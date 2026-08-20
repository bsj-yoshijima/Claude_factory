#!/usr/bin/env bash
# Cloud Run へのデプロイ。判定と実行はここに集約してある。
#
#   bash tools/deploy.sh              事前チェックだけ（何も変更しない）
#   bash tools/deploy.sh --deploy     チェックが全部通ったらデプロイする
#   bash tools/deploy.sh --deploy --migrate
#                                     スキーマの世代が上がっているとき、migrate も実行する
#
# 既定を「チェックだけ」にしているのは、うっかり実行でデプロイが走らないようにするため。
#
# 環境変数を触らないのが要点。gcloud run deploy に --set-env-vars を渡すと
# 既存の環境変数が全置換されて PUBLIC_URL が消えるので、このスクリプトは
# --source とリージョンしか指定しない（他の設定はサービス側の値が維持される）。
set -euo pipefail

SERVICE="${SERVICE:-claude-factory}"
REGION="${REGION:-asia-northeast1}"

# gcloud は Homebrew の cask だとログインシェル以外の PATH に入っていないことがある
export PATH="$PATH:/opt/homebrew/share/google-cloud-sdk/bin:/usr/local/share/google-cloud-sdk/bin"

DO_DEPLOY=0; DO_MIGRATE=0
for a in "$@"; do
  case "$a" in
    --deploy)  DO_DEPLOY=1 ;;
    --migrate) DO_MIGRATE=1 ;;
    *) echo "不明な引数: $a"; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
FAIL=0
ok()   { printf '  ✅ %s\n' "$*"; }
warn() { printf '  ⚠️  %s\n' "$*"; }
bad()  { printf '  ❌ %s\n' "$*"; FAIL=1; }

echo
echo "=== 事前チェック（service=$SERVICE region=${REGION}）==="

# 1. ブランチと作業ツリー
BRANCH=$(git branch --show-current)
[ "$BRANCH" = "main" ] && ok "ブランチは main" || bad "ブランチが main ではない（${BRANCH}）"
[ -z "$(git status --porcelain)" ] && ok "作業ツリーはクリーン" \
  || bad "コミットしていない変更がある（デプロイされるのは作業ツリーの内容なので、意図しないものが混ざる）"

# 2. origin/main と一致しているか（pull 忘れ / push 忘れの検出）
git fetch -q origin 2>/dev/null || warn "git fetch に失敗した（オフライン？）"
LOCAL=$(git rev-parse HEAD); REMOTE=$(git rev-parse origin/main 2>/dev/null || echo '')
if [ -z "$REMOTE" ]; then warn "origin/main が取れなかった"
elif [ "$LOCAL" = "$REMOTE" ]; then ok "origin/main と一致（$(git log --oneline -1 | cut -c1-60)）"
else
  AHEAD=$(git rev-list --count origin/main..HEAD); BEHIND=$(git rev-list --count HEAD..origin/main)
  bad "origin/main とずれている（未 push $AHEAD / 未取り込み ${BEHIND}）"
fi

# 3. gcloud の状態
ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -1 || true)
[ -n "$ACCOUNT" ] && ok "gcloud 認証済み（${ACCOUNT}）" || bad "gcloud が未認証（gcloud auth login）"
PROJECT=$(gcloud config get-value project 2>/dev/null || true)
[ -n "$PROJECT" ] && ok "プロジェクト: $PROJECT" || bad "プロジェクトが未設定（gcloud config set project）"

# 4. Dockerfile が .gcloudignore で除外されていないか（一度これで落ちた）
if [ -f .gcloudignore ] && grep -qE '^[[:space:]]*Dockerfile[[:space:]]*$' .gcloudignore; then
  bad ".gcloudignore が Dockerfile を除外している（Cloud Build がビルドできない）"
else
  ok ".gcloudignore は Dockerfile を除外していない"
fi

# 5. テスト
if npm test >/tmp/cf-deploy-test.log 2>&1; then
  ok "テスト通過（$(grep -oE '[0-9]+/[0-9]+ 件 通過' /tmp/cf-deploy-test.log | tail -1)）"
else
  bad "テストが失敗している（詳細: /tmp/cf-deploy-test.log）"
fi

# 6. スキーマの世代。コードが要求する版と、いま DB に当たっている版を比べる
CODE_V=$(node -e 'import("./db/version.mjs").then(m=>console.log(m.SCHEMA_VERSION))')
DB_V=$(node --env-file-if-exists=.env -e '
  import("./server/db.mjs").then(async ({one,pool})=>{
    let v=0; try{ v=(await one("SELECT version FROM schema_meta WHERE id=1"))?.version ?? 0; }catch{}
    console.log(v); await pool.end();
  })' 2>/dev/null | tail -1)
if [ "$CODE_V" = "$DB_V" ]; then
  ok "スキーマの世代が一致（コード v$CODE_V / DB v${DB_V}）"
elif [ "$DB_V" -lt "$CODE_V" ] 2>/dev/null; then
  if [ "$DO_MIGRATE" = 1 ]; then
    warn "DB が古い（v$DB_V → v${CODE_V}）。--migrate が指定されているので流す"
  else
    bad "DB が古い（v$DB_V / コード v${CODE_V}）。このまま出すと新リビジョンが起動に失敗する → --migrate を付けるか npm run db:migrate を先に実行する"
  fi
else
  warn "DB のほうが新しい（DB v$DB_V / コード v${CODE_V}）。古いコードを出すことになる"
fi

echo
if [ "$FAIL" = 1 ]; then
  echo "  ⛔ チェックに失敗しました。デプロイしません。"
  exit 1
fi
echo "  チェックはすべて通りました。"

if [ "$DO_DEPLOY" != 1 ]; then
  echo "  （--deploy が指定されていないので、ここで終了します）"
  echo
  exit 0
fi

# ---- ここから先が実際の変更 ----
if [ "$DO_MIGRATE" = 1 ] && [ "$CODE_V" != "$DB_V" ]; then
  echo
  echo "=== スキーマを当てる ==="
  npm run db:migrate
fi

echo
echo "=== デプロイ ==="
gcloud run deploy "$SERVICE" --source . --region "$REGION" --quiet

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')
REV=$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.latestReadyRevisionName)')

echo
echo "=== 事後確認 ==="
echo "  リビジョン: $REV"
echo "  URL: $URL"

# 環境変数が消えていないか（--set-env-vars を使っていないので消えないが、念のため見る）
ENVS=$(gcloud run services describe "$SERVICE" --region "$REGION" \
  --format='value(spec.template.spec.containers[0].env[].name)' 2>/dev/null | tr ';' ' ')
case "$ENVS" in
  *PUBLIC_URL*) ok "PUBLIC_URL が維持されている" ;;
  *) bad "PUBLIC_URL が消えている（Cookie の Secure と OAuth のリダイレクトが壊れる）" ;;
esac

HEALTH=$(curl -s -m 30 "$URL/api/health" || echo '')
case "$HEALTH" in
  *'"db":"up"'*) ok "DB に繋がっている" ;;
  *) bad "/api/health が異常: $(printf '%s' "$HEALTH" | head -c 200)" ;;
esac
case "$HEALTH" in
  *'"google":true'*) ok "Google SSO が有効" ;;
  *) bad "SSO が無効になっている（dev ログインが開いている可能性）" ;;
esac

# 配信されているコードが手元と同じか。ビルドの取り違えを検出する
for f in game/app.mjs game/craft.mjs; do
  L=$(shasum -a 256 "$f" | cut -d' ' -f1)
  R=$(curl -s -m 30 "$URL/$f" | shasum -a 256 | cut -d' ' -f1)
  [ "$L" = "$R" ] && ok "$f が手元と一致" || bad "$f が手元と違う（配信 $R / 手元 ${L}）"
done

echo
[ "$FAIL" = 1 ] && { echo "  ⚠️  デプロイは完了したが、事後確認に問題があります。"; exit 1; }
echo "  ✅ デプロイ完了。"
echo

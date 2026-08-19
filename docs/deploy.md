# Cloud Run へのデプロイ

DB（Neon）はすでにクラウドにあるので、**アプリを Cloud Run に乗せれば「ローカルでサーバを
立てなくてよい」状態になる**。DB は移さないので、データもユーザーもそのまま引き継がれる。

変わるのは実質 `PUBLIC_URL` だけ。→ [phase1-setup.md](phase1-setup.md) の続き。

---

## 前提

- Neon の共有DBが動いていること（`DATABASE_URL`）
- Google OAuth クライアントがあること（`GOOGLE_CLIENT_ID` / `_SECRET`）
- GCP プロジェクトに**請求先アカウントが紐付いていること**（使用量が $0 でも必須）
- `gcloud` が入っていること（`gcloud --version`）

## この構成の要点

| | 値 | 理由 |
|---|---|---|
| `--max-instances` | **1（必須）** | `oauthStates`（[index.mjs](../server/index.mjs)）と `lastQs`（[ingest-otel.mjs](../server/ingest-otel.mjs)）がプロセス内 Map。複数インスタンスだとログインが確率で失敗し、query_source が欠ける |
| `--min-instances` | 0 か 1 | 0 なら無料枠内だが初回が2〜3秒待たされる。1 は月$10前後 |
| リージョン | `asia-northeast1` | 東京。DB はシンガポールなので往復77msは残る |
| 認証 | `--allow-unauthenticated` | 画面は Google SSO、取り込みはトークンでアプリ側が守る |

`min-instances=0` にする場合、業務時間中は各自の Claude Code から10秒おきに OTLP が
飛ぶので実質ウォームのままになる。落ちるのは夜間と休日だけ。

---

## 1. 初期設定（1回だけ）

```bash
gcloud auth login
gcloud config set project <プロジェクトID>
gcloud config set run/region asia-northeast1
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com
```

## 2. シークレットを置く

接続文字列と OAuth シークレットは `--set-env-vars` に書かず、Secret Manager に入れる
（コマンド履歴とデプロイ設定に平文で残さないため）。

```bash
printf '%s' 'postgres://…neon…?sslmode=require' | \
  gcloud secrets create DATABASE_URL --data-file=-
printf '%s' 'GOCSPX-…' | \
  gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-
```

Cloud Run のサービスアカウントに読み取りを許可する。

```bash
PROJECT_NUMBER=$(gcloud projects describe "$(gcloud config get-value project)" --format='value(projectNumber)')
for S in DATABASE_URL GOOGLE_CLIENT_SECRET; do
  gcloud secrets add-iam-policy-binding "$S" \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
    --role=roles/secretmanager.secretAccessor
done
```

## 3. スキーマを当てる

**コンテナは DB の構造を書き換えない**（サーバは起動時に世代を確認して止まるだけ）。
先に手元から流しておく。

```bash
npm run db:migrate      # .env の DATABASE_URL = Neon を見る
```

## 4. 1回目のデプロイ

`PUBLIC_URL` は Cloud Run の URL だが、URL は作られるまで分からない。
**1回目は仮で上げて、URL が出てから入れ直す。**

```bash
gcloud run deploy claude-factory \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --max-instances 1 \
  --min-instances 0 \
  --memory 512Mi \
  --set-env-vars 'GOOGLE_CLIENT_ID=…apps.googleusercontent.com,GOOGLE_HD=bravesoft.co.jp,DEV_LOGIN=0,DEV_UNLOCK_EMAILS=…' \
  --set-secrets 'DATABASE_URL=DATABASE_URL:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest'
```

`--source .` は Dockerfile を見て Cloud Build 側でビルドしてくれる（ローカルに docker は不要）。
上がる量は `.gcloudignore` が効いて **95MB → 49MB**。

## 5. URL を確定させる

```bash
URL=$(gcloud run services describe claude-factory --region asia-northeast1 --format='value(status.url)')
echo "$URL"
gcloud run services update claude-factory --region asia-northeast1 \
  --update-env-vars "PUBLIC_URL=$URL"
```

`PUBLIC_URL` が `https://` になると Cookie に Secure が付き、`/setup` が配る OTLP の
エンドポイントも自動でこの URL になる（[index.mjs](../server/index.mjs) の `SECURE`）。

## 6. OAuth のリダイレクト URI を足す

Google Cloud Console → 認証情報 → 該当のクライアント → 承認済みのリダイレクト URI に
**追加**する（`http://localhost:4321/...` は消さない。消すとローカル開発で SSO が使えなくなる）。

```
<URL>/auth/google/callback
```

## 7. 動作確認

```bash
curl -s "$URL/api/health"
```

`db: "up"` と `auth.google: true`、`auth.devLogin: false` を確認する。
そのあとブラウザで `$URL` を開いてログインする。

## 8. メンバーへの周知

`$URL/setup` に出る JSON で **`OTEL_EXPORTER_OTLP_ENDPOINT` と hooks 4つの `curl` の URL** を
差し替えて、**新しい claude セッションを起動**してもらう。

**トークンは変わらない**（同じ Neon を使い続けるため）。URL の置換だけで済む。

これ以降、メンバーはローカルでサーバを立てる必要がない。

---

## 残っている宿題

デプロイ自体には要らないが、乗せたあとに効いてくるもの。

| # | 項目 | 影響 |
|---|---|---|
| 1 | **`ingest_seen` の刈り取り**（`docs/multiuser.md` の残件4） | 5日で36,000行・8MB。DB の約半分がこれ。毎時タイマーは `min-instances=0` だと動かないので、**リクエスト契機**にする |
| 2 | `dev-server.log` への追記（[index.mjs](../server/index.mjs) の `recordDeath`） | Cloud Run では消えるだけだが、無意味にメモリを使う。標準出力に寄せる |
| 3 | `oauthStates` / `lastQs` を DB か Cookie に移す | これができるまで `--max-instances 1` から出られない |
| 4 | GitHub Actions での自動デプロイ | 手動 `gcloud run deploy` が通ってから。Workload Identity 連携で鍵ファイルを置かない |
| 5 | dev / prod の2環境化 | Neon のブランチ機能で DB を分け、Cloud Run サービスを2つにする |

## ロールバック

```bash
gcloud run revisions list --service claude-factory --region asia-northeast1
gcloud run services update-traffic claude-factory --region asia-northeast1 --to-revisions <前のリビジョン>=100
```

スキーマを変えたデプロイを戻す場合は、**DB は戻らない**ことに注意する。
`schema_meta.version` はコード側より新しいままなので、古いコードは警告を出して起動する
（追加は additive なので動く）。

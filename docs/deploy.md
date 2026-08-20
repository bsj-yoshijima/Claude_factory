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

秘密でない値も `.env` から読ませて、手でコピペしない（履歴に残さない）。

```bash
CID=$(grep '^GOOGLE_CLIENT_ID=' .env | sed 's/^[^=]*=//')
HD=$(grep '^GOOGLE_HD=' .env | sed 's/^[^=]*=//')
UNLOCK=$(grep '^DEV_UNLOCK_EMAILS=' .env | sed 's/^[^=]*=//')
# 先頭の ^|^ で区切り文字をパイプに変える。DEV_UNLOCK_EMAILS の値にカンマが
# 入っているので、既定のカンマ区切りのままだと gcloud が別の変数として解釈して落ちる
ENVS="^|^DEV_LOGIN=0|GOOGLE_CLIENT_ID=${CID}|GOOGLE_HD=${HD}|DEV_UNLOCK_EMAILS=${UNLOCK}"

gcloud run deploy claude-factory \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --max-instances 1 \
  --min-instances 0 \
  --memory 512Mi \
  --set-env-vars "$ENVS" \
  --set-secrets 'DATABASE_URL=DATABASE_URL:latest,GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest'
```

`--source .` は Dockerfile を見て Cloud Build 側でビルドしてくれる（ローカルに docker は不要）。
上がる量は `.gcloudignore` が効いて **95MB → 48MB**。

> **`.gcloudignore` に `Dockerfile` を書かないこと。** Cloud Build はアップロードされた
> コンテキストの中の Dockerfile を読むので、除外すると
> `unable to evaluate symlinks in Dockerfile path: lstat /workspace/Dockerfile` で落ちる。

## 5. URL を確定させる

```bash
URL=$(gcloud run services describe claude-factory --region asia-northeast1 --format='value(status.url)')
echo "$URL"
gcloud run services update claude-factory --region asia-northeast1 \
  --update-env-vars "PUBLIC_URL=$URL"
```

`PUBLIC_URL` が `https://` になると Cookie に Secure が付き、`/setup` が配る OTLP の
エンドポイントも自動でこの URL になる（[index.mjs](../server/index.mjs) の `SECURE`）。

> **Cloud Run は URL を2形式発行する。** `status.url`（`claude-factory-<ハッシュ>-an.a.run.app`）と、
> デプロイ出力に出る `claude-factory-<プロジェクト番号>.asia-northeast1.run.app`。どちらも同じ
> サービスに届く。OAuth のリダイレクト先は `PUBLIC_URL` から組み立てられるので、
> **`PUBLIC_URL` に入れたほうを正とし、そちらをリダイレクト URI に登録する**
> （両方登録しておくとどちらで開いてもログインできる）。

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
| 1 | `dev-server.log` への追記（[index.mjs](../server/index.mjs) の `recordDeath`） | Cloud Run では消えるだけだが、無意味にメモリを使う。標準出力に寄せる |
| 2 | `oauthStates` / `lastQs` を DB か Cookie に移す | これができるまで `--max-instances 1` から出られない。**人数を増やすときの最初の前提**（→ [scale.md](scale.md)） |
| 3 | dev / prod の2環境化 | Neon のブランチ機能で DB を分け、Cloud Run サービスを2つにする |

自動デプロイ（GitHub Actions + Workload Identity）は**やらないことにした**。マージと
デプロイを切り離して「意図したタイミングで出す」ほうが運用に合うため、
`bash tools/deploy.sh` とスキル（`.claude/skills/deploy`）から手元で叩く形にしている。

### 古い行の掃除について

`agent_sessions`（7日）と `ingest_seen`（2日）は、**起動時に1回 + 毎時**で掃除される。

`min-instances=0` でも、誰かが工場の画面を開いていればブラウザが5秒おきに叩くので
インスタンスは起きたままで、毎時タイマーも回る。加えて Cloud Run はトラフィックが
あってもインスタンスを作り直すことがあり、そのたびにタイマーのカウントは
ゼロに戻るので、**起動時にも1回走らせて**取りこぼさないようにしてある。

## 費用の測り方（一度間違えたので手順を残す）

リクエストログから測れる。ただし **レイテンシの単純合計は課金額の目安にならない。**
Cloud Run は**同時に処理したぶんを1インスタンス時間として数える**ので、
区間を重ね合わせて測る必要がある。

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="claude-factory" AND logName:"requests"' \
  --freshness=90m --limit=5000 --format='csv[no-heading](timestamp,httpRequest.latency)'
```

`timestamp` は**完了時刻**なので、開始は `timestamp - latency`。この区間を
マージした総和が課金対象に近い。

実測（稼働88分・工場画面を1回開いた状態）:

| | 値 |
|---|---|
| レイテンシの単純合計 | 464秒 |
| **区間をマージした実時間** | **205秒**（単純合計の 2.3分の1） |
| 月換算 | 約10万秒 / 無料枠 18万 vCPU秒 → **56%** |

夜間・休日は claude も止まるので、実際はこれより小さい。

### 静的ファイルの 304 が 189ms かかるのは正常

同じ実測での内訳:

| 種別 | 回数 | 1回 | 転送量 |
|---|---|---|---|
| assets 304 | 1,111 | 189ms | 0.2MB |
| assets 200 | 43 | 471ms | 46.9MB |

**304 は本文を読まずに返しているのに189ms**かかる。サーバの実装が遅いのではなく、
**単一 vCPU（`--max-instances 1`）に500超のリクエストが同時に来て CPU を分け合う**ため。
1件あたりの実処理は1ms未満でも、同時数で割られてレイテンシが膨らむ。

課金は重ね合わせで数えるので、**この189msは費用にはほぼ影響しない**（上の205秒がその答え）。
初回ロードが数秒遅くなるだけで、そこには起動中の目隠しが出る。直すなら
アセットのリクエスト数自体を減らす（スプライトシート化）か Cloud CDN を前に置く。

## ロールバック

```bash
gcloud run revisions list --service claude-factory --region asia-northeast1
gcloud run services update-traffic claude-factory --region asia-northeast1 --to-revisions <前のリビジョン>=100
```

スキーマを変えたデプロイを戻す場合は、**DB は戻らない**ことに注意する。
`schema_meta.version` はコード側より新しいままなので、古いコードは警告を出して起動する
（追加は additive なので動く）。

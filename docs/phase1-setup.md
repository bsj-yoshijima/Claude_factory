# Phase 1 セットアップ — 共有 DB + Google SSO（ホスティングはまだしない）

サーバは各自の PC で動かしたまま、**DB だけをクラウドに置いて全員で共有する**段階。
ここで確認したいのは 2 つだけ。

1. **Google SSO が実物として動くこと**（モックの dev ログインではなく）
2. **複数人が 1 つの DB を共有して、リーダーボードが正しく動くこと**

Cloud Run へ移すのは、この 2 つが確認できてから（→ [multiuser.md](multiuser.md)）。

```
Aさんの PC:  claude → localhost:4321 ─┐
Bさんの PC:  claude → localhost:4321 ─┼→ Neon（共有 Postgres）→ リーダーボード
Cさんの PC:  claude → localhost:4321 ─┘
```

DB を最初からクラウドに置くのが要点。**Phase 2 では DB を移さない**ので、
「ローカル → クラウド」の移行作業もデータ移行も発生しない。変わるのは `PUBLIC_URL` だけ。

---

## 費用

**$0。** Neon の無料枠と、Google の OAuth クライアント（課金対象外）だけを使う。

---

## オーナーの作業

### 1. Neon で共有 Postgres を作る

1. https://neon.tech でサインアップ（GitHub アカウントで入れる）
2. プロジェクトを作成。**リージョンは `Asia Pacific (Singapore)`** を選ぶ（東京は無料枠に無い）
3. PostgreSQL のバージョンは **16** を選ぶ（`db/schema.sql` の前提）
4. ダッシュボードの Connection string をコピーする

接続文字列は 2 種類出てくる。**Phase 1 では pooler が付いていないほう（直接接続）を使う。**

```
postgres://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
                          ^^^^^^^ ここに -pooler が入っていないもの
```

pooler 版はトランザクション単位で接続を貸す仕組みのため、`tools/migrate.mjs` が使う
セッション単位の `pg_advisory_lock` が正しく効かない。人数が増えて接続が足りなく
なったら、そのとき pooler に切り替える（migrate だけ直接接続に残す）。

**タイムゾーン**: 日次バケットは JST で切っている。Neon は UTC 固定なので、
`db/schema.sql` 側で `AT TIME ZONE` を使っている箇所（`server/time.mjs` の `jstDay`）が
そのまま効く。DB 側の設定変更は不要。

### 2. スキーマを流す

自分の `.env` に接続文字列を入れて（雛形は後述）、

```bash
npm run db:migrate
```

接続先が表示されるので、**手元の docker ではなく Neon を指していることを必ず確認する。**

```
  接続先: postgres://USER:****@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb
  スキーマ: v未初期化 → v1
  重み    : wp_weights を同期しました
```

### 3. Google OAuth クライアントを作る

1. Google Cloud Console → **APIとサービス** → **OAuth 同意画面**
   - User Type: **内部**（社内ドメインのみなのでこれで足りる。審査も不要）
2. **認証情報** → **認証情報を作成** → **OAuth クライアント ID**
   - アプリケーションの種類: **ウェブアプリケーション**
   - 承認済みのリダイレクト URI に **これを登録**:
     ```
     http://localhost:4321/auth/google/callback
     ```
3. 発行された **クライアント ID** と **クライアントシークレット** を控える

`http://` は通常 Google に拒否されるが、**`localhost` だけは例外として許可されている**。
Phase 1 が成立する理由がこれ。逆に `http://192.168.x.x:4321/...` は登録できないので、
「1 人の PC を立てて LAN で共有」はできない（全員が各自ローカルで立てる形にする）。

Phase 2 に移るときは、この同じクライアントに Cloud Run の URL を**追加**すればよい。
localhost を消さずに両方登録しておけば、移行後もローカル開発が壊れない。

### 4. メンバーに配る

配るのは次の 3 つ。**シークレットを含むので Slack の平文ではなく、1Password などの
社内の正規手段で渡す。**

| 項目 | 備考 |
|---|---|
| `DATABASE_URL` | Neon の接続文字列（直接接続版） |
| `GOOGLE_CLIENT_ID` | |
| `GOOGLE_CLIENT_SECRET` | **SSO を検証する人にだけ**渡せばよい（次項） |

#### SSO を全員に配る必要はない

Phase 1 で見たいものは 2 つあり、**必要な人が違う**。

| 検証したいこと | 必要なもの | 対象 |
|---|---|---|
| Google SSO が動くか | `GOOGLE_CLIENT_*` | **オーナー + 1〜2 人**で足りる |
| リーダーボードが動くか | `DATABASE_URL` だけ | **全員** |

`GOOGLE_CLIENT_ID` を設定しない人は dev ログイン（メールアドレスを入れるだけ）に
なるが、**同じ共有 DB に入るのでリーダーボードには正しく並ぶ**。ユーザーはメール
アドレスで同定されるので、後から SSO に切り替えても同じ工場・同じ実績が引き継がれる。

Phase 1 で全員に OAuth クライアントシークレットを配る必要はない、ということ。

---

## メンバーの作業

### 1. `.env` を作る

リポジトリ直下に `.env` を作り、オーナーから渡された値を入れる。
（`.gitignore` 済みなのでコミットされない）

```sh
# 共有 DB。オーナーから渡された接続文字列をそのまま
DATABASE_URL=postgres://USER:PASSWORD@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# 各自のサーバから繋ぐので、1人あたりの接続数を絞る
PG_POOL_MAX=3

# --- ここから下は SSO を検証する人だけ。無ければ dev ログインで動く ---
#GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
#GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx
#GOOGLE_HD=bravesoft.co.jp
```

### 2. 起動する

```bash
npm install && npm run dev
```

`docker compose` は**起動しなくてよい**（DB は Neon にあるため）。
`npm run db:migrate` も**実行しない**（オーナーだけの操作）。

起動ログで認証の種類が分かる。

```
  🏭 Claude Factory (マルチユーザー版)
  → http://localhost:4321
  認証  : Google SSO (bravesoft.co.jp 限定)      ← SSO 有効
  認証  : dev ログイン（GOOGLE_CLIENT_ID 未設定のため）  ← dev ログイン
```

### 3. Claude Code を繋ぐ

http://localhost:4321 を開いてログイン → `/setup` に出る JSON を
`~/.claude/settings.json` にマージ → **新しい claude セッションを起動**する
（起動中のセッションには反映されない）。

エンドポイントは自分の `localhost:4321` になる。OTLP は自分のサーバが受けて、
共有 DB に自分の `user_id` で書き込む。

### 4. コードが更新されたとき

```bash
git pull && npm run dev
```

これだけ。スキーマ変更があった場合は起動時に止まって教えてくれる。

```
  ⛔ DB のスキーマが古いため起動できません（DB: v1 / コード: v2）
     オーナーが npm run db:migrate を実行するまでお待ちください。
```

この場合はオーナーに連絡して、migrate が済んでからもう一度 `npm run dev` する。

---

## 確認する項目

| # | 見るもの | 期待 |
|---|---|---|
| 1 | SSO でログイン | 社内アカウントだけがアカウント選択に出る（`GOOGLE_HD`） |
| 2 | 社外アカウントでログイン | 弾かれる |
| 3 | 2 人以上が claude を動かす | リーダーボードに両方が並ぶ |
| 4 | 他人の WP | **自分のぶんと混ざっていない**（旧実装のバグはここだった） |
| 5 | 自分の工場 | 他人のログインで書き換わらない |
| 6 | `identity_mismatches` テーブル | 空であること（OTLP の自己申告メールとトークンの食い違い） |
| 7 | 全員が同時に `npm run dev` | 接続エラーが出ない（`PG_POOL_MAX`） |

---

## ハマりどころ

**`sslmode=require` を消さない。** Neon は TLS 必須。接続文字列から落とすと繋がらない。

**Neon の無料枠は 5 分アクセスが無いと DB がサスペンドする。** 復帰に数秒かかるので、
朝イチの初回リクエストだけ遅い。`waitForDb()` が待つので失敗はしない。

**`docker compose` を起動したままだと紛らわしい。** `.env` に `DATABASE_URL` があれば
Neon を見るので実害は無いが、`npm run db:psql` は**ローカルの docker に入る**コマンド
なので、共有 DB を覗きたいときは Neon のコンソールか `psql "$DATABASE_URL"` を使う。

**`.env not found. Continuing without it.` はエラーではない。** `.env` を置いていない
（＝ローカル完結で使っている）ときに Node が出す案内で、既定値で正常に起動している。

**ローカル完結に戻したいとき**は `.env` の `DATABASE_URL` をコメントアウトして
`npm run db:up`。既定値の docker に戻る。切り替えは何度でもできる。

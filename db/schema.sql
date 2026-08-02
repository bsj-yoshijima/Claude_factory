-- Claude Factory — マルチユーザー版スキーマ (PostgreSQL 16)
--
-- 設計の要点:
--   1. WP は「重み付け後の値」ではなく「重みをかける前のカウント」を分バケットで持つ。
--      → 重みを変えれば全期間が即座に再集計される（WP.md §6 の性質を保ったまま、
--         生ログ 24MB/日/人 を数KB/日/人 に圧縮する）
--   2. 集計はすべて user_id で分割する。旧 otel.mjs の wpTotal は全ユーザー合算だった。
--   3. 💰・図鑑・在庫はサーバだけが書き換える。クライアントは結果を受け取るだけ。

-- ============================== 認証・識別 ==============================
CREATE TABLE IF NOT EXISTS users (
  id          bigserial PRIMARY KEY,
  email       text NOT NULL UNIQUE,
  google_sub  text UNIQUE,                     -- Google OIDC の sub。dev ログインでは NULL
  name        text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ブラウザのログインセッション（Cookie に入れる不透明トークン）
CREATE TABLE IF NOT EXISTS auth_sessions (
  token       text PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

-- Claude Code からの取り込み用トークン。
-- ★ 集計のキーは必ずここから引いた user_id を使う。OTLP ペイロードの user.email は
--    クライアントの自己申告なので、照合にしか使わない（なりすまし防止）。
CREATE TABLE IF NOT EXISTS ingest_tokens (
  token       text PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  revoked_at  timestamptz,
  last_seen_at timestamptz
);
CREATE INDEX IF NOT EXISTS ingest_tokens_user ON ingest_tokens(user_id);

-- ペイロードの user.email がトークンの持ち主と食い違った記録（監査用）
CREATE TABLE IF NOT EXISTS identity_mismatches (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed     text NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);

-- ============================== 工場 ==============================
CREATE TABLE IF NOT EXISTS factories (
  user_id      bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- 工場名。空文字なら画面側で「◯◯の工場」を既定表示にする
  name         text NOT NULL DEFAULT '',
  money        bigint NOT NULL DEFAULT 0,
  bg           text NOT NULL DEFAULT 'auto',
  floor        text NOT NULL DEFAULT 'wood',
  bg_owned     text[] NOT NULL DEFAULT ARRAY['auto'],
  floor_owned  text[] NOT NULL DEFAULT ARRAY['wood'],
  series_owned text[] NOT NULL DEFAULT ARRAY[]::text[],
  -- prop / deco の配置と在庫。関係を持たないので jsonb で十分
  props        jsonb NOT NULL DEFAULT '[]'::jsonb,
  stock        jsonb NOT NULL DEFAULT '{"machine":{},"prop":{},"deco":{}}'::jsonb,
  emoji_decos  jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- 製造の進み。wp_mark = 前回 tick 時点の「その人の累計WP」
  wp_mark      double precision NOT NULL DEFAULT 0,
  wp_mark_init boolean NOT NULL DEFAULT false,   -- 初回は遡らない（基準を取るだけ）
  last_tick_at timestamptz NOT NULL DEFAULT now(),
  -- 工場の「形」が変わるたびに +1 する版番号。ポーリングの度に配置・在庫・所持品を
  -- 送り直さないための仕組み（実測でレスポンスの 67% がこの不変部分だった）。
  -- クライアントは自分が持っている rev を送り、一致していればサーバは factory を省略する。
  rev          bigint NOT NULL DEFAULT 0
);
-- 既存DB向け（CREATE TABLE は IF NOT EXISTS なので後から足した列はここで追加する）
ALTER TABLE factories ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
ALTER TABLE factories ADD COLUMN IF NOT EXISTS rev bigint NOT NULL DEFAULT 0;

-- 製造機だけは行にする（running / wp を機械ごとに持つため）。
-- ★ id はクライアントが生成するレイアウトIDなので、主キーは必ず (user_id, id)。
--   id 単独にすると他人と同じIDを送るだけで相手の機械を書き換えられる。
CREATE TABLE IF NOT EXISTS machines (
  id       text NOT NULL,
  user_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sub      text NOT NULL,                       -- 's2'..'s5' = マス数
  dir      text NOT NULL DEFAULT 'u',
  cx       integer NOT NULL DEFAULT 0,
  cy       integer NOT NULL DEFAULT 0,
  lvl      integer NOT NULL DEFAULT 1,
  running  boolean NOT NULL DEFAULT false,
  wp       double precision NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);

CREATE TABLE IF NOT EXISTS machine_slots (
  user_id    bigint NOT NULL,
  machine_id text NOT NULL,
  idx        integer NOT NULL,
  mat_id     text,
  PRIMARY KEY (user_id, machine_id, idx),
  FOREIGN KEY (user_id, machine_id) REFERENCES machines(user_id, id) ON DELETE CASCADE
);

-- 旧定義（id 単独の主キー）で作られていたら作り直す。
-- 配置はクライアントから再送されるので、開発中に捨てても復旧できる。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index i
     WHERE i.indrelid = 'machines'::regclass AND i.indisprimary
       AND array_length(i.indkey::int[], 1) = 1
  ) THEN
    DROP TABLE machine_slots;
    DROP TABLE machines;
    RAISE NOTICE 'machines を (user_id, id) 主キーで作り直しました';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS machines (
  id       text NOT NULL,
  user_id  bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sub      text NOT NULL,
  dir      text NOT NULL DEFAULT 'u',
  cx       integer NOT NULL DEFAULT 0,
  cy       integer NOT NULL DEFAULT 0,
  lvl      integer NOT NULL DEFAULT 1,
  running  boolean NOT NULL DEFAULT false,
  wp       double precision NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, id)
);
CREATE TABLE IF NOT EXISTS machine_slots (
  user_id    bigint NOT NULL,
  machine_id text NOT NULL,
  idx        integer NOT NULL,
  mat_id     text,
  PRIMARY KEY (user_id, machine_id, idx),
  FOREIGN KEY (user_id, machine_id) REFERENCES machines(user_id, id) ON DELETE CASCADE
);

-- ============================== 成果 ==============================
CREATE TABLE IF NOT EXISTS products_made (
  id          bigserial PRIMARY KEY,
  user_id     bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  text NOT NULL,
  machine_id  text,
  recipe_key  text NOT NULL DEFAULT '',
  made_at     timestamptz NOT NULL DEFAULT now(),
  viewed      boolean NOT NULL DEFAULT false    -- false = 🎁完成品の新着
);
CREATE INDEX IF NOT EXISTS products_made_user_at ON products_made(user_id, made_at DESC);
CREATE INDEX IF NOT EXISTS products_made_unviewed ON products_made(user_id) WHERE NOT viewed;

-- 図鑑。first_at を持つ（旧実装は個数だけで初取得日が残らなかった）
CREATE TABLE IF NOT EXISTS dex (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  count      integer NOT NULL DEFAULT 0,
  first_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id)
);

-- ガチャ景品の在庫
CREATE TABLE IF NOT EXISTS inventory (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  qty     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, item_id)
);

-- 売上（JST の暦日ごと）。7日トリムは廃止 → 月次実績が出せる
CREATE TABLE IF NOT EXISTS sales_daily (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     date NOT NULL,
  amount  bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- ============================== エージェント ==============================
-- hooks (SessionStart / UserPromptSubmit / Stop / SessionEnd) が書き込む。
-- OTel には cwd を示す属性が存在しないため、project 名は hook でしか取れない。
-- ★ 主キーは (user_id, session_id)。session_id だけにすると、他人と同じ session_id を
--   名乗るだけで相手の行を書き換えられてしまう（マルチテナントの分離が壊れる）。
CREATE TABLE IF NOT EXISTS agent_sessions (
  session_id    text NOT NULL,
  user_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project       text NOT NULL DEFAULT '',
  state         text NOT NULL DEFAULT 'idle',   -- 'busy' | 'idle' | 'ended'
  -- 一度でも働いたか。実測で 207セッション中 191 が1分未満なので、
  -- 「起動しただけで何もしなかった」セッションは短い時間で工場から下げる
  ever_busy     boolean NOT NULL DEFAULT false,
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  PRIMARY KEY (user_id, session_id)
);
ALTER TABLE agent_sessions ADD COLUMN IF NOT EXISTS ever_busy boolean NOT NULL DEFAULT false;
-- 旧定義（session_id 単独の主キー）で作られていたら作り直す。
-- 在/不在は数秒で再構築される揮発データなので、捨てても失うものが無い。
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_index i
     WHERE i.indrelid = 'agent_sessions'::regclass AND i.indisprimary
       AND array_length(i.indkey::int[], 1) = 1
  ) THEN
    DROP TABLE agent_sessions;
    RAISE NOTICE 'agent_sessions を (user_id, session_id) 主キーで作り直しました';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS agent_sessions (
  session_id    text NOT NULL,
  user_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project       text NOT NULL DEFAULT '',
  state         text NOT NULL DEFAULT 'idle',
  ever_busy     boolean NOT NULL DEFAULT false,
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  ended_at      timestamptz,
  PRIMARY KEY (user_id, session_id)
);
CREATE INDEX IF NOT EXISTS agent_sessions_user ON agent_sessions(user_id, last_event_at DESC);

-- 頭アクセサリ。プロジェクト単位で保持する（旧実装の G.skins[proj] 相当）
CREATE TABLE IF NOT EXISTS skins (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project text NOT NULL,
  skin_id text NOT NULL,
  PRIMARY KEY (user_id, project)
);

-- ============================== WP の素材 ==============================
-- ★ここが設計の肝。重みをかける「前」のカウントを分バケットで持つ。
CREATE TABLE IF NOT EXISTS wp_source_minute (
  user_id      bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minute_ts    bigint NOT NULL,                  -- epoch 分
  tool_name    text NOT NULL,
  is_subagent  boolean NOT NULL,
  ok_count     integer NOT NULL DEFAULT 0,
  ng_count     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, minute_ts, tool_name, is_subagent)
);
CREATE INDEX IF NOT EXISTS wp_source_minute_user ON wp_source_minute(user_id, minute_ts);

CREATE TABLE IF NOT EXISTS wp_metric_minute (
  user_id       bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  minute_ts     bigint NOT NULL,
  lines_added   double precision NOT NULL DEFAULT 0,
  lines_removed double precision NOT NULL DEFAULT 0,
  commits       double precision NOT NULL DEFAULT 0,
  prs           double precision NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, minute_ts)
);

-- 重み。ここを UPDATE するだけで全期間の WP が変わる（再取り込み不要）
CREATE TABLE IF NOT EXISTS wp_weights (
  kind   text NOT NULL,          -- 'tool' | 'metric' | 'config'
  key    text NOT NULL,
  weight double precision NOT NULL,
  PRIMARY KEY (kind, key)
);

-- 分ごとの WP（上限適用後）。重み表を参照するので VIEW にしてある。
-- 本番で履歴が伸びたらこの定義のまま日次でマテリアライズすればよい。
CREATE OR REPLACE VIEW wp_minute AS
WITH cfg AS (
  SELECT
    COALESCE((SELECT weight FROM wp_weights WHERE kind='config' AND key='perMinuteCap'), 200) AS cap,
    COALESCE((SELECT weight FROM wp_weights WHERE kind='config' AND key='subagentFactor'), 0.5) AS subf,
    COALESCE((SELECT weight FROM wp_weights WHERE kind='tool'   AND key='_default'), 3) AS defw
),
raw AS (
  SELECT s.user_id, s.minute_ts,
         SUM(s.ok_count
             * COALESCE(w.weight, (SELECT defw FROM cfg))
             -- Agent / Task 自身は「起動コスト」なので子係数をかけない
             * CASE WHEN s.is_subagent AND s.tool_name NOT IN ('Agent','Task')
                    THEN (SELECT subf FROM cfg) ELSE 1 END) AS wp
    FROM wp_source_minute s
    LEFT JOIN wp_weights w ON w.kind='tool' AND w.key = s.tool_name
   GROUP BY s.user_id, s.minute_ts
  UNION ALL
  SELECT m.user_id, m.minute_ts,
         m.lines_added   * COALESCE((SELECT weight FROM wp_weights WHERE kind='metric' AND key='linesAdded'), 0.5)
       + m.lines_removed * COALESCE((SELECT weight FROM wp_weights WHERE kind='metric' AND key='linesRemoved'), 0.3)
       + m.commits       * COALESCE((SELECT weight FROM wp_weights WHERE kind='metric' AND key='commit'), 50)
       + m.prs           * COALESCE((SELECT weight FROM wp_weights WHERE kind='metric' AND key='pullRequest'), 150)
    FROM wp_metric_minute m
)
SELECT user_id, minute_ts,
       SUM(wp)                                   AS wp_raw,
       LEAST(SUM(wp), (SELECT cap FROM cfg))     AS wp,
       GREATEST(SUM(wp) - (SELECT cap FROM cfg), 0) AS wp_clipped
  FROM raw
 GROUP BY user_id, minute_ts;

-- JST の暦日で束ねる（UTC だと深夜作業が前日に寄る）
CREATE OR REPLACE VIEW wp_daily AS
SELECT user_id,
       (to_timestamp(minute_ts * 60) AT TIME ZONE 'Asia/Tokyo')::date AS day,
       SUM(wp)         AS wp,
       SUM(wp_raw)     AS wp_raw,
       SUM(wp_clipped) AS wp_clipped
  FROM wp_minute
 GROUP BY 1, 2;

-- ============================== スコアカード ==============================
-- ゲーム用 WP とは別系統（WP.md §9）。サブエージェント係数はかけない生カウント。
CREATE TABLE IF NOT EXISTS scorecard_daily (
  user_id        bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day            date NOT NULL,
  lines_added    double precision NOT NULL DEFAULT 0,
  lines_removed  double precision NOT NULL DEFAULT 0,
  commits        double precision NOT NULL DEFAULT 0,
  prs            double precision NOT NULL DEFAULT 0,
  output_tokens  double precision NOT NULL DEFAULT 0,
  input_tokens   double precision NOT NULL DEFAULT 0,
  cache_read_tokens double precision NOT NULL DEFAULT 0,
  cost_usd       double precision NOT NULL DEFAULT 0,
  active_time_sec double precision NOT NULL DEFAULT 0,
  skill          integer NOT NULL DEFAULT 0,
  agent          integer NOT NULL DEFAULT 0,
  custom_agent   integer NOT NULL DEFAULT 0,
  async_agent    integer NOT NULL DEFAULT 0,
  sub_tool_uses  integer NOT NULL DEFAULT 0,
  tools_ok       integer NOT NULL DEFAULT 0,
  tools_ng       integer NOT NULL DEFAULT 0,
  edit_accept    integer NOT NULL DEFAULT 0,
  edit_reject    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- 使った Skill 名 / サブエージェント種別の内訳
CREATE TABLE IF NOT EXISTS scorecard_names (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     date NOT NULL,
  kind    text NOT NULL,          -- 'skill' | 'agent_type'
  name    text NOT NULL,
  count   integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, kind, name)
);

-- ============================== 重複排除 ==============================
-- WP.md §8 ② の未実装項目。OTLP はネットワーク越しだと再送が日常なので必須。
CREATE TABLE IF NOT EXISTS ingest_seen (
  user_id    bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dedup_key  text NOT NULL,
  at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dedup_key)
);
CREATE INDEX IF NOT EXISTS ingest_seen_at ON ingest_seen(at);

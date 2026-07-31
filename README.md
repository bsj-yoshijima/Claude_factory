# 🏭 Claude Factory

いま動いている **Claude Code の全セッション**を、「工場で働く仲間」としてリアルタイムに可視化する育成ゲーム。

- **busy のエージェント → 工場**でせっせと作業（火花を散らして working）
- **idle のエージェント → 休憩室**でソファに座って休む（💤）
- **朝 / 夕 / 夜**は日本時間(JST)に応じて背景が自動で切り替わる
- **設置モード**で、決まった背景の上に自分で機械や小物を配置できる（自由な工場づくり）
- **生産ダッシュボード**が busy の合計時間を「生産量」として積み上げていく

背景は Stitch で生成した「空の工場（朝/夕/夜）」のドット絵を採用し、その上にエージェントとオブジェクトを重ねて描画しています。

## 使い方

依存ゼロ（Node標準モジュールのみ）。

```bash
node server.mjs
# → http://localhost:4321 をブラウザで開く
```

停止 / 再起動:

```bash
lsof -ti tcp:4321 | xargs kill        # 停止
node server.mjs                       # 再起動
```

別のディレクトリで `claude` を起動して作業させると、その子が工場に現れて働き出します。

## 画面の見かた

| 操作 | 内容 |
|---|---|
| 🏭 **工場** タブ | busy のエージェントが床のあちこちで作業する様子 |
| ☕ **休憩室** タブ | idle のエージェントがソファでくつろぐ様子 |
| 🔧 **設置** タブ | 設置モード。下のパレットから選んで床タイルをクリックで配置／🗑️で撤去 |
| エージェントをクリック | 体の色を巡回で変更（セッションごとに保持） |
| 生産ダッシュボード | 今日の生産（稼働30分=1個）・今日の稼働時間・稼働中の数・累計生産 |

### URL パラメータ（プレビュー / 共有リンク）

- `?hour=17.5` … 任意時刻の採光をプレビュー（朝/夕/夜の切替確認）
- `?view=lounge` … 休憩室ビューで開く
- `?build=1` … 設置モードで開く
- `?demo=1` … サンプルの設置レイアウトを一時表示（未配置のときのみ）
- `?dummy=12` … サーバ未接続時にダミーのエージェントを表示（プレビュー用）

## 📊 メトリクス（OTel プロトタイプ）

`http://localhost:4321/metrics` — Claude Code から OpenTelemetry で送られてくる実績値を全部そのまま並べ、WP（Work Point）を集計する検証用ページ。

有効化するには `~/.claude/settings.json` の `env` に以下を入れて、**新しい** claude セッションを開始する（起動中のセッションには反映されない）。

```json
"CLAUDE_CODE_ENABLE_TELEMETRY": "1",
"OTEL_METRICS_EXPORTER": "otlp",
"OTEL_LOGS_EXPORTER": "otlp",
"OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
"OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318",
"OTEL_METRIC_EXPORT_INTERVAL": "10000",
"OTEL_LOGS_EXPORT_INTERVAL": "5000",
"OTEL_LOG_USER_PROMPTS": "0",
"OTEL_LOG_ASSISTANT_RESPONSES": "0",
"OTEL_LOG_TOOL_DETAILS": "0",
"OTEL_LOG_TOOL_CONTENT": "0"
```

`http/json` が使えるので **OTel Collector は不要**。`otel.mjs` が素の Node で OTLP を直接受ける（依存ゼロを維持）。

```
Claude Code ──OTLP/JSON──▶ :4318 /v1/metrics, /v1/logs   ← otel.mjs（受信 + WP集計）
                                    │  生ログを ~/.claude/factory/otel-raw.jsonl に追記
                                    ▼
                           :4321 /api/otel ──▶ /metrics（表示）
```

生ログを残しているので、`otel.mjs` の `WP` の重みを書き換えて再起動すれば**過去データを自動リプレイして再集計**される。

### 実測でわかったドキュメントとの差異

| 項目 | 実際 |
|---|---|
| イベント名 | `event.name` は `claude_code.` プレフィックス**無し**（`tool_result` 等） |
| 識別属性 | `user.email` / `session.id` / `organization.id` は resource ブロックではなく**各 datapoint / logRecord の attributes 側**に入る |
| 未記載イベント | `hook_registered` / `hook_execution_start` / `hook_execution_complete` が実在（`hook_event=PostToolUse:Bash` まで取れる） |
| プロンプト内容 | `prompt` / `response` 属性は存在するが値は `<REDACTED>`（既定で内容は送られない） |
| `DISABLE_TELEMETRY=1` との併存 | 併存可。OTel 送信はブロックされない |

### WP の重み（`otel.mjs` の `WP`）

ツール実行は `success=true` のみ加点。

| 対象 | 重み |
|---|---|
| `Edit` / `Write` / `NotebookEdit` | 10 |
| `Bash` | 4 |
| `Agent` / `Task` | 15 |
| `Skill` | 25 |
| `Read` / `Grep` / `Glob` | 2 |
| その他・MCP ツール | 3 |
| `lines_of_code.count` (added) | × 0.5 |
| `lines_of_code.count` (removed) | × 0.3 |
| `commit.count` | × 50 |
| `pull_request.count` | × 150 |

## 仕組み

```
~/.claude/sessions/*.json     起動中セッションの実体（1ファイル = 1エージェント）
      │  1.5秒ごとに読み取り／ps で死活判定（終了済みの残骸を除外）
      ▼
server.mjs (Node 常駐)         → /api/sessions で稼働状況を JSON 配信 + 静的ファイル配信
      │  1.5秒ポーリング
      ▼
claude-factory.html           Canvas ゲーム画面。背景画像＋エージェント＋設置物を描画
```

- 完全ローカル・オフライン動作。セッション情報が外部に出ることはありません。
- 設置したオブジェクトはブラウザの localStorage に保存されます。
- 生産量は「busy になっている合計時間」から算出する擬似生産です（稼働30分で1個）。

## ファイル

| ファイル | 内容 |
|---|---|
| `server.mjs` | セッションを読んで配信＋静的ファイル配信する常駐サーバ |
| `claude-factory.html` | **メインのゲーム画面**（背景画像・設置・工場/休憩室・ダッシュボード） |
| `assets/factory-*.jpg` | Stitch 生成の空部屋背景（morning / evening / night） |
| `pixel-factory.html` | 旧・全手描きドット絵版（`http://localhost:4321/classic` で表示） |
| `index.html` | 初期のシンプル版（カードUI） |
| `machine-concepts.html` | 工場に足す機械のコンセプトボード |
| `proposal.html` / `slides.html` / `slides-en.html` / `Claude-Factory.pdf` | 企画書・発表スライド |

## 必要環境

- Node.js（`node server.mjs` が動けばOK）
- macOS 向け（`ps` によるプロセス死活判定を使用）

---

🤖 Built with [Claude Code](https://claude.com/claude-code)

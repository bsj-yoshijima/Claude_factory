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

| 場所 | 内容 |
|---|---|
| **上中央 左** | **今日の労働量(WP) / 今日の製造数** — そのエンジニアが今日やった量 |
| **上中央 右** | **製造パネル**。原材料スロット・次の製品までのWP・製造開始/停止 |

実績ボードと製造パネルは横並び。ウィンドウ幅が足りなければ上下に折り返す。
| 右中央 🎁 **完成品** | 製品が完成すると出る。開くと図鑑に登録される |
| 右下 🔧 **レイアウト編集** | 常時表示。パレットから床クリックで配置／ドラッグで移動／🗑で撤去 |
| 右上 ☰ **メニュー** | 📖図鑑 / 🏆リーダーボード / 🏪ショップ / 📊メトリクス |
| 左下 | Claude君の絵で稼働中(✨) / 休憩中(☕)の数を表示 |
| 抽出機をクリック | 原材料をセットする |
| エージェントをクリック | 頭アクセサリを巡回で変更（セッションごとに保持） |

`/legacy` の旧Canvas版は 工場/休憩室タブ・設置モードの構成のまま残してある。

### URL パラメータ（プレビュー / 共有リンク）

- `?hour=17.5` … 任意時刻の採光をプレビュー（朝/夕/夜の切替確認）
- `?view=lounge` … 休憩室ビューで開く
- `?build=1` … 設置モードで開く
- `?demo=1` … サンプルの設置レイアウトを一時表示（未配置のときのみ）
- `?dummy=12` … サーバ未接続時にダミーのエージェントを表示（プレビュー用）

## 🏭 製造（プロトタイプ）

実WPを溜めて製品を作り、**📖図鑑を埋めていく**のがゴール。

1. 右下の 🔧**レイアウト編集** で **抽出機（🟥）を最大3台**設置する
2. 抽出機をクリック → **原材料を1つ選ぶ**（牛乳・小麦粉・卵・バターなど12種）
3. ☰メニューの 🏭**製造** で全機械が縦一覧（マス数の昇順）。行ごとに素材セット・進捗・**▶製造開始**
4. 押した時点からの **実WP** がその機械に加算され、**マス数 × 50WP** で1製品が完成
5. 完成すると右中央に **🎁完成品** ボタン。開くと一覧が出て**📖図鑑に登録**される（初回は `NEW`）

| 仕様 | 挙動 |
|---|---|
| 必要WP | **マス数 × 50WP**（`WP_PER_SLOT`）。2マス機=100WP / 5マス機=250WP |
| WPの配分 | 稼いだWPは**台数で按分せず、稼働中の全機械にそれぞれ同額**を加算する |
| WPの管理単位 | **機械ごと**に独立（`G.craft.mach[id] = {running, wp}`） |
| 製品の決まり方 | **必要WPに達したその時点**のマスの組み合わせを見て決まる。レシピにあれば出うる製品5種からレア度で重み付けしてランダム |
| レシピに無い組み合わせ | **🪨 謎のカタマリ** ができる（＝組み合わせを当てにいく動機） |
| 作れる物の表示 | **出さない**（探す楽しみを残すため）。筐体の上と一覧には稼働状態と進捗だけ出す |
| `NEW` | 図鑑に未登録の製品**すべて**に付く（同じ新製品が3個できていれば3個とも） |
| 💰の稼ぎ方 | **完成品一覧を開いたとき**にレア度別の売価が加算される（N 60 / R 200 / SR 700 / SSR 2,600 / UR 9,000）。ダイアログに今回の売上と内訳を出す |
| 超過WP | 次の製品に繰り越す |
| 原材料の変更・解除 | **製造は止まらず、WPもリセットしない**（溜めた分はそのまま次の製品に使われる） |
| セッションの永続 | リロードしても継続（閉じている間に稼いだWPも反映される） |

画面上中央のボードに**今日の労働量(WP) / 今日の製造数**を大きく表示する。製造パネルはその下で、次の製品までのWPを出す。
☰メニューの🏆リーダーボードで [スコアカード](WP.md#9-業務スコアカード) を軸ごとに並べ替えできる。

> 製品・原材料・レシピ・必要WP（`CRAFT_WP`）は `factory-phaser.html` の先頭付近にまとめてある。
> 将来は工場のジャンルを選べるようにして、原材料と製品のセットを差し替える想定。

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
| 未記載イベント | `hook_registered` / `hook_execution_start` / `hook_execution_complete`（`hook_event=PostToolUse:Bash` まで取れる）、**`subagent_completed`**（`total_tool_uses` / `total_tokens` / `agent_type` / `is_async`）、**`skill_activated`** |
| Skill 名 | 自作 Skill は `custom_skill` に伏せられる（`OTEL_LOG_TOOL_DETAILS=1` で開示）。公式・同梱の Skill は実名で届く |
| プロンプト内容 | `prompt` / `response` 属性は存在するが値は `<REDACTED>`（既定で内容は送られない） |
| `DISABLE_TELEMETRY=1` との併存 | 併存可。OTel 送信はブロックされない |

### WP の重み（`otel.mjs` の `WP`）

> 計測ロジックの全体・較正データ・**指標としての妥当性の限界**は [WP.md](WP.md) にまとめてある。
>
> ゲーム用WPと**業務スコアカード**は目的が違うので分離している。
> ゲーム用WPは「活動量」であって「パフォーマンス」ではなく、**人と人の比較には使えない**
> （実測で `Skill` 1.2% / `Agent` 0.9% しか占めず、`Bash` を大量に叩く人が上位になる）。
> 使い方を見るための多軸スコアカードは [WP.md #9](WP.md#9-業務スコアカード)。

ツール実行は `success=true` のみ加点。

| 対象 | 重み |
|---|---|
| `Edit` / `Write` / `NotebookEdit` | 10 |
| `Bash` | 4 |
| `Agent` / `Task` | 3（起動コストのみ） |
| `Skill` | 25 |
| `Read` / `Grep` / `Glob` | 2 |
| その他・MCP ツール | 3 |
| `lines_of_code.count` (added) | × 0.5 |
| `lines_of_code.count` (removed) | × 0.3 |
| `commit.count` | × 50 |
| `pull_request.count` | × 150 |
| **サブエージェント内のツール実行** | 上記 **× 0.5** |

さらに **1人1分あたり 200WP の上限**をかけている（`perMinuteCap`）。実測では1分あたり中央値20 / 90%=45 なので通常の作業ではほぼ効かない。バランス調整ではなく `Read` ループや大量並列エージェントのような病的なケースを止めるガードレール。**削られた量は画面に必ず表示する**（黙ってクリップしない）。

### サブエージェントの扱い

実測でわかったこと: **子（サブエージェント）のツール実行は、親と同じ `session.id` の `tool_result` として混ざって届く。** `tool_result` には `query_source` も `agent.name` も付かないので、そのままでは親子を区別できない。放置すると `Agent` の起動WPと子の労働WPが二階層で加算され、サブエージェントを多用する人が構造的に有利になる。

判別は2段構えで行っている。

| Agent の実行形態 | `duration_ms` | 判別方法 |
|---|---|---|
| 同期（`run_in_background: false`） | 子の実行時間を含む（実測 28.6s） | `[end - duration_ms, end]` の区間に入るか |
| **バックグラウンド（既定）** | **ほぼ 0（1〜42ms）** | 区間が作れないので、**直前に完了した `api_request` の `query_source`** で判定 |

`api_request.query_source` の実測値はドキュメントの `main` / `subagent` / `auxiliary` より詳細だった。

| 値 | 意味 |
|---|---|
| `sdk` | 親（メインループ） |
| `agent:builtin:general-purpose` | 組み込みサブエージェント |
| `agent:custom` | カスタムサブエージェント |
| `web_search_tool` | Web検索の内部呼び出し |
| `prompt_suggestion` | 入力補完の裏処理 |

ツールは「直前に完了した `api_request` の応答」として実行されるので、直前が `agent:*` ならそのツールは子のもの、というルール。**並列に多数のバックグラウンドエージェントが走っている間は親の作業と時間的に重なるため、この判定は近似**（完全な分離はOTelのデータだけでは不可能）。

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
| `factory-phaser.html` / `game/main.js` | **現行のゲーム画面**（Phaser版。`/` と `/next`） |
| `metrics.html` / `otel.mjs` | 📊 メトリクス（`/metrics`）。OTel 受信 + WP / スコアカード集計 |
| `assets/room-*.png` | Stitch 生成のテーマ別背景（`docs/stitch-prompts.md` にプロンプト） |
| `assets/prop_*.png` | 装飾プロップ（汎用12種 + テーマ別6種×5テーマ）。**表示サイズに合わせて縮小済み** |
| `assets/prop-src/prop_*.png` | 上記の原寸版（切り出したまま・200〜400px）。サイズを変えるときの元データ |
| `assets/prop-sheets/*.jpg` | Stitch が生成したアセットシート（1枚に3×2で6体） |
| `tools/cut_props.py` | シートから1体ずつ切り出し、背景と接地影を抜いて `assets/prop-src/` を作る |
| `tools/fit_props.py` | 原寸版をゲーム内の表示サイズへ縮小して `assets/prop_*.png` を作る |
| `claude-factory.html` | 旧・Canvas版（`/legacy`） |
| `assets/factory-*.jpg` | 旧Canvas版の空部屋背景（morning / evening / night） |
| `pixel-factory.html` | 旧・全手描きドット絵版（`/classic`） |
| `index.html` | 初期のシンプル版（カードUI） |
| `machine-concepts.html` | 工場に足す機械のコンセプトボード |
| `proposal.html` / `slides.html` / `slides-en.html` / `Claude-Factory.pdf` | 企画書・発表スライド |

### プロップの大きさ（コマ数）

`pixelArt:true`（NEAREST）なので、原寸のまま1コマ（約42px）に縮めると描き込みが間引かれて潰れる。
そのため **① 描き込みの多い物は使う床のコマ数を増やす ② 素材をその表示サイズまで縮小しておく** の2段で対応している。

- コマ数は `game/main.js` の `PROP_SPAN`（1 / 2 / 4）が唯一の定義。表示高 = `1.35 * CELL * √コマ数`
- 例: 回転レーン・ネタケース・人間大砲・真鍮ボイラー等は 4コマ（2×2相当）、給茶台などは 2コマ
- `PROP_SPAN` を変えたら `python3 tools/fit_props.py` を実行して素材を焼き直す

| `tools/cut_machines.py` | 製造機シートを1台ずつ切り出し、表示サイズへ縮小＋スロット位置を実測（`python3 tools/cut_machines.py`） |
| `tools/test_ui_browser.mjs` | 実ブラウザ(headless Chrome)でUIを操作して確認（`node tools/test_ui_browser.mjs`。サーバ起動が前提）。グローバル名の衝突など「構文は通るが実行時に壊れる」類はこれでしか出ない |
| `tools/test_machines.mjs` | 製造機／設置ロジックの検証（`node tools/test_machines.mjs`。Phaser をスタブして描画なしで走る） |

### 製造機と素材（コンベアは廃止）

製造機は **2〜5マスを占有する筐体**で、**1マス＝素材スロット1つ**。入っている素材の**組合せ**で作れる物が変わる。

- サイズは `sub`（`s2`〜`s5`）が在庫キー兼マス数（1マス機は廃止）。占有マスの定義は `cellsOf()` が唯一の真実。
- 向きは `dir`（`'u'`／`'v'`）。設置前は **Rキー**でプレビューの向きを切替、設置後は設定パネルの ↻回転。
- 編集モードで**製造機をクリックすると設定パネル**が開く（マスごとの素材／回転／撤去）。複数マスなのでドラッグ移動はしない。
- **レシピは素材の"集合"で判定**（順不同・重複は1つとして数える）。既知の組合せに無ければ **「謎の塊」**。
- 素材が揃っている機械は一定間隔で完成品をポンと出し、`window.__onProduce(product, mats)` が発火する。

レシピ表は `RECIPES`（`game/main.js`）。`window.__factory.recipes` を差し替えれば外から丸ごと入れ替えられる（組合せロジックは別担当に渡せる）。素材は `MATS`。

旧セーブのコンベア／出荷口は読み込み時に破棄し、旧4種の製造機（抽出機など）と旧1マス機は最小の2マス機に読み替える。

### 製造機のスキン

**スプライト（テーマ別ドット絵）→ 無ければ手続き描画** の順に解決する（`machTex()` / `partsSkin()`）。

| やりたいこと | やること |
|---|---|
| 新しいテーマのドット絵を足す | `assets/mach-sheets/<theme>.png`（2x2・マゼンタ背景・左上から2/3/4/5マス）を置いて `python3 tools/cut_machines.py`。`MACH_ART` に `<theme>` を足す |
| 色だけテーマに合わせる（絵なし） | `PART_SKIN_BY_THEME` に `テーマ名:'wood'` のように1行足す（パレットは `PART_PAL`） |

用意済み: `normal`（既定・ガンメタル）/ `arabia`（テラコッタ＋真鍮＋ターコイズタイル）。パーツのテーマは背景（部屋テーマ）に自動追従し、絵の無いテーマは `normal` にフォールバックする。単体で試すなら `window.__factory.setPartsTheme('arabia')`。

**素材アイコンは占有マスの真上に置く**。絵の意匠には依存しない（スロットの穴を描く必要はない）。それが成立するのは、`tools/cut_machines.py` が**4台の筐体の高さを揃えて焼く**から。

生成された絵は台ごとにマスピッチが違う（例: アラビアで1マス 92/69/58/48px）ため、幅だけを占有外周に合わせると長い台ほど筐体が高くなる（実測で最大 +37%）。そこで **幅=占有外周の幅 / 高さ=占有外周の高さ+共通の筐体高（4台の中央値）** で縦横別々に合わせている。歪みは数%に収まり、超えると警告が出る。

## 必要環境

- Node.js（`node server.mjs` が動けばOK）
- macOS 向け（`ps` によるプロセス死活判定を使用）

---

🤖 Built with [Claude Code](https://claude.com/claude-code)

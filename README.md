# 🏭 Claude Factory

いま動いている **Claude Code の全セッション**を、「工場で働く仲間」としてリアルタイムに可視化する育成ゲーム。

- **busy のエージェント → 工場**でせっせと作業（火花を散らして working）
- **idle のエージェント → 休憩室**でソファに座って休む（💤）
- **朝 / 夕 / 夜**は日本時間(JST)に応じて採光が自動で切り替わる
- **🔧レイアウト編集**で、自分で製造機や小物を配置できる（自由な工場づくり）
- 実測の**労働量(WP)**で製品を製造し、**📖図鑑を埋めていく**のがゴール

サーバでホスティングし、**各ユーザーが自分の工場を持つ**。工場のデータはすべてサーバが持つ。

## 使い方

サーバでホスティングし、**各ユーザーが自分の工場を持つ**構成（Postgres + Google SSO）。
詳細は [docs/multiuser.md](docs/multiuser.md)。

```bash
npm install && docker compose up -d && npm run dev
# → http://localhost:4321
```

停止 / 再起動:

```bash
lsof -ti tcp:4321 | xargs kill        # 停止
npm run dev                           # 再起動
```

工場のデータ（💰 / 在庫 / 図鑑 / 製造）はすべてサーバが持つ唯一の真実で、ブラウザには保存しない。
別のディレクトリで `claude` を起動して作業させると、その子が工場に現れて働き出します。

## 画面の見かた

| 場所 | 内容 |
|---|---|
| **上中央 左** | **今日の労働量(WP) / 今日の製造数 / 今日の売上** — そのエンジニアが今日やった量。**「今日の製造」をクリック**すると 📊今日つくったもの一覧（レア度順・原材料の組み合わせ・個数） |
| **上中央 右** | 🏭**製造機設定** ボタン（メインラベル）。下に小さく稼働状況（製造中 N/M台）。クリックで🏭製造ダイアログ |

実績ボードと製造パネルは横並び。ウィンドウ幅が足りなければ上下に折り返す。
| 右中央 🎁 **完成品** | 製品が完成すると出る。開くと図鑑に登録され、**中身は空になる**（＝常に新着だけ） |
| 右下 🔧 **レイアウト編集** | 常時表示。パレットから床クリックで配置／ドラッグで移動／🗑で撤去 |
| 右上 ☰ **メニュー** | 🏠マイページ / 🧾製造レシピ / 🏪ショップ / 🔧レイアウト編集 / 📖図鑑 / 🏆リーダーボード |
| 左下 | Claude君の絵で稼働中(✨) / 休憩中(☕)の数を表示 |
| 抽出機をクリック | 原材料をセットする |
| エージェントをクリック | 頭アクセサリを巡回で変更（セッションごとに保持） |

### URL パラメータ（プレビュー / 共有リンク）

- `?hour=17.5` … 任意時刻の採光をプレビュー（朝/夕/夜の切替確認）
- `?edit=1` … レイアウト編集モードで開く
- `?shop=mach` … ショップの指定タブで開く（`1` で既定タブ）

## 🏭 製造（プロトタイプ）

実WPを溜めて製品を作り、**📖図鑑を埋めていく**のがゴール。

1. ☰メニューの 🔧**レイアウト編集** で製造機を設置する
2. 抽出機をクリック → **ジャンルを選んで原材料を1つ選ぶ**（🍳食品 / ⚙️機械 / 🧺生活品 の32種）
3. ☰メニューの 🏭**製造** で全機械が縦一覧（マス数の昇順）。行ごとに素材セット・進捗・**▶製造開始**。マスをクリックすると**ジャンルごとの見出しの下に全原材料が並ぶ**（タブ切り替えはしない）
4. 押した時点からの **実WP** がその機械に加算され、**マス数 × 2,000WP** で1製品が完成
5. 完成すると右中央に **🎁完成品** ボタン。開くと一覧が出て**📖図鑑に登録**される（初回は `NEW`）。**1回開いたら中身はリセット**され、次の製品ができるまでボタンは消える

| 仕様 | 挙動 |
|---|---|
| 必要WP | **マス数 × 2,000WP**（`game/data/rules.mjs` の `WP_PER_SLOT`）。2マス機=4,000WP / 5マス機=10,000WP |
| WPの配分 | 稼いだWPは**台数で按分せず、稼働中の全機械にそれぞれ同額**を加算する |
| WPの管理単位 | **機械ごと**に独立（`G.craft.mach[id] = {running, wp}`） |
| 製品の決まり方 | **必要WPに達したその時点**のマスの組み合わせを見て決まる。レシピにあれば候補から重み付けしてランダム |
| レシピに無い組み合わせ | **🪨 謎のカタマリ** ができる（＝組み合わせを当てにいく動機） |
| ジャンル跨ぎ | 別ジャンルの原材料を混ぜてもセットできる。**ほとんどは 🪨**。`SECRETS` に書いた組み合わせだけ、その確率で ✨**シークレット**（👽エイリアン・🐈ふしぎな猫など）が出る |
| 作れる物の表示 | **出さない**（探す楽しみを残すため）。筐体の上と一覧には稼働状態と進捗だけ出す |
| `NEW` | 図鑑に未登録の製品**すべて**に付く（同じ新製品が3個できていれば3個とも） |
| 💰の稼ぎ方 | **製品が完成した瞬間**にレア度別の売価が加算される（N 60 / R 200 / SR 700 / SSR 2,600 / UR 9,000）。🎁完成品のダイアログに出すのは**今回開いた分の合計と内訳（加算済み）**（所持額は🏪ショップで見る） |
| 製造の記録 | サーバの `products_made` に残る。**📊今日の製造**は `/api/made` を見るので、🎁完成品を開いても消えない。売上も日付ごとにサーバが集計する |
| 超過WP | 次の製品に繰り越す |
| 原材料の変更・解除 | **製造は止まらず、WPもリセットしない**（溜めた分はそのまま次の製品に使われる） |
| セッションの永続 | リロードしても継続（閉じている間に稼いだWPも反映される） |

画面上中央のボードに**今日の労働量(WP) / 今日の製造数 / 今日の売上**を大きく表示する。製造数はクリックで📊今日の製造が開く。
☰メニューの🏆リーダーボードで [スコアカード](WP.md#9-業務スコアカード) を軸ごとに並べ替えできる。

### ジャンルと組み合わせの定義（拡張ポイント）

ジャンル・原材料・製品・レシピは **[game/data/craft.mjs](game/data/craft.mjs)** が唯一の定義。ここだけ触れば増やせる（`game/main.js` は素材の色をジャンル既定色にフォールバックするので、素材を足しても触らなくてよい）。

マスタは3つの ESM に分かれていて、**クライアント（`factory-phaser.html`）とサーバ（`server/game-data.mjs`）が同じものを import する**。値がズレようがない。

| ファイル | 内容 |
|---|---|
| [game/data/craft.mjs](game/data/craft.mjs) | ジャンル / 原材料 / 製品 / レシピ / 抽選（`rollProduct`）/ `keyOfSlots` |
| [game/data/econ.mjs](game/data/econ.mjs) | レア度 / 製造機 / 装飾 / 背景 / 床材 / シリーズと価格 |
| [game/data/rules.mjs](game/data/rules.mjs) | `WP_PER_SLOT` / `PROD_PRICE` / `needWp` |

| 増やすもの | 足す場所 |
|---|---|
| ジャンル | `GENRES` に1行。図鑑のジャンルタブと、原材料ピッカーの見出し + 一覧は自動で増える |
| 原材料 | `MATS` に1行（`g` = ジャンル） |
| 製品 | `PRODS` に1行（`g` = ジャンル / `r` = レア度1..5 / `m` = **レシピ**＝この製品を作る組み合わせ） |
| 組み合わせ | 手で書く表はない。`RECIPES` は `PRODS` の `m` から自動で組み立てる |
| ジャンル跨ぎの隠し当たり | `SECRETS` に1行（`p` = シークレットが出る確率。外れは 🪨） |

**製品と組み合わせは1対1**。`m` は製品ごとに1つしかないので、違う組み合わせから同じ製品が出ることは構造的に起きない。図鑑の材料アイコンも同じ `m` を出すため、表示とレシピがズレない。

```js
{id:'omelet', g:'food',e:'🍳',n:'オムレツ', r:1,m:['egg','butter','cheese']},   // → キー 'butter,cheese,egg'
{id:'onigiri',g:'food',e:'🍙',n:'おにぎり', r:1,m:['rice','veg']},              // 🍣寿司と同じ m ＝ 同じキーを共有
```

- `m` は同ジャンルの原材料を **2〜5個**（製造機のマス数が2〜5なので6個以上は作れない）
- 逆向き（1つの組み合わせ → 複数の製品）は意図して残してある。同じ `m` を持つ製品どうしはレア度の既定重み（`RAR[r].w`）で引き分けるので、**同じ組み合わせを何度も試して上位レア度を狙う**遊びになる（現在7通り）

抽選の分岐は `rollProduct()` の4行だけ: ①隠しレシピ（跨ぎ）→ 確率でシークレット / 外れは🪨 → ②跨ぎでレシピ無し → 🪨 → ③同ジャンルのレシピ → 重み付き抽選 → ④レシピ無し → 🪨。

`node tools/test_craft.mjs` がこのブロックを切り出して、キーの正規化・ジャンルの整合・確率（実測が設定値に寄るか）・全製品の到達性・**製品と組み合わせが1対1であること**・原材料数が2〜5に収まることまで検証する。**`m` を触ったら必ず走らせる。**

📖図鑑は **製品タブ配下でジャンルを切り替える**（🍳食品 / ⚙️機械 / 🧺生活品 / ✨シークレット）。✨タブには 🪨謎のカタマリ も入る。

> 必要WP（`WP_PER_SLOT`）も同じファイルの先頭付近。

## 📊 テレメトリ（OTel）

Claude Code から OpenTelemetry で送られてくる実績値を受けて WP（Work Point）を集計する。
集計結果は 🏠マイページ・🏆リーダーボードで見る（検証用の `/metrics` ページは廃止した）。

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

`http/json` が使えるので **OTel Collector は不要**。`server/ingest-otel.mjs` が OTLP を直接受ける。

```
Claude Code ──OTLP/JSON──▶ :4321 /v1/metrics, /v1/logs   ← server/ingest-otel.mjs（受信）
                                    │  分バケットで Postgres に格納
                                    ▼
                           :4321 /api/state, /api/mypage, /api/leaderboard（表示）
```

重みはDBの表にあるので、**`UPDATE` するだけで全期間のWPが再集計**される（再取り込みは不要）。

### 実測でわかったドキュメントとの差異

| 項目 | 実際 |
|---|---|
| イベント名 | `event.name` は `claude_code.` プレフィックス**無し**（`tool_result` 等） |
| 識別属性 | `user.email` / `session.id` / `organization.id` は resource ブロックではなく**各 datapoint / logRecord の attributes 側**に入る |
| 未記載イベント | `hook_registered` / `hook_execution_start` / `hook_execution_complete`（`hook_event=PostToolUse:Bash` まで取れる）、**`subagent_completed`**（`total_tool_uses` / `total_tokens` / `agent_type` / `is_async`）、**`skill_activated`** |
| Skill 名 | 自作 Skill は `custom_skill` に伏せられる（`OTEL_LOG_TOOL_DETAILS=1` で開示）。公式・同梱の Skill は実名で届く |
| プロンプト内容 | `prompt` / `response` 属性は存在するが値は `<REDACTED>`（既定で内容は送られない） |
| `DISABLE_TELEMETRY=1` との併存 | 併存可。OTel 送信はブロックされない |

### WP の重み（`server/wp.mjs` の `WP` → DBの重み表）

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
Claude Code ──OTLP/JSON + hooks──▶ server/index.mjs ──▶ Postgres
                                        │  WP集計・製造判定(craft.mjs)・図鑑登録
                                        ▼
                              /api/state ほか（JSON）
                                        │  5秒ポーリング
                                        ▼
        factory-phaser.html（器）→ game/app.mjs → game/ui/*   画面
                                    game/main.js（Phaser のシーン）
```

- 💰 / 在庫 / 図鑑 / 製造の判定は**すべてサーバが唯一の真実**。クライアントの申告は信じない。
- 工場のデータはブラウザに保存しない（ログインした本人の工場がサーバにある）。
- 製造は実測WPで進む（1製品 = マス数 × `WP_PER_SLOT`）。

## ファイル

| ファイル | 内容 |
|---|---|
| `server/*.mjs` | **サーバ**（Postgres / OTLP / hooks / ゲームAPI）。[docs/multiuser.md](docs/multiuser.md) |
| `db/schema.sql` | スキーマ |
| `factory-phaser.html` | 画面の器（CSS と DOM だけ）。動きは `game/app.mjs` から始まる |
| `game/app.mjs` | エントリ。起動の順番と、`main.js`・テストへ渡す窓口 |
| `game/state.mjs` / `game/net.mjs` / `game/craft.mjs` | 共有状態 / サーバとの出入口 / 製造の状態とボード |
| `game/ui/*.mjs` | 画面ごと（`dialog` `parts` `collection` `recipes` `craft-dialog` `shop` `leaderboard` `mypage` `agents` `palette` `morph`） |
| `game/main.js` | Phaser のシーン（クラシックスクリプト）。UI へは `window.__*` 経由 |
| `assets/room-*.png` | Stitch 生成のテーマ別背景（`docs/stitch-prompts.md` にプロンプト） |
| `assets/prop_*.png` | 装飾プロップ（汎用12種 + テーマ別6種×5テーマ）。**表示サイズに合わせて縮小済み** |
| `assets/prop-src/prop_*.png` | 上記の原寸版（切り出したまま・200〜400px）。サイズを変えるときの元データ |
| `assets/prop-sheets/*.jpg` | Stitch が生成したアセットシート（1枚に3×2で6体） |
| `tools/cut_props.py` | シートから1体ずつ切り出し、背景と接地影を抜いて `assets/prop-src/` を作る |
| `tools/fit_props.py` | 原寸版をゲーム内の表示サイズへ縮小して `assets/prop_*.png` を作る |
| `docs/index.html` / `docs/machine-concepts.html` | 初期のシンプル版（カードUI）／機械のコンセプトボード |
| `docs/proposal.html` / `docs/slides.html` / `docs/slides-en.html` / `docs/Claude-Factory.pdf` | 企画書・発表スライド |

### プロップの大きさ（コマ数）

`pixelArt:true`（NEAREST）なので、原寸のまま1コマ（約42px）に縮めると描き込みが間引かれて潰れる。
そのため **① 描き込みの多い物は使う床のコマ数を増やす ② 素材をその表示サイズまで縮小しておく** の2段で対応している。

- コマ数は `game/main.js` の `PROP_SPAN`（1 / 2 / 4）が唯一の定義。表示高 = `1.35 * CELL * √コマ数`
- 例: 回転レーン・ネタケース・人間大砲・真鍮ボイラー等は 4コマ（2×2相当）、給茶台などは 2コマ
- `PROP_SPAN` を変えたら `python3 tools/fit_props.py` を実行して素材を焼き直す

| `tools/mach_prompt_template.md` | 製造機スプライトを Stitch に依頼するテンプレ（向きをピクセル送りで数値指定する。文章だと横一列で返ってくる） |
| `tools/cut_machines.py` | 製造機シートから**2マス機の絵だけを正**として3/4/5マス機を合成し、表示サイズへ縮小＋投入口のアンカーを書き出す（`python3 tools/cut_machines.py`） |
| `tools/mach_axis.mjs` | 製造機スプライトの長軸が全テーマ `+u`（右斜め下）を向いているか検査する（`node tools/mach_axis.mjs`／`--fix` で左右反転して揃える）。逆向きの絵は**影・占有マス・素材アイコンが正しい向きなのに本体だけ直交して見える**。`tools/test_machines.mjs` から呼ばれる |
| `tools/make_favicon.mjs` | ファビコン（工場＋左下にClaude君）を描いて `assets/favicon.png` / `favicon-192.png` を出す（`node tools/make_favicon.mjs`。依存ゼロ。Claude君は `mascotCanvas()` の手順を移植したものなので、マスコットの形を変えたら再実行する） |
| `tools/test_ui_browser.mjs` | 実ブラウザ(headless Chrome)でUIを操作して確認（`node tools/test_ui_browser.mjs`。サーバ起動が前提。`CF_URL` で接続先を変えられる）。「構文は通るが実行時に壊れる」類はこれでしか出ない |
| `tools/test_machines.mjs` | 製造機／設置ロジックの検証（`node tools/test_machines.mjs`。Phaser をスタブして描画なしで走る） |
| `tools/test_craft.mjs` | ジャンル／原材料／製品／レシピ＋確率の検証（`node tools/test_craft.mjs`。`game/data/craft.mjs` を import するだけ。ブラウザ不要） |

### 製造機と素材（コンベアは廃止）

製造機は **2〜5マスを占有する筐体**で、**1マス＝素材スロット1つ**。入っている素材の**組合せ**で作れる物が変わる。

- サイズは `variant`（`s2`〜`s5`）が在庫キー兼マス数（1マス機は廃止）。占有マスの定義は `cellsOf()` が唯一の真実。
  `variant` は `kind`（machine / prop / deco）の下位で `MACH` / `PROP` / `DECO` 表を引くキー、という意味で全体に統一している。
- 向きは `dir`（`'u'`／`'v'`）。設置前は **Rキー**でプレビューの向きを切替、設置後は設定パネルの ↻回転。
- 編集モードで**製造機をクリックすると設定パネル**が開く。**中身は🏭製造の一覧とまったく同じ行（`machRow()`）**で、違いは下に**配置（↻回転 / ✥移動）**が付くことだけ。複数マスなのでドラッグ移動はしない。
- **レシピは素材の"集合"で判定**（順不同・重複は1つとして数える）。既知の組合せに無ければ **「謎の塊」**。
- 素材が揃っている機械は一定間隔で完成品をポンと出し、`window.__onProduce(product, mats)` が発火する。

素材マスタ・レシピ・製品の**定義の正は [game/data/craft.mjs](game/data/craft.mjs)**（上の「ジャンルと組み合わせの定義」）。`game/main.js` は描画専用で、素材idを `window.__craft.mat()` に問い合わせて解決する（`matArt()`。個別色 → ジャンル既定色 → 既定色 の順にフォールバックするので、素材を増やしてもここは触らない）。

旧セーブのコンベア／出荷口は読み込み時に破棄し、旧4種の製造機（抽出機など）と旧1マス機は最小の2マス機に読み替える。

### 製造機のスキン

**スプライト（テーマ別ドット絵）→ 無ければ手続き描画** の順に解決する（`machTex()` / `partsSkin()`）。

| やりたいこと | やること |
|---|---|
| 新しいテーマのドット絵を足す | `assets/mach-sheets/<theme>.png`（2x2・マゼンタ背景・左上から2/3/4/5マス）を置いて `python3 tools/cut_machines.py`。`MACH_ART` に `<theme>` を足す |
| 色だけテーマに合わせる（絵なし） | `PART_SKIN_BY_THEME` に `テーマ名:'wood'` のように1行足す（パレットは `PART_PAL`） |

用意済み: `normal`（既定・ガンメタル）/ `arabia`（テラコッタ＋真鍮＋ターコイズタイル）。パーツのテーマは背景（部屋テーマ）に自動追従し、絵の無いテーマは `normal` にフォールバックする。単体で試すなら `window.__factory.setPartsTheme('arabia')`。

**素材アイコンは占有マスの真上に置く**。絵の意匠には依存しない（スロットの穴を描く必要はない）。

生成された絵は台ごとにマスピッチが違う（halloween ±13% / scifi ±57%）。生成AIは何度指示しても長い台ほどマスを詰めてくるので、**投入口を検出できるテーマは 2マス機の絵1枚だけを正とし、1ベイ（1マスぶんの縦帯）を繰り返して3/4/5マス機を合成する**（`tools/cut_machines.py`）。送りは定義上ぴったり一定になり、デザインも4サイズで完全に同一になる。投入口の位置は `assets/mach-fit.json` にアンカーとして書き出し、`machFit()` が素材アイコンを絵の口に乗せる。

投入口を検出できないテーマ（`SPOT_TEST` 未登録）は従来どおり **幅=占有外周の幅 / 高さ=占有外周の高さ+共通の筐体高（4台の中央値）** の幅合わせにフォールバックする。歪みは数%に収まり、超えると警告が出る。

## 必要環境

- Node.js 20 以上
- Postgres（`docker compose up -d` で用意する）

---

🤖 Built with [Claude Code](https://claude.com/claude-code)

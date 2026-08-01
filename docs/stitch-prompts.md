# Stitch 生成プロンプト定義

Stitch(project `10683244945413223519`)で **部屋背景** と **オブジェクト(小物)** を生成するときの
テンプレート集約ファイル。**テーマ固有の部分だけを差し替え**れば、サイズ・パース・床の空き方が
揃った素材が安定して出る。成功実績のあるテンプレをここに固定しておく。

- 生成後は `=s0` を付けた downloadUrl で原寸(1376×768)取得 → `assets/room-<key>.png`
- 新規テーマは main.js の `preload`/`ROOM_TEX`、factory-phaser.html の `SERIES`/`ROOM_THEMES`/`BG_META` の**計5箇所**に登録
- 装飾プロップは部屋と同じ紺(#1b1b2e)背景で生成 → `tools/cut_props.py` で背景と接地影を抜く → `assets/prop-src/` → `tools/fit_props.py` で表示サイズに縮小 → `assets/prop_<key>.png`

---

## 1. 部屋背景テンプレート（room-<key>.png）

`{{THEME_BLOCK}}` だけをテーマごとに差し替える。それ以外は固定。

```
Wide landscape (1376x768) isometric pixel-art room, lo-fi 8-bit Famicom, chunky pixels,
HIGH DETAIL dense wall decoration.
SIZING: SAME size and footprint as the Arabian/Chinese palace rooms, NOT bigger;
leave dark void margins in all four corners around the central diamond room.
Diamond floor corners: FRONT bottom-center, LEFT far-left, RIGHT far-right, BACK upper-center.
True 2:1 isometric, no distortion.

FLOOR: completely clear and EMPTY — {{FLOOR_MATERIAL}} laid diagonally to match the iso grid,
with only a faint flat {{FLOOR_MOTIF}} inlay (NO furniture, NO objects on the floor).

THEME: {{THEME_BLOCK}}

IMPORTANT: no characters, no people, no floor objects, no text, no UI.
Empty clear floor, same size as reference rooms, dark void margins in corners.
```

### THEME_BLOCK の書式（テーマごと）

`LEFT WALL:`（窓の外の景色）/ `WALLS:`（壁の素材）/ `WALL-MOUNTED DECOR ONLY:`（壁掛けの小物を密に）
/ `Lighting:` / `Palette:` の5行で構成する。**装飾はすべて壁掛け**にし、床には置かない。

### 成功済みテーマの差し替え値（key → FLOOR / THEME概要）

| key | FLOOR_MATERIAL / MOTIF | 窓の外 | 壁・装飾の要点 |
|---|---|---|---|
| steampunk | 濃マホガニー寄木 / 真鍮歯車象嵌 | セピア夕暮れ・煙突・飛行船 | 連動歯車群・大型オーラリー・圧力計・蒸気配管・テスラコイル・コグ時計 |
| retrofuture | 石床 / コンパス紋 | 火山湖・潜水艦の丸窓 | 真鍮リベット壁・パイプオルガン(ノーチラス/ミステリアスアイランド) |
| western | 風化パイン板 / ロープ＆星 | 黄金の夕暮れの森の川・外輪蒸気船 | 丸太＆石壁・石の暖炉・鹿角・WANTED・バンジョー・ワゴンホイール・樽 |
| sushi | 桧板 / 青海波 | 晴れた日本の街・青空・電柱 | 暖簾・メニュー札・だるま・招き猫・提灯・魚拓・お茶ディスペンサー・竹 |
| beehive | ハニカム蝋面 / 六角タイル | 夏の花畑・デイジー・青空・飛ぶ蜂 | 六角セル壁・滴る蜂蜜・蜜蝋キャップ・休む蜂・蜜蝋キャンドル・光る蜜セル |
| circus | 赤い木くず床 / 放射状の星 | 観覧車・豆電球の夕暮れ広場 | 赤白金ストライプ・バンティング・ポスター・金の星・空中ブランコと輪・縞カーテン |
| carnival | 磨いた舞踏会床 / ハーレクイン菱形 | 花火とパレードの夜 | 紫金バロック壁・羽根仮面・ビーズ・道化帽・フルール・ド・リス・ミラー・羽根ボア・燭台 |
| desert | 焼けた砂＋砂岩スラブ / 風紋＆小石 | 砂丘とヤシのオアシス・キャラバン・夕焼け | 地層の砂岩壁・キリム・壁龕の壺・角付き頭骨・パンパス・サボテン・ランタン・ロープ・ペトログリフ |
| jungle | 苔むした割れ石スラブ / 蔦と葉の彫り | 滝と密林・木漏れ日 | マヤ風グリフの石壁・彫像の顔・太陽円盤・エメラルド・モンステラ/シダ・蘭・蝶・垂れる根 |
| egypt | 磨いた砂岩スラブ / ヒエログリフ＆ホルスの目 | ピラミッド/ナイルと帆船・ヤシ・黄金の空 | ヒエログリフ壁・ロータス柱・金のアヌビス・ホルスの目・ファラオのマスク・アンク・スカラベ・ラーの円盤・松明 |
| christmas | 木材 / 雪の結晶＆ヒイラギ | 雪夜の村・松・家の灯・そりのシルエット | 松のガーランドと赤リボン・リース・豆電球・トナカイ・雪景色の額・キャンディケイン・暖炉+靴下・背面角にツリー |
| space | 金属格子 / ヘックス＆発光ライン | 青い地球・星雲・衛星・月・星空 | 金属パネル+シアンの継ぎ目・制御盤とモニター群・世界地図の司令スクリーン・配管・ロボットアーム・酸素タンク・ドッキングハッチ・宇宙服ロッカー |
| ice | 氷パネル / 結晶模様と反射 | オーロラ・雪山・凍った松 | 半透明氷ブロック壁・氷柱・青く光る水晶・雪の結晶レリーフ・青い炎の氷燭台・氷柱シャンデリア・霜の鏡 |
| mushroom | 木材+苔 / 葉とキノコの輪 | 光るキノコと小川・蛍・木漏れ日の魔法の森 | 湾曲した木のキノコ軸壁・壁に光るキノコ・ランタンキノコ・ツタと苔・どんぐり・押し花の額・光る胞子の瓶棚・妖精ライト・カタツムリ |
| onsen | 石スラブ+檜デッキ / さざ波と小石 | 秋の紅葉・滝・石灯籠・山・夕焼け | 石積み+檜梁・鹿威し・暖簾・桶と柄杓の棚・提灯・盆栽と竹・山の掛け軸・畳んだ手ぬぐい・祠のお地蔵・湯気 |

> 既存の arabia / undersea / japan / china / diner / fantasy / scifi / cabin / dino /
> haunted / pirate / circuit / dwarf / hell / tokyo / halloween も同じテンプレ系統。

### サイズ検証
- ダウンロード後 `assets/room-arabia.png`(基準)と床ダイヤの位置が一致していれば
  グリッド較正(OFF_U=0.577, OFF_V=0.851)そのままで整合する。
- 四隅に暗い余白が出ていること＝基準と同フットプリント。枠いっぱいになったら再生成。

---

## 2. 装飾プロップテンプレート（prop_<key>.png）

1テーマにつき **6種** を1枚(3列×2行)で出す → `tools/cut_props.py` で個別スライス。
`{{THEME}}` `{{PALETTE}}` `{{SIX_ITEMS}}` を差し替える。サーカス/回転寿司/西部開拓/
ミツバチの巣/スチームパンクの30種はこのテンプレで生成済み(6/6 使えるヒット率)。

背景をマゼンタではなく**部屋と同じ紺 #1b1b2e** にしているのは、Stitch が必ず接地影を
描いてしまい、マゼンタだと影が黒浮きするため。紺なら影ごと `cut_props.py` が抜ける。

```
A pixel-art game asset sheet — NOT a UI mockup. No buttons, no labels, no text anywhere,
no panels, no header, no navigation.

Canvas: flat solid dark navy background, exactly #1b1b2e, filling the whole screen.
Absolutely no gradients, no vignette, no grid lines.

Content: 6 isolated {{THEME}} themed pixel-art floor props, arranged in a clean
3-column x 2-row grid with generous even spacing, each object free-floating on the navy
background with a small soft dark elliptical shadow directly under it.

Art direction (must match exactly):
- 16-bit / SNES-era pixel art, chunky visible square pixels, hard aliased edges,
  NO anti-aliasing, NO smooth gradients, NO blur, NO glow bloom.
- Isometric 3/4 view from slightly above, camera angle identical for every object,
  so each prop sits flat on an imaginary isometric floor.
- Each object roughly 220 px wide and 260 px tall, bottom-anchored, standing upright.
- Dark warm outline (deep desaturated brown-purple, near #3a2430) around every silhouette;
  interior shading in 3-4 flat tones per material — light top face, mid front-left face,
  dark front-right face.
- Palette: {{PALETTE}}. Warm, slightly desaturated, cozy — never neon.

The 6 props, left to right, top row then bottom row:
{{SIX_ITEMS}}
```

`{{PALETTE}}` は部屋画像の色に合わせる（例: 回転寿司 = light honey-blond hinoki wood,
cream white plaster, vermilion red, indigo blue accents, brushed steel）。
`{{SIX_ITEMS}}` は「1. 〜」の番号付きで、素材・色・載っている小物まで書くと崩れにくい。

### 切り出しと組み込み

```bash
# 1) downloadUrl に =s0 を付けて原寸取得 → assets/prop-sheets/<theme>.jpg
# 2) tools/cut_props.py の SHEETS に 6体分の名前を追記(接頭辞はテーマ3文字: cir_/sus_/wes_/bee_/stm_)
python3 tools/cut_props.py assets/prop-sheets assets/prop-src   # 背景+接地影を抜く(30体で30〜45分)
python3 tools/fit_props.py                                      # 表示サイズまで縮小
```

- 登録先は main.js の `PROP_NAMES` と `PROP_SPAN`、factory-phaser.html の `PROP`(価格・絵文字・`th`)の**計3箇所**
- `PROP_SPAN` は使う床のコマ数(1/2/4)。描き込みが多い物は 2〜4 にしないと 1コマ(42px)で潰れて読めない
- コマ数を変えたら `fit_props.py` を再実行（表示サイズ = `1.35*CELL*√コマ数` で焼き直すため）

---

## 3. エージェント・スキンテンプレート（skin-<id>.png）

スキン = **今のマスコットに装備を着せた"1枚絵"**。別キャラは作らない。ベースを固定し装備だけ変える。
1シートに複数キャラを2×3等で並べ→マゼンタ抜き→個別スライス→`assets/skin-<id>.png`。
`setPose` が `setScale((1.5*CELL)/height)` で足元基準に縮小するので、**各キャラは全身・足を最下部**に。

### 固定プレフィックス（全スキン共通・"型"の核。毎回そのまま）

```
Sprite sheet of cute chibi MASCOT characters, lo-fi 8-bit Famicom pixel-art, VERY chunky pixels,
thick clean black outlines, flat vibrant colors, high contrast.
IMPORTANT — every mascot shares the EXACT SAME BASE, only the worn costume changes:
a single rounded bean/egg-shaped body, NO visible arms, three tiny stubby feet at the very bottom,
a plain face with only two small black dot eyes (no nose, no mouth), front-facing, standing upright,
same body shape / size / proportions / 3 feet for all.
Make the gear FLASHY and eye-catching (bold shapes, gold, gems, glow, sparkles, flowing capes).
The face (two dot eyes) stays visible, EXCEPT eyewear gear (sunglasses / visor / eyepatch / mask) may cover the eyes.
Arrange in a grid with WIDE clear gaps. Solid pure MAGENTA (#FF00FF) flat background everywhere
including gaps. NO shadows, NO ground, NO text, NO labels, NO UI.
```

### 各スキンの可変部（被り物 head + 着るもの body の1セット）

`N) <THEME> — HEAD: <被り物>. OUTFIT: <着るもの>. [eyes covered by <...>]` を並べる。

| id | HEAD(被り物) | OUTFIT(着るもの) | 目隠し |
|---|---|---|---|
| japan | 金の前立が輝く豪華な兜 | 金縁の縅・胴丸 | - |
| pirate | ドクロ付き三角帽 | 金ボタンの赤いコート | 眼帯 |
| tokyo | 光るネオンバイザー | 黒＋シアンネオンのジャケット | バイザー |
| christmas | ふさ付きサンタ帽＋白髭 | 金ベルトの赤白サンタ服 | - |
| arabia | 宝石付き金ターバン＋羽根 | 紫金の豪華ベスト＋帯 | - |
| egypt | 金青のネメス＋コブラ | 金の幅広襟＋白布 | - |
| china | 龍の金冠 | 赤金の龍の官服 | - |
| undersea | 真珠と貝の冠 | 虹色のウロコ＋ヒレ | - |
| fantasy | 星の輝く魔法帽 | 星屑のローブ | - |
| scifi | 銀ヘルメット＋触角 | 発光する銀スーツ | バイザー可 |
| cabin | ニット帽 | 赤黒チェックのネル＋斧 | - |
| dino | トゲ付き恐竜フード | 緑の着ぐるみ＋尻尾 | - |
| haunted | 角の立ったシーツ | おばけの白布(波裾) | 目穴 |
| circuit | 炎柄レーサーヘルメット | スポンサー柄スーツ | バイザー |
| dwarf | ランプ付き鉱夫帽 | 革の作業着＋金バックル | 髭 |
| hell | 燃える悪魔の角 | 赤マント＋尻尾 | - |
| steampunk | ゴーグル付きシルクハット | 真鍮の歯車付き革コート | ゴーグル可 |
| retrofuture | 真鍮の潜水士官帽 | ティール士官コート＋真鍮 | - |
| halloween | 吸血鬼の髪＋立ち襟 | 赤裏地の黒マント | 牙 |
| western | カウボーイ帽 | 保安官星＋バンダナ＋ベスト | - |
| sushi | 日の丸鉢巻 | 白の板前着＋前掛け | - |
| beehive | 触角＋縞ヘルメット | 黄黒縞＋透ける羽 | - |
| circus | 虹色の髪＋赤鼻 | 水玉＋フリル襟 | 赤鼻 |
| carnival | 羽根の豪華仮面 | 紫金のマント | 仮面 |
| desert | 布のターバン頭巾 | 砂色のローブ | 口布可 |
| jungle | ピスヘルメット | カーキの探検服＋装備 | - |
| space | 金バイザーの宇宙ヘルメット | 白い与圧服＋パッチ | バイザー |
| ice | 氷の結晶の王冠 | 白青の煌めくドレス | - |
| mushroom | 赤白ドットのキノコ帽 | 葉っぱの妖精服＋羽 | - |
| onsen | 頭に乗せた手ぬぐい | 藍の浴衣 | - |
| diner | ダイナーの紙帽 | ギンガム＋エプロン | - |

### 記入例（1シート6体）

```
<固定プレフィックス>
6 mascots, left to right:
1) SAMURAI — HEAD: ornate kabuto helmet with a big shining golden crescent crest. OUTFIT: navy-and-gold lamellar do armor. eyes visible.
2) PIRATE — HEAD: black tricorn with white skull. OUTFIT: red captain coat with gold buttons and sash. right eye covered by a black eyepatch.
3) CYBER — HEAD: glowing pink-and-cyan neon visor. OUTFIT: black jacket with glowing cyan neon trim. eyes covered by the visor.
4) SANTA — HEAD: fluffy red santa hat with white pom, white beard. OUTFIT: red-and-white santa coat with a gold-buckle belt. eyes visible.
5) GENIE — HEAD: golden jeweled turban with a feather. OUTFIT: purple-and-gold ornate vest with a sash. eyes visible.
6) PHARAOH — HEAD: gold-and-blue nemes headdress with a cobra. OUTFIT: broad gold collar and white kilt. eyes visible.
```

### スライス
- `scratchpad/skins/slice.py` を流用（連結成分で切り出し→マゼンタ抜き→`assets/skin-<id>.png`）。
- 足が最下部・全身が入っているか確認（`setScale` が高さ基準のため）。

---

## 補足: 装飾プロップの状況

### 生成済み（各6種・シートは `assets/prop-sheets/<key>.jpg`）

| key | 6 items |
|---|---|
| circus | ポップコーンワゴン / 玉乗り台 / 縞トランク3段 / 輪投げスタンド / 人間大砲 / ベルベットスツール |
| sushi | 回転レーン / 寿司桶5段 / 給茶台 / 藁巻き酒樽 / 招き猫の台座 / ネタケース |
| western | 樽テーブル / 蹄鉄投げ / 荷馬車の車輪 / 焚き火とコーヒー / サボテンの鉢 / 金の秤台 |
| beehive | ハニカム台 / 蜜壺ピラミッド / 花粉のカゴ / 蜜蝋の燭台 / 女王蜂の玉座 / 巣枠ラック |
| steampunk | 真鍮ボイラー / 歯車の山 / 圧力計コンソール / 銅管チェア / 天球儀 / 石炭バケツ |

### 未生成（発注候補）

| key | items 案 |
|---|---|
| diner | jukebox / neon clock / milkshake counter stool / vintage gas pump |
| carnival | mask stand / cake tower / balloon bunch / drum |
| undersea | treasure chest / coral / anchor / clam |
| japan | 石灯籠 / 盆栽 / 手水鉢 / 太鼓 |
| ...他テーマ | 同様に6種ずつ |

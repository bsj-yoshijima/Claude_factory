# Stitch 生成プロンプト定義

Stitch(project `10683244945413223519`)で **部屋背景** と **オブジェクト(小物)** を生成するときの
テンプレート集約ファイル。**テーマ固有の部分だけを差し替え**れば、サイズ・パース・床の空き方が
揃った素材が安定して出る。成功実績のあるテンプレをここに固定しておく。

- 生成後は `=s0` を付けた downloadUrl で原寸(1376×768)取得 → `assets/room-<key>.png`
- 新規テーマは main.js の `preload`/`ROOM_TEX`、factory-phaser.html の `SERIES`/`ROOM_THEMES`/`BG_META` の**計5箇所**に登録
- オブジェクトはマゼンタ(#FF00FF)背景でクロマキー抜き → `assets/prop_<key>_*.png`

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

## 2. オブジェクト(小物)テンプレート（prop_<key>_*.png）

1テーマにつき **4種** をまとめて1枚のシートで出す → マゼンタ抜き → 個別スライス。
`{{THEME}}` と `{{FOUR_ITEMS}}` を差し替える。

```
Sprite sheet of exactly 4 separate {{THEME}} themed decorative objects, isometric pixel-art,
lo-fi 8-bit Famicom style, chunky pixels, thick clean black outlines, high contrast.
The 4 items are: {{FOUR_ITEMS}}.
Arrange them in a single horizontal row, evenly spaced, each fully separated with clear gaps,
each roughly the same size (fitting about 1-1.5 floor tiles), standing on the ground
(front view, slight 2:1 isometric 3/4 angle) so they can sit on an isometric floor.
Solid pure MAGENTA (#FF00FF) flat background, NO shadows touching the magenta,
NO ground plane, NO text, NO labels, NO UI, NO characters.
Each object clearly readable as a small game prop.
```

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

## 補足: 装飾プロップ 4 items 案（未生成 / これから発注）

| key | 4 items |
|---|---|
| diner | jukebox / neon clock / milkshake counter stool / vintage gas pump |
| steampunk | brass diving helmet / gear contraption / pressure boiler / tesla globe |
| western | wooden barrel cactus / campfire / wagon wheel / hay bale |
| sushi | conveyor sushi plate stack / soy sauce & gari set / sake barrel / neko figurine |
| beehive | honey pot / honeycomb frame / flower cluster / smoker(養蜂器具) |
| circus | striped pedestal / cannon / stacked balls / hoop stand |
| carnival | mask stand / cake tower / balloon bunch / drum |
| undersea | treasure chest / coral / anchor / clam |
| japan | 石灯籠 / 盆栽 / 手水鉢 / 太鼓 |
| ...他テーマ | 同様に4種ずつ |

> スライス手順: python で列方向の非マゼンタ塊を検出し矩形で切り出し、
> 透過PNG化 → placeable prop カタログ(PROP_NAMES 系)に追加。
```

---

## 4. コンベア・スキンテンプレート（belt-<skin>-{straight,corner,tee,cross}.png）

コンベアの見た目を切替可能にする「スキン」。1スキン = **直線/コーナー/T字(分岐)/十字** の4ピース1セット（設置時に接続マスクからピースと反転を選ぶ）。既存 `belt_seg`(直線) `belt_corner`(コーナー) が**デフォルトスキン**の素材。追加スキンをこの型で生成する。

- 規約: **2:1アイソメtrue・チャンキー8bit・太い黒縁・マゼンタ背景**。1ピース=**床1セルに載るサイズ**、ベルト上面が上向き、側面レール＋ローラー、上面にトレッド(進行方向の縞/シェブロン)。全ピース同スケール・同アングル。
- 反転運用: 直線は片軸だけ描き、もう片軸は flipX。コーナーは1向き描き、他3向きは flipX/flipY。T/十字は対称。
- スライス: マゼンタ抜き→`assets/belt-<skin>-straight.png` 等。既存 `belt_seg.png`/`belt_corner.png` は skin=`default` として流用。

### 固定プレフィックス（毎回そのまま）

```
Pixel-art ISOMETRIC conveyor-belt piece SET, true 2:1 isometric, lo-fi 8-bit Famicom, VERY chunky pixels, thick clean black outlines, flat colors. Solid pure MAGENTA (#FF00FF) flat background, NO floor, NO shadow, NO text.
A 2x2 grid of exactly 4 pieces, all the SAME scale, SAME iso viewing angle, each sized to sit on ONE isometric floor tile, belt top surface facing up with visible tread chevrons showing travel direction, side rails and end rollers:
1) STRAIGHT segment running along one iso axis.
2) CORNER / 90° elbow (belt turns).
3) T-JUNCTION (three-way branch).
4) CROSS (four-way).
SKIN STYLE: {{SKIN_STYLE}}
Consistent chunky pixel style across all 4 pieces. Only the hats/UI-free belt pieces on magenta.
```

### スキン別の {{SKIN_STYLE}} 例（可変部）

| skin | SKIN_STYLE |
|---|---|
| default | dark industrial grey metal, yellow-and-black hazard stripes on the side, steel rollers（＝既存belt_seg系） |
| neon | sleek white-and-charcoal body with glowing cyan neon tread and edge lights |
| wood | warm wooden planks with brass fittings and rope side rails |
| gold | ornate gold-and-royal-purple belt with jeweled rollers（アラビア/宮殿向け） |
| candy | glossy pink belt with white-and-red striped tread, mint rollers |
| rust | rusty orange-brown riveted steel, worn hazard paint（スチパン/西部向け） |

### 実装メモ（並行準備）
- 現状は手続き描画(接続に応じてアーム＋トレッド＋ライン色)。**スプライト方式へ移行**する場合: 接続マスク→ピース種別(直線=2対向/コーナー=2隣接/T=3/十字=4/端=1)＋反転を選び、`belt-<skin>-*` を配置。skin は G に保存して全ベルト差し替え。
- belt_seg=default straight, belt_corner=default corner。まず default で方式を通し、その後スキンを足す。

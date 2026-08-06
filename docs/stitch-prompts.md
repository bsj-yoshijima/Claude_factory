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

`LEFT WALL:`（開口の形＋外の景色）/ `WALLS:`（壁の素材）/ `WALL-MOUNTED DECOR ONLY:`（壁掛けの小物を密に）
/ `Lighting:` / `Palette:` の5行で構成する。**装飾はすべて壁掛け**にし、床には置かない。

`LEFT WALL:` は「窓」と書かない。**外が見える開口**として、その世界観に合う形を明示する
（アーチ／丸窓／洞窟の裂け目／氷の割れ目／船体の破孔など）。位置だけが規格で、形は自由。
木枠のガラス窓に寄せたくないので、必要なら `no frames, no glass` と書き添える。

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

### サイズ検証（2026-08 更新: 基準は arabia ではなく ISO 定数）
- 現在のグリッドは `game/scene/iso.mjs` の `ISO`（軸対称・画像中心揃え・OFF=0）が唯一の基準。
  旧記載の「arabia 基準 + OFF_U=0.577/OFF_V=0.851」は廃止済みで、既存のテーマ部屋は現行グリッドとずれている。
- 生成時は `docs/room-guide-1376x768.png`（規格の床ダイヤ 12×12・壁立ち上げを描いた下絵）を参照画像として渡す。
  床は 12×12 マス（ゲームの論理マスと同一。旧背景の床絵は11列分しかないが旧デザインとして無視）。
  床ダイヤの規定頂点（1376×768 px）: 奥(688,275) / 右(1137,499) / 手前(688,724) / 左(239,499)。
  壁の垂直高さは左右統一 260px（上端は床エッジと平行。壁上頂点は 奥(688,15) / 右(1137,239) / 左(239,239)）。
  奥・手前・壁上奥は画像中心 x=688 に乗り、左右の角は同じ y=499。1マスは厳密に 2:1。
- ダウンロード後は `tools/preview/guide.html` で背景を重ねて床ダイヤが一致するか検収する
  （ガイドの再生成・PNG書き出しも同ページ）。一覧でまとめて見るなら `tools/preview/rooms.html`。
- 四隅に暗い余白が出ていること＝規格と同フットプリント。枠いっぱいになったら再生成。

---

## 1-B. 全背景を作り直す場合の発注方針（規格ファースト）

既存背景を全部破棄して 0 から作る場合の手順。**狙いは「ガイドに合わせること」ではなく
「全部屋が互いに同じ形であること」**。全部屋が同じ形なら、系統的なズレは `ISO` を一度だけ
再較正すれば吸収できる。部屋ごとにバラバラだと何も吸収できない。だから指示は
「毎回同じ1枚の型から描かせる」形にする。

### 規格（変更しない。`game/scene/iso.mjs` の `ISO` が唯一の出どころ）

`ISO = { Bx:0.5, By:0.3584, ux:0.3261, uy:0.2919, vx:-0.3261, vy:0.2919 }`（2026-08 に確定）

1376×768 での規定頂点:
床 奥(688,275) 右(1137,499) 手前(688,724) 左(239,499) ／ 壁上 奥(688,15) 右(1137,239) 左(239,239)
→ 奥と手前は同じ x（=画像中心 688）、左と右は同じ y、壁高は左右とも 260px、左右マージンは各239px、
1マスの送りは x:y = 2:1（厳密）。

### 手順（この順に上から実行する）

**0. 検収ツールを開けるようにする**

```bash
npm run dev
```

ブラウザで `http://localhost:4321/tools/preview/guide.html` を開く。
ポート4321が使用中なら `PORT=4322 npm run dev` のように変えてよい（URLも合わせる）。
一覧でまとめて見たいときは `http://localhost:4321/tools/preview/rooms.html`。

**1. Stitch に渡す参照画像を用意する**

`docs/room-shell-1376x768.png` を使う。**これは既にコミットされているので、作り直す必要はない**。
壁2面と床を単色で塗った「部屋の殻」で、床の12×12の目地だけ入っている。

> ⚠️ `docs/room-guide-1376x768.png` を Stitch に渡してはいけない。こちらは**検収用**で、
> ピンク/金の線と座標ラベルが焼き込まれている。渡すとモデルがその線や日本語ごと
> 部屋の中に描いてしまう。
>
> 規格を変えた場合だけ作り直す。guide.html の
> **「⬇ Stitch用の殻だけ保存」**＝参照画像 / **「⬇ 検収用オーバーレイ保存」**＝検収用。

**2. 1部屋目（ゴールデンルーム）を作る**

下の「プロンプト」の `{{...}}` を埋めて、参照画像に `room-shell-1376x768.png` を添えて生成する。
**ここだけは時間をかけて、手順4の検収に通るまで作り直す。**後続すべての基準になる。

**3. 2部屋目以降はゴールデンルームを参照画像にする**

殻ではなく**完成した1部屋目の画像**を渡し、「この部屋の形・カメラ・床サイズ・壁高はそのまま、
素材と装飾だけテーマを変える」と指示する。テキストで幾何を指示するより桁違いに安定する。
（狙いは「規格に合わせること」より「全部屋が互いに同じ形であること」。全部屋が同じ形なら
系統的なズレは後から一度で吸収できるが、部屋ごとにバラバラだと何も吸収できない。）

**4. 1枚ずつ検収する**

`=s0` を付けた downloadUrl で原寸(1376×768)を取得し、`assets/rooms/room-<key>.png` として保存
（`<key>` は下の一覧の key。既存を差し替えるだけならコード変更は不要）。
guide.html の「下に重ねる背景」でその部屋を選び、次の3点を見る。

- **ピンクの菱形**の4頂点が、絵の床の4隅と合っているか（合否の主判定）
- **金の線**が壁の上端と合っているか
- 四隅に暗い余白（void）が残っているか。枠いっぱいなら大きすぎるので再生成

ズレが目に見える大きさなら再生成。数pxなら許容（そのまま採用してよい）。

**5. 新しいテーマを追加した場合だけ、コードに登録する**

既存テーマの差し替えでは不要。新規テーマを増やしたときは以下を触る。

- `game/scene/main.mjs` の `this.load.image('room_...')` のリスト（末尾のループに key を追加）
- `game/scene/catalog.mjs` の `ROOM_TEX`
- `game/data/econ.mjs`（ショップの並び・家具・エージェント名）
- サムネイル生成: `node tools/assets/make_theme_thumbs.mjs`（`assets/ui/icons/theme-<key>.png` を作る）

**6.（必要になったときだけ）ISO の再較正**

全部屋が「同じ方向へ同じだけ」ずれた場合に限り、`ISO` を一度だけ実測に合わせ直せば全部が揃う。
ただし `ISO` を変えると製造機スプライトの1マス送りが合わなくなるので、
その場合は `python3 tools/assets/refit_machines.py` で128枚を合わせ直し、`npm test` を通すこと。

### プロンプト（型の塗り替えとして発注する）

座標を数値で指示しても生成モデルは従えない。**「部屋を描いて」ではなく「この殻を塗り替えて」**
という枠組みにするのが要点。寸法は px ではなく**タイル数と割合**で言う。

```
Repaint THIS EXACT room shell with a new theme. Output 1376x768.

STRICT GEOMETRY — copy from the reference image, do not change:
the room outline, the four corners of the floor diamond, the wall height,
the camera angle. Every edge stays exactly where it is in the reference.
Do NOT resize, rotate, re-center, crop, or zoom the room.
Keep the four canvas corners as empty dark void margins, and keep them COMPLETELY EMPTY:
every piece of decoration must sit INSIDE the room, on one of the two walls. Nothing —
no plant, no bracket, no shelf, no lantern — may hang outside the room outline or float
in the dark margins.

The floor diamond is left-right symmetric: its left and right vertices are at the
SAME height, its back and front vertices are on the SAME vertical center line.
Floor = exactly 12 x 12 isometric tiles, true 2:1 isometric.
Floor spans 65% of image width and 59% of image height.
Wall height = 34% of image height (about 58% of the floor diamond's height),
measured straight up from the floor edge; the wall top edge runs parallel to the floor edge.
Two walls only: the LEFT wall opens to the outside, the RIGHT wall is solid.
The LEFT wall has EXACTLY THREE openings that reveal the outside scenery —
not two, not four, not five. Do not add, remove, merge or split any opening.

ONLY THEIR POSITION IS FIXED. The three soft dark patches on the left wall of the
reference image mark WHERE the openings go — keep those three positions and roughly
that size, evenly spaced along the left wall.

THE SHAPE IS YOURS TO MATCH THE THEME. These are openings, NOT literal windows:
do NOT default to rectangular glass panes in wooden or metal frames. Give each opening
the shape and framing that the theme would really use — an ogee or horseshoe arch,
a round porthole, a ragged cave mouth, a crack in ice, a torn hull breach, a gap between
tree trunks, a torii-framed view — whatever fits. Glass is optional; often there is
no glass and no frame at all. What matters is only that the outside view is visible
through all three.

CHANGE ONLY the surface materials and the decoration:
FLOOR: {{FLOOR_MATERIAL}} laid diagonally along the iso grid, with only a faint flat
{{FLOOR_MOTIF}} inlay. Completely clear and EMPTY — no furniture, no objects on the floor.

THEME: {{THEME_BLOCK}}

lo-fi 8-bit Famicom pixel art, chunky pixels, HIGH DETAIL dense wall decoration.
IMPORTANT: no characters, no people, no floor objects, no text, no UI.
```

`{{FLOOR_MATERIAL}}` / `{{FLOOR_MOTIF}}` / `{{THEME_BLOCK}}` の埋め方は「1.」節と共通:

- `{{FLOOR_MATERIAL}}` と `{{FLOOR_MOTIF}}` … 「成功済みテーマの差し替え値」表の
  **FLOOR_MATERIAL / MOTIF 列**（`/` の左が MATERIAL、右が MOTIF）
- `{{THEME_BLOCK}}` … 同じ表の「窓の外」「壁・装飾の要点」列をもとに、
  `LEFT WALL:` / `WALLS:` / `WALL-MOUNTED DECOR ONLY:` / `Lighting:` / `Palette:` の**5行**で書く
  （書式の詳細は「THEME_BLOCK の書式」小節）。**装飾はすべて壁掛け**にし、床には置かない

表に無い新テーマを作るときも同じ5行の型で書き、うまくいったら表に1行足しておく。

### 記入例: arabia（1部屋目・そのまま貼れる完成形）

参照画像に `docs/room-shell-1376x768.png` を添えて、これをそのまま投げる。

```
Repaint THIS EXACT room shell with a new theme. Output 1376x768.

STRICT GEOMETRY — copy from the reference image, do not change:
the room outline, the four corners of the floor diamond, the wall height,
the camera angle. Every edge stays exactly where it is in the reference.
Do NOT resize, rotate, re-center, crop, or zoom the room.
Keep the four canvas corners as empty dark void margins, and keep them COMPLETELY EMPTY:
every piece of decoration must sit INSIDE the room, on one of the two walls. Nothing —
no plant, no bracket, no shelf, no lantern — may hang outside the room outline or float
in the dark margins.

The floor diamond is left-right symmetric: its left and right vertices are at the
SAME height, its back and front vertices are on the SAME vertical center line.
Floor = exactly 12 x 12 isometric tiles, true 2:1 isometric.
Floor spans 65% of image width and 59% of image height.
Wall height = 34% of image height (about 58% of the floor diamond's height),
measured straight up from the floor edge; the wall top edge runs parallel to the floor edge.
Two walls only: the LEFT wall opens to the outside, the RIGHT wall is solid.
The LEFT wall has EXACTLY THREE openings that reveal the outside scenery —
not two, not four, not five. Do not add, remove, merge or split any opening.

ONLY THEIR POSITION IS FIXED. The three soft dark patches on the left wall of the
reference image mark WHERE the openings go — keep those three positions and roughly
that size, evenly spaced along the left wall.

THE SHAPE IS YOURS TO MATCH THE THEME. These are openings, NOT literal windows:
do NOT default to rectangular glass panes in wooden or metal frames. Give each opening
the shape and framing that the theme would really use — an ogee or horseshoe arch,
a round porthole, a ragged cave mouth, a crack in ice, a torn hull breach, a gap between
tree trunks, a torii-framed view — whatever fits. Glass is optional; often there is
no glass and no frame at all. What matters is only that the outside view is visible
through all three.

CHANGE ONLY the surface materials and the decoration:
FLOOR: pale cream marble slabs laid diagonally along the iso grid, with only a faint flat
gold arabesque medallion inlay. Completely clear and EMPTY — no furniture, no objects on the floor.

THEME:
LEFT WALL: the three openings are tall ogee arches cut straight into the plaster — no frames, no glass — looking onto a violet Arabian night: crescent moon, scattered stars, silhouetted domes and minarets of a desert city.
WALLS: carved purple-and-gold Moorish plaster with horseshoe arches, dense geometric fretwork and slender gilded columns.
WALL-MOUNTED DECOR ONLY: pierced brass lanterns hung at several heights, a swagged purple silk curtain with gold tassels, arched niches holding gold coins and jewelled treasure, teardrop mirrors, a brass oil lamp on a wall shelf, strings of glass beads, a peacock perched on a wall ledge, a potted date palm on a wall bracket.
Lighting: warm amber lantern glow from the left, deep violet shadows.
Palette: royal purple, indigo, warm gold, brass, cream.

lo-fi 8-bit Famicom pixel art, chunky pixels, HIGH DETAIL dense wall decoration.
IMPORTANT: no characters, no people, no floor objects, no text, no UI.
```

### やってはいけない指示

- 「床の左角を (230,501) に置いて」— 座標指定は効かない。相対比とタイル数で言う
- 枚数や位置を**文章だけ**で指示する — 開口は殻の絵に3つ描いてあるので「絵のとおりに」と言う方が効く
  （arabia の1回目は文章だけで指示して4つになった）
- 開口を「window」と呼ぶ — 木枠のガラス窓を描かれる。**opening**と呼び、形はテーマに合わせる。
  殻の絵の開口はわざと上端をぼかしてある（硬い四角で描くと、その四角ごとコピーされる）
- 参照画像を毎回変える — 形がバラける。型は固定、または直前のゴールデンルームで固定
- 「壁を高く」「奥行きを深く」等の相対的な形容 — 型からの逸脱を誘発する

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

## 3. 被り物テンプレート（hats/hat-<id>.png）★現行方式

スキン = **手続きマスコットの頭に被り物を1枚重ねる**。31テーマぶん生成済み。
シート生成はStitchが頭の輪郭まで描く癖があるので、**1個ずつ単体生成**する。

### プロンプト（`{{ITEM}}` だけ差し替える。それ以外は固定）

```
Pixel-art game asset image: ONE single piece of headwear only, front view, centered, filling most of the frame.
Style: lo-fi 8-bit Famicom pixel-art, VERY chunky pixels, thick clean black outlines, flat vibrant colors, high contrast, simple 2-tone shading.
ITEM: {{ITEM}}
IMPORTANT: draw ONLY the headwear itself — NO head, NO face, NO ears, NO character, NO mannequin, NO stand, NO shadow, NO ground, NO text, NO labels, NO UI, NO frame, NO border.
The bottom edge of the headwear is the hollow opening where a head would go: keep it straight, symmetric and horizontal so the sprite can be pasted on top of a character's head.
Background: solid pure MAGENTA (#FF00FF) flat fill everywhere around the headwear.
```

`{{ITEM}}` は `a SAMURAI KABUTO helmet — navy-and-gold lacquered bowl …` のように
**大文字の品名 + em dash + 形・色・飾りの列挙**で書く。発光色に**マゼンタは使わない**（背景と混ざって抜ける）。

### 抜き（tools/assets/key_hat.py）

```
python3 tools/assets/key_hat.py <raw.png> assets/hats/hat-<id>.png [--keep-hollow] [--fill=0.5,0.6]
```

- 背景マゼンタは縁からの flood fill ＋ ほぼ純マゼンタ(r>200,b>200,g<80)の無条件除去。
- 既定では「頭が入る空洞の黒ベタ」も抜く（黒マスクを収縮した最大成分＝空洞。輪郭線は残る）。
- `--keep-hollow`: バイザー・仮面・髪など**暗い面を残したい**ものに必須
  （tokyo / circuit / space / scifi / carnival / haunted / halloween / hell がこれ）。
- `--fill=x,y`: 空洞が純マゼンタから外れた色で塗られていた場合の逃げ道（幅/高さの比で位置指定）。

### 較正（assets/hats/hat-fit.json）

`{ "<id>": { "cx": 0.5, "dy": 3.375 } }`

- `cx` = 頭に載る中心（幅比）。左右対称なら 0.5。非対称な飾りがあるものだけずらす。
- `dy` = 下げ量（ドット）。空洞が深い兜・フード・バイザーは下げて深く被せる。
- `w` = 横幅（ドット）。既定は頭幅の `HAT_W_DOT=19`。大きく見せたい兜や小さい紙帽で変える。
  共通の載せ位置は `mascot.mjs` の `HAT_W_DOT=19 / HAT_CX=12.5 / HAT_BASE_Y=10.8`。
- **このJSONのキーが「生成済み」の正**。preload はここにある id だけ読む（未生成の404を出さない）。

### 位置決め・切り取り（tools/preview/hats.html）

ゲームと同じ較正でマスコットに重ねるビューア。`?id=japan,egypt` で絞り込み、
`?pose=stand,work,sit`、`?v=<数字>` でキャッシュ回避。

- **移動(V)**: ドラッグ=位置 / ホイール・Shift+上下=大きさ / ←↑↓→=0.125ドット / Alt+クリック=リセット
- **消しゴム(E) / 範囲消し(R)**: 絵の一部を落とす。Ctrl+Z で1手ずつ戻る
- 値と消し跡は localStorage に溜まる。`JSON をコピー` で `hat-fit.json` に貼り、
  消し跡は `window.__eraseMask()` の出力を `tools/assets/erase_hat.py` に食わせて PNG に焼く
- 空洞が頭より広いと開口部から背景が見えるので、`dy` は「目が隠れない」ぎりぎりで止める

### 軽量化（tools/assets/shrink_hats.py）

```
python3 tools/assets/shrink_hats.py --backup=<原画の退避先> --max=256
```

盤面での実寸は横 17〜46px しかないので、原画のままだと1枚 200〜600KB は完全に無駄。
**整数分の1に NEAREST 縮小（長辺256px）＋ PNG8 パレット化（α2値）** で 31件 8.8MB → 0.5MB。
縦横比を保つので `cx / dy / w` はそのまま通る。すでに PNG8 のファイルは触らない（何度流しても安全）。

---

## 3-b. エージェント・スキンテンプレート（skin-<id>.png）※旧方式・撤回済み

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

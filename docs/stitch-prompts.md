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
- 生成時は `docs/shells/room-guide-1376x768.png`（規格の床ダイヤ 12×12・壁立ち上げを描いた下絵）を参照画像として渡す。
  床は 12×12 マス（ゲームの論理マスと同一。旧背景の床絵は11列分しかないが旧デザインとして無視）。
  **床は厚み25pxの板**として描き、規定ダイヤは「上面」＝物が立つ面。厚みは上面の下に出す
  （画像下端まで44pxあるので収まる）。壁の上端も10pxの天面を持つ。既存32枚の実測は21〜37px。
  ※「平面で描いてコードで厚みを足す」案も検討したが、側面の素材がテーマごとに違って
  コードでは出せないので、画像に焼き込む方針にした。歩留まりが悪ければ平面へ戻す。
  床ダイヤの規定頂点（1376×768 px）: 奥(688,275) / 右(1137,499) / 手前(688,724) / 左(239,499)。
  壁の垂直高さは左右統一 260px（上端は床エッジと平行。壁上頂点は 奥(688,15) / 右(1137,239) / 左(239,239)）。
  奥・手前・壁上奥は画像中心 x=688 に乗り、左右の角は同じ y=499。1マスは厳密に 2:1。
- ダウンロード後は `tools/preview/guide.html` で背景を重ねて床ダイヤが一致するか検収する
  （ガイドの再生成・PNG書き出しも同ページ）。一覧でまとめて見るなら `tools/preview/rooms.html`。
- 四隅に暗い余白が出ていること＝規格と同フットプリント。枠いっぱいになったら再生成。
- 余白の色は **#0C1014 の単色**（実機キャンバスの `backgroundColor` と同値）。ここを揃えると
  盤面の外周で継ぎ目が出ない。既存32枚は余白がばらついている（room-factory は (13,11,24)〜(19,17,30)）。
  生成物は薄いグラデや光のにじみが入りがちなので、外周を機械で検査するとよい。

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

`docs/shells/room-shell-1376x768.png` を使う。**これは既にコミットされているので、作り直す必要はない**。
壁2面と床を単色で塗った「部屋の殻」で、床の12×12の目地だけ入っている。

> ⚠️ `docs/shells/room-guide-1376x768.png` を Stitch に渡してはいけない。こちらは**検収用**で、
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

THE MARGIN IS ONE PERFECTLY FLAT COLOUR: exactly #0C1014, the same single value in every
pixel outside the room, right up to the room's outline. Absolutely no gradient, no
vignette, no darkening toward the corners, no glow, no bloom, no light bleed or haze
from the lamps, no stars, no dust, no dithering, no noise, no texture, no drop shadow
under the room. Fill it as one solid block of #0C1014, like a flat background layer.
The room's silhouette is a hard, clean, aliased edge against that flat colour.

The floor diamond is left-right symmetric: its left and right vertices are at the
SAME height, its back and front vertices are on the SAME vertical center line.
Floor = exactly 12 x 12 isometric tiles, true 2:1 isometric.
Floor spans 65% of image width and 59% of image height.

THE FLOOR DIAMOND IS THE TOP SURFACE — the surface things stand on. The floor is a
SLAB about 25px thick, exactly as in the reference image: its top face keeps the diamond
exactly, and the slab's side faces are drawn BELOW the two front edges, never inside the
diamond. Do not shrink or inset the top surface to make room for the thickness.
The two walls are slabs too, about 10px thick: they show a thin top face along their top
edge, and their outer ends — at the left and right corners of the room — show the cut
thickness of the wall. Every corner where these faces meet is closed and mitered:
no gaps, no floating edges, nothing ending in mid-air.
The wall thickness sits OUTSIDE the room, so it never eats into the 12 x 12 floor.
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

### 記入例: space（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口の形がテーマでどう変わるかの例。arabia はアーチ、space は丸い舷窓になる。
`CHANGE ONLY the surface materials and the decoration:` 以降を、この5ブロックに差し替える。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: brushed steel deck plating laid diagonally along the iso grid, with only a faint flat
hexagon lattice and thin cyan glowing seam lines inlaid flush with the surface.
Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the deck: layered grey steel with a row of small rivets and a thin cyan light strip running along the top of the edge.
WALL EDGES: the wall top faces and the wall end cuts show bare gunmetal plating, a shade lighter, with a cyan seam line along every exposed edge.

THEME:
LEFT WALL: the three openings are round reinforced portholes — thick riveted steel rims set flush into the hull, no timber, no curtains — looking out onto deep space: the blue curve of Earth with white cloud bands, a violet nebula, scattered stars, a small satellite and a distant moon.
WALLS: riveted gunmetal hull panels with glowing cyan seams between the plates, exposed conduit runs and stencilled hazard stripes.
WALL-MOUNTED DECOR ONLY: banks of control panels with blinking indicator lights, a large command screen showing a green world map, gauge clusters, coiled pipes and cable trunks, a folded robotic arm on a rail, strapped oxygen tanks, a circular docking hatch with a wheel lock, spacesuit lockers, a wall-mounted fire extinguisher, a caged emergency lamp.
Lighting: cool cyan panel light from the left, hard blue-grey shadows, small warm amber accents from the indicator lights.
Palette: gunmetal grey, steel blue, glowing cyan, off-white, small amber and red accents.
```

### 記入例: beehive（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口を**六角のセル**にした例。arabia=アーチ / space=丸い舷窓 / beehive=六角セル / factory=金属枠の窓、
と開口の形がテーマごとに変わる。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: golden beeswax comb laid diagonally along the iso grid, with only a faint flat
hexagon lattice pressed into the surface. Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the wax: layered translucent amber, a shade darker, with a soft rounded wax bead along the top of the edge.
WALL EDGES: the wall top faces and the wall end cuts show pale cream beeswax, a shade lighter, with a soft rounded wax lip along every exposed edge.

THEME:
LEFT WALL: the three openings are big hexagonal comb cells opened right through the wax — thick raised beeswax rims, no frames, no glass — looking out onto a summer meadow: bright blue sky, a few white clouds, daisies and clover, several bees in flight.
WALLS: dense honeycomb of hexagonal beeswax cells, some sealed with pale wax cappings, some brimming with glowing amber honey, thin honey strands drooling down between them.
WALL-MOUNTED DECOR ONLY: cells glowing with backlit amber honey, slow honey drips, pale wax cappings, two or three fuzzy bees resting on the comb, beeswax candles on wax brackets, a hanging wooden comb frame, cells packed with golden pollen, a small wax ledge with honey pots and a dipper.
Lighting: warm honey-gold light from the left, soft amber glow from the filled cells, gentle rounded shading (wax, not stone).
Palette: honey gold, deep amber, pale beeswax cream, warm brown, small black-and-yellow accents.
```

### 記入例: cabin（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口を**丸太を貫いた窓穴＋板の鎧戸（ガラス無し）**にした例。木の小屋は「木枠のガラス窓」に
なりがちだが、それだと factory と見分けがつかなくなるので、丸太を切り欠いた穴として書く。
壁の切り口は**丸太の木口（年輪）**にすると、素材が丸太であることが縁だけで伝わる。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: wide worn pine floorboards laid diagonally along the iso grid, with only a faint flat
grain-and-knot pattern and small nail heads. Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the boards resting on a dark log joist, a shade darker, with a thin worn timber trim along the top of the edge.
WALL EDGES: the wall top faces and the wall end cuts show the sawn END GRAIN of the stacked logs — pale rings and cracks in each round log end — a shade lighter than the wall.

THEME:
LEFT WALL: the three openings are holes cut straight through the stacked logs — rough-hewn timber sill and lintel, small open plank shutters swung back against the wall, no glass — looking out onto a sunlit pine forest with a calm lake and distant blue mountains.
WALLS: horizontal stacked pine logs with pale cream chinking packed between them, notched corner joints, a few knots and axe marks.
WALL-MOUNTED DECOR ONLY: bundles of dried herbs hung upside down, a brass kerosene lantern on a peg, snowshoes crossed on the wall, a fishing rod with a wicker creel, a plaid blanket over a peg rail, a small cuckoo clock, framed pressed leaves, a mounted trout on a board, an axe resting on two brackets, a wall rack of split firewood, a copper kettle on a hook.
Lighting: warm golden afternoon light from the left, soft warm shadows, a cosy lantern glow.
Palette: honey pine, warm brown, cream chinking, forest green accents, brass.
```

### 記入例: carnival（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口を**半円アーチのバルコニー（鉄柵つき）**にした例。arabia の尖ったオージーアーチと
区別するため、半円＋バロックの飾り＋鉄の手すりで別物にしている。
床のハーレクイン菱形は**低コントラスト**で指定する（強い市松にすると設置物が読みにくくなる）。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: polished cream marble ballroom floor laid diagonally along the iso grid, with only a faint
LOW-CONTRAST harlequin diamond pattern in pale gold — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the polished stone, a shade darker, with a gilded moulding strip along the top of the edge.
WALL EDGES: the wall top faces read as a gilded cornice moulding, and the wall end cuts show the purple plaster core with a gold beading along every exposed edge.

THEME:
LEFT WALL: the three openings are tall ROUND-ARCHED balcony doorways — ornate gilded baroque surrounds with a carved keystone, a low wrought-iron balcony railing across the bottom, purple velvet drapes tied back at the sides, no glass — looking out onto a carnival night: fireworks bursting over a lantern-lit parade of floats, confetti in the air.
WALLS: deep purple baroque plaster with gold damask, carved gilt scrollwork panels and fluted pilasters.
WALL-MOUNTED DECOR ONLY: feathered masquerade masks in several styles, strings of purple-green-gold beads, a belled jester hat on a peg, gold fleur-de-lis emblems, ornate oval mirrors, a feather boa draped over a hook, wall candelabra with lit candles, ribbon rosettes, a tambourine.
Lighting: warm candlelight across the room, cool blue-and-pink firework flashes spilling in from the left openings.
Palette: royal purple, rich gold, emerald green, cream, small black-and-white harlequin accents.
```

### 記入例: china（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口を**八角の花窓（朱塗りの格子・ガラス無し）**にした例。格子は透けるので外が見える。
壁の天面を**翡翠色の瓦の笠木**にすると、宮殿の壁であることが縁だけで伝わる。
書は固定部の `no text` に反するので、掛軸は**文字の無い山水画**にする。
外の空は `lighting.mjs` の china が紅い空(0xC0342B)なので、夕焼けで揃える。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: polished dark red lacquered floor tiles laid diagonally along the iso grid, with only a faint
LOW-CONTRAST gold cloud-scroll inlay — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the lacquer over dark rosewood, a shade darker, with a thin gold trim line along the top of the edge.
WALL EDGES: the wall top faces read as a coping of jade-green glazed roof tiles, and the wall end cuts show the crimson plaster core with a gold beading along every exposed edge.

THEME:
LEFT WALL: the three openings are OCTAGONAL lattice windows — vermilion lacquered timber frames filled with fine geometric fretwork you can see straight through, no glass — looking out onto a red sunset sky over curved palace rooftops, pagoda silhouettes, flying cranes and distant blue mountains.
WALLS: crimson lacquered plaster with gold geometric fretwork panels, carved gilded dragons and cloud scrolls, dark rosewood columns with gold capitals.
WALL-MOUNTED DECOR ONLY: red paper lanterns hung at several heights, silk landscape scroll paintings with NO writing on them, a round gold dragon medallion, an open folding fan, carved jade discs, a wall shelf of blue-and-white porcelain vases, strings of gold coins with red tassels, a small brass gong on a bracket, carved peony reliefs, a hanging bundle of bamboo.
Lighting: warm red-gold lantern light from the left, deep crimson shadows.
Palette: crimson red, rich gold, jade green, dark rosewood, cream.
```

### 記入例: christmas（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口は**枠そのものを松のガーランドで作る**例。形は素直な四角のままだが、縁が緑の葉と赤リボンに
なるので cabin / factory の木枠・金属枠と混ざらない。壁の天面に**雪と氷柱**を載せるのも
このテーマ専用の縁の処理。

> 旧テーマ表には「背面角にツリー」とあるが、**床に置くものは規格違反**なので入れない。
> ツリー感が欲しければ壁掛けのツリー型ガーランドで代用する。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: warm honey timber floorboards laid diagonally along the iso grid, with only a faint
LOW-CONTRAST snowflake-and-holly inlay — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no furniture, no objects on the floor, NO christmas tree.
The slab's side faces show the cut edge of the boards, a shade darker, with a thin deep-green trim strip along the top of the edge.
WALL EDGES: the wall top faces carry a soft rounded cap of white snow with a few tiny icicles at the ends, and the wall end cuts show the pale timber core underneath.

THEME:
LEFT WALL: the three openings are plain gaps in the timber wall with NO glass, their edges completely wrapped in thick pine garland with red ribbon and holly berries, snow piled on the sills and small icicles along the top — looking out onto a snowy village at night: lit cottage windows, dark pines, falling snow, a sleigh silhouette against the deep blue sky.
WALLS: warm honey pine planking with a band of red-and-cream nordic pattern, deep green painted wainscot below.
WALL-MOUNTED DECOR ONLY: pine garlands with red ribbon and gold bells, a big holly wreath, strings of warm fairy lights, a carved wooden reindeer silhouette, framed snowy landscape pictures, crossed candy canes, a stone fireplace built into the right wall with red stockings hung above it and pinecones and candles on its mantel, a gold advent star, knitted mittens on a peg, an old wooden sled hung flat on the wall.
Lighting: cold blue moonlight spilling in from the left openings, warm orange firelight from the fireplace on the right, soft glow from the fairy lights.
Palette: deep pine green, warm red, cream, honey timber, gold, snow white.
```

### 記入例: circuit（差し替える部分だけ。固定部は arabia の例と全文同じ）

**circuit は電子回路ではなく F1 のサーキット（ピットガレージ）**。既存の `room-circuit.png` は
赤白の壁・チェッカーフラッグ・タイヤラック・工具板・ピットレーンの線が入ったガレージで、
窓の外はグランドスタンドとコース。この方向を維持する。

開口は**細い支柱で区切った大判のガラス**（ガレージの窓）。factory の桟割りの窓と混ざらないよう、
「小さな窓ガラスの格子ではなく、大きな一枚板」と明示する。
床スラブの側面を**コースの縁石（赤白の縞）**にすると、テーマがひと目で分かる。
ピットボードやタイミングモニターは文字を書かれやすいので、固定部の `no text` を補強する。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: glossy polished light-grey garage concrete laid diagonally along the iso grid, with a faint
LOW-CONTRAST pit-lane marking — one yellow line and thin white boxes — plus a soft reflective sheen.
Subtle, so objects placed on it stay readable. Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the concrete, a shade darker, with a RED-AND-WHITE KERB STRIPE running along the top of the edge like a race-track kerb.
WALL EDGES: the wall top faces show brushed aluminium capping with a thin red stripe, and the wall end cuts show the white panel core with a red edge line.

THEME:
LEFT WALL: the three openings are wide garage glazing panels — ONE big clean sheet of glass each, no small panes and no mullions, held by slim aluminium frames between red-and-white striped steel posts — looking out onto the pit lane and the circuit: kerbed asphalt, a packed grandstand, a start gantry with NO lettering on it, safety fencing, blue sky with a few clouds.
WALLS: red-and-white racing-liveried panels with a black-and-white chequered band, bolted seams and slim steel posts.
WALL-MOUNTED DECOR ONLY: a rack of stacked black slick tyres, chequered-flag banners, a pegboard of wrenches and impact guns, coiled air hoses on a reel, a spare front wing on brackets, a racing helmet on a shelf, a hanging race suit, a red fire extinguisher, a blank pit board with nothing written on it, a wall timing monitor showing only coloured bars.
IMPORTANT: no letters, numbers, words, logos or sponsor marks anywhere — signs, boards, monitors and banners are all blank or patterned only.
Lighting: bright daylight flooding in from the left glazing, cool white garage strip lights, hard reflections on the polished floor.
Palette: racing red, white, gunmetal grey, black rubber, small yellow line accents.
```

### 記入例: circus（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口を**テントの合わせ目（ロープの編み上げ＋帆布のフラップ）**にした例。
carnival（仮面舞踏会のバロックなバルコニー）と紛れないよう、circus は**大テントの帆布**に寄せる。
床は木くずなのでタイルの目地が無い。**斜めの掻き跡**で目地の代わりにする。
床スラブの側面は**リングの木製カーブ（赤白）**、壁の天面は**縞のスカラップ幕**にすると縁で伝わる。
ポスターは文字と顔を禁止する（固定部の `no text` / `no people` の補強）。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: packed red circus-ring sawdust, raked in faint diagonal lines that follow the iso grid,
with only a faint LOW-CONTRAST gold radial star motif — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the wooden ring kerb: red-and-white painted boards, a shade darker, with the sawdust layer visible as a thin band along the top of the edge.
WALL EDGES: the wall top faces carry a red-and-white SCALLOPED canvas valance with small gold tassels, and the wall end cuts show the raw striped canvas edge with a gold rope binding.

THEME:
LEFT WALL: the three openings are tent slits — the big top's canvas laced together with rope through brass eyelets, the flaps pulled back and tied at the sides, a scalloped striped pelmet over the top, no glass — looking out onto a fairground at dusk: a lit ferris wheel, strings of warm bulbs, striped tent tops, a purple-and-orange sky.
WALLS: red, cream and gold vertically striped big-top canvas with gold rope trim and star studs.
WALL-MOUNTED DECOR ONLY: strings of triangular bunting, framed circus posters showing only patterns and simple shapes, big gold stars, a trapeze bar and hanging rings, striped curtains tied back, a ribbon-wrapped hoop, juggling clubs on a rack, a bass drum hung flat, a brass megaphone, a caged bulb string, a ringmaster's top hat on a peg.
IMPORTANT: no letters, numbers or words on the posters or anywhere else, and no faces or figures on them either.
Lighting: warm golden bulb light from the left openings, soft dusk glow, gentle spotlight pools on the walls.
Palette: circus red, cream white, rich gold, deep navy shadows, small teal accents.
```

### 記入例: desert（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口を**上が狭い台形（プエブロ／日干し煉瓦の窓）**にした例。台形は他テーマで使っていないので
形だけで見分けがつく。arabia（宮殿のアーチ）や egypt（ヒエログリフ）と混ざらないよう、
desert は**土と砂岩の素朴な住居**に寄せる。
壁の天面から**梁（ヴィガ）の丸太を突き出させる**のがこのテーマ専用の縁の処理。
サボテンやパンパスは床置き禁止なので、壁龕か壁掛けにする。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: sun-baked sandstone slabs laid diagonally along the iso grid, with only a faint
LOW-CONTRAST wind-ripple pattern and a few scattered pebbles — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the sandstone: horizontal STRATA bands in ochre, rust and cream, a shade darker, with a thin drift of wind-blown sand along the top of the edge.
WALL EDGES: the wall top faces are rounded sun-bleached adobe coping with the ends of round wooden roof poles (vigas) protruding at intervals, and the wall end cuts show the mud-brick core flecked with straw.

THEME:
LEFT WALL: the three openings are TRAPEZOIDAL window holes — wider at the bottom, narrower at the top — punched through thick adobe with deep reveals, a lintel of lashed wooden poles and a rolled-up reed blind above, no glass — looking out onto rolling dunes at sunset: a palm oasis, a distant camel caravan in silhouette, a hot orange sky.
WALLS: stratified sandstone blocks below, sun-baked adobe plaster above, with carved petroglyph panels.
WALL-MOUNTED DECOR ONLY: a woven kilim hung flat, wall niches holding round clay pots, a horned animal skull, bundles of dried pampas grass, a small barrel cactus set in a wall niche, a punched-tin lantern, coiled rope on a peg, a hanging clay water jug, strings of dried red chillies, carved spiral petroglyphs.
Lighting: hot orange sunset light raking in from the left, long deep shadows, warm dusty tones.
Palette: ochre, rust orange, sun-bleached cream, terracotta, small faded turquoise accents.
```

### 記入例: diner（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口を**角丸のクローム枠＋中桟1本**にした例。circuit（細い支柱の大判一枚ガラス）と紛れないよう、
diner は**厚いクロームの縁と角丸**で流線形を出す。
床の市松は本来は白黒だが、そのままだと設置物が柄に埋もれるので**チャコール×クリームの低コントラスト**にする。
ネオン看板・時計・メニュー板・ナンバープレートは文字が入りやすいので、**文字と数字を全面禁止**する。
床置きのジュークボックスは規格違反なので、壁掛け型のセレクターにする。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: glossy checkerboard diner tiles laid diagonally along the iso grid — alternating charcoal and
cream rather than pure black and white, kept LOW CONTRAST so objects placed on it stay readable —
with a soft polished sheen. Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show a polished CHROME skirting band with a thin cherry-red stripe along the top of the edge.
WALL EDGES: the wall top faces are polished chrome capping with a slim glowing neon tube run along them, and the wall end cuts show the mint-green tile core.

THEME:
LEFT WALL: the three openings are wide diner windows with ROUNDED CORNERS in thick polished chrome frames, one horizontal chrome bar across the middle of each, a mint-tiled bulkhead below the sill — looking out onto a sunny 1950s street: a finned classic car at the kerb, a lamp post, low storefronts, bright blue sky.
WALLS: glossy mint-green subway tile below a wide chrome band, cream panelling above with cherry-red accent stripes and chrome rivet trim.
WALL-MOUNTED DECOR ONLY: neon wall signs shaped as arrows, hearts and stars, a chrome-framed wall clock with only tick marks on its face, a hanging glass pie display case, chrome milkshake mixers on a wall shelf, a wall-mounted jukebox selector, a red vinyl padded panel, chrome napkin dispensers and a ketchup-and-mustard pair on a shelf, a hanging chrome coffee urn, a blank menu board with coloured stripes only.
IMPORTANT: no letters, numbers or words anywhere — the neon, the clock face, the menu board and every sign are shapes and colours only.
Lighting: bright midday daylight flooding in from the left windows, warm pink-and-blue neon glow, hard chrome highlights.
Palette: cherry red, mint green, cream, polished chrome, charcoal, neon pink and blue accents.
```

### 記入例: dino（差し替える部分だけ。固定部は arabia の例と全文同じ）

既存の `room-dino.png` は発掘現場の岩窟。**床に骨格と足跡が平らに埋まっている**のが看板で、
これは「床に置いた物」ではなく面の模様なので今の規格と両立する。ただし主張が強いと設置物が
読みにくくなるので、`LOW-CONTRAST` かつ `flush with the surface` を明示する。
開口は**岩を叩き割った洞窟口**（上はアーチだが縁がギザギザ）。arabia の整ったアーチや
carnival の半円バロックと形で区別できる。
床スラブの側面に**骨と琥珀が埋まった地層**を出すのがこのテーマ専用の縁の処理。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: sandy-brown flagstones and packed dirt laid diagonally along the iso grid, with a large
dinosaur skeleton and a few three-toed footprints fossilised FLUSH INTO the surface as flat imprints —
kept LOW CONTRAST so objects placed on it stay readable. Nothing stands up from the floor:
completely clear and EMPTY — no furniture, no props, no loose bones lying on it.
The slab's side faces show the cut edge of layered sediment with fossil BONES and chunks of glowing amber embedded in the strata, a shade darker, with a thin lip of packed dirt along the top of the edge.
WALL EDGES: the wall top faces are rough broken rock with a few green vines trailing over them, and the wall end cuts show layered sedimentary rock.

THEME:
LEFT WALL: the three openings are cave mouths hacked through the rock — arched at the top but with an irregular, chipped stone edge, no frames, no glass — looking out onto a prehistoric valley: a smoking volcano, tree ferns, pterodactyls circling, a long-necked dinosaur in silhouette, a hot orange sky.
WALLS: rough stacked stone blocks with earth packed between them, cracks and claw gouges.
WALL-MOUNTED DECOR ONLY: a big horned dinosaur skull mounted on the wall, a ribcage-and-spine fossil half excavated out of the stone, clusters of glowing amber crystals, flaming torches on bone brackets, hanging green vines, a clutch of speckled eggs set in a wall niche, a fossilised spiral ammonite, fern fronds sprouting from wall cracks.
Lighting: warm orange volcano and torch light from the left, deep brown shadows, amber glow from the crystals.
Palette: sandy tan, warm brown, bone cream, glowing amber orange, moss green.
```

### 記入例: dwarf（差し替える部分だけ。固定部は arabia の例と全文同じ）

既存の `room-dwarf.png` は坑木（角材＋鉄の帯金）で支えた鉱山。壁に青紫と金の鉱石、
壁掛けのツルハシとランタン、開口の外は**空ではなく鍾乳石と溶岩の洞窟**。この方向を維持する。
開口は**角材で枠組みした坑道の口**。dino の岩を割った洞窟口や cabin の丸太の穴と、
「角材＋鉄の帯金」で区別できる。
ルーン文字は固定部の `no text` に反するので明示的に禁止する。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: grey chiselled stone flagstones laid diagonally along the iso grid, with only a faint
LOW-CONTRAST pattern of hairline cracks and a few tiny gem glints embedded flush in the stone —
subtle, so objects placed on it stay readable. Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the flagstones over rough bedrock, a shade darker, with a thin GOLD VEIN and a couple of gem glints running through the strata below the top edge.
WALL EDGES: the wall top faces are rough hewn rock capped by a heavy squared timber beam with black iron strapping, and the wall end cuts show the raw bedrock core.

THEME:
LEFT WALL: the three openings are mine adits — rough passages framed by heavy squared timber posts and a lintel beam bolted with black iron brackets, no doors, no glass — looking through into a deep cavern: hanging stalactites, rising stalagmites, rivers of glowing orange lava, dark rock far above.
WALLS: rough chiselled granite blocks studded with clusters of blue, violet and gold ore, braced by heavy timber shoring posts with iron bands.
WALL-MOUNTED DECOR ONLY: pickaxes hung on pegs, iron oil lanterns on hooks, big gem clusters growing out of the rock, an exposed gold vein, a coil of rope, an iron-banded bucket on a hook, a hanging chain hoist, a wall-mounted whetstone, a rack of chisels, a mine cart wheel hung flat.
IMPORTANT: no runes, letters, numbers or carved inscriptions anywhere.
Lighting: warm orange lava glow pouring in from the left openings, pools of lantern light, cool blue glints off the gems, deep shadows.
Palette: cool grey granite, warm timber brown, iron black, glowing lava orange, gem blue, violet and gold.
```

### 記入例: egypt（差し替える部分だけ。固定部は arabia の例と全文同じ）

**このテーマだけ `no text` の例外を明示する。** ヒエログリフはテーマの看板なので入れたいが、
固定部には `no text` がある。ヒエログリフは絵文字として扱い、
**ラテン文字・数字・現代の単語は禁止のまま**にする、と書き分ける。
開口は**ロータス柱で挟んだ楣（まぐさ）式**。desert の台形と紛れないよう、柱＋反り縁＋有翼日輪で
神殿の意匠にする。壁の天面を**エジプトのカヴェット・コーニス（青赤金の縦縞）**にするのが縁の見せ場。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: polished sandstone slabs laid diagonally along the iso grid, with only a faint
LOW-CONTRAST gold inlay of an Eye of Horus and a few scarabs — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the sandstone, a shade darker, with a painted band of blue-and-gold chevrons along the top of the edge.
WALL EDGES: the wall top faces are an Egyptian CAVETTO CORNICE painted in vertical blue, red and gold stripes, and the wall end cuts show the plain sandstone core.

THEME:
LEFT WALL: the three openings are temple post-and-lintel doorways — each flanked by a carved lotus-bud column and topped by a cavetto cornice with a winged sun disk, no doors, no glass — looking out onto the Nile at golden hour: feluccas with white sails, date palms, three pyramids on the far bank, a warm golden sky.
WALLS: polished sandstone blocks covered in carved and painted relief registers.
WALL-MOUNTED DECOR ONLY: carved hieroglyph panels, a gold Anubis head mounted on the wall, a big Eye of Horus, ankh symbols, a scarab beetle relief, a golden Ra sun disk, bronze wall torches, a shelf of painted canopic jars, a gold pharaoh mask, a papyrus fan, a broad beaded collar hung flat.
IMPORTANT: carved Egyptian hieroglyph symbols ARE wanted — they count as pictures, not writing.
But no Latin letters, no numbers, no modern words anywhere in the image.
Lighting: golden desert light raking in from the left, warm pools of torchlight, deep umber shadows.
Palette: sandstone gold, lapis blue, turquoise, deep red ochre, black, bright gold.
```

### 記入例: fantasy（差し替える部分だけ。固定部は arabia の例と全文同じ）

既存の `room-fantasy.png` は魔法使いの塔の書斎。石壁に光るルーン、尖頭アーチの窓の外はオーロラ、
紫の旗、シャンデリア、そして**床に光る魔法陣**。魔法陣は面の模様なので活かせるが、
**床置きの本棚と浮遊水晶は壁掛けに移す**（マスを塞ぐため）。
ルーンは egypt のヒエログリフと同じ扱いで、**絵としての紋様は可・ラテン文字と数字は禁止**。
開口は**石の狭間飾り（トレーサリー）入りの尖頭ランセット**。arabia のオージーアーチとは
「石の細工が入る／S字カーブではない」で区別する。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: grey stone flagstones laid diagonally along the iso grid, with a glowing arcane circle inlaid
FLUSH into the surface at the centre and a thin drift of low mist — the circle glows softly but stays
RESTRAINED so objects placed on it remain readable. Nothing stands up from the floor: completely
clear and EMPTY — no bookcases, no crystals, no furniture on the floor.
The slab's side faces show the cut edge of the stone, a shade darker, with a faint line of glowing glyph-light seeping out of the mortar joints along the top of the edge.
WALL EDGES: the wall top faces are weathered chamfered stone capping with a thin thread of cyan glow running along them, and the wall end cuts show the plain stone core.

THEME:
LEFT WALL: the three openings are tall pointed LANCET arches with carved stone tracery in their heads, open to the air with no glass — looking out onto a night sky lit by green and violet aurora, with a few stars and a distant mountain ridge.
WALLS: grey cut stone blocks carved with glowing cyan arcane glyphs.
WALL-MOUNTED DECOR ONLY: purple heraldic banners with an abstract sigil, WALL-HUNG shelves of spellbooks, a hanging iron candle chandelier, crystals hovering inside wall niches, a brass astrolabe hung flat, a rack of rolled scrolls, bundles of dried herbs, a crystal orb on a wall bracket, dripped candles on stone brackets.
IMPORTANT: glowing arcane glyphs and sigils ARE wanted — they count as patterns, not writing.
But no Latin letters, no numbers, no readable words anywhere in the image.
Lighting: cool aurora light spilling in from the left openings, warm candlelight from the chandelier, soft cyan and violet magical glow.
Palette: cool grey stone, deep violet, glowing cyan, warm candle gold, teal.
```

### 記入例: halloween（差し替える部分だけ。固定部は arabia の例と全文同じ）

既存の `room-halloween.png` は**橙の壁紙＋紫のガーランド＋光るカボチャの「飾り付けた部屋」**。
`haunted`（朽ちた洋館）とは別方向なので、halloween は明るく祭り寄りに保つ。
開口は christmas と同じ考え方で**枠の素材で個性を出す**（christmas=松のガーランド／
halloween=枯れ枝と蜘蛛の巣）。carnival の金のバロックな半円アーチとはこれで区別できる。
床スラブの側面に**コウモリのシルエットの帯**を回すと、既存デザインの壁の腰帯と呼応する。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: dark grey-purple plank boards laid diagonally along the iso grid, with only a faint
LOW-CONTRAST pattern of cobweb wisps and a few pale green and purple light pools lying flat on the surface —
subtle, so objects placed on it stay readable. Completely clear and EMPTY — no furniture, no pumpkins on the floor.
The slab's side faces show the cut edge of the boards, a shade darker, with a row of small black BAT SILHOUETTES painted along the top of the edge.
WALL EDGES: the wall top faces are glossy black capping with a small carved pumpkin finial at each outer end, and the wall end cuts show the orange wallpaper edge over a dark timber core.

THEME:
LEFT WALL: the three openings are round-topped holes whose surrounds are wrapped in twisted bare branches and torn cobwebs — no frames, no glass — looking out onto a moonlit night: a huge full moon, leafless black trees, bats in flight, a crooked fence with tiny lit jack-o'-lanterns along it, deep indigo sky.
WALLS: bright pumpkin-orange wallpaper with a subtle darker purple leaf pattern, a black bat-silhouette border running along the base, a black picture rail.
WALL-MOUNTED DECOR ONLY: glowing jack-o'-lanterns hung on hooks with a soft green halo, strings of purple triangular bunting, cobwebs with fat spiders in the corners, a witch hat on a peg, a black cat cutout, a broomstick hung flat, candy buckets on a wall shelf, a paper skeleton garland, a candelabra with dripping candles, a hanging paper ghost.
Lighting: cold blue moonlight from the left openings, warm orange glow from the pumpkins, sickly green accents.
Palette: pumpkin orange, deep purple, black, bone cream, small toxic-green accents.
```

### 記入例: haunted（差し替える部分だけ。固定部は arabia の例と全文同じ）

既存の `room-haunted.png` は朽ちたヴィクトリア朝の洋館（halloween の祭り部屋とは逆方向）。
紫のダマスク壁紙が剥がれ、金縁の肖像画、角の頭骨、蜘蛛の巣、緑の湿気、破れた深紅のカーテン。

**このテーマは `no people` に例外を作る。** 肖像画はテーマの看板なので入れたいが、固定部には
`no characters, no people` がある。**額の中の顔は可・室内に立つ人物は禁止**と書き分ける。

既存の絵から落とすもの: **床の絨毯**（ゲーム側に設置物としての絨毯があるので背景に焼くと衝突する）、
**床置きの燭台と床の瓦礫**（マスを塞ぐ）。燭台は壁付けのブラケットに移す。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: dark warped plank boards laid diagonally along the iso grid, with only a faint
LOW-CONTRAST bloom of green damp mould and grey dust lying flat on the surface —
subtle, so objects placed on it stay readable. Completely clear and EMPTY —
no rug, no carpet, no candlestick, no debris, no furniture on the floor.
The slab's side faces show the cut edge of the rotted boards, splintered and a shade darker, with strands of cobweb strung along the top of the edge.
WALL EDGES: the wall top faces are cracked plaster cornice with paint peeling off it and a cobweb draped at each outer end, and the wall end cuts show the lath and horsehair plaster core.

THEME:
LEFT WALL: the three openings are tall ruined windows — warped frames holding jagged shards of broken glass, heavy torn crimson velvet curtains hanging askew from bent iron rods — looking out onto an overgrown moonlit graveyard: dead trees, crooked headstones, low fog, a wrought-iron fence, a full moon behind ragged clouds.
WALLS: faded aubergine damask wallpaper peeling away in long strips over dark stained wainscot panelling, water stains and cracks.
WALL-MOUNTED DECOR ONLY: gilt-framed portrait paintings gone dark with age, a mounted antlered skull, iron wall sconces with dripping guttering candles, a cracked mirror, a stopped pendulum clock on the wall, a dusty violin hung flat, a moth-eaten tapestry, thick cobwebs in the upper corners.
IMPORTANT: faces are allowed ONLY inside the picture frames. No person, ghost or creature is present in the room itself. No letters, numbers or words anywhere.
Lighting: cold blue moonlight through the left openings, weak flickering candlelight, a sickly green cast from the damp.
Palette: faded aubergine purple, dusty rose, tarnished gold, blackened timber, mould green.
```

### 記入例: hell（差し替える部分だけ。固定部は arabia の例と全文同じ）

既存の `room-hell.png` は黒い玄武岩に溶岩の亀裂、床中央に光る五芒星、山羊の頭骨、鎖、
右壁の裾に頭蓋骨の欄干。床の五芒星と溶岩の亀裂は面の模様なので活かせる。

`dwarf` と溶岩で被るので住み分ける: dwarf=灰色の花崗岩＋坑木＋宝石＋ランタン（採掘場）／
hell=黒い玄武岩＋溶岩の亀裂＋骨と鎖（木材と宝石は使わない）。
開口は**岩が裂けた不定形の亀裂（縁が赤熱）**。dino の欠けたアーチや dwarf の角材の枠と形で分かれる。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: cracked black basalt slabs laid diagonally along the iso grid, with glowing orange lava
seeping along the cracks and a red pentagram sigil burned FLUSH into the surface at the centre —
the glow stays RESTRAINED so objects placed on it remain readable. Completely clear and EMPTY —
no furniture, no braziers, no rubble on the floor.
The slab's side faces show the cut edge of the basalt, a shade darker, with molten orange lava glowing out from deep inside the cracks below the top edge.
WALL EDGES: the wall top faces are jagged blackened rock with small licks of flame flickering along them, and the wall end cuts show basalt shot through with glowing lava seams.

THEME:
LEFT WALL: the three openings are ragged FISSURES torn straight through the basalt — irregular jagged edges still glowing molten orange where the rock is hot, no frames, no glass — looking out over a hellscape: a wide river of lava, black spires of rock, drifting smoke, a dull red sky.
WALLS: black basalt slabs veined with glowing lava cracks, scorched and blistered.
WALL-MOUNTED DECOR ONLY: horned ram skulls mounted on the rock, heavy iron chains hung on hooks, a carved pentagram relief glowing red, iron braziers on wall brackets with floating flames, a low stone parapet with skull balusters running along the base of the right wall, iron spikes, a bone trophy rack.
IMPORTANT: no letters, numbers or words anywhere. No person, demon or creature is present in the room.
Lighting: intense orange-red glow from the left fissures and the floor cracks, deep black shadows, no cool light anywhere.
Palette: black basalt, charcoal, glowing lava orange, blood red, bone grey.
```

### 記入例: ice（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口は**氷柱で縁取られた氷柱（ピラー）の間の隙間**。固定部の例に `a crack in ice` があるが、
それは hell の「岩が裂けた亀裂」と形が近くなるので、ice は**柱と氷柱で枠を作る**方向にする
（christmas=松のガーランド / halloween=枯れ枝 / haunted=破れたカーテン と同じ「枠の素材で個性」）。
床スラブの側面から**氷柱を垂らす**のがこのテーマ専用の縁の処理。
外の景色は fantasy もオーロラなので、ice は**淡い青の薄暮＋雪山と凍った松**に寄せ、
fantasy（夜・紫と緑の強いオーロラ・魔術）と色で分ける。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: polished pale blue ice panels laid diagonally along the iso grid, with only a faint
LOW-CONTRAST frost-crystal pattern and soft reflections — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the ice: translucent blue with trapped air bubbles, a shade darker, and a row of small ICICLES hanging down from the top of the edge.
WALL EDGES: the wall top faces carry a crest of jagged rime-ice spikes growing upward, and the wall end cuts show layered clear-and-blue ice full of tiny bubbles.

THEME:
LEFT WALL: the three openings are gaps between thick translucent ICE PILLARS, with a dense fringe of icicles hanging across the top of each and frost creeping around the edges, no glass — looking out onto a frozen twilight landscape: snow-laden pines, a frozen lake, white mountain peaks, a pale ribbon of aurora low on the horizon.
WALLS: stacked semi-transparent ice blocks with visible seams, deep blue where they are thick, frost bloom across the surface.
WALL-MOUNTED DECOR ONLY: long icicles hanging from ledges, clusters of blue glowing crystals, carved snowflake reliefs, ice candelabra burning with pale blue flames, an icicle chandelier hanging overhead, a frosted mirror, feathery frost-fern patterns spreading across the ice.
Lighting: pale cyan twilight from the left openings, cold blue shadows, an ethereal glow from the crystals and the blue flames.
Palette: pale ice blue, white, deep glacier teal, silver, glowing cyan.
```

### 記入例: japan（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口は**引き開けた障子**。障子は本来向こうが見えないので「開けてある」ことを明示し、
残った障子の桟が枠の意匠になる。丸窓は space の舷窓と、格子は china の花窓と紛れるので使わない。
床は畳。畳は2:1なので**1枚が2マス分**になると書いておくと目地が破綻しない。
床スラブの側面を**畳の厚い藁の断面**にするのがこのテーマ専用の縁の処理。
掛軸は china と同じく**文字なしの山水画**に限定する（固定部の `no text`）。
外は `lighting.mjs` の japan が桜の空(0xF6B5C0)なので、桜と縁側の庭で揃える。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: pale green tatami mats laid diagonally along the iso grid — each mat spans two tiles and is
edged with a slim dark indigo cloth border — with only a faint LOW-CONTRAST woven straw texture.
Subtle, so objects placed on it stay readable. Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the tatami: a thick pale layer of packed straw over a dark timber base rail, a shade darker, with the indigo border wrapping the top of the edge.
WALL EDGES: the wall top faces are a dark walnut beam with a clean chamfer, and the wall end cuts show the pale earthen plaster core flecked with straw.

THEME:
LEFT WALL: the three openings are shoji screens SLID OPEN — dark timber frames with the paper-and-lattice panels pushed aside so the garden shows through the gap, a low wooden threshold below, no glass — looking out onto a spring garden: a cherry tree in full bloom, petals drifting down, a stone lantern, raked gravel, a small pond, a soft pink sky.
WALLS: pale earthen plaster with exposed dark walnut posts and a horizontal nageshi rail, and a shallow tokonoma alcove recessed into the right wall.
WALL-MOUNTED DECOR ONLY: a hanging scroll painted with a landscape and NO writing on it, a round white paper lantern, a rolled-up bamboo sudare blind, a katana on a wall rack, a noh mask hung flat, an open folding fan, a wall shelf of tea bowls, a glass wind chime, a small bonsai on a wall bracket, an ikebana arrangement set in the alcove.
Lighting: soft diffuse pink-white daylight from the left openings, warm glow from the paper lantern, gentle shadows.
Palette: pale straw green, warm cream plaster, dark walnut, indigo accents, sakura pink.
```

### 記入例: jungle（差し替える部分だけ。固定部は arabia の例と全文同じ）

開口は**マヤの持ち送りアーチ（頭が階段状の三角）**。他のどのテーマとも形が重ならない強い意匠。
マヤのグリフと石像の顔は egypt / haunted と同じ例外扱いにする
（**紋様としてのグリフと彫刻の顔は可・ラテン文字と室内に立つ人物は禁止**）。
`dino` も岩と蔦で近いので住み分ける: dino=素の割れ岩＋骨と琥珀（発掘現場）／
jungle=彫刻された石灰岩＋苔と植物（遺跡）。壁の天面も dino は素の割れ岩、jungle は彫りのある蛇腹。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: mossy cracked limestone slabs laid diagonally along the iso grid, with only a faint
LOW-CONTRAST carved vine-and-leaf motif and patches of moss in the joints — subtle, so objects
placed on it stay readable. Completely clear and EMPTY — no furniture, no plants, no objects on the floor.
The slab's side faces show the cut edge of the limestone, a shade darker, with moss cushioning the top of the edge and small ferns and thin aerial roots trailing down from it.
WALL EDGES: the wall top faces are a stepped stone cornice carved with a running vine motif and thickly padded with moss, and the wall end cuts show the pale limestone core threaded with fine roots.

THEME:
LEFT WALL: the three openings are MAYAN CORBEL ARCHES — tall doorways whose heads step inward in stone courses to a narrow point, edges overgrown with creeping vines and hanging roots, no doors, no glass — looking out into deep jungle: a waterfall plunging into a green pool, a dense canopy, shafts of dappled sunlight, a stepped stone pyramid in the distance, butterflies.
WALLS: carved limestone blocks covered in Mayan-style relief glyph panels, moss growing in every joint.
WALL-MOUNTED DECOR ONLY: carved glyph panels, a big stone deity mask, a large carved sun disk, emerald crystals set into the stone, monstera leaves and ferns growing straight out of the wall, hanging orchids, butterflies resting on the stone, trailing aerial roots, a carved serpent frieze, a stone ledge holding obsidian offerings.
IMPORTANT: carved Mayan glyphs and carved stone faces ARE wanted — they count as carvings, not writing or people.
But no Latin letters, no numbers, and no living person or creature standing in the room.
Lighting: green dappled sunlight filtering in from the left openings, humid warm shadows, small emerald glints.
Palette: mossy green, weathered limestone grey, deep jungle green, emerald, warm ochre sunlight.
```

### 記入例: mushroom（差し替える部分だけ。固定部は arabia の例と全文同じ）

部屋の中＝**巨大キノコの軸の内側**。開口は**縁が丸く巻いた不定形の楕円の穴**にする。
石やガラスの枠を持つテーマが多いので、ここは「有機的でフチが柔らかい」ことが個性になる。
床スラブの側面を**繊維質の軸の断面＋苔と小キノコ**にするのが縁の処理。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: warm honey wood laid diagonally along the iso grid with soft patches of moss, and only a faint
LOW-CONTRAST fairy ring of leaves and tiny mushroom caps inlaid flush — subtle, so objects placed on it
stay readable. Completely clear and EMPTY — no furniture, no mushrooms standing on the floor.
The slab's side faces show the cut edge as pale FIBROUS mushroom-stem flesh under the wood, a shade darker, with moss fringing the top of the edge and a few tiny mushrooms sprouting from it.
WALL EDGES: the wall top faces are a soft rolled ridge of pale cream stem flesh with tiny glowing mushrooms growing along it, and the wall end cuts show the fibrous cream interior of the stem.

THEME:
LEFT WALL: the three openings are soft-edged OVAL holes in the fleshy stem — thick rounded rims of pale mushroom flesh with little mushrooms growing around them, no frames, no glass — looking out into an enchanted forest: glowing blue mushrooms, a narrow stream, drifting fireflies, tall trees with sunlight filtering down.
WALLS: the curved inner wall of a giant mushroom stem — pale cream fibrous flesh banded with warm wood grain, moss and thin vines climbing up it.
WALL-MOUNTED DECOR ONLY: clusters of glowing teal mushrooms, lantern mushrooms hanging like lamps, trailing vines and moss, acorn ornaments on strings, pressed-flower frames, a birch-bark shelf of glowing spore jars, strings of tiny fairy lights, a snail resting on the wall, garlands of dried leaves.
Lighting: soft green dappled forest light from the left openings, warm glow from the lantern mushrooms, gentle teal bioluminescence.
Palette: cream mushroom flesh, warm honey wood, moss green, glowing teal and blue, soft coral pink accents.
```

### 記入例: onsen（差し替える部分だけ。固定部は arabia の例と全文同じ）

`japan` と和で被るので住み分ける: japan=畳＋障子＋春の桜（座敷）／
onsen=濡れた石＋檜＋秋の紅葉と湯気（湯屋）。素材も季節も別にする。
開口は**石の柱の間＋檜の梁＋短い暖簾**。japan の障子と混ざらない。
床スラブの側面から**湯気が立ち上る**のがこのテーマ専用の縁の処理。
お地蔵さんは顔を持つので、jungle の石像と同じ例外扱い（**彫像は可・生身の人物は禁止**）。
掛軸は文字なしの山水画に限定する。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: wet dark stone slabs laid diagonally along the iso grid with a band of pale hinoki decking,
and only a faint LOW-CONTRAST ripple pattern and a few small pebbles, plus a damp reflective sheen —
subtle, so objects placed on it stay readable. Completely clear and EMPTY — no bath, no buckets, no objects on the floor.
The slab's side faces show the cut edge of the wet stone over a pale hinoki base rail, a shade darker, with a thin trickle of water and soft WISPS OF STEAM curling up along the top of the edge.
WALL EDGES: the wall top faces are a pale hinoki beam with a slight overhang and a split-bamboo gutter, and the wall end cuts show stacked stone with pale mortar between the courses.

THEME:
LEFT WALL: the three openings are gaps between rough stacked stone piers under a heavy hinoki lintel — a short indigo noren curtain hanging across the top of each, a low bamboo half-screen at the sill, steam drifting through, no glass — looking out onto an autumn mountain bath: blazing red and orange maples, a waterfall, a stone lantern, misty peaks, a warm sunset sky.
WALLS: rough stacked stone below, pale hinoki plank cladding and exposed beams above.
WALL-MOUNTED DECOR ONLY: a bamboo shishi-odoshi mounted on the wall, indigo noren panels, a shelf of wooden buckets and ladles, a round paper lantern, bamboo stalks and a small bonsai on a wall bracket, a mountain landscape scroll with NO writing on it, folded tenugui towels over a rail, a small stone Jizo statue set in a wall niche, a rolled bamboo blind, drifting wisps of steam.
IMPORTANT: the carved stone Jizo statue is fine — but no living person is present in the room, and no letters, numbers or words anywhere.
Lighting: warm amber sunset raking in from the left openings, light softened and diffused by the steam, a gentle glow from the paper lantern.
Palette: wet charcoal stone, pale hinoki cream, deep indigo, autumn maple red and orange, soft steam white.
```

### 記入例: pirate（差し替える部分だけ。固定部は arabia の例と全文同じ）

部屋の中＝**海賊船の砲列甲板**。開口は**砲門（ガンポート）**にする。
分厚い船体を四角く抜き、木の蓋をロープで跳ね上げて留めた形。船尾窓にすると factory の桟割りの窓と、
丸窓にすると space の舷窓と紛れるので使わない。
床スラブの側面を**船体の厚板＋銅板張り**にするのが縁の処理。
海図は文字を書かれやすいので、**海岸線と赤い×だけ**に限定する。
床のモチーフにコンパス紋を使うと retrofuture と被るので、こちらは使わない。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: dark oak deck planks laid diagonally along the iso grid with tarred caulk seams, and only a faint
LOW-CONTRAST scatter of dried sand and pale salt stains — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no barrels, no chests, no cannon, no furniture on the floor.
The slab's side faces show the cut edge of the hull: layers of thick oak planking over a heavy beam, a shade darker, with a strip of green-tinged COPPER SHEATHING and rows of nails along the top of the edge.
WALL EDGES: the wall top faces are a thick oak gunwale rail with rope coiled around it, and the wall end cuts show layered hull planking with black caulk lines and copper nail heads.

THEME:
LEFT WALL: the three openings are GUN PORTS — square holes cut through the thick hull, each with its heavy timber port lid swung up and lashed open with rope, thick planking visible in the reveal, no glass — looking out over open sea at sunset: rolling swell, another tall ship on the horizon, gulls, a burning orange sky.
WALLS: dark tarred oak hull planking with curved ribs and heavy iron bolts.
WALL-MOUNTED DECOR ONLY: a ship's wheel hung on the wall, a Jolly Roger flag, swinging brass lanterns, coiled rope on pegs, a cutlass and a flintlock crossed, a slung hammock, a parrot on a wall perch, a sea chart showing only coastlines and a red X, a brass sextant, a fishing net with shells caught in it.
IMPORTANT: no letters, numbers or words anywhere — the chart has no labels. No person is present in the room.
Lighting: warm golden sunset light pouring through the gun ports from the left, swinging lantern light, deep brown shadows.
Palette: dark tarred oak, weathered timber, brass, deep red, sea blue-green, bone white.
```

### 記入例: retrofuture（差し替える部分だけ。固定部は arabia の例と全文同じ）

ヴェルヌ的な潜水艦（ノーチラス）の艦内。テーマ表の「潜水艦の丸窓」は space の舷窓と形が被るので、
**真鍮の装飾枠＋放射状の桟＋分厚い曲面ガラス**にして差を付ける
（space=機能一点張りの鋼の丸窓・ガラス無しでも可／retrofuture=装飾過多の真鍮枠・水中なのでガラス必須）。
`undersea` とも水中で被るが、undersea=珊瑚と生物の有機的な海中、retrofuture=真鍮と木の人工物。
パイプオルガンは床置きになるので、**壁付けのパイプ列**だけにする。
計器は数字を書かれやすいので目盛りだけに限定する。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: polished dark stone slabs laid diagonally along the iso grid, with only a faint
LOW-CONTRAST brass-inlaid compass rose at the centre — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no furniture, no machinery standing on the floor.
The slab's side faces show the cut edge of the stone over a riveted BRASS base plate, a shade darker, with a row of round rivet heads along the top of the edge.
WALL EDGES: the wall top faces are polished brass capping with a beaded line of rivets and small gimbal lamps set into them, and the wall end cuts show layered brass plate over dark walnut.

THEME:
LEFT WALL: the three openings are grand submarine VIEWPORTS — thick curved glass held in heavy ornate brass frames with radiating decorative spokes, big hinges and a ring of rivets — looking out into a flooded volcanic lake: glowing orange lava vents on the lakebed, drifting shoals of fish, tall kelp, dark green water shading to black.
WALLS: riveted brass and burnished copper plating set into dark walnut panelling with Victorian filigree.
WALL-MOUNTED DECOR ONLY: a bank of brass organ pipes mounted flat against the right wall, brass pressure gauges and dials with only tick marks on their faces, a large ornate barometer, a copper diving helmet on a bracket, a shelf of glass specimen jars, a mounted nautilus shell, brass speaking tubes, a rack of rolled charts, gimbal-mounted oil lamps, a ship's telegraph on the wall.
IMPORTANT: no letters, numbers or words anywhere — every dial, plate and chart carries marks and patterns only.
Lighting: cool green-blue light filtering in through the left viewports, warm amber glow from the oil lamps, hard brass highlights.
Palette: burnished brass, copper, dark walnut, deep teal water light, ivory cream, amber lamplight.
```

### 記入例: scifi（差し替える部分だけ。固定部は arabia の例と全文同じ）

既存の `room-scifi.png` は継ぎ目の無い宇宙船内。シアンとマゼンタの発光ライン、床のヘックス格子と
ホログラムの円、丸角の縦長ビューポート。`space` と住み分ける:

| | space | scifi |
|---|---|---|
| 壁 | リベット打ちのガンメタ・ハザード縞 | 継ぎ目の無い滑らかなパネル（リベット無し） |
| 発光 | シアンのみ | シアン＋マゼンタ |
| 小物 | 酸素タンク・宇宙服ロッカー・ドッキングハッチ | 光る薬瓶・波形モニタ・ホロ投影 |
| 開口 | 丸いリベット舷窓 | 丸角の縦長ビューポート（カプセル型） |
| 外 | 青い地球 | 星雲と惑星 |

床のホログラム円は面の模様として `FLUSH` 指定にする。モニタは波形だけにして数字を禁止。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: dark blue-grey metal deck panels laid diagonally along the iso grid, with only a faint
LOW-CONTRAST cyan hexagon lattice inlaid flush and a glowing holographic ring projected FLAT onto the
surface — restrained, so objects placed on it stay readable. Completely clear and EMPTY —
no furniture, no consoles standing on the floor.
The slab's side faces show the cut edge of layered composite decking, a shade darker, with a thin glowing CYAN LIGHT STRIP and a slim conduit running along the top of the edge.
WALL EDGES: the wall top faces are seamless brushed panel with a hot MAGENTA light strip inset along them, and the wall end cuts show layered composite with a glowing cyan seam.

THEME:
LEFT WALL: the three openings are tall CAPSULE-SHAPED viewports — rounded-rectangle apertures in slim brushed-metal frames with a glowing cyan edge line and seamless curved glass — looking out into deep space: a violet and blue nebula, drifting stars, a ringed planet, a small distant moon.
WALLS: smooth seamless blue-grey panelling with no rivets, recessed cyan and magenta light strips tracing the seams.
WALL-MOUNTED DECOR ONLY: banks of wall monitors showing only waveforms and abstract graphs, hanging cable bundles with glowing fluid vials, recessed vent grilles, a holographic projector node, a sealed sliding door panel, a rack of glowing power cells, a med-scanner alcove, thin light conduits tracing the panel joints.
IMPORTANT: no letters, numbers or words anywhere — every screen and panel shows waveforms, bars and glyph-free graphics only.
Lighting: cool nebula light from the left viewports, cyan and magenta glow from the strips, deep dark ambient.
Palette: dark blue-grey, brushed steel, glowing cyan, hot magenta, deep space violet.
```

### 記入例: steampunk（差し替える部分だけ。固定部は arabia の例と全文同じ）

`retrofuture` と真鍮のヴィクトリアンで被るので住み分ける:
retrofuture=潜水艦の艦内・水中・胡桃材＋真鍮・オルガンパイプ／
steampunk=陸の工房・セピアの煙突街・マホガニー＋真鍮・歯車と蒸気。
開口は**虹彩絞り（アイリス）**。丸い形は space / retrofuture と共通だが、
**重なった羽根と歯車のリング**という機構が見えるので一目で別物になる。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: dark mahogany parquet laid diagonally along the iso grid, with only a faint
LOW-CONTRAST brass gear inlay — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no furniture, no machinery standing on the floor.
The slab's side faces show the cut edge of the parquet over a riveted iron frame, a shade darker, with a row of small brass COGS set along the top of the edge.
WALL EDGES: the wall top faces are a brass rail with little turning cogs and a copper pressure pipe running along them, and the wall end cuts show layered mahogany panel over iron plate.

THEME:
LEFT WALL: the three openings are circular apertures closed by a brass IRIS DIAPHRAGM — the overlapping blades retracted open, a toothed gear ring around the rim, small cogs and a lever at one side, no glass — looking out over a sepia industrial dusk: a forest of smokestacks trailing smoke, an airship drifting past, rooftops, a hazy amber sky.
WALLS: dark mahogany panelling framed in brass, with exposed copper steam pipes and riveted iron plates.
WALL-MOUNTED DECOR ONLY: trains of interlocking gears slowly turning on the wall, a large brass orrery mounted flat, pressure gauges with only tick marks on their faces, copper pipes with valves letting off small jets of steam, a Tesla coil crackling on a bracket, a big cog clock with no numerals, a rack of brass tools, a hanging chain and pulley, a riveted vent.
IMPORTANT: no letters, numbers or words anywhere — gauges and the clock carry tick marks only.
Lighting: warm sepia dusk light from the left apertures, amber gaslight, hard brass highlights, a faint electric-blue crackle from the coil.
Palette: dark mahogany, polished brass, copper, iron black, sepia amber, small electric blue.
```

### 記入例: sushi（差し替える部分だけ。固定部は arabia の例と全文同じ）

和が3つ（japan / onsen / sushi）あるので分ける:
japan=畳の座敷・春の庭・障子／onsen=濡れた石と檜の湯屋・秋の山・湯気／
sushi=**檜の寿司屋・晴れた現代の商店街・引き戸のガラス**。
sushi だけ「現代の街」が外に見えるのが最大の差。暖簾は onsen で開口に使ったので、
sushi では**右壁の装飾**に回し、開口は引き戸のガラスにする。
品書きの木札は文字が入りやすいので、**魚の絵だけ**に限定する。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: pale hinoki cypress planks laid diagonally along the iso grid, with only a faint
LOW-CONTRAST indigo seigaiha wave motif — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no counter, no stools, no objects on the floor.
The slab's side faces show the cut edge of the hinoki planks over a dark timber base rail, a shade darker, with a narrow band of indigo seigaiha-printed cloth wrapped along the top of the edge.
WALL EDGES: the wall top faces are a pale hinoki beam faced with a band of indigo seigaiha cloth, and the wall end cuts show the pale end grain of the cypress boards.

THEME:
LEFT WALL: the three openings are wide SLIDING GLASS shopfront panels in slim dark timber frames, the middle one slid partly open, a half-lowered bamboo sudare blind hanging above each — looking out onto a sunny Japanese shopping street: low tiled buildings, utility poles and tangled wires, a parked bicycle, bright blue sky.
WALLS: pale hinoki plank cladding in a dark timber frame grid, with a band of indigo tiles along the base.
WALL-MOUNTED DECOR ONLY: indigo noren panels, rows of wooden menu tags painted with a small fish or prawn and NO writing, a red daruma on a shelf, a maneki-neko waving cat on a shelf, red paper lanterns, gyotaku fish prints, a tea dispenser on a wall shelf, fresh bamboo stalks, a shelf of ceramic tea cups, a wall-mounted knife rack.
IMPORTANT: no letters, numbers or words anywhere — the menu tags and lanterns carry pictures and patterns only.
Lighting: bright warm daylight from the left openings, clean white shop light, a warm glow from the paper lanterns.
Palette: pale hinoki cream, indigo blue, warm lantern red, black timber, fresh bamboo green.
```

### 記入例: tokyo（差し替える部分だけ。固定部は arabia の例と全文同じ）

既存の `room-tokyo.png` は雨の裏路地。**濡れた床のネオン反射**が看板。
ネオンが `scifi` / `diner` と被るので分ける: scifi=乾いた宇宙船の内装／diner=クロームと50年代／
tokyo=**雨・濡れて反射する床・赤提灯・路地**。

> ⚠️ 既存の絵はネオン看板に**崩れた日本語**が入っている。固定部の `no text` に反するうえ、
> 日本語話者には破綻が目立つ。ここでは**文字ではなく抽象的な光の帯と図形**にしている。
> どうしても看板の字面が欲しい場合だけ `LEFT WALL:` と `WALL-MOUNTED` の該当箇所を書き換える。

自販機は床置きだとマスを塞ぐので、**壁に埋め込む**形にする。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: dark wet tiles laid diagonally along the iso grid, glossy with rain, with only a faint
LOW-CONTRAST white painted arrow marking and shallow puddles, plus soft blurred neon reflections —
kept RESTRAINED so objects placed on it stay readable. Completely clear and EMPTY —
no vending machine, no crates, no objects on the floor.
The slab's side faces show the cut edge of the tiles over grimy concrete, a shade darker, with a glowing MAGENTA NEON STRIP running along the top of the edge and a few drips of water.
WALL EDGES: the wall top faces are dark metal capping with a thin cyan neon line and a tangle of cables running along them, and the wall end cuts show raw concrete faced with tile.

THEME:
LEFT WALL: the three openings are tall plain apertures in dark metal frames, streaked with rain, cables sagging across their tops, no glass — looking out onto a rainy neon city at night: tall towers, glowing sign boxes, falling rain, wet reflections, a deep violet-black sky.
WALLS: dark grimy metal panels and bare concrete, a magenta neon strip running along the base, exposed ducting.
WALL-MOUNTED DECOR ONLY: tall vertical neon sign boxes glowing in magenta and cyan — abstract bars, circles and glyph-free shapes, NOT characters — red paper lanterns hanging in a row, an air-conditioning unit, bundles of cables, a vending machine RECESSED into the right wall with its face flush, a half-lowered metal shutter, a fire-escape ladder, a hanging umbrella, a clock with no numerals.
IMPORTANT: no letters, no numbers, no Japanese characters, no words anywhere — every sign is light and shape only.
Lighting: night. Magenta and cyan neon dominate, cold rain light from the left openings, everything reflected in the wet floor.
Palette: near-black charcoal, hot magenta, electric cyan, lantern red, wet asphalt grey-violet.
```

### 記入例: undersea（差し替える部分だけ。固定部は arabia の例と全文同じ）

`retrofuture` と水中で被るので住み分ける: retrofuture=真鍮と木の潜水艦（人工物・ガラス越し）／
undersea=**珊瑚と貝の海底遺跡（有機物・水が通り抜ける）**。undersea にはガラスも金属も出さない。
開口は**帆立貝の形（上辺が扇状のひだ）**。ここまでのどの形とも重ならない。
床スラブの側面に**フジツボと磯巾着、縁から昆布**を垂らすのが縁の処理。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: pale sand-covered stone slabs laid diagonally along the iso grid, crusted with small corals,
with only a faint LOW-CONTRAST pattern of sand ripples and a few shells lying flush in the surface —
subtle, so objects placed on it stay readable. Completely clear and EMPTY — no chest, no anchor, no objects standing on the floor.
The slab's side faces show the cut edge of the stone thick with BARNACLES and small anemones, a shade darker, with a fringe of green kelp trailing down from the top of the edge.
WALL EDGES: the wall top faces carry a crest of branching coral and sea fans swaying in the current, and the wall end cuts show layered stone with old shells embedded in it.

THEME:
LEFT WALL: the three openings are SCALLOP-SHELL shaped apertures — the top edge fluted into a fan of ridges, the rim grown over with pink and orange coral, water flowing straight through them, no glass — looking out into the open sea: a sunken ship on the seabed, a school of silver fish, a kelp forest, pale shafts of sunlight coming down from the surface far above, a whale in the distance.
WALLS: ancient sunken masonry blocks smothered in coral, sponges and anemones, with kelp drifting against them.
WALL-MOUNTED DECOR ONLY: sea fans and branching coral, giant clam shells mounted open, glowing jellyfish drifting by the wall, an old encrusted anchor fixed to the wall, a fishing net with pearls caught in it, a wall niche spilling pearls and gold coins, starfish clinging to the stone, sea urchins, an encrusted ship's wheel, strings of rising bubbles, a ledge of conch shells.
Lighting: blue-green caustic light rippling in from the left openings, soft god rays from above, dim depths in the corners, gentle bioluminescent glow from the jellyfish.
Palette: deep teal, aqua, pale sand, coral pink and orange, seafoam green, pearl white.
```

### 記入例: western（差し替える部分だけ。固定部は arabia の例と全文同じ）

`cabin` と木造で被るので住み分ける: cabin=**横積みの丸太**の山小屋・森の暮らし（乾燥ハーブ・かんじき・釣竿）／
western=**縦張りの製材板＋石の基礎**の開拓地・暖炉と鹿角とバンジョー。
暖炉と鹿角は western に寄せてある（cabin では意図的に外した）。
WANTED の貼り紙は文字が必ず入るので、**星の印だけの色褪せた紙**に置き換える。
床スラブの側面に**蹄鉄と鉄の帯**を打つのが縁の処理。

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: weathered grey-brown pine boards laid diagonally along the iso grid, with only a faint
LOW-CONTRAST rope-and-star motif and some scuffed wear — subtle, so objects placed on it stay readable.
Completely clear and EMPTY — no barrels, no crates, no furniture on the floor.
The slab's side faces show the cut edge of the boards over a dry-stone footing, a shade darker, with a thin iron strap and a nailed HORSESHOE along the top of the edge.
WALL EDGES: the wall top faces are a weathered timber cornice finished with a row of split shingles, and the wall end cuts show the vertical boards standing on their stone base.

THEME:
LEFT WALL: the three openings are tall narrow holes with a shallow arched head, trimmed in weathered painted timber with a plain plank sill, one plank shutter latched back flat against the wall beside each, no glass — looking out onto a golden frontier dusk: a wide river, a paddle steamer with its wheel turning, forested banks, a dirt track, a warm amber sky.
WALLS: vertical rough-sawn board-and-batten planking above a dry-stone base course, with square nail heads and sun-bleached patches.
WALL-MOUNTED DECOR ONLY: mounted deer antlers, a stone fireplace built into the right wall with a rough timber mantel, a banjo hung by its neck, a wagon wheel hung flat, a coiled lasso on a peg, a cowboy hat, a rifle on a wall rack, a faded poster carrying only a printed star and no writing, a Navajo-pattern blanket hung flat, a punched-tin lantern, a pair of spurs, a longhorn cattle skull.
IMPORTANT: no letters, numbers or words anywhere — the poster and every sign are marks and patterns only.
Lighting: golden dusk light raking in from the left openings, warm orange firelight from the fireplace, long dusty shadows.
Palette: weathered grey-brown pine, warm tan, rust red, brass, dusty gold, small deep-green accents.
```

### 記入例: factory（デフォルト部屋・**ガラスを抜く必要がある唯一の部屋**）

デフォルトの工場部屋 `assets/rooms/room-factory.png`（テクスチャキー `bg_room`）だけは特別扱い。
**ガラスが透過している**ので、その後ろに置いた空・太陽・月・星が窓越しに見え、時間帯で変化する
（`lighting.mjs` の `skyLayer` / `sun` / `moon` / `stars`。テーマ部屋ではこの演出を切っている）。
現行ファイルは 23,777px が alpha<128 で抜かれている。テーマ部屋（arabia / space）は 0px。

生成物は不透明なので、**ガラスを純マゼンタ #FF00FF のベタ塗りで出させて、後からクロマキーで抜く**。
props / hats と同じ手（`tools/assets/key_hat.py` などのマゼンタ抜きと同じ考え方）。

固定部は arabia の例と同じだが、**開口の形の段落だけ差し替える**（工場では「金属枠のガラス窓」が
まさに正解なので、`do NOT default to rectangular glass panes...` の段落を下記に置き換える）。

```
THE SHAPE: this theme really is glazed industrial windows, so here rectangular steel-framed
windows ARE correct. Each of the three openings is a tall factory window with a slim dark
steel frame, divided by thin mullions into a grid of rectangular panes.

THE GLASS MUST BE FLAT PURE MAGENTA #FF00FF: fill every pane with solid #FF00FF and nothing
else — no sky, no clouds, no reflections, no highlights, no gradient, no tint, no glazing bars
drawn over the magenta except the real mullions. The magenta is a chroma-key that gets cut out
later so the game can show its own animated sky behind the glass. Do NOT use magenta anywhere
else in the image.
```

差し替える5ブロック:

```
CHANGE ONLY the surface materials and the decoration:
FLOOR: worn dark brown industrial floor tiles laid diagonally along the iso grid, with only a faint flat
grid of steel plate seams and a few pale scuff marks. Completely clear and EMPTY — no furniture, no objects on the floor.
The slab's side faces show the cut edge of the tiles over a dark concrete base, a shade darker, with a thin steel trim strip along the top of the edge.
WALL EDGES: the wall top faces and the wall end cuts show bare riveted brown steel plate, a shade lighter, with a darker seam line along every exposed edge.

THEME:
LEFT WALL: the three openings are tall steel-framed factory windows, slim dark frames divided by thin mullions into a grid of rectangular panes, every pane filled with flat pure magenta #FF00FF.
WALLS: riveted brown steel wall panels with visible plate seams and bolt rows, patches of exposed dark brickwork, stencilled numbers.
WALL-MOUNTED DECOR ONLY: fat copper pipe runs with elbows, valves and pressure gauges, a grey fuse box with a lever, a caged work lamp on a bracket, a tool rack with wrenches, a round factory clock, a yellow-and-black hazard sign, a metal vent grille, a small bolted shelf with oil cans.
Lighting: cool daylight coming in from the left windows, warm tungsten pool from the work lamp, long soft shadows.
Palette: rust brown, copper, gunmetal grey, warm ochre, dark chocolate.
```

`{{FLOOR_MATERIAL}}` / `{{FLOOR_MOTIF}}` / `{{THEME_BLOCK}}` の埋め方は「1.」節と共通:

- `{{FLOOR_MATERIAL}}` と `{{FLOOR_MOTIF}}` … 「成功済みテーマの差し替え値」表の
  **FLOOR_MATERIAL / MOTIF 列**（`/` の左が MATERIAL、右が MOTIF）
- `{{THEME_BLOCK}}` … 同じ表の「窓の外」「壁・装飾の要点」列をもとに、
  `LEFT WALL:` / `WALLS:` / `WALL-MOUNTED DECOR ONLY:` / `Lighting:` / `Palette:` の**5行**で書く
  （書式の詳細は「THEME_BLOCK の書式」小節）。**装飾はすべて壁掛け**にし、床には置かない

表に無い新テーマを作るときも同じ5行の型で書き、うまくいったら表に1行足しておく。

### 記入例: arabia（1部屋目・そのまま貼れる完成形）

参照画像に `docs/shells/room-shell-1376x768.png` を添えて、これをそのまま投げる。

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

THE MARGIN IS ONE PERFECTLY FLAT COLOUR: exactly #0C1014, the same single value in every
pixel outside the room, right up to the room's outline. Absolutely no gradient, no
vignette, no darkening toward the corners, no glow, no bloom, no light bleed or haze
from the lamps, no stars, no dust, no dithering, no noise, no texture, no drop shadow
under the room. Fill it as one solid block of #0C1014, like a flat background layer.
The room's silhouette is a hard, clean, aliased edge against that flat colour.

The floor diamond is left-right symmetric: its left and right vertices are at the
SAME height, its back and front vertices are on the SAME vertical center line.
Floor = exactly 12 x 12 isometric tiles, true 2:1 isometric.
Floor spans 65% of image width and 59% of image height.

THE FLOOR DIAMOND IS THE TOP SURFACE — the surface things stand on. The floor is a
SLAB about 25px thick, exactly as in the reference image: its top face keeps the diamond
exactly, and the slab's side faces are drawn BELOW the two front edges, never inside the
diamond. Do not shrink or inset the top surface to make room for the thickness.
The two walls are slabs too, about 10px thick: they show a thin top face along their top
edge, and their outer ends — at the left and right corners of the room — show the cut
thickness of the wall. Every corner where these faces meet is closed and mitered:
no gaps, no floating edges, nothing ending in mid-air.
The wall thickness sits OUTSIDE the room, so it never eats into the 12 x 12 floor.
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
The slab's side faces show the cut edge of the same cream marble, a shade darker, with a thin gold trim line along the top of the edge.
WALL EDGES: the wall top faces and the wall end cuts show the same purple plaster as the walls, a shade lighter, with a slim gold beading along every exposed edge.

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

## 1-C. 製造機も同じ方式（型 → 1台目 → 以降は1台目を参照）

製造機スプライトにも同じ「殻を塗り替える」方式を移してある。詳細は
`docs/machine-sprite-prompt.md` の「0. 1マスモジュールの型（ゴールデン方式・現行）」。
発注するのは**1マス分のモジュール1枚だけ**で、`tools/assets/cut_machines.py` が
それを並べて 2〜5マス機を作る。

## 1-D. 装飾品も同じ方式（シアンの枠で仕切った7種シート1枚）

装飾品スプライトも「殻を塗り替える」方式。詳細は `docs/prop-sprite-prompt.md`、
発注文そのものは `docs/prop-prompts/`（31テーマぶん生成済み）。

部屋・製造機と違うのは2点。**セルをシアンの枠で仕切る**ことと、**殻の形はプレースホルダ**
であること。枠は焼き込みが「どこがどのセルか」を機械的に知るための目印で、生成物は殻と同じ
寸法では返らないため、殻の座標から推測すると別の物を切り出す（実際に失敗した）。
形は自由でよく、**足元の大きさ（接地菱形）だけが絶対**。ここが広がると盤面のマスに収まらない。

全テーマ共通で作るのは chair / shelf / lamp / plant（1×1）と table / sofa / rug（1×2）の7種で、
1テーマ1枚。名物・一点物は物ごとに特徴も大きさも違うので、カスタムの殻で1体ずつ発注する。

| | 部屋背景 | 製造機 | 装飾品 |
|---|---|---|---|
| 型を作る | `tools/preview/guide.html` | `tools/assets/make_machine_shell.py` | `tools/preview/props.html` の「🧱 殻」 |
| Stitch に渡す殻 | `docs/shells/room-shell-1376x768.png` | `docs/shells/mach-shell-1024.png` | `docs/shells/prop-shell-sheet7-1519x1127.png` ほか |
| 発注文 | 同ファイル内 | `docs/machine-sprite-prompt.md` | `docs/prop-prompts/<theme>-sheet.txt` |
| 検収 | `tools/preview/guide.html` に重ねる | `tools/assets/check_machine_module.py` | `tools/preview/props.html` ＋ 焼き込みの `_contact-*.png` |
| 焼き込み | なし（そのまま使う） | `tools/assets/cut_machines.py` | `tools/assets/cut_prop_sheet.mjs` |
| 発注回数 | 1テーマ1枚 | 1テーマ1枚 | 1テーマ1枚（共通7種）＋ 名物を随時 |
| 背景 | 暗い void | マゼンタ #FF00FF | マゼンタ #FF00FF ＋ 目印のシアン #00E5FF |

> 部屋の絵をテーマの参照として2枚目に添えるのは**やらない**。カメラが崩れ、枠が塗りつぶしに
> 化けて大きさが 20% ぶれた（実測）。経緯と再挑戦用の文面は `docs/prop-sprite-prompt.md`。

型の絵だけでは幾何が崩れるテーマがある（実測で 30枚中3枚）。その場合は殻ではなく
**合格済みモジュールを土台にして再スキン**すると通る。部屋の「2部屋目以降はゴールデン
ルームを参照画像にする」と同じ話で、テキストより桁違いに効く。

---

## 2. オブジェクト(小物)テンプレート（prop_<key>_*.png）★旧方式

> **現行は `docs/prop-sprite-prompt.md`（上の 1-D）。** この節はシート方式の記録として残す。
> シートで発注すると1枚の中での相対サイズしか揃わず、**マスに対する大きさと接地位置が決まらない**。
> 既存290体がこの方式で、生成後に「高さだけ揃える」後処理をかけた結果、
> 焼いた画像の高さは 42/60/84px の3種・幅は 14〜116px と成り行きになり、
> 盤面での大きさが 0.2〜1.5倍にばらついた。

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

---

## 5. アイテムアイコン テンプレート（mat-<id>.png / prod-<id>.png / genre-<id>.png）

原材料32・製品113・ジャンル3 の**148枚**。もとは craft.mjs の絵文字（🥛🌾🥣…）で、
盤面と部屋がドット絵なのにアイコンだけフォント任せだったのを置き換えた（経緯は
`docs/task-mat-prod-icons.md`、前例は `tools/assets/make_menu_icons.mjs` の冒頭）。

### 規格

**グリッドの1辺 = 実際に出る px** に合わせる。半端な倍率でも 1/2 でも濁るので、
大きさを変えたいときは表示倍率ではなくグリッドごと描き直す（make_menu_icons.mjs 冒頭と同じ）。

| 種別 | グリッド | 根拠（factory-phaser.html の実測） |
|---|---|---|
| 原材料 `mat-<id>` | **16×16** | レシピ左 `.rms` 15px / 材料チップ `.mchip` 14px / 製造機のマス `.mslot .e` 19〜24px |
| 製品 `prod-<id>` | **32×32** | 図鑑カード `.pcard .e` 28px / レシピ右 `.rp .e` 22px |
| ジャンル `genre-<id>` | **16×16** | 見出しの文字（10〜12px）に混ぜる |

- 製品を 16×16 で作って 2倍に伸ばしてはいけない（情報量が足りない）。逆に 32×32 を
  16px で出すのも禁止（1ドット飛びに間引かれて濁る）。CSS のクラスを分けてある
  （原材料・ジャンル = `.uic` 16px / `.uic.lg` 32px、製品 = `.pic` 32px）。
- 切り出しは `--size=16` / `--size=32` で指定する。
- **正面向き**。部屋背景はアイソメだが、16px ではアイソメだと何も読めない。
- 画風の固定句は背景と同じ（`lo-fi 8-bit Famicom pixel art, chunky pixels, thick clean
  black outlines, flat colours, high contrast` ＋ `simple 2-tone shading`）。
- ジャンルで色相を寄せる: 食品=暖色 / 機械=金属＋アクセント1色 / 生活品=自然色。

### プロンプト（`{{GENRE}}` と 4個ぶんの品名を差し替える。それ以外は固定）

```
Sprite sheet of exactly 4 separate {{GENRE}} game item icons, FRONT VIEW (flat, straight-on,
no isometric angle, no perspective), lo-fi 8-bit Famicom pixel art, VERY chunky pixels,
thick clean black outlines, flat colours, high contrast, simple 2-tone shading.

The 4 items, left to right:
(1) {{NAME}} — {{形・色の列挙}}
(2) ... (3) ... (4) ...

STRICTLY NO PINK and NO MAGENTA anywhere in the artwork.
Arrange them in ONE single horizontal row, evenly spaced, wide clear gaps between them,
all the same size, each roughly filling its own square cell, centred on the same horizontal line.
Each item must stay readable when shrunk to a tiny 16x16 icon: ONE simple bold silhouette
per item, big shapes only, NO thin lines, NO tiny details, NO gradients.
Background: solid pure MAGENTA (#FF00FF) flat fill everywhere around and between the items.
ABSOLUTELY NO TEXT ANYWHERE: no captions, no names, no labels, no numbers. NO shadows,
NO ground plane, NO UI, NO frame, NO border, NO characters.
```

品名は **大文字の品名 + em dash + 形・色の列挙**（被り物テンプレと同じ書き方）。
「(1) 品名」の並びは、あとで生成物を探す鍵にもなる（下記）。

### つまずいた所（次に作る人へ）

- **絵にピンク／マゼンタを使わせない。** 抜きと区別が付かない。ピンクの糸を頼んだら
  糸だけそっくり消えた。いちご・クリーム・ドレス等は「DEEP RED」「WHITE」と指定する。
- **背景は #FF00FF にならない。** 実測 (254,15,253) 前後にばらつくうえ、シートによっては
  (198,54,141) のくすんだローズになる。`cut_icon_sheet.py` は**外周1ドットの最頻色**を
  そのシートの背景として学習する。決め打ちの比率判定だけだと列が丸ごと残る。
- **NO TEXT と書いてもラベル文字を描くことがある。** 本体と縦に重なる塊だけ残して落とす。
- **「横1列」と書いても積むことがある。** 3個＋下に1個 になった列があった。横方向の谷が
  n個に割れないときは、塊を近い順に併合して n 組にし、左→右・同列は上→下 の順で拾う。
- **MCP がタイムアウトしても生成は成功している。** 投げっぱなしにして、あとで
  `list_screens` の `title` を `(1) 品名` で grep して `screenshot.downloadUrl` を拾う方が速い
  （`=s0` を付けて原寸取得）。並列は6本まで。

### 切り出し（tools/assets/cut_icon_sheet.py）

```
python3 tools/assets/cut_icon_sheet.py           <sheet.png> assets/ui/icons mat-  milk flour egg butter
python3 tools/assets/cut_icon_sheet.py --size=32 <sheet.png> assets/ui/icons prod- tkg pretzel shake pancake
```

マゼンタ抜き → 列ごとに切り出し → bbox クロップ → 長辺を --size へ LANCZOS 縮小（α premultiply）。
NEAREST は使わない（生成物のドットは格子に乗っておらず、1ドットが 15.5px だったりして輪郭が欠ける）。

### 検収（tools/preview/icons.html）

1x/2x/4x と「実際の枠に混ぜた行」を並べる（製品の節は 1x が 32px）。**合否は 1x だけ**。`?g=food` `?ids=milk,egg` で絞れる。

# 製造機スプライトの Stitch 依頼テンプレ

`<THEME>` `<THEME_DESIGN>` `<SPOT_DESIGN>` `<PALETTE>` を差し替えて `generate_screen_from_text` に投げる。

**必ず1テーマ1枚**（`assets/mach-sheets/<theme>.png`）。2枚に分けると生成が別々になり、
**同じテーマなのに2枚でデザインが変わってしまう**。1枚に4台入れたうえで、
送りを「画像幅に対する比」で指定して圧縮を防ぐ。

切り出しは `python3 tools/cut_machines.py`。投入口を検出できるテーマでは
**2マス機の絵1枚だけを正**として、そこから1ベイ（1マスぶんの縦帯）を取り出して繰り返し、
3/4/5マス機を合成する。だから **いちばん大事なのは2マス機の出来** で、3/4/5マス機は
「送りがバラついていても構わない」（絵としては使わず、ログに実測値を出すだけ）。
それでも4台とも描いてもらうのは、1枚に4台あるほうがデザインが揃いやすいから。

## 向きについて（いちばん間違えられる所）

ゲームのアイソメ格子は、1マス進むと画面上で次だけ動く:

| 方向 | 画面での移動 | 見え方 |
|---|---|---|
| `+u` | (+27.6, +14.3) px | **右斜め下** |
| `-u` | (−27.6, −14.3) px | **左斜め上** |
| `+v` | (−28.0, +13.7) px | 左斜め下 |
| `-v` | (+28.0, −13.7) px | 右斜め上 |

**素材は `+u`（右斜め下）方向の1種類だけ作らせる。** もう一方の対角（右斜め上↔左斜め下）は
ゲーム側が左右反転して使うので生成不要（`game/main.js` の `if(e.dir==='v') img.setFlipX(true)`）。

この前提が破れると、**影・占有マス・素材アイコンは正しい向きに並ぶのに本体の絵だけが
直交した向きに見える**。目で見て気づきにくいので、`node tools/mach_axis.mjs` で機械的に
検査する（`tools/test_machines.mjs` から自動で呼ばれる）。逆向きだったら `--fix` で揃える。

## これまでの失敗と対処

1. 「long axis running from upper-left down-to-the-right」と書くと**マスが横一列**に並ぶ。
   → 1マスあたりのピクセル送りを数字で書いて解決。
2. 送りを数字で書くと斜めには並ぶが、今度は**正面を向いた箱を斜めに数珠つなぎ**にしてくる
   （各要素に正面パネルがある＝アイソメになっていない）。
   → 「水平線を1本も描くな」「見える面は2つだけ」「天面は菱形」で解決。
3. 長い台を枠に収めようと**1マスを圧縮**してくる（置き場の間隔が 54→49→43→34px と詰まった）。
   → 送りを「画像幅の1/12」と**比で**指定し、first→last の距離もサイズ別に明記する。
   - 切り出し側で縦横別々に引き伸ばして直すのは **NG**（サイズごとに歪んでデザインが変わる）
   - 2枚に分けて生成するのも **NG**（2枚でデザインが別物になる）。必ず1枚に4台。
4. 向きを直すために上物を削ると**地味になる**。向きの規則は守らせたまま、
   上物は「アーケード筐体並みの密度で」と明示して盛ること。装飾にも同じアイソメ規則を課し、
   置き場を隠さない・横にはみ出さない、とだけ縛る。
5. **題材を bench / counter / workbench / altar / bath と書くと正面図になる。** 家具なので
   モデルは家具のカタログ的な正面ビューを描く。しかも「天板の丸い窪み」と合わさって**流し台**に見える。
   → 題材を **INDUSTRIAL PROCESSING MACHINE** と言い切り、機械の部品（モーター、歯車、
     ベルト、ピストン、圧力計、排気筒、**製品が出てくるシュート**）を必ず持たせる。
     テーマは素材と装飾だけを決め、家具に戻さない。
6. **`runes` / `hieroglyphs` / `glyphs` と書くと文字が描き込まれる。** 冒頭の「no text」だけでは
   足りない（模様のつもりの語が文字を呼ぶ）。文字禁止を独立した段落にして、ルーン・象形文字・
   紋章・銘まで名指しで禁止し、代わりに使う語（notches / studs / bolt heads / grooves）を示す。
7. 向きは規則を並べても従わない。**既知のアイソメ作品を参照**させ（Habbo Hotel / SimCity 2000）、
   失敗形を名指しで禁止する（「天面が細い水平の帯になって前面が大きな長方形になったら、
   それは正面図であって間違い」「天面は側面と同じくらい目立つ大きな菱形であること」）。
8. **em dash（—）などの記号を多用すると API が `Request contains an invalid argument.` を返す。**
   本文の `—` はすべて `,` か `:` に置き換えて送る（上のテンプレは置換済みの形で書いてある）。

## 受け取ったシートの合否

取り込む前に必ず見る。詳しくは `python3 tools/cut_machines.py` のログと、検出点を重ねた画像。

- **不採用**（作り直しを依頼する）
  - プロンプト文やラベルが画像に焼き込まれている（回転寿司で発生）
  - 投入口の数が 2/3/4/5 になっていない（温泉で 1/1/2/3 になった）
  - シートに黒い枠線が描き込まれている（温泉）
- **採用できるが手当てが要る**
  - 1台だけアイソメ角が違う → `pick_source` が角度の多数派の台を合成元に選ぶので通る
  - 投入口の検出が影に引っ張られる → `SPOT_TEST` を締める／`SPOT_TOP` で上側に限定する
    （西部は `max(rgb)<70` で影を拾い、`<45` で直った）

---

## 意匠のルール（2026-08-03 決定）

**側面・端面には物を付けない。装飾は天板に置く。**

| 面 | 許可 | 禁止 |
|---|---|---|
| 側面・端面 | 浅い凹凸だけ。ステップごとのパネル継ぎ目、鋲の列、少し窪んだパネル、**面一に嵌まった**点検窓（発光可） | 突き出す物すべて。圧力計・配管・ベルト・弁ハンドル・ホース・木箱・バンパー・排出シュート |
| 天板 | 物を置いてよい。排気筒・計器盤・巻いたホース・小さな木箱・寝かせた弁ハンドルなど。**天板の奥半分**に置き、投入口を塞がない。上には伸ばしてよい | 台の両端より横へ張り出すこと |
| 底面 | **一直線**。脚・足・シュート・スカートなど、底より下に垂れる物は一切なし | 垂れ下がり全般 |

底面を一直線に縛るのは見た目だけの話ではない。**絵の最下端が接地線と一致していないと、
ゲーム側が機械を持ち上げて置いてしまう**（垂れ下がったシュートを床に合わせるため）。
`tools/cut_machines.py` は接地線を推定して `mach-fit.json` の `gy` に書き、`game/main.js`
はそれを足元の四角形の手前の辺に合わせるが、そもそも垂れ下がりが無ければ推定が不要になる。

プロンプトには次の3項を独立した見出しで入れる（本文中に混ぜると効かない）。

```
1. NOTHING IS ATTACHED TO THE SIDE FACES OR THE END FACES. The two visible faces carry only
   SHALLOW RELIEF: panel seams at each step boundary, rows of small rivets, a slightly recessed
   panel, and a row of small inspection windows set FLUSH into the face. Nothing sticks out from
   a face, and nothing hangs below the machine.
2. THE BOTTOM EDGE OF THE MACHINE IS ONE CLEAN STRAIGHT LINE. No legs, no feet, no chute, no
   skirt, no protrusion of any kind dips below the base. The base is a plain straight
   parallelogram sitting flat on the ground.
3. OBJECTS ON THE TOP PLATE ARE ALLOWED. Put the machinery up there instead. They sit on the
   BACK half of the top plate, behind the intakes, never covering an intake. They may rise
   upward, but must not extend sideways past the ends of the base.
```

---

## いちばん確実な作り方: **うまくいったシートを種にして、テーマだけ差し替える**

テキストだけで一から作らせると、**同じプロンプトでも出来が大きくブレる**（投入口の数が
1/1/1/1 になる、L字に膨らむ、屋根が付いて立方体になる、装飾が消えて地味になる）。
何度書き直しても直らないので、**構造は既存の合格シートから引き継がせる**。

- 種にするシート: **ドワーフ鉱山 `d7c4677cdf2546eeb15b7ae734ffb63d`**
  （投入口2/3/4/5・1マス奥行き・低い側面・正しいアイソメ角がそろっている）
- 使うツール: `generate_variants`
  - `selectedScreenIds: ['d7c4677cdf2546eeb15b7ae734ffb63d']`
  - `variantOptions: {variantCount: 1, creativeRange: 'REFINE', aspects: ['COLOR_SCHEME','IMAGES']}`
    → `LAYOUT` を変更対象に入れないのが肝。レイアウトを触らせない。
- プロンプトの型:

```
Re-skin this exact sprite sheet to a "<THEME>" theme.

KEEP EVERYTHING STRUCTURAL IDENTICAL to the reference. Do not redesign the layout:
- Same 2x2 arrangement of four machines on the same flat pure magenta (#FF00FF) background.
- Same four lengths and the SAME NUMBER OF INTAKES on each machine as the reference.
- Same intake positions and the same spacing between intake centers.
- Same true 2:1 isometric angle, same long axis running from upper-left back end down to lower-right front end.
- Same low profile: the visible long side face stays exactly as short as in the reference. Do not make it taller.
- Same one-tile-deep straight strip footprint. No side wings, no L shapes.
- Same one row of arched glowing windows on the side face, one under each intake.
- Same mechanical parts in the same places: gauge cluster, motor with drive belt, valve wheels, exhaust at the back end, output chute at the lower-front corner.

ONLY CHANGE THE MATERIALS AND DECORATION:
- Body: <素材と色>, instead of granite and iron.
- Intake collars: <素材> instead of hammered iron.
- Side windows: glowing <色> behind <素材> frames.
- Back-edge decoration, replacing the forge and gems, at the same size and the same place: <小物を6つほど>
- Palette: <6色>

Keep the same VERY chunky lo-fi 8-bit Famicom pixel art style, extreme high contrast, thick clean black outlines, flat colors, no gradients. NO text, no letters, no numbers anywhere.
```

一から作らせるのは、種にできるシートがまだ無いテーマ系統だけにする。

---

## 一から作る場合のテンプレ（短い方）

長文版（下）と同じ縛りを箇条書きに畳んだもの。**2600字ほどで、長文版より通りが良い**
（海賊船・スチパン・ドワーフ鉱山・幽霊屋敷などはこれで一発）。`<>` を差し替える。

```
High-precision pixel art SPRITE SHEET for a game on a FLAT SOLID PURE MAGENTA (#FF00FF) background. ABSOLUTELY NO floor, NO walls, NO cast shadows, NO text, NO labels, NO UI, NO borders, NO grid lines. NO letters, no numbers, no runes, no sigils.

CONTENT: Exactly 4 separate industrial "<THEME>" manufacturing machines arranged in a 2x2 grid with wide magenta gaps.
- Top-Left: 2 units long.
- Top-Right: 3 units long.
- Bottom-Left: 4 units long.
- Bottom-Right: 5 units long.

FOOTPRINT & PROPORTIONS (CRITICAL):
1. NARROW SLAB: Each machine is exactly ONE TILE DEEP. The top plate is a narrow strip.
2. DEPTH RULER: The rim of one intake collar almost spans the entire depth of the top plate.
3. LOW PROFILE: The housing is very low, only half a tile tall. The visible long side face is a short horizontal band.
4. NO CUBES: Even the 2-unit machine is a long rectangle (2x1), never a square or cube.
5. SHARED TILE PITCH: The distance between intake centers (one step) is IDENTICAL in all 4 machines. Shorter machines leave large magenta gaps.
6. TOTAL HEIGHT: GROUND line to the very top of the tallest part is exactly TWO AND A HALF STEPS. Body is 2/3 of height, decoration is 1/3.

ORIENTATION: True 2:1 isometric projection. Long axis runs from BACK END (Upper-Left) down to FRONT END (Lower-Right).
- Visible LONG SIDE face points toward viewer's Lower-Left.
- Visible SHORT END face points toward viewer's Lower-Right.
- Every edge is vertical or at a 2:1 slope. NO horizontal lines.

SUBJECT: Industrial <THEME> Machines.
- BODY: <筐体の素材と色>
- INTAKES: Centered on each tile unit is ONE <素材>collar set flush into the <素材> top plate. Intakes are foreshortened ELLIPSES (2:1). Dark and empty inside.
- SIDE: Short arched windows glowing <色>, framed by <素材> mullions.
- MECHANICAL DETAILS: A cluster of pressure gauges, a motor housing with a drive belt, small valve wheels, a stubby exhaust pipe at the back end, and an output chute at the lower-front corner.
- DECORATION (BACK EDGE): <テーマの小物を6つほど>

STYLE: VERY chunky lo-fi 8-bit Famicom pixel art, extreme high contrast, thick clean black outlines, flat vibrant colors. No gradients, no anti-aliasing. Palette: <6色>. Consistency is absolute.
```

`generate_screen_from_text` は**ほぼ必ずタイムアウトする**が、裏で生成は走っている。
反映は速いときで数分、遅いときは**数時間**かかる（実測あり）。投げる前に `list_screens` の
IDを控えておき、あとで差分を取る。生成中は `screenInstances` にUUID形式のプレースホルダが立つ。

---

## 長文版（参考。上の短い版で足りないときだけ）

```
Pixel art sprite sheet on a FLAT SOLID PURE MAGENTA (#FF00FF) background.
No floor, no walls, no cast shadows, no borders, no grid lines.
The magenta must be the ONLY background colour.

ABSOLUTELY NO WRITING OF ANY KIND ANYWHERE IN THE IMAGE.
No text, no labels, no letters, no numbers, no words, no runes, no glyphs, no hieroglyphs,
no sigils, no inscriptions, no engraved characters, no signage — not in any real language and
not in any invented or decorative one. If a surface needs detail, use notches, studs, bolt
heads, grooves, rivets, chevrons or plain geometric shapes, never anything that reads as a
character. This applies to every part: hopper collars, side panels, plaques and end caps.

=== WHAT THIS IS ===
FOUR INDUSTRIAL PROCESSING MACHINES for a factory game, themed as <THEME>.
These are MACHINES that manufacture things. They are NOT benches, NOT counters, NOT tables,
NOT altars, NOT baths, NOT furniture. A player must look at one and think "that thing makes
something". Every one of them therefore has visible machinery: a motor housing, gears and a
drive belt, pistons, a pressure gauge cluster, valve wheels, riveted plating, an exhaust stack
venting at the back, and an OUTPUT CHUTE at the front-lower end where the finished product
drops out. The theme only decides the MATERIALS and DECORATION of that machine — it never
turns it back into furniture.

=== HOW IT IS DRAWN — READ THIS BEFORE ANYTHING ELSE ===
Draw it exactly like an isometric game object from Habbo Hotel or SimCity 2000: a single solid
object sitting on an isometric tile grid, seen from a corner, in true 2:1 isometric projection.

The base of the machine is a PARALLELOGRAM lying on that grid — think of a domino tile lying
flat on an isometric chessboard, N squares long and 1 square deep.
- The lowest point of the whole silhouette is a SINGLE CORNER at the bottom.
- From that bottom corner, one base edge climbs UP-AND-LEFT at a 2:1 slope, and the other
  climbs UP-AND-RIGHT at a 2:1 slope.
- Consequently there are NO HORIZONTAL LINES anywhere in the structure. Every structural edge
  is either vertical, or sloping at 2:1 down-right, or sloping at 2:1 down-left.
- Exactly TWO faces of the body are visible: the LONG SIDE (facing down-and-LEFT) and the
  SHORT END (facing down-and-RIGHT). No face is parallel to the image plane.

FAILURE MODE TO AVOID — this is the mistake that keeps happening:
If the top face comes out as a THIN HORIZONTAL BAND and the machine's long front is a big flat
rectangle facing the viewer, you have drawn a FRONT ELEVATION, not an isometric object. That is
wrong. The top face must be a large, obvious RHOMBUS — wide open to the viewer, clearly a
parallelogram, roughly as visually prominent as the side face.

The long axis runs from the BACK END at the UPPER-LEFT down to the FRONT END at the LOWER-RIGHT.
Only this one orientation; do not draw a mirrored version.

=== FOOTPRINT & PROPORTIONS (CRITICAL) ===
1. NARROW SLAB: each machine is several tiles long but exactly ONE TILE DEEP.
   The top plate is a narrow strip.
2. DEPTH RULER: the rim of one funnel almost spans the entire depth of the top
   plate, leaving only a tiny margin of plate on either side.
3. LOW PROFILE: the housing is very low — only half a tile tall. The long side
   face is a short band, not a tall wall.
4. HEIGHT RATIO: from feet to funnel rim, the funnels are 1/4 of the total
   height and the housing is 3/4.
5. NO CUBES: even the shortest 2-unit machine is a long rectangle (twice as long
   as it is deep), never a square or a cube.

=== THE FOUR MACHINES — ONE SHARED TILE PITCH ===
The four machines sit in a 2x2 grid with wide magenta gaps.
The distance between the centres of two neighbouring hoppers is called
ONE STEP. One step is exactly the same length in all four machines. This
is the single most important measurement on the sheet: never stretch or
squeeze it to make a machine fit its area.
Set one step to about one eighth of the sheet width, and keep it constant.

Measured from the first hopper to the last hopper:
  upper left  — 2 hoppers, so 1 step from first to last
  upper right — 3 hoppers, so 2 steps from first to last
  lower left  — 4 hoppers, so 3 steps from first to last
  lower right — 5 hoppers, so 4 steps from first to last

The number of arched furnace windows on the long side face equals the
number of hoppers, each window directly below its own hopper.

Because one step never changes, the machines get steadily longer: the
longest is four times the first-to-last span of the shortest. The lower
right machine must be one full step longer than the lower left machine.
If those two look the same length, the sheet is wrong.
Everything else is identical: body height, hopper size, funnel shape,
end pieces, decoration. Length is the only difference.

=== HOW TALL AND HOW DEEP — KEEP IT LOW ===
Everything is measured in STEPs, so the machine always matches the game's tiles.

- DEPTH: the body is exactly ONE STEP deep. It is one tile deep, no more.
  Do not draw a fat, chunky block that spills over its tile.
- TOTAL HEIGHT: from the ground line to the very top of the tallest part is
  TWO AND A HALF STEPS. That is all. It is a low, wide machine, not a tower.
- THE HOPPERS ARE THE TOP THIRD: the funnels occupy only the top third of that
  total height. The solid body occupies the lower two thirds.
- Nothing on the machine — no chimney, no cauldron, no lamp — may go higher than
  the top of the hoppers.

To picture it: the 5-tile machine is five steps long but only two and a half steps
tall. It is clearly a long low machine, about twice as wide as it is tall.
If it looks like a tall cabinet or a tower, it is wrong.

=== FILL NOTHING ===
Do not scale any machine up or down to fill its area. Do not compress a
long machine to fit. The short machines are simply small and leave large
areas of bare magenta around them, which is correct and intended.

=== THE INGREDIENT INTAKE ===
Each tile has ONE intake where a raw material is loaded, centred on its tile, all identical,
evenly spaced along the diagonal, and left COMPLETELY EMPTY. Because the top face is a rhombus,
each intake is an ELLIPSE (a circle foreshortened 2:1), never a full circle. They form a
DESCENDING DIAGONAL LINE and must never be covered by decoration.
Design each intake as: <SPOT_DESIGN>

=== DECORATION ===
Load the machine with a rich themed superstructure so it reads as a showpiece, at the density of
an elaborate arcade cabinet: <THEME_DESIGN>
Every added object is ALSO drawn in the same 2:1 isometric projection. Decoration sits on the
BACK half of the top face, along the back edge, or hangs from posts; it must never cover an
intake. It may rise UPWARD freely, but nothing may stick out sideways past the ends of the base.

=== STYLE ===
Chunky lo-fi 8-bit Famicom pixel art, extreme high contrast, thick clean black outlines,
flat colors, no gradients, no anti-aliasing. Palette: <PALETTE>.
```

## `<SPOT_DESIGN>` の書き方の注意

**文字を呼ぶ語を使わないこと。** `runes` / `hieroglyphs` / `glyphs` / `sigils` /
`engraved symbols` / `inscription` と書くと、**そのまま文字を描かれる**。実際にハロウィンで
「notched with poison-green glowing runes on the lip」と書いた結果、漏斗の帯に緑の文字が
入った（ユーザー指摘）。ディテールが欲しいときは `notches` / `studs` / `bolt heads` /
`grooves` / `rivets` / `chevrons` など**文字に見えない語**を使う。

**水回りに見える語を使わないこと。** `well` / `basin` / `sunk into` / `stainless` /
`polished steel ring` は、テーマが水でなくても**流し台**を描かせる。実際にダイナーで
「chrome-rimmed griddle well sunk into the stainless counter」と書いた結果、
鉄板ではなくシンクのような絵になった。

- 水のテーマ（露天風呂など）→ そのままの語でよい
- それ以外 → **その素材の言葉で言う**。`set flush into the <素材> top` を使い、
  `plate` / `dish` / `hotplate` / `trivet` / `pad` など**平らな置き台**の語を選ぶ

## 差し替え例

| テーマ | `<SPOT_DESIGN>` | `<THEME_DESIGN>` |
|---|---|---|
| 露天風呂 | 黒石のリングに乳白色の湯、湯気（楕円） | 竹の掛け流し樋、石灯籠、藍の暖簾を吊る竹の桁、湯桶の積み重ね、紅葉の枝、簾、木札 |
| ダイナー | 天板に面一で嵌まった鋳鉄のホットプレート（楕円）、クロムの縁と赤いランプ ※`well`/`sunk`は使わない | ネオンアーチ、ミルクシェイクミキサー、ケチャップとマスタード、ナプキン入れ、ガラスのケーキドーム、メニュー板 |
| ピラミッド | 石灰岩の天板に面一の金の献納皿（楕円）、縁に彫り込みの刻み ※`hieroglyphs`は使わない | オベリスク、カノプス壺、スカラベ、アンク、青蓮、松明、パピルスの巻物 |
| ハロウィン | 鋳鉄の短いホッパー襟（楕円）、縁の刻みが緑に光る ※`runes`は使わない | 提灯かぼちゃ、蝋燭、蜘蛛の巣、蝙蝠、緑の薬瓶、歪んだランタン、大鍋 |
| 西部開拓 | オーク天板に面一の黒鉄プレート（楕円）、真鍮の縁と鋲 | 樽、蹄鉄、スポーク車輪、鉄の帯、火の入った炉扉、排出シュート |
| 和風温泉 | 黒い川石のリング（楕円）に乳白色の湯、立ちのぼる湯気 ※水テーマなので水の語でよい | 竹の掛け流し樋、石灯籠、藍の暖簾、湯桶の積み重ね、紅葉の枝、簾 |
| 回転寿司 | 檜天板に面一の黒漆の皿（楕円）、金の細い縁と刻み ※`well`/`sunk`は使わない | 赤提灯の列、ネタケース、醤油差し、竹の焼き台、米の木箱、藍の半暖簾 |
| 日本 | 杉天板に面一の黒鉄プレート（楕円）、鋲の輪と朱漆の帯 | 朱の鳥居、瓦の庇、白提灯、注連縄と紙垂、松の盆栽、梵鐘 |
| 海賊船 | オークのデッキ天板に面一の真鍮ポートホール輪（楕円）、太い鋲 | 巻いた麻縄とキャプスタン、舵輪、火薬樽、吊りランタン、索具、宝箱、畳んだ帆 |
| スチパン | 鉄天板に面一のリベット付き真鍮襟（楕円）、銅のリップ | 銅管の束、圧力計、フライホイールとベルト、遠心調速機、小型ボイラー、蒸気笛 |
| ドワーフ鉱山 | 花崗岩天板に面一の鍛鉄襟（楕円）、角ばった鋲の輪 | 石の炉と熾火、金床、交差したツルハシ、鞴、鉱車、原石の群晶、鉄鎖 |

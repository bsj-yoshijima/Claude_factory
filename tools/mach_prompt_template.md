# 製造機スプライトの Stitch 依頼テンプレ

`<THEME>` `<THEME_DESIGN>` `<SPOT_DESIGN>` `<PALETTE>` を差し替えて `generate_screen_from_text` に投げる。

**必ず1テーマ1枚**（`assets/mach-sheets/<theme>.png`）。2枚に分けると生成が別々になり、
**同じテーマなのに2枚でデザインが変わってしまう**。1枚に4台入れたうえで、
送りを「画像幅に対する比」で指定して圧縮を防ぐ。

切り出しは `python3 tools/cut_machines.py`。**1マスの送りを実測し、テーマ全体で1つの倍率**
（`ゲームの送り 27.65 ÷ 実測の送り`）を全サイズに等倍でかける。サイズごとに違う倍率をかけると
**デザインの見え方がサイズごとに変わってしまう**ので絶対にやらない。

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
6. 向きは規則を並べても従わない。**既知のアイソメ作品を参照**させ（Habbo Hotel / SimCity 2000）、
   失敗形を名指しで禁止する（「天面が細い水平の帯になって前面が大きな長方形になったら、
   それは正面図であって間違い」「天面は側面と同じくらい目立つ大きな菱形であること」）。

---

## テンプレ本文

```
Pixel art sprite sheet on a FLAT SOLID PURE MAGENTA (#FF00FF) background.
No floor, no walls, no cast shadows, no text, no labels, no borders, no grid lines.
The magenta must be the ONLY background colour.

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
| ピラミッド | 石灰岩の天板に面一の金の献納皿（楕円）、縁に象形文字 | オベリスク、カノプス壺、スカラベ、アンク、青蓮、松明、パピルスの巻物 |
| ハロウィン | 黒い板の天板に面一の鋳鉄のトリベット（楕円）、縁のルーンが緑に光る | 提灯かぼちゃ、蝋燭、蜘蛛の巣、蝙蝠、緑の薬瓶、歪んだランタン、大鍋 |

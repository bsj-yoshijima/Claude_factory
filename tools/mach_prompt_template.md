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

---

## テンプレ本文

```
Pixel art sprite sheet on a FLAT SOLID PURE MAGENTA (#FF00FF) background.
No floor, no walls, no cast shadows, no text, no labels, no borders, no grid lines.
The magenta must be the ONLY background colour — no white, no vignette, no panels behind the machines.

FOUR <THEME> machines on ONE sheet. FOUR ROWS, EXACTLY ONE MACHINE PER ROW, stacked in a single
vertical column with magenta gaps between rows. Never place two machines side by side on a row.
Every machine starts at the SAME left edge.
Row 1: 2 tiles. Row 2: 3 tiles. Row 3: 4 tiles. Row 4: 5 tiles.

=== SCALE — AS IMPORTANT AS ORIENTATION ===
All four machines are THE SAME MACHINE at THE SAME SCALE, only different lengths.
Never resize a machine to fill its row, and never compress a long one to make it fit.

The step from one tile to the next is THE SAME in all four machines, and equals
1/12 of the image width to the RIGHT, and half that DOWN.
On a 1024x1024 canvas that is exactly 85 px right and 43 px down per tile.

Measuring between the centres of the first and last ingredient spot:
  2 tiles ->  85 px right,  43 px down      4 tiles -> 255 px right, 128 px down
  3 tiles -> 170 px right,  85 px down      5 tiles -> 340 px right, 170 px down
So the 5-tile machine has 4x the spot-span of the 2-tile machine, and is roughly twice its
total width. The 2-tile machine is small; the 5-tile one is big and spans about half the sheet.
There will be a lot of empty magenta to the right of the 2-tile machine. That is CORRECT.

=== ORIENTATION — THE MOST IMPORTANT RULE ===
Each machine is ONE SINGLE CONTINUOUS BOX drawn in true 2:1 isometric projection.
It is NOT several front-facing boxes chained together. It is one long bench, turned diagonally.

Read these five rules as a checklist. If any of them fails, the drawing is wrong:
1. NO HORIZONTAL LINES. Every structural edge runs at one of exactly two slopes:
   down-to-the-RIGHT at 2:1, or down-to-the-LEFT at 2:1. The only vertical lines are the
   corner edges of the body. Nothing is drawn flat or level.
2. THE TOP FACE IS A LONG RHOMBUS (parallelogram), never a rectangle seen head-on.
3. EXACTLY TWO FACES ARE VISIBLE: the LONG SIDE face (facing down-and-LEFT) and the SHORT END
   face (facing down-and-RIGHT), meeting at one vertical corner edge at the near-bottom corner.
4. NO FACE IS PARALLEL TO THE IMAGE PLANE. There is no flat front-facing panel anywhere.
   If you can see a panel square-on, it is wrong.
5. The long axis runs from the BACK END at the UPPER-LEFT down to the FRONT END at the LOWER-RIGHT.

Consequences to draw correctly:
- The row of ingredient spots forms a DESCENDING DIAGONAL LINE, never a horizontal line.
- Make the tile count countable on the LONG SIDE face: divide it into N identical panels,
  one per tile, separated by a thin vertical strip.
Only this one orientation is needed; do not draw a mirrored version.

=== THE INGREDIENT SPOT ===
One per tile, centred on its tile, all identical in size, evenly spaced along the diagonal,
and left COMPLETELY EMPTY so something can be placed there. It must read instantly as
"put something here" and must never be covered by decoration.
It is an ELLIPSE (a circle foreshortened 2:1), never a full circle.
Design the spot as: <SPOT_DESIGN>

=== THE REST OF THE DESIGN — MAKE IT LAVISH ===
The bare box above is only the chassis. Load it with a rich, eye-catching superstructure so it
reads as a showpiece machine, not a plain counter: <THEME_DESIGN>
Aim for the density of an elaborate arcade cabinet — several distinct pieces of apparatus, not
one lonely accessory. All four carry the same kit at the same size; the longer machines simply
have room for more of it, so the 5-tile one is the grandest.

Constraints on the decoration (these do not relax the orientation rules):
- Every added object is ALSO drawn in the same 2:1 isometric projection. No front-facing faces.
- Decoration sits on the BACK half of the top face, along the back edge, or hangs from posts.
  It must NEVER cover, overlap or crowd an ingredient spot — those stay clear and readable.
- It may rise UPWARD as tall as you like, but NOTHING may stick out sideways past the ends of
  the base — the horizontal silhouette is exactly the base footprint.

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

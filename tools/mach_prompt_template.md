# 製造機スプライトの Stitch 依頼テンプレ

`<THEME>` `<THEME_DESIGN>` `<SPOT_DESIGN>` `<PALETTE>` を差し替えて `generate_screen_from_text` に投げる。
切り出しは `python3 tools/cut_machines.py`（シートは `assets/mach-sheets/<theme>.png` に置く）。

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

過去の失敗（2段階）:
1. 「long axis running from upper-left down-to-the-right」と書くと**マスが横一列**に並ぶ。
   → 1マスあたりのピクセル送りを数字で書いて解決。
2. 送りを数字で書くと斜めには並ぶが、今度は**正面を向いた箱を斜めに数珠つなぎ**にしてくる
   （各要素に正面パネルがある＝アイソメになっていない）。
   → 「水平線を1本も描くな」「見える面は2つだけ」「天面は菱形」で解決。

---

## テンプレ本文

```
Pixel art sprite sheet on a FLAT SOLID PURE MAGENTA (#FF00FF) background.
No floor, no walls, no cast shadows, no text, no labels, no borders, no grid lines.
The magenta must be the ONLY background colour — no white, no vignette, no panels behind the machines.

FOUR <THEME> machines. FOUR ROWS, EXACTLY ONE MACHINE PER ROW, stacked in a single vertical
column with wide magenta gaps between rows. Never place two machines side by side on the same row.
Every machine starts at the SAME left edge; each is longer than the one above it.

=== ORIENTATION — THE MOST IMPORTANT RULE ===
The machine is ONE SINGLE CONTINUOUS BOX drawn in true 2:1 isometric projection.
It is NOT several front-facing boxes chained together. It is one long bench, turned diagonally.

Read these five rules as a checklist. If any of them fails, the drawing is wrong:

1. NO HORIZONTAL LINES. Every structural edge of the machine runs at one of exactly two slopes:
   down-to-the-RIGHT at 2:1 (2 px across for every 1 px down), or down-to-the-LEFT at 2:1.
   The only vertical lines are the corner edges of the body. Nothing is drawn flat/level.
2. THE TOP FACE IS A RHOMBUS — a long parallelogram, i.e. a rectangle seen in isometric.
   It is never a rectangle seen head-on.
3. EXACTLY TWO FACES ARE VISIBLE: the LONG SIDE face, which faces down-and-to-the-LEFT, and
   the SHORT END face, which faces down-and-to-the-RIGHT. They meet at one vertical corner
   edge at the near-bottom corner of the machine.
4. NO FACE IS PARALLEL TO THE IMAGE PLANE. There is no flat front-facing panel anywhere.
   If you can see a panel square-on, it is wrong.
5. The long axis runs from the BACK END at the UPPER-LEFT down to the FRONT END at the
   LOWER-RIGHT. Tile number k sits offset from tile number 0 by exactly
   ( k * 32 px to the RIGHT , k * 16 px DOWNWARD ).

Consequences to draw correctly:
- The row of ingredient spots forms a DESCENDING DIAGONAL LINE, never a horizontal line.
- Each ingredient spot is an ELLIPSE (a circle foreshortened 2:1), never a full circle.
- Make the tile count countable on the LONG SIDE face: divide it into N identical panels
  (arches / doors / vents), one per tile, separated by a thin vertical strip.
Only this one orientation is needed; do not draw a mirrored version.

=== LENGTHS ===
Row 1: 2 tile units. Row 2: 3 tile units. Row 3: 4 tile units. Row 4: 5 tile units.
The 32px tile step is IDENTICAL in all four machines — never stretch or squash a machine to
fill space. Lengths are therefore strictly proportional 2 : 3 : 4 : 5, and the bottom machine
is exactly 2.5 times longer than the top one. Same tile size, same body height, same end caps,
same design language across all four. ONLY THE LENGTH DIFFERS.

=== THE INGREDIENT SPOT ===
Each tile unit has ONE clearly designed place where an ingredient will be set down. The game
draws the ingredient icon exactly at the CENTER of that tile, so the spot must be centred on
its tile, all spots identical in size, evenly spaced along the diagonal, and left COMPLETELY
EMPTY so something can be placed there. They must read instantly as "put something here" and
must never be covered by other decoration.
Design the spot as: <SPOT_DESIGN>

=== THE REST OF THE DESIGN ===
Be generous and make it beautiful: <THEME_DESIGN>
These may rise UPWARD as tall as you like, but NOTHING may stick out sideways past the ends
of the base — the horizontal silhouette is exactly the base footprint.

=== STYLE ===
Chunky lo-fi 8-bit Famicom pixel art, extreme high contrast, thick clean black outlines,
flat colors, no gradients, no anti-aliasing. Palette: <PALETTE>.
```

## 差し替え例

| テーマ | `<SPOT_DESIGN>` | `<THEME_DESIGN>` |
|---|---|---|
| 露天風呂 | 円形の石風呂。滑らかな黒石のリングに乳白色の湯、湯気 | 杉と黒い溶岩石の湯船、竹の掛け流し、湯桶、石灯籠、藍の暖簾、紅葉の枝 |
| ダイナー | クロム縁の丸い鉄板。ステンレス天板に沈んだ焼き面と赤いランプ | ステンレス天板、赤エナメル、市松の蹴込み、ミントの腰壁、ミキサー、ネオンアーチ |

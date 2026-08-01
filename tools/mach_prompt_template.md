# 製造機スプライトの Stitch 依頼テンプレ

`<THEME>` `<THEME_DESIGN>` `<SPOT_DESIGN>` `<PALETTE>` を差し替えて `generate_screen_from_text` に投げる。

**1テーマ2枚に分けて依頼する。** 4台を1枚に詰めるとモデルが長い台を圧縮して比率が壊れる。
- `assets/mach-sheets/<theme>-a.png` … 2マスと3マス（上下2段）
- `assets/mach-sheets/<theme>-b.png` … 4マスと5マス（上下2段）

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

過去の失敗（2段階）:
1. 「long axis running from upper-left down-to-the-right」と書くと**マスが横一列**に並ぶ。
   → 1マスあたりのピクセル送りを数字で書いて解決。
2. 送りを数字で書くと斜めには並ぶが、今度は**正面を向いた箱を斜めに数珠つなぎ**にしてくる
   （各要素に正面パネルがある＝アイソメになっていない）。
   → 「水平線を1本も描くな」「見える面は2つだけ」「天面は菱形」で解決。
3. 長い台を枠に収めようと**1マスを圧縮**してくる（置き場の間隔が 54→49→43→34px と詰まった）。
   → 送りを 64/32px と絶対値で指定し、**1テーマ2枚に分割**して枠の圧迫をなくす。
     切り出し側で縦横別々に引き伸ばして直すのは NG（サイズごとに歪んでデザインが変わる）。
4. 向きを直すために上物を削ると**地味になる**。向きの規則は守らせたまま、
   上物は「アーケード筐体並みの密度で」と明示して盛ること。装飾にも同じアイソメ規則を課し、
   置き場を隠さない・横にはみ出さない、とだけ縛る。

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

=== SCALE — THE MOST IMPORTANT RULE ===
The machines on this sheet are THE SAME MACHINE at THE SAME SCALE, only different lengths.
Do NOT resize any of them to fill the canvas.
The step from one tile to the next is EXACTLY 64 pixels to the RIGHT and 32 pixels DOWN,
in EVERY machine on the sheet. Measuring between the centres of the ingredient spots,
first spot to last spot is:
  2 tiles →  64 px right,  32 px down      4 tiles → 192 px right,  96 px down
  3 tiles → 128 px right,  64 px down      5 tiles → 256 px right, 128 px down
The short machine really is small and the long one really is big. Leaving empty magenta to
the right of a short machine is CORRECT — never stretch it to fill the space, and never
compress a long one to make it fit.

=== THE INGREDIENT SPOT ===
Each tile unit has ONE clearly designed place where an ingredient will be set down. The game
draws the ingredient icon exactly at the CENTER of that tile, so the spot must be centred on
its tile, all spots identical in size, evenly spaced along the diagonal, and left COMPLETELY
EMPTY so something can be placed there. They must read instantly as "put something here" and
must never be covered by other decoration.
Design the spot as: <SPOT_DESIGN>

=== THE REST OF THE DESIGN — MAKE IT LAVISH ===
The bare box above is only the chassis. Load it with a rich, eye-catching superstructure so it
reads as a showpiece machine, not a plain counter: <THEME_DESIGN>
Aim for the density of an elaborate arcade cabinet — several distinct pieces of apparatus, not
one lonely accessory. The longer machines carry more of it, so the 5-tile one is the grandest.

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

## 差し替え例

| テーマ | `<SPOT_DESIGN>` | `<THEME_DESIGN>` |
|---|---|---|
| 露天風呂 | 黒石のリングに乳白色の湯、湯気（楕円） | 竹の掛け流し樋、石灯籠、藍の暖簾を吊る竹の桁、湯桶の積み重ね、紅葉の枝、簾、木札 |
| ダイナー | クロム縁の丸い鉄板（楕円）、赤いランプ | ネオンアーチ、ミルクシェイクミキサー、ケチャップとマスタード、ナプキン入れ、ガラスのケーキドーム、メニュー板、ヒートランプ |

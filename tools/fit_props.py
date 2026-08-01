#!/usr/bin/env python3
"""原寸プロップ(assets/prop-src)を、ゲーム内の表示サイズに合わせて縮小し assets/ に書き出す。

    使い方: python3 tools/fit_props.py [supersample=1]

なぜ必要か:
  Phaser 側は pixelArt:true (=NEAREST) なので、330px の素材を 42px で描くと
  ピクセルが 8 回に 1 回しか拾われず、描き込みが壊れて読めなくなる。
  あらかじめ表示サイズまで高品質(LANCZOS)に縮小しておけば、ゲーム内では
  ほぼ 1:1 で描かれるため、間引きによる破壊が起きない。

表示サイズは game/main.js から実際の定数を読んで計算する(二重管理を避けるため):
  表示高 = 1.35 * CELL * sqrt(コマ数)      … PROP_SPAN のコマ数
  CELL   = W,H,GU,GV,ISO から算出           … main.js と同じ式

supersample は 1 が既定(=表示サイズちょうど)。2 にすると 2 倍で焼くので
Phaser 側が 0.5 倍に縮小して描く(将来キャンバス解像度を上げる場合の保険)。
"""
import math
import os
import re
import sys

from PIL import Image, ImageEnhance, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAIN_JS = os.path.join(ROOT, 'game', 'main.js')
SRC_DIR = os.path.join(ROOT, 'assets', 'prop-src')
OUT_DIR = os.path.join(ROOT, 'assets')
BASE = 1.35          # main.js の prop 描画係数


def read_consts():
    """main.js から W,H,GU,GV / ISO / PROP_SPAN を読む。"""
    js = open(MAIN_JS, encoding='utf-8').read()
    m = re.search(r'const W\s*=\s*(\d+),\s*H\s*=\s*(\d+),\s*GU\s*=\s*(\d+),\s*GV\s*=\s*(\d+)', js)
    W, H, GU, GV = (int(g) for g in m.groups())
    iso = dict(re.findall(r'(\w+):\s*(-?[\d.]+)', re.search(r'const ISO\s*=\s*\{([^}]*)\}', js).group(1)))
    cell = (math.hypot(float(iso['ux']) * W / GU, float(iso['uy']) * H / GU)
            + math.hypot(float(iso['vx']) * W / GV, float(iso['vy']) * H / GV)) / 2
    span_body = re.search(r'const PROP_SPAN\s*=\s*\{(.*?)\n\};', js, re.S).group(1)
    spans = {k: int(v) for k, v in re.findall(r'(\w+)\s*:\s*(\d+)', span_body)}
    # 基本家具はスロット(chair/table/...)でコマ数が決まる。main.js の FURN_SPAN と同じ規則を使う
    furn_body = re.search(r'const FURN_SPAN\s*=\s*\{([^}]*)\}', js).group(1)
    furn = {k: int(v) for k, v in re.findall(r'(\w+)\s*:\s*(\d+)', furn_body)}
    names = re.findall(r"'([a-z][a-z0-9_]*)'", re.search(r'const PROP_NAMES\s*=\s*\[(.*?)\];', js, re.S).group(1))
    return cell, spans, furn, names


# 個別の明るさ補正。Stitch が暗く描いてしまい、暗いテーマの床に置くと沈んで
# シルエットしか見えない物だけをここで持ち上げる(平均輝度が他のスロットに揃う値)。
BRIGHTEN = {'hal_shelf': 1.5}

# 左右反転。アイソメでは水平反転が「90度回した向き」に相当する。
# ソファは全テーマ手前角が右寄りに揃っているので、逆向きに描かれたテーブルだけ
# 反転させてセットで置いたときに向きが合うようにする(接地線の手前角で判定した)。
FLIP = {'din_table', 'cab_table', 'hal_table'}


def pixelize(im, target_h, block, colors, sharpen, brighten=1.0, flip=False):
    """表示サイズへ落としつつ、ドット絵の「パキッとした」質感に整える。

    ただ縮小しただけだと半透明の縁と中間色だらけの「精細なミニチュア」になる。
      1) 論理解像度(表示サイズ / block)へ LANCZOS 縮小
      2) アンシャープで、縮小で鈍ったエッジのコントラストを戻す ← パキッとさせる本体
      3) 色数を落として面を平坦化(中間色の帯を減らす)
      4) アルファを2値化して輪郭の滲みを断つ
      5) NEAREST で block 倍に戻す（block=1 なら等倍のまま）
    block を上げるほど粒は粗くなる。1 で細かくパキッと、2 でドット感が強い。
    """
    if flip:
        im = im.transpose(Image.FLIP_LEFT_RIGHT)
    if brighten != 1.0:
        r, g, b, a = im.split()
        rgb = ImageEnhance.Brightness(Image.merge('RGB', (r, g, b))).enhance(brighten)
        im = Image.merge('RGBA', (*rgb.split(), a))
    lh = max(1, round(target_h / block))
    lw = max(1, round(im.width * (target_h / im.height) / block))
    small = im.resize((lw, lh), Image.LANCZOS)
    if sharpen:
        r, g, b, a = small.split()
        rgb = Image.merge('RGB', (r, g, b)).filter(
            ImageFilter.UnsharpMask(radius=1, percent=sharpen, threshold=2))
        small = Image.merge('RGBA', (*rgb.split(), a))
    r, g, b, a = small.split()
    a = a.point(lambda v: 255 if v >= 128 else 0)                       # 輪郭を硬く
    rgb = Image.merge('RGB', (r, g, b)).quantize(colors=colors, dither=Image.Dither.NONE).convert('RGB')
    small = Image.merge('RGBA', (*rgb.split(), a))
    return small if block == 1 else small.resize((lw * block, lh * block), Image.NEAREST)


def main(ss=1, block=1, colors=24, sharpen=140, out_dir=OUT_DIR):
    cell, spans, furn, names = read_consts()
    print(f'CELL={cell:.1f}px  ss={ss}  block={block}px  colors={colors}  sharpen={sharpen}%  out={out_dir}')
    missing, rows = [], []
    for name in names:
        src = os.path.join(SRC_DIR, f'prop_{name}.png')
        if not os.path.exists(src):
            missing.append(name)
            continue
        span = spans.get(name) or furn.get(name.split('_')[1] if '_' in name else '', 1)
        target_h = round(BASE * math.sqrt(span) * cell * ss)
        im = Image.open(src).convert('RGBA')
        out = pixelize(im, target_h, block, colors, sharpen, BRIGHTEN.get(name, 1.0), name in FLIP)
        out.save(os.path.join(out_dir, f'prop_{name}.png'))
        rows.append(f'  {name:18s} {span}コマ  {im.width}x{im.height} → {out.size[0]}x{out.size[1]}')
    print('\n'.join(rows))
    print(f'{len(rows)}体を書き出しました' + (f' / 原寸なし: {missing}' if missing else ''))


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--supersample', type=int, default=1)
    ap.add_argument('--block', type=int, default=1, help='1ドットの大きさ(px)。2〜3でドット絵の粒になる')
    ap.add_argument('--colors', type=int, default=24, help='1体あたりの色数')
    ap.add_argument('--sharpen', type=int, default=140, help='アンシャープの強さ(%%)。0で無効')
    ap.add_argument('--out', default=OUT_DIR)
    a = ap.parse_args()
    main(a.supersample, a.block, a.colors, a.sharpen, a.out)

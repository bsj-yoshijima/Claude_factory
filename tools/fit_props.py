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

from PIL import Image

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
    names = re.findall(r"'([a-z][a-z0-9_]*)'", re.search(r'const PROP_NAMES\s*=\s*\[(.*?)\];', js, re.S).group(1))
    return cell, spans, names


def main(ss=1):
    cell, spans, names = read_consts()
    print(f'CELL={cell:.1f}px  supersample={ss}')
    missing, rows = [], []
    for name in names:
        src = os.path.join(SRC_DIR, f'prop_{name}.png')
        if not os.path.exists(src):
            missing.append(name)
            continue
        span = spans.get(name, 1)
        target_h = round(BASE * math.sqrt(span) * cell * ss)
        im = Image.open(src).convert('RGBA')
        scale = target_h / im.height
        out = im.resize((max(1, round(im.width * scale)), target_h), Image.LANCZOS)
        out.save(os.path.join(OUT_DIR, f'prop_{name}.png'))
        rows.append(f'  {name:18s} {span}コマ  {im.width}x{im.height} → {out.size[0]}x{out.size[1]}')
    print('\n'.join(rows))
    print(f'{len(rows)}体を書き出しました' + (f' / 原寸なし: {missing}' if missing else ''))


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 1)

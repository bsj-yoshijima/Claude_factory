#!/usr/bin/env python3
"""被り物フィットビューアで付けた消し跡を PNG に焼き込む。

    python3 tools/assets/erase_hat.py <strokes.json> [--dir assets/hats] [--backup <dir>]

入力は2形式。どちらも座標は **hat-<id>.png の元ピクセル**で、該当画素のアルファを0にする。

1) ストロークの列（localStorage('hatErase') そのまま。ブラシは円(半径r)、rect は矩形）

    { "<id>": [ {"t":"b","x":120,"y":80,"r":24}, {"t":"rect","x":0,"y":600,"w":800,"h":120} ] }

2) 消去マスクのランレングス（ビューアの `window.__eraseMask()` の戻り。数千手でも軽い）

    { "<id>": {"w":942, "h":799, "rle":"473:641-644;474-520:634-644,700-710;..."} }
      → "y:開始-終了,開始-終了" の閉区間（y も "y0-y1" で範囲指定できる）。
        w/h は取り違え防止の照合用。

**クロップはしない**。画像サイズを変えると hat-fit.json の cx/dy/w の意味が変わってしまうため、
消しても縦横は元のまま（透明が増えるだけ）。
"""
import json
import os
import shutil
import sys

from PIL import Image, ImageDraw


def apply(path, spec):
    im = Image.open(path).convert('RGBA')
    mask = Image.new('L', im.size, 0)          # 消す場所=255
    d = ImageDraw.Draw(mask)
    if isinstance(spec, dict):                 # ランレングス形式
        if (spec['w'], spec['h']) != im.size:
            raise SystemExit(f'size mismatch {path}: mask {(spec["w"], spec["h"])} != png {im.size}')
        for row in spec['rle'].split(';'):
            if not row:
                continue
            ys, runs = row.split(':')
            y0, y1 = (ys.split('-') + [None])[:2] if '-' in ys else (ys, ys)
            y0, y1 = int(y0), int(y1 if y1 is not None else y0)
            for run in runs.split(','):
                a, b = run.split('-')
                d.rectangle([int(a), y0, int(b), y1], fill=255)
    else:                                      # ストローク形式
        for s in spec:
            if s.get('t') == 'rect':
                d.rectangle([s['x'], s['y'], s['x'] + s['w'] - 1, s['y'] + s['h'] - 1], fill=255)
            else:
                r = s['r']
                d.ellipse([s['x'] - r, s['y'] - r, s['x'] + r, s['y'] + r], fill=255)
    a = im.getchannel('A')
    a.paste(0, (0, 0), mask)
    im.putalpha(a)
    im.save(path)
    return im.size


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opt = {a.split('=')[0]: a.split('=')[1] for a in sys.argv[1:] if a.startswith('--') and '=' in a}
    hats = opt.get('--dir', 'assets/hats')
    backup = opt.get('--backup')
    data = json.load(open(args[0]))
    for id, spec in data.items():
        if not spec:
            continue
        path = os.path.join(hats, f'hat-{id}.png')
        if not os.path.exists(path):
            print('skip (no file):', id)
            continue
        if backup:
            os.makedirs(backup, exist_ok=True)
            dst = os.path.join(backup, f'hat-{id}.png')
            if not os.path.exists(dst):        # 初回だけ元を退避(繰り返し焼いても原本は残る)
                shutil.copy2(path, dst)
        print(id, '->', apply(path, spec))


main()

#!/usr/bin/env python3
"""シークレット(UMA)のアイコンを Stitch の生成物から作る。

    python3 tools/assets/cut_secrets.py <raw/*.png ...> [--out assets/ui/icons] [--size 32]

出力は製品アイコンと同じ土俵（assets/ui/icons/prod-<id>.png・32x32）に置く。
UIは parts.mjs の prodIcon() 1本で出しているので、シークレットだけ別系統にはしない。

やること: マゼンタ背景を縁から flood fill で抜く → 中身の外接矩形で切る →
正方キャンバスに収めて size へ縮小 → α2値化 → PNG8。
1024px から 32px は 32分の1なので、点で間引く NEAREST では絵が消える。
ここは LANCZOS で潰してから α を2値に戻す（縁のにじみは切り捨てる）。
"""
import argparse
import os
from collections import deque

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def key_out(im):
    """縁からの flood fill でマゼンタだけ抜く（中の紫や桃色は守る）"""
    im = im.convert('RGBA')
    w, h = im.size
    a = np.asarray(im).astype(int)
    r, g, b = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mag = (r > 150) & (b > 150) & (g < 110) & (r - g > 60) & (b - g > 60)
    seen = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if mag[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if mag[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and mag[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((nx, ny))
    out = np.array(np.asarray(im))
    out[:, :, 3] = np.where(seen, 0, out[:, :, 3])
    # 縁に残るマゼンタのハロー（アンチエイリアスの中間色）も落とす
    halo = (~seen) & mag
    out[:, :, 3] = np.where(halo, 0, out[:, :, 3])
    return Image.fromarray(out, 'RGBA')


def make(src, out_dir, size):
    im = key_out(Image.open(src))
    bb = im.getbbox()
    if not bb:
        print(f'!! {src}: マゼンタを抜いたら何も残らない'); return None
    im = im.crop(bb)
    # 正方に収める（図鑑のマスが正方なので、ここで揃えると CSS が1種類で済む）
    s = max(im.size)
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.paste(im, ((s - im.width) // 2, (s - im.height) // 2))
    sq = sq.resize((size, size), Image.LANCZOS)
    q = sq.convert('RGBA')
    alpha = q.getchannel('A').point(lambda v: 255 if v > 128 else 0)
    q.putalpha(alpha)
    q = q.quantize(colors=64, method=Image.FASTOCTREE)   # RGBA はこれか libimagequant のみ
    name = os.path.splitext(os.path.basename(src))[0]
    path = os.path.join(out_dir, f'prod-{name}.png')
    q.save(path, optimize=True)
    print(f'{path}  {q.size[0]}x{q.size[1]}  {os.path.getsize(path)//1024}KB')
    return path


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src', nargs='+')
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'ui', 'icons'))
    ap.add_argument('--size', type=int, default=32)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for f in a.src:
        make(f, a.out, a.size)

#!/usr/bin/env python3
"""シークレット(UMA)のアイコンを Stitch の生成物から作る。

    python3 tools/assets/cut_secrets.py <raw/*.png ...> [--out assets/ui/secrets] [--size 128]

やること: マゼンタ背景を縁から flood fill で抜く → 中身の外接矩形で切る →
正方キャンバスに収めて長辺 size へ NEAREST 縮小 → PNG8(α2値)。
図鑑では 34px で出すので、原寸 1024px のままだと1枚1MB近い無駄になる。
NEAREST なのはドット絵の輪郭を保つため（LANCZOS だと縁がにじんで黒線が灰色になる）。
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
    k = max(1, round(s / size))                     # 整数分の1で間引く（ドットが崩れない）
    sq = sq.resize((max(1, s // k), max(1, s // k)), Image.NEAREST)
    q = sq.convert('RGBA')
    alpha = q.getchannel('A').point(lambda v: 255 if v > 128 else 0)
    q.putalpha(alpha)
    q = q.quantize(colors=64, method=Image.FASTOCTREE)   # RGBA はこれか libimagequant のみ
    name = os.path.splitext(os.path.basename(src))[0]
    path = os.path.join(out_dir, name + '.png')
    q.save(path, optimize=True)
    print(f'{path}  {q.size[0]}x{q.size[1]}  {os.path.getsize(path)//1024}KB')
    return path


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('src', nargs='+')
    ap.add_argument('--out', default=os.path.join(ROOT, 'assets', 'ui', 'secrets'))
    ap.add_argument('--size', type=int, default=128)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    for f in a.src:
        make(f, a.out, a.size)

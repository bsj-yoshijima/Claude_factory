#!/usr/bin/env python3
"""Stitch製の被り物1個絵(マゼンタ背景JPEG)を assets/hats/hat-<id>.png 用の透過PNGにする。

    python3 tools/assets/key_hat.py <in.jpg> <out.png> [--keep-hollow]

2段で抜く:
  1) 背景マゼンタ: 縁からの flood fill。JPEGで滲むので「マゼンタ寄り」判定＋縁1周を削る。
     本体内部は触らないので、兜の内側の黒などを誤爆しない。
  2) 頭が入る空洞の黒ベタ: 下辺から届く「分厚い黒の塊」だけを抜く(--keep-hollow で無効)。
     黒の輪郭線と地続きなので、収縮(erode)した芯だけを塗り、あとで太さ ERODE ぶん戻す。
     こうすると空洞は抜け、空洞の縁の輪郭線は残る。

出力は bbox でクロップ。ゲーム側は幅を頭幅に正規化して底辺中央を頭頂に置くので、
クロップ後の「幅」と「底辺」が配置の基準になる(hat-fit.json の cx / dy で微調整)。
"""
import sys
from collections import deque
from PIL import Image

ERODE = 7          # 黒の「塊」判定に使う収縮量(px)。輪郭線(1ドット≒16px)より細かく、空洞より粗い
DARK = 62          # これ以下の明るさを黒とみなす


def is_mag(p):
    r, g, b = p[0], p[1], p[2]
    return r > 110 and b > 110 and g < 0.62 * min(r, b)


def is_pure_mag(p):
    """ほぼ #FF00FF。紫や桃色の被り物(アラビアのターバン等)を誤爆しない厳しめの判定"""
    r, g, b = p[0], p[1], p[2]
    return r > 200 and b > 200 and g < 80


def flood_bg(px, w, h):
    """縁から届くマゼンタを透過にする"""
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    seen = bytearray(w * h)
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i] or not is_mag(px[x, y]):
            continue
        seen[i] = 1
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    # 輪郭線で囲まれた「頭の入り口」の背景は縁から届かないので、ほぼ純マゼンタは無条件に抜く
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and is_pure_mag(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    # 縁に残る滲み1周
    kill = [(x, y) for y in range(h) for x in range(w)
            if px[x, y][3] and is_mag(px[x, y])
            and any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    for x, y in kill:
        px[x, y] = (0, 0, 0, 0)


def flood_hollow(px, w, h):
    """下辺から届く分厚い黒(=頭が入る空洞)を透過にする。輪郭線は残す"""
    dark = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] and max(p[0], p[1], p[2]) <= DARK:
                dark[y * w + x] = 1
    # 収縮: 上下左右 ERODE px すべて黒なら芯
    core = bytearray(w * h)
    for y in range(h):
        for x in range(w):
            if not dark[y * w + x]:
                continue
            if all(0 <= x + dx < w and 0 <= y + dy < h and dark[(y + dy) * w + x + dx]
                   for dx, dy in [(d, 0) for d in (-ERODE, ERODE)] + [(0, d) for d in (-ERODE, ERODE)]):
                core[y * w + x] = 1
    # 芯の連結成分のうち最大のもの(=頭が入る空洞。輪郭線は収縮で消えるので残らない)
    seen = bytearray(w * h)
    hit = []
    for sy in range(h):
        for sx in range(w):
            if not core[sy * w + sx] or seen[sy * w + sx]:
                continue
            comp = []
            q = deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and core[ny * w + nx] and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            if len(comp) > len(hit):
                hit = comp
    # 芯を ERODE ぶん膨らませて戻す(黒の範囲内だけ)
    for x, y in hit:
        for dy in range(-ERODE, ERODE + 1):
            for dx in range(-ERODE, ERODE + 1):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and dark[ny * w + nx]:
                    px[nx, ny] = (0, 0, 0, 0)
    return len(hit)


def flood_seed(px, w, h, fx, fy, tol=70):
    """指定座標(幅/高さの比)の色に近い連結領域を抜く。
    背景が純マゼンタから外れて塗られた「頭の入り口」を手当てするための逃げ道。"""
    sx, sy = int(w * fx), int(h * fy)
    base = px[sx, sy]
    q = deque([(sx, sy)])
    n = 0
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        p = px[x, y]
        if p[3] == 0 or max(abs(p[i] - base[i]) for i in range(3)) > tol:
            continue
        px[x, y] = (0, 0, 0, 0)
        n += 1
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return n


def despeckle(px, w, h, ratio=0.003):
    """空洞を抜いたあとに残る輪郭線の切れ端(小さな孤立塊)を落とす"""
    seen = bytearray(w * h)
    comps, total = [], 0
    for sy in range(h):
        for sx in range(w):
            if px[sx, sy][3] == 0 or seen[sy * w + sx]:
                continue
            comp, q = [], deque([(sx, sy)])
            seen[sy * w + sx] = 1
            while q:
                x, y = q.popleft()
                comp.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] and not seen[ny * w + nx]:
                        seen[ny * w + nx] = 1
                        q.append((nx, ny))
            comps.append(comp)
            total += len(comp)
    for comp in comps:
        if len(comp) < total * ratio:
            for x, y in comp:
                px[x, y] = (0, 0, 0, 0)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src, dst = args[0], args[1]
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    px = im.load()
    flood_bg(px, w, h)
    for a in sys.argv[1:]:
        if a.startswith('--fill='):       # --fill=0.5,0.6 : その位置の色の塊を抜く
            fx, fy = (float(v) for v in a.split('=')[1].split(','))
            print('seed fill px:', flood_seed(px, w, h, fx, fy))
    if '--keep-hollow' not in sys.argv:
        n = flood_hollow(px, w, h)
        despeckle(px, w, h)
        print('hollow core px:', n)
    im = im.crop(im.getbbox())
    im.save(dst)
    print(dst, im.size)


main()

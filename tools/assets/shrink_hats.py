#!/usr/bin/env python3
"""ゲームに載せる被り物 PNG を軽くする。

    python3 tools/assets/shrink_hats.py [--dir=assets/hats] [--max=256] [--backup=<dir>] [--dry]

Stitch から落とした原画は 700〜1000px 角で1枚 200〜600KB あるが、盤面での実寸は
**横 17〜46px**（`w`ドット × DOTP=3 × スプライト倍率 0.556）しかない。高解像度は無駄なので:

1. **整数分の1に縮小**（1/2, 1/3, …）。倍数で割るとドットの目が崩れないので NEAREST で十分。
   `--max` は縮小後の最大辺。既定 256px は実寸の5倍以上あり、Retina でも足りる。
2. **PNG8(パレット)化**。ドット絵は色数が少ないので RGBA より一気に小さくなる。
   半透明は残さず α>128 を不透明として2値化する（元絵の縁は JPEG 由来のにじみだけなので、
   むしろ切れが良くなる）。透明は専用のパレット番号にして `transparency` で指定。

**縦横比は変えない**。`hat-fit.json` の cx/dy/w は画像の幅を基準にした比率なので、
比率が同じなら較正はそのまま通る（＝縮小しても盤面での見た目は変わらない）。
"""
import os
import shutil
import sys

from PIL import Image

TRANSP = 255          # 透明に使うパレット番号


def shrink(im, maxside):
    k = max(1, -(-max(im.size) // maxside))       # ceil(長辺 / max)
    if k == 1:
        return im, 1
    return im.resize((im.width // k, im.height // k), Image.NEAREST), k


def to_pal(im):
    """RGBA → PNG8。α>128 を不透明、それ以外は透明インデックスに寄せる"""
    alpha = im.getchannel('A').point(lambda v: 255 if v > 128 else 0)
    q = im.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=TRANSP)
    # 余った1色を透明用に。色は黒にする(縮小時に色が滲む描画系でも、輪郭の黒に紛れて目立たない)
    pal = q.getpalette()[:TRANSP * 3] + [0, 0, 0]
    q.putpalette(pal)
    px, ap = q.load(), alpha.load()
    for y in range(q.height):
        for x in range(q.width):
            if ap[x, y] == 0:
                px[x, y] = TRANSP
    q.info['transparency'] = TRANSP
    return q


def main():
    opt = {a.split('=')[0]: a.split('=')[1] for a in sys.argv[1:] if '=' in a}
    hats = opt.get('--dir', 'assets/hats')
    maxside = int(opt.get('--max', 256))
    backup = opt.get('--backup')
    dry = '--dry' in sys.argv
    before = after = 0
    for name in sorted(os.listdir(hats)):
        if not name.startswith('hat-') or not name.endswith('.png'):
            continue
        path = os.path.join(hats, name)
        im = Image.open(path)
        if im.mode == 'P' and 'transparency' in im.info:
            print(f'{name}: すでに PNG8 なので触らない')
            before += os.path.getsize(path); after += os.path.getsize(path)
            continue
        src = os.path.getsize(path)
        im = im.convert('RGBA')
        small, k = shrink(im, maxside)
        out = to_pal(small)
        if backup:
            os.makedirs(backup, exist_ok=True)
            dst = os.path.join(backup, name)
            if not os.path.exists(dst):        # 原画は初回だけ退避(何度流しても原本は残る)
                shutil.copy2(path, dst)
        if not dry:
            out.save(path, optimize=True)
        dstsize = os.path.getsize(path) if not dry else src
        print(f'{name}: {im.size} {src//1024}KB -> 1/{k} {small.size} {dstsize//1024}KB')
        before += src; after += dstsize
    print(f'合計 {before//1024}KB -> {after//1024}KB')


main()

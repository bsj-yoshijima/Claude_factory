#!/usr/bin/env python3
"""部屋背景のガラス(マゼンタのベタ)を抜いて透過にする。

    使い方: python3 tools/assets/key_room_glass.py <in.png> [out.png] [--report]
            out を省くと in を上書きする（元に戻せないので注意）

なぜ必要か:
  デフォルト部屋 `assets/rooms/room-factory.png`（テクスチャキー `bg_room`）だけは
  ガラスが透過している必要がある。ゲームは背景の**後ろ**に空・太陽・月・星を置いていて、
  それが窓越しに見え、時間帯で変化する（game/scene/lighting.mjs の skyLayer / sun / moon / stars）。
  テーマ部屋はこの演出を切っているので、抜きが要るのはこの1枚だけ。

  生成AIは透過を出せないので、`docs/stitch-prompts.md` の factory 用プロンプトでは
  ガラスを純マゼンタのベタで描かせている。それをここでクロマキーする。

やり方:
  マゼンタらしさ m = (min(R,B) - G) / 255 で測る。
    - m >= HI            … ガラス本体。完全に透過にする
    - LO < m < HI        … 桟との境界の中間色。m に応じて半透明にし、色かぶりを打ち消す
    - m <= LO            … 触らない
  茶色の壁(R>G>B) や灰色(R≒G≒B) は min(R,B) が G を超えないので、この式では反応しない。
  生成物のマゼンタは純粋な #FF00FF にならない（実測 (254,15,253) 前後にばらつく）ので、
  固定色との一致ではなく上の比率で判定する。
"""
import sys

from PIL import Image

HI = 0.50   # これ以上は完全透過
LO = 0.12   # これ以下は無視


def magentaness(r, g, b):
    lo = min(r, b)
    return 0.0 if lo <= g else (lo - g) / 255.0


def key(img):
    img = img.convert('RGBA')
    px = img.load()
    w, h = img.size
    n_clear = n_edge = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = magentaness(r, g, b)
            if m >= HI:
                px[x, y] = (0, 0, 0, 0)
                n_clear += 1
            elif m > LO:
                # 境界の中間色。マゼンタぶんだけ薄くし、残る色から赤紫を抜く
                t = (m - LO) / (HI - LO)                 # 0..1
                excess = (r + b) / 2 - g
                r2 = max(0, min(255, int(r - excess * 0.9)))
                b2 = max(0, min(255, int(b - excess * 0.9)))
                px[x, y] = (r2, g, b2, int(a * (1 - t)))
                n_edge += 1
    return img, n_clear, n_edge


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        print(__doc__)
        sys.exit(1)
    src = args[0]
    dst = args[1] if len(args) > 1 else src
    img, n_clear, n_edge = key(Image.open(src))
    if '--report' in sys.argv:
        print(f'完全透過 {n_clear}px / 境界の半透明 {n_edge}px')
    img.save(dst)
    print(f'wrote {dst}')


if __name__ == '__main__':
    main()

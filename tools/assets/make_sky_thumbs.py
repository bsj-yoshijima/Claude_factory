#!/usr/bin/env python3
"""空テーマ（標準・快晴・夕焼け・星空）のサムネイルを作る。

    使い方: python3 tools/assets/make_sky_thumbs.py

入力 : assets/rooms/room-factory.png （ガラスが透過していること）
出力 : assets/ui/icons/theme-{auto,blue,sunset,night}.png （64×64）

部屋テーマのサムネ（tools/assets/make_theme_thumbs.mjs）は部屋の絵をそのまま縮めるだけで
済むが、空テーマは部屋の絵が同じで**光の当たり方だけが変わる**ので、それを再現しないと
4つとも同じ絵になってしまう。ゲームと同じ手順で合成する:

    1. 背景(room-factory.png)に環境色 amb を掛ける   … Phaser の bgImg.setTint(amb)
    2. その後ろに空の色 sky を敷く                    … lighting.mjs の skyLayer
    ガラスが透過しているので、窓のところだけ空の色が出る。

amb / sky の値は game/scene/lighting.mjs の TH テーブルと同じ。変えたらここも合わせること。

「標準」は時刻連動なので1枚の絵にできない。昼と夜を左右に割って「時間で変わる」ことを示す。

切り出し位置(480×480 @ 左450・上30)は make_theme_thumbs.mjs と同一。ここがずれると
空テーマだけ他とフレーミングが違って見える。
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'assets', 'rooms', 'room-factory.png')
OUT = os.path.join(ROOT, 'assets', 'ui', 'icons')
CROP = (450, 30, 450 + 480, 30 + 480)   # make_theme_thumbs.mjs の CROP と同じ
THUMB = 64

# game/scene/lighting.mjs の TH テーブルより
TH = {
    'blue':   {'amb': 0xffffff, 'sky': 0xaec6e6},
    'sunset': {'amb': 0xffce9e, 'sky': 0xef8f56},
    'night':  {'amb': 0x47597f, 'sky': 0x0c1430},
}


def rgb(v):
    return ((v >> 16) & 255, (v >> 8) & 255, v & 255)


def scene(room, amb, sky):
    """部屋に環境色を掛け、後ろに空を敷いた1枚を返す（ガラス越しに空が見える）"""
    ar, ag, ab = rgb(amb)
    tinted = Image.merge('RGBA', (
        room.getchannel('R').point(lambda p: p * ar // 255),
        room.getchannel('G').point(lambda p: p * ag // 255),
        room.getchannel('B').point(lambda p: p * ab // 255),
        room.getchannel('A')))
    return Image.alpha_composite(Image.new('RGBA', room.size, rgb(sky) + (255,)), tinted)


def thumb(img):
    return img.crop(CROP).resize((THUMB, THUMB), Image.LANCZOS).convert('RGB')


def main():
    room = Image.open(SRC).convert('RGBA')
    if room.getchannel('A').getextrema()[0] == 255:
        print('!! room-factory.png のガラスが抜けていない。'
              'tools/assets/key_room_glass.py を先に通すこと')
    os.makedirs(OUT, exist_ok=True)
    made = {}
    for key, t in TH.items():
        made[key] = thumb(scene(room, t['amb'], t['sky']))
    # 標準 = 時刻連動。昼(快晴)と夜(星空)を左右で割って「変わる」ことを見せる
    auto = made['blue'].copy()
    auto.paste(made['night'].crop((THUMB // 2, 0, THUMB, THUMB)), (THUMB // 2, 0))
    made['auto'] = auto
    for key, im in made.items():
        p = os.path.join(OUT, f'theme-{key}.png')
        im.save(p)
        print(f'  icons/theme-{key}.png ({THUMB}×{THUMB}, {os.path.getsize(p) / 1024:.1f}KB)')
    print(f'  {len(made)} テーマ')


if __name__ == '__main__':
    main()

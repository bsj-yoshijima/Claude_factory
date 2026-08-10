"""製造機の「型」— Stitch に塗り替えさせる 1マスモジュールの殻を描く。

部屋の殻(make_room_shell.py)と同じ考え方。部屋は「へこみ」— 床があって、その奥に壁が
立ち上がり、内側の面がこちらを向く。製造機はその逆の「出っ張り」— 天面があって、その手前に
側面が降り、外側の面がこちらを向く。使う面と色は部屋と対応させる:

    部屋                        製造機
    床ダイヤ                 →  天面(1マス)
    左壁の内側の面           →  手前左の長側面（機械が伸びる向きに平行。全マスで見える）
    右壁の内側の面           →  手前右の端面（先頭マスだけで見える）
    左壁の開口（色が微妙に  →  ホッパー（天面の中央）と点検窓（長側面の中央）。
    変わるゾーン・上端ぼかし）  同じ扱い。位置だけ規格で、形はテーマ任せ。だから
                                硬い枠で描かず、ぼかしたゾーンとして置く
    暗い余白(void)           →  マゼンタ #FF00FF（切り抜き前提なのでここだけ違う）

線は引かない（部屋の殻で線を使っているのは床の12x12の目地だけで、天面は1マスなので
目地が無い）。面取りの帯やハイライトも入れない。部屋に無いものは作らない。

寸法は px ではなく「菱形の幅 DW に対する比」で決める。比の値は採用済みの32枚の
`assets/mach-sheets/_module_*.png` の実測値（全枚一致）から取った:

    菱形の幅 : 高さ            = 1 : 0.558   → 型では厳密な 2:1 (1:0.5) に直す
    側面の高さ / 菱形の幅      = 0.346
    総高(接地〜最上端) / 菱形幅 = 0.913       → ホッパーの頭は天面の奥角とほぼ同じ高さ

    使い方:
      python3 tools/assets/make_machine_shell.py          # docs/ に殻と検収下絵を書く
      python3 tools/assets/make_machine_shell.py --size 512 --out /tmp/shell.png
"""
import argparse
import os

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SIZE = 1024                     # 正方キャンバス。比で描くので値そのものに意味は無い
DW_RATIO = 0.90                 # 菱形の幅 / キャンバス幅（採用済みモジュールと同じ 462/512）
BODY = 0.346                    # 側面の高さ / 菱形の幅
HOP = 0.44                      # ホッパーの口の径 / 菱形の幅（天面の中央。実測 0.42 に合わせた）
WIN_LEN = 0.44                  # 点検窓の長さ / 長側面の長さ
WIN_H = 0.46                    # 点検窓の高さ / 側面の高さ
BLUR = 0.009                    # ぼかし半径 / 菱形の幅

MAGENTA = (0xff, 0x00, 0xff)
TOP     = (0xcd, 0xbf, 0xa4)         # 天面 ＝ 部屋の床
SIDE_L  = (0x3a, 0x33, 0x52)         # 手前左の長側面 ＝ 部屋の左壁の内側
SIDE_R  = (0x45, 0x3d, 0x60)         # 手前右の端面   ＝ 部屋の右壁の内側
HOLE    = (0x2a, 0x35, 0x48)         # ホッパー・点検窓 ＝ 部屋の開口

GUIDE_EDGE = (0xff, 0x3d, 0xa6)      # 検収下絵: 接地菱形
GUIDE_TOP  = (0xff, 0xd2, 0x4a)      # 検収下絵: 天面の菱形
GUIDE_HOP  = (0x6e, 0xe6, 0xff)      # 検収下絵: ホッパーの位置


def geom(size=SIZE):
    """型の頂点を返す。原点は接地菱形の手前角（＝絵の最下点）。"""
    dw = size * DW_RATIO
    sx, sy = dw / 2, dw / 4                    # 1マスの半幅・半高（厳密に 2:1）
    body = dw * BODY
    cx = size / 2
    cy = size - (size - (body + 2 * sy)) / 2   # 接地菱形の手前角の y（上下中央に収める）

    def g(u, v, up=0.0):
        return (cx + (u - v) * sx, cy - 2 * sy + (u + v) * sy - up)

    return g, dict(dw=dw, sx=sx, sy=sy, body=body, cx=cx, cy=cy, size=size)


def soft(size, poly, blur, fill, into):
    """ぼかした塗り。硬い枠で描くとその枠ごとコピーされるので、境界を溶かす。"""
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(blur))
    into.paste(Image.new('RGB', (size, size), fill), (0, 0), m)


def soft_ellipse(size, box, blur, fill, into):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).ellipse(box, fill=255)
    m = m.filter(ImageFilter.GaussianBlur(blur))
    into.paste(Image.new('RGB', (size, size), fill), (0, 0), m)


def make(path, size=SIZE, guide=False):
    g, G = geom(size)
    body, blur = G['body'], G['dw'] * BLUR
    im = Image.new('RGB', (size, size), MAGENTA)
    d = ImageDraw.Draw(im)

    # 面は3つだけ。奥の2面は箱自身に隠れるので描かない
    #   u = 機械が伸びる向き（右斜め下）／ v = 奥行き（左斜め下）。1マスなので u,v とも 0..1
    d.polygon([g(0, 1), g(1, 1), g(1, 1, body), g(0, 1, body)], fill=SIDE_L)   # 長側面(手前左)
    d.polygon([g(1, 1), g(1, 0), g(1, 0, body), g(1, 1, body)], fill=SIDE_R)   # 端面(手前右)
    d.polygon([g(0, 0, body), g(1, 0, body), g(1, 1, body), g(0, 1, body)], fill=TOP)

    # ホッパー。天面の中央に、ぼかした楕円のゾーンとして置く（形はテーマ任せ）
    hx, hy = g(0.5, 0.5, body)
    soft_ellipse(size, (hx - G['sx'] * HOP, hy - G['sy'] * HOP,
                        hx + G['sx'] * HOP, hy + G['sy'] * HOP), blur, HOLE, im)

    # 点検窓。長側面の中央に、同じくぼかしたゾーンとして置く
    a, b = 0.5 - WIN_LEN / 2, 0.5 + WIN_LEN / 2
    top_off = body * (1 - WIN_H) / 2
    soft(size, [(g(a, 1)[0], g(a, 1)[1] - top_off), (g(b, 1)[0], g(b, 1)[1] - top_off),
                (g(b, 1)[0], g(b, 1)[1] - top_off - body * WIN_H),
                (g(a, 1)[0], g(a, 1)[1] - top_off - body * WIN_H)], blur, HOLE, im)

    if guide:
        # 検収下絵。線とラベルが焼き込まれているので Stitch には渡さない
        w = max(1, round(size / 340))
        d.line([g(0, 0), g(1, 0), g(1, 1), g(0, 1), g(0, 0)], fill=GUIDE_EDGE, width=w)
        d.line([g(0, 0, body), g(1, 0, body), g(1, 1, body), g(0, 1, body), g(0, 0, body)],
               fill=GUIDE_TOP, width=w)
        for u, v in ((0, 0), (1, 0), (1, 1), (0, 1)):
            d.line([g(u, v), g(u, v, body)], fill=GUIDE_TOP, width=w)
        r = G['sx'] * HOP
        d.ellipse((hx - r, hy - r / 2, hx + r, hy + r / 2), outline=GUIDE_HOP, width=w)
        d.line([(0, g(1, 1)[1]), (size, g(1, 1)[1])], fill=GUIDE_EDGE, width=w)   # 接地線

    im.save(path)
    print(f'{path}  {size}x{size}  菱形={G["dw"]:.0f}x{G["dw"]/2:.0f} '
          f'側面={body:.0f}px 総高={body + 2 * G["sy"]:.0f}px')
    return im


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--size', type=int, default=SIZE)
    ap.add_argument('--out', default=None)
    ap.add_argument('--guide', action='store_true', help='検収用の線を焼き込む')
    a = ap.parse_args()
    if a.out:
        make(a.out, a.size, a.guide)
    else:
        make(os.path.join(ROOT, 'docs', f'mach-shell-{a.size}.png'), a.size, False)
        make(os.path.join(ROOT, 'docs', f'mach-guide-{a.size}.png'), a.size, True)

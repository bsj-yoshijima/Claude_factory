"""厚みつきの部屋の殻を描く。

guide.html の draw(shellOnly) と同じ ISO・同じ色・同じ開口。違いは厚みを持たせたこと:
  壁 … 内側の面は床エンドライン(u=0 / v=0)に乗せたまま、厚みは部屋の外へ出す
  床 … ダイヤの手前2辺の下に小口を出す
外へはみ出した分は暗い余白に重なってよい（枠線の外に出てよい、という運用）。
"""
from PIL import Image, ImageDraw

IW, IH = 1376, 768
GU = GV = 12
WALL = 260                      # 壁の垂直高さ(px)
ISO = dict(Bx=0.5, By=0.3584, ux=0.3261, uy=0.2919, vx=-0.3261, vy=0.2919)

# 左壁の開口3つ（lighting.mjs の windows と同値）。床エッジから 24〜245px 上
WINDOWS = [(0.069, 0.252), (0.388, 0.579), (0.720, 0.918)]
WIN_UP0, WIN_UP1 = 24, 245
WIN_SOLID = 0.62                # 下から62%までベタ、そこから上端に向けてぼかす

VOID       = (0x12, 0x0e, 0x1c)
FLOOR      = (0xcd, 0xbf, 0xa4)
FLOOR_SIDE = (0x8e, 0x83, 0x6f)      # 床の小口
GROUT      = (0x5a, 0x4a, 0x34, 140)
WALL_L     = (0x3a, 0x33, 0x52)      # 左壁の内側の面
WALL_R     = (0x45, 0x3d, 0x60)      # 右壁の内側の面
WALL_TOP   = (0x5d, 0x53, 0x7e)      # 壁の上面（厚みが見える面）
WALL_CAP_L = (0x2b, 0x25, 0x3f)      # 左壁の端の小口
WALL_CAP_R = (0x33, 0x2d, 0x49)      # 右壁の端の小口
WIN        = (0x2a, 0x35, 0x48)


def P(u, v, up=0.0):
    return ((ISO['Bx'] + u*ISO['ux'] + v*ISO['vx']) * IW,
            (ISO['By'] + u*ISO['uy'] + v*ISO['vy']) * IH - up)


def make(path, wall_tiles=0.5, floor_px=18, grid=True):
    """wall_tiles: 壁の厚み(マス単位)。floor_px: 床の小口の高さ(px)。"""
    t = wall_tiles / GU                       # 床全体が 1.0 = 12マス
    im = Image.new('RGB', (IW, IH), VOID)
    d = ImageDraw.Draw(im, 'RGBA')

    # --- 壁の上面（厚みが見える面）。平面では L 字。内側の縁は u=0 / v=0 に一致
    d.polygon([P(0, 1, WALL), P(0, 0, WALL), P(1, 0, WALL),
               P(1, -t, WALL), P(-t, -t, WALL), P(-t, 1, WALL)], fill=WALL_TOP)

    # --- 壁の端の小口（左端 v=1 / 右端 u=1）。外側にだけ出る
    d.polygon([P(0, 1), P(-t, 1), P(-t, 1, WALL), P(0, 1, WALL)], fill=WALL_CAP_L)
    d.polygon([P(1, 0), P(1, -t), P(1, -t, WALL), P(1, 0, WALL)], fill=WALL_CAP_R)

    # --- 壁の内側の面。ここが床エンドラインにぴったり乗る
    d.polygon([P(0, 0), P(0, 1), P(0, 1, WALL), P(0, 0, WALL)], fill=WALL_L)
    d.polygon([P(0, 0), P(1, 0), P(1, 0, WALL), P(0, 0, WALL)], fill=WALL_R)

    # --- 床の小口（手前2辺の下）。頂点は動かさず、下へ floor_px だけ出す
    if floor_px:
        down = lambda p: (p[0], p[1] + floor_px)
        left, front, right = P(0, 1), P(1, 1), P(1, 0)
        d.polygon([left, front, down(front), down(left)], fill=FLOOR_SIDE)
        d.polygon([front, right, down(right), down(front)], fill=FLOOR_SIDE)

    # --- 床（12x12）
    d.polygon([P(0, 0), P(1, 0), P(1, 1), P(0, 1)], fill=FLOOR)
    if grid:
        for i in range(GU + 1):
            d.line([P(i/GU, 0), P(i/GU, 1)], fill=GROUT, width=1)
            d.line([P(0, i/GV), P(1, i/GV)], fill=GROUT, width=1)

    # --- 左壁の開口3つ。guide.html と同じ「絶対yの縦グラデーション」でぼかす
    #     （硬い四角で描くと、その枠ごと木枠のガラス窓としてコピーされる）
    win_a = Image.new('L', (IW, IH), 0)          # 開口3つぶんのアルファをここに溜める
    for v0, v1 in WINDOWS:
        a, b = P(0, v0), P(0, v1)
        mid = (a[1] + b[1]) / 2
        y_bot, y_top = mid - WIN_UP0, mid - WIN_UP1
        quad = Image.new('L', (IW, IH), 0)
        ImageDraw.Draw(quad).polygon(
            [(a[0], a[1]-WIN_UP0), (b[0], b[1]-WIN_UP0),
             (b[0], b[1]-WIN_UP1), (a[0], a[1]-WIN_UP1)], fill=255)
        # canvas のグラデーションと同じく、両端の外側は端の色のまま伸びる（clamp）
        grad = Image.new('L', (IW, IH), 0)
        gd = ImageDraw.Draw(grad)
        for y in range(IH):
            k = (y_bot - y) / (y_bot - y_top)                  # 0=下端 1=上端
            k = min(max(k, 0.0), 1.0)
            al = 255 if k <= WIN_SOLID else int(255 * (1 - (k - WIN_SOLID) / (1 - WIN_SOLID)))
            gd.line([(0, y), (IW, y)], fill=al)
        win_a.paste(Image.composite(grad, win_a, quad))
    # RGB は WIN 一色のまま、アルファだけ差し替える（paste で混ぜると RGB まで暗くなる）
    ov = Image.new('RGBA', (IW, IH), WIN + (0,))
    ov.putalpha(win_a)
    im = Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')

    im.save(path)
    print(path, f'wall={wall_tiles}tile floor={floor_px}px')


if __name__ == '__main__':
    make('preview/shell-thick-035.png', 0.35, 12)
    make('preview/shell-thick-05.png',  0.5,  18)
    make('preview/shell-thick-08.png',  0.8,  28)
    make('preview/shell-thick-05-nofloor.png', 0.5, 0)

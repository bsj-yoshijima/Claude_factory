#!/usr/bin/env python3
"""部屋の背景画像を拡縮＋平行移動して、床をゲームのグリッドに合わせる。

    測るだけ: python3 tools/fit_room.py <theme>
    書き込む: python3 tools/fit_room.py <theme> --apply
    別画像から: python3 tools/fit_room.py <theme> --from <path> --apply

なぜ画像を動かすのか:
  背景は生成物で、床の菱形が game/main.js のグリッドと数十pxずれる。生成し直しても
  ピクセル座標は守られない(実測: 幅 673px / 675px と2回とも 5% 大きいまま)。
  絵そのものは良いので、**デザインには触れず幾何だけ直す**。拡縮と平行移動しかしないので
  色も構図も変わらない。

合わせ方:
  1. 横幅: シルエットの左端〜右端が、グリッドの左角〜右角(640px)になるよう一様に拡縮する。
     壁は床の角の真上に立つので、シルエットの左右端 = 床の左右角として使える。
  2. 横位置: 左端をグリッドの左角(x=197)に合わせる。
  3. 縦位置: グリッドの右下辺(右角→手前角)に、床上面の右下辺を重ねる。
     機械的に取れるのはシルエットの下端(スカートの下端)なので、下端から上へ明るさが
     跳ねる所までをスカート厚として引く。

注意:
  背景は setDisplaySize(1024,572) で引き伸ばして描かれる。測るのはキャンバス座標で行い、
  書き込みは元解像度で行う。
"""
import os, re, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIRT_PROBE = 40      # 下端から上へ何px ぶん明るさを見るか
SKIRT_JUMP = 135      # 明るさの合計がこれ以上跳ねたらスカート→床上面の境目


def grid():
    src = open(os.path.join(ROOT, 'game', 'main.js'), encoding='utf-8').read()
    W, H, GU, GV = (int(x) for x in re.search(
        r'const W = (\d+), H = (\d+), GU = (\d+), GV = (\d+)', src).groups())
    iso = {k: float(v) for k, v in re.findall(r'(Bx|By|ux|uy|vx|vy):\s*(-?[\d.]+)', src)[:6]}
    vmax = (GV - 1) / GV      # 左下辺は1列ぶん浅い(床は 12 x 11)
    def uv(u, v):
        return ((iso['Bx'] + u * iso['ux'] + v * iso['vx']) * W,
                (iso['By'] + u * iso['uy'] + v * iso['vy']) * H)
    return W, H, uv(0, 0), uv(1, 0), uv(1, vmax), uv(0, vmax)


def probe(arr):
    """(左端x, 右端x, 右下辺のシルエット下端がグリッド線から何px下か, スカート厚)"""
    bg = arr[3, 3]
    mask = np.abs(arr - bg).sum(axis=2) > 60
    W = arr.shape[1]
    xs = [x for x in range(W) if mask[:, x].any()]
    if not xs:
        return None
    return xs[0], xs[-1], mask


def edge_gap(arr, mask, R, F):
    slope = (F[1] - R[1]) / (F[0] - R[0])
    dys, skirts = [], []
    for x in range(int(F[0]) + 20, int(R[0]) - 10, 2):
        col = np.nonzero(mask[:, x])[0]
        if not len(col):
            continue
        ybot = col[-1]
        dys.append(ybot - (R[1] + (x - R[0]) * slope))
        lum = [int(arr[y, x].sum()) for y in range(max(0, ybot - SKIRT_PROBE), ybot + 1)][::-1]
        t = next((i for i in range(1, len(lum)) if lum[i] - lum[0] > SKIRT_JUMP), None)
        if t:
            skirts.append(t)
    if not dys:
        return None, None
    return float(np.median(dys)), (float(np.median(skirts)) if skirts else 0.0)


def main():
    if len(sys.argv) < 2:
        print(__doc__); return
    theme = sys.argv[1]
    apply_ = '--apply' in sys.argv
    srcp = sys.argv[sys.argv.index('--from') + 1] if '--from' in sys.argv else None
    dst = os.path.join(ROOT, 'assets', f'room-{theme}.png')
    img = Image.open(srcp or dst).convert('RGB')
    W, H, A, R, F, D = grid()
    target_w = R[0] - D[0]                       # 左角→右角 = 640px

    def measure(im):
        arr = np.asarray(im.convert('RGB').resize((W, H))).astype(int)
        xl, xr, mask = probe(arr)
        gap, skirt = edge_gap(arr, mask, R, F)
        return xl, xr, gap, skirt

    xl, xr, gap, skirt = measure(img)
    scale = target_w / (xr - xl)
    print(f'{theme}: 幅 {xr-xl}px → 目標 {target_w:.0f}px  (倍率 {scale:.4f})')
    print(f'  右下辺: 下端 {gap:+.1f}px / スカート {skirt:.0f}px → 上面 {gap-skirt:+.1f}px ずれ')

    # 元解像度で「拡縮 → 貼り直し」。キャンバス基準の量を元解像度へ換算する
    kx, ky = img.width / W, img.height / H
    nw, nh = max(1, round(img.width * scale)), max(1, round(img.height * scale))
    small = img.resize((nw, nh), Image.LANCZOS)
    bgc = tuple(np.asarray(img)[3, 3].tolist())
    canvas = Image.new('RGB', (img.width, img.height), bgc)
    # まず中央に置いてから、実測でぴったりに追い込む
    ox, oy = (img.width - nw) // 2, (img.height - nh) // 2
    for _ in range(4):
        t = canvas.copy(); t.paste(small, (ox, oy))
        xl2, xr2, gap2, skirt2 = measure(t)
        dx = (D[0] - xl2) * kx                    # 左端をグリッドの左角へ
        dy = -(gap2 - skirt2) * ky                # 床上面の辺をグリッド線へ
        if abs(dx) < 0.6 and abs(dy) < 0.6:
            break
        ox += round(dx); oy += round(dy)
    out = canvas.copy(); out.paste(small, (ox, oy))
    xl3, xr3, gap3, skirt3 = measure(out)
    print(f'  合わせた後: 幅 {xr3-xl3}px / 左端 x={xl3} (目標 {D[0]:.0f}) / '
          f'上面のずれ {gap3-skirt3:+.1f}px')
    if not apply_:
        print('  (--apply を付けると書き込みます)'); return
    out.save(dst)
    print(f'  書き込み: {dst}')


if __name__ == '__main__':
    main()

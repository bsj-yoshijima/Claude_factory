#!/usr/bin/env python3
"""受け取った1マスモジュールを、型(make_machine_shell.py)と突き合わせて合否を出す。

部屋の背景を guide.html で検収するのと同じ役目。取り込む(cut_machines.py)前に必ず通す。
数字だけでは検出ミスに気づけないので、**検出結果を絵に重ねた画像**と、**並べた時の見え方**
も書き出す。目で見るのはこの2枚。

    python3 tools/assets/check_machine_module.py assets/mach-sheets/_module_pirate.png
    python3 tools/assets/check_machine_module.py <raw.png> --out preview/mach-check

見るもの(値は型 make_machine_shell.py の定数と同じ出どころ):

  接地菱形の比      0.500 ちょうど      ずれは cut_machines が縦を潰して直すが、
                                        0.60 を超えると角度自体が違う → 不採用
  垂れ下がり        0                   接地菱形より下に画素があると、ゲームが機械を
                                        持ち上げて置く。脚・シュート・影は不採用
  横のはみ出し      0                   菱形より横に出ると、並べた時に隣とぶつかる
  総高 / 菱形幅     0.85 前後(<1.05)    塔になっていないか
  側面高 / 菱形幅   0.35 前後           低い箱か
  ホッパー          1つ・天面の中央     素材アイコンはここに乗る。中心がずれると全サイズずれる
"""
import argparse
import os
import sys
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from make_machine_shell import BODY, HOP, SIZE, geom            # noqa: E402  型の定数

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

RATIO_WANT = 0.5            # 接地菱形 高さ/幅（厳密な 2:1）
RATIO_MAX = 0.60            # これを超えたらアイソメ角が違う
# 採用済み32枚の実測では、垂れ下がりは 0.005〜0.008 が「無い」状態（角の推定と
# アンチエイリアスの分だけ必ず出る）。本当に垂れているものは 0.016 以上に跳ねる。
DROP_MAX = 0.012            # 垂れ下がりの許容（菱形幅に対する比）
SIDE_MAX = 0.008            # 横はみ出しの許容
TALL_MAX = 1.05             # 総高/菱形幅 の上限
BODY_TOL = 0.05             # 側面の高さ/菱形幅 の許容幅(型 BODY からの差)。箱が高いと別物になる
SIZE_WANT, SIZE_TOL = 0.90, 0.06   # 菱形幅/画像幅。型と同じ大きさで塗られているか
# ホッパー中心の、型が言う位置からのずれ(菱形幅に対する比)。型どおりに塗れていれば 0.03 以下。
# 口が持ち上がった漏斗(旧モジュール)は y のぶん 0.07〜0.11 出るので、そこは通す。
HOP_OFF_MAX = 0.12


def key_out(im):
    """縁からの flood fill でマゼンタ背景を抜く（内部の紫っぽい塗りは守る）"""
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
    return Image.fromarray(out, 'RGBA')


def base_diamond(op):
    """接地菱形の (xL,yL, xR,yR, xF,yB)。下から4割の帯だけを見る（cut_machines と同じ）。

    絵全体で最左/最右を取ると、上物のはみ出し1画素で角が大きくずれる。"""
    h, w = op.shape
    ys = [y for y in range(h) if op[y].any()]
    yT, yB = ys[0], ys[-1]
    y0 = max(0, int(yB - 0.4 * (yB - yT)))
    band = op[y0:yB + 1]
    xs = [x for x in range(w) if band[:, x].any()]
    xL, xR = xs[0], xs[-1]
    yL = y0 + int(np.nonzero(band[:, xL])[0][-1])
    yR = y0 + int(np.nonzero(band[:, xR])[0][-1])
    row = np.nonzero(op[yB])[0]
    return xL, yL, xR, yR, float(row.mean()), yB, yT


def hopper(im, op, exp, dw):
    """天面のホッパーの口。型が言う位置(exp)のまわりだけを探す。

    「上半分の暗い塊のうち最大」では、筐体が暗いテーマ(タール塗りの船体など)で
    側面を拾ってしまう。口の位置は型で決まっているので、そこを見ればよい。"""
    a = np.asarray(im.convert('RGBA')).astype(int)
    h, w = op.shape
    # 口は「いちばん暗い所」。暗い筐体(タール塗り・暗紫)だと緩いしきい値で筐体と繋がって
    # 重心が落ちるので、厳しい方から順に試して最初に見つかった塊を採る。
    mx = a[:, :, :3].max(axis=2)
    x0, x1 = int(exp[0] - 0.30 * dw), int(exp[0] + 0.30 * dw)
    y0, y1 = int(exp[1] - 0.16 * dw), int(exp[1] + 0.16 * dw)
    m = np.zeros(op.shape, bool)
    m[max(0, y0):min(h, y1), max(0, x0):min(w, x1)] = True
    dark = op & m & (mx < 40)
    for th in (60, 90):                 # 窓の中で見つからなければ緩める
        if dark.any():
            break
        dark = op & m & (mx < th)
    seen = np.zeros_like(dark)
    best = None
    for y in range(h):
        for x in range(w):
            if not dark[y, x] or seen[y, x]:
                continue
            q, cells = deque([(x, y)]), []
            seen[y, x] = True
            while q:
                cx, cy = q.popleft(); cells.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and dark[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True; q.append((nx, ny))
            if best is None or len(cells) > len(best):
                best = cells
    if not best or len(best) < 0.001 * w * h:
        return None, 0
    xs = [c[0] for c in best]; ys = [c[1] for c in best]
    return (float(np.mean(xs)), float(np.mean(ys))), len(best)


def tiled(im, op, n_max=5):
    """1マスモジュールを並べて見せる。cut_machines の module_fit と同じ手順。"""
    xL, yL, xR, yR, xF, yB, _yT = base_diamond(op)
    dw = xR - xL + 1
    dh = (yB - yL) + (yB - yR)
    vs = (dw / 2) / max(1.0, dh)                       # 縦を潰して 2:1 にする
    mod = im.resize((im.width, max(1, round(im.height * vs))), Image.LANCZOS)
    sx, sy = dw / 2, dw / 4
    shots = []
    for n in (2, 3, 5):
        offs = [(round(sx * i), round(sy * i)) for i in range(n)]
        cw, ch = mod.width + offs[-1][0], mod.height + offs[-1][1]
        c = Image.new('RGBA', (cw, ch), (0, 0, 0, 0))
        for dx, dy in offs:
            c.alpha_composite(mod, (dx, dy))
        shots.append(c.crop(c.getbbox() or (0, 0, cw, ch)))
    pad = 24
    W = max(s.width for s in shots) + pad * 2
    H = sum(s.height for s in shots) + pad * (len(shots) + 1)
    sheet = Image.new('RGB', (W, H), (0x12, 0x0e, 0x1c))
    y = pad
    for s in shots:
        sheet.paste(s, (pad, y), s); y += s.height + pad
    return sheet


def check(path, out_dir):
    im = key_out(Image.open(path))
    op = np.asarray(im)[:, :, 3] > 128
    if not op.any():
        print('!! マゼンタを抜いたら何も残りませんでした（背景がマゼンタでない）'); return False
    h, w = op.shape
    xL, yL, xR, yR, xF, yB, yT = base_diamond(op)
    dw = xR - xL + 1
    dh = (yB - yL) + (yB - yR)
    ratio = dh / dw

    # 接地菱形の手前2辺より下に出ている画素 = 垂れ下がり
    ys, xs = np.nonzero(op)
    left = xs <= xF
    gy = np.where(left,
                  yL + (xs - xL) * (yB - yL) / max(1e-6, xF - xL),
                  yB + (xs - xF) * (yR - yB) / max(1e-6, xR - xF))
    drop = float(max(0.0, (ys - gy).max())) if len(ys) else 0.0

    # 横のはみ出し（絵全体の左右端 vs 接地菱形の左右端）
    all_x = [x for x in range(w) if op[:, x].any()]
    over = max(xL - all_x[0], all_x[-1] - xR)

    body = 0
    col = np.nonzero(op[:, min(w - 1, xL + 3)])[0]
    if len(col):
        body = col[-1] - col[0]
    tall = (yB - yT) / dw
    # 型が言うホッパーの位置: 接地菱形の中心の真上、側面の高さぶん上がった天面の中心
    exp = ((xL + xR) / 2, yB - dw * (0.25 + BODY))
    hc, harea = hopper(im, op, exp, dw)
    hop_off = (abs(hc[0] - exp[0]) + abs(hc[1] - exp[1])) / dw if hc else None
    hop_d = 2 * (harea / np.pi * 2) ** 0.5 / dw if hc else 0   # 2:1楕円の面積から長径を逆算

    ok = True

    def line(label, val, good, note=''):
        nonlocal ok
        ok = ok and good
        print(f'  {"OK " if good else "NG "} {label:<16}{val:<22}{note}')

    print(f'== {os.path.basename(path)}  {w}x{h}   接地菱形 {dw}x{dh:.0f}px')
    line('菱形の比', f'{ratio:.3f}  (型 {RATIO_WANT})', ratio <= RATIO_MAX,
         '縦を潰して補正する' if abs(ratio - RATIO_WANT) > 0.01 else '')
    line('垂れ下がり', f'{drop:.1f}px  ({drop / dw:.3f})', drop / dw <= DROP_MAX,
         '' if drop / dw <= DROP_MAX else '脚・シュート・影が接地菱形より下に出ている')
    line('横はみ出し', f'{over}px  ({over / dw:.3f})', over / dw <= SIDE_MAX,
         '' if over / dw <= SIDE_MAX else '並べた時に隣のマスへ食い込む')
    line('総高/菱形幅', f'{tall:.3f}  (型 {BODY + 0.5:.3f})', tall <= TALL_MAX,
         '' if tall <= TALL_MAX else '塔になっている')
    line('側面高/菱形幅', f'{body / dw:.3f}  (型 {BODY})', abs(body / dw - BODY) <= BODY_TOL,
         '' if abs(body / dw - BODY) <= BODY_TOL else '箱の高さが型と違う(低い箱になっていない)')
    line('大きさ(菱形/画像)', f'{dw / w:.3f}  (型 {SIZE_WANT})', abs(dw / w - SIZE_WANT) <= SIZE_TOL,
         '' if abs(dw / w - SIZE_WANT) <= SIZE_TOL else '型と違う大きさで塗られている')
    if hc is None:
        # 温泉の湯のように口が暗くないテーマ。cut_machines も同じく型の幾何から出すので不合格にしない
        line('ホッパー', '色では拾えず', True, '口が暗くない。位置は型の幾何から出す(温泉など)')
    else:
        line('ホッパー', f'中心ずれ {hop_off:.3f} / 径 {hop_d:.2f}  (型 {HOP})',
             hop_off <= HOP_OFF_MAX, '' if hop_off <= HOP_OFF_MAX else '天面の中央から外れている')

    # --- 検出点を重ねた絵と、並べた絵
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(path))[0]
    ov = Image.new('RGB', (w, h), (0x12, 0x0e, 0x1c))
    ov.paste(im, (0, 0), im)
    d = ImageDraw.Draw(ov)
    wd = max(1, round(w / 340))
    d.line([(xL, yL), (xF, yB), (xR, yR)], fill=(0xff, 0x3d, 0xa6), width=wd)      # 実測の接地
    d.line([(xL, yL), (xF, yL - (yB - yL)), (xR, yR)], fill=(0xff, 0x3d, 0xa6), width=wd)
    ideal = dw / 4
    d.line([(xL, yB - ideal), (xF, yB), (xR, yB - ideal)],
           fill=(0xff, 0xd2, 0x4a), width=wd)                                      # 厳密2:1
    r = dw * HOP / 2
    d.ellipse((exp[0] - r, exp[1] - r / 2, exp[0] + r, exp[1] + r / 2),
              fill=None, outline=(0xff, 0xd2, 0x4a), width=wd)          # 型が言う口の位置
    if hc:
        d.ellipse((hc[0] - 6 * wd, hc[1] - 3 * wd, hc[0] + 6 * wd, hc[1] + 3 * wd),
                  outline=(0x6e, 0xe6, 0xff), width=wd)                 # 実測の口の中心
        d.line([((xL + xR) / 2, 0), ((xL + xR) / 2, h)], fill=(0x6e, 0xe6, 0xff), width=1)
    p1 = os.path.join(out_dir, f'{base}-check.png'); ov.save(p1)
    p2 = os.path.join(out_dir, f'{base}-tiled.png'); tiled(im, op).save(p2)
    print(f'  検出点: {p1}\n  並べた絵: {p2}')
    print('  ' + ('→ 合格。cut_machines.py に流してよい' if ok else '→ 不採用。作り直しを依頼する'))
    return ok


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('paths', nargs='+')
    ap.add_argument('--out', default=os.path.join(ROOT, 'preview', 'mach-check'))
    a = ap.parse_args()
    good = all([check(p, a.out) for p in a.paths])
    sys.exit(0 if good else 1)

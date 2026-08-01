#!/usr/bin/env python3
"""Stitch生成の製造機シート(2x2・マゼンタ背景)を1台ずつ切り出し、ゲームの表示サイズへ焼く。

    使い方: python3 tools/cut_machines.py

入力 : assets/mach-sheets/<theme>.png   … 左上から 2/3/4/5 マス機の順(2x2)
出力 : assets/mach-<theme>-s<N>.png     … 透過PNG・ゲーム内の表示幅ちょうど
       assets/mach-fit.json             … 素材ごとのスロット中心(スプライト幅/高さに対する比)

なぜ mach-fit.json が要るか:
  絵の筐体の比率は、ゲーム側で計算する占有外周の比率とぴったりは一致しない。
  スロット位置を計算で出すと素材アイコンが絵の穴からズレるので、絵から実測して持たせる。

なぜ表示幅まで縮小するか:
  Phaser は pixelArt:true (NEAREST) なので、245px の素材を 155px で描くとピクセルが
  間引かれて描き込みが壊れる。あらかじめ LANCZOS で表示幅へ落としておけば ほぼ 1:1 で描ける。

表示幅は game/main.js の定数から算出する(二重管理を避けるため):
  占有マスの外周(inset込み)を画面へ射影した bbox の幅 = スプライトの幅
"""
import os, re, math, itertools
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, 'assets', 'mach-sheets')
OUT = os.path.join(ROOT, 'assets')
SIZES = [2, 3, 4, 5]          # 左上→右上→左下→右下
COLS, ROWS = 2, 2
ERODE = 1                     # マゼンタのハロー除去(alpha収縮 px)


def main_js_consts():
    """game/main.js から W,H,GU,GV,ISO,MACH_GEO.inset を読む"""
    src = open(os.path.join(ROOT, 'game', 'main.js'), encoding='utf-8').read()
    m = re.search(r'const W = (\d+), H = (\d+), GU = (\d+), GV = (\d+)', src)
    W, H, GU, GV = map(int, m.groups())
    iso = dict(re.findall(r'(Bx|By|ux|uy|vx|vy):\s*(-?[\d.]+)', src)[:6])
    iso = {k: float(v) for k, v in iso.items()}
    inset = float(re.search(r'MACH_GEO = \{ inset:([\d.]+)', src).group(1))
    return W, H, GU, GV, iso, inset


def target_width(n, W, H, GU, GV, iso, IN):
    """u方向にNマス並べたときの、占有外周の画面bbox幅(px)"""
    du_u = (n - 2 * IN) / GU          # u方向の伸び
    dv_v = (1 - 2 * IN) / GV          # v方向の幅
    return abs(du_u * iso['ux'] * W) + abs(dv_v * iso['vx'] * W)


def is_magenta(px):
    r, g, b = px[0], px[1], px[2]
    return r > 150 and b > 150 and g < 110 and (r - g) > 60 and (b - g) > 60


def key_out(im):
    """縁からflood fillでマゼンタ背景を抜く(内部の紫っぽい塗りは守る)"""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    seen = [[False] * h for _ in range(w)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_magenta(px[x, y]) and not seen[x][y]:
                seen[x][y] = True; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_magenta(px[x, y]) and not seen[x][y]:
                seen[x][y] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and is_magenta(px[nx, ny]):
                seen[nx][ny] = True; q.append((nx, ny))
    # ハロー除去: 透明に隣接する半端なマゼンタ寄りピクセルを削る
    for _ in range(ERODE):
        drop = []
        for x in range(w):
            for y in range(h):
                if px[x, y][3] == 0:
                    continue
                if any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0
                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    r, g, b, _a = px[x, y]
                    if r > 120 and b > 120 and g < 130 and (r - g) > 35 and (b - g) > 35:
                        drop.append((x, y))
        for x, y in drop:
            px[x, y] = (0, 0, 0, 0)
    return im


def slot_centers(sp, n):
    """スプライトから凹みスロットの中心を実測する。
    穴は「面積のある暗い塊」。輪郭線と区別するため収縮して残るものだけを拾う。"""
    w, h = sp.size
    px = sp.load()
    dark = [[False] * h for _ in range(w)]
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a > 128 and (r + g + b) / 3 < 78:
                dark[x][y] = True
    # 収縮(4近傍) x2 : 細い輪郭線を消し、面のある穴だけ残す
    core = dark
    for _ in range(2):
        nxt = [[False] * h for _ in range(w)]
        for x in range(1, w - 1):
            for y in range(1, h - 1):
                if core[x][y] and core[x-1][y] and core[x+1][y] and core[x][y-1] and core[x][y+1]:
                    nxt[x][y] = True
        core = nxt
    # 連結成分
    seen = [[False] * h for _ in range(w)]
    comps = []
    for x in range(w):
        for y in range(h):
            if not core[x][y] or seen[x][y]:
                continue
            q = deque([(x, y)]); seen[x][y] = True; pts = []
            while q:
                cx, cy = q.popleft(); pts.append((cx, cy))
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = cx+dx, cy+dy
                    if 0 <= nx < w and 0 <= ny < h and core[nx][ny] and not seen[nx][ny]:
                        seen[nx][ny] = True; q.append((nx, ny))
            comps.append(pts)
    comps.sort(key=len, reverse=True)
    cand = comps[:n + 4]               # 端のコントロールパネル等、穴でない暗部も混じる
    if len(cand) < n:
        return None
    info = [((sum(p[0] for p in c) / len(c), sum(p[1] for p in c) / len(c)), len(c)) for c in cand]

    def score(sub):
        """スロットは『等間隔・一直線・同じ大きさ』に並ぶ。そこからの外れ具合を測る"""
        sub = sorted(sub, key=lambda t: t[0][0])
        xs = [t[0][0] for t in sub]; ys = [t[0][1] for t in sub]; ar = [t[1] for t in sub]
        if n == 1:
            return 0.0
        gaps = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
        if min(gaps) <= 1:
            return 1e9
        gm = sum(gaps) / len(gaps)
        even = sum((g - gm) ** 2 for g in gaps) / len(gaps) / (gm * gm)      # 等間隔か
        # 直線か: 端点を結ぶ直線からの残差
        x0, y0, x1, y1 = xs[0], ys[0], xs[-1], ys[-1]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1
        line = sum(abs((xs[i]-x0)*dy - (ys[i]-y0)*dx) / L for i in range(len(xs))) / len(xs) / max(1, gm)
        am = sum(ar) / len(ar)
        size = sum(abs(a - am) for a in ar) / len(ar) / am                   # 同じ大きさか
        return even * 3 + line * 3 + size

    best, bs = None, 1e18
    for sub in itertools.combinations(info, n):
        v = score(list(sub))
        if v < bs:
            bs, best = v, list(sub)
    cs = sorted([t[0] for t in best], key=lambda c: c[0])   # 左(奥)→右(手前)= u方向の並び
    return cs


def main():
    W, H, GU, GV, iso, IN = main_js_consts()
    fit = {}
    for f in sorted(os.listdir(SHEETS)):
        if not f.lower().endswith('.png'):
            continue
        theme = os.path.splitext(f)[0]
        sheet = key_out(Image.open(os.path.join(SHEETS, f)))
        sw, sh = sheet.size
        print(f'== {f} ({sw}x{sh})')
        for i, n in enumerate(SIZES):
            cx, cy = i % COLS, i // COLS
            quad = sheet.crop((cx * sw // COLS, cy * sh // ROWS,
                               (cx + 1) * sw // COLS, (cy + 1) * sh // ROWS))
            bb = quad.getbbox()
            if not bb:
                print(f'   s{n}: 中身なし・スキップ'); continue
            sp = quad.crop(bb)
            tw = target_width(n, W, H, GU, GV, iso, IN)
            th = max(1, round(sp.height * tw / sp.width))
            out = sp.resize((round(tw), th), Image.LANCZOS)
            path = os.path.join(OUT, f'mach-{theme}-s{n}.png')
            out.save(path)
            cs = slot_centers(out, n)
            if cs:
                fit.setdefault(theme, {})[str(n)] = [[round(x / out.width, 4), round(y / out.height, 4)] for x, y in cs]
                gap = (cs[-1][0] - cs[0][0]) / (n - 1)
                note = f'スロット{n}個 検出 (間隔 {gap:.1f}px)'
            else:
                note = f'!! スロット検出に失敗({n}個見つからず) → 計算位置で描画'
            pitch = sp.width / n      # 素材側の1マスあたりの幅(整合の目安)
            print(f'   s{n}: 原寸 {sp.width}x{sp.height} (1マス={pitch:.0f}px) '
                  f'→ {out.width}x{out.height}  {note}')


    import json
    with open(os.path.join(OUT, 'mach-fit.json'), 'w', encoding='utf-8') as fp:
        json.dump(fit, fp, ensure_ascii=False, indent=1)
    print('\nwrote assets/mach-fit.json')


if __name__ == '__main__':
    main()

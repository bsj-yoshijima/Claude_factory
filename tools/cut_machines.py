#!/usr/bin/env python3
"""Stitch生成の製造機シート(マゼンタ背景・4台)を1台ずつ切り出し、ゲームの座標系へ焼く。

    使い方: python3 tools/cut_machines.py

入力 : assets/mach-sheets/<theme>.png   … 2/3/4/5 マス機が4台。並びは 2x2 でも縦1列でもよい
出力 : assets/mach-<theme>-s<N>.png     … 透過PNG。1マスの送りがゲームの1マスと一致する大きさ
       assets/mach-fit.json             … 素材アイコンを絵の投入口に乗せるためのアンカー

較正の考え方（ここが肝）:
  4台は「同じ機械の長さ違い」なので、1マスの送り(隣り合う投入口の中心間距離)は4台とも同じはず。
  ところが生成された絵は毎回、長い台ほど送りを詰めてくる(実測 43.7→40.6→38.1→36.9px, ±9.6%)。

  そこで **投入口を検出して送りを実測し、テーマ全体で1つの倍率**
  (ゲームの送り ÷ 実測の送りの中央値) を4台すべてに等倍でかける。
  サイズごとに違う倍率をかけると「サイズごとにデザインの見え方が変わる」ので絶対にやらない。
  残る ±9.6% のばらつきは、2マス機がやや大きめ・5マス機がやや小さめに見える程度で吸収する。

  絵の長軸が「右斜め上」向き(送りのdyが負)なら、切り出し時に左右反転して
  ゲームが基準とする「右斜め下」向きに揃える。もう一方の対角はゲーム側が更に反転して使う。

なぜゲームの表示サイズまで縮小するか:
  Phaser は pixelArt:true (NEAREST) なので、大きい素材を縮めて描くとピクセルが間引かれて
  描き込みが壊れる。あらかじめ LANCZOS で表示サイズへ落としておけば ほぼ 1:1 で描ける。
"""
import os, re, math, itertools
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, 'assets', 'mach-sheets')
OUT = os.path.join(ROOT, 'assets')
SIZES = [2, 3, 4, 5]          # 幅の小さい順に割り当てる
ERODE = 1                     # マゼンタのハロー除去(alpha収縮 px)
MIN_AREA = 2000               # これ未満の連結成分はゴミとして捨てる

# 投入口(素材を置く場所)の色。テーマごとに違うので判定を持たせる。
# 未登録のテーマは較正できないので、従来どおり幅合わせにフォールバックする。
SPOT_TEST = {
    'halloween': lambda p: p[3] > 128 and max(p[:3]) < 60,                                                    # ホッパーの暗い口
    'onsen':     lambda p: p[3] > 128 and p[1] > 140 and p[2] > 140 and p[0] < 170 and p[1]-p[0] > 25,        # 湯(ターコイズ)
}
SPOT_MIN_AREA = 120


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


def split_machines(sheet):
    """シートから機械を4台切り出す。並び(2x2 / 縦1列)に依存しないよう連結成分で拾う。
    ゴミを捨てて面積上位4つを取り、幅の小さい順に返す(= 2,3,4,5 マス機の順)。"""
    w, h = sheet.size
    px = sheet.load()
    seen = [[False] * h for _ in range(w)]
    boxes = []
    for x in range(w):
        for y in range(h):
            if seen[x][y] or px[x, y][3] == 0:
                continue
            q = deque([(x, y)]); seen[x][y] = True
            x0 = x1 = x; y0 = y1 = y; area = 0
            while q:
                cx, cy = q.popleft(); area += 1
                if cx < x0: x0 = cx
                if cx > x1: x1 = cx
                if cy < y0: y0 = cy
                if cy > y1: y1 = cy
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and px[nx, ny][3] != 0:
                            seen[nx][ny] = True; q.append((nx, ny))
            if area >= MIN_AREA:
                boxes.append((area, (x0, y0, x1 + 1, y1 + 1)))
    boxes.sort(key=lambda b: -b[0])
    picks = [b[1] for b in boxes[:len(SIZES)]]
    picks.sort(key=lambda bb: bb[2] - bb[0])       # 幅の小さい順 = 2,3,4,5 マス
    return picks


def _unused_slot_centers(sp, n):
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


def target_height(n, W, H, GU, GV, iso, IN):
    """u方向にNマス並べたときの、占有外周の画面bbox高さ(px)。筐体の高さは含まない"""
    return abs((n - 2 * IN) / GU * iso['uy'] * H) + abs((1 - 2 * IN) / GV * iso['vy'] * H)


MAX_WARP = 0.15   # 縦の歪みがこれを超えたら警告(背の高い意匠を潰している可能性)


def spot_blobs(sp, test):
    """投入口の候補を連結成分で拾う。((cx,cy), area) のリスト"""
    w, h = sp.size
    px = sp.load()
    seen = [[False] * h for _ in range(w)]
    out = []
    for x in range(w):
        for y in range(h):
            if seen[x][y] or not test(px[x, y]):
                continue
            q = deque([(x, y)]); seen[x][y] = True; pts = []
            while q:
                cx, cy = q.popleft(); pts.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and test(px[nx, ny]):
                        seen[nx][ny] = True; q.append((nx, ny))
            if len(pts) >= SPOT_MIN_AREA:
                xs = [q0[0] for q0 in pts]; ys = [q0[1] for q0 in pts]
                out.append(((sum(xs) / len(xs), sum(ys) / len(ys)), len(pts)))
    return out


def pick_spots(cands, n):
    """候補から「等間隔・一直線・同じ大きさ」に最も近い n 個を選ぶ(装飾の誤検出を落とす)"""
    if len(cands) < n:
        return None
    if n == 1:
        return [max(cands, key=lambda t: t[1])]
    best, bv = None, 1e18
    for sub in itertools.combinations(cands, n):
        sub = sorted(sub, key=lambda t: t[0][0])
        xs = [t[0][0] for t in sub]; ys = [t[0][1] for t in sub]; ar = [t[1] for t in sub]
        g = [xs[i + 1] - xs[i] for i in range(n - 1)]
        if min(g) <= 2:
            continue
        gm = sum(g) / len(g)
        even = sum((q - gm) ** 2 for q in g) / len(g) / (gm * gm)
        x0, y0, x1, y1 = xs[0], ys[0], xs[-1], ys[-1]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1
        line = sum(abs((xs[i] - x0) * dy - (ys[i] - y0) * dx) / L for i in range(n)) / n / max(1, gm)
        am = sum(ar) / len(ar)
        size = sum(abs(a - am) for a in ar) / len(ar) / am
        v = even * 3 + line * 3 + size
        if v < bv:
            bv, best = v, sub
    return best


def main():
    import json
    W, H, GU, GV, iso, IN = main_js_consts()
    step_x = abs(iso['ux'] * W / GU)      # ゲームの1マス送り(u方向)
    step_y = abs(iso['uy'] * H / GU)
    fit = {}
    for f in sorted(os.listdir(SHEETS)):
        if not f.lower().endswith('.png'):
            continue
        theme = os.path.splitext(f)[0]
        sheet = key_out(Image.open(os.path.join(SHEETS, f)))
        print(f'== {f} ({sheet.width}x{sheet.height})')
        picks = split_machines(sheet)
        if len(picks) < len(SIZES):
            print(f'   !! 機械を{len(picks)}台しか検出できませんでした(4台必要)。スキップ'); continue
        test = SPOT_TEST.get(theme)

        # 1周目: 投入口を検出して、各台の送りを測る
        found = []
        for n, bb in zip(SIZES, picks):
            sp = sheet.crop(bb)
            spots = pick_spots(spot_blobs(sp, test), n) if test else None
            found.append((n, sp, spots))
        measured = [( (s[-1][0][0]-s[0][0][0])/(n-1), (s[-1][0][1]-s[0][0][1])/(n-1) )
                    for n, _, s in found if s and n > 1]
        if len(measured) < 2:
            print('   !! 投入口を検出できないテーマなので、従来の幅合わせにフォールバック')
            legacy_fit(theme, found, W, H, GU, GV, iso, IN)
            continue

        # 絵の長軸が「右斜め上」向き(dyが負)なら左右反転して「右斜め下」に揃える
        flip = (sum(m[1] for m in measured) / len(measured)) < 0
        dxs = sorted(abs(m[0]) for m in measured)
        med = dxs[len(dxs) // 2]                       # 送りの中央値
        scale = step_x / med                            # テーマ全体で1つの倍率(等倍)
        spread = (max(dxs) - min(dxs)) / med * 100
        print(f'   投入口の送り: {[round(abs(m[0]),1) for m in measured]} (ばらつき ±{spread:.1f}%)'
              f' / 中央値 {med:.1f}px → 倍率 {scale:.3f}{"  ※左右反転" if flip else ""}')

        for n, sp, spots in found:
            if flip:
                sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
                spots = [((sp.width - 1 - c[0][0], c[0][1]), c[1]) for c in spots][::-1] if spots else None
            ow, oh = max(1, round(sp.width * scale)), max(1, round(sp.height * scale))
            out = sp.resize((ow, oh), Image.LANCZOS)
            out.save(os.path.join(OUT, f'mach-{theme}-s{n}.png'))
            if spots:
                ax = spots[0][0][0] * scale / ow
                ay = spots[0][0][1] * scale / oh
                fit.setdefault(theme, {})[str(n)] = {'ax': round(ax, 4), 'ay': round(ay, 4)}
                got = abs(spots[-1][0][0] - spots[0][0][0]) / (n - 1) * scale if n > 1 else step_x
                print(f'   s{n}: {sp.width}x{sp.height} → {ow}x{oh}  送り {got:.1f}px (目標 {step_x:.1f})'
                      f'  アンカー ({ax:.3f}, {ay:.3f})')
            else:
                print(f'   s{n}: {sp.width}x{sp.height} → {ow}x{oh}  !! 投入口を検出できずアンカーなし')

    with open(os.path.join(OUT, 'mach-fit.json'), 'w', encoding='utf-8') as fp:
        json.dump(fit, fp, ensure_ascii=False, indent=1)
    print('\nwrote assets/mach-fit.json')


def legacy_fit(theme, found, W, H, GU, GV, iso, IN):
    """投入口を検出できないテーマ用。占有外周の幅に合わせ、筐体高を4台で揃える従来方式"""
    cut = []
    for n, sp, _ in found:
        tw = target_width(n, W, H, GU, GV, iso, IN)
        fh = target_height(n, W, H, GU, GV, iso, IN)
        cut.append((n, sp, tw, fh, sp.height * tw / sp.width - fh))
    bodies = sorted(c[4] for c in cut)
    body = bodies[len(bodies) // 2]
    print(f'   共通の筐体高 = {body:.1f}px (実測 {", ".join(f"{c[4]:.0f}" for c in cut)})')
    for n, sp, tw, fh, b in cut:
        th = fh + body
        warp = th / (fh + b) - 1
        out = sp.resize((round(tw), round(th)), Image.LANCZOS)
        out.save(os.path.join(OUT, f'mach-{theme}-s{n}.png'))
        flag = '  !! 縦の歪みが大きい' if abs(warp) > MAX_WARP else ''
        print(f'   s{n}: → {out.width}x{out.height}  筐体 {b:.0f}→{body:.0f}px  縦{warp*100:+.1f}%{flag}')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Stitch生成の製造機シート(マゼンタ背景・4台)から、3/4/5マス機を「2マス機の絵」で合成する。

    使い方: python3 tools/cut_machines.py

入力 : assets/mach-sheets/<theme>.png   … 2/3/4/5 マス機が4台。並びは 2x2 でも縦1列でもよい
出力 : assets/mach-<theme>-s<N>.png     … 透過PNG。1マスの送りがゲームの1マスと一致する大きさ
       assets/mach-fit.json             … 素材アイコンを絵の投入口に乗せるためのアンカー

なぜ合成するのか:
  4台は「同じ機械の長さ違い」なので1マスの送りは4台とも同じはず。ところが生成AIは
  何度指示しても長い台ほどマスを詰めてくる(halloween ±13%, scifi ±57%)。4台とも全体幅を
  同じにしようとするためで、生成のやり直しでは直らない。

  そこで **2マス機の絵1枚だけを正とし、そこから1ベイ(1マスぶんの区画)を取り出して
  繰り返す**。送りは定義上ぴったり一定になり、デザインも4サイズで完全に同一になる。
  シートの3/4/5マス機は使わない(ログに実測値を出すだけ)。

合成の手順:
  1. シートから2マス機を切り出す。長軸が「右斜め上」なら左右反転してゲームの「右斜め下」に揃える。
  2. 1ベイの周期ベクトルをテンプレートマッチで実測する(投入口の重心はホッパーの大きさの差で
     偏るので使わない)。得た周期 (Dx,Dy) を、ゲームのアイソメ比 uy/ux に合うよう
     Py=round(Dx*比) へ **列ごとの縦シフト(せん断)** で直す。垂直線は垂直のまま保たれ、
     Py-Dy が整数なので絵の周期性も厳密に保たれる。
  3. **画面上の縦線 x=c で切る**。機械は (Dx,Py) で右下へ伸びるので、幅 Dx の縦帯 1 本が
     ちょうど「ベイ1つぶんの列」(投入口・天面・前面が同じ列に乗る)になる。
     アイソメの斜線で切るとホッパーや煙突のような背の高い部分が別の帯へずれて穴が空く。
  4. Nマス機 = [x<=c の奥側] + [縦帯を N-2 回] + [x>c の手前側を (N-2)*(Dx,Py) ずらす]。
     ずらし量が整数なので補間は起きない(各領域は元絵の純粋な平行移動)。
  5. 繰り返す縦帯からは端の飾り(煙突・煙・歯車)を消す。1ベイ隣に同じ絵が無い画素を飾りと見なし、
     「1ベイ隣の同じ相対位置」の絵で置き換える。奥側の飾りは前方から、手前側の飾りは後方から借りる。

なぜゲームの表示サイズまで縮小するか:
  Phaser は pixelArt:true (NEAREST) なので、大きい素材を縮めて描くとピクセルが間引かれて
  描き込みが壊れる。あらかじめ LANCZOS で表示サイズへ落としておけば ほぼ 1:1 で描ける。

投入口を検出できないテーマ(normal / arabia / diner)は、従来の幅合わせ(legacy_fit)のまま。
"""
import os, re, math, itertools
from collections import deque
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEETS = os.path.join(ROOT, 'assets', 'mach-sheets')
OUT = os.path.join(ROOT, 'assets')
SIZES = [2, 3, 4, 5]          # 幅の小さい順に割り当てる
ERODE = 2                     # マゼンタのハロー除去(alpha収縮 px)。帆綱のような細い線の縁に残る
MIN_AREA = 2000               # これ未満の連結成分はゴミとして捨てる

# 投入口(素材を置く場所)の色。テーマごとに違うので判定を持たせる。
# 未登録のテーマは較正できないので、従来どおり幅合わせにフォールバックする。
SPOT_TEST = {
    'halloween': lambda p: p[3] > 128 and max(p[:3]) < 60,                                                    # ホッパーの暗い口
    'scifi':     lambda p: p[3] > 128 and max(p[:3]) < 70,                                                    # 吸気リングの暗い口
    'egypt':     lambda p: p[3] > 128 and 190 < p[0] < 232 and 118 < p[1] < 158 and p[2] < 45,                 # 漏斗の内側(琥珀)
    'western':   lambda p: p[3] > 128 and max(p[:3]) < 45,                                                    # 漏斗の黒い口(影と繋がるので暗めに)
    'onsen':     lambda p: p[3] > 128 and p[0] > 170 and p[2] > p[0] + 8,                                      # 乳白色の湯(青みがある)
    'japan':     lambda p: p[3] > 128 and 45 < max(p[:3]) < 100 and max(p[:3]) - min(p[:3]) < 30,              # 黒鉄プレート(灰)
    'pirate':    lambda p: p[3] > 128 and max(p[:3]) < 28,                                                    # 真鍮輪の黒い内側
    'steampunk': lambda p: p[3] > 128 and max(p[:3]) < 28,                                                    # 真鍮襟の黒い内側
    'dwarf':     lambda p: p[3] > 128 and max(p[:3]) < 45,                                                    # 鍛鉄襟の暗い内側
}
SPOT_MIN_AREA = 120
SPOT_FILL = 0.40            # 塊が外接矩形をどれだけ埋めていれば「面」と見なすか(輪郭線を落とす)
SPOT_ASPECT = (1.05, 4.6)   # 2:1アイソメなので投入口は横長。縦長の塊は投入口ではない

# 投入口は必ず筐体の上側にある。下部の影を誤検出しないよう、bboxの上から何割までを見るか。
SPOT_TOP = {'western': 0.62}


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
    # 縁から届かない「囲まれたマゼンタ」(帆と帆柱の隙間など)も抜く。
    # プロンプトでマゼンタは背景専用と縛っているので、意匠の色と衝突しない。
    for x in range(w):
        for y in range(h):
            if px[x, y][3] and is_magenta(px[x, y]):
                px[x, y] = (0, 0, 0, 0)
    # フリンジ除去: 背景に接した「マゼンタ寄り」の画素を、隣の正しい色で塗り替える。
    # 消すだけだと帆綱のような細い線がピンクのまま残る/穴になるので、色を借りて直す。
    # 内部の紫の意匠には触らない(透明に接している画素だけが対象)。
    def fringe(p):
        r, g, b = p[0], p[1], p[2]
        return r > 120 and b > 120 and g < 130 and (r - g) > 35 and (b - g) > 35
    for _ in range(ERODE):
        fix = []
        for x in range(w):
            for y in range(h):
                if px[x, y][3] == 0 or not fringe(px[x, y]):
                    continue
                near = [(x + dx, y + dy) for dx in (-1, 0, 1) for dy in (-1, 0, 1)]
                if not any(0 <= a < w and 0 <= b2 < h and px[a, b2][3] == 0 for a, b2 in near):
                    continue                                   # 背景に接していない = 意匠の紫
                good = [px[a, b2] for a, b2 in near
                        if 0 <= a < w and 0 <= b2 < h and px[a, b2][3] and not fringe(px[a, b2])]
                fix.append((x, y, tuple(sum(c[i] for c in good) // len(good) for i in range(3)) + (255,)
                            if good else (0, 0, 0, 0)))
        for x, y, v in fix:
            px[x, y] = v
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


def target_height(n, W, H, GU, GV, iso, IN):
    """u方向にNマス並べたときの、占有外周の画面bbox高さ(px)。筐体の高さは含まない"""
    return abs((n - 2 * IN) / GU * iso['uy'] * H) + abs((1 - 2 * IN) / GV * iso['vy'] * H)


MAX_WARP = 0.15   # 縦の歪みがこれを超えたら警告(背の高い意匠を潰している可能性)


TAIL = 0.25   # 行の幅が最大幅のこの割合を下回るあいだ、上下から削る


def trim_tails(pts):
    """塊の上下から「細い尻尾」を削る。露天風呂の湯気のように投入口とつながって伸びる装飾が
    重心を引っぱるのを防ぐ。楕円そのものは上下端が数行減るだけで、重心は動かない。"""
    rows = {}
    for x, y in pts:
        rows.setdefault(y, []).append(x)
    ys = sorted(rows)
    wide = max(len(rows[y]) for y in ys) * TAIL
    lo, hi = 0, len(ys) - 1
    while lo < hi and len(rows[ys[lo]]) < wide: lo += 1
    while hi > lo and len(rows[ys[hi]]) < wide: hi -= 1
    keep = set(ys[lo:hi + 1])
    return [p for p in pts if p[1] in keep]


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
            if len(pts) < SPOT_MIN_AREA:
                continue
            pts = trim_tails(pts)
            if len(pts) < SPOT_MIN_AREA:
                continue
            xs = [q0[0] for q0 in pts]; ys = [q0[1] for q0 in pts]
            bw, bh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
            # 投入口は「2:1に潰した円」= 外接矩形の π/4≈0.79 を埋める横長の塊。
            # 色だけで拾うと黒い輪郭線が全部つながった巨大な成分が混ざるので、形でも落とす。
            if len(pts) < SPOT_FILL * bw * bh:
                continue
            if not (SPOT_ASPECT[0] <= bw / bh <= SPOT_ASPECT[1]):
                continue
            out.append(((sum(xs) / len(xs), sum(ys) / len(ys)), len(pts)))
    return out


def pick_spots(cands, n, score=None):
    """候補から「等間隔・一直線・同じ大きさ」に最も近い n 個を選ぶ(装飾の誤検出を落とす)。
    score=True なら (選んだ組, 崩れの度合い) を返す。"""
    if len(cands) < n:
        return (None, 1e18) if score else None
    if n == 1:
        top = [max(cands, key=lambda t: t[1])]
        return (top, 0.0) if score else top
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
    return best if score is None else (best, bv)


GOOD_SPOTS = 0.35   # 「等間隔・一直線・同サイズ」の崩れがこの値未満なら投入口の並びと認める


def best_spots(cands, hint):
    """投入口が何個あるかを絵から決める。生成AIは台ごとに個数を1つ間違えることがあるので、
    呼び名(hint)を鵜呑みにせず、6個から2個まで試して「並びとして成立する最大個数」を採る。"""
    for k in range(min(6, len(cands)), 1, -1):
        got = pick_spots(cands, k, score=True)
        if got and got[0] and got[1] < GOOD_SPOTS:
            return list(got[0])
    return pick_spots(cands, hint)


# ---- ここから「2マス機からNマス機を合成する」ための道具 ----------------------------

CUT = 0.5          # 切断線の位置。投入口0から何周期ぶん手前か(0.5 = ベイの境目)
BAD_TOL = 56       # 1ベイ隣と色がこれ以上違えば「端の飾り」と見なす(RGBユークリッド距離)
BAD_JITTER = 2     # 絵の微妙なズレを許すため、比較先は ±2px の範囲で最も近い画素を採る


def _shift(m, dx, dy):
    """配列を (dx,dy) だけずらす(はみ出しは0埋め)。m[y][x] が m[y+dy][x+dx] を見に行く"""
    h, w = m.shape[0], m.shape[1]
    out = np.zeros_like(m)
    xs0, xs1 = max(0, -dx), min(w, w - dx)
    ys0, ys1 = max(0, -dy), min(h, h - dy)
    if xs1 <= xs0 or ys1 <= ys0:
        return out
    out[ys0:ys1, xs0:xs1] = m[ys0 + dy:ys1 + dy, xs0 + dx:xs1 + dx]
    return out


def measure_period(sp, org, guess, rad=8):
    """1ベイの周期ベクトル(整数)をテンプレートマッチで実測する。
    投入口の重心はホッパーの大きさの差で数px偏るので、絵そのものを突き合わせる。"""
    a = np.asarray(sp.convert('RGBA')).astype(np.int32)
    h, w, _ = a.shape
    rgb = a[:, :, :3]; op = a[:, :, 3] > 128
    gx, gy = int(round(guess[0])), int(round(guess[1]))
    tw = max(16, abs(gx)); th = max(16, int(abs(gx) * 1.5))       # 投入口まわり1ベイぶん
    tx0 = max(0, min(w - tw, int(round(org[0] - tw / 2))))
    ty0 = max(0, min(h - th, int(round(org[1] - th * 0.35))))
    T = rgb[ty0:ty0+th, tx0:tx0+tw]; TO = op[ty0:ty0+th, tx0:tx0+tw]
    best = (1e18, gx, gy)
    for dx in range(gx - rad, gx + rad + 1):
        for dy in range(gy - rad, gy + rad + 1):
            x0, y0 = tx0 + dx, ty0 + dy
            if x0 < 0 or y0 < 0 or x0 + tw > w or y0 + th > h:
                continue
            C = rgb[y0:y0+th, x0:x0+tw]; CO = op[y0:y0+th, x0:x0+tw]
            e = float(((T - C) ** 2).sum(axis=2)[TO & CO].sum()) + 3 * 160 * 160 * int((TO ^ CO).sum())
            if e / (tw * th) < best[0]:
                best = (e / (tw * th), dx, dy)
    return best[1], best[2]


def shear_y(sp, r):
    """列 x を round(r*x) px だけ縦にずらす。垂直線は垂直のまま。
    r*Dx が整数なら「(Dx,Dy)周期 → (Dx,Dy+r*Dx)周期」の言い換えになり、周期性は厳密に保たれる。"""
    if r == 0:
        return sp, 0
    a = np.asarray(sp.convert('RGBA'))
    h, w, _ = a.shape
    sh = [int(round(r * x)) for x in range(w)]
    pad0, pad1 = max(0, -min(sh)), max(0, max(sh))
    out = np.zeros((h + pad0 + pad1, w, 4), dtype=a.dtype)
    for x in range(w):
        out[pad0 + sh[x]:pad0 + sh[x] + h, x, :] = a[:, x, :]
    return Image.fromarray(out, 'RGBA'), pad0


def deco_mask(sp, D):
    """「1ベイ前にも後ろにも同じ絵が無い」画素 = 端の飾り(煙突・煙・歯車・端の面)"""
    Dx, Dy = D
    a = np.asarray(sp.convert('RGBA')).astype(np.int32)
    h, w, _ = a.shape
    rgb = a[:, :, :3]; op = a[:, :, 3] > 128
    best = np.full((h, w), 1e9)
    for sgn in (+1, -1):
        for ox in range(-BAD_JITTER, BAD_JITTER + 1):
            for oy in range(-BAD_JITTER, BAD_JITTER + 1):
                B = _shift(rgb, sgn*Dx + ox, sgn*Dy + oy)
                OB = _shift(op, sgn*Dx + ox, sgn*Dy + oy)
                d = np.sqrt(((rgb - B) ** 2).sum(axis=2))
                best = np.minimum(best, np.where(OB, d, 1e9))
    return op & (best > BAD_TOL)


def clean_bay(sp, D, bad, mid_x):
    """飾りを「1ベイ隣の同じ相対位置」の絵で置き換えた『素のベイ』。繰り返す縦帯はこれを使う。
    奥側(x<mid_x)の飾りは前方(+D)から、手前側は後方(-D)から借りる = 必ず機械の内側から取る。"""
    Dx, Dy = D
    a = np.asarray(sp.convert('RGBA'))
    h, w, _ = a.shape
    out = a.copy()
    X = np.arange(w)[None, :].repeat(h, 0)
    todo = bad.copy()
    for sgn in (+1, -1):                       # 第一希望(奥は+D / 手前は-D)
        want = todo & ((X < mid_x) == (sgn > 0))
        ok = want & ~_shift(todo, sgn*Dx, sgn*Dy)
        out[ok] = _shift(a, sgn*Dx, sgn*Dy)[ok]
        todo = todo & ~ok
    for sgn in (-1, +1):                       # 第二希望
        ok = todo & ~_shift(todo, sgn*Dx, sgn*Dy)
        out[ok] = _shift(a, sgn*Dx, sgn*Dy)[ok]
        todo = todo & ~ok
    out[todo] = 0                              # 前後とも飾りなら消す
    return Image.fromarray(out, 'RGBA')


def compose(sp, cln, org, D, n, m=2):
    """Mマス機の絵からNマス機を合成する。画面上の縦線 x=cx で切り、幅Dxの縦帯を N-M 回はさむ
    (N<M なら逆に |N-M| 本のベイを飛ばして詰める)。
    領域kは元絵の (k*Dx, k*Dy) 平行移動そのもの(整数)なので、補間は一切起きない。"""
    Dx, Dy = D
    a = np.asarray(sp.convert('RGBA'))
    b = np.asarray(cln.convert('RGBA'))
    h, w, _ = a.shape
    rep = n - m
    # ベイを詰める(rep<0)ときは手前側が上へ寄るだけで、奥側は元の高さのまま残る。
    # H2 まで縮めると奥側の下端を切り落としてしまうので、縮めるのは横だけ。
    W2, H2 = w + rep * Dx, h + max(0, rep) * Dy
    X, Y = np.meshgrid(np.arange(W2), np.arange(H2))
    cx = int(round(org[0] + CUT * Dx))
    steps = np.clip(np.ceil((X - cx) / Dx - 1e-9).astype(np.int64), 0, abs(rep))
    k = steps if rep >= 0 else -steps
    sx, sy = X - k * Dx, Y - k * Dy
    inside = (sx >= 0) & (sx < w) & (sy >= 0) & (sy < h)
    cy, cxx = np.clip(sy, 0, h - 1), np.clip(sx, 0, w - 1)
    # 繰り返す縦帯(k>=1 かつ 元絵の切断線より奥)だけ飾りを消した絵を使う。
    # 奥側(k=0)と手前側(sx>cx)は元絵のまま = 煙突も歯車も1つずつ残る。
    use = np.where(((k >= 1) & (sx <= cx))[:, :, None], b[cy, cxx], a[cy, cxx])
    out = np.zeros((H2, W2, 4), dtype=a.dtype)
    out[inside] = use[inside]
    im = Image.fromarray(out, 'RGBA')
    bb = im.getbbox() or (0, 0, W2, H2)
    return im.crop(bb), (org[0] - bb[0], org[1] - bb[1])


ANGLE_TOL = 0.25   # ベイの傾き(|dy/dx|)が多数派からこの割合を超えて外れたら合成元にしない


def pick_source(found):
    """合成元の台を選ぶ。(index, その絵が持つベイ数) を返す。無理なら None。

    「幅が最小 = 2マス機」とは限らない。生成AIは投入口の数を1つ間違えることがあるので、
    台の呼び名ではなく **実際に検出できた投入口の数** をベイ数として扱う。
    そのうえで、絵のアイソメ角が多数派から外れている台(たまに1台だけ違う角度で描かれる)は
    合成元から外し、残りのうちベイ数が少ない台を選ぶ(合成は伸ばす向きのほうが素直)。"""
    cand = {}
    for i, (_n, _sp, spots) in enumerate(found):
        if not spots or len(spots) < 2:
            continue
        cs = sorted([s[0] for s in spots], key=lambda c: c[0])
        dx = cs[-1][0] - cs[0][0]
        if dx > 4:
            cand[i] = (abs(cs[-1][1] - cs[0][1]) / dx, len(spots))
    if not cand:
        return None
    angs = sorted(a for a, _m in cand.values())
    med = angs[len(angs) // 2]
    ok = [i for i, (a, _m) in cand.items()
          if med > 0 and abs(a - med) / med <= ANGLE_TOL] or list(cand)
    i = min(ok, key=lambda k: (cand[k][1], k))
    return i, cand[i][1]


def synth_fit(theme, found, W, H, GU, GV, iso):
    """2マス機の絵からNマス機を合成する。{'2':{ax,ay},...} を返す。無理なら None"""
    step_x = abs(iso['ux'] * W / GU)
    step_y = abs(iso['uy'] * H / GU)
    src = pick_source(found)
    if src is None:
        return None
    idx, m = src
    nominal, sp, spots = found[idx]
    if idx != 0 or m != nominal:
        print(f'   ※合成元は「{nominal}マス機」の絵。実際の投入口は {m} 個なので '
              f'{m}ベイぶんの絵として扱う')
    cs = sorted([s[0] for s in spots], key=lambda c: c[0])
    cs = [cs[0], cs[1]]                                     # 隣り合う2つの投入口 = 1ベイ
    if cs[1][1] < cs[0][1]:                                 # 長軸が右斜め上 → 左右反転
        sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
        cs = [(sp.width - 1 - c[0], c[1]) for c in cs][::-1]
        print('   ※長軸が右斜め上なので左右反転してゲームの向きに揃えた')
    guess = (cs[1][0] - cs[0][0], cs[1][1] - cs[0][1])
    Dx, Dy = measure_period(sp, cs[0], guess)
    if Dx < 8:
        return None
    Py = int(round(Dx * step_y / step_x))                   # ゲームのアイソメ比に合う縦の送り
    r = (Py - Dy) / Dx
    sp, pad = shear_y(sp, r)
    org = (cs[0][0], cs[0][1] + pad + round(r * cs[0][0]))
    scale = step_x / Dx
    print(f'   2マス機の1ベイ = ({Dx},{Dy})px → ({Dx},{Py})px にせん断 (列あたり {r:+.4f}px)'
          f' / 倍率 {scale:.4f}')
    if Py != Dy:
        print(f'   ※絵のアイソメ角がゲームと違う(1ベイの縦 {Dy}px に対しゲームは {Py}px)。'
              f'差の{abs(Dy-Py)}pxは列ごとの縦シフトで吸収した')
    bad = deco_mask(sp, (Dx, Py))
    cln = clean_bay(sp, (Dx, Py), bad, org[0] + CUT * Dx)
    out_fit = {}
    for n, _sp, _s in found:
        im, o = compose(sp, cln, org, (Dx, Py), n, m)
        ow, oh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
        res = im.resize((ow, oh), Image.LANCZOS)
        res.save(os.path.join(OUT, f'mach-{theme}-s{n}.png'))
        ax, ay = o[0] * scale / ow, o[1] * scale / oh
        out_fit[str(n)] = {'ax': round(ax, 4), 'ay': round(ay, 4)}
        print(f'   s{n}: 合成 {im.width}x{im.height} → {ow}x{oh}  '
              f'送り ({Dx*scale:.3f}, {Py*scale:.3f})px  アンカー ({ax:.4f}, {ay:.4f})')
    dy_err = abs(Py * scale - step_y)
    print(f'   送りの目標 ({step_x:.3f}, {step_y:.3f})px  → 横は完全一致 / '
          f'縦の残差 {dy_err:.3f}px/マス (5マス機の端で {dy_err*4:.2f}px)')
    return out_fit


def main():
    import json
    W, H, GU, GV, iso, IN = main_js_consts()
    step_x = abs(iso['ux'] * W / GU)      # ゲームの1マス送り(u方向)
    step_y = abs(iso['uy'] * H / GU)
    print(f'ゲームの1マス送り = ({step_x:.4f}, {step_y:.4f})px  (game/main.js の ISO/W/H/GU より)')
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

        # 投入口を検出する。4台ぶん測るのは「生成された絵がどれだけ詰まっているか」をログに残すため
        found = []
        for n, bb in zip(SIZES, picks):
            sp = sheet.crop(bb)
            cands = spot_blobs(sp, test) if test else []
            top = SPOT_TOP.get(theme)
            if top:
                cands = [c for c in cands if c[0][1] < sp.height * top]
            spots = best_spots(cands, n) if test and cands else None
            found.append((n, sp, spots))
        measured = [abs((s[-1][0][0] - s[0][0][0]) / (n - 1)) for n, _, s in found if s and n > 1]
        if len(measured) >= 2:
            med = sorted(measured)[len(measured) // 2]
            print(f'   シートの実測送り: {" / ".join(f"{m:.1f}" for m in measured)} px '
                  f'(ばらつき ±{(max(measured)-min(measured))/med*100:.1f}%) ← これを直すために合成する')

        got = synth_fit(theme, found, W, H, GU, GV, iso) if test else None
        if got:
            fit[theme] = got
        else:
            print('   !! 2マス機の投入口を検出できないテーマなので、従来の幅合わせにフォールバック')
            legacy_fit(theme, found, W, H, GU, GV, iso, IN)

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

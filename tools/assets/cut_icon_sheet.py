#!/usr/bin/env python3
"""Stitch生成の「横1列アイコンシート」を1個ずつ切り出して 16×16 の透過PNGにする。

    使い方: python3 tools/assets/cut_icon_sheet.py [--size=N] <sheet.png> <出力先dir> <prefix> <id1> ...
    例    : python3 tools/assets/cut_icon_sheet.py sheet1.png assets/ui/icons mat- milk flour egg butter
            python3 tools/assets/cut_icon_sheet.py --size=32 s.png assets/ui/icons prod- tkg pretzel

原材料・製品のアイコン用。cut_props.py が盤面に置くプロップ（大きいまま使う）なのに対し、
こちらは表示サイズちょうどまで落とす。

**--size は「実際に出る大きさ」に合わせる。** ドット絵は半端な倍率でも 1/2 でも濁るので、
グリッドの1辺＝表示px にする（make_menu_icons.mjs 冒頭と同じ考え方）。実測:
  原材料 16 … レシピ左 .rms 15px / 材料チップ .mchip 14px / 製造機のマス .mslot 19〜24px
  製品   32 … 図鑑カード .pcard .e 28px / レシピ右 .rp .e 22px
  ジャンル 16 … 見出しの文字に混ぜる

マゼンタ抜きは key_room_glass.py と同じ「比率判定」。生成物のマゼンタは純粋な #FF00FF に
ならない（実測 (254,15,253) 前後にばらつく上、シートによって上下で微妙に色が違う）ので、
固定色一致では抜けない。r>150 かつ b>150 かつ g が両者よりずっと小さい、で見る。

Stitch はこちらが NO TEXT と書いてもラベル文字を描くことがある。列ごとに
「最大の塊」と「それと縦に重なる塊」だけを残して、下に離れて置かれた文字を落とす。

列の切れ目は「幅を等分」ではなく**空白の谷を探して**決める。等分だと隣の絵の端が
数ドット入り込んで、原寸で「謎の縦棒」になる（アルミ缶の右にガラス板の枠が入った）。

注意: **ピンク/マゼンタ寄りの色は絵に使わせないこと。** 抜きと区別が付かない。
糸をピンクで出させたら糸だけがそっくり消えた（赤や臙脂なら通る）。

縮小は LANCZOS。ドット絵は本来 整数分の1 の NEAREST が理想だが、生成物のドットは
きっちり格子に乗っていない（1ドットが 15.5px だったりする）ので NEAREST だと輪郭が
欠ける。α を premultiply してから縮めて、縁に黒ハローが出ないようにしている。
"""
import sys
import os
from collections import deque, Counter
from PIL import Image

SIZE = 16          # 出力の1辺（--size で上書きする）
ALPHA_CUT = 110    # 縮小後、これ未満のαは捨てる（半端な半透明を残すと原寸で滲む）
PAD = 0            # 正方形のうち絵に使わない余白（0 = 目一杯）


def magenta_ish(px):
    """いかにもマゼンタな色か。比率で見る（純 #FF00FF を期待しない）"""
    r, g, b = px[0], px[1], px[2]
    return r > 150 and b > 150 and g < r - 60 and g < b - 60


def bg_colour(im):
    """外周1ドットから背景色を推定する。

    シートによって背景が #FF00FF から大きくずれる（実測 (198,54,141) のくすんだ
    ローズがあった）。決め打ちの比率判定だけだと、そういうシートで背景が丸ごと
    残る（おにぎりの列が全部マゼンタの四角になった）。外周は必ず背景なので、
    そこの最頻色を「このシートの背景」として使う。"""
    w, h = im.size
    px = im.load()
    edge = ([px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)]
            + [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)])
    return Counter(edge).most_common(1)[0][0]


def keyed_mask(im):
    """背景でない画素の bool マスク"""
    w, h = im.size
    px = im.load()
    br, bg_, bb = bg_colour(im)[:3]
    TOL = 46            # 背景のばらつき（上下で色が違うシートがある）を吸収する幅

    def is_bg(p):
        if magenta_ish(p):
            return True
        return abs(p[0] - br) <= TOL and abs(p[1] - bg_) <= TOL and abs(p[2] - bb) <= TOL

    return [[not is_bg(px[x, y]) for x in range(w)] for y in range(h)]


def components(mask, x0, x1):
    """mask の x0..x1 列にある連結成分を [(面積, y上, y下, [(x,y)...])] で返す"""
    h = len(mask)
    seen = [[False] * (x1 - x0) for _ in range(h)]
    out = []
    for sy in range(h):
        for sx in range(x0, x1):
            if not mask[sy][sx] or seen[sy][sx - x0]:
                continue
            q = deque([(sx, sy)])
            seen[sy][sx - x0] = True
            cells = []
            while q:
                x, y = q.popleft()
                cells.append((x, y))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if x0 <= nx < x1 and 0 <= ny < h and mask[ny][nx] and not seen[ny][nx - x0]:
                        seen[ny][nx - x0] = True
                        q.append((nx, ny))
            ys = [c[1] for c in cells]
            out.append((len(cells), min(ys), max(ys), cells))
    return out


def columns(mask, w, h, n):
    """絵が入っている列の塊を n 個みつけて [(x0,x1)...] を返す。

    空白の谷で切る。塊が n より多く出たら（染料の飛沫のように絵が分かれている）、
    間隔の狭いものから順に併合して n 個に落とす。谷が見つからなければ等分に逃げる。"""
    ink = [sum(1 for y in range(h) if mask[y][x]) for x in range(w)]
    runs = []
    x = 0
    while x < w:
        if ink[x]:
            s = x
            while x < w and ink[x]:
                x += 1
            runs.append([s, x - 1])
        else:
            x += 1
    if len(runs) < n:
        return None                      # 横1列に並んでいない → 塊ごとに拾う方へ回す
    while len(runs) > n:
        gaps = [(runs[i + 1][0] - runs[i][1], i) for i in range(len(runs) - 1)]
        _, i = min(gaps)
        runs[i] = [runs[i][0], runs[i + 1][1]]
        del runs[i + 1]
    # 塊のあいだの中点で区切る（絵の端が切れないように余白ごと渡す）
    out = []
    for i, (a, b) in enumerate(runs):
        x0 = 0 if i == 0 else (runs[i - 1][1] + a) // 2
        x1 = w if i == len(runs) - 1 else (b + runs[i + 1][0]) // 2 + 1
        out.append((x0, x1))
    return out


def clusters(mask, w, h, n):
    """横1列に並んでいないシートを、塊を寄せ集めて n 個に分ける。

    Stitch は「4個を横1列」と書いても 3個＋下に1個 のように積むことがある
    （顕微鏡・望遠鏡・マウス・キーボードの列がそうなった）。近い塊から順に
    併合して n 組にし、左→右、同じ列なら上→下 の順（＝プロンプトの並び）に返す。"""
    comps = components(mask, 0, w)
    if len(comps) < n:
        return None
    comps.sort(key=lambda c: -c[0])
    groups = []
    for _, _, _, cells in comps:
        xs = [c[0] for c in cells]
        ys = [c[1] for c in cells]
        groups.append([min(xs), max(xs), min(ys), max(ys), cells])

    def gap(a, b):
        dx = max(0, max(a[0], b[0]) - min(a[1], b[1]))
        dy = max(0, max(a[2], b[2]) - min(a[3], b[3]))
        return (dx * dx + dy * dy) ** 0.5

    while len(groups) > n:
        best = None
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                d = gap(groups[i], groups[j])
                if best is None or d < best[0]:
                    best = (d, i, j)
        _, i, j = best
        a, b = groups[i], groups[j]
        groups[i] = [min(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), max(a[3], b[3]),
                     a[4] + b[4]]
        del groups[j]
    tol = w / (2 * n)                    # これより横位置が近ければ「同じ列」とみなす
    groups.sort(key=lambda g: ((g[0] + g[1]) / 2 // tol, (g[2] + g[3]) / 2))
    return [g[4] for g in groups]


def cut(sheet_path, out_dir, prefix, ids):
    im = Image.open(sheet_path).convert('RGB')
    w, h = im.size
    n = len(ids)
    mask = keyed_mask(im)
    src = im.load()
    os.makedirs(out_dir, exist_ok=True)

    cols = columns(mask, w, h, n)
    grouped = None if cols else clusters(mask, w, h, n)
    if cols is None and grouped is None:
        print(f'  ! {sheet_path}: {n}個に分けられない')
        return
    for i, ident in enumerate(ids):
        if cols:
            x0, x1 = cols[i]
            comps = components(mask, x0, x1)
            if not comps:
                print(f'  ! {ident}: 何も見つからない')
                continue
            comps.sort(key=lambda c: -c[0])
            main = comps[0]
            # 本体と縦に重なる塊だけ拾う（下に離れたラベル文字はここで落ちる）
            keep = [c for c in comps if not (c[2] < main[1] or c[1] > main[2])]
            cells = [cell for c in keep for cell in c[3]]
        else:
            cells = grouped[i]

        xs = [c[0] for c in cells]
        ys = [c[1] for c in cells]
        bx0, bx1, by0, by1 = min(xs), max(xs), min(ys), max(ys)
        bw, bh = bx1 - bx0 + 1, by1 - by0 + 1

        # 切り抜き（bbox）を RGBA で作る。premultiply して縮小する
        crop = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
        cp = crop.load()
        for x, y in cells:
            r, g, b = src[x, y]
            cp[x - bx0, y - by0] = (r, g, b, 255)

        # 長辺を SIZE-PAD*2 に合わせ、正方形の中央に置く
        box = SIZE - PAD * 2
        if bw >= bh:
            tw, th = box, max(1, round(bh * box / bw))
        else:
            th, tw = box, max(1, round(bw * box / bh))

        pm = Image.new('RGBA', (bw, bh))
        pmp = pm.load()
        for y in range(bh):
            for x in range(bw):
                r, g, b, a = cp[x, y]
                f = a / 255
                pmp[x, y] = (int(r * f), int(g * f), int(b * f), a)
        pm = pm.resize((tw, th), Image.LANCZOS)

        small = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
        sp = small.load()
        pmr = pm.load()
        ox, oy = (SIZE - tw) // 2, (SIZE - th) // 2
        for y in range(th):
            for x in range(tw):
                r, g, b, a = pmr[x, y]
                if a < ALPHA_CUT:
                    continue
                f = a / 255
                sp[x + ox, y + oy] = (
                    min(255, int(r / f)), min(255, int(g / f)), min(255, int(b / f)), 255)

        out = os.path.join(out_dir, f'{prefix}{ident}.png')
        small.save(out)
        print(f'  {out}  (src {bw}x{bh} -> {tw}x{th})')


if __name__ == '__main__':
    argv = sys.argv[1:]
    if argv and argv[0].startswith('--size='):
        SIZE = int(argv[0].split('=')[1])
        argv = argv[1:]
    if len(argv) < 4:
        print(__doc__)
        sys.exit(1)
    cut(argv[0], argv[1], argv[2], argv[3:])

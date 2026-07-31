#!/usr/bin/env python3
"""Stitch生成の3x2アセットシート(JPEG)を1体ずつ切り出して透過PNGにする。

    使い方: python3 tools/cut_props.py assets/prop-sheets assets
    (素のPythonで全ピクセルを走査するので 1体あたり1分前後・全30体で30〜45分かかる)

背景の紺と接地影を落とし、スプライト本体(暗い輪郭・黒い鉄・石炭を含む)は残す。

背景の落とし方は2段:
  1) 背景色 bg の「明るさを変えただけの色」を縁から flood fill で除去
     (sushi/western/steampunk の影はこれで落ちる。黒い鉄(31,31,39)は紺の直線から
      外れるので残る)
  2) 残った縁のうち「暗くて分厚い塊」を影と判定して除去
     (circus の影(1,4,23)・beehive の影(42,20,43) は独自色なので 1) では落ちない。
      輪郭線と区別するために収縮(erode)して面積が残るかで「塊かどうか」を見る)
"""
import sys, os
from collections import deque, Counter
from PIL import Image

SHEETS = {
    'circus':    ['cir_popcorn', 'cir_ballstand', 'cir_trunks', 'cir_ringtoss', 'cir_cannon', 'cir_stool'],
    'sushi':     ['sus_lane', 'sus_oke', 'sus_tea', 'sus_sake', 'sus_neko', 'sus_netacase'],
    'western':   ['wes_barreltable', 'wes_horseshoe', 'wes_wheel', 'wes_campfire', 'wes_cactus', 'wes_assay'],
    'beehive':   ['bee_combtable', 'bee_honeypots', 'bee_pollen', 'bee_candles', 'bee_throne', 'bee_frames'],
    'steampunk': ['stm_boiler', 'stm_cogs', 'stm_console', 'stm_chair', 'stm_orrery', 'stm_coal'],
}
COLS, ROWS = 3, 2
PAD = 3          # 切り出し後に足す余白(px)
ERODE = 2        # 影判定の収縮半径(px)
BLOB_MIN = 150   # 収縮後にこれだけ残れば「塊」=影
NB = ((1, 0), (-1, 0), (0, 1), (0, -1))


def make_bg_test(bg, kmin=0.15):
    """bg の明るさを変えただけの色(=背景と、背景を暗くした影)を判定する。

    kmin を上げると「暗くした色」を除外できる。囲まれた領域を抜くときは
    素の背景色だけを対象にしたいので kmin=0.85 で呼ぶ(石炭やケトルの暗部を守る)。
    """
    bx, by, bz = bg
    nn = bx * bx + by * by + bz * bz
    RES, KMIN, KMAX = 6.5, kmin, 1.45   # KMAX>1 は軽いビネットで四隅より明るい箇所があるため

    def test(p):
        r, g, b = p[0], p[1], p[2]
        k = (r * bx + g * by + b * bz) / nn
        if not (KMIN <= k <= KMAX):
            return False
        dr, dg, db = r - k * bx, g - k * by, b - k * bz
        return dr * dr + dg * dg + db * db <= RES * RES

    return test


def near(p, c, tol):
    d0, d1, d2 = p[0] - c[0], p[1] - c[1], p[2] - c[2]
    return d0 * d0 + d1 * d1 + d2 * d2 <= tol * tol


class Cell:
    """1セル分の背景マスク。(0,0)-(w,h) のローカル座標で扱う。"""

    def __init__(self, px, x0, y0, x1, y1):
        self.w, self.h = x1 - x0, y1 - y0
        self.p = [[px[x0 + x, y0 + y] for x in range(self.w)] for y in range(self.h)]
        self.bg = [[False] * self.w for _ in range(self.h)]

    def fill_from_edges(self, test):
        """縁の背景ピクセルから test を満たす範囲へ flood fill。"""
        q = deque()
        for x in range(self.w):
            for y in (0, self.h - 1):
                self._seed(x, y, test, q)
        for y in range(self.h):
            for x in (0, self.w - 1):
                self._seed(x, y, test, q)
        self._grow(q, test)

    def _seed(self, x, y, test, q):
        if not self.bg[y][x] and test(self.p[y][x]):
            self.bg[y][x] = True
            q.append((x, y))

    def _grow(self, q, test):
        bg, p, w, h = self.bg, self.p, self.w, self.h
        while q:
            x, y = q.popleft()
            for dx, dy in NB:
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx] and test(p[ny][nx]):
                    bg[ny][nx] = True
                    q.append((nx, ny))

    def fill_pockets(self, test, min_area=40):
        """縁から届かない「囲まれた背景」も抜く(三脚の内側・輪の穴など)。"""
        seen = [[False] * self.w for _ in range(self.h)]
        filled = 0
        for sy in range(self.h):
            for sx in range(self.w):
                if self.bg[sy][sx] or seen[sy][sx] or not test(self.p[sy][sx]):
                    continue
                q, pts = deque([(sx, sy)]), []
                seen[sy][sx] = True
                while q:
                    x, y = q.popleft(); pts.append((x, y))
                    for dx, dy in NB:
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.w and 0 <= ny < self.h and not self.bg[ny][nx] \
                                and not seen[ny][nx] and test(self.p[ny][nx]):
                            seen[ny][nx] = True; q.append((nx, ny))
                if len(pts) >= min_area:
                    for x, y in pts:
                        self.bg[y][x] = True
                    filled += 1
        return filled

    def rim_colors(self):
        """背景に接している本体側ピクセルの色を数える(暗いものだけ)。"""
        c = Counter()
        for y in range(self.h):
            for x in range(self.w):
                if self.bg[y][x]:
                    continue
                if not any(0 <= x + dx < self.w and 0 <= y + dy < self.h and self.bg[y + dy][x + dx]
                           for dx, dy in NB):
                    continue
                pv = self.p[y][x]
                if 0.3 * pv[0] + 0.6 * pv[1] + 0.1 * pv[2] < 80:      # 暗い縁のみ候補
                    c[(pv[0] >> 2 << 2, pv[1] >> 2 << 2, pv[2] >> 2 << 2)] += 1
        return c

    def region_from_bg(self, color, tol):
        """背景から連結する「color に近いピクセル」の集合。"""
        seen = [[False] * self.w for _ in range(self.h)]
        q = deque()
        for y in range(self.h):
            for x in range(self.w):
                if not self.bg[y][x]:
                    continue
                for dx, dy in NB:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and not self.bg[ny][nx] \
                            and not seen[ny][nx] and near(self.p[ny][nx], color, tol):
                        seen[ny][nx] = True
                        q.append((nx, ny))
        out = []
        while q:
            x, y = q.popleft()
            out.append((x, y))
            for dx, dy in NB:
                nx, ny = x + dx, y + dy
                if 0 <= nx < self.w and 0 <= ny < self.h and not self.bg[ny][nx] \
                        and not seen[ny][nx] and near(self.p[ny][nx], color, tol):
                    seen[ny][nx] = True
                    q.append((nx, ny))
        return out, seen

    def strip_shadow(self):
        """暗くて分厚い「横長で下寄りの塊」(=接地影)を剥がす。

        輪郭線(細い)・黒い鉄や石炭(横長でない)を消さないよう、
        収縮後の面積 + アスペクト比 + 位置の3条件で影を見分ける。
        """
        for color, n in self.rim_colors().most_common(12):
            if n < 25:
                break
            pts, mask = self.region_from_bg(color, 18)
            if len(pts) < BLOB_MIN:
                continue
            # 収縮して「太い部分」だけを残す。影と同色でつながった輪郭線はここで消える
            core = [(x, y) for x, y in pts
                    if all(0 <= x + dx < self.w and 0 <= y + dy < self.h and mask[y + dy][x + dx]
                           for dx in range(-ERODE, ERODE + 1) for dy in range(-ERODE, ERODE + 1))]
            if len(core) < BLOB_MIN:
                continue                       # 細い → 輪郭線なので触らない
            xs = [p[0] for p in core]; ys = [p[1] for p in core]
            rw, rh = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
            if rw < 1.8 * rh:                  # 影は平たい楕円。石炭やギアの塊はほぼ正方形
                continue
            if max(ys) < 0.55 * self.h:        # 影は必ず下寄り
                continue
            # 太い部分を膨張し直して(=開処理)、影の範囲だけを背景に落とす
            R = ERODE + 1
            core_set = set(core)
            for x, y in pts:
                if any((x + dx, y + dy) in core_set
                       for dx in range(-R, R + 1) for dy in range(-R, R + 1)):
                    self.bg[y][x] = True
            # 影と背景の中間色(アンチエイリアスのフチ)も落とす
            self.fill_from_edges(make_blend_test(color, self.p[0][0]))
            self.fill_pockets(lambda p, c=color: near(p, c, 18))
            return color
        return None

    def clean_specks(self):
        """影を剥がした跡に残る「暗くて細い破片」(影のアンチエイリアスのフチ)を消す。
        真鍮の輪や蒸気のような明るい離れパーツは残す。"""
        comps, seen, dropped = [], [[False] * self.w for _ in range(self.h)], 0
        for sy in range(self.h):
            for sx in range(self.w):
                if self.bg[sy][sx] or seen[sy][sx]:
                    continue
                q, pts = deque([(sx, sy)]), []
                seen[sy][sx] = True
                while q:
                    x, y = q.popleft(); pts.append((x, y))
                    for dx, dy in NB:
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.w and 0 <= ny < self.h and not self.bg[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True; q.append((nx, ny))
                comps.append(pts)
        if not comps:
            return 0
        comps.sort(key=len, reverse=True)
        for pts in comps[1:]:
            lum = sum(0.3 * self.p[y][x][0] + 0.6 * self.p[y][x][1] + 0.1 * self.p[y][x][2]
                      for x, y in pts) / len(pts)
            if lum >= 90:
                continue                       # 明るい離れパーツ(輪・蒸気)は残す
            s_ = set(pts)
            thick = sum(1 for x, y in pts
                        if all((x + dx, y + dy) in s_ for dx in (-1, 0, 1) for dy in (-1, 0, 1)))
            if len(pts) < 400 or thick / len(pts) < 0.12:
                for x, y in pts:
                    self.bg[y][x] = True
                dropped += 1
        return dropped

    def bbox(self):
        minx, miny, maxx, maxy = self.w, self.h, -1, -1
        for y in range(self.h):
            row = self.bg[y]
            for x in range(self.w):
                if not row[x]:
                    if x < minx: minx = x
                    if x > maxx: maxx = x
                    if y < miny: miny = y
                    if y > maxy: maxy = y
        return minx, miny, maxx, maxy


def make_blend_test(c1, c2):
    """c1-c2 を結ぶ線上の色(=2色のアンチエイリアス中間色)を判定する。"""
    vx, vy, vz = c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]
    nn = vx * vx + vy * vy + vz * vz or 1

    def test(p):
        dx, dy, dz = p[0] - c1[0], p[1] - c1[1], p[2] - c1[2]
        t = (dx * vx + dy * vy + dz * vz) / nn
        if not (-0.15 <= t <= 1.15):
            return False
        rx, ry, rz = dx - t * vx, dy - t * vy, dz - t * vz
        return rx * rx + ry * ry + rz * rz <= 100      # 残差 10 以内

    return test


def row_split(px, H, x0, x1, test):
    """列内で上下段の境界行を「本体が無い帯」の中心から決める(背の高い物体の切れ防止)。"""
    lo, hi = int(H * 0.33), int(H * 0.67)
    empty = [y for y in range(lo, hi) if all(test(px[x, y]) for x in range(x0, x1))]
    if not empty:
        return H // 2
    best = cur = [empty[0], empty[0]]
    for y in empty[1:]:
        if y == cur[1] + 1:
            cur[1] = y
        else:
            if cur[1] - cur[0] > best[1] - best[0]: best = cur
            cur = [y, y]
    if cur[1] - cur[0] > best[1] - best[0]: best = cur
    return (best[0] + best[1]) // 2


def main(src_dir, out_dir):
    for sheet, names in SHEETS.items():
        im = Image.open(os.path.join(src_dir, f'{sheet}.jpg')).convert('RGB')
        W, H = im.size
        px = im.load()
        corners = [px[2, 2], px[W - 3, 2], px[2, H - 3], px[W - 3, H - 3]]
        bgc = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
        test = make_bg_test(bgc)
        cw = W // COLS
        splits = [row_split(px, H, c * cw, (c + 1) * cw, test) for c in range(COLS)]
        print(f'{sheet}: 背景 {bgc} / 段境界 {splits}')
        for i, name in enumerate(names):
            cx, cy = i % COLS, i // COLS
            x0, x1 = cx * cw, (cx + 1) * cw
            y0, y1 = (0, splits[cx]) if cy == 0 else (splits[cx], H)
            cell = Cell(px, x0, y0, x1, y1)
            cell.fill_from_edges(test)
            pockets = cell.fill_pockets(make_bg_test(bgc, 0.85), 300)
            shadows = []
            for _ in range(3):
                s_ = cell.strip_shadow()
                if not s_: break
                shadows.append(s_)
            specks = cell.clean_specks()
            minx, miny, maxx, maxy = cell.bbox()
            if maxx < 0:
                print(f'  !! {name}: 本体が見つからない'); continue
            clip = [s for s, ok in (('L', minx > 0), ('R', maxx < cell.w - 1),
                                    ('T', miny > 0), ('B', maxy < cell.h - 1)) if not ok]
            bx0, by0 = max(0, minx - PAD), max(0, miny - PAD)
            bx1, by1 = min(cell.w, maxx + 1 + PAD), min(cell.h, maxy + 1 + PAD)
            out = Image.new('RGBA', (bx1 - bx0, by1 - by0), (0, 0, 0, 0))
            op = out.load()
            for y in range(by0, by1):
                for x in range(bx0, bx1):
                    if not cell.bg[y][x]:
                        op[x - bx0, y - by0] = cell.p[y][x] + (255,)
            out.save(os.path.join(out_dir, f'prop_{name}.png'))
            note = (('影 ' + ' + '.join(map(str, shadows))) if shadows else '影なし') + (f' / 内側{pockets}箇所' if pockets else '') + (f' / 破片{specks}除去' if specks else '')
            print(f'  {name:18s} {out.size[0]:>4}x{out.size[1]:<4} {note}'
                  + (f'  ⚠ セル端に接触: {",".join(clip)}' if clip else ''))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

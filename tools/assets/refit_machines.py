#!/usr/bin/env python3
"""既存の製造機スプライトを、現在の ISO の1マス送りへ合わせ直す。

    使い方: python3 tools/assets/refit_machines.py [--dry-run] [--out <dir>]

    --out を付けると assets/machines/ を書き換えず、そのディレクトリへ書き出す(比較用)。
    付けない場合は assets/machines/ を直接上書きする(元に戻すなら git checkout)。

なぜ cut_machines.py ではないのか:
  cut_machines.py はシート(assets/mach-sheets)から焼き直す本来の道具だが、いま動かせない。
    - 参照先の `game/main.js` が存在しない(座標系は game/scene/iso.mjs に分かれた)
    - 出力先が `assets/` のままで、実際の置き場 `assets/machines/` と食い違う
    - 現在の128枚は「1マスモジュール由来」だが、そのモジュール素材が未コミット
      (hell はシートすら無い)。走らせても同じ絵は再現できず、hell は失われる
  つまり焼き直しは "絵が変わる" 作業になる。ここでは絵を変えたくないので、
  出来上がったスプライトを**そのまま拡縮して送りだけ合わせる**。

やること:
  スプライトには「1ベイ(1マス)の送り」が焼き込まれている(mach-fit.json の step/stepY)。
  現在の ISO の送りとの比だけ、画像を x/y 別々に拡縮する。ベイの送りは画像内の距離なので
  拡縮率そのままで変わり、絵柄・装飾は一切失われない。

  比は一様でない(x 1.0065倍 / y 0.9714倍)ので MACH_DRAW のようなスカラーでは吸収できない。
  拡縮率を厳密に効かせたいので resize(整数サイズへの丸めで送りが 0.08px ずれる)ではなく
  transform(AFFINE) を使う。出力キャンバスだけ ceil で整数にし、中身は厳密比で写す。

  アンカー(ax/ay/gy)は画像サイズに対する割合なので、キャンバスの丸めぶんだけ再計算する。
"""
import json
import math
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MACH = os.path.join(ROOT, 'assets', 'machines')
FIT = os.path.join(MACH, 'mach-fit.json')


def game_consts():
    """game/scene/iso.mjs と catalog.mjs から W,H,GU と ISO,MACH_DRAW を読む"""
    iso_src = open(os.path.join(ROOT, 'game', 'scene', 'iso.mjs'), encoding='utf-8').read()
    cat_src = open(os.path.join(ROOT, 'game', 'scene', 'catalog.mjs'), encoding='utf-8').read()
    m = re.search(r'const W = (\d+), H = (\d+), GU = (\d+), GV = (\d+)', iso_src)
    W, H, GU, GV = map(int, m.groups())
    # export 行だけを見る(コメントに書かれた旧値を拾わないように)
    line = re.search(r'export const ISO = \{([^}]*)\}', iso_src).group(1)
    iso = {k: float(v) for k, v in re.findall(r'(Bx|By|ux|uy|vx|vy):\s*(-?[\d.]+)', line)}
    draw = float(re.search(r'const MACH_DRAW = ([\d.]+)', cat_src).group(1))
    return W, H, GU, iso, draw


def main():
    dry = '--dry-run' in sys.argv
    out_dir = MACH
    if '--out' in sys.argv:
        out_dir = os.path.abspath(sys.argv[sys.argv.index('--out') + 1])
        os.makedirs(out_dir, exist_ok=True)
        print(f'出力先: {out_dir} (assets/machines/ は書き換えない)')
    W, H, GU, iso, draw = game_consts()
    step_x = abs(iso['ux'] * W / GU) * draw
    step_y = abs(iso['uy'] * H / GU) * draw
    print(f'現在の ISO の1マス送り = ({step_x:.4f}, {step_y:.4f})px  比 {step_x/step_y:.4f}:1')

    fit = json.load(open(FIT, encoding='utf-8'))
    n_img = 0
    for theme in sorted(fit):
        for size in sorted(fit[theme]):
            a = fit[theme][size]
            sx = step_x / a['step']
            sy = step_y / a['stepY']
            name = f'mach-{theme}-s{size}.png'
            im = Image.open(os.path.join(MACH, name)).convert('RGBA')
            w, h = im.size
            w2, h2 = math.ceil(w * sx), math.ceil(h * sy)
            if not dry:
                # 出力(x,y) → 入力(x/sx, y/sy)。拡縮率は丸めずキャンバスだけ整数にする
                out = im.transform((w2, h2), Image.AFFINE, (1 / sx, 0, 0, 0, 1 / sy, 0),
                                   resample=Image.BICUBIC)
                out.save(os.path.join(out_dir, name))
            # アンカーは「画像サイズに対する割合」なので、キャンバスの丸めぶんを補正する
            a['ax'] = round(a['ax'] * w * sx / w2, 4)
            a['ay'] = round(a['ay'] * h * sy / h2, 4)
            if a.get('gy') is not None:
                a['gy'] = round(a['gy'] * h * sy / h2, 4)
            a['step'] = round(step_x, 4)
            a['stepY'] = round(step_y, 4)
            n_img += 1
            if theme == sorted(fit)[0]:
                print(f'  {theme}/s{size}: {w}x{h} → {w2}x{h2}  (x{sx:.6f}, y{sy:.6f})')
    if not dry:
        with open(os.path.join(out_dir, 'mach-fit.json'), 'w', encoding='utf-8') as fp:
            json.dump(fit, fp, ensure_ascii=False, indent=1)
    print(f'\n{n_img}枚{"(dry-run)" if dry else ""} / mach-fit.json の step,stepY,アンカーを更新')


if __name__ == '__main__':
    main()

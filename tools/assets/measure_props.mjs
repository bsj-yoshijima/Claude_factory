#!/usr/bin/env node
/* 装飾品(assets/props/*.png)の「接地の位置と幅」を絵から実測して assets/props/prop-fit.json に書く。

     使い方: node tools/assets/measure_props.mjs

なぜ必要か:
  盤面の装飾品は今まで「絵の高さ」で大きさを決め、「絵の bbox の下端中央」をマス中心に
  置いていた(game/scene/machine-art.mjs)。絵の中で物がどこに立っているかを誰も見ていないので
    - 背の高い物は細く、横広の物ははみ出す(実測: 幅/マス幅 が 0.2〜1.5 まで散る)
    - 傘が片側に張り出したランプや板が片寄った棚は、bbox 中央と足元の中央が最大42%ずれる
  という2つのズレが出ていた。絵から足元を測って JSON に持たせれば、描画側は
  「足元の中心を、占有ブロックの手前角に合わせる」だけで済む(絵は焼き直さなくてよい)。

測り方（接地菱形の稜線に当てる）:
  1. アルファ128以上を不透明とみなし、列ごとの最下点 ylow(x) を取る
  2. 最下点 (xb,yb) が接地菱形の手前角。菱形は 2:1 なので、そこから左右へ傾き ±0.5 で
     稜線が伸びる。ylow(x) がその稜線の近く(許容 tol)にある列を「床に着いている」とみなす
  3. 着いている列の左右端 = 足元の幅、中点 = 足元の中心

  「bbox の下から N% の帯」で測ってはいけない。アイソメでは椅子の4本脚のうち
  手前の1本だけが最下点になるので、帯では足元幅が実際の 1/4 ほどに出る(実測で 17%)。
  稜線で測ると4本とも拾える。

出力(値は画像サイズに対する比。焼き直しても比なら生き残る):
  { "<name>": { "cx":足元の中心x, "by":接地の下端y, "bw":足元の幅, "w":全体の幅, "h":全体の高さ,
                "left":bboxの左, "right":bboxの右, "flags":[...] } }

flags は「自動測定が当てにならない疑いがある個体」の目印。検収ページ(tools/preview/props.html)で
絞り込んで目視するためのもので、値そのものは信用してよい個体にも付くことがある。
  narrowBase … 足元が bbox 幅の 1/4 未満。脚1本・吊り下げなど、下端が接地面とは限らない
  skew       … 足元の中心が bbox 中心から 15% 以上ずれている。今まさに端に寄って見えていた個体
  wide       … 全体幅が足元幅の 2.2 倍超。上に大きく張り出すので幅のクランプが効く
  edge       … bbox が画像の端に接している。シートで切れている疑い
*/
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = path.join(ROOT, 'assets', 'props');
const OUT = path.join(DIR, 'prop-fit.json');

const SLOPE = 0.5;          // アイソメ 2:1 の稜線の傾き（画面px/画面px）
const TOL = 0.06;           // 稜線からの許容ズレ / bbox の高さ。絵のガタつきと影のぶん
const ALPHA = 128;          // 不透明とみなすアルファ
const NARROW = 0.25, SKEW = 0.15, WIDE = 2.2;

/* PNG(8bit RGBA/RGB, インタレース無し)を展開する。Pillow が入っていない環境でも動くよう zlib だけで読む */
function readPNG(file){
  const b = fs.readFileSync(file);
  let off = 8, w = 0, h = 0, bd = 0, ct = 0; const idat = [];
  while(off < b.length){
    const len = b.readUInt32BE(off), type = b.toString('ascii', off+4, off+8);
    const data = b.subarray(off+8, off+8+len);
    if(type === 'IHDR'){ w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if(type === 'IDAT') idat.push(data);
    else if(type === 'IEND') break;
    off += 12 + len;
  }
  if(bd !== 8 || (ct !== 6 && ct !== 2)) throw new Error(`未対応のPNG (bitDepth=${bd} colorType=${ct})`);
  const ch = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  let p = 0;
  for(let y = 0; y < h; y++){
    const ft = raw[p++]; const line = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y*stride, (y+1)*stride), prev = y ? out.subarray((y-1)*stride, y*stride) : null;
    for(let i = 0; i < stride; i++){
      const a = i >= ch ? cur[i-ch] : 0, up = prev ? prev[i] : 0, ul = (prev && i >= ch) ? prev[i-ch] : 0;
      let v = line[i];
      if(ft === 1) v += a;
      else if(ft === 2) v += up;
      else if(ft === 3) v += (a + up) >> 1;
      else if(ft === 4){ const pa = Math.abs(up-ul), pb = Math.abs(a-ul), pc = Math.abs(a+up-2*ul);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? up : ul); }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, px: out };
}

/* 1枚ぶんの実測。戻り値は画像サイズに対する比 */
function measure(file){
  const { w, h, ch, px } = readPNG(file);
  const low = new Int32Array(w).fill(-1);                   // 列ごとの最下点
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for(let y = 0; y < h; y++){
    for(let x = 0; x < w; x++){
      const a = ch === 4 ? px[(y*w+x)*ch+3] : 255;
      if(a < ALPHA) continue;
      if(y > low[x]) low[x] = y;
      if(x < x0) x0 = x; if(x > x1) x1 = x;
      if(y < y0) y0 = y; if(y > y1) y1 = y;
    }
  }
  if(y1 < 0) return null;                                   // 中身が空
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  /* 接地菱形の手前角を「一番下の点」で決めてはいけない。ランプの垂れた紐のような
     孤立ピクセルが1つあるだけで角がそこへ飛び、足元が1pxになる(実測 tky_lamp)。
     下の方にある点を順に手前角の候補にして、稜線に乗る列が一番多い候補を採る。 */
  const tol = Math.max(2, bh * TOL);
  /* 候補(xb,yb)の当てはまり。稜線 y = yb - |x-xb|*0.5 に対して
       ・稜線より下へ出る列があれば無効（床から突き抜けている＝手前角がそこではない）
       ・稜線の上 tol 以内にある列を「床に着いている」と数える
     「下へ出てはいけない」制約が要る。これが無いと、稜線を高く取るほど条件が緩くなるので
     当てはまり最大の候補が宙に浮く(chair の手前角が絵の 86% の高さに出ていた)。 */
  const fitRidge = (xb, yb) => { let n = 0, a = xb, b = xb;
    for(let x = x0; x <= x1; x++){
      if(low[x] < 0) continue;
      const ridge = yb - Math.abs(x - xb) * SLOPE;
      if(low[x] > ridge + tol) return null;
      if(low[x] >= ridge - tol){ n++; if(x < a) a = x; if(x > b) b = x; } }
    return { n, a, b }; };
  let best = null;
  for(let x = x0; x <= x1; x++){
    if(low[x] < 0 || low[x] < y1 - bh * 0.2) continue;             // 下の方の点だけ候補にする
    const r = fitRidge(x, low[x]);
    if(r && (!best || r.n > best.n || (r.n === best.n && r.b - r.a > best.b - best.a))) best = { ...r, xb:x, yb:low[x] };
  }
  if(!best) best = { a:x0, b:x1, xb:(x0+x1)/2, yb:y1 };            // 当てはまらない絵は bbox で代用
  const fx0 = best.a, fx1 = best.b, yb = best.yb;
  let footW = fx1 - fx0 + 1, footCx = (fx0 + fx1 + 1) / 2;
  const flags = [];
  if(footW / bw < NARROW){
    /* 足元が bbox の 1/4 未満 = 稜線に乗ったのが紐や脚1本だけ、という失敗の形。
       そのまま使うと「その1本をマス幅に合わせる」ので絵が数倍に膨らむ。
       bbox で代用して安全側(=従来と同じ幅基準)に倒し、flag で拾えるようにする。 */
    flags.push('narrowBase');
    footW = bw; footCx = (x0 + x1 + 1) / 2;
  }
  if(Math.abs(footCx - (x0 + x1 + 1) / 2) / bw > SKEW) flags.push('skew');
  if(bw / footW > WIDE) flags.push('wide');
  /* 画像の端に「長く」触れている＝シートで切れている疑い。1点触れているだけの絵は多い
     (焼き込みが枠いっぱいに詰めるため)ので、辺の1/4以上に渡って触れている時だけ疑う */
  const run = (get, n) => { let c = 0; for(let i = 0; i < n; i++) if(get(i)) c++; return c; };
  const opaque = (x, y) => (ch === 4 ? px[(y*w+x)*ch+3] : 255) >= ALPHA;
  if(run(y => opaque(0, y), h) > bh/4 || run(y => opaque(w-1, y), h) > bh/4
     || run(x => opaque(x, h-1), w) > bw/4) flags.push('edge');
  const r = (v) => Math.round(v * 10000) / 10000;
  return { cx: r(footCx / w), by: r((yb + 1) / h), bw: r(footW / w),
    w: r(bw / w), h: r(bh / h), left: r(x0 / w), right: r((x1 + 1) / w), px: [w, h], flags };
}

/* 手で直す個体。[足元の中心x, 足元の幅] を画像の幅に対する比で書く。
   稜線が当たらない絵(紐が垂れている / 脚が1本しか下まで来ていない)は自動測定が外れる。
   検収ページ tools/preview/props.html を flag で絞り込んで見て、おかしいものをここに足す。
   fit_props.py の BRIGHTEN / LEVELS / FLIP と同じ「個別の例外だけ表に持つ」やり方。 */
const OVERRIDE = {
  // 'cab_lamp': [0.50, 0.45],
};

const files = fs.readdirSync(DIR).filter(f => /^prop_.*\.png$/.test(f)).sort();
const fit = {}, bad = [];
for(const f of files){
  const name = f.replace(/^prop_|\.png$/g, '');
  try{
    const m = measure(path.join(DIR, f));
    if(!m){ bad.push(`${name}: 中身が空`); continue; }
    const o = OVERRIDE[name];
    if(o){ m.cx = o[0]; m.bw = o[1]; m.flags = m.flags.filter(x => x !== 'narrowBase' && x !== 'skew' && x !== 'wide').concat('manual'); }
    fit[name] = m;
  }catch(e){ bad.push(`${name}: ${e.message}`); }
}
fs.writeFileSync(OUT, JSON.stringify(fit, null, 0) + '\n');

const all = Object.entries(fit);
const count = (k) => all.filter(([, m]) => m.flags.includes(k)).length;
console.log(`${all.length}体を測って ${path.relative(ROOT, OUT)} に書きました`);
console.log(`  narrowBase ${count('narrowBase')}  skew ${count('skew')}  wide ${count('wide')}  edge ${count('edge')}`);
console.log(`  いずれかに該当 ${all.filter(([, m]) => m.flags.length).length}体 / 無印 ${all.filter(([, m]) => !m.flags.length).length}体`);
if(bad.length) console.log('読めなかった:', bad);

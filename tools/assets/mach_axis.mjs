/* 製造機スプライトの「長軸の向き」を検査する。依存ゼロ（Node標準のzlibだけでPNGを読む）。
 *
 *   検査: node tools/assets/mach_axis.mjs
 *   修正: node tools/assets/mach_axis.mjs --fix            （向きが逆のテーマを左右反転する）
 *         node tools/assets/mach_axis.mjs --fix normal     （テーマを指定して反転する）
 *
 * なぜ必要か:
 *   ゲームは「素材は +u（右斜め下 ↘）に伸びる1種類だけ」を前提にしていて、もう一方の対角は
 *   game/main.js が実行時に左右反転して使う（_machFlipTex）。この前提が破れている絵は、
 *   影・占有マス・素材アイコンが正しい向きに並ぶのに**本体の絵だけが直交した向きに見える**。
 *   tools/assets/cut_machines.py は合成時に向きを揃えるが、それ以前に作られた絵は素通しなので、
 *   ここで検査してテスト(test/test_machines.mjs)から守る。
 *
 * 判定のしかた:
 *   列ごとに「不透明な最初のピクセルのy」を取り、左端1/6と右端1/6の平均を比べる。
 *   右へ行くほど下がる(+) なら ↘ = +u、上がる(−) なら ↗ = −v。
 *   天面のシルエットは長軸に沿うので、意匠に関係なくこの符号で向きが分かる。
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const ASSETS = path.join(import.meta.dirname, '..', '..', 'assets', 'machines');
/** 判定に使うサイズ。マス数が多いほど長軸がはっきり出る */
const PROBE_SIZE = 5;
/** これ以下の傾きは「判定できない」として扱う（±1マスの送りは約14px） */
const MIN_SLOPE = 5;

/* ------------------------------- PNG 読み書き ------------------------------- */
export function readPng(file) {
  const b = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8);
    const d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bitDepth = d[8]; colorType = d[9]; }
    if (type === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (bitDepth !== 8 || !ch) throw new Error(`${path.basename(file)}: 未対応のPNG (bitDepth=${bitDepth}, colorType=${colorType})`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, px = Buffer.alloc(h * stride);
  let q = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[q++], line = raw.subarray(q, q + stride); q += stride;
    const cur = px.subarray(y * stride, (y + 1) * stride);
    const prev = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, bb = prev ? prev[i] : 0, c = (prev && i >= ch) ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += bb;
      else if (f === 3) v += (a + bb) >> 1;
      else if (f === 4) {
        const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? bb : c);
      }
      cur[i] = v & 255;
    }
  }
  return { w, h, ch, px };
}

const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (buf) => { let c = 0xffffffff; for (const x of buf) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}
export function writePng(file, { w, h, ch, px }) {
  const raw = Buffer.alloc((w * ch + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) { raw[p++] = 0; px.copy(raw, p, y * w * ch, (y + 1) * w * ch); p += w * ch; }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = { 1: 0, 2: 4, 3: 2, 4: 6 }[ch]; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
export function flipX({ w, h, ch, px }) {
  const out = Buffer.alloc(px.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * ch, d = (y * w + (w - 1 - x)) * ch;
    px.copy(out, d, s, s + ch);
  }
  return { w, h, ch, px: out };
}

/* ------------------------------- 向きの判定 ------------------------------- */
/** @returns {{slope:number, axis:'u'|'v'|'?'}} slope>0 なら ↘(+u) */
export function axisOf(file) {
  const { w, h, ch, px } = readPng(file);
  // 列ごとに「不透明な最後のy」= 接地側のシルエットを取る。
  // 上端で測ると、背の高い背面装飾(頭骨・万国旗・太陽電池パネルなど)に引っぱられて
  // 符号が反転する。接地側は必ず台の底面をなぞるので装飾に影響されない。
  const bottom = [];
  for (let x = 0; x < w; x++) {
    for (let y = h - 1; y >= 0; y--) {
      const i = (y * w + x) * ch;
      const a = (ch === 4 || ch === 2) ? px[i + ch - 1] : 255;
      if (a > 32) { bottom.push([x, y]); break; }
    }
  }
  const top = bottom;
  if (top.length < 12) return { slope: 0, axis: '?' };
  const band = Math.floor(top.length / 6);
  const avg = (arr) => arr.reduce((s, t) => s + t[1], 0) / arr.length;
  const slope = Math.round(avg(top.slice(-band)) - avg(top.slice(0, band)));
  return { slope, axis: slope > MIN_SLOPE ? 'u' : slope < -MIN_SLOPE ? 'v' : '?' };
}

const themeFile = (theme, n) => path.join(ASSETS, `mach-${theme}-s${n}.png`);
/** assets にある製造機テーマを列挙する */
export function themes() {
  return [...new Set(fs.readdirSync(ASSETS)
    .map((f) => /^mach-(.+)-s\d\.png$/.exec(f))
    .filter(Boolean).map((m) => m[1]))].sort();
}
/** 全テーマの判定。{theme, slope, axis, ok}[] */
export function report() {
  return themes().map((theme) => {
    const f = themeFile(theme, PROBE_SIZE);
    if (!fs.existsSync(f)) return { theme, slope: 0, axis: '?', ok: false, missing: true };
    const { slope, axis } = axisOf(f);
    return { theme, slope, axis, ok: axis === 'u' };
  });
}

/* --------------------------------- CLI --------------------------------- */
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const args = process.argv.slice(2);
  const fix = args.includes('--fix');
  const only = args.filter((a) => !a.startsWith('--'));
  const rows = report().filter((r) => !only.length || only.includes(r.theme));
  const label = { u: '↘ +u (正)', v: '↗ -v (逆)', '?': '判定不能' };
  for (const r of rows) console.log(`  ${r.theme.padEnd(12)} slope=${String(r.slope).padStart(4)}  ${label[r.axis]}`);
  const bad = rows.filter((r) => r.axis === 'v');
  if (!bad.length) { console.log(`\n${rows.length} テーマすべて +u（右斜め下）`); process.exit(0); }
  console.log(`\n向きが逆: ${bad.map((b) => b.theme).join(', ')}`);
  if (!fix) { console.log('--fix を付けると左右反転して揃えます'); process.exit(1); }
  for (const b of bad) {
    for (const f of fs.readdirSync(ASSETS).filter((f) => new RegExp(`^mach-${b.theme}-s\\d\\.png$`).test(f))) {
      const p = path.join(ASSETS, f);
      writePng(p, flipX(readPng(p)));
      console.log(`  反転: ${f}`);
    }
  }
  const after = report().filter((r) => bad.some((b) => b.theme === r.theme));
  for (const r of after) console.log(`  → ${r.theme}: ${label[r.axis]}`);
  process.exit(after.every((r) => r.ok) ? 0 : 1);
}

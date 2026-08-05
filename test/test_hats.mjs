// 被り物アセット(assets/hats)と較正(hat-fit.json)の整合を検証する。
// 実行: node test/test_hats.mjs
// 画像そのものは見ないが、「読み込まれない絵」「較正の無い絵」「重すぎる絵」は落とす。
import fs from 'node:fs';
import path from 'node:path';

import { SKIN } from '../game/data/econ.mjs';

const DIR = 'assets/hats';
const MAX_KB = 64;        // 実寸は横17〜46px。1枚64KBを超えたら shrink_hats.py 通し忘れ
const MAX_SIDE = 320;     // 同じく、長辺320pxを超えたら縮小し忘れ

let fail = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok  ' : 'FAIL  ') + msg); if (!cond) fail++; };

/* PNG の IHDR と tRNS だけ読む(依存を増やさないため手で解く) */
function pngInfo(buf) {
  const sig = buf.subarray(0, 8).toString('hex');
  const info = { sig, width: buf.readUInt32BE(16), height: buf.readUInt32BE(20),
                 depth: buf[24], colorType: buf[25], trns: false };
  let p = 8;
  while (p + 8 <= buf.length) {
    const len = buf.readUInt32BE(p), type = buf.subarray(p + 4, p + 8).toString('ascii');
    if (type === 'tRNS') info.trns = true;
    if (type === 'IEND') break;
    p += 12 + len;
  }
  return info;
}

const fit = JSON.parse(fs.readFileSync(path.join(DIR, 'hat-fit.json'), 'utf8'));
const files = fs.readdirSync(DIR).filter(f => f.startsWith('hat-') && f.endsWith('.png'));
const ids = Object.keys(fit);
const themes = new Set(Object.keys(SKIN));

console.log(`\n[1] hat-fit.json のキー(${ids.length}件)`);
ok(ids.length > 0, 'キーがある');
ok(!('none' in fit), "'none' は入っていない(デフォルト=被り物なし)");
for (const id of ids) ok(themes.has(id), `${id}: econ.mjs の SKIN にテーマがある`);

console.log('\n[2] 画像とキーが一対一');
// preload は hat-fit.json のキーだけ読む。キーの無い PNG は永久に使われない(=消し忘れ)
for (const id of ids) ok(files.includes(`hat-${id}.png`), `${id}: hat-${id}.png がある`);
for (const f of files) ok(ids.includes(f.slice(4, -4)), `${f}: hat-fit.json にキーがある`);

console.log('\n[3] 較正の値が現実的な範囲');
for (const [id, e] of Object.entries(fit)) {
  ok(typeof e.cx === 'number' && e.cx > 0 && e.cx < 1, `${id}: cx=${e.cx} は 0〜1`);
  const dy = e.dy === undefined ? 0 : e.dy;
  ok(typeof dy === 'number' && dy >= -4 && dy <= 24, `${id}: dy=${dy} は -4〜24 ドット`);
  const w = e.w === undefined ? 19 : e.w;
  ok(typeof w === 'number' && w >= 4 && w <= 40, `${id}: w=${w} は 4〜40 ドット`);
  ok(Object.keys(e).every(k => ['cx', 'dy', 'w'].includes(k)), `${id}: 知らないキーが無い`);
}

console.log('\n[4] ゲームに載せる画像は軽量(PNG8・縮小済み)');
for (const f of files.sort()) {
  const buf = fs.readFileSync(path.join(DIR, f));
  const i = pngInfo(buf), kb = Math.round(buf.length / 1024);
  ok(i.sig === '89504e470d0a1a0a', `${f}: PNG である`);
  ok(i.colorType === 3, `${f}: パレット(PNG8)である colorType=${i.colorType}`);
  ok(i.trns, `${f}: 透過(tRNS)を持つ`);
  ok(Math.max(i.width, i.height) <= MAX_SIDE, `${f}: 長辺 ${Math.max(i.width, i.height)}px <= ${MAX_SIDE}`);
  ok(kb <= MAX_KB, `${f}: ${kb}KB <= ${MAX_KB}KB`);
}

console.log(fail ? `\n❌ ${fail} 件 失敗` : `\n✅ 被り物アセット ${files.length} 件 OK`);
process.exit(fail ? 1 : 0);

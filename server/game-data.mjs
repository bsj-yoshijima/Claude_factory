// マスタデータ（ジャンル / 原材料 / 製品 / レシピ / 価格）をサーバ側に読み込む。
//
// 定義の正は factory-phaser.html の中の2ブロックのままにしてある:
//   ECON-DATA-START  … RAR / PRIZES / SELL / MACH / DECO / PROP / BG / FLOOR / SERIES
//   CRAFT-DATA-START … GENRES / MATS / PRODS / RECIPES / SECRETS / rollProduct
// クライアントとサーバで定義を二重に持つと必ずズレるので、切り出して評価する方式にした。
// （tools/test_craft.mjs が既に同じ手法で検証しており、実績のあるやり方）
//
// 将来この2ブロックを純粋な ESM に昇格させたら、ここは import 1行に置き換わる。
import fs from 'node:fs';
import vm from 'node:vm';

const HTML = new URL('../factory-phaser.html', import.meta.url);
const html = fs.readFileSync(HTML, 'utf8');

function cut(startMarker, endMarker) {
  const i = html.indexOf(startMarker);
  const j = html.indexOf(endMarker);
  if (i < 0 || j < 0) throw new Error(`マスタデータのマーカーが見つからない: ${startMarker}`);
  return html.slice(i, j + endMarker.length);
}

const ctx = vm.createContext({ console });
vm.runInContext(
  cut('/* == ECON-DATA-START ==', '/* == ECON-DATA-END == */') + '\n' +
  cut('/* == CRAFT-DATA-START ==', '/* == CRAFT-DATA-END == */') + '\n' +
  // 製造に必要な定数は CRAFT-DATA の外にあるので、ここで同じ値を明示的に持つ。
  // 変えるときは factory-phaser.html 側と揃えること（test_server.mjs が一致を検証する）。
  'globalThis.$ = {GENRES,GENRE,SECRET_G,MATS,MAT,PRODS,PROD,RECIPES,SECRETS,UNKNOWN_PRODUCT,' +
  'genreOf,genresOfMats,normPool,poolFor,rollProduct,' +
  'RAR,PRIZES,SELL,MACH,machVariant,lvCost,DECO,PROP,BG,FLOOR,SERIES};',
  ctx,
);

const $ = ctx.$;

/** 1製品あたりの必要WP = マス数 × WP_PER_SLOT（factory-phaser.html と同値） */
export const WP_PER_SLOT = 50;
/** 製品の売価（レア度別）。製品が完成した瞬間に 💰 に加算される */
export const PROD_PRICE = { 1: 60, 2: 200, 3: 700, 4: 2600, 5: 9000 };
/** 製造機のマス数。's2' → 2 */
export const sizeOf = (variant) =>
  Math.max(2, Math.min(5, Number(String(variant || 's2').slice(1)) || 2));
/** その機械が1製品作るのに必要な WP */
export const needWp = (variant) => sizeOf(variant) * WP_PER_SLOT;

/** 素材の集合 → レシピキー（重複除去してソートしカンマ結合） */
export function keyOfSlots(slots) {
  const set = [...new Set((slots || []).filter(Boolean))].sort();
  return set.length ? set.join(',') : null;
}

export const {
  GENRES, GENRE, SECRET_G, MATS, MAT, PRODS, PROD, RECIPES, SECRETS, UNKNOWN_PRODUCT,
  genreOf, genresOfMats, normPool, poolFor, rollProduct,
  RAR, PRIZES, SELL, MACH, machVariant, lvCost, DECO, PROP, BG, FLOOR, SERIES,
} = $;

/** 購入可能なものの値段を1箇所で引く。サーバ側の購入検証はすべてこれを通す。 */
export function priceOf(kind, id) {
  const table = { machine: MACH, prop: PROP, deco: DECO, bg: BG, floor: FLOOR, series: SERIES }[kind];
  if (!table) return null;
  const e = table[id];
  return e && typeof e.price === 'number' ? e.price : null;
}

export const summary = () =>
  `ジャンル${GENRES.length} / 原材料${MATS.length} / 製品${PRODS.length} / ` +
  `レシピ${Object.keys(RECIPES).length} / 隠し${Object.keys(SECRETS).length}`;

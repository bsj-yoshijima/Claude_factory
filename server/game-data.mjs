// マスタデータ（ジャンル / 原材料 / 製品 / レシピ / 価格）のサーバ側の入口。
//
// 定義の正は game/data/ の3モジュールで、クライアントもサーバもこれを import する。
// 以前は factory-phaser.html からマーカーで文字列を切り出して vm で評価していたが、
// ・HTML を分割できない
// ・ブロックの外にある定数（WP_PER_SLOT / PROD_PRICE）は手で二重管理になる
// という2つの制約があったので ESM に昇格させた。
//
// ここは「サーバから見た窓口」に徹する。マスタを増やすときは game/data/ を触ること。
export {
  RAR, PRIZES, SELL, MACH, machVariant, lvCost, DECO, PROP, BG, FLOOR, SERIES,
} from '../game/data/econ.mjs';
export {
  GENRES, GENRE, SECRET_G, MATS, MAT, PRODS, PROD, RECIPES, SECRETS, UNKNOWN_PRODUCT,
  genreOf, genresOfMats, normPool, poolFor, rollProduct, keyOfSlots,
} from '../game/data/craft.mjs';
export { WP_PER_SLOT, PROD_PRICE, sizeOf, needWp } from '../game/data/rules.mjs';

import { MACH, PROP, DECO, BG, FLOOR, SERIES } from '../game/data/econ.mjs';
import { GENRES, MATS, PRODS, RECIPES, SECRETS } from '../game/data/craft.mjs';

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

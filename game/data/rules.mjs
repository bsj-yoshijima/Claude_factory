/* 製造ルールの定数 — これまでクライアントとサーバで「同じ値を手で二重に持ち、
   test/test_server.mjs が一致を検証する」形だったものを1箇所に集めた。
   テストは両方を import するので、常駐プロセスが古いままのズレは検出できなかった。
   定義を1つにすれば、そもそもズレようがない。 */

/** 1製品あたりの必要WP = マス数 × WP_PER_SLOT（2マス4000 / 3マス6000 / 4マス8000 / 5マス10000） */
export const WP_PER_SLOT = 2000;

/** 製造機のマス数。's2' → 2。範囲外・未知の variant は2マス機に丸める */
export const sizeOf = (variant) =>
  Math.max(2, Math.min(5, Number(String(variant || 's2').slice(1)) || 2));

/** マス数から必要WPを出す（クライアントは機械オブジェクトの .size を持っている） */
export const needWpForSize = (size) => Math.max(1, size || 1) * WP_PER_SLOT;

/** variant から必要WPを出す（サーバはDBの variant 文字列を持っている） */
export const needWp = (variant) => needWpForSize(sizeOf(variant));

/** 製品の売価（レア度別）。製品が完成した瞬間に 💰 と売上に加算される */
export const PROD_PRICE = { 1: 50, 2: 100, 3: 250, 4: 500, 5: 1000 };

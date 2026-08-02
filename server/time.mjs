// 日付まわりの唯一の定義。
//
// 以前は同じ「JSTの暦日」の計算が wp.mjs / craft.mjs / ingest-otel.mjs の3箇所に
// バラバラの名前（jstDay / jstDayOf）で複製されていた。集計の境界を決める値なので、
// ここ1箇所だけに置いて全員が import する。

/** ミリ秒 → JST の暦日 'YYYY-MM-DD'（既定はいま） */
export const jstDay = (t = Date.now()) =>
  new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);

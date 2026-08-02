// 製造エンジン（サーバ権威）。
//
// 旧実装はブラウザの tickCraft() が製品を作り 💰 を足していたため、DevTools から
// いくらでも書き換えられた。リーダーボードを置く以上ここはサーバに移す必要がある。
//
// 副作用として、ブラウザを開いていなくても製造が進むようになる（tick は API 呼び出しの
// たびに遅延評価される）。旧実装の「1tickあたり20個まで」の刻みも不要になった。
import { tx, one, all } from './db.mjs';
import { totalWp } from './wp.mjs';
import { rollProduct, keyOfSlots, needWp, PROD, PROD_PRICE, BLOB } from './game-data.mjs';

// 病的なケースの保険。到達したら黙って捨てず必ず記録する（WP.md §4 と同じ方針）
const MAX_PER_MACHINE = 2000;

const jstDay = (t = Date.now()) => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * その人の製造を最新まで進める。
 *  - 稼いだWPは按分せず、稼働中の全機械にそれぞれ同額を加算する（旧実装と同じ）
 *  - 必要WPに達した「その時点」のマスの組み合わせで製品が決まる
 *  - 超過WPは次の製品に繰り越す
 * @returns {{delta:number, produced:Array, capped:number}}
 */
export async function tick(userId) {
  const wpNow = await totalWp(userId);

  /* 空振りの早期リターン。
     ポーリングのほとんどは「前回から WP が1も増えていない」状態で来る
     （OTLP の logs は5秒バッチなので、それより短い間隔で叩けば必ず空振りする）。
     ここでトランザクションを張ると、何も起きていないのに毎回 1 write が発生する。
     ロックを取らない SELECT で先に判定して、増えていなければ即座に返す。 */
  const peek = await one(
    `SELECT wp_mark, wp_mark_init FROM factories WHERE user_id=$1`, [userId]);
  if (!peek) return { delta: 0, produced: [], capped: 0 };
  if (peek.wp_mark_init && wpNow <= Number(peek.wp_mark)) {
    return { delta: 0, produced: [], capped: 0, noop: true };
  }

  return tx(async (c) => {
    const f = (await c.query(
      `SELECT wp_mark, wp_mark_init FROM factories WHERE user_id=$1 FOR UPDATE`,
      [userId])).rows[0];
    if (!f) return { delta: 0, produced: [], capped: 0 };

    // 初回は基準を取るだけ（工場を持つ前に稼いだWPを遡って入れない）
    if (!f.wp_mark_init) {
      await c.query(
        `UPDATE factories SET wp_mark=$2, wp_mark_init=true, last_tick_at=now() WHERE user_id=$1`,
        [userId, wpNow]);
      return { delta: 0, produced: [], capped: 0 };
    }

    // ロック取得までの間に他のリクエストが先に進めていたら何もしない
    const delta = Math.max(0, wpNow - Number(f.wp_mark));
    if (delta <= 0) return { delta: 0, produced: [], capped: 0, noop: true };

    const machines = (await c.query(
      `SELECT m.id, m.sub, m.wp,
              COALESCE(ARRAY_AGG(s.mat_id ORDER BY s.idx) FILTER (WHERE s.mat_id IS NOT NULL),
                       ARRAY[]::text[]) AS mats
         FROM machines m
         LEFT JOIN machine_slots s ON s.user_id = m.user_id AND s.machine_id = m.id
        WHERE m.user_id=$1 AND m.running
        GROUP BY m.user_id, m.id`,
      [userId])).rows;

    const produced = [];
    let capped = 0;

    for (const m of machines) {
      let wp = Number(m.wp) + delta;
      const need = needWp(m.sub);
      let n = 0;
      while (wp >= need && n < MAX_PER_MACHINE) {
        wp -= need;
        const key = keyOfSlots(m.mats);                 // ここで初めて組み合わせを見る
        const p = key ? rollProduct(key) : PROD[BLOB];  // 空なら「レシピに無い」扱い
        if (!p) break;
        produced.push({ machineId: m.id, product: p, key: key || '' });
        n++;
      }
      if (n >= MAX_PER_MACHINE) capped++;
      await c.query(`UPDATE machines SET wp=$3 WHERE user_id=$1 AND id=$2`, [userId, m.id, wp]);
    }

    if (produced.length) {
      await c.query(
        `INSERT INTO products_made(user_id, product_id, machine_id, recipe_key)
         SELECT $1, * FROM UNNEST($2::text[], $3::text[], $4::text[])`,
        [userId, produced.map((x) => x.product.id), produced.map((x) => x.machineId),
         produced.map((x) => x.key)]);
    }
    await c.query(
      `UPDATE factories SET wp_mark=$2, last_tick_at=now() WHERE user_id=$1`, [userId, wpNow]);

    return { delta, produced, capped };
  });
}

/**
 * 🎁完成品を開いたときの処理。
 * 旧実装と同じく「開いた瞬間」に図鑑登録と売上加算をする（作った瞬間ではない）。
 * @returns {{items:Array, gain:number, registered:number}}
 */
export async function claim(userId) {
  return tx(async (c) => {
    const rows = (await c.query(
      `UPDATE products_made SET viewed=true
        WHERE user_id=$1 AND NOT viewed
        RETURNING product_id, made_at, recipe_key`,
      [userId])).rows;
    if (!rows.length) return { items: [], gain: 0, registered: 0 };

    // 「初めて」の判定は登録『前』の図鑑で行う（同じ新製品が3個なら3個とも NEW）
    const had = new Set((await c.query(
      `SELECT product_id FROM dex WHERE user_id=$1`, [userId])).rows.map((r) => r.product_id));

    let gain = 0, registered = 0;
    const counts = new Map();
    const items = [];
    for (const r of rows) {
      const p = PROD[r.product_id];
      if (!p) continue;
      counts.set(p.id, (counts.get(p.id) || 0) + 1);
      gain += PROD_PRICE[p.r] || 0;
      if (!had.has(p.id)) registered++;
      items.push({ id: p.id, e: p.e, n: p.n, r: p.r, isNew: !had.has(p.id), at: r.made_at });
    }

    for (const [pid, n] of counts) {
      await c.query(
        `INSERT INTO dex(user_id, product_id, count, first_at) VALUES ($1,$2,$3,now())
         ON CONFLICT (user_id, product_id) DO UPDATE SET count = dex.count + EXCLUDED.count`,
        [userId, pid, n]);
    }
    if (gain) {
      // rev も上げる: 💰が変わったのでポーリング側に factory を送り直させる
      await c.query(`UPDATE factories SET money = money + $2, rev = rev + 1 WHERE user_id=$1`,
        [userId, gain]);
      await c.query(
        `INSERT INTO sales_daily(user_id, day, amount) VALUES ($1,$2,$3)
         ON CONFLICT (user_id, day) DO UPDATE SET amount = sales_daily.amount + EXCLUDED.amount`,
        [userId, jstDay(), gain]);
    }
    return { items, gain, registered };
  });
}

/** 未回収（🎁バッジに出す）件数 */
export const pendingCount = async (userId) =>
  Number((await one(
    `SELECT COUNT(*)::int AS n FROM products_made WHERE user_id=$1 AND NOT viewed`,
    [userId]))?.n || 0);

/** 📊今日の製造（JST）。7日トリムは廃止したので月次も引ける */
export const madeBetween = (userId, fromDay, toDay) => all(
  `SELECT product_id, made_at, recipe_key FROM products_made
    WHERE user_id=$1
      AND (made_at AT TIME ZONE 'Asia/Tokyo')::date BETWEEN $2 AND $3
    ORDER BY made_at DESC LIMIT 2000`,
  [userId, fromDay, toDay]);

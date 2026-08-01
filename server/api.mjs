// ゲーム API。💰・図鑑・在庫を書き換えるのはここだけ（クライアントは結果を受け取る）。
import { q, one, all, tx } from './db.mjs';
import { totalWp, todayWp, dailyWp, capStats, jstDay, WP } from './wp.mjs';
import { activeAgents } from './ingest-hooks.mjs';
import { tick, claim, pendingCount, madeBetween } from './craft.mjs';
import * as GD from './game-data.mjs';

const jsonOk = (body) => ({ status: 200, body });
const bad = (msg, status = 400) => ({ status, body: { error: msg } });

/* ============================ 工場の現在値 ============================ */
async function factoryOf(userId) {
  const f = await one(`SELECT * FROM factories WHERE user_id=$1`, [userId]);
  const machines = await all(
    `SELECT m.id, m.sub, m.dir, m.cx, m.cy, m.lvl, m.running, m.wp,
            COALESCE(ARRAY_AGG(s.mat_id ORDER BY s.idx) FILTER (WHERE s.idx IS NOT NULL),
                     ARRAY[]::text[]) AS slots
       FROM machines m LEFT JOIN machine_slots s ON s.user_id=m.user_id AND s.machine_id=m.id
      WHERE m.user_id=$1 GROUP BY m.user_id, m.id ORDER BY m.id`, [userId]);
  return {
    money: Number(f.money),
    bg: f.bg, floor: f.floor,
    bgOwned: f.bg_owned, floorOwned: f.floor_owned, seriesOwned: f.series_owned,
    props: f.props, stock: f.stock, emojiDecos: f.emoji_decos,
    machines: machines.map((m) => ({
      id: m.id, sub: m.sub, dir: m.dir, cx: m.cx, cy: m.cy, lvl: m.lvl,
      running: m.running, wp: Number(m.wp),
      need: GD.needWp(m.sub),
      slots: m.slots,
    })),
  };
}

/**
 * ポーリングの唯一の入口。
 * 旧実装は /api/sessions(1.5秒) と /api/otel(3秒) の2本を叩いていた。実測すると
 * ブラウザのポーリングがテレメトリ受信の30倍のリクエストを生むので、1本に統合して
 * 間隔も2秒に落とす。クライアント側は document.visibilityState で止める。
 */
export async function getState(user) {
  const t = await tick(user.id);                 // 遅延評価: 開いていない間の分もここで進む
  const [wpTotal, wpToday, agents, pending, factory, sales] = await Promise.all([
    totalWp(user.id), todayWp(user.id), activeAgents(user.id), pendingCount(user.id),
    factoryOf(user.id),
    one(`SELECT COALESCE(amount,0) AS a FROM sales_daily WHERE user_id=$1 AND day=$2`,
      [user.id, jstDay()]),
  ]);
  const madeToday = await one(
    `SELECT COUNT(*)::int AS n FROM products_made
      WHERE user_id=$1 AND (made_at AT TIME ZONE 'Asia/Tokyo')::date = $2`,
    [user.id, jstDay()]);

  return jsonOk({
    ts: Date.now(),
    me: { id: user.id, email: user.email, name: user.name },
    wp: { total: wpTotal, today: wpToday },
    today: { made: Number(madeToday?.n || 0), sales: Number(sales?.a || 0) },
    pending,
    justProduced: t.produced.length,
    agents,
    busy: agents.filter((a) => a.working).length,
    idle: agents.filter((a) => !a.working).length,
    factory,
  });
}

/* ============================== 🎁完成品 ============================== */
export async function postClaim(user) {
  await tick(user.id);
  return jsonOk(await claim(user.id));
}

/* =============================== ショップ =============================== */
export async function postBuy(user, body) {
  const { kind, id } = body || {};
  const price = GD.priceOf(kind, id);
  if (price == null) return bad(`買えないものです: ${kind}/${id}`);

  return tx(async (c) => {
    const f = (await c.query(
      `SELECT money, bg_owned, floor_owned, series_owned, stock
         FROM factories WHERE user_id=$1 FOR UPDATE`, [user.id])).rows[0];

    // 内装は「所持していれば無料で再適用」。所持していなければ購入
    if (kind === 'bg' || kind === 'floor' || kind === 'series') {
      const col = { bg: 'bg_owned', floor: 'floor_owned', series: 'series_owned' }[kind];
      const owned = f[col] || [];
      if (!owned.includes(id)) {
        if (Number(f.money) < price) return bad('💰が足りません');
        await c.query(
          `UPDATE factories SET money = money - $2, ${col} = array_append(${col}, $3) WHERE user_id=$1`,
          [user.id, price, id]);
      }
      // 適用
      if (kind === 'bg') await c.query(`UPDATE factories SET bg=$2 WHERE user_id=$1`, [user.id, id]);
      if (kind === 'floor') await c.query(`UPDATE factories SET floor=$2 WHERE user_id=$1`, [user.id, id]);
      if (kind === 'series') {
        const S = GD.SERIES[id];
        await c.query(
          `UPDATE factories SET bg=$2, floor=$3,
                  bg_owned    = CASE WHEN $2 = ANY(bg_owned)    THEN bg_owned    ELSE array_append(bg_owned, $2) END,
                  floor_owned = CASE WHEN $3 = ANY(floor_owned) THEN floor_owned ELSE array_append(floor_owned, $3) END
            WHERE user_id=$1`, [user.id, S.sky, S.floor]);
      }
      return jsonOk({ ok: true, factory: await factoryOf(user.id) });
    }

    // machine / prop / deco は在庫に入る（設置は🔧編集から）
    if (Number(f.money) < price) return bad('💰が足りません');
    const stock = f.stock || { machine: {}, prop: {}, deco: {} };
    stock[kind] = stock[kind] || {};
    stock[kind][id] = (stock[kind][id] || 0) + 1;
    await c.query(`UPDATE factories SET money = money - $2, stock = $3 WHERE user_id=$1`,
      [user.id, price, JSON.stringify(stock)]);
    return jsonOk({ ok: true, factory: await factoryOf(user.id) });
  });
}

export async function postSell(user, body) {
  const itemId = String(body?.itemId || '');
  const prize = GD.PRIZES.find((p) => p.id === itemId);
  if (!prize) return bad(`売れないものです: ${itemId}`);
  return tx(async (c) => {
    const inv = (await c.query(
      `SELECT qty FROM inventory WHERE user_id=$1 AND item_id=$2 FOR UPDATE`,
      [user.id, itemId])).rows[0];
    const have = Number(inv?.qty || 0);
    const want = body?.qty === 'all' ? have : Math.max(1, Number(body?.qty) || 1);
    if (have < want || want <= 0) return bad('在庫がありません');
    const gain = (GD.SELL[prize.r] || 0) * want;
    await c.query(`UPDATE inventory SET qty = qty - $3 WHERE user_id=$1 AND item_id=$2`,
      [user.id, itemId, want]);
    await c.query(`UPDATE factories SET money = money + $2 WHERE user_id=$1`, [user.id, gain]);
    await c.query(
      `INSERT INTO sales_daily(user_id, day, amount) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, day) DO UPDATE SET amount = sales_daily.amount + EXCLUDED.amount`,
      [user.id, jstDay(), gain]);
    return jsonOk({ ok: true, gain, factory: await factoryOf(user.id) });
  });
}

export async function postLevelUp(user, body) {
  const id = String(body?.id || '');
  return tx(async (c) => {
    const m = (await c.query(
      `SELECT lvl FROM machines WHERE id=$1 AND user_id=$2 FOR UPDATE`, [id, user.id])).rows[0];
    if (!m) return bad('その製造機がありません');
    const cost = GD.lvCost(m.lvl);
    const f = (await c.query(`SELECT money FROM factories WHERE user_id=$1 FOR UPDATE`,
      [user.id])).rows[0];
    if (Number(f.money) < cost) return bad('💰が足りません');
    await c.query(`UPDATE factories SET money = money - $2 WHERE user_id=$1`, [user.id, cost]);
    await c.query(`UPDATE machines SET lvl = lvl + 1 WHERE user_id=$1 AND id=$2`, [user.id, id]);
    return jsonOk({ ok: true, factory: await factoryOf(user.id) });
  });
}

/* ============================ レイアウト / 機械 ============================ */
/** 配置の保存。在庫数を超える設置は拒否する（クライアントの申告を信じない） */
export async function putLayout(user, body) {
  const machines = Array.isArray(body?.machines) ? body.machines : [];
  const props = Array.isArray(body?.props) ? body.props : [];

  return tx(async (c) => {
    const f = (await c.query(`SELECT stock FROM factories WHERE user_id=$1 FOR UPDATE`,
      [user.id])).rows[0];
    const stock = f.stock || {};

    // 在庫チェック（製造機）
    const want = {};
    for (const m of machines) {
      const sub = GD.machSub(m.sub);
      want[sub] = (want[sub] || 0) + 1;
    }
    for (const [sub, n] of Object.entries(want)) {
      const owned = Number(stock.machine?.[sub] || 0);
      if (n > owned) return bad(`製造機 ${sub} の在庫が足りません（所持${owned} / 設置${n}）`);
    }

    const keep = machines.map((m) => String(m.id));
    await c.query(
      `DELETE FROM machines WHERE user_id=$1 AND NOT (id = ANY($2::text[]))`, [user.id, keep]);
    for (const m of machines) {
      await c.query(
        `INSERT INTO machines(id, user_id, sub, dir, cx, cy, lvl)
         VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,1))
         ON CONFLICT (user_id, id) DO UPDATE
           SET sub=EXCLUDED.sub, dir=EXCLUDED.dir, cx=EXCLUDED.cx, cy=EXCLUDED.cy`,
        [String(m.id), user.id, GD.machSub(m.sub), m.dir === 'v' ? 'v' : 'u',
         Number(m.cx) | 0, Number(m.cy) | 0, Number(m.lvl) || 1]);
    }
    await c.query(`UPDATE factories SET props=$2 WHERE user_id=$1`,
      [user.id, JSON.stringify(props)]);
    return jsonOk({ ok: true, factory: await factoryOf(user.id) });
  });
}

/** マスに素材をセットする。素材を変えても WP はリセットしない（旧実装と同じ） */
export async function putSlots(user, body) {
  const id = String(body?.id || '');
  const slots = Array.isArray(body?.slots) ? body.slots : [];
  const m = await one(`SELECT sub FROM machines WHERE id=$1 AND user_id=$2`, [id, user.id]);
  if (!m) return bad('その製造機がありません');
  const size = GD.sizeOf(m.sub);
  await tx(async (c) => {
    await c.query(`DELETE FROM machine_slots WHERE user_id=$1 AND machine_id=$2`, [user.id, id]);
    for (let i = 0; i < size; i++) {
      const mat = slots[i] && GD.MAT[slots[i]] ? slots[i] : null;
      await c.query(`INSERT INTO machine_slots(user_id, machine_id, idx, mat_id) VALUES ($1,$2,$3,$4)`,
        [user.id, id, i, mat]);
    }
  });
  return jsonOk({ ok: true, factory: await factoryOf(user.id) });
}

export async function putRunning(user, body) {
  const id = String(body?.id || '');
  const r = await q(`UPDATE machines SET running=$3 WHERE id=$1 AND user_id=$2`,
    [id, user.id, !!body?.running]);
  if (!r.rowCount) return bad('その製造機がありません');
  return jsonOk({ ok: true, factory: await factoryOf(user.id) });
}

/* ================================ スキン ================================ */
export async function putSkin(user, body) {
  const project = String(body?.project || '');
  const skinId = String(body?.skinId || 'none');
  if (!project) return bad('project が必要です');
  if (skinId === 'none') await q(`DELETE FROM skins WHERE user_id=$1 AND project=$2`, [user.id, project]);
  else await q(
    `INSERT INTO skins(user_id, project, skin_id) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, project) DO UPDATE SET skin_id=EXCLUDED.skin_id`,
    [user.id, project, skinId]);
  return jsonOk({ ok: true, skins: await skinsOf(user.id) });
}
export const skinsOf = async (userId) =>
  Object.fromEntries((await all(`SELECT project, skin_id FROM skins WHERE user_id=$1`, [userId]))
    .map((r) => [r.project, r.skin_id]));

/* ================================ 図鑑 ================================ */
export async function getDex(user) {
  const rows = await all(
    `SELECT product_id, count, first_at FROM dex WHERE user_id=$1`, [user.id]);
  return jsonOk({
    dex: Object.fromEntries(rows.map((r) => [r.product_id, { n: r.count, firstAt: r.first_at }])),
    inv: Object.fromEntries((await all(
      `SELECT item_id, qty FROM inventory WHERE user_id=$1 AND qty>0`, [user.id]))
      .map((r) => [r.item_id, r.qty])),
  });
}

/* ============================= リーダーボード =============================
   WP.md §9 の原則どおり、単一の合計値は作らず多軸のまま返す。
   期間フィルタ（日次 / 週次 / 月次）は旧実装に無かった機能（§8 ⑧）。 */
const PERIODS = {
  today: () => [jstDay(), jstDay()],
  week: () => { const d = new Date(Date.now() + 9 * 3600e3); d.setUTCDate(d.getUTCDate() - 6);
    return [d.toISOString().slice(0, 10), jstDay()]; },
  month: () => [jstDay().slice(0, 8) + '01', jstDay()],
  all: () => ['1970-01-01', jstDay()],
};

export async function getLeaderboard(_user, query) {
  const period = PERIODS[query.get('period')] ? query.get('period') : 'week';
  const [from, to] = PERIODS[period]();
  const rows = await all(
    `SELECT u.id, u.email, u.name,
            SUM(s.lines_added) AS lines_added, SUM(s.lines_removed) AS lines_removed,
            SUM(s.commits) AS commits, SUM(s.prs) AS prs,
            SUM(s.output_tokens) AS output_tokens,
            SUM(s.skill) AS skill, SUM(s.agent) AS agent, SUM(s.custom_agent) AS custom_agent,
            SUM(s.sub_tool_uses) AS sub_tool_uses, SUM(s.tools_ok) AS tools_ok,
            SUM(s.active_time_sec) AS active_time_sec,
            COUNT(DISTINCT s.day) AS active_days,
            COALESCE((SELECT SUM(wp) FROM wp_daily w
                       WHERE w.user_id=u.id AND w.day BETWEEN $1 AND $2), 0) AS wp
       FROM scorecard_daily s JOIN users u ON u.id = s.user_id
      WHERE s.day BETWEEN $1 AND $2
      GROUP BY u.id`, [from, to]);

  // 効率スコア。最低成果フィルタが無いと「3行しか書いていない人」が1位になる（WP.md §9）
  const EFF = { removed: 0.3, prLines: 150, scale: 1000, minPrs: 1, minLines: 100 };
  const sc = rows.map((r) => {
    const linesAdded = Number(r.lines_added), linesRemoved = Number(r.lines_removed);
    const lines = linesAdded + linesRemoved;
    const prs = Number(r.prs), out = Number(r.output_tokens);
    const outcome = linesAdded + linesRemoved * EFF.removed + prs * EFF.prLines;
    const eligible = prs >= EFF.minPrs && lines >= EFF.minLines;
    const toolsOk = Number(r.tools_ok), subUses = Number(r.sub_tool_uses);
    return {
      id: r.id, email: r.email, name: r.name || r.email.split('@')[0],
      linesAdded, linesRemoved, lines, commits: Number(r.commits), prs,
      skill: Number(r.skill), agent: Number(r.agent), customAgent: Number(r.custom_agent),
      delegationPct: toolsOk ? +(subUses / toolsOk * 100).toFixed(1) : 0,
      activeDays: Number(r.active_days),
      activeHours: +(Number(r.active_time_sec) / 3600).toFixed(1),
      wp: Math.round(Number(r.wp)),
      efficiency: eligible && out ? +(outcome / out * EFF.scale).toFixed(3) : null,
      eligible,
    };
  });
  return jsonOk({ period, from, to, scorecard: sc, config: EFF });
}

/* ============================== マイページ ============================== */
export async function getMe(user, ingestToken) {
  const [daily, cap, dexN] = await Promise.all([
    dailyWp(user.id), capStats(user.id),
    one(`SELECT COUNT(*)::int AS n, COALESCE(SUM(count),0)::int AS total FROM dex WHERE user_id=$1`,
      [user.id]),
  ]);
  const sales = await all(
    `SELECT day, amount FROM sales_daily WHERE user_id=$1 ORDER BY day DESC LIMIT 90`, [user.id]);
  const made = await all(
    `SELECT (made_at AT TIME ZONE 'Asia/Tokyo')::date AS day, COUNT(*)::int AS n
       FROM products_made WHERE user_id=$1 GROUP BY 1 ORDER BY 1 DESC LIMIT 90`, [user.id]);
  return jsonOk({
    me: { id: user.id, email: user.email, name: user.name },
    ingestToken,
    weights: WP,
    wpDaily: daily, cap,
    dex: { unique: Number(dexN?.n || 0), total: Number(dexN?.total || 0), all: GD.PRODS.length },
    salesDaily: sales, madeDaily: made,
  });
}

export async function getMade(user, query) {
  const to = query.get('to') || jstDay();
  const from = query.get('from') || to;
  return jsonOk({ from, to, made: await madeBetween(user.id, from, to) });
}

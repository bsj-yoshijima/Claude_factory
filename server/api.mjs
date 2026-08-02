// ゲーム API。💰・図鑑・在庫を書き換えるのはここだけ（クライアントは結果を受け取る）。
import { q, one, all, tx } from './db.mjs';
import { totalWp, todayWp, dailyWp, capStats, jstDay, WP } from './wp.mjs';
import { activeAgents } from './ingest-hooks.mjs';
import { tick, claim, pendingCount, madeBetween } from './craft.mjs';
import * as GD from './game-data.mjs';
import { displayName, defaultFactoryName, normalizeFactoryName } from './names.mjs';

const jsonOk = (body) => ({ status: 200, body });
const bad = (msg, status = 400) => ({ status, body: { error: msg } });

/* 工場名は factories.name（DB）が唯一の真実。アカウント作成時に既定名が入っているので、
   表示側で組み立て直さない。ここで使うのは「空にされたときに戻す既定値」だけ。 */

/* 工場の「形」（配置・在庫・所持品・💰・内装）が変わったら版番号を上げる。
   ポーリングはこの rev を見て、factory 一式を送るかどうかを決める。
   製造の tick は機械の wp しか動かさないので rev は上げない。 */
const bumpRev = (c, userId) =>
  (c || { query: (t, p) => q(t, p) }).query(
    `UPDATE factories SET rev = rev + 1 WHERE user_id=$1`, [userId]);

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
    rev: Number(f.rev),
    money: Number(f.money),
    name: f.name || '',
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
 *
 * 旧実装は /api/sessions(1.5秒) と /api/otel(3秒) の2本を叩いていた。実測すると
 * ブラウザのポーリングはテレメトリ受信の30倍のリクエストを生むので1本にまとめ、
 * さらに次の3つで削っている:
 *   1. factory（配置・在庫・所持品）は rev が変わったときだけ積む
 *      … 実測でレスポンス 3,499B のうち 2,351B がこの「変わらない部分」だった
 *   2. 間隔は5秒。OTLP の logs バッチが5秒なので、それより速く叩いても新しい値は無い
 *   3. tick は WP が増えていなければトランザクションを張らない（空振りの書き込みを止める）
 * クライアント側は document.visibilityState が hidden の間ポーリングを止める。
 */
export async function getState(user, query) {
  const t = await tick(user.id);                 // 遅延評価: 開いていない間の分もここで進む
  const knownRev = Number(query?.get('rev') ?? -1);

  const [wpTotal, wpToday, agents, pending, head, sales, madeToday, live] = await Promise.all([
    totalWp(user.id), todayWp(user.id), activeAgents(user.id), pendingCount(user.id),
    one(`SELECT rev, money FROM factories WHERE user_id=$1`, [user.id]),
    one(`SELECT COALESCE(amount,0) AS a FROM sales_daily WHERE user_id=$1 AND day=$2`,
      [user.id, jstDay()]),
    one(`SELECT COUNT(*)::int AS n FROM products_made
          WHERE user_id=$1 AND (made_at AT TIME ZONE 'Asia/Tokyo')::date = $2`,
      [user.id, jstDay()]),
    // 毎回変わりうるのは機械の進捗だけ（実測 387B）。定義や配置は factory 側にある
    all(`SELECT id, wp, running FROM machines WHERE user_id=$1 ORDER BY id`, [user.id]),
  ]);
  const rev = Number(head?.rev || 0);

  const body = {
    ts: Date.now(),
    rev,
    me: { id: user.id, email: user.email, name: user.name },
    wp: { total: wpTotal, today: wpToday },
    today: { made: Number(madeToday?.n || 0), sales: Number(sales?.a || 0) },
    money: Number(head?.money || 0),
    machines: live.map((m) => ({ id: m.id, wp: Number(m.wp), running: m.running })),
    pending,
    justProduced: t.produced.length,
    agents,
    busy: agents.filter((a) => a.working).length,
    idle: agents.filter((a) => !a.working).length,
  };
  // クライアントが持っている版が古いときだけ工場一式を積む
  if (knownRev !== rev) body.factory = await factoryOf(user.id);
  return jsonOk(body);
}

/** 工場一式を明示的に取り直す（クライアントの復旧用） */
export const getFactory = async (user) => jsonOk({ factory: await factoryOf(user.id) });

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
      await bumpRev(c, user.id);
      return jsonOk({ ok: true, factory: await factoryOf(user.id) });
    }

    // machine / prop / deco は在庫に入る（設置は🔧編集から）
    if (Number(f.money) < price) return bad('💰が足りません');
    const stock = f.stock || { machine: {}, prop: {}, deco: {} };
    stock[kind] = stock[kind] || {};
    stock[kind][id] = (stock[kind][id] || 0) + 1;
    await c.query(`UPDATE factories SET money = money - $2, stock = $3 WHERE user_id=$1`,
      [user.id, price, JSON.stringify(stock)]);
    await bumpRev(c, user.id);
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
    await bumpRev(c, user.id);
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
    await bumpRev(c, user.id);
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
    await bumpRev(c, user.id);
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
    await bumpRev(c, user.id);
  });
  return jsonOk({ ok: true, factory: await factoryOf(user.id) });
}

export async function putRunning(user, body) {
  const id = String(body?.id || '');
  const r = await q(`UPDATE machines SET running=$3 WHERE id=$1 AND user_id=$2`,
    [id, user.id, !!body?.running]);
  if (!r.rowCount) return bad('その製造機がありません');
  await bumpRev(null, user.id);
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
   期間フィルタ（今日 / 今週 / 今月 / 今年）は旧実装に無かった機能（§8 ⑧）。 */
const PERIODS = {
  today: () => [jstDay(), jstDay()],
  week: () => { const d = new Date(Date.now() + 9 * 3600e3); d.setUTCDate(d.getUTCDate() - 6);
    return [d.toISOString().slice(0, 10), jstDay()]; },
  month: () => [jstDay().slice(0, 8) + '01', jstDay()],
  year: () => [jstDay().slice(0, 4) + '-01-01', jstDay()],
  all: () => ['1970-01-01', jstDay()],
};
/** 並べ替えできる軸。クライアントのボタンと1対1で対応する */
const LB_METRICS = ['efficiency', 'prs', 'commits', 'lines', 'skill', 'agent',
  'customAgent', 'delegationPct', 'activeDays'];

export async function getLeaderboard(_user, query) {
  const period = PERIODS[query.get('period')] ? query.get('period') : 'week';
  const [from, to] = PERIODS[period]();
  const rows = await all(
    `SELECT u.id, u.email, u.name, COALESCE(fa.name,'') AS factory_name,
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
                              LEFT JOIN factories fa ON fa.user_id = u.id
      WHERE s.day BETWEEN $1 AND $2
      GROUP BY u.id, fa.name`, [from, to]);

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
      id: r.id, email: r.email, name: displayName(r),
      // リーダーボードに出す名前は DB の工場名をそのまま（作成時に既定名が入っている）
      factoryName: r.factory_name || defaultFactoryName(r),   // 空は古い行の保険
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
  // 並べ替えとページング。limit を渡されたときだけ切る（渡さなければ全件＝旧来の挙動）
  const metric = LB_METRICS.includes(query.get('metric')) ? query.get('metric') : 'efficiency';
  const sorted = [...sc].sort((a, b) => {
    const av = a[metric], bv = b[metric];
    if (av == null && bv == null) return b.lines - a.lines;   // 効率ランク外どうしは変更行で
    if (av == null) return 1;                                 // ランク外は必ず後ろ
    if (bv == null) return -1;
    return bv - av || b.lines - a.lines;                      // 降順（1位が最上位）
  });
  const rawLimit = query.get('limit');
  const limit = rawLimit == null ? null : Math.min(200, Math.max(1, Number(rawLimit) || 20));
  const offset = Math.max(0, Number(query.get('offset')) || 0);
  const page = limit == null ? sorted : sorted.slice(offset, offset + limit);

  return jsonOk({
    period, from, to, metric,
    total: sorted.length, offset, limit,
    scorecard: page,
    config: EFF,
  });
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

/* ============================ マイページ(工場) ============================
   ハンバーガーメニューの 🏠マイページ が読む。
   直近 N 日（JST）の WP / 製造個数 / 売上を「日が抜けない」形にして返す。
   グラフは0の日も点として要るので、日付の穴埋めはここでやる（クライアントに任せない）。 */
const MYPAGE_MAX_DAYS = 90;

export async function getMyPage(user, query) {
  const days = Math.min(MYPAGE_MAX_DAYS,
    Math.max(2, Number(query?.get('days')) || 14));
  const to = jstDay();
  const from = jstDay(Date.now() - (days - 1) * 86400e3);

  const [f, wp, sales, made] = await Promise.all([
    one(`SELECT name FROM factories WHERE user_id=$1`, [user.id]),
    dailyWp(user.id, from, to),
    all(`SELECT day, amount FROM sales_daily WHERE user_id=$1 AND day BETWEEN $2 AND $3`,
      [user.id, from, to]),
    all(`SELECT (made_at AT TIME ZONE 'Asia/Tokyo')::date AS day, COUNT(*)::int AS n
           FROM products_made
          WHERE user_id=$1
            AND (made_at AT TIME ZONE 'Asia/Tokyo')::date BETWEEN $2 AND $3
          GROUP BY 1`, [user.id, from, to]),
  ]);

  // date 型は pg が Date で返すので、必ず JST の 'YYYY-MM-DD' に揃えてから突き合わせる
  const key = (d) => (typeof d === 'string' ? d.slice(0, 10) : jstDay(d.getTime()));
  const byDay = (rows, val) => Object.fromEntries(rows.map((r) => [key(r.day), Number(val(r))]));
  const wpMap = byDay(wp, (r) => r.wp);
  const salesMap = byDay(sales, (r) => r.amount);
  const madeMap = byDay(made, (r) => r.n);

  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = jstDay(Date.now() - i * 86400e3);
    series.push({
      day,
      wp: Math.round(wpMap[day] || 0),
      made: madeMap[day] || 0,
      sales: salesMap[day] || 0,
    });
  }
  const sum = (list, k) => list.reduce((a, d) => a + d[k], 0);
  const last7 = series.slice(-7);

  return jsonOk({
    // DB の工場名をそのまま返す（アカウント作成時に既定名が入っている）。
    // 万一 name が空の古い行に当たったときだけ既定名で埋める
    name: f?.name || defaultFactoryName(user),
    userName: displayName(user),
    defaultName: defaultFactoryName(user),   // 「空にすると戻る」先を画面に出すため
    from, to, days,
    series,
    totals7: { wp: sum(last7, 'wp'), made: sum(last7, 'made'), sales: sum(last7, 'sales') },
  });
}

/** 工場名の変更。空にすると既定名（◯◯の工場）に戻す。DB に名前なしの工場は作らない */
export async function putFactoryName(user, body) {
  const name = normalizeFactoryName(body?.name, user);
  await q(`UPDATE factories SET name=$2 WHERE user_id=$1`, [user.id, name]);
  return jsonOk({ ok: true, name });
}

export async function getMade(user, query) {
  const to = query.get('to') || jstDay();
  const from = query.get('from') || to;
  return jsonOk({ from, to, made: await madeBetween(user.id, from, to) });
}

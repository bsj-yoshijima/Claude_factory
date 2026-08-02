// マルチユーザー版サーバのエンドツーエンド検証。
//   実行: node tools/test_server.mjs        （docker compose up -d が前提）
//
// サーバを別プロセスで立ち上げ、HTTP 越しに
//   ログイン → トークン発行 → hooks → OTLP → 製造 → 回収 → ショップ → リーダーボード
// まで一気に通す。ブラウザなしで「設計どおり動くか」を確認できる。
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = Number(process.env.TEST_PORT || 4455);
const BASE = `http://localhost:${PORT}`;
const RUN = Date.now().toString(36);
const EMAIL = `test-${RUN}@example.com`;
const OTHER = `other-${RUN}@example.com`;

let fails = 0, checks = 0;
const ok = (cond, msg, extra = '') => {
  checks++;
  if (!cond) fails++;
  console.log(`${cond ? '  ok  ' : 'FAIL  '}${msg}${extra ? `  ${extra}` : ''}`);
};
const eq = (a, b, msg) => ok(a === b, msg, `(got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

/* ------------------------------ HTTP ヘルパ ------------------------------ */
function makeClient() {
  let cookie = '';
  return async function call(method, p, { body, token, form } = {}) {
    const headers = { Accept: 'application/json' };
    if (cookie) headers.Cookie = cookie;
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; payload = new URLSearchParams(form).toString(); }
    else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(BASE + p, { method, headers, body: payload, redirect: 'manual' });
    const sc = res.headers.getSetCookie?.() || [];
    for (const c of sc) if (c.startsWith('cf_session=')) cookie = c.split(';')[0];
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
  };
}

/* --------------------- OTLP ペイロードの組み立て --------------------- */
const sv = (v) => ({ stringValue: String(v) });
const iv = (v) => ({ intValue: String(v) });
const kv = (o) => Object.entries(o).map(([key, value]) => ({
  key, value: typeof value === 'number' ? iv(value) : sv(value),
}));

let seq = 0;
function logRecord(name, at, extra = {}, sess = 'sess-otel') {
  return {
    timeUnixNano: String(at * 1e6),
    attributes: kv({
      'event.name': name, 'session.id': sess, 'event.sequence': ++seq,
      'user.email': EMAIL, ...extra,
    }),
  };
}
const logsPayload = (records) => ({
  resourceLogs: [{
    resource: { attributes: kv({ 'service.name': 'claude-code' }) },
    scopeLogs: [{ logRecords: records }],
  }],
});
const metricsPayload = (metrics) => ({
  resourceMetrics: [{
    resource: { attributes: kv({ 'service.name': 'claude-code' }) },
    scopeMetrics: [{ metrics }],
  }],
});
const counter = (name, at, value, attrs = {}) => ({
  name,
  sum: {
    aggregationTemporality: 1,
    dataPoints: [{ timeUnixNano: String(at * 1e6), asInt: String(value),
      attributes: kv({ 'session.id': 'sess-otel', 'user.email': EMAIL, ...attrs }) }],
  },
});

/* ================================ 本体 ================================ */
const child = spawn(process.execPath, ['server/index.mjs'], {
  env: { ...process.env, PORT: String(PORT), PUBLIC_URL: BASE, DEV_LOGIN: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d; });
child.stderr.on('data', (d) => { serverLog += d; });

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/api/health`); if (r.ok) return; } catch {}
    await sleep(250);
  }
  throw new Error(`サーバが起動しません:\n${serverLog}`);
}

try {
  await waitUp();
  const a = makeClient();       // alice
  const b = makeClient();       // 別ユーザー（分離の検証用）

  console.log('[1] 認証とトークン');
  {
    const anon = await (makeClient())('GET', '/api/state');
    eq(anon.status, 401, '未ログインでは /api/state が 401');

    const r = await a('POST', '/auth/dev', { form: { email: EMAIL } });
    eq(r.status, 200, 'dev ログインできる');
    const me = await a('GET', '/api/me');
    eq(me.status, 200, '/api/me が返る');
    ok(/^cf_/.test(me.json.ingestToken || ''), '取り込みトークンが発行される');
    var TOKEN = me.json.ingestToken;

    await b('POST', '/auth/dev', { form: { email: OTHER } });
    var TOKEN_B = (await b('GET', '/api/me')).json.ingestToken;
    ok(TOKEN !== TOKEN_B, '人ごとに別のトークンになる');

    const bad = await fetch(`${BASE}/v1/logs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer nope' },
      body: '{}' });
    eq(bad.status, 401, '不正なトークンの OTLP は 401');
  }

  console.log('\n[2] hooks によるエージェントの在/不在');
  {
    await a('POST', '/hooks/SessionStart', { token: TOKEN, body: { session_id: 's1', cwd: '/x/eventos-api' } });
    let st = (await a('GET', '/api/state')).json;
    eq(st.agents.length, 0, 'SessionStart 直後は入場しない（一瞬で終わるセッションを弾く）');

    await a('POST', '/hooks/UserPromptSubmit', { token: TOKEN, body: { session_id: 's1' } });
    st = (await a('GET', '/api/state')).json;
    eq(st.agents.length, 1, 'UserPromptSubmit で即入場する');
    eq(st.agents[0].project, 'eventos-api', 'cwd からプロジェクト名が取れている');
    eq(st.agents[0].working, true, '稼働中(✨)になる');
    eq(st.busy, 1, 'busy カウント');

    await a('POST', '/hooks/Stop', { token: TOKEN, body: { session_id: 's1' } });
    st = (await a('GET', '/api/state')).json;
    eq(st.agents[0].working, false, 'Stop で休憩(☕)になる');
    eq(st.idle, 1, 'idle カウント');

    // マルチテナントの分離: 他人が同じ session_id を名乗っても自分の行は乗っ取られない
    await b('POST', '/hooks/SessionStart', { token: TOKEN_B, body: { session_id: 's1', cwd: '/x/HIJACK' } });
    await b('POST', '/hooks/UserPromptSubmit', { token: TOKEN_B, body: { session_id: 's1' } });
    st = (await a('GET', '/api/state')).json;
    eq(st.agents[0].project, 'eventos-api', '同じ session_id を他人が送っても自分の行は書き換わらない');
    const stB2 = (await b('GET', '/api/state')).json;
    eq(stB2.agents[0].project, 'HIJACK', '相手は相手で自分の行を持つ');

    await a('POST', '/hooks/SessionEnd', { token: TOKEN, body: { session_id: 's1' } });
    st = (await a('GET', '/api/state')).json;
    eq(st.agents.length, 0, 'SessionEnd で退場する');
    eq((await b('GET', '/api/state')).json.agents.length, 1, '自分の SessionEnd で他人を退場させない');

    const noTok = await fetch(`${BASE}/hooks/Stop`, { method: 'POST', body: '{}' });
    eq(noTok.status, 401, 'トークン無しの hook は 401');
  }

  console.log('\n[3] OTLP 取り込みと WP');
  {
    const t = Date.now();
    // Edit(10) ×2 + Bash(4) ×1 = 24 WP。1分に収まるので上限(200)は効かない
    const recs = [
      logRecord('api_request', t, { query_source: 'sdk' }),
      logRecord('tool_result', t + 10, { tool_name: 'Edit', success: 'true' }),
      logRecord('tool_result', t + 20, { tool_name: 'Edit', success: 'true' }),
      logRecord('tool_result', t + 30, { tool_name: 'Bash', success: 'true' }),
      logRecord('tool_result', t + 40, { tool_name: 'Bash', success: 'false' }),  // 失敗は加点しない
    ];
    let r = await a('POST', '/v1/logs', { token: TOKEN, body: logsPayload(recs) });
    eq(r.status, 200, 'OTLP logs を受け付ける');
    let st = (await a('GET', '/api/state')).json;
    eq(st.wp.total, 24, 'WP = Edit10×2 + Bash4 = 24（失敗した Bash は加点されない）');

    // 同じペイロードを再送 → event.sequence による重複排除が効くこと
    r = await a('POST', '/v1/logs', { token: TOKEN, body: logsPayload(recs) });
    st = (await a('GET', '/api/state')).json;
    eq(st.wp.total, 24, '同じペイロードを再送しても二重加算されない（重複排除）');

    // サブエージェント: 直前の api_request が agent:* なら子とみなし ×0.5
    const t2 = t + 60000;
    await a('POST', '/v1/logs', { token: TOKEN, body: logsPayload([
      logRecord('api_request', t2, { query_source: 'agent:builtin:general-purpose' }),
      logRecord('tool_result', t2 + 10, { tool_name: 'Edit', success: 'true' }),
    ]) });
    st = (await a('GET', '/api/state')).json;
    eq(st.wp.total, 29, 'サブエージェント内の Edit は ×0.5 で 5WP（24 → 29）');

    // メトリクス由来（追加行 ×0.5 / コミット ×50）
    await a('POST', '/v1/metrics', { token: TOKEN, body: metricsPayload([
      counter('claude_code.lines_of_code.count', t, 100, { type: 'added' }),
      counter('claude_code.commit.count', t, 1),
    ]) });
    st = (await a('GET', '/api/state')).json;
    eq(st.wp.total, 29 + 50 + 50, '追加100行(50WP) + コミット1(50WP) が乗る');

    // 別ユーザーのWPが混ざらないこと（旧実装は wpTotal が全ユーザー合算だった）
    const stB = (await b('GET', '/api/state')).json;
    eq(stB.wp.total, 0, '別ユーザーの WP は 0 のまま（人ごとに分離されている）');
  }

  console.log('\n[4] 1分あたり上限（ガードレール）');
  {
    const t = Date.now() + 3600e3;                 // 他と混ざらない別の分に置く
    const many = [logRecord('api_request', t, { query_source: 'sdk' })];
    for (let i = 0; i < 60; i++) many.push(logRecord('tool_result', t + i, { tool_name: 'Edit', success: 'true' }));
    const before = (await a('GET', '/api/state')).json.wp.total;
    await a('POST', '/v1/logs', { token: TOKEN, body: logsPayload(many) });
    const after = (await a('GET', '/api/state')).json.wp.total;
    eq(after - before, 200, '1分に600WP分を詰め込んでも 200 でクリップされる');
    const me = await a('GET', '/api/me');
    ok(me.json.cap.clipped >= 400, 'クリップ量が可視化されている（黙って捨てない）',
      `clipped=${Math.round(me.json.cap.clipped)}`);
  }

  console.log('\n[5] 製造（サーバ権威）');
  {
    // 2マス機を1台置いて素材をセット → 稼働
    let r = await a('PUT', '/api/layout', { body: { machines: [{ id: 'm1', variant: 's2', cx: 3, cy: 3 }], props: [] } });
    eq(r.status, 200, '在庫のぶんだけ製造機を設置できる');

    const over = await a('PUT', '/api/layout', {
      body: { machines: [{ id: 'm1', variant: 's2', cx: 3, cy: 3 }, { id: 'm2', variant: 's2', cx: 5, cy: 3 }], props: [] } });
    eq(over.status, 400, '在庫を超える設置はサーバが拒否する');

    await a('PUT', '/api/machine/slots', { body: { id: 'm1', slots: ['flour', 'milk'] } });
    await a('PUT', '/api/machine/run', { body: { id: 'm1', running: true } });

    const st0 = (await a('GET', '/api/state')).json;
    const m = st0.factory.machines[0];
    eq(m.need, 100, '2マス機の必要WPは 100（マス数 × 50）');
    eq(st0.pending, 0, '稼働させた時点では在庫ゼロ（止めている間のWPは繰り越さない＝旧実装と同じ）');

    // 稼働開始後に働く。1分に Edit×10 = 100WP を3分ぶん → 2マス機で3個できるはず
    const base = Date.now() + 7200e3;
    for (let min = 0; min < 3; min++) {
      const t = base + min * 60000;
      const recs = [logRecord('api_request', t, { query_source: 'sdk' })];
      for (let i = 0; i < 10; i++) recs.push(logRecord('tool_result', t + i, { tool_name: 'Edit', success: 'true' }));
      await a('POST', '/v1/logs', { token: TOKEN, body: logsPayload(recs) });
    }
    const st1 = (await a('GET', '/api/state')).json;
    eq(st1.pending, 3, '300WP ぶん働いたら 2マス機で3個できる（超過は繰り越し）');
    const salesMade = st1.today.sales - st0.today.sales;   // この節で完成したぶんだけを見る
    ok(salesMade > 0, '売上は完成した瞬間に立つ（🎁を開く前）', `💰${salesMade}`);
    eq(st1.factory.money, st0.factory.money + salesMade, '💰も完成した瞬間に増える');

    // 🎁完成品を開く = 図鑑登録のみ。売上はもう立っているので二重加算しない
    const before = st1.factory.money;
    const cl = (await a('POST', '/api/claim')).json;
    eq(cl.items.length, 3, '完成品を回収できる');
    eq(cl.gain, salesMade, '回収時の表示額は完成時に加算済みの額と一致する');
    // 許容集合はレシピ定義から導く（ハードコードするとレシピ追加で壊れる）
    const GD = await import('../server/game-data.mjs');
    const allowed = new Set(GD.poolFor(GD.keyOfSlots(['flour', 'milk'])).map((x) => x.p.id));
    ok(cl.items.length > 0 && cl.items.every((x) => allowed.has(x.id)),
      '小麦粉+牛乳のレシピに載っている製品しか出ない',
      cl.items.map((x) => `${x.e}${x.n}`).join(' '));
    const after = (await a('GET', '/api/state')).json;
    eq(after.factory.money, before, '🎁を開いても 💰 は二重に増えない');
    eq(after.today.sales, st1.today.sales, '🎁を開いても今日の売上は二重に増えない');
    eq(after.pending, 0, '回収後は新着が 0 になる');
    eq(after.today.made, 3, '📊今日の製造に3個が記録される');
    const collection = (await a('GET', '/api/collection')).json.collection;
    ok(Object.keys(collection).length > 0, '図鑑に登録される');
    ok(Object.values(collection).every((d) => d.firstAt),
      '初取得日時が記録される（旧実装には無かった）');
  }

  console.log('\n[6] ショップ（サーバ検証）');
  {
    const st = (await a('GET', '/api/state')).json;
    const money = st.factory.money;
    const r = await a('POST', '/api/shop/buy', { body: { kind: 'machine', id: 's5' } });
    if (money < 34000) {
      eq(r.status, 400, '💰が足りなければサーバが購入を拒否する');
    } else {
      eq(r.status, 200, '購入できる');
    }
    const fake = await a('POST', '/api/shop/buy', { body: { kind: 'machine', id: 'FREE_MACHINE' } });
    eq(fake.status, 400, '存在しない商品IDは拒否される');

    const cheap = await a('POST', '/api/shop/buy', { body: { kind: 'bg', id: 'auto' } });
    eq(cheap.status, 200, '所持済みの内装は無料で再適用できる');
  }

  console.log('\n[7] リーダーボード（期間フィルタつき）');
  {
    const r = await a('GET', '/api/leaderboard?period=week');
    eq(r.status, 200, '週次リーダーボードが取れる');
    const mine = r.json.scorecard.find((x) => x.email === EMAIL);
    ok(!!mine, '自分が載っている');
    ok(mine.wp > 0, 'WP が入っている', `wp=${mine.wp}`);
    eq(mine.efficiency, null, 'PR も行数も足りないので効率はランク外（最低成果フィルタ）');
    for (const p of ['today', 'week', 'month', 'year', 'all']) {
      const x = await a('GET', `/api/leaderboard?period=${p}`);
      ok(x.status === 200 && x.json.period === p, `period=${p} が引ける`, `${x.json.from}〜${x.json.to}`);
    }
    // 軸ごとの並べ替えとページング（画面は20件ずつ「もっとみる」で伸ばす）
    const p1 = await a('GET', '/api/leaderboard?period=all&metric=commits&limit=2&offset=0');
    ok(p1.json.metric === 'commits' && p1.json.scorecard.length <= 2,
      '軸を指定して20件ずつ切り出せる', `total=${p1.json.total} 返り=${p1.json.scorecard.length}`);
    ok(p1.json.scorecard.every((u, i, arr) => i === 0 || arr[i - 1].commits >= u.commits),
      '指定した軸の降順で並ぶ');
    const p2 = await a('GET', '/api/leaderboard?period=all&metric=commits&limit=2&offset=2');
    ok(p1.json.scorecard.every((u) => !p2.json.scorecard.some((v) => v.id === u.id)),
      'offset で次のページが取れる（重複しない）');
    const bad = await a('GET', '/api/leaderboard?period=all&metric=__evil__&limit=1');
    eq(bad.json.metric, 'efficiency', '未知の軸は既定（効率）に落とす');
  }

  console.log('\n[8] ポーリングの軽量化');
  {
    const full = await a('GET', '/api/state');
    const rev = full.json.rev;
    ok(!!full.json.factory, '初回（rev未知）は factory 一式が返る');
    const fullBytes = Buffer.byteLength(JSON.stringify(full.json));

    const slim = await a('GET', `/api/state?rev=${rev}`);
    ok(!slim.json.factory, '同じ rev を送ると factory は省略される');
    ok(Array.isArray(slim.json.machines), '機械の進捗（wp/running）は毎回返る');
    eq(slim.json.rev, rev, 'rev は毎回返る（変わったらクライアントが取り直せる）');
    const slimBytes = Buffer.byteLength(JSON.stringify(slim.json));
    ok(slimBytes < fullBytes, `ペイロードが小さくなる`,
      `${fullBytes}B → ${slimBytes}B (-${Math.round((1 - slimBytes / fullBytes) * 100)}%)`);

    // 工場の形が変わったら rev が上がり、次のポーリングで一式が届く
    await a('POST', '/api/shop/buy', { body: { kind: 'bg', id: 'auto' } });
    const after = await a('GET', `/api/state?rev=${rev}`);
    ok(after.json.rev !== rev, '購入すると rev が上がる');
    ok(!!after.json.factory, 'rev が変わったら factory が再送される');

    // tick の空振り: WP が増えていないポーリングは factories に書き込まない
    const { pool: p2 } = await import('../server/db.mjs');
    const tickAt = async () => (await p2.query(
      `SELECT last_tick_at FROM factories f JOIN users u ON u.id=f.user_id WHERE u.email=$1`,
      [EMAIL])).rows[0].last_tick_at.getTime();
    const t0 = await tickAt();
    for (let i = 0; i < 3; i++) await a('GET', `/api/state?rev=${after.json.rev}`);
    eq(await tickAt(), t0, 'WPが増えていないポーリングは書き込みを起こさない（空振りtickの廃止）');
  }

  console.log('\n[9] 重みの変更で過去が再集計されること（WP.md §6 の性質）');
  {
    const before = (await a('GET', '/api/state')).json.wp.total;
    const { pool } = await import('../server/db.mjs');
    await pool.query(`UPDATE wp_weights SET weight=20 WHERE kind='tool' AND key='Edit'`);
    const after = (await a('GET', '/api/state')).json.wp.total;
    ok(after > before, '重みを UPDATE しただけで全期間の WP が変わる（再取り込み不要）',
      `${Math.round(before)} → ${Math.round(after)}`);
    await pool.query(`UPDATE wp_weights SET weight=10 WHERE kind='tool' AND key='Edit'`);
    await pool.end();
  }

  console.log(`\n${fails ? '❌' : '✅'} ${checks - fails}/${checks} 件 通過`);
} catch (e) {
  console.error('\n実行中にエラー:', e);
  console.error(serverLog.slice(-2000));
  fails++;
} finally {
  child.kill('SIGTERM');
}
process.exit(fails ? 1 : 0);

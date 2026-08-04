// OTLP/JSON レシーバ。Claude Code から直接 POST される。
//
//   POST /v1/logs     ← claude_code.* イベント（既定5秒間隔）
//   POST /v1/metrics  ← claude_code.* メトリクス（既定60秒間隔）
//
// 旧 otel.mjs との違い:
//   - 集計のキーは「トークンから引いた user_id」。ペイロードの user.email は照合だけに使う
//     （自己申告なので、そのまま信じるとリーダーボードでなりすませてしまう）
//   - 1イベント1行を書かず、受信バッチをメモリ上で分バケットに畳んでから UPSERT する
//     （100人規模で 600 writes/s → 2 writes/s 程度に落ちる）
//   - event.sequence による重複排除を行う（WP.md §8 ② の未実装項目。再送で二重加算しない）
import { q, tx } from './db.mjs';
import { jstDay } from './time.mjs';

/* ===================== OTLP/JSON のデコード =====================
   OTLP/JSON は int64 を「文字列」で送ってくるので必ず Number() を通す。 */
function anyValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('boolValue' in v) return v.boolValue;
  if ('intValue' in v) return Number(v.intValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(anyValue);
  if ('kvlistValue' in v) return attrs(v.kvlistValue.values);
  return null;
}
function attrs(list) {
  const o = {};
  for (const kv of list || []) o[kv.key] = anyValue(kv.value);
  return o;
}
function dpValue(dp) {
  if (dp.asInt !== undefined) return Number(dp.asInt);
  if (dp.asDouble !== undefined) return Number(dp.asDouble);
  if (dp.sum !== undefined) return Number(dp.sum);
  return 0;
}
const nanoToMs = (n) => (n ? Math.round(Number(n) / 1e6) : Date.now());
const minuteOf = (ms) => Math.floor(ms / 60000);
// 実測メモ: event.name は `claude_code.` プレフィックス無しで届く（"tool_result" 等）
const norm = (name) => String(name).replace(/^claude_code\./, '');

/* ===================== 親 / 子（サブエージェント）の判別 =====================
   実測（WP.md §3）で、子のツール実行は親と同じ session.id の tool_result として
   混ざって届き、query_source も agent.name も付かない。
   ツールは「直前に完了した api_request の応答」として実行されるので、
   直前の api_request の query_source が agent:* ならそのツールは子のもの。

   query_source の実測値: sdk=親 / agent:builtin:* / agent:custom / web_search_tool …

   旧 otel.mjs は Agent の duration_ms から実行区間も併用していたが、同期エージェントも
   api_request を agent:* で出すため、この判定だけで両方カバーできる
   （test/test_server.mjs が実ログで旧実装との一致を検証する）。
   並列に多数のバックグラウンドエージェントが走る間は近似になるのは旧実装と同じ。 */
const lastQs = new Map();          // sessionId -> 直近の query_source
const LASTQS_MAX = 5000;
function rememberQs(sess, qs) {
  if (lastQs.size > LASTQS_MAX) lastQs.clear();   // 素朴な上限。取りこぼしても次で復帰する
  lastQs.set(sess, qs);
}
const isSubagent = (sess) => {
  const qs = lastQs.get(sess);
  return !!qs && qs.startsWith('agent:');
};

/* ============================ バッチ集計器 ============================
   受信ペイロード1件を畳んでから DB に書く。 */
class Batch {
  constructor(userId) {
    this.userId = userId;
    this.tools = new Map();     // `${minute}|${tool}|${isSubagent}` -> {ok, ng}
    this.metrics = new Map();   // minute -> {la, lr, commits, prs}
    this.score = new Map();     // day -> {…カウンタ}
    this.names = new Map();     // `${day}|${kind}|${name}` -> count
    this.alive = new Map();     // sessionId -> そのセッションで見た最新のイベント時刻(ms)
    this.dedup = new Set();
  }
  /** このセッションが生きている証跡。工場の 🟢/💤 の判定だけに使う（集計には入らない） */
  live(sess, ms) {
    if (!sess || sess === '?' || !ms) return;
    const cur = this.alive.get(sess);
    if (cur == null || ms > cur) this.alive.set(sess, ms);
  }
  tool(ms, name, isSubagent, ok) {
    const k = `${minuteOf(ms)}|${name}|${isSubagent ? 1 : 0}`;
    const e = this.tools.get(k) || { ok: 0, ng: 0 };
    e[ok ? 'ok' : 'ng']++;
    this.tools.set(k, e);
  }
  metric(ms, field, v) {
    const m = minuteOf(ms);
    const e = this.metrics.get(m) || { la: 0, lr: 0, commits: 0, prs: 0 };
    e[field] += v;
    this.metrics.set(m, e);
  }
  sc(ms, field, v = 1) {
    const d = jstDay(ms);
    const e = this.score.get(d) || {};
    e[field] = (e[field] || 0) + v;
    this.score.set(d, e);
  }
  name(ms, kind, name) {
    const k = `${jstDay(ms)}|${kind}|${name}`;
    this.names.set(k, (this.names.get(k) || 0) + 1);
  }
  get empty() {
    return !this.tools.size && !this.metrics.size && !this.score.size && !this.names.size
        && !this.alive.size;
  }
}

const SC_FIELDS = [
  'lines_added', 'lines_removed', 'commits', 'prs', 'output_tokens', 'input_tokens',
  'cache_read_tokens', 'cost_usd', 'active_time_sec', 'skill', 'agent', 'custom_agent',
  'async_agent', 'sub_tool_uses', 'tools_ok', 'tools_ng', 'edit_accept', 'edit_reject',
];

async function flush(b) {
  if (b.empty) return;
  await tx(async (c) => {
    if (b.tools.size) {
      const mins = [], names = [], subs = [], oks = [], ngs = [];
      for (const [k, v] of b.tools) {
        const [m, n, s] = k.split('|');
        mins.push(Number(m)); names.push(n); subs.push(s === '1'); oks.push(v.ok); ngs.push(v.ng);
      }
      await c.query(
        `INSERT INTO wp_source_minute(user_id, minute_ts, tool_name, is_subagent, ok_count, ng_count)
         SELECT $1, * FROM UNNEST($2::bigint[], $3::text[], $4::bool[], $5::int[], $6::int[])
         ON CONFLICT (user_id, minute_ts, tool_name, is_subagent) DO UPDATE
           SET ok_count = wp_source_minute.ok_count + EXCLUDED.ok_count,
               ng_count = wp_source_minute.ng_count + EXCLUDED.ng_count`,
        [b.userId, mins, names, subs, oks, ngs]);
    }
    if (b.metrics.size) {
      const mins = [], la = [], lr = [], cm = [], pr = [];
      for (const [m, v] of b.metrics) { mins.push(m); la.push(v.la); lr.push(v.lr); cm.push(v.commits); pr.push(v.prs); }
      await c.query(
        `INSERT INTO wp_metric_minute(user_id, minute_ts, lines_added, lines_removed, commits, prs)
         SELECT $1, * FROM UNNEST($2::bigint[], $3::float8[], $4::float8[], $5::float8[], $6::float8[])
         ON CONFLICT (user_id, minute_ts) DO UPDATE
           SET lines_added   = wp_metric_minute.lines_added   + EXCLUDED.lines_added,
               lines_removed = wp_metric_minute.lines_removed + EXCLUDED.lines_removed,
               commits       = wp_metric_minute.commits       + EXCLUDED.commits,
               prs           = wp_metric_minute.prs           + EXCLUDED.prs`,
        [b.userId, mins, la, lr, cm, pr]);
    }
    for (const [day, e] of b.score) {
      const cols = SC_FIELDS.filter((f) => e[f]);
      if (!cols.length) continue;
      await c.query(
        `INSERT INTO scorecard_daily(user_id, day, ${cols.join(',')})
         VALUES ($1, $2, ${cols.map((_, i) => `$${i + 3}`).join(',')})
         ON CONFLICT (user_id, day) DO UPDATE SET
         ${cols.map((f) => `${f} = scorecard_daily.${f} + EXCLUDED.${f}`).join(', ')}`,
        [b.userId, day, ...cols.map((f) => e[f])]);
    }
    for (const [k, n] of b.names) {
      const [day, kind, name] = k.split('|');
      await c.query(
        `INSERT INTO scorecard_names(user_id, day, kind, name, count) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id, day, kind, name) DO UPDATE SET count = scorecard_names.count + EXCLUDED.count`,
        [b.userId, day, kind, name, n]);
    }
    if (b.dedup.size) {
      await c.query(
        `INSERT INTO ingest_seen(user_id, dedup_key)
         SELECT $1, * FROM UNNEST($2::text[]) ON CONFLICT DO NOTHING`,
        [b.userId, [...b.dedup]]);
    }
    // 受信1回につきこの UPDATE 1発だけ（イベント件数には比例しない）。
    // 行は作らない: セッションの実体と project 名は hook 側が持つ。
    // 時刻は「now を超えない」「後戻りしない」で丸める（過去ログのリプレイで
    // 死んだセッションが生き返らないように）。
    if (b.alive.size) {
      const ids = [...b.alive.keys()], ms = ids.map((k) => b.alive.get(k));
      await c.query(
        `UPDATE agent_sessions AS s
            SET last_activity_at = GREATEST(COALESCE(s.last_activity_at, 'epoch'::timestamptz),
                                            LEAST(now(), to_timestamp(v.ms / 1000.0)))
           FROM UNNEST($2::text[], $3::float8[]) AS v(session_id, ms)
          WHERE s.user_id = $1 AND s.session_id = v.session_id AND s.state <> 'ended'`,
        [b.userId, ids, ms]);
    }
  });
}

/** 既に取り込んだ dedup_key を除く */
async function filterSeen(userId, keys) {
  if (!keys.length) return new Set();
  const r = await q(
    `SELECT dedup_key FROM ingest_seen WHERE user_id=$1 AND dedup_key = ANY($2::text[])`,
    [userId, keys]);
  return new Set(r.rows.map((x) => x.dedup_key));
}

/* ================================ logs ================================ */
export async function ingestLogs(userId, payload, audit) {
  const recs = [];
  for (const rl of payload.resourceLogs || []) {
    const res = attrs(rl.resource?.attributes);
    for (const sl of rl.scopeLogs || []) {
      for (const lr of sl.logRecords || []) {
        const a = { ...res, ...attrs(lr.attributes) };
        recs.push({ a, t: nanoToMs(lr.timeUnixNano || lr.observedTimeUnixNano) });
      }
    }
  }
  if (!recs.length) return { accepted: 0, duplicates: 0 };
  // 親子判定は時系列順でないと成立しない（api_request → その応答でツールが走る）
  recs.sort((x, y) => x.t - y.t);

  const keyOf = (a) => {
    const s = a['session.id'] || '?';
    const seq = a['event.sequence'];
    return seq != null ? `L:${s}:${seq}` : null;
  };
  const seen = await filterSeen(userId, recs.map((r) => keyOf(r.a)).filter(Boolean));

  const b = new Batch(userId);
  let accepted = 0, duplicates = 0;
  for (const { a, t } of recs) {
    audit?.(a);
    const k = keyOf(a);
    if (k) {
      if (seen.has(k) || b.dedup.has(k)) { duplicates++; continue; }
      b.dedup.add(k);
    }
    accepted++;
    const name = norm(a['event.name'] || '');
    const sess = a['session.id'] || '?';
    b.live(sess, t);                    // 種類を問わず「届いた＝生きている」

    // api_request: 親/子の判別材料。以降のツールはこの query_source に従う
    if (name === 'api_request' && a.query_source) {
      rememberQs(sess, a.query_source);
      if (a.query_source === 'agent:custom') b.sc(t, 'custom_agent');
      continue;
    }

    if (name === 'tool_result') {
      const tn = a.tool_name || '(unknown)';
      const ok = !(a.success === false || a.success === 'false');
      // Agent / Task 自身は起動コスト。子係数は SQL 側でも除外している
      const inSub = tn !== 'Agent' && tn !== 'Task' && isSubagent(sess);
      b.tool(t, tn, inSub, ok);
      b.sc(t, ok ? 'tools_ok' : 'tools_ng');
      if (ok && tn === 'Skill') b.sc(t, 'skill');
      if (ok && (tn === 'Agent' || tn === 'Task')) b.sc(t, 'agent');
      continue;
    }

    // 実測値が入る未ドキュメントのイベント。ヒューリスティックより正確
    if (name === 'subagent_completed') {
      b.sc(t, 'agent');
      b.sc(t, 'sub_tool_uses', Number(a.total_tool_uses || 0));
      if (a.is_async === true || a.is_async === 'true') b.sc(t, 'async_agent');
      if (a['agent.source'] && a['agent.source'] !== 'built-in') b.sc(t, 'custom_agent');
      b.name(t, 'agent_type', `${a.agent_type || '?'}(${a['agent.source'] || '?'})`);
      continue;
    }
    if (name === 'skill_activated' || name === 'skill_executed') {
      b.name(t, 'skill', a['skill.name'] || a.skill_name || '(unnamed)');
      continue;
    }
  }
  await flush(b);
  return { accepted, duplicates };
}

/* =============================== metrics =============================== */
export async function ingestMetrics(userId, payload, audit) {
  const b = new Batch(userId);
  let accepted = 0;
  for (const rm of payload.resourceMetrics || []) {
    const res = attrs(rm.resource?.attributes);
    for (const sm of rm.scopeMetrics || []) {
      for (const m of sm.metrics || []) {
        const body = m.sum || m.gauge || m.histogram || m.exponentialHistogram;
        if (!body) continue;
        for (const dp of body.dataPoints || []) {
          const a = { ...res, ...attrs(dp.attributes) };
          audit?.(a);
          const t = nanoToMs(dp.timeUnixNano);
          const v = dpValue(dp);
          accepted++;
          // メトリクスは活動量に関係なく固定周期で飛ぶ。ログが途切れる
          // 「無言で長いツール実行」の区間はこちらが生存を担保する
          b.live(a['session.id'], t);
          switch (m.name) {
            case 'claude_code.lines_of_code.count':
              if (a.type === 'added') { b.metric(t, 'la', v); b.sc(t, 'lines_added', v); }
              else if (a.type === 'removed') { b.metric(t, 'lr', v); b.sc(t, 'lines_removed', v); }
              break;
            case 'claude_code.commit.count':
              b.metric(t, 'commits', v); b.sc(t, 'commits', v); break;
            case 'claude_code.pull_request.count':
              b.metric(t, 'prs', v); b.sc(t, 'prs', v); break;
            case 'claude_code.cost.usage':
              b.sc(t, 'cost_usd', v); break;
            case 'claude_code.active_time.total':
              b.sc(t, 'active_time_sec', v); break;
            case 'claude_code.token.usage':
              if (a.type === 'output') b.sc(t, 'output_tokens', v);
              else if (a.type === 'input') b.sc(t, 'input_tokens', v);
              else if (a.type === 'cacheRead') b.sc(t, 'cache_read_tokens', v);
              break;
            case 'claude_code.code_edit_tool.decision':
              // 手戻りの兆候。user_reject / user_abort は「Claudeの提案を人が止めた」
              if (a.decision === 'reject' || /^user_(reject|abort)$/.test(String(a.source)))
                b.sc(t, 'edit_reject', v);
              else b.sc(t, 'edit_accept', v);
              break;
          }
        }
      }
    }
  }
  await flush(b);
  return { accepted, duplicates: 0 };
}

/** テスト用: セッションの親子判定キャッシュを捨てる */
export const _resetQs = () => lastQs.clear();

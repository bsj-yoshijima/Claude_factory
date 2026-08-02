// Claude Factory — OTLP/JSON レシーバ + WP 集計エンジン
//
// Claude Code は OTEL_EXPORTER_OTLP_PROTOCOL=http/json をサポートするので、
// OTel Collector を立てずに素の Node で受信できる（依存ゼロを維持）。
//   POST /v1/metrics  ← claude_code.* メトリクス（既定 60s 間隔 / delta temporality）
//   POST /v1/logs     ← claude_code.* イベント（既定 5s 間隔）
//   POST /v1/traces   ← CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1 のときだけ
//
// 受信した生ペイロードは otel-raw.jsonl に追記して残す。WP の重みを変えたときに
// リプレイして再集計できるようにするため（起動時に自動リプレイする）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';

const DATA_DIR = path.join(os.homedir(), '.claude', 'factory');
const RAW_FILE = path.join(DATA_DIR, 'otel-raw.jsonl');

/* ============================ WP の重み ============================
   ここだけ書き換えて再起動すれば、過去の生ログをリプレイして再集計される。 */
export const WP = {
  // tool_result イベント（success=true のみ加点）
  tool: {
    Edit: 10, Write: 10, NotebookEdit: 10,
    Bash: 4,
    Agent: 3, Task: 3,    // 起動コストのみ。中身の労働は子の tool_result 側で数える
    Skill: 25,
    Read: 2, Grep: 2, Glob: 2,
    _default: 3,          // 上記以外・MCP ツールなど
  },
  // サブエージェント内のツール実行にかける係数。
  // 実測(session 4dcc579b)で、子の tool_result は親と同じ session.id に混ざって届き、
  // query_source も agent.name も付かないことを確認した。判別は Agent の
  // duration_ms から逆算した実行区間に入るかどうかで行う。
  // 子の労働は実労働なので 0 にはしないが、Agent 起動分と二階層で満額払わないため 0.5。
  subagentFactor: 0.5,
  // claude_code.lines_of_code.count メトリクス
  linesAdded: 0.5,
  linesRemoved: 0.3,      // 削除も労働として評価（行数稼ぎの逆インセンティブを消す）
  // その他メトリクス
  commit: 50,
  pullRequest: 150,
  // 1人1分あたりのWP上限（工場のライン速度）。
  // 実測(98分)では 1分あたり 中央値20 / 90%=45 / 最大83 WP だったので、200 は通常の作業では
  // 1回もクリップしない。バランス調整ではなく、Read ループや大量並列エージェントのような
  // 病的なケースを止めるガードレールとして置いている。クリップ量は必ず画面に出す。
  perMinuteCap: 200,
};

/* ==================== 業務スコアカードの設定 ====================
   ゲーム用WPとは目的が違うので完全に分離する。
   - ゲーム用WP : 「頑張った感」。サブエージェント係数 0.5 をかける（ゲーム内の公平性）
   - スコアカード: 「Claude Code の使い方」の可視化。係数はかけず生カウントで見せる
   スコアカードは単一の合計値を作らない。多軸のまま並べる。 */
export const SCORE = {
  // 効率スコア = (追加行 + 削除行×removed + PR数×prLines) ÷ output_tokens × 1000
  // 分母に総トークンを使わないこと: 実測で cacheRead が output の 316 倍あり、
  // 総トークンは「セッションの長さ」を測ってしまう。output_tokens が試行錯誤の量に最も近い。
  eff: {
    removed: 0.3,      // 削除も成果だが、追加と同額だと「消して稼ぐ」が成立する
    prLines: 150,      // 実測較正: 4 PR / 558 追加行 = 1PR ≒ 140行。スケールを揃える
    scale: 1000,       // 表示上の桁合わせ
  },
  // 効率順ランキングの参加条件。これが無いと「3行しか書いていない人」が1位になる
  // （実測: output 1,529 / 追加3行 のセッションが効率トップに並んだ）
  minPrs: 1,
  minLines: 100,
};

/* ===================== OTLP/JSON のデコード補助 =====================
   OTLP/JSON は int64 を「文字列」で送ってくる（JSON の数値精度対策）ので、
   asInt / intValue は必ず Number() を通す。 */
function anyValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('boolValue' in v) return v.boolValue;
  if ('intValue' in v) return Number(v.intValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('bytesValue' in v) return '(bytes)';
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(anyValue);
  if ('kvlistValue' in v) return attrs(v.kvlistValue.values);
  return null;
}
function attrs(list) {
  const o = {};
  for (const kv of list || []) o[kv.key] = anyValue(kv.value);
  return o;
}
function num(dp) {
  if (dp.asInt !== undefined) return Number(dp.asInt);
  if (dp.asDouble !== undefined) return Number(dp.asDouble);
  if (dp.sum !== undefined) return Number(dp.sum);   // histogram
  return 0;
}
function nanoToMs(n) { return n ? Math.round(Number(n) / 1e6) : Date.now(); }
// 稼働日は JST の暦日で数える（UTC だと日本の深夜作業が前日に寄る）
const jstDay = t => new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10);

/* ============================== ストア ============================== */
// 1シリーズ = メトリクス名 + 属性の組み合わせ。delta なので受信値を足し込むだけ。
const series = new Map();   // key -> {name, unit, attrs, value, points, first, last}
const events = new Map();   // eventName -> {count, first, last, attrKeys:Set, breakdown:Map}
const recent = [];          // 直近イベント（生データ確認用リングバッファ）
const users = new Map();    // identity -> {wp, tools, lines, events}
const resources = new Map();// resource key -> {attrs, count, last}
// ツールWPは受信時に即加算できない。Agent の tool_result は子より後に届くので
// （実測: 子 seq18/27 → Agent seq33）、受信時点では「子かどうか」が判定できない。
// そこで1件ずつ記録しておき、snapshot() で Agent 区間と突き合わせて計算する。
const toolEvents = [];      // {t, tool, ok, sess, id}
const agentWindows = [];    // {sess, start, end} — 同期 Agent の実行区間
const apiEvents = [];       // {t, sess, qs} — api_request の query_source（親/子の判別に使う）
const metricWpEvents = [];  // {t, id, wp} — メトリクス由来のWP（分バケットに入れるため時刻を保持）
const TOOL_EVENTS_MAX = 200000;
const RECENT_MAX = 300;

let stats = { metricPosts: 0, logPosts: 0, tracePosts: 0, bytes: 0, startedAt: Date.now(), firstSeen: null, lastSeen: null, replayed: 0 };

// 全メトリクス/イベントに共通で付く「識別・環境」属性。メトリクスの系列キーからは外して
// セッション横断で合算する（入れると session.id ごとに行が増えて表が読めなくなる）。
const STD_ATTRS = new Set([
  'service.name', 'service.version', 'claude.deployment_mode', 'host.arch', 'os.type', 'os.version',
  'process.owner', 'user.id', 'user.email', 'user.account_uuid', 'user.account_id', 'organization.id',
  'session.id', 'terminal.type', 'app.version', 'app.entrypoint', 'safe_mode', 'user.groups',
  'identity.source', 'event.timestamp', 'event.sequence', 'event.name',
]);
const dimsOf = a => Object.fromEntries(Object.entries(a).filter(([k]) => !STD_ATTRS.has(k)));

function seriesKey(name, a) {
  const ks = Object.keys(a).sort().map(k => `${k}=${a[k]}`).join(',');
  return `${name}{${ks}}`;
}
function bump(map, key, n = 1) { map.set(key, (map.get(key) || 0) + n); }

// 実測メモ: user.email / session.id / organization.id は resource ブロックではなく
// 各 datapoint / logRecord の attributes 側に入ってくる（docs の "Standard attributes" の実体）。
// resource には service.name / os.type / process.owner などしか無いので、両方をマージして扱う。
function identityOf(a) {
  return a['user.email'] || a['user.account_uuid'] || a['user.id'] || '(unknown)';
}
function userOf(a) {
  const id = identityOf(a);
  if (!users.has(id)) users.set(id, {
    id, email: a['user.email'] || null, team: a.team || null,
    wpMetric: 0, tools: 0, lines: 0, events: 0,
    // --- 業務スコアカード用の生カウント（サブエージェント係数をかけない） ---
    sc: {
      linesAdded: 0, linesRemoved: 0, commits: 0, prs: 0,
      outputTokens: 0, inputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0,
      skill: 0, agent: 0, toolsOk: 0, toolsNg: 0,
      qsCustomAgent: 0, qsBuiltinAgent: 0, qsMain: 0,
      skillPathsInstalled: 0,
      // 未ドキュメントだが実在するイベント。スコアカードにはこちらが正確
      // subagent_completed: total_tool_uses / total_tokens / agent_type / agent.source / is_async
      subAgents: 0, subAgentsCustom: 0, subAgentsAsync: 0,
      subToolUses: 0, subTokens: 0, subTypes: new Map(),
      // skill_executed: skill.name つきの Skill 実行
      skillExec: 0, skillNames: new Map(),
      editAccept: 0, editReject: 0,
      days: new Set(), sessions: new Set(),
    },
  });
  const u = users.get(id);
  if (!u.email && a['user.email']) u.email = a['user.email'];
  if (!u.team && a.team) u.team = a.team;
  return u;
}
// 実測メモ: イベントの event.name は `claude_code.` プレフィックス無しで届く（"tool_result" 等）。
// docs の表記と揃えるため照合用に正規化する（表示は届いた生の名前のまま）。
const norm = name => String(name).replace(/^claude_code\./, '');

/* ------------------------------ metrics ------------------------------ */
function ingestMetrics(payload) {
  for (const rm of payload.resourceMetrics || []) {
    const res = attrs(rm.resource?.attributes);
    for (const sm of rm.scopeMetrics || []) {
      for (const m of sm.metrics || []) {
        const body = m.sum || m.gauge || m.histogram || m.exponentialHistogram;
        if (!body) continue;
        const temporality = body.aggregationTemporality;   // 1=DELTA, 2=CUMULATIVE
        for (const dp of body.dataPoints || []) {
          const a = { ...res, ...attrs(dp.attributes) };
          touchResource(a);
          const u = userOf(a);
          const v = num(dp);
          const dims = dimsOf(a);
          const key = seriesKey(m.name, dims);
          const t = nanoToMs(dp.timeUnixNano);
          let s = series.get(key);
          if (!s) { s = { name: m.name, unit: m.unit || '', attrs: dims, value: 0, points: 0, first: t, last: t, temporality }; series.set(key, s); }
          // CUMULATIVE の場合は最新値がそのまま累計なので上書き、DELTA は加算
          if (temporality === 2) s.value = v; else s.value += v;
          s.points++; s.last = t;

          // --- 業務スコアカード（生カウント） ---
          const sc = u.sc;
          if (a['session.id']) sc.sessions.add(a['session.id']);
          sc.days.add(jstDay(t));
          switch (m.name) {
            case 'claude_code.lines_of_code.count':
              if (a.type === 'added') sc.linesAdded += v; else if (a.type === 'removed') sc.linesRemoved += v;
              break;
            case 'claude_code.commit.count': sc.commits += v; break;
            case 'claude_code.pull_request.count': sc.prs += v; break;
            case 'claude_code.cost.usage': sc.costUsd += v; break;
            case 'claude_code.token.usage':
              if (a.type === 'output') sc.outputTokens += v;
              else if (a.type === 'input') sc.inputTokens += v;
              else if (a.type === 'cacheRead') sc.cacheReadTokens += v;
              else if (a.type === 'cacheCreation') sc.cacheCreationTokens += v;
              break;
            case 'claude_code.code_edit_tool.decision':
              // 手戻りの兆候。user_reject / user_abort は「Claudeの提案を人が止めた」
              if (a.decision === 'reject' || /^user_(reject|abort)$/.test(String(a.source))) sc.editReject += v;
              else sc.editAccept += v;
              break;
          }

          // WP への寄与
          if (m.name === 'claude_code.lines_of_code.count') {
            const w = a.type === 'added' ? WP.linesAdded : a.type === 'removed' ? WP.linesRemoved : 0;
            u.wpMetric += v * w; u.lines += v;
            metricWpEvents.push({ t, id: identityOf(a), wp: v * w });
          } else if (m.name === 'claude_code.commit.count') {
            u.wpMetric += v * WP.commit;
            metricWpEvents.push({ t, id: identityOf(a), wp: v * WP.commit });
          } else if (m.name === 'claude_code.pull_request.count') {
            u.wpMetric += v * WP.pullRequest;
            metricWpEvents.push({ t, id: identityOf(a), wp: v * WP.pullRequest });
          }
          mark(t);
        }
      }
    }
  }
}

/* ------------------------------- logs -------------------------------- */
// 低カーディナリティな属性だけ内訳を取る（session.id 等を入れると爆発するので除外）
const BREAKDOWN_KEYS = new Set([
  'tool_name', 'success', 'error_type', 'decision', 'decision_type', 'decision_source', 'source',
  'model', 'query_source', 'speed', 'effort', 'status', 'status_code', 'action', 'auth_method',
  'start_type', 'type', 'language', 'command_source', 'command_name', 'from_mode', 'to_mode',
  'trigger', 'transport_type', 'server_scope', 'mcp_server_scope', 'agent.name', 'skill.name',
  'plugin.name', 'marketplace.name', 'mcp_server.name', 'mcp_tool.name', 'workflow.name',
  'plugin.scope', 'enabled_via', 'terminal.type', 'error_name', 'error_code', 'has_category',
  // 実測で見つかった未ドキュメントのイベント属性（hook_* 系）
  'hook_event', 'hook_type', 'hook_source', 'hook_name', 'managed_only', 'tool_source',
  'has_hooks', 'has_mcp', 'host_owned_mcp', 'is_plugin',
]);

function ingestLogs(payload) {
  for (const rl of payload.resourceLogs || []) {
    const res = attrs(rl.resource?.attributes);
    for (const sl of rl.scopeLogs || []) {
      for (const lr of sl.logRecords || []) {
        const a = { ...res, ...attrs(lr.attributes) };
        touchResource(a);
        const u = userOf(a);
        const name = a['event.name'] || anyValue(lr.body) || '(unnamed)';
        const t = nanoToMs(lr.timeUnixNano || lr.observedTimeUnixNano);

        let e = events.get(name);
        if (!e) { e = { name, count: 0, first: t, last: t, attrKeys: new Set(), breakdown: new Map(), sums: new Map() }; events.set(name, e); }
        e.count++; e.last = t; u.events++;
        if (a['session.id']) u.sc.sessions.add(a['session.id']);
        u.sc.days.add(jstDay(t));
        for (const k of Object.keys(a)) {
          e.attrKeys.add(k);
          if (BREAKDOWN_KEYS.has(k)) bump(e.breakdown, `${k}=${a[k]}`);
          // 数値属性は合計も出す（トークン数・コスト・所要時間の把握用）
          if (typeof a[k] === 'number' && !/timestamp|sequence/.test(k)) bump(e.sums, k, a[k]);
        }

        // WP: ツール実行は記録だけして、集計は snapshot() で行う（上のコメント参照）
        if (norm(name) === 'tool_result') {
          const tn = a.tool_name || '(unknown)';
          const ok = !(a.success === false || a.success === 'false');
          const sess = a['session.id'] || '?';
          if (toolEvents.length < TOOL_EVENTS_MAX) {
            toolEvents.push({ t, tool: tn, ok, sess, id: identityOf(a) });
          }
          // Agent / Task は子の実行区間を作る。duration_ms から開始時刻を逆算する
          const dur = Number(a.duration_ms || 0);
          if (ok && (tn === 'Agent' || tn === 'Task') && dur > 0) {
            agentWindows.push({ sess, start: t - dur, end: t });
          }
          if (ok) u.tools++;
          // スコアカード側は係数をかけない生カウント
          if (ok) {
            u.sc.toolsOk++;
            if (tn === 'Skill') u.sc.skill++;
            if (tn === 'Agent' || tn === 'Task') u.sc.agent++;
          } else u.sc.toolsNg++;
        }
        // api_request の query_source で親(sdk)と子(agent:*)を見分ける。
        // ツールは「直前に完了した api_request」の応答として実行されるので、
        // 直前の api_request が agent:* ならそのツールはサブエージェントのもの。
        // バックグラウンド実行の Agent は duration_ms≈0 で区間が作れないため、これが主判定になる。
        if (norm(name) === 'api_request' && a.query_source) {
          apiEvents.push({ t, sess: a['session.id'] || '?', qs: a.query_source });
          // カスタムサブエージェントを使っているかは「使いこなし度」の強い signal
          if (a.query_source === 'agent:custom') u.sc.qsCustomAgent++;
          else if (String(a.query_source).startsWith('agent:')) u.sc.qsBuiltinAgent++;
          else if (a.query_source === 'sdk') u.sc.qsMain++;
        }
        // サブエージェントの完了報告。ヒューリスティックより正確な実測値が入っている
        // （実測で照合: ヒューリスティック244件 vs total_tool_uses 合計259件 = 94%の精度）
        if (norm(name) === 'subagent_completed') {
          const sc2 = u.sc;
          sc2.subAgents++;
          if (a['agent.source'] && a['agent.source'] !== 'built-in') sc2.subAgentsCustom++;
          if (a.is_async === true || a.is_async === 'true') sc2.subAgentsAsync++;
          sc2.subToolUses += Number(a.total_tool_uses || 0);
          sc2.subTokens += Number(a.total_tokens || 0);
          const ty = `${a.agent_type || '?'}(${a['agent.source'] || '?'})`;
          sc2.subTypes.set(ty, (sc2.subTypes.get(ty) || 0) + 1);
        }
        // Skill 起動（実測のイベント名は skill_activated）。
        // 注意: 自作 Skill の名前は "custom_skill" に伏せられる（OTEL_LOG_TOOL_DETAILS=1 で開示）。
        // 公式・プラグイン同梱の Skill は実名で届く（メトリクス側で skill.name=review-bug-fix を観測）。
        if (norm(name) === 'skill_activated' || norm(name) === 'skill_executed') {
          u.sc.skillExec++;
          const sn = a['skill.name'] || a.skill_name || '(unnamed)';
          u.sc.skillNames.set(sn, (u.sc.skillNames.get(sn) || 0) + 1);
        }
        // 導入済み Skill 数（使う前段階の環境整備度）
        if (norm(name) === 'plugin_loaded' && typeof a.skill_path_count === 'number') {
          u.sc.skillPathsInstalled = Math.max(u.sc.skillPathsInstalled, a.skill_path_count);
        }

        recent.push({ t, name, identity: identityOf(a), attrs: dimsOf(a) });
        if (recent.length > RECENT_MAX) recent.shift();
        mark(t);
      }
    }
  }
}

function ingestTraces(payload) {
  // 現状は件数だけ数える（BETA 有効時のみ届く）
  for (const rs of payload.resourceSpans || []) {
    for (const ss of rs.scopeSpans || []) {
      for (const sp of ss.spans || []) {
        const name = `span:${sp.name}`;
        let e = events.get(name);
        if (!e) e = { name, count: 0, first: Date.now(), last: Date.now(), attrKeys: new Set(), breakdown: new Map(), sums: new Map() }, events.set(name, e);
        e.count++; e.last = Date.now();
      }
    }
  }
}

// セッション単位に集約。表示は識別・環境属性だけに絞る（tool_name 等の変動属性は混ぜない）
function touchResource(a) {
  const key = `${identityOf(a)}|${a['session.id'] || '?'}`;
  const std = Object.fromEntries(Object.entries(a).filter(([k]) => STD_ATTRS.has(k) && !k.startsWith('event.')));
  let r = resources.get(key);
  if (!r) { r = { attrs: std, count: 0, last: Date.now() }; resources.set(key, r); }
  r.count++; r.last = Date.now(); r.attrs = { ...r.attrs, ...std };
}
function mark(t) {
  if (!stats.firstSeen || t < stats.firstSeen) stats.firstSeen = t;
  if (!stats.lastSeen || t > stats.lastSeen) stats.lastSeen = t;
}

/* ============================ 集計スナップショット ============================ */
export function snapshot() {
  const sumSeries = (name, filter) => {
    let v = 0;
    for (const s of series.values()) {
      if (s.name !== name) continue;
      if (filter && !filter(s.attrs)) continue;
      v += s.value;
    }
    return v;
  };
  const added = sumSeries('claude_code.lines_of_code.count', a => a.type === 'added');
  const removed = sumSeries('claude_code.lines_of_code.count', a => a.type === 'removed');
  const commits = sumSeries('claude_code.commit.count');
  const prs = sumSeries('claude_code.pull_request.count');

  /* --- ツールWP: Agent 区間に入る実行は subagentFactor をかける --- */
  const winBySess = new Map();
  for (const w of agentWindows) {
    if (!winBySess.has(w.sess)) winBySess.set(w.sess, []);
    winBySess.get(w.sess).push(w);
  }
  const inWindow = (sess, t) => (winBySess.get(sess) || []).some(w => t >= w.start && t <= w.end);

  // 直前に完了した api_request の query_source を引くための索引（セッションごとに時刻昇順）
  const apiBySess = new Map();
  for (const e of apiEvents) {
    if (!apiBySess.has(e.sess)) apiBySess.set(e.sess, []);
    apiBySess.get(e.sess).push(e);
  }
  for (const arr of apiBySess.values()) arr.sort((a, b) => a.t - b.t);
  function prevQuerySource(sess, t) {
    const arr = apiBySess.get(sess);
    if (!arr || !arr.length) return null;
    let lo = 0, hi = arr.length - 1, ans = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m].t <= t) { ans = m; lo = m + 1; } else hi = m - 1; }
    return ans < 0 ? null : arr[ans].qs;
  }
  // 同期 Agent の区間 OR 直前の api_request が agent:* なら子とみなす
  const inSubagent = (sess, t) => {
    if (inWindow(sess, t)) return true;
    const qs = prevQuerySource(sess, t);
    return !!qs && qs.startsWith('agent:');
  };

  // キー = ツール名 + 親/子。親と子を別行にして内訳が見えるようにする
  const agg = new Map();   // key -> {tool, isSubagent, ok, ng, wp}
  const perUser = new Map();
  const delegation = new Map();      // id -> {viaSubagent, all}
  const minuteBuckets = new Map();   // `${id}|${分}` -> 生WP
  const addToMinute = (id, t, wp) => {
    const k = `${id}|${Math.floor(t / 60000)}`;
    minuteBuckets.set(k, (minuteBuckets.get(k) || 0) + wp);
  };
  for (const e of toolEvents) {
    // Agent / Task 自身は「起動コスト」なので係数をかけない（入れ子でも二重に割り引かない）
    const isAgent = e.tool === 'Agent' || e.tool === 'Task';
    const isSubagent = !isAgent && inSubagent(e.sess, e.t);
    const key = `${e.tool}|${isSubagent}`;
    let g = agg.get(key);
    if (!g) { g = { tool: e.tool, isSubagent, ok: 0, ng: 0, wp: 0 }; agg.set(key, g); }
    if (!e.ok) { g.ng++; continue; }
    const w = (WP.tool[e.tool] ?? WP.tool._default) * (isSubagent ? WP.subagentFactor : 1);
    g.ok++; g.wp += w;
    perUser.set(e.id, (perUser.get(e.id) || 0) + w);
    addToMinute(e.id, e.t, w);
    // 委譲率のための人ごとの内訳（係数はかけない生の件数）
    let ds = delegation.get(e.id);
    if (!ds) { ds = { viaSubagent: 0, all: 0 }; delegation.set(e.id, ds); }
    ds.all++; if (isSubagent) ds.viaSubagent++;
  }
  for (const e of metricWpEvents) addToMinute(e.id, e.t, e.wp);

  // 1分バケットごとに上限でクリップ。削られた量は必ず外に出す（黙って上限をかけない）
  let wpRaw = 0, wpCapped = 0, clippedMinutes = 0;
  const perUserCapped = new Map();
  const dayBuckets = new Map();      // JST の暦日 -> 上限適用後のWP（ゲームの「今日の累計」用）
  for (const [k, v] of minuteBuckets) {
    const i = k.lastIndexOf('|');
    const id = k.slice(0, i);
    const minute = Number(k.slice(i + 1));
    wpRaw += v;
    const c = Math.min(v, WP.perMinuteCap);
    wpCapped += c;
    perUserCapped.set(id, (perUserCapped.get(id) || 0) + c);
    const day = jstDay(minute * 60000);
    dayBuckets.set(day, (dayBuckets.get(day) || 0) + c);
    if (v > WP.perMinuteCap) clippedMinutes++;
  }
  const wpDaily = Object.fromEntries([...dayBuckets.entries()].sort());
  const wpToday = wpDaily[jstDay(Date.now())] || 0;

  const breakdown = [
    ...[...agg.values()].sort((a, b) => b.wp - a.wp).map(g => ({
      label: `tool_result ${g.tool}${g.isSubagent ? ' 〈子〉' : ''}`,
      count: g.ok,
      weight: +((WP.tool[g.tool] ?? WP.tool._default)
                * (g.isSubagent ? WP.subagentFactor : 1)).toFixed(2),
      wp: g.wp, kind: 'tool', isSubagent: g.isSubagent,
      failed: g.ng, isDefaultWeight: WP.tool[g.tool] === undefined,
    })),
    { label: 'lines_of_code(added)', count: added, weight: WP.linesAdded, wp: added * WP.linesAdded, kind: 'metric' },
    { label: 'lines_of_code(removed)', count: removed, weight: WP.linesRemoved, wp: removed * WP.linesRemoved, kind: 'metric' },
    { label: 'commit.count', count: commits, weight: WP.commit, wp: commits * WP.commit, kind: 'metric' },
    { label: 'pull_request.count', count: prs, weight: WP.pullRequest, wp: prs * WP.pullRequest, kind: 'metric' },
  ];
  // breakdown の合計は「生WP」。上限適用後が実際に使う wpTotal
  const wpTotal = wpCapped;

  /* ==================== 業務スコアカード ====================
     単一の合計値は作らない。多軸のまま並べてフロントで並べ替える。 */
  const scorecard = [...users.values()].map(u => {
    const s = u.sc;
    const d = delegation.get(u.id) || { viaSubagent: 0, all: 0 };
    const lines = s.linesAdded + s.linesRemoved;
    const outcome = s.linesAdded + s.linesRemoved * SCORE.eff.removed + s.prs * SCORE.eff.prLines;
    const eligible = s.prs >= SCORE.minPrs && lines >= SCORE.minLines;
    return {
      id: u.id, email: u.email, team: u.team,
      // 成果（絶対量）
      linesAdded: s.linesAdded, linesRemoved: s.linesRemoved, lines,
      commits: s.commits, prs: s.prs,
      // 使い方（subagent_completed / skill_executed の実測値を優先）
      skill: Math.max(s.skill, s.skillExec),
      skillNames: [...s.skillNames.entries()].sort((a, b) => b[1] - a[1]),
      agent: Math.max(s.agent, s.subAgents),
      customAgent: s.subAgentsCustom,
      asyncAgent: s.subAgentsAsync,
      subToolUses: s.subToolUses, subTokens: s.subTokens,
      subTypes: [...s.subTypes.entries()].sort((a, b) => b[1] - a[1]),
      skillPathsInstalled: s.skillPathsInstalled,
      // 委譲率は total_tool_uses（実測）を優先し、無ければヒューリスティックにフォールバック
      delegationPct: s.subToolUses && s.toolsOk
        ? +(s.subToolUses / s.toolsOk * 100).toFixed(1)
        : (d.all ? +(d.viaSubagent / d.all * 100).toFixed(1) : 0),
      delegationSource: s.subToolUses ? 'subagent_completed' : 'heuristic',
      // 投入
      outputTokens: s.outputTokens, cacheReadTokens: s.cacheReadTokens, costUsd: +s.costUsd.toFixed(2),
      toolsOk: s.toolsOk, toolsNg: s.toolsNg,
      failPct: (s.toolsOk + s.toolsNg) ? +(s.toolsNg / (s.toolsOk + s.toolsNg) * 100).toFixed(1) : 0,
      editAccept: s.editAccept, editReject: s.editReject,
      reworkPct: (s.editAccept + s.editReject) ? +(s.editReject / (s.editAccept + s.editReject) * 100).toFixed(1) : 0,
      // 効率（要: 最低成果フィルタ。満たさない人は null にしてランク外にする）
      efficiency: eligible && s.outputTokens ? +(outcome / s.outputTokens * SCORE.eff.scale).toFixed(3) : null,
      eligible,
      toolsPerPr: s.prs ? Math.round(s.toolsOk / s.prs) : null,
      // 活動
      activeDays: s.days.size, sessions: s.sessions.size,
      // ゲーム用WP（参考。業務評価には使わない）
      gameWp: Math.round(perUserCapped.get(u.id) ?? 0),
    };
  }).sort((a, b) => b.lines - a.lines);

  return {
    stats: { ...stats, uptimeSec: Math.round((Date.now() - stats.startedAt) / 1000), rawFile: RAW_FILE },
    wpTotal, breakdown, weights: WP,
    wpDaily, wpToday,                 // ゲーム側の「今日の累計WP」用
    scorecard, scoreConfig: SCORE,
    cap: {
      perMinute: WP.perMinuteCap, wpRaw, wpCapped,
      clipped: wpRaw - wpCapped, clippedMinutes,
      activeMinutes: minuteBuckets.size,
      peakPerMinute: minuteBuckets.size ? Math.max(...minuteBuckets.values()) : 0,
    },
    subagent: {
      windows: agentWindows.length,
      toolsInside: [...agg.values()].filter(g => g.isSubagent).reduce((s, g) => s + g.ok, 0),
      factor: WP.subagentFactor,
    },
    series: [...series.values()].sort((a, b) => a.name.localeCompare(b.name) || b.value - a.value),
    events: [...events.values()].sort((a, b) => b.count - a.count).map(e => ({
      name: e.name, count: e.count, first: e.first, last: e.last,
      attrKeys: [...e.attrKeys].sort(),
      breakdown: [...e.breakdown.entries()].sort((a, b) => b[1] - a[1]),
      sums: [...e.sums.entries()].sort((a, b) => b[1] - a[1]),
    })),
    users: [...users.values()]
      .map(u => ({ ...u, wpTool: perUser.get(u.id) || 0,
                   wpRaw: u.wpMetric + (perUser.get(u.id) || 0),
                   wp: perUserCapped.get(u.id) ?? (u.wpMetric + (perUser.get(u.id) || 0)) }))
      .sort((a, b) => b.wp - a.wp),
    resources: [...resources.values()].sort((a, b) => b.last - a.last),
    recent: [...recent].reverse().slice(0, 120),
  };
}

/* ============================ 生ログ保存 / リプレイ ============================ */
function appendRaw(kind, payload) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(RAW_FILE, JSON.stringify({ kind, at: Date.now(), payload }) + '\n');
  } catch {}
}
function replay() {
  let txt = '';
  try { txt = fs.readFileSync(RAW_FILE, 'utf8'); } catch { return; }
  let n = 0;
  for (const line of txt.split('\n')) {
    if (!line) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    try {
      if (d.kind === 'metrics') ingestMetrics(d.payload);
      else if (d.kind === 'logs') ingestLogs(d.payload);
      else if (d.kind === 'traces') ingestTraces(d.payload);
      n++;
    } catch {}
  }
  stats.replayed = n;
}

/* ============================== HTTP サーバ ============================== */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('error', reject);
    req.on('end', () => {
      let buf = Buffer.concat(chunks);
      const enc = (req.headers['content-encoding'] || '').toLowerCase();
      try {
        if (enc.includes('gzip')) buf = zlib.gunzipSync(buf);
        else if (enc.includes('deflate')) buf = zlib.inflateSync(buf);
      } catch (e) { return reject(e); }
      resolve(buf);
    });
  });
}

export function startOtelReceiver(port = 4318) {
  replay();
  const srv = http.createServer(async (req, res) => {
    const route = (req.url || '/').split('?')[0];
    const ok = (b = '{}') => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(b); };

    if (req.method !== 'POST') {
      if (route === '/api/otel') { ok(JSON.stringify(snapshot())); return; }
      res.writeHead(404); res.end('otel receiver'); return;
    }
    const kind = route === '/v1/metrics' ? 'metrics'
               : route === '/v1/logs' ? 'logs'
               : route === '/v1/traces' ? 'traces' : null;
    if (!kind) { res.writeHead(404); res.end('{}'); return; }

    let buf;
    try { buf = await readBody(req); } catch { res.writeHead(400); res.end('{}'); return; }
    stats.bytes += buf.length;

    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (!ct.includes('json')) {
      // http/protobuf で来てしまった場合。依存ゼロでは解けないので気づけるようにログを出す
      console.warn(`  [otel] ${route}: Content-Type=${ct} を受信。OTEL_EXPORTER_OTLP_PROTOCOL=http/json を設定してください`);
      ok(); return;
    }
    let payload;
    try { payload = JSON.parse(buf.toString('utf8')); } catch { res.writeHead(400); res.end('{}'); return; }

    appendRaw(kind, payload);
    try {
      if (kind === 'metrics') { stats.metricPosts++; ingestMetrics(payload); }
      else if (kind === 'logs') { stats.logPosts++; ingestLogs(payload); }
      else { stats.tracePosts++; ingestTraces(payload); }
    } catch (e) { console.warn('  [otel] ingest error:', e.message); }
    ok('{"partialSuccess":{}}');
  });
  srv.listen(port, '127.0.0.1', () => {
    console.log(`  📡 OTel レシーバ: http://localhost:${port} (/v1/metrics, /v1/logs)`);
    if (stats.replayed) console.log(`     過去ログ ${stats.replayed} 件をリプレイして集計済み`);
  });
  srv.on('error', e => console.warn(`  [otel] listen 失敗 (${port}): ${e.message}`));
  return srv;
}

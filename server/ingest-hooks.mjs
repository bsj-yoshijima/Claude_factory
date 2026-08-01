// Claude Code の hooks 受け口。工場に並ぶ Claude 君の在/不在はここで決まる。
//
// なぜ hooks が必要か:
//   OTel の属性に cwd / project は存在しない（実ログの全 attribute キーを確認済み）。
//   キャラのラベルとスキンの永続化キーはプロジェクト名なので、hook でしか取れない。
//
// なぜ PreToolUse / PostToolUse を使わないか:
//   実測でこの2つは 76回/時 走り、いま 1ms で終わっている。ネットワーク呼び出しを
//   足すと 20〜50倍になり体感される。使うのは低頻度の4つだけ（合計 約12回/時）。
//     SessionStart(5.9回/時) / UserPromptSubmit(2.5回/時) / Stop(2.3回/時) / SessionEnd
import { q } from './db.mjs';
import path from 'node:path';

/** busy → 休憩(☕) にするまでの無音時間。
 *  実測: 同一セッションの連続イベント間隔は p99=28.5s / p99.5=88.5s。
 *  90秒なら「作業中なのに休ませる」誤判定は全区間の 0.6% 程度。 */
export const IDLE_AFTER_SEC = 90;
/** 一度でも働いたセッションを工場から消すまでの無音時間。
 *  実測で30分超の沈黙は全区間の 0.05%。SessionEnd は kill -9 では飛ばないので保険が要る。 */
export const GONE_AFTER_SEC = 30 * 60;
/** 一度も働かなかったセッションを下げるまでの無音時間。
 *  実測で 207セッション中 191 が1分未満。これを30分残すと工場が残骸で埋まる。 */
export const GONE_IDLE_ONLY_SEC = 5 * 60;
/** 働いた実績のないセッションを工場に出すまでの猶予。
 *  busy になったセッションは実際に作業しているので、この猶予なしで即入場させる。 */
export const MIN_LIFE_SEC = 20;

const EVENTS = new Set(['SessionStart', 'UserPromptSubmit', 'Stop', 'SessionEnd']);

/**
 * hook 1件を反映する。
 * @param {number} userId  トークンから引いた本人（ペイロードは信用しない）
 * @param {{hook_event_name?:string, session_id?:string, cwd?:string}} body
 */
export async function ingestHook(userId, event, body) {
  const name = event || body?.hook_event_name;
  if (!EVENTS.has(name)) return { ok: false, reason: `unknown hook: ${name}` };
  const sessionId = String(body?.session_id || '').slice(0, 200);
  if (!sessionId) return { ok: false, reason: 'session_id がありません' };
  // cwd はフルパスで届く。表示に使うのは末尾のディレクトリ名だけ（パスを DB に残さない）
  const project = body?.cwd ? path.basename(String(body.cwd)) : '';

  if (name === 'SessionEnd') {
    await q(
      `UPDATE agent_sessions SET state='ended', ended_at=now(), last_event_at=now()
        WHERE session_id=$1 AND user_id=$2`, [sessionId, userId]);
    return { ok: true, state: 'ended' };
  }

  // SessionStart=idle（まだ働いていない） / UserPromptSubmit=busy / Stop=idle
  const state = name === 'UserPromptSubmit' ? 'busy' : 'idle';
  await q(
    `INSERT INTO agent_sessions(session_id, user_id, project, state, ever_busy, started_at, last_event_at)
     VALUES ($1,$2,$3,$4,$5,now(),now())
     ON CONFLICT (user_id, session_id) DO UPDATE
       SET state = EXCLUDED.state,
           ever_busy = agent_sessions.ever_busy OR EXCLUDED.ever_busy,
           last_event_at = now(),
           ended_at = NULL,
           -- SessionStart 以外では project を上書きしない（cwd が無い経路のため）
           project = CASE WHEN EXCLUDED.project <> '' THEN EXCLUDED.project
                          ELSE agent_sessions.project END`,
    [sessionId, userId, project, state, state === 'busy']);
  return { ok: true, state };
}

/**
 * いま工場に並べるエージェント一覧。
 * 状態の減衰（busy → 休憩 → 退場）はクエリ側で行う。バックグラウンドジョブを持たない。
 */
export async function activeAgents(userId) {
  const r = await q(
    `SELECT session_id, project, state, ever_busy, started_at, last_event_at,
            EXTRACT(EPOCH FROM (now() - last_event_at))::int AS idle_sec
       FROM agent_sessions
      WHERE user_id = $1
        AND state <> 'ended'
        -- 退場: 働いた実績があれば長め、無ければ短めで下げる
        AND last_event_at > now() - (CASE WHEN ever_busy THEN $2 ELSE $3 END || ' seconds')::interval
        -- 入場: 働いたセッションは即時。そうでなければ猶予を過ぎてから
        AND (ever_busy OR now() - started_at >= ($4 || ' seconds')::interval)
      ORDER BY ever_busy DESC, last_event_at DESC`,
    [userId, GONE_AFTER_SEC, GONE_IDLE_ONLY_SEC, MIN_LIFE_SEC]);

  return r.rows.map((w) => {
    const working = w.state === 'busy' && w.idle_sec <= IDLE_AFTER_SEC;
    return {
      sessionId: w.session_id,
      project: w.project || w.session_id.slice(0, 8),
      name: w.project || w.session_id.slice(0, 8),
      status: working ? 'busy' : 'idle',
      working,
      idleSec: w.idle_sec,
      startedAt: w.started_at,
    };
  });
}

/** 終了済み・古すぎるセッションを掃除する（起動時と定期実行） */
export async function purgeOldSessions() {
  const r = await q(
    `DELETE FROM agent_sessions WHERE last_event_at < now() - interval '7 days'`);
  return r.rowCount;
}

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

/** busy → 休憩(☕) にするまでの、hook が途切れてからの時間。
 *  hook は「プロンプト投入(UserPromptSubmit)」と「応答終了(Stop)」しか飛ばないので、
 *  これ単独だと 90秒を超える作業は必ず休憩に見える（＝稼働中のエージェントが 💤 になる）。
 *  OTel が届いているセッションは下の ACTIVE_AFTER_SEC が優先される。 */
export const IDLE_AFTER_SEC = 90;
/** OTel が最後に届いてから、まだ稼働中とみなす時間。
 *  実測(1日ぶん・470区間): 受信間隔は中央値 9.6秒 / p90 41秒。
 *  連続作業中の実測最大は 68.8秒（ログを出さない長いツール実行の区間）。
 *  180秒はそこに約2.6倍の余裕を見た値。長くするほど「kill -9 で Stop が
 *  飛ばずに落ちたセッション」が 🟢 のまま残る時間も延びる、というトレードオフ。 */
export const ACTIVE_AFTER_SEC = 180;
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
    // seen_at = hook と OTel のうち新しいほう。「まだ居るか」はこれで測る
    `WITH a AS (
       SELECT *, GREATEST(last_event_at, COALESCE(last_activity_at, last_event_at)) AS seen_at
         FROM agent_sessions WHERE user_id = $1 AND state <> 'ended')
     SELECT session_id, project, state, ever_busy, started_at, last_event_at,
            EXTRACT(EPOCH FROM (now() - last_event_at))::int AS idle_sec,
            EXTRACT(EPOCH FROM (now() - last_activity_at))::int AS otel_sec
       FROM a
      WHERE -- 退場: 働いた実績があれば長め、無ければ短めで下げる
            seen_at > now() - (CASE WHEN ever_busy THEN $2 ELSE $3 END || ' seconds')::interval
        -- 入場: 働いたセッションは即時。そうでなければ猶予を過ぎてから
        AND (ever_busy OR now() - started_at >= ($4 || ' seconds')::interval)
      ORDER BY ever_busy DESC, seen_at DESC`,
    [userId, GONE_AFTER_SEC, GONE_IDLE_ONLY_SEC, MIN_LIFE_SEC]);

  return r.rows.map((w) => {
    // state は「プロンプトを投げてから Stop が来るまで」busy。その区間のうち、
    //   hook が新しい            → そのまま稼働
    //   OTel が届き続けている    → 長い作業の最中。稼働のまま（本来の不具合はここ）
    // OTel が無いセッション(otel_sec=null)は従来どおり hook だけで判定する。
    const working = w.state === 'busy'
      && (w.idle_sec <= IDLE_AFTER_SEC || (w.otel_sec != null && w.otel_sec <= ACTIVE_AFTER_SEC));
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

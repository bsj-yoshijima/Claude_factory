// WP（Work Point）の重みと集計。
//
// 旧 otel.mjs との違いは3点:
//   1. 全ユーザー合算だった wpTotal / wpToday を user_id ごとに分けた（旧実装のバグ）
//   2. 生ログを全リプレイせず、wp_source_minute（重みをかける前のカウント）から集計する
//   3. 重みは DB の wp_weights テーブルに置く。UPDATE すれば全期間が即座に再集計される
//
// 重みの意味と較正の根拠は WP.md を参照。ここは値の置き場所でしかない。
import { q, all, one } from './db.mjs';
import { jstDay } from './time.mjs';

export const WP = {
  tool: {
    Edit: 10, Write: 10, NotebookEdit: 10,
    Bash: 4,
    Agent: 3, Task: 3,      // 起動コストのみ。中身の労働は子の tool_result 側で数える
    Skill: 25,
    Read: 2, Grep: 2, Glob: 2,
    _default: 3,            // 上記以外・MCP ツールなど
  },
  metric: {
    linesAdded: 0.5,
    linesRemoved: 0.3,      // 削除も労働として評価（行数稼ぎの逆インセンティブを消す）
    commit: 50,
    pullRequest: 150,
  },
  config: {
    subagentFactor: 0.5,    // サブエージェント内のツール実行にかける係数
    perMinuteCap: 200,      // 1人1分あたりの上限（ガードレール。実測 p90=45）
  },
};

/** コード側の重みを wp_weights に流し込む。起動のたびに実行して構わない（冪等） */
export async function syncWeights() {
  const rows = [];
  for (const [k, v] of Object.entries(WP.tool)) rows.push(['tool', k, v]);
  for (const [k, v] of Object.entries(WP.metric)) rows.push(['metric', k, v]);
  for (const [k, v] of Object.entries(WP.config)) rows.push(['config', k, v]);
  await q(
    `INSERT INTO wp_weights(kind, key, weight)
     SELECT * FROM UNNEST($1::text[], $2::text[], $3::float8[])
     ON CONFLICT (kind, key) DO UPDATE SET weight = EXCLUDED.weight`,
    [rows.map((r) => r[0]), rows.map((r) => r[1]), rows.map((r) => r[2])],
  );
}

/** その人の全期間の累計WP（上限適用後）。製造の delta 計算に使う */
export async function totalWp(userId) {
  const r = await one(`SELECT COALESCE(SUM(wp),0) AS wp FROM wp_minute WHERE user_id=$1`, [userId]);
  return Number(r?.wp || 0);
}

/** JST の暦日ごとのWP。今日の労働量ボードとマイページが読む */
export async function dailyWp(userId, fromDay = null, toDay = null) {
  return all(
    `SELECT day, wp, wp_raw, wp_clipped
       FROM wp_daily
      WHERE user_id=$1
        AND ($2::date IS NULL OR day >= $2)
        AND ($3::date IS NULL OR day <= $3)
      ORDER BY day`,
    [userId, fromDay, toDay],
  );
}

/** 今日のWP（JST） */
export async function todayWp(userId) {
  const r = await one(`SELECT COALESCE(wp,0) AS wp FROM wp_daily WHERE user_id=$1 AND day=$2`,
    [userId, jstDay()]);
  return Number(r?.wp || 0);
}

/** 上限で削られた量。「黙ってクリップしない」ため画面に出す用（WP.md §4） */
export async function capStats(userId) {
  const r = await one(
    `SELECT COALESCE(SUM(wp),0) AS wp, COALESCE(SUM(wp_raw),0) AS raw,
            COALESCE(SUM(wp_clipped),0) AS clipped,
            COUNT(*) FILTER (WHERE wp_clipped > 0) AS clipped_minutes,
            COUNT(*) AS active_minutes,
            COALESCE(MAX(wp_raw),0) AS peak
       FROM wp_minute WHERE user_id=$1`, [userId]);
  return {
    perMinute: WP.config.perMinuteCap,
    wp: Number(r?.wp || 0), wpRaw: Number(r?.raw || 0), clipped: Number(r?.clipped || 0),
    clippedMinutes: Number(r?.clipped_minutes || 0),
    activeMinutes: Number(r?.active_minutes || 0),
    peakPerMinute: Number(r?.peak || 0),
  };
}

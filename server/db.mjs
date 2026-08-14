// Postgres 接続。スキーマの適用（冪等）もここで面倒を見る。
import fs from 'node:fs';
import pg from 'pg';

const { Pool } = pg;

// bigint(int8) を文字列ではなく数値で受け取る。金額も WP も 2^53 に遠く及ばないので安全。
pg.types.setTypeParser(20, (v) => (v === null ? null : Number(v)));
// numeric / double も数値に
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

export const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://factory:factory@localhost:55432/factory';

// 1プロセスが握る最大接続数。
//
// 下げると遅くなる。getState は12本のクエリを投げるので、接続数を絞ると往復が
// 何波にも分かれる。DB がリモートだと効き方が大きい（Neon シンガポール、1往復
// 約77ms での実測: max=10 で getState 約390ms、max=3 で約1080ms）。
// 共有 DB でも絞る必要はまず無い（Neon 無料枠の実測は max_connections=901）。
// DB 側の上限に実際にぶつかったときだけ PG_POOL_MAX で下げる。
const POOL_MAX = Number(process.env.PG_POOL_MAX) || 10;

export const pool = new Pool({ connectionString: DATABASE_URL, max: POOL_MAX });

// アイドル中の接続が切れると pg は pool に 'error' を emit する。リスナが無いと
// EventEmitter がそれを throw し、uncaughtException でプロセスごと落ちる
// （Mac のスリープ・Docker の再起動などで実際に起きる）。ここで受けて捨てる。
// 壊れた接続は pg 側が既にプールから外しているので、次のクエリは新しい接続で通る。
pool.on('error', (err) => {
  console.error(`  [db] アイドル接続のエラー（プールから除外済み）: ${err.message}`);
});

export const q = (text, params) => pool.query(text, params);
/** 1行だけ返すクエリ。無ければ null */
export const one = async (text, params) => (await pool.query(text, params)).rows[0] ?? null;
/** 行の配列を返す */
export const all = async (text, params) => (await pool.query(text, params)).rows;

/** トランザクション。fn がthrowしたら ROLLBACK する */
export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch {}
    throw e;
  } finally {
    c.release();
  }
}

/** schema.sql を流す。全部 IF NOT EXISTS / OR REPLACE なので何度実行してもよい */
export async function migrate() {
  const sql = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  await pool.query(sql);
}

export async function waitForDb(timeoutMs = 20000) {
  const started = Date.now();
  for (;;) {
    try { await pool.query('SELECT 1'); return; }
    catch (e) {
      if (Date.now() - started > timeoutMs) {
        throw new Error(
          `Postgres に接続できません (${DATABASE_URL})\n` +
          `  → docker compose up -d を実行してください。詳細: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

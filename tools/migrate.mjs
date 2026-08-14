#!/usr/bin/env node
// スキーマ適用コマンド。**オーナーだけが実行する。**
//
//   npm run db:migrate
//
// なぜサーバの起動処理から切り離したか:
//   マルチユーザー版は「各自のPCでサーバを起動 → 1つの DB を共有する」形も取りうる。
//   起動のたびに DDL と wp_weights の上書きが走ると、
//     - 複数人が同時起動したときに DDL がぶつかる
//     - git pull し忘れた人が 1 人起動しただけで、古い重みが全員ぶんを上書きする
//   の 2 つが起きる。後者はエラーも出ずにスコアだけ変わるので特に危ない。
//   そこで DB を書き換える操作はここに集め、サーバ側は読むだけにした。
//
// 実行するもの:
//   1. db/schema.sql の適用（全部 IF NOT EXISTS / OR REPLACE なので何度でも安全）
//   2. schema_meta にバージョンを記録（サーバの起動ゲートが読む）
//   3. wp_weights の同期（コード側の重みを DB に反映）
//
// agent_sessions の掃除はサーバ側の毎時タイマーに任せている（このコマンドを
// 叩くまで掃除されない、という状態にしたくないため）。
import fs from 'node:fs';
import { pool, waitForDb, DATABASE_URL } from '../server/db.mjs';
import { SCHEMA_VERSION } from '../db/version.mjs';
import { syncWeights } from '../server/wp.mjs';

// 接続先を必ず見せる。共有 DB と手元の docker を取り違えたまま流すのが一番怖い
const shown = DATABASE_URL.replace(/\/\/([^:]+):[^@]*@/, '//$1:****@');   // パスワードは伏せる
console.log(`\n  接続先: ${shown}`);

await waitForDb();

const c = await pool.connect();
let ok = false;
try {
  // 実行者は基本 1 人だが、CI と手元が重なっても壊れないように直列化しておく。
  // 後から来たほうは待たされるだけで、失敗しない。
  await c.query(`SELECT pg_advisory_lock(hashtext('claude-factory-migrate'))`);

  const before = (await c.query(
    `SELECT version FROM schema_meta WHERE id = 1`).catch(() => null))?.rows?.[0]?.version ?? 0;

  await c.query(fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));

  await c.query(
    `INSERT INTO schema_meta(id, version, applied_at) VALUES (1, $1, now())
     ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, applied_at = EXCLUDED.applied_at`,
    [SCHEMA_VERSION]);

  await syncWeights();

  console.log(`  スキーマ: v${before || '未初期化'} → v${SCHEMA_VERSION}`);
  console.log(`  重み    : wp_weights を同期しました`);
  console.log(`\n  ✅ 完了。メンバーは git pull && npm run dev で最新に追随できます\n`);
  ok = true;
} finally {
  await c.query(`SELECT pg_advisory_unlock(hashtext('claude-factory-migrate'))`).catch(() => {});
  c.release();
  await pool.end();
}

process.exit(ok ? 0 : 1);

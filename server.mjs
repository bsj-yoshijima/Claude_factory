#!/usr/bin/env node
// Claude Factory — ローカルの全 Claude Code セッションを「工場で働くキャラ」として可視化する
// 依存ゼロ。`node server.mjs` で起動 → http://localhost:4321
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = process.env.PORT || 4321;
const SESSIONS_DIR = path.join(os.homedir(), '.claude', 'sessions');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// いま生きている claude プロセスの pid 集合を取る（死んだセッションの残骸を除外するため）
function livePids() {
  try {
    const out = execSync('ps -axo pid=,args=', { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split('\n')) {
      const m = line.match(/^\s*(\d+)\s+(.*)$/);
      if (!m) continue;
      const [, pid, args] = m;
      // "claude" 実行体だけ。grep 等の巻き込みを避ける
      if (/(^|\/|\s)claude(\s|$)/.test(args) && !/\bgrep\b/.test(args)) {
        pids.add(Number(pid));
      }
    }
    return pids;
  } catch {
    return null; // ps が使えない環境ではフィルタしない
  }
}

function collectSessions() {
  const live = livePids();
  let files = [];
  try {
    files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  } catch {
    return [];
  }
  const now = Date.now();
  const workers = [];
  for (const f of files) {
    let d;
    try { d = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8')); }
    catch { continue; }
    const pid = d.pid;
    const alive = live ? live.has(pid) : true;
    if (!alive) continue; // 生きているプロセスだけ工場に並べる
    const status = d.status || 'idle';
    workers.push({
      pid,
      sessionId: d.sessionId,
      name: d.name || `session-${pid}`,
      project: d.cwd ? path.basename(d.cwd) : '(unknown)',
      cwd: d.cwd || '',
      kind: d.kind || 'interactive',
      version: d.version || '',
      status,                         // "busy" | "idle"
      working: status === 'busy',     // キャラが手を動かす基準
      idleSec: d.updatedAt ? Math.round((now - d.updatedAt) / 1000) : null,
      startedAt: d.startedAt || null,
    });
  }
  // 稼働中を先頭に、次に更新が新しい順
  workers.sort((a, b) => (b.working - a.working) || ((a.idleSec ?? 1e12) - (b.idleSec ?? 1e12)));
  return workers;
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/sessions') {
    const workers = collectSessions();
    const body = JSON.stringify({
      ts: Date.now(),
      total: workers.length,
      busy: workers.filter(w => w.working).length,
      idle: workers.filter(w => !w.working).length,
      workers,
    });
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*', // file:// から開いても叩けるように
    });
    res.end(body);
    return;
  }
  // それ以外はドット絵工場ページを返す
  const html = fs.readFileSync(path.join(__dirname, 'pixel-factory.html'), 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, () => {
  console.log(`\n  🏭 Claude Factory 起動しました`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  データ元: ${SESSIONS_DIR}`);
  const w = collectSessions();
  console.log(`  現在: 全${w.length}体 / 稼働中${w.filter(x => x.working).length}体\n`);
});

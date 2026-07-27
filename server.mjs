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

// ===== 実トークン消費の集計(トランスクリプトを mtime キャッシュで軽量に) =====
const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const SAVE_FILE = path.join(os.homedir(), '.claude', 'claude-factory-save.json');
const tokFileCache = new Map();          // path -> {mtime, eff}
let tokTotal = 0, tokComputedAt = 0;
function listTranscripts(dir) {
  let out = [], ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listTranscripts(p));
    else if (e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}
function sumFileTokens(p) {
  let eff = 0, txt = '';
  try { txt = fs.readFileSync(p, 'utf8'); } catch { return 0; }
  for (const line of txt.split('\n')) {
    if (!line) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    const u = (d.message && d.message.usage) || d.usage;
    if (!u) continue;
    // 実消費 = 出力 + 入力 + キャッシュ生成（cache_read は巨大・安価なので除外）
    eff += (u.output_tokens || 0) + (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  }
  return eff;
}
function refreshTokens() {
  try {
    const files = listTranscripts(PROJECTS_DIR);
    let total = 0; const seen = new Set();
    for (const f of files) {
      seen.add(f);
      let st; try { st = fs.statSync(f); } catch { continue; }
      const c = tokFileCache.get(f);
      if (c && c.mtime === st.mtimeMs) { total += c.eff; continue; }
      const eff = sumFileTokens(f);
      tokFileCache.set(f, { mtime: st.mtimeMs, eff });
      total += eff;
    }
    for (const k of [...tokFileCache.keys()]) if (!seen.has(k)) tokFileCache.delete(k);
    tokTotal = total; tokComputedAt = Date.now();
  } catch {}
}

const server = http.createServer((req, res) => {
  const route = (req.url || '/').split('?')[0];
  const JSONH = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' };
  if (route === '/api/usage') {
    res.writeHead(200, JSONH);
    res.end(JSON.stringify({ totalTokens: tokTotal, computedAt: tokComputedAt }));
    return;
  }
  if (route === '/api/save') {
    if (req.method === 'POST') {
      let body = ''; req.on('data', c => body += c);
      req.on('end', () => { try { fs.writeFileSync(SAVE_FILE, body || '{}'); } catch {}
        res.writeHead(200, JSONH); res.end('{"ok":true}'); });
      return;
    }
    let data = '{}'; try { data = fs.readFileSync(SAVE_FILE, 'utf8'); } catch {}
    res.writeHead(200, JSONH); res.end(data || '{}');
    return;
  }
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
  // 画像などの静的アセット(/assets/* と *.jpg/png)を配信
  const MIME = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.gif':'image/gif',
                 '.svg':'image/svg+xml', '.css':'text/css', '.js':'text/javascript' };
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const ext = path.extname(urlPath).toLowerCase();
  if (ext && MIME[ext]) {
    const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const file = path.join(__dirname, safe);
    if (file.startsWith(__dirname) && fs.existsSync(file)) {
      res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(file));
      return;
    }
    res.writeHead(404); res.end('not found'); return;
  }
  // /classic=旧ドット絵, /next=Phaser基盤(プロトタイプ), それ以外=現行ゲーム
  const page = urlPath === '/classic' ? 'pixel-factory.html'
             : urlPath === '/next'    ? 'factory-phaser.html'
             : 'claude-factory.html';
  const html = fs.readFileSync(path.join(__dirname, page), 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(PORT, () => {
  console.log(`\n  🏭 Claude Factory 起動しました`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  データ元: ${SESSIONS_DIR}`);
  const w = collectSessions();
  console.log(`  現在: 全${w.length}体 / 稼働中${w.filter(x => x.working).length}体\n`);
  // トークン集計はサーバ起動をブロックしないよう遅延実行
  setTimeout(() => { refreshTokens(); console.log(`  実トークン消費(累計・実効): ${tokTotal.toLocaleString()}`); }, 300);
  setInterval(refreshTokens, 120000);
});

#!/usr/bin/env node
// Claude Factory — マルチユーザー版サーバ
//
//   ゲーム画面 + API + OTLP 受信 + hooks 受信 を1プロセスで持つ。
//   本番は Cloud Run 1コンテナ + Postgres を想定（この構成のままデプロイできる）。
//
//   起動:  docker compose up -d && node server/index.mjs
//   旧版:  node server.mjs   （単一ユーザーのローカル版。そのまま残してある）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { waitForDb, one, pool } from './db.mjs';
import { SCHEMA_VERSION } from '../db/version.mjs';
import * as Auth from './auth.mjs';
import { ingestLogs, ingestMetrics } from './ingest-otel.mjs';
import { ingestHook, purgeOldSessions } from './ingest-hooks.mjs';
import * as API from './api.mjs';
import * as GD from './game-data.mjs';

const PORT = Number(process.env.PORT || 4321);
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECURE = PUBLIC_URL.startsWith('https://');

const JSONH = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const send = (res, status, body, headers = {}) => {
  const b = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { ...JSONH, ...headers });
  res.end(b);
};
const sendHtml = (res, html, headers = {}) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(html);
};

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('error', reject);
    req.on('end', () => {
      let buf = Buffer.concat(chunks);
      const enc = String(req.headers['content-encoding'] || '').toLowerCase();
      try {
        if (enc.includes('gzip')) buf = zlib.gunzipSync(buf);
        else if (enc.includes('deflate')) buf = zlib.inflateSync(buf);
      } catch (e) { return reject(e); }
      resolve(buf);
    });
  });
}
const readJson = async (req) => {
  const buf = await readBody(req);
  if (!buf.length) return {};
  return JSON.parse(buf.toString('utf8'));
};

/* ============================== 静的ファイル ============================== */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
function serveStatic(res, urlPath) {
  const ext = path.extname(urlPath).toLowerCase();
  if (!ext || !MIME[ext]) return false;
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); res.end('not found'); return true;
  }
  // アセットは数百枚あるので、本番は CDN 前提。ローカルでは短めのキャッシュ
  res.writeHead(200, { 'Content-Type': MIME[ext], 'Cache-Control': 'public, max-age=300' });
  res.end(fs.readFileSync(file));
  return true;
}

/* ============================== ログイン画面 ============================== */
const page = (title, inner) => `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<!-- 色のトークンはゲーム画面と共有する（静的配信は認証前に通るのでログイン前でも読める） -->
<link rel="stylesheet" href="/game/theme.css"><style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
 background:radial-gradient(120% 120% at 50% 30%,#1b232b 0%,#0c1014 70%);color:var(--ink);
 font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
/* ゲーム画面のダイアログ(#panel)と同じ考え方。カードは必ず画面内に収め、
   溢れる分はカードの中でスクロールさせる（画面ごと伸びると下のボタンに気づけない） */
.card{width:min(640px,100%);background:rgba(16,24,26,.9);border:1px solid var(--edge);
 border-radius:14px;padding:26px 24px;max-height:calc(100vh - 48px);overflow-y:auto;
 overscroll-behavior:contain}
h1{margin:0 0 6px;font-size:20px;color:var(--gold)} h2{font-size:14px;color:var(--mint);margin:22px 0 8px}
p,li{font-size:13px;line-height:1.75;color:#cfe6dc} .dim{color:#9fb0c0;font-size:12px}
button,.btn{background:var(--gold);color:#243b34;font-weight:700;border:0;border-radius:9px;
 padding:11px 18px;cursor:pointer;font-family:inherit;font-size:13px;text-decoration:none;display:inline-block}
input{background:#0e1518;border:1px solid var(--edge);color:var(--ink);border-radius:9px;
 padding:11px 12px;font-family:inherit;font-size:13px;width:100%}
/* 設定JSONは60行超あり、そのまま出すとカードの中身がこれだけになってしまう。
   高さを画面の4割で止めて中でスクロールさせ、前後の手順とボタンを画面内に残す */
pre{background:#0b1114;border:1px solid var(--edge);border-radius:10px;padding:13px;
 overflow:auto;max-height:40vh;font-size:11.5px;line-height:1.6;color:#bfe6d5;position:relative}
ol{padding-left:20px} .row{display:flex;gap:9px;align-items:center;margin-top:12px;flex-wrap:wrap}
.warn{border-left:3px solid var(--gold);padding-left:11px;color:#ffe6b8;font-size:12px;margin:14px 0}
</style></head><body><div class="card">${inner}</div></body></html>`;

const loginPage = () => page('Claude Factory — ログイン', `
<h1>🏭 Claude Factory</h1>
<p class="dim">いま動いている Claude Code のセッションを「工場で働く仲間」として可視化する育成ゲーム。</p>
${Auth.google.enabled ? `
<div class="row"><a class="btn" href="/auth/google">Google でログイン</a></div>
${Auth.google.hd ? `<p class="dim">${Auth.google.hd} のアカウントのみ</p>` : ''}` : `
<div class="warn">Google SSO が未設定なので <b>dev ログイン</b>が有効です。<br>
本番では <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> を設定してください
（設定すると dev ログインは自動的に無効になります）。</div>
<form method="POST" action="/auth/dev">
  <input name="email" type="email" required placeholder="you@example.com" value="dev@example.com">
  <div class="row"><button type="submit">dev ログイン</button></div>
</form>`}`);

const setupPage = (user, token) => {
  const settings = {
    env: {
      CLAUDE_CODE_ENABLE_TELEMETRY: '1',
      OTEL_METRICS_EXPORTER: 'otlp',
      OTEL_LOGS_EXPORTER: 'otlp',
      OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
      OTEL_EXPORTER_OTLP_ENDPOINT: PUBLIC_URL,
      OTEL_EXPORTER_OTLP_HEADERS: `Authorization=Bearer ${token}`,
      OTEL_METRIC_EXPORT_INTERVAL: '60000',
      OTEL_LOGS_EXPORT_INTERVAL: '5000',
      OTEL_LOG_USER_PROMPTS: '0',
      OTEL_LOG_ASSISTANT_RESPONSES: '0',
      OTEL_LOG_TOOL_DETAILS: '0',
      OTEL_LOG_TOOL_CONTENT: '0',
    },
    hooks: Object.fromEntries(['SessionStart', 'UserPromptSubmit', 'Stop', 'SessionEnd'].map((ev) => [ev, [{
      hooks: [{
        type: 'command',
        // タイムアウト1秒・失敗は握り潰す。サーバが落ちても Claude Code を止めない
        command: `curl -sS -m 1 -X POST ${PUBLIC_URL}/hooks/${ev} ` +
          `-H 'Authorization: Bearer ${token}' -H 'Content-Type: application/json' --data-binary @- >/dev/null 2>&1 || true`,
        timeout: 2,
      }],
    }]])),
  };
  return page('Claude Factory — セットアップ', `
<h1>⚙️ セットアップ</h1>
<p>${user.email} としてログイン中。あとは Claude Code 側の設定を1回だけ。</p>
<h2>1. <code>~/.claude/settings.json</code> にこれをマージする</h2>
<pre id="cfg">${JSON.stringify(settings, null, 2).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>
<div class="row"><button onclick="navigator.clipboard.writeText(document.getElementById('cfg').textContent);this.textContent='コピーしました ✓'">クリップボードにコピー</button>
<a class="btn" href="/api/setup.json" download="claude-factory-settings.json" style="background:#3a4a45;color:#cfeee0">JSON で保存</a></div>
<div class="warn">⚠️ <b>すでに起動している claude セッションには反映されません。</b>
貼り付けたあと、<b>新しいセッションを起動</b>してください。</div>
<h2>2. 動作確認</h2>
<p class="dim">新しい claude を起動して何か作業すると、数秒で工場にキャラが現れます。</p>
<div class="row"><a class="btn" href="/">工場へ行く</a>
<a class="btn" href="/api/health" style="background:#3a4a45;color:#cfeee0">受信状況を見る</a></div>
<h2>このトークンについて</h2>
<p class="dim">トークンはあなた専用です。集計はトークンから引いた本人に紐づけられ、
送られてきた <code>user.email</code> の自己申告は照合にしか使いません（なりすまし防止）。
漏れたと思ったら <a href="/setup?rotate=1" style="color:var(--gold)">再発行</a> してください。</p>`);
};

/* ================================ ルータ ================================ */
async function handle(req, res) {
  const url = new URL(req.url, PUBLIC_URL);
  const route = url.pathname;
  const method = req.method || 'GET';

  /* ---------- OTLP 受信（Claude Code から。Cookie ではなくトークン認証） ---------- */
  if (route === '/v1/logs' || route === '/v1/metrics' || route === '/v1/traces') {
    if (method !== 'POST') return send(res, 405, { error: 'POST only' });
    const user = await Auth.userFromIngest(req);
    if (!user) return send(res, 401, { error: 'invalid ingest token' });
    let payload;
    try {
      const buf = await readBody(req);
      const ct = String(req.headers['content-type'] || '').toLowerCase();
      if (!ct.includes('json')) {
        console.warn(`  [otel] Content-Type=${ct}。OTEL_EXPORTER_OTLP_PROTOCOL=http/json を設定してください`);
        return send(res, 200, { partialSuccess: {} });
      }
      payload = JSON.parse(buf.toString('utf8'));
    } catch (e) { return send(res, 400, { error: String(e.message) }); }

    const audit = Auth.makeAuditor(user);
    try {
      if (route === '/v1/logs') stats.logs += (await ingestLogs(user.id, payload, audit)).accepted;
      else if (route === '/v1/metrics') stats.metrics += (await ingestMetrics(user.id, payload, audit)).accepted;
      // traces は BETA 有効時のみ。いまは数えるだけ
      else stats.traces++;
      stats.lastAt = Date.now();
    } catch (e) { console.warn('  [otel] ingest error:', e.message); }
    return send(res, 200, { partialSuccess: {} });
  }

  /* ---------- hooks 受信 ---------- */
  if (route.startsWith('/hooks/')) {
    if (method !== 'POST') return send(res, 405, { error: 'POST only' });
    const user = await Auth.userFromIngest(req);
    if (!user) return send(res, 401, { error: 'invalid ingest token' });
    let body = {};
    try { body = await readJson(req); } catch { /* hook は stdin が空でも来る */ }
    const r = await ingestHook(user.id, route.slice('/hooks/'.length), body);
    stats.hooks++; stats.lastAt = Date.now();
    return send(res, r.ok ? 200 : 400, r);
  }

  /* ---------- 認証 ---------- */
  if (route === '/auth/google' && Auth.google.enabled) {
    const state = crypto.randomBytes(16).toString('hex');
    oauthStates.set(state, Date.now());
    res.writeHead(302, { Location: Auth.googleAuthUrl(`${PUBLIC_URL}/auth/google/callback`, state) });
    return res.end();
  }
  if (route === '/auth/google/callback' && Auth.google.enabled) {
    const state = url.searchParams.get('state');
    if (!state || !oauthStates.delete(state)) return send(res, 400, { error: 'state が不正です' });
    try {
      const claims = await Auth.googleExchange(
        url.searchParams.get('code'), `${PUBLIC_URL}/auth/google/callback`);
      const user = await Auth.upsertUser(claims);
      const token = await Auth.createSession(user.id);
      res.writeHead(302, { Location: '/setup', 'Set-Cookie': Auth.setCookie(token, SECURE) });
      return res.end();
    } catch (e) { return sendHtml(res, page('ログイン失敗', `<h1>ログインできませんでした</h1><p>${e.message}</p><p><a class="btn" href="/login">戻る</a></p>`)); }
  }
  if (route === '/auth/dev' && method === 'POST') {
    if (!Auth.DEV_LOGIN) return send(res, 403, { error: 'dev ログインは無効です' });
    const raw = (await readBody(req)).toString('utf8');
    const email = new URLSearchParams(raw).get('email') || (() => { try { return JSON.parse(raw).email; } catch { return null; } })();
    try {
      const user = await Auth.upsertUser({ email, name: String(email).split('@')[0] });
      const token = await Auth.createSession(user.id);
      const accept = String(req.headers.accept || '');
      if (accept.includes('application/json')) {
        return send(res, 200, { ok: true, email: user.email }, { 'Set-Cookie': Auth.setCookie(token, SECURE) });
      }
      res.writeHead(302, { Location: '/setup', 'Set-Cookie': Auth.setCookie(token, SECURE) });
      return res.end();
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (route === '/auth/logout') {
    const c = Auth.parseCookies(req);
    if (c[Auth.COOKIE]) await Auth.destroySession(c[Auth.COOKIE]);
    res.writeHead(302, { Location: '/login', 'Set-Cookie': Auth.clearCookie() });
    return res.end();
  }
  if (route === '/login') return sendHtml(res, loginPage());

  /* ---------- 受信状況（認証不要。値は返さない） ---------- */
  if (route === '/api/health') {
    return send(res, 200, {
      ok: true,
      db: await pool.query('SELECT 1').then(() => 'up').catch((e) => `down: ${e.message}`),
      master: GD.summary(),
      ingest: stats,
      auth: { google: Auth.google.enabled, devLogin: Auth.DEV_LOGIN, hd: Auth.google.hd || null },
      dev: { unlockAll: Auth.DEV_LOGIN },
      thresholds: { publicUrl: PUBLIC_URL },
    });
  }

  /* ---------- ここから先はログインが必要 ---------- */
  const cookies = Auth.parseCookies(req);
  const user = await Auth.userFromSession(cookies[Auth.COOKIE]);

  if (route === '/setup') {
    if (!user) { res.writeHead(302, { Location: '/login' }); return res.end(); }
    const token = url.searchParams.get('rotate')
      ? await Auth.rotateIngestToken(user.id) : await Auth.ensureIngestToken(user.id);
    return sendHtml(res, setupPage(user, token));
  }

  if (route.startsWith('/api/')) {
    if (!user) return send(res, 401, { error: 'ログインしてください', login: '/login' });
    try {
      const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await readJson(req) : null;
      let r;
      switch (`${method} ${route}`) {
        case 'GET /api/state':        r = await API.getState(user, url.searchParams); break;
        case 'GET /api/factory':      r = await API.getFactory(user); break;
        case 'POST /api/claim':       r = await API.postClaim(user); break;
        case 'POST /api/shop/buy':    r = await API.postBuy(user, body); break;
        case 'POST /api/machine/level': r = await API.postLevelUp(user, body); break;
        case 'PUT /api/layout':       r = await API.putLayout(user, body); break;
        case 'PUT /api/machine/slots': r = await API.putSlots(user, body); break;
        case 'PUT /api/machine/run':  r = await API.putRunning(user, body); break;
        case 'PUT /api/skin':         r = await API.putSkin(user, body); break;
        case 'GET /api/collection':   r = await API.getCollection(user); break;
        case 'GET /api/leaderboard':  r = await API.getLeaderboard(user, url.searchParams); break;
        case 'GET /api/made':         r = await API.getMade(user, url.searchParams); break;
        case 'GET /api/me':           r = await API.getMe(user, await Auth.ensureIngestToken(user.id)); break;
        case 'GET /api/mypage':       r = await API.getMyPage(user, url.searchParams); break;
        case 'PUT /api/factory/name': r = await API.putFactoryName(user, body); break;
        case 'GET /api/skins':        r = { status: 200, body: { skins: await API.skinsOf(user.id) } }; break;
        case 'GET /api/setup.json':   r = { status: 200, body: { note: '/setup の内容と同じ' } }; break;
        /* 開発用の裏道（画面の ?unlockall）。dev ログインが有効なとき＝Google SSO を
           設定していないローカル開発のときだけ通す。SSO を設定した本番相当の環境では
           ルート自体が存在しない（未知のルートと見分けがつかない 404）。
           これなら同僚は環境変数を足さずにクエリパラメータだけで使える。 */
        case 'POST /api/dev/unlockall':
          r = Auth.DEV_LOGIN ? await API.postDevUnlockAll(user)
                             : { status: 404, body: { error: `no route: ${method} ${route}` } };
          break;
        default: r = { status: 404, body: { error: `no route: ${method} ${route}` } };
      }
      return send(res, r.status, r.body);
    } catch (e) {
      console.error(`  [api] ${method} ${route}:`, e);
      return send(res, 500, { error: e.message });
    }
  }

  /* ---------- 静的ファイル・ゲーム画面 ---------- */
  if (serveStatic(res, decodeURIComponent(route))) return;
  if (!user) { res.writeHead(302, { Location: '/login' }); return res.end(); }
  // マルチユーザー版は Phaser 画面のみ。/metrics（検証用）は本番に持ち込まない
  return sendHtml(res, fs.readFileSync(path.join(ROOT, 'factory-phaser.html'), 'utf8'));
}

/* ============================ 死因を残す ============================ */
// dev サーバは標準出力しか持たないので、親シェルが閉じると落ちた理由も消える。
// 想定外の終了だけ dev-server.log に追記して、次に落ちたとき原因が分かるようにする。
const DEATH_LOG = path.join(ROOT, 'dev-server.log');
function recordDeath(kind, detail) {
  const line = `${new Date().toISOString()} [${kind}] pid=${process.pid} ${detail}\n`;
  console.error(`\n  ${line}`);
  try { fs.appendFileSync(DEATH_LOG, line); } catch {}
}
// 握り潰した例外でプロセスを落とさない（可視化ツールなので生存を優先する）
process.on('uncaughtException', (e) => recordDeath('uncaughtException', e?.stack || String(e)));
process.on('unhandledRejection', (e) => recordDeath('unhandledRejection', e?.stack || String(e)));
// 外から殺された場合（親シェルの終了・kill・Docker 停止）もそれと分かるように
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
  process.on(sig, () => { recordDeath('signal', sig); process.exit(0); });
}

/* ================================ 起動 ================================ */
const stats = { logs: 0, metrics: 0, traces: 0, hooks: 0, lastAt: null, startedAt: Date.now() };
const oauthStates = new Map();
setInterval(() => {                                  // 10分より古い state は捨てる
  const cut = Date.now() - 600e3;
  for (const [k, t] of oauthStates) if (t < cut) oauthStates.delete(k);
}, 60e3).unref();

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error('  [http]', e);
    try { send(res, 500, { error: 'internal error' }); } catch {}
  });
});

/**
 * スキーマの世代が合っているか確かめるだけ。DB には一切書き込まない。
 *
 * DB が古い場合は起動を止める。新しい列を前提にしたコードが走ると、
 * メンバーには原因の分からない SQL エラーとしてしか見えないため、
 * 「オーナーの migrate 待ち」だとその場で分かるようにしている。
 * 逆にコードが古い場合は、スキーマの変更が基本 additive で古いコードでも動くので、
 * 警告だけ出してそのまま起動する。
 */
async function checkSchema() {
  const r = await one(`SELECT version FROM schema_meta WHERE id = 1`).catch(() => null);
  const db = r?.version ?? 0;                       // 表ごと無い＝まだ一度も migrate していない

  if (db < SCHEMA_VERSION) {
    console.error(
      `\n  ⛔ DB のスキーマが古いため起動できません（DB: v${db || '未初期化'} / コード: v${SCHEMA_VERSION}）\n` +
      `\n     オーナーが npm run db:migrate を実行するまでお待ちください。` +
      `\n     手元の DB を自分で使っている場合は、自分で npm run db:migrate を実行してください。\n`);
    process.exit(1);
  }
  if (db > SCHEMA_VERSION) {
    console.warn(
      `\n  ⚠️  コードが古いようです（DB: v${db} / コード: v${SCHEMA_VERSION}）` +
      `\n     git pull で最新にしてください。このまま起動しますが、新しい機能は表示されません。\n`);
  }
}

async function main() {
  await waitForDb();
  await checkSchema();
  server.listen(PORT, () => {
    console.log(`\n  🏭 Claude Factory (マルチユーザー版)`);
    console.log(`  → ${PUBLIC_URL}`);
    console.log(`  マスタ: ${GD.summary()}`);
    console.log(`  認証  : ${Auth.google.enabled ? `Google SSO${Auth.google.hd ? ` (${Auth.google.hd} 限定)` : ''}`
      : 'dev ログイン（GOOGLE_CLIENT_ID 未設定のため）'}`);
    console.log(`  受信  : POST ${PUBLIC_URL}/v1/logs, /v1/metrics, /hooks/*`);
    if (Auth.DEV_LOGIN) console.log(`  裏道  : ?unlockall で全解放できます（dev ログイン中のみ。SSO を設定すると消えます）`);
    console.log('');
  });
  setInterval(() => purgeOldSessions().catch(() => {}), 3600e3).unref();
}

main().catch((e) => { console.error(`\n  起動に失敗しました:\n  ${e.message}\n`); process.exit(1); });

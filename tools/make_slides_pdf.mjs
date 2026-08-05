/* docs/slides.html を PDF に書き出す（docs/Claude-Factory.pdf）。

   スライドは JS で1枚だけ .on にして見せる作りなので、そのまま印刷すると1枚しか出ない。
   docs/slides.html 側の `@media print` が全枚数を縦並びに戻して1枚=1ページにしているので、
   ここは Chrome の printToPDF を叩くだけでよい。

   使い方: node tools/make_slides_pdf.mjs
     サーバ起動が前提（file:// だと印刷CSSの break-after が効かないことがある）。
     接続先は CF_URL で変えられる。

   依存ゼロ（Playwright は使わない）。Chrome を headless で起こして CDP で話す。 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.CF_URL || 'http://127.0.0.1:4321';
const URL_ = `${BASE.replace(/\/$/, '')}/docs/slides.html`;
const OUT = path.join(ROOT, 'docs', 'Claude-Factory.pdf');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9406;
const PROFILE = '/tmp/cf-slides-pdf';

/* 旧 docs/archive/Claude-Factory.pdf と同じ 16:9 の紙面。余白ゼロで1枚まるごと使う */
const PAPER = { width: 13.89, height: 7.81 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!fs.existsSync(CHROME)) {
    console.error(`  Chrome が見つかりません: ${CHROME}\n  CHROME_PATH で指定してください`);
    process.exit(1);
  }
  try {
    const res = await fetch(URL_, { method: 'HEAD' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error(`  ${URL_} が開けません (${e.message})\n  npm run dev でサーバを起動してください`);
    process.exit(1);
  }

  fs.rmSync(PROFILE, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run',
    '--window-size=1440,810', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(700);
    try { target = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); break; } catch {}
  }
  if (!target) { chrome.kill(); throw new Error('Chrome の CDP に繋がりませんでした'); }

  const ws = new WebSocket(target.find((t) => t.type === 'page').webSocketDebuggerUrl);
  const waits = new Map();
  let id = 0;
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((r) => {
    const i = ++id; waits.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });

  await send('Page.enable');
  // 2倍で描いてから紙に落とす（等倍だとドット絵のスクショが甘くなる）
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 810, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: URL_ });
  await sleep(6000);   // 焼き込んだ data URI の画像をデコードしきるまで待つ

  const n = (await send('Runtime.evaluate', {
    expression: 'document.querySelectorAll(".slide").length', returnByValue: true,
  })).result?.result?.value;

  const r = await send('Page.printToPDF', {
    printBackground: true, landscape: false, preferCSSPageSize: false,
    paperWidth: PAPER.width, paperHeight: PAPER.height,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0, scale: 1,
  });
  fs.writeFileSync(OUT, Buffer.from(r.result.data, 'base64'));
  chrome.kill();

  const pages = (fs.readFileSync(OUT).toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`  ${path.relative(ROOT, OUT)} — ${pages}ページ / ${(fs.statSync(OUT).size / 1024 / 1024).toFixed(1)}MB`);
  if (pages !== n) {
    console.error(`  !! スライド ${n}枚 に対して ${pages}ページ。印刷CSS(@media print)を確認すること`);
    process.exit(1);
  }
}

main().catch((e) => { console.error('  失敗:', e.message); process.exit(1); });

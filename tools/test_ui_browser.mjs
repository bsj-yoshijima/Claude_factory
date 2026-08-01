// 実ブラウザ(headless Chrome + CDP)でUIを操作して確認する。依存ゼロ。
//   使い方: node server.mjs を起動しておいて → node tools/test_ui_browser.mjs
// main.js と factory-phaser.html はどちらもクラシックスクリプトなので、
// グローバル名が衝突すると HTML 側が丸ごと実行されずボタンが全部死ぬ。
// その手の「構文は通るが実行時に壊れる」不具合はこのテストでしか捕まらない。
import { spawn } from 'node:child_process'; import fs from 'node:fs';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT=9334;
const prof='/tmp/cf-chrome-test-profile';
const ch=spawn(CHROME,['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${PORT}`,
  `--user-data-dir=${prof}`,'--window-size=1400,900','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let t=null; for(let i=0;i<40;i++){ try{ t=await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if(t.length)break; }catch(_){} await sleep(250);} 
const ws=new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl);
let id=0; const pend=new Map();
const send=(m,p={})=>new Promise(r=>{const i=++id; pend.set(i,r); ws.send(JSON.stringify({id:i,method:m,params:p}));});
const errs=[];
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m.result);pend.delete(m.id);return;}
  if(m.method==='Runtime.exceptionThrown'){const d=m.params.exceptionDetails; errs.push((d.exception&&d.exception.description)||d.text);}};
await new Promise(r=>ws.onopen=r);
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate',{url:'http://localhost:4321/'}); await sleep(6000);
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true}); return r.result?.value ?? r.exceptionDetails?.text;};
let fail=0; const ok=(c,m)=>{console.log((c?'  ok  ':'FAIL  ')+m); if(!c)fail++;};

console.log('=== ボタン操作 ===');
await ev(`document.getElementById('menuBtn').click()`); await sleep(200);
ok(await ev(`document.getElementById('menu').classList.contains('show')`), 'メニューボタン → メニューが開く');
await ev(`document.getElementById('menuBtn').click()`); await sleep(200);
ok(!(await ev(`document.getElementById('menu').classList.contains('show')`)), 'もう一度押すと閉じる');

await ev(`document.getElementById('editFab').click()`); await sleep(400);
ok(await ev(`window.__scene.editMode===true`), 'レイアウト編集ボタン → 編集モードON');
ok(await ev(`document.getElementById('palette').classList.contains('show')`), '編集パレットが出る');
await ev(`document.getElementById('editFab').click()`); await sleep(300);
ok(await ev(`window.__scene.editMode===false`), 'もう一度押すと編集モードOFF');

console.log('\n=== 製造機クリック → 素材パネル ===');
const mid=await ev(`window.__scene.placed.find(x=>x.kind==='machine').id`);
await ev(`window.__openMachine(${JSON.stringify(mid)})`); await sleep(400);
ok(await ev(`document.getElementById('overlay').classList.contains('show')`), '製造機の設定パネルが開く');
ok(await ev(`document.getElementById('panel').innerHTML.includes('製造機')`), 'パネルに製造機の見出しが出る');
const before=await ev(`JSON.stringify(window.__factory.getMachine(${JSON.stringify(mid)}).slots)`);
ok((await ev(`document.querySelectorAll('[data-slot]').length`))>0, 'マスの一覧が出る');
await ev(`document.querySelector('[data-slot]').click()`); await sleep(300);   // 1マス目を選ぶ
const nmat=await ev(`document.querySelectorAll('[data-mat]').length`);
ok(nmat>0, `マスを選ぶと素材の一覧が出る (${nmat}種)`);
await ev(`document.querySelector('[data-mat]').click()`); await sleep(400);    // 素材を選ぶ
const after=await ev(`JSON.stringify(window.__factory.getMachine(${JSON.stringify(mid)}).slots)`);
ok(before!==after, `素材を選ぶとスロットに入る ${before} → ${after}`);
ok((await ev(`document.getElementById('craft').innerHTML`)).includes('set'), '製造パネルのスロットも埋まる');
// 外す
await ev(`(function(){const c=document.querySelector('[data-clear]'); if(c)c.click();})()`); await sleep(400);
ok((await ev(`JSON.stringify(window.__factory.getMachine(${JSON.stringify(mid)}).slots)`))===before, '「外す」で元に戻る');
ok(await ev(`document.getElementById('craft').innerHTML.includes('原材料')||document.getElementById('craft').innerHTML.length>0`), '製造パネルが再描画される');

console.log('\n=== ショップ/図鑑 ===');
await ev(`document.querySelector('.close').click()`); await sleep(200);
for(const [fn,label] of [['openShop','ショップ'],['openDex','図鑑']]){
  await ev(`${fn}()`); await sleep(300);
  ok(await ev(`document.getElementById('overlay').classList.contains('show')`), `${label}が開く`);
  await ev(`closeOverlay()`); await sleep(150);
}
console.log('\n=== 実行時例外 ===');
console.log(errs.length? errs.slice(0,5).join('\n') : '  (なし)');
if(errs.length) fail++;
const shot=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('/tmp/cf-ui-test.png',Buffer.from(shot.data,'base64'));
console.log(fail? `\n${fail} 件 FAIL` : '\nすべて通過');
ws.close(); ch.kill(); process.exit(fail?1:0);

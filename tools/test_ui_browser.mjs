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

console.log('\n=== 製造機パネルの「✥ 移動」 ===');
ok((await ev(`document.querySelectorAll('[data-move]').length`))>0, '配置の行に移動ボタンがある');
await ev(`document.querySelector('[data-move]').click()`); await sleep(300);
ok(await ev(`window.__factory.isMoving()===true`), '移動ボタン → 移動モードに入る');
ok(!(await ev(`document.getElementById('overlay').classList.contains('show')`)), '移動モードに入るとパネルが閉じる（床をクリックできる）');
ok(await ev(`window.__scene.editMode===true`), '移動モードでは編集モードがONになる');
ok(await ev(`document.getElementById('editFab').classList.contains('on')`), '🔧ボタンの見た目も編集ONに揃う');
await ev(`window.__factory.cancelMove()`); await sleep(150);
await ev(`window.__scene.toggleEdit(false)`); await sleep(200);

console.log('\n=== ショップ/図鑑（共通ダイアログ） ===');
for(const [fn,label] of [['openShop','ショップ'],['openDex','図鑑']]){
  await ev(`${fn}()`); await sleep(300);
  ok(await ev(`document.getElementById('overlay').classList.contains('show')`), `${label}が開く`);
  ok(await ev(`!!document.querySelector('#panel .dlgHead h2') && !!document.querySelector('#panel .pbody')`), `${label}が共通ダイアログ（見出し＋本文）で描かれる`);
  ok((await ev(`document.querySelectorAll('#panel [data-dlgtab]').length`))>1, `${label}のタブが出る`);
  await ev(`closeOverlay()`); await sleep(150);
}
// タブ切替（ショップ: 売却 → 製造機）
await ev(`openShop('sell')`); await sleep(250);
await ev(`document.querySelector('[data-dlgtab="mach"]').click()`); await sleep(250);
ok(await ev(`document.querySelector('[data-dlgtab="mach"]').classList.contains('on')`), 'タブをクリックで切り替わる');
ok(await ev(`document.getElementById('panel').innerHTML.includes('製造機を購入')`), '切り替えた本文が描かれる');
await ev(`closeOverlay()`); await sleep(150);
// フッターの操作ボタン（原材料ピッカーの「原材料を外す」）
await ev(`window.__factory.setSlot(${JSON.stringify(mid)},0,'milk')`); await sleep(150);
await ev(`openMatPicker(${JSON.stringify(mid)},0)`); await sleep(250);
ok((await ev(`document.querySelectorAll('#panel .dlgFoot [data-dlgact]').length`))>0, 'フッターに操作ボタンが出る（原材料を外す）');
await ev(`document.querySelector('#panel .dlgFoot [data-dlgact]').click()`); await sleep(300);
ok(await ev(`window.__factory.getMachine(${JSON.stringify(mid)}).slots[0]===null`), 'フッターのボタンが機能する（原材料が外れる）');

console.log('\n=== エージェント一覧 → スキン変更 ===');
ok(!(await ev(`!!document.getElementById('legend')`)), '常時表示のエージェント凡例は無くなっている');
await ev(`document.getElementById('hud').click()`); await sleep(400);
ok(await ev(`document.getElementById('overlay').classList.contains('show')`), '稼働/休憩HUDのクリックで一覧が開く');
ok(await ev(`document.getElementById('panel').innerHTML.includes('エージェント')`), '一覧の見出しが出る');
const nag=await ev(`document.querySelectorAll('[data-agsel]').length`);
ok(nag>0, `エージェントの行が出る (${nag}件)`);
ok(await ev(`/稼働 \\d+ \\/ 休憩 \\d+/.test(document.querySelector('.dlgSub').textContent)`), '見出しに稼働/休憩の内訳が出る');
await ev(`document.querySelector('[data-agsel]').click()`); await sleep(250);
const nsk=await ev(`document.querySelectorAll('[data-skin]').length`);
ok(nsk>1, `行の「🎨 スキン」でスキン一覧が出る (${nsk}種)`);
const proj=await ev(`decodeURIComponent(document.querySelector('[data-skin]').dataset.proj)`);
await ev(`document.querySelectorAll('[data-skin]')[3].click()`); await sleep(300);
const applied=await ev(`(window.__factory.getAgents().find(a=>a.proj===${JSON.stringify(proj)})||{}).skinId`);
ok(applied&&applied!=='none', `一覧からスキンを変更できる (${proj} → ${applied})`);
ok(await ev(`window.__scene.skins[${JSON.stringify(proj)}]===${JSON.stringify(applied)}`), 'シーン側にも反映される（永続化フック経由）');
await ev(`document.querySelectorAll('[data-skin]')[0].click()`); await sleep(300);   // デフォルトへ戻す
ok((await ev(`(window.__factory.getAgents().find(a=>a.proj===${JSON.stringify(proj)})||{}).skinId`))==='none', 'デフォルトに戻せる');
await sleep(1200);
ok(await ev(`document.getElementById('overlay').classList.contains('show')&&document.querySelectorAll('[data-agsel]').length>0`), '開いている間も中身が更新され続ける（1秒ごと）');
await ev(`closeOverlay()`); await sleep(150);

console.log('\n=== メニューのグルーピング ===');
ok((await ev(`document.querySelectorAll('#menu .mh').length`))>=3, 'メニューに見出しが3つ以上ある');
ok((await ev(`document.querySelectorAll('#menu .msep').length`))>=2, 'メニューに区切りがある');
for(const idn of ['shopBtn','dexBtn','lbBtn','agentsBtn','editMenuBtn'])
  ok(await ev(`!!document.getElementById('${idn}')`), `メニュー項目 #${idn} がある`);
console.log('\n=== 実行時例外 ===');
console.log(errs.length? errs.slice(0,5).join('\n') : '  (なし)');
if(errs.length) fail++;
const shot=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('/tmp/cf-ui-test.png',Buffer.from(shot.data,'base64'));
console.log(fail? `\n${fail} 件 FAIL` : '\nすべて通過');
ws.close(); ch.kill(); process.exit(fail?1:0);

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
// 実マウス。DOM要素が mousemove を吸っていないか（Phaserにポインタが届くか）を見るのに使う
const mouse=(type,x,y)=>send('Input.dispatchMouseEvent',{type,x,y,button:'none',buttons:0});
let fail=0; const ok=(c,m)=>{console.log((c?'  ok  ':'FAIL  ')+m); if(!c)fail++;};

console.log('=== ボタン操作 ===');
await ev(`document.getElementById('menuBtn').click()`); await sleep(200);
ok(await ev(`document.getElementById('menu').classList.contains('show')`), 'メニューボタン → メニューが開く');
await ev(`document.getElementById('menuBtn').click()`); await sleep(200);
ok(!(await ev(`document.getElementById('menu').classList.contains('show')`)), 'もう一度押すと閉じる');

await ev(`document.getElementById('editFab').click()`); await sleep(400);
ok(await ev(`window.__scene.editMode===true`), 'レイアウト編集ボタン → 編集モードON');
ok(await ev(`document.getElementById('palette').classList.contains('show')`), '編集パレットが出る');

console.log('\n=== #palette がキャンバスのドラッグを塞がない ===');
// パレットは盤面の下1/4に重なる。枠・余白・アイテムの隙間が mousemove を吸うと Phaser の
// ポインタが更新されず、その領域でドラッグが固まる（既存バグ）。
const geo=JSON.parse(await ev(`(()=>{const p=document.getElementById('palette').getBoundingClientRect(),
  c=document.querySelector('#game canvas').getBoundingClientRect();
  return JSON.stringify({pl:p.left,pt:p.top,pw:p.width,ph:p.height,cl:c.left,ct:c.top,cw:c.width,ch:c.height});})()`));
ok(geo.pw>0&&geo.ph>0, `パレットの領域を取得 (${Math.round(geo.pw)}×${Math.round(geo.ph)})`);
// パレット∩キャンバスを格子状に叩いて、素通りしない要素が「押せるUI」だけか調べる
const probe=await ev(`(()=>{const p=document.getElementById('palette').getBoundingClientRect(),
  cv=document.querySelector('#game canvas'), c=cv.getBoundingClientRect(); let hit=0; const bad=[];
  for(let i=1;i<12;i++) for(let j=1;j<12;j++){
    const x=Math.round(p.left+p.width*i/12), y=Math.round(p.top+p.height*j/12);
    if(x<c.left||x>c.right||y<c.top||y>c.bottom) continue;
    const el=document.elementFromPoint(x,y); if(!el) continue;
    if(el===cv){ hit++; continue; }
    if(el.closest('.pitem')||el.closest('.pcat .c')) continue;
    bad.push(el.className||el.id||el.tagName); }
  return JSON.stringify({hit,bad:bad.slice(0,4)});})()`);
const pr=JSON.parse(probe);
ok(pr.hit>0, `パレットの下でもキャンバスに届く点がある (${pr.hit}点)`);
ok(pr.bad.length===0, `塞いでいるのは押せるUIだけ${pr.bad.length?' → '+pr.bad.join(','):''}`);
// 実際にマウスを動かして Phaser のポインタが追従するか（本命）
const gapX=Math.round(geo.pl+3), gapY=Math.round(geo.pt+geo.ph*0.5);   // パレットの左余白＝素通りすべき所
await mouse('mouseMoved',Math.round(geo.cl+40),Math.round(geo.ct+40)); await sleep(120);
const p0=await ev(`Math.round(window.__scene.input.activePointer.x)`);
await mouse('mouseMoved',gapX,gapY); await sleep(120);
const p1=await ev(`Math.round(window.__scene.input.activePointer.x)+','+Math.round(window.__scene.input.activePointer.y)`);
const wantX=Math.round((gapX-geo.cl)*(await ev(`window.__scene.scale.width`))/geo.cw);
ok(String(p1).split(',')[0]!==String(p0) && Math.abs(+String(p1).split(',')[0]-wantX)<6,
   `パレットの上でも Phaser のポインタが更新される (x ${p0} → ${p1} / 期待 x≈${wantX})`);
// 非表示のときはそもそも当たらない
await ev(`document.getElementById('editFab').click()`); await sleep(300);
ok(await ev(`window.__scene.editMode===false`), 'もう一度押すと編集モードOFF');
ok(await ev(`(()=>{const cv=document.querySelector('#game canvas');
  return document.elementFromPoint(${gapX},${gapY})===cv;})()`), 'パレット非表示のときも同じ点がキャンバスに届く');

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
ok(!(await ev(`document.getElementById('craft').innerHTML.includes('原材料をセット')`)), '常時表示のコンパクト製造が「作れる物」に変わる');
// 外す
await ev(`(function(){const c=document.querySelector('[data-clear]'); if(c)c.click();})()`); await sleep(400);
ok((await ev(`JSON.stringify(window.__factory.getMachine(${JSON.stringify(mid)}).slots)`))===before, '「外す」で元に戻る');
ok(await ev(`document.getElementById('craft').innerHTML.includes('原材料をセット')`), 'コンパクト製造も未設定に戻る');
ok((await ev(`document.querySelectorAll('[data-del]').length`))===0, '設定パネルに🗑撤去ボタンは無い（D&Dに一本化）');

console.log('\n=== 製造機パネルの「✥ 移動」 ===');
ok((await ev(`document.querySelectorAll('[data-move]').length`))>0, '配置の行に移動ボタンがある');
await ev(`document.querySelector('[data-move]').click()`); await sleep(300);
ok(await ev(`window.__factory.isMoving()===true`), '移動ボタン → 移動モードに入る');
ok(!(await ev(`document.getElementById('overlay').classList.contains('show')`)), '移動モードに入るとパネルが閉じる（床をクリックできる）');
ok(await ev(`window.__scene.editMode===true`), '移動モードでは編集モードがONになる');
ok(await ev(`document.getElementById('editFab').classList.contains('on')`), '🔧ボタンの見た目も編集ONに揃う');
await ev(`window.__factory.cancelMove()`); await sleep(150);
await ev(`window.__scene.toggleEdit(false)`); await sleep(200);

console.log('\n=== 🏭 製造タブ（素材のセットをここで完結） ===');
ok(await ev(`!!document.getElementById('craftBtn')`), 'メニュー「工場」に 🏭製造 がある');
await ev(`closeOverlay()`); await sleep(150);
await ev(`document.getElementById('craft').click()`); await sleep(350);
ok(await ev(`document.getElementById('overlay').classList.contains('show')`), '常時表示の製造をクリックで製造ダイアログが開く');
await ev(`closeOverlay()`); await sleep(150);
await ev(`document.getElementById('craftBtn').click()`); await sleep(350);
ok(await ev(`document.querySelector('#panel .dlgHead h2').textContent.includes('製造')`), 'メニューからも開く（見出しが 🏭 製造）');
const nslot=await ev(`document.querySelectorAll('[data-cslot]').length`);
ok(nslot===(await ev(`window.__factory.getMachine(${JSON.stringify(mid)}).size`)), `製造機のマス数ぶんスロットが出る (${nslot})`);
await ev(`document.querySelector('[data-cslot]').click()`); await sleep(250);
const ncm=await ev(`document.querySelectorAll('[data-cmat]').length`);
ok(ncm>0, `マスをクリックで原材料の一覧が出る (${ncm}種)`);
await ev(`document.querySelectorAll('[data-cmat]')[1].click()`); await sleep(350);   // 小麦粉
ok(await ev(`window.__factory.getMachine(${JSON.stringify(mid)}).slots[0]!==null`), 'ダイアログから原材料をセットできる');
ok(await ev(`document.getElementById('panel').innerHTML.includes('作れる物')`), '「作れる物」が出る');
// 2マス目も埋めてレシピに載る組み合わせにする（小麦粉+牛乳）
await ev(`document.querySelectorAll('[data-cslot]')[1].click()`); await sleep(250);
await ev(`document.querySelector('[data-cmat]').click()`); await sleep(350);
ok(await ev(`document.getElementById('panel').innerHTML.includes('種からランダム')`), 'レシピに載る組み合わせだと候補が出る');
// ▶製造開始
const gobtn=`[...document.querySelectorAll('#panel .dlgFoot [data-dlgact]')].find(b=>b.textContent.includes('製造'))`;
ok(await ev(`!${gobtn}.disabled`), 'フッターの ▶製造開始 が押せる');
await ev(`${gobtn}.click()`); await sleep(350);
ok(await ev(`!!craftState().session`), '▶製造開始でセッションが始まる');
ok(await ev(`document.getElementById('panel').innerHTML.includes('次の製品まで')`), 'WPの進捗が製造中の表示になる');
await ev(`[...document.querySelectorAll('#panel .dlgFoot [data-dlgact]')].find(b=>b.textContent.includes('停止')).click()`); await sleep(300);
ok(!(await ev(`!!craftState().session`)), '■停止で止まる');
await sleep(1200);
ok(await ev(`document.getElementById('overlay').classList.contains('show')&&document.querySelectorAll('[data-cslot]').length>0`), '開いている間も更新され続ける（live）');
// 機械の選択（2台目を置くとタブが出る）
const mid2=await ev(`(()=>{const s=window.__scene; for(let r=0;r<16;r++)for(let c=0;c<16;c++){
  if(s.canPlace('machine',c,r,{sub:'s3',dir:'u'})) return s.addPlaced('machine','s3',{cell:{c,r},dir:'u'}); } return null;})()`);
await ev(`window.__layoutChanged()`); await ev(`openCraft()`); await sleep(350);
const ntab=await ev(`document.querySelectorAll('#panel [data-dlgtab]').length`);
ok(ntab>1, `製造機が複数あるとタブで選べる (${ntab}台)`);
await ev(`document.querySelector('[data-dlgtab="${mid2}"]').click()`); await sleep(300);
ok((await ev(`craftState().activeId`))===mid2, 'タブで製造に使う機械を切り替えられる');
ok((await ev(`document.querySelectorAll('[data-cslot]').length`))===3, '選んだ機械のマス数（3マス）に切り替わる');
// ✕で外す
await ev(`document.querySelector('[data-cslot]').click()`); await sleep(200);
await ev(`document.querySelector('[data-cmat]').click()`); await sleep(300);
ok((await ev(`document.querySelectorAll('[data-cclear]').length`))>0, 'セット済みのマスに✕（外す）が出る');
await ev(`document.querySelector('[data-cclear]').click()`); await sleep(300);
ok(await ev(`window.__factory.getMachine(${JSON.stringify(mid2)}).slots[0]===null`), '✕で原材料を外せる');
// 後片付け（2台目を撤去して1台に戻す）
await ev(`window.__factory.removeMachine(${JSON.stringify(mid2)}); craftState().activeId=null; window.__layoutChanged();`);
await ev(`window.__factory.setSlot(${JSON.stringify(mid)},0,null); window.__factory.setSlot(${JSON.stringify(mid)},1,null); renderCraft();`);
await ev(`closeOverlay()`); await sleep(200);

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
for(const idn of ['craftBtn','shopBtn','dexBtn','lbBtn','agentsBtn','editMenuBtn'])
  ok(await ev(`!!document.getElementById('${idn}')`), `メニュー項目 #${idn} がある`);
console.log('\n=== 編集パレットの案内文（実態に合わせる） ===');
await ev(`document.getElementById('editFab').click()`); await sleep(400);
await ev(`document.querySelector('#palette .c[data-cat="machine"]').click()`); await sleep(250);
const mh=await ev(`document.querySelector('#palette .phint').textContent`);
ok(String(mh).includes('ドラッグ')&&String(mh).includes('ゴミ箱'), `製造機の案内が D&D 移動/撤去になっている → ${mh}`);
await ev(`document.querySelector('#palette .c[data-cat="prop"]').click()`); await sleep(250);
const ph=await ev(`document.querySelector('#palette .phint').textContent`);
ok(String(ph).includes('ドラッグ')&&String(ph).includes('ゴミ箱'), '装飾の案内と文言が揃っている');
await ev(`document.getElementById('editFab').click()`); await sleep(300);

console.log('\n=== 実行時例外 ===');
console.log(errs.length? errs.slice(0,5).join('\n') : '  (なし)');
if(errs.length) fail++;
const shot=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('/tmp/cf-ui-test.png',Buffer.from(shot.data,'base64'));
// 製造ダイアログを開いた状態のスクショ（レイアウト確認用）
await ev(`(()=>{const s=window.__scene.placed.find(x=>x.kind==='machine');
  window.__factory.setSlot(s.id,0,'flour'); window.__factory.setSlot(s.id,1,'milk'); renderCraft(); openCraft();})()`);
await sleep(600);
const shot2=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('/tmp/cf-ui-craft.png',Buffer.from(shot2.data,'base64'));
console.log(fail? `\n${fail} 件 FAIL` : '\nすべて通過');
ws.close(); ch.kill(); process.exit(fail?1:0);

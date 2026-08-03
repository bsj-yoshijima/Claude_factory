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
await send('Page.navigate',{url:'http://localhost:4321/'});
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,returnByValue:true}); return r.result?.value ?? r.exceptionDetails?.text;};
// 固定待ちにすると、プロファイルが冷えているときに間に合わずテスト全体が崩れる。
// Phaser のシーンが立ち上がる（= window.__scene が入る）まで待つ。
for(let i=0;i<80;i++){ if(await ev('typeof window.__scene')==='object') break; await sleep(250); }
await sleep(800);   // create() 直後の初回描画ぶん
// 実マウス。DOM要素が mousemove を吸っていないか（Phaserにポインタが届くか）を見るのに使う
const mouse=(type,x,y)=>send('Input.dispatchMouseEvent',{type,x,y,button:'none',buttons:0});
let fail=0; const ok=(c,m)=>{console.log((c?'  ok  ':'FAIL  ')+m); if(!c)fail++;};

const window0=JSON.parse(await ev(`JSON.stringify({w:innerWidth,h:innerHeight})`));
console.log('=== ボタン操作 ===');
await ev(`document.getElementById('menuBtn').click()`); await sleep(200);
ok(await ev(`document.getElementById('menu').classList.contains('show')`), 'メニューボタン → メニューが開く');
await ev(`document.getElementById('menuBtn').click()`); await sleep(200);
ok(!(await ev(`document.getElementById('menu').classList.contains('show')`)), 'もう一度押すと閉じる');

await ev(`document.getElementById('editFab').click()`); await sleep(700);   // 寄せのトランジション(0.42s)が終わるまで待つ
ok(await ev(`window.__scene.editMode===true`), 'レイアウト編集ボタン → 編集モードON');
ok(await ev(`document.getElementById('palette').classList.contains('show')`), '編集パレットが出る');

console.log('\n=== 編集中は工場が右へ寄り、左にパレットが出る ===');
// 以前はパレットを盤面に重ねていて、枠や余白が mousemove を吸うとドラッグが固まった。
// いまは左のサイドバーなので「盤面と一切重ならない」ことを直接確かめる。
const geo=JSON.parse(await ev(`(()=>{const p=document.getElementById('palette').getBoundingClientRect(),
  c=document.querySelector('#game canvas').getBoundingClientRect();
  return JSON.stringify({pl:p.left,pt:p.top,pr:p.right,pw:p.width,ph:p.height,
    cl:c.left,ct:c.top,cr:c.right,cw:c.width,ch:c.height,vw:innerWidth});})()`));
ok(geo.pw>0&&geo.ph>0, `パレットの領域を取得 (${Math.round(geo.pw)}×${Math.round(geo.ph)})`);
ok(Math.round(geo.pl)===0 && geo.ph>=window0.h*0.9, `パレットは画面左に張り付いた縦パネル (left=${Math.round(geo.pl)}, h=${Math.round(geo.ph)})`);
ok(geo.cl>=geo.pr-1, `工場はパレットの右へ寄っている (canvas.left=${Math.round(geo.cl)} ≧ palette.right=${Math.round(geo.pr)})`);
ok(geo.cr<=geo.vw+1, `寄せても工場が画面からはみ出さない (canvas.right=${Math.round(geo.cr)} ≦ ${geo.vw})`);
// 縮めて逃がすのではなく、パレットを除いた残り幅いっぱいに広げる（余白を残さない）
ok(geo.vw-geo.cr <= (geo.cl-geo.pr)+6, `右の余白が左と同程度まで詰まっている (左${Math.round(geo.cl-geo.pr)}px / 右${Math.round(geo.vw-geo.cr)}px)`);
ok(geo.cw >= (geo.vw-geo.pw)*0.9, `盤面が残り幅の9割以上を使っている (canvas ${Math.round(geo.cw)}px / 残り ${Math.round(geo.vw-geo.pw)}px)`);
// パレット領域を格子状に叩いて、キャンバスと重なる点が1つも無いこと
const over=+await ev(`(()=>{const p=document.getElementById('palette').getBoundingClientRect(),
  c=document.querySelector('#game canvas').getBoundingClientRect(); let n=0;
  for(let i=1;i<12;i++) for(let j=1;j<12;j++){
    const x=p.left+p.width*i/12, y=p.top+p.height*j/12;
    if(x>=c.left&&x<=c.right&&y>=c.top&&y<=c.bottom) n++; }
  return n;})()`);
ok(over===0, `パレットと盤面が重ならない (重なり ${over}点)`);
// 寄せたあとも Phaser の当たり判定が付いてくるか（transform で動かしているので本命）
const midX=Math.round((geo.cl+geo.cr)/2), midY=Math.round(geo.ct+geo.ch*0.4);
await mouse('mouseMoved',midX,midY); await sleep(200);
const got=String(await ev(`Math.round(window.__scene.input.activePointer.x)`));
const wantX=Math.round((midX-geo.cl)*(await ev(`window.__scene.scale.width`))/geo.cw);
ok(Math.abs(+got-wantX)<8, `寄せたあともポインタ座標が合う (x ${got} / 期待 ≈${wantX})`);
// 閉じると元の位置に戻る
await ev(`document.getElementById('editFab').click()`); await sleep(700);
ok(await ev(`window.__scene.editMode===false`), 'もう一度押すと編集モードOFF');
ok(await ev(`document.getElementById('palette').getBoundingClientRect().right<=1`), 'パレットは左へ引っ込む');
ok(await ev(`!document.getElementById('wrap').classList.contains('editing')`), '工場の寄せも戻る');

console.log('\n=== 製造機クリック → 設定パネル（中身は🏭製造の一覧と同じ行 + 配置） ===');
const mid=await ev(`window.__scene.placed.find(x=>x.kind==='machine').id`);
// localStorage が前回の実行から残るので、素材を空にしてから始める（前回の素材が残ると差分が出ない）
const clearSlots=async(id)=>{ await ev(`(()=>{const m=window.__factory.getMachine(${JSON.stringify(id)});
  for(let i=0;i<m.size;i++) window.__factory.setSlot(m.id,i,null); window.__layoutChanged(); renderCraft();})()`); };
await clearSlots(mid);
await ev(`window.__openMachine(${JSON.stringify(mid)})`); await sleep(400);
ok(await ev(`document.getElementById('overlay').classList.contains('show')`), '製造機の設定パネルが開く');
ok(await ev(`document.getElementById('panel').innerHTML.includes('製造機')`), 'パネルに製造機の見出しが出る');
const before=await ev(`JSON.stringify(window.__factory.getMachine(${JSON.stringify(mid)}).slots)`);
ok((await ev(`document.querySelectorAll('#panel .mrow').length`))===1, '一覧と同じ行(.mrow)が1台ぶん出る');
ok((await ev(`document.querySelectorAll('#panel .mrow [data-cslot]').length`))===(await ev(`window.__factory.getMachine(${JSON.stringify(mid)}).size`)), 'マス数ぶんのスロットが出る');
ok((await ev(`document.querySelectorAll('#panel [data-crun]').length`))===1, '行の中に▶製造開始がある');
await ev(`document.querySelector('#panel [data-cslot]').click()`); await sleep(300);   // 1マス目を選ぶ
const nmat=await ev(`document.querySelectorAll('[data-cmat]').length`);
ok(nmat===(await ev(`MATS.length`)), `マスを選ぶと全ジャンルの素材が一度に出る (${nmat}種)`);
ok((await ev(`document.querySelectorAll('#panel .pgroup .ghead').length`))===(await ev(`GENRES.length`)),
   'ジャンルごとの見出しの下に原材料が並ぶ（タブ切り替えではない）');
ok(!(await ev(`/マス目 ▸/.test(document.getElementById('panel').textContent)`)), '「Nマス目 ▸」のラベルは出さない');
await ev(`document.querySelector('[data-cmat="iron"]').click()`); await sleep(400);    // 素材を選ぶ
const after=await ev(`JSON.stringify(window.__factory.getMachine(${JSON.stringify(mid)}).slots)`);
ok(before!==after&&(await ev(`window.__factory.getMachine(${JSON.stringify(mid)}).slots[0]==='iron'`)),
   `素材を選ぶとスロットに入る ${before} → ${after}`);
// ✕で外す
await ev(`(function(){const c=document.querySelector('#panel [data-cclear]'); if(c)c.click();})()`); await sleep(400);
ok((await ev(`JSON.stringify(window.__factory.getMachine(${JSON.stringify(mid)}).slots)`))===before, '✕で元に戻る');
ok(await ev(`/製造機なし|待機中|製造中/.test(document.getElementById('craft').textContent)`), 'コンパクト製造は稼働状況を出す');
ok((await ev(`document.querySelectorAll('[data-del]').length`))===0, '設定パネルに🗑撤去ボタンは無い（D&Dに一本化）');
ok((await ev(`document.querySelectorAll('#panel [data-rot]').length`))>0, '一覧との違いは「配置」が付くことだけ（↻回転がある）');

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
// 一覧は「1台 = 1行」。タブでは切り替えない
const nrow=await ev(`document.querySelectorAll('.mrow').length`);
ok(nrow===(await ev(`window.__scene.machineList().length`)), `全機械が縦一覧で出る (${nrow}台)`);
const sel=`[data-cslot][data-cmid=${JSON.stringify(mid)}]`;
const nslot=await ev(`document.querySelectorAll('${sel}').length`);
ok(nslot===(await ev(`window.__factory.getMachine(${JSON.stringify(mid)}).size`)), `製造機のマス数ぶんスロットが出る (${nslot})`);
await ev(`document.querySelector('${sel}').click()`); await sleep(250);
const ncm=await ev(`document.querySelectorAll('[data-cmat]').length`);
ok(ncm>0, `マスをクリックで原材料の一覧が出る (${ncm}種)`);
ok(ncm===(await ev(`MATS.length`)), '全ジャンルの原材料が一度に出る（切り替え不要）');
ok(await ev(`[...document.querySelectorAll('#panel .pgroup')].every(g=>
  [...g.querySelectorAll('[data-cmat]')].every(e=>MAT[e.dataset.cmat].g===MAT[g.querySelector('[data-cmat]').dataset.cmat].g))`),
   'ジャンルの見出しごとに、その ジャンルの原材料だけがまとまっている');
await ev(`document.querySelector('[data-cmat="glass"]').click()`); await sleep(350);
ok(await ev(`window.__factory.getMachine(${JSON.stringify(mid)}).slots[0]==='glass'`), 'ダイアログから原材料をセットできる');
// 2マス目も埋める（ガラス+銅線 = ⚙️機械のレシピ）
await ev(`document.querySelectorAll('${sel}')[1].click()`); await sleep(250);
await ev(`document.querySelector('[data-cmat="wire"]').click()`); await sleep(350);
ok(await ev(`window.__factory.getMachine(${JSON.stringify(mid)}).slots[1]==='wire'`), '2マス目にもセットできる');
ok(!(await ev(`!!document.querySelector('.mrow .gtag')`)), 'プログレスバー左のジャンルラベルは出さない');
// ▶製造開始（行のボタン）。前回の実行が localStorage に残るので停止状態から始める
await ev(`machState(${JSON.stringify(mid)}).running=false; saveGame(); openCraft();`); await sleep(350);
const gobtn=`document.querySelector('[data-crun=${JSON.stringify(mid)}]')`;
ok(await ev(`!${gobtn}.disabled`), '行の ▶製造開始 が押せる');
await ev(`${gobtn}.click()`); await sleep(350);
ok(await ev(`machState(${JSON.stringify(mid)}).running===true`), '▶製造開始でその機械が稼働する');
ok(await ev(`/\\d+ \\/ \\d+ WP/.test(document.querySelector('.mrow .wpline').textContent)`), '行にWPの進捗が出る');
ok((await ev(`document.querySelectorAll('.mrow .wpline b').length`))===nrow, '行ごとにWP表示がある');
ok(await ev(`/\\d+ \\/ \\d+ WP/.test(document.querySelector('.mrow .wpline b').textContent)`), 'WPは「現在 / 必要」形式');
// 必要WP = マス数 × WP_PER_SLOT
ok(await ev(`(function(){const m=machinesSorted()[0]; return needWp(m)===m.size*WP_PER_SLOT;})()`), '必要WPがマス数に比例する');
await ev(`${gobtn}.click()`); await sleep(300);
ok(await ev(`machState(${JSON.stringify(mid)}).running===false`), '■停止で止まる');
await sleep(1200);
ok(await ev(`document.getElementById('overlay').classList.contains('show')&&document.querySelectorAll('[data-cslot]').length>0`), '開いている間も更新され続ける（live）');
// 2台目を置くと行が増える
const mid2=await ev(`(()=>{const s=window.__scene; for(let r=0;r<16;r++)for(let c=0;c<16;c++){
  if(s.canPlace('machine',c,r,{variant:'s3',dir:'u'})) return s.addPlaced('machine','s3',{cell:{c,r},dir:'u'}); } return null;})()`);
await ev(`window.__layoutChanged()`); await ev(`openCraft()`); await sleep(350);
ok((await ev(`document.querySelectorAll('.mrow').length`))===nrow+1, `2台目を置くと行が増える (${nrow}→${nrow+1})`);
ok((await ev(`document.querySelectorAll('[data-cslot][data-cmid=${JSON.stringify(mid2)}]').length`))===3, '2台目は3マスぶんのスロットが出る');
// ✕で外す
await ev(`document.querySelector('[data-cslot][data-cmid=${JSON.stringify(mid2)}]').click()`); await sleep(200);
await ev(`document.querySelector('[data-cmat]').click()`); await sleep(300);
ok((await ev(`document.querySelectorAll('[data-cclear][data-cmid=${JSON.stringify(mid2)}]').length`))>0, 'セット済みのマスに✕（外す）が出る');
await ev(`document.querySelector('[data-cclear][data-cmid=${JSON.stringify(mid2)}]').click()`); await sleep(300);
ok(await ev(`window.__factory.getMachine(${JSON.stringify(mid2)}).slots[0]===null`), '✕で原材料を外せる');
// 後片付け（2台目を撤去して1台に戻す）
await ev(`window.__factory.removeMachine(${JSON.stringify(mid2)}); craftState().activeId=null; window.__layoutChanged();`);
await ev(`window.__factory.setSlot(${JSON.stringify(mid)},0,null); window.__factory.setSlot(${JSON.stringify(mid)},1,null); renderCraft();`);
await ev(`closeOverlay()`); await sleep(200);

console.log('\n=== ショップ/図鑑（共通ダイアログ） ===');
for(const [fn,label] of [['openShop','ショップ'],['openCollection','図鑑']]){
  await ev(`${fn}()`); await sleep(300);
  ok(await ev(`document.getElementById('overlay').classList.contains('show')`), `${label}が開く`);
  ok(await ev(`!!document.querySelector('#panel .dlgHead h2') && !!document.querySelector('#panel .pbody')`), `${label}が共通ダイアログ（見出し＋本文）で描かれる`);
  ok((await ev(`document.querySelectorAll('#panel [data-dlgtab]').length`))>1, `${label}のタブが出る`);
  await ev(`closeOverlay()`); await sleep(150);
}
console.log('\n=== 📖 図鑑: 製品タブ配下のジャンル切り替え ===');
await ev(`openCollection('prod')`); await sleep(300);
const ngt=await ev(`document.querySelectorAll('[data-collection-genre]').length`);
ok(ngt===(await ev(`GENRES.length+1`)), `ジャンルタブが全ジャンル + ✨シークレット ぶん出る (${ngt})`);
ok(await ev(`[...document.querySelectorAll('#panel .pgrid .pcard')].length===PRODS.filter(p=>p.g===_collectionGenre).length`),
   '出ている製品カードは選択中ジャンルの数と一致');
for(const g of ['mech','life','secret']){
  await ev(`document.querySelector('[data-collection-genre="${g}"]').click()`); await sleep(250);
  ok(await ev(`document.querySelector('[data-collection-genre="${g}"]').classList.contains('on') && _collectionGenre==='${g}'`), `${g} タブに切り替わる`);
  ok(await ev(`document.querySelectorAll('#panel .pgrid .pcard').length===PRODS.filter(p=>p.g==='${g}').length`),
     `${g} の製品だけが並ぶ (${await ev(`PRODS.filter(p=>p.g==='${g}').length`)}種)`);
}
ok(await ev(`document.querySelector('#panel .rowline').textContent.includes('ジャンルを跨いだ原材料')`),
   'シークレットタブは「ジャンル跨ぎで出る」と案内する');
await ev(`closeOverlay()`); await sleep(150);

// タブ切替（ショップ: 売却 → 製造機）
await ev(`openShop('sell')`); await sleep(250);
await ev(`document.querySelector('[data-dlgtab="mach"]').click()`); await sleep(250);
ok(await ev(`document.querySelector('[data-dlgtab="mach"]').classList.contains('on')`), 'タブをクリックで切り替わる');
ok(await ev(`document.getElementById('panel').innerHTML.includes('製造機を購入')`), '切り替えた本文が描かれる');
await ev(`closeOverlay()`); await sleep(150);
// フッターの操作ボタン（製造機パネルの「🏭 製造タブへ」）
await ev(`window.__openMachine(${JSON.stringify(mid)})`); await sleep(300);
ok((await ev(`document.querySelectorAll('#panel .dlgFoot [data-dlgact]').length`))>0, 'フッターに操作ボタンが出る（🏭製造タブへ）');
await ev(`document.querySelector('#panel .dlgFoot [data-dlgact]').click()`); await sleep(350);
ok(await ev(`document.querySelector('#panel .dlgHead h2').textContent.includes('製造')&&!document.querySelector('[data-rot]')`),
   'フッターのボタンが機能する（配置なしの🏭製造一覧に移る）');
await ev(`closeOverlay()`); await sleep(150);

console.log('\n=== 🎁完成品は「新着だけ」／📊今日の製造・今日の売上 ===');
// 完成品を2個ぶん仕込む（実WPを待たずに検証したいので直接積む）
// 前回の実行ぶんが localStorage に残るので、記録と売上をいったん空にしてから数える
await ev(`(()=>{const c=craftState(); const now=Date.now(); c.made=[]; c.log=[]; c.sales={};
  for(const pid of ['bulb','cat']){ const rec={pid, at:now, key:'glass,wire', mid:${JSON.stringify(mid)}};
    c.made.push({...rec,viewed:false}); c.log.push(rec); }
  saveGame(); updateDoneBtn(); renderBoard();})()`); await sleep(200);
ok(await ev(`document.getElementById('doneBtn').classList.contains('show')`), '製品ができると🎁完成品ボタンが出る');
ok((await ev(`document.getElementById('doneN').textContent`))==='2', 'バッジは新着の個数（2）');
const money0=await ev(`Math.floor(G.money)`), sales0=await ev(`salesToday()`);
await ev(`openDone()`); await sleep(350);
ok((await ev(`document.querySelectorAll('#panel .pgrid .pcard').length`))===2, '開くと今回の2個が並ぶ');
ok(await ev(`document.querySelector('.dlgSub').textContent.includes('2個')`), '見出しは今回の個数');
ok(!(await ev(`/所持 💰/.test(document.getElementById('panel').textContent)`)), '「（N個・所持 💰…）」は出さない');
const gain=(await ev(`Math.floor(G.money)`))-money0;
ok(gain>0 && (await ev(`salesToday()`))===sales0+gain, `売上が💰と今日の売上に入る (+${gain})`);
await ev(`closeOverlay()`); await sleep(200);
ok((await ev(`craftState().made.length`))===0, '1回開いたら中身はリセットされる');
ok(!(await ev(`document.getElementById('doneBtn').classList.contains('show')`)), '次の製品ができるまで🎁ボタンは出ない');
await ev(`openDone()`); await sleep(300);
ok((await ev(`document.querySelectorAll('#panel .pgrid .pcard').length`))===0, '空のまま開いても前回の分は出てこない');
await ev(`closeOverlay()`); await sleep(150);
// 📊今日の製造（記録は完成品を開いても消えない）
ok(await ev(`/今日の売上/.test(document.getElementById('board').textContent)`), 'ボードに「今日の売上」が出る');
ok(await ev(`salesToday()>0 && document.getElementById('board').textContent.includes(Math.floor(salesToday()).toLocaleString())`), '今日の売上の金額が出る');
await ev(`document.getElementById('todayBtn').click()`); await sleep(350);
ok(await ev(`document.querySelector('#panel .dlgHead h2').textContent.includes('今日の製造')`), '「今日の製造」クリックで一覧が開く');
const tcards=await ev(`document.querySelectorAll('#panel .pgrid .pcard').length`);
ok(tcards===2, `今日つくった製品が種類ごとに並ぶ (${tcards}種)`);
ok(await ev(`(()=>{const r=[...document.querySelectorAll('#panel .pcard .rr')].map(e=>e.textContent);
  const ord=Object.keys(RAR).map(k=>RAR[k].n); return r.every((x,i)=>i===0||ord.indexOf(r[i-1])>=ord.indexOf(x));})()`),
   'レア度の高い順に並ぶ');
ok(await ev(`document.querySelector('#panel .pcard .qn').textContent.includes('×')`), '製造した個数が出る');
ok(await ev(`document.getElementById('panel').textContent.includes('🪟')`), '使った原材料の組み合わせが出る（🪟ガラス+🔌銅線）');
await ev(`closeOverlay()`); await sleep(150);

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
for(const idn of ['craftBtn','shopBtn','collectionBtn','lbBtn','agentsBtn','editMenuBtn'])
  ok(await ev(`!!document.getElementById('${idn}')`), `メニュー項目 #${idn} がある`);
console.log('\n=== 編集パレットの案内文（実態に合わせる） ===');
await ev(`document.getElementById('editFab').click()`); await sleep(700);   // 寄せのトランジション(0.42s)が終わるまで待つ
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

// 製造機ごとのWP計算を実ブラウザ(headless Chrome + CDP)で検証する。依存ゼロ。
//   使い方: node server.mjs を起動しておいて → node tools/test_craft_wp.mjs
//
// WPの加算は factory-phaser.html のインラインスクリプトにあるので、Phaserスタブ
// (test_machines.mjs)では触れない。実ページを動かして中の関数を直接叩く。
//
// 注意: セーブ(/api/save)を書き換えるので、開始時にバックアップして最後に必ず戻す。
import { spawn } from 'node:child_process';
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', PORT=9335;
const prof='/tmp/cf-chrome-craft-profile';
const SRV='http://localhost:4321', OTEL='http://localhost:4318';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

// --- サーバが起きているか ---
try{ const r=await fetch(SRV+'/api/otel'); if(!r.ok) throw 0; }
catch(_){ console.error('server が起動していません。別のターミナルで `node server.mjs` を実行してください。'); process.exit(1); }

// --- セーブのバックアップ（テストは配置と製造状態を壊すので必ず戻す） ---
const backup = await (await fetch(SRV+'/api/save',{cache:'no-store'})).text();
const restore = async ()=>{ try{ await fetch(SRV+'/api/save',{method:'POST',body:backup}); }catch(_){} };

const ch=spawn(CHROME,['--headless=new','--disable-gpu','--no-first-run',`--remote-debugging-port=${PORT}`,
  `--user-data-dir=${prof}`,'--window-size=1400,900','about:blank'],{stdio:'ignore'});
let fail=0;
const ok=(c,m,extra)=>{ console.log((c?'  ok  ':'FAIL  ')+m+(c||extra===undefined?'':`\n        → ${JSON.stringify(extra)}`)); if(!c)fail++; };

try{
  let t=null, page=null;
  for(let i=0;i<60;i++){ try{ t=await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    page=(t||[]).find(x=>x.type==='page'); if(page)break; }catch(_){} await sleep(250); }
  if(!page) throw new Error(`Chrome に接続できません（port ${PORT}）。残っているプロセスを消してから再実行してください:\n  pkill -f ${prof}`);
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pend=new Map(); const errs=[];
  const send=(m,p={})=>new Promise(r=>{ const i=++id; pend.set(i,r); ws.send(JSON.stringify({id:i,method:m,params:p})); });
  ws.onmessage=e=>{ const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){ pend.get(m.id)(m.result); pend.delete(m.id); return; }
    if(m.method==='Runtime.exceptionThrown'){ const d=m.params.exceptionDetails; errs.push((d.exception&&d.exception.description)||d.text); } };
  await new Promise(r=>ws.onopen=r);
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate',{url:SRV+'/'}); await sleep(6000);
  const ev=async(x,awaitPromise=false)=>{ const r=await send('Runtime.evaluate',{expression:x,returnByValue:true,awaitPromise});
    if(r.exceptionDetails) throw new Error(r.exceptionDetails.text+' :: '+(r.exceptionDetails.exception?.description||''));
    return r.result?.value; };
  const J=async x=>JSON.parse(await ev(`JSON.stringify(${x})`));

  ok(await ev(`!!window.__scene && !!window.__factory`), 'シーンが起動している');

  // 実WPのポーリングを止める。動いたままだと注入した値に実測分が混ざる
  await ev(`clearInterval(window.__pollTimer); WPST.ok=true; 'stopped'`);

  // 2/3/5マスの台だけにする（既存配置は最後にバックアップから戻す）
  const setup = await J(`(()=>{
    const s=window.__scene;
    for(const e of s.placed.filter(x=>x.kind==='machine')) s.removeItem(e.id);
    const ids=['s2','s3','s5'].map(sub=>s.addPlaced('machine',sub,{}));
    G.craft={ mats:{}, activeId:null, made:[], dex:{}, mach:{}, wpMark:WPST.total };
    window.__layoutChanged();
    return { ids, sizes: machinesSorted().map(m=>m.size) };
  })()`);
  ok(setup.ids.every(Boolean) && setup.sizes.join()==='2,3,5', '2/3/5マスの台を用意できた', setup);
  const [M2,M3,M5]=setup.ids;

  console.log('\n=== 必要WP = マス数 × 50 ===');
  const need = await J(`(()=>{ const f={}; for(const m of machinesSorted()) f[m.size]=needWp(m); return f; })()`);
  ok(need['2']===100, '2マス機 → 100WP', need);
  ok(need['3']===150, '3マス機 → 150WP', need);
  ok(need['5']===250, '5マス機 → 250WP', need);

  // 以降は「状態を作る → deltaを注入 → tickCraft」を1つの同期ブロックで行う。
  // 途中で他の処理が割り込めないので、注入した値だけで結果が決まる。
  const run = (setupJs, delta)=>J(`(()=>{
    const c=craftState(); c.made=[]; c.dex={};
    ${setupJs}
    c.wpMark=WPST.total; WPST.total+=${delta}; tickCraft();
    const wp={}; for(const m of machines()) wp[m.id]=Math.round(machState(m.id).wp*100)/100;
    return { wp, made:c.made.map(x=>({pid:x.pid, mid:x.mid, key:x.key})) };
  })()`);
  const RUN=(ids,extra='')=>`for(const m of machines()) c.mach[m.id]={running:false,wp:0};
    ${ids.map(i=>`c.mach['${i}']={running:true,wp:0};`).join('')} ${extra}`;

  console.log('\n=== 稼いだWPは按分せず、稼働中の全機械に同額 ===');
  let r = await run(RUN([M2,M3,M5]), 50);
  ok(r.wp[M2]===50 && r.wp[M3]===50 && r.wp[M5]===50, '3台稼働で50WP投入 → 3台とも +50（1/3ずつではない）', r.wp);

  console.log('\n=== 停止中の台には入らない ===');
  r = await run(RUN([M2]), 60);
  ok(r.wp[M2]===60 && r.wp[M3]===0 && r.wp[M5]===0, '2マス機だけ稼働 → 他の台は0のまま', r.wp);

  console.log('\n=== 必要WPに達すると1個完成し、超過分は繰り越す ===');
  r = await run(RUN([M2]), 130);
  ok(r.made.length===1 && r.made[0].mid===M2, '2マス機に130WP → 1個完成', r.made);
  ok(r.wp[M2]===30, '超過30WPが繰り越される', r.wp);

  console.log('\n=== 1回の加算で複数個できる ===');
  r = await run(RUN([M2]), 250);
  ok(r.made.length===2, '2マス機に250WP → 2個完成', r.made.length);
  ok(r.wp[M2]===50, '残り50WPが繰り越される', r.wp);

  console.log('\n=== 台ごとに独立して進む（必要WPが違っても混ざらない）===');
  r = await run(RUN([M2,M5]), 250);
  ok(r.wp[M2]===50 && r.wp[M5]===0, '250WP投入 → 2マス機は2個作って50余り / 5マス機はちょうど1個で0', r.wp);
  ok(r.made.filter(x=>x.mid===M2).length===2 && r.made.filter(x=>x.mid===M5).length===1,
     '完成数は 2マス機2個 / 5マス機1個', r.made);

  console.log('\n=== 原材料を変えてもWPはリセットされず、稼働も止まらない ===');
  const keep = await J(`(()=>{
    const c=craftState(); c.made=[]; const F=window.__factory;
    for(const m of machines()) c.mach[m.id]={running:false,wp:0};
    c.mach['${M5}']={running:true,wp:0};
    for(let i=0;i<5;i++) F.setSlot('${M5}',i,null);
    F.setSlot('${M5}',0,'egg'); F.setSlot('${M5}',1,'milk'); F.setSlot('${M5}',2,'sugar');
    c.wpMark=WPST.total; WPST.total+=200; tickCraft();
    const 途中={ wp:machState('${M5}').wp, running:machState('${M5}').running, made:c.made.length };
    // ここで組み合わせを入れ替える
    F.setSlot('${M5}',0,'meat'); F.setSlot('${M5}',1,'rice'); F.setSlot('${M5}',2,null);
    const 変更後={ wp:machState('${M5}').wp, running:machState('${M5}').running };
    c.wpMark=WPST.total; WPST.total+=50; tickCraft();
    return { 途中, 変更後, made:c.made.map(x=>({pid:x.pid,key:x.key})) };
  })()`);
  ok(keep.途中.wp===200 && keep.途中.made===0, '200WPまで溜まる（250必要なのでまだ完成しない）', keep.途中);
  ok(keep.変更後.wp===200, '原材料を変えてもWPは200のまま', keep.変更後);
  ok(keep.変更後.running===true, '原材料を変えても稼働は継続する', keep.変更後);

  console.log('\n=== 製品は「必要WPに達した時点」の組み合わせで決まる ===');
  ok(keep.made.length===1 && keep.made[0].key==='meat,rice',
     '変更後の meat,rice で判定される（変更前の egg,milk,sugar ではない）', keep.made);
  const pudding=['pudding','icecream','parfait','crepe','honeytoast'];
  ok(!pudding.includes(keep.made[0].pid), '変更前の組み合わせの製品(プリン系)は出ない', keep.made);

  console.log('\n=== 素材が空のまま到達したら 謎のカタマリ ===');
  r = await J(`(()=>{
    const c=craftState(); c.made=[]; const F=window.__factory;
    for(const m of machines()) c.mach[m.id]={running:false,wp:0};
    for(let i=0;i<5;i++) F.setSlot('${M2}',i,null);
    c.mach['${M2}']={running:true,wp:0};
    c.wpMark=WPST.total; WPST.total+=100; tickCraft();
    return { made:c.made.map(x=>({pid:x.pid,key:x.key})) };
  })()`);
  ok(r.made.length===1 && r.made[0].pid==='blob', '素材なしで到達 → 🪨謎のカタマリ', r.made);

  console.log('\n=== 起動直後に過去のWPを遡って入れない ===');
  r = await J(`(()=>{
    const c=craftState(); c.made=[]; delete c.wpMark;      // 未初期化の状態を再現
    for(const m of machines()) c.mach[m.id]={running:true,wp:0};
    WPST.total+=9999; tickCraft();                          // 1回目は基準取りだけ
    const 初回={ wp:machState('${M2}').wp, mark:c.wpMark===WPST.total };
    WPST.total+=100; tickCraft();                           // 2回目から加算される
    return { 初回, 二回目:machState('${M2}').wp };
  })()`);
  ok(r.初回.wp===0 && r.初回.mark, '初回は基準を取るだけで加算しない（9999WPを遡らない）', r.初回);
  ok(r.二回目===0, 'そのあとの100WPは加算され、必要100に達して0に戻る', r.二回目);

  console.log('\n=== 実際のOTel受信から加算されるか（配線の確認）===');
  const before = await ev(`(()=>{ const c=craftState();
    for(const m of machines()) c.mach[m.id]={running:false,wp:0};
    c.mach['${M5}']={running:true,wp:0}; c.made=[];
    return null; })(), 'set'`);
  // Edit を5件 = 50WP ぶん送る
  const now=Date.now();
  const recs=Array.from({length:5},(_,i)=>({ timeUnixNano:String((now+i)*1e6), attributes:[
    {key:'event.name',value:{stringValue:'tool_result'}},
    {key:'event.sequence',value:{intValue:String(950000+i)}},
    {key:'tool_name',value:{stringValue:'Edit'}},
    {key:'success',value:{boolValue:true}},
    {key:'session.id',value:{stringValue:'craft-wp-test'}},
    {key:'user.email',value:{stringValue:'test@example.com'}}]}));
  const res=await fetch(OTEL+'/v1/logs',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({resourceLogs:[{resource:{attributes:[]},scopeLogs:[{logRecords:recs}]}]})});
  ok(res.status===200, 'OTelレシーバが受け付けた（HTTP 200）', res.status);
  await sleep(600);
  // pollWp は Promise を返すので awaitPromise で待つ
  const flow = JSON.parse(await ev(`(async()=>{
    const c=craftState();
    delete c.wpMark; await pollWp();                 // 1回目: 累計WPの基準を取る
    const base=Math.round(WPST.total), b=machState('${M5}').wp;
    await pollWp();                                  // 2回目: 差分があれば加算される
    return JSON.stringify({ base, b, after:machState('${M5}').wp, ok:WPST.ok });
  })()`, true));
  ok(flow.ok===true && flow.base>0, 'pollWp が /api/otel から実測WPを取得できている', flow);
  ok(flow.b===0, '1回目は基準取りなので加算されない', flow);

  if(errs.length){ console.log('\n=== 例外 ==='); errs.forEach(e=>console.log('  '+String(e).split('\n')[0])); fail+=errs.length; }
} catch(e){
  console.error('\nテストが異常終了: '+e.message); fail++;
} finally {
  await restore();
  console.log('\nセーブを元に戻しました。');
  try{ ch.kill(); }catch(_){}
}
console.log(fail? `\n${fail} 件 FAIL` : '\nすべて ok');
process.exit(fail?1:0);

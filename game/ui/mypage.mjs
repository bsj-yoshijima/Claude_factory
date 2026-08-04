/* 🏠 マイページ — 工場名とWPの推移。 */
import { NET } from '../net.mjs';
import { G } from '../state.mjs';
import { openDialog, toast } from './dialog.mjs';
import { tabStrip } from './parts.mjs';

const MY_DAYS=90;                      // 週次12週分を作るのに必要な日数。日次は末尾14日だけ使う
const MY_DAILY_N=14, MY_WEEK_N=12;
const MY_COLOR='#9fdcc6';              // 折れ線はWPの1本だけ
let _myRange='day', _mySel=null, _myData=null, _myEdit=false;
// 既定名はサーバが決める（ユーザー名 → 無ければメールの @ より前 → 「◯◯の工場」）
const myDefaultName=()=> (_myData&&_myData.defaultName)
  || `${(_myData&&_myData.userName)||'あなた'}の工場`;
const myName=()=> (_myData&&_myData.name) || myDefaultName();
// 属性値に入れる用のエスケープ（工場名はユーザー入力なので " < > & を潰す）
const myAttr=(s)=>String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* 目盛りの上限は 1/2/5×10^n に丸める（軸の数字が読みやすい値になる） */
function niceMax(v){
  if(!(v>0)) return 1;
  const e=Math.pow(10,Math.floor(Math.log10(v))), f=v/e;
  return (f<=1?1:f<=2?2:f<=5?5:10)*e;
}
/* 日付ユーティリティ。'YYYY-MM-DD' は UTC 正午ではなく 00:00 として素直に足し引きする */
const myDayMs=(d)=>Date.parse(d+'T00:00:00Z');
const myDayStr=(ms)=>new Date(ms).toISOString().slice(0,10);
const myMd=(d)=>d.slice(5).replace('-','/');                      // 07/19（年は出さない）

/* 表示中の粒度でバケツを作る。日次=1日、週次=日曜00:00〜土曜23:59 */
function myBuckets(){
  const series=(_myData&&_myData.series)||[];
  if(_myRange!=='week'){
    return series.slice(-MY_DAILY_N).map(d=>({
      key:d.day, wp:d.wp, made:d.made, sales:d.sales,
      title:myMd(d.day), x:myMd(d.day) }));
  }
  const by=new Map();
  for(const d of series){
    const t=myDayMs(d.day);
    const start=myDayStr(t-new Date(t).getUTCDay()*86400000);      // 直前の日曜
    let b=by.get(start);
    if(!b) by.set(start,b={key:start,n:0,wp:0,made:0,sales:0});
    b.n++; b.wp+=d.wp; b.made+=d.made; b.sales+=d.sales;
  }
  const list=[...by.values()].sort((a,b)=>a.key<b.key?-1:1);
  // 先頭は取得範囲の途中から始まる欠けた週。合計が過小に出るので落とす
  if(list.length>1&&list[0].n<7) list.shift();
  return list.slice(-MY_WEEK_N).map(b=>({ ...b,
    title:`${myMd(b.key)} - ${myMd(myDayStr(myDayMs(b.key)+6*86400000))}`,
    x:myMd(b.key) }));
}
const mySelIdx=(b)=> b.length ? Math.min(Math.max(_mySel==null?b.length-1:_mySel,0),b.length-1) : -1;

/* WPの折れ線＋塗り。点の縦列（どの高さでも可）をクリックするとその日/週の数値に切り替わる */
function myChartSvg(buckets,sel){
  const W=620,H=210,PL=26,PR=76,PT=16,PB=26;   // PL は左端の日付ラベル、PR は右端の「n WP」が切れない幅
  const n=buckets.length;
  if(!n) return '<div class="cost">まだ記録がありません</div>';
  const max=niceMax(Math.max(...buckets.map(d=>d.wp),0));
  const X=i=> n<2 ? PL : PL+i*(W-PL-PR)/(n-1);
  const Y=v=> PT+(1-v/max)*(H-PT-PB);
  const pts=buckets.map((d,i)=>[X(i),Y(d.wp)]);
  const line=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area=`${line} L${pts[pts.length-1][0].toFixed(1)},${Y(0)} L${pts[0][0].toFixed(1)},${Y(0)} Z`;
  // 目盛りは 0 / 中間 / 上限。丸めた結果ラベルが重複したら線だけ引く（0が並ぶのを防ぐ）
  const seen=new Set();
  const grid=[max,max/2,0].map(v=>{      // 上限を先に見て、丸めがぶつかったら中間を落とす
    const t=Math.round(v).toLocaleString(), dup=seen.has(t); seen.add(t);
    return `<line x1="${PL}" x2="${W-PR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="#22322e" stroke-width="1"/>`
      +(dup?'':`<text x="${W-PR+8}" y="${(Y(v)+4).toFixed(1)}" fill="#9fb0c0" font-size="11">${t}<tspan
              fill="#7d8f9c" font-size="9"> WP</tspan></text>`);
  }).join('');
  // x軸ラベルは端と中間だけ（全点出すと潰れる）。選択中の点は必ず出す
  const every=Math.max(1,Math.ceil(n/5));
  const xlab=buckets.map((d,i)=> (i%every===0||i===n-1||i===sel)
    ? `<text x="${X(i).toFixed(1)}" y="${H-7}" fill="${i===sel?'#eafff4':'#9fb0c0'}" font-size="10"
             text-anchor="middle">${d.x}</text>` : '').join('');
  const cursor=(sel>=0&&sel<n)
    ? `<line x1="${pts[sel][0].toFixed(1)}" x2="${pts[sel][0].toFixed(1)}" y1="${PT}" y2="${H-PB}"
             stroke="#eafff4" stroke-width="1.5" opacity=".8"/>
       <circle cx="${pts[sel][0].toFixed(1)}" cy="${pts[sel][1].toFixed(1)}" r="10"
               fill="${MY_COLOR}" opacity=".22"/>` : '';
  const dots=buckets.map((d,i)=>{
    const on=i===sel;
    return `<circle cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="${on?5.5:3.6}"
              fill="${on?MY_COLOR:'#10171b'}" stroke="${MY_COLOR}" stroke-width="2"/>`;}).join('');
  // 当たり判定は点ではなく縦帯にする。隣の点との中点で区切った列のどの高さを押しても
  // その日/週が選ばれる（半径数pxの点を狙わせると指でもマウスでも押しにくい）
  const hits=buckets.map((d,i)=>{
    const x0=i===0   ? 0 : (pts[i-1][0]+pts[i][0])/2;
    const x1=i===n-1 ? W : (pts[i][0]+pts[i+1][0])/2;
    return `<rect class="myhit" x="${x0.toFixed(1)}" y="0" width="${(x1-x0).toFixed(1)}" height="${H}"
             fill="transparent" data-myi="${i}" role="button" tabindex="0"
             aria-label="${d.title}"><title>${d.title}</title></rect>`;}).join('');
  return `<div class="mychart"><svg viewBox="0 0 ${W} ${H}" role="img"
      aria-label="${_myRange==='week'?`直近${n}週`:`直近${n}日`}のWPの推移">
    <defs><linearGradient id="myg_wp" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${MY_COLOR}" stop-opacity=".38"/>
      <stop offset="100%" stop-color="${MY_COLOR}" stop-opacity=".03"/></linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#myg_wp)"/>
    <path d="${line}" fill="none" stroke="${MY_COLOR}" stroke-width="2.4"
          stroke-linejoin="round" stroke-linecap="round"/>
    ${cursor}${dots}${xlab}${hits}
  </svg></div>`;
}
function myBody(){
  if(!_myData) return '<div class="cost">読み込み中…</div>';
  const b=myBuckets(), sel=mySelIdx(b), t=b[sel]||{wp:0,made:0,sales:0,title:'—'};
  const head=_myEdit
    // 編集は「いま表示されている名前」から始める。空欄＋プレイスホルダだと
    // 消したのか未設定なのか分からないし、一文字だけ直したいときに打ち直しになる
    ? `<div class="myname"><input id="myNameIn" maxlength="24" placeholder="${myAttr(myDefaultName())}"
         value="${myAttr(myName())}">
       <span class="ed" id="myNameSave">保存</span><span class="ed" id="myNameCancel">やめる</span></div>
       <div class="rowline" style="font-size:11px;color:#9fb0c0;margin-top:4px">24文字まで。空にすると「${myAttr(myDefaultName())}」に戻ります。</div>`
    : `<div class="myname"><b>🏭 ${myAttr(myName())}</b><span class="ed" id="myNameEdit">✏️ 編集</span></div>`;
  return `${head}
    ${_myData.failed?`<div class="rowline" style="font-size:11px;color:#ff9f7a;margin-top:8px">
      集計を取得できませんでした。サーバが古い可能性があります（<b>npm run dev</b> で再起動してください）。</div>`:''}
    ${tabStrip([{id:'day',label:'日次'},{id:'week',label:'週次'}], _myRange, 'data-myrange', {pill:true})}
    <div class="myperiod">${t.title}</div>
    <div class="mystats">
      <div class="mystat"><div class="k">WP</div><div class="v">${Math.round(t.wp).toLocaleString()}<small>WP</small></div></div>
      <div class="mystat"><div class="k">製造個数</div><div class="v">${t.made.toLocaleString()}<small>個</small></div></div>
      <div class="mystat"><div class="k">売上</div><div class="v">${Math.round(t.sales).toLocaleString()}<small>💰</small></div></div>
    </div>
    <div class="rowline" style="font-size:11px;color:#9fb0c0;margin-top:14px">
      ※グラフをクリックで切り替え
    </div>
    ${myChartSvg(b,sel)}`;
}
async function saveFactoryName(name,dlg){
  name=String(name||'').replace(/\s+/g,' ').trim().slice(0,24);
  const r=await NET.call('PUT','/api/factory/name',{name});
  if(!r) return;                         // 失敗時は編集状態のまま（NET.call が toast を出す）
  name=r.name;
  G.factoryName=name; _myData.name=name; _myEdit=false; dlg.refresh();
  toast('工場名を変更しました');
}
export async function openMyPage(){
  _myEdit=false; _myData=null; _mySel=null; _myRange='day';
  const dlg=openDialog({ title:'🏠 マイページ', body:myBody,
    onRender:(p,d)=>{
      p.querySelectorAll('[data-myrange]').forEach(el=>el.onclick=()=>{
        _myRange=el.dataset.myrange; _mySel=null; d.refresh();   // 粒度を変えたら最新の点に戻す
      });
      p.querySelectorAll('[data-myi]').forEach(el=>{
        const pick=()=>{ _mySel=+el.dataset.myi; d.refresh(); };
        el.onclick=pick;
        el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pick(); } };
      });
      const ed=p.querySelector('#myNameEdit'); if(ed) ed.onclick=()=>{ _myEdit=true; d.refresh(); };
      const cancel=p.querySelector('#myNameCancel'); if(cancel) cancel.onclick=()=>{ _myEdit=false; d.refresh(); };
      const save=p.querySelector('#myNameSave'), inp=p.querySelector('#myNameIn');
      if(save&&inp){ save.onclick=()=>saveFactoryName(inp.value,d);
        inp.onkeydown=e=>{ if(e.key==='Enter') saveFactoryName(inp.value,d);
                           if(e.key==='Escape'){ _myEdit=false; d.refresh(); } };
        // 差分適用で入力欄は生き残るので、初回だけ選択する（再描画のたびに全選択し直さない）
        if(document.activeElement!==inp){ inp.focus(); inp.select(); } }
    } });
  _myData = await NET.call('GET',`/api/mypage?days=${MY_DAYS}`);
  // 取得に失敗したときは 0 を並べて黙らない。名前だけはポーリングの me から作れる
  if(!_myData){
    const me=(NET.last&&NET.last.me)||{};
    const who=String(me.name||'').trim()||String(me.email||'').split('@')[0]||'あなた';
    _myData={ name:G.factoryName||'', userName:who, defaultName:`${who}の工場`,
      days:MY_DAYS, series:[], failed:true };
  }
  dlg.refresh();   // 読み込み中に閉じられていれば refresh は何もしない
}

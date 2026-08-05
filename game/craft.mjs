/* 製造の状態とボード — WPのポーリング / 今日の集計 / 上部の表示。
   製造の判定そのものはサーバ(server/craft.mjs)が持つ。 */
import { PROD } from './data/craft.mjs';
import { PROD_PRICE, needWpForSize } from './data/rules.mjs';
import { NET, applyFactory } from './net.mjs';
import { G, craftState, machState, machines } from './state.mjs';
import { openCollection } from './ui/collection.mjs';
import { _dlg, openDialog, toast } from './ui/dialog.mjs';
import { morphInto } from './ui/morph.mjs';
import { matRow, prodCard, uic, updateBadge } from './ui/parts.mjs';

export let wpState={ total:0, today:0, ok:false, scorecard:[] };
export let pendingCount=0;
/* 回収(🎁を開く)で 0 に戻す。ESM では import した束縛へ代入できないので、
   持ち主のこちらに setter を置く（読み取りは live binding でそのまま見える）。 */
export const setPending=(n)=>{ pendingCount=n; };
export async function pollWp(){
  if(document.visibilityState==='hidden') return;   // 裏に回っている間は叩かない
  // 手元の版番号を渡す。工場の形が変わっていなければサーバは factory を返さない
  const d=await NET.call('GET','/api/state?rev='+NET.rev);
  if(!d){ wpState.ok=false; return; }
  NET.last=d;
  wpState={ total:d.wp.total, today:d.wp.today, ok:true, scorecard:wpState.scorecard };
  pendingCount=d.pending;
  if(d.factory){ applyFactory(d.factory); }      // 版が変わったときだけ来る
  else {
    // 差分だけ反映する（毎回変わるのは 💰 と各機械の進捗だけ）
    NET.rev=d.rev; G.money=d.money;
    const c=craftState();
    for(const m of (d.machines||[])) c.mach[m.id]={running:!!m.running, wp:m.wp};
  }
  if(window.__scene&&window.__scene.refreshMachines) window.__scene.refreshMachines();
  updateDoneBtn(); updateBadge(); renderCraft(); renderBoard();
}
/* main.js の poll() はここからエージェント一覧を受け取る（二重ポーリングを避ける） */
const madeToday = ()=> (NET.last&&NET.last.today.made)||0;
const salesToday = ()=> (NET.last&&NET.last.today.sales)||0;
export function renderBoard(){
  const el=document.getElementById('board'); if(!el) return;
  // pollWp から数秒おきに呼ばれる。innerHTML を貼り替えると、そのたびに
  // ここの文字の選択（ハイライト）が解除されてしまうので差分適用にする
  morphInto(el,`
    <div class="m"><div class="v">${wpState.ok?Math.floor(wpState.today).toLocaleString():'—'}<small>WP</small></div>
      <div class="l">今日の労働量</div></div>
    <div class="m prod hit" id="todayBtn" title="クリックで今日つくったものを見る">
      <div class="v">${madeToday()}<small>個</small></div>
      <div class="l">今日の製造</div></div>
    <div class="m sales"><div class="v">${Math.floor(salesToday()).toLocaleString()}<small>${uic('yen')}</small></div>
      <div class="l">今日の売上</div></div>`);
  const b=document.getElementById('todayBtn'); if(b) b.onclick=openToday;
}
/* 製造の記録は /api/made（products_made）から取る。描画しやすい形に揃えてから流す。 */
let _madeToday=null;                  // null=まだ取れていない / 配列=今日の記録
const normMadeRow = r => ({ pid:r.product_id, at:new Date(r.made_at).getTime(), key:r.recipe_key||'' });
async function fetchMadeToday(dlg){
  const d=await NET.call('GET','/api/made');
  if(!d){ if(!_madeToday) _madeToday=[]; return; }   // 取れなかったら前回の内容を残す
  _madeToday=(d.made||[]).map(normMadeRow);
  if(dlg) dlg.refresh();
}
const madeTodayRows = ()=> _madeToday||[];
/* 📊 今日の製造 — 今日つくったものをレア度順に並べる（図鑑に近い見た目）。
   原材料の組み合わせも出すので、当たった組み合わせを見返す用途にも使える。 */
export function openToday(){
  _madeToday=null;                                  // 開くたび取り直す（前回開いた内容を出さない）
  const dlg=openDialog({ title:`${uic('chart')} 今日の製造`,
    subtitle:()=>`${madeToday()}個 / 売上 ${uic('yen')}${Math.floor(salesToday()).toLocaleString()}`,
    live:2000,
    body:()=>{
      if(!_madeToday) return '<div class="cost" style="padding:12px">読み込み中…</div>';
      const rows={};
      for(const m of madeTodayRows()){ const p=PROD[m.pid]; if(!p) continue;
        const r=rows[m.pid]||(rows[m.pid]={p, n:0, keys:{}});
        r.n++; if(m.key) r.keys[m.key]=(r.keys[m.key]||0)+1; }
      const list=Object.values(rows).sort((a,b)=>(b.p.r-a.p.r)||(b.n-a.n));
      if(!list.length) return `<div class="cost" style="padding:12px">今日はまだ何も作っていません。${uic('factory')}製造で原材料をセットして ▶製造開始。</div>`;
      const gain=list.reduce((s,r)=>s+(PROD_PRICE[r.p.r]||0)*r.n,0);
      return `<div class="pgrid">${list.map(r=>{
          // 製品ごとの組み合わせは1つなので普通は1行。過去の履歴に旧レシピが残る場合だけ複数出る（多い順に3つまで）
          const ks=Object.keys(r.keys).sort((a,b)=>r.keys[b]-r.keys[a]).slice(0,3)
            .map(k=>matRow(k, r.keys[k]>1?` ×${r.keys[k]}`:''));
          return prodCard(r.p,{ key:`pd:${r.p.id}`, n:`<b style="color:#eafff4">×${r.n}</b>`, rows:ks });
        }).join('')}</div>
        <div class="rowline" style="font-size:11px;color:#9fb0c0">
          レア度の高い順。数字は今日つくった個数、その下は使った原材料の組み合わせ。
          今日つくったものの合計価値は ${uic('yen')}${gain.toLocaleString()}（完成した時点で ${uic('yen')} に入っている）。</div>`;
    },
    actions:[{label:`${uic('collection')} 図鑑を見る`,kind:'ghost',on:()=>openCollection()}] });
  // 開いている間だけ記録を取りに行く（閉じたら止める）
  const pull=()=>{ if(_dlg!==dlg){ clearInterval(t); return; } fetchMadeToday(dlg); };
  const t=setInterval(pull, 5000); pull();
  return dlg;
}

/* --- 製造のコンパクト表示（画面上中央）。詳しい操作は🏭製造ダイアログに寄せ、
       ここは「いま何を作っているか + WP」だけを出す導線にする --- */
/* 上中央のこれは🏭製造ダイアログを開くためのトリガー。
   進捗は各機械の行で見るので、ここでは稼働台数だけ出す。 */
export function renderCraft(){
  const el=document.getElementById('craft'); if(!el) return;
  const ms=machines(), run=ms.filter(m=>machState(m.id).running).length;
  // メインは「製造機設定」。稼働状況は下に小さく添える（何のボタンか一目で分かるように）
  // 製造中は文字だけ。歯車アイコンは 16ドットでは歯車に見えず、24ドットに上げても
  // 馴染まなかったので置かないことにした
  const st = !ms.length ? '製造機なし' : run ? `製造中 ${run}/${ms.length}台` : `${uic('box')} 待機中 ${ms.length}台`;
  morphInto(el,`<span class="pe">${uic('factory',true)}</span>
    <div class="mid"><div class="nm">製造機設定</div>
      <div class="note">${st}</div>${
      wpState.ok?'':'<div class="note warn">WP未取得（サーバ未接続）</div>'}</div>
    <span class="go">▸</span>`);
  el.title='クリックで🏭製造（原材料のセット・製造開始）';
  renderBoard();
}
/* 機械1台の製造開始/停止。WPはリセットしない（停止中は増えないだけ） */
export function toggleMachine(id){
  const st=machState(id), ms=machines(), m=ms.find(x=>x.id===id);
  st.running=!st.running;
  craftState().activeId=id;
  NET.call('PUT','/api/machine/run',{id,running:st.running})
    .then(r=>{ if(r&&r.factory){ applyFactory(r.factory); renderCraft(); } });
  renderCraft();
  if(window.__scene&&window.__scene.refreshMachines) window.__scene.refreshMachines();
  toast(st.running ? `${m?(m.no||''):''}号機の製造を開始（${m?needWpForSize(m.size):0}WPで1個）` : '製造を停止（溜めたWPは保持）');
}

/* =========================================================================
   🏭 製造ダイアログ — 全機械を縦に並べた一覧
     ・タブで切り替えない（一覧性を優先）。並びはマス数の昇順
     ・各行でマスのセット / 進捗 / 製造開始・停止が完結する
     ・作れる物は出さない（組み合わせを探すのがゲームの目的）
   開いている間は1秒ごとに再描画してWPに追従する。
   ========================================================================= */
export function updateDoneBtn(){
  const b=document.getElementById('doneBtn'); if(!b) return;
  b.classList.toggle('show', pendingCount>0);
  document.getElementById('doneN').textContent = pendingCount || '';
}
/* 回収(図鑑登録)はサーバの /api/claim が行う。
   売上は完成した瞬間にサーバの tick() が積んでいるので、ここでは合計額を見せるだけ。 */

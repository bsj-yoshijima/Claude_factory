/* 🏭 製造ダイアログと 🎁 完成品 — 機械1台ぶんの行(machRow)が共通の部品。 */
import { MACH } from '../data/econ.mjs';
import { GENRES, MAT, MATS } from '../data/craft.mjs';
import { needWpForSize } from '../data/rules.mjs';
import { renderBoard, renderCraft, setPending, toggleMachine, updateDoneBtn, wpState } from '../craft.mjs';
import { NET, applyFactory } from '../net.mjs';
import { craftState, machState, machines, machinesSorted, runningCount, snapLayout } from '../state.mjs';
import { openCollection } from './collection.mjs';
import { _dlg, openDialog, toast } from './dialog.mjs';
import { genreIcon, matIcon, prodCard, rarChips, uic, updateBadge, yen } from './parts.mjs';

export let _craftPick=null;                       // {mid, idx} = いま原材料を選んでいるマス
/* 選択の解除は他モジュール(app の設置直後)からも起きる。
   ESM では import した束縛へ代入できないので、持ち主のこちらに setter を置く。 */
export const setCraftPick=(v)=>{ _craftPick=v; };
const matsOfGenre=(g)=>MATS.filter(m=>m.g===g);
const machTitle=(m)=>`${(MACH['s'+m.size]||{}).e||'🏭'} ${m.no}号機`;
/* 機械1台ぶんの行。🏭製造の一覧と、機械単体のダイアログで同じものを使う（見た目を揃える）。
   マス → クリックで原材料ピッカー / ▶製造開始・停止 / WPの進捗。 */
export function machRow(m){
  const st=machState(m.id), need=needWpForSize(m.size), pct=Math.min(100, st.wp/need*100);
  const nSet=m.slots.filter(Boolean).length;
  const slots=m.slots.map((mid,i)=>{ const mt=MAT[mid];
    const on=_craftPick&&_craftPick.mid===m.id&&_craftPick.idx===i;
    return `<div class="mslot ${mt?'set':''} ${on?'pick':''}" data-cslot="${i}" data-cmid="${m.id}"
      title="${i+1}マス目${mt?`: ${mt.n}`:''} — クリックで原材料を選ぶ">
      <span class="e">${mt?matIcon(mt.id,true):'＋'}</span>
      ${mt?`<span class="x" data-cclear="${i}" data-cmid="${m.id}" title="外す">✕</span>`:''}</div>`; }).join('');
  // ピッカーはジャンルごとの見出し + その下に原材料（タブで切り替えない。跨いだセットもできる）
  const picker = (_craftPick&&_craftPick.mid===m.id) ? `<div class="mpick">
    ${GENRES.map(g=>`<div class="pgroup"><div class="ghead">${genreIcon(g.id)} ${g.n}</div><div class="grow">
      ${matsOfGenre(g.id).map(x=>`<span class="mchip ${m.slots[_craftPick.idx]===x.id?'on':''}"
        data-cmat="${x.id}" data-cmid="${m.id}" title="${x.n}">${matIcon(x.id)}<small>${x.n}</small></span>`).join('')}
      </div></div>`).join('')}</div>` : '';
  return `<div class="mrow ${st.running?'run':''}" data-key="mach:${m.id}" title="${machTitle(m)}（${m.size}マス / 必要 ${need}WP）">
    <div class="mslots">${slots}
      <button class="dbtn ${st.running?'ghost':''}" data-crun="${m.id}"${(!st.running&&!nSet)?' disabled':''}
        title="${(!st.running&&!nSet)?'原材料を1つ以上セットしてください':''}">${st.running?'■ 停止':'▶ 製造開始'}</button>
    </div>${picker}
    <div class="wpline"><div class="bar"><i style="width:${pct.toFixed(1)}%"></i></div>
      <b${wpState.ok?'':' style="color:#ff9f7a"'}>${Math.floor(st.wp)} / ${need} WP</b></div>
  </div>`;
}
/* machRow のクリックを結線する。dlg.refresh() で描き直す前提。 */
export function bindMachRow(p,d){
  p.querySelectorAll('[data-crun]').forEach(el=>el.onclick=()=>{ toggleMachine(el.dataset.crun); d.refresh(); });
  p.querySelectorAll('[data-cslot]').forEach(el=>el.onclick=(ev)=>{
    if(ev.target.dataset && ev.target.dataset.cclear!=null) return;   // ✕(外す)は別扱い
    const mid=el.dataset.cmid, i=+el.dataset.cslot;
    _craftPick=(_craftPick&&_craftPick.mid===mid&&_craftPick.idx===i)?null:{mid,idx:i};
    d.refresh(); });
  p.querySelectorAll('[data-cclear]').forEach(el=>el.onclick=(ev)=>{
    ev.stopPropagation(); setMat(el.dataset.cmid, +el.dataset.cclear, null); _craftPick=null; d.refresh(); });
  p.querySelectorAll('[data-cmat]').forEach(el=>el.onclick=()=>{
    if(!_craftPick) return; setMat(el.dataset.cmid, _craftPick.idx, el.dataset.cmat); _craftPick=null; d.refresh(); });
}
export function openCraft(){
  _craftPick=null;
  return openDialog({ title:`${uic('factory')} 製造`,
    subtitle:()=>{ const ms=machines(); return ms.length?`${ms.length}台 / 稼働 ${runningCount()}台`:'製造機がありません'; },
    live:1000,
    body:()=>{
      const ms=machinesSorted();
      if(!ms.length) return `<div class="cost" style="padding:12px">製造機がありません。${uic('shop')}ショップで購入 → ${uic('layout')}レイアウト編集で床に設置してください。</div>`;
      return ms.map(machRow).join('');
    },
    onRender:bindMachRow });
}
// 導線は上部の製造ボード(#craft)だけ。☰メニューからは外した（同じ物への入口が2つある必要はない）
function setMat(machineId, slotIdx, matId){
  const c=craftState(), F=window.__factory;
  if(!F||!F.setSlot(machineId, slotIdx, matId||null)) return;   // 素材の実体は機械のマス(レイアウトに保存)
  c.activeId = machineId;
  // 原材料を変えても製造は止めず、溜まったWPも保持する。
  // 何ができるかは「必要WPに達した時点」の組み合わせで決まる（サーバの craft.mjs）。
  snapLayout();
  const m=machines().find(x=>x.id===machineId);
  NET.call('PUT','/api/machine/slots',{id:machineId,slots:(m&&m.slots)||[]})
    .then(r=>{ if(r&&r.factory){ applyFactory(r.factory); renderCraft(); } });
  renderCraft();
  toast(matId ? `${MAT[matId].e} ${MAT[matId].n} をセット` : '原材料を外しました');
}
// main.js から呼ばれる: 機械の上に出す原材料バッジ / 機械クリック
/* 🎁完成品の中身。r=null は「まだ /api/claim の返事が来ていない」 */
function doneBody(r){
  if(!r) return '<div class="cost" style="padding:12px">読み込み中…</div>';
  const byRar={}; for(const it of r.items) byRar[it.r]=(byRar[it.r]||0)+1;
  const cards=[...r.items].reverse().slice(0,200).map(p=>prodCard(p,{isNew:p.isNew})).join('');
  return `${r.gain?`<div class="invbar" style="font-size:12px">
          <span style="color:#9fb0c0">今回の売上<small style="opacity:.75">（加算済み）</small></span>
          <b style="color:#ffd27a;font-size:19px">${yen(r.gain)}</b>${rarChips(byRar)}</div>`
        :`<div class="rowline" style="font-size:11px;color:#9fb0c0">新しく完成した製品はありません。</div>`}
      <div class="rowline" style="font-size:11px;color:#9fb0c0">
        ${r.registered?`${r.registered}個を${uic('collection')}図鑑に登録しました。`:''}NEW は初めて作られた製品です。</div>
      <div class="pgrid">${cards||'<div class="cost">まだありません</div>'}</div>`;
}
/* 二重回収の防止。ホスティング環境では claim の往復に数百msかかるので、
   その間にもう一度押されると「2回目の空の claim」で中身が消えて見えた。 */
let _claiming=false;
export async function openDone(){
  if(_claiming) return;
  _claiming=true;
  /* サーバの返事を待たずに先に枠を出す。押した瞬間に画面が変わらないと
     「反応していない」と思ってもう一度押されるため、往復の待ちは中で見せる。 */
  let res=null;
  const d=openDialog({ title:`${uic('gift')} 完成品`,
    subtitle:()=>res?`${res.items.length}個`:'',
    body:()=>doneBody(res),
    actions:()=>res?[{label:`${uic('collection')} 図鑑を見る`,kind:'ghost',on:()=>openCollection()}]:[] });
  const r=await NET.call('POST','/api/claim').finally(()=>{ _claiming=false; });
  if(!r){ if(_dlg===d) d.close(); return; }   // 通信エラーは toast が出る。空の枠は残さない
  setPending(0); updateDoneBtn();
  if(_dlg!==d) return;                        // 待っている間に別の画面へ移っていたら描かない
  res=r; d.refresh();                         // ここまでで中身が出る（往復1回ぶん）
  /* 💰と図鑑の取り直しは表示に間に合わせる必要がないので、
     ダイアログを出したあとに並列で回す（直列に待つと開くのがそのぶん遅れる）。 */
  const [st,col]=await Promise.all([
    NET.call('GET','/api/state?rev='+NET.rev),
    NET.call('GET','/api/collection'),
  ]);
  if(st){ NET.last=st; applyFactory(st.factory); }
  if(col){ const c=craftState(); c.collection=Object.fromEntries(
    Object.entries(col.collection||{}).map(([k,v])=>[k,v.owned]));
    c.collectionMeta=col.collection||{}; }
  updateBadge(); renderBoard();
}

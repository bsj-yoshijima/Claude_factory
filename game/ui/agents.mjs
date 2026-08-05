/* 🧑‍🏭 エージェント一覧 — 稼働状況と被り物(スキン)の変更。 */
import { _dlg, openDialog, toast } from './dialog.mjs';
import { G } from '../state.mjs';
import { uic } from './parts.mjs';

let _agentSel=null;                     // スキン選択を開いているプロジェクト(null=閉じている)
function agentRows(){                   // プロジェクト単位に集約(同名エージェントは稼働数をまとめる)
  const list=(window.__factory&&window.__factory.getAgents())||[];
  const by={};
  for(const a of list){ const p=by[a.proj]||(by[a.proj]={proj:a.proj,color:a.color,skinId:'none',n:0,busy:0});
    p.n++; if(a.working)p.busy++; if(a.skinId&&a.skinId!=='none')p.skinId=a.skinId; }
  return Object.values(by);
}
const skinName=(id)=>{ const s=((window.__factory&&window.__factory.skinList)||[]).find(x=>x.id===id); return s?s.n:'デフォルト'; };
/* 被り物の画像(assets/hats/hat-*.png)は31テーマぶん揃っているが、増減しても壊れないようにしておく。
   onerror で DOM を差し替える手は、差分適用のたびに元の <img> へ戻されて
   読み直し→また差し替え…とちらつくので使わない。
   「その画像があるか」を一度だけ判定してキャッシュし、描画は常に決定的にする。 */
const _hatOk=new Map();                     // id -> true(あり) / false(なし・未判定)
export function hatReady(id){
  if(!id||id==='none') return false;
  if(_hatOk.has(id)) return _hatOk.get(id);
  _hatOk.set(id,false);                     // 判定がつくまでは「なし」＝絵文字で描く
  const im=new Image();
  im.onload =()=>{ _hatOk.set(id,true); if(_dlg) _dlg.refresh(); };   // 届いたら次の描画から画像に変わる
  im.onerror=()=>{ _hatOk.set(id,false); };
  im.src='assets/hats/hat-'+id+'.png';
  return false;
}
/* スキンの見本。被り物の画像があればそれを、無ければ Claude君のドット絵を出す。
   以前は絵文字（🧑‍🏭 や テーマの絵文字）を仮アイコンにしていたが、ドット絵の中で浮くうえ、
   「被り物なし」も「画像が未生成」も実際の見た目は素の Claude君なので、そちらのほうが正しい。 */
function skinThumb(id,px){
  return hatReady(id)
    ? `<img src="assets/hats/hat-${id}.png" alt="" style="width:${px+16}px;height:${px+16}px;object-fit:contain">`
    : uic('agent',true);
}
export function openAgents(){
  const esc=(s)=>String(s||'').replace(/[<>&]/g,'');
  return openDialog({ title:`${uic('agent')} エージェント`,
    subtitle:()=>{ const r=agentRows(), n=r.reduce((s,p)=>s+p.n,0), b=r.reduce((s,p)=>s+p.busy,0);
      return `稼働 ${b} / 休憩 ${n-b}`; },
    live:1000,                          // 開いている間は最新の稼働状況に追従
    body:()=>{
      const rows=agentRows(); if(!rows.length) return '<div class="cost" style="padding:12px">稼働中のエージェントがいません。</div>';
      /* 選べるのは所持しているスキンだけ（ショップで買う）。'none'=デフォルトは常に選べる。
         未所持を並べても押せないだけなので、一覧には出さずショップへ案内する */
      const all=(window.__factory&&window.__factory.skinList)||[];
      const owned=G.skinOwned||[];
      const skins=all.filter(s=>s.id==='none'||owned.includes(s.id));
      return rows.map(p=>{
        const key=encodeURIComponent(p.proj), nm=esc(p.proj)||'(無名)', open=_agentSel===p.proj;
        const hat=hatReady(p.skinId)?`<img src="assets/hats/hat-${p.skinId}.png" alt="">`:'';
        // 1プロジェクト = 1ノード。data-key で、稼働状況の変化で並びが動いてもノードを持ち回す
        // （＝ 開いているスキン一覧のスクロール位置が live更新で戻らない）
        let h=`<div data-key="ag:${key}"><div class="rc">
          <div class="ic"><span class="lgAv" style="background:${p.color||'#4f7fc4'}"><span class="eye l"></span><span class="eye r"></span>${hat}</span></div>
          <div class="mid"><div class="nm">${nm}${p.n>1?` <span style="color:#9fb0c0;font-size:10px">×${p.n}</span>`:''}</div>
            <div class="cost"><span class="agSt ${p.busy?'on':''}">${p.busy?`🟢 稼働 ${p.busy}/${p.n}`:'💤 休憩'}</span>スキン: ${skinName(p.skinId)}</div></div>
          <button data-agsel="${key}">${open?'閉じる':'スキン'}</button></div>`;
        // スキンの一覧は長いので行の直下で折りたたみ表示（他の行が押し出されないよう高さを制限）
        if(open) h+=`<div class="grid" style="margin:0 0 12px 8px;max-height:196px;overflow-y:auto">${skins.map(s=>{ const on=p.skinId===s.id;
            return `<div class="cell own" data-key="sk:${s.id}" data-skin="${s.id}" data-proj="${key}" title="${s.n}"
              style="${on?'border-color:var(--gold);box-shadow:0 0 0 2px var(--gold) inset':''}">${skinThumb(s.id,26)}<small style="color:#cfeee0">${s.n}</small>${on?'<span class="qty">✓</span>':''}</div>`;
          }).join('')}</div>`;
        return h+'</div>';
      }).join('')
      +`<div class="rowline" style="font-size:11px;color:#9fb0c0">「スキン」から被り物を変更できます（所持しているものだけ）。
         ${uic('shop')}ショップ→スキン で購入できます。画像が未生成のスキンは Claude君のまま出ていて、アセットが届くと見た目が変わります。</div>`;
    },
    onRender:(p,d)=>{
      p.querySelectorAll('[data-agsel]').forEach(el=>el.onclick=()=>{
        const pj=decodeURIComponent(el.dataset.agsel); _agentSel=(_agentSel===pj)?null:pj; d.refresh(); });
      p.querySelectorAll('[data-skin]').forEach(el=>el.onclick=()=>{
        const pj=decodeURIComponent(el.dataset.proj);
        if(!window.__factory) return;
        window.__factory.applySkin(pj, el.dataset.skin);   // scene側で this.skins更新＋window.__skinChangedで永続化
        toast(`${pj||'(無名)'} → ${skinName(el.dataset.skin)}`); d.refresh(); });
    } });
}
// 導線は左下の稼働/休憩HUDだけ。☰メニューの「仲間」節は外した（同じ物への入口が2つある必要はない）

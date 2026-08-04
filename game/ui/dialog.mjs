/* 共通ダイアログ — 見出し / タブ / 本文 / 操作ボタン / 閉じる。全画面がこれに載る。 */
import { morphInto } from './morph.mjs';

export const overlay=document.getElementById('overlay'), panel=document.getElementById('panel');
/* =========================================================================
   DOM差分適用（morph） — 再描画で「いまの状態」を壊さないための土台
   innerHTML の貼り替えは DOM ノードを丸ごと捨てるので、
     ・選択中のテキスト（ハイライト）が解除される
     ・入れ子のスクロール位置 / フォーカス / ホバー / 入力途中の値が失われる
     ・<img> が読み直しになってちらつく
   live更新（1〜2秒ごと）ではこれが延々と起きる。そこで
   「新しく描いたツリーへ、既存ツリーを最小の変更で寄せる」方式にする。
   ノードが生き残るので、上のどれも副作用として保たれる。
     data-key   : 並び替わるリストに付けると、ノードを持ち回して同一性を保てる
     data-morph="skip" : 既にある要素の中身には触れない（外部が触る領域の保護用）
   ========================================================================= */
export let _dlg=null, _dlgTimer=null;
export function closeOverlay(){ overlay.classList.remove('show');
  if(_dlgTimer){ clearInterval(_dlgTimer); _dlgTimer=null; } _dlg=null;
  // パレットは編集モード側の持ち物。ここから直に呼ぶと相互 import になるので window 経由にする
  if(document.getElementById('palette').classList.contains('show')&&window.renderPalette) window.renderPalette(); }
export function openDialog(o){
  const val=(v,d)=>(typeof v==='function')?v(d):v;
  const dlg={ tab:o.tab||null, refresh, setTab, close:closeOverlay };
  let mounted=false, shownTab=null;                          // 初回だけは前のダイアログの残骸を捨てて建て直す
  function setTab(id){ dlg.tab=id; if(o.onTab) o.onTab(id,dlg); else refresh(); }
  function refresh(){
    if(_dlg!==dlg) return;                                   // 別のダイアログに差し替わっていたら描かない
    const tabs=val(o.tabs,dlg)||[];
    const acts=val(o.actions,dlg)||[];
    const subtitle=o.subtitle!=null?val(o.subtitle,dlg):'';
    const html='<span class="close" title="閉じる">✕</span>'
      +`<div class="dlgHead"><h2>${o.title||''}${subtitle?`<span class="dlgSub">${subtitle}</span>`:''}</h2>`
      +(tabs.length?`<div class="sttabs">${tabs.map(t=>`<span class="sttab ${t.id===dlg.tab?'on':''}" data-dlgtab="${t.id}">${t.label}</span>`).join('')}</div>`:'')
      +'</div>'
      +`<div class="pbody">${val(o.body,dlg)||''}</div>`
      +(acts.length?`<div class="dlgFoot">${acts.map((a,i)=>
          `<button class="dbtn ${a.kind==='ghost'?'ghost':''}" data-dlgact="${i}"${a.disabled?' disabled':''}>${a.label}</button>`).join('')}</div>`:'');
    // 2回目以降は差分適用。選択中のテキストもスクロール位置も生き残る（morphInto の項を参照）
    const tabChanged = mounted && shownTab!==dlg.tab;
    if(mounted) morphInto(panel,html); else { panel.innerHTML=html; mounted=true; }
    shownTab=dlg.tab;
    // 本文が別物になるタブ切替のときだけ先頭へ。live更新ではスクロール位置を保つ
    if(tabChanged){ const b=panel.querySelector('.pbody'); if(b) b.scrollTop=0; }
    panel.querySelector('.close').onclick=closeOverlay;
    panel.querySelectorAll('[data-dlgtab]').forEach(el=>el.onclick=()=>setTab(el.dataset.dlgtab));
    panel.querySelectorAll('[data-dlgact]').forEach(el=>el.onclick=()=>{ const a=acts[+el.dataset.dlgact]; if(a&&a.on) a.on(dlg); });
    if(o.onRender) o.onRender(panel,dlg);
  }
  if(_dlgTimer){ clearInterval(_dlgTimer); _dlgTimer=null; }
  _dlg=dlg; refresh(); overlay.classList.add('show');
  if(o.live) _dlgTimer=setInterval(()=>{ if(overlay.classList.contains('show')) refresh(); else closeOverlay(); }, o.live);
  return dlg;
}
export function toast(m){ const t=document.getElementById('toast'); t.textContent=m; t.style.display='block'; clearTimeout(t._t); t._t=setTimeout(()=>t.style.display='none',1600); }

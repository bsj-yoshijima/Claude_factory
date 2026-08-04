/* DOM差分適用 — 再描画で「いまの状態」を壊さないための土台。 */
function _morphAttrs(from,to){
  for(const a of Array.from(from.attributes)) if(!to.hasAttribute(a.name)) from.removeAttribute(a.name);
  for(const a of Array.from(to.attributes)) if(from.getAttribute(a.name)!==a.value) from.setAttribute(a.name,a.value);
}
// 差し替えずに寄せられる組み合わせか。data-key が違うものは別物として扱う
function _morphSame(a,b){
  if(a.nodeType!==b.nodeType) return false;
  if(a.nodeType!==1) return true;
  return a.tagName===b.tagName && (a.getAttribute('data-key')||null)===(b.getAttribute('data-key')||null);
}
function _morphNode(from,to){
  if(from.nodeType!==1){ if(from.nodeValue!==to.nodeValue) from.nodeValue=to.nodeValue; return; }
  if(to.getAttribute('data-morph')==='skip') return;
  _morphAttrs(from,to);
  _morphChildren(from,to);
}
function _morphChildren(from,to){
  // data-key を持つ既存の子を先に拾っておく（並びが変わってもノードを使い回す）
  const keyed=new Map();
  for(const c of Array.from(from.childNodes))
    if(c.nodeType===1){ const k=c.getAttribute('data-key'); if(k) keyed.set(k,c); }
  let cur=from.firstChild;
  for(const t of Array.from(to.childNodes)){
    const k=(t.nodeType===1)?t.getAttribute('data-key'):null;
    let hit=null;
    if(k){ if(keyed.has(k)){ hit=keyed.get(k); keyed.delete(k); } }
    // キー無しは位置で対応づける。キー付きの既存ノードは「その場所の持ち主」ではないので使わない
    else if(cur && _morphSame(cur,t) && !(cur.nodeType===1&&cur.getAttribute('data-key'))) hit=cur;
    if(hit){
      if(hit===cur) cur=cur.nextSibling; else from.insertBefore(hit,cur);
      _morphNode(hit,t);
    } else from.insertBefore(t.cloneNode(true),cur);       // cur が null なら末尾に足される
  }
  while(cur){ const n=cur.nextSibling; from.removeChild(cur); cur=n; }   // cur 以降は残りもの
}
/* html を root の中身に反映する。root の子ノードは可能な限り再利用される */
export function morphInto(root,html){
  const tmp=document.createElement('div'); tmp.innerHTML=html;
  _morphChildren(root,tmp);
}

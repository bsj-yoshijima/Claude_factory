/* 共通のUI部品 — 同じ見た目のものは同じ関数から出す。 */
import { MACH, RAR, machVariant } from '../data/econ.mjs';
import { MAT, SECRET_G } from '../data/craft.mjs';
import { PROD_PRICE } from '../data/rules.mjs';
import { G } from '../state.mjs';

export function updateBadge(){ const m=document.getElementById('shopMoney');
  if(m) m.innerHTML=yen(Math.floor(G.money)); }

/* UI機能のドット絵アイコン（16×16 を原寸。lg=true は整数2倍の32px）。
   ダイアログの見出し・タブ・ボタン・説明文など「HTMLを置ける場所」だけで使う。
   toast() は textContent、title 属性も文字列しか入らないので、そこは絵文字のまま。
   材料・製品・装飾・テーマの絵文字はゲームの中身なので触っていない。 */
export const uic=(name,lg=false)=>`<img class="uic${lg?' lg':''}" src="assets/ui/icons/${name}.png" alt="">`;

/* 💰の表示は必ずこれを通す（uic('yen') を直に書かない）。
   金額とアイコンの「並び・大きさ・縦の揃え」を1箇所に閉じ込めるため:
     ・アイコンは必ず数値の後ろ（前に置く書き方を残すと混在する）
     ・大きさは数字の半分。桁の大小に追従させたいので px ではなく em（CSS 側）
     ・下端を数字のベースラインに合わせる（CSS 側）
   丸めは呼ぶ側の判断（floor か round か）に任せ、ここでは桁区切りだけ入れる。 */
export const yen=(n)=>
  `<span class="yenv">${Number(n||0).toLocaleString()}<img class="uic yen" src="assets/ui/icons/yen.png" alt="円"></span>`;

/* テーマのサムネイル（部屋の絵の縮小版 64×64。tools/assets/make_theme_thumbs.mjs 生成）。
   ドット絵ではないので pixelated にはせず、CSS 側で普通に縮めて出す。
   汎用（キーなし）だけは対応する部屋が無いのでソファのアイコンで代用する。 */
export const themeIcon=(key)=> key
  ? `<img class="thumb" src="assets/ui/icons/theme-${key}.png" alt="">`
  : uic('sofa');

/* 製造機のドット絵アイコン（16×16。編集パレットでは原寸、ショップの行だけ2倍）。
   HTMLを置ける場所（ショップの行・編集パレット）だけで使う。トーストや title 属性は
   文字列しか入らないので、そこは MACH[].e の絵文字のまま。 */
export const machIcon=(variant)=>
  `<img class="micon" src="assets/ui/icons/${MACH[machVariant(variant)].ic}.png" alt="">`;

/* =========================================================================
   共通のUI部品 — 同じ見た目のものは同じ関数から出す

   以前は 図鑑 / 📊今日の製造 / 🎁完成品 / 🏪ショップ が、それぞれ同じ入れ子の
   HTML を手で書いていた。レア度の枠色や NEW バッジの付け方が場所ごとに
   微妙に違い、片方だけ直る事故が起きやすかった。
   ========================================================================= */
/* 製品カード（図鑑・今日の製造・完成品で共通）。
     p     : 製品（PROD の要素）
     n     : 個数。null なら個数行を出さない
     rows  : カード下部に足す行（レシピ絵文字など）の配列
     isNew : NEW バッジ
     miss  : 未発見（❓ で伏せる）
     key   : morphInto 用の data-key（並びが変わる一覧で使う） */
/* 製品の絵。シークレット(UMA)だけドット絵アイコンを持つ。
   assets/ui/secrets/<id>.png が無い/読めないときは onerror で絵文字に戻る。 */
export const prodArt=(p)=> (p && p.g===SECRET_G && p.id!=='blob')
  ? `<img class="pimg" src="assets/ui/secrets/${p.id}.png" alt="${p.n}"
       onerror="this.replaceWith(document.createTextNode('${p.e}'))">`
  : (p?p.e:'');

export function prodCard(p,{n=null,rows=[],isNew=false,miss=false,key=null}={}){
  const col=RAR[p.r].c, k=key?` data-key="${key}"`:'';
  if(miss) return `<div class="pcard miss"${k}><div class="e">❓</div><div class="nm">？？？</div>
      <div class="rr" style="color:${col}">${RAR[p.r].n}</div></div>`;
  return `<div class="pcard"${k} style="border-color:${col}">${isNew?'<span class="new">NEW</span>':''}
      <div class="e">${prodArt(p)}</div><div class="nm">${p.n}</div>
      <div class="rr" style="color:${col}">${RAR[p.r].n}</div>
      ${n!=null?`<div class="qn">${n}</div>`:''}${rows.join('')}</div>`;
}
/* 原材料の組み合わせを絵文字で1行。title には日本語名を出す */
export function matRow(key,suffix=''){
  const ids=String(key||'').split(',').filter(Boolean);
  if(!ids.length) return '';
  return `<div class="qn" title="${ids.map(x=>MAT[x]?MAT[x].n:x).join(' + ')}">${
    ids.map(x=>MAT[x]?MAT[x].e:'').join('')}${suffix}</div>`;
}
/* レア度ごとの内訳チップ（完成品の売上内訳） */
export const rarChips=(byRar)=>Object.keys(byRar).sort().map(r=>
  `<span class="chip"><b style="color:${RAR[r].c}">${RAR[r].n}</b>×${byRar[r]} = ${yen(PROD_PRICE[r]*byRar[r])}</span>`).join('');
/* 1行アイテム（ショップの各タブ・エージェント一覧で共通）。
     icon / name / sub は文字列（HTML可）、action は右端のボタン */
export function itemRow({icon='',name='',sub='',action='',key=null,style=''}){
  const k=key?` data-key="${key}"`:'';
  return `<div class="rc"${k}${style?` style="${style}"`:''}><div class="ic">${icon}</div>
      <div class="mid"><div class="nm">${name}</div>${sub?`<div class="cost">${sub}</div>`:''}</div>${action}</div>`;
}
/* 横並びのタブ列。openDialog のタブ機構に載せられない「本文内の切り替え」用。
   属性名(attr)だけ変えて、リーダーボードの軸ボタンとマイページの粒度切替が同じ見た目になる。
   pill:true は角丸の独立ボタン（見出しに連なるタブではないとき）。
   以前はここだけ style="border-radius:8px" をインラインで上書きしていた。 */
export const tabStrip=(items,cur,attr,{pill=false}={})=>
  `<div class="${pill?'rowline':'sttabs'}">${items.map(t=>
    `<span class="sttab${t.id===cur?' on':''}${pill?' pill':''}" ${attr}="${t.id}">${t.label}</span>`).join('')}</div>`;


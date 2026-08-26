/* 共通のUI部品 — 同じ見た目のものは同じ関数から出す。 */
import { MACH, RAR, machVariant } from '../data/econ.mjs';
import { GENRE, MAT } from '../data/craft.mjs';
import { PROD_PRICE } from '../data/rules.mjs';
import { G } from '../state.mjs';

export function updateBadge(){ const m=document.getElementById('shopMoney');
  if(m) m.innerHTML=yen(Math.floor(G.money)); }

/* ☰メニューのリーダーボード項目の出し分け。
   リーダーボードは同じグループの人だけを並べるものなので、どのグループにも
   入っていない人には項目そのものを出さない（開いて空の表を見せない）。
   updateBadge と同じく pollWp から毎回呼ばれる冪等な同期。 */
export function syncLbMenu(){ const el=document.getElementById('lbBtn');
  if(el) el.style.display = G.hasGroup ? '' : 'none'; }

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

/* 原材料 / 製品 / ジャンルのドット絵アイコン（16×16 を原寸。lg=true は整数2倍の32px）。
   tools/assets/cut_icon_sheet.py が Stitch のシートから切り出したもの。

   craft.mjs の `e`（絵文字）は消していない。toast() と title 属性は文字列しか入らないので
   そこは絵文字のままだし、アイコンが用意できていない環境の控えでもある
   （同じ判断を背景テーマでしている。palette.mjs の BG_META のコメント参照）。
   HTML を置ける場所だけ、この3つを通してドット絵にする。 */
const icon=(cls,file,alt)=>`<img class="${cls}" src="assets/ui/icons/${file}.png" alt="${alt}">`;
/* ドット絵は伸ばすとボケるので、出る大きさごとに別の絵を持つ（表示倍率で誤魔化さない）。
     原材料・ジャンル … 16px 版（.uic）と 32px 版（-32.png / .pic）の2枚持ち。
       16px = レシピ左 .rms 15px / 材料チップ .mchip 14px / 図鑑カードの材料行
       32px = 製造機のマス .mslot .e（24px の枠）
     製品 … 32×32 の1枚（.pic）。出る枠が 図鑑カード28px / レシピ右22px なので原寸で足りる。
   lg=true で 32px 版に切り替わる。16px 版を CSS で2倍に伸ばすのは禁止。 */
export const matIcon=(id,lg=false)=> icon(lg?'pic':'uic',`mat-${id}${lg?'-32':''}`,(MAT[id]||{}).n||'');
export const prodIcon=(p)=> icon('pic',`prod-${p.id}`,p.n||'');
/* シークレット枠は GENRES に無い（原材料を持たないので）。絵が無いので ✨ のまま出す */
export const genreIcon=(id,lg=false)=> GENRE[id] ? icon(lg?'pic':'uic',`genre-${id}${lg?'-32':''}`,GENRE[id].n) : '✨';

/* 製造機のドット絵アイコン（16×16。編集パレットでは原寸、ショップの行だけ2倍）。
   HTMLを置ける場所（ショップの行・編集パレット）だけで使う。トーストや title 属性は
   文字列しか入らないので、そこは MACH[].e の絵文字のまま。
   cls は置き場所に合わせて変える。既定の .micon は行やマスの中に置くとき用で、
   'uic' を渡すと他のUIアイコンと同じ縦位置になる（タブの見出しなど、並びが揃う）。 */
export const machIcon=(variant,cls='micon')=>
  `<img class="${cls}" src="assets/ui/icons/${MACH[machVariant(variant)].ic}.png" alt="">`;

/* 装飾品のアイコン。殻から作り直した個体(prop-fit.json の baked)は、盤面に置くのと
   同じ絵をそのまま出す。旧290体は絵の余白や大きさがまちまちで一覧に並べると不揃いなので、
   従来どおり絵文字のまま（fb で受ける）。baked が増えれば自動でこちらへ移る。 */
export const propArt=(variant,fb)=>{
  const f = window.__scene && window.__scene.propFit && window.__scene.propFit()[variant];
  return (f && f.baked)
    ? `<img class="propart" src="assets/props/prop_${variant}.png" alt="">`
    : fb;
};

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
export function prodCard(p,{n=null,rows=[],isNew=false,miss=false,key=null}={}){
  const col=RAR[p.r].c, k=key?` data-key="${key}"`:'';
  if(miss) return `<div class="pcard miss"${k}><div class="e">❓</div><div class="nm">？？？</div>
      <div class="rr" style="color:${col}">${RAR[p.r].n}</div></div>`;
  return `<div class="pcard"${k} style="border-color:${col}">${isNew?'<span class="new">NEW</span>':''}
      <div class="e">${prodIcon(p)}</div><div class="nm">${p.n}</div>
      <div class="rr" style="color:${col}">${RAR[p.r].n}</div>
      ${n!=null?`<div class="qn">${n}</div>`:''}${rows.join('')}</div>`;
}
/* 原材料の組み合わせをドット絵で1行。title には日本語名を出す */
export function matRow(key,suffix=''){
  const ids=String(key||'').split(',').filter(Boolean);
  if(!ids.length) return '';
  return `<div class="qn" title="${ids.map(x=>MAT[x]?MAT[x].n:x).join(' + ')}">${
    ids.map(x=>MAT[x]?matIcon(x):'').join('')}${suffix}</div>`;
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


/* 🧾 製造レシピ — 「何を入れれば作れるか」の一覧。 */
import { RAR } from '../data/econ.mjs';
import { GENRES, MAT, PRODS, SECRETS, SECRET_G, UNKNOWN_PRODUCT } from '../data/craft.mjs';
import { craftState } from '../state.mjs';
import { openDialog } from './dialog.mjs';

function secretMatsOf(pid){
  const k=Object.keys(SECRETS).find(k=>SECRETS[k].pid===pid);
  return k?k.split(','):[];
}
function recipeRow(p,mats){
  const chips=mats.map(x=>MAT[x]?`<span title="${MAT[x].n}">${MAT[x].e}</span>`:'').join('<i>＋</i>');
  const out=(craftState().collection[p.id]||0)
    ? `<span class="rp"><span class="e">${p.e}</span><span class="nm">${p.n}</span>
         <span class="rr" style="color:${RAR[p.r].c}">${RAR[p.r].n}</span></span>`
    : `<span class="rp"><span class="e sil" title="まだ作っていない製品">${p.e}</span>
         <span class="nm dim">？？？</span></span>`;
  return `<div class="rrow" data-key="${p.id}"><span class="rms">${chips}</span><i class="ra">→</i>${out}</div>`;
}
/* 節の中の並び順は「必要マス数の少ない順 → 同じマス数ならレア度の低い順」。
   持っている製造機で作れるものが上に来るので、2マス機しか無いうちから表が読める。
   必要マス数 = 重複を除いた原材料の数（RECIPES のキーと同じ数え方）。 */
const recipeSlots = (mats)=>new Set(mats).size;
const recipeSorted = (rows)=>rows.slice().sort((a,b)=>
  recipeSlots(a.mats)-recipeSlots(b.mats) || a.p.r-b.p.r);
const recipeRowsOf = (g,matsOf)=>PRODS.filter(p=>p.g===g && p.id!==UNKNOWN_PRODUCT)
  .map(p=>({p,mats:matsOf(p)}));
function recipeBody(){
  const c=craftState();
  const sec=(head,rows)=>`<div class="rsec">${head}</div><div class="rlist">`
    +recipeSorted(rows).map(x=>recipeRow(x.p,x.mats)).join('')+'</div>';
  let body=GENRES.map(g=>sec(`${g.e} ${g.n}`, recipeRowsOf(g.id,p=>p.m))).join('');
  /* シークレットは1つでも作るまで節ごと出さない。出したあとも中身は「作った物」だけで、
     未発見のシークレットは行ごと存在しない（残り何個かを悟らせないため）。 */
  const found=recipeRowsOf(SECRET_G,p=>secretMatsOf(p.id)).filter(x=>c.collection[x.p.id]);
  if(found.length) body+=sec('✨ シークレット',found);
  return body+`<div class="rowline" style="font-size:11px;color:#9fb0c0">
    左が原材料の組み合わせ、右がそれで作れる製品。1度も作っていない製品は
    <b style="color:#eafff4">シルエット</b>だけ見える。作れば名前とレア度が出る。
    作った数は 📖 図鑑 で見られる。</div>`;
}
export function openRecipes(){ return openDialog({ title:'🧾 製造レシピ', body:recipeBody }); }

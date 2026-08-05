/* 📖 図鑑 — 製造した製品の一覧。ジャンルごとのタブ。 */
import { GENRE, GENRES, PRODS, SECRET_G } from '../data/craft.mjs';
import { WP_PER_SLOT } from '../data/rules.mjs';
import { craftState } from '../state.mjs';
import { openDialog } from './dialog.mjs';
import { matRow, prodCard, uic } from './parts.mjs';

let _collectionGenre='food';     // 図鑑のジャンル切り替え（GENRES + ✨シークレット）
// 図鑑のタブ＝製品のジャンル。GENRES に足せば自動で増える
const collectionGenres = ()=>[...GENRES, {id:SECRET_G,e:'✨',n:'シークレット'}];
/* 図鑑の並びは レア度の低い順 → 同レア度なら必要マス数の少ない順。
   PRODS の定義順（ジャンル→マス数→単独/レシピガチャ枠）をそのまま出すと、マス数グループの
   末尾に置いたレシピガチャ枠の「1段上」のせいで、次のグループの先頭で必ずレア度が下がる。
   定義順は m を読みやすく並べるためのもので表示順ではないので、ここで並べ直す。 */
const prodsOfGenre = (g)=>PRODS.filter(p=>p.g===g)
  .sort((a,b)=> a.r-b.r || new Set(a.m||[]).size-new Set(b.m||[]).size);
// タブはジャンルそのもの。件数は「発見済み/全部」
function collectionTabs(){
  const c=craftState();
  return collectionGenres().map(g=>{ const list=prodsOfGenre(g.id);
    const own=list.filter(p=>c.collection[p.id]).length;
    return {id:g.id,label:`${g.e} ${g.n} ${own}/${list.length}`}; });
}
// 全ジャンル通しての達成度は見出しの脇に出す（タブがジャンル別の件数で埋まっているぶん）
function collectionSubtitle(){
  const c=craftState();
  return `${PRODS.filter(p=>c.collection[p.id]).length}/${PRODS.length}`;
}
function collectionBody(){
  const c=craftState();
  // 図鑑への登録は「🎁完成品の一覧を開いたとき」に行われる
  return `<div class="pgrid">${prodsOfGenre(_collectionGenre).map(p=>{ const n=c.collection[p.id]||0;
      // 発見済みにはレシピ（= m）をそのまま出す。製品ごとに組み合わせは1つだけなので断定して見せられる
      return prodCard(p, n ? {n:`×${n}`, rows:[matRow(p.m.join(','))]} : {miss:true});
    }).join('')}</div>
      <div class="rowline" style="font-size:11px;color:#9fb0c0">${_collectionGenre===SECRET_G
        ? `シークレットは<b style="color:#ffd27a">ジャンルを跨いだ原材料</b>の特定の組み合わせでのみ、ごく低確率で出る。
           跨いだ組み合わせのほとんどは 🪨 謎のカタマリ。`
        : `同じ ${GENRE[_collectionGenre]?GENRE[_collectionGenre].e+GENRE[_collectionGenre].n:''} ジャンルの原材料の組み合わせを変えて未発見の製品を探そう。
           発見済みカードの下に出る絵文字が<b style="color:#eafff4">その製品を作れる唯一の組み合わせ</b>。
           同じ組み合わせから複数の製品が出ることはあるので、上位レア度は何度も試して狙う。
           1製品 = マス数 × ${WP_PER_SLOT}WP。レシピに無い組み合わせだと 🪨 謎のカタマリ ができる。`}</div>`;
}
export function openCollection(genre){
  const gs=collectionGenres();
  if(genre&&gs.some(g=>g.id===genre)) _collectionGenre=genre;
  if(!gs.some(g=>g.id===_collectionGenre)) _collectionGenre=gs[0].id;   // GENRES から消えたジャンルを覚えていたとき
  return openDialog({ title:`${uic('collection')} 図鑑`, subtitle:collectionSubtitle,
    tabs:collectionTabs, tab:_collectionGenre,
    onTab:(id,d)=>{ _collectionGenre=id; d.refresh(); },
    body:collectionBody });
}
// 引数なしで開く（そのまま渡すと click イベントが tab として入ってしまう）

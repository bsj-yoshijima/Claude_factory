/* 🔧 レイアウト編集 — パレット / 設置 / 製造機の設定パネル / 編集モードの寄せ。 */
import { BG, DECO, MACH, PROP, PROP_GROUPS } from '../data/econ.mjs';
import { NET, applyFactory, saveGame } from '../net.mjs';
import { G, availN, snapLayout } from '../state.mjs';
import { toast } from './dialog.mjs';
import { morphInto } from './morph.mjs';
import { machIcon, themeIcon, uic, updateBadge } from './parts.mjs';

const ROOM_THEMES=['arabia','undersea','japan','china','diner','fantasy','scifi','cabin','dino','haunted','pirate','circuit','dwarf','hell','steampunk','retrofuture','tokyo','halloween','western','sushi','beehive','circus','carnival','desert','jungle','egypt','christmas','space','ice','mushroom','onsen'];
const SKY_THEMES=['blue','sunset','night','space'];   // オーロラは星空・宇宙と同じ暗い夜空で見分けが付かないので外した
/* 背景の表示名と絵文字。絵文字はサムネが無い環境向けの控え（現在は全キーに 64×64 のサムネがある。
   部屋テーマ=tools/assets/make_theme_thumbs.mjs / 空テーマ=tools/assets/make_sky_thumbs.py）。
   キーは空テーマ(SKY_THEMES)と部屋テーマ(ROOM_THEMES)の
   両方をまとめて持つ。'space' は両方に属していて、以前はここで2回定義していた
   （後ろの「宇宙ステーション」が勝っていた）。二重定義はやめて1つにしてある。 */
export const BG_META={auto:{e:'🕐',n:'標準'},blue:{e:'☀️',n:'快晴'},sunset:{e:'🌆',n:'夕焼け'},night:{e:'🌙',n:'星空'},arabia:{e:'🕌',n:'アラビア'},undersea:{e:'🐚',n:'海底'},japan:{e:'⛩️',n:'日本'},china:{e:'🐉',n:'中華'},diner:{e:'🍔',n:'ダイナー'},fantasy:{e:'🧙',n:'ファンタジー'},scifi:{e:'🚀',n:'SF宇宙'},cabin:{e:'🌲',n:'森コテージ'},dino:{e:'🦖',n:'ダイナソー'},haunted:{e:'👻',n:'幽霊屋敷'},pirate:{e:'🏴‍☠️',n:'海賊船'},circuit:{e:'🏁',n:'サーキット'},dwarf:{e:'⛏️',n:'ドワーフ鉱山'},hell:{e:'😈',n:'地獄'},steampunk:{e:'⚙️',n:'スチパン'},retrofuture:{e:'🛸',n:'レトロ未来'},tokyo:{e:'🌃',n:'Tokyo'},halloween:{e:'🎃',n:'ハロウィン'},western:{e:'🤠',n:'西部開拓時代'},sushi:{e:'🍣',n:'回転寿司'},beehive:{e:'🐝',n:'ミツバチの巣'},circus:{e:'🎪',n:'サーカス'},carnival:{e:'🎭',n:'カーニバル'},desert:{e:'🏜️',n:'砂漠'},jungle:{e:'🌴',n:'ジャングル'},egypt:{e:'🔺',n:'古代エジプト'},christmas:{e:'🎄',n:'クリスマス'},space:{e:'🚀',n:'宇宙ステーション'},ice:{e:'🧊',n:'氷の城'},mushroom:{e:'🍄',n:'森のキノコ'},onsen:{e:'♨️',n:'和風温泉'}};
/* 所持している背景。'space' は空テーマにも部屋テーマにも入っているので、
   両方所持していると同じマスが2つ並ぶ。重複は落とす（先に出たほうを残す）。 */
function ownedBgs(){ const a=['auto'];
  for(const k of SKY_THEMES) if(G.bgOwned.includes(k)) a.push(k);
  for(const k of ROOM_THEMES) if(G.seriesOwned.includes(k)) a.push(k);
  return [...new Set(a)]; }
/* 背景の切り替え。見た目はその場で変え、保存はサーバに投げる。
   saveGame()（PUT /api/layout）は配置しか送らないので、これが無いと再読込で戻ってしまう。
   使う口は購入と同じ /api/shop/buy — 所持済みなら無料で再適用される。

   種別は BG（空の背景。'auto' を含む）にキーがあれば 'bg'、無ければ 'series' で判定する。
   SERIES を先に見てはいけない —— 'space' は BG(背景単体 4,200円)にも
   SERIES(宇宙ステーション 6,000円)にも同じキーで入っているので、SERIES 側に倒すと
   「背景単体で買った人が選び直すたびにシリーズを買わされる」。
   シリーズを買うとサーバが S.sky を bg_owned にも入れるので、'bg' で送れば
   どちらの買い方でも所持済み＝無料の再適用になる。
   （SKY_THEMES で判定すると 'auto'(標準) が漏れて 'series' 扱いになり、サーバに弾かれる）

   所持していないキーはそもそも送らない（送ると購入になってしまう）。
   一覧には所持しているものしか並ばないので通常は起こらないが、課金口を叩くので二重に守る。 */
function applyBg(k){
  const owned=(G.bgOwned||[]).includes(k)||(G.seriesOwned||[]).includes(k);
  if(!owned){ toast('未所持です。ショップ→背景 で購入してください'); return; }
  const prev=G.bg, prevFloor=G.floor;
  const paint=(bg)=>{ G.bg=bg;
    if(window.__scene){ window.__scene.setSkyTheme(bg); window.__scene.setFloor(ROOM_THEMES.includes(bg)?'wood':G.floor); } };
  paint(k);
  const kind=BG[k]?'bg':'series';
  NET.call('POST','/api/shop/buy',{kind,id:k}).then(r=>{
    if(r){ applyFactory(r.factory); updateBadge(); renderPalette(); }
    // 失敗したら見た目も戻す（サーバとずれたまま残さない）
    else { G.floor=prevFloor; paint(prev); renderPalette(); }
  });
}
const paletteEl=document.getElementById('palette');
let editCat='bg', editSel=null; window.__editSel=null;
let selMode=false, selN=0;                       // 収納の複数選択モードと選択数
let propFilter=null;                             // 装飾の絞り込みテーマ(null=すべて / ''=汎用)
let _paletteView=null;                           // 最後に描いた一覧の種類。切り替わったときだけスクロールを戻す
export function renderPalette(){
  const cats=[['bg',`${uic('sky')} 背景`],['prop',`${uic('sofa')} 装飾`],['machine',`${uic('factory')} 製造機`]];
  let items='', hint='', acts='', fil='';
  // key は差分適用でノードを持ち回すための識別子（在庫が増減しても他の項目が作り直されない）
  const cell=(key,dataAttr,e,n,extra,qn,on)=>`<div class="pitem ${on?'on':''}" data-key="${key}" ${dataAttr}>${e}<small>${n}</small>${qn!=null?`<span class="qn">${qn}</span>`:''}</div>`;
  if(editCat==='bg'){ hint='背景を選ぶと即適用（部屋ごと切替）';
    items=ownedBgs().map(k=>`<div class="pitem ${G.bg===k?'cur':''}" data-key="bg:${k}" data-bg="${k}">${
      themeIcon(k)}<small>${BG_META[k].n}</small></div>`).join('');
  } else if(editCat==='prop'){
    const s=window.__scene, placedN=s?s.stowables().length:0;
    if(selMode){ hint=`床の装飾をクリックで選択（もう一度クリックで解除）・ ${selN}個 選択中`;
      items=`<div class="phint" style="padding:8px">選択モード中です。戻したい装飾を床でクリックしてください。</div>`;
    } else {
      hint=(editSel?'床をクリックで設置':'在庫から選んで床をクリックで設置')
        +`<br>設置済みはドラッグで移動 / ${uic('trash')}ゴミ箱へドラッグで撤去 ・ ラグは床の平物なので家具の下に敷けます`;
      // テーマ(=背景)で絞り込む。propFilter が null なら全部。DECO は汎用('')扱い
      const inFilter=(th)=> propFilter===null || (th||'')===propFilter;
      const P=Object.keys(PROP).filter(t=>availN('prop',t)>0&&inFilter(PROP[t].th)).map(t=>cell(`prop:${t}`,`data-place="prop:${t}"`,PROP[t].e,PROP[t].n,0,availN('prop',t),editSel&&editSel.kind==='prop'&&editSel.variant===t));
      const D=Object.keys(DECO).filter(t=>availN('deco',t)>0&&inFilter('')).map(t=>cell(`deco:${t}`,`data-place="deco:${t}"`,DECO[t].e,DECO[t].n,0,availN('deco',t),editSel&&editSel.kind==='deco'&&editSel.variant===t));
      items=(P.concat(D).join(''))||`<div class="phint" style="padding:8px">${propFilter===null?`在庫なし。${uic('shop')}ショップ→装飾 で購入してください。`:`このテーマの在庫がありません。「すべて」に戻すか、${uic('shop')}ショップで購入してください。`}</div>`;
      // 絞り込み行: 在庫のあるテーマだけ出す。適用中の背景と同じテーマには印を付ける
      const nOf=(th)=> Object.keys(PROP).filter(t=>(PROP[t].th||'')===th&&availN('prop',t)>0).length
                     + (th===''?Object.keys(DECO).filter(t=>availN('deco',t)>0).length:0);
      const chips=PROP_GROUPS.filter(([th])=>nOf(th)>0).map(([th,label])=>{
        const cur=(th&&th===G.bg)?' ●':'';                      // いま適用中の背景と同じテーマ
        return `<span class="c ${propFilter===th?'on':''}" data-pfil="${th}">${themeIcon(th)}${label}${cur} <span style="color:#9fb0c0">${nOf(th)}</span></span>`; });
      const allN=Object.keys(PROP).filter(t=>availN('prop',t)>0).length
               + Object.keys(DECO).filter(t=>availN('deco',t)>0).length;
      fil=`<span class="c ${propFilter===null?'on':''}" data-pfil="*">すべて <span style="color:#9fb0c0">${allN}</span></span>`+chips.join('');
    }
    // 収納(設置済みを在庫に戻す)。位置は失われるが、在庫に戻るので置き直せる
    acts = selMode
      ? `<span class="c ${selN?'on':''}" data-stow="sel">${uic('box')} 選択した${selN}個を収納</span><span class="c" data-selmode="0">✖ 選択をやめる</span>`
      : `<span class="c" data-stow="all">${uic('box')} すべて収納 (${placedN})</span><span class="c" data-selmode="1">☑️ 選んで収納</span>`;
  } else { hint=(editSel?'床をクリックで設置（Rキーで向き切替）':'在庫から選んで床をクリックで設置。マス数ぶんの空きが必要です')
      +`<br>設置済みはドラッグで移動 / ${uic('trash')}ゴミ箱へドラッグで撤去 ・ クリックで設定パネル（↻回転・✥移動／素材は${uic('factory')}製造タブ）`;
    const M=Object.keys(MACH).filter(t=>availN('machine',t)>0).map(t=>cell(`machine:${t}`,`data-place="machine:${t}"`,machIcon(t),MACH[t].n,0,availN('machine',t),editSel&&editSel.kind==='machine'&&editSel.variant===t));
    items=M.join('')||`<div class="phint" style="padding:8px">在庫なし。${uic('shop')}ショップ→製造機 で購入してください。</div>`;
  }
  morphInto(paletteEl,`<div class="phead"><b>${uic('layout')} レイアウト編集</b><span class="c" data-pclose="1">✖ 閉じる</span></div>
    <div class="pcat">${cats.map(c=>`<span class="c ${c[0]===editCat?'on':''}" data-cat="${c[0]}">${c[1]}</span>`).join('')}</div>
    ${fil?`<div class="pcat pfil">${fil}</div>`:''}
    <div class="pitems">${items}</div>${acts?`<div class="pcat">${acts}</div>`:''}<div class="phint">${hint}</div>`);
  // 一覧そのものが別物になったとき（カテゴリ/絞り込み/選択モードの切替）だけ先頭に戻す。
  // 設置や購入での描き直しではスクロール位置を保つ
  const view=`${editCat}/${propFilter}/${selMode?1:0}`;
  if(view!==_paletteView){ _paletteView=view; const it=paletteEl.querySelector('.pitems'); if(it) it.scrollTop=0; }
  paletteEl.querySelectorAll('[data-pclose]').forEach(el=>el.onclick=()=>toggleEditMode());
  paletteEl.querySelectorAll('.c[data-cat]').forEach(el=>el.onclick=()=>{ editCat=el.dataset.cat; editSel=null; window.__editSel=null; setSelMode(false); renderPalette(); });
  paletteEl.querySelectorAll('[data-pfil]').forEach(el=>el.onclick=()=>{ propFilter=el.dataset.pfil==='*'?null:el.dataset.pfil; renderPalette(); });
  paletteEl.querySelectorAll('[data-selmode]').forEach(el=>el.onclick=()=>{ setSelMode(el.dataset.selmode==='1'); renderPalette(); });
  paletteEl.querySelectorAll('[data-stow]').forEach(el=>el.onclick=()=>stow(el.dataset.stow));
  paletteEl.querySelectorAll('[data-bg]').forEach(el=>el.onclick=()=>{ applyBg(el.dataset.bg); renderPalette(); });
  paletteEl.querySelectorAll('[data-place]').forEach(el=>el.onclick=()=>{ const p=el.dataset.place.split(':'); editSel={kind:p[0],variant:p[1]||null}; window.__editSel=editSel; renderPalette(); });
}
function setSelMode(on){ const s=window.__scene; if(!s) return;
  selMode=!!on; selN=0; s.setSelectMode(selMode);
  if(selMode){ editSel=null; window.__editSel=null; }   // 選択中は誤って設置しないように
}
// 収納 = 設置済みの装飾を在庫に戻す(位置は失われるが置き直せる)
function stow(mode){ const s=window.__scene; if(!s) return;
  let n=0;
  if(mode==='all'){
    const total=s.stowables().length;
    if(!total){ toast('床に装飾がありません'); return; }
    if(!confirm(`床の装飾 ${total} 個をすべて在庫に戻します。配置はやり直しになります。よろしいですか？`)) return;
    n=s.stowAll();
  } else {
    if(!selN){ toast('戻す装飾を床でクリックして選んでください'); return; }
    n=s.stowSelected();
  }
  snapLayout(); saveGame(); updateBadge(); renderPalette();
  toast(`${n}個を在庫に戻しました`);
}
const gameEl=document.getElementById('game'), wrapEl=document.getElementById('wrap');
function slideGame(){
  const g=window.__game; if(!g||!g.scale) return;
  const t0=performance.now();
  const tick=()=>{ g.scale.refresh(); if(performance.now()-t0<620) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
/* 編集モードのON/OFF表示をシーンに合わせる。Eキーや「✥移動」でシーン側から切り替わることがある。
   入口は ☰メニューの「🔧 レイアウト編集」だけ（盤面に常駐するボタンは置かない）ので、
   ONかどうかはボタンの見た目ではなくこの変数で覚える。 */
let _editOn=false;
export function syncEditMode(){ const on=!!(window.__scene&&window.__scene.editMode);
  if(_editOn===on) return;                                   // 変化したときだけ描き直す
  _editOn=on; paletteEl.classList.toggle('show',on);
  wrapEl.classList.toggle('editing',on); slideGame();
  if(on) renderPalette(); else { editSel=null; window.__editSel=null; } }
export function toggleEditMode(){ if(!window.__scene){ toast('準備中…'); return; }
  const on=window.__scene.toggleEdit(); syncEditMode();
  toast(on?'🔧 編集: パレットで選ぶ→床クリックで設置（Rで向き）/ 設置済みはドラッグで移動・🗑へドラッグで撤去':'編集モードを終了'); }

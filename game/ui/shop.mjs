/* 🏪 ショップ — 製造機・装飾・背景の購入と強化。💰の増減は必ずサーバが決める。 */
import { DECO, MACH, PROP, PROP_GROUPS, SERIES, SKIN, lvCost, machVariant } from '../data/econ.mjs';
import { MAT } from '../data/craft.mjs';
import { NET, applyFactory } from '../net.mjs';
import { G, availN, machState, ownedN } from '../state.mjs';
import { hatReady } from './agents.mjs';
import { openDialog, toast } from './dialog.mjs';
import { itemRow, machIcon, matIcon, propArt, themeIcon, uic, updateBadge, yen } from './parts.mjs';

async function apiBuy(kind,id,okMsg){
  const r=await NET.call('POST','/api/shop/buy',{kind,id});
  if(!r) return false; applyFactory(r.factory); updateBadge(); if(okMsg) toast(okMsg); return true;
}
// 購入=在庫(owned)に追加。設置は編集パレットから床クリックで行う
function buyMachine(type){ if(!MACH[type])return; if(G.money<MACH[type].price)return;
  apiBuy('machine',type,`${MACH[type].e} ${MACH[type].n} を購入（🔧編集で設置）`); }
function levelUp(id){ const e=(G.layout||[]).find(x=>x.id===id&&x.kind==='machine'); if(!e)return; if(G.money<lvCost(e.lvl))return;
  NET.call('POST','/api/machine/level',{id}).then(r=>{ if(!r)return;
    applyFactory(r.factory);
    const lv=(r.factory.machines.find(x=>x.id===id)||{}).lvl;
    if(window.__scene&&lv)window.__scene.setMachineLevel(id,lv);
    updateBadge(); toast(`Lv${lv} に強化！`); }); }
// 素材スロットの要約（ショップ一覧用）。何が作れるかは伏せ、素材と稼働状態だけ出す
function slotSummary(e){ const mats=[...new Set((e.slots||[]).filter(Boolean))].sort();
  if(!mats.length) return '素材未設定';
  const icons=mats.map(m=>MAT[m]?matIcon(m):'?').join('');
  // ここは 11px の1行なので、24×24 の歯車を並べると行が倍の高さになる。文字だけにする
  return `${icons}${machState(e.id).running?' ・ 製造中':''}`; }
function buyDeco(t){ if(G.money<DECO[t].price)return;
  apiBuy('deco',t,`${DECO[t].e} ${DECO[t].n} を購入（🔧編集で設置）`); }
function buyProp(t){ if(G.money<PROP[t].price)return;
  apiBuy('prop',t,`${PROP[t].n} を購入（🔧編集で設置）`); }
// スキンは「買う」だけ。誰に被せるかはエージェント一覧で選ぶ
function buySkin(id){ if(!SKIN[id])return; if(G.money<SKIN[id].price)return;
  apiBuy('skin',id,`${SKIN[id].n} を購入（エージェント一覧で被せられます）`); }
function buySeries(k){ const S=SERIES[k];
  apiBuy('series',k,`${S.n} シリーズを適用`).then(okk=>{ if(okk&&window.__scene){
    window.__scene.setSkyTheme(S.sky); window.__scene.setFloor(S.floor); } }); }

let _shopTab='mach';
/* タブ名とアイコンは編集パレットのカテゴリと1対1で揃えてある
   （製造機=factory / 装飾=sofa / 背景=sky）。
   背景は「部屋ごとの着せ替え」に一本化した。以前は別に「内装」タブがあって
   背景(窓の外の景色)と床材を1つずつ買えたが、シリーズが両方まとめて着せ替える
   ので二重だった。タブIDの 'series' は ?shop=series で使えるので変えていない。 */
// 製造機タブの絵は工場ではなく製造機そのもの（レイアウト編集のパレットと揃える）。
// 工場のアイコンは🏭製造タブ=作るものを決める方で使っているので、役割が紛れる
const SHOP_TABS=[['mach',`${machIcon('s2','uic')} 製造機`],['equip',`${uic('sofa')} 装飾`],
                 ['series',`${uic('sky')} 背景`],['skin',`${uic('agent')} スキン`]];
/* ショップの各行は itemRow() に寄せてある。見出し・在庫バッジ・購入ボタンは
   どのタブでも同じ形なので、ここでその3つだけを作る小物を持つ。 */
const shopHead=(t,style='margin:12px 0 6px')=>`<div class="cost" style="${style}">${t}</div>`;
const stockBadge=(n)=>`<span style="color:#9fb0c0;font-size:10px">在庫 ${n}</span>`;
const buyBtn=(attr,id,price,label='購入')=>`<button ${attr}="${id}" ${G.money>=price?'':'disabled'}>${label}</button>`;
/* 所持済みなら「適用」、使用中なら押せない。背景・床材とシリーズで共通の出し分け */
const applyBtn=(attr,id,own,cur,price)=>
  `<button ${attr}="${id}" ${(own||G.money>=price)&&!cur?'':'disabled'}>${own?(cur?'---':'適用'):'購入'}</button>`;
function shopBody(){
    let body='';
    if(_shopTab==='mach'){
      body = shopHead(`設置済みの製造機（Lv↑で生産量が増える。素材は${uic('factory')}製造タブでセット）`,'margin:2px 0 6px');
      const machs=(G.layout||[]).filter(e=>e.kind==='machine');
      body += machs.map(e=>{ const c=lvCost(e.lvl), M=MACH[machVariant(e.variant)];
        return itemRow({ icon:machIcon(e.variant), key:`mc:${e.id}`,
          name:`${M.n} <span style="color:#7fe6ff;font-size:11px">Lv${e.lvl}</span>`,
          sub:`${slotSummary(e)} ・ 次のLv ${yen(c)}`,
          action:`<button data-lv="${e.id}" ${G.money>=c?'':'disabled'}>強化</button>` });
      }).join('') || `<div class="cost" style="padding:6px 2px">未設置。${uic('layout')}編集で在庫から設置</div>`;
      body += shopHead('製造機を購入（マス数が多いほど素材を多く入れられる＝作れる物が増える）');
      body += Object.keys(MACH).map(t=>itemRow({ icon:machIcon(t), key:`mb:${t}`,
        name:`${MACH[t].n} ${stockBadge(availN('machine',t))}`,
        sub:`${yen(MACH[t].price)}`,
        action:buyBtn('data-buymach',t,MACH[t].price) })).join('');
    } else if(_shopTab==='equip'){
      body = shopHead(`購入すると在庫に入ります。設置は ${uic('layout')}編集 のパレットから床をクリック。`,'margin:2px 0 8px');
      body += shopHead('装飾プロップ（Stitch製）');
      for(const [th,label] of PROP_GROUPS){
        const all=Object.keys(PROP).filter(t=>(PROP[t].th||'')===th);
        if(!all.length) continue;
        body += shopHead(`${themeIcon(th)}${label}`,'margin:10px 0 4px;color:#7fe6ff');
        // 基本家具(全テーマ共通スロット)と名物(そのテーマだけの一点物)を分けて並べる
        const ks=[...all.filter(t=>PROP[t].fu), ...all.filter(t=>!PROP[t].fu)];
        body += ks.map(t=>{ const sp=(window.PROP_SPAN||{})[t]||1;   // 占有コマ数(見た目の大きさ)
          return itemRow({ icon:propArt(t,PROP[t].e), key:`pr:${t}`,
            name:`${PROP[t].n} ${stockBadge(ownedN('prop',t))}`,
            sub:`${yen(PROP[t].price)}${sp>1?` ・ ${sp}コマ`:''}`,
            action:buyBtn('data-prop',t,PROP[t].price) }); }).join('');
      }
      body += shopHead('その他');
      body += Object.keys(DECO).map(t=>itemRow({ icon:DECO[t].e, key:`dc:${t}`,
        name:`${DECO[t].n} ${stockBadge(ownedN('deco',t))}`,
        sub:`${yen(DECO[t].price)}`,
        action:buyBtn('data-deco',t,DECO[t].price) })).join('');
    } else if(_shopTab==='skin'){   // スキン — エージェントの被り物
      body = shopHead('買うとエージェント一覧で被せられる。被り物はプロジェクト単位で選べる','margin:2px 0 8px');
      body += Object.keys(SKIN).map(id=>{ const S=SKIN[id], own=(G.skinOwned||[]).includes(id), ready=hatReady(id);
        return itemRow({ icon:ready?`<img class="hat" src="assets/hats/hat-${id}.png" alt="">`:uic('agent',true),
          key:`sk:${id}`, name:S.n,
          // 画像が未生成のスキンは買っても見た目が変わらないので、その旨を行に出す
          sub:`${own?'':yen(S.price)}${ready?'':(own?'':' ・ ')+'画像準備中'}`,
          action:own?'<button disabled>所持</button>':buyBtn('data-skin',id,S.price) }); }).join('');
    } else {   // 背景 — 部屋ごとの着せ替え（背景＋床材＋装飾のセット）
      body = shopHead('部屋ごと着せ替え。購入したものは編集の「背景」からいつでも切り替えられる','margin:2px 0 8px');
      body += Object.keys(SERIES).map(k=>{ const S=SERIES[k],own=G.seriesOwned.includes(k),cur=(G.bg===S.sky&&G.floor===S.floor);
        return itemRow({ icon:themeIcon(S.sky), key:`sr:${k}`,
          name:`${S.n} ${cur?'<span style="color:#7fe6ff;font-size:10px">適用中</span>':''}`,
          // decos は空のシリーズもあるので、あるときだけ区切りを出す（先頭に「・」が浮くのを防ぐ）
          sub:`${S.decos.length?S.decos.join(' ')+' ・ ':''}${own?'所持':yen(S.price)}`,
          action:applyBtn('data-series',k,own,cur,S.price) }); }).join('');
    }
    return body;
}
export function openShop(tab){ if(tab&&SHOP_TABS.some(t=>t[0]===tab))_shopTab=tab;
  return openDialog({ title:`${uic('shop')} ショップ`,
    subtitle:()=>`<span id="shopMoney" style="color:#ffd27a;font-size:13px">${yen(Math.floor(G.money))}</span>`,
    tabs:SHOP_TABS.map(t=>({id:t[0],label:t[1]})), tab:_shopTab,
    onTab:(id,d)=>{ _shopTab=id; d.refresh(); },
    body:shopBody,
    onRender:(p,d)=>{
      const re=()=>d.refresh();
      p.querySelectorAll('[data-lv]').forEach(b=>b.onclick=()=>{ levelUp(b.dataset.lv); re(); });
      p.querySelectorAll('[data-buymach]').forEach(b=>b.onclick=()=>{ buyMachine(b.dataset.buymach); re(); });
      p.querySelectorAll('[data-deco]').forEach(b=>b.onclick=()=>{ buyDeco(b.dataset.deco); re(); });
      p.querySelectorAll('[data-prop]').forEach(b=>b.onclick=()=>{ buyProp(b.dataset.prop); re(); });
      p.querySelectorAll('[data-series]').forEach(b=>b.onclick=()=>{ buySeries(b.dataset.series); re(); });
      p.querySelectorAll('[data-skin]').forEach(b=>b.onclick=()=>{ buySkin(b.dataset.skin); re(); });
    } });
}

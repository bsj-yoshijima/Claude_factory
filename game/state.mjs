/* 画面が共有する状態 — 工場(G)と、そこから引く小さな読み取り。
   サーバから来た値の置き場で、ここ自体は通信もDOM操作もしない。 */
import { keyOfSlots } from './data/craft.mjs';

export let G={ money:0, machines:[{variant:'s2',lvl:1}], decos:{},
        bg:'auto', floor:'wood', bgOwned:['auto'], floorOwned:['wood'], skins:{}, skinOwned:[], seriesOwned:[], emojiDecos:[], layout:[],
        stock:{machine:{},prop:{},deco:{}}, lastT:null,
        // グループに入っているか（/api/state の me.hasGroup）。
        // false の間は ☰メニューからリーダーボードを隠す。既定は false ＝
        // 状態を取れていないうちは出さない（一瞬出てから消えるのを防ぐ）
        hasGroup:false };
/* =========================================================================
   NET — データ層。工場のデータはすべてサーバ(server/index.mjs)が持つ。
     ・💰 / 図鑑 / 在庫 / 製造 はサーバが唯一の真実。G はその写し
     ・製造判定はサーバ側(server/craft.mjs)。クライアントは結果を受け取るだけ
     ・購入・強化・素材セットは API を叩き、返ってきた factory で G を上書きする
   G をブラウザに保存することはない（ログインした本人の工場がサーバにある）。
   ========================================================================= */
export function ownedN(kind,variant){ return (G.stock[kind]&&G.stock[kind][variant])||0; }
export function availN(kind,variant){ return Math.max(0, ownedN(kind,variant) - placedCount(kind,variant)); }
// 設置済みは必ず所持(在庫)に含める(在庫 >= 設置数 を保証)
export function reconcileStock(){ const need={machine:{},prop:{},deco:{}};
  for(const e of (G.layout||[])) if(need[e.kind]) need[e.kind][e.variant]=(need[e.kind][e.variant]||0)+1;
  for(const k of ['machine','prop','deco']){ for(const s in need[k]) if((G.stock[k][s]||0)<need[k][s]) G.stock[k][s]=need[k][s]; } }
// 配置レイアウト(位置)の唯一の真実 = G.layout。シーンから同期。
export function snapLayout(){ if(window.__scene) G.layout=window.__scene.getLayout(); }
const placedCount=(kind,variant)=> (G.layout||[]).filter(e=>e.kind===kind&&(variant==null||e.variant===variant)).length;
// エージェント頭アクセ(スキン)の永続化: main.js からクリック巡回時に呼ばれる
export function craftState(){
  if(!G.craft||typeof G.craft!=='object') G.craft={};
  const c=G.craft;
  if(c.activeId===undefined) c.activeId=null;
  // collection = 図鑑（product_id → 所持数）。/api/collection の写し
  if(!c.collection||typeof c.collection!=='object') c.collection={};
  // 製造は機械ごとに独立。mach[id] = {running, wp}
  if(!c.mach||typeof c.mach!=='object') c.mach={};
  return c;
}
/* 機械1台ぶんの製造状態。WPは「稼働中に稼いだ分の累積」。
   稼いだWPは台数で按分せず、稼働中の全機械に同額を加算する。 */
export function machState(id){
  const c=craftState();
  if(!c.mach[id]||typeof c.mach[id]!=='object') c.mach[id]={running:false, wp:0};
  const st=c.mach[id];
  if(typeof st.wp!=='number'||!isFinite(st.wp)||st.wp<0) st.wp=0;
  st.running=!!st.running;
  return st;
}
// 一覧はマス数の昇順。番号は設置順で固定しておく（並べ替えても号機名が変わらないように）
export function machinesSorted(){
  const ms=machines(), no={}; ms.forEach((m,i)=>no[m.id]=i+1);
  return ms.slice().sort((a,b)=>(a.size-b.size)||(no[a.id]-no[b.id])).map(m=>({...m, no:no[m.id]}));
}
export function runningCount(){ return machines().filter(m=>machState(m.id).running).length; }
/* 製造は「1台の製造機」単位。その機械の各マス(2〜5)が原材料スロット。
   activeId = いま製造に使っている機械。未指定なら最初の1台。 */
export function machines(){ const s=window.__scene; return (s&&s.machineList)?s.machineList():[]; }
function activeMachine(){ const c=craftState(), ms=machines(); if(!ms.length) return null;
  return ms.find(m=>m.id===c.activeId) || ms[0]; }
function comboMats(){ const m=activeMachine(); return m ? m.slots.filter(Boolean) : []; }
function comboKey(){ return keyOfSlots(comboMats()); }
/* main.js が「この機械で何が作れるか」を描くために引く。レシピの正はこちら側。 */

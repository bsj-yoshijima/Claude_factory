/* データ層 — 工場のデータはすべてサーバが持つ。ここが唯一の出入口。 */
import { G, craftState, machines, snapLayout } from './state.mjs';
import { openDialog, toast } from './ui/dialog.mjs';

export const NET={
  last:null, collectionLoaded:false,
  rev:-1,          // いま手元にある工場の版番号。サーバはこれが一致すれば factory を省略する
  async probe(){
    try{
      const r=await fetch('/api/state',{cache:'no-store'});
      if(r.status===401){ location.href='/login'; return false; }
      if(!r.ok) return false;
      NET.last=await r.json(); return true;
    }catch(_){ return false; }
  },
  async call(method,path,body){
    try{
      const r=await fetch(path,{method,cache:'no-store',
        headers:body!==undefined?{'Content-Type':'application/json'}:undefined,
        body:body!==undefined?JSON.stringify(body):undefined});
      const j=await r.json().catch(()=>({}));
      if(!r.ok){ toast(j.error||`通信エラー (${r.status})`); return null; }
      return j;
    }catch(e){ toast('サーバに繋がりません'); return null; }
  },
};
/* サーバの factory を G に写す。UI 側のコードは G を読むだけなので変更不要 */
export function applyFactory(f){
  if(!f) return;
  if(typeof f.rev==='number') NET.rev=f.rev;
  G.money=f.money; G.bg=f.bg; G.floor=f.floor; G.factoryName=f.name||'';
  G.bgOwned=f.bgOwned||['auto']; G.floorOwned=f.floorOwned||['wood'];
  G.seriesOwned=f.seriesOwned||[]; G.stock=f.stock||{machine:{},prop:{},deco:{}};
  G.emojiDecos=f.emojiDecos||[];
  G.layout=[
    ...(f.machines||[]).map(m=>({id:m.id,kind:'machine',variant:m.variant,dir:m.dir,c:m.cx,r:m.cy,lvl:m.lvl,slots:m.slots})),
    ...(f.props||[]),
  ];
  const c=craftState(); c.mach={};
  for(const m of (f.machines||[])) c.mach[m.id]={running:!!m.running, wp:m.wp};
}
/* サーバへ配置を送る（在庫を超える設置はサーバが拒否する） */
let layoutT=null;
function pushLayout(){
  if(layoutT) clearTimeout(layoutT);
  layoutT=setTimeout(async ()=>{
    snapLayout();
    const ms=(G.layout||[]).filter(e=>e.kind==='machine')
      .map(e=>({id:e.id,variant:e.variant,dir:e.dir,cx:e.c,cy:e.r,lvl:e.lvl}));
    const props=(G.layout||[]).filter(e=>e.kind!=='machine');
    const r=await NET.call('PUT','/api/layout',{machines:ms,props});
    if(r&&r.factory) applyFactory(r.factory);
  },400);
}
/* 💰・在庫・図鑑はサーバが持っているので、保存すべきものは配置だけ */
export function saveGame(){ pushLayout(); }
/* 繋がらなければ工場が無いのと同じ。黙って空の工場を見せるより、理由を出して止める */
export async function loadGame(){
  if(!await NET.probe()){                             // 401 は probe が /login へ飛ばしている
    openDialog({ title:'⚠️ サーバに繋がりません',
      body:`<div class="rowline" style="font-size:12px;color:#9fb0c0">
        工場のデータはサーバにあります。サーバが起動しているか確かめて、読み込み直してください。</div>`,
      actions:[{label:'🔄 再読み込み',kind:'primary',on:()=>location.reload()}] });
    return false;
  }
  applyFactory(NET.last.factory);
  const d=await NET.call('GET','/api/collection');
  if(d){ const c=craftState();
    c.collection=Object.fromEntries(
      Object.entries(d.collection||{}).map(([k,v])=>[k,v.owned]));
    c.collectionMeta=d.collection||{}; NET.collectionLoaded=true; }
  const sk=await NET.call('GET','/api/skins'); if(sk) G.skins=sk.skins||{};
  return true;
}
/* 開発用の全解放（?unlockall）。所持品・在庫・💰の正はサーバなので、
   ここで G を書いても次のポーリングで消える。サーバに書かせて結果を受け取る。
   dev ログインのサーバ（＝Google SSO 未設定のローカル開発）でしかルートが無いので、
   本番相当の環境では 404 が返る。
   NET.call は 404 のとき素の "no route: …" を出してしまうので、ここは直に叩く。 */
export async function unlockAll(){
  let r;
  try{ r=await fetch('/api/dev/unlockall',{method:'POST',cache:'no-store'}); }
  catch(_){ toast('サーバに繋がりません'); return false; }
  if(r.status===404){ toast('このサーバでは ?unlockall は使えません（ローカル開発用の裏道です）'); return false; }
  const j=await r.json().catch(()=>({}));
  if(!r.ok){ toast(j.error||`全解放に失敗しました (${r.status})`); return false; }
  applyFactory(j.factory);
  const g=j.granted||{};
  toast(`✅ 全解放しました（💰${g.money} / 背景${g.bg} / 床${g.floor} / シリーズ${g.series} / 在庫各${g.stock}）`);
  return true;
}
// 在庫と配置数

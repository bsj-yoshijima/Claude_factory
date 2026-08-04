// game/main.js の配置/製造機ロジックを Phaser スタブ上で検証する(描画はしない)。実行: node test/test_machines.mjs
import fs from 'node:fs';
import vm from 'node:vm';

// 代入した値は控えて読み戻せる(ドラッグは obj._e / obj.x,y を読み書きするので素通しでは検証できない)
// メソッドは Phaser と同じく自分自身を返す(チェーンしても同じオブジェクトを指す)。
// setDepth/setCrop は引数を控える → 「帯ごとの深度」を検証できる。
const chain = () => { const store={};
  const p = new Proxy(function(){}, {
    get(t,k){
      if(Object.prototype.hasOwnProperty.call(store,k)) return store[k];
      if(k==='__store') return store;   // 「何が設定されたか」をテストから覗く口
      if(k==='setDepth') return (d)=>{ store.depth=d; return p; };
      if(k==='setCrop')  return (x,y,w,h)=>{ store.crop={x,y,width:w,height:h}; return p; };
      if(k==='texture') return {key:'stub', getSourceImage:()=>({width:64,height:64})};
      if(k==='displayWidth'||k==='displayHeight'||k==='x'||k==='y'||k==='width'||k==='height') return 32;
      if(k==='visible') return true;
      if(k==='destroy') return ()=>{};
      return (...a)=>p;
    },
    apply(){ return p; },
    set(t,k,v){ store[k]=v; return true; },
  });
  return p; };
const obj = () => { const o = chain(); return o; };

// 製造機スプライトは実物のPNGサイズを使う(帯の切り出し位置が絵の幅に依る)
const pngWH=(p)=>{ const b=fs.readFileSync(p); return { width:b.readUInt32BE(16), height:b.readUInt32BE(20) }; };   // IHDR
const MACH_PNG={};
for(const th of ['normal','arabia','diner','halloween','scifi']) for(const n of [2,3,4,5]){
  try{ MACH_PNG[`mach_${th}_s${n}`]=pngWH(new URL(`../assets/machines/mach-${th}-s${n}.png`, import.meta.url)); }catch(_){}
}
let machTexOn=true;            // false にすると手続き描画のフォールバックを通せる
const canvasTex={};            // addCanvas で焼いたテクスチャ(v向きの反転絵など)
const textures = {
  exists:(k)=>['dec_crate','dec_plant','m_red','m_blue','m_green','m_yellow','item_box','shadow','spark'].includes(k)
    || (machTexOn && !!MACH_PNG[k]) || !!canvasTex[k],
  remove(k){ delete canvasTex[k]; }, addCanvas(k,cv){ canvasTex[k]=cv; },
  get:(k)=>({ getSourceImage:()=> canvasTex[k] || MACH_PNG[k] || {width:64,height:64} }),
  // 土台の色は絵の下端から拾う。スタブでは常に不透明・単色として返す
  getPixelAlpha:()=>255, getPixel:()=>({red:0x2c,green:0x47,blue:0x40}) };

const Phaser = {
  AUTO:0, BlendModes:{ADD:1,NORMAL:0,MULTIPLY:2},
  Scale:{FIT:0,CENTER_BOTH:0},
  Math:{ Clamp:(v,a,b)=>Math.max(a,Math.min(b,v)) },
  Utils:{ Array:{ Shuffle:(a)=>a } },
  // ゴミ箱の矩形・製造機の掴み手(多角形)は実際に内外判定するのでちゃんと実装する
  Geom:{
    Rectangle: class { constructor(x,y,w,h){ this.x=x; this.y=y; this.width=w; this.height=h; }
      static Contains(rc,x,y){ return x>=rc.x && x<=rc.x+rc.width && y>=rc.y && y<=rc.y+rc.height; } },
    Polygon: class { constructor(flat){ this.points=[];
        for(let i=0;i+1<flat.length;i+=2) this.points.push({x:flat[i],y:flat[i+1]}); }
      static Contains(poly,x,y){ const p=poly.points; let inside=false;
        for(let i=0,j=p.length-1;i<p.length;j=i++)
          if((p[i].y>y)!==(p[j].y>y) && x < (p[j].x-p[i].x)*(y-p[i].y)/(p[j].y-p[i].y)+p[i].x) inside=!inside;
        return inside; } },
  },
  Curves:{ Path: class { constructor(){} lineTo(){} quadraticBezierTo(){} getPoint(){} } },
  Display:{ Color:{ IntegerToColor:()=>({r:1,g:1,b:1,color:0}), HexStringToColor:()=>({color:0}),
    Interpolate:{ ColorWithColor:()=>({r:1,g:1,b:1}) }, GetColor:()=>0xffffff } },
  Scene: class { constructor(){} },
  Game: class { constructor(cfg){ Phaser.__scene = cfg.scene[0]; } },
};

const grad = { addColorStop(){} };
const ctx2d = new Proxy({}, { get:(t,k)=> k==='createRadialGradient' ? ()=>grad : ()=>{}, set:()=>true });
const document = { createElement:()=>({ getContext:()=>ctx2d, width:0, height:0 }),
  getElementById:()=>null };
const location = { search:'' };
const window = {};

// 素材/レシピの正は factory-phaser.html 側。テストでは最小のスタブを噛ませる
window.__craft = { preview:(slots)=>{
  const set=[...new Set(slots.filter(Boolean))].sort().join(',');
  const T={ 'egg,flour,milk':{e:'🥞',n:'パンケーキ ほか4種'}, 'egg,milk,sugar':{e:'🍮',n:'プリン ほか4種'},
            'meat,rice':{e:'🍛',n:'カレー ほか4種'}, 'rice,veg':{e:'🍙',n:'おにぎり ほか4種'} };
  return T[set] || {e:'🪨', n:'謎のカタマリ', unknown:true}; } };
const sandbox = { Phaser, document, location, window, console, Math, Date, Set, Map, JSON, URLSearchParams,
  Object, Array, String, Number, parseInt, parseFloat, isNaN, fetch:async()=>{ throw new Error('offline'); },
  setTimeout, Proxy };
sandbox.window = window; sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(new URL('../game/main.js', import.meta.url)).toString(), sandbox);

const Main = Phaser.__scene;
const s = new Main();
// Scene の Phaser 提供メンバをスタブ
s.load = new Proxy({}, { get:()=>()=>{} });
s.add = new Proxy({}, { get:(t,k)=>()=>obj() });
s.textures = textures;
// 入力ハンドラは登録内容を控える(移動モードの床クリック/キー操作をテストから叩くため)
s.input = { _h:{}, on(ev,fn){ (this._h[ev]=this._h[ev]||[]).push(fn); }, setDraggable(){}, activePointer:null,
  keyboard:{ _h:{}, on(ev,fn){ (this._h[ev]=this._h[ev]||[]).push(fn); } } };
s.time = { addEvent(){} };
s.tweens = { add(){} };
// 投入口アンカーは実物を読ませる(帯の切り出しと素材アイコンの位置がこれに依る)
const machFitSrc=fs.readFileSync(new URL('../assets/machines/mach-fit.json', import.meta.url)).toString();
s.cache = { json:{ get:()=>({}) }, text:{ get:(k)=> k==='machfit'? machFitSrc : '{}' } };
s.poll = async()=>{};
s.createNightFx = function(){ this.windows=[]; this.uLen=0.55; this.sh=0.04;
  this.skyLayer=obj(); this.sun=obj(); this.sunG=obj(); this.moon=obj(); this.moonG=obj(); this.stars=[];
  this.shaftGfx=obj(); this.shaftOn=0; };
s.updateLighting = function(){};
s.drawShafts = function(){};
s.tintByLight = ()=>0xffffff;
s.preload(); s.create();

// ---- 検証 ----
let fail=0;
const ok=(cond,msg)=>{ console.log((cond?'  ok  ':'FAIL  ')+msg); if(!cond)fail++; };
const F=()=>window.__factory;
const machines=()=>s.placed.filter(e=>e.kind==='machine');
const at=(c,r)=>s.machineAtCell(c,r);

console.log('\n[1] コンベア/出荷口は廃止されている');
ok(s.placed.filter(e=>e.kind==='outlet').length===0, '出荷口が存在しない');
ok(typeof s.placeBelt==='undefined', 'placeBelt API が無い');
ok(typeof s.renderBelts==='undefined' && typeof s.canLayBelt==='undefined', 'コンベア関連メソッドが無い');
ok(s.addPlaced('belt',null,{cell:{c:2,r:2}})===null, "kind='belt' は設置できない");

console.log('\n[2] 製造機は 1〜5 マスを占有する');
s.buildLayout([]);
for(const n of [2,3,4,5]){
  const id=s.addPlaced('machine','s'+n,{cell:{c:1,r:n-2},dir:'u'});
  const e=s.placed.find(x=>x.id===id);
  ok(!!id && s.cellsOf(e).length===n, `s${n} は ${n} マス占有 → 実際 ${e?s.cellsOf(e).length:'-'}`);
}
ok(s.occ.size===2+3+4+5, `占有マス合計 14 → 実際 ${s.occ.size}`);
s.buildLayout([]);
const one=s.addPlaced('machine','s1',{cell:{c:1,r:1},dir:'u'});
ok(s.cellsOf(s.placed.find(x=>x.id===one)).length===2, '1マス機は廃止 → s1 指定でも2マスになる');

console.log('\n[3] 向き(dir)と重なり判定');
s.buildLayout([]);
const a3=s.addPlaced('machine','s3',{cell:{c:4,r:4},dir:'u'});
ok(!!a3, 'u向き 3マス機を (4,4) に設置');
ok(s.canPlace('machine',5,4,{variant:'s2'})===false, '占有中の (5,4) には置けない');
ok(s.canPlace('machine',4,5,{variant:'s3',dir:'u'})===true, '隣の行 (4,5) には置ける');
ok(s.canPlace('machine',10,4,{variant:'s3',dir:'u'})===false, '盤外にはみ出す配置は不可');
ok(s.addPlaced('machine','s2',{cell:{c:5,r:4},dir:'v',strict:true})===null, '重なる指定は strict で拒否');
ok(s.rotateMachine(a3)===true, '90°回転できる');
ok(s.placed.find(x=>x.id===a3).dir==='v', '回転後 dir=v');
ok(s.cellsOf(s.placed.find(x=>x.id===a3)).map(q=>q.r).join()==='4,5,6', 'v向きで r が伸びる');

console.log('\n[4] 1マスごとの素材設定');
s.buildLayout([]);
const m=s.addPlaced('machine','s3',{cell:{c:3,r:3},dir:'u'});
ok(s.getMachine(m).slots.length===3, 'スロットがマス数ぶん(3)ある');
ok(s.getMachine(m).product===null, '素材未設定なら作れる物は null');
ok(s.setSlot(m,0,'milk')===true, '1マス目に牛乳');
ok(s.setSlot(m,1,'egg')===true && s.setSlot(m,2,'flour')===true, '2/3マス目に卵・小麦粉');
ok(s.setSlot(m,3,'milk')===false, '存在しないスロットは拒否');
ok(s.setSlot(m,0,'nope')===false, '未定義の素材は拒否');
ok(s.getMachine(m).slots.join()==='milk,egg,flour', 'スロットの内容が保持される');

console.log('\n[5] 組合せで作れる物が変わる（順不同）');
ok(s.getMachine(m).product.e==='🥞', `牛乳+卵+小麦粉 → パンケーキ系 (${s.getMachine(m).product.e})`);
s.setSlot(m,0,'egg'); s.setSlot(m,1,'milk');
ok(s.getMachine(m).product.e==='🥞', '卵+牛乳+小麦粉 も同じ結果（順不同）');
s.setSlot(m,2,'meat');
ok(s.getMachine(m).product.unknown===true, `未知の組合せ → 謎のカタマリ`);
s.setSlot(m,0,null); s.setSlot(m,1,'rice'); s.setSlot(m,2,'veg');
ok(s.getMachine(m).product.e==='🍙', '米+野菜 = おにぎり系（空きスロットは無視）');
s.setSlot(m,0,'rice');
ok(s.getMachine(m).product.e==='🍙', '同じ素材の重複は1つとして数える');
s.setSlot(m,0,null); s.setSlot(m,1,null); s.setSlot(m,2,null);
ok(s.getMachine(m).product===null, '全部外すと未設定に戻る');

console.log('\n[6] マス数が多いほど作れる物が増える');
s.buildLayout([]);
const m5=s.addPlaced('machine','s5',{cell:{c:2,r:8},dir:'u'});
['rice','meat','veg','egg','cheese'].forEach((k,i)=>s.setSlot(m5,i,k));
ok(s.getMachine(m5).product!==null, '5マスぶんの素材を保持できる');
ok(s.getMachine(m5).slots.filter(Boolean).length===5, '5スロットすべてに素材が入る');

console.log('\n[7] 保存/復元（素材と向きが残る）');
const lay=s.getLayout();
ok(lay[0].slots && lay[0].dir, '保存データに slots と dir が入る');
s.buildLayout(lay);
const r5=s.placed.find(e=>e.kind==='machine');
ok(s.getMachine(r5.id).slots.join()==='rice,meat,veg,egg,cheese', '復元後も素材が残る');
ok(s.getMachine(r5.id).product!==null, '復元後も判定できる');
console.log('\n[8] 旧セーブの移行');
const dropped=s.buildLayout([
  {id:'b1',kind:'belt',c:10,r:5},{id:'b2',kind:'belt',c:9,r:5},{id:'o1',kind:'outlet',c:11,r:5},
  {id:'m1',kind:'machine',variant:'red',lvl:2,c:3,r:3},
]);
ok(dropped===3, `コンベア2+出荷口1=3件を破棄 → 実際 ${dropped}`);
ok(machines().length===1, '製造機だけ残る');
ok(machines()[0].variant==='s2', '旧4種(red)は最小の2マス機に読み替え');
ok(machines()[0].lvl===2, 'レベルは維持');
ok(s.getMachine(machines()[0].id).slots.length===2, 'スロットが2つ用意される');

console.log('\n[9] 撤去と占有の解放');
const before=s.occ.size;
s.removeItem(machines()[0].id);
ok(s.occ.size===before-2, '撤去で占有マス(2)が解放される');
ok(machines().length===0, '製造機が消える');
s.buildLayout([]);
const big=s.addPlaced('machine','s4',{cell:{c:1,r:1},dir:'u'});
ok(s.occ.size===4, '4マス機で occ が4');
s.removeItem(big);
ok(s.occ.size===0, '4マスぶんすべて解放される');

console.log('\n[10] スキン切替');
s.setPartsTheme('japan'); ok(s.partsSkin().top===0x7a5a38, 'japan → wood パレット');
s.setPartsTheme('scifi'); ok(s.partsSkin().top===0x232a52, 'scifi → neon パレット');
s.setPartsTheme(null);    ok(s.partsSkin().top===0x39424b, '未設定 → default パレット');

console.log('\n[11] 製造の進行は上流エンジン(tickCraft)が持つ');
ok(typeof s._produceUpdate==='undefined', 'main.js 側の二重生産ループは無い');
ok(typeof s.celebrate==='function', '完成演出 celebrate() を提供する');
ok(typeof s.machineList==='function', '製造UIへ machineList() を提供する');
ok(typeof s.refreshMachineBadges==='function', '上流UIが呼ぶ refreshMachineBadges() がある');
s.buildLayout([]); const mid=s.addPlaced('machine','s3',{cell:{c:5,r:5},dir:'u'}); s.setSlot(mid,0,'rice');
const ml=s.machineList();
ok(Array.isArray(ml)&&ml.length===1&&ml[0].slots.length===3, 'machineList() が slots つきで返る');
ok(ml[0].slots[0]==='rice' && ml[0].id===mid, 'machineList() の中身が正しい');

console.log('\n[12] 製造機の移動（掴んで置き直す）');
{
  const toasts=[]; let layoutN=0, opened=null;
  window.__toast=(t)=>toasts.push(String(t));
  window.__layoutChanged=()=>{ layoutN++; };
  window.__openMachine=(id)=>{ opened=id; };
  const pt=(c,r)=>sandbox.cellXY(c,r);                                     // マス中心の画面座標
  // クリック=押して離す。編集中の製造機はドラッグと区別するため「離した時点」で設定パネルが開く
  const click=(c,r)=>{ const p=pt(c,r);
    for(const fn of (s.input._h['pointerdown']||[])) fn(p,[]);
    for(const fn of (s.input._h['pointerup']||[])) fn(p); };
  const key=(n)=>{ for(const fn of (s.input.keyboard._h[n]||[])) fn(); };
  const cellOf=(id)=>{ const e=s.placed.find(x=>x.id===id); return e? e.cell.c+','+e.cell.r : '-'; };
  const dirOf=(id)=>{ const e=s.placed.find(x=>x.id===id); return e&&e.dir; };

  s.buildLayout([]); s.toggleEdit(false);
  const mv=s.addPlaced('machine','s3',{cell:{c:1,r:1},dir:'u'});
  const other=s.addPlaced('machine','s2',{cell:{c:5,r:5},dir:'u'});
  ok(typeof F().beginMoveMachine==='function' && typeof F().cancelMove==='function', '__factory に beginMoveMachine/cancelMove がある');
  ok(F().beginMoveMachine('nope')===false, '存在しないidでは移動モードに入らない');
  ok(F().beginMoveMachine(other+'x')===false, '製造機以外/不正なidも false');
  ok(F().beginMoveMachine(mv)===true, '移動モードに入る');
  ok(s.editMode===true, '編集モードでなければ自動でONになる');
  ok(F().isMoving()===true, '移動モード中である');

  ok(s.canPlace('machine',1,2,{variant:'s3',dir:'u',ignoreId:mv})===true, 'ignoreId で自分自身の占有は無視される');
  ok(s.canPlace('machine',1,1,{variant:'s3',dir:'u'})===false, 'ignoreId なしなら自分と重なって不可');

  toasts.length=0;
  click(5,5);   // 他の製造機の上 = 置けない
  ok(cellOf(mv)==='1,1', '重なる先をクリックしても移動しない');
  ok(F().isMoving()===true, '置けない先では移動モードを維持する');
  ok(toasts.some(t=>t.includes('置けません')), '置けないときはトーストで知らせる');
  ok(opened===null, '移動モード中は製造機をクリックしても設定パネルを開かない');

  const layout0=layoutN;
  click(8,2);   // 空きマス = 確定
  ok(cellOf(mv)==='8,2', `空きマスをクリックで移動できる → 実際 ${cellOf(mv)}`);
  ok(F().isMoving()===false, '確定すると移動モードを抜ける');
  ok(layoutN===layout0+1, '確定で __layoutChanged() が呼ばれる');
  ok(s.occ.has('8,2')&&s.occ.has('9,2')&&s.occ.has('10,2')&&!s.occ.has('1,1'), '占有マスが移動先へ移る');

  F().beginMoveMachine(mv); key('keydown-R');
  ok(dirOf(mv)==='v', '移動モード中の R キーで回転する');
  ok(s.cellsOf(s.placed.find(x=>x.id===mv)).map(q=>q.r).join()==='2,3,4', '回転後は v 方向に伸びる');
  key('keydown-R'); ok(dirOf(mv)==='u', 'もう一度 R で元の向きに戻る');

  click(8,2);   // 移動対象そのものをクリック = キャンセル
  ok(F().isMoving()===false, '対象の製造機をもう一度クリックでキャンセル');
  ok(cellOf(mv)==='8,2', 'キャンセルしても位置は元のまま');

  F().beginMoveMachine(mv); key('keydown-ESC');
  ok(F().isMoving()===false, 'Esc でキャンセルできる');
  ok(cellOf(mv)==='8,2', 'Esc でも位置は元のまま');

  F().beginMoveMachine(mv);
  ok(F().cancelMove()===true && F().isMoving()===false, 'cancelMove() で抜けられる');
  ok(F().cancelMove()===false, '移動中でなければ cancelMove() は false');

  F().beginMoveMachine(mv); s.toggleEdit(false);
  ok(F().isMoving()===false, '編集モードを抜けると移動モードも解除される');
  F().beginMoveMachine(mv); s.removeItem(mv);
  ok(F().isMoving()===false, '掴んでいた製造機を撤去したら移動モードも解除される');

  // 移動モードでなければ従来どおり製造機クリックで設定パネルが開く
  s.toggleEdit(true); opened=null; click(5,5);
  ok(opened===other, '移動モード外では製造機クリックで設定パネルが開く');
  s.toggleEdit(false); window.__toast=null; window.__layoutChanged=null; window.__openMachine=null;
}

console.log('\n[13] 製造機のドラッグ&ドロップ（他の設置物と同じ操作感）');
{
  const toasts=[]; let layoutN=0, opened=null;
  window.__toast=(t)=>toasts.push(String(t));
  window.__layoutChanged=()=>{ layoutN++; };
  window.__openMachine=(id)=>{ opened=id; };
  const pt=(c,r)=>sandbox.cellXY(c,r);                                     // マス中心の画面座標
  const hs=(ev)=>(s.input._h[ev]||[]);
  // Phaser の pointer は「押した位置」を downX/downY に持つ(dragstart は最初に動かした時点で飛ぶ)
  let dn={x:0,y:0};
  const P=(x,y)=>({x,y,downX:dn.x,downY:dn.y});
  const down=(x,y,over)=>{ dn={x,y}; for(const fn of hs('pointerdown')) fn(P(x,y), over||[]); };
  const up=(x,y)=>{ for(const fn of hs('pointerup')) fn(P(x,y)); };
  const dstart=(o,x,y)=>{ for(const fn of hs('dragstart')) fn(P(x,y),o); };
  const dmove =(o,x,y)=>{ for(const fn of hs('drag')) fn(P(x,y),o,x,y); };
  const dend  =(o,x,y)=>{ for(const fn of hs('dragend')) fn(P(x,y),o); };
  const ent=(id)=>s.placed.find(x=>x.id===id);
  const cellOf=(id)=>{ const e=ent(id); return e? e.cell.c+','+e.cell.r : '-'; };
  // 掴んで運んで離す(押下〜離すまで一式)。to は画面座標
  const drag=(id,to)=>{ const e=ent(id), a=pt(e.cell.c,e.cell.r), o=e.main;
    down(a.x,a.y); dstart(o,a.x,a.y); dmove(o,to.x,to.y); dend(o,to.x,to.y); up(to.x,to.y); };

  s.buildLayout([]); s.toggleEdit(true);
  const dm=s.addPlaced('machine','s3',{cell:{c:1,r:1},dir:'u'});
  const blk=s.addPlaced('machine','s2',{cell:{c:5,r:5},dir:'u'});
  const de=ent(dm);

  // -- 掴める(当たり判定) --
  ok(de.main && de.main._e===de, '製造機の main に掴み手(_e)がついている');
  const hit=s._machHit(de);
  ok(hit.points.length===6, '当たり判定は占有マス外周＋高さの6角形');
  const c0=pt(1,1), c2=pt(3,1);
  ok(Phaser.Geom.Polygon.Contains(hit,c0.x,c0.y), '先頭マスの中心を掴める');
  ok(Phaser.Geom.Polygon.Contains(hit,c2.x,c2.y), '3マス目(占有の端)の中心も掴める');
  ok(Phaser.Geom.Polygon.Contains(hit,c0.x,c0.y-de._hgt*0.6), '筐体の高さぶん(床の外)も掴める');
  ok(!Phaser.Geom.Polygon.Contains(hit,pt(8,8).x,pt(8,8).y), '離れたマスは掴めない');
  const hit2=s._machHit({kind:'machine',variant:'s2',dir:'u',cell:{c:5,r:5},_hgt:de._hgt});
  ok(!Phaser.Geom.Polygon.Contains(hit2,c0.x,c0.y), '別の製造機の当たり判定には入らない');

  // -- 置ける先へドラッグして移動 --
  const l0=layoutN;
  drag(dm, pt(8,2));
  ok(cellOf(dm)==='8,2', `空きマスへドラッグで移動できる → 実際 ${cellOf(dm)}`);
  ok(s.occ.has('8,2')&&s.occ.has('9,2')&&s.occ.has('10,2')&&!s.occ.has('1,1'), '占有マスが移動先へ移る');
  ok(layoutN===l0+1, 'ドロップで __layoutChanged() が呼ばれる');
  ok(opened===null, 'ドラッグしたときは設定パネルを開かない');

  // -- dragstart は「最初に動かした時点」で飛ぶ。起点が押した位置でないと落とし先がズレる --
  { const e=ent(dm), a=pt(e.cell.c,e.cell.r), b=pt(4,6), h={x:(a.x+b.x)/2, y:(a.y+b.y)/2};
    down(a.x,a.y); dstart(e.main,h.x,h.y); dmove(e.main,b.x,b.y); dend(e.main,b.x,b.y); up(b.x,b.y);
    ok(cellOf(dm)==='4,6', `途中から dragstart が飛んでも狙ったマスへ落ちる → 実際 ${cellOf(dm)}`); }
  drag(dm, pt(8,2)); ok(cellOf(dm)==='8,2', 'もう一度ドラッグして元のマスへ戻せる');

  // -- 置けない先はドロップしても元の位置 --
  toasts.length=0;
  const gx=ent(dm).objs[0].x, gy=ent(dm).objs[0].y;
  drag(dm, pt(5,5));   // blk と重なる
  ok(cellOf(dm)==='8,2', '置けない先へ落としても元の位置のまま');
  ok(toasts.some(t=>t.includes('置けません')), '置けないときはトーストで知らせる');
  ok(s.occ.has('8,2')&&s.occ.has('5,5'), '両方の占有マスが保たれる');
  { const o=ent(dm).objs[0]; ok(o.x===gx&&o.y===gy, '絵の座標も掴む前へ戻る');
    ok(ent(dm)._dbase==null, 'ドラッグの控えが残らない'); }

  // -- 盤外へはみ出す先も不可 --
  drag(dm, pt(11,7));
  ok(cellOf(dm)==='8,2', '3マスぶんが盤外へ出る先には置けない');

  // -- クリック(ほぼ動かない)なら設定パネル --
  opened=null;
  { const e=ent(dm), a=pt(e.cell.c,e.cell.r);
    down(a.x,a.y); dstart(e.main,a.x,a.y); dmove(e.main,a.x+3,a.y+2); dend(e.main,a.x+3,a.y+2); up(a.x+3,a.y+2);
    ok(opened===dm, 'しきい値以下の移動はクリック扱い → 設定パネルが開く');
    ok(cellOf(dm)==='8,2', 'クリック扱いのときは移動しない'); }
  opened=null; { const a=pt(5,5); down(a.x,a.y); up(a.x,a.y); }
  ok(opened===blk, 'ドラッグせずクリックしただけでも設定パネルが開く');

  // -- ゴミ箱へドロップで撤去 --
  opened=null; const l1=layoutN, tr=s._trashRect, tp={x:tr.x+tr.width/2, y:tr.y+tr.height/2};
  drag(dm, tp);
  ok(ent(dm)===undefined, 'ゴミ箱へドラッグすると撤去される');
  ok(!s.occ.has('8,2')&&!s.occ.has('9,2')&&!s.occ.has('10,2'), '撤去で占有マスが解放される');
  ok(layoutN===l1+1, '撤去でも __layoutChanged() が呼ばれる');
  ok(opened===null, '撤去したのに設定パネルは開かない');

  // -- 移動モード中はドラッグと干渉しない --
  const mm=s.addPlaced('machine','s2',{cell:{c:1,r:8},dir:'u'});
  F().beginMoveMachine(mm);
  { const e=ent(mm), a=pt(1,8), b=pt(8,8);
    dstart(e.main,a.x,a.y); dmove(e.main,b.x,b.y); dend(e.main,b.x,b.y);
    ok(cellOf(mm)==='1,8', '移動モード中はドラッグしても動かない');
    ok(s._mdrag==null, '移動モード中はドラッグ状態を作らない');
    ok(F().isMoving()===true, '移動モードは維持される'); }
  F().cancelMove();

  // -- 編集モード外ではドラッグしない --
  s.toggleEdit(false);
  { const e=ent(mm), a=pt(1,8), b=pt(6,8);
    dstart(e.main,a.x,a.y); dmove(e.main,b.x,b.y); dend(e.main,b.x,b.y);
    ok(cellOf(mm)==='1,8', '編集モード外ではドラッグで動かない'); }
  opened=null; { const a=pt(1,8); down(a.x,a.y); }
  ok(opened===mm, '編集モード外は押した時点で設定パネルが開く(従来どおり)');

  // -- 編集を抜けたらドラッグ中の見た目も戻る --
  s.toggleEdit(true);
  { const e=ent(mm), a=pt(1,8), b=pt(6,8), o=e.objs[0], ox=o.x, oy=o.y;
    down(a.x,a.y); dstart(e.main,a.x,a.y); dmove(e.main,b.x,b.y);
    ok(o.x!==ox, 'ドラッグ中は絵がカーソルについてくる');
    s.toggleEdit(false);
    ok(s._mdrag==null, '編集を抜けるとドラッグ状態が解除される');
    ok(o.x===ox&&o.y===oy, '絵の座標も元へ戻る'); }

  // -- prop/deco の従来のドラッグが壊れていない --
  s.buildLayout([]); s.toggleEdit(true);
  const dc=s.addPlaced('deco','crate',{cell:{c:2,r:2}});
  { const e=ent(dc), b=pt(7,3);
    ok(e.main._e===e, 'deco にも掴み手がついている');
    dmove(e.main,b.x,b.y); dend(e.main,b.x,b.y);
    ok(cellOf(dc)==='7,3', `deco をドラッグで移動できる → 実際 ${cellOf(dc)}`); }
  { const e=ent(dc), b=pt(7,3); dmove(e.main,b.x,b.y); dend(e.main,tp.x,tp.y);
    ok(ent(dc)===undefined, 'deco をゴミ箱へドラッグすると撤去される'); }
  const dc2=s.addPlaced('deco','crate',{cell:{c:2,r:2}});
  s.addPlaced('machine','s2',{cell:{c:9,r:9},dir:'u'});
  { const e=ent(dc2), b=pt(9,9); dmove(e.main,b.x,b.y); dend(e.main,b.x,b.y);
    ok(cellOf(dc2)==='2,2', 'deco は製造機の占有マスへは置けず元へ戻る'); }

  s.toggleEdit(false); window.__toast=null; window.__layoutChanged=null; window.__openMachine=null;
}

console.log('\n[14] main.js と UI モジュールの境界');
{ /* 以前は main.js と HTML の inline script が両方クラシックスクリプトで、同名の
     const/let/class/function があると SyntaxError で HTML 側が丸ごと実行されず
     UIが全部死んだ（それを機械的に検出していた）。
     いまは UI 側が ESM（game/app.mjs ほか）なのでスコープが分離され、
     この事故は構造的に起きない。代わりに次の2つを守る。
       ・HTML は器だけを持ち、動きは module から始まる
       ・main.js（クラシックのまま）から UI へ触るのは window.__* と morphInto だけ */
  const src=fs.readFileSync(new URL('../game/main.js', import.meta.url)).toString();
  const html=fs.readFileSync(new URL('../factory-phaser.html', import.meta.url)).toString();
  // UI 側の実体。app.mjs から芋づるで読まれるものも含めて game/**.mjs を全部見る
  const uiDir=new URL('../game/', import.meta.url);
  const uiFiles=[];
  (function walk(d){ for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const u=new URL(e.name+(e.isDirectory()?'/':''), d);
    if(e.isDirectory()) walk(u); else if(e.name.endsWith('.mjs')) uiFiles.push(fs.readFileSync(u).toString()); } })(uiDir);
  const ui=uiFiles.join('\n');

  ok(/<script type="module"[^>]*src="game\/app\.mjs"/.test(html) && !/<script>\s*\n\s*'use strict'/.test(html),
     'HTML は器だけで、動きは module（game/app.mjs）から始まる');
  ok(uiFiles.length>0, `UI モジュールを ${uiFiles.length} 本読んだ`);

  // main.js から UI へ触るのは window.__* と window.morphInto だけ、という約束
  const body=src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
  const viaWindow=[...body.matchAll(/window\.(__[A-Za-z]\w*|morphInto)/g)].map(m=>m[1]);
  ok(viaWindow.length>0, `main.js → UI は window 経由（${new Set(viaWindow).size} 種）`);

  // UI 側が公開している window の一覧に、main.js が使う名前が全部あるか
  const exposed=new Set([...ui.matchAll(/window\.(__[A-Za-z]\w*|morphInto)\s*=/g)].map(m=>m[1]));
  for(const m of ui.matchAll(/Object\.assign\(window,\s*\{([\s\S]*?)\}\)/g))
    for(const n of m[1].split(/[,\s]+/)) if(/^(__[A-Za-z]\w*|morphInto)$/.test(n)) exposed.add(n);
  // main.js 自身が定義して公開しているものは除く（__scene / __factory / __game など）
  const ownedByMain=new Set([...body.matchAll(/window\.(__[A-Za-z]\w*)\s*=/g)].map(m=>m[1]));
  const missing=[...new Set(viaWindow)].filter(n=>!exposed.has(n)&&!ownedByMain.has(n));
  ok(missing.length===0, `main.js が使う window の名前は全部 UI 側が公開している${missing.length?' → 未公開: '+missing.join(','):''}`);
}

console.log('\n[15] 製造機スプライトの1マス送り（tools/assets/cut_machines.py の成果物）');
{ // シートに描かれた台は そのまま切り取って使う（絵が無いサイズだけ2マス機から合成する）。
  // ゲームが必要とするのは「投入口 i がマス i の真上に来る」ことだけで、それは
  //   その絵の投入口の間隔 == ゲームの1マスの送り
  // に尽きる。切り出し側が実測した送りを mach-fit.json に書いているので、そこを検証する。
  //
  // 逆に「4サイズで絵の幅が1マスずつ増える」「投入口0番の位置が4サイズとも同じ」は
  // 合成していたときだけ成り立つ性質で、そのまま切り取りでは成り立たない（台ごとに
  // 別の絵で、装飾の張り出しも違う）。main.js は投入口の列を占有マスの中心に合わせ、
  // 縦は絵の下端を接地させるので、絵の外形が揃っていなくても位置は破綻しない。
  const pngSize=(p)=>{ const b=fs.readFileSync(p);
    return { w:b.readUInt32BE(16), h:b.readUInt32BE(20) }; };            // IHDR
  const dir=new URL('../assets/machines/', import.meta.url);
  const fit=JSON.parse(fs.readFileSync(new URL('mach-fit.json', dir)).toString());
  const src=fs.readFileSync(new URL('../game/main.js', import.meta.url)).toString();
  const [,W,H,GU] = src.match(/const W = (\d+), H = (\d+), GU = (\d+), GV = \d+/).map(Number);
  const iso = Object.fromEntries([...src.matchAll(/(ux|uy):\s*(-?[\d.]+)/g)].map(m=>[m[1],+m[2]]));
  // 絵は MACH_DRAW ぶん小さく焼いてある（描画時に縮めると NEAREST でドットが壊れる）
  const draw = +src.match(/const MACH_DRAW = ([\d.]+)/)[1];
  const stepX = Math.abs(iso.ux*W/GU)*draw;
  const themes=Object.keys(fit);
  ok(themes.length>0, `mach-fit.json にテーマがある (${themes.length}件)`);
  let offStep=[], offAnchor=[], missing=[], nDirect=0, nSynth=0, nModule=0;
  for(const th of themes) for(const n of ['2','3','4','5']){
    const a=fit[th][n];
    if(!a){ missing.push(`${th}/s${n}`); continue; }
    if(a.src==='module') nModule++; else if(a.src==='direct') nDirect++; else nSynth++;
    if(Math.abs(a.step-stepX)>0.05) offStep.push(`${th}/s${n}=${a.step}`);
    const s=pngSize(new URL(`mach-${th}-s${n}.png`, dir));
    // アンカー（投入口0番）は絵の内側にあること。外に出ていたら素材アイコンが宙に浮く
    if(!(a.ax>0.02 && a.ax<0.98 && a.ay>0.02 && a.ay<0.98)) offAnchor.push(`${th}/s${n}`);
    ok(s.w>0 && s.h>0, `${th}/s${n} のPNGがある (${s.w}x${s.h})`);
  }
  ok(missing.length===0, `全テーマ 2〜5マスの4サイズが揃っている${missing.length?' → 欠け: '+missing.join(', '):''}`);
  ok(offStep.length===0,
     `全サイズの1マス送りがゲームと一致 (目標 ${stepX.toFixed(3)}px)${offStep.length?' → ずれ: '+offStep.join(', '):''}`);
  ok(offAnchor.length===0,
     `投入口0番のアンカーが絵の内側にある${offAnchor.length?' → 外: '+offAnchor.join(', '):''}`);
  console.log(`  （1マスモジュールを並べて ${nModule}枚 / シートそのまま切取 ${nDirect}枚 / 合成 ${nSynth}枚）`);
}

console.log('\n[16] 製造機は「マスごとの深度」で描く（帯分割）');
{ // 深度が1つしか無いと、手前のマスに立ったキャラが機械の裏へ回ってしまう(既存バグ)。
  // 絵を1マスぶんの縦帯に切り、帯 i を「マス i の中心y」で描いていることを確かめる。
  const cxy=sandbox.cellXY;
  const depthsOf=(e)=>e.objs.map(o=>o.__store.depth).filter(d=>typeof d==='number');
  const bandsOf=(e)=>e.objs.filter(o=>o.__store.crop);
  const near=(a,b)=>Math.abs(a-b)<1e-6;
  for(const dir of ['u','v']){
    for(const th of [null,'halloween']){        // null=normal(アンカー無し) / halloween=アンカーあり
      s.setPartsTheme(th); s.buildLayout([]);
      const id=s.addPlaced('machine','s5',{cell:{c:2,r:3},dir});
      const e=s.placed.find(x=>x.id===id), cells=s.cellsOf(e), want=cells.map(q=>cxy(q.c,q.r).y);
      const tag=`${th||'normal'} dir=${dir}`;
      const bands=bandsOf(e);
      ok(bands.length===cells.length, `${tag}: 帯の数がマス数(5)と一致 → 実際 ${bands.length}`);
      ok(bands.every((b,i)=>near(b.__store.depth,want[i])),
         `${tag}: 各帯の depth が対応するマス中心の y と一致`);
      // 帯は絵を隙間なく分割する(継ぎ目に穴も重なりも出ない)
      const iw=MACH_PNG[`mach_${th||'normal'}_s5`].width;
      const seg=bands.map(b=>[b.__store.crop.x, b.__store.crop.x+b.__store.crop.width]).sort((a,b)=>a[0]-b[0]);
      ok(seg[0][0]===0 && seg[4][1]===iw, `${tag}: 両端の帯は絵の端まで伸びる (0..${iw})`);
      ok(seg.every((g,i)=>i===0||g[0]===seg[i-1][1]), `${tag}: 帯同士に隙間も重なりもない`);
      ok(seg.every(g=>g[1]-g[0]>0), `${tag}: 空の帯が無い`);
      // 土台・素材アイコンもそのマスの深度に置く
      const ds=depthsOf(e);
      ok(want.every(y=>ds.some(d=>near(d,y-0.3))), `${tag}: 土台もマスごとの深度`);
      ['milk','egg','flour','rice','meat'].forEach((m,i)=>s.setSlot(id,i,m));
      const e2=s.placed.find(x=>x.id===id), ds2=depthsOf(e2);
      ok(want.every(y=>ds2.some(d=>near(d,y+0.2))), `${tag}: 素材アイコンもマスごとの深度`);
      // 昔の「全部いちばん手前の角(C.y)で描く」に戻っていないこと
      const C=s._machFootprint(e2)[2];
      ok(bandsOf(e2).filter(b=>near(b.__store.depth,C.y)).length===0, `${tag}: 1枚岩の深度(C.y)は残っていない`);
      ok(e2._lit.length===5 && e2._lit.every(sp=>s.lit.some(x=>x.sp===sp)), `${tag}: 5枚とも採光tintの対象になる`);
      s.removeItem(id);
      ok(s.lit.length===0, `${tag}: 撤去で採光の登録も5枚ぶん外れる`);
    }
  }
  // 手続き描画のフォールバック(スプライトが無いテーマ)も同じくマスごとの深度
  machTexOn=false; s._machFit=null; s.setPartsTheme(null); s.buildLayout([]);
  for(const dir of ['u','v']){
    const id=s.addPlaced('machine','s4',{cell:{c:1,r:1},dir});
    const e=s.placed.find(x=>x.id===id), cells=s.cellsOf(e);
    ok(bandsOf(e).length===0, `手続き描画 dir=${dir}: スプライトを使っていない`);
    const ds=depthsOf(e);
    ok(cells.every(q=>ds.some(d=>near(d,cxy(q.c,q.r).y))), `手続き描画 dir=${dir}: 筐体もマスごとの深度`);
    ok(cells.length===4 && ds.filter(d=>cells.some(q=>near(d,cxy(q.c,q.r).y))).length===4,
       `手続き描画 dir=${dir}: マス数(4)ぶんの筐体に分かれている`);
    s.removeItem(id);
  }
  machTexOn=true; s._machFit=null; s.setPartsTheme(null); s.buildLayout([]);
}

/* ===== スプライトの長軸の向き =====
   ゲームは「素材は +u(右斜め下 ↘) の1種類だけ」を前提に、もう一方の対角を実行時に
   左右反転して使う(_machFlipTex)。逆向きの絵が混ざると、影・占有マス・素材アイコンは
   正しい向きに並ぶのに**本体の絵だけが直交した向きに見える**。
   絵は生成AI由来で、向きは何度も間違えられている所なので機械的に見張る。 */
console.log('\n=== 製造機スプライトの長軸 ===');
{
  const { report } = await import('../tools/assets/mach_axis.mjs');
  const rows = report();
  ok(rows.length > 0, `テーマの絵が見つかる (${rows.length}テーマ)`);
  const bad = rows.filter(r => r.axis === 'v');
  ok(bad.length === 0, bad.length
    ? `全テーマが +u(右斜め下) を向いている → 逆向き: ${bad.map(b => `${b.theme}(slope=${b.slope})`).join(', ')}。node tools/assets/mach_axis.mjs --fix で揃える`
    : `全${rows.length}テーマが +u(右斜め下) を向いている`);
  const undecided = rows.filter(r => r.axis === '?');
  ok(undecided.length === 0, undecided.length
    ? `長軸が判定できる絵になっている → 判定不能: ${undecided.map(u => u.theme).join(', ')}`
    : '全テーマで長軸が判定できる');
}

console.log(fail? `\n${fail} 件 FAIL` : '\nすべて通過');
process.exit(fail?1:0);

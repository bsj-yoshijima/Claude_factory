// game/main.js の配置/製造機ロジックを Phaser スタブ上で検証する(描画はしない)。実行: node tools/test_machines.mjs
import fs from 'node:fs';
import vm from 'node:vm';

const chain = () => new Proxy(function(){}, {
  get(t,k){
    if(k==='texture') return {key:'stub', getSourceImage:()=>({width:64,height:64})};
    if(k==='displayWidth'||k==='displayHeight'||k==='x'||k==='y'||k==='width'||k==='height') return 32;
    if(k==='visible') return true;
    if(k==='destroy') return ()=>{};
    return chain();
  },
  apply(){ return chain(); },
  set(){ return true; },
});
const obj = () => { const o = chain(); return o; };

const textures = { exists:(k)=>['dec_crate','dec_plant','m_red','m_blue','m_green','m_yellow','item_box','shadow','spark'].includes(k),
  remove(){}, addCanvas(){}, get:()=>({ getSourceImage:()=>({width:64,height:64}) }) };

const Phaser = {
  AUTO:0, BlendModes:{ADD:1,NORMAL:0,MULTIPLY:2},
  Scale:{FIT:0,CENTER_BOTH:0},
  Math:{ Clamp:(v,a,b)=>Math.max(a,Math.min(b,v)) },
  Utils:{ Array:{ Shuffle:(a)=>a } },
  Geom:{ Rectangle: class { constructor(){} static Contains(){ return false; } } },
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
s.input = { on(){}, setDraggable(){}, keyboard:{ on(){} } };
s.time = { addEvent(){} };
s.tweens = { add(){} };
s.cache = { json:{ get:()=>({}) } };
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
ok(s.canPlace('machine',5,4,{sub:'s2'})===false, '占有中の (5,4) には置けない');
ok(s.canPlace('machine',4,5,{sub:'s3',dir:'u'})===true, '隣の行 (4,5) には置ける');
ok(s.canPlace('machine',10,4,{sub:'s3',dir:'u'})===false, '盤外にはみ出す配置は不可');
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
ok(s.getMachine(m).product.n==='ケーキ', `牛乳+卵+小麦粉 = ケーキ → ${s.getMachine(m).product.n}`);
s.setSlot(m,0,'egg'); s.setSlot(m,1,'milk');
ok(s.getMachine(m).product.n==='ケーキ', '卵+牛乳+小麦粉 も同じケーキ（順不同）');
s.setSlot(m,2,'gelatin');
ok(s.getMachine(m).product.n==='謎の塊', `未知の組合せ → 謎の塊 → ${s.getMachine(m).product.n}`);
s.setSlot(m,0,null); s.setSlot(m,1,'berry'); s.setSlot(m,2,'gelatin');
ok(s.getMachine(m).product.n==='いちごゼリー', 'いちご+ゼラチン = いちごゼリー（空きスロットは無視）');
s.setSlot(m,0,'berry');
ok(s.getMachine(m).product.n==='いちごゼリー', '同じ素材の重複は1つとして数える');
s.setSlot(m,0,null); s.setSlot(m,1,null); s.setSlot(m,2,null);
ok(s.getMachine(m).product===null, '全部外すと未設定に戻る');

console.log('\n[6] マス数が多いほど作れる物が増える');
s.buildLayout([]);
const m5=s.addPlaced('machine','s5',{cell:{c:2,r:8},dir:'u'});
['rice','fish','nori','egg','gelatin'].forEach((k,i)=>s.setSlot(m5,i,k));
ok(s.getMachine(m5).product.n==='弁当', `5素材のレシピが成立 → ${s.getMachine(m5).product.n}`);
ok(F().recipeFor(['coffee','milk']).n==='カフェオレ', 'recipeFor をUIから直接引ける');

console.log('\n[7] 保存/復元（素材と向きが残る）');
const lay=s.getLayout();
ok(lay[0].slots && lay[0].dir, '保存データに slots と dir が入る');
s.buildLayout(lay);
const r5=s.placed.find(e=>e.kind==='machine');
ok(s.getMachine(r5.id).slots.join()==='rice,fish,nori,egg,gelatin', '復元後も素材が残る');
ok(s.getMachine(r5.id).product.n==='弁当', '復元後も同じ物が作れる');
console.log('\n[8] 旧セーブの移行');
const dropped=s.buildLayout([
  {id:'b1',kind:'belt',c:10,r:5},{id:'b2',kind:'belt',c:9,r:5},{id:'o1',kind:'outlet',c:11,r:5},
  {id:'m1',kind:'machine',sub:'red',lvl:2,c:3,r:3},
]);
ok(dropped===3, `コンベア2+出荷口1=3件を破棄 → 実際 ${dropped}`);
ok(machines().length===1, '製造機だけ残る');
ok(machines()[0].sub==='s2', '旧4種(red)は最小の2マス機に読み替え');
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

console.log('\n[11] 生産フック');
s.buildLayout([]);
const pm=s.addPlaced('machine','s2',{cell:{c:6,r:6},dir:'u'});
s.setSlot(pm,0,'coffee'); s.setSlot(pm,1,'milk');
let got=null; window.__onProduce=(p,mats)=>{ got={p,mats}; };
s._prodT=0; s._produceUpdate(999999);
ok(got && got.p.n==='カフェオレ', `__onProduce が完成品を通知 → ${got?got.p.n:'なし'}`);
ok(got && got.mats.join()==='coffee,milk', '使った素材も渡る');

console.log(fail? `\n${fail} 件 FAIL` : '\nすべて通過');
process.exit(fail?1:0);

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
s.cache = { json:{ get:()=>({}) }, text:{ get:()=>'{}' } };
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
  const click=(c,r)=>{ for(const fn of (s.input._h['pointerdown']||[])) fn(pt(c,r),[]); };
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

  ok(s.canPlace('machine',1,2,{sub:'s3',dir:'u',ignoreId:mv})===true, 'ignoreId で自分自身の占有は無視される');
  ok(s.canPlace('machine',1,1,{sub:'s3',dir:'u'})===false, 'ignoreId なしなら自分と重なって不可');

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

console.log('\n[13] グローバル名の衝突（main.js と factory-phaser.html）');
{ // クラシックスクリプト同士なので同名の const/let/class/function は SyntaxError になり
  // HTML のスクリプトが丸ごと実行されなくなる（= UIが全部死ぬ）。機械的に検出する。
  const src=fs.readFileSync(new URL('../game/main.js', import.meta.url)).toString();
  const html=fs.readFileSync(new URL('../factory-phaser.html', import.meta.url)).toString();
  const inline=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const tops=(code)=>{ const out=new Set(); let depth=0;
    for(const line of code.split('\n')){ const st=line.trim();
      if(depth===0){ let m;
        if((m=st.match(/^(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/))) out.add(m[1]);
        if((m=st.match(/^function\s+([A-Za-z_$][\w$]*)/))) out.add(m[1]);
        const d=st.match(/^(?:const|let|var)\s+(.*)$/);
        if(d) for(const mm of d[1].matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*=/g)) out.add(mm[1]);
      }
      depth += (line.split('{').length-1)-(line.split('}').length-1);
    } return out; };
  const a=tops(src), b=tops(inline);
  const dup=[...a].filter(x=>b.has(x));
  ok(dup.length===0, `グローバル名の衝突なし${dup.length?' → '+dup.join(','):''}`);
}

console.log(fail? `\n${fail} 件 FAIL` : '\nすべて通過');
process.exit(fail?1:0);

'use strict';
/* Claude Factory — Phaser 3 基盤
   1シーン統合(休憩室廃止) / 設置物セル占有＋BFS回避徘徊 / マスコット3ポーズ状態機械。
   追加: 接地影(背景に溶け込む), idle小ネタ(座り💤 / コーヒー☕ / 壁際にもたれる)。 */

const W = 1024, H = 572, GU = 12, GV = 12;
// ISO は背景 factory-room.png に「描かれた床タイル格子」(12x12)を画像から実測フィットした値。
// 旧値は床の縁(トリム)基準で、描き込みのタイル目地と半マス位相＋約5%ピッチがずれており、
// マス中心に置いた設置物が"目地の交差点"に乗って見えていた。GU/GV=12 は不変なので保存レイアウトは互換。
const ISO = { Bx:0.4930, By:0.3584, ux:0.3240, uy:0.3005, vx:-0.3281, vy:0.2864 };
const CELL = ( Math.hypot(ISO.ux*W/GU, ISO.uy*H/GU) + Math.hypot(ISO.vx*W/GV, ISO.vy*H/GV) ) / 2;
function isoToScreen(u,v){ return { x:(ISO.Bx+u*ISO.ux+v*ISO.vx)*W, y:(ISO.By+u*ISO.uy+v*ISO.vy)*H }; }
const OFF_U = 0, OFF_V = 0;
// オブジェクトは各マスの中心(c+0.5)/GU に置く。編集グリッド線はマス境界(c/GU)に引く→各オブジェクトが四角の中央に入る。
function cellXY(c,r){ return isoToScreen((c+0.5+OFF_U)/GU,(r+0.5+OFF_V)/GV); }   // c,r は連続値でも可
const ISO_DET = ISO.ux*ISO.vy - ISO.vx*ISO.uy;
function screenToIso(sx,sy){ const nx=sx/W-ISO.Bx, ny=sy/H-ISO.By;
  return { u:(nx*ISO.vy - ISO.vx*ny)/ISO_DET, v:(ISO.ux*ny - nx*ISO.uy)/ISO_DET }; }
function uvXY(u,v){ return { x:(ISO.Bx+u*ISO.ux+v*ISO.vx)*W, y:(ISO.By+u*ISO.uy+v*ISO.vy)*H }; }
const AU={x:ISO.ux*W/GU, y:ISO.uy*H/GU};   // 1セル u方向 の画面ベクトル
const AV={x:ISO.vx*W/GV, y:ISO.vy*H/GV};   // 1セル v方向 の画面ベクトル
const K = (c,r)=> c+','+r;
const DIRS4 = [[1,0],[-1,0],[0,1],[0,-1]];

/* ===== 製造機のスキン =====
   スキンは「テクスチャの命名規約 + パレット」の2段。
   1) テクスチャ mach_<theme>_body があればそれを使う（未整備）
   2) 無ければ手続き描画にフォールバックし、PART_SKIN_BY_THEME のパレットで色だけ替える
   → 新テーマは「PNGを置く」か「パレットを1行足す」だけで足りる(コード変更不要)。 */
const PART_PAL = {
  default:{ top:0x39424b, side:0x1b2026, edge:0x11151a, rim:0x6b7681, glow:0x7fe6ff },
  wood:   { top:0x7a5a38, side:0x3a2a18, edge:0x1e150c, rim:0xb8935a, glow:0xffd08a },
  aqua:   { top:0x246d76, side:0x0e3138, edge:0x061c21, rim:0x55b8bb, glow:0x9ff0e6 },
  neon:   { top:0x232a52, side:0x0c1226, edge:0x050813, rim:0x5566bb, glow:0x7fffd4 },
  brass:  { top:0x574029, side:0x241a0e, edge:0x120c05, rim:0xc09550, glow:0xffd27f },
  candy:  { top:0x7a3d5c, side:0x321528, edge:0x1a0a14, rim:0xdd85ac, glow:0xfff0a0 },
};
const PART_SKIN_BY_THEME = {
  japan:'wood', onsen:'wood', cabin:'wood', sushi:'wood', western:'wood', pirate:'wood', jungle:'wood', mushroom:'wood',
  undersea:'aqua', ice:'aqua', beehive:'brass', steampunk:'brass', dwarf:'brass', hell:'brass', egypt:'brass', china:'brass', arabia:'brass',
  scifi:'neon', space:'neon', circuit:'neon', tokyo:'neon', retrofuture:'neon', haunted:'neon',
  circus:'candy', carnival:'candy', christmas:'candy', halloween:'candy', diner:'candy', fantasy:'candy', desert:'candy', dino:'candy',
};
// 製造機の見た目(セル比)。inset=マス境界からの余白 / height=筐体の高さ / slot=スロット穴の大きさ
const MACH_GEO = { inset:0.10, height:0.42, slot:0.52 };
// 製造機のサイズ。sub('s2'..'s5') が在庫キー兼サイズ。1マス=スロット1つ。1マス機は廃止(最小2マス)。
const MACH_SIZES = [2,3,4,5];
const KINDS = ['machine','deco','prop','emoji','prize'];   // 設置できる種類（belt/outlet は廃止）
const MACH_MIN = 2;
const MACH_ART = ['normal','arabia'];   // スプライトを用意したテーマ(assets/mach-<theme>-s<N>.png)
const machSize = (sub)=> Math.min(5, Math.max(MACH_MIN, parseInt(String(sub||'').replace(/\D/g,''))||MACH_MIN));

/* ===== 素材とレシピ =====
   製造機の各マス(スロット)に素材を1つ設定する。1台に入っている素材の「集合」でできる物が変わる。
   ・順不同（牛乳→卵→小麦粉 と 卵→牛乳→小麦粉 は同じケーキ）。同じ素材の重複は1つとして数える。
   ・既知レシピに無い組合せ → 「謎の塊」。
   ・レシピ表は window.__factory.recipes で差し替え可能（組合せロジックは別担当に渡せる）。 */
const MATS = {
  milk:   {e:'🥛', n:'牛乳',      c:0xf2f0e6},
  egg:    {e:'🥚', n:'卵',        c:0xf5e6c8},
  flour:  {e:'🌾', n:'小麦粉',    c:0xe0c98a},
  sugar:  {e:'🍬', n:'砂糖',      c:0xf6dce8},
  berry:  {e:'🍓', n:'いちご',    c:0xe05a6a},
  cocoa:  {e:'🫘', n:'カカオ',    c:0x7a4a2a},
  gelatin:{e:'🧊', n:'ゼラチン',  c:0xbfe6ee},
  coffee: {e:'☕', n:'コーヒー豆', c:0x5a3a24},
  honey:  {e:'🍯', n:'はちみつ',  c:0xe8b13a},
  rice:   {e:'🍚', n:'米',        c:0xf0efe8},
  fish:   {e:'🐟', n:'魚',        c:0x6aa8d0},
  nori:   {e:'🍃', n:'海苔',      c:0x2f5a3a},
};
const RECIPES = [
  {k:['milk','egg','flour'],                    e:'🍰', n:'ケーキ'},
  {k:['milk','egg','flour','sugar'],            e:'🎂', n:'デコレーションケーキ'},
  {k:['milk','egg','flour','sugar','berry'],    e:'🥞', n:'ベリーパンケーキ'},
  {k:['berry','gelatin'],                       e:'🍮', n:'いちごゼリー'},
  {k:['milk','sugar','gelatin'],                e:'🍨', n:'パンナコッタ'},
  {k:['flour','sugar','cocoa'],                 e:'🍪', n:'ココアクッキー'},
  {k:['milk','sugar','cocoa'],                  e:'🍫', n:'ミルクチョコ'},
  {k:['coffee','milk'],                         e:'🥤', n:'カフェオレ'},
  {k:['coffee','milk','sugar','cocoa'],         e:'☕', n:'モカ'},
  {k:['honey','milk'],                          e:'🍼', n:'ハニーミルク'},
  {k:['honey','flour','egg'],                   e:'🍩', n:'ハニードーナツ'},
  {k:['rice','egg'],                            e:'🍳', n:'卵かけごはん'},
  {k:['rice','fish'],                           e:'🍣', n:'寿司'},
  {k:['rice','fish','nori'],                    e:'🍙', n:'手巻き'},
  {k:['fish','nori'],                           e:'🍥', n:'なると'},
  {k:['rice','fish','nori','egg','gelatin'],    e:'🍱', n:'弁当'},
];
const UNKNOWN_PRODUCT = {e:'🪨', n:'謎の塊', unknown:true};
const matKey = (list)=> Array.from(new Set(list.filter(Boolean))).sort().join('+');
/* スロットの素材配列 → 作れる物。1つも入っていなければ null(未設定)。 */
function recipeFor(slots){
  const key=matKey(slots||[]); if(!key) return null;
  const table=(window.__factory && window.__factory.recipes) || RECIPES;
  for(const r of table) if(matKey(r.k)===key) return r;
  return UNKNOWN_PRODUCT;
}

const INK = '#3b4643', EYE = '#241713';
const PRESETS = [
  {b:'#c15f3c',s:'#9d4527',l:'#d67e57'}, {b:'#4f7fc4',s:'#37588f',l:'#7ba3df'},
  {b:'#4fa564',s:'#367b47',l:'#7bc78d'}, {b:'#8a5fc0',s:'#623f90',l:'#ac86dc'},
  {b:'#e0b23a',s:'#ad8327',l:'#f2d06a'}, {b:'#d86a9c',s:'#a94773',l:'#f094bc'},
];
const MTOP = [3,2,1,1,0,0,1,2,3,3,2,1,0,0,1,1,2,3];
// スキン=被り物(帽子)のみ。ベースの手続きマスコット(26x28ドット,1ドット=DOTP px)はそのまま。
// 被り物テクスチャ hat_<id> を頭頂に載せる較正: 底辺中央を(HAT_CX, HAT_BASE_Y)ドットへ、幅をHAT_W_DOTに正規化。
const DOTP = 3, HAT_CX = 12.5, HAT_BASE_Y = 10.8, HAT_W_DOT = 19;
function makeMascot(scene, key, pal, pose){
  const P=3, w=26, h=28;
  const cv=document.createElement('canvas'); cv.width=w*P; cv.height=h*P;
  const g=cv.getContext('2d');
  const px=(x,y,c)=>{ g.fillStyle=c; g.fillRect(x*P,y*P,P,P); };
  const obox=(x,y,ww,hh,c)=>{ g.fillStyle=INK; g.fillRect(x*P,y*P,ww*P,hh*P); g.fillStyle=c; g.fillRect((x+1)*P,(y+1)*P,(ww-2)*P,(hh-2)*P); };
  const x0=4, bottomY = pose==='sit' ? 23 : 22, topBase=bottomY-14, bw=18, rows=bottomY-topBase+1;
  if(pose==='sit'){ obox(x0+2,bottomY-1,5,3,pal.s); obox(x0+11,bottomY-1,5,3,pal.s); }
  else { obox(x0+1,bottomY,3,4,pal.s); obox(x0+7,bottomY,3,4,pal.s); obox(x0+13,bottomY,3,4,pal.s); }
  if(pose==='work'){ obox(x0-2,topBase+2,3,6,pal.s); obox(x0+17,topBase+1,3,6,pal.s); }
  const isF=(i,r)=> i>=0&&i<bw&&r>=0&&r<rows&&r>=MTOP[i];
  for(let i=0;i<bw;i++) for(let r=0;r<rows;r++){
    if(!isF(i,r)) continue; const X=x0+i, Y=topBase+r;
    if(!isF(i-1,r)||!isF(i+1,r)||!isF(i,r-1)||!isF(i,r+1)){ px(X,Y,INK); continue; }
    let c=pal.b; if(i>=bw-5||r>=rows-2) c=pal.s; else if(r===MTOP[i]+1) c=pal.l; px(X,Y,c);
  }
  const ey=topBase+4; px(x0+5,ey,EYE); px(x0+6,ey,EYE); px(x0+11,ey,EYE); px(x0+12,ey,EYE);
  if(scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, cv);
}

// テーマ専用の部屋画像(Stitch製・壁/床/窓を焼き込み)。ここにあるテーマは背景ごと差し替える
const ROOM_TEX = { arabia:'room_arabia', undersea:'room_undersea', japan:'room_japan', china:'room_china',
  diner:'room_diner', fantasy:'room_fantasy', scifi:'room_scifi', cabin:'room_cabin', dino:'room_dino',
  haunted:'room_haunted', pirate:'room_pirate', circuit:'room_circuit', dwarf:'room_dwarf', hell:'room_hell', steampunk:'room_steampunk',
  retrofuture:'room_retrofuture', tokyo:'room_tokyo', halloween:'room_halloween', western:'room_western', sushi:'room_sushi', beehive:'room_beehive', circus:'room_circus', carnival:'room_carnival', desert:'room_desert', jungle:'room_jungle', egypt:'room_egypt', christmas:'room_christmas', space:'room_space', ice:'room_ice', mushroom:'room_mushroom', onsen:'room_onsen' };
// Stitch製 装飾プロップ。汎用12種 + テーマ別6種×5テーマ(部屋画像と同じアイソメ視点で生成)
const PROP_NAMES = ['vase','palm','rug','flantern','fountain','chest','cushion','bonsai','lantern','pedestal','flower','screen',
  'cir_popcorn','cir_ballstand','cir_trunks','cir_ringtoss','cir_cannon','cir_stool',                 // 🎪 サーカス
  'sus_lane','sus_oke','sus_tea','sus_sake','sus_neko','sus_netacase',                                // 🍣 回転寿司
  'wes_barreltable','wes_horseshoe','wes_wheel','wes_campfire','wes_cactus','wes_assay',              // 🤠 西部開拓
  'bee_combtable','bee_honeypots','bee_pollen','bee_candles','bee_throne','bee_frames',               // 🐝 ミツバチの巣
  'stm_boiler','stm_cogs','stm_console','stm_chair','stm_orrery','stm_coal'];                         // ⚙️ スチームパンク
// プロップが使う床のコマ数(=見た目の大きさ)。1コマだと潰れて読めない描き込みの多い物を 2/4 に上げる。
// 表示高 = 1.35*CELL*√コマ数（4コマなら縦横2倍 = 2x2マス相当）。未指定は1コマ。
// 素材PNGはこの表示サイズに合わせて縮小済み(tools/fit_props.py)。値を変えたら再実行が必要。
const PROP_SPAN = {
  sus_lane:4, sus_netacase:4, cir_popcorn:4, cir_cannon:4, wes_campfire:4, bee_throne:4, stm_boiler:4, stm_console:4,
  sus_tea:2, sus_sake:2, sus_oke:2, sus_neko:2, cir_trunks:2, cir_ringtoss:2, cir_ballstand:2,
  wes_barreltable:2, wes_horseshoe:2, wes_wheel:2, wes_assay:2,
  bee_combtable:2, bee_honeypots:2, bee_pollen:2, bee_candles:2, bee_frames:2,
  stm_chair:2, stm_cogs:2, stm_orrery:2,
};
const propSpan = (name)=> PROP_SPAN[name] || 1;
window.PROP_SPAN = PROP_SPAN;   // ショップ表示(factory-phaser.html)から参照
// エージェントのスキン(id=テーマキー・31種＋'none')。スキン=被り物(帽子)だけ。ベースのマスコットは常にそのまま、
// 頭上に被り物テクスチャ hat_<id>(形状指定でStitch生成→マゼンタ抜き)を1枚重ねる。定義のあるidだけ帽子が乗る。プロジェクト単位で永続化。
const SKINS = [
  {id:'none', n:'デフォルト'},
  {id:'arabia',n:'魔人'},{id:'undersea',n:'人魚'},{id:'japan',n:'侍'},{id:'china',n:'皇帝'},
  {id:'diner',n:'ウェイトレス'},{id:'fantasy',n:'魔法使い'},{id:'scifi',n:'宇宙人'},{id:'cabin',n:'きこり'},
  {id:'dino',n:'恐竜'},{id:'haunted',n:'ゴースト'},{id:'pirate',n:'海賊'},{id:'circuit',n:'レーサー'},
  {id:'dwarf',n:'ドワーフ'},{id:'hell',n:'デビル'},{id:'steampunk',n:'発明家'},{id:'retrofuture',n:'ネモ船長'},
  {id:'tokyo',n:'サイバー'},{id:'halloween',n:'吸血鬼'},{id:'western',n:'ガンマン'},{id:'sushi',n:'寿司職人'},
  {id:'beehive',n:'みつばち'},{id:'circus',n:'ピエロ'},{id:'carnival',n:'仮面'},{id:'desert',n:'遊牧民'},
  {id:'jungle',n:'探検家'},{id:'egypt',n:'ファラオ'},{id:'christmas',n:'サンタ'},{id:'space',n:'宇宙飛行士'},
  {id:'ice',n:'氷の女王'},{id:'mushroom',n:'妖精'},{id:'onsen',n:'湯上がり'},
];
const DECOR = ['crate','drum','plant','pallet','sign'];
// 製造機はショップ経済側(G.machines)が設置する。ここは無料の初期装飾のみ。
const DEMO = [
  {k:'dec_crate',c:2,r:8},{k:'dec_plant',c:1,r:10},
];

class Main extends Phaser.Scene {
  preload(){
    this.load.image('bg_room','assets/factory-room.png');   // ガラス透過(窓の後ろに空/月/太陽を置く)
    this.load.image('room_arabia','assets/room-arabia.png');   // Stitch製 テーマ部屋(壁/床/窓 焼き込み)
    this.load.image('room_undersea','assets/room-undersea.png');
    this.load.image('room_japan','assets/room-japan.png');
    this.load.image('room_china','assets/room-china.png');
    this.load.image('room_diner','assets/room-diner.png');
    this.load.image('room_fantasy','assets/room-fantasy.png');
    this.load.image('room_scifi','assets/room-scifi.png');
    this.load.image('room_cabin','assets/room-cabin.png');
    this.load.image('room_dino','assets/room-dino.png');
    for(const n of ['haunted','pirate','circuit','dwarf','hell','steampunk','retrofuture','tokyo','halloween','western','sushi','beehive','circus','carnival','desert','jungle','egypt','christmas','space','ice','mushroom','onsen']) this.load.image('room_'+n, `assets/room-${n}.png`);
    for(const n of PROP_NAMES) this.load.image('prop_'+n, `assets/prop_${n}.png`);
    for(const s of SKINS) if(s.id!=='none') this.load.image('hat_'+s.id, `assets/hat-${s.id}.png`);   // 被り物。未生成でもPhaserは欠損扱い→描画側でexistsチェック
    this.load.json('hatfit','assets/hat-fit.json');   // 被り物ごとのツバ中心(cx=幅比)。非対称な飾りでも頭の中心で被る
    for(const d of DECOR) this.load.image('dec_'+d, `assets/obj_${d}.png`);
    // 製造機スプライト(Stitch製)。命名規約 mach_<theme>_s<N>。無いテーマは normal → 手続き描画 の順にフォールバック
    for(const th of MACH_ART) for(const n of MACH_SIZES) this.load.image(`mach_${th}_s${n}`, `assets/mach-${th}-s${n}.png`);
    this.load.json('machfit','assets/mach-fit.json');   // 絵から実測したスロット中心(幅/高さ比)。素材アイコンを穴にぴったり載せる
  }
  create(){
    this.bgImg=this.add.image(0,0,'bg_room').setOrigin(0,0).setDisplaySize(W,H).setDepth(-1000);
    this._hourQ = new URLSearchParams(location.search).get('hour');
    this.lit=[];      // 位置ライティングで色付けする設置物 {sp,x,y}
    this.ambB=1; this.ambInt=0xefe9dd; this.lightOn=0;
    this._ambC=Phaser.Display.Color.IntegerToColor(0xefe9dd); this._shaftC=Phaser.Display.Color.IntegerToColor(0xfff3da);   // 配置時のtint用に早期初期化
    this.lights=[{x:0.40*W,y:0.30*H,r:235},{x:0.55*W,y:0.36*H,r:235},{x:0.69*W,y:0.30*H,r:235}]; // 天井ライト位置
    PRESETS.forEach((p,i)=>{ makeMascot(this,`m${i}_stand`,p,'stand'); makeMascot(this,`m${i}_work`,p,'work'); makeMascot(this,`m${i}_sit`,p,'sit'); });
    // 火花
    const sc=document.createElement('canvas'); sc.width=6; sc.height=6; const sg=sc.getContext('2d');
    sg.fillStyle='#fff'; sg.fillRect(2,0,2,6); sg.fillRect(0,2,6,2); this.textures.addCanvas('spark',sc);
    this.sparks=this.add.particles(0,0,'spark',{ lifespan:420, speedX:{min:-14,max:14}, speedY:{min:-34,max:-8},
      scale:{start:1.1,end:0}, alpha:{start:1,end:0}, tint:[0xffffff,0xfce87e,0xf08a68], quantity:1, frequency:-1, emitting:false });
    this.sparks.setDepth(5000);
    // 接地影テクスチャ(ソフト楕円)
    const shc=document.createElement('canvas'); shc.width=64; shc.height=32; const shg=shc.getContext('2d');
    const grd=shg.createRadialGradient(32,16,1,32,16,30); grd.addColorStop(0,'rgba(0,0,0,0.5)'); grd.addColorStop(1,'rgba(0,0,0,0)');
    shg.fillStyle=grd; shg.fillRect(0,0,64,32); this.textures.addCanvas('shadow',shc);

    this.occ=new Set(); this.machineCells=[]; this.placed=[]; this.editMode=false;
    this.partsTheme=null; this.placeDir='u';   // placeDir = 設置プレビューの向き(Rキーで切替)
    for(const o of DEMO) this.addPlaced('deco', o.k.replace('dec_',''), {cell:{c:o.c,r:o.r}, silent:true});
    this.setupEdit();
    this.createNightFx();
    this.updateLighting(); this.time.addEvent({delay:4000,loop:true,callback:()=>this.updateLighting()});
    // 床グリッド確認(?grid=1): 設置物が正しくセルに接地しているか検証
    if(new URLSearchParams(location.search).get('grid')==='1'){ const g=this.add.graphics().setDepth(8000); g.lineStyle(1,0x33ffcc,0.5);
      for(let c=0;c<=GU;c++){ const a=cellXY(c-0.5,-0.5), b=cellXY(c-0.5,GV-0.5); g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.strokePath(); }
      for(let r=0;r<=GV;r++){ const a=cellXY(-0.5,r-0.5), b=cellXY(GU-0.5,r-0.5); g.beginPath(); g.moveTo(a.x,a.y); g.lineTo(b.x,b.y); g.strokePath(); } }
    // 窓定義の確認(?win=1): 窓quad と 床への採光帯を描画
    if(new URLSearchParams(location.search).get('win')==='1'){ const g=this.add.graphics().setDepth(9500);
      for(const w of this.windows){ g.lineStyle(2,0xff3b5c,0.9); g.strokePoints(w.quad,true);
        const p1=uvXY(0,w.v0),p2=uvXY(0,w.v1),p3=uvXY(this.uLen,w.v1+this.sh),p4=uvXY(this.uLen,w.v0+this.sh);
        g.lineStyle(2,0x33ffcc,0.8); g.strokePoints([p1,p2,p3,p4],true); } }
    this.agents={}; this.hud=document.getElementById('hud');
    if(new URLSearchParams(location.search).get('edit')==='1') this.toggleEdit(true);   // 編集(グリッド/ドラッグ/ベルト矢印)
    this.input.keyboard.on('keydown-E', ()=>this.toggleEdit());
    window.__scene=this;
    // Scene↔UI ブリッジ(スキン選択画面が参照)
    window.__factory={
      getAgents:()=>Object.keys(this.agents).map(k=>{ const a=this.agents[k]; return {proj:a.proj, skinId:a.skinId||'none', working:!!a.busy, color:PRESETS[a.ci].b}; }),
      applySkin:(proj,skinId)=>this.applySkin(proj,skinId),
      skinList:SKINS,
      setPartsTheme:(t)=>this.setPartsTheme(t),   // 製造機のスキン(テーマ)切替
      // 製造機の素材スロット。UI(パレット/設定パネル)はここ越しにシーンを触る
      materials:MATS, recipes:RECIPES, machSizes:MACH_SIZES,
      getMachine:(id)=>this.getMachine(id),
      setSlot:(id,i,mat)=>this.setSlot(id,i,mat),
      rotateMachine:(id)=>this.rotateMachine(id),
      moveMachine:(id,c,r)=>this.moveItem(id,c,r),
      removeMachine:(id)=>this.removeItem(id),
      recipeFor:(slots)=>recipeFor(slots),
    };
    this.poll(); this.time.addEvent({delay:1500,loop:true,callback:()=>this.poll()});
  }
  /* ===== 配置レジストリ（位置指定・移動・撤去に対応。編集画面の土台） =====
     製造機だけが複数マス(1〜5)を占有する。占有マスは cellsOf() が唯一の定義。 */
  cellsOf(e){ if(e.kind!=='machine') return [e.cell];
    const n=machSize(e.sub), du=(e.dir==='v')?0:1, dv=(e.dir==='v')?1:0, out=[];
    for(let i=0;i<n;i++) out.push({c:e.cell.c+du*i, r:e.cell.r+dv*i});
    return out; }
  /* 製造機の占有マス群の外周(uv)。描画とヒット判定で共用 */
  _machFootprint(e){ const n=machSize(e.sub), IN=MACH_GEO.inset;
    const c0=e.cell.c, r0=e.cell.r, du=(e.dir==='v')?0:1, dv=(e.dir==='v')?1:0;
    const u0=(c0+IN)/GU, u1=(c0+du*(n-1)+1-IN)/GU, v0=(r0+IN)/GV, v1=(r0+dv*(n-1)+1-IN)/GV;
    return [uvXY(u0,v0), uvXY(u1,v0), uvXY(u1,v1), uvXY(u0,v1)];   // A(最奥) B C(最手前) D
  }
  _makeObjs(e){ const {c,r}=e.cell; const p=cellXY(c,r); const u=(c+0.5)/GU, v=(r+0.5)/GV;
    const tint=this.tintByLight(u,v); const objs=[]; let main=null; e._lit=null;
    if(e.kind==='machine'){
      this._makeMachine(e, objs); main=e.main;
      for(const q of this.cellsOf(e)) this.machineCells.push({c:q.c,r:q.r});
    } else if(e.kind==='deco'){
      const img=this.add.image(p.x,p.y,'dec_'+e.sub).setOrigin(0.5,1).setDepth(p.y); img.setScale(1.0*CELL/img.height).setTint(tint);
      const sh=this.add.image(p.x+CELL*0.2,p.y+CELL*0.1,'shadow').setDepth(p.y-0.5).setRotation(0.5).setDisplaySize(img.displayWidth*1.05,img.displayWidth*0.5).setAlpha(0.5);
      objs.push(sh,img); main=img; e._lit=img; this.lit.push({sp:img,u,v});
    } else if(e.kind==='prop'){
      const img=this.add.image(p.x,p.y,'prop_'+e.sub).setOrigin(0.5,1).setDepth(p.y); img.setScale(1.35*Math.sqrt(propSpan(e.sub))*CELL/img.height).setTint(tint);
      const sh=this.add.image(p.x+CELL*0.2,p.y+CELL*0.09,'shadow').setDepth(p.y-0.5).setRotation(0.5).setDisplaySize(img.displayWidth*1.0,img.displayWidth*0.46).setAlpha(0.5);
      objs.push(sh,img); main=img; e._lit=img; this.lit.push({sp:img,u,v});
    } else if(e.kind==='emoji'){
      const sh=this.add.image(p.x+CELL*0.16,p.y+CELL*0.05,'shadow').setDepth(p.y-0.6).setRotation(0.5).setDisplaySize(CELL*0.72,CELL*0.32).setAlpha(0.42);
      const t=this.add.text(p.x,p.y-CELL*0.12,e.sub,{fontSize:Math.round(CELL*1.05)+'px'}).setOrigin(0.5,1).setDepth(p.y);
      objs.push(sh,t); main=t;
    } else if(e.kind==='prize'){
      const col=Phaser.Display.Color.HexStringToColor(e.sub.color).color;
      const sh=this.add.image(p.x+CELL*0.16,p.y+CELL*0.06,'shadow').setDepth(p.y-0.6).setRotation(0.5).setDisplaySize(CELL*0.8,CELL*0.36).setAlpha(0.5);
      const gl=this.add.ellipse(p.x,p.y-2,CELL*0.95,CELL*0.5,col,0.5).setDepth(p.y-1).setBlendMode(Phaser.BlendModes.ADD);
      const base=this.add.rectangle(p.x,p.y-2,CELL*0.5,CELL*0.2,0x2b3138).setOrigin(0.5,1).setDepth(p.y); base.setStrokeStyle(1,0x14171c);
      const t=this.add.text(p.x,p.y-CELL*0.26,e.sub.e,{fontSize:Math.round(CELL*0.95)+'px'}).setOrigin(0.5,1).setDepth(p.y+0.1);
      objs.push(sh,gl,base,t); main=t;
    }
    if(e.kind!=='machine'){ e.objs=objs; e.main=main; }
    return e;
  }
  /* ---- 製造機の描画。スプライト(mach_<theme>_s<N>)があればそれ、無ければ手続きの筐体。
       どちらの場合も「1マス=スロット1つ」の位置は占有マスから計算するので、素材アイコンは必ずマスに乗る。 ---- */
  machTex(e){ const n=machSize(e.sub);
    for(const th of [this.partsTheme, 'normal']){ const k=`mach_${th}_s${n}`;
      if(th && this.textures.exists(k)) return {key:k, theme:th, n}; }
    return null; }
  /* 絵のスロット中心(幅/高さ比)。v向きは左右反転して描くので x も反転する */
  machSlotPts(tex, img, flip){
    const fit=((this.cache.json.get('machfit')||{})[tex.theme]||{})[String(tex.n)];
    if(!fit) return null;
    const L=img.x-img.displayWidth/2, T=img.y-img.displayHeight;
    return fit.map(([fx,fy])=>({ x:L+(flip?1-fx:fx)*img.displayWidth, y:T+fy*img.displayHeight })); }
  _makeMachine(e, objs){
    const sk=this.partsSkin();
    const [A,B,C,D]=this._machFootprint(e);
    const xs=[A.x,B.x,C.x,D.x], ys=[A.y,B.y,C.y,D.y];
    const bx0=Math.min(...xs), bx1=Math.max(...xs), by0=Math.min(...ys), by1=Math.max(...ys);
    const u=(e.cell.c+0.5)/GU, v=(e.cell.r+0.5)/GV, tint=this.tintByLight(u,v);
    const tex=this.machTex(e);
    const g=this.add.graphics().setDepth(C.y+0.1); objs.push(g); e._gfx=g;
    let HG, slotPts=null;   // 天面の高さ(px) / スロット中心(スプライトのときは絵から実測)
    if(tex){
      // 素材の footprint 幅はゲーム側の占有外周と一致するよう焼いてある(tools/cut_machines.py)
      const img=this.add.image((bx0+bx1)/2, by1, tex.key).setOrigin(0.5,1).setDepth(C.y).setTint(tint);
      img.setDisplaySize(bx1-bx0, img.height*(bx1-bx0)/img.width);
      if(e.dir==='v') img.setFlipX(true);   // 素材はu方向。v方向は左右反転で角度が合う
      objs.push(img); e._lit=img; this.lit.push({sp:img,u,v});
      HG = Math.max(2, img.displayHeight-(by1-by0));
      slotPts = this.machSlotPts(tex, img, e.dir==='v');
      const sh=this.add.image((bx0+bx1)/2+3, by1-2, 'shadow').setDepth(C.y-0.5)
        .setDisplaySize((bx1-bx0)*0.95,(by1-by0)*0.7).setAlpha(0.42); objs.push(sh);
    } else {
      HG = MACH_GEO.height*CELL;
      const up=(q)=>({x:q.x, y:q.y-HG});
      g.fillStyle(0x000000,0.34); g.fillPoints([A,B,C,D].map(q=>({x:q.x+3,y:q.y+3})),true);   // 接地影
      g.fillStyle(sk.side,1);                                                                 // 手前2面(側面)
      g.fillPoints([B,C,up(C),up(B)],true); g.fillPoints([D,C,up(C),up(D)],true);
      g.fillStyle(sk.top,1); g.fillPoints([A,B,C,D].map(up),true);                            // 天面
      g.lineStyle(2,sk.rim,0.95); g.strokePoints([A,B,C,D].map(up),true);                     // 天面の縁
      g.lineStyle(2,sk.edge,0.9);
      for(const q of [B,C,D]) g.lineBetween(q.x,q.y,q.x,q.y-HG);                              // 縦のエッジ
    }
    const up=(q)=>({x:q.x, y:q.y-HG});

    // スロット(1マス1つ)。素材が入っていれば素材色で光らせ、絵文字を天面に載せる
    e.slots = Array.isArray(e.slots) ? e.slots.slice(0, machSize(e.sub)) : [];
    while(e.slots.length < machSize(e.sub)) e.slots.push(null);
    e._slotObjs=[];
    const SL=MACH_GEO.slot;
    this.cellsOf(e).forEach((q,idx)=>{
      const mat=e.slots[idx], m=mat&&MATS[mat];
      const ctr = (slotPts && slotPts[idx]) || up(cellXY(q.c,q.r));   // 絵の実測位置 > 計算位置
      if(slotPts){ if(m){ g.fillStyle(m.c,0.5); g.fillEllipse(ctr.x,ctr.y,CELL*0.46,CELL*0.24);
                          g.lineStyle(1.5,sk.glow,0.85); g.strokeEllipse(ctr.x,ctr.y,CELL*0.46,CELL*0.24); } }
      else {   // 手続き描画: 穴そのものを描く
        const s0=uvXY((q.c+0.5-SL/2)/GU,(q.r+0.5-SL/2)/GV), s1=uvXY((q.c+0.5+SL/2)/GU,(q.r+0.5-SL/2)/GV);
        const s2=uvXY((q.c+0.5+SL/2)/GU,(q.r+0.5+SL/2)/GV), s3=uvXY((q.c+0.5-SL/2)/GU,(q.r+0.5+SL/2)/GV);
        const poly=[s0,s1,s2,s3].map(up);
        g.fillStyle(m?m.c:0x0d1116, m?0.85:0.6); g.fillPoints(poly,true);
        g.lineStyle(1.5, m?sk.glow:sk.edge, m?0.9:0.7); g.strokePoints(poly,true);
      }
      if(m){ const t=this.add.text(ctr.x,ctr.y-CELL*0.08,m.e,{fontSize:Math.round(CELL*0.5)+'px'}).setOrigin(0.5,0.5).setDepth(C.y+0.2+idx*0.01);
             objs.push(t); e._slotObjs.push(t); }
    });

    // 完成品の表示(筐体の上)。素材未設定なら出さない
    const prod=recipeFor(e.slots); e.product=prod;
    const mid={x:(bx0+bx1)/2, y:by0-HG};
    if(prod){
      const badge=this.add.text(mid.x, mid.y-CELL*0.30, prod.e, {fontSize:Math.round(CELL*0.8)+'px'}).setOrigin(0.5,1).setDepth(C.y+2);
      const nm=this.add.text(mid.x, mid.y-CELL*0.28, prod.n, {fontFamily:'monospace',fontSize:'10px',color:prod.unknown?'#d9b48a':'#eafff6'}).setOrigin(0.5,0).setDepth(C.y+2);
      nm.setShadow(0,1,'#000',3,true,true);
      objs.push(badge,nm); e._badge=badge;
    } else {
      const hint=this.add.text(mid.x, mid.y-CELL*0.1, '素材未設定', {fontFamily:'monospace',fontSize:'10px',color:'#93a39d'}).setOrigin(0.5,1).setDepth(C.y+2);
      hint.setShadow(0,1,'#000',3,true,true); objs.push(hint);
    }
    if(e.lvl>1){ const lv=this.add.text(bx0+6, by1-HG, `Lv${e.lvl}`, {fontFamily:'monospace',fontSize:'9px',color:'#9fb0c0'}).setOrigin(0,1).setDepth(C.y+2);
      lv.setShadow(0,1,'#000',3,true,true); objs.push(lv); }
    e.objs=objs; e.main=g;
  }
  partsSkin(){ const t=this.partsTheme||null;
    return Object.assign({theme:t}, PART_PAL[PART_SKIN_BY_THEME[t]||'default']); }
  /* パーツのテーマを切り替える(背景テーマに追従 / 単体でも呼べる) */
  setPartsTheme(theme){ if(this.partsTheme===theme) return; this.partsTheme=theme||null;
    for(const e of this.placed.slice()) if(e.kind==='machine') this._remake(e); }
  _remake(e){ this._detach(e); this._makeObjs(e); if(this.editMode) this._enableDrag(e); }

  /* ---- 占有・設置可否 ---- */
  _syncOcc(){ this.occ.clear(); for(const e of this.placed) for(const q of this.cellsOf(e)) this.occ.add(K(q.c,q.r)); }
  machineAtCell(c,r){ return this.placed.find(e=>e.kind==='machine' && this.cellsOf(e).some(q=>q.c===c&&q.r===r))||null; }
  entryAtCell(c,r){ return this.placed.find(e=>this.cellsOf(e).some(q=>q.c===c&&q.r===r))||null; }
  /* 仮の entry を作って占有マスを判定する(設置前チェック用) */
  canPlace(kind,c,r,opt){ opt=opt||{};
    if(kind!=='machine') return this.isFree(c,r);
    const probe={kind:'machine', sub:opt.sub||'s1', dir:opt.dir||'u', cell:{c,r}};
    const skip=opt.ignoreId||null;
    for(const q of this.cellsOf(probe)){
      if(q.c<0||q.r<0||q.c>=GU||q.r>=GV) return false;
      const at=this.entryAtCell(q.c,q.r); if(at && at.id!==skip) return false;
    }
    return true; }
  /* 位置未指定のときの落とし先(その向き・サイズで収まる空き) */
  autoCell(kind,opt){ if(kind!=='machine') return this.freeCell();
    for(const dir of [opt&&opt.dir||'u','u','v'])
      for(let r=1;r<GV-1;r++) for(let c=1;c<GU-1;c++)
        if(this.canPlace('machine',c,r,{sub:opt&&opt.sub,dir})){ if(opt) opt.dir=dir; return {c,r,dir}; }
    return null; }
  addPlaced(kind, sub, extra){ extra=extra||{};
    // 知らない kind(廃止した belt/outlet など)は絵の無い幽霊エントリになるので弾く
    if(KINDS.indexOf(kind)<0) return null;
    if(kind==='deco' && !this.textures.exists('dec_'+sub)) return null;
    if(kind==='machine') sub = 's'+machSize(sub);
    let dir = (kind==='machine') ? (extra.dir==='v'?'v':'u') : undefined;
    let cell=extra.cell||null;
    if(cell && !this.canPlace(kind,cell.c,cell.r,{sub,dir})) cell=null;
    if(!cell && extra.strict) return null;              // レイアウト復元: 勝手に別マスへ動かさない
    if(!cell){ const o={sub,dir}; cell=this.autoCell(kind,o); if(cell&&cell.dir) dir=cell.dir; }
    if(!cell) return null;
    const e={ id: extra.id||('o'+(this._oid=(this._oid||0)+1)), kind, sub, lvl:extra.lvl||1,
      cell:{c:cell.c,r:cell.r}, dir, slots:(kind==='machine'? (extra.slots||[]) : undefined) };
    this._makeObjs(e); this.placed.push(e); this._syncOcc();
    if(this.editMode) this._enableDrag(e);
    if(!extra.silent){ const p=cellXY(cell.c,cell.r); this._spawnPop(p.x,p.y); }
    return e.id;
  }
  _detach(e){ for(const o of e.objs) o.destroy();
    if(e._lit){ const i=this.lit.findIndex(x=>x.sp===e._lit); if(i>=0)this.lit.splice(i,1); }
    if(e.kind==='machine'){ for(const q of this.cellsOf(e)){
      const i=this.machineCells.findIndex(m=>m.c===q.c&&m.r===q.r); if(i>=0)this.machineCells.splice(i,1); } } }
  removeItem(id){ const i=this.placed.findIndex(x=>x.id===id); if(i<0) return false;
    this._detach(this.placed[i]); this.placed.splice(i,1); this.lastRemoved=1; this._syncOcc(); return true; }
  moveItem(id,c,r){ const e=this.placed.find(x=>x.id===id); if(!e)return false;
    if(!this.canPlace(e.kind,c,r,{sub:e.sub,dir:e.dir,ignoreId:id})) return false;
    this._detach(e); e.cell={c,r}; this._makeObjs(e); this._syncOcc();
    if(this.editMode) this._enableDrag(e); return true; }
  /* 製造機を90°回転(u軸⇔v軸)。回した先が空いていなければ何もしない */
  rotateMachine(id){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e) return false;
    const nd=(e.dir==='v')?'u':'v';
    if(!this.canPlace('machine',e.cell.c,e.cell.r,{sub:e.sub,dir:nd,ignoreId:id})) return false;
    this._detach(e); e.dir=nd; this._makeObjs(e); this._syncOcc();
    if(this.editMode) this._enableDrag(e); return true; }
  /* スロット i に素材をセット(null でクリア)。作れる物が即座に変わる */
  setSlot(id,i,mat){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e) return false;
    if(i<0||i>=machSize(e.sub)) return false;
    if(mat!=null && !MATS[mat]) return false;
    e.slots[i]=mat||null; this._remake(e);
    const p=cellXY(e.cell.c,e.cell.r); this._spawnPop(p.x,p.y); return true; }
  getMachine(id){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e) return null;
    return { id:e.id, size:machSize(e.sub), dir:e.dir, lvl:e.lvl, slots:e.slots.slice(),
      product:e.product?{e:e.product.e,n:e.product.n,unknown:!!e.product.unknown}:null }; }
  _snapBack(e){ const p=cellXY(e.cell.c,e.cell.r); if(e.main){ e.main.x=p.x; e.main.y=p.y; } }
  getLayout(){ return this.placed.map(e=>{ const o={id:e.id,kind:e.kind,sub:e.sub,lvl:e.lvl,c:e.cell.c,r:e.cell.r};
    if(e.kind==='machine'){ o.dir=e.dir; o.slots=e.slots.slice(); } return o; }); }
  /* 旧レイアウトの移行: コンベア/出荷口は廃止したので捨てる。旧4種の製造機(red等)は1マス機に読み替える。 */
  buildLayout(list){
    for(const e of this.placed.slice()){ this._detach(e); }
    this.placed=[]; this._syncOcc();
    let dropped=0;
    for(const it of (list||[])){
      if(it.kind==='belt'||it.kind==='outlet'){ dropped++; continue; }
      const sub=(it.kind==='machine') ? ('s'+machSize(it.sub)) : it.sub;
      this.addPlaced(it.kind, sub, {cell:{c:it.c,r:it.r}, lvl:it.lvl, id:it.id, dir:it.dir, slots:it.slots, silent:true});
    }
    this._oid=Math.max(0,...this.placed.map(e=>parseInt(String(e.id).replace(/\D/g,''))||0));
    return dropped; }
  setMachineLevel(id,lvl){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e)return; e.lvl=lvl; this._remake(e); }
  // 旧API互換（ショップ購入から呼ばれる）
  placeMachine(type){ return this.addPlaced('machine', type); }
  placeDeco(type){ return this.addPlaced('deco', type); }
  placeEmojiDeco(emoji){ return this.addPlaced('emoji', emoji); }
  placeProp(name){ if(!this.textures.exists('prop_'+name)) return null; return this.addPlaced('prop', name); }
  placePrize(emoji,color){ return this.addPlaced('prize', {e:emoji,color}); }
  /* ===== 生産: 素材が揃っている製造機が一定間隔で完成品をポンと出す ===== */
  _produceUpdate(time){
    const ms=this.placed.filter(e=>e.kind==='machine' && e.product);
    if(!ms.length) return;
    if(this._prodT && time-this._prodT < 2600) return; this._prodT=time;
    for(const e of ms){
      const [A,,C]=this._machFootprint(e);
      const x=(A.x+C.x)/2, y=(A.y+C.y)/2 - MACH_GEO.height*CELL;
      const t=this.add.text(x,y-CELL*0.4,e.product.e,{fontSize:Math.round(CELL*0.7)+'px'}).setOrigin(0.5,1).setDepth(C.y+3);
      this.tweens.add({targets:t, y:y-CELL*1.5, alpha:0, duration:1400, onComplete:()=>t.destroy()});
      this.produced=(this.produced||0)+1;
      if(window.__onProduce) window.__onProduce(e.product, e.slots.filter(Boolean));
    }
  }
  syncMachines(list){ for(const m of (list||[])) this.addPlaced('machine', 's'+machSize(m.type), {lvl:m.lvl||1}); }
  /* 設置時のポップ演出 */
  _spawnPop(x,y){ const g=this.add.circle(x,y-CELL*0.5,CELL*0.6,0xffe9a8,0.5).setDepth(9000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:g,scale:1.8,alpha:0,duration:420,onComplete:()=>g.destroy()}); }
  /* ===== 編集モード（グリッド表示・ドラッグ移動・ゴミ箱で撤去） ===== */
  setupEdit(){
    // 床ダイヤ[0,1]²を綺麗な12×12に等分する線だけを表示(中心点は出さない)。オブジェクトは各マスの中央に入る。
    this.editGrid=this.add.graphics().setDepth(-998).setVisible(false); this.editGrid.lineStyle(1,0x7fe6ff,0.42);
    const gl=(u0,v0,u1,v1)=>{ const a=uvXY(u0,v0),b=uvXY(u1,v1); this.editGrid.beginPath(); this.editGrid.moveTo(a.x,a.y); this.editGrid.lineTo(b.x,b.y); this.editGrid.strokePath(); };
    // 目地はマス境界(c/GU)に引く(13本) → 各マスの中心=設置点が四角のど真ん中になる
    for(let c=0;c<=GU;c++) gl(c/GU,0,c/GU,1);
    for(let r=0;r<=GV;r++) gl(0,r/GV,1,r/GV);
    // マスハイライト(設置先=緑/赤・設置済み=占有マス)。床の上・オブジェクトの下。オブジェクトが四角の中に入るのが見える。
    this.hoverGfx=this.add.graphics().setDepth(-1).setVisible(false);
    this.input.on('pointermove',(po)=>this._drawHover(po));
    this.trash=this.add.container(72,H-52,[ this.add.rectangle(0,0,124,72,0x3a1418,0.85).setStrokeStyle(2,0xe05a4e), this.add.text(0,0,'🗑 ここへ撤去',{fontSize:'13px',color:'#ffd0c8'}).setOrigin(0.5) ]).setDepth(8600).setVisible(false);
    this._trashRect=new Phaser.Geom.Rectangle(10,H-88,124,74);
    // 床クリック: 製造機の上なら設定パネル、空きマスならパレットで選択中のアイテムを設置
    this.input.on('pointerdown',(po,over)=>{ if(!this.editMode) return; if(over&&over.length) return;
      const uv=screenToIso(po.x,po.y);
      const c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
      const m=this.machineAtCell(c,r);
      if(m){ this._placedPtr=true; if(window.__openMachine) window.__openMachine(m.id); return; }   // 素材設定/回転/撤去
      const sel=window.__editSel; if(!sel) return;
      const opt=(sel.kind==='machine')?{sub:sel.sub,dir:this.placeDir||'u'}:null;
      if(!this.canPlace(sel.kind,c,r,opt)){ if(window.__toast) window.__toast(
        sel.kind==='machine' ? `そこには置けません（${machSize(sel.sub)}マスぶんの空きが必要）` : 'そこには置けません'); return; }
      this._placedPtr=true; if(window.__editPlaceAt) window.__editPlaceAt(c,r); });
    // 設置前の向き切替(Rキー)。製造機を選んでいるときだけ効く
    this.input.keyboard.on('keydown-R',()=>{ if(!this.editMode) return;
      this.placeDir=(this.placeDir==='v')?'u':'v';
      if(window.__toast) window.__toast('向き: '+(this.placeDir==='v'?'↙ 手前方向':'↘ 奥方向')); });
    this.input.on('drag',(po,obj,dx,dy)=>{ if(this.editMode&&obj._e){ obj.x=dx; obj.y=dy; } });
    this.input.on('dragend',(po,obj)=>{ if(!this.editMode||!obj._e)return; const e=obj._e;
      if(Phaser.Geom.Rectangle.Contains(this._trashRect,po.x,po.y)){
        this.removeItem(e.id); if(window.__layoutChanged)window.__layoutChanged(); return; }
      const uv=screenToIso(obj.x,obj.y); let c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
      if(!this.moveItem(e.id,c,r)) this._snapBack(e);
      if(window.__layoutChanged)window.__layoutChanged(); });
  }
  _enableDrag(e){ if(e.kind==='machine') return;   // 複数マス。移動/撤去はクリックで開く設定パネルから
    const m=e.main; if(!m)return; m._e=e; m.setInteractive({useHandCursor:true}); this.input.setDraggable(m,true); }
  _disableDrag(e){ const m=e.main; if(!m||e.kind==='machine')return; this.input.setDraggable(m,false); m.disableInteractive(); m._e=null; }
  _diamond(g,c,r){ const p0=uvXY(c/GU,r/GV),p1=uvXY((c+1)/GU,r/GV),p2=uvXY((c+1)/GU,(r+1)/GV),p3=uvXY(c/GU,(r+1)/GV);
    g.beginPath(); g.moveTo(p0.x,p0.y); g.lineTo(p1.x,p1.y); g.lineTo(p2.x,p2.y); g.lineTo(p3.x,p3.y); g.closePath(); }
  _drawHover(po){ const g=this.hoverGfx; if(!g)return;
    if(!this.editMode){ g.clear(); g.setVisible(false); return; }
    g.clear(); g.setVisible(true);
    g.fillStyle(0x7fe6ff,0.10);   // 設置済みマスをうっすら塗る(=各オブジェクトが入っている四角)
    for(const e of this.placed) for(const q of this.cellsOf(e)){ this._diamond(g,q.c,q.r); g.fillPath(); }
    const sel=window.__editSel;
    if(sel && po){ const uv=screenToIso(po.x,po.y);
      const c=Phaser.Math.Clamp(Math.floor(uv.u*GU),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV),0,GV-1);
      const opt=(sel.kind==='machine')?{sub:sel.sub,dir:this.placeDir||'u'}:null;
      const ok=this.canPlace(sel.kind,c,r,opt), col=ok?0x33ffcc:0xe0674e;
      // 製造機は占有する全マスをプレビュー(Rキーで向き切替)
      const cells=(sel.kind==='machine') ? this.cellsOf({kind:'machine',sub:sel.sub,dir:this.placeDir||'u',cell:{c,r}}) : [{c,r}];
      for(const q of cells){ if(q.c<0||q.r<0||q.c>=GU||q.r>=GV) continue;
        g.fillStyle(col,0.30); this._diamond(g,q.c,q.r); g.fillPath();
        g.lineStyle(2,col,0.95); this._diamond(g,q.c,q.r); g.strokePath(); } }
  }
  toggleEdit(on){ this.editMode=(on==null)?!this.editMode:!!on; this.editGrid.setVisible(this.editMode); this.trash.setVisible(this.editMode); if(this.hoverGfx){ this.hoverGfx.clear(); this.hoverGfx.setVisible(false); }
    for(const e of this.placed){ this.editMode?this._enableDrag(e):this._disableDrag(e); } return this.editMode; }
  /* 窓オブジェクトを座標で定義(左壁 u=0)。床エッジ uvXY(0,v) を基準に壁の高さ方向へ立ち上げる。
     光源(採光の床帯・月/星のマスク)はすべてこの窓定義から導出する。 */
  defineWindows(){
    this.winUp0=0; this.winUp1=248;                  // 床エッジからの立ち上げ(px)。ガラス全体を覆うよう広めに
    this.windows=[{v0:0.050,v1:0.226},{v0:0.364,v1:0.555},{v0:0.697,v1:0.891}];  // 背景のガラス透過から実測した3枚の窓(左壁沿い v 範囲)。ISO を床タイル基準に更新した際に再計算済み
    for(const w of this.windows){
      const b0=uvXY(0,w.v0), b1=uvXY(0,w.v1);
      w.quad=[{x:b0.x,y:b0.y-this.winUp0},{x:b1.x,y:b1.y-this.winUp0},{x:b1.x,y:b1.y-this.winUp1},{x:b0.x,y:b0.y-this.winUp1}];
      w.vc=(w.v0+w.v1)/2; w.hw=(w.v1-w.v0)/2*0.92;    // 採光帯の中心/半幅
    }
    // 空フィルは「左壁ガラス帯を丸ごと覆う1枚」。背景の透過ガラスがマスクするので枠ズレは原理的に出ない
    const s0=uvXY(0,-0.05), s1=uvXY(0,0.98);
    this.skyCover=[{x:s0.x,y:s0.y+22},{x:s1.x,y:s1.y+22},{x:s1.x,y:s1.y-300},{x:s0.x,y:s0.y-300}];
  }
  createNightFx(){
    this.defineWindows();
    // bg のガラスは透過。bg(-1000)の“後ろ”に 空/太陽/月/星 を置く → ガラス越しに見え、桟に隠れる
    this.skyLayer=this.add.graphics().setDepth(-1150);           // 窓の外の空
    const sw=this.windows[0], sx=(sw.quad[0].x+sw.quad[2].x)/2, syy=sw.quad[3].y+(sw.quad[0].y-sw.quad[3].y)*0.34;
    this.sunG=this.add.circle(sx,syy,42,0xffe08a).setDepth(-1110).setAlpha(0);   // 太陽(昼・奥の窓)
    this.sun =this.add.circle(sx,syy,18,0xfff2c0).setDepth(-1100).setAlpha(0);
    const mw=this.windows[2], mx=(mw.quad[0].x+mw.quad[2].x)/2, my=mw.quad[3].y+(mw.quad[0].y-mw.quad[3].y)*0.30;
    this.moonG=this.add.circle(mx,my,34,0xf6efcf).setDepth(-1110).setAlpha(0);   // 月(夜・前の窓)
    this.moon =this.add.circle(mx,my,15,0xfbf6df).setDepth(-1100).setAlpha(0);
    this.stars=[];
    for(const w of this.windows) for(let i=0;i<6;i++){ const t=0.12+Math.random()*0.76, uu=0.08+Math.random()*0.66;
      const bx=w.quad[0].x+(w.quad[1].x-w.quad[0].x)*t, by=w.quad[0].y+(w.quad[1].y-w.quad[0].y)*t;
      const s=this.add.circle(bx, by-(this.winUp1-this.winUp0)*uu, 1.5, 0xffffff).setDepth(-1120).setAlpha(0); s.ph=Math.random()*6.28; this.stars.push(s); }
    // 採光(床に落ちる光。窓の v範囲から導出)
    this.uLen=0.55; this.sh=0.04;
    this.shaftGfx=this.add.graphics().setDepth(-900).setBlendMode(Phaser.BlendModes.ADD);
    this.ambInt=0xffffff; this._ambC=Phaser.Display.Color.IntegerToColor(0xffffff);
    this._shaftC=Phaser.Display.Color.IntegerToColor(0xfff2d6); this.shaftOn=0;
  }
  /* 窓からの光が (u,v) に当たる量(0..1)。u=室内奥行き, v=左壁沿い */
  lightAt(u,v){
    let l=0; if(this.shaftOn>0 && u>=-0.03 && u<=this.uLen)
      for(const s of this.windows){ const vv=s.vc + this.sh*(u/this.uLen);
        if(Math.abs(v-vv)<s.hw) l=Math.max(l, this.shaftOn*(1-(u/this.uLen)*0.5)); }
    return Phaser.Math.Clamp(l,0,1);
  }
  tintByLight(u,v){ const l=this.lightAt(u,v);
    // ベース色: 採光(l)で窓色へ寄せる。lが無くても環境色
    let r,g,b;
    if(l<=0.01){ const a=this._ambC; r=a.r; g=a.g; b=a.b; }
    else { const c=Phaser.Display.Color.Interpolate.ColorWithColor(this._ambC,this._shaftC,100,Math.round(l*100)); r=c.r; g=c.g; b=c.b; }
    // 光源=窓(u=0=左上)。奥(uが大)ほど暗くして光源方向の陰影勾配を作る
    const shade=1 - Phaser.Math.Clamp(u,0,1)*0.16;
    return Phaser.Display.Color.GetColor(Math.round(r*shade),Math.round(g*shade),Math.round(b*shade)); }
  drawShafts(){ const g=this.shaftGfx; g.clear(); if(this.shaftOn<=0) return;
    const col=Phaser.Display.Color.GetColor(this._shaftC.r,this._shaftC.g,this._shaftC.b);
    for(const s of this.windows){
      const p1=uvXY(0.0,s.vc-s.hw), p2=uvXY(0.0,s.vc+s.hw), p3=uvXY(this.uLen,s.vc+s.hw+this.sh), p4=uvXY(this.uLen,s.vc-s.hw+this.sh);
      g.fillStyle(col, this.shaftOn*0.4); g.fillPoints([p1,p2,p3,p4],true);
      const q3=uvXY(this.uLen*0.5,s.vc+s.hw+this.sh*0.5), q4=uvXY(this.uLen*0.5,s.vc-s.hw+this.sh*0.5);
      g.fillStyle(col, this.shaftOn*0.3); g.fillPoints([p1,p2,q3,q4],true);   // 窓際を濃く
    }
  }
  updateLighting(){
    let hr;
    if(this._hourQ!=null && this._hourQ!=='') hr=parseFloat(this._hourQ);
    else { const n=new Date(), j=new Date(n.getTime()+n.getTimezoneOffset()*60000+9*3600000); hr=j.getHours()+j.getMinutes()/60; }
    // amb=背景に掛ける色(背景の見た目は維持)。objAmb=設置物の環境色(背景の淡い色調へ寄せて一体化)。shaftは全体に淡め。
    let amb=0xffffff, objAmb=0xefe9dd, ambB=1, shaftCol=0xfff3da, shaftOn=0, nf=0;
    if(hr>=8&&hr<16){ amb=0xffffff; objAmb=0xefe9dd; ambB=1; shaftCol=0xfff3da; shaftOn=0.16; }              // 昼
    else if(hr>=5&&hr<8){ amb=0xffe9cc; objAmb=0xf0dcc2; ambB=0.94; shaftCol=0xffdca6; shaftOn=0.15; nf=(hr<7?(7-hr)/2:0); } // 朝日
    else if(hr>=16&&hr<18.5){ amb=0xffce9e; objAmb=0xecc196; ambB=0.86; shaftCol=0xffb277; shaftOn=0.18; }   // 西日
    else if(hr>=18.5&&hr<20){ amb=0x8a7594; objAmb=0x83718c; ambB=0.62; shaftCol=0xbfb0d8; shaftOn=0.11; nf=(hr-18.5)/1.5; } // 薄暮
    else { amb=0x47597f; objAmb=0x4c5c7e; ambB=0.5; shaftCol=0xafc0e6; shaftOn=0.10; nf=1; }                 // 夜
    // 窓の外の空(時間帯) + 太陽/月/星（bgの後ろ・ガラス越し）
    let sky, dayF=0;
    if(hr>=8&&hr<16){ sky=0xaec6e6; dayF=1; }                                   // 昼(青空)
    else if(hr>=5&&hr<8){ sky=0xf0c79c; dayF=(hr-5)/3; }                        // 朝焼け
    else if(hr>=16&&hr<18.5){ sky=0xef8f56; dayF=Math.max(0,1-(hr-16)/2.5); }   // 夕焼け
    else if(hr>=18.5&&hr<20){ sky=0x3a3560; dayF=0; }                           // 薄暮
    else { sky=0x0c1430; dayF=0; }                                             // 夜空
    // 背景テーマ(ショップ購入)。'auto'/未設定は時刻連動。テーマ時は室内採光も揃える
    const TH={ blue:{amb:0xffffff,obj:0xefe9dd,shaft:0xfff3da,son:0.16,sky:0xaec6e6,day:1,nf:0},
      sunset:{amb:0xffce9e,obj:0xecc196,shaft:0xffb277,son:0.18,sky:0xef8f56,day:0.55,nf:0},
      night:{amb:0x47597f,obj:0x4c5c7e,shaft:0xafc0e6,son:0.10,sky:0x0c1430,day:0,nf:1},
      space:{amb:0x3a3f66,obj:0x40466e,shaft:0x8aa0d8,son:0.08,sky:0x0a0a22,day:0,nf:1},
      aurora:{amb:0x4a6a72,obj:0x4f6f74,shaft:0x9fe0c8,son:0.12,sky:0x123b3a,day:0,nf:1},
      arabia:{amb:0xecba70,obj:0xe8c79a,shaft:0xffcf94,son:0.18,sky:0xE8A15A,day:0.4,nf:0.2},   // 砂漠の夕(壁=テラコッタ)
      undersea:{amb:0x8fc2d2,obj:0x7fb3c6,shaft:0x9fe6f0,son:0.14,sky:0x1E6E7E,day:0,nf:0},      // 海中
      japan:{amb:0xffe6ea,obj:0xf0d8dc,shaft:0xffd0d8,son:0.14,sky:0xF6B5C0,day:0.5,nf:0},        // 桜の空
      china:{amb:0xffcf9e,obj:0xe8b58a,shaft:0xffcf8a,son:0.16,sky:0xC0342B,day:0.3,nf:0.3} };    // 紅い空
    const t=TH[this.skyTheme]; if(t){ amb=t.amb; objAmb=t.obj; shaftCol=t.shaft; shaftOn=t.son; sky=t.sky; dayF=t.day; nf=t.nf; }
    if(this.themedRoom){ amb=0xffffff; objAmb=0xf0e6d6; shaftOn=0; nf=0; dayF=0; }   // テーマ部屋画像はそのまま活かす(過剰な色掛け/採光を切る)
    this.ambInt=objAmb; this.ambB=ambB; this.shaftOn=shaftOn; this.lightOn=nf;
    this._ambC=Phaser.Display.Color.IntegerToColor(objAmb);
    this._shaftC=Phaser.Display.Color.IntegerToColor(shaftCol);
    this.bgImg.setTint(amb);
    this.drawShafts();
    for(const o of this.lit) o.sp.setTint(this.tintByLight(o.u,o.v));   // 設置物を採光で色付け
    if(this.skyLayer){ this.skyLayer.clear(); this.skyLayer.fillStyle(sky,1); this.skyLayer.fillPoints(this.skyCover,true); }
    if(this.sun){ this.sun.setAlpha(dayF); this.sunG.setAlpha(dayF*0.5); }
    if(this.moon){ this.moon.setAlpha(nf); this.moonG.setAlpha(nf*0.5); for(const s of this.stars) s.setAlpha(nf); }
  }
  /* テーマ部屋(画像ごと差し替え)。焼き込み済みなので動的な空/採光/床オーバーレイは切る */
  setRoom(key){ const tex=ROOM_TEX[key]; this.themedRoom=!!tex;
    this.setPartsTheme(tex?key:null);   // 部屋テーマに製造機のスキンを追従させる
    if(this.bgImg){ this.bgImg.setTexture(tex||'bg_room').setDisplaySize(W,H); }
    const vis=!this.themedRoom;
    if(this.skyLayer) this.skyLayer.setVisible(vis);
    if(this.sun){ this.sun.setVisible(vis); this.sunG.setVisible(vis); }
    if(this.moon){ this.moon.setVisible(vis); this.moonG.setVisible(vis); }
    for(const s of (this.stars||[])) s.setVisible(vis);
    if(this.themedRoom && this.floorGfx) this.floorGfx.clear();   // 床は部屋画像に含まれる
  }
  setSkyTheme(theme){
    if(ROOM_TEX[theme]){ this.skyTheme=null; this.setRoom(theme); this.updateLighting(); return; }
    this.setRoom(null); this.skyTheme=(theme&&theme!=='auto')?theme:null; this.updateLighting(); }
  setFloor(theme){ if(!this.floorGfx){ this.floorGfx=this.add.graphics().setDepth(-999); }
    const g=this.floorGfx; g.clear(); g.setBlendMode(Phaser.BlendModes.NORMAL);
    // シリーズ床材=不透明のタイル模様に描き替え(素材そのものを変える)
    const PAT={ sand:{a:0xd8b478,b:0xcaa45e,grout:0x8a5836,m1:0xE8C868,m2:0x9c6a40},        // アラビア(アラベスク)
      aqua:{a:0x64b3b3,b:0x53a0a5,grout:0x2c6c72,m1:0x9fe6d6,m2:0x347c80},                   // 海底
      tatami:{a:0xbcc386,b:0xaeb672,grout:0x7a6640,m1:0xd6dca4,m2:0x87764c},                 // 和(畳)
      redgold:{a:0xae322c,b:0x9a2824,grout:0x561411,m1:0xE8C468,m2:0x781c18} };              // 中華
    if(PAT[theme]){ this._patternFloor(PAT[theme]); return; }
    // 単色床材=従来の色掛け(MULTIPLY)
    g.setBlendMode(Phaser.BlendModes.MULTIPLY);
    const col={cool:0x9fb6d0, crimson:0xd9948a, forest:0x93c090, gold:0xe8cf8a, mono:0xc4c4c4}[theme];
    if(col==null) return;   // wood=素の床
    g.fillStyle(col,1); g.fillPoints([uvXY(0,0),uvXY(1,0),uvXY(1,1),uvXY(0,1)],true); }
  /* 床タイルを1枚ずつ不透明に描く(市松ベース＋同心ダイヤのモチーフ)。OFFで目地に整合 */
  _patternFloor(pal){ const g=this.floorGfx; const P=(u,v)=>uvXY(u,v);
    g.fillStyle(pal.b,1); g.fillPoints([P(0,0),P(1,0),P(1,1),P(0,1)],true);   // 全面ベース(端のスキマ対策)
    const mid=(p,q,t)=>({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
    for(let c=0;c<GU;c++) for(let r=0;r<GV;r++){
      const u0=(c+OFF_U)/GU,u1=(c+1+OFF_U)/GU,v0=(r+OFF_V)/GV,v1=(r+1+OFF_V)/GV;
      if(u0<-0.02||u1>1.02||v0<-0.02||v1>1.02) continue;
      const A=P(u0,v0),B=P(u1,v0),C=P(u1,v1),D=P(u0,v1), cen=P((u0+u1)/2,(v0+v1)/2);
      g.fillStyle(((c+r)&1)?pal.a:pal.b,1); g.fillPoints([A,B,C,D],true);
      g.lineStyle(1,pal.grout,0.6); g.strokePoints([A,B,C,D],true);
      const ins=(t)=>[mid(A,cen,t),mid(B,cen,t),mid(C,cen,t),mid(D,cen,t)];
      g.fillStyle(pal.m2,0.85); g.fillPoints(ins(0.30),true);   // 中ダイヤ
      g.fillStyle(pal.m1,0.95); g.fillPoints(ins(0.60),true);   // 芯ダイヤ(モチーフ)
    } }
  isFree(c,r){ return c>=0&&r>=0&&c<GU&&r<GV && !this.occ.has(K(c,r)); }
  freeCell(){ for(let i=0;i<50;i++){ const c=1+Math.floor(Math.random()*(GU-2)), r=1+Math.floor(Math.random()*(GV-2)); if(this.isFree(c,r)) return {c,r}; } return {c:1,r:1}; }
  freeCellIn(minr,maxr){ for(let i=0;i<40;i++){ const c=1+Math.floor(Math.random()*(GU-2)), r=minr+Math.floor(Math.random()*(maxr-minr+1)); if(this.isFree(c,r)) return {c,r}; } return null; }
  freeAdjacent(cell){ const dirs=[[1,0],[-1,0],[0,1],[0,-1]]; Phaser.Utils.Array.Shuffle(dirs);
    for(const [dc,dr] of dirs){ if(this.isFree(cell.c+dc,cell.r+dr)) return {c:cell.c+dc,r:cell.r+dr}; } return this.freeCell(); }
  bfs(from,to){ if(from.c===to.c&&from.r===to.r) return [];
    const prev={}; prev[K(from.c,from.r)]=null; const q=[from];
    while(q.length){ const cur=q.shift();
      for(const [dc,dr] of [[1,0],[-1,0],[0,1],[0,-1]]){ const nc=cur.c+dc,nr=cur.r+dr,kk=K(nc,nr);
        if(!this.isFree(nc,nr)||kk in prev) continue; prev[kk]={c:cur.c,r:cur.r};
        if(nc===to.c&&nr===to.r){ const path=[]; let n={c:nc,r:nr}; while(n){ path.unshift(n); n=prev[K(n.c,n.r)]; } path.shift(); return path; }
        q.push({c:nc,r:nr}); } }
    return null; }
  clearDeco(a){ if(a.z){a.z.destroy();a.z=null;} if(a.cup){a.cup.destroy();a.cup=null;} }
  /* ベースは常に手続きマスコット m{ci}_{pose}。被り物 hat_<id> があれば頭上にオーバーレイ層 a.hat を重ねる
     (幅を頭幅に正規化, 底辺中央を頭頂へ)。位置/反転/採光は update 側で毎フレーム同期。座り時は頭が1ドット下がる。 */
  setPose(a, pose){
    a.sp.setTexture(`m${a.ci}_${pose}`).setScale(a.scl);
    a.hatBaseY = HAT_BASE_Y + (pose==='sit'?1:0);
    const has = a.skinId && a.skinId!=='none' && this.textures.exists('hat_'+a.skinId);
    if(has){
      if(!a.hat){ a.hat=this.add.sprite(a.sp.x,a.sp.y,'hat_'+a.skinId); }
      else if(a.hat.texture.key!=='hat_'+a.skinId){ a.hat.setTexture('hat_'+a.skinId); }
      const hf=(this.cache.json.get('hatfit')||{})[a.skinId];
      a.hat.setOrigin(hf&&typeof hf.cx==='number'?hf.cx:0.5, 1);   // ツバ中心=頭に載る中心。飾りが非対称でも中央に被る
      const nw=a.hat.texture.getSourceImage().width;
      a.hat.setScale((HAT_W_DOT*DOTP*a.scl)/nw).setVisible(true);
    } else if(a.hat){ a.hat.setVisible(false); }
  }
  /* スキン適用: 該当プロジェクトの全エージェント + this.skins マップ更新 + 既存の保存フックで永続化 */
  applySkin(proj, skinId){ if(!proj)return; this.skins=this.skins||{};
    if(skinId==='none') delete this.skins[proj]; else this.skins[proj]=skinId;
    for(const k in this.agents){ const a=this.agents[k]; if(a.proj===proj){ a.skinId=skinId; this.setPose(a,'stand'); } }
    if(window.__skinChanged) window.__skinChanged(proj, skinId); }
  /* ロード時の一括反映(プロジェクト→skinId マップ) */
  applySkins(map){ this.skins=map||{}; for(const k in this.agents){ const a=this.agents[k]; a.skinId=this.skins[a.proj]||'none'; this.setPose(a,'stand'); } }
  decide(a){
    this.clearDeco(a);
    if(a.busy && this.machineCells.length && Math.random()<0.75){
      const m=this.machineCells[Math.floor(Math.random()*this.machineCells.length)];
      const spot=this.freeAdjacent(m); a.path=this.bfs(a.cell,spot)||[]; a.after={state:'work',face:m,dur:150+Math.random()*180};
    } else if(a.busy){
      const spot=this.freeCell(); a.path=this.bfs(a.cell,spot)||[]; a.after={state:'idle',dur:90+Math.random()*90};
    } else {
      const rt=['sit','coffee','lean'][Math.floor(Math.random()*3)];
      const spot=(rt==='lean' ? (this.freeCellIn(1,2)||this.freeCell()) : this.freeCell());
      a.path=this.bfs(a.cell,spot)||[]; a.after={state:'rest',dur:220+Math.random()*260,restType:rt};
    }
  }
  async poll(){
    let d=null; try{ const r=await fetch('/api/sessions',{cache:'no-store'}); d=await r.json(); }catch(_){}
    if(!d) d={workers:[{sessionId:'d1',project:'eventos-api',working:true},{sessionId:'d2',project:'metabase',working:true},{sessionId:'d3',project:'olc-fw',working:true},{sessionId:'d4',project:'checkin',working:false},{sessionId:'d5',project:'seed',working:false},{sessionId:'d6',project:'news',working:false}]};
    const present=new Set(); let busyN=0,idleN=0;
    (d.workers||[]).forEach((w,idx)=>{
      const key=String(w.sessionId||w.pid||idx); present.add(key); w.working?busyN++:idleN++;
      if(!this.agents[key]){
        const cell=this.freeCell(); const p=cellXY(cell.c,cell.r); const ci=Object.keys(this.agents).length%PRESETS.length;
        const s=1.5*CELL/(28*3);
        const shadow=this.add.image(p.x,p.y,'shadow').setDisplaySize(CELL*0.95,CELL*0.42).setAlpha(0.48).setRotation(0.5);
        const sp=this.add.sprite(p.x,p.y,`m${ci}_stand`).setOrigin(0.5,1).setScale(s);
        const lbl=this.add.text(p.x,p.y-30,w.project||'',{fontFamily:'monospace',fontSize:'11px',color:'#eafff6'}).setOrigin(0.5,1).setVisible(false);   // 名前は画面左の凡例に表示(頭上ラベルは非表示)
        lbl.setShadow(0,1,'#000',3,true,true);
        this.agents[key]={sp,lbl,shadow,ci,cell,px:p.x,py:p.y,path:[],state:'walk',after:null,timer:0,face:1,busy:w.working,restType:'sit',z:null,cup:null,scl:s,
          hat:null, hatBaseY:HAT_BASE_Y, proj:w.project||'', skinId:(this.skins&&this.skins[w.project])||'none'};
        this.setPose(this.agents[key],'stand');   // スキン適用済みなら即テクスチャ反映
        this.decide(this.agents[key]);
      } else this.agents[key].busy=w.working;
    });
    for(const k of Object.keys(this.agents)){ if(!present.has(k)){ const a=this.agents[k]; this.clearDeco(a); a.sp.destroy(); if(a.hat)a.hat.destroy(); a.lbl.destroy(); a.shadow.destroy(); delete this.agents[k]; } }
    this.busyCount=busyN;
    if(this.hud) this.hud.innerHTML=`稼働 <b>${busyN}</b> ・ 休憩 ${idleN} ・ Phaser基盤`;
  }
  update(time){
    // 星のまたたき(夜)
    if(this.stars && this.lightOn>0){ for(const s of this.stars) s.setAlpha(this.lightOn*(0.35+0.65*Math.abs(Math.sin(time*0.002+s.ph)))); }
    this._produceUpdate(time);   // 素材が揃っている製造機が完成品をポンと出す
    const SPD=1.7;
    for(const k of Object.keys(this.agents)){
      const a=this.agents[k];
      if(a.path && a.path.length){
        const w0=a.path[0], t=cellXY(w0.c,w0.r);
        const dx=t.x-a.px, dy=t.y-a.py, dist=Math.hypot(dx,dy);
        if(dist<2){ a.cell=w0; a.path.shift(); } else { a.px+=dx/dist*SPD; a.py+=dy/dist*SPD; a.face=dx<0?-1:1; }
        a.state='walk'; this.setPose(a,'stand');
        a.sp.x=a.px; a.sp.y=a.py - Math.abs(Math.sin(time*0.012))*3;
      } else if(a.after){
        a.state=a.after.state; a.timer=a.after.dur; a.restType=a.after.restType||a.restType;
        if(a.after.face) a.face=(cellXY(a.after.face.c,a.after.face.r).x < a.px)?-1:1;
        a.after=null;
      } else if(a.timer>0){
        a.timer--; a.sp.x=a.px; a.sp.y=a.py;
        if(a.state==='work'){
          const sw=(Math.floor(time*0.012)%2===0); this.setPose(a,sw?'work':'stand'); a.sp.y=a.py-(sw?1:0);
          if(Math.random()<0.14) this.sparks.emitParticleAt(a.px + a.face*12, a.py-26, 2);
        } else if(a.state==='rest'){
          const rt=a.restType;
          if(rt==='sit'){ this.setPose(a,'sit');
            if(!a.z && Math.random()<0.03){ a.z=this.add.text(a.px+9,a.py-30,'💤',{fontSize:'13px'}).setOrigin(0.5,1); a.zt=time; } }
          else if(rt==='coffee'){ this.setPose(a,'stand');
            if(!a.cup) a.cup=this.add.text(a.px+a.face*11,a.py-16,'☕',{fontSize:'12px'}).setOrigin(0.5,1); }
          else { this.setPose(a,'stand'); } // lean: 壁際で立つ
        } else { this.setPose(a,'stand'); a.sp.x=a.px; a.sp.y=a.py; }
      } else this.decide(a);
      { const lt=this.tintByLight((a.cell.c+0.5)/GU,(a.cell.r+0.5)/GV);   // 部屋の採光を乗算tint(スキンにも適用)
        a.sp.setFlipX(a.face<0).setDepth(a.py).setTint(lt);
        if(a.hat && a.hat.visible){ const dp=DOTP*a.scl;
          a.hat.setPosition(a.sp.x+(HAT_CX-13)*dp, a.sp.y-(28-a.hatBaseY)*dp).setDepth(a.py+0.6).setTint(lt).setFlipX(a.face<0); } }
      a.shadow.setPosition(a.px+CELL*0.2,a.py+CELL*0.09).setDepth(a.py-0.5);
      a.lbl.setPosition(a.px, a.py-42*a.scl-6).setDepth(a.py+1);
      if(a.z){ a.z.setPosition(a.px+9, a.py-30-((time-(a.zt||time))*0.01)).setDepth(a.py+2);
        if((time-(a.zt||time))>1800){ a.z.destroy(); a.z=null; } }
      if(a.cup){ a.cup.setPosition(a.px+a.face*11, a.py-16).setDepth(a.py+2); }
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO, parent:'game', width:W, height:H, backgroundColor:'#0c1014', pixelArt:true,
  scale:{ mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH }, scene:[Main],
});

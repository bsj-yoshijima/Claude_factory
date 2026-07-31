'use strict';
/* Claude Factory — Phaser 3 基盤
   1シーン統合(休憩室廃止) / 設置物セル占有＋BFS回避徘徊 / マスコット3ポーズ状態機械。
   追加: 接地影(背景に溶け込む), idle小ネタ(座り💤 / コーヒー☕ / 壁際にもたれる)。 */

const W = 1024, H = 572, GU = 12, GV = 12;
const ISO = { Bx:0.4858, By:0.3685, ux:0.3398, uy:0.3138, vx:-0.3121, vy:0.2852 };
const CELL = ( Math.hypot(ISO.ux*W/GU, ISO.uy*H/GU) + Math.hypot(ISO.vx*W/GV, ISO.vy*H/GV) ) / 2;
function isoToScreen(u,v){ return { x:(ISO.Bx+u*ISO.ux+v*ISO.vx)*W, y:(ISO.By+u*ISO.uy+v*ISO.vy)*H }; }
const OFF_U = 0.577, OFF_V = 0.851;   // 背景の床タイル目地への位相補正(FFT実測)。セル境界=目地に一致
function cellXY(c,r){ return isoToScreen((c+0.5+OFF_U)/GU,(r+0.5+OFF_V)/GV); }   // c,r は連続値でも可
const ISO_DET = ISO.ux*ISO.vy - ISO.vx*ISO.uy;
function screenToIso(sx,sy){ const nx=sx/W-ISO.Bx, ny=sy/H-ISO.By;
  return { u:(nx*ISO.vy - ISO.vx*ny)/ISO_DET, v:(ISO.ux*ny - nx*ISO.uy)/ISO_DET }; }
function uvXY(u,v){ return { x:(ISO.Bx+u*ISO.ux+v*ISO.vx)*W, y:(ISO.By+u*ISO.uy+v*ISO.vy)*H }; }
const AU={x:ISO.ux*W/GU, y:ISO.uy*H/GU};   // 1セル u方向 の画面ベクトル
const AV={x:ISO.vx*W/GV, y:ISO.vy*H/GV};   // 1セル v方向 の画面ベクトル
const K = (c,r)=> c+','+r;

const INK = '#3b4643', EYE = '#241713';
const PRESETS = [
  {b:'#c15f3c',s:'#9d4527',l:'#d67e57'}, {b:'#4f7fc4',s:'#37588f',l:'#7ba3df'},
  {b:'#4fa564',s:'#367b47',l:'#7bc78d'}, {b:'#8a5fc0',s:'#623f90',l:'#ac86dc'},
  {b:'#e0b23a',s:'#ad8327',l:'#f2d06a'}, {b:'#d86a9c',s:'#a94773',l:'#f094bc'},
];
const MTOP = [3,2,1,1,0,0,1,2,3,3,2,1,0,0,1,1,2,3];
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

const MACHINES = ['m_red','m_blue','m_green','m_yellow'];
const MACHS_JP = { red:'抽出機', green:'成形機', blue:'演算機', yellow:'選別機' };
// テーマ専用の部屋画像(Stitch製・壁/床/窓を焼き込み)。ここにあるテーマは背景ごと差し替える
const ROOM_TEX = { arabia:'room_arabia', undersea:'room_undersea', japan:'room_japan', china:'room_china',
  diner:'room_diner', fantasy:'room_fantasy', scifi:'room_scifi', cabin:'room_cabin', dino:'room_dino',
  haunted:'room_haunted', pirate:'room_pirate', circuit:'room_circuit', dwarf:'room_dwarf', hell:'room_hell', steampunk:'room_steampunk',
  retrofuture:'room_retrofuture', tokyo:'room_tokyo', halloween:'room_halloween' };
const PROP_NAMES = ['vase','palm','rug','flantern','fountain','chest','cushion','bonsai','lantern','pedestal','flower','screen'];  // Stitch製 装飾プロップ
// エージェントのスキン(頭アクセ e + 体の色 body)。クリックで巡回・プロジェクト単位で永続化。
const SKINS = [
  {id:'none',   e:'',   n:'なし'},
  {id:'chick',  e:'🐤', n:'ひよこ'},
  {id:'phones', e:'🎧', n:'ヘッドフォン'},
  {id:'hat',    e:'🎩', n:'シルクハット'},
  {id:'crown',  e:'👑', n:'王様',     body:0xf1d489},
  {id:'ribbon', e:'🎀', n:'リボン'},
  {id:'flower', e:'🌸', n:'花'},
  {id:'mush',   e:'🍄', n:'キノコ'},
  {id:'cap',    e:'🎓', n:'卒業'},
  {id:'ninja',  e:'🥷', n:'忍者',     body:0x3b4048},
  {id:'diver',  e:'🤿', n:'ダイバー', body:0x5aa6d6},
  {id:'santa',  e:'🎅', n:'サンタ',   body:0xd25148},
  {id:'party',  e:'🎉', n:'パーティ', body:0xe07ab0},
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
    for(const n of ['haunted','pirate','circuit','dwarf','hell','steampunk','retrofuture','tokyo','halloween']) this.load.image('room_'+n, `assets/room-${n}.png`);
    for(const n of PROP_NAMES) this.load.image('prop_'+n, `assets/prop_${n}.png`);
    for(const m of MACHINES) this.load.image(m, `assets/obj_${m}_d0.png`);
    for(const d of DECOR) this.load.image('dec_'+d, `assets/obj_${d}.png`);
    this.load.image('belt_seg','assets/belt_seg.png');
    this.load.image('belt_corner','assets/belt_corner.png');   // belt_seg 由来(同一パレット)
    this.load.image('item_box','assets/obj_crate.png');
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
    for(const o of DEMO){ const isM=MACHINES.includes(o.k);
      this.addPlaced(isM?'machine':'deco', isM?o.k.replace('m_',''):o.k.replace('dec_',''), {cell:{c:o.c,r:o.r}, silent:true}); }
    this.setupEdit();
    this.createBelt();
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
    this.poll(); this.time.addEvent({delay:1500,loop:true,callback:()=>this.poll()});
  }
  createBelt(){
    // ベルト実寸: 1セル強に収めて隣と自然に連結（元は2.3セルで重なっていた）
    const BW=1.28*CELL, bscale=BW/965;
    this.beltH=0.34*CELL;            // 箱の底をベルト天面に合わせる高さ(側面に被らないよう)
    this.beltLift=0.8*CELL;          // 箱をこの分だけ手前セグメントより上に描く(奥に隠れないよう)
    // L字ベルト: 手前(6,9)→(6,6)で右折→(9,6)。矢印なしスプライトをセルごとに連結
    const armA=[{c:6,r:9},{c:6,r:8},{c:6,r:7}];       // V軸(手前→奥・右上へ)
    const corner={c:6,r:6};
    const armB=[{c:7,r:6},{c:8,r:6},{c:9,r:6}];        // U軸(右下へ)
    const put=(c,r,flip,tex)=>{ const p=cellXY(c,r);
      const s=this.add.image(p.x,p.y,tex||'belt_seg').setOrigin(0.5,0.72).setScale(bscale).setFlipX(!!flip).setDepth(p.y);
      this.add.image(p.x+CELL*0.16,p.y+CELL*0.07,'shadow').setDepth(p.y-0.5).setRotation(0.5).setDisplaySize(s.displayWidth*0.82,s.displayWidth*0.36).setAlpha(0.45);
      this.lit.push({sp:s, u:(c+0.5)/GU, v:(r+0.5)/GV});   // 採光対象
      this.occ.add(K(c,r)); return s; };
    for(const o of armA) put(o.c,o.r,false);
    put(corner.c,corner.r,false,'belt_corner');            // コーナー(専用エルボ)
    for(const o of armB) put(o.c,o.r,true);                // U軸側は反転して斜めを合わせる
    // 製品を L字 Path に沿って流す(矢印なし・箱の動きで方向が分かる)
    const h=this.beltH, P=(c,r)=>{ const p=cellXY(c,r); return {x:p.x,y:p.y-h}; };
    const a=P(6,9.4), pre=P(6,6.5), cor=P(6,6), post=P(6.5,6), b=P(9.4,6);
    this.beltPath=new Phaser.Curves.Path(a.x,a.y);
    this.beltPath.lineTo(pre.x,pre.y);
    this.beltPath.quadraticBezierTo(post.x,post.y,cor.x,cor.y);   // (endX,endY,ctrlX,ctrlY) コーナーで滑らかに右折
    this.beltPath.lineTo(b.x,b.y);
    this._pv=new Phaser.Math.Vector2();
    this.items=[]; const N=5;
    for(let i=0;i<N;i++){ const it=this.add.image(a.x,a.y,'item_box').setOrigin(0.5,0.9); it.setScale(0.5*CELL/it.height); it.t=i/N; this.items.push(it); }
    // edit時のみ流れる向きを表示する矢印レイヤー
    this.beltDirGfx=this.add.graphics().setDepth(8600);
  }
  drawBeltDir(time){
    const g=this.beltDirGfx; g.clear(); if(!this.editMode||!this.beltPath) return;
    g.lineStyle(4,0x7fecec,0.95); g.lineCap='round';
    const v=new Phaser.Math.Vector2(), v2=new Phaser.Math.Vector2();
    const off=((time*0.0005)%0.07);
    for(let t=off; t<1; t+=0.07){ this.beltPath.getPoint(t,v); this.beltPath.getPoint(Math.min(1,t+0.02),v2);
      const dx=v2.x-v.x, dy=v2.y-v.y, L=Math.hypot(dx,dy)||1, ax=dx/L, ay=dy/L, nx=-ay, ny=ax;
      const cx=v.x, cy=v.y-3, tip={x:cx+ax*7,y:cy+ay*7};
      const la={x:cx-ax*2-nx*5,y:cy-ay*2-ny*5}, lb={x:cx-ax*2+nx*5,y:cy-ay*2+ny*5};
      g.beginPath(); g.moveTo(la.x,la.y); g.lineTo(tip.x,tip.y); g.lineTo(lb.x,lb.y); g.strokePath(); }
  }
  /* ===== 配置レジストリ（位置指定・移動・撤去に対応。編集画面の土台） ===== */
  _makeObjs(e){ const {c,r}=e.cell; const p=cellXY(c,r); const u=(c+0.5)/GU, v=(r+0.5)/GV;
    const tint=this.tintByLight(u,v); const objs=[]; let main=null; e._lit=null;
    if(e.kind==='machine'){
      const tex={red:'m_red',blue:'m_blue',green:'m_green',yellow:'m_yellow'}[e.sub];
      const img=this.add.image(p.x,p.y,tex).setOrigin(0.5,1).setDepth(p.y); img.setScale(2.0*CELL/img.height).setTint(tint);
      const sh=this.add.image(p.x+CELL*0.24,p.y+CELL*0.12,'shadow').setDepth(p.y-0.5).setRotation(0.5).setDisplaySize(img.displayWidth*1.15,img.displayWidth*0.52).setAlpha(0.5);
      const lbl=this.add.text(p.x,p.y-2.0*CELL-4,(MACHS_JP[e.sub]||'')+(e.lvl>1?` Lv${e.lvl}`:''),{fontFamily:'monospace',fontSize:'10px',color:'#eafff6'}).setOrigin(0.5,1).setDepth(p.y+1); lbl.setShadow(0,1,'#000',3,true,true);
      objs.push(sh,img,lbl); main=img; e._lit=img; this.lit.push({sp:img,u,v}); this.machineCells.push({c,r});
    } else if(e.kind==='belt'){
      const s=this.add.image(p.x,p.y,'belt_seg').setOrigin(0.5,0.72).setScale(1.28*CELL/965).setDepth(p.y).setTint(tint);
      const sh=this.add.image(p.x+CELL*0.16,p.y+CELL*0.07,'shadow').setDepth(p.y-0.5).setRotation(0.5).setDisplaySize(s.displayWidth*0.82,s.displayWidth*0.36).setAlpha(0.45);
      objs.push(sh,s); main=s; e._lit=s; this.lit.push({sp:s,u,v});
    } else if(e.kind==='deco'){
      const img=this.add.image(p.x,p.y,'dec_'+e.sub).setOrigin(0.5,1).setDepth(p.y); img.setScale(1.0*CELL/img.height).setTint(tint);
      const sh=this.add.image(p.x+CELL*0.2,p.y+CELL*0.1,'shadow').setDepth(p.y-0.5).setRotation(0.5).setDisplaySize(img.displayWidth*1.05,img.displayWidth*0.5).setAlpha(0.5);
      objs.push(sh,img); main=img; e._lit=img; this.lit.push({sp:img,u,v});
    } else if(e.kind==='prop'){
      const img=this.add.image(p.x,p.y,'prop_'+e.sub).setOrigin(0.5,1).setDepth(p.y); img.setScale(1.35*CELL/img.height).setTint(tint);
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
    e.objs=objs; e.main=main; return e;
  }
  addPlaced(kind, sub, extra){ extra=extra||{};
    if(kind==='deco' && !this.textures.exists('dec_'+sub)) return null;
    const cell=(extra.cell && this.isFree(extra.cell.c,extra.cell.r)) ? extra.cell : this.freeCell();
    const e={ id: extra.id||('o'+(this._oid=(this._oid||0)+1)), kind, sub, lvl:extra.lvl||1, cell };
    this._makeObjs(e); this.occ.add(K(cell.c,cell.r)); this.placed.push(e);
    if(this.editMode) this._enableDrag(e);
    if(!extra.silent){ const p=cellXY(cell.c,cell.r); this._spawnPop(p.x,p.y); }
    return e.id;
  }
  _detach(e){ for(const o of e.objs) o.destroy();
    if(e._lit){ const i=this.lit.findIndex(x=>x.sp===e._lit); if(i>=0)this.lit.splice(i,1); }
    if(e.kind==='machine'){ const i=this.machineCells.findIndex(m=>m.c===e.cell.c&&m.r===e.cell.r); if(i>=0)this.machineCells.splice(i,1); } }
  removeItem(id){ const i=this.placed.findIndex(e=>e.id===id); if(i<0)return false; const e=this.placed[i];
    this._detach(e); this.occ.delete(K(e.cell.c,e.cell.r)); this.placed.splice(i,1); return true; }
  moveItem(id,c,r){ const e=this.placed.find(x=>x.id===id); if(!e)return false;
    const same=(e.cell.c===c&&e.cell.r===r); if(!same && !this.isFree(c,r)) return false;
    this._detach(e); this.occ.delete(K(e.cell.c,e.cell.r));
    e.cell={c,r}; this._makeObjs(e); this.occ.add(K(c,r));
    if(this.editMode) this._enableDrag(e); return true; }
  getLayout(){ return this.placed.map(e=>({id:e.id,kind:e.kind,sub:e.sub,lvl:e.lvl,c:e.cell.c,r:e.cell.r})); }
  buildLayout(list){ for(const e of this.placed.slice()) this.removeItem(e.id);
    for(const it of (list||[])) this.addPlaced(it.kind, it.sub, {cell:{c:it.c,r:it.r}, lvl:it.lvl, id:it.id, silent:true});
    this._oid=Math.max(0,...this.placed.map(e=>parseInt(String(e.id).replace(/\D/g,''))||0)); }
  setMachineLevel(id,lvl){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e)return; e.lvl=lvl; this.moveItem(id,e.cell.c,e.cell.r); }
  // 旧API互換（ショップ購入から呼ばれる）
  placeMachine(type){ return this.addPlaced('machine', type); }
  placeBelt(){ return this.addPlaced('belt', null); }
  placeDeco(type){ return this.addPlaced('deco', type); }
  placeEmojiDeco(emoji){ return this.addPlaced('emoji', emoji); }
  placeProp(name){ if(!this.textures.exists('prop_'+name)) return null; return this.addPlaced('prop', name); }
  placePrize(emoji,color){ return this.addPlaced('prize', {e:emoji,color}); }
  syncMachines(list){ for(const m of (list||[])) this.addPlaced('machine', m.type, {lvl:m.lvl||1}); }
  /* 設置時のポップ演出 */
  _spawnPop(x,y){ const g=this.add.circle(x,y-CELL*0.5,CELL*0.6,0xffe9a8,0.5).setDepth(9000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:g,scale:1.8,alpha:0,duration:420,onComplete:()=>g.destroy()}); }
  /* ===== 編集モード（グリッド表示・ドラッグ移動・ゴミ箱で撤去） ===== */
  setupEdit(){
    // グリッドは床タイルの目地に一致(uvXYで直接描画・床[0,1]にクリップ)。深度は床の上・オブジェクトの下
    this.editGrid=this.add.graphics().setDepth(-998).setVisible(false); this.editGrid.lineStyle(1,0x7fe6ff,0.5);
    const gl=(u0,v0,u1,v1)=>{ const a=uvXY(u0,v0),b=uvXY(u1,v1); this.editGrid.beginPath(); this.editGrid.moveTo(a.x,a.y); this.editGrid.lineTo(b.x,b.y); this.editGrid.strokePath(); };
    for(let c=0;c<GU;c++){ const uu=(c+OFF_U)/GU; if(uu>0&&uu<1) gl(uu,0,uu,1); }
    for(let r=0;r<GV;r++){ const vv=(r+OFF_V)/GV; if(vv>0&&vv<1) gl(0,vv,1,vv); }
    gl(0,0,1,0); gl(1,0,1,1); gl(1,1,0,1); gl(0,1,0,0);   // 床の外周
    // セル中心ドット(=オブジェクトの設置点)。各マスの中心が一目で分かる
    this.editGrid.fillStyle(0x7fe6ff,0.6);
    for(let c=0;c<GU;c++) for(let r=0;r<GV;r++){ const p=cellXY(c,r); this.editGrid.fillCircle(p.x,p.y,2.2); }
    this.trash=this.add.container(72,H-52,[ this.add.rectangle(0,0,124,72,0x3a1418,0.85).setStrokeStyle(2,0xe05a4e), this.add.text(0,0,'🗑 ここへ撤去',{fontSize:'13px',color:'#ffd0c8'}).setOrigin(0.5) ]).setDepth(8600).setVisible(false);
    this._trashRect=new Phaser.Geom.Rectangle(10,H-88,124,74);
    // 空き床クリックで、パレットで選択中のアイテムを設置
    this.input.on('pointerdown',(po,over)=>{ if(!this.editMode) return; if(over&&over.length) return;
      if(!window.__editSel) return; const uv=screenToIso(po.x,po.y);
      const c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
      if(window.__editPlaceAt) window.__editPlaceAt(c,r); });
    this.input.on('drag',(po,obj,dx,dy)=>{ if(this.editMode&&obj._e){ obj.x=dx; obj.y=dy; } });
    this.input.on('dragend',(po,obj)=>{ if(!this.editMode||!obj._e)return; const e=obj._e;
      if(Phaser.Geom.Rectangle.Contains(this._trashRect,po.x,po.y)){ this.removeItem(e.id); if(window.__layoutChanged)window.__layoutChanged(); return; }
      const uv=screenToIso(obj.x,obj.y); let c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
      if(!this.moveItem(e.id,c,r)) this.moveItem(e.id,e.cell.c,e.cell.r);
      if(window.__layoutChanged)window.__layoutChanged(); });
  }
  _enableDrag(e){ const m=e.main; if(!m)return; m._e=e; m.setInteractive({useHandCursor:true}); this.input.setDraggable(m,true); }
  _disableDrag(e){ const m=e.main; if(!m)return; this.input.setDraggable(m,false); m.disableInteractive(); m._e=null; }
  toggleEdit(on){ this.editMode=(on==null)?!this.editMode:!!on; this.editGrid.setVisible(this.editMode); this.trash.setVisible(this.editMode);
    for(const e of this.placed){ this.editMode?this._enableDrag(e):this._disableDrag(e); } return this.editMode; }
  /* 窓オブジェクトを座標で定義(左壁 u=0)。床エッジ uvXY(0,v) を基準に壁の高さ方向へ立ち上げる。
     光源(採光の床帯・月/星のマスク)はすべてこの窓定義から導出する。 */
  defineWindows(){
    this.winUp0=0; this.winUp1=248;                  // 床エッジからの立ち上げ(px)。ガラス全体を覆うよう広めに
    this.windows=[{v0:0.03,v1:0.215},{v0:0.36,v1:0.56},{v0:0.71,v1:0.914}];  // 背景のガラス透過から実測した3枚の窓(左壁沿い v 範囲)
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
  clearDeco(a){ if(a.z){a.z.destroy();a.z=null;} if(a.cup){a.cup.destroy();a.cup=null;} if(a.skinObj){a.skinObj.destroy();a.skinObj=null;} }
  /* スキン: 頭アクセサリの表示更新 / クリック巡回 / 一括反映(ロード時) */
  updateSkin(a){ const sk=SKINS.find(s=>s.id===a.skinId)||SKINS[0]; a.bodyTint=sk.body||null;
    if(!sk.e){ if(a.skinObj){a.skinObj.destroy();a.skinObj=null;} return; }
    if(!a.skinObj) a.skinObj=this.add.text(a.px,a.py,'',{fontSize:'15px'}).setOrigin(0.5,1);
    a.skinObj.setText(sk.e); }
  mulTint(x,y){ const xr=(x>>16)&255,xg=(x>>8)&255,xb=x&255, yr=(y>>16)&255,yg=(y>>8)&255,yb=y&255;
    return ((xr*yr/255|0)<<16)|((xg*yg/255|0)<<8)|(xb*yb/255|0); }
  cycleSkin(key){ const a=this.agents[key]; if(!a)return; const i=SKINS.findIndex(s=>s.id===a.skinId);
    a.skinId=SKINS[(i+1)%SKINS.length].id; this.updateSkin(a);
    if(window.__skinChanged) window.__skinChanged(a.proj, a.skinId); }
  applySkins(map){ this.skins=map||{}; for(const k in this.agents){ const a=this.agents[k]; a.skinId=this.skins[a.proj]||'none'; this.updateSkin(a); } }
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
        const lbl=this.add.text(p.x,p.y-30,w.project||'',{fontFamily:'monospace',fontSize:'11px',color:'#eafff6'}).setOrigin(0.5,1);
        lbl.setShadow(0,1,'#000',3,true,true);
        this.agents[key]={sp,lbl,shadow,ci,cell,px:p.x,py:p.y,path:[],state:'walk',after:null,timer:0,face:1,busy:w.working,restType:'sit',z:null,cup:null,scl:s,
          proj:w.project||'', skinId:(this.skins&&this.skins[w.project])||'none', skinObj:null};
        sp.setInteractive({useHandCursor:true}).on('pointerdown',()=>this.cycleSkin(key));
        this.updateSkin(this.agents[key]);
        this.decide(this.agents[key]);
      } else this.agents[key].busy=w.working;
    });
    for(const k of Object.keys(this.agents)){ if(!present.has(k)){ const a=this.agents[k]; this.clearDeco(a); a.sp.destroy(); a.lbl.destroy(); a.shadow.destroy(); delete this.agents[k]; } }
    this.busyCount=busyN;
    if(this.hud) this.hud.innerHTML=`稼働 <b>${busyN}</b> ・ 休憩 ${idleN} ・ Phaser基盤`;
  }
  update(time){
    // 星のまたたき(夜)
    if(this.stars && this.lightOn>0){ for(const s of this.stars) s.setAlpha(this.lightOn*(0.35+0.65*Math.abs(Math.sin(time*0.002+s.ph)))); }
    // コンベア: 連続ベルトを描画 + 製品を Path に沿って流す
    if(this.beltDirGfx) this.drawBeltDir(time);
    if(this.items && this.beltPath){ const v=this._pv;
      for(const it of this.items){ it.t=(it.t+0.0012)%1; this.beltPath.getPoint(it.t, v);   // 速度30%
        const uv=screenToIso(v.x, v.y+this.beltH); it.setPosition(v.x, v.y).setDepth(v.y + this.beltH + this.beltLift).setTint(this.tintByLight(uv.u,uv.v)); } }
    const SPD=1.7;
    for(const k of Object.keys(this.agents)){
      const a=this.agents[k];
      if(a.path && a.path.length){
        const w0=a.path[0], t=cellXY(w0.c,w0.r);
        const dx=t.x-a.px, dy=t.y-a.py, dist=Math.hypot(dx,dy);
        if(dist<2){ a.cell=w0; a.path.shift(); } else { a.px+=dx/dist*SPD; a.py+=dy/dist*SPD; a.face=dx<0?-1:1; }
        a.state='walk'; a.sp.setTexture(`m${a.ci}_stand`);
        a.sp.x=a.px; a.sp.y=a.py - Math.abs(Math.sin(time*0.012))*3;
      } else if(a.after){
        a.state=a.after.state; a.timer=a.after.dur; a.restType=a.after.restType||a.restType;
        if(a.after.face) a.face=(cellXY(a.after.face.c,a.after.face.r).x < a.px)?-1:1;
        a.after=null;
      } else if(a.timer>0){
        a.timer--; a.sp.x=a.px; a.sp.y=a.py;
        if(a.state==='work'){
          const sw=(Math.floor(time*0.012)%2===0); a.sp.setTexture(sw?`m${a.ci}_work`:`m${a.ci}_stand`); a.sp.y=a.py-(sw?1:0);
          if(Math.random()<0.14) this.sparks.emitParticleAt(a.px + a.face*12, a.py-26, 2);
        } else if(a.state==='rest'){
          const rt=a.restType;
          if(rt==='sit'){ a.sp.setTexture(`m${a.ci}_sit`);
            if(!a.z && Math.random()<0.03){ a.z=this.add.text(a.px+9,a.py-30,'💤',{fontSize:'13px'}).setOrigin(0.5,1); a.zt=time; } }
          else if(rt==='coffee'){ a.sp.setTexture(`m${a.ci}_stand`);
            if(!a.cup) a.cup=this.add.text(a.px+a.face*11,a.py-16,'☕',{fontSize:'12px'}).setOrigin(0.5,1); }
          else { a.sp.setTexture(`m${a.ci}_stand`); } // lean: 壁際で立つ
        } else { a.sp.setTexture(`m${a.ci}_stand`); a.sp.x=a.px; a.sp.y=a.py; }
      } else this.decide(a);
      { const lt=this.tintByLight((a.cell.c+0.5)/GU,(a.cell.r+0.5)/GV);   // 採光×衣装色
        a.sp.setFlipX(a.face<0).setDepth(a.py).setTint(a.bodyTint?this.mulTint(lt,a.bodyTint):lt); }
      a.shadow.setPosition(a.px+CELL*0.2,a.py+CELL*0.09).setDepth(a.py-0.5);
      a.lbl.setPosition(a.px, a.py-42*a.scl-6).setDepth(a.py+1);
      if(a.z){ a.z.setPosition(a.px+9, a.py-30-((time-(a.zt||time))*0.01)).setDepth(a.py+2);
        if((time-(a.zt||time))>1800){ a.z.destroy(); a.z=null; } }
      if(a.cup){ a.cup.setPosition(a.px+a.face*11, a.py-16).setDepth(a.py+2); }
      if(a.skinObj){ a.skinObj.setPosition(a.px, a.sp.y - a.sp.displayHeight + 5).setDepth(a.py+3); }
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO, parent:'game', width:W, height:H, backgroundColor:'#0c1014', pixelArt:true,
  scale:{ mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH }, scene:[Main],
});

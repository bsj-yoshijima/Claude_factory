'use strict';
/* Claude Factory — Phaser 3 基盤
   1シーン統合(休憩室廃止) / 設置物セル占有＋BFS回避徘徊 / マスコット3ポーズ状態機械。
   追加: 接地影(背景に溶け込む), idle小ネタ(座り💤 / コーヒー☕ / 壁際にもたれる)。 */

const W = 1024, H = 572, GU = 12, GV = 12;
const ISO = { Bx:0.4858, By:0.3685, ux:0.3398, uy:0.3138, vx:-0.3121, vy:0.2852 };
const CELL = ( Math.hypot(ISO.ux*W/GU, ISO.uy*H/GU) + Math.hypot(ISO.vx*W/GV, ISO.vy*H/GV) ) / 2;
function isoToScreen(u,v){ return { x:(ISO.Bx+u*ISO.ux+v*ISO.vx)*W, y:(ISO.By+u*ISO.uy+v*ISO.vy)*H }; }
function cellXY(c,r){ return isoToScreen((c+0.5)/GU,(r+0.5)/GV); }   // c,r は連続値でも可
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
const DECOR = ['crate','drum','plant','pallet','sign'];
const DEMO = [
  {k:'m_red',c:3,r:2},{k:'m_blue',c:5,r:2},{k:'m_green',c:7,r:2},{k:'m_yellow',c:9,r:2},
  {k:'dec_crate',c:2,r:8},{k:'dec_drum',c:10,r:7},{k:'dec_sign',c:10,r:9},{k:'dec_pallet',c:4,r:9},{k:'dec_plant',c:1,r:10},
];

class Main extends Phaser.Scene {
  preload(){
    this.load.image('bg_room','assets/factory-room.png');   // ガラス透過(窓の後ろに空/月/太陽を置く)
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
    this.ambB=1; this.ambInt=0xffffff; this.lightOn=0;
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

    this.occ=new Set(); this.machineCells=[];
    for(const o of DEMO){
      const p=cellXY(o.c,o.r);
      const img=this.add.image(p.x,p.y,o.k).setOrigin(0.5,1);
      const isM=MACHINES.includes(o.k);
      img.setScale((isM?2.0:1.0)*CELL/img.height).setDepth(p.y);
      this.add.image(p.x+CELL*0.24,p.y+CELL*0.12,'shadow').setDepth(p.y-0.5).setRotation(0.5)  // 光源=左上→影は右下へ伸ばす
        .setDisplaySize(img.displayWidth*1.15, img.displayWidth*0.52).setAlpha(0.5);
      this.lit.push({sp:img, u:(o.c+0.5)/GU, v:(o.r+0.5)/GV});   // 位置(uv)で採光
      this.occ.add(K(o.c,o.r)); if(isM) this.machineCells.push({c:o.c,r:o.r});
    }
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
    this.editMode = new URLSearchParams(location.search).get('edit')==='1';   // edit時のみ方向矢印
    this.input.keyboard.on('keydown-E', ()=>{ this.editMode=!this.editMode; });
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
  /* ガチャ景品を空きセルに飾る(台座＋絵文字＋レア発光) */
  placePrize(emoji, color){
    const cell=this.freeCell(); const p=cellXY(cell.c,cell.r);
    const col=Phaser.Display.Color.HexStringToColor(color).color;
    this.add.image(p.x+CELL*0.16,p.y+CELL*0.06,'shadow').setDepth(p.y-0.6).setRotation(0.5).setDisplaySize(CELL*0.8,CELL*0.36).setAlpha(0.5);  // 接地影
    this.add.ellipse(p.x,p.y-2, CELL*0.95, CELL*0.5, col, 0.5).setDepth(p.y-1).setBlendMode(Phaser.BlendModes.ADD);
    const base=this.add.rectangle(p.x,p.y-2, CELL*0.5, CELL*0.2, 0x2b3138).setOrigin(0.5,1).setDepth(p.y); base.setStrokeStyle(1,0x14171c);
    this.add.text(p.x, p.y-CELL*0.26, emoji, {fontSize:Math.round(CELL*0.95)+'px'}).setOrigin(0.5,1).setDepth(p.y+0.1);
    this.occ.add(K(cell.c,cell.r)); return true;
  }
  /* クラフトで建てた製造機を空きセルに設置(DEMOと同じ描画・採光・影) */
  placeMachine(type, label){
    const tex={red:'m_red',blue:'m_blue',green:'m_green',yellow:'m_yellow'}[type]; if(!tex) return false;
    const cell=this.freeCell(); const p=cellXY(cell.c,cell.r);
    const img=this.add.image(p.x,p.y,tex).setOrigin(0.5,1);
    img.setScale(2.0*CELL/img.height).setDepth(p.y);
    this.add.image(p.x+CELL*0.24,p.y+CELL*0.12,'shadow').setDepth(p.y-0.5).setRotation(0.5)
      .setDisplaySize(img.displayWidth*1.15, img.displayWidth*0.52).setAlpha(0.5);
    this.lit.push({sp:img, u:(cell.c+0.5)/GU, v:(cell.r+0.5)/GV});
    img.setTint(this.tintByLight((cell.c+0.5)/GU,(cell.r+0.5)/GV));
    if(label){ const t=this.add.text(p.x,p.y-2.0*CELL-4,label,{fontFamily:'monospace',fontSize:'10px',color:'#eafff6'}).setOrigin(0.5,1).setDepth(p.y+1); t.setShadow(0,1,'#000',3,true,true); }
    this.occ.add(K(cell.c,cell.r)); this._spawnPop(p.x,p.y); return true;
  }
  /* クラフトで作ったコンベア単体を空きセルに設置 */
  placeBelt(){
    const BW=1.28*CELL, bscale=BW/965; const cell=this.freeCell(); const p=cellXY(cell.c,cell.r);
    const s=this.add.image(p.x,p.y,'belt_seg').setOrigin(0.5,0.72).setScale(bscale).setDepth(p.y);
    this.add.image(p.x+CELL*0.16,p.y+CELL*0.07,'shadow').setDepth(p.y-0.5).setRotation(0.5).setDisplaySize(s.displayWidth*0.82,s.displayWidth*0.36).setAlpha(0.45);
    this.lit.push({sp:s, u:(cell.c+0.5)/GU, v:(cell.r+0.5)/GV});
    s.setTint(this.tintByLight((cell.c+0.5)/GU,(cell.r+0.5)/GV));
    this.occ.add(K(cell.c,cell.r)); this._spawnPop(p.x,p.y); return true;
  }
  /* 設置時のポップ演出 */
  _spawnPop(x,y){ const g=this.add.circle(x,y-CELL*0.5,CELL*0.6,0xffe9a8,0.5).setDepth(9000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:g,scale:1.8,alpha:0,duration:420,onComplete:()=>g.destroy()}); }
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
    this.ambInt=objAmb; this.ambB=ambB; this.shaftOn=shaftOn;
    this._ambC=Phaser.Display.Color.IntegerToColor(objAmb);
    this._shaftC=Phaser.Display.Color.IntegerToColor(shaftCol);
    this.bgImg.setTint(amb);
    this.drawShafts();
    for(const o of this.lit) o.sp.setTint(this.tintByLight(o.u,o.v));   // 設置物を採光で色付け
    // 窓の外の空(時間帯) + 太陽/月/星（bgの後ろ・ガラス越し）
    let sky, dayF=0;
    if(hr>=8&&hr<16){ sky=0xaec6e6; dayF=1; }                                   // 昼(青空)
    else if(hr>=5&&hr<8){ sky=0xf0c79c; dayF=(hr-5)/3; }                        // 朝焼け
    else if(hr>=16&&hr<18.5){ sky=0xef8f56; dayF=Math.max(0,1-(hr-16)/2.5); }   // 夕焼け
    else if(hr>=18.5&&hr<20){ sky=0x3a3560; dayF=0; }                           // 薄暮
    else { sky=0x0c1430; dayF=0; }                                             // 夜空
    if(this.skyLayer){ this.skyLayer.clear(); this.skyLayer.fillStyle(sky,1); this.skyLayer.fillPoints(this.skyCover,true); }
    if(this.sun){ this.sun.setAlpha(dayF); this.sunG.setAlpha(dayF*0.5); }
    if(this.moon){ this.moon.setAlpha(nf); this.moonG.setAlpha(nf*0.5); for(const s of this.stars) s.setAlpha(nf); }
  }
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
        this.agents[key]={sp,lbl,shadow,ci,cell,px:p.x,py:p.y,path:[],state:'walk',after:null,timer:0,face:1,busy:w.working,restType:'sit',z:null,cup:null,scl:s};
        this.decide(this.agents[key]);
      } else this.agents[key].busy=w.working;
    });
    for(const k of Object.keys(this.agents)){ if(!present.has(k)){ const a=this.agents[k]; this.clearDeco(a); a.sp.destroy(); a.lbl.destroy(); a.shadow.destroy(); delete this.agents[k]; } }
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
      a.sp.setFlipX(a.face<0).setDepth(a.py).setTint(this.tintByLight((a.cell.c+0.5)/GU,(a.cell.r+0.5)/GV));   // 採光で色付け
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

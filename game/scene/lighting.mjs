/* 採光と内装 — 窓・時間帯の色・光の柱・部屋/床の差し替え。 */
import { ROOM_TEX } from './catalog.mjs';
import { GU, GV, H, ISO, OFF_U, OFF_V, W, uvXY } from './iso.mjs';



export const Lighting = {
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
  },
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
  },
  /* 窓からの光が (u,v) に当たる量(0..1)。u=室内奥行き, v=左壁沿い */
  lightAt(u,v){
    let l=0; if(this.shaftOn>0 && u>=-0.03 && u<=this.uLen)
      for(const s of this.windows){ const vv=s.vc + this.sh*(u/this.uLen);
        if(Math.abs(v-vv)<s.hw) l=Math.max(l, this.shaftOn*(1-(u/this.uLen)*0.5)); }
    return Phaser.Math.Clamp(l,0,1);
  },
  tintByLight(u,v){ const l=this.lightAt(u,v);
    // ベース色: 採光(l)で窓色へ寄せる。lが無くても環境色
    let r,g,b;
    if(l<=0.01){ const a=this._ambC; r=a.r; g=a.g; b=a.b; }
    else { const c=Phaser.Display.Color.Interpolate.ColorWithColor(this._ambC,this._shaftC,100,Math.round(l*100)); r=c.r; g=c.g; b=c.b; }
    // 光源=窓(u=0=左上)。奥(uが大)ほど暗くして光源方向の陰影勾配を作る
    const shade=1 - Phaser.Math.Clamp(u,0,1)*0.16;
    return Phaser.Display.Color.GetColor(Math.round(r*shade),Math.round(g*shade),Math.round(b*shade)); },
  drawShafts(){ const g=this.shaftGfx; g.clear(); if(this.shaftOn<=0) return;
    const col=Phaser.Display.Color.GetColor(this._shaftC.r,this._shaftC.g,this._shaftC.b);
    for(const s of this.windows){
      const p1=uvXY(0.0,s.vc-s.hw), p2=uvXY(0.0,s.vc+s.hw), p3=uvXY(this.uLen,s.vc+s.hw+this.sh), p4=uvXY(this.uLen,s.vc-s.hw+this.sh);
      g.fillStyle(col, this.shaftOn*0.4); g.fillPoints([p1,p2,p3,p4],true);
      const q3=uvXY(this.uLen*0.5,s.vc+s.hw+this.sh*0.5), q4=uvXY(this.uLen*0.5,s.vc-s.hw+this.sh*0.5);
      g.fillStyle(col, this.shaftOn*0.3); g.fillPoints([p1,p2,q3,q4],true);   // 窓際を濃く
    }
  },
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
  },
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
  },
  setSkyTheme(theme){
    if(ROOM_TEX[theme]){ this.skyTheme=null; this.setRoom(theme); this.updateLighting(); return; }
    this.setRoom(null); this.skyTheme=(theme&&theme!=='auto')?theme:null; this.updateLighting(); },
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
    g.fillStyle(col,1); g.fillPoints([uvXY(0,0),uvXY(1,0),uvXY(1,1),uvXY(0,1)],true); },
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
};

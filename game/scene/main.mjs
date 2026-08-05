/* Claude Factory — Phaser のシーン本体。
   ここは「工場の盤面そのもの」だけを持つ。分量の大きい3つは役割ごとに切り出して
   ミックスインで混ぜている（Scene のメソッドなので this の意味は変わらない）。
     scene/machine-art.mjs  製造機の見た目
     scene/lighting.mjs     採光と内装
     scene/edit.mjs         レイアウト編集
   UI(game/app.mjs ほか)へは window.__* 経由でしか触らない。 */
import { DECOR, DEMO, KINDS, MACH_ART, MACH_SIZES, PROP_NAMES, SKINS, isFlatProp, machSize, matArt } from './catalog.mjs';
import { Edit } from './edit.mjs';
import { CELL, GU, GV, H, K, W, cellXY, uvXY } from './iso.mjs';
import { Lighting } from './lighting.mjs';
import { MachineArt } from './machine-art.mjs';
import { DOTP, HAT_BASE_Y, HAT_CX, HAT_W_DOT, PRESETS, makeMascot, mascotIcons } from './mascot.mjs';

export class Main extends Phaser.Scene {
  preload(){
    this.load.image('bg_room','assets/rooms/factory-room.png');   // ガラス透過(窓の後ろに空/月/太陽を置く)
    this.load.image('room_arabia','assets/rooms/room-arabia.png');   // Stitch製 テーマ部屋(壁/床/窓 焼き込み)
    this.load.image('room_undersea','assets/rooms/room-undersea.png');
    this.load.image('room_japan','assets/rooms/room-japan.png');
    this.load.image('room_china','assets/rooms/room-china.png');
    this.load.image('room_diner','assets/rooms/room-diner.png');
    this.load.image('room_fantasy','assets/rooms/room-fantasy.png');
    this.load.image('room_scifi','assets/rooms/room-scifi.png');
    this.load.image('room_cabin','assets/rooms/room-cabin.png');
    this.load.image('room_dino','assets/rooms/room-dino.png');
    for(const n of ['haunted','pirate','circuit','dwarf','hell','steampunk','retrofuture','tokyo','halloween','western','sushi','beehive','circus','carnival','desert','jungle','egypt','christmas','space','ice','mushroom','onsen']) this.load.image('room_'+n, `assets/rooms/room-${n}.png`);
    for(const n of PROP_NAMES) this.load.image('prop_'+n, `assets/props/prop_${n}.png`);
    this.load.text('machfit','assets/machines/mach-fit.json');   // 投入口のアンカー。素材アイコンを絵の口に乗せる
    this.load.text('hatfit','assets/hats/hat-fit.json');   // 被り物ごとのツバ中心(cx=幅比)。非対称な飾りでも頭の中心で被る(load.json は中身が壊れるとローダーごと落ちるので text 読み)
    /* 被り物は「用意できているテーマだけ」読む。どれが用意済みかの正は hat-fit.json のキー。
       SKINS 全部(32種)を投機的に読むと、絵が無いぶんだけ 404 がコンソールに並んで
       初見の人には壊れているように見える（描画側は exists チェックで無視していた）。
       hat-fit.json が読めた時点で追加投入する。Phaser はロード中の追加を受け付ける。 */
    this.load.once('filecomplete-text-hatfit', (_key,_type,data)=>{
      let ready={}; try{ ready=JSON.parse(data)||{}; }catch(_){}
      for(const s of SKINS) if(s.id!=='none' && ready[s.id]) this.load.image('hat_'+s.id, `assets/hats/hat-${s.id}.png`);
    });
    for(const d of DECOR) this.load.image('dec_'+d, `assets/objects/obj_${d}.png`);
    // 製造機スプライト(Stitch製)。命名規約 mach_<theme>_s<N>。無いテーマは normal → 手続き描画 の順にフォールバック
    for(const th of MACH_ART) for(const n of MACH_SIZES) this.load.image(`mach_${th}_s${n}`, `assets/machines/mach-${th}-s${n}.png`);
    // 絵から実測したスロット中心(幅/高さ比)。素材アイコンを穴にぴったり載せる。
    // load.json は中身が壊れているとローダーごと例外で落ちる(=create()が走らない)ので text で読んで自前parse

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

    this.occ=new Set(); this.rugOcc=new Set(); this.machineCells=[]; this.placed=[]; this.editMode=false;
    this.partsTheme=null; this.placeDir='u';   // placeDir = 設置プレビューの向き(Rキーで切替)
    this.moveId=null;   // 移動モードで掴んでいる製造機のid(null=移動していない)
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
      matArt:(id)=>matArt(id), machSizes:MACH_SIZES,
      getMachine:(id)=>this.getMachine(id),
      setSlot:(id,i,mat)=>this.setSlot(id,i,mat),
      rotateMachine:(id)=>this.rotateMachine(id),
      moveMachine:(id,c,r)=>this.moveItem(id,c,r),
      // 製造機はドラッグ&ドロップでも動かせるが、設定パネルからの「掴んで床をクリック」移動も残す
      beginMoveMachine:(id)=>this.beginMoveMachine(id),
      cancelMove:()=>this.cancelMove(),
      isMoving:()=>!!this.moveId,
      removeMachine:(id)=>this.removeItem(id),
    };
    this.poll(); this.time.addEvent({delay:1500,loop:true,callback:()=>this.poll()});
  }
  /* ===== 配置レジストリ（位置指定・移動・撤去に対応。編集画面の土台） =====
     製造機だけが複数マス(1〜5)を占有する。占有マスは cellsOf() が唯一の定義。 */
  _remake(e){ this._detach(e); this._makeObjs(e); if(this.editMode) this._enableDrag(e); }

  /* ---- 占有・設置可否 ---- */
  _syncOcc(){ this.occ.clear(); this.rugOcc.clear();
    for(const e of this.placed){
      if(this.isFlat(e)){ this.rugOcc.add(K(e.cell.c,e.cell.r)); continue; }   // ラグは床の平物。マスを塞がない
      for(const q of this.cellsOf(e)) this.occ.add(K(q.c,q.r)); } }
  isRugFree(c,r){ return c>=0&&r>=0&&c<GU&&r<GV && !this.rugOcc.has(K(c,r)); }
  freeRugCell(){ for(let i=0;i<60;i++){ const c=Math.floor(Math.random()*GU), r=Math.floor(Math.random()*GV);
      if(this.isRugFree(c,r)) return {c,r}; }
    for(let c=0;c<GU;c++) for(let r=0;r<GV;r++) if(this.isRugFree(c,r)) return {c,r};
    return null; }
  machineAtCell(c,r){ return this.placed.find(e=>e.kind==='machine' && this.cellsOf(e).some(q=>q.c===c&&q.r===r))||null; }
  entryAtCell(c,r){ return this.placed.find(e=>this.cellsOf(e).some(q=>q.c===c&&q.r===r))||null; }
  /* 仮の entry を作って占有マスを判定する(設置前チェック用) */
  canPlace(kind,c,r,opt){ opt=opt||{};
    if(kind==='prop' && isFlatProp(opt.variant)) return this.isRugFree(c,r);   // ラグは家具の上にも敷ける
    if(kind!=='machine') return this.isFree(c,r);
    const probe={kind:'machine', variant:opt.variant||'s1', dir:opt.dir||'u', cell:{c,r}};
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
        if(this.canPlace('machine',c,r,{variant:opt&&opt.variant,dir})){ if(opt) opt.dir=dir; return {c,r,dir}; }
    return null; }
  addPlaced(kind, variant, extra){ extra=extra||{};
    // 知らない kind(廃止した belt/outlet など)は絵の無い幽霊エントリになるので弾く
    if(KINDS.indexOf(kind)<0) return null;
    if(kind==='deco' && !this.textures.exists('dec_'+variant)) return null;
    if(kind==='machine') variant = 's'+machSize(variant);
    let dir = (kind==='machine') ? (extra.dir==='v'?'v':'u') : undefined;
    // ラグは平物。家具の占有(occ)を無視して敷けるが、ラグ同士(rugOcc)は重ねない
    const flat = kind==='prop' && isFlatProp(variant);
    let cell=extra.cell||null;
    if(cell && !this.canPlace(kind,cell.c,cell.r,{variant,dir})) cell=null;
    if(!cell && extra.strict) return null;              // レイアウト復元: 勝手に別マスへ動かさない
    if(!cell) cell = flat ? this.freeRugCell() : (function(o){ const q=this.autoCell(kind,o); if(q&&q.dir) dir=q.dir; return q; }).call(this,{variant,dir});
    if(!cell) return null;
    const e={ id: extra.id||('o'+(this._oid=(this._oid||0)+1)), kind, variant, lvl:extra.lvl||1,
      cell:{c:cell.c,r:cell.r}, dir, slots:(kind==='machine'? (extra.slots||[]) : undefined) };
    this._makeObjs(e); this.placed.push(e); this._syncOcc();
    if(this.editMode) this._enableDrag(e);
    if(!extra.silent){ const p=cellXY(cell.c,cell.r); this._spawnPop(p.x,p.y); }
    return e.id;
  }
  _detach(e){ for(const o of e.objs) o.destroy(); e._dbase=null;
    // _lit は1枚(deco/prop)のことも、帯に分けた複数枚(製造機)のこともある
    for(const sp of (Array.isArray(e._lit)?e._lit:(e._lit?[e._lit]:[]))){
      const i=this.lit.findIndex(x=>x.sp===sp); if(i>=0)this.lit.splice(i,1); }
    if(e.kind==='machine'){ for(const q of this.cellsOf(e)){
      const i=this.machineCells.findIndex(m=>m.c===q.c&&m.r===q.r); if(i>=0)this.machineCells.splice(i,1); } } }
  // ラグは平物。占有レイヤーが家具(occ)と別なので判定を切り替える
  isFlat(e){ return e.kind==='prop' && isFlatProp(e.variant); }
  removeItem(id){ const i=this.placed.findIndex(x=>x.id===id); if(i<0) return false;
    if(this.sel) this.sel.delete(id);
    this._detach(this.placed[i]); this.placed.splice(i,1); this.lastRemoved=1; this._syncOcc();
    if(this.moveId===id) this.cancelMove();   // 掴んでいた物が消えたら移動モードも抜ける
    if(this._mdrag && this._mdrag.id===id) this._mdrag=null;   // ドラッグ中の物が消えた場合も同様
    if(this._tap && this._tap.id===id) this._tap=null;         // 消えた物の設定パネルは開かない
    return true; }
  moveItem(id,c,r){ const e=this.placed.find(x=>x.id===id); if(!e)return false;
    if(!this.canPlace(e.kind,c,r,{variant:e.variant,dir:e.dir,ignoreId:id})) return false;
    this._detach(e); e.cell={c,r}; this._makeObjs(e); this._syncOcc();
    if(this.editMode) this._enableDrag(e); return true; }
  /* 製造機を90°回転(u軸⇔v軸)。回した先が空いていなければ何もしない */
  rotateMachine(id){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e) return false;
    const nd=(e.dir==='v')?'u':'v';
    if(!this.canPlace('machine',e.cell.c,e.cell.r,{variant:e.variant,dir:nd,ignoreId:id})) return false;
    this._detach(e); e.dir=nd; this._makeObjs(e); this._syncOcc();
    if(this.editMode) this._enableDrag(e); return true; }
  /* ===== 製造機の移動(掴んで置き直す) =====
     複数マスなのでドラッグは無効。設定パネルの「移動」から掴み、床クリックで確定する。
     移動モード中: カーソルに全マスのプレビューが追従 / R=回転 / Esc・本体クリック=キャンセル */
  beginMoveMachine(id){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e) return false;
    if(!this.editMode) this.toggleEdit(true);
    this.moveId=id; if(this.moveTip) this.moveTip.setVisible(true);
    this._drawHover(this.input&&this.input.activePointer); return true; }
  cancelMove(){ if(!this.moveId) return false; this.moveId=null;
    if(this.moveTip) this.moveTip.setVisible(false);
    this._drawHover(this.input&&this.input.activePointer); return true; }
  /* 移動モード中の床クリック。自分のマスならキャンセル、置けなければ知らせて移動モードは維持 */
  _moveDrop(c,r){ const e=this.placed.find(x=>x.id===this.moveId);
    if(!e){ this.cancelMove(); return false; }
    if(this.cellsOf(e).some(q=>q.c===c&&q.r===r)){ this.cancelMove();
      if(window.__toast) window.__toast('移動をやめました'); return false; }
    if(!this.moveItem(e.id,c,r)){ if(window.__toast) window.__toast('そこには置けません…'); return false; }
    this.cancelMove(); if(window.__layoutChanged) window.__layoutChanged();
    if(window.__toast) window.__toast('移動しました'); return true; }
  /* スロット i に素材をセット(null でクリア)。作れる物が即座に変わる */
  setSlot(id,i,mat){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e) return false;
    if(i<0||i>=machSize(e.variant)) return false;
    if(mat!=null && !matArt(mat)) return false;   // 上流(HTML)が知らない素材は受け付けない
    e.slots[i]=mat||null; this._remake(e);
    const p=cellXY(e.cell.c,e.cell.r); this._spawnPop(p.x,p.y); return true; }
  getMachine(id){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e) return null;
    return { id:e.id, size:machSize(e.variant), dir:e.dir, lvl:e.lvl, slots:e.slots.slice(),
      product:e.product?{e:e.product.e,n:e.product.n,unknown:!!e.product.unknown}:null }; }
  /* ドラッグをやめたときに見た目を元へ戻す。製造機は絵が複数あるので掴んだ時点の座標(_dbase)を書き戻す */
  _snapBack(e){
    if(e.kind==='machine'){ for(const b of (e._dbase||[])){ b.o.x=b.x; b.o.y=b.y; } e._dbase=null; return; }
    const p=cellXY(e.cell.c,e.cell.r); if(e.main){ e.main.x=p.x; e.main.y=p.y; } }
  /* ===== 製造UI(factory-phaser.html)との橋渡し ===== */
  machineList(){ return this.placed.filter(e=>e.kind==='machine').map(e=>this.getMachine(e.id)); }
  // 製造の開始/停止・完成で筐体上の表示(製造中/待機中/進捗)が変わるので作り直す
  refreshMachines(){ for(const e of this.placed.filter(x=>x.kind==='machine')) this._remake(e); }
  // 素材のセット/解除のあとに見た目を作り直す(上流UIから呼ばれる)
  refreshMachineBadges(){ for(const e of this.placed.slice()) if(e.kind==='machine') this._remake(e); }
  // 製造完了の演出。対象の製造機の上で絵文字が浮き上がる
  celebrate(emoji, id){ const ms=this.placed.filter(e=>e.kind==='machine');
    const t=(id&&ms.find(e=>e.id===id))||ms[0]; if(!t) return;
    const p=cellXY(t.cell.c,t.cell.r); this._spawnPop(p.x,p.y);
    const tx=this.add.text(p.x,p.y-CELL*1.2,emoji,{fontSize:Math.round(CELL*1.1)+'px'}).setOrigin(0.5,1).setDepth(9001);
    this.tweens.add({targets:tx,y:p.y-CELL*3.2,alpha:0,duration:1500,ease:'Cubic.easeOut',onComplete:()=>tx.destroy()}); }
  getLayout(){ return this.placed.map(e=>{ const o={id:e.id,kind:e.kind,variant:e.variant,lvl:e.lvl,c:e.cell.c,r:e.cell.r};
    if(e.kind==='machine'){ o.dir=e.dir; o.slots=e.slots.slice(); } return o; }); }
  /* 旧レイアウトの移行: コンベア/出荷口は廃止したので捨てる。旧4種の製造機(red等)は1マス機に読み替える。 */
  buildLayout(list){
    for(const e of this.placed.slice()){ this._detach(e); }
    this.placed=[]; this._syncOcc();
    let dropped=0;
    for(const it of (list||[])){
      if(it.kind==='belt'||it.kind==='outlet'){ dropped++; continue; }
      const variant=(it.kind==='machine') ? ('s'+machSize(it.variant)) : it.variant;
      this.addPlaced(it.kind, variant, {cell:{c:it.c,r:it.r}, lvl:it.lvl, id:it.id, dir:it.dir, slots:it.slots, silent:true});
    }
    this._oid=Math.max(0,...this.placed.map(e=>parseInt(String(e.id).replace(/\D/g,''))||0));
    return dropped; }
  setMachineLevel(id,lvl){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e)return; e.lvl=lvl; this._remake(e); }
  // 旧API互換（ショップ購入から呼ばれる）
  placeMachine(variant){ return this.addPlaced('machine', variant); }
  placeDeco(variant){ return this.addPlaced('deco', variant); }
  placeEmojiDeco(emoji){ return this.addPlaced('emoji', emoji); }
  placeProp(name){ if(!this.textures.exists('prop_'+name)) return null; return this.addPlaced('prop', name); }
  syncMachines(list){ for(const m of (list||[])) this.addPlaced('machine', 's'+machSize(m.variant), {lvl:m.lvl||1}); }
  isFree(c,r){ return c>=0&&r>=0&&c<GU&&r<GV && !this.occ.has(K(c,r)); }
  // ラグは家具とは別レイヤーで1マス1枚。家具のあるマスにも敷けるが、ラグ同士は重ねない
  isRugFree(c,r){ return c>=0&&r>=0&&c<GU&&r<GV && !this.rugOcc.has(K(c,r)); }
  freeRugCell(){ for(let i=0;i<80;i++){ const c=1+Math.floor(Math.random()*(GU-2)), r=1+Math.floor(Math.random()*(GV-2)); if(this.isRugFree(c,r)) return {c,r}; }
    for(let c=0;c<GU;c++) for(let r=0;r<GV;r++) if(this.isRugFree(c,r)) return {c,r};
    return {c:1,r:1}; }
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
      const hf=(this.hatFit())[a.skinId];
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
    // エージェント一覧は factory-phaser.html が /api/state で一括取得しているので
    // そこから受け取る（同じ情報を2本のエンドポイントで取りに行かない）
    let d=null;
    try{ d = (typeof window.__agentFeed==='function') ? window.__agentFeed() : null; }catch(_){}
    // まだ1回もポーリングが返っていない間だけ、絵作りのためのダミーを出す
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
    // 毎ポーリング呼ばれる。innerHTML の貼り替えだと数字を選択するたびに解除され、
    // <img> も読み直しでちらつくので、UI側の差分適用(morphInto)に載せる
    if(this.hud){ const ic=mascotIcons();
      window.morphInto(this.hud,
        `<span class="st" title="稼働中"><img src="${ic.work}" alt=""><i class="fx">✨</i><b>${busyN}</b></span>`+
        `<span class="st" title="休憩中"><img src="${ic.sit}" alt=""><i class="fx">☕</i><b class="idle">${idleN}</b></span>`); }
  }
  update(time){
    // 星のまたたき(夜)
    if(this.stars && this.lightOn>0){ for(const s of this.stars) s.setAlpha(this.lightOn*(0.35+0.65*Math.abs(Math.sin(time*0.002+s.ph)))); }
    // 製造の進行(WP→製品)は factory-phaser.html の tickCraft が持つ。完成演出は celebrate() 経由。
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

/* 切り出したメソッド群をプロトタイプに混ぜる。定義の場所が変わるだけで、
   呼び出し側から見た this.xxx() は今までどおり。 */
Object.assign(Main.prototype, MachineArt, Lighting, Edit);

// HTML側が #game を CSS transform で動かす(編集モードの寄せ)。transform はレイアウトを
// 変えないので Phaser は気づけない。境界を取り直せるよう Game を公開しておく。
window.__game = new Phaser.Game({
  type: Phaser.AUTO, parent:'game', width:W, height:H, backgroundColor:'#0c1014', pixelArt:true,
  scale:{ mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH }, scene:[Main],
});

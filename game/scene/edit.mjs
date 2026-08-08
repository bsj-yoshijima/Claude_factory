/* 🔧 レイアウト編集 — 掴み手・ドラッグ・ホバー表示・収納・複数選択。 */
import { STOWABLE, machSize } from './catalog.mjs';
import { CELL, DRAG_SLOP, GU, GV, H, OFF_U, OFF_V, W, cellXY, screenToIso, uvXY } from './iso.mjs';



export const Edit = {
  /* 設置時のポップ演出 */
  _spawnPop(x,y){ const g=this.add.circle(x,y-CELL*0.5,CELL*0.6,0xffe9a8,0.5).setDepth(9000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:g,scale:1.8,alpha:0,duration:420,onComplete:()=>g.destroy()}); },
  /* ===== 編集モード（グリッド表示・ドラッグ移動・ゴミ箱で撤去） ===== */
  setupEdit(){
    // 床ダイヤ[0,1]²を綺麗な12×12に等分する線だけを表示(中心点は出さない)。オブジェクトは各マスの中央に入る。
    // 線は2px・不透明度0.6。1px/0.42 だと明るい床(大理石)や寒色の床(氷)で線が埋もれて
    // マスの境目が読めない部屋があった。太さだけでは足りず、濃さの方が効く
    this.editGrid=this.add.graphics().setDepth(-998).setVisible(false); this.editGrid.lineStyle(2,0x7fe6ff,0.6);
    const gl=(u0,v0,u1,v1)=>{ const a=uvXY(u0,v0),b=uvXY(u1,v1); this.editGrid.beginPath(); this.editGrid.moveTo(a.x,a.y); this.editGrid.lineTo(b.x,b.y); this.editGrid.strokePath(); };
    // 目地はマス境界(c/GU)に引く(13本) → 各マスの中心=設置点が四角のど真ん中になる
    for(let c=0;c<=GU;c++) gl(c/GU,0,c/GU,1);
    for(let r=0;r<=GV;r++) gl(0,r/GV,1,r/GV);
    // マスハイライト(設置先=緑/赤・設置済み=占有マス)。床の上・オブジェクトの下。オブジェクトが四角の中に入るのが見える。
    this.hoverGfx=this.add.graphics().setDepth(-1).setVisible(false);
    this.input.on('pointermove',(po)=>this._drawHover(po));
    this.trash=this.add.container(72,H-52,[ this.add.rectangle(0,0,124,72,0x3a1418,0.85).setStrokeStyle(2,0xe05a4e), this.add.text(0,0,'🗑 ここへ撤去',{fontSize:'13px',color:'#ffd0c8'}).setOrigin(0.5) ]).setDepth(8600).setVisible(false);
    this._trashRect=new Phaser.Geom.Rectangle(10,H-88,124,74);
    // 移動モード中の案内(ゴミ箱と同じ要領。画面上部の中央)
    this.moveTip=this.add.container(W/2,26,[ this.add.rectangle(0,0,336,34,0x123a2e,0.88).setStrokeStyle(2,0x33ffcc),
      this.add.text(0,0,'↔ 移動先の床をクリック ・ R:回転 ・ Esc:やめる',{fontSize:'13px',color:'#c8fff0'}).setOrigin(0.5) ]).setDepth(8600).setVisible(false);
    /* 選択中のキーの案内。回転の入口がRキーだけなので、選んだ時点で見せる。
       盤面ではなく右下に固定する(物の上に出すと家具に重なって読めない)。
       ゴミ箱が左下なので、左右で場所が分かれる。右端から左へ伸ばす。 */
    this.pickGfx=this.add.graphics().setDepth(-1).setVisible(false);
    this.pickTipText=this.add.text(-11,0,'',{fontSize:'13px',color:'#ccf7ff'}).setOrigin(1,0.5);
    this.pickTipBg=this.add.rectangle(0,0,10,34,0x0d2c33,0.88).setStrokeStyle(2,0x00e5ff).setOrigin(1,0.5);
    this.pickTip=this.add.container(W-14,H-52,[this.pickTipBg,this.pickTipText]).setDepth(8600).setVisible(false);
    // 床クリック: 製造機の上なら設定パネル、空きマスならパレットで選択中のアイテムを設置
    this.input.on('pointerdown',(po,over)=>{
      if(this.selectMode) return;   // 収納の選択中は設置も移動もしない
      const uv=screenToIso(po.x,po.y);
      const c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
      // 移動モード中は設定パネルも新規設置も抑止。床クリック=移動先の確定
      if(this.moveId){ this._placedPtr=true; this._moveDrop(c,r); return; }
      // 床マスの外(筐体の高さぶん)を掴んだときも拾えるよう、当たり判定に出ている製造機も見る
      const hit=(over&&over.length&&over[0]&&over[0]._e)||null;
      const m=this.machineAtCell(c,r) || ((hit&&hit.kind==='machine')?hit:null);
      /* 通常モードの製造機クリックは素材パネル(素材設定がコア機能なので)。
         編集モード中は「選択」だけにする。編集中にパネルが出ると、並べ替えの最中に
         別の作業のダイアログが割り込むことになる。 */
      /* 選択は「押した時点」で切り替える。離した時点にすると、別の物を選んだまま
         また別の物をドラッグでき、光っている物と動かしている物が食い違う。 */
      if(m){ this._placedPtr=true;
        if(this.editMode){ this._pick(m.id); return; }
        if(window.__openMachine) window.__openMachine(m.id); return; }
      if(!this.editMode) return;
      /* 装飾品も編集中はクリックで選べる。拾うのは「絵」だけで、床のマスからは引かない:
         ラグは家具の上にも敷けるので、マスで拾うとラグを重ねて置けなくなる。 */
      const pr=(hit&&hit.kind==='prop')?hit:null;
      if(pr){ this._placedPtr=true; this._pick(pr.id); return; }
      this._clearPick();                       // 何も無い床をクリック=選択を解除
      if(over&&over.length) return;
      const sel=window.__editSel; if(!sel) return;
      const opt=(sel.kind==='machine'||sel.kind==='prop')?{variant:sel.variant,dir:this.placeDir||'u'}:null;
      if(!this.canPlace(sel.kind,c,r,opt)){ if(window.__toast) window.__toast(
        sel.kind==='machine' ? `そこには置けません（${machSize(sel.variant)}マスぶんの空きが必要）` : 'そこには置けません'); return; }
      this._placedPtr=true; if(window.__editPlaceAt) window.__editPlaceAt(c,r); });
    // 設置前の向き切替(Rキー)。製造機と装飾品に効く
    this.input.keyboard.on('keydown-R',()=>{ if(!this.editMode) return;
      if(this.moveId){   // 移動モード中は掴んでいる製造機そのものを回す
        if(!this.rotateMachine(this.moveId)){ if(window.__toast) window.__toast('回した先に空きがありません'); return; }
        if(window.__layoutChanged) window.__layoutChanged();
        this._drawHover(this.input.activePointer); return; }
      /* 選択中の物があればそれを回す。これが一番はっきりした入口で、カーソルの位置に
         依存しない(下のホバー経由は、選ばずにいきなり回したいとき用に残してある)。 */
      const pk=this.pickId && this.placed.find(x=>x.id===this.pickId);
      if(pk){
        if(!this._canRotate(pk)){ if(window.__toast) window.__toast('この装飾品は回せません'); return; }
        const ok=(pk.kind==='machine') ? this.rotateMachine(pk.id) : this.rotateProp(pk.id);
        if(!ok){ if(window.__toast) window.__toast('回した先に空きがありません'); return; }
        if(window.__layoutChanged) window.__layoutChanged();
        this._drawPick(); this._drawHover(this.input.activePointer); return; }
      /* 設置済みの装飾品の上でRを押したらその物を回す。装飾品には設定パネルが無いので、
         これが回転の入口になる(製造機はパネルの「移動」→R)。
         見ている絵を先に拾う。床のマスから引くだけだと、背の高い物(屏風・ランプ)は
         絵が自分のマスよりずっと上に描かれるので、絵を指しているのにカーソル下の床は
         2〜3マス奥の別マスになり、Rが空振りして「向き」の切替に落ちていた。
         pointerdown が製造機で同じ手(over[0]._e)を使っている。 */
      const po=this.input.activePointer;
      if(po){ const uv=screenToIso(po.x,po.y);
        const c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
        const hit=this.input.hitTestPointer(po).find(o=>o&&o._e&&o._e.kind==='prop');
        const at=(hit&&hit._e) || this.entryAtCell(c,r);
        if(at && at.kind==='prop'){
          if(!this.rotateProp(at.id)){ if(window.__toast) window.__toast('回した先に空きがありません'); return; }
          if(window.__layoutChanged) window.__layoutChanged();
          this._drawHover(po); return; } }
      this.placeDir=(this.placeDir==='v')?'u':'v';
      if(window.__toast) window.__toast('向き: '+(this.placeDir==='v'?'↙ 手前方向':'↘ 奥方向')); });
    // 移動のキャンセル / 選択の解除(Escキー)
    this.input.keyboard.on('keydown-ESC',()=>{
      if(this.moveId){ this.cancelMove(); if(window.__toast) window.__toast('移動をやめました'); return; }
      if(this.pickId) this._clearPick(); });
    // 製造機のドラッグ開始。絵が複数(筐体graphics＋素材の文字など)あるので掴んだ時点の座標を控える
    this.input.on('dragstart',(po,obj)=>{ if(!this.editMode||!obj||!obj._e) return; const e=obj._e;
      if(this.moveId) return;                       // 移動モード中はドラッグしない
      this._pick(e.id);                             // 掴んだ物を選択中にする(押した時点と同じ)
      if(e.kind!=='machine'){
        /* 装飾品も掴んだ時点の「絵の原点」と「マスの中心」を控える。
           落とし先は原点の移動量をマス中心に足して求める。
           絵の原点から直に逆算してはいけない: 新規格の絵は原点がマス中心ではなく
           接地菱形の手前角なので、半マス手前のマスに落ちる。 */
        const p0=cellXY(e.cell.c,e.cell.r);
        this._pdrag={ id:e.id, ax:obj.x, ay:obj.y, cx:p0.x, cy:p0.y };
        return;
      }
      const p=cellXY(e.cell.c,e.cell.r);
      // 起点は「押した位置」。dragstart は最初に動かした時点で飛ぶので po.x を使うとその分ずれる
      const x0=(po.downX!=null)?po.downX:po.x, y0=(po.downY!=null)?po.downY:po.y;
      this._mdrag={ id:e.id, x0, y0, px:p.x, py:p.y, c:e.cell.c, r:e.cell.r, moved:false };
      e._dbase=(e.objs||[]).map(o=>({o, x:o.x, y:o.y})); });
    this.input.on('drag',(po,obj,dx,dy)=>{ if(!this.editMode||!obj._e) return; const e=obj._e;
      if(e.kind==='machine'){ const d=this._mdrag; if(!d||d.id!==e.id) return;
        const ddx=po.x-d.x0, ddy=po.y-d.y0;
        if(Math.hypot(ddx,ddy)>DRAG_SLOP) d.moved=true;
        for(const b of (e._dbase||[])){ b.o.x=b.x+ddx; b.o.y=b.y+ddy; }
        // 落とし先のマスは「掴んだ製造機の基準マス」を運んだ位置から求める(プレビューと一致させる)
        const uv=screenToIso(d.px+ddx, d.py+ddy);
        d.c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1); d.r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
        this._drawHover(po); return; }
      obj.x=dx; obj.y=dy;
      // 装飾品も落とし先をプレビューする(複数マスの物は占有ぶん全部光る)
      const d=this._pdrag;
      if(d && d.id===e.id){
        const uv=screenToIso(d.cx+(obj.x-d.ax), d.cy+(obj.y-d.ay));
        d.c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1);
        d.r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
        this._drawHover(po);
      } });
    this.input.on('dragend',(po,obj)=>{ if(!this.editMode||!obj._e)return; const e=obj._e;
      if(e.kind==='machine'){ const d=this._mdrag; this._mdrag=null;
        if(!d||d.id!==e.id){ this._snapBack(e); return; }
        if(!d.moved){ this._snapBack(e); this._drawHover(po); return; }   // ほぼ動いていない=クリック扱い(ゴミ箱の上でも消さない)
        if(Phaser.Geom.Rectangle.Contains(this._trashRect,po.x,po.y)){
          this.removeItem(e.id); if(window.__layoutChanged)window.__layoutChanged(); this._drawHover(po); return; }
        if(!this.moveItem(e.id,d.c,d.r)){ this._snapBack(e);
          if(window.__toast) window.__toast('そこには置けません…'); }
        if(window.__layoutChanged)window.__layoutChanged(); this._drawHover(po); return; }
      if(Phaser.Geom.Rectangle.Contains(this._trashRect,po.x,po.y)){
        this.removeItem(e.id); if(window.__layoutChanged)window.__layoutChanged(); return; }
      // マス中心を「絵の原点が動いたぶん」だけ運んだ点から落とし先を決める(dragstart 参照)
      const d=this._pdrag; this._pdrag=null;
      const at=(d&&d.id===e.id) ? {x:d.cx+(obj.x-d.ax), y:d.cy+(obj.y-d.ay)} : {x:obj.x, y:obj.y};
      const uv=screenToIso(at.x,at.y); let c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
      if(!this.moveItem(e.id,c,r)) this._snapBack(e);
      if(window.__layoutChanged)window.__layoutChanged();
      if(this.pickId===e.id) this._drawPick(); });
  }
  /* 製造機の掴み手。main は Graphics で当たり判定を持たないので、占有マスの外周＋筐体の高さぶんの
     多角形(見た目のシルエット)を渡す。A(最奥) B C(最手前) D の上辺と手前2面を結んだ6角形。 */,
  _machHit(e){ const [A,B,C,D]=this._machFootprint(e), h=e._hgt||0;
    return new Phaser.Geom.Polygon([A.x,A.y-h, B.x,B.y-h, B.x,B.y, C.x,C.y, D.x,D.y, D.x,D.y-h]); },
  // 通常は「ドラッグで移動」、収納の選択モード中は「クリックで選択」に付け替える
  _enableDrag(e){ const m=e.main; if(!m)return; m._e=e;
    if(e.kind==='machine') m.setInteractive({ hitArea:this._machHit(e), hitAreaCallback:Phaser.Geom.Polygon.Contains, useHandCursor:true });
    else m.setInteractive({useHandCursor:true});
    m.removeAllListeners('pointerdown');
    const selectable = this.selectMode && STOWABLE.includes(e.kind);
    this.input.setDraggable(m, !this.selectMode);
    if(selectable) m.on('pointerdown', ()=>this.toggleSelect(e.id)); },
  _disableDrag(e){ const m=e.main; if(!m)return; this.input.setDraggable(m,false); m.removeAllListeners('pointerdown'); m.disableInteractive(); m._e=null; },
  /* ===== 編集中の「選択中」 =====
     置いてある物をクリックすると選ばれ、占有マスが光り、その上にキーの案内が出る。
     window.__editSel(パレットで選んだ品目)や sel(収納の複数選択)とは別物。 */
  _canRotate(e){
    if(!e) return false;
    if(e.kind!=='prop') return true;
    // 旧290体の装飾品は1マス固定で絵の反転も効かない。回してもだんまりになるので断る
    const f=this.propFit()[e.variant];
    return !!(f && f.baked && f.shape);
  },
  _pick(id){ const e=this.placed.find(x=>x.id===id); if(!e) return;
    this.pickId=id; this._drawPick(); },
  _clearPick(){ if(!this.pickId && !(this.pickGfx&&this.pickGfx.visible)) return;
    this.pickId=null;
    if(this.pickGfx){ this.pickGfx.clear(); this.pickGfx.setVisible(false); }
    if(this.pickTip) this.pickTip.setVisible(false); },
  _drawPick(){ const g=this.pickGfx; if(!g) return;
    const e=this.pickId && this.editMode && !this.selectMode && this.placed.find(x=>x.id===this.pickId);
    if(!e){ this._clearPick(); return; }                 // 撤去・編集終了などで居なくなった
    g.clear(); g.setVisible(true);
    for(const q of this.cellsOf(e)){ if(q.c<0||q.r<0||q.c>=GU||q.r>=GV) continue;
      g.fillStyle(0x00e5ff,0.22); this._diamond(g,q.c,q.r); g.fillPath();
      g.lineStyle(2,0x00e5ff,0.95); this._diamond(g,q.c,q.r); g.strokePath(); }
    const rot=this._canRotate(e);
    this.pickTipText.setText(rot ? '選択中 ・ R:回転 ・ Esc:解除' : '選択中 ・ この物は回せません ・ Esc:解除');
    // Rectangle は width への代入では形が変わらない(geom を持っている)。setSize を使う
    this.pickTipBg.setSize(this.pickTipText.width + 22, 34);
    this.pickTip.setVisible(true); },
  _diamond(g,c,r){ const p0=uvXY(c/GU,r/GV),p1=uvXY((c+1)/GU,r/GV),p2=uvXY((c+1)/GU,(r+1)/GV),p3=uvXY(c/GU,(r+1)/GV);
    g.beginPath(); g.moveTo(p0.x,p0.y); g.lineTo(p1.x,p1.y); g.lineTo(p2.x,p2.y); g.lineTo(p3.x,p3.y); g.closePath(); },
  _drawHover(po){ const g=this.hoverGfx; if(!g)return;
    /* 選択中の光もここで引き直す。物を動かすと絵が作り直されて占有マスが変わるので、
       置きっぱなしにすると光だけ元の場所に残る。ホバーは毎フレームではなく
       ポインタが動いたときだけなので、菱形を数枚引く程度の負荷で足りる。 */
    if(this.pickId) this._drawPick();
    if(!this.editMode){ g.clear(); g.setVisible(false); return; }
    g.clear(); g.setVisible(true);
    g.fillStyle(0x7fe6ff,0.10);   // 設置済みマスをうっすら塗る(=各オブジェクトが入っている四角)
    for(const e of this.placed) for(const q of this.cellsOf(e)){ this._diamond(g,q.c,q.r); g.fillPath(); }
    // ドラッグ中の装飾品は落とし先の占有マスをプレビュー(1×2 なら2マスとも光る)
    const pd=this.moveId?null:this._pdrag;
    if(pd && pd.c!=null){
      const pe=this.placed.find(x=>x.id===pd.id);
      if(pe){ const ok=this.canPlace(pe.kind,pd.c,pd.r,{variant:pe.variant,dir:pe.dir,ignoreId:pe.id});
        this._paintCells(this.cellsOf({kind:pe.kind,variant:pe.variant,dir:pe.dir,cell:{c:pd.c,r:pd.r}}),
          ok?0x33ffcc:0xe0674e);
        return; }
    }
    // 移動モード中/ドラッグ中は掴んでいる製造機のサイズ・向きぶんをプレビュー(自分の占有は無視して判定)
    const d=this.moveId?null:this._mdrag, mvId=this.moveId||(d&&d.id);
    const mv=mvId && this.placed.find(x=>x.id===mvId);
    if(mv){ let c,r;
      if(d){ c=d.c; r=d.r; }
      else { if(!po) return; const uv=screenToIso(po.x,po.y);
        c=Phaser.Math.Clamp(Math.floor(uv.u*GU),0,GU-1); r=Phaser.Math.Clamp(Math.floor(uv.v*GV),0,GV-1); }
      const ok=this.canPlace('machine',c,r,{variant:mv.variant,dir:mv.dir,ignoreId:mv.id});
      this._paintCells(this.cellsOf({kind:'machine',variant:mv.variant,dir:mv.dir,cell:{c,r}}), ok?0x33ffcc:0xe0674e);
      return; }
    const sel=window.__editSel;
    if(sel && po){ const uv=screenToIso(po.x,po.y);
      const c=Phaser.Math.Clamp(Math.floor(uv.u*GU),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV),0,GV-1);
      const opt=(sel.kind==='machine'||sel.kind==='prop')?{variant:sel.variant,dir:this.placeDir||'u'}:null;
      const ok=this.canPlace(sel.kind,c,r,opt);
      // 製造機と装飾品は占有する全マスをプレビュー(Rキーで向き切替)
      const cells=(sel.kind==='machine'||sel.kind==='prop')
        ? this.cellsOf({kind:sel.kind,variant:sel.variant,dir:this.placeDir||'u',cell:{c,r}}) : [{c,r}];
      this._paintCells(cells, ok?0x33ffcc:0xe0674e); }
  },
  /* プレビューのマス塗り(置ける=緑/置けない=赤)。設置プレビューと移動プレビューで共用 */
  _paintCells(cells,col){ const g=this.hoverGfx;
    for(const q of cells){ if(q.c<0||q.r<0||q.c>=GU||q.r>=GV) continue;
      g.fillStyle(col,0.30); this._diamond(g,q.c,q.r); g.fillPath();
      g.lineStyle(2,col,0.95); this._diamond(g,q.c,q.r); g.strokePath(); } },
  toggleEdit(on){ this.editMode=(on==null)?!this.editMode:!!on; this.editGrid.setVisible(this.editMode);
    this._clearPick();
    if(!this.editMode){ this.setSelectMode(false);
      this.cancelMove();   // 編集を抜けたら移動モードも解除(元の位置のまま)
      if(this._mdrag){ const dg=this.placed.find(x=>x.id===this._mdrag.id); this._mdrag=null; if(dg) this._snapBack(dg); } }
    this.trash.setVisible(this.editMode && !this.selectMode);
    if(this.hoverGfx){ this.hoverGfx.clear(); this.hoverGfx.setVisible(false); }
    for(const e of this.placed){ this.editMode?this._enableDrag(e):this._disableDrag(e); } return this.editMode; },
  /* ===== 収納(在庫に戻す) ===== */
  stowables(){ return this.placed.filter(e=>STOWABLE.includes(e.kind)); },
  stowAll(){ const list=this.stowables(); for(const e of list) this.removeItem(e.id); this._drawSel(); return list.length; },
  setSelectMode(on){ const v=!!on; if(v===!!this.selectMode) return v;
    this.selectMode=v; this.sel=new Set(); this._clearPick();
    this.trash.setVisible(this.editMode && !v);
    for(const e of this.placed) if(this.editMode) this._enableDrag(e);
    this._drawSel(); this._notifySel(); return v; },
  toggleSelect(id){ if(!this.sel) this.sel=new Set();
    this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id);
    this._drawSel(); this._notifySel(); },
  stowSelected(){ const ids=[...(this.sel||[])]; for(const id of ids) this.removeItem(id);
    this.sel=new Set(); this._drawSel(); this._notifySel(); return ids.length; },
  _notifySel(){ if(window.__selChanged) window.__selChanged(this.sel?this.sel.size:0); },
  _drawSel(){ if(!this.selGfx) this.selGfx=this.add.graphics().setDepth(8400);
    const g=this.selGfx; g.clear(); if(!this.selectMode) return;
    for(const e of this.placed){ if(!this.sel || !this.sel.has(e.id)) continue;
      const p=cellXY(e.cell.c,e.cell.r);
      g.fillStyle(0x7fe6ff,0.20); g.fillEllipse(p.x,p.y-2,CELL*1.12,CELL*0.56);
      g.lineStyle(2,0x7fe6ff,0.95); g.strokeEllipse(p.x,p.y-2,CELL*1.12,CELL*0.56); } }
  /* 窓オブジェクトを座標で定義(左壁 u=0)。床エッジ uvXY(0,v) を基準に壁の高さ方向へ立ち上げる。
     光源(採光の床帯・月/星のマスク)はすべてこの窓定義から導出する。 */
};

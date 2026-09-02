/* 製造機の見た目 — 占有マスの形・スプライトの切り出し・手続き描画。
   Scene のメソッドとして書かれているので this の意味を変えないようミックスインで渡す。 */
import { MACH_DRAW, MACH_GEO, PART_PAL, PART_SKIN_BY_THEME, PROP_FIT, RUG_DEPTH, isFlatProp, machSize, matArt, matTexKey, propShape, propSpan, recipeFor } from './catalog.mjs';
import { CELL, GU, GV, blockIso, cellXY, uvXY } from './iso.mjs';



export const MachineArt = {
  /* 装飾品が床のいくつ分を占めるか [列,行]。dir==='v' で 90度回した形になる。
     新規格(焼き込み済み)の絵だけが複数マスを占める。旧290体は今までどおり1マス:
     占有を後から広げると、保存済みのレイアウトが2マス目で衝突して復元できなくなる。 */
  propBlock(e){
    if(e.kind!=='prop') return [1,1];
    const f=this.propFit()[e.variant];
    if(!f||!f.baked||!f.shape) return [1,1];
    const [n,m]=f.shape;
    return (e.dir==='v') ? [m,n] : [n,m];
  },
  cellsOf(e){
    if(e.kind==='prop'){ const [n,m]=this.propBlock(e), out=[];
      for(let i=0;i<n;i++) for(let j=0;j<m;j++) out.push({c:e.cell.c+i, r:e.cell.r+j});
      return out; }
    if(e.kind!=='machine') return [e.cell];
    const n=machSize(e.variant), du=(e.dir==='v')?0:1, dv=(e.dir==='v')?1:0, out=[];
    for(let i=0;i<n;i++) out.push({c:e.cell.c+du*i, r:e.cell.r+dv*i});
    return out; },
  /* 製造機の占有マス群の外周(uv)。描画とヒット判定で共用 */
  _machFootprint(e){ const n=machSize(e.variant), IN=MACH_GEO.inset;
    const c0=e.cell.c, r0=e.cell.r, du=(e.dir==='v')?0:1, dv=(e.dir==='v')?1:0;
    const u0=(c0+IN)/GU, u1=(c0+du*(n-1)+1-IN)/GU, v0=(r0+IN)/GV, v1=(r0+dv*(n-1)+1-IN)/GV;
    return [uvXY(u0,v0), uvXY(u1,v0), uvXY(u1,v1), uvXY(u0,v1)];   // A(最奥) B C(最手前) D
  }
  /* 占有マスを1マスずつの外周(uv)に切る。inset は両端だけ効かせ、マス同士の継ぎ目は詰める
     (union が _machFootprint と一致する = 隙間も重なりも出ない) */,
  _machCellQuads(e){ const n=machSize(e.variant), IN=MACH_GEO.inset;
    const c0=e.cell.c, r0=e.cell.r, du=(e.dir==='v')?0:1, dv=(e.dir==='v')?1:0, out=[];
    for(let i=0;i<n;i++){
      const h0=(i===0)?IN:0, h1=(i===n-1)?IN:0;
      const u0=(c0+du*i+(du?h0:IN))/GU, u1=(c0+du*i+1-(du?h1:IN))/GU;
      const v0=(r0+dv*i+(dv?h0:IN))/GV, v1=(r0+dv*i+1-(dv?h1:IN))/GV;
      out.push([uvXY(u0,v0), uvXY(u1,v0), uvXY(u1,v1), uvXY(u0,v1)]);   // A(最奥) B C(最手前) D
    }
    return out; },
  /* マス i の外周のうち隣と接していない辺だけを描く(継ぎ目に線を出さない)。辺は A-B, B-C, C-D, D-A の順 */
  _strokeOuter(g,q,i,n,dir){
    const ext=(dir==='v') ? [i===0, true, i===n-1, true] : [true, i===n-1, true, i===0];
    for(let k=0;k<4;k++){ if(!ext[k]) continue; const p=q[k], r=q[(k+1)%4];
      g.beginPath(); g.moveTo(p.x,p.y); g.lineTo(r.x,r.y); g.strokePath(); } },
  /* 凸多角形を縦の帯 [xa,xb] で切る(Sutherland-Hodgman)。土台を自分の帯の中に閉じ込めるのに使う */
  _clipX(pts, xa, xb){
    const cut=(pl, keep, edge)=>{ const out=[];
      for(let i=0;i<pl.length;i++){ const p=pl[i], q=pl[(i+1)%pl.length];
        const kp=keep(p), kq=keep(q);
        if(kp) out.push(p);
        if(kp!==kq && q.x!==p.x){ const t=(edge-p.x)/(q.x-p.x); out.push({x:edge, y:p.y+(q.y-p.y)*t}); } }
      return out; };
    const l=cut(pts, p=>p.x>=xa, xa);
    return l.length ? cut(l, p=>p.x<=xb, xb) : l; },
  _makeObjs(e){ const {c,r}=e.cell; const p=cellXY(c,r); const u=(c+0.5)/GU, v=(r+0.5)/GV;
    const tint=this.tintByLight(u,v); const objs=[]; let main=null; e._lit=null;
    if(e.kind==='machine'){
      this._makeMachine(e, objs); main=e.main;
      for(const q of this.cellsOf(e)) this.machineCells.push({c:q.c,r:q.r});
    } else if(e.kind==='deco'){
      const img=this.add.image(p.x,p.y,'dec_'+e.variant).setOrigin(0.5,1).setDepth(p.y); img.setScale(1.0*CELL/img.height).setTint(tint);
      const sh=this.add.image(p.x+CELL*0.2,p.y+CELL*0.1,'shadow').setDepth(p.y-0.5).setRotation(0.5).setDisplaySize(img.displayWidth*1.05,img.displayWidth*0.5).setAlpha(0.5);
      objs.push(sh,img); main=img; e._lit=img; this.lit.push({sp:img,u,v});
    } else if(e.kind==='prop'){
      const img=this.propImage(e);
      const flat=isFlatProp(e.variant);
      img.setTint(tint);
      if(!flat){
        // 影は絵ではなく接地菱形に合わせる。絵の幅に合わせると、傘が横へ張り出した
        // ランプのように「足元より絵が広い」物で影だけ大きくなる。位置も絵の原点(菱形の
        // 手前角)ではなく菱形の中心に置く
        const [n,m]=propShape(e.variant), b=blockIso(c,r,n,m);
        const sh=this.add.image((b.back.x+b.front.x)/2+CELL*0.2,(b.back.y+b.front.y)/2+CELL*0.09,'shadow')
          .setDepth(img.depth-0.5).setRotation(0.5)
          .setDisplaySize(b.w*PROP_FIT.foot,b.w*PROP_FIT.foot*0.46).setAlpha(0.5);
        objs.push(sh);
      }
      objs.push(img); main=img; e._lit=img; this.lit.push({sp:img,u,v});
    } else if(e.kind==='emoji'){
      const sh=this.add.image(p.x+CELL*0.16,p.y+CELL*0.05,'shadow').setDepth(p.y-0.6).setRotation(0.5).setDisplaySize(CELL*0.72,CELL*0.32).setAlpha(0.42);
      const t=this.add.text(p.x,p.y-CELL*0.12,e.variant,{fontSize:Math.round(CELL*1.05)+'px'}).setOrigin(0.5,1).setDepth(p.y);
      objs.push(sh,t); main=t;
    }
    if(e.kind!=='machine'){ e.objs=objs; e.main=main; }
    return e;
  }
  /* ---- 製造機の描画。スプライト(mach_<theme>_s<N>)があればそれ、無ければ手続きの筐体。
       どちらの場合も「1マス=スロット1つ」の位置は占有マスから計算するので、素材アイコンは必ずマスに乗る。 ---- */,
  machTex(e){ const n=machSize(e.variant);
    for(const th of [this.partsTheme, 'normal']){ const k=`mach_${th}_s${n}`;
      if(th && this.textures.exists(k)) return {key:k, theme:th, n}; }
    return null; },
  /* 絵のスロット中心(幅/高さ比)。v向きは左右反転して描くので x も反転する */
  machFit(){ if(this._machFit) return this._machFit;
    try{ this._machFit=JSON.parse(this.cache.text.get('machfit')||'{}'); }catch(_){ this._machFit={}; }
    return this._machFit; },
  hatFit(){ if(this._hatFit) return this._hatFit;
    try{ this._hatFit=JSON.parse(this.cache.text.get('hatfit')||'{}'); }catch(_){ this._hatFit={}; }
    return this._hatFit; },
  /* 絵から実測した装飾品の足元(cx=中心x, by=接地の高さ, bw=足元の幅, w/left=bbox。すべて画像に対する比) */
  propFit(){ if(this._propFit) return this._propFit;
    try{ this._propFit=JSON.parse(this.cache.text.get('propfit')||'{}'); }catch(_){ this._propFit={}; }
    return this._propFit; }
  /* ---- 装飾品の1枚。「足元の中心を、占有ブロックの接地菱形の手前角に合わせる」だけで
       大きさも位置も決まる(catalog.mjs の PROP_FIT)。手前角は菱形の中心 x でもあるので、
       絵は必ずマスの中央に立つ。傘のように上が張り出す物は maxW で頭打ちにする。
       実測(prop-fit.json)が無い個体は、旧来の「絵の高さ基準・bboxの下端をマス中心へ」に落とす。 ---- */,
  propImage(e){
    const {c,r}=e.cell, flat=isFlatProp(e.variant), f=this.propFit()[e.variant];
    const img=this.add.image(0,0,'prop_'+e.variant);
    /* 新規格(殻から作った絵)。焼き込み(tools/assets/cut_prop_sheet.mjs)の時点で
       1マスの大きさに合わせてあるので、ゲーム側は倍率をいじらない。接地点(cx,by)を
       ブロックの「菱形の中心x・手前角のy」に合わせるだけ。推測が一切入らない。 */
    if(f && f.baked){
      // 形は焼き込み時に記録したものを使う。コマ数の表(FURN_SPAN)は旧290体むけの値で、
      // 例えば lamp は 2コマ(1×2)。新しい絵は 1×1 なので、表に従うと半マスずれる
      const [n,m]=this.propBlock(e), b=blockIso(c,r,n,m);
      const cx=(b.back.x+b.front.x)/2, v=(e.dir==='v');
      /* v向きは絵を左右反転する。アイソメでは水平反転が90度回した向きに相当する
         (製造機も同じ手を使っている)。反転すると原点も鏡になるので cx を裏返す。 */
      img.setOrigin(v?1-f.cx:f.cx, f.by).setPosition(cx, b.front.y)
         .setDepth(flat?RUG_DEPTH:b.front.y).setScale(1).setFlipX(v);
      return img;
    }
    if(!f){   // 旧規格のフォールバック(絵はあるが未測定)
      const p=cellXY(c,r);
      img.setOrigin(0.5,flat?0.5:1).setPosition(p.x,p.y).setDepth(flat?RUG_DEPTH:p.y)
         .setScale(1.35*Math.sqrt(propSpan(e.variant))*CELL/img.height);
      return img;
    }
    const [n,m]=propShape(e.variant), b=blockIso(c,r,n,m);
    if(flat){   // ラグは床に寝かせる平物。絵の全幅を菱形の幅に合わせ、菱形の中心へ置く
      const cx=(b.back.x+b.front.x)/2, cy=(b.back.y+b.front.y)/2;
      img.setOrigin(f.left+f.w/2, f.by-f.h/2).setPosition(cx,cy).setDepth(RUG_DEPTH)
         .setScale(b.w/(f.w*img.width));
      return img;
    }
    const s=Math.min(PROP_FIT.foot*b.w/(f.bw*img.width),     // 足元をマスに合わせる(基準)
                     PROP_FIT.maxW*b.w/(f.w*img.width),      // 横の張り出しの上限
                     PROP_FIT.maxH*b.w/(f.h*img.height));    // 高さの上限
    /* 原点を「足元の中心・接地の高さ」に置くと、絵のどこが描かれていようが接地点で位置が決まる。
       置き先は「自分の接地菱形の中心を、マスの菱形の中心に重ねる」。
       原点は自分の菱形の"手前角"(最下点)なので、菱形の中心から手前角までの距離だけ下げる:
       菱形は2:1なので 幅 fw の菱形の中心〜手前角は fw/4。
       手前角どうしを合わせてはいけない。それが正しいのは足元がマスいっぱい(foot=1.0)の時だけで、
       foot=0.50 だと 1×1 で7px・2×2 で14px、物が手前へずれる。 */
    const fw=f.bw*img.width*s;
    img.setOrigin(f.cx, f.by)
       .setPosition((b.back.x+b.front.x)/2, (b.back.y+b.front.y)/2 + fw/4)
       .setDepth((b.back.y+b.front.y)/2 + fw/4).setScale(s);
    return img;
  }
  /* 左右反転した製造機テクスチャ(v向き用)。帯の切り出し(setCrop)は「反転したときの切り出し位置」が
     WebGL と Canvas で食い違うので、flipX せず反転済みテクスチャを焼いて素直に切る。 */,
  _machFlipTex(key){ const fk=key+'__fx';
    if(!this.textures.exists(fk)){
      const src=this.textures.get(key).getSourceImage();
      const cv=document.createElement('canvas'); cv.width=src.width; cv.height=src.height;
      const cg=cv.getContext('2d'); cg.translate(cv.width,0); cg.scale(-1,1); cg.drawImage(src,0,0);
      this.textures.addCanvas(fk,cv); }
    return fk; }
  /* 絵の下端(接地している縁)の色。土台をこの色で塗ると床との継ぎ目が目立たない。
     テクスチャ読みは重いのでテーマ+サイズごとに1回だけ測って覚える。 */,
  _machFootColor(key, sx, ih, fallback){
    this._footCol = this._footCol || {};
    if(key in this._footCol) return this._footCol[key];
    // 拾いたいのは「機械の裾の色」。土台とその2pxの縁取りは絵の輪郭から数px食み出すので、
    // ここが機械と違う色だと、マスの角に黒や明るい三角が飛び出して「絵が抜けた」ように見える。
    //   ・1列だけ見ない … 列 sx(投入口0番の列)は絵の奥側で、長い機械では絵の下端から遠い。
    //     旧実装は下端から40pxで打ち切っていたので 4/5マス機では何も拾えず fallback(暗い縁色)だった。
    //   ・最下端そのものを拾わない … そこは必ず太い黒の輪郭線。
    // 幅方向に何点かサンプルし、輪郭でない色の中央値(明るさ順)を採る。
    let col=fallback;
    const src=this.textures.get(key).getSourceImage(), iw=src.width;
    const cand=[];
    for(let k=1;k<=9;k++){
      const x=Math.min(iw-1, Math.round(iw*k/10));
      let bottom=-1;
      for(let y=ih-1; y>=0; y--){ if(this.textures.getPixelAlpha(x,y,key)>200){ bottom=y; break; } }
      if(bottom<2) continue;
      for(let y=bottom-1; y>=0 && y>bottom-6; y--){
        const c=this.textures.getPixel(x,y,key); if(!c) continue;
        if(Math.max(c.red,c.green,c.blue)<50) continue;              // 輪郭線は飛ばす
        cand.push([c.red+c.green+c.blue, (c.red<<16)|(c.green<<8)|c.blue]); break; } }
    if(cand.length){ cand.sort((a,b)=>a[0]-b[0]); col=cand[cand.length>>1][1]; }
    this._footCol[key]=col; return col; }
  /* 製造機は複数マスを一直線に占有するので、深度を1つしか持たせるとマスごとの前後関係が壊れる
     (手前のマスに立ったキャラが機械の裏へ回る)。絵を「1マスぶんの縦帯」に切り、帯 i をマス i の深度で描く。 */,
  _makeMachine(e, objs){
    const sk=this.partsSkin();
    const [A,B,C,D]=this._machFootprint(e);
    const xs=[A.x,B.x,C.x,D.x], ys=[A.y,B.y,C.y,D.y];
    const bx0=Math.min(...xs), bx1=Math.max(...xs), by0=Math.min(...ys), by1=Math.max(...ys);
    const u=(e.cell.c+0.5)/GU, v=(e.cell.r+0.5)/GV, tint=this.tintByLight(u,v);
    const tex=this.machTex(e);
    const cells=this.cellsOf(e), n=cells.length, quads=this._machCellQuads(e);
    const dep=cells.map(q=>cellXY(q.c,q.r).y);        // 帯ごとの深度 = そのマス中心の y(キャラと同じ基準)
    const dBack=dep[0], dFront=dep[n-1];              // u/v どちらの向きでも添字が大きいほど手前
    const g=this.add.graphics().setDepth(dFront+0.1); objs.push(g); e._gfx=g;   // 掴み手(main)。絵は帯ごとの graphics が持つ
    const cellG=[];                                   // 手続き描画のときのマスごとの graphics
    let HG, spotPts=null;   // 天面の高さ(px) / 投入口の実位置(スプライトのときアンカーから算出)
    let artTop=null, artMidX=null;   // 絵の上端と中心x。稼働バッジをここの真上に出す
    e._lit=[];              // 採光tintの対象。帯の数だけある
    if(tex){
      // 絵は「1マスの送り = ゲームの1マス × MACH_DRAW」で焼いてある(tools/cut_machines.py)。
      // ここで setScale して縮めてはいけない。pixelArt:true は NEAREST なので、
      // 半端な倍率をかけるとドットが不均等に間引かれて線が太い所と消える所ができる。
      // 縮小は焼き込み側(LANCZOS)に任せ、ここは等倍で描く。
      // 一方 土台と素材アイコンは絵に合わせて縮める必要があるので、倍率は幾何計算だけに使う。
      const S=MACH_DRAW;
      const flip=(e.dir==='v');   // 素材はu方向。v方向は左右反転した絵で角度が合う
      const key=flip? this._machFlipTex(tex.key) : tex.key;
      const src=this.textures.get(key).getSourceImage(), iw=src.width, ih=src.height;
      const dw=iw, dh=ih;         // 絵は等倍(焼き込み済み)
      const fitA=((this.machFit()[tex.theme])||{})[String(tex.n)];
      const ax=fitA ? (flip?1-fitA.ax:fitA.ax) : null;
      const du=(cellXY(1,0).x-cellXY(0,0).x)*S, dv=(cellXY(1,0).y-cellXY(0,0).y)*S;   // 縮めた後の1マス送り
      // 投入口の列の中点を、占有マスの中心の列の中点に合わせる。
      // 投入口0番をマス0に固定すると、縮めたぶんが手前側にだけ寄って土台が見えてしまう。
      let imx=(bx0+bx1)/2;
      if(fitA){
        const p0=cellXY(cells[0].c,cells[0].r), pN=cellXY(cells[n-1].c,cells[n-1].r);
        imx += (p0.x+pN.x)/2 - (((imx-dw/2)+ax*dw) + (flip?-1:1)*du*(n-1)/2);
      }
      const L=imx-dw/2;
      const sx0=fitA ? L+ax*dw : 0;                       // 投入口0番の画面x
      // 縦位置は「絵の下端」ではなく「絵の接地線」を足元の四角形の手前の辺に合わせる。
      // 絵の一番下はシュートや脚が垂れていることが多く、そこを床に合わせると
      // 本体が数px持ち上がって浮いて見える(土台が絵の下から食み出す)。
      let imy=by1;
      if(fitA && fitA.gy!=null){
        /* 合わせる先は「機械の長辺のうち手前側の辺」。C は常に最手前の角だが、
           長辺は向きで入れ替わる: u向き(右下がり)は D→C、v向き(右上がり)は B→C。
           どちらでも D→C を使うと、v向きのときだけ短辺(手前の角の 22px)の
           延長線で高さを取ることになり、絵が1マス弱ぶん手前へ落ちる。 */
        const dd=flip?B:D, cc=C;
        const fy=(cc.x===dd.x)? cc.y : dd.y+(sx0-dd.x)*(cc.y-dd.y)/(cc.x-dd.x);
        imy = fy + dh*(1-fitA.gy);                        // 接地線が fy に来るよう下端を決める
      }
      if(fitA){ const sy=(imy-dh)+fitA.ay*dh;
        spotPts=cells.map((q,i)=>({x:sx0+(flip?-1:1)*du*i, y:sy+dv*i}));
        HG = Math.max(2, imy-sy);      // 天面の高さ = 接地点から投入口までの高さ
      } else HG = Math.max(2, dh-(by1-by0));
      // 帯の切れ目は「隣の投入口との中点」。マス中心ではなく絵側の送りで切る(縮めてあるので別物)。
      // 両端は絵の端まで伸ばす(端の飾りを落とさない)。境界は元絵の整数pxに丸める
      // (隣り合う帯が同じ値になる = 継ぎ目に隙間も重なりも出ない)。
      const cx=cells.map(q=>cellXY(q.c,q.r).x), asc=(cx[n-1]>=cx[0]), cut=[];
      for(let i=1;i<n;i++){
        const bnd = fitA ? sx0+(flip?-1:1)*du*(i-0.5) : (cx[i-1]+cx[i])/2;
        cut.push(Phaser.Math.Clamp(Math.round(bnd-L),0,iw));   // 等倍なので画面px=元絵px
      }
      const sh=this.add.image((bx0+bx1)/2+3, imy-2, 'shadow').setDepth(dBack-0.6)
        .setDisplaySize(dw*0.9,(by1-by0)*0.7).setAlpha(0.42); objs.push(sh);   // 影は機械の一番奥より後ろ
      // 土台も絵と同じだけ縮める。原点は接地点(足元の中央)。
      const fx=(bx0+bx1)/2, fy=imy;
      const shrink=(p)=>({x:fx+(p.x-fx)*S, y:fy+(p.y-fy)*S});
      // 土台をテーマ色で塗ると、絵の下に暗い帯が出て「床との間に隙間がある」ように見える。
      // 絵の下端の色を拾って塗れば、機械の裾がそのまま床まで続いているように見える。
      const foot=this._machFootColor(key, Math.round((ax||0.5)*iw), ih, sk.edge);
      cells.forEach((q,i)=>{
        // 絵の本体の奥行はゲームの1マスより浅いことがあり、占有マスの手前側に床が残る。
        // そこに後ろのキャラが覗くので、マスごとの土台で塞いでから帯を重ねる。
        const x0 = asc ? (i===0?0:cut[i-1]) : (i===n-1?0:cut[i]);
        const x1 = asc ? (i===n-1?iw:cut[i]) : (i===0?iw:cut[i-1]);
        // 土台は「自分の帯の中」だけに描く。マスの菱形は帯より横に広いので、そのまま塗ると
        // 隣のマスの帯(depth が小さい = 先に描かれる)の上に単色が乗り、絵の中に灰色や黒の
        // 三角が出る(絵が抜けたように見える)。帯で切っておけば、はみ出した分は必ず自分の絵の下。
        const qd=this._clipX(quads[i].map(shrink), L+x0, L+x1);
        const bg=this.add.graphics().setDepth(dep[i]-0.3); objs.push(bg);
        if(qd.length>2){ bg.fillStyle(foot,1); bg.fillPoints(qd,true);
          bg.lineStyle(1,foot,1); bg.strokePoints(qd,true); }
        const im=this.add.image(imx, imy, key).setOrigin(0.5,1).setDepth(dep[i]).setTint(tint);
        im.setCrop(x0, 0, Math.max(0,x1-x0), ih);   // 位置は変えず、自分の帯だけを見せる
        objs.push(im); e._lit.push(im); this.lit.push({sp:im,u,v});
      });
      artTop=imy-dh; artMidX=imx;
      /* クリック/掴みの当たり判定に使う絵の置き場所(左上と大きさ)。筐体の箱だけで判定すると
         箱より横に広い部分(天面の飾り・張り出したシュート)が押せない。edit.mjs _machHit 参照。 */
      e._artHit={ key, x:L, y:artTop, w:dw, h:dh };
    } else {
      e._artHit=null;   // 手続き描画は絵が無い。箱のシルエットがそのまま見た目
      HG = MACH_GEO.height*CELL;
      const up=(q)=>({x:q.x, y:q.y-HG});
      // 手続き描画もマスごとに分ける。継ぎ目に線や内壁が出ないよう、外周の面/辺/角だけ描く
      cells.forEach((q,i)=>{
        const [a,b,c,d]=quads[i], vv=(e.dir==='v'), first=(i===0), last=(i===n-1);
        const cg=this.add.graphics().setDepth(dep[i]); objs.push(cg); cellG.push(cg);
        cg.fillStyle(0x000000,0.34); cg.fillPoints([a,b,c,d].map(p=>({x:p.x+3,y:p.y+3})),true);   // 接地影
        cg.fillStyle(sk.side,1);                                                                  // 手前2面(側面)
        if(vv||last) cg.fillPoints([b,c,up(c),up(b)],true);
        if(!vv||last) cg.fillPoints([d,c,up(c),up(d)],true);
        cg.fillStyle(sk.top,1); cg.fillPoints([a,b,c,d].map(up),true);                            // 天面
        cg.lineStyle(2,sk.rim,0.95); this._strokeOuter(cg,[a,b,c,d].map(up),i,n,e.dir);           // 天面の縁
        cg.lineStyle(2,sk.edge,0.9);
        for(const p of [ (vv?first:last)&&b, last&&c, (vv?last:first)&&d ])
          if(p) cg.lineBetween(p.x,p.y,p.x,p.y-HG);                                               // 縦のエッジ
      });
    }
    const up=(q)=>({x:q.x, y:q.y-HG});
    e._hgt=HG;   // 筐体の高さ(px)。ドラッグの当たり判定(_machHit)で使う

    // スロット(1マス1つ)。素材が入っていれば素材色で光らせ、絵文字を天面に載せる
    e.slots = Array.isArray(e.slots) ? e.slots.slice(0, machSize(e.variant)) : [];
    while(e.slots.length < machSize(e.variant)) e.slots.push(null);
    e._slotObjs=[];
    const SL=MACH_GEO.slot;
    cells.forEach((q,idx)=>{
      const mat=e.slots[idx], m=matArt(mat);
      const ctr = (spotPts && spotPts[idx]) || up(cellXY(q.c,q.r));   // 絵の投入口 > マス中心の真上
      if(tex){ // スプライトは意匠が自由なので穴は描かない。素材が入っているマスだけ光らせる
        if(m){ const gl=this.add.graphics().setDepth(dep[idx]+0.1); objs.push(gl);
               gl.fillStyle(m.c,0.5); gl.fillEllipse(ctr.x,ctr.y,CELL*0.46,CELL*0.24);
               gl.lineStyle(1.5,sk.glow,0.85); gl.strokeEllipse(ctr.x,ctr.y,CELL*0.46,CELL*0.24); } }
      else {   // 手続き描画のときだけ、置き場が分かるよう穴を描く(そのマスの graphics に載せる)
        const cg=cellG[idx];
        const s0=uvXY((q.c+0.5-SL/2)/GU,(q.r+0.5-SL/2)/GV), s1=uvXY((q.c+0.5+SL/2)/GU,(q.r+0.5-SL/2)/GV);
        const s2=uvXY((q.c+0.5+SL/2)/GU,(q.r+0.5+SL/2)/GV), s3=uvXY((q.c+0.5-SL/2)/GU,(q.r+0.5+SL/2)/GV);
        const poly=[s0,s1,s2,s3].map(up);
        cg.fillStyle(m?m.c:0x0d1116, m?0.85:0.6); cg.fillPoints(poly,true);
        cg.lineStyle(1.5, m?sk.glow:sk.edge, m?0.9:0.7); cg.strokePoints(poly,true);
      }
      if(m){
        /* ドット絵を原寸で置く。setScale で伸ばさないこと（pixelArt:true = NEAREST なので濁る）。
           テクスチャが無い素材（上流だけが知っている追加素材）は絵文字のまま出す。 */
        const key=matTexKey(mat);
        const t=this.textures.exists(key)
          ? this.add.image(ctr.x,ctr.y-CELL*0.08,key)
          : this.add.text(ctr.x,ctr.y-CELL*0.08,m.e,{fontSize:Math.round(CELL*0.5)+'px'});
        t.setOrigin(0.5,0.5).setDepth(dep[idx]+0.2);
        objs.push(t); e._slotObjs.push(t); }
    });

    /* 稼働バッジ(筐体の上)。素材未設定なら出さない。
       アンカーは絵の上端。by0-HG(足元の最奥を筐体の高さぶん持ち上げた点)は
       絵の上端より30px ほど高く、盤面で機械から浮いて見えていた。
       手続き描画のときは絵が無いので従来どおり by0-HG を使う。 */
    const prod=recipeFor(e.slots, e.id); e.product=prod;
    const mid={ x: (artMidX!=null?artMidX:(bx0+bx1)/2),
                y: (artTop!=null?artTop:by0-HG) };
    if(prod){
      /* 進捗バーだけの小さな表示。
         以前は完成品名と「製造中 x/yWP」を並べ、そのあと ⚙️/📦 のアイコンを
         添えていたが、盤面では絵が主役なので文字もアイコンも要らない。
         稼働しているかはバーの色で分かる（緑=稼働 / 灰=停止）。
         数値は🏭製造タブと製造機パネルで見られる。 */
      const BW=Math.round(CELL*0.95), BH=4;
      const bx=Math.round(mid.x-BW/2), by=Math.round(mid.y-2-BH);
      const p=Math.max(0,Math.min(1, typeof prod.p==='number'?prod.p:0));
      const pb=this.add.graphics().setDepth(C.y+2); objs.push(pb);
      pb.fillStyle(0x000000,0.55); pb.fillRect(bx-1,by-1,BW+2,BH+2);   // 縁。明るい床でも輪郭が出る
      pb.fillStyle(0x1b2430,0.95); pb.fillRect(bx,by,BW,BH);           // 溝
      pb.fillStyle(prod.running?0x33ffcc:0x8fa0ae,1);                  // 稼働=緑 / 停止=灰
      pb.fillRect(bx,by,Math.round(BW*p),BH);
    } else {
      const hint=this.add.text(mid.x, mid.y-CELL*0.1, '素材未設定', {fontFamily:'monospace',fontSize:'10px',color:'#93a39d'}).setOrigin(0.5,1).setDepth(C.y+2);
      hint.setShadow(0,1,'#000',3,true,true); objs.push(hint);
    }
    if(e.lvl>1){ const lv=this.add.text(bx0+6, by1-HG, `Lv${e.lvl}`, {fontFamily:'monospace',fontSize:'9px',color:'#9fb0c0'}).setOrigin(0,1).setDepth(C.y+2);
      lv.setShadow(0,1,'#000',3,true,true); objs.push(lv); }
    e.objs=objs; e.main=g;
  },
  partsSkin(){ const t=this.partsTheme||null;
    return Object.assign({theme:t}, PART_PAL[PART_SKIN_BY_THEME[t]||'default']); },
  /* パーツのテーマを切り替える(背景テーマに追従 / 単体でも呼べる) */
  setPartsTheme(theme){ if(this.partsTheme===theme) return; this.partsTheme=theme||null;
    for(const e of this.placed.slice()) if(e.kind==='machine') this._remake(e); }
};

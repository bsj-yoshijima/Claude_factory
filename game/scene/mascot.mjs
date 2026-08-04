/* マスコットのドット絵 — キャラを手続きで描いて Phaser のテクスチャに焼く。
   assets には置かず、色違いをコードで作る（tools/assets/make_favicon.mjs が同じ手順を移植している）。 */
const INK = '#3b4643', EYE = '#241713';
export const PRESETS = [
  {b:'#c15f3c',s:'#9d4527',l:'#d67e57'}, {b:'#4f7fc4',s:'#37588f',l:'#7ba3df'},
  {b:'#4fa564',s:'#367b47',l:'#7bc78d'}, {b:'#8a5fc0',s:'#623f90',l:'#ac86dc'},
  {b:'#e0b23a',s:'#ad8327',l:'#f2d06a'}, {b:'#d86a9c',s:'#a94773',l:'#f094bc'},
];
const MTOP = [3,2,1,1,0,0,1,2,3,3,2,1,0,0,1,1,2,3];
// スキン=被り物(帽子)のみ。ベースの手続きマスコット(26x28ドット,1ドット=DOTP px)はそのまま。
// 被り物テクスチャ hat_<id> を頭頂に載せる較正: 底辺中央を(HAT_CX, HAT_BASE_Y)ドットへ、幅をHAT_W_DOTに正規化。
export const DOTP = 3, HAT_CX = 12.5, HAT_BASE_Y = 10.8, HAT_W_DOT = 19;
export function makeMascot(scene, key, pal, pose){
  const cv=mascotCanvas(pal,pose);
  if(scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, cv);
}
// マスコットを描いた canvas を返す。Phaserテクスチャにも HUD用の <img> にも使う
function mascotCanvas(pal, pose){
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
  return cv;
}
// HUD用アイコン(稼働=作業ポーズ / 休憩=座りポーズ)。初回だけ描いて data URL を使い回す
let _mascotIcons=null;
export function mascotIcons(){
  if(!_mascotIcons) _mascotIcons={
    work: mascotCanvas(PRESETS[0],'work').toDataURL(),
    sit:  mascotCanvas(PRESETS[1],'sit').toDataURL(),
  };
  return _mascotIcons;
}

// テーマ専用の部屋画像(Stitch製・壁/床/窓を焼き込み)。ここにあるテーマは背景ごと差し替える

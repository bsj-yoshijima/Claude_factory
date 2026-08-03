/* ファビコンを生成する。依存ゼロ（Node標準のzlibだけでPNGを書く）。
     使い方: node tools/make_favicon.mjs
     出力  : assets/favicon.png (64px) / assets/favicon-192.png (Appleのホーム画面用)

   絵の中身は「工場 + 左下にClaude君」。
   Claude君は画面左下のHUDに出ているアイコンと同じもの ——
   game/main.js の mascotCanvas() の手順をそのまま移植して、1ドット=1pxで描いている。
   （HUDのアイコンは canvas に描いて data URL 化したものでPNGファイルが無いため、
     ファイルを流用するのではなく描画手順のほうを合わせている。
     マスコットの形を変えたときは両方直すこと。）

   下地は白系。Claude君の体がテラコッタ(#c15f3c)なので、地を同系色にすると溶ける。
   64×64 で描いて整数倍で拡大する（縮小も 64→32→16 と割り切れるので輪郭が濁らない）。 */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const S = 64;                                   // 元のドット絵の一辺
const OUT = path.join(import.meta.dirname, '..', 'assets');

/* --- 配色 --- */
const INK = '#3b4643', EYE = '#241713';         // game/main.js と同じ
const PAL = {b:'#c15f3c', s:'#9d4527', l:'#d67e57'};   // PRESETS[0] = Claude君の体色
const C = {
  bg    : '#f6f1e7',   // 下地。白すぎない生成り（明るいタブでも輪郭が残る）
  bgEdge: '#ddd3c4',   // 下地のふち
  wall  : '#4b5a55',   // 工場の壁
  roof  : '#35413d',   // 屋根・煙突
  win   : '#ffc95e',   // 窓の灯り
  smoke : '#cfc6b8',   // 煙
};

/* --- 64×64 のキャンバス。値は色文字列 or null(透明) --- */
const cv = Array.from({length:S},()=>Array(S).fill(null));
const put=(x,y,c)=>{ if(x>=0&&x<S&&y>=0&&y<S&&c) cv[y][x]=c; };
const rect=(x,y,w,h,c)=>{ for(let j=0;j<h;j++) for(let i=0;i<w;i++) put(x+i,y+j,c); };

/* --- 角丸の下地 --- */
const R=12;
const inTile=(x,y)=>{
  const dx = x<R ? R-1-x : (x>=S-R ? x-(S-R) : 0);
  const dy = y<R ? R-1-y : (y>=S-R ? y-(S-R) : 0);
  return dx*dx+dy*dy <= (R-1)*(R-1)+R;
};
for(let y=0;y<S;y++) for(let x=0;x<S;x++) if(inTile(x,y)) put(x,y,C.bg);
for(let y=0;y<S;y++) for(let x=0;x<S;x++)          // 1pxのふち
  if(inTile(x,y) && !(inTile(x-1,y)&&inTile(x+1,y)&&inTile(x,y-1)&&inTile(x,y+1))) put(x,y,C.bgEdge);

/* --- 工場: 煙突2本 + のこぎり屋根の建屋 + 灯りのついた窓 --- */
rect(41,10,4,3,C.smoke); rect(38,5,3,3,C.smoke);            // 煙
rect(39,13,7,13,C.roof); rect(39,13,7,2,INK);               // 右(奥)の煙突
rect(27,18,7,10,C.roof); rect(27,18,7,2,INK);               // 左(手前)の煙突
const BX=19, BY=26, BW=39, BH=28;
rect(BX,BY,BW,BH,C.wall);
for(let i=0;i<BW;i++){                                      // のこぎり屋根（6ドット周期）
  const top = 5-(i%6);
  rect(BX+i,BY,1,top,null); if(inTile(BX+i,BY)) rect(BX+i,BY,1,top,C.bg);   // 上は下地でくり抜く
  rect(BX+i,BY+top,1,2,C.roof);
}
rect(BX,BY+BH-2,BW,2,C.roof);                               // 接地
for(let k=0;k<4;k++) rect(BX+4+k*9,BY+13,6,6,C.win);        // 窓の灯り

/* =========================================================================
   Claude君 — game/main.js の mascotCanvas() の移植（1ドット=1px、'work'ポーズ）
   ========================================================================= */
const MTOP = [3,2,1,1,0,0,1,2,3,3,2,1,0,0,1,1,2,3];
function drawMascot(ox,oy,pal,pose){
  const px=(x,y,c)=>put(ox+x,oy+y,c);
  const obox=(x,y,ww,hh,c)=>{ rect(ox+x,oy+y,ww,hh,INK); rect(ox+x+1,oy+y+1,ww-2,hh-2,c); };
  const x0=4, bottomY = pose==='sit'?23:22, topBase=bottomY-14, bw=18, rows=bottomY-topBase+1;
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
}
// 建屋の左手前に立たせる（足元が接地線に乗る位置）
drawMascot(2, 28, PAL, 'work');

/* --- PNG を書く（RGBA・フィルタなし） --- */
const hex=c=>c?[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16),255]:[0,0,0,0];
const CRC=(()=>{ const t=[]; for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c=c&1?0xedb88320^(c>>>1):c>>>1; t[n]=c>>>0; }
  return b=>{ let c=0xffffffff; for(const x of b) c=t[(c^x)&255]^(c>>>8); return (c^0xffffffff)>>>0; }; })();
const chunk=(type,data)=>{ const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td=Buffer.concat([Buffer.from(type,'ascii'),data]);
  const crc=Buffer.alloc(4); crc.writeUInt32BE(CRC(td)); return Buffer.concat([len,td,crc]); };
function png(scale){
  const w=S*scale, raw=Buffer.alloc((w*4+1)*w);
  let p=0;
  for(let y=0;y<w;y++){ raw[p++]=0;                       // フィルタ種別 0(None)
    for(let x=0;x<w;x++){ const [r,g,b,a]=hex(cv[(y/scale)|0][(x/scale)|0]);
      raw[p++]=r; raw[p++]=g; raw[p++]=b; raw[p++]=a; } }
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(w,4);
  ihdr[8]=8; ihdr[9]=6; ihdr[10]=0; ihdr[11]=0; ihdr[12]=0;   // 8bit RGBA
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ihdr), chunk('IDAT',zlib.deflateSync(raw,{level:9})), chunk('IEND',Buffer.alloc(0))]);
}
for(const [name,scale] of [['favicon.png',1],['favicon-192.png',3]]){
  fs.writeFileSync(path.join(OUT,name), png(scale));
  console.log(`  ${name} (${S*scale}×${S*scale})`);
}

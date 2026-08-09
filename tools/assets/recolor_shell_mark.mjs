#!/usr/bin/env node
/* 殻の「印」の色だけを別の色に塗り替える。

     node tools/assets/recolor_shell_mark.mjs <殻.png> <殻.json> <#RRGGBB> <出力の接尾辞>

   例: node tools/assets/recolor_shell_mark.mjs \
         docs/shells/prop-shell-sheet7-1519x1127.png \
         docs/shells/prop-shell-sheet7-1519x1127.json '#FF6A00' ice

なぜ要るか:
  印はシアン #00E5FF 固定だが、テーマ側が同じくらい彩度の高いシアンを絵に使うと
  区別がつかなくなる。ice で実際に詰んだ: 脚の間から覗く菱形のスリット(距離37〜73)と
  ラグの雪の結晶(距離40〜69)が完全に重なり、しきい値をどこに置いても
  「菱形が残る」か「結晶が消える」のどちらかにしかならなかった。
  そのテーマだけ印を別の色にすれば衝突しない。

やること:
  殻は「印の色」と「背景のマゼンタ」の2色と、その中間色(縁のぼけ)でできている。
  各画素を  画素 = a*印 + (1-a)*マゼンタ  と見て a を出し、印だけ新しい色に差し替える。
  a は緑で測る(マゼンタの緑は0、シアンの緑は229)。幾何は1画素も動かない。
*/
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function readPNG(file){
  const b = fs.readFileSync(file);
  let off=8,w=0,h=0,bd=0,ct=0; const idat=[];
  while(off<b.length){
    const len=b.readUInt32BE(off), type=b.toString('ascii',off+4,off+8);
    const d=b.subarray(off+8,off+8+len);
    if(type==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];}
    else if(type==='IDAT') idat.push(d); else if(type==='IEND') break;
    off+=12+len;
  }
  if(bd!==8||(ct!==6&&ct!==2)) throw new Error(`未対応のPNG bd=${bd} ct=${ct}`);
  const ch=ct===6?4:3, raw=zlib.inflateSync(Buffer.concat(idat));
  const stride=w*ch, out=Buffer.alloc(h*stride); let p=0;
  for(let y=0;y<h;y++){
    const ft=raw[p++]; const line=raw.subarray(p,p+stride); p+=stride;
    const cur=out.subarray(y*stride,(y+1)*stride), prev=y?out.subarray((y-1)*stride,y*stride):null;
    for(let i=0;i<stride;i++){
      const a=i>=ch?cur[i-ch]:0, up=prev?prev[i]:0, ul=(prev&&i>=ch)?prev[i-ch]:0;
      let v=line[i];
      if(ft===1)v+=a; else if(ft===2)v+=up; else if(ft===3)v+=(a+up)>>1;
      else if(ft===4){const pa=Math.abs(up-ul),pb=Math.abs(a-ul),pc=Math.abs(a+up-2*ul);
        v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?up:ul);}
      cur[i]=v&255;
    }
  }
  return {w,h,ch,px:out};
}
const CRC=(()=>{const t=[...Array(256)].map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  return (buf)=>{let c=0xffffffff;for(const b of buf)c=t[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};})();
function writePNG(file,w,h,rgba){
  const raw=Buffer.alloc(h*(w*4+1));
  for(let y=0;y<h;y++){ raw[y*(w*4+1)]=0; rgba.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4); }
  const chunk=(type,data)=>{const len=Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td=Buffer.concat([Buffer.from(type,'ascii'),data]);
    const cr=Buffer.alloc(4); cr.writeUInt32BE(CRC(td)); return Buffer.concat([len,td,cr]);};
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4); ihdr[8]=8; ihdr[9]=6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR',ihdr), chunk('IDAT',zlib.deflateSync(raw,{level:9})), chunk('IEND',Buffer.alloc(0))]));
}

const [pngIn, jsonIn, hex, suffix] = process.argv.slice(2);
if(!suffix){ console.log("使い方: node tools/assets/recolor_shell_mark.mjs <殻.png> <殻.json> <#RRGGBB> <接尾辞>"); process.exit(1); }
const m = /^#?([0-9a-f]{6})$/i.exec(hex);
if(!m){ console.log('色は #RRGGBB で指定する'); process.exit(1); }
const NEW = [parseInt(m[1].slice(0,2),16), parseInt(m[1].slice(2,4),16), parseInt(m[1].slice(4,6),16)];

const spec = JSON.parse(fs.readFileSync(jsonIn,'utf8'));
const oldHex = (spec.mark||'#00e5ff').replace('#','');
const OLD = [parseInt(oldHex.slice(0,2),16), parseInt(oldHex.slice(2,4),16), parseInt(oldHex.slice(4,6),16)];
const BG = [255,0,255];

const im = readPNG(pngIn);
const out = Buffer.alloc(im.w*im.h*4);
let touched = 0;
/* 塗り替えるのは「印そのもの」と「印と背景の中間色(線の縁)」だけ。
   殻に描かれた見本の家具(ベージュ)は印ではないので触らない。
   最初これを区別せず全画素を混合とみなしたら、見本の家具まで橙色に染まった。 */
for(let i=0;i<im.w*im.h;i++){
  const s=i*im.ch, c=[im.px[s],im.px[s+1],im.px[s+2]];
  /* 印→背景を結ぶ線分に射影し、そこからどれだけ外れているかを見る */
  let num=0, den=0;
  for(let k=0;k<3;k++){ const d=OLD[k]-BG[k]; num += (c[k]-BG[k])*d; den += d*d; }
  const a = Math.min(1, Math.max(0, num/den));
  let off=0;
  for(let k=0;k<3;k++){ const e = c[k] - (a*OLD[k] + (1-a)*BG[k]); off += e*e; }
  if(Math.sqrt(off) > 40 || a <= 0.02){        // 線分から遠い = 印ではない
    for(let k=0;k<3;k++) out[i*4+k] = c[k];
  }else{
    touched++;
    for(let k=0;k<3;k++) out[i*4+k] = Math.round(a*NEW[k] + (1-a)*BG[k]);
  }
  out[i*4+3] = 255;
}
const base = pngIn.replace(/\.png$/,'');
const outPng = `${base}-${suffix}.png`, outJson = jsonIn.replace(/\.json$/,'') + `-${suffix}.json`;
writePNG(outPng, im.w, im.h, out);
fs.writeFileSync(outJson, JSON.stringify({...spec, mark:'#'+m[1].toLowerCase()}, null, 0)+'\n');
console.log(`印 #${oldHex} → #${m[1].toLowerCase()}  塗り替えた画素 ${touched}`);
console.log('  ' + path.relative(process.cwd(), outPng));
console.log('  ' + path.relative(process.cwd(), outJson));

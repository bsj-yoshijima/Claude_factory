#!/usr/bin/env node
/* 生成された装飾品シートを、絵に残ったシアンの枠を基準に1体ずつ切り出して焼き込む。

     node tools/assets/cut_prop_sheet.mjs <sheet.png> <cells.json> <prefix> [--out DIR]

   例: node tools/assets/cut_prop_sheet.mjs ~/Downloads/jpn.png docs/shells/prop-shell-sheet7-1519x1127.json jpn

なぜ枠を基準にするか:
  生成物は殻と同じ寸法では返らず（1519x1127 で頼んでも別サイズで返る）、並びも少し動く。
  殻の座標を拡縮して当てにいくと**別の物を切り出す**（ソファの位置から机が出た）。
  枠は絵に残るので、それを見つければ推測が要らない。
    枠の幅   → 1マスの大きさ
    枠の下辺 → 接地線
    枠の中心 → 横の中心
  枠の内側の菱形も同じシアンなので、シアンを落とせば枠ごと一緒に消える。

出力:
  <out>/prop_<prefix>_<slot>.png      … 実寸の透過PNG
  <out>/prop-fit-<prefix>.json        … { "<prefix>_<slot>": {cx, by, px} } 接地点(画像に対する比)
  <out>/_contact-<prefix>.png         … 切り出した全体を並べた検収用の1枚
                                        （数値だけで判断して中身が別物だった失敗があるので必ず目で見る）
*/
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { CELL_W } from '../../game/scene/iso.mjs';   // 1マスの接地菱形の幅(55.65px)

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/* スロットが床のいくつ分を占めるか。殻がこの形で描かれているので、焼き込みも同じ形で記録し、
   ゲーム側はコマ数の表(catalog.mjs の FURN_SPAN)ではなくこの値を使う。
   表の方は旧290体むけの値で、たとえば lamp は 2コマ(1×2)になっている。新しい絵は 1×1 で
   描いてあるので、表に従うと 1×2 ブロックの中心へ置かれて半マスずれる。 */
const SHAPE = { chair:[1,1], shelf:[1,1], lamp:[1,1], plant:[1,1],
                table:[1,2], sofa:[1,2], rug:[1,2],
                'free-1x1':[1,1], 'free-1x2':[1,2], 'free-2x2':[2,2] };
/* 枠・菱形(シアン)と背景(マゼンタ)の判定。
   シアンは「色で落とす」のをやめた。以前は青緑寄りの画素を全部落としていたが、
   それだと**淡い水色を使った物が消える**（onsen の露天風呂で湯が丸ごと消えた。
   湯 rgb(207,238,240) は枠を探す厳しい判定には掛からないのに、落とす緩い判定には掛かる）。
   ice / undersea など水色を使うテーマでも同じことが起きる。
   いまは「純粋なシアンの画素の集まり」をマスクにして、その数px外側までを落とす。
   線の縁のマゼンタとの中間色は、この膨張ぶんで一緒に消える。
   マゼンタは背景全面なので従来どおり色で落とす。 */
/* 印は #00E5FF そのもの。判定は「その色からどれだけ離れているか」で決める。
   しきい値や個別の条件を積むより、この1本の方が壊れにくい。実測:
     枠の芯      rgb(7,228,255) 距離7 / rgb(20,224,248) 距離22
     露天風呂の湯 rgb(175,241,231) 距離182 / 影の湯 rgb(117,201,203) 距離131
   以前は「緑と青が赤より55以上高い」で見ていて、湯(231-175=56)が1ポイント差で
   印と判定され、焼き込みで湯が消えた。影の湯も同じ理由で奥側が欠けた。 */
/* 印の色は殻の JSON の mark を正とする(既定 #00E5FF)。テーマの絵と印が同じ色域に
   入ってしまうと、しきい値では絶対に分けられない。ice がその実例で、脚の間から覗く
   菱形のスリット(距離37〜73)とラグの雪の結晶(距離40〜69)が完全に重なった。
   そのテーマだけ印を別の色で刷った殻を使う(tools/assets/recolor_shell_mark.mjs)。 */
let MARK = [0,229,255];
const dist2 = (c,m)=> (c[0]-m[0])**2 + (c[1]-m[1])**2 + (c[2]-m[2])**2;
/* しきい値は --mark-tol で下げられる。既定の70は線の縁のぼけた画素まで拾うための値だが、
   テーマ側がシアンに近い色を絵に使うと、その絵まで印と判定して消してしまう
   (ice のラグの雪の結晶。距離41)。しきい値を下げると線の縁が印から漏れるが、
   縁は「印から D px 以内の青緑」として別途落とされるので実害は出ない。実測(ice):
     枠線の芯   距離 6〜14      枠線の縁 距離 27〜57
     ラグの結晶 距離 40〜69 */
let markTol = 70;
const isMark = (c)=> dist2(c,MARK) < markTol*markTol;
const isMag  = (c)=> c[0]>170 && c[1]<110 && c[2]>170 && c[0]-c[1]>60 && c[2]-c[1]>60;
const killMag =(c)=> c[0]>120 && c[2]>120 && c[0]-c[1]>45 && c[2]-c[1]>45; // 赤紫に寄った画素
const cyanish=(c)=> c[2]>90 && c[1]-c[0]>18 && c[2]-c[0]>18;              // 青緑に寄った画素
/* シアン(0,229,255)とマゼンタ(255,0,255)の中間色。線の縁に1〜2px出る。
   青が支配的で赤+緑が低い。これを落とさないと枠の縁が物として残り、切り出しが枠まで広がる。 */
const isBlend=(c)=> c[2]>190 && c[2]>=c[0]-10 && c[2]>=c[1]-10 && (c[0]+c[1])<340;
/* 線の縁は「印 と マゼンタ の混合」でできている。印の色を差し替えても効くように、
   色名ではなく「印→マゼンタ を結ぶ線分にどれだけ近いか」で判定する。
   シアンの実測: rgb(107,177,255) は線分から 44、rgb(49,201,251) は 16。
   氷の淡い水色 rgb(200,235,250) は 185 で残る。 */
const nearMarkLine=(c)=>{
  let num=0, den=0;
  for(let k=0;k<3;k++){ const d=MARK[k]-255*(k!==1?1:0); num += (c[k]-(k!==1?255:0))*d; den += d*d; }
  const a = Math.min(1, Math.max(0, num/den));
  let off=0;
  for(let k=0;k<3;k++){ const base=(k!==1?255:0); const e = c[k]-(a*MARK[k]+(1-a)*base); off += e*e; }
  return off < 60*60;
};

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

const args = process.argv.slice(2);
const [sheetFile, cellsFile, prefix] = args;
if(!prefix){ console.log('使い方: node tools/assets/cut_prop_sheet.mjs <sheet.png> <cells.json> <prefix> [--out DIR] [--slot 名前] [--scale 倍率] [--pad px] [--bleed px] [--flip] [--mark-tol 距離]'); process.exit(1); }
const oi = args.indexOf('--out');
const outDir = oi>=0 ? args[oi+1] : path.join(ROOT,'assets','props');
/* カスタムの殻はセル名が形(free-1x2)なので、そのままだと prop_jpn_free-1x2.png になる。
   --slot でその物の名前(byobu など)に差し替える。 */
const si = args.indexOf('--slot');
const slotOverride = si>=0 ? args[si+1] : null;
/* --scale は一点物の救済用の手動係数。生成物が枠に対して大きすぎるとき、
   作り直す代わりにこの倍率で縮める。**共通7種には使わないこと**(そこは殻と
   プロンプトで揃うのが正で、係数で誤魔化すと規格が崩れる)。
   使ったら fit に scale として残るので、後から効いているのが分かる。 */
/* --pad は絵の下に透明の余白を足す一点物むけの手当て。
   接地線は本来 枠の下辺(gy)から出すのが正で、by>1.0(＝マスを埋め尽くさない物ほど
   自分の手前角がマスの手前角より上に来る)も正常。だが生成側が枠の中の置き方を外すと
   そのまま前後にずれる。--pad N は「PNGの下端を接地線に置き、絵はそこから N px 上」
   にする。N がそのまま「マスの手前角からどれだけ奥に置くか」になる。

   これも2回まわり道した:
     --sit    絵の最下点を接地線へ … マスより小さい物がマスの前半分に寄る
     --center 外接矩形の中心をマスの中心へ … 計算は合うが、見た目はまだ手前だった
   結局「下にどれだけ余白を置くか」を直に指定するのが分かりやすい。
   **共通7種には使わないこと**(あちらは殻の時点で位置が合っている)。 */
const pi = args.indexOf('--pad');
const padBottom = pi>=0 ? Math.round(Number(args[pi+1])) : 0;
if(!(padBottom>=0)) { console.log('--pad は0以上の整数'); process.exit(1); }
const ki = args.indexOf('--scale');
const manualScale = ki>=0 ? Number(args[ki+1]) : 1;
if(!(manualScale>0)) { console.log('--scale は正の数'); process.exit(1); }
/* --bleed は「枠の外 N px までを絵として拾う」。植物の葉のように枠から出て描かれた物の救済。
   既定は0(＝従来どおり枠の中だけ)。外へ広げると線の外縁の中間色を物と誤認する恐れがあるが、
   その帯は印から D px 以内なので isBg が落とす。隣の枠の内側は inOther が除く。
   救済であって規格ではない: 使ったら fit に bleed として残す。 */
const bi = args.indexOf('--bleed');
const bleed = bi>=0 ? Math.round(Number(args[bi+1])) : 0;
if(!(bleed>=0)) { console.log('--bleed は0以上の整数'); process.exit(1); }
/* --flip は絵を左右反転する。向きだけが他テーマと逆に描かれてきたときの手当て。 */
const flip = args.includes('--flip');
/* --mark-tol は印(#00E5FF)と判定する色の距離。既定70。絵がシアンに近い色を使うテーマで下げる。 */
const mi = args.indexOf('--mark-tol');
if(mi>=0){ markTol = Number(args[mi+1]);
  if(!(markTol>0)) { console.log('--mark-tol は正の数'); process.exit(1); }
  console.log(`  印の判定を #00E5FF から距離 ${markTol} 以内に絞る(既定70)`); }
fs.mkdirSync(outDir, { recursive:true });

const sh = readPNG(sheetFile);
const spec = JSON.parse(fs.readFileSync(cellsFile,'utf8'));
/* 印の色は殻が持っている。ice のように印を差し替えた殻でもそのまま焼ける */
if(spec.mark){ const m=/^#?([0-9a-f]{6})$/i.exec(spec.mark);
  if(m){ MARK=[parseInt(m[1].slice(0,2),16),parseInt(m[1].slice(2,4),16),parseInt(m[1].slice(4,6),16)];
    if(m[1].toLowerCase()!=="00e5ff") console.log(`  印の色は殻の指定 #${m[1].toLowerCase()} を使う`); } }
const get=(x,y)=>{const i=(y*sh.w+x)*sh.ch; return [sh.px[i],sh.px[i+1],sh.px[i+2]];};

/* シアンの印(枠と菱形)のマスク。
   純粋なシアンの画素と、そこから D px 以内にある青緑寄りの画素(＝線の縁の中間色)を落とす。

   ここは3通り試した:
     色だけ           … 湯が丸ごと消えた(淡い水色が「印」の判定に入る)
     つながりで塗る   … もっと悪い。湯が1点でも菱形に触れていれば連結して全部消える
     色 ＋ D px 以内  … これ。印から離れた水色は残る
   D は線の縁の中間色(実測1〜2px)を消せる最小に留める。大きくすると、印に接している
   絵(露天風呂の奥側の湯)がそのぶん削れる。 */
const D = Math.max(4, Math.round(sh.w*0.004));
const markPx = new Uint8Array(sh.w*sh.h);
for(let y=0;y<sh.h;y++) for(let x=0;x<sh.w;x++) if(isMark(get(x,y))) markPx[y*sh.w+x]=1;
const markD = new Uint8Array(sh.w*sh.h);
for(let y=0;y<sh.h;y++) for(let x=0;x<sh.w;x++){
  if(!markPx[y*sh.w+x]) continue;
  for(let dy=-D;dy<=D;dy++){ const ny=y+dy; if(ny<0||ny>=sh.h) continue;
    for(let dx=-D;dx<=D;dx++){ const nx=x+dx; if(nx<0||nx>=sh.w) continue; markD[ny*sh.w+nx]=1; } }
}
/* 印から D px 以内の「線の縁」を落とす判定。
   cyanish / isBlend はシアンの印むけに作った条件で、**印がシアンでないときは有害**。
   ice(印をオレンジにした殻)で、氷の淡い水色 rgb(200,235,250) が cyanish に当てはまり、
   枠線に接した結晶の先が消えて平らに切れた。印がシアンのときだけ従来どおりにする。 */
const markIsCyan = MARK[0]===0 && MARK[1]===229 && MARK[2]===255;
const isBg = (x,y,c)=> markPx[y*sh.w+x]
  || (markD[y*sh.w+x] && (nearMarkLine(c) || (markIsCyan && (cyanish(c)||isBlend(c)))))
  || killMag(c);

/* シアンの連結成分を拾う。枠と菱形の見分けは次のブロックでやる */
const seen=new Uint8Array(sh.w*sh.h), comps=[];
for(let y=0;y<sh.h;y++) for(let x=0;x<sh.w;x++){
  const k=y*sh.w+x; if(seen[k]) continue;
  if(!isMark(get(x,y))){ seen[k]=1; continue; }
  const q=[k]; seen[k]=1; let n=0,x0=x,x1=x,y0=y,y1=y;
  while(q.length){
    const c=q.pop(), cy=(c/sh.w)|0, cx=c%sh.w; n++;
    if(cx<x0)x0=cx; if(cx>x1)x1=cx; if(cy<y0)y0=cy; if(cy>y1)y1=cy;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const nx=cx+dx, ny=cy+dy;
      if(nx<0||ny<0||nx>=sh.w||ny>=sh.h) continue;
      const nk=ny*sh.w+nx; if(seen[nk]) continue;
      seen[nk]=1; if(isMark(get(nx,ny))) q.push(nk);
    }
  }
  const bw=x1-x0+1, bh=y1-y0+1;
  if(bw<40||bh<40) continue;
  comps.push({n,x0,x1,y0,y1,bw,bh, fill:n/(bw*bh)});
}
/* 枠と菱形の見分け方。「輪郭は占有率が低い」では駄目だった: 菱形が物に隠れて欠けると
   占有率が下がり、枠と区別できなくなる（実測で枠が6個のはずが9個になった）。
   確実なのは包含関係。菱形は必ずどれかの枠の内側にあるので、
   「他のかたまりの外接矩形に収まっているものは枠ではない」で落とせる。 */
/* 「1体だけならキャンバスの縁を枠とみなす」分岐が以前あったが消した。生成物は依頼した
   寸法で返らない(384x533 で頼んで 848x1264、縦横比が7%違う)ので、縁は基準にならない。
   1体でも枠は描く。カスタムの殻も枠つきに作り直してある。 */
/* 外接矩形が重なる塊どうしは、同じ枠の断片とみなして併合する。
   枠は1本の線なので普通は1つの連結成分になるが、**物が線を跨いで描かれると線が分断され**、
   1枚の枠が2つ以上の塊として出てくる(jungle の植物。葉が枠の左右を横切って3つに割れた)。
   そのまま数えると枠が8個になり、スロットの割り当てが1つずつ後ろへずれて、
   椅子の枠から葉が出てきた。枠の中の菱形も外接矩形が枠に含まれるのでここで併合されるが、
   併合しても矩形は枠のままなので影響はない。 */
/* その塊だけで四辺が閉じているか(＝それ単体で1枚の枠か)。
   閉じている塊は、隣とどれだけ端が揃っていても別の枠なので併合してはいけない。
   これを見ないと、同じ行に並ぶ高さの揃った枠どうし(egypt の椅子と棚)が
   「端が揃っていて隙間が小さい」に当てはまって1つに融合した。 */
const isClosed = (c)=>{
  const lw = Math.max(2, Math.round(Math.min(c.bw,c.bh)*0.06));
  const has = (x,y)=> x>=0 && y>=0 && x<sh.w && y<sh.h && markPx[y*sh.w+x];
  const band = (fix, from, to, horiz)=>{           // 帯の中に印がある割合
    let n=0;
    for(let v=from; v<=to; v++){
      let hit=false;
      for(let d=0; d<=lw && !hit; d++) hit = horiz ? has(v, fix+d) || has(v, fix-d) : has(fix+d, v) || has(fix-d, v);
      if(hit) n++;
    }
    return n/(to-from+1);
  };
  return band(c.y0, c.x0, c.x1, true)  >= 0.9 && band(c.y1, c.x0, c.x1, true)  >= 0.9
      && band(c.x0, c.y0, c.y1, false) >= 0.9 && band(c.x1, c.y0, c.y1, false) >= 0.9;
};
{
  const m = comps.map(c=>({...c, closed:isClosed(c)}));
  for(let again=true; again; ){
    again=false;
    for(let i=0;i<m.length && !again;i++) for(let j=i+1;j<m.length;j++){
      const a=m[i], b=m[j];
      /* 併合するのは次の2つだけ。緩めると連鎖して全部が1つの巨大な矩形に育つ
         (「片方の軸でよく重なっていれば併合」にしたら 10個 → 1個 になった)。
           1. 外接矩形が重なっている … 枠の中の菱形や、線に接した破片
           2. 端が揃っていて隙間が小さい … 枠が上下(左右)に割れた場合。
              割れると外接矩形は重ならないが、**割れた両片は同じ辺を共有する**ので
              x(または y)の両端がほぼ一致する。jungle の植物は葉が左右の線を横切り、
              枠が上下に割れて 30px の隙間ができた(枠の高さの22%)。
              隣の枠は端が揃わない(同じ行なら y0 が30px違い、同じ列なら x1 が110px違う)。 */
      const hit = !(a.x0>b.x1 || b.x0>a.x1 || a.y0>b.y1 || b.y0>a.y1);
      const tol = Math.max(4, Math.round(Math.min(a.bw,b.bw,a.bh,b.bh)*0.03));
      const gapY = Math.max(a.y0,b.y0) - Math.min(a.y1,b.y1) - 1;
      const gapX = Math.max(a.x0,b.x0) - Math.min(a.x1,b.x1) - 1;
      const split = !a.closed && !b.closed && (
                    (Math.abs(a.x0-b.x0)<=tol && Math.abs(a.x1-b.x1)<=tol && gapY <= 0.35*Math.min(a.bh,b.bh))
                 || (Math.abs(a.y0-b.y0)<=tol && Math.abs(a.y1-b.y1)<=tol && gapX <= 0.35*Math.min(a.bw,b.bw)));
      if(!hit && !split) continue;
      a.x0=Math.min(a.x0,b.x0); a.x1=Math.max(a.x1,b.x1);
      a.y0=Math.min(a.y0,b.y0); a.y1=Math.max(a.y1,b.y1);
      a.n+=b.n; a.bw=a.x1-a.x0+1; a.bh=a.y1-a.y0+1; a.fill=a.n/(a.bw*a.bh); a.closed=a.closed||b.closed;
      m.splice(j,1); again=true; break;
    }
  }
  if(m.length !== comps.length) console.log(`  分断された枠を併合: ${comps.length}個 → ${m.length}個`);
  comps.splice(0, comps.length, ...m);
}
const big = comps.slice().sort((a,b)=>(b.bw*b.bh)-(a.bw*a.bh));
const frames = [];
for(const c of big){
  const inside = frames.some(f => c.x0>=f.x0-2 && c.x1<=f.x1+2 && c.y0>=f.y0-2 && c.y1<=f.y1+2);
  if(!inside) frames.push(c);
}
frames.sort((a,b)=>
  (a.y1 > b.y1 + a.bh*0.5 ? 1 : b.y1 > a.y1 + b.bh*0.5 ? -1 : a.x0 - b.x0));
const names = spec.cells.map(c=>c.k);
console.log(`シアンの塊 ${comps.length}個 → 枠 ${frames.length}個 (期待 ${names.length})`);
if(frames.length !== names.length){
  console.log('⚠ 枠の数が合いません。生成をやり直すか、枠が塗り替えられていないか確認してください');
  /* どれが余分(または欠け)なのか分からないと直しようがないので、見つけた枠を全部出す */
  for(const [i,f] of frames.entries())
    console.log(`   枠${i}: ${f.bw}x${f.bh}px @(${f.x0},${f.y0})-(${f.x1},${f.y1}) 塗り${(f.fill*100)|0}%`);
}

const fit={}, rows=[], crops=[];
for(const [i,fr] of frames.entries()){
  const cellK = names[i] || `cell${i}`;
  const slot = (slotOverride && frames.length===1) ? slotOverride : cellK;
  const cell = spec.cells[i];
  const gameW = cell ? cell.w/spec.scale : 64;          // その枠がゲーム内で何pxになるか
  const s = gameW / fr.bw * manualScale;                // 枠の幅を合わせる倍率(--scale で手動補正)

  const [sn0,sm0] = SHAPE[cellK] || [1,1];
  const lw = Math.max(2, Math.round(fr.bw*0.06));
  /* 探す範囲は枠の外接矩形まで(線の帯も含める)。線の内側だけに限ると、線に触れた部分が
     黙って捨てられて絵が欠ける（畳の手前角が削れた）。線そのものはシアンなので拾わない。
     外側へは広げない: 線の外縁にはマゼンタとの中間色が出ていて、それを物と誤認する。 */
  const ix0=Math.max(0,fr.x0-bleed), ix1=Math.min(sh.w-1,fr.x1+bleed),
        iy0=Math.max(0,fr.y0-bleed), iy1=Math.min(sh.h-1,fr.y1+bleed);
  const inOther=(x,y)=>frames.some(o=>o!==fr && x>=o.x0 && x<=o.x1 && y>=o.y0 && y<=o.y1);
  let x0=ix1, x1=ix0, y0=iy1, y1=iy0, any=false;
  for(let y=iy0;y<=iy1;y++) for(let x=ix0;x<=ix1;x++){
    const c=get(x,y); if(isBg(x,y,c) || inOther(x,y)) continue;
    any=true; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
  }
  if(!any){ console.log(`  ${slot}: 中身が空 → スキップ`); continue; }
  const bw=x1-x0+1, bh=y1-y0+1;
  const ow=Math.max(1,Math.round(bw*s)), oh=Math.max(1,Math.round(bh*s));
  const out=Buffer.alloc(ow*oh*4);
  for(let oy=0;oy<oh;oy++) for(let ox=0;ox<ow;ox++){
    let r=0,g=0,b=0,a=0,tot=0;
    for(let y=Math.floor(y0+oy/s); y<Math.min(y1+1, Math.ceil(y0+(oy+1)/s)); y++)
      for(let x=Math.floor(x0+ox/s); x<Math.min(x1+1, Math.ceil(x0+(ox+1)/s)); x++){
        const c=get(x,y); tot++;
        if(isBg(x,y,c) || inOther(x,y)) continue;
        r+=c[0]; g+=c[1]; b+=c[2]; a++;
      }
    const o=(oy*ow+ox)*4;
    if(!a || a/tot < 0.5){ out[o+3]=0; continue; }
    out[o]=Math.round(r/a); out[o+1]=Math.round(g/a); out[o+2]=Math.round(b/a); out[o+3]=255;
  }
  /* 仕上げに孤立した数pxの点を落とす。枠線の縁の中間色が縮小で1画素だけ生き残ることがある
     （実測: 椅子の右端に1px）。本体から離れた3px以下の塊は、この大きさでは意味を持たない。 */
  let specks=0;
  {
    const seen=new Uint8Array(ow*oh), lumps=[];
    for(let y=0;y<oh;y++) for(let x=0;x<ow;x++){
      const k=y*ow+x; if(seen[k]) continue;
      if(out[k*4+3]<128){ seen[k]=1; continue; }
      const q=[k]; seen[k]=1; const px=[];
      while(q.length){
        const c=q.pop(), cy=(c/ow)|0, cx=c%ow; px.push(c);
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
          const nx=cx+dx, ny=cy+dy; if(nx<0||ny<0||nx>=ow||ny>=oh) continue;
          const nk=ny*ow+nx; if(seen[nk]) continue;
          seen[nk]=1; if(out[nk*4+3]>=128) q.push(nk);
        }
      }
      lumps.push(px);
    }
    for(const px of lumps){
      if(px.length > 3) continue;
      for(const k of px) out[k*4+3]=0;
      specks += px.length;
    }
  }
  /* 孤立点を消したぶん、余白が残ることがある(切り出し範囲は消す前に決めているため。
     実測: ランプの左に10pxの空白)。残った不透明画素で切り直す。 */
  let cw=ow, chh=oh, cout=out, padL=0, padT=0;
  {
    let ax0=ow, ax1=-1, ay0=oh, ay1=-1;
    for(let y=0;y<oh;y++) for(let x=0;x<ow;x++){
      if(out[(y*ow+x)*4+3]<128) continue;
      if(x<ax0)ax0=x; if(x>ax1)ax1=x; if(y<ay0)ay0=y; if(y>ay1)ay1=y;
    }
    if(ax1>=ax0 && (ax0>0||ay0>0||ax1<ow-1||ay1<oh-1)){
      cw=ax1-ax0+1; chh=ay1-ay0+1; padL=ax0; padT=ay0;
      cout=Buffer.alloc(cw*chh*4);
      for(let y=0;y<chh;y++) out.copy(cout, y*cw*4, ((y+ay0)*ow+ax0)*4, ((y+ay0)*ow+ax1+1)*4);
    }
  }
  /* 余白。下は「マスのどこに置くか」を決める実効の余白。上は同じ量を足すだけで、
     盤面の見え方は変わらない(接地点は比率 by で持つので、高さと by が同じ割合で増える)。
     上を足すのは一覧(レイアウト編集のパレット・ショップ)で PNG をそのまま並べるため。
     下だけ足すと絵が枠の上寄りに見えてバランスが悪い。 */
  if(padBottom>0){
    const nh=chh+padBottom*2, nb=Buffer.alloc(cw*nh*4);
    cout.copy(nb, cw*padBottom*4); cout=nb; chh=nh; padT+=padBottom/s;
  }
  /* --flip は絵を左右反転する。アイソメでは水平反転が90度回した向きに相当するので
     (ゲーム側も dir==='v' を setFlipX で表している)、向きだけが他テーマと逆に
     描かれてきたときの手当てになる。生成をやり直す必要はない。
     反転すると接地点の x も鏡になるので、下の cx で 1-cx にする。 */
  if(flip){
    const nb=Buffer.alloc(cw*chh*4);
    for(let y=0;y<chh;y++) for(let x=0;x<cw;x++)
      cout.copy(nb, (y*cw+(cw-1-x))*4, (y*cw+x)*4, (y*cw+x)*4+4);
    cout=nb;
  }
  writePNG(path.join(outDir, `prop_${prefix}_${slot}.png`), cw, chh, cout);
  crops.push({slot, ow:cw, oh:chh, out:cout});

  const r4=(v)=>Math.round(v*10000)/10000;
  /* 接地線は枠の下辺そのものではない。殻はキャンバスを線幅ぶん広げてあるので、
     菱形の手前角は下辺より少し上にある。その比 gy を殻の JSON が持っている。 */
  const gy = cell && cell.gy ? cell.gy : 1;
  /* 接地線は必ず枠から出す。絵の最下点で代用してはいけない:
     足元がマスより小さい家具は、自分の手前角がマスの手前角より上に来るのが正しく、
     by が 1.0 を超える。これは浮きではない。絵の最下点を接地点にすると、
     小さい家具ほど手前へ押し出されてマスからずれる。 */
  const cxFrame=(fr.x0+fr.x1+1)/2, byFrame = fr.y0 + fr.bh*gy;   // 枠の中心x / 接地線
  /* --pad を使ったら「絵の下端 + padBottom」が接地線。上の余白は接地点より下には
     効かないので、by は (上の余白 + 絵 + 下の余白) 分の (上の余白 + 絵 + 下の余白) = 1 */
  const byRatio = padBottom>0 ? 1 : ((byFrame-y0)*s-padT)/chh;
  const cxR = ((cxFrame-x0)*s-padL)/cw;
  fit[`${prefix}_${slot}`] = { cx:r4(flip ? 1-cxR : cxR), by:r4(byRatio),
    px:[cw,chh], shape:[sn0,sm0],
    ...(manualScale!==1 ? {scale:manualScale} : {}), ...(padBottom ? {pad:padBottom} : {}),
    ...(bleed ? {bleed} : {}), ...(flip ? {flip:1} : {}), ...(markTol!==70 ? {markTol} : {}) };
  /* 枠の外へ絵が出ていないか。切り出しは枠の内側だけなので、出ていた分は黙って捨てられる。
     捨てた量を数えないと「収まっているように見えて実は切れている」を見逃す。 */
  /* 線の縁にはマゼンタとシアンの中間色が1〜2px出る。厳しい判定のままだとこれを「物」と
     数えて全件が「切れている」になるので、判定を緩めたうえで線から数px離す。 */
  let spill=0;
  /* --bleed で拾うと決めた範囲は「はみ出し」ではないので、死角も同じだけ広げる */
  const dead=Math.max(4, Math.round(lw*0.8))+bleed, band=dead+Math.max(6, lw*2);
  for(let y=Math.max(0,fr.y0-band); y<=Math.min(sh.h-1,fr.y1+band); y++)
    for(let x=Math.max(0,fr.x0-band); x<=Math.min(sh.w-1,fr.x1+band); x++){
      if(x>=fr.x0-dead && x<=fr.x1+dead && y>=fr.y0-dead && y<=fr.y1+dead) continue;
      /* 隣の枠の中は数えない。枠が太い(セルが塗りつぶしになった)ときに帯が隣のセルへ
         届いて、隣の物を「はみ出し」と誤検知した。
         外側にも隣の線幅ぶんの余白を取る: 生成側がシアンの枠のさらに外に黒い縁を
         描いてくることがあり(onsen で実際に出た)、それが隣の枠の飾りなのに
         こちらの「はみ出し」として数えられていた。1体あたり最大4400画素の誤検知。 */
      if(frames.some(o=>{ if(o===fr) return false;
        const m=Math.max(4, Math.round(o.bw*0.06*1.5));
        return x>=o.x0-m && x<=o.x1+m && y>=o.y0-m && y<=o.y1+m; })) continue;
      const c=get(x,y); if(!isBg(x,y,c)) spill++;
    }
  /* 枠に対する物の入り方。1.00 を超えていたら線を越えている。
     ただし枠が足元より広い殻(カスタム)ではこれが緩くなるので、
     本当に見たい「足元のマスに収まっているか」は下の maskW で別に出す。 */
  const wOver=bw/(fr.bw-2*lw), below=(y1-(byFrame-1))*s;
  /* 接地線と絵の下端の隙間。by>1.0 自体は正常(コンパクトな家具は自分の手前角がマスの
     手前角より上に来る)だが、それはマスの奥行きに対して小さい差のはず。マスの奥行きの
     半分近くなったら、絵が枠の下辺に接しておらず宙に浮く。
     実測: 採用した japan 7点は rug -0% / table 9% / sofa 9% / chair 14% / shelf 17% /
     lamp 32% / plant 31%。失敗した屏風(縦に中央寄せされた)は 57%。境目は 45% に置いた。 */
  const [sn,sm] = [sn0,sm0];
  const gap = (byFrame - (y1+1)) * s, depth = (sn+sm)*CELL_W/4;
  /* 足元のマス(接地菱形)に対する絵の幅。枠に対する幅は殻の取り方で変わるが、
     こちらは盤面の寸法そのもの。ただし**張り出しも数える**ので足元の大きさではない:
     化石の尻尾や植物の葉はマスの外へ出てよく、それで 1.1 前後になる。
     目安 japan/dino の7点 0.61〜0.96 / 尻尾つきの化石 1.13(問題なし)。
     1.20 を超えたら足元ごと大きい疑いが濃いので見に行く、程度の指標。 */
  const maskW = cw / ((sn+sm)*CELL_W/2);
  rows.push(`  ${(prefix+'_'+slot).padEnd(12)} ${String(cw).padStart(3)}x${String(chh).padStart(3)}px`
    + `  絵の幅/マス ${maskW.toFixed(2)}` + (maskW>1.20 ? ' ⚠大きすぎ' : '')
    + `  枠に対する幅 ${wOver.toFixed(2)}` + (wOver>1 ? ' ⚠枠越え' : '')
    + `  接地線との隙間 ${(gap/depth*100).toFixed(0)}%` + (gap/depth>0.45 ? ' ⚠浮いている' : '')
    + `  枠外へ捨てた画素 ${spill>50 ? spill+' ⚠切れている' : spill}`
    + (specks ? `  孤立点 ${specks}px を除去` : ''));
}
fs.writeFileSync(path.join(outDir, `prop-fit-${prefix}.json`), JSON.stringify(fit,null,0)+'\n');

/* 検収用のコンタクトシート。数値だけで判断しないための一枚 */
if(crops.length){
  const pad=6, H=Math.max(...crops.map(c=>c.oh))+pad*2;
  const W=crops.reduce((a,c)=>a+c.ow+pad,pad);
  const cs=Buffer.alloc(W*H*4);
  let cx=pad;
  for(const c of crops){
    const top=H-pad-c.oh;
    for(let y=0;y<c.oh;y++) for(let x=0;x<c.ow;x++){
      const s4=(y*c.ow+x)*4, d4=((top+y)*W+(cx+x))*4;
      cs[d4]=c.out[s4]; cs[d4+1]=c.out[s4+1]; cs[d4+2]=c.out[s4+2]; cs[d4+3]=c.out[s4+3];
    }
    cx += c.ow+pad;
  }
  writePNG(path.join(outDir, `_contact-${prefix}.png`), W, H, cs);
}
console.log(rows.join('\n'));
console.log(`${crops.length}体 → ${path.relative(ROOT,outDir)}  検収は _contact-${prefix}.png を見ること`);

// 装飾品の接地(game/scene/machine-art.mjs の propImage)を Phaser スタブ上で検証する。実行: node test/test_props.mjs
//
// 見ているのは3つ。どれも「絵の中身」ではなく「絵をどこにどの大きさで置くか」の規格。
//   1. 足元の中心が、占有ブロックの接地菱形の中心に乗る（マスの端に寄らない）
//   2. 絵がマスからはみ出さない（幅・高さの上限を超えない）
//   3. 大きさが揃う（上限に当たらない限り、足元の幅は菱形の幅の PROP_FIT.foot 倍ちょうど）
// 290体すべてに対して回す。絵を差し替えたり prop-fit.json を測り直したときの見張りになる。
import fs from 'node:fs';

globalThis.window = {};                    // catalog.mjs が評価時に window.PROP_SPAN を置く
const { MachineArt } = await import('../game/scene/machine-art.mjs');
const { PROP_FIT, isFlatProp, propShape } = await import('../game/scene/catalog.mjs');
const { blockIso } = await import('../game/scene/iso.mjs');

const FIT = JSON.parse(fs.readFileSync(new URL('../assets/props/prop-fit.json', import.meta.url), 'utf8'));

/* Phaser の Image のスタブ。propImage が使う setOrigin/setPosition/setDepth/setScale だけ
   実際に値を控える(チェーンできるよう自分自身を返す)。幅と高さは実物のPNGから読む。 */
const img = (w, h) => { const o = {
  width:w, height:h, x:0, y:0, originX:0.5, originY:0.5, depth:0, scale:1,
  setOrigin(a,b){ o.originX=a; o.originY=(b===undefined?a:b); return o; },
  setPosition(x,y){ o.x=x; o.y=y; return o; },
  setDepth(d){ o.depth=d; return o; },
  setScale(s){ o.scale=s; return o; },
  setTint(){ return o; },
  setFlipX(v){ o.flipX=v; return o; },
}; return o; };
const pngWH = (p) => { const b = fs.readFileSync(p); return { w:b.readUInt32BE(16), h:b.readUInt32BE(20) }; };   // IHDR

const scene = Object.assign(Object.create(null), MachineArt, {
  add:{ image:(_x,_y,key)=>{ const n=key.replace(/^prop_/,''); const s=pngWH(new URL(`../assets/props/prop_${n}.png`, import.meta.url)); return img(s.w, s.h); } },
  cache:{ text:{ get:()=>JSON.stringify(FIT) } },
});

let fail = 0, n = 0;
const ok = (cond, msg) => { n++; if(!cond){ fail++; console.log('  NG  ' + msg); } };
const EPS = 0.01;

/* 描かれる矩形(画面座標)を原点と倍率から復元する */
function rect(o){
  const w = o.width*o.scale, h = o.height*o.scale;
  return { x0:o.x - o.originX*w, y0:o.y - o.originY*h, w, h };
}

console.log('=== 装飾品の接地 (290体) ===');
const names = Object.keys(FIT).sort();
let clamped = 0, exact = 0, baked = 0;
for(const name of names){
  const f = FIT[name], e = { kind:'prop', variant:name, cell:{c:3, r:4} };
  const o = scene.propImage(e);
  // 形は焼き込み済みなら fit が持つ(コマ数の表は旧290体むけ)
  const [nn,mm] = f.shape || propShape(name), b = blockIso(3, 4, nn, mm);
  const R = rect(o), flat = isFlatProp(name);
  const bad = [o.x,o.y,o.scale].some(v => !Number.isFinite(v));
  ok(!bad, `${name}: 位置と倍率が数値になる`);
  if(bad) continue;

  /* 新規格(殻から作った絵)。焼き込みの時点で1マスの大きさに合わせてあるので、
     ゲーム側は等倍で置くだけ。接地点(cx,by)が「菱形の中心x・手前角のy」に乗る。 */
  if(f.baked){
    baked++;
    ok(o.scale === 1, `${name}: 等倍で描く(焼き込み済み)`);
    ok(Math.abs(R.x0 + f.cx*R.w - (b.back.x+b.front.x)/2) < EPS, `${name}: 接地点 x が菱形の中心に乗る`);
    ok(Math.abs(R.y0 + f.by*R.h - b.front.y) < EPS, `${name}: 接地点 y が菱形の手前角に乗る`);
    ok(R.w <= 1.15*b.w + 1, `${name}: 幅がマスの1.15倍以内`);
    continue;
  }
  if(flat){
    // ラグは床に寝かせる平物。絵の全幅を菱形の幅に合わせ、菱形の中心へ
    const cx = (b.back.x+b.front.x)/2, cy = (b.back.y+b.front.y)/2;
    ok(Math.abs(R.x0 + f.left*R.w + f.w*R.w/2 - cx) < EPS, `${name}: bbox の中心 x が菱形の中心に乗る`);
    ok(Math.abs(R.y0 + (f.by - f.h/2)*R.h - cy) < EPS, `${name}: bbox の中心 y が菱形の中心に乗る`);
    ok(Math.abs(f.w*R.w - b.w) < EPS, `${name}: 絵の幅が菱形の幅ちょうど`);
    continue;
  }
  // 1. 自分の接地菱形の中心が、マスの菱形の中心に重なる。
  //    原点(絵の最下点)は自分の菱形の手前角なので、中心から fw/4 下がった位置に来る
  const fw = f.bw*R.w;
  ok(Math.abs(R.x0 + f.cx*R.w - (b.back.x+b.front.x)/2) < EPS, `${name}: 足元の中心 x が菱形の中心に乗る`);
  ok(Math.abs(R.y0 + f.by*R.h - ((b.back.y+b.front.y)/2 + fw/4)) < EPS, `${name}: 足元の菱形の中心 y がマスの菱形の中心に乗る`);
  // 2. マスからはみ出さない
  ok(f.w*R.w <= PROP_FIT.maxW*b.w + EPS, `${name}: 幅が上限(菱形の${PROP_FIT.maxW}倍)以内`);
  ok(f.h*R.h <= PROP_FIT.maxH*b.w + EPS, `${name}: 高さが上限(菱形の${PROP_FIT.maxH}倍)以内`);
  // 3. 上限に当たっていなければ、足元の幅は菱形の foot 倍ちょうど(=大きさが揃う)
  const foot = f.bw*R.w, want = PROP_FIT.foot*b.w;
  ok(foot <= want + EPS, `${name}: 足元が規定の幅を超えない`);
  if(Math.abs(foot - want) < EPS) exact++; else clamped++;
  // 深度は自分の接地点(=絵の最下点)の y。手前にある物ほど後に描かれる
  ok(o.depth === o.y, `${name}: 深度が接地点の y`);
}
console.log(`  新規格(焼き込み済み) ${baked}体 / 旧規格: 足元ぴったり ${exact}体 / 上限で縮めた ${clamped}体`);

/* 細長いブロック(1×2)は、菱形の手前角と中心xが半マス(約14px)ずれる。
   手前角のxに置くと物が左へ寄るので、横は中心x・縦は手前角のy を使う。 */
console.log('\n=== 1×2 の横位置 ===');
/* 見本は「まだ焼き込んでいない 1×2」から選ぶ。名前を直に書くと、その物を
   焼き込んだ瞬間にこの検査が旧規格の式で新規格の fit を見て落ちる(arb_sofa で起きた)。 */
const legacy1x2 = names.find(k => !FIT[k].baked && !isFlatProp(k) && propShape(k)[1] === 2);
{
  const b = blockIso(3, 4, 1, 2);
  const gap = Math.abs(b.front.x - (b.back.x+b.front.x)/2);
  ok(gap > 13 && gap < 15, `1×2 では手前角が菱形の中心から ${gap.toFixed(1)}px ずれている(=区別が要る)`);
  const name = legacy1x2, f = FIT[name];
  const o = scene.propImage({ kind:'prop', variant:name, cell:{c:3, r:4} }), R = rect(o);
  ok(Math.abs(R.x0 + f.cx*R.w - (b.back.x+b.front.x)/2) < EPS, `${name}(1×2): 足元が菱形の中心xに乗る`);
  const fw = f.bw*R.w;
  ok(Math.abs(R.y0 + f.by*R.h - ((b.back.y+b.front.y)/2 + fw/4)) < EPS, `${name}(1×2): 足元の菱形の中心がマスの中心に乗る`);
  // 手前角に合わせていた頃は、足元がマスいっぱいでないぶんだけ手前へずれていた
  ok(b.front.y - ((b.back.y+b.front.y)/2 + fw/4) > 5, `${name}(1×2): 旧実装(手前角合わせ)なら ${(b.front.y-((b.back.y+b.front.y)/2+fw/4)).toFixed(1)}px 手前へずれていた`);
}

/* 未測定の絵は旧規格(高さ基準・マス中心)へ落ちる。prop-fit.json を消しても盤面が壊れないこと */
console.log('\n=== 実測が無い個体のフォールバック ===');
{
  const bare = Object.assign(Object.create(null), MachineArt, { add:scene.add, cache:{ text:{ get:()=>'{}' } } });
  const o = bare.propImage({ kind:'prop', variant:'arb_chair', cell:{c:0, r:0} });
  ok(Number.isFinite(o.x) && Number.isFinite(o.scale) && o.scale > 0, 'prop-fit.json が空でも描ける');
  ok(o.originX === 0.5 && o.originY === 1, '旧規格の原点(下端中央)に戻る');
}

/* 中心ズレが大きかった個体。旧規格では bbox の中心をマス中心に置いていたので、
   足元の中心はマス中心から f.cx-bbox中心 のぶんだけ外れていた。新規格でそれが 0 になる。 */
console.log('\n=== 中心ズレの大きかった個体 ===');
for(const name of ['tky_lamp','cab_lamp','lantern','stm_shelf']){
  const f = FIT[name]; if(!f) continue;
  const o = scene.propImage({ kind:'prop', variant:name, cell:{c:3, r:4} });
  /* 形は焼き込み済みなら fit が持つ。コマ数の表(propShape)は旧290体むけで lamp が 1×2。
     テーマを焼き込むとその表と食い違い、別の大きさのブロックで判定してしまう
     (tokyo を焼いたときに tky_lamp がこれで落ちた。ゲーム側は既に fit.shape を見ている)。 */
  const [nn,mm] = f.shape || propShape(name), b = blockIso(3, 4, nn, mm), R = rect(o);
  const off = Math.abs(R.x0 + f.cx*R.w - (b.back.x+b.front.x)/2);
  const wasOff = f.left!=null ? (Math.abs(f.cx - (f.left + f.w/2)) / f.w * 100).toFixed(0)+'%' : '焼き込み済み';
  ok(off < EPS, `${name}: 足元の中心がマス中心に乗る (旧規格では bbox 中心から ${wasOff} ずれていた)`);
}


/* 新規格の装飾品は複数マスを占め、90度回すと占有も入れ替わる（製造機と同じ）。
   旧290体は1マスのまま: 占有を後から広げると保存済みレイアウトが復元できなくなる。 */
console.log('\n=== 新規格の占有と回転 ===');
{
  const S = Object.assign(Object.create(null), MachineArt, { add:scene.add, cache:scene.cache });
  const baked = Object.entries(FIT).filter(([,v])=>v.baked);
  for(const [name, f] of baked){
    const [n,m] = f.shape;
    const u = S.cellsOf({ kind:'prop', variant:name, dir:'u', cell:{c:3,r:4} });
    const v = S.cellsOf({ kind:'prop', variant:name, dir:'v', cell:{c:3,r:4} });
    ok(u.length === n*m, `${name}: u向きで ${n*m} マス占有 (実際 ${u.length})`);
    ok(v.length === n*m, `${name}: v向きでも同じマス数`);
    if(n!==m) ok(u.some(q=>!v.some(w=>w.c===q.c&&w.r===q.r)),
      `${name}: 回すと占有マスが変わる (${n}×${m} → ${m}×${n})`);
  }
  const legacy = S.cellsOf({ kind:'prop', variant:legacy1x2, dir:'u', cell:{c:0,r:0} });
  ok(legacy.length === 1, `旧規格の装飾品(${legacy1x2})は1マスのまま(保存レイアウトの互換)`);
  // v向きは絵を左右反転する
  const o = S.propImage({ kind:'prop', variant:'jpn_table', dir:'v', cell:{c:2,r:2} });
  ok(o.flipX === true, 'v向きは絵を左右反転する');
  const o2 = S.propImage({ kind:'prop', variant:'jpn_table', dir:'u', cell:{c:2,r:2} });
  ok(o2.flipX === false, 'u向きは反転しない');
}

console.log(fail ? `\n${fail} / ${n} 件 FAIL` : `\n${n} 件 すべて通過`);
process.exit(fail ? 1 : 0);

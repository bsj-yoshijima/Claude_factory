// ジャンル / 原材料 / 製品 / レシピ（factory-phaser.html の CRAFT-DATA ブロック）を検証する。
// 実行: node tools/test_craft.mjs
// ブロックだけを切り出して素の JS として評価するので、Phaser もブラウザも要らない。
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../factory-phaser.html', import.meta.url)).toString();
const cut = (a,b)=>{ const i=html.indexOf(a), j=html.indexOf(b);
  if(i<0||j<0) throw new Error(`マーカーが見つからない: ${a} / ${b}`);
  return html.slice(i, j+b.length); };
const rarLine = html.split('\n').find(l=>l.trim().startsWith('const RAR='));
if(!rarLine) throw new Error('const RAR= が見つからない');

const ctx = vm.createContext({ console });
vm.runInContext(
  rarLine + '\n' + cut('/* == CRAFT-DATA-START ==','/* == CRAFT-DATA-END == */')
  + '\n;globalThis.$={GENRES,GENRE,SECRET_G,MATS,MAT,PRODS,PROD,RECIPES,SECRETS,BLOB,RAR,'
  + 'genreOf,genresOfMats,normPool,poolFor,rollProduct};', ctx);
const $ = ctx.$;

let fail=0;
const ok=(cond,msg)=>{ console.log((cond?'  ok  ':'FAIL  ')+msg); if(!cond)fail++; };
const keyOf=(mats)=>[...new Set(mats)].sort().join(',');

console.log('[1] ジャンル');
ok($.GENRES.length>=3, `ジャンル ${$.GENRES.length} 種: ${$.GENRES.map(g=>g.n).join(' / ')}`);
ok(new Set($.GENRES.map(g=>g.id)).size===$.GENRES.length, 'ジャンルidが重複していない');
ok(!$.GENRE[$.SECRET_G], 'シークレットは原材料を持つジャンルに入っていない');

console.log('\n[2] 原材料');
ok(new Set($.MATS.map(m=>m.id)).size===$.MATS.length, `原材料idが重複していない（${$.MATS.length}種）`);
{ const bad=$.MATS.filter(m=>!$.GENRE[m.g]);
  ok(!bad.length, `全原材料が既知のジャンル${bad.length?' → '+bad.map(m=>m.id):''}`); }
for(const g of $.GENRES){ const n=$.MATS.filter(m=>m.g===g.id).length;
  ok(n>=2, `${g.e}${g.n}: 原材料 ${n}種（組み合わせを作れる数）`); }

console.log('\n[3] 製品');
ok(new Set($.PRODS.map(p=>p.id)).size===$.PRODS.length, `製品idが重複していない（${$.PRODS.length}種）`);
{ const bad=$.PRODS.filter(p=>!$.GENRE[p.g]&&p.g!==$.SECRET_G);
  ok(!bad.length, `全製品がジャンル or シークレット${bad.length?' → '+bad.map(p=>p.id):''}`); }
{ const bad=$.PRODS.filter(p=>!$.RAR[p.r]);
  ok(!bad.length, `全製品のレア度が RAR にある${bad.length?' → '+bad.map(p=>p.id):''}`); }
{ // 図鑑のヒントに使うので、製品の m は同ジャンルの実在する原材料であること
  const bad=$.PRODS.filter(p=>(p.m||[]).some(x=>!$.MAT[x]||(p.g!==$.SECRET_G&&$.MAT[x].g!==p.g)));
  ok(!bad.length, `製品の相性原材料が同ジャンルで実在${bad.length?' → '+bad.map(p=>p.id):''}`); }
for(const g of [...$.GENRES,{id:$.SECRET_G,n:'シークレット',e:'✨'}]){
  const n=$.PRODS.filter(p=>p.g===g.id).length; ok(n>0, `${g.e}${g.n}: 製品 ${n}種`); }
ok($.PROD[$.BLOB] && $.PROD[$.BLOB].g===$.SECRET_G, '🪨謎のカタマリはシークレットタブ側にいる');

console.log('\n[4] レシピ（キーの正規化 / 同ジャンル / 参照先）');
for(const k of Object.keys($.RECIPES)){
  const mats=k.split(',');
  const bad=mats.filter(x=>!$.MAT[x]);
  if(bad.length){ ok(false, `${k}: 未定義の原材料 ${bad.join(',')}`); continue; }
  ok(k===keyOf(mats), `${k}: キーがソート済み・重複なし`);
  const gs=$.genresOfMats(mats);
  ok(gs.length===1, `${k}: 同ジャンル（${gs.join('+')}）`);
  const pool=$.normPool($.RECIPES[k]);
  const ids=(Array.isArray($.RECIPES[k])?$.RECIPES[k].map(x=>Array.isArray(x)?x[0]:x):Object.keys($.RECIPES[k]));
  ok(pool.length===ids.length, `${k}: 製品${ids.length}件すべて実在`);
  ok(pool.every(x=>x.p.g===gs[0]), `${k}: 製品のジャンルが原材料と一致`);
  ok(pool.every(x=>x.w>0), `${k}: すべての確率が正`);
}

console.log('\n[5] シークレット（ジャンル跨ぎ限定）');
for(const k of Object.keys($.SECRETS)){
  const s=$.SECRETS[k], mats=k.split(',');
  const bad=mats.filter(x=>!$.MAT[x]);
  if(bad.length){ ok(false, `${k}: 未定義の原材料 ${bad.join(',')}`); continue; }
  ok(k===keyOf(mats), `${k}: キーがソート済み・重複なし`);
  ok($.genresOfMats(mats).length>1, `${k}: ジャンルを跨いでいる（${$.genresOfMats(mats).join('+')}）`);
  ok(!!$.PROD[s.pid] && $.PROD[s.pid].g===$.SECRET_G, `${k}: → ${s.pid} がシークレット製品として存在`);
  ok(s.p>0 && s.p<1, `${k}: 確率 ${(s.p*100).toFixed(1)}%（0<p<1）`);
  ok(!$.RECIPES[k], `${k}: 通常レシピと重複していない`);
}

console.log('\n[6] 抽選（rollProduct）');
const roll=(key,n)=>{ const c={}; for(let i=0;i<n;i++){ const p=$.rollProduct(key); c[p.id]=(c[p.id]||0)+1; } return c; };
{ // 同ジャンルのレシピ: 定義した製品しか出ない
  const key='glass,wire', want=new Set($.poolFor(key).map(x=>x.p.id));
  const got=Object.keys(roll(key,3000));
  ok(got.every(id=>want.has(id)), `${key}: 出たのは定義した製品だけ（${got.join(',')}）`);
  ok(!got.includes($.BLOB), `${key}: 🪨が混ざらない`); }
{ // 明示した比率どおりに出るか（{pc:55,...} 形式）
  const key='glass,iron,semic,wire', n=20000, c=roll(key,n);
  const spec=$.RECIPES[key], sum=Object.values(spec).reduce((a,b)=>a+b,0);
  const errs=Object.keys(spec).map(id=>Math.abs((c[id]||0)/n - spec[id]/sum));
  ok(Math.max(...errs)<0.02, `${key}: 明示した比率と一致（最大誤差 ${(Math.max(...errs)*100).toFixed(2)}pt）`); }
{ // 未定義の同ジャンル組み合わせ → 🪨
  const c=roll('rice,sugar',500);
  ok(Object.keys(c).length===1 && c[$.BLOB]===500, 'レシピに無い同ジャンルの組み合わせ → 🪨 のみ'); }
{ // ジャンル跨ぎ（隠しレシピ以外） → 🪨
  const c=roll('iron,milk',500);
  ok(Object.keys(c).length===1 && c[$.BLOB]===500, 'ジャンル跨ぎ（隠しレシピ外）→ 🪨 のみ'); }
{ // 隠しレシピ: ほとんど🪨、まれにシークレット。実測が p に寄るか
  for(const key of Object.keys($.SECRETS)){
    const s=$.SECRETS[key], n=40000, c=roll(key,n);
    const hit=(c[s.pid]||0)/n;
    ok(Object.keys(c).every(id=>id===s.pid||id===$.BLOB), `${key}: 出るのは ${s.pid} か 🪨 だけ`);
    ok(Math.abs(hit-s.p)<0.01, `${key}: ${s.pid} 実測 ${(hit*100).toFixed(2)}% ≒ 設定 ${(s.p*100).toFixed(1)}%`);
    ok((c[$.BLOB]||0)/n>0.5, `${key}: 跨ぎなので大半（${(((c[$.BLOB]||0)/n)*100).toFixed(1)}%）は 🪨`);
  } }
{ // 素材なし → 🪨（クラッシュしない）
  ok($.rollProduct(null).id===$.BLOB && $.rollProduct('').id===$.BLOB, '素材なし → 🪨'); }

console.log('\n[7] 到達性（全製品がどこかのレシピから出られるか）');
{ const reach=new Set([$.BLOB]);
  for(const k of Object.keys($.RECIPES)) for(const x of $.normPool($.RECIPES[k])) reach.add(x.p.id);
  for(const k of Object.keys($.SECRETS)) reach.add($.SECRETS[k].pid);
  const un=$.PRODS.filter(p=>!reach.has(p.id));
  const names=un.map(p=>p.e+p.n).join(' ');
  ok(!un.length, 'どのレシピからも出ない製品がない'+(un.length?' → '+names:'')); }

console.log(fail? `\n${fail} 件 FAIL` : '\nすべて通過');
process.exit(fail?1:0);

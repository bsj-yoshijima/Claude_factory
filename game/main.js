'use strict';
/* Claude Factory — Phaser 3 基盤
   1シーン統合(休憩室廃止) / 設置物セル占有＋BFS回避徘徊 / マスコット3ポーズ状態機械。
   追加: 接地影(背景に溶け込む), idle小ネタ(座り💤 / コーヒー☕ / 壁際にもたれる)。 */

const W = 1024, H = 572, GU = 12, GV = 12;
// ISO は背景 factory-room.png に「描かれた床タイル格子」(12x12)を画像から実測フィットした値。
// 旧値は床の縁(トリム)基準で、描き込みのタイル目地と半マス位相＋約5%ピッチがずれており、
// マス中心に置いた設置物が"目地の交差点"に乗って見えていた。GU/GV=12 は不変なので保存レイアウトは互換。
const ISO = { Bx:0.4930, By:0.3584, ux:0.3240, uy:0.3005, vx:-0.3281, vy:0.2864 };
const CELL = ( Math.hypot(ISO.ux*W/GU, ISO.uy*H/GU) + Math.hypot(ISO.vx*W/GV, ISO.vy*H/GV) ) / 2;
function isoToScreen(u,v){ return { x:(ISO.Bx+u*ISO.ux+v*ISO.vx)*W, y:(ISO.By+u*ISO.uy+v*ISO.vy)*H }; }
const OFF_U = 0, OFF_V = 0;
// オブジェクトは各マスの中心(c+0.5)/GU に置く。編集グリッド線はマス境界(c/GU)に引く→各オブジェクトが四角の中央に入る。
function cellXY(c,r){ return isoToScreen((c+0.5+OFF_U)/GU,(r+0.5+OFF_V)/GV); }   // c,r は連続値でも可
const ISO_DET = ISO.ux*ISO.vy - ISO.vx*ISO.uy;
function screenToIso(sx,sy){ const nx=sx/W-ISO.Bx, ny=sy/H-ISO.By;
  return { u:(nx*ISO.vy - ISO.vx*ny)/ISO_DET, v:(ISO.ux*ny - nx*ISO.uy)/ISO_DET }; }
function uvXY(u,v){ return { x:(ISO.Bx+u*ISO.ux+v*ISO.vx)*W, y:(ISO.By+u*ISO.uy+v*ISO.vy)*H }; }
const AU={x:ISO.ux*W/GU, y:ISO.uy*H/GU};   // 1セル u方向 の画面ベクトル
const AV={x:ISO.vx*W/GV, y:ISO.vy*H/GV};   // 1セル v方向 の画面ベクトル
const K = (c,r)=> c+','+r;
const DIRS4 = [[1,0],[-1,0],[0,1],[0,-1]];
const DRAG_SLOP = 8;   // これ以下の移動は「ドラッグではなくクリック」とみなす(px)

/* ===== 製造機のスキン =====
   スキンは「テクスチャの命名規約 + パレット」の2段。
   1) テクスチャ mach_<theme>_body があればそれを使う（未整備）
   2) 無ければ手続き描画にフォールバックし、PART_SKIN_BY_THEME のパレットで色だけ替える
   → 新テーマは「PNGを置く」か「パレットを1行足す」だけで足りる(コード変更不要)。 */
const PART_PAL = {
  default:{ top:0x39424b, side:0x1b2026, edge:0x11151a, rim:0x6b7681, glow:0x7fe6ff },
  wood:   { top:0x7a5a38, side:0x3a2a18, edge:0x1e150c, rim:0xb8935a, glow:0xffd08a },
  aqua:   { top:0x246d76, side:0x0e3138, edge:0x061c21, rim:0x55b8bb, glow:0x9ff0e6 },
  neon:   { top:0x232a52, side:0x0c1226, edge:0x050813, rim:0x5566bb, glow:0x7fffd4 },
  brass:  { top:0x574029, side:0x241a0e, edge:0x120c05, rim:0xc09550, glow:0xffd27f },
  candy:  { top:0x7a3d5c, side:0x321528, edge:0x1a0a14, rim:0xdd85ac, glow:0xfff0a0 },
};
const PART_SKIN_BY_THEME = {
  japan:'wood', onsen:'wood', cabin:'wood', sushi:'wood', western:'wood', pirate:'wood', jungle:'wood', mushroom:'wood',
  undersea:'aqua', ice:'aqua', beehive:'brass', steampunk:'brass', dwarf:'brass', hell:'brass', egypt:'brass', china:'brass', arabia:'brass',
  scifi:'neon', space:'neon', circuit:'neon', tokyo:'neon', retrofuture:'neon', haunted:'neon',
  circus:'candy', carnival:'candy', christmas:'candy', halloween:'candy', diner:'candy', fantasy:'candy', desert:'candy', dino:'candy',
};
// 製造機の見た目(セル比)。inset=マス境界からの余白 / height=筐体の高さ / slot=スロット穴の大きさ
const MACH_GEO = { inset:0.10, height:0.42, slot:0.52 };
// 製造機のサイズ。sub('s2'..'s5') が在庫キー兼サイズ。1マス=スロット1つ。1マス機は廃止(最小2マス)。
const MACH_SIZES = [2,3,4,5];
const KINDS = ['machine','deco','prop','emoji','prize'];   // 設置できる種類（belt/outlet は廃止）
const MACH_MIN = 2;
const MACH_ART = ['normal','arabia','diner','halloween','scifi'];   // スプライトを用意したテーマ(assets/mach-<theme>-s<N>.png)
const machSize = (sub)=> Math.min(5, Math.max(MACH_MIN, parseInt(String(sub||'').replace(/\D/g,''))||MACH_MIN));

/* ===== 素材の見た目 =====
   素材マスタ・レシピ・製品・図鑑は factory-phaser.html の製造エンジンが正（window.__craft.mat）。
   main.js が持つのは「スロットに何色で何の絵文字を描くか」だけ。
   ジャンル・素材を増やすときに触るのは上流(HTML)だけでよいように、ここは
   ①個別の色（MAT_ART） → ②ジャンルの色（MAT_G_C） → ③既定色 の順にフォールバックする。 */
const MAT_ART = {
  milk:  {e:'🥛', c:0xf2f0e6}, flour: {e:'🌾', c:0xe0c98a}, egg:   {e:'🥚', c:0xf5e6c8},
  butter:{e:'🧈', c:0xf2d27a}, sugar: {e:'🍬', c:0xf6dce8}, choco: {e:'🍫', c:0x7a4a2a},
  rice:  {e:'🍚', c:0xf0efe8}, noodle:{e:'🍥', c:0xe8d9b0}, cheese:{e:'🧀', c:0xe8c04a},
  tomato:{e:'🍅', c:0xd9483f}, meat:  {e:'🥩', c:0xc05a5a}, veg:   {e:'🥬', c:0x6aa84f},
};
const MAT_G_C = { food:0xe8d9b0, mech:0x9fb6c8, life:0xd9c39a };   // ジャンル既定色
/* 素材id → {e,c}。上流が知っている素材なら MAT_ART に無くても描ける（= HTML だけで追加できる）。
   どちらも知らない素材は null（setSlot が弾く）。 */
function matArt(id){
  if(id==null) return null;
  const art=MAT_ART[id];
  const up=(window.__craft&&window.__craft.mat)?window.__craft.mat(id):null;
  if(!art&&!up) return null;
  return { e:(art&&art.e)||(up&&up.e)||'❓',
           c:(art&&art.c)||MAT_G_C[up&&up.g]||0xa8b6bd };
}
/* スロットの素材配列 → 筐体の上に出す表示。何が作れるかは伏せ、稼働状態と進捗を返す。
   判定は上流エンジンに委譲する(window.__craft.preview) */
function recipeFor(slots, id){
  const f=(slots||[]).filter(Boolean); if(!f.length) return null;
  return (window.__craft && window.__craft.preview) ? window.__craft.preview(f, id) : null;
}

const INK = '#3b4643', EYE = '#241713';
const PRESETS = [
  {b:'#c15f3c',s:'#9d4527',l:'#d67e57'}, {b:'#4f7fc4',s:'#37588f',l:'#7ba3df'},
  {b:'#4fa564',s:'#367b47',l:'#7bc78d'}, {b:'#8a5fc0',s:'#623f90',l:'#ac86dc'},
  {b:'#e0b23a',s:'#ad8327',l:'#f2d06a'}, {b:'#d86a9c',s:'#a94773',l:'#f094bc'},
];
const MTOP = [3,2,1,1,0,0,1,2,3,3,2,1,0,0,1,1,2,3];
// スキン=被り物(帽子)のみ。ベースの手続きマスコット(26x28ドット,1ドット=DOTP px)はそのまま。
// 被り物テクスチャ hat_<id> を頭頂に載せる較正: 底辺中央を(HAT_CX, HAT_BASE_Y)ドットへ、幅をHAT_W_DOTに正規化。
const DOTP = 3, HAT_CX = 12.5, HAT_BASE_Y = 10.8, HAT_W_DOT = 19;
function makeMascot(scene, key, pal, pose){
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
function mascotIcons(){
  if(!_mascotIcons) _mascotIcons={
    work: mascotCanvas(PRESETS[0],'work').toDataURL(),
    sit:  mascotCanvas(PRESETS[1],'sit').toDataURL(),
  };
  return _mascotIcons;
}

// テーマ専用の部屋画像(Stitch製・壁/床/窓を焼き込み)。ここにあるテーマは背景ごと差し替える
const ROOM_TEX = { arabia:'room_arabia', undersea:'room_undersea', japan:'room_japan', china:'room_china',
  diner:'room_diner', fantasy:'room_fantasy', scifi:'room_scifi', cabin:'room_cabin', dino:'room_dino',
  haunted:'room_haunted', pirate:'room_pirate', circuit:'room_circuit', dwarf:'room_dwarf', hell:'room_hell', steampunk:'room_steampunk',
  retrofuture:'room_retrofuture', tokyo:'room_tokyo', halloween:'room_halloween', western:'room_western', sushi:'room_sushi', beehive:'room_beehive', circus:'room_circus', carnival:'room_carnival', desert:'room_desert', jungle:'room_jungle', egypt:'room_egypt', christmas:'room_christmas', space:'room_space', ice:'room_ice', mushroom:'room_mushroom', onsen:'room_onsen' };
// Stitch製 装飾プロップ(部屋画像と同じアイソメ視点で生成)。
//   汎用12種 + テーマ別の「名物」6種×5テーマ + テーマ別の「基本家具」7種×テーマ
// 基本家具は全テーマ共通のスロット(chair/table/sofa/shelf/rug/lamp/plant)で、材質と色だけテーマで差し替える。
const PROP_NAMES = ['vase','palm','rug','flantern','fountain','chest','cushion','bonsai','lantern','pedestal','flower','screen',
  'cir_popcorn','cir_ballstand','cir_trunks','cir_ringtoss','cir_cannon','cir_stool',                 // 🎪 サーカス
  'sus_lane','sus_oke','sus_tea','sus_sake','sus_neko','sus_netacase',                                // 🍣 回転寿司
  'wes_barreltable','wes_horseshoe','wes_wheel','wes_campfire','wes_cactus','wes_assay',              // 🤠 西部開拓
  'bee_combtable','bee_honeypots','bee_pollen','bee_candles','bee_throne','bee_frames',               // 🐝 ミツバチの巣
  'stm_boiler','stm_cogs','stm_console','stm_armchair','stm_orrery','stm_coal',                       // ⚙️ スチームパンク
  'sus_chair','sus_table','sus_sofa','sus_shelf','sus_rug','sus_lamp','sus_plant','sus_noren',        // 🍣 家具セット
  'stm_chair','stm_table','stm_sofa','stm_shelf','stm_rug','stm_lamp','stm_plant','stm_helmet',       // ⚙️ 家具セット
  'jpn_chair','jpn_table','jpn_sofa','jpn_shelf','jpn_rug','jpn_lamp','jpn_plant','jpn_byobu',        // ⛩️ 日本
  'din_chair','din_table','din_sofa','din_shelf','din_rug','din_lamp','din_plant','din_jukebox',      // 🍔 ダイナー
  'cab_chair','cab_table','cab_sofa','cab_shelf','cab_rug','cab_lamp','cab_plant','cab_hearth',       // 🌲 森コテージ
  'sci_chair','sci_table','sci_sofa','sci_shelf','sci_rug','sci_lamp','sci_plant','sci_starmap',      // 🚀 SF宇宙
  'fan_chair','fan_table','fan_sofa','fan_shelf','fan_rug','fan_lamp','fan_plant','fan_cauldron',     // 🧙 ファンタジー
  'pir_chair','pir_table','pir_sofa','pir_shelf','pir_rug','pir_lamp','pir_plant','pir_chest',        // 🏴‍☠️ 海賊船
  'hal_chair','hal_table','hal_sofa','hal_shelf','hal_rug','hal_lamp','hal_plant','hal_pumpkin',      // 🎃 ハロウィン
  'sea_chair','sea_table','sea_sofa','sea_shelf','sea_rug','sea_lamp','sea_plant','sea_treasure',     // 🐚 海底
  'arb_chair','arb_table','arb_sofa','arb_shelf','arb_rug','arb_lamp','arb_plant','arb_hookah',       // 🕌 アラビア
  'chn_chair','chn_table','chn_sofa','chn_shelf','chn_rug','chn_lamp','chn_plant','chn_censer',       // 🐉 中華
  'dno_chair','dno_table','dno_sofa','dno_shelf','dno_rug','dno_lamp','dno_plant','dno_fossil',       // 🦖 ダイナソー
  'hnt_chair','hnt_table','hnt_sofa','hnt_shelf','hnt_rug','hnt_lamp','hnt_plant','hnt_clock',        // 👻 幽霊屋敷
  'wes_chair','wes_table','wes_sofa','wes_shelf','wes_rug','wes_lamp','wes_plant','wes_piano',        // 🤠 西部開拓
  'bee_chair','bee_table','bee_sofa','bee_shelf','bee_rug','bee_lamp','bee_plant','bee_honeyfountain',// 🐝 ミツバチの巣
  'cir_chair','cir_table','cir_sofa','cir_shelf','cir_rug','cir_lamp','cir_plant','cir_carousel',     // 🎪 サーカス
  'tky_chair','tky_table','tky_sofa','tky_shelf','tky_rug','tky_lamp','tky_plant','tky_vending',      // 🌃 Tokyo
  'cct_chair','cct_table','cct_sofa','cct_shelf','cct_rug','cct_lamp','cct_plant','cct_podium',       // 🏁 サーキット
  'dwf_chair','dwf_table','dwf_sofa','dwf_shelf','dwf_rug','dwf_lamp','dwf_plant','dwf_forge',        // ⛏️ ドワーフ鉱山
  'hel_chair','hel_table','hel_sofa','hel_shelf','hel_rug','hel_lamp','hel_plant','hel_cauldron',     // 😈 地獄
  'rft_chair','rft_table','rft_sofa','rft_shelf','rft_rug','rft_lamp','rft_plant','rft_organ',        // 🛸 レトロ未来
  'crn_chair','crn_table','crn_sofa','crn_shelf','crn_rug','crn_lamp','crn_plant','crn_maskpedestal', // 🎭 カーニバル
  'dst_chair','dst_table','dst_sofa','dst_shelf','dst_rug','dst_lamp','dst_plant','dst_skull',        // 🏜️ 砂漠
  'jgl_chair','jgl_table','jgl_sofa','jgl_shelf','jgl_rug','jgl_lamp','jgl_plant','jgl_idol',         // 🌿 ジャングル
  'egy_chair','egy_table','egy_sofa','egy_shelf','egy_rug','egy_lamp','egy_plant','egy_sarcophagus',  // 🔺 エジプト
  'xms_chair','xms_table','xms_sofa','xms_shelf','xms_rug','xms_lamp','xms_plant','xms_fireplace',    // 🎄 クリスマス
  'spc_chair','spc_table','spc_sofa','spc_shelf','spc_rug','spc_lamp','spc_plant','spc_console',      // 🛰️ 宇宙
  'ice_chair','ice_table','ice_sofa','ice_shelf','ice_rug','ice_lamp','ice_plant','ice_throne',       // ❄️ 氷の城
  'msh_chair','msh_table','msh_sofa','msh_shelf','msh_rug','msh_lamp','msh_plant','msh_bed',          // 🍄 森のキノコ
  'ons_chair','ons_table','ons_sofa','ons_shelf','ons_rug','ons_lamp','ons_plant','ons_rotenburo'];   // ♨️ 温泉
// プロップが使う床のコマ数(=見た目の大きさ)。1コマだと潰れて読めない描き込みの多い物を 2/4 に上げる。
// 表示高 = 1.35*CELL*√コマ数（4コマなら縦横2倍 = 2x2マス相当）。未指定は1コマ。
// 素材PNGはこの表示サイズに合わせて縮小済み(tools/fit_props.py)。値を変えたら再実行が必要。
const PROP_SPAN = {
  sus_lane:4, sus_netacase:4, cir_popcorn:4, cir_cannon:4, wes_campfire:4, bee_throne:4, stm_boiler:4, stm_console:4,
  sus_tea:2, sus_sake:2, sus_oke:2, sus_neko:2, cir_trunks:2, cir_ringtoss:2, cir_ballstand:2,
  wes_barreltable:2, wes_horseshoe:2, wes_wheel:2, wes_assay:2,
  bee_combtable:2, bee_honeypots:2, bee_pollen:2, bee_candles:2, bee_frames:2,
  stm_armchair:2, stm_cogs:2, stm_orrery:2,
  // 各テーマの名物(一点物)。基本家具と同じ2コマ
  sus_noren:2, stm_helmet:2, jpn_byobu:2, din_jukebox:2, cab_hearth:2,
  sci_starmap:2, fan_cauldron:2, pir_chest:2, hal_pumpkin:2, sea_treasure:2,
  arb_hookah:2, chn_censer:2, dno_fossil:2, hnt_clock:2, wes_piano:2,
  bee_honeyfountain:2, cir_carousel:2, tky_vending:2, cct_podium:2, dwf_forge:2,
  hel_cauldron:2, rft_organ:2, crn_maskpedestal:2, dst_skull:2, jgl_idol:2,
  egy_sarcophagus:2, xms_fireplace:2, spc_console:2, ice_throne:2, msh_bed:2, ons_rotenburo:2,
};
// 基本家具はスロットでコマ数を固定する(テーマが変わっても椅子は椅子の大きさ)。
// `<テーマ3文字>_<スロット>` の命名なので、末尾から引ける。
// テーブルはソファとセットで置くので、ソファと同じ2コマにして大きさを揃える
const FURN_SPAN = { chair:1, table:2, shelf:1, sofa:2, rug:2, lamp:2, plant:2 };
// ラグは床に敷くだけの平物。セルを占有しないので上に家具を置け、キャラも上を歩ける。
// 汎用の 'rug' と各テーマの '<pre>_rug' が対象。
const isFlatProp = (sub)=> /(^|_)rug$/.test(String(sub));
// ラグの描画深度。床(-999)より上・他のオブジェクト(depth=画面y なので正の値)より下に固定し、
// 手前のマスに敷いても家具やキャラの上に被らないようにする。
const RUG_DEPTH = -950;
const propSpan = (name)=> PROP_SPAN[name] || FURN_SPAN[String(name).split('_')[1]] || 1;
window.PROP_SPAN = PROP_SPAN;   // ショップ表示(factory-phaser.html)から参照
// 収納(=在庫に戻す)の対象。在庫を持つ種類だけ。絵文字装飾やガチャ景品は在庫が無く、
// 戻すと復元できないので対象外にする。
const STOWABLE = ['prop','deco'];
// エージェントのスキン(id=テーマキー・31種＋'none')。スキン=被り物(帽子)だけ。ベースのマスコットは常にそのまま、
// 頭上に被り物テクスチャ hat_<id>(形状指定でStitch生成→マゼンタ抜き)を1枚重ねる。定義のあるidだけ帽子が乗る。プロジェクト単位で永続化。
const SKINS = [
  {id:'none', n:'デフォルト'},
  {id:'arabia',n:'魔人'},{id:'undersea',n:'人魚'},{id:'japan',n:'侍'},{id:'china',n:'皇帝'},
  {id:'diner',n:'ウェイトレス'},{id:'fantasy',n:'魔法使い'},{id:'scifi',n:'宇宙人'},{id:'cabin',n:'きこり'},
  {id:'dino',n:'恐竜'},{id:'haunted',n:'ゴースト'},{id:'pirate',n:'海賊'},{id:'circuit',n:'レーサー'},
  {id:'dwarf',n:'ドワーフ'},{id:'hell',n:'デビル'},{id:'steampunk',n:'発明家'},{id:'retrofuture',n:'ネモ船長'},
  {id:'tokyo',n:'サイバー'},{id:'halloween',n:'吸血鬼'},{id:'western',n:'ガンマン'},{id:'sushi',n:'寿司職人'},
  {id:'beehive',n:'みつばち'},{id:'circus',n:'ピエロ'},{id:'carnival',n:'仮面'},{id:'desert',n:'遊牧民'},
  {id:'jungle',n:'探検家'},{id:'egypt',n:'ファラオ'},{id:'christmas',n:'サンタ'},{id:'space',n:'宇宙飛行士'},
  {id:'ice',n:'氷の女王'},{id:'mushroom',n:'妖精'},{id:'onsen',n:'湯上がり'},
];
const DECOR = ['crate','drum','plant','pallet','sign'];
// 製造機はショップ経済側(G.machines)が設置する。ここは無料の初期装飾のみ。
const DEMO = [
  {k:'dec_crate',c:2,r:8},{k:'dec_plant',c:1,r:10},
];

class Main extends Phaser.Scene {
  preload(){
    this.load.image('bg_room','assets/factory-room.png');   // ガラス透過(窓の後ろに空/月/太陽を置く)
    this.load.image('room_arabia','assets/room-arabia.png');   // Stitch製 テーマ部屋(壁/床/窓 焼き込み)
    this.load.image('room_undersea','assets/room-undersea.png');
    this.load.image('room_japan','assets/room-japan.png');
    this.load.image('room_china','assets/room-china.png');
    this.load.image('room_diner','assets/room-diner.png');
    this.load.image('room_fantasy','assets/room-fantasy.png');
    this.load.image('room_scifi','assets/room-scifi.png');
    this.load.image('room_cabin','assets/room-cabin.png');
    this.load.image('room_dino','assets/room-dino.png');
    for(const n of ['haunted','pirate','circuit','dwarf','hell','steampunk','retrofuture','tokyo','halloween','western','sushi','beehive','circus','carnival','desert','jungle','egypt','christmas','space','ice','mushroom','onsen']) this.load.image('room_'+n, `assets/room-${n}.png`);
    for(const n of PROP_NAMES) this.load.image('prop_'+n, `assets/prop_${n}.png`);
    for(const s of SKINS) if(s.id!=='none') this.load.image('hat_'+s.id, `assets/hat-${s.id}.png`);   // 被り物。未生成でもPhaserは欠損扱い→描画側でexistsチェック
    this.load.text('machfit','assets/mach-fit.json');   // 投入口のアンカー。素材アイコンを絵の口に乗せる
    this.load.text('hatfit','assets/hat-fit.json');   // 被り物ごとのツバ中心(cx=幅比)。非対称な飾りでも頭の中心で被る(load.json は中身が壊れるとローダーごと落ちるので text 読み)
    for(const d of DECOR) this.load.image('dec_'+d, `assets/obj_${d}.png`);
    // 製造機スプライト(Stitch製)。命名規約 mach_<theme>_s<N>。無いテーマは normal → 手続き描画 の順にフォールバック
    for(const th of MACH_ART) for(const n of MACH_SIZES) this.load.image(`mach_${th}_s${n}`, `assets/mach-${th}-s${n}.png`);
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
  cellsOf(e){ if(e.kind!=='machine') return [e.cell];
    const n=machSize(e.sub), du=(e.dir==='v')?0:1, dv=(e.dir==='v')?1:0, out=[];
    for(let i=0;i<n;i++) out.push({c:e.cell.c+du*i, r:e.cell.r+dv*i});
    return out; }
  /* 製造機の占有マス群の外周(uv)。描画とヒット判定で共用 */
  _machFootprint(e){ const n=machSize(e.sub), IN=MACH_GEO.inset;
    const c0=e.cell.c, r0=e.cell.r, du=(e.dir==='v')?0:1, dv=(e.dir==='v')?1:0;
    const u0=(c0+IN)/GU, u1=(c0+du*(n-1)+1-IN)/GU, v0=(r0+IN)/GV, v1=(r0+dv*(n-1)+1-IN)/GV;
    return [uvXY(u0,v0), uvXY(u1,v0), uvXY(u1,v1), uvXY(u0,v1)];   // A(最奥) B C(最手前) D
  }
  /* 占有マスを1マスずつの外周(uv)に切る。inset は両端だけ効かせ、マス同士の継ぎ目は詰める
     (union が _machFootprint と一致する = 隙間も重なりも出ない) */
  _machCellQuads(e){ const n=machSize(e.sub), IN=MACH_GEO.inset;
    const c0=e.cell.c, r0=e.cell.r, du=(e.dir==='v')?0:1, dv=(e.dir==='v')?1:0, out=[];
    for(let i=0;i<n;i++){
      const h0=(i===0)?IN:0, h1=(i===n-1)?IN:0;
      const u0=(c0+du*i+(du?h0:IN))/GU, u1=(c0+du*i+1-(du?h1:IN))/GU;
      const v0=(r0+dv*i+(dv?h0:IN))/GV, v1=(r0+dv*i+1-(dv?h1:IN))/GV;
      out.push([uvXY(u0,v0), uvXY(u1,v0), uvXY(u1,v1), uvXY(u0,v1)]);   // A(最奥) B C(最手前) D
    }
    return out; }
  /* マス i の外周のうち隣と接していない辺だけを描く(継ぎ目に線を出さない)。辺は A-B, B-C, C-D, D-A の順 */
  _strokeOuter(g,q,i,n,dir){
    const ext=(dir==='v') ? [i===0, true, i===n-1, true] : [true, i===n-1, true, i===0];
    for(let k=0;k<4;k++){ if(!ext[k]) continue; const p=q[k], r=q[(k+1)%4];
      g.beginPath(); g.moveTo(p.x,p.y); g.lineTo(r.x,r.y); g.strokePath(); } }
  _makeObjs(e){ const {c,r}=e.cell; const p=cellXY(c,r); const u=(c+0.5)/GU, v=(r+0.5)/GV;
    const tint=this.tintByLight(u,v); const objs=[]; let main=null; e._lit=null;
    if(e.kind==='machine'){
      this._makeMachine(e, objs); main=e.main;
      for(const q of this.cellsOf(e)) this.machineCells.push({c:q.c,r:q.r});
    } else if(e.kind==='deco'){
      const img=this.add.image(p.x,p.y,'dec_'+e.sub).setOrigin(0.5,1).setDepth(p.y); img.setScale(1.0*CELL/img.height).setTint(tint);
      const sh=this.add.image(p.x+CELL*0.2,p.y+CELL*0.1,'shadow').setDepth(p.y-0.5).setRotation(0.5).setDisplaySize(img.displayWidth*1.05,img.displayWidth*0.5).setAlpha(0.5);
      objs.push(sh,img); main=img; e._lit=img; this.lit.push({sp:img,u,v});
    } else if(e.kind==='prop'){
      // ラグは床に寝かせる平物: 影なし・マス中心に置く(足元基準だと奥にズレて浮いて見える)・常に最背面
      const flat=isFlatProp(e.sub);
      const img=this.add.image(p.x,p.y,'prop_'+e.sub).setOrigin(0.5,flat?0.5:1).setDepth(flat?RUG_DEPTH:p.y);
      img.setScale(1.35*Math.sqrt(propSpan(e.sub))*CELL/img.height).setTint(tint);
      if(!flat){
        const sh=this.add.image(p.x+CELL*0.2,p.y+CELL*0.09,'shadow').setDepth(p.y-0.5).setRotation(0.5).setDisplaySize(img.displayWidth*1.0,img.displayWidth*0.46).setAlpha(0.5);
        objs.push(sh);
      }
      objs.push(img); main=img; e._lit=img; this.lit.push({sp:img,u,v});
    } else if(e.kind==='emoji'){
      const sh=this.add.image(p.x+CELL*0.16,p.y+CELL*0.05,'shadow').setDepth(p.y-0.6).setRotation(0.5).setDisplaySize(CELL*0.72,CELL*0.32).setAlpha(0.42);
      const t=this.add.text(p.x,p.y-CELL*0.12,e.sub,{fontSize:Math.round(CELL*1.05)+'px'}).setOrigin(0.5,1).setDepth(p.y);
      objs.push(sh,t); main=t;
    } else if(e.kind==='prize'){
      const col=Phaser.Display.Color.HexStringToColor(e.sub.color).color;
      const sh=this.add.image(p.x+CELL*0.16,p.y+CELL*0.06,'shadow').setDepth(p.y-0.6).setRotation(0.5).setDisplaySize(CELL*0.8,CELL*0.36).setAlpha(0.5);
      const gl=this.add.ellipse(p.x,p.y-2,CELL*0.95,CELL*0.5,col,0.5).setDepth(p.y-1).setBlendMode(Phaser.BlendModes.ADD);
      const base=this.add.rectangle(p.x,p.y-2,CELL*0.5,CELL*0.2,0x2b3138).setOrigin(0.5,1).setDepth(p.y); base.setStrokeStyle(1,0x14171c);
      const t=this.add.text(p.x,p.y-CELL*0.26,e.sub.e,{fontSize:Math.round(CELL*0.95)+'px'}).setOrigin(0.5,1).setDepth(p.y+0.1);
      objs.push(sh,gl,base,t); main=t;
    }
    if(e.kind!=='machine'){ e.objs=objs; e.main=main; }
    return e;
  }
  /* ---- 製造機の描画。スプライト(mach_<theme>_s<N>)があればそれ、無ければ手続きの筐体。
       どちらの場合も「1マス=スロット1つ」の位置は占有マスから計算するので、素材アイコンは必ずマスに乗る。 ---- */
  machTex(e){ const n=machSize(e.sub);
    for(const th of [this.partsTheme, 'normal']){ const k=`mach_${th}_s${n}`;
      if(th && this.textures.exists(k)) return {key:k, theme:th, n}; }
    return null; }
  /* 絵のスロット中心(幅/高さ比)。v向きは左右反転して描くので x も反転する */
  machFit(){ if(this._machFit) return this._machFit;
    try{ this._machFit=JSON.parse(this.cache.text.get('machfit')||'{}'); }catch(_){ this._machFit={}; }
    return this._machFit; }
  hatFit(){ if(this._hatFit) return this._hatFit;
    try{ this._hatFit=JSON.parse(this.cache.text.get('hatfit')||'{}'); }catch(_){ this._hatFit={}; }
    return this._hatFit; }
  /* 左右反転した製造機テクスチャ(v向き用)。帯の切り出し(setCrop)は「反転したときの切り出し位置」が
     WebGL と Canvas で食い違うので、flipX せず反転済みテクスチャを焼いて素直に切る。 */
  _machFlipTex(key){ const fk=key+'__fx';
    if(!this.textures.exists(fk)){
      const src=this.textures.get(key).getSourceImage();
      const cv=document.createElement('canvas'); cv.width=src.width; cv.height=src.height;
      const cg=cv.getContext('2d'); cg.translate(cv.width,0); cg.scale(-1,1); cg.drawImage(src,0,0);
      this.textures.addCanvas(fk,cv); }
    return fk; }
  /* 製造機は複数マスを一直線に占有するので、深度を1つしか持たせるとマスごとの前後関係が壊れる
     (手前のマスに立ったキャラが機械の裏へ回る)。絵を「1マスぶんの縦帯」に切り、帯 i をマス i の深度で描く。 */
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
    e._lit=[];              // 採光tintの対象。帯の数だけある
    if(tex){
      // 1マスの送りがゲームと一致するよう焼いてある(tools/cut_machines.py)ので拡縮しない。
      // 拡縮すると送りが崩れて素材アイコンが投入口からズレる。
      const flip=(e.dir==='v');   // 素材はu方向。v方向は左右反転した絵で角度が合う
      const key=flip? this._machFlipTex(tex.key) : tex.key;
      const src=this.textures.get(key).getSourceImage(), iw=src.width, ih=src.height;
      const fitA=((this.machFit()[tex.theme])||{})[String(tex.n)];
      const ax=fitA ? (flip?1-fitA.ax:fitA.ax) : null;
      // 投入口0番が「マス0の中心」の真上に来るよう横位置を合わせる。
      // bbox中央で置くと絵ごとに数px〜十数px 横へズレ、マスの一部に床が見えてしまう。
      let imx=(bx0+bx1)/2;
      if(fitA) imx += cellXY(e.cell.c,e.cell.r).x - ((imx-iw/2)+ax*iw);
      const L=imx-iw/2;
      if(fitA){ const sx=L+ax*iw, sy=(by1-ih)+fitA.ay*ih;
        const du=cellXY(1,0).x-cellXY(0,0).x, dv=cellXY(1,0).y-cellXY(0,0).y;
        spotPts=cells.map((q,i)=>({x:sx+(flip?-1:1)*du*i, y:sy+dv*i}));
        HG = Math.max(2, by1-sy);      // 天面の高さ = 接地点から投入口までの高さ
      } else HG = Math.max(2, ih-(by1-by0));
      // 帯の切れ目は「隣のマス中心との中点」。両端は絵の端まで伸ばす(端の飾りを落とさない)。
      // 境界は整数pxに丸める(隣り合う帯が同じ値になる=継ぎ目に隙間も重なりも出ない)。
      const cx=cells.map(q=>cellXY(q.c,q.r).x), asc=(cx[n-1]>=cx[0]), cut=[];
      for(let i=1;i<n;i++) cut.push(Phaser.Math.Clamp(Math.round((cx[i-1]+cx[i])/2-L),0,iw));
      const sh=this.add.image((bx0+bx1)/2+3, by1-2, 'shadow').setDepth(dBack-0.6)
        .setDisplaySize(iw*0.9,(by1-by0)*0.7).setAlpha(0.42); objs.push(sh);   // 影は機械の一番奥より後ろ
      cells.forEach((q,i)=>{
        // 絵の本体の奥行はゲームの1マスより浅いことがあり、占有マスの手前側に床が残る。
        // そこに後ろのキャラが覗くので、マスごとの暗い土台で塞いでから帯を重ねる。
        const bg=this.add.graphics().setDepth(dep[i]-0.3); objs.push(bg);
        bg.fillStyle(sk.edge,1); bg.fillPoints(quads[i],true);
        bg.lineStyle(2,sk.side,1); this._strokeOuter(bg,quads[i],i,n,e.dir);
        const x0 = asc ? (i===0?0:cut[i-1]) : (i===n-1?0:cut[i]);
        const x1 = asc ? (i===n-1?iw:cut[i]) : (i===0?iw:cut[i-1]);
        const im=this.add.image(imx, by1, key).setOrigin(0.5,1).setDepth(dep[i]).setTint(tint);
        im.setCrop(x0, 0, Math.max(0,x1-x0), ih);   // 位置は変えず、自分の帯だけを見せる
        objs.push(im); e._lit.push(im); this.lit.push({sp:im,u,v});
      });
    } else {
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
    e.slots = Array.isArray(e.slots) ? e.slots.slice(0, machSize(e.sub)) : [];
    while(e.slots.length < machSize(e.sub)) e.slots.push(null);
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
      if(m){ const t=this.add.text(ctr.x,ctr.y-CELL*0.08,m.e,{fontSize:Math.round(CELL*0.5)+'px'}).setOrigin(0.5,0.5).setDepth(dep[idx]+0.2);
             objs.push(t); e._slotObjs.push(t); }
    });

    // 完成品の表示(筐体の上)。素材未設定なら出さない
    const prod=recipeFor(e.slots, e.id); e.product=prod;
    const mid={x:(bx0+bx1)/2, y:by0-HG};
    if(prod){
      const badge=this.add.text(mid.x, mid.y-CELL*0.30, prod.e, {fontSize:Math.round(CELL*0.8)+'px'}).setOrigin(0.5,1).setDepth(C.y+2);
      const nm=this.add.text(mid.x, mid.y-CELL*0.28, prod.n, {fontFamily:'monospace',fontSize:'10px',color:prod.unknown?'#d9b48a':'#eafff6'}).setOrigin(0.5,0).setDepth(C.y+2);
      nm.setShadow(0,1,'#000',3,true,true);
      objs.push(badge,nm); e._badge=badge;
    } else {
      const hint=this.add.text(mid.x, mid.y-CELL*0.1, '素材未設定', {fontFamily:'monospace',fontSize:'10px',color:'#93a39d'}).setOrigin(0.5,1).setDepth(C.y+2);
      hint.setShadow(0,1,'#000',3,true,true); objs.push(hint);
    }
    if(e.lvl>1){ const lv=this.add.text(bx0+6, by1-HG, `Lv${e.lvl}`, {fontFamily:'monospace',fontSize:'9px',color:'#9fb0c0'}).setOrigin(0,1).setDepth(C.y+2);
      lv.setShadow(0,1,'#000',3,true,true); objs.push(lv); }
    e.objs=objs; e.main=g;
  }
  partsSkin(){ const t=this.partsTheme||null;
    return Object.assign({theme:t}, PART_PAL[PART_SKIN_BY_THEME[t]||'default']); }
  /* パーツのテーマを切り替える(背景テーマに追従 / 単体でも呼べる) */
  setPartsTheme(theme){ if(this.partsTheme===theme) return; this.partsTheme=theme||null;
    for(const e of this.placed.slice()) if(e.kind==='machine') this._remake(e); }
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
    if(kind==='prop' && isFlatProp(opt.sub)) return this.isRugFree(c,r);   // ラグは家具の上にも敷ける
    if(kind!=='machine') return this.isFree(c,r);
    const probe={kind:'machine', sub:opt.sub||'s1', dir:opt.dir||'u', cell:{c,r}};
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
        if(this.canPlace('machine',c,r,{sub:opt&&opt.sub,dir})){ if(opt) opt.dir=dir; return {c,r,dir}; }
    return null; }
  addPlaced(kind, sub, extra){ extra=extra||{};
    // 知らない kind(廃止した belt/outlet など)は絵の無い幽霊エントリになるので弾く
    if(KINDS.indexOf(kind)<0) return null;
    if(kind==='deco' && !this.textures.exists('dec_'+sub)) return null;
    if(kind==='machine') sub = 's'+machSize(sub);
    let dir = (kind==='machine') ? (extra.dir==='v'?'v':'u') : undefined;
    // ラグは平物。家具の占有(occ)を無視して敷けるが、ラグ同士(rugOcc)は重ねない
    const flat = kind==='prop' && isFlatProp(sub);
    let cell=extra.cell||null;
    if(cell && !this.canPlace(kind,cell.c,cell.r,{sub,dir})) cell=null;
    if(!cell && extra.strict) return null;              // レイアウト復元: 勝手に別マスへ動かさない
    if(!cell) cell = flat ? this.freeRugCell() : (function(o){ const q=this.autoCell(kind,o); if(q&&q.dir) dir=q.dir; return q; }).call(this,{sub,dir});
    if(!cell) return null;
    const e={ id: extra.id||('o'+(this._oid=(this._oid||0)+1)), kind, sub, lvl:extra.lvl||1,
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
  isFlat(e){ return e.kind==='prop' && isFlatProp(e.sub); }
  removeItem(id){ const i=this.placed.findIndex(x=>x.id===id); if(i<0) return false;
    if(this.sel) this.sel.delete(id);
    this._detach(this.placed[i]); this.placed.splice(i,1); this.lastRemoved=1; this._syncOcc();
    if(this.moveId===id) this.cancelMove();   // 掴んでいた物が消えたら移動モードも抜ける
    if(this._mdrag && this._mdrag.id===id) this._mdrag=null;   // ドラッグ中の物が消えた場合も同様
    if(this._tap && this._tap.id===id) this._tap=null;         // 消えた物の設定パネルは開かない
    return true; }
  moveItem(id,c,r){ const e=this.placed.find(x=>x.id===id); if(!e)return false;
    if(!this.canPlace(e.kind,c,r,{sub:e.sub,dir:e.dir,ignoreId:id})) return false;
    this._detach(e); e.cell={c,r}; this._makeObjs(e); this._syncOcc();
    if(this.editMode) this._enableDrag(e); return true; }
  /* 製造機を90°回転(u軸⇔v軸)。回した先が空いていなければ何もしない */
  rotateMachine(id){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e) return false;
    const nd=(e.dir==='v')?'u':'v';
    if(!this.canPlace('machine',e.cell.c,e.cell.r,{sub:e.sub,dir:nd,ignoreId:id})) return false;
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
    if(i<0||i>=machSize(e.sub)) return false;
    if(mat!=null && !matArt(mat)) return false;   // 上流(HTML)が知らない素材は受け付けない
    e.slots[i]=mat||null; this._remake(e);
    const p=cellXY(e.cell.c,e.cell.r); this._spawnPop(p.x,p.y); return true; }
  getMachine(id){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e) return null;
    return { id:e.id, size:machSize(e.sub), dir:e.dir, lvl:e.lvl, slots:e.slots.slice(),
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
  getLayout(){ return this.placed.map(e=>{ const o={id:e.id,kind:e.kind,sub:e.sub,lvl:e.lvl,c:e.cell.c,r:e.cell.r};
    if(e.kind==='machine'){ o.dir=e.dir; o.slots=e.slots.slice(); } return o; }); }
  /* 旧レイアウトの移行: コンベア/出荷口は廃止したので捨てる。旧4種の製造機(red等)は1マス機に読み替える。 */
  buildLayout(list){
    for(const e of this.placed.slice()){ this._detach(e); }
    this.placed=[]; this._syncOcc();
    let dropped=0;
    for(const it of (list||[])){
      if(it.kind==='belt'||it.kind==='outlet'){ dropped++; continue; }
      const sub=(it.kind==='machine') ? ('s'+machSize(it.sub)) : it.sub;
      this.addPlaced(it.kind, sub, {cell:{c:it.c,r:it.r}, lvl:it.lvl, id:it.id, dir:it.dir, slots:it.slots, silent:true});
    }
    this._oid=Math.max(0,...this.placed.map(e=>parseInt(String(e.id).replace(/\D/g,''))||0));
    return dropped; }
  setMachineLevel(id,lvl){ const e=this.placed.find(x=>x.id===id&&x.kind==='machine'); if(!e)return; e.lvl=lvl; this._remake(e); }
  // 旧API互換（ショップ購入から呼ばれる）
  placeMachine(type){ return this.addPlaced('machine', type); }
  placeDeco(type){ return this.addPlaced('deco', type); }
  placeEmojiDeco(emoji){ return this.addPlaced('emoji', emoji); }
  placeProp(name){ if(!this.textures.exists('prop_'+name)) return null; return this.addPlaced('prop', name); }
  placePrize(emoji,color){ return this.addPlaced('prize', {e:emoji,color}); }
  syncMachines(list){ for(const m of (list||[])) this.addPlaced('machine', 's'+machSize(m.type), {lvl:m.lvl||1}); }
  /* 設置時のポップ演出 */
  _spawnPop(x,y){ const g=this.add.circle(x,y-CELL*0.5,CELL*0.6,0xffe9a8,0.5).setDepth(9000).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({targets:g,scale:1.8,alpha:0,duration:420,onComplete:()=>g.destroy()}); }
  /* ===== 編集モード（グリッド表示・ドラッグ移動・ゴミ箱で撤去） ===== */
  setupEdit(){
    // 床ダイヤ[0,1]²を綺麗な12×12に等分する線だけを表示(中心点は出さない)。オブジェクトは各マスの中央に入る。
    this.editGrid=this.add.graphics().setDepth(-998).setVisible(false); this.editGrid.lineStyle(1,0x7fe6ff,0.42);
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
    // 床クリック: 製造機の上なら設定パネル、空きマスならパレットで選択中のアイテムを設置
    this.input.on('pointerdown',(po,over)=>{
      if(this.selectMode) return;   // 収納の選択中は設置も移動もしない
      this._tap=null;
      const uv=screenToIso(po.x,po.y);
      const c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
      // 移動モード中は設定パネルも新規設置も抑止。床クリック=移動先の確定
      if(this.moveId){ this._placedPtr=true; this._moveDrop(c,r); return; }
      // 床マスの外(筐体の高さぶん)を掴んだときも拾えるよう、当たり判定に出ている製造機も見る
      const hit=(over&&over.length&&over[0]&&over[0]._e)||null;
      const m=this.machineAtCell(c,r) || ((hit&&hit.kind==='machine')?hit:null);
      // 製造機は編集中/通常どちらのクリックでも素材パネルを開く(素材設定がコア機能なので)
      if(m){ this._placedPtr=true;
        // 編集中はドラッグと取り違えないよう、指を離した時点(ほぼ動いていなければ)に開く
        if(this.editMode){ this._tap={id:m.id, x:po.x, y:po.y}; return; }
        if(window.__openMachine) window.__openMachine(m.id); return; }
      if(!this.editMode) return; if(over&&over.length) return;
      const sel=window.__editSel; if(!sel) return;
      const opt=(sel.kind==='machine')?{sub:sel.sub,dir:this.placeDir||'u'}:null;
      if(!this.canPlace(sel.kind,c,r,opt)){ if(window.__toast) window.__toast(
        sel.kind==='machine' ? `そこには置けません（${machSize(sel.sub)}マスぶんの空きが必要）` : 'そこには置けません'); return; }
      this._placedPtr=true; if(window.__editPlaceAt) window.__editPlaceAt(c,r); });
    // 設置前の向き切替(Rキー)。製造機を選んでいるときだけ効く
    this.input.keyboard.on('keydown-R',()=>{ if(!this.editMode) return;
      if(this.moveId){   // 移動モード中は掴んでいる製造機そのものを回す
        if(!this.rotateMachine(this.moveId)){ if(window.__toast) window.__toast('回した先に空きがありません'); return; }
        if(window.__layoutChanged) window.__layoutChanged();
        this._drawHover(this.input.activePointer); return; }
      this.placeDir=(this.placeDir==='v')?'u':'v';
      if(window.__toast) window.__toast('向き: '+(this.placeDir==='v'?'↙ 手前方向':'↘ 奥方向')); });
    // 移動のキャンセル(Escキー)
    this.input.keyboard.on('keydown-ESC',()=>{ if(!this.moveId) return;
      this.cancelMove(); if(window.__toast) window.__toast('移動をやめました'); });
    // クリック(ほぼ動いていない)なら設定パネル。ドラッグしたときは開かない
    this.input.on('pointerup',(po)=>{ const t=this._tap; this._tap=null;
      if(!t||this.moveId) return;
      if(Math.hypot(po.x-t.x, po.y-t.y)>DRAG_SLOP) return;
      if(window.__openMachine) window.__openMachine(t.id); });
    // 製造機のドラッグ開始。絵が複数(筐体graphics＋素材の文字など)あるので掴んだ時点の座標を控える
    this.input.on('dragstart',(po,obj)=>{ if(!this.editMode||!obj||!obj._e) return; const e=obj._e;
      if(e.kind!=='machine'||this.moveId) return;   // 移動モード中はドラッグしない
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
      obj.x=dx; obj.y=dy; });
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
      const uv=screenToIso(obj.x,obj.y); let c=Phaser.Math.Clamp(Math.floor(uv.u*GU-OFF_U),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV-OFF_V),0,GV-1);
      if(!this.moveItem(e.id,c,r)) this._snapBack(e);
      if(window.__layoutChanged)window.__layoutChanged(); });
  }
  /* 製造機の掴み手。main は Graphics で当たり判定を持たないので、占有マスの外周＋筐体の高さぶんの
     多角形(見た目のシルエット)を渡す。A(最奥) B C(最手前) D の上辺と手前2面を結んだ6角形。 */
  _machHit(e){ const [A,B,C,D]=this._machFootprint(e), h=e._hgt||0;
    return new Phaser.Geom.Polygon([A.x,A.y-h, B.x,B.y-h, B.x,B.y, C.x,C.y, D.x,D.y, D.x,D.y-h]); }
  // 通常は「ドラッグで移動」、収納の選択モード中は「クリックで選択」に付け替える
  _enableDrag(e){ const m=e.main; if(!m)return; m._e=e;
    if(e.kind==='machine') m.setInteractive({ hitArea:this._machHit(e), hitAreaCallback:Phaser.Geom.Polygon.Contains, useHandCursor:true });
    else m.setInteractive({useHandCursor:true});
    m.removeAllListeners('pointerdown');
    const selectable = this.selectMode && STOWABLE.includes(e.kind);
    this.input.setDraggable(m, !this.selectMode);
    if(selectable) m.on('pointerdown', ()=>this.toggleSelect(e.id)); }
  _disableDrag(e){ const m=e.main; if(!m)return; this.input.setDraggable(m,false); m.removeAllListeners('pointerdown'); m.disableInteractive(); m._e=null; }
  _diamond(g,c,r){ const p0=uvXY(c/GU,r/GV),p1=uvXY((c+1)/GU,r/GV),p2=uvXY((c+1)/GU,(r+1)/GV),p3=uvXY(c/GU,(r+1)/GV);
    g.beginPath(); g.moveTo(p0.x,p0.y); g.lineTo(p1.x,p1.y); g.lineTo(p2.x,p2.y); g.lineTo(p3.x,p3.y); g.closePath(); }
  _drawHover(po){ const g=this.hoverGfx; if(!g)return;
    if(!this.editMode){ g.clear(); g.setVisible(false); return; }
    g.clear(); g.setVisible(true);
    g.fillStyle(0x7fe6ff,0.10);   // 設置済みマスをうっすら塗る(=各オブジェクトが入っている四角)
    for(const e of this.placed) for(const q of this.cellsOf(e)){ this._diamond(g,q.c,q.r); g.fillPath(); }
    // 移動モード中/ドラッグ中は掴んでいる製造機のサイズ・向きぶんをプレビュー(自分の占有は無視して判定)
    const d=this.moveId?null:this._mdrag, mvId=this.moveId||(d&&d.id);
    const mv=mvId && this.placed.find(x=>x.id===mvId);
    if(mv){ let c,r;
      if(d){ c=d.c; r=d.r; }
      else { if(!po) return; const uv=screenToIso(po.x,po.y);
        c=Phaser.Math.Clamp(Math.floor(uv.u*GU),0,GU-1); r=Phaser.Math.Clamp(Math.floor(uv.v*GV),0,GV-1); }
      const ok=this.canPlace('machine',c,r,{sub:mv.sub,dir:mv.dir,ignoreId:mv.id});
      this._paintCells(this.cellsOf({kind:'machine',sub:mv.sub,dir:mv.dir,cell:{c,r}}), ok?0x33ffcc:0xe0674e);
      return; }
    const sel=window.__editSel;
    if(sel && po){ const uv=screenToIso(po.x,po.y);
      const c=Phaser.Math.Clamp(Math.floor(uv.u*GU),0,GU-1), r=Phaser.Math.Clamp(Math.floor(uv.v*GV),0,GV-1);
      const opt=(sel.kind==='machine')?{sub:sel.sub,dir:this.placeDir||'u'}:null;
      const ok=this.canPlace(sel.kind,c,r,opt);
      // 製造機は占有する全マスをプレビュー(Rキーで向き切替)
      const cells=(sel.kind==='machine') ? this.cellsOf({kind:'machine',sub:sel.sub,dir:this.placeDir||'u',cell:{c,r}}) : [{c,r}];
      this._paintCells(cells, ok?0x33ffcc:0xe0674e); }
  }
  /* プレビューのマス塗り(置ける=緑/置けない=赤)。設置プレビューと移動プレビューで共用 */
  _paintCells(cells,col){ const g=this.hoverGfx;
    for(const q of cells){ if(q.c<0||q.r<0||q.c>=GU||q.r>=GV) continue;
      g.fillStyle(col,0.30); this._diamond(g,q.c,q.r); g.fillPath();
      g.lineStyle(2,col,0.95); this._diamond(g,q.c,q.r); g.strokePath(); } }
  toggleEdit(on){ this.editMode=(on==null)?!this.editMode:!!on; this.editGrid.setVisible(this.editMode);
    if(!this.editMode){ this.setSelectMode(false);
      this.cancelMove();   // 編集を抜けたら移動モードも解除(元の位置のまま)
      this._tap=null;
      if(this._mdrag){ const dg=this.placed.find(x=>x.id===this._mdrag.id); this._mdrag=null; if(dg) this._snapBack(dg); } }
    this.trash.setVisible(this.editMode && !this.selectMode);
    if(this.hoverGfx){ this.hoverGfx.clear(); this.hoverGfx.setVisible(false); }
    for(const e of this.placed){ this.editMode?this._enableDrag(e):this._disableDrag(e); } return this.editMode; }
  /* ===== 収納(在庫に戻す) ===== */
  stowables(){ return this.placed.filter(e=>STOWABLE.includes(e.kind)); }
  stowAll(){ const list=this.stowables(); for(const e of list) this.removeItem(e.id); this._drawSel(); return list.length; }
  setSelectMode(on){ const v=!!on; if(v===!!this.selectMode) return v;
    this.selectMode=v; this.sel=new Set();
    this.trash.setVisible(this.editMode && !v);
    for(const e of this.placed) if(this.editMode) this._enableDrag(e);
    this._drawSel(); this._notifySel(); return v; }
  toggleSelect(id){ if(!this.sel) this.sel=new Set();
    this.sel.has(id) ? this.sel.delete(id) : this.sel.add(id);
    this._drawSel(); this._notifySel(); }
  stowSelected(){ const ids=[...(this.sel||[])]; for(const id of ids) this.removeItem(id);
    this.sel=new Set(); this._drawSel(); this._notifySel(); return ids.length; }
  _notifySel(){ if(window.__selChanged) window.__selChanged(this.sel?this.sel.size:0); }
  _drawSel(){ if(!this.selGfx) this.selGfx=this.add.graphics().setDepth(8400);
    const g=this.selGfx; g.clear(); if(!this.selectMode) return;
    for(const e of this.placed){ if(!this.sel || !this.sel.has(e.id)) continue;
      const p=cellXY(e.cell.c,e.cell.r);
      g.fillStyle(0x7fe6ff,0.20); g.fillEllipse(p.x,p.y-2,CELL*1.12,CELL*0.56);
      g.lineStyle(2,0x7fe6ff,0.95); g.strokeEllipse(p.x,p.y-2,CELL*1.12,CELL*0.56); } }
  /* 窓オブジェクトを座標で定義(左壁 u=0)。床エッジ uvXY(0,v) を基準に壁の高さ方向へ立ち上げる。
     光源(採光の床帯・月/星のマスク)はすべてこの窓定義から導出する。 */
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
  }
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
  }
  /* 窓からの光が (u,v) に当たる量(0..1)。u=室内奥行き, v=左壁沿い */
  lightAt(u,v){
    let l=0; if(this.shaftOn>0 && u>=-0.03 && u<=this.uLen)
      for(const s of this.windows){ const vv=s.vc + this.sh*(u/this.uLen);
        if(Math.abs(v-vv)<s.hw) l=Math.max(l, this.shaftOn*(1-(u/this.uLen)*0.5)); }
    return Phaser.Math.Clamp(l,0,1);
  }
  tintByLight(u,v){ const l=this.lightAt(u,v);
    // ベース色: 採光(l)で窓色へ寄せる。lが無くても環境色
    let r,g,b;
    if(l<=0.01){ const a=this._ambC; r=a.r; g=a.g; b=a.b; }
    else { const c=Phaser.Display.Color.Interpolate.ColorWithColor(this._ambC,this._shaftC,100,Math.round(l*100)); r=c.r; g=c.g; b=c.b; }
    // 光源=窓(u=0=左上)。奥(uが大)ほど暗くして光源方向の陰影勾配を作る
    const shade=1 - Phaser.Math.Clamp(u,0,1)*0.16;
    return Phaser.Display.Color.GetColor(Math.round(r*shade),Math.round(g*shade),Math.round(b*shade)); }
  drawShafts(){ const g=this.shaftGfx; g.clear(); if(this.shaftOn<=0) return;
    const col=Phaser.Display.Color.GetColor(this._shaftC.r,this._shaftC.g,this._shaftC.b);
    for(const s of this.windows){
      const p1=uvXY(0.0,s.vc-s.hw), p2=uvXY(0.0,s.vc+s.hw), p3=uvXY(this.uLen,s.vc+s.hw+this.sh), p4=uvXY(this.uLen,s.vc-s.hw+this.sh);
      g.fillStyle(col, this.shaftOn*0.4); g.fillPoints([p1,p2,p3,p4],true);
      const q3=uvXY(this.uLen*0.5,s.vc+s.hw+this.sh*0.5), q4=uvXY(this.uLen*0.5,s.vc-s.hw+this.sh*0.5);
      g.fillStyle(col, this.shaftOn*0.3); g.fillPoints([p1,p2,q3,q4],true);   // 窓際を濃く
    }
  }
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
      aurora:{amb:0x4a6a72,obj:0x4f6f74,shaft:0x9fe0c8,son:0.12,sky:0x123b3a,day:0,nf:1},
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
  }
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
  }
  setSkyTheme(theme){
    if(ROOM_TEX[theme]){ this.skyTheme=null; this.setRoom(theme); this.updateLighting(); return; }
    this.setRoom(null); this.skyTheme=(theme&&theme!=='auto')?theme:null; this.updateLighting(); }
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
    g.fillStyle(col,1); g.fillPoints([uvXY(0,0),uvXY(1,0),uvXY(1,1),uvXY(0,1)],true); }
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
    let d=null; try{ const r=await fetch('/api/sessions',{cache:'no-store'}); d=await r.json(); }catch(_){}
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
    if(this.hud){ const ic=mascotIcons();
      this.hud.innerHTML=
        `<span class="st" title="稼働中"><img src="${ic.work}" alt=""><i class="fx">✨</i><b>${busyN}</b></span>`+
        `<span class="st" title="休憩中"><img src="${ic.sit}" alt=""><i class="fx">☕</i><b class="idle">${idleN}</b></span>`; }
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

new Phaser.Game({
  type: Phaser.AUTO, parent:'game', width:W, height:H, backgroundColor:'#0c1014', pixelArt:true,
  scale:{ mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH }, scene:[Main],
});

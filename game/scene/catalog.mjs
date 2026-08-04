/* 見た目のカタログ — 製造機/素材/プロップ/部屋/スキンの対応表。
   「何をどのテクスチャで描くか」だけを持ち、ゲームのルールは持たない。 */

/* ===== 製造機のスキン =====
   スキンは「テクスチャの命名規約 + パレット」の2段。
   1) テクスチャ mach_<theme>_body があればそれを使う（未整備）
   2) 無ければ手続き描画にフォールバックし、PART_SKIN_BY_THEME のパレットで色だけ替える
   → 新テーマは「PNGを置く」か「パレットを1行足す」だけで足りる(コード変更不要)。 */
export const PART_PAL = {
  default:{ top:0x39424b, side:0x1b2026, edge:0x11151a, rim:0x6b7681, glow:0x7fe6ff },
  wood:   { top:0x7a5a38, side:0x3a2a18, edge:0x1e150c, rim:0xb8935a, glow:0xffd08a },
  aqua:   { top:0x246d76, side:0x0e3138, edge:0x061c21, rim:0x55b8bb, glow:0x9ff0e6 },
  neon:   { top:0x232a52, side:0x0c1226, edge:0x050813, rim:0x5566bb, glow:0x7fffd4 },
  brass:  { top:0x574029, side:0x241a0e, edge:0x120c05, rim:0xc09550, glow:0xffd27f },
  candy:  { top:0x7a3d5c, side:0x321528, edge:0x1a0a14, rim:0xdd85ac, glow:0xfff0a0 },
};
export const PART_SKIN_BY_THEME = {
  japan:'wood', onsen:'wood', cabin:'wood', sushi:'wood', western:'wood', pirate:'wood', jungle:'wood', mushroom:'wood',
  undersea:'aqua', ice:'aqua', beehive:'brass', steampunk:'brass', dwarf:'brass', hell:'brass', egypt:'brass', china:'brass', arabia:'brass',
  scifi:'neon', space:'neon', circuit:'neon', tokyo:'neon', retrofuture:'neon', haunted:'neon',
  circus:'candy', carnival:'candy', christmas:'candy', halloween:'candy', diner:'candy', fantasy:'candy', desert:'candy', dino:'candy',
};
// 製造機の見た目(セル比)。inset=マス境界からの余白 / height=筐体の高さ / slot=スロット穴の大きさ
export const MACH_GEO = { inset:0.10, height:0.42, slot:0.52 };
// 製造機の描画倍率。絵は1マスの送りぴったりに焼いてあるが、他のオブジェクトと並べると
// やや大きいので少しだけ小さく描く。絵・土台・素材アイコンを同じ倍率で縮めるので、
// 投入口とアイコンの位置関係は崩れない(占有マス数は変わらない)。
// 製造機の描画倍率。tools/cut_machines.py も同じ値を読んで、この倍率ぶん小さく焼く。
// 1.0 以外にすると 絵の1マスの送り(24.33px など)と 盤面の1マスの送り(27.648px)が食い違い、
// 機械が占有マスより短くなってグリッドに乗らない(浮いて見える/長軸が平行に見えない)。
// 小さく見せたいときは倍率ではなく、絵そのものを低く薄く描かせる。
export const MACH_DRAW = 1.0;
// 製造機のサイズ。variant('s2'..'s5') が在庫キー兼サイズ。1マス=スロット1つ。1マス機は廃止(最小2マス)。
export const MACH_SIZES = [2,3,4,5];
export const KINDS = ['machine','deco','prop','emoji'];   // 設置できる種類（belt/outlet/prize は廃止）
const MACH_MIN = 2;
export const MACH_ART = ['normal','arabia','diner','halloween','scifi','egypt','western','onsen','japan','pirate','steampunk','dwarf','china','sushi','haunted','tokyo','beehive','carnival','circus','desert','space','ice','mushroom','undersea','fantasy','christmas','jungle','circuit','retrofuture','cabin','dino','hell'];   // スプライトを用意したテーマ(assets/machines/mach-<theme>-s<N>.png)
export const machSize = (variant)=> Math.min(5, Math.max(MACH_MIN, parseInt(String(variant||'').replace(/\D/g,''))||MACH_MIN));

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
export function matArt(id){
  if(id==null) return null;
  const art=MAT_ART[id];
  const up=(window.__craft&&window.__craft.mat)?window.__craft.mat(id):null;
  if(!art&&!up) return null;
  return { e:(art&&art.e)||(up&&up.e)||'❓',
           c:(art&&art.c)||MAT_G_C[up&&up.g]||0xa8b6bd };
}
/* スロットの素材配列 → 筐体の上に出す表示。何が作れるかは伏せ、稼働状態と進捗を返す。
   判定は上流エンジンに委譲する(window.__craft.preview) */
export function recipeFor(slots, id){
  const f=(slots||[]).filter(Boolean); if(!f.length) return null;
  return (window.__craft && window.__craft.preview) ? window.__craft.preview(f, id) : null;
}

export const ROOM_TEX = { arabia:'room_arabia', undersea:'room_undersea', japan:'room_japan', china:'room_china',
  diner:'room_diner', fantasy:'room_fantasy', scifi:'room_scifi', cabin:'room_cabin', dino:'room_dino',
  haunted:'room_haunted', pirate:'room_pirate', circuit:'room_circuit', dwarf:'room_dwarf', hell:'room_hell', steampunk:'room_steampunk',
  retrofuture:'room_retrofuture', tokyo:'room_tokyo', halloween:'room_halloween', western:'room_western', sushi:'room_sushi', beehive:'room_beehive', circus:'room_circus', carnival:'room_carnival', desert:'room_desert', jungle:'room_jungle', egypt:'room_egypt', christmas:'room_christmas', space:'room_space', ice:'room_ice', mushroom:'room_mushroom', onsen:'room_onsen' };
// Stitch製 装飾プロップ(部屋画像と同じアイソメ視点で生成)。
//   汎用12種 + テーマ別の「名物」6種×5テーマ + テーマ別の「基本家具」7種×テーマ
// 基本家具は全テーマ共通のスロット(chair/table/sofa/shelf/rug/lamp/plant)で、材質と色だけテーマで差し替える。
export const PROP_NAMES = ['vase','palm','rug','flantern','fountain','chest','cushion','bonsai','lantern','pedestal','flower','screen',
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
export const isFlatProp = (variant)=> /(^|_)rug$/.test(String(variant));
// ラグの描画深度。床(-999)より上・他のオブジェクト(depth=画面y なので正の値)より下に固定し、
// 手前のマスに敷いても家具やキャラの上に被らないようにする。
export const RUG_DEPTH = -950;
export const propSpan = (name)=> PROP_SPAN[name] || FURN_SPAN[String(name).split('_')[1]] || 1;
window.PROP_SPAN = PROP_SPAN;   // ショップ表示(factory-phaser.html)から参照
// 収納(=在庫に戻す)の対象。在庫を持つ種類だけ。絵文字装飾やガチャ景品は在庫が無く、
// 戻すと復元できないので対象外にする。
export const STOWABLE = ['prop','deco'];
// エージェントのスキン(id=テーマキー・31種＋'none')。スキン=被り物(帽子)だけ。ベースのマスコットは常にそのまま、
// 頭上に被り物テクスチャ hat_<id>(形状指定でStitch生成→マゼンタ抜き)を1枚重ねる。定義のあるidだけ帽子が乗る。プロジェクト単位で永続化。
export const SKINS = [
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
export const DECOR = ['crate','drum','plant','pallet','sign'];
// 製造機はショップ経済側(G.machines)が設置する。ここは無料の初期装飾のみ。
export const DEMO = [
  {k:'dec_crate',c:2,r:8},{k:'dec_plant',c:1,r:10},
];


/* 製造まわりのマスタ — ジャンル / 原材料 / 製品 / レシピの唯一の定義。
   拡張はこのファイルだけで完結する。tools/test_craft.mjs がここを直接 import して検証する。

   ─ 拡張のしかた ─
   1. ジャンルを増やす     … GENRES に1行。以降は `g:'<id>'` を付けるだけ
   2. 原材料を増やす       … MATS に1行（g = 所属ジャンル）
   3. 製品を増やす         … PRODS に1行（g = ジャンル / r = レア度1..5 / m = レシピ）
   4. 組み合わせを変える   … その製品の m を書き換える。RECIPES は m から自動で作られる
   5. ジャンル跨ぎの当たり … SECRETS に1行（p = シークレットが出る確率。外れは🪨カタマリ）

   純データだけを置くこと（document / window / fetch を参照しない）。 */
import { RAR } from './econ.mjs';

export const GENRES = [
  {id:'food',e:'🍳',n:'食品'},
  {id:'mech',e:'⚙️',n:'機械'},
  {id:'life',e:'🧺',n:'生活品'},
];
export const GENRE = Object.fromEntries(GENRES.map(g=>[g.id,g]));
// シークレット枠。原材料を持たない「ジャンル跨ぎでだけ出る製品」のジャンルid
export const SECRET_G = 'secret';
export const genreOf = (matId)=> (MAT[matId]||{}).g || null;
// 選んだ原材料が何ジャンルに跨っているか（1 = 同ジャンル / 2以上 = ジャンル跨ぎ）
export function genresOfMats(mats){ return [...new Set((mats||[]).map(genreOf).filter(Boolean))]; }

// 原材料。g = ジャンル。ジャンルを跨いだセットも可能（ほぼ🪨カタマリ、一部シークレット）
export const MATS = [
  // 🍳 食品
  {id:'milk',  g:'food',e:'🥛',n:'牛乳'},   {id:'flour', g:'food',e:'🌾',n:'小麦粉'}, {id:'egg',   g:'food',e:'🥚',n:'卵'},
  {id:'butter',g:'food',e:'🧈',n:'バター'}, {id:'sugar', g:'food',e:'🍬',n:'砂糖'},   {id:'choco', g:'food',e:'🍫',n:'チョコ'},
  {id:'rice',  g:'food',e:'🍚',n:'米'},     {id:'noodle',g:'food',e:'🍥',n:'麺'},     {id:'cheese',g:'food',e:'🧀',n:'チーズ'},
  {id:'tomato',g:'food',e:'🍅',n:'トマト'}, {id:'meat',  g:'food',e:'🥩',n:'肉'},     {id:'veg',   g:'food',e:'🥬',n:'野菜'},
  // ⚙️ 機械
  {id:'iron',  g:'mech',e:'🔩',n:'鉄'},     {id:'alum',  g:'mech',e:'🥫',n:'アルミ'}, {id:'glass', g:'mech',e:'🪟',n:'ガラス'},
  {id:'rubber',g:'mech',e:'🛞',n:'ゴム'},   {id:'semic', g:'mech',e:'💾',n:'半導体'}, {id:'wire',  g:'mech',e:'🔌',n:'銅線'},
  {id:'batt',  g:'mech',e:'🔋',n:'電池'},   {id:'oil',   g:'mech',e:'🛢️',n:'石油'},   {id:'magnet',g:'mech',e:'🧲',n:'磁石'},
  {id:'lens',  g:'mech',e:'🔍',n:'レンズ'},
  // 🧺 生活品
  {id:'wood',  g:'life',e:'🪵',n:'木材'},   {id:'cloth', g:'life',e:'🧵',n:'布'},     {id:'cotton',g:'life',e:'☁️',n:'綿'},
  {id:'thread',g:'life',e:'🪢',n:'糸'},     {id:'leather',g:'life',e:'👝',n:'皮'},    {id:'plastic',g:'life',e:'🧴',n:'プラスチック'},
  {id:'paper', g:'life',e:'📄',n:'紙'},     {id:'bamboo',g:'life',e:'🎍',n:'竹'},     {id:'dye',   g:'life',e:'🎨',n:'染料'},
  {id:'feather',g:'life',e:'🪶',n:'羽毛'},
];
export const MAT = Object.fromEntries(MATS.map(m=>[m.id,m]));

// 製品（g は所属ジャンル / r は RAR と共通のレア度 1..5 / m はこの製品を作る組み合わせ＝レシピ）
// m がレシピの正。RECIPES はこの m から組み立て、図鑑の材料アイコンも同じ m を出す。
/* 並びは ジャンル → マス数 → 単独レシピ / レシピガチャ枠 の順。
   ★ が付いた2行が同じ m を共有する「レシピガチャ枠」（w:80 が基本レア度 / w:20 が1段上）。 */
export const PRODS = [
  // ══════════════ 🍳 食品 ══════════════
  // ── 2マス（基本 N）──
  {id:'tkg',     g:'food',e:'🥣',n:'卵かけご飯',    r:1,m:['rice','egg']},
  {id:'pretzel', g:'food',e:'🥨',n:'プレッツェル',  r:1,m:['flour','sugar']},
  {id:'shake',   g:'food',e:'🥤',n:'チョコシェイク',r:1,m:['milk','choco']},
  {id:'pancake', g:'food',e:'🥞',n:'パンケーキ',    r:1,m:['flour','egg']},
  {id:'fries',   g:'food',e:'🍟',n:'フライドポテト',r:1,m:['veg','butter']},
  {id:'kushi',   g:'food',e:'🍢',n:'串焼き',        r:1,m:['meat','veg']},
  {id:'sandwich',g:'food',e:'🥪',n:'サンドイッチ',  r:1,m:['flour','cheese']},
  {id:'croissant',g:'food',e:'🥐',n:'クロワッサン', r:1,m:['flour','butter']},
  {id:'onigiri', g:'food',e:'🍙',n:'おにぎり',      r:1,m:['rice','veg'],   w:80},  // ★🍚🥬
  {id:'sushi',   g:'food',e:'🍣',n:'寿司',          r:2,m:['rice','veg'],   w:20},  // ★
  {id:'burger',  g:'food',e:'🍔',n:'ハンバーガー',  r:1,m:['flour','meat'], w:80},  // ★🌾🥩
  {id:'taco',    g:'food',e:'🌮',n:'タコス',        r:2,m:['flour','meat'], w:20},  // ★
  // ── 3マス（基本 R）──
  {id:'bread',   g:'food',e:'🍞',n:'食パン',        r:2,m:['flour','butter','milk']},
  {id:'omelet',  g:'food',e:'🍳',n:'オムレツ',      r:2,m:['egg','butter','cheese']},
  {id:'salad',   g:'food',e:'🥗',n:'サラダ',        r:2,m:['veg','tomato','cheese']},
  {id:'soup',    g:'food',e:'🍲',n:'スープ',        r:2,m:['veg','tomato','meat']},
  {id:'cupnoodle',g:'food',e:'🍜',n:'カップラーメン',r:2,m:['noodle','meat','veg']},
  {id:'pizza',   g:'food',e:'🍕',n:'ピザ',          r:2,m:['flour','cheese','tomato']},
  {id:'pasta',   g:'food',e:'🍝',n:'パスタ',        r:2,m:['noodle','tomato','cheese']},
  {id:'curry',   g:'food',e:'🍛',n:'カレー',        r:2,m:['rice','meat','veg']},
  {id:'cookie',  g:'food',e:'🍪',n:'クッキー',      r:2,m:['flour','butter','sugar'],w:80}, // ★🌾🧈🍬
  {id:'donut',   g:'food',e:'🍩',n:'ドーナツ',      r:3,m:['flour','butter','sugar'],w:20}, // ★
  {id:'pudding', g:'food',e:'🍮',n:'プリン',        r:2,m:['egg','milk','sugar'],   w:80},  // ★🥚🥛🍬
  {id:'icecream',g:'food',e:'🍨',n:'アイスクリーム',r:3,m:['egg','milk','sugar'],   w:20},  // ★
  // ── 4マス（基本 SR）──
  {id:'gratin',  g:'food',e:'🥘',n:'グラタン',      r:3,m:['cheese','milk','butter','veg']},
  {id:'bento',   g:'food',e:'🍱',n:'特上弁当',      r:3,m:['rice','meat','veg','egg']},
  {id:'crepe',   g:'food',e:'🫓',n:'クレープ',      r:3,m:['butter','flour','milk','sugar'],w:80}, // ★🧈🌾🥛🍬
  {id:'honeytoast',g:'food',e:'🍯',n:'ハニートースト',r:4,m:['butter','flour','milk','sugar'],w:20}, // ★
  {id:'cupcake', g:'food',e:'🧁',n:'カップケーキ',  r:3,m:['choco','egg','milk','sugar'],w:80},    // ★🍫🥚🥛🍬
  {id:'parfait', g:'food',e:'🍧',n:'豪華パフェ',    r:4,m:['choco','egg','milk','sugar'],w:20},    // ★
  // ── 5マス（基本 SSR）──
  {id:'ramen',   g:'food',e:'🍥',n:'特製ラーメン',  r:4,m:['noodle','meat','egg','veg','cheese']},
  {id:'fondue',  g:'food',e:'🫕',n:'チーズフォンデュ',r:4,m:['butter','cheese','milk','tomato','veg']},
  {id:'cake',    g:'food',e:'🍰',n:'ショートケーキ',r:4,m:['butter','egg','flour','milk','sugar'],w:80}, // ★🧈🥚🌾🥛🍬
  {id:'deco',    g:'food',e:'🎂',n:'デコレーションケーキ',r:5,m:['butter','egg','flour','milk','sugar'],w:20}, // ★
  {id:'meatpie', g:'food',e:'🥧',n:'ミートパイ',    r:4,m:['cheese','meat','rice','tomato','veg'],w:80},  // ★🧀🥩🍚🍅🥬
  {id:'course',  g:'food',e:'🏆',n:'伝説のフルコース',r:5,m:['cheese','meat','rice','tomato','veg'],w:20}, // ★
  // ══════════════ ⚙️ 機械 ══════════════
  // ── 2マス（基本 N）──
  {id:'bulb',    g:'mech',e:'💡',n:'電球',          r:1,m:['glass','wire']},
  {id:'speaker', g:'mech',e:'🔊',n:'スピーカー',    r:1,m:['magnet','wire']},
  {id:'driver',  g:'mech',e:'🪛',n:'ドライバー',    r:1,m:['iron','alum']},
  {id:'mirror',  g:'mech',e:'🪞',n:'手鏡',          r:1,m:['glass','alum']},
  {id:'goggle',  g:'mech',e:'🥽',n:'ゴーグル',      r:1,m:['glass','rubber']},
  {id:'powbank', g:'mech',e:'🪫',n:'モバイルバッテリー',r:1,m:['batt','wire']},
  {id:'compass', g:'mech',e:'🧭',n:'方位磁針',      r:1,m:['iron','magnet']},
  {id:'kickboard',g:'mech',e:'🛴',n:'キックボード', r:1,m:['iron','rubber']},
  {id:'micro',   g:'mech',e:'🔬',n:'顕微鏡',        r:1,m:['glass','lens'],w:80},  // ★🪟🔍
  {id:'scope',   g:'mech',e:'🔭',n:'望遠鏡',        r:2,m:['glass','lens'],w:20},  // ★
  {id:'mouse',   g:'mech',e:'🖱️',n:'マウス',        r:1,m:['semic','wire'],w:80},  // ★💾🔌
  {id:'keyboard',g:'mech',e:'⌨️',n:'キーボード',    r:2,m:['semic','wire'],w:20},  // ★
  // ── 3マス（基本 R）──
  {id:'clock',   g:'mech',e:'⏰',n:'置き時計',      r:2,m:['iron','batt','glass']},
  {id:'fan',     g:'mech',e:'🌀',n:'扇風機',        r:2,m:['iron','wire','rubber']},
  {id:'light',   g:'mech',e:'🔦',n:'懐中電灯',      r:2,m:['batt','glass','alum']},
  {id:'console', g:'mech',e:'🎮',n:'ゲーム機',      r:2,m:['semic','batt','wire']},
  {id:'camera',  g:'mech',e:'📷',n:'カメラ',        r:2,m:['lens','glass','semic']},
  {id:'printer', g:'mech',e:'🖨️',n:'プリンター',    r:2,m:['iron','semic','wire']},
  {id:'tv',      g:'mech',e:'📺',n:'テレビ',        r:2,m:['glass','semic','wire']},
  {id:'bike',    g:'mech',e:'🏍️',n:'バイク',        r:2,m:['iron','rubber','oil']},
  {id:'phone',   g:'mech',e:'📱',n:'スマホ',        r:2,m:['batt','glass','semic'],w:80},  // ★🔋🪟💾
  {id:'watch',   g:'mech',e:'⌚',n:'スマートウォッチ',r:3,m:['batt','glass','semic'],w:20},  // ★
  {id:'radio',   g:'mech',e:'📻',n:'ラジオ',        r:2,m:['magnet','semic','wire'],w:80}, // ★🧲💾🔌
  {id:'headphone',g:'mech',e:'🎧',n:'ヘッドホン',   r:3,m:['magnet','semic','wire'],w:20}, // ★
  // ── 4マス（基本 SR）──
  {id:'car',     g:'mech',e:'🚗',n:'車',            r:3,m:['iron','rubber','glass','oil']},
  {id:'train',   g:'mech',e:'🚃',n:'電車',          r:3,m:['iron','alum','magnet','wire']},
  {id:'heli',    g:'mech',e:'🚁',n:'ヘリコプター',  r:3,m:['alum','iron','oil','rubber'],w:80},  // ★🥫🔩🛢️🛞
  {id:'plane',   g:'mech',e:'✈️',n:'飛行機',        r:4,m:['alum','iron','oil','rubber'],w:20},  // ★
  {id:'pc',      g:'mech',e:'💻',n:'パソコン',      r:3,m:['alum','glass','magnet','semic'],w:80}, // ★🥫🪟🧲💾
  {id:'satellite',g:'mech',e:'🛰️',n:'人工衛星',     r:4,m:['alum','glass','magnet','semic'],w:20}, // ★
  // ── 5マス（基本 SSR）──
  {id:'steamloco',g:'mech',e:'🚂',n:'蒸気機関車',   r:4,m:['iron','oil','wire','rubber','magnet']},
  {id:'crane',   g:'mech',e:'🏗️',n:'クレーン車',    r:4,m:['iron','alum','oil','rubber','wire']},
  {id:'exosuit', g:'mech',e:'🦾',n:'パワードスーツ',r:4,m:['alum','batt','iron','magnet','semic'],w:80}, // ★🥫🔋🔩🧲💾
  {id:'robot',   g:'mech',e:'🤖',n:'ロボット',      r:5,m:['alum','batt','iron','magnet','semic'],w:20}, // ★
  {id:'ship',    g:'mech',e:'🚢',n:'客船',          r:4,m:['alum','glass','iron','oil','semic'],w:80},   // ★🥫🪟🔩🛢️💾
  {id:'rocket',  g:'mech',e:'🚀',n:'ロケット',      r:5,m:['alum','glass','iron','oil','semic'],w:20},   // ★
  // ══════════════ 🧺 生活品 ══════════════
  // ── 2マス（基本 N）──
  {id:'brush',   g:'life',e:'🪥',n:'歯ブラシ',      r:1,m:['plastic','thread']},
  {id:'soap',    g:'life',e:'🧼',n:'せっけん',      r:1,m:['plastic','dye']},
  {id:'note',    g:'life',e:'📓',n:'ノート',        r:1,m:['paper','thread']},
  {id:'basket',  g:'life',e:'🧺',n:'洗濯かご',      r:1,m:['plastic','bamboo']},
  {id:'scarf',   g:'life',e:'🧣',n:'マフラー',      r:1,m:['cloth','thread']},
  {id:'pencil',  g:'life',e:'✏️',n:'えんぴつ',      r:1,m:['wood','dye']},
  {id:'sandal',  g:'life',e:'🩴',n:'サンダル',      r:1,m:['plastic','leather']},
  {id:'kite',    g:'life',e:'🪁',n:'凧',            r:1,m:['bamboo','paper']},
  {id:'socks',   g:'life',e:'🧦',n:'靴下',          r:1,m:['cotton','thread'],w:80}, // ★☁️🪢
  {id:'gloves',  g:'life',e:'🧤',n:'手袋',          r:2,m:['cotton','thread'],w:20}, // ★
  {id:'broom',   g:'life',e:'🧹',n:'ほうき',        r:1,m:['bamboo','thread'],w:80}, // ★🎍🪢
  {id:'strawhat',g:'life',e:'👒',n:'麦わら帽子',    r:2,m:['bamboo','thread'],w:20}, // ★
  // ── 3マス（基本 R）──
  {id:'tshirt',  g:'life',e:'👕',n:'Tシャツ',       r:2,m:['cloth','cotton','thread']},
  {id:'sponge',  g:'life',e:'🧽',n:'スポンジ',      r:2,m:['cotton','plastic','dye']},
  {id:'case',    g:'life',e:'💼',n:'ブリーフケース',r:2,m:['leather','thread','dye']},
  {id:'cap',     g:'life',e:'🧢',n:'キャップ',      r:2,m:['cloth','cotton','dye']},
  {id:'umbrella',g:'life',e:'☂️',n:'傘',            r:2,m:['cloth','bamboo','plastic']},
  {id:'shoes',   g:'life',e:'👟',n:'スニーカー',    r:2,m:['cotton','leather','thread']},
  {id:'futon',   g:'life',e:'🛌',n:'布団',          r:2,m:['cloth','cotton','feather']},
  {id:'frame',   g:'life',e:'🖼️',n:'額縁',          r:2,m:['wood','paper','dye']},
  {id:'pants',   g:'life',e:'👖',n:'ズボン',        r:2,m:['cloth','leather','thread'],w:80}, // ★🧵👝🪢
  {id:'bag',     g:'life',e:'🎒',n:'リュック',      r:3,m:['cloth','leather','thread'],w:20}, // ★
  {id:'chair',   g:'life',e:'🪑',n:'イス',          r:2,m:['cloth','cotton','wood'],  w:80}, // ★🧵☁️🪵
  {id:'bed',     g:'life',e:'🛏️',n:'ベッド',        r:3,m:['cloth','cotton','wood'],  w:20}, // ★
  // ── 4マス（基本 SR）──
  {id:'suit',    g:'life',e:'👔',n:'スーツ',        r:3,m:['cloth','thread','leather','dye']},
  {id:'chest',   g:'life',e:'🗄️',n:'たんす',        r:3,m:['wood','bamboo','paper','dye']},
  {id:'carpet',  g:'life',e:'🧶',n:'カーペット',    r:3,m:['cloth','cotton','dye','thread'],w:80},    // ★🧵☁️🎨🪢
  {id:'kimono',  g:'life',e:'👘',n:'着物',          r:4,m:['cloth','cotton','dye','thread'],w:20},    // ★
  {id:'teddy',   g:'life',e:'🧸',n:'ぬいぐるみ',    r:3,m:['cloth','cotton','feather','leather'],w:80}, // ★🧵☁️🪶👝
  {id:'sofa',    g:'life',e:'🛋️',n:'ソファ',        r:4,m:['cloth','cotton','feather','leather'],w:20}, // ★
  // ── 5マス（基本 SSR）──
  {id:'tent',    g:'life',e:'⛺',n:'テント',        r:4,m:['cloth','thread','wood','plastic','dye']},
  {id:'dress',   g:'life',e:'👗',n:'ドレス',        r:4,m:['cloth','cotton','dye','leather','thread']},
  {id:'coat',    g:'life',e:'🧥',n:'高級コート',    r:4,m:['cloth','cotton','dye','feather','thread'],w:80}, // ★🧵☁️🎨🪶🪢
  {id:'magic',   g:'life',e:'🪄',n:'魔法の絨毯',    r:5,m:['cloth','cotton','dye','feather','thread'],w:20}, // ★
  {id:'doll',    g:'life',e:'🪆',n:'からくり人形',  r:4,m:['cloth','dye','paper','thread','wood'],w:80},     // ★🧵🎨📄🪢🪵
  {id:'hina',    g:'life',e:'🎎',n:'ひな人形',      r:5,m:['cloth','dye','paper','thread','wood'],w:20},     // ★
  // ── ✨ シークレット（ジャンルを跨いだ特定の組み合わせでのみ出る）──
  {id:'ghost',   g:SECRET_G,e:'👻',n:'おばけ',      r:3,m:[]},
  {id:'cat',     g:SECRET_G,e:'🐈',n:'ふしぎな猫',  r:4,m:[]},
  {id:'alien',   g:SECRET_G,e:'👽',n:'エイリアン',  r:5,m:[]},
  {id:'dragon',  g:SECRET_G,e:'🐉',n:'ドラゴン',    r:5,m:[]},
  // レシピに無い組み合わせのときだけ出る。組み合わせを探す動機になる「ハズレ枠」
  {id:'blob',    g:SECRET_G,e:'🪨',n:'謎のカタマリ',r:1,m:[]},
];
export const UNKNOWN_PRODUCT='blob';
export const PROD = Object.fromEntries(PRODS.map(p=>[p.id,p]));

/* 組み合わせ（重複を除いた原材料のソート済みキー）→ 出うる製品。
   手で書く表は持たず、PRODS の m から機械的に作る。m は製品ごとに1つしかないので
   「違う組み合わせから同じ製品が出る」ことが構造的に起きない（製品 → 組み合わせ は1対1）。
   図鑑に出す材料アイコンも同じ m を見ているので、表示とレシピは必ず一致する。
   逆向き（1つの組み合わせから複数の製品）は残してある。同じ m を持つ製品どうしは
   重みで引き分けるので、同じ組み合わせを何度も試して上位レア度を狙う遊びになる。
   重みは製品の w（%で書く。レシピガチャ枠は 80/20）。w が無い製品はレア度の既定重み（RAR[r].w）。 */
export const recipeKeyOf = (p)=> [...new Set(p.m||[])].sort().join(',');
export const RECIPES = PRODS.reduce((r,p)=>{
  if(p.g===SECRET_G) return r;                  // シークレットはジャンル跨ぎ限定なので SECRETS 側
  const k=recipeKeyOf(p);
  (r[k]=r[k]||[]).push(p.w!=null ? [p.id,p.w] : p.id); return r;
}, {});

/* ジャンルを跨いだ組み合わせのときだけ引かれる隠しレシピ。
   ここに書いた組み合わせだけ p の確率でシークレット製品、外れは 🪨 謎のカタマリ。
   ここに無いジャンル跨ぎは必ず 🪨（＝跨ぎは基本ハズレ、という体験を保つ）。 */
export const SECRETS = {
  'cotton,milk,thread'  : {pid:'cat',    p:0.12},   // 🥛牛乳 + ☁️綿 + 🪢糸
  'cloth,noodle'        : {pid:'ghost',  p:0.10},   // 🍥麺 + 🧵布
  'egg,glass,semic'     : {pid:'alien',  p:0.06},   // 🥚卵 + 🪟ガラス + 💾半導体
  'iron,leather,meat'   : {pid:'dragon', p:0.04},   // 🥩肉 + 🔩鉄 + 👝皮
};

/* レシピ値の3通りの書き方を [{p:製品, w:重み}] に正規化する。
   重み未指定はレア度の既定重み（RAR[r].w）を使う。 */
export function normPool(spec){
  let list=[];
  if(Array.isArray(spec)) list=spec.map(x=>Array.isArray(x)?{id:x[0],w:+x[1]}:{id:x,w:null});
  else if(spec&&typeof spec==='object') list=Object.keys(spec).map(id=>({id,w:+spec[id]}));
  return list.filter(x=>PROD[x.id]).map(x=>({ p:PROD[x.id],
    w:(x.w!=null&&isFinite(x.w)&&x.w>0)?x.w:RAR[PROD[x.id].r].w }));
}
export function pickWeighted(pool){
  if(!pool.length) return null;
  const ws=pool.reduce((s,x)=>s+x.w,0); let x=Math.random()*ws;
  for(const it of pool){ x-=it.w; if(x<=0) return it.p; }
  return pool[pool.length-1].p;
}
// デバッグ・テスト用: その組み合わせで出うる製品と確率（%）
export function poolFor(key){
  if(!key) return [];
  const s=SECRETS[key];
  if(s&&PROD[s.pid]) return [{p:PROD[s.pid],w:s.p},{p:PROD[UNKNOWN_PRODUCT],w:1-s.p}];
  if(genresOfMats(key.split(',')).length>1) return [{p:PROD[UNKNOWN_PRODUCT],w:1}];
  const pool=normPool(RECIPES[key]);
  return pool.length?pool:[{p:PROD[UNKNOWN_PRODUCT],w:1}];
}
/* 組み合わせから1つ引く。判定の順番がゲーム性なのでここが唯一の分岐点。
   1. 隠しレシピ（ジャンル跨ぎ）→ p の確率でシークレット / 外れは🪨
   2. ジャンル跨ぎでレシピ無し  → 🪨
   3. 同ジャンルのレシピ         → 重み付き抽選
   4. 同ジャンルでレシピ無し     → 🪨 */
export function rollProduct(key){
  if(!key) return PROD[UNKNOWN_PRODUCT];
  const s=SECRETS[key];
  if(s&&PROD[s.pid]) return (Math.random()<(s.p||0)) ? PROD[s.pid] : PROD[UNKNOWN_PRODUCT];
  if(genresOfMats(key.split(',')).length>1) return PROD[UNKNOWN_PRODUCT];
  return pickWeighted(normPool(RECIPES[key])) || PROD[UNKNOWN_PRODUCT];
}
/* 機械のマスの中身 → レシピキー。重複を除いてソートするので、
   入れる順番や同じ素材を2マスに入れたかは結果に影響しない。
   クライアントとサーバで同じキーにならないと製造結果がズレるので定義は1つだけ。 */
export const keyOfSlots = (slots)=>{ const set=[...new Set((slots||[]).filter(Boolean))].sort();
  return set.length?set.join(','):null; };

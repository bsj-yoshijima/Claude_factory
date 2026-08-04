/* 経済まわりのマスタ — レア度 / 製造機 / 内装 / テーマの唯一の定義。
   クライアント(factory-phaser.html)とサーバ(server/game-data.mjs)が同じこれを import する。
   純データだけを置くこと（document / window / fetch を参照しない）。 */

export const RAR={1:{n:'N',c:'#9fb0c0',w:58},2:{n:'R',c:'#5fa8e0',w:27},3:{n:'SR',c:'#b57be0',w:11},4:{n:'SSR',c:'#f6c04a',w:3.2},5:{n:'UR',c:'#ff5d6c',w:0.8}};
export const PRIZES=[
  {id:'p_bolt',e:'🔩',n:'謎のボルト',r:1},{id:'p_clip',e:'📎',n:'クリップ',r:1},{id:'p_cone',e:'🚧',n:'コーン',r:1},{id:'p_seed',e:'🌱',n:'観葉の芽',r:1},
  {id:'p_guitar',e:'🎸',n:'ギター',r:2},{id:'p_lamp',e:'💡',n:'ランプ',r:2},{id:'p_bronze',e:'🥉',n:'銅トロフィー',r:2},
  {id:'p_robot',e:'🤖',n:'ロボ人形',r:3},{id:'p_arcade',e:'🕹️',n:'アーケード',r:3},{id:'p_gold',e:'🥇',n:'金メダル',r:3},
  {id:'p_crystal',e:'💎',n:'クリスタル',r:4},{id:'p_rocket',e:'🚀',n:'ロケット',r:4},
  {id:'p_crown',e:'👑',n:'王冠',r:5},{id:'p_dragon',e:'🐉',n:'ドラゴン像',r:5},
];
// ===== 価格・レート（すべて調整可） =====
export const SELL={1:60,2:180,3:600,4:2400,5:9000};         // 景品売却額(レア度別)
// 製造機は「マス数」で選ぶ。1マス=素材スロット1つ。入っている素材の組合せで作れる物が変わる。
// 製造機は2〜5マス（1マス機は廃止）。最小の2マス機が最初の1台。
export const MACH={ s2:{e:'2️⃣',n:'製造機 2マス',price:0},      s3:{e:'3️⃣',n:'製造機 3マス',price:6500},
             s4:{e:'4️⃣',n:'製造機 4マス',price:15000},  s5:{e:'5️⃣',n:'製造機 5マス',price:34000} };
export const machVariant=(t)=> MACH[t] ? t : 's2';   // 旧4種(red等)・旧1マス機(s1) はすべて2マス機に読み替え
export const lvCost=(lvl)=> Math.round(120*lvl*lvl);        // レベルアップ費用
export const DECO={ crate:{e:'📦',n:'木箱',price:150}, drum:{e:'🛢️',n:'ドラム缶',price:200}, plant:{e:'🪴',n:'観葉植物',price:180}, pallet:{e:'🧱',n:'パレット',price:160}, sign:{e:'🚧',n:'標識',price:220} };
// Stitch製 装飾プロップ(床に置くオブジェクト)。th = 対応テーマ(未指定は汎用)
export const PROP={ vase:{e:'🏺',n:'装飾壺',price:220}, palm:{e:'🌴',n:'ヤシの木',price:240}, rug:{e:'🧶',n:'絨毯',price:200}, flantern:{e:'🪔',n:'燭台ランプ',price:260},
  fountain:{e:'⛲',n:'噴水',price:450}, chest:{e:'🧰',n:'宝箱',price:400}, cushion:{e:'🛋️',n:'クッション',price:180}, bonsai:{e:'🎍',n:'盆栽',price:280},
  lantern:{e:'🏮',n:'吊り提灯',price:220}, pedestal:{e:'🗿',n:'石台座',price:320}, flower:{e:'🌸',n:'花鉢',price:170}, screen:{e:'🖼️',n:'屏風',price:340},
  // 🎪 サーカス
  cir_popcorn:{e:'🍿',n:'ポップコーンワゴン',price:380,th:'circus'}, cir_ballstand:{e:'⭐',n:'玉乗り台',price:300,th:'circus'},
  cir_trunks:{e:'🧳',n:'縞トランク3段',price:280,th:'circus'},      cir_ringtoss:{e:'🎯',n:'輪投げスタンド',price:260,th:'circus'},
  cir_cannon:{e:'💥',n:'人間大砲',price:480,th:'circus'},           cir_stool:{e:'🪑',n:'ベルベットスツール',price:200,th:'circus'},
  // 🍣 回転寿司
  sus_lane:{e:'🍣',n:'回転レーン',price:460,th:'sushi'},            sus_oke:{e:'🪵',n:'寿司桶5段',price:240,th:'sushi'},
  sus_tea:{e:'🍵',n:'給茶台',price:280,th:'sushi'},                 sus_sake:{e:'🍶',n:'藁巻き酒樽',price:320,th:'sushi'},
  sus_neko:{e:'🐱',n:'招き猫の台座',price:300,th:'sushi'},           sus_netacase:{e:'🐟',n:'ネタケース',price:500,th:'sushi'},
  // 🤠 西部開拓
  wes_barreltable:{e:'🍺',n:'樽テーブル',price:300,th:'western'},    wes_horseshoe:{e:'🐴',n:'蹄鉄投げ',price:240,th:'western'},
  wes_wheel:{e:'🛞',n:'荷馬車の車輪',price:260,th:'western'},        wes_campfire:{e:'🔥',n:'焚き火とコーヒー',price:340,th:'western'},
  wes_cactus:{e:'🌵',n:'サボテンの鉢',price:220,th:'western'},       wes_assay:{e:'⚖️',n:'金の秤台',price:420,th:'western'},
  // 🐝 ミツバチの巣
  bee_combtable:{e:'🍯',n:'蜜のハニカム台',price:300,th:'beehive'},  bee_honeypots:{e:'🫙',n:'蜜壺ピラミッド',price:320,th:'beehive'},
  bee_pollen:{e:'🧺',n:'花粉のカゴ',price:240,th:'beehive'},         bee_candles:{e:'🕯️',n:'蜜蝋の燭台',price:260,th:'beehive'},
  bee_throne:{e:'👑',n:'女王蜂の玉座',price:520,th:'beehive'},       bee_frames:{e:'🪟',n:'巣枠ラック',price:280,th:'beehive'},
  // ⚙️ スチームパンク
  stm_boiler:{e:'⚗️',n:'真鍮ボイラー',price:460,th:'steampunk'},     stm_cogs:{e:'⚙️',n:'歯車の山',price:220,th:'steampunk'},
  stm_console:{e:'🎛️',n:'圧力計コンソール',price:400,th:'steampunk'},stm_armchair:{e:'🛋️',n:'銅管のアームチェア',price:360,th:'steampunk'},
  stm_orrery:{e:'🔭',n:'天球儀',price:480,th:'steampunk'},           stm_coal:{e:'🪣',n:'石炭バケツ',price:200,th:'steampunk'},
  // ===== 基本家具(fu:true) — 全テーマ共通スロット。価格はスロットで固定し、テーマ差は見た目だけ =====
  // 🍣 回転寿司
  sus_chair:{e:'🪑',n:'白木のスツール',price:200,th:'sushi',fu:1},    sus_table:{e:'🪵',n:'一枚板のテーブル',price:280,th:'sushi',fu:1},
  sus_sofa:{e:'🛋️',n:'生成りのベンチソファ',price:420,th:'sushi',fu:1},sus_shelf:{e:'🗄️',n:'白木の食器棚',price:320,th:'sushi',fu:1},
  sus_rug:{e:'🟦',n:'畳のラグ',price:240,th:'sushi',fu:1},            sus_lamp:{e:'🏮',n:'行灯スタンド',price:260,th:'sushi',fu:1},
  sus_plant:{e:'🎋',n:'竹の鉢',price:220,th:'sushi',fu:1},            sus_noren:{e:'🎏',n:'暖簾立て',price:340,th:'sushi'},
  // ⚙️ スチームパンク
  stm_chair:{e:'🪑',n:'銅管の椅子',price:200,th:'steampunk',fu:1},    stm_table:{e:'🪵',n:'歯車のテーブル',price:280,th:'steampunk',fu:1},
  stm_sofa:{e:'🛋️',n:'革張りのソファ',price:420,th:'steampunk',fu:1}, stm_shelf:{e:'🗄️',n:'鉄フレームの棚',price:320,th:'steampunk',fu:1},
  stm_rug:{e:'🟥',n:'歯車柄のラグ',price:240,th:'steampunk',fu:1},    stm_lamp:{e:'💡',n:'真鍮のフロアランプ',price:260,th:'steampunk',fu:1},
  stm_plant:{e:'🪴',n:'銅鉢のシダ',price:220,th:'steampunk',fu:1},    stm_helmet:{e:'🤿',n:'潜水ヘルメット台',price:380,th:'steampunk'},
  // ⛩️ 日本
  jpn_chair:{e:'🪑',n:'座椅子',price:200,th:'japan',fu:1},           jpn_table:{e:'🍵',n:'ちゃぶ台',price:280,th:'japan',fu:1},
  jpn_sofa:{e:'🛋️',n:'縁台ベンチ',price:420,th:'japan',fu:1},         jpn_shelf:{e:'🗄️',n:'和箪笥',price:320,th:'japan',fu:1},
  jpn_rug:{e:'🟩',n:'畳マット',price:240,th:'japan',fu:1},           jpn_lamp:{e:'🏮',n:'行灯',price:260,th:'japan',fu:1},
  jpn_plant:{e:'🎋',n:'鉢植えの竹',price:220,th:'japan',fu:1},        jpn_byobu:{e:'🌸',n:'桜の屏風',price:380,th:'japan'},
  // 🍔 ダイナー
  din_chair:{e:'🪑',n:'クロームチェア',price:200,th:'diner',fu:1},     din_table:{e:'🍟',n:'ダイナーテーブル',price:280,th:'diner',fu:1},
  din_sofa:{e:'🛋️',n:'レッドブースソファ',price:420,th:'diner',fu:1},  din_shelf:{e:'🥤',n:'ミルクシェイク棚',price:320,th:'diner',fu:1},
  din_rug:{e:'🏁',n:'チェッカーマット',price:240,th:'diner',fu:1},     din_lamp:{e:'💡',n:'ストライプランプ',price:260,th:'diner',fu:1},
  din_plant:{e:'🪴',n:'モンステラの鉢',price:220,th:'diner',fu:1},     din_jukebox:{e:'🎶',n:'ジュークボックス',price:380,th:'diner'},
  // 🌲 森コテージ
  cab_chair:{e:'🪑',n:'丸太の椅子',price:200,th:'cabin',fu:1},        cab_table:{e:'🪵',n:'丸太のテーブル',price:280,th:'cabin',fu:1},
  cab_sofa:{e:'🛋️',n:'ログソファ',price:420,th:'cabin',fu:1},         cab_shelf:{e:'🗄️',n:'山小屋の棚',price:320,th:'cabin',fu:1},
  cab_rug:{e:'🟫',n:'編み込みラグ',price:240,th:'cabin',fu:1},        cab_lamp:{e:'🏮',n:'吊りランタン',price:260,th:'cabin',fu:1},
  cab_plant:{e:'🌲',n:'樽植えのモミ',price:220,th:'cabin',fu:1},      cab_hearth:{e:'🔥',n:'石の暖炉',price:380,th:'cabin'},
  // 🚀 SF宇宙
  sci_chair:{e:'🪑',n:'操舵席チェア',price:200,th:'scifi',fu:1},      sci_table:{e:'🛸',n:'ホロ投影テーブル',price:280,th:'scifi',fu:1},
  sci_sofa:{e:'🛋️',n:'クルー用ソファ',price:420,th:'scifi',fu:1},     sci_shelf:{e:'🗄️',n:'補給物資ラック',price:320,th:'scifi',fu:1},
  sci_rug:{e:'🔷',n:'ヘクスデッキマット',price:240,th:'scifi',fu:1},   sci_lamp:{e:'💡',n:'ケージ型ランプ',price:260,th:'scifi',fu:1},
  sci_plant:{e:'🪴',n:'水耕培養槽シダ',price:220,th:'scifi',fu:1},     sci_starmap:{e:'🖥️',n:'星図コンソール',price:380,th:'scifi'},
  // 🧙 ファンタジー
  fan_chair:{e:'🪑',n:'魔道士の椅子',price:200,th:'fantasy',fu:1},     fan_table:{e:'📖',n:'魔導書の作業机',price:280,th:'fantasy',fu:1},
  fan_sofa:{e:'🌙',n:'三日月のソファ',price:420,th:'fantasy',fu:1},    fan_shelf:{e:'📚',n:'秘薬と魔導書の棚',price:320,th:'fantasy',fu:1},
  fan_rug:{e:'🔮',n:'魔法陣のラグ',price:240,th:'fantasy',fu:1},      fan_lamp:{e:'🕯️',n:'錬鉄のランタン灯',price:260,th:'fantasy',fu:1},
  fan_plant:{e:'🪴',n:'光る魔法草の鉢',price:220,th:'fantasy',fu:1},   fan_cauldron:{e:'🧪',n:'大魔女の大釜',price:380,th:'fantasy'},
  // 🏴‍☠️ 海賊船
  pir_chair:{e:'🪑',n:'船長の椅子',price:200,th:'pirate',fu:1},       pir_table:{e:'🗺️',n:'海図テーブル',price:280,th:'pirate',fu:1},
  pir_sofa:{e:'🛋️',n:'船室のベンチソファ',price:420,th:'pirate',fu:1}, pir_shelf:{e:'🔭',n:'航海道具の棚',price:320,th:'pirate',fu:1},
  pir_rug:{e:'🧭',n:'羅針盤のラグ',price:240,th:'pirate',fu:1},       pir_lamp:{e:'🏮',n:'真鍮のランタン灯',price:260,th:'pirate',fu:1},
  pir_plant:{e:'🌴',n:'樽植えのヤシ',price:220,th:'pirate',fu:1},     pir_chest:{e:'💰',n:'財宝の宝箱',price:380,th:'pirate'},
  // 🎃 ハロウィン
  hal_chair:{e:'🪑',n:'ゴシックの玉座',price:200,th:'halloween',fu:1}, hal_table:{e:'🕯️',n:'獣脚のロウソク机',price:280,th:'halloween',fu:1},
  hal_sofa:{e:'💀',n:'紫ベルベットのソファ',price:420,th:'halloween',fu:1}, hal_shelf:{e:'📚',n:'魔導書の棚',price:320,th:'halloween',fu:1},
  hal_rug:{e:'🕸️',n:'蜘蛛の巣ラグ',price:240,th:'halloween',fu:1},    hal_lamp:{e:'🏮',n:'鉄のランタン灯',price:260,th:'halloween',fu:1},
  hal_plant:{e:'🪴',n:'枯れいばらの鉢',price:220,th:'halloween',fu:1}, hal_pumpkin:{e:'🎃',n:'大かぼちゃランタン',price:380,th:'halloween'},
  // 🐚 海底
  sea_chair:{e:'🪑',n:'ホタテ貝の椅子',price:200,th:'undersea',fu:1},  sea_table:{e:'🫧',n:'シーグラスのテーブル',price:280,th:'undersea',fu:1},
  sea_sofa:{e:'🐚',n:'シャコ貝のソファ',price:420,th:'undersea',fu:1}, sea_shelf:{e:'🪸',n:'珊瑚の飾り棚',price:320,th:'undersea',fu:1},
  sea_rug:{e:'🌀',n:'海藻織りのラグ',price:240,th:'undersea',fu:1},    sea_lamp:{e:'🎐',n:'クラゲのランプ',price:260,th:'undersea',fu:1},
  sea_plant:{e:'🌿',n:'コンブの鉢植え',price:220,th:'undersea',fu:1},  sea_treasure:{e:'💰',n:'沈没船の宝箱',price:380,th:'undersea'},
  // 🕌 アラビア
  arb_chair:{e:'🪑',n:'透かし彫りの椅子',price:200,th:'arabia',fu:1},  arb_table:{e:'🫖',n:'真鍮のトレイテーブル',price:280,th:'arabia',fu:1},
  arb_sofa:{e:'🛋️',n:'マジュリスのソファ',price:420,th:'arabia',fu:1}, arb_shelf:{e:'🏺',n:'馬蹄アーチの飾り棚',price:320,th:'arabia',fu:1},
  arb_rug:{e:'🧶',n:'ペルシャ絨毯',price:240,th:'arabia',fu:1},        arb_lamp:{e:'🏮',n:'モロッコランタン',price:260,th:'arabia',fu:1},
  arb_plant:{e:'🌴',n:'ナツメヤシの鉢',price:220,th:'arabia',fu:1},    arb_hookah:{e:'💨',n:'水たばこ',price:380,th:'arabia'},
  // 🐉 中華
  chn_chair:{e:'🪑',n:'紫檀の官帽椅',price:200,th:'china',fu:1},       chn_table:{e:'🍵',n:'朱漆の茶卓',price:280,th:'china',fu:1},
  chn_sofa:{e:'🛋️',n:'羅漢榻',price:420,th:'china',fu:1},             chn_shelf:{e:'🏺',n:'多宝格の飾り棚',price:320,th:'china',fu:1},
  chn_rug:{e:'🐉',n:'龍紋の絨毯',price:240,th:'china',fu:1},           chn_lamp:{e:'🏮',n:'紅提灯スタンド',price:260,th:'china',fu:1},
  chn_plant:{e:'🎍',n:'青花鉢の竹',price:220,th:'china',fu:1},         chn_censer:{e:'🪔',n:'黄金の龍香炉',price:380,th:'china'},
  // 🦖 ダイナソー
  dno_chair:{e:'🪑',n:'骨アーチの石イス',price:200,th:'dino',fu:1},    dno_table:{e:'🥚',n:'化石テーブル',price:280,th:'dino',fu:1},
  dno_sofa:{e:'🛋️',n:'毛皮ソファ',price:420,th:'dino',fu:1},          dno_shelf:{e:'🦴',n:'発掘標本棚',price:320,th:'dino',fu:1},
  dno_rug:{e:'🐾',n:'足あとラグ',price:240,th:'dino',fu:1},            dno_lamp:{e:'💡',n:'琥珀ランプ',price:260,th:'dino',fu:1},
  dno_plant:{e:'🌿',n:'古代シダ',price:220,th:'dino',fu:1},            dno_fossil:{e:'🦖',n:'ティラノの全身骨格',price:380,th:'dino'},
  // 👻 幽霊屋敷
  hnt_chair:{e:'🪑',n:'呪われた高背椅子',price:200,th:'haunted',fu:1}, hnt_table:{e:'💀',n:'髑髏のテーブル',price:280,th:'haunted',fu:1},
  hnt_sofa:{e:'🛋️',n:'破れたビロードのソファ',price:420,th:'haunted',fu:1}, hnt_shelf:{e:'📚',n:'蜘蛛の巣の本棚',price:320,th:'haunted',fu:1},
  hnt_rug:{e:'🟥',n:'虫食いのペルシャ絨毯',price:240,th:'haunted',fu:1}, hnt_lamp:{e:'🕯️',n:'蝋燭の燭台スタンド',price:260,th:'haunted',fu:1},
  hnt_plant:{e:'🥀',n:'枯れ木の石壺',price:220,th:'haunted',fu:1},     hnt_clock:{e:'🕰️',n:'亡霊の振り子時計',price:380,th:'haunted'},
  // 🤠 西部開拓（家具）
  wes_chair:{e:'🪑',n:'牛革の木椅子',price:200,th:'western',fu:1},     wes_table:{e:'🪵',n:'古板のテーブル',price:280,th:'western',fu:1},
  wes_sofa:{e:'🛋️',n:'革張りベンチソファ',price:420,th:'western',fu:1}, wes_shelf:{e:'🥃',n:'酒瓶の棚',price:320,th:'western',fu:1},
  wes_rug:{e:'🧶',n:'ナバホ織のラグ',price:240,th:'western',fu:1},     wes_lamp:{e:'🏮',n:'カンテラ立てランプ',price:260,th:'western',fu:1},
  wes_plant:{e:'🌿',n:'ユッカの木桶',price:220,th:'western',fu:1},     wes_piano:{e:'🎹',n:'酒場のピアノ',price:380,th:'western'},
  // 🐝 ミツバチの巣（家具）
  bee_chair:{e:'🪑',n:'ハニカムチェア',price:200,th:'beehive',fu:1},   bee_table:{e:'🧇',n:'蜜ろうテーブル',price:280,th:'beehive',fu:1},
  bee_sofa:{e:'🛋️',n:'ワックスソファ',price:420,th:'beehive',fu:1},   bee_shelf:{e:'🗄️',n:'蜂蜜棚',price:320,th:'beehive',fu:1},
  bee_rug:{e:'🟨',n:'ハニカムラグ',price:240,th:'beehive',fu:1},       bee_lamp:{e:'🏮',n:'琥珀ランタン',price:260,th:'beehive',fu:1},
  bee_plant:{e:'🌼',n:'クローバーの鉢',price:220,th:'beehive',fu:1},   bee_honeyfountain:{e:'⛲',n:'ハチミツの泉',price:380,th:'beehive'},
  // 🎪 サーカス（家具）
  cir_chair:{e:'🪑',n:'星付きサーカスチェア',price:200,th:'circus',fu:1}, cir_table:{e:'🪧',n:'ストライプのローテーブル',price:280,th:'circus',fu:1},
  cir_sofa:{e:'🛋️',n:'紫ベルベットのソファ',price:420,th:'circus',fu:1}, cir_shelf:{e:'🗄️',n:'曲芸道具の棚',price:320,th:'circus',fu:1},
  cir_rug:{e:'🟥',n:'放射ストライプのラグ',price:240,th:'circus',fu:1}, cir_lamp:{e:'💡',n:'電球付きテントランプ',price:260,th:'circus',fu:1},
  cir_plant:{e:'🌴',n:'ドラム鉢のヤシ',price:220,th:'circus',fu:1},    cir_carousel:{e:'🎠',n:'ミニ回転木馬',price:380,th:'circus'},
  // 🌃 Tokyo
  tky_chair:{e:'🪑',n:'居酒屋スツール',price:200,th:'tokyo',fu:1},     tky_table:{e:'🍜',n:'ラーメンテーブル',price:280,th:'tokyo',fu:1},
  tky_sofa:{e:'🛋️',n:'ネオンソファ',price:420,th:'tokyo',fu:1},       tky_shelf:{e:'🏪',n:'コンビニ棚',price:320,th:'tokyo',fu:1},
  tky_rug:{e:'🚸',n:'横断歩道ラグ',price:240,th:'tokyo',fu:1},         tky_lamp:{e:'🏮',n:'赤提灯ランプ',price:260,th:'tokyo',fu:1},
  tky_plant:{e:'🎍',n:'竹の鉢植え',price:220,th:'tokyo',fu:1},         tky_vending:{e:'🥤',n:'自動販売機',price:380,th:'tokyo'},
  // 🏁 サーキット
  cct_chair:{e:'🪑',n:'バケットシート',price:200,th:'circuit',fu:1},   cct_table:{e:'🛞',n:'タイヤテーブル',price:280,th:'circuit',fu:1},
  cct_sofa:{e:'🛋️',n:'ピットレザーソファ',price:420,th:'circuit',fu:1}, cct_shelf:{e:'🔧',n:'ピットツールラック',price:320,th:'circuit',fu:1},
  cct_rug:{e:'🛣️',n:'サーキットラグ',price:240,th:'circuit',fu:1},     cct_lamp:{e:'🚦',n:'ピットシグナルランプ',price:260,th:'circuit',fu:1},
  cct_plant:{e:'🌳',n:'月桂樹タイヤ鉢',price:220,th:'circuit',fu:1},   cct_podium:{e:'🏆',n:'表彰台',price:380,th:'circuit'},
  // ⛏️ ドワーフ鉱山
  dwf_chair:{e:'🪑',n:'鉄鋲の樫椅子',price:200,th:'dwarf',fu:1},       dwf_table:{e:'🪨',n:'花崗岩のテーブル',price:280,th:'dwarf',fu:1},
  dwf_sofa:{e:'🛋️',n:'革張りの長椅子',price:420,th:'dwarf',fu:1},     dwf_shelf:{e:'💎',n:'鉱石棚',price:320,th:'dwarf',fu:1},
  dwf_rug:{e:'🟥',n:'宝石紋のラグ',price:240,th:'dwarf',fu:1},         dwf_lamp:{e:'🏮',n:'坑道ランタン',price:260,th:'dwarf',fu:1},
  dwf_plant:{e:'🍄',n:'光るキノコ鉢',price:220,th:'dwarf',fu:1},       dwf_forge:{e:'⚒️',n:'ドワーフの鍛冶炉',price:380,th:'dwarf'},
  // 😈 地獄
  hel_chair:{e:'🪑',n:'魔王の玄武岩チェア',price:200,th:'hell',fu:1},  hel_table:{e:'🔥',n:'溶岩ひび割れテーブル',price:280,th:'hell',fu:1},
  hel_sofa:{e:'🛋️',n:'骨トゲの血赤ソファ',price:420,th:'hell',fu:1},  hel_shelf:{e:'💀',n:'髑髏の鉄棚',price:320,th:'hell',fu:1},
  hel_rug:{e:'⭐',n:'魔法陣ラグ',price:240,th:'hell',fu:1},            hel_lamp:{e:'🕯️',n:'髑髏の炎スタンド',price:260,th:'hell',fu:1},
  hel_plant:{e:'🌹',n:'茨の魔樹',price:220,th:'hell',fu:1},            hel_cauldron:{e:'🍲',n:'煮えたぎる溶岩鍋',price:380,th:'hell'},
  // 🛸 レトロ未来
  rft_chair:{e:'🪑',n:'艦長の革張り椅子',price:200,th:'retrofuture',fu:1}, rft_table:{e:'🗺️',n:'海図テーブル',price:280,th:'retrofuture',fu:1},
  rft_sofa:{e:'🛋️',n:'サロンのソファ',price:420,th:'retrofuture',fu:1}, rft_shelf:{e:'🧪',n:'標本棚',price:320,th:'retrofuture',fu:1},
  rft_rug:{e:'🧭',n:'羅針盤の絨毯',price:240,th:'retrofuture',fu:1},   rft_lamp:{e:'🏮',n:'深海ランタン灯',price:260,th:'retrofuture',fu:1},
  rft_plant:{e:'🌿',n:'海藻の鉢植え',price:220,th:'retrofuture',fu:1}, rft_organ:{e:'🎹',n:'真鍮のパイプオルガン',price:380,th:'retrofuture'},
  // 🎭 カーニバル
  crn_chair:{e:'🪑',n:'バロックの金彩チェア',price:200,th:'carnival',fu:1}, crn_table:{e:'🎭',n:'大理石のテーブル',price:280,th:'carnival',fu:1},
  crn_sofa:{e:'🛋️',n:'紫ベルベットの長椅子',price:420,th:'carnival',fu:1}, crn_shelf:{e:'📿',n:'仮面と首飾りの棚',price:320,th:'carnival',fu:1},
  crn_rug:{e:'🔶',n:'ハーレクイン柄のラグ',price:240,th:'carnival',fu:1}, crn_lamp:{e:'🕯️',n:'金のキャンドルスタンド',price:260,th:'carnival',fu:1},
  crn_plant:{e:'🌴',n:'ビーズのパルメット',price:220,th:'carnival',fu:1}, crn_maskpedestal:{e:'🎭',n:'仮面の台座',price:380,th:'carnival'},
  // 🏜️ 砂漠
  dst_chair:{e:'🪑',n:'キリムチェア',price:200,th:'desert',fu:1},      dst_table:{e:'🏺',n:'砂岩スラブテーブル',price:280,th:'desert',fu:1},
  dst_sofa:{e:'🛋️',n:'サンドストーンソファ',price:420,th:'desert',fu:1}, dst_shelf:{e:'🪟',n:'岩窟シェルフ',price:320,th:'desert',fu:1},
  dst_rug:{e:'🧶',n:'キリムラグ',price:240,th:'desert',fu:1},          dst_lamp:{e:'🏮',n:'砂漠ランタン',price:260,th:'desert',fu:1},
  dst_plant:{e:'🌵',n:'サボテンの鉢',price:220,th:'desert',fu:1},      dst_skull:{e:'🐂',n:'頭骨トーテム',price:380,th:'desert'},
  // 🌿 ジャングル
  jgl_chair:{e:'🪑',n:'石の玉座',price:200,th:'jungle',fu:1},          jgl_table:{e:'🪨',n:'遺跡の石卓',price:280,th:'jungle',fu:1},
  jgl_sofa:{e:'🛋️',n:'苔むす石のベンチ',price:420,th:'jungle',fu:1},  jgl_shelf:{e:'🏺',n:'祭壇の石棚',price:320,th:'jungle',fu:1},
  jgl_rug:{e:'🧶',n:'部族模様の敷物',price:240,th:'jungle',fu:1},      jgl_lamp:{e:'💎',n:'翡翠の灯り',price:260,th:'jungle',fu:1},
  jgl_plant:{e:'🌿',n:'モンステラの鉢',price:220,th:'jungle',fu:1},    jgl_idol:{e:'🗿',n:'古代の石像頭',price:380,th:'jungle'},
  // 🔺 エジプト
  egy_chair:{e:'🪑',n:'ファラオの玉座',price:200,th:'egypt',fu:1},     egy_table:{e:'🏺',n:'供物の石卓',price:280,th:'egypt',fu:1},
  egy_sofa:{e:'🛋️',n:'獅子脚の長椅子',price:420,th:'egypt',fu:1},     egy_shelf:{e:'📜',n:'パピルスの石棚',price:320,th:'egypt',fu:1},
  egy_rug:{e:'🧿',n:'ホルスの目の敷物',price:240,th:'egypt',fu:1},     egy_lamp:{e:'🔥',n:'パピルス柱の聖火灯',price:260,th:'egypt',fu:1},
  egy_plant:{e:'🪷',n:'青蓮とパピルスの壺',price:220,th:'egypt',fu:1}, egy_sarcophagus:{e:'⚱️',n:'黄金の石棺',price:380,th:'egypt'},
  // 🎄 クリスマス
  xms_chair:{e:'🪑',n:'ヒイラギの木椅子',price:200,th:'christmas',fu:1}, xms_table:{e:'🍪',n:'ジンジャークッキーの卓',price:280,th:'christmas',fu:1},
  xms_sofa:{e:'🛋️',n:'赤いベルベットソファ',price:420,th:'christmas',fu:1}, xms_shelf:{e:'🎁',n:'プレゼント棚',price:320,th:'christmas',fu:1},
  xms_rug:{e:'❄️',n:'雪の結晶ラグ',price:240,th:'christmas',fu:1},     xms_lamp:{e:'💡',n:'リースのフロアランプ',price:260,th:'christmas',fu:1},
  xms_plant:{e:'🎄',n:'クリスマスツリー',price:220,th:'christmas',fu:1}, xms_fireplace:{e:'🔥',n:'石造りの暖炉',price:380,th:'christmas'},
  // 🛰️ 宇宙
  spc_chair:{e:'🪑',n:'クルーシート',price:200,th:'space',fu:1},       spc_table:{e:'🍽️',n:'ギャレーテーブル',price:280,th:'space',fu:1},
  spc_sofa:{e:'🛋️',n:'クルーベンチ',price:420,th:'space',fu:1},       spc_shelf:{e:'📦',n:'補給ラック',price:320,th:'space',fu:1},
  spc_rug:{e:'🟨',n:'デッキマット',price:240,th:'space',fu:1},         spc_lamp:{e:'💡',n:'ワークライト',price:260,th:'space',fu:1},
  spc_plant:{e:'🥬',n:'植物栽培装置',price:220,th:'space',fu:1},       spc_console:{e:'🛰️',n:'司令コンソール',price:380,th:'space'},
  // ❄️ 氷の城
  ice_chair:{e:'🪑',n:'氷彫りの椅子',price:200,th:'ice',fu:1},         ice_table:{e:'🧊',n:'氷板のテーブル',price:280,th:'ice',fu:1},
  ice_sofa:{e:'🛋️',n:'氷結のソファ',price:420,th:'ice',fu:1},         ice_shelf:{e:'🗄️',n:'霜の飾り棚',price:320,th:'ice',fu:1},
  ice_rug:{e:'❄️',n:'雪華の毛皮ラグ',price:240,th:'ice',fu:1},         ice_lamp:{e:'🏮',n:'氷晶ランプ',price:260,th:'ice',fu:1},
  ice_plant:{e:'🌲',n:'樹氷の小松',price:220,th:'ice',fu:1},           ice_throne:{e:'👑',n:'氷の玉座',price:380,th:'ice'},
  // 🍄 森のキノコ
  msh_chair:{e:'🪑',n:'ベニテングダケの椅子',price:200,th:'mushroom',fu:1}, msh_table:{e:'🪵',n:'切り株テーブル',price:280,th:'mushroom',fu:1},
  msh_sofa:{e:'🛋️',n:'丸太のソファ',price:420,th:'mushroom',fu:1},    msh_shelf:{e:'🗄️',n:'木のうろ棚',price:320,th:'mushroom',fu:1},
  msh_rug:{e:'🟩',n:'妖精の輪ラグ',price:240,th:'mushroom',fu:1},      msh_lamp:{e:'💡',n:'光るキノコランプ',price:260,th:'mushroom',fu:1},
  msh_plant:{e:'🪴',n:'シダと光るキノコ',price:220,th:'mushroom',fu:1}, msh_bed:{e:'🛏️',n:'キノコのベッド',price:380,th:'mushroom'},
  // ♨️ 温泉
  ons_chair:{e:'🪑',n:'檜の椅子',price:200,th:'onsen',fu:1},           ons_table:{e:'🍶',n:'湯上がりの座卓',price:280,th:'onsen',fu:1},
  ons_sofa:{e:'🛋️',n:'檜の湯上がりベンチ',price:420,th:'onsen',fu:1}, ons_shelf:{e:'🧺',n:'湯桶の棚',price:320,th:'onsen',fu:1},
  ons_rug:{e:'🍁',n:'紅葉の畳マット',price:240,th:'onsen',fu:1},       ons_lamp:{e:'🏮',n:'行灯',price:260,th:'onsen',fu:1},
  ons_plant:{e:'🍁',n:'紅葉の鉢植え',price:220,th:'onsen',fu:1},       ons_rotenburo:{e:'♨️',n:'岩風呂',price:380,th:'onsen'} };
// ショップでプロップをテーマ別に見出し分けする
export const PROP_GROUPS=[['','🧰 汎用'],
  ['japan','⛩️ 日本'],['onsen','♨️ 温泉'],['tokyo','🌃 Tokyo'],['sushi','🍣 回転寿司'],['china','🐉 中華'],
  ['arabia','🕌 アラビア'],['desert','🏜️ 砂漠'],['egypt','🔺 エジプト'],['jungle','🌿 ジャングル'],['undersea','🐚 海底'],
  ['diner','🍔 ダイナー'],['cabin','🌲 森コテージ'],['mushroom','🍄 森のキノコ'],['ice','❄️ 氷の城'],['christmas','🎄 クリスマス'],
  ['fantasy','🧙 ファンタジー'],['dwarf','⛏️ ドワーフ鉱山'],['hell','😈 地獄'],['haunted','👻 幽霊屋敷'],['halloween','🎃 ハロウィン'],
  ['pirate','🏴‍☠️ 海賊船'],['western','🤠 西部開拓'],['dino','🦖 ダイナソー'],['circus','🎪 サーカス'],['carnival','🎭 カーニバル'],
  ['circuit','🏁 サーキット'],['steampunk','⚙️ スチームパンク'],['retrofuture','🛸 レトロ未来'],['scifi','🚀 SF宇宙'],['space','🛰️ 宇宙'],
  ['beehive','🐝 ミツバチの巣']];
export const BG={ auto:{n:'標準（時刻連動）',price:0}, blue:{n:'快晴',price:1800}, sunset:{n:'夕焼け',price:2200}, night:{n:'星空',price:2600}, space:{n:'宇宙',price:4200}, aurora:{n:'オーロラ',price:5200} };
export const FLOOR={ wood:{n:'木材（標準）',price:0}, cool:{n:'クールグレー',price:1000}, crimson:{n:'レッドタイル',price:1200}, forest:{n:'フォレスト',price:1200}, gold:{n:'ゴールド',price:3200} };
// テーマシリーズ: 空テーマ(sky)＋床材(floor)＋絵文字装飾セット(decos) をまとめて購入/適用
export const SERIES={
  arabia:{n:'🕌 アラビア', price:6000, sky:'arabia',   floor:'wood',    decos:[]},
  undersea:{n:'🐚 海底',   price:6000, sky:'undersea', floor:'wood',    decos:[]},
  japan:{n:'⛩️ 日本',      price:6000, sky:'japan',    floor:'wood',    decos:[]},
  china:{n:'🐉 中華',      price:6000, sky:'china',    floor:'wood',    decos:[]},
  diner:{n:'🍔 ダイナー',   price:6000, sky:'diner',    floor:'wood',    decos:[]},
  fantasy:{n:'🧙 ファンタジー', price:6000, sky:'fantasy', floor:'wood', decos:[]},
  scifi:{n:'🚀 SF宇宙',    price:6000, sky:'scifi',    floor:'wood',    decos:[]},
  cabin:{n:'🌲 森コテージ', price:6000, sky:'cabin',    floor:'wood',    decos:[]},
  dino:{n:'🦖 ダイナソー',  price:6000, sky:'dino',     floor:'wood',    decos:[]},
  haunted:{n:'👻 幽霊屋敷',  price:6000, sky:'haunted',  floor:'wood',    decos:[]},
  pirate:{n:'🏴‍☠️ 海賊船',   price:6000, sky:'pirate',   floor:'wood',    decos:[]},
  circuit:{n:'🏁 サーキット', price:6000, sky:'circuit',  floor:'wood',    decos:[]},
  dwarf:{n:'⛏️ ドワーフ鉱山', price:6000, sky:'dwarf',    floor:'wood',    decos:[]},
  hell:{n:'😈 地獄',         price:6000, sky:'hell',     floor:'wood',    decos:[]},
  steampunk:{n:'⚙️ スチパン', price:6000, sky:'steampunk',floor:'wood',    decos:[]},
  retrofuture:{n:'🛸 レトロ未来', price:6000, sky:'retrofuture',floor:'wood', decos:[]},
  tokyo:{n:'🌃 Tokyo',      price:6000, sky:'tokyo',    floor:'wood',    decos:[]},
  halloween:{n:'🎃 ハロウィン', price:6000, sky:'halloween',floor:'wood', decos:[]},
  western:{n:'🤠 西部開拓時代', price:6000, sky:'western',floor:'wood', decos:[]},
  sushi:{n:'🍣 回転寿司', price:6000, sky:'sushi',floor:'wood', decos:[]},
  beehive:{n:'🐝 ミツバチの巣', price:6000, sky:'beehive',floor:'wood', decos:[]},
  circus:{n:'🎪 サーカス', price:6000, sky:'circus',floor:'wood', decos:[]},
  carnival:{n:'🎭 カーニバル', price:6000, sky:'carnival',floor:'wood', decos:[]},
  desert:{n:'🏜️ 砂漠', price:6000, sky:'desert',floor:'wood', decos:[]},
  jungle:{n:'🌴 ジャングル', price:6000, sky:'jungle',floor:'wood', decos:[]},
  egypt:{n:'🔺 古代エジプト', price:6000, sky:'egypt',floor:'wood', decos:[]},
  christmas:{n:'🎄 クリスマス', price:6000, sky:'christmas',floor:'wood', decos:[]},
  space:{n:'🚀 宇宙ステーション', price:6000, sky:'space',floor:'wood', decos:[]},
  ice:{n:'🧊 氷の城', price:6000, sky:'ice',floor:'wood', decos:[]},
  mushroom:{n:'🍄 森のキノコ', price:6000, sky:'mushroom',floor:'wood', decos:[]},
  onsen:{n:'♨️ 和風温泉', price:6000, sky:'onsen',floor:'wood', decos:[]},
};

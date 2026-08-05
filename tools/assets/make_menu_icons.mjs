/* UIのドット絵アイコンを生成する。依存ゼロ（Node標準のzlibだけでPNGを書く）。
     使い方: node tools/assets/make_menu_icons.mjs
     出力  : assets/ui/icons/*.png （すべて 16×16・RGBA）
       ☰メニュー  mypage / recipe / shop / layout / collection / leaderboard
       画面共通    factory / gift / yen / box / trash / chart / agent / sky / sofa
       製造機      mach2〜mach5（マス数=2〜5。ショップの行と編集パレットで使う）

   もとは絵文字（🏠🧾🏪🔧📖🏆）だったが、盤面がドット絵なのに
   メニューだけOSのフォント任せで、環境によって形も色も変わっていた。
   ゲーム画面と同じ 1ドット=1px のドット絵に置き換える。

   置き場所の大きさに合わせたグリッドで描いて、原寸か整数倍だけで出す。
   ドット絵は半端な倍率で縮めると輪郭が濁るので、大きさを変えたいときは表示倍率を
   いじらずグリッドごと描き直すこと（32×32 版を 16px で出すと 1x 画面でドットが
   1つ飛びに間引かれる）。整数倍の拡大だけは image-rendering:pixelated で足りる。
   メニューやダイアログの文字は 12〜16px なので 16×16 を原寸で出す。
   ショップの行だけは枠が 34px あるので、同じ 16×16 を2倍(32px)に拡大して使う。

   1色（--ink）の白シルエット＋「抜き」だけで描く。多色にすると項目ごとの
   色に意味があるように見えてしまうので、絵はシルエットだけで見分けさせる：
     mypage      家（三角屋根）        ← ショップとは屋根の形で見分ける
     recipe      クリップボード        ← 図鑑とは1枚か2枚かで見分ける
     shop        しま模様のひさし
     layout      マス目 + 鉛筆
     collection  開いた本（背あり）
     leaderboard 高さの違う3本の柱（順位）

   抜きどうしは必ず1ドット以上の白で離すこと —— 接すると白が細い橋になって、
   原寸で潰れて別の形に見える（家の扉と窓をくっつけて「脚が2本」に見えたのがこれ）。
   16×16 では 3×5 の数字が入らないので、表彰台の 1・2・3 は柱の高さだけで表す。 */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const W = '#e6fff4';                            // 唯一の色（game/theme.css の --ink）
const OUT = path.join(import.meta.dirname, '..', '..', 'assets', 'ui', 'icons');

/* --- キャンバスと描画プリミティブ。box は x0..x1 / y0..y1 を含む矩形 --- */
const mk = (S) => {
  const cv = Array.from({ length: S }, () => Array(S).fill(null));
  const px = (x, y, c) => { if (x >= 0 && x < S && y >= 0 && y < S) cv[y][x] = c; };
  const box = (x0, y0, x1, y1, c = W) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, c); };
  const cut = (x0, y0, x1, y1) => box(x0, y0, x1, y1, null);
  /* 円。r は半径（ドット）。中心は 0.5 ずれた格子の中間に置けるよう小数で受ける */
  const disc = (cx, cy, r, c = W) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) px(x, y, c);
  };
  return { cv, px, box, cut, disc };
};

/* =========================================================================
   アイコン本体。[グリッドの1辺, 描く関数] で、置き場所に合う大きさを持たせる
   ========================================================================= */
const ICONS = {
  /* 🏠 マイページ — 三角屋根の家。窓は上、扉は下。あいだに白を1ドット残す */
  mypage: [16, () => {
    const { cv, px, box, cut } = mk(16);
    for (let y = 1; y <= 5; y++) box(8 - y, y, 7 + y, y);   // 屋根
    box(0, 6, 15, 6);                                 // 軒先
    box(2, 7, 13, 15);                                // 壁
    cut(4, 9, 5, 10); cut(10, 9, 11, 10);             // 窓
    cut(7, 12, 8, 15);                                // 扉
    px(8, 14, W);                                     // ノブ
    return cv;
  }],

  /* 🧾 製造レシピ — クリップボード。罫線3本で「手順書」に見せる */
  recipe: [16, () => {
    const { cv, box, cut } = mk(16);
    box(6, 0, 9, 2);                                  // クリップ
    box(3, 3, 12, 15);                                // 紙
    cut(6, 3, 9, 3);                                  // クリップと紙の境
    for (const [y, x1] of [[6, 10], [9, 10], [12, 8]]) cut(5, y, x1, y);
    return cv;
  }],

  /* 🏪 ショップ — しま模様のひさし。家と違って屋根が平ら */
  shop: [16, () => {
    const { cv, box, cut } = mk(16);
    box(0, 1, 15, 4);                                 // ひさし
    for (const x of [3, 7, 11]) cut(x, 2, x, 4);      // 縞の割り（上端はつないだまま）
    box(2, 6, 13, 15);                                // 建屋（ひさしとは1ドット空ける）
    cut(4, 8, 7, 11);                                 // ショーウィンドウ
    cut(9, 10, 11, 15);                               // 扉
    return cv;
  }],

  /* 🔧 レイアウト編集 — 左下にマス目、右上へ鉛筆。
     16×16 では重ねる余裕がないので、マス目を 8×8 に抑えて鉛筆と場所を分ける */
  layout: [16, () => {
    const { cv, px, box } = mk(16);
    box(0, 8, 7, 15); box(1, 9, 6, 14, null);         // 外枠（1ドット）
    box(3, 8, 3, 15); box(0, 11, 7, 11);              // 十字の目地
    /* 鉛筆：斜め45°の帯。(1,-1) と (1,1) だけでは x+y の偶奇が固定されて
       市松模様になるので、1ドットずつ真下にも置いて隙間を埋める。
       最後の1歩は中央だけ残して尖らせる（k は帯の断面位置） */
    for (let t = 0; t <= 5; t++) for (let k = t < 5 ? 0 : 1; k <= (t < 5 ? 2 : 1); k++) {
      px(8 + t + k, 12 - t + k, W); px(8 + t + k, 13 - t + k, W);
    }
    return cv;
  }],

  /* 📖 図鑑 — 開いた本。背は谷（抜き）で表し、下だけつないで1冊に見せる */
  collection: [16, () => {
    const { cv, box, cut } = mk(16);
    for (let x = 0; x <= 6; x++) box(x, 4 - Math.round(x * 2 / 6), x, 13);
    for (let x = 9; x <= 15; x++) box(x, 4 - Math.round((15 - x) * 2 / 6), x, 13);
    cut(7, 0, 8, 10);                                 // 背の谷
    box(7, 11, 8, 13);                                // 背の下（2ページをつなぐ）
    for (const y of [6, 9]) { cut(2, y, 5, y); cut(10, y, 13, y); }   // 罫線
    return cv;
  }],

  /* 🏆 リーダーボード — 高さの違う3本の柱。あいだは抜きで割り、底でつなぐ */
  leaderboard: [16, () => {
    const { cv, box } = mk(16);
    for (const [x, top] of [[1, 7], [6, 2], [11, 9]]) box(x, top, x + 3, 12);
    box(0, 13, 15, 15);                               // 台の底
    return cv;
  }],

  /* 🏭 工場 — ダイアログの見出し・工場名・製造タブで使う。
     のこぎり屋根＋煙突。家（mypage）とは屋根の形で見分ける */
  factory: [16, () => {
    const { cv, box, cut } = mk(16);
    for (let x = 0; x <= 15; x++) box(x, 6 + (x % 4), x, 15);   // のこぎり屋根＋建屋
    box(0, 1, 1, 6);                                  // 煙突
    for (const x of [3, 7, 11]) cut(x, 11, x + 1, 12);          // 窓
    return cv;
  }],

  /* 🎁 完成品 — リボンをかけた箱。📦（box）とはリボンと蝶結びで見分ける。
     ふたは切らずに残す（全体を縦に切ると板が3枚並んだように見える） */
  gift: [16, () => {
    const { cv, box, cut } = mk(16);
    box(6, 0, 9, 1);                                  // 結び目
    box(3, 2, 12, 4);                                 // リボンの羽（抜きを入れると目に見える）
    box(1, 5, 14, 7);                                 // ふた（切らずに残す）
    box(2, 8, 13, 15);                                // 本体
    cut(7, 8, 8, 14);                                 // リボンの溝（底まで抜くと脚が2本に見える）
    return cv;
  }],

  /* 💰 お金 — ¥ の字そのもの。売上や価格の数字の隣に出るので、絵ではなく
     文字の形にする。金袋・コイン・札束も試したが、16ドットではどれも塊に
     潰れて「お金」だと読めなかった（丸は歯車、3枚重ねは☰ に見える）。 */
  yen: [16, () => {
    const { cv, box } = mk(16);
    for (let i = 0; i <= 4; i++) { box(2 + i, 1 + i, 3 + i, 1 + i); box(12 - i, 1 + i, 13 - i, 1 + i); }   // 八
    box(7, 6, 8, 15);                                 // 縦棒
    box(3, 8, 12, 9); box(3, 11, 12, 12);             // 横棒2本
    return cv;
  }],

  /* 📦 収納・待機 — 木箱。ふたの線と縦の板で「箱」に見せる */
  box: [16, () => {
    const { cv, box, cut } = mk(16);
    box(1, 4, 14, 15);
    cut(2, 7, 13, 7);                                 // ふたの合わせ目（両端は残してふたに見せる）
    cut(5, 9, 5, 15); cut(10, 9, 10, 15);             // 板の割り
    return cv;
  }],

  /* 🗑 撤去 — ゴミ箱。ふた・取っ手・縦の筋 */
  trash: [16, () => {
    const { cv, box, cut } = mk(16);
    box(6, 0, 9, 1);                                  // 取っ手
    box(2, 2, 13, 3);                                 // ふた
    box(3, 5, 12, 15);                                // 本体
    cut(6, 7, 6, 13); cut(9, 7, 9, 13);               // 筋
    return cv;
  }],

  /* 📊 今日の製造 — 軸のある棒グラフ。リーダーボード（軸なし・台つき）と区別する */
  chart: [16, () => {
    const { cv, box } = mk(16);
    box(0, 1, 1, 15); box(0, 14, 15, 15);             // 軸
    box(4, 9, 6, 13); box(8, 6, 10, 13); box(12, 3, 14, 13);   // 右上がりの棒
    return cv;
  }],

  /* 🧑‍🏭 エージェント — Claude君（工場で働いている本人）。ただの人型にすると
     「誰か」でしかなく、盤面で動いているキャラと結びつかなかった。
     形は game/scene/mascot.mjs の MTOP（頭に山が2つ）・3本脚・作業ポーズの腕を
     16×16 に詰めたもの。あちらは 1ドット=3px で 18ドット幅なので、
     ここでは幅14ドットに縮めて山と谷の位置だけ合わせている。
     マスコットの形を変えたときは mascot.mjs / make_favicon.mjs と一緒に直すこと。 */
  agent: [16, () => {
    const { cv, box, cut } = mk(16);
    // 体の上端。0 が一番高い（山）。中央の 3 が谷 = 頭の2つの山のあいだ
    const TOP = [2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2];
    TOP.forEach((t, i) => box(2 + i, 1 + t, 2 + i, 12));        // 胴（上端が山なり・幅12）
    box(0, 6, 1, 9); box(14, 5, 15, 8);                         // 腕（胴の外へ2ドット出す。左右で高さをずらす）
    box(2, 13, 4, 15); box(6, 13, 8, 15); box(11, 13, 13, 15);  // 3本脚
    cut(4, 5, 5, 6); cut(10, 5, 11, 6);                         // 目
    return cv;
  }],

  /* 🌏 背景 — 窓の外の景色。地球にすると経線・緯線の抜きで的のように見えたので、
     「太陽＋丘」の風景にした（背景＝空と景色を選ぶ機能なので意味も近い） */
  sky: [16, () => {
    const { cv, box, disc } = mk(16);
    disc(4, 3.5, 2.6);                                // 太陽
    for (let d = 0; d <= 3; d++) box(4 - d, 8 + d, 4 + d, 8 + d);            // 手前の丘
    for (let d = 0; d <= 5; d++) box(11 - d, 6 + d, 11 + d, 6 + d);          // 奥の丘
    box(0, 12, 15, 15);                               // 地面
    return cv;
  }],

  /* 🧰 設備・装飾 — ソファ。もとは道具箱にしていたが工具箱にしか見えず、
     「装飾＝部屋に置く家具や置物」が伝わらなかった。
     背クッション2つ＋幅広の胴で「座る家具」に見せる。肘掛けは16ドットでは
     背と座面にくっついて塊に潰れるので入れない。椅子＋テーブルの2点構成も
     試したが、1つあたり7ドットしか取れず脚が線になって読めなかった。 */
  sofa: [16, () => {
    const { cv, box } = mk(16);
    box(2, 2, 7, 5); box(9, 2, 14, 5);                // 背クッション2つ（あいだを1ドット空ける）
    box(0, 6, 15, 11);                                // 胴（座面と肘掛けを兼ねる）
    box(1, 12, 3, 14); box(12, 12, 14, 14);           // 脚
    return cv;
  }],

  /* 2️⃣〜5️⃣ 製造機（2〜5マス）— ホッパー付きの本体に「マス」を抜きで並べる。
     4種の違いはマスの数だけ。数字を描くより、盤面の製造機と同じ
     「素材を入れる口がいくつあるか」で見せたほうが意味と一致する。

     16×16 で描く。編集パレットのマス（62×64）に 32×32 を原寸で置くと
     アイコンだけが大きく浮くので、小さいほうに合わせて描き、
     ショップの行では整数2倍（32px）に拡大して使う。
     マスは1ドット幅・間隔1ドットで中央寄せ。5マスでも左右に2ドットの壁が残る。 */
  ...Object.fromEntries([2, 3, 4, 5].map((n) => [`mach${n}`, [16, () => {
    const { cv, box, cut } = mk(16);
    box(6, 0, 9, 1);                                  // ホッパー（投入口）
    box(1, 2, 14, 11);                                // 本体
    cut(3, 4, 12, 4);                                 // 天板の継ぎ目
    const w = 2 * n - 1, x0 = Math.round((16 - w) / 2);
    for (let i = 0; i < n; i++) cut(x0 + i * 2, 6, x0 + i * 2, 9);            // 素材のマス
    box(2, 12, 5, 14); box(10, 12, 13, 14);           // 脚
    return cv;
  }]])),
};

/* --- PNG を書く（RGBA・フィルタなし。tools/assets/make_favicon.mjs と同じ手順） --- */
const hex = (c) => (c
  ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255]
  : [0, 0, 0, 0]);
const CRC = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (b) => { let c = 0xffffffff; for (const x of b) c = t[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
};
function png(cv, S) {
  const raw = Buffer.alloc((S * 4 + 1) * S);
  let p = 0;
  for (let y = 0; y < S; y++) {
    raw[p++] = 0;                                     // フィルタ種別 0(None)
    for (let x = 0; x < S; x++) { const [r, g, b, a] = hex(cv[y][x]); raw[p++] = r; raw[p++] = g; raw[p++] = b; raw[p++] = a; }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6;                           // 8bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

fs.mkdirSync(OUT, { recursive: true });
for (const [name, [size, draw]] of Object.entries(ICONS)) {
  fs.writeFileSync(path.join(OUT, `${name}.png`), png(draw(), size));
  console.log(`  icons/${name}.png (${size}×${size})`);
}

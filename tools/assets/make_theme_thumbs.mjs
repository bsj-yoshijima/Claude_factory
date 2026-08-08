/* テーマのサムネイルを作る。
     使い方: node tools/assets/make_theme_thumbs.mjs
     入力  : assets/rooms/room-<テーマ>.png （31テーマ）
     出力  : assets/ui/icons/theme-<テーマ>.png （64×64）

   ショップの「設備」タブのテーマ見出し・「シリーズ」の行・編集パレットの背景一覧は
   もともとテーマごとに絵文字（⛩️ 🍣 🕌 …）を当てていた。部屋の絵はすでにあるので、
   絵文字の代わりにその部屋を小さく写す。31種を描き起こす必要がなく、
   「買うと部屋がこうなる」がそのまま伝わる。

   ドット絵アイコン（tools/assets/make_menu_icons.mjs）とは性質が違うので分けている：
   あちらは 1ドット=1px で描いた原寸のアイコン、こちらは部屋の写しを縮めたもの。
   表示側も pixelated ではなく通常の補間で出す（ドット単位の形を見せるものではない）。

   assets/rooms/*.png は拡張子が png だが中身は JPEG なので、この repo の
   依存ゼロPNG書き出し（make_favicon.mjs 系）では読めない。
   macOS 標準の sips に任せている（追加インストール不要。macOS 以外では動かない）。

   切り出し位置は全テーマ共通。部屋の絵はすべて 1376×768 の同じ構図なので、
   奥の壁と床が入る 480×480（左450・上30）を square に切って縮める。
   壁ぎわを外すと床だけになってテーマの見分けがつかなくなる。 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const SRC = path.join(ROOT, 'assets', 'rooms');
const OUT = path.join(ROOT, 'assets', 'ui', 'icons');
const CROP = { size: 480, top: 30, left: 450 };
const THUMB = 64;

if (os.platform() !== 'darwin') {
  console.error('sips が無い環境では動きません（macOS 前提）。');
  process.exit(1);
}

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'theme-thumbs-'));
// room-factory.png はデフォルト部屋。ショップでも編集パレットでも 'factory' というキーは
// 存在せず（デフォルトは 'auto'）、作っても誰も参照しないので除く。
// 以前は factory-room.png という名前でこの正規表現から自然に外れていた。
const rooms = fs.readdirSync(SRC)
  .filter((f) => /^room-.+\.png$/.test(f) && f !== 'room-factory.png').sort();

for (const file of rooms) {
  const key = file.slice(5, -4);
  const cut = path.join(tmp, `${key}.png`);
  // crop と resize は1回の sips に混ぜると適用順が狂うので2段に分ける
  execFileSync('sips', ['-s', 'format', 'png',
    '-c', String(CROP.size), String(CROP.size),
    '--cropOffset', String(CROP.top), String(CROP.left),
    path.join(SRC, file), '--out', cut], { stdio: 'ignore' });
  const out = path.join(OUT, `theme-${key}.png`);
  execFileSync('sips', ['-z', String(THUMB), String(THUMB), cut, '--out', out], { stdio: 'ignore' });
  console.log(`  icons/theme-${key}.png (${THUMB}×${THUMB}, ${(fs.statSync(out).size / 1024).toFixed(1)}KB)`);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`  ${rooms.length} テーマ`);

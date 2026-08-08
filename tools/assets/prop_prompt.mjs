#!/usr/bin/env node
/* 装飾品の発注プロンプトを組み立てる。31テーマぶんを手で書かないため。

     node tools/assets/prop_prompt.mjs japan              # 8スロット分を表示
     node tools/assets/prop_prompt.mjs japan chair        # 1スロットだけ
     node tools/assets/prop_prompt.mjs japan --out /tmp   # ファイルに書き出す
     node tools/assets/prop_prompt.mjs --list             # テーマ一覧

  規格と考え方は docs/prop-sprite-prompt.md（人間が読む方）。ここは同じ内容の組み立て器で、
  文面を直すときは両方を合わせる。テーマの Palette は部屋(docs/stitch-prompts.md)と同値。

  全テーマ共通で作るのは chair / shelf / lamp / table / sofa / rug の6種。plant と名物は
  物ごとに特徴も大きさも違うので都度、単体の殻で発注する。
  --sheet が6種1枚版（1テーマ1回）。セルはシアンの枠で仕切ってあり、焼き込みは
  その枠を見つけて切る（殻の座標から推測すると別の物を切り出す。実際に失敗した）。
*/
import fs from 'node:fs';
import path from 'node:path';

/* スロット。size は殻の発注サイズ、shell は添付する殻のファイル名。
   top は「必ず見えていなければならない上面」。正面図で描かれると成立しないものを具体名で挙げる。 */
const SLOTS = {
  chair: { top:'the top of the seat, the top of every leg, the top of the backrest',
    what:`WHAT THIS IS: one CHAIR for one person. The shell shows four legs, a seat plate,
and a backrest on the far side. A theme may shape it differently (a stool, a bench, a zaisu)
as long as it still reads as one seat and its feet stay on the diamond.` },
  shelf: { top:'the top of the cabinet, the top edge of every shelf board',
    what:`WHAT THIS IS: a free standing SHELF or cabinet. The shell shows a shallow upright box with
TWO dark openings on its front face. Those dark zones mark WHERE the openings go. ONLY THE
SHAPE IS YOURS: open shelves, sliding doors, niches, whatever the theme would use. Keep them
dark and mostly empty. The box stays shallow: its footprint is the diamond, not deeper.` },
  lamp: { top:'the top of the base, the top of the shade',
    what:`WHAT THIS IS: a FLOOR LAMP. The shell shows a small base, a thin upright stem and a shade on
top. A theme may shape it differently (a paper lantern, a candle stand, a torch) as long as
the base stays on the diamond and the light is at the top. The light may glow, but paint the glow ON the shade, never as a haze
out in the magenta.` },
  plant: { top:'the rim of the pot, the top of the foliage',
    what:`WHAT THIS IS: a POTTED PLANT. The shell shows a pot, a short stem and a mass of foliage above
it. The pot sits on the diamond and the foliage may overhang it. Keep the pot clearly visible
below the foliage.` },
  table: { top:'the top of the table, the top of every leg',
    what:`WHAT THIS IS: a low TABLE, twice as long as it is deep, with four legs and a top plate. The
long axis runs down-and-left, and the four feet stay on the diamond. It is LOW, about half
the height of a chair. Do not turn it into a desk or a counter.` },
  sofa: { top:'the top of the seat cushions, the top of the backrest, the top of both armrests',
    what:`WHAT THIS IS: a two seat SOFA. The shell shows a seat, a backrest running along the LONG
side, and an armrest at each END of the long axis. A theme may shape it differently, but it seats two, the
backrest is lower than a chair's, and the feet stay on the diamond.` },
  rug: { top:'the whole rug is the floor plane itself, seen from above',
    what:`WHAT THIS IS: a flat RUG lying on the floor. It has NO height and NO thickness: it is
the floor plane itself, seen at the same isometric angle. Paint the weave, the border and the pattern. NO
fringe lifting off the ground, NO folds, NO objects on top of it.` },
  // 名物は形が決まらないので枠と接地面だけの殻を使う。幅の要る物は 1x2 を選ぶ
};

/* テーマ。palette は部屋のプロンプトと同値（色が食い違わないようにする）。
   landmark は各テーマの一点物（catalog.mjs の PROP_NAMES 8番目）。 */
const THEMES = {
  arabia:{pre:'arb', name:'an Arabian palace room', landmark:'a HOOKAH on a low stand',
    mat:'engraved brass, mother of pearl inlay, tasselled carpet weave, painted tilework',
    pal:'royal purple, indigo, warm gold, brass, cream.'},
  beehive:{pre:'bee', name:'the inside of a beehive', landmark:'a HONEY FOUNTAIN',
    mat:'beeswax, honeycomb cells, polished amber, gold fittings',
    pal:'honey gold, deep amber, pale beeswax cream, warm brown, small black-and-yellow accents.'},
  cabin:{pre:'cab', name:'a forest log cabin', landmark:'a STONE HEARTH',
    mat:'pine logs, deer hide, red and black check wool, wrought iron',
    pal:'honey pine, warm brown, cream chinking, forest green accents, brass.'},
  circuit:{pre:'cct', name:'a racing circuit pit garage', landmark:'a WINNERS PODIUM',
    mat:'moulded carbon fibre, painted steel panels, rubber, racing decals',
    pal:'racing red, white, gunmetal grey, black rubber, small yellow line accents.'},
  china:{pre:'chn', name:'a Chinese palace room', landmark:'a bronze INCENSE BURNER',
    mat:'rosewood, vermilion lacquer, jade inlay, gilded edging',
    pal:'crimson red, rich gold, jade green, dark rosewood, cream.'},
  circus:{pre:'cir', name:'a circus big top', landmark:'a CAROUSEL',
    mat:'striped canvas, painted wood, gold braid and rope',
    pal:'circus red, cream white, rich gold, deep navy shadows, small teal accents.'},
  carnival:{pre:'crn', name:'a masked carnival ballroom', landmark:'a MASK PEDESTAL',
    mat:'baroque gilt carving, velvet, feathers, beadwork',
    pal:'royal purple, rich gold, emerald green, cream, small black-and-white harlequin accents.'},
  diner:{pre:'din', name:'a 1950s American diner', landmark:'a JUKEBOX',
    mat:'chrome tubing, red vinyl upholstery, enamel, checkered trim',
    pal:'cherry red, mint green, cream, polished chrome, charcoal, neon pink and blue accents.'},
  dino:{pre:'dno', name:'a prehistoric dinosaur camp', landmark:'a mounted FOSSIL SKELETON',
    mat:'bone, rough stone, tanned hide, amber',
    pal:'sandy tan, warm brown, bone cream, glowing amber orange, moss green.'},
  desert:{pre:'dst', name:'a desert caravan tent', landmark:'a horned SKULL on a stand',
    mat:'sandstone, kilim weave, terracotta, sun dried timber',
    pal:'ochre, rust orange, sun-bleached cream, terracotta, small faded turquoise accents.'},
  dwarf:{pre:'dwf', name:'a dwarven mine hall', landmark:'a FORGE with an anvil',
    mat:'granite, wrought iron, heavy studs, raw gemstones',
    pal:'cool grey granite, warm timber brown, iron black, glowing lava orange, gem blue, violet and gold.'},
  egypt:{pre:'egy', name:'an Egyptian tomb chamber', landmark:'a SARCOPHAGUS',
    mat:'sandstone, lapis inlay, gold leaf, papyrus',
    pal:'sandstone gold, lapis blue, turquoise, deep red ochre, black, bright gold.'},
  fantasy:{pre:'fan', name:'a wizard tower room', landmark:'a bubbling CAULDRON',
    mat:'old stone, carved oak, brass, crystal',
    pal:'cool grey stone, deep violet, glowing cyan, warm candle gold, teal.'},
  halloween:{pre:'hal', name:'a Halloween cottage', landmark:'a giant carved PUMPKIN',
    mat:'weathered planks, black iron, pumpkin rind, cobweb',
    pal:'pumpkin orange, deep purple, black, bone cream, small toxic-green accents.'},
  hell:{pre:'hel', name:'an infernal hall', landmark:'a CAULDRON over a lava vent',
    mat:'obsidian, scorched iron, lava cracks, bone',
    pal:'black basalt, charcoal, glowing lava orange, blood red, bone grey.'},
  haunted:{pre:'hnt', name:'a haunted mansion room', landmark:'a GRANDFATHER CLOCK',
    mat:'faded velvet, blackened timber, clouded mirror glass, dust',
    pal:'faded aubergine purple, dusty rose, tarnished gold, blackened timber, mould green.'},
  ice:{pre:'ice', name:'an ice palace hall', landmark:'an ice THRONE',
    mat:'clear ice, frost, polished silver, blue crystal',
    pal:'pale ice blue, white, deep glacier teal, silver, glowing cyan.'},
  jungle:{pre:'jgl', name:'a jungle temple', landmark:'a stone IDOL',
    mat:'mossy stone, vines, bamboo, carved glyphs',
    pal:'mossy green, weathered limestone grey, deep jungle green, emerald, warm ochre sunlight.'},
  japan:{pre:'jpn', name:'a traditional Japanese room', landmark:'a folding screen (a BYOBU)',
    mat:'hinoki cypress joinery, pale straw tatami, washi paper panels, dark walnut, black lacquer, indigo dyed cloth, small brass fittings',
    pal:'pale straw green, warm cream plaster, dark walnut, indigo accents, sakura pink.'},
  mushroom:{pre:'msh', name:'a forest mushroom house', landmark:'a mushroom BED',
    mat:'mushroom cap flesh, honey coloured wood, moss, glowing spores',
    pal:'cream mushroom flesh, warm honey wood, moss green, glowing teal and blue, soft coral pink accents.'},
  onsen:{pre:'ons', name:'a Japanese hot spring bath house', landmark:'an open air bath (a ROTENBURO)',
    mat:'wet stone, hinoki cypress, indigo dyed cloth, bamboo',
    pal:'wet charcoal stone, pale hinoki cream, deep indigo, autumn maple red and orange, soft steam white.'},
  pirate:{pre:'pir', name:'a pirate ship cabin', landmark:'a TREASURE CHEST',
    mat:'tarred oak, hemp rope, brass, scuffed leather',
    pal:'dark tarred oak, weathered timber, brass, deep red, sea blue-green, bone white.'},
  retrofuture:{pre:'rft', name:'a retro futurist submarine salon', landmark:'a pipe ORGAN',
    mat:'polished brass, walnut, rivets, round glass',
    pal:'burnished brass, copper, dark walnut, deep teal water light, ivory cream, amber lamplight.'},
  scifi:{pre:'sci', name:'a science fiction ship interior', landmark:'a holographic STAR MAP',
    mat:'brushed steel, white resin, glowing panels',
    pal:'dark blue-grey, brushed steel, glowing cyan, hot magenta, deep space violet.'},
  undersea:{pre:'sea', name:'an undersea grotto', landmark:'a spilling TREASURE HOARD',
    mat:'coral, shells, pearl, driftwood, seaweed',
    pal:'deep teal, aqua, pale sand, coral pink and orange, seafoam green, pearl white.'},
  space:{pre:'spc', name:'an orbital space station', landmark:'a CONTROL CONSOLE',
    mat:'metal panels, grating, cyan seams, moulded resin',
    pal:'gunmetal grey, steel blue, glowing cyan, off-white, small amber and red accents.'},
  steampunk:{pre:'stm', name:'a steampunk workshop', landmark:'a brass diving HELMET on a stand',
    mat:'mahogany, polished brass, copper piping, iron rivets',
    pal:'dark mahogany, polished brass, copper, iron black, sepia amber, small electric blue.'},
  sushi:{pre:'sus', name:'a sushi restaurant', landmark:'a NOREN curtain on a frame',
    mat:'pale hinoki, indigo dyed cloth, black bamboo, glazed ceramic',
    pal:'pale hinoki cream, indigo blue, warm lantern red, black timber, fresh bamboo green.'},
  tokyo:{pre:'tky', name:'a neon Tokyo back street room', landmark:'a VENDING MACHINE',
    mat:'black metal, acrylic, neon tubing, concrete',
    pal:'near-black charcoal, hot magenta, electric cyan, lantern red, wet asphalt grey-violet.'},
  western:{pre:'wes', name:'a wild west saloon', landmark:'an upright PIANO',
    mat:'weathered pine, studded leather, cast iron, brass',
    pal:'weathered grey-brown pine, warm tan, rust red, brass, dusty gold, small deep-green accents.'},
  christmas:{pre:'xms', name:'a Christmas living room', landmark:'a FIREPLACE with stockings',
    mat:'pine timber, red ribbon, gold trim, snow',
    pal:'deep pine green, warm red, cream, honey timber, gold, snow white.'},
};

/* 単体スロット版(chair だけ・sofa だけ…)は廃止した。専用の殻を8枚保守する必要があり、
   7点シートに統合した時点で殻ごと消したため、参照先が無い prompt を吐いていた。
   いま作れるのは --sheet(共通7種) と --custom(名物1体) の2つ。 */

/* シート版。8体を1枚に並べた殻(docs/prop-shell-sheet7-1519x1127.png)に対して発注する。
   1体版と同じ強さのカメラ規則を、8体すべてに効かせるのが要点。 */
/* 全テーマ共通で作るのはこの7種。名物だけは物ごとに特徴も大きさも違うので都度単体で。 */
const SHEET_ORDER = ['chair','shelf','lamp','plant','table','sofa','rug'];
const SHEET_LABEL = { chair:'a CHAIR', shelf:'a SHELF', lamp:'a FLOOR LAMP', plant:'a POTTED PLANT',
  table:'a low TABLE', sofa:'a two seat SOFA', rug:'a flat RUG' };

const buildSheet = (themeKey) => {
  const t = THEMES[themeKey];
  if(!t) throw new Error(`未知のテーマ: ${themeKey}`);
  // 名物の文言はそのまま使う(大文字化しない)。カンマを含めると並びの列挙が壊れるので
  // THEMES 側の landmark にはカンマを入れない
  const label = (k) => k === 'landmark' ? t.landmark : SHEET_LABEL[k];
  const tops = SHEET_ORDER.map((k,i) => `${i+1} ${label(k)}: ${SLOTS[k].top}.`).join('\n');
  const whats = SHEET_ORDER.map((k,i) => {
    const w = SLOTS[k].what || `WHAT THIS IS: ${t.landmark}, the signature object of this theme. Its cell gives you only the
floor tile and the empty space above it, so the shape is yours.`;
    return `${i+1} ${w.replace(/^WHAT THIS IS: /,'')}`;
  }).join('\n');
  return `REPAINT THIS EXACT SHEET. The image you are editing is a master shell for SEVEN objects.
Each object sits inside its own CYAN RECTANGLE. Paint your theme directly on top of it, like
colouring in a line drawing.

THE DRAWINGS IN THE SHELL ARE PLACEHOLDERS, NOT THE FINAL DESIGN. They show you the size and
the posture. You may change the design to suit the theme: a stool instead of a backed chair,
a paper lantern instead of a shaded lamp, a chest of drawers instead of open shelves.
What you may NOT change is the FOOTPRINT: how much floor the object covers. If the footprint
grows, the object will not fit its tile on the game board.
Output 1519x1127.

THE CYAN RECTANGLES ARE THE FRAME OF THE JOB. There are seven of them and they never move.
- Repaint the object INSIDE each rectangle. One object per rectangle. Never move an object to
  another rectangle, never swap two of them, never leave one empty, never add an eighth.
- NOTHING crosses a cyan line. If a design does not fit, make it smaller, not wider.
- Each object STANDS ON THE BOTTOM EDGE of its own rectangle: its lowest point TOUCHES that
  line. It is CENTRED left to right in its rectangle.
- DO NOT CENTRE AN OBJECT VERTICALLY and DO NOT FLOAT IT. There must be NO magenta gap between
  the lowest point of an object and the bottom line of its rectangle. Empty space belongs
  ABOVE the object, never below it.
- DO NOT REPAINT THE CYAN LINES. Leave them exactly the cyan they already are (#00E5FF).
  They are registration marks that a script uses to cut the sheet apart, and it finds them by
  that exact colour. Never use that cyan anywhere else in the image.
- The magenta OUTSIDE the rectangles stays completely empty.
- Inside each rectangle there is a cyan DIAMOND on the floor. THAT DIAMOND IS THE RULE:
  the object stands on it and its footprint matches it. Not wider, not deeper. The object may
  cover part of it, that is fine, but its feet must land on that diamond and nowhere else.
  It is the same registration cyan: do not repaint it, do not shade it, do not extend it.
  EACH DIAMOND KEEPS ITS EXACT SIZE, SHAPE AND POSITION. Do not enlarge it, do not stretch it,
  do not redraw it wider than it already is. An object standing at the BACK of its diamond,
  with floor showing in front of it, is WRONG: it will hover above its tile in the game.

THE CAMERA IS FIXED AND IT IS NOT A FRONT VIEW. This applies to all seven objects.
These are game objects seen from the same overhead isometric camera as the room they will
stand in. They are NOT catalogue illustrations, NOT product shots, NOT side views, NOT
elevations.
- True 2:1 isometric: every horizontal edge on the ground travels 2 pixels across for exactly
  1 pixel down.
- Exactly TWO vertical faces of any box are visible: one facing lower-left, one facing
  lower-right. Never one flat face facing the viewer.

YOU MUST SEE THE TOP FACES. For each object, these faces are visible:
${tops}
If any face of any object is parallel to the image plane, that drawing is wrong.

THE SEVEN OBJECTS, in the order they appear on the sheet:
top row, left to right:     ${SHEET_ORDER.slice(0,4).map(label).join(", ")}
bottom row, left to right:  ${SHEET_ORDER.slice(4).map(label).join(", ")}

${whats}

BACKGROUND: solid pure MAGENTA (#FF00FF) everywhere around every object, exactly as in the
sheet. The magenta is cut away later, so nothing may touch it except the objects themselves.
NO floor, NO ground plane, NO cast shadow, NO border, NO frame of your own, NO grid, NO text.

STYLE: VERY chunky lo-fi 8-bit Famicom pixel art, extreme high contrast, thick clean black
outlines, flat colors, no gradients, no anti-aliasing. Each one is shown about 50 pixels tall
in the game, so keep them BOLD: few large shapes, strong silhouette. No fine filigree, no thin
hatching.

THE SECOND IMAGE IS THE ROOM these objects will live in. Take its taste from it:
the same palette, the same materials, the same amount of detail, the same light and the same
era. The furniture must look like it was built for that room and photographed in it.
Do NOT copy any object out of the room image, and do NOT redraw the room: only the seven cyan
rectangles get painted. If the room and the words below disagree, follow the room.

THEME: ${t.name}. All seven are one matching set, same workshop, same hand.
Materials: ${t.mat}.
Palette: ${t.pal}
Keep the theme in the MATERIAL and the ORNAMENT, not in the shape.
`;
};;

/* テーマ名 → 部屋の背景ファイル名。ほぼ同名だが undersea/retrofuture など一部だけ違う */
const ROOM = { arabia:'arabia', beehive:'beehive', cabin:'cabin', circuit:'circuit', china:'china',
  circus:'circus', carnival:'carnival', diner:'diner', dino:'dino', desert:'desert', dwarf:'dwarf',
  egypt:'egypt', fantasy:'fantasy', halloween:'halloween', hell:'hell', haunted:'haunted', ice:'ice',
  jungle:'jungle', japan:'japan', mushroom:'mushroom', onsen:'onsen', pirate:'pirate',
  retrofuture:'retrofuture', scifi:'scifi', undersea:'undersea', space:'space', steampunk:'steampunk',
  sushi:'sushi', tokyo:'tokyo', western:'western', christmas:'christmas' };


/* カスタム装飾品(名物・一点物)の殻。形が決まっていないので殻にはダミーの箱が立っている。
   1枠1体で、${OBJECT} にその物の説明を入れて発注する。
   1体だけでもシアンの枠は必ず要る。一度「キャンバスの縁が枠」として省いたら、生成物が
   384x533 の依頼に対して 848x1264(縦横比が7%違う)で返り、大きさの基準が絵の中に
   一つも残らなかった。縁は絵ではないので生成側は保てない。枠は描かれた線なので残る。 */
/* 生成側が返すキャンバスは 1200x896 / 1024x1024 / 896x1200 の3種類しかない(実測)。
   頼んだ寸法は無視され、いちばん近い比に丸めて描き直される。2x2 の殻は比が 0.903 と
   中途半端で、1.000 へ丸められた拍子に高さが1割減り、菱形が枠に対して8%太った。
   殻のキャンバスをこの3つの比に合わせてある。広げるのは横だけで、枠はキャンバスの縁に引く。
   枠が足元の菱形より広くなるが、その比は殻のJSONに記録されるので縮尺は狂わない。 */
const CUSTOM_SHELL = {
  '1x1': { file:'prop-shell-custom-1x1-372x499.png', size:'372x499' },
  '1x2': { file:'prop-shell-custom-1x2-423x567.png', size:'423x567' },
  '2x2': { file:'prop-shell-custom-2x2-617x617.png', size:'617x617' },
};
const buildCustom = (themeKey, shape, object) => {
  const t = THEMES[themeKey], sh = CUSTOM_SHELL[shape];
  if(!t) throw new Error(`未知のテーマ: ${themeKey}`);
  if(!sh) throw new Error(`形は 1x1 / 1x2 / 2x2 のどれか: ${shape}`);
  const what = object || t.landmark;
  return `REPAINT THIS EXACT SHELL. You are editing a master shell for ONE object. Paint your theme
directly on top of it, like colouring in a line drawing. Output ${sh.size}.

THE CYAN RECTANGLE IS THE FRAME OF THE JOB. It never moves and it never changes shape.
- Repaint the object INSIDE the rectangle. NOTHING crosses a cyan line. If a design does not
  fit, make it smaller, not wider.
- The object STANDS ON THE BOTTOM LINE of the rectangle: its lowest point TOUCHES that line,
  and the object is CENTRED left to right.
- DO NOT CENTRE THE OBJECT VERTICALLY and DO NOT FLOAT IT. There must be NO magenta gap
  between the lowest point of the object and the bottom line. Empty space belongs ABOVE the
  object, never below it. Follow the placeholder: its lowest corner touches the line.
- DO NOT REPAINT THE CYAN LINES, and DO NOT REPAINT THE CYAN DIAMOND on the floor. Leave them
  exactly the cyan they already are (#00E5FF). They are registration marks that a script uses
  to cut the object out, and it finds them by that exact colour. It works out the scale from
  the WIDTH of the rectangle, so THE RECTANGLE MUST KEEP ITS PROPORTIONS: same width against
  height as in the shell. Never use that cyan anywhere else in the image.
- THE DIAMOND KEEPS ITS EXACT SIZE, SHAPE AND POSITION. Do not enlarge it, do not stretch it,
  do not redraw it wider than it already is. Its front corner already touches the bottom line;
  that corner is where the object's lowest point goes.
- The magenta OUTSIDE the rectangle stays completely empty.

THE CAMERA IS FIXED AND IT IS NOT A FRONT VIEW.
This is a game object seen from the same overhead isometric camera as the room it will stand
in. It is NOT a catalogue illustration, NOT a product shot, NOT a side view, NOT an elevation.
- True 2:1 isometric: every horizontal edge on the ground travels 2 pixels across for exactly
  1 pixel down. Measure it against the cyan diamond in the shell.
- Exactly TWO vertical faces of any box are visible: one facing lower-left, one facing
  lower-right. Never one flat face facing the viewer.
- You MUST SEE THE TOP FACES: the top of its base and the top of its tallest part.
- The cyan diamond is the floor tile. The object's footprint matches it and its lowest point
  sits on the diamond's FRONT corner. An object that stands at the BACK of the diamond, with
  the floor showing in front of it, is WRONG: it will hover above its tile in the game.

WHAT THIS IS: ${what}.
The plain box in the shell is only a placeholder for the SIZE and the POSITION. Replace it
with the real object, shaped however the theme wants. What you may NOT change is the
FOOTPRINT: the object stands on the cyan diamond and covers no more floor than it.
If the footprint grows, the object will not fit its tile on the game board.

BACKGROUND: solid pure MAGENTA (#FF00FF) everywhere around the object, exactly as in the
shell. The magenta is cut away later, so nothing may touch it except the object itself.
NO floor, NO ground plane, NO cast shadow, NO border, NO frame of your own, NO grid, NO text.

STYLE: VERY chunky lo-fi 8-bit Famicom pixel art, extreme high contrast, thick clean black
outlines, flat colors, no gradients, no anti-aliasing. It is shown about 50 pixels tall in the
game, so keep it BOLD: few large shapes, strong silhouette. No fine filigree, no thin hatching.

THEME: ${t.name}.
Materials: ${t.mat}.
Palette: ${t.pal}
Keep the theme in the MATERIAL and the ORNAMENT, not in the shape.
`;
};

const args = process.argv.slice(2);
if(args.includes('--list')){
  console.log(Object.entries(THEMES).map(([k,v]) => `${v.pre}  ${k.padEnd(12)} ${v.landmark}`).join('\n'));
  process.exit(0);
}
const theme = args[0];
if(!theme){ console.log('使い方: node tools/assets/prop_prompt.mjs <theme> [slot] [--out DIR]'); process.exit(1); }
const outI = args.indexOf('--out');
const outDir = outI >= 0 ? args[outI+1] : null;
/* 部屋の画像をテーマの参照として2枚目に添えると、カメラが崩れて正面図になり、
   シアンの枠まで描き替えられた(2026-08 の japan で実測)。添付が2枚あると
   『REPAINT THIS EXACT SHEET』の this が曖昧になるためと思われる。
   既定は添付なし。試したいときだけ --room を付ける。 */
const noRoom = !args.includes('--room');

const ci = args.indexOf('--custom');
if(ci >= 0){
  const shape = args[ci+1];
  const oi2 = args.indexOf('--object');
  const text = buildCustom(theme, shape, oi2>=0 ? args[oi2+1] : null);
  const head = `# 添付する殻: docs/${CUSTOM_SHELL[shape].file}\n# 出力サイズ: ${CUSTOM_SHELL[shape].size}\n\n`;
  if(outDir){ const p2=path.join(outDir, `${theme}-custom-${shape}.txt`); fs.writeFileSync(p2, head+text); console.log(p2); }
  else console.log(text);
  process.exit(0);
}
if(args.includes('--sheet')){                       // 8体1枚版
  let text = buildSheet(theme);
  if(noRoom){
    text = text.replace(/THE SECOND IMAGE IS THE ROOM[\s\S]*?follow the room\.\n\n/, '');
  } else {
    /* 添付が2枚あると『REPAINT THIS EXACT SHEET』の this が曖昧になり、
       部屋の方に引っ張られてカメラが崩れた。どちらを編集するのかを冒頭で確定させる。 */
    text = text.replace('REPAINT THIS EXACT SHEET. The image you are editing is a master shell for SEVEN objects.',
      `TWO IMAGES ARE ATTACHED AND THEY HAVE DIFFERENT JOBS.
THE FIRST IMAGE is the one you edit. It is a master shell for SEVEN objects.
THE SECOND IMAGE is a room, for reference only. NEVER edit it. NEVER copy its layout, its
composition or any object out of it. NEVER draw a room, a floor, a wall or a window.
Your output is the FIRST image repainted: the same size, the same seven cyan rectangles,
in the same places.

REPAINT THE FIRST IMAGE.`);
  }
  const head = noRoom
    ? `# 添付する殻: docs/prop-shell-sheet7-1519x1127.png\n# 出力サイズ: 1519x1127\n# 部屋の画像は添付しない(添えるとカメラが崩れる。--room で付けられるが非推奨)\n\n`
    : `# 添付1枚目(塗り替える殻): docs/prop-shell-sheet7-1519x1127.png\n# 添付2枚目(テーマの参照): assets/rooms/room-${ROOM[theme]||theme}.png\n# 出力サイズ: 1519x1127\n\n`;
  /* --room 版は別名で出す。同じ名前に書いていたので、再生成のループを回すと
     標準版が部屋参照版で上書きされていた(実際に踏んだ)。 */
  if(outDir){ const f = path.join(outDir, `${theme}-sheet${noRoom?'':'-room'}.txt`); fs.writeFileSync(f, head+text); console.log(f); }
  else console.log(text);
  process.exit(0);
}
console.log(`使い方:
  node tools/assets/prop_prompt.mjs <theme> --sheet             共通7種を1枚で発注
  node tools/assets/prop_prompt.mjs <theme> --custom 1x1|1x2|2x2  名物を1体で発注
  node tools/assets/prop_prompt.mjs --list                      テーマ一覧
生成済みの本文は docs/prop-prompts/ にある。`);
process.exit(1);

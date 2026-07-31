# Stitch 生成プロンプト定義

Stitch(project `10683244945413223519`)で **部屋背景** と **オブジェクト(小物)** を生成するときの
テンプレート集約ファイル。**テーマ固有の部分だけを差し替え**れば、サイズ・パース・床の空き方が
揃った素材が安定して出る。成功実績のあるテンプレをここに固定しておく。

- 生成後は `=s0` を付けた downloadUrl で原寸(1376×768)取得 → `assets/room-<key>.png`
- 新規テーマは main.js の `preload`/`ROOM_TEX`、factory-phaser.html の `SERIES`/`ROOM_THEMES`/`BG_META` の**計5箇所**に登録
- オブジェクトはマゼンタ(#FF00FF)背景でクロマキー抜き → `assets/prop_<key>_*.png`

---

## 1. 部屋背景テンプレート（room-<key>.png）

`{{THEME_BLOCK}}` だけをテーマごとに差し替える。それ以外は固定。

```
Wide landscape (1376x768) isometric pixel-art room, lo-fi 8-bit Famicom, chunky pixels,
HIGH DETAIL dense wall decoration.
SIZING: SAME size and footprint as the Arabian/Chinese palace rooms, NOT bigger;
leave dark void margins in all four corners around the central diamond room.
Diamond floor corners: FRONT bottom-center, LEFT far-left, RIGHT far-right, BACK upper-center.
True 2:1 isometric, no distortion.

FLOOR: completely clear and EMPTY — {{FLOOR_MATERIAL}} laid diagonally to match the iso grid,
with only a faint flat {{FLOOR_MOTIF}} inlay (NO furniture, NO objects on the floor).

THEME: {{THEME_BLOCK}}

IMPORTANT: no characters, no people, no floor objects, no text, no UI.
Empty clear floor, same size as reference rooms, dark void margins in corners.
```

### THEME_BLOCK の書式（テーマごと）

`LEFT WALL:`（窓の外の景色）/ `WALLS:`（壁の素材）/ `WALL-MOUNTED DECOR ONLY:`（壁掛けの小物を密に）
/ `Lighting:` / `Palette:` の5行で構成する。**装飾はすべて壁掛け**にし、床には置かない。

### 成功済みテーマの差し替え値（key → FLOOR / THEME概要）

| key | FLOOR_MATERIAL / MOTIF | 窓の外 | 壁・装飾の要点 |
|---|---|---|---|
| steampunk | 濃マホガニー寄木 / 真鍮歯車象嵌 | セピア夕暮れ・煙突・飛行船 | 連動歯車群・大型オーラリー・圧力計・蒸気配管・テスラコイル・コグ時計 |
| retrofuture | 石床 / コンパス紋 | 火山湖・潜水艦の丸窓 | 真鍮リベット壁・パイプオルガン(ノーチラス/ミステリアスアイランド) |
| western | 風化パイン板 / ロープ＆星 | 黄金の夕暮れの森の川・外輪蒸気船 | 丸太＆石壁・石の暖炉・鹿角・WANTED・バンジョー・ワゴンホイール・樽 |
| sushi | 桧板 / 青海波 | 晴れた日本の街・青空・電柱 | 暖簾・メニュー札・だるま・招き猫・提灯・魚拓・お茶ディスペンサー・竹 |
| beehive | ハニカム蝋面 / 六角タイル | 夏の花畑・デイジー・青空・飛ぶ蜂 | 六角セル壁・滴る蜂蜜・蜜蝋キャップ・休む蜂・蜜蝋キャンドル・光る蜜セル |
| circus | 赤い木くず床 / 放射状の星 | 観覧車・豆電球の夕暮れ広場 | 赤白金ストライプ・バンティング・ポスター・金の星・空中ブランコと輪・縞カーテン |
| carnival | 磨いた舞踏会床 / ハーレクイン菱形 | 花火とパレードの夜 | 紫金バロック壁・羽根仮面・ビーズ・道化帽・フルール・ド・リス・ミラー・羽根ボア・燭台 |
| desert | 焼けた砂＋砂岩スラブ / 風紋＆小石 | 砂丘とヤシのオアシス・キャラバン・夕焼け | 地層の砂岩壁・キリム・壁龕の壺・角付き頭骨・パンパス・サボテン・ランタン・ロープ・ペトログリフ |
| jungle | 苔むした割れ石スラブ / 蔦と葉の彫り | 滝と密林・木漏れ日 | マヤ風グリフの石壁・彫像の顔・太陽円盤・エメラルド・モンステラ/シダ・蘭・蝶・垂れる根 |
| egypt | 磨いた砂岩スラブ / ヒエログリフ＆ホルスの目 | ピラミッド/ナイルと帆船・ヤシ・黄金の空 | ヒエログリフ壁・ロータス柱・金のアヌビス・ホルスの目・ファラオのマスク・アンク・スカラベ・ラーの円盤・松明 |

> 既存の arabia / undersea / japan / china / diner / fantasy / scifi / cabin / dino /
> haunted / pirate / circuit / dwarf / hell / tokyo / halloween も同じテンプレ系統。

### サイズ検証
- ダウンロード後 `assets/room-arabia.png`(基準)と床ダイヤの位置が一致していれば
  グリッド較正(OFF_U=0.577, OFF_V=0.851)そのままで整合する。
- 四隅に暗い余白が出ていること＝基準と同フットプリント。枠いっぱいになったら再生成。

---

## 2. オブジェクト(小物)テンプレート（prop_<key>_*.png）

1テーマにつき **4種** をまとめて1枚のシートで出す → マゼンタ抜き → 個別スライス。
`{{THEME}}` と `{{FOUR_ITEMS}}` を差し替える。

```
Sprite sheet of exactly 4 separate {{THEME}} themed decorative objects, isometric pixel-art,
lo-fi 8-bit Famicom style, chunky pixels, thick clean black outlines, high contrast.
The 4 items are: {{FOUR_ITEMS}}.
Arrange them in a single horizontal row, evenly spaced, each fully separated with clear gaps,
each roughly the same size (fitting about 1-1.5 floor tiles), standing on the ground
(front view, slight 2:1 isometric 3/4 angle) so they can sit on an isometric floor.
Solid pure MAGENTA (#FF00FF) flat background, NO shadows touching the magenta,
NO ground plane, NO text, NO labels, NO UI, NO characters.
Each object clearly readable as a small game prop.
```

### テーマごとの 4 items 案（未生成 / これから発注）

| key | 4 items |
|---|---|
| diner | jukebox / neon clock / milkshake counter stool / vintage gas pump |
| steampunk | brass diving helmet / gear contraption / pressure boiler / tesla globe |
| western | wooden barrel cactus / campfire / wagon wheel / hay bale |
| sushi | conveyor sushi plate stack / soy sauce & gari set / sake barrel / neko figurine |
| beehive | honey pot / honeycomb frame / flower cluster / smoker(養蜂器具) |
| circus | striped pedestal / cannon / stacked balls / hoop stand |
| carnival | mask stand / cake tower / balloon bunch / drum |
| undersea | treasure chest / coral / anchor / clam |
| japan | 石灯籠 / 盆栽 / 手水鉢 / 太鼓 |
| ...他テーマ | 同様に4種ずつ |

> スライス手順: python で列方向の非マゼンタ塊を検出し矩形で切り出し、
> 透過PNG化 → placeable prop カタログ(PROP_NAMES 系)に追加。
```

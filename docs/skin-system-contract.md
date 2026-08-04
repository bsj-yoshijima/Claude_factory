# エージェント・スキンシステム 改修契約

旧仕様（頭上に絵文字アクセ `a.skinObj` ＋ 体tint `a.bodyTint`、クリックで巡回）を**撤廃**し、
「**エージェントを選んで、テーマ別スキン画像を丸ごと適用**」する本格スキンに置き換える。

- **画像アセットは別担当(メインスレッド)がStitchで生成** → `assets/skin-<id>.png`（透過PNG）。
- **UI/コードはサブエージェント担当**。アセットがまだ無くても動くよう、テクスチャ未ロード時は
  従来の手続きマスコット(`m{ci}_*`)にフォールバックすること（デカップリング）。

## スキン一覧（id = テーマキー、31種）＋ 'none'(デフォルト=手続きマスコット)

```js
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
```

## テクスチャ規約

- preload: **用意できている id だけ**読む。どれが用意済みかの正は `assets/hat-fit.json` のキーで、
  `hat-fit.json` を先に読み、その `filecomplete` で該当ぶんだけ `this.load.image('hat_'+id, ...)` を追加投入する。
  ※ Phaser は404を欠損テクスチャとして扱うだけなので全idを投機的に読んでも動くが、
  未生成のぶん（現状25件）がコンソールに404として並び、初見では壊れて見える。
  描画側の `this.textures.exists('hat_'+id)` チェックは引き続き残す（二重の安全網）。
- 適用: エージェント `a.skinId`（既定 'none'）。
  - `a.skinId!=='none' && this.textures.exists('skin_'+a.skinId)` のとき、
    `a.sp.setTexture('skin_'+a.skinId)` を stand/work/sit すべてで使う（ポーズ差分なし・簡略化）。
    表示高さは手続きマスコットと揃える（`setDisplaySize` かスケール計算で on-screen 高さを合わせる。
    足元基準 `setOrigin(0.5,1)` は維持。歩行の上下バウンド・`setFlipX(a.face<0)`・`setDepth(a.py)` は継続）。
  - それ以外は従来どおり `m{a.ci}_stand/work/sit`。
- ライティング: スキンにも部屋の採光 `lt` を multiply tint で掛けてOK（テーマ部屋は淡色なので破綻しない）。
  旧 `a.bodyTint` は撤廃。

## 撤廃するもの

- `a.skinObj`（頭上絵文字）の生成・更新・位置追従（`updateSkin` 内の絵文字ロジック、
  update ループ末尾の `if(a.skinObj){...setPosition...}` 行、`clearDeco` 内の skinObj 破棄も整理）。
- 旧 `SKINS`（emoji `e`/`body` を持つ配列）と `cycleSkin` の**クリック巡回**。
  （エージェントのクリックは「スキン画面でそのエージェントを選択」用途に変更 or 廃止でよい）
- `a.bodyTint` / `mulTint(lt, a.bodyTint)` の tint 分岐（ライティング tint のみ残す）。

## 新UI（factory-phaser.html）: スキン選択画面

- トップバーに「🎨 スキン」タブを追加（既存 ガチャ/ショップ/編集/図鑑 と同様の overlay パネル）。
- パネル構成:
  1. **エージェント選択**: 現在稼働中エージェントを一覧（プロジェクト名で表示、稼働/休憩の状態も）。
     クリックで対象を選択（選択中はハイライト）。
  2. **スキン選択グリッド**: `SKINS` をカード表示（スキン画像サムネ or 名前）。クリックで選択中エージェントに適用。
     適用中スキンには印。'none' でデフォルトに戻せる。
- 固定サイズパネル（既存の `#panel` 流儀＝ガタつかない・内部スクロール）。

## Scene↔UI ブリッジ（main.js が window に生やす）

- `window.__factory = { getAgents(), applySkin(proj, skinId), skinList }`
  - `getAgents()` → `[{proj, skinId, working}]`（現在の `this.agents` から）。
  - `applySkin(proj, skinId)` → 該当プロジェクトの全エージェントに適用＋`this.skins[proj]=skinId` 更新＋
    既存の保存フック（`window.__skinChanged(proj, skinId)` かセーブ）で永続化。
  - `skinList` → `SKINS`（UIが参照）。
- 既存の per-project 永続化（`this.skins` マップ / `applySkins(map)` ロード）は流用。

## 完了条件

- `node -c game/main.js` OK ＋ html内スクリプトの `new Function(...)` パースOK。
- 頭上絵文字が出ない。スキン未適用時は従来マスコット。スキン適用時はテクスチャがあれば差し替わる
  （無ければマスコットのまま＝アセット待ち）。
- スキン画面でエージェント選択→スキン適用→再ロードで維持。

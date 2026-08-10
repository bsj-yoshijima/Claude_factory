# docs/ の中身

| | |
|---|---|
| `shells/` | 絵を発注するときに添付する**殻**（下絵）。png と、焼き込みが読む json |
| `prop-prompts/` | 装飾品の発注プロンプト（31テーマ×5種＝155本、生成済み）。→ [README](prop-prompts/README.md) |
| `decks/` | 企画書・発表スライド・PDF（現行版） |
| `archive/` | それらの旧版。参照はされていないが経緯として残す |

## 絵を作る（Stitch へ発注する）

| ファイル | 対象 | 添付する殻 |
|---|---|---|
| [stitch-prompts.md](stitch-prompts.md) | 部屋の背景 | `shells/room-shell-1376x768.png` |
| [machine-sprite-prompt.md](machine-sprite-prompt.md) | 製造機 | `shells/mach-shell-1024.png` |
| [prop-sprite-prompt.md](prop-sprite-prompt.md) | 装飾品 | `shells/prop-shell-*.png` |

装飾品を発注するだけなら [prop-prompts/README.md](prop-prompts/README.md) が入口。
`prop-sprite-prompt.md` は**なぜその形なのか**（潰した分岐と失敗の記録）を残す方。

### 殻を新しく作るときの注意

生成側が返すキャンバスは決まった比のものしかない（**1376x768 / 1200x896 / 1024x1024 /
896x1200**、どれも約1.05〜1.08MP）。外れた比で頼むと近い比へ丸めて描き直され、そのぶん
割り付けが変わる。2×2 の殻がこれで1割潰れた。→ `prop-sprite-prompt.md`

## 仕様・記録

| ファイル | 中身 |
|---|---|
| [wp.md](wp.md) | WP（作業ポイント）の算出と経済バランス |
| [multiuser.md](multiuser.md) | マルチユーザー版のデータ構造とAPI |
| [skin-system-contract.md](skin-system-contract.md) | マスコットの見た目（スキン）の取り決め |
| [task-mat-prod-icons.md](task-mat-prod-icons.md) | 原材料・製品アイコンの作業メモ |

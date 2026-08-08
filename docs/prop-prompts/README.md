# 装飾品の発注プロンプト（生成済み・そのまま貼れる）

31テーマ × 4種類 = 124本。Stitch の Web UI に**殻の画像を添付して、本文をそのまま貼る**だけ。
各ファイルの先頭に `#` で「添付する殻」と「出力サイズ」が書いてある（`#` の行は貼らない）。

中身は `tools/assets/prop_prompt.mjs` が組み立てたもの。文面を直すときはツール側を直して
このフォルダを作り直す（→ 末尾の再生成コマンド）。

## どれを使うか

| ファイル | 用途 | 添付する殻 |
|---|---|---|
| `<theme>-sheet.txt` | **これが標準。** 全テーマ共通の7種を1枚で発注 | `docs/prop-shell-sheet7-1519x1127.png` |
| `<theme>-sheet-room.txt` | 上と同じだが、部屋の絵をテーマの参照として2枚目に添える版 | 同上 ＋ `assets/rooms/room-<theme>.png` |
| `<theme>-custom-1x1.txt` | 名物・一点物（床1マス） | `docs/prop-shell-custom-1x1-372x499.png` |
| `<theme>-custom-1x2.txt` | 同（細長い物） | `docs/prop-shell-custom-1x2-423x567.png` |
| `<theme>-custom-2x2.txt` | 同（大きい物） | `docs/prop-shell-custom-2x2-617x617.png` |

共通の7種は **chair / shelf / lamp / plant（1×1）と table / sofa / rug（1×2）**。
名物は物ごとに特徴も大きさも違うので、共通シートには入れず1体ずつ発注する。

### `-room` 版は非推奨

部屋の絵を2枚目に添えると**枠が塗りつぶしに描き替えられ、大きさが 20% ぶれた**（実測）。
枠の幅が大きさの基準なので、そこがぶれると縮尺が崩れる。テイストを寄せる利点はあるが、
規格の安定を失うので既定は使わない。残してあるのは、生成モデルが変わったときに
再挑戦する価値があるため。経緯は `docs/prop-sprite-prompt.md`。

### カスタムの `{{OBJECT}}`

`<theme>-custom-*.txt` はそのテーマの名物（例: japan なら屏風）が入った状態で出してある。
別の物を作りたいときはツールに `--object` を渡す:

```
node tools/assets/prop_prompt.mjs japan --custom 1x2 --object "a KOTATSU with a quilt"
```

殻にはダミーの四角が立っている。**形は自由だが、その四角が示す高さと接地面は守らせる**
（菱形だけの殻だと幾何ごと外れた実績があるため、手本として置いている）。

カスタムの殻にも**シアンの枠がある**。1体だけだからと枠を外したら、生成物が別の寸法・別の
縦横比で返って大きさの基準が消えた（→ `docs/prop-sprite-prompt.md`）。枠は消さないこと。

## 生成したあと

```
node tools/assets/cut_prop_sheet.mjs <生成物.png> docs/prop-shell-sheet7-1519x1127.json <prefix>
```

カスタムは殻のJSONを渡し、`--slot` でその物の名前を付ける（付けないと `free-1x2` になる）:

```
node tools/assets/cut_prop_sheet.mjs <生成物.png> docs/prop-shell-custom-1x2-423x567.json jpn --slot byobu
```

`prefix` はテーマの3文字（japan なら `jpn`。対応は `game/scene/catalog.mjs` の `PROP_NAMES`）。
`assets/props/` に実寸のPNGと `prop-fit-<prefix>.json` が出る。**必ず `_contact-<prefix>.png` を
目で見ること**（数値だけ見て中身が別物だったことがある）。

`prop-fit-<prefix>.json` の中身を `assets/props/prop-fit.json` へ `baked:1` を付けて統合すると、
ゲームが新規格の描画（等倍・接地点合わせ）に切り替わる。

## 再生成

```
for t in $(node tools/assets/prop_prompt.mjs --list | awk '{print $2}'); do
  node tools/assets/prop_prompt.mjs $t --sheet      --out docs/prop-prompts
  node tools/assets/prop_prompt.mjs $t --sheet --room --out docs/prop-prompts   # -room 版は手で改名
  for s in 1x1 1x2 2x2; do
    node tools/assets/prop_prompt.mjs $t --custom $s --out docs/prop-prompts
  done
done
```

殻の画像そのものは `tools/preview/props.html` の「🧱 殻」から作る（Python は要らない）。

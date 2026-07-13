# 🏭 Claude Factory

いま動いている **Claude Code のセッション**を、「工場で働く仲間」としてリアルタイムに可視化するダッシュボード。

各エージェント = 1体のマスコット。稼働中(busy)はベルトコンベアを左→右に流れながら作業し、待機中(idle)は手前の充電ポートで充電しながら休む。ふと画面に目をやるだけで「いま何体動いていて、どれが作業中か」がつかめる、眺めていたくなる"景色"のダッシュボードを目指しています。

> 発表用の企画書・スライドも同梱（`proposal.html` / `slides.html` / `Claude-Factory.pdf`）。

## 使い方

依存ゼロ（Node標準モジュールのみ）。

```bash
node server.mjs
# → http://localhost:4321 をブラウザで開く
```

停止 / 再起動:

```bash
lsof -ti tcp:4321 | xargs kill        # 停止
node server.mjs                       # 再起動
```

別のディレクトリで `claude` を起動して作業させると、その子が工場に現れて動き出します。

## 仕組み

```
~/.claude/sessions/*.json     起動中セッションの実体（1ファイル = 1エージェント）
      │  1秒ごとに読み取り／ps で死活判定（終了済みの残骸を除外）
      ▼
server.mjs (Node 常駐)         → /api/sessions で稼働状況を JSON 配信
      │  1秒ポーリング
      ▼
pixel-factory.html            Canvas のドット絵工場。busy/idle をアニメで表現
```

- 完全ローカル・オフライン動作。セッション情報が外部に出ることはありません。
- 進捗%は API に存在しないため、コンベア上の進み具合は「busy になってからの経過時間」による擬似進捗です（`taskProgress()` を差し替えれば実データ対応可能）。

## 主な機能

- **リアルタイム稼働数**: 稼働中 / 待機中 / 合計 / 完了 を常時表示
- **busy → ベルトコンベアを左→右**に流れて作業（右端で完成）
- **idle → 充電ポート**でドッキングして充電（バッテリーゲージ + ⚡、満充電で 💤）
- **稼働メーター / 警告灯**: 稼働率 (busy/total) に連動
- **JST 昼夜サイクル**: 実時刻に合わせて採光・天井照明・夜の光が連続的に変化（`?hour=17.5` で任意時刻プレビュー）
- **タップで色替え**: マスコットをクリックすると体色が巡回（セッションごとに保持）
- ドット絵の工場装飾: タンク・スチール棚・高架コンベア・配管・換気ファン・看板猫 ほか

## ファイル

| ファイル | 内容 |
|---|---|
| `server.mjs` | セッションを読んで `/api/sessions` を配信する常駐サーバ |
| `pixel-factory.html` | メインの工場ビュー（Canvas ドット絵・アニメ・実データ連動） |
| `index.html` | 初期のシンプル版（カードUI） |
| `machine-concepts.html` | 工場に足す機械のコンセプトボード |
| `proposal.html` | 企画書（1枚もの） |
| `slides.html` / `slides-en.html` | 発表スライド（日本語 / 英語） |
| `Claude-Factory.pdf` | スライドの PDF 版 |

## 必要環境

- Node.js（`node server.mjs` が動けばOK）
- macOS 向け（`ps` によるプロセス死活判定を使用）

---

🤖 Built with [Claude Code](https://claude.com/claude-code)

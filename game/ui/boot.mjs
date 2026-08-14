/* 起動中の目隠し（#boot）— 盤面で働いているときの Claude 君をそのまま出す。
   器（markup と CSS）は factory-phaser.html、動きはここ。

   アセットのロードが終わるまでは Phaser が使えないので、盤面の稼働アニメを
   素の canvas で再現する。絵は game/scene/mascot.mjs のドット絵をそのまま使う
   （assets を読まない手続き描画なので、ロード前でも描ける）。

   動きの数値は game/scene/main.mjs の稼働中の処理に合わせてある:
     ・work と stand を 約12回/秒 で入れ替える（腕のバタバタ）
     ・work のフレームだけ 1ドット浮かせる
     ・毎フレーム 14% の確率で、右手のあたりに火花を2粒
   ここを変えるときは向こうも一緒に直す（同じキャラが別の動きをすると気持ち悪い）。 */
import { DOTP, PRESETS, mascotCanvas } from '../scene/mascot.mjs';

const DOT = 4;                     // ドット1個の辺(CSS px)。盤面は 3。整数だけ使う
const Z = 2;                       // canvas の内部解像度の倍率（高解像度画面でぼやけないように）
const S = DOT / DOTP;              // 盤面基準の座標・速度をこの表示倍率に合わせる係数
const SPARK_COLORS = ['#ffffff', '#fce87e', '#f08a68'];   // main.mjs の tint と同じ
const LIFE = 420;                  // 火花の寿命(ms)。main.mjs の lifespan と同じ

let raf = 0, done = false;

/** 目隠しの中の canvas に、稼働中の Claude 君を描き続ける */
export function startBootMascot() {
  const cv = document.querySelector('#boot .bmascot');
  if (!cv) return;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;                        // ドットを補間させない
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 色は HUD のアイコンと同じ PRESETS[0]（橙）。2ポーズを先に焼いておく
  const work = mascotCanvas(PRESETS[0], 'work', DOT);
  const stand = mascotCanvas(PRESETS[0], 'stand', DOT);
  const mx = Math.round((cv.width / Z - work.width) / 2);  // 中央に置く
  const my = Math.round(cv.height / Z - work.height - 3);  // 足元を少し上げる
  const handX = mx + Math.round(work.width / 2) + 12 * S;  // main.mjs の px + face*12
  const handY = my + work.height - 26 * S;                 //     と py - 26

  const sparks = [];
  let t0 = null;

  const frame = (t) => {
    if (done) return;
    if (t0 === null) t0 = t;
    const dt = Math.min(50, t - (frame._last ?? t)); frame._last = t;

    g.setTransform(Z, 0, 0, Z, 0, 0);
    g.clearRect(0, 0, cv.width / Z, cv.height / Z);

    // 腕のバタバタ。止めたい人には work のまま静止させる
    const swing = still ? true : Math.floor(t * 0.012) % 2 === 0;
    g.drawImage(swing ? work : stand, mx, my - (swing ? Math.round(S) : 0));

    if (!still) {
      if (Math.random() < 0.14) for (let i = 0; i < 2; i++) sparks.push({
        x: handX, y: handY,
        vx: (-14 + Math.random() * 28) * S, vy: (-34 + Math.random() * 26) * S,
        age: 0, c: SPARK_COLORS[(Math.random() * SPARK_COLORS.length) | 0],
      });
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.age += dt;
        if (s.age >= LIFE) { sparks.splice(i, 1); continue; }
        s.x += s.vx * dt / 1000; s.y += s.vy * dt / 1000;
        const k = s.age / LIFE;
        // 6x6 の十字（main.mjs が作っている spark テクスチャと同じ形）を縮めながら消す
        const w = 6 * S * 1.1 * (1 - k);
        g.globalAlpha = 1 - k; g.fillStyle = s.c;
        g.fillRect(s.x - w / 6, s.y - w / 2, w / 3, w);
        g.fillRect(s.x - w / 2, s.y - w / 6, w, w / 3);
        g.globalAlpha = 1;
      }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}

/** 読み込みの進捗（0〜1）をバーに反映する */
export function bootProgress(p) {
  if (done) return;
  const bar = document.querySelector('#boot .bbar i');
  if (bar) bar.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
}

/** 目隠しを外す。呼ばれるのは「盤面と所持品が載り切った」時点 */
export function bootDone() {
  if (done) return;
  done = true;
  if (raf) cancelAnimationFrame(raf);
  const el = document.getElementById('boot');
  if (!el) return;
  const bar = el.querySelector('.bbar i');
  if (bar) bar.style.width = '100%';
  el.classList.add('gone');
  setTimeout(() => el.remove(), 400);
}

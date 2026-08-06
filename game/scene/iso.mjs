/* 等角の座標系 — 画面座標とマス(c,r)の相互変換。
   盤面の見た目に関わる数値はここだけ。絵の位置は全部ここから出る。 */

'use strict';
/* Claude Factory — Phaser 3 基盤
   1シーン統合(休憩室廃止) / 設置物セル占有＋BFS回避徘徊 / マスコット3ポーズ状態機械。
   追加: 接地影(背景に溶け込む), idle小ネタ(座り💤 / コーヒー☕ / 壁際にもたれる)。 */

export const W = 1024, H = 572, GU = 12, GV = 12;
// ISO は「背景画像に対する床ダイヤ(12x12)の位置」を比率で持つ。背景を作る側の規格でもある
// (tools/preview/guide.html が同じ値から Stitch 用の下絵と検収オーバーレイを引く)。
// 経緯: 元は room-factory.png のタイル目地に実測フィットした値だったが、手描き絵の歪みを
// そのまま拾って (a) u軸とv軸で1.39°のねじれ (b) Bx=0.4930 で全体が画像中心より約10px左
// という非対称が入っていた。背景の絵自体は左右マージンが完全一致(=中央)だったので、
// 絵ではなくグリッド側の誤差と判断し、軸を対称化(ux=-vx, uy=vy)して Bx=0.5 に中央揃えした。
// さらに 1マスを厳密な 2:1 にした: 旧u軸は 1.930:1、旧v軸は 2.051:1 で、平均は 1.991:1。
// つまり絵は true 2:1 で描かれていて、旧値は u と v が逆方向に約3.5%ずれていただけ。
// uy は ux から導出(uy = ux*W/(2*H))。これで 奥/手前/壁上奥 が画像中心 x に乗り、
// 左右の角が同じ y になり、1マスの送りが x:y = 2:1 になる。
// GU/GV=12 は不変なので保存レイアウト(c,r)は互換。画面上の位置は最大10px程度動く。
export const ISO = { Bx:0.5, By:0.3584, ux:0.3261, uy:0.2919, vx:-0.3261, vy:0.2919 };
export const CELL = ( Math.hypot(ISO.ux*W/GU, ISO.uy*H/GU) + Math.hypot(ISO.vx*W/GV, ISO.vy*H/GV) ) / 2;
function isoToScreen(u,v){ return { x:(ISO.Bx+u*ISO.ux+v*ISO.vx)*W, y:(ISO.By+u*ISO.uy+v*ISO.vy)*H }; }
export const OFF_U = 0, OFF_V = 0;
// オブジェクトは各マスの中心(c+0.5)/GU に置く。編集グリッド線はマス境界(c/GU)に引く→各オブジェクトが四角の中央に入る。
export function cellXY(c,r){ return isoToScreen((c+0.5+OFF_U)/GU,(r+0.5+OFF_V)/GV); }   // c,r は連続値でも可
const ISO_DET = ISO.ux*ISO.vy - ISO.vx*ISO.uy;
export function screenToIso(sx,sy){ const nx=sx/W-ISO.Bx, ny=sy/H-ISO.By;
  return { u:(nx*ISO.vy - ISO.vx*ny)/ISO_DET, v:(ISO.ux*ny - nx*ISO.uy)/ISO_DET }; }
export function uvXY(u,v){ return { x:(ISO.Bx+u*ISO.ux+v*ISO.vx)*W, y:(ISO.By+u*ISO.uy+v*ISO.vy)*H }; }
const AU={x:ISO.ux*W/GU, y:ISO.uy*H/GU};   // 1セル u方向 の画面ベクトル
const AV={x:ISO.vx*W/GV, y:ISO.vy*H/GV};   // 1セル v方向 の画面ベクトル
export const K = (c,r)=> c+','+r;
const DIRS4 = [[1,0],[-1,0],[0,1],[0,-1]];
export const DRAG_SLOP = 8;   // これ以下の移動は「ドラッグではなくクリック」とみなす(px)

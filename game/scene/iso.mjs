/* 等角の座標系 — 画面座標とマス(c,r)の相互変換。
   盤面の見た目に関わる数値はここだけ。絵の位置は全部ここから出る。 */

'use strict';
/* Claude Factory — Phaser 3 基盤
   1シーン統合(休憩室廃止) / 設置物セル占有＋BFS回避徘徊 / マスコット3ポーズ状態機械。
   追加: 接地影(背景に溶け込む), idle小ネタ(座り💤 / コーヒー☕ / 壁際にもたれる)。 */

export const W = 1024, H = 572, GU = 12, GV = 12;
// ISO は背景 factory-room.png に「描かれた床タイル格子」(12x12)を画像から実測フィットした値。
// 旧値は床の縁(トリム)基準で、描き込みのタイル目地と半マス位相＋約5%ピッチがずれており、
// マス中心に置いた設置物が"目地の交差点"に乗って見えていた。GU/GV=12 は不変なので保存レイアウトは互換。
export const ISO = { Bx:0.4930, By:0.3584, ux:0.3240, uy:0.3005, vx:-0.3281, vy:0.2864 };
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

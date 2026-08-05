/* Claude Factory — 画面のエントリ。
   起動の順番と、main.js(クラシックスクリプト)・テストへ渡す窓口だけを持つ。 */
import { GENRES, MAT, MATS, PRODS } from './data/craft.mjs';
import { WP_PER_SLOT, needWpForSize } from './data/rules.mjs';
import { openToday, pollWp, renderBoard, renderCraft, updateDoneBtn, wpState } from './craft.mjs';
import { NET, loadGame, saveGame } from './net.mjs';
import { G, availN, craftState, machState, machines, machinesSorted, reconcileStock, snapLayout } from './state.mjs';
import { openAgents } from './ui/agents.mjs';
import { openCollection } from './ui/collection.mjs';
import { setCraftPick, bindMachRow, machRow, openCraft, openDone } from './ui/craft-dialog.mjs';
import { closeOverlay, openDialog, overlay, toast } from './ui/dialog.mjs';
import { openLb } from './ui/leaderboard.mjs';
import { morphInto } from './ui/morph.mjs';
import { openMyPage } from './ui/mypage.mjs';
import { setEditOn, paletteEl, renderPalette, slideGame, syncEditMode, toggleEditMode } from './ui/palette.mjs';
import { uic, updateBadge } from './ui/parts.mjs';
import { openRecipes } from './ui/recipes.mjs';
import { openShop } from './ui/shop.mjs';

window.__layoutChanged=()=>{ snapLayout(); saveGame(); };
window.__skinChanged=(proj,skinId)=>{ if(!proj)return;
  if(skinId==='none') delete G.skins[proj]; else G.skins[proj]=skinId;
  NET.call('PUT','/api/skin',{project:proj,skinId}); };
window.morphInto=morphInto;        // scene(main.js)のHUD更新からも使う
/* =========================================================================
   共通ダイアログ — 見出し / タブ / 本文 / フッターの操作ボタン / 閉じる
   すべてのダイアログ(ショップ・図鑑・エージェント・原材料・製造機…)はこれに載せる。
     openDialog({
       title  : 見出し（絵文字込みの文字列）
       subtitle: 見出し右の小さい補足。文字列 or (dlg)=>文字列
       tabs   : [{id,label}] or (dlg)=>[…]  省略可。タブ付きダイアログ
       tab    : 初期タブid
       onTab  : (id,dlg)=>void  タブを押したとき（省略時は dlg.tab を差し替えて再描画）
       body   : 本文HTML or (dlg)=>HTML   ※refresh のたびに呼ばれる
       actions: [{label,on,kind:'primary'|'ghost',disabled}] or (dlg)=>[…]  フッターのボタン
       live   : ミリ秒。開いている間この間隔で再描画する（エージェント一覧など）
       onRender:(panel,dlg)=>void  本文描画後のイベント結線
     })
   戻り値 dlg = { tab, refresh(), setTab(id), close() }

   body は毎回まるごと組み直してよい（宣言的に書ける）。実際の DOM への反映は
   morphInto による差分適用なので、変わっていない部分のノードはそのまま残る。
   ＝ 文字の選択・入れ子のスクロール位置・フォーカス・画像は live更新でも壊れない。
   並びが変わりうるリストの各要素には data-key を付けること（付いていないと
   位置で対応づけるため、並び替えのときに中身だけが入れ替わる）。
   onRender は毎回呼ばれるので、結線は el.onclick= のような冪等な形で書く
   （addEventListener はノードが残るぶん二重登録になる）。
   ========================================================================= */
overlay.addEventListener('click',e=>{ if(e.target===overlay) closeOverlay(); });
window.__toast=toast;   // scene(main.js)から通知を出す用
// 💰はショップを開いたときだけ見えればよいので、常設バッジは持たない。
// 購入/売却の各所から呼ばれるため、関数名は残してショップ内の残高表示だけ更新する。
document.getElementById('collectionBtn').addEventListener('click',()=>openCollection());

/* =========================================================================
   🧾 製造レシピ — 「何を入れれば作れるか」の一覧
   図鑑が実績（作った物と個数）なら、こちらは献立表。原材料の組み合わせは
   最初から全部見せて、製品のほうを伏せる。未製造は絵文字を黒く潰した
   シルエットだけを出し、名前もレア度も出さない（レア度が見えると作る前から
   狙い目が分かってしまい、「作って確かめる」動機が消える）。
   個数は出さない ＝ そこは図鑑の担当。
   🪨謎のカタマリはレシピではなく「レシピに無い組み合わせのハズレ」なので載せない。
   ========================================================================= */
// シークレットは PRODS 側の m が空で、組み合わせは SECRETS のキーにある。製品id → 原材料 に引き直す
document.getElementById('recipeBtn').addEventListener('click',()=>openRecipes());

/* =========================================================================
   製造 — 製造機に原材料をセット → 実WPを溜めて製品化
   WP の累計と各機械の進捗はサーバが持ち、/api/state で受け取る。
   ========================================================================= */
// 原材料をセットできるマス数 = 製造機のマス数(2〜5)。台ごとに1レシピ。



/* G.craft — サーバから取ってきた状態を置く手元の入れ物。
   ブラウザには保存しない（読み込みのたびに /api/state と /api/collection から作り直す）。 */
window.__craft = {
  mat:(id)=>MAT[id]||null,
  // 何が作れるかは伏せる（探す楽しみを残す）。代わりに稼働状態と進捗だけ返す。
  preview:(slots, id)=>{
    const set=(slots||[]).filter(Boolean);
    if(!set.length) return null;                       // 素材未設定 → main.js 側が「素材未設定」を出す
    const ms=machines(), m=id?ms.find(x=>x.id===id):null;
    if(!m) return {e:'📦', n:'素材セット済み', unknown:false};
    const st=machState(m.id), need=needWpForSize(m.size);
    return st.running
      ? {e:'⚙️', n:`製造中 ${Math.floor(st.wp)}/${need}WP`, unknown:false}
      : {e:'📦', n:'待機中', unknown:true};
  },
};

/* --- 状態の取得 ---
   /api/state の1本にまとめてある。実測するとブラウザのポーリングが
   テレメトリ受信の30倍のリクエストを生むので、エンドポイントを統合し、
   タブが見えていないときは止める。 */
window.__agentFeed=()=> NET.last ? {workers:NET.last.agents} : null;
/* 製造判定はサーバ側（server/craft.mjs）。
   ・稼いだWPは按分せず、稼働中の全機械にそれぞれ同額を加算する
   ・必要WPに達した「その時点」のマスの組み合わせで作られる製品が決まる
   ・原材料を変えてもWPはリセットしない（溜まった分はそのまま次に使う）
   クライアントは /api/state で進捗を、/api/claim で結果を受け取るだけ。 */

/* --- 今日の労働量ボード（画面上中央・このゲームの主役の数字） ---
   「今日どれだけ働いたか」を示す数字なので、製造の設定とは切り離して大きく出す。 */
// 今日の集計はサーバが数えている（🎁完成品を開いても減らない）
document.getElementById('craft').addEventListener('click',()=>openCraft());

/* --- 原材料の選択（ピッカーは machRow の中にある。ここはセットの実体だけ） --- */
window.__matBadge = ()=>'';   // 原材料は機械のマス(スロット)に直接描かれるのでバッジは使わない
window.__machineClick = (machineId)=>{ if(window.__openMachine) window.__openMachine(machineId); };

/* --- 完成品（新着だけを見せる箱。1回開いたら中身は空になる） --- */
document.getElementById('doneBtn').addEventListener('click',openDone);

/* =========================================================================
   リーダーボード — 期間タブ（今日/今週/今月/今年）× 軸ボタン（9種）
   ・1画面に出すのは「選んだ軸の値」だけ。全軸を並べると読めないし、
     暗黙の総合順位に見えてしまう（docs/wp.md §9: 単一の合計点は作らない）
   ・最初は上位20件。「もっとみる」で20件ずつ追加で取得する
   ========================================================================= */
document.getElementById('lbBtn').addEventListener('click',openLb);

/* =========================================================================
   マイページ — 工場名 / 選んだ日・週のWP・製造個数・売上 / WPの推移グラフ
   粒度は日次(00:00-23:59)と週次(日曜00:00-土曜23:59)の2つ。折れ線はWPだけ引き、
   グラフをクリックするとその日・週の3指標に切り替わる（3本重ねると単位が違って読めない）。
   ========================================================================= */
document.getElementById('myBtn').addEventListener('click',openMyPage);

/* --- ハンバーガーメニュー（主要機能以外を畳む） --- */
const menuEl=document.getElementById('menu'), menuBtn=document.getElementById('menuBtn');
const closeMenu=()=>menuEl.classList.remove('show');
menuBtn.addEventListener('click',e=>{ e.stopPropagation(); menuEl.classList.toggle('show'); });
for(const mi of menuEl.querySelectorAll('.mi')) mi.addEventListener('click',closeMenu);
document.addEventListener('click',e=>{ if(!menuEl.contains(e.target)&&e.target!==menuBtn) closeMenu(); });

/* ===== 🧑‍🏭 エージェント一覧（スキン変更つき）=====
   常時表示はやめ、左下の稼働/休憩HUD か ☰メニューから開く。開いている間は1秒ごとに更新。 */
document.getElementById('hud').addEventListener('click',()=>{ if(!window.__factory){ toast('準備中…'); return; } openAgents(); });
document.getElementById('hud').title='クリックでエージェント一覧';

/* ===== ショップ（製造機・設備・内装の購入と強化） ===== */
/* 💰 の増減は必ずサーバが決める（クライアントの申告を信じない） */
document.getElementById('shopBtn').addEventListener('click',()=>openShop());

/* ===== 起動: ロード→オフライン生産→シーン待ち→所持品反映→生産tick ===== */
function waitScene(){ return new Promise(res=>{ (function chk(){ if(window.__scene) res(); else setTimeout(chk,60); })(); }); }
function applyOwned(){ const s=window.__scene; if(!s)return;
  if(G.layout&&G.layout.length){ const dropped=s.buildLayout(G.layout);   // 保存済みレイアウト(位置)を復元
    snapLayout();
    if(dropped) setTimeout(()=>toast(`コンベアは廃止されました（${dropped} 個を撤去）。製造機をクリックして素材を設定してください`),900); }
  else {                        // 初回: サーバの在庫ぶん(最初の1台)を置いてレイアウトを確定させる
    s.syncMachines(G.machines);
    for(const e of (G.emojiDecos||[])) s.placeEmojiDeco(e);
    snapLayout();
  }
  reconcileStock(); saveGame();
  s.setSkyTheme(G.bg); s.setFloor(G.floor); s.applySkins(G.skins); }
/* ===== 編集パレット: 大項目→在庫から選ぶ→床クリックで設置 ===== */
window.__selChanged=(n)=>{ selN=n; renderPalette(); };
window.renderPalette=renderPalette;
window.__editPlaceAt=(c,r)=>{ const sel=window.__editSel; if(!sel)return;
  if(availN(sel.kind,sel.variant)<=0){ editSel=null; window.__editSel=null; renderPalette(); return; }
  const s=window.__scene; const id = s.addPlaced(sel.kind, sel.variant, {cell:{c,r}, dir:s.placeDir});
  if(id){ snapLayout(); saveGame(); updateBadge(); toast('設置しました'); if(availN(sel.kind,sel.variant)<=0){ editSel=null; window.__editSel=null; } renderPalette(); } };
/* ===== 製造機の設定パネル: 中身は🏭製造の一覧と同じ行（machRow）。
       違いは「その下に配置（↻回転 / ✥移動）が付く」ことだけ。編集中に機械をクリックで開く ===== */
window.__openMachine=(id)=>{
  const F=window.__factory; if(!F) return; setCraftPick(null);
  const dlg=openDialog({ title:`${uic('factory')} 製造機`, subtitle:()=>{ const m=F.getMachine(id); return m?`${m.size}マス${m.lvl>1?` Lv${m.lvl}`:''}`:''; },
    live:1000,
    body:()=>{
    const m=machinesSorted().find(x=>x.id===id);
    if(!m){ setTimeout(closeOverlay,0); return ''; }
    return machRow(m)
      + `<div class="rc" style="margin-top:12px"><div class="mid"><div class="nm">配置</div>`
      + `<div class="cost">向きを変える / 別の場所へ移す（撤去は${uic('trash')}ゴミ箱へドラッグ）</div></div>`
      + `<button data-rot="1">↻ 回転</button><button data-move="1" style="margin-left:5px">✥ 移動</button></div>`;
  },
    actions:[{label:`${uic('factory')} 製造タブへ`,kind:'ghost',on:()=>openCraft()}],
    onRender:(p,d)=>{
    bindMachRow(p,d);                        // マス・ピッカー・製造開始は一覧と同じ結線
    p.querySelectorAll('[data-rot]').forEach(el=>el.onclick=()=>{
      if(!F.rotateMachine(id)){ toast('回した先に空きがありません'); return; } window.__layoutChanged(); renderCraft(); d.refresh(); });
    // 移動: シーンが「掴んで床クリックで置き直す」モードに入る。
    // パネルが開いたままだと床をクリックできないので必ず閉じる。保存もシーン側(__layoutChanged)が行う。
    p.querySelectorAll('[data-move]').forEach(el=>el.onclick=()=>{
      if(!F.beginMoveMachine(id)){ toast('移動できません'); return; }
      closeOverlay(); syncEditMode(); });   // 移動は必要なら編集モードをONにするので表示を合わせる
    // 撤去はドラッグ&ドロップ(🗑ゴミ箱)に一本化したのでボタンは持たない
  } });
  return dlg;
};
/* ===== 編集モードの寄せ =====
   パレットを盤面に重ねると工場が隠れるので、編集中は工場を右へスッと寄せ、空いた左にパレットを出す。
   寄せ方は CSS(#wrap.editing #game の width と margin-left)に任せ、盤面は残り幅いっぱいまで広げる。
   Phaser(Scale.FIT) は親要素の大きさを 500ms ごとのポーリングでしか見に行かないので、
   アニメ中だけ毎フレーム scale.refresh() を叩いて、描画も当たり判定もぬるっと追従させる。 */
document.getElementById('editMenuBtn').addEventListener('click',toggleEditMode);
loadGame().then(async (ok)=>{
  if(!ok) return;                                    // サーバに繋がらない旨は loadGame が出している
  G.lastT=Date.now();
  await waitScene(); applyOwned(); updateBadge();
  setInterval(syncEditMode, 1000); syncEditMode();   // Eキー・移動モードでの編集ON/OFFに追従
  if(window.__scene&&window.__scene.refreshMachineBadges) window.__scene.refreshMachineBadges();
  updateDoneBtn(); renderCraft(); pollWp();
  /* 5秒ごと。OTLP の logs バッチがちょうど5秒間隔なので、
     これより速く叩いても新しい値は存在しない（＝同じ値を取り直すだけ）。
     裏に回っている間は pollWp 側で止まる。 */
  setInterval(pollWp, 5000);
  document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') pollWp(); });
  const q=new URLSearchParams(location.search);
  // ?unlockall は単一ユーザー版のテスト用だった。💰も在庫もサーバが持つので効かない
  if(q.get('unlockall')) toast('?unlockall は使えません（💰と在庫はサーバが管理）');
  if(q.get('edit')){ paletteEl.classList.add('show'); setEditOn(true);
    wrapEl.classList.add('editing'); slideGame(); renderPalette(); }
  if(q.get('shop'))openShop(q.get('shop')==='1'?undefined:q.get('shop'));
});

/* module にしたのでトップレベルの名前はもうグローバルではない。
   外から触る必要がある分だけ、ここで明示的に公開する。
     ・game/main.js（クラシックスクリプト）が使うもの … window.__* と morphInto
     ・test/test_ui_browser.mjs が page 上で評価するもの … 下の一覧
   ここに無い名前は「この画面の内部」なので、外から参照してはいけない。 */
Object.assign(window, {
  // マスタ（テストがジャンル数・製品数を突き合わせる）
  GENRES, MATS, PRODS, WP_PER_SLOT,
  // 画面の状態と操作
  G, NET, wpState, craftState, machState, needWpForSize, machines, machinesSorted,
  renderCraft, renderBoard, updateDoneBtn, updateBadge, saveGame, snapLayout, toast,
  // ダイアログ
  openDialog, closeOverlay, openCollection, openRecipes, openShop,
  openToday, openLb, openMyPage, openDone, openAgents,
});


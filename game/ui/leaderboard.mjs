/* 🏆 リーダーボード — 期間 × 軸。単一の合計点は作らない（WP.md §9）。 */
import { NET } from '../net.mjs';
import { openDialog } from './dialog.mjs';
import { tabStrip } from './parts.mjs';

const LB_PERIODS=[['today','今日'],['week','今週'],['month','今月'],['year','今年']];
const LB_PAGE=20;
const LB_MEDAL=['🥇','🥈','🥉'];   // 1〜3位は順位の数字の代わりにメダル
/* 軸の定義。key=APIの項目 / desc=表の上に出す説明 / fmt=セルの表示 */
const LB_AXES=[
  {key:'efficiency',  label:'効率',       col:'効率',
   desc:'少ないトークンでどれだけ成果を出したか。(追加行 + 削除行×0.3 + PR×150) ÷ output_tokens × 1000。PR1件かつ100行以上が対象で、満たさない人は「—」でランク外。難易度は補正しないので絶対量と併せて見ること。',
   fmt:u=>u.efficiency==null?'<span style="color:#9fb0c0">—</span>':`<b style="color:var(--gold)">${u.efficiency}</b>`},
  {key:'prs',         label:'PR数',       col:'PR',
   desc:'期間内に作成したプルリクエストの数。作業がレビュー可能な単位まで届いた回数。',
   fmt:u=>u.prs.toLocaleString()},
  {key:'commits',     label:'コミット数', col:'コミット',
   desc:'期間内のコミット数。小さく刻んで進めているほど増える。',
   fmt:u=>u.commits.toLocaleString()},
  {key:'lines',       label:'変更行数',   col:'変更行',
   desc:'追加行 + 削除行。消した行も労働として数える（行数稼ぎの逆インセンティブを消すため）。',
   fmt:u=>`${u.lines.toLocaleString()}<span style="color:#9fb0c0;font-size:10px"> (+${u.linesAdded.toLocaleString()} / -${u.linesRemoved.toLocaleString()})</span>`},
  {key:'skill',       label:'Skill利用',  col:'Skill',
   desc:'Skill を呼び出した回数。手順を毎回書き下すのではなく、再利用できる形に畳めているか。',
   fmt:u=>u.skill.toLocaleString()},
  {key:'agent',       label:'Agent起動',  col:'Agent',
   desc:'サブエージェントを起動した回数。調査や並行作業を任せられているか。',
   fmt:u=>u.agent.toLocaleString()},
  {key:'customAgent', label:'自作Agent',  col:'自作Agent',
   desc:'自分で定義したエージェントの起動回数。自分の仕事に合わせて道具を作れているか。',
   fmt:u=>u.customAgent.toLocaleString()},
  {key:'delegationPct',label:'委譲率',    col:'委譲率',
   desc:'全ツール実行のうち、サブエージェント側で実行された割合。高いほど本体の文脈を使わずに任せている。',
   fmt:u=>`${u.delegationPct}%`},
  {key:'activeDays',  label:'稼働日数',   col:'稼働日',
   desc:'期間内に Claude Code を使った日数。量ではなく続いているかを見る軸。',
   fmt:u=>`${u.activeDays.toLocaleString()}日`},
];
const lbAxis=(k)=>LB_AXES.find(a=>a.key===k)||LB_AXES[0];
let _lbKey='efficiency';
let _lbPeriod='week';
export async function openLb(){
  let rows=null;            // null=読み込み中
  let total=0, loading=false;
  async function load(more){
    loading=true;
    const offset=more?(rows||[]).length:0;
    const d=await NET.call('GET',
      `/api/leaderboard?period=${_lbPeriod}&metric=${_lbKey}&limit=${LB_PAGE}&offset=${offset}`);
    const page=(d&&d.scorecard)||[];
    rows=more?[...(rows||[]),...page]:page;
    total=(d&&d.total)||rows.length;
    loading=false;
  }
  const dlg=openDialog({ title:'🏆 リーダーボード',
    tabs:LB_PERIODS.map(([k,l])=>({id:k,label:l})), tab:_lbPeriod,
    onTab:async(id,d)=>{ _lbPeriod=id; rows=null; d.refresh(); await load(false); d.refresh(); },
    body:()=>{
    const ax=lbAxis(_lbKey);
    const btns=tabStrip(LB_AXES.map(a=>({id:a.key,label:`${a.label}順`})), _lbKey, 'data-lbk', {pill:true});
    const note=`<div class="rowline" style="font-size:11px;color:#9fb0c0;line-height:1.7">
        <b style="color:#9fdcc6">${ax.label}順</b>${ax.desc}</div>`;
    if(!rows) return btns+note+'<div class="cost">読み込み中…</div>';
    // 工場名はサーバ(DB)の factories.name が factoryName で来る。空は古い行の保険
    const fname = (u)=> u.factoryName || `${String(u.name||u.id||'').split('@')[0]}の工場`;
    const more = rows.length<total
      ? `<div class="rowline" style="justify-content:center">
           <button class="dbtn ghost" id="lbMore">もっとみる（${rows.length} / ${total}）</button></div>` : '';
    return btns+note+`
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr style="color:#9fb0c0">
          <th style="text-align:left;width:34px">#</th><th style="text-align:left">工場</th>
          <th style="text-align:right">${ax.col}</th>
        </tr></thead><tbody>${rows.length?rows.map((u,i)=>`
          <tr style="border-top:1px solid #22322e">
            <td style="text-align:left;color:#9fb0c0" title="${i+1}位">${LB_MEDAL[i]
              ? `<span style="font-size:15px;line-height:1">${LB_MEDAL[i]}</span>` : i+1}</td>
            <td style="text-align:left;color:#eafff4" title="${u.name||u.id||''}">🏭 ${fname(u)}</td>
            <td style="text-align:right">${ax.fmt(u)}</td></tr>`).join('')
          :'<tr><td colspan="3" style="color:#9fb0c0;padding:10px">データがありません（OTelの設定を確認）</td></tr>'}</tbody></table>
      ${more}`;
  },
  onRender:(p,d)=>{
    p.querySelectorAll('[data-lbk]').forEach(el=>el.onclick=async()=>{
      if(el.dataset.lbk===_lbKey) return;
      _lbKey=el.dataset.lbk; rows=null; d.refresh();      // 軸を変えたら1ページ目から取り直す
      await load(false); d.refresh();
    });
    const m=p.querySelector('#lbMore');
    if(m) m.onclick=async()=>{
      if(loading) return;
      m.disabled=true; m.textContent='読み込み中…';
      await load(true); d.refresh();
    };
  } });
  await load(false);
  dlg.refresh();   // 読み込み中に閉じられていれば refresh は何もしない
}

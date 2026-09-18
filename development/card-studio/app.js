'use strict';
const M=window.StudioModel;
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stateNames={draft:'下書き',testing:'検証中',adopted:'採用',held:'保留',archived:'見送り'};
let library={schemaVersion:1,revision:0,cards:[],definitions:[]}, baseline=M.clone(library), selected=null, tab='basic', slot='front', dirty=false, ready=false, saving=false, logs={}, storage=null;
const current=()=>library.cards.find(d=>d.id===selected);
const defs=()=>M.definitions(library);
const date=v=>new Date(v).toLocaleString('ja-JP');
const options=(pairs,value)=>pairs.map(x=>{const [v,label]=Array.isArray(x)?x:[x,x];return `<option value="${esc(v)}" ${v===value?'selected':''}>${esc(label)}</option>`;}).join('');
function field(label,path,value,{type='text',hint='',placeholder='',step,min,area=false,select=null}={}) {
  const id='f-'+path.replaceAll('.','-');
  const attrs=`id="${esc(id)}" data-bind="${esc(path)}"`;
  const input=select?`<select ${attrs}>${options(select,value)}</select>`:area?`<textarea ${attrs} rows="3" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`:`<input ${attrs} type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${step!==undefined?`step="${step}"`:''} ${min!==undefined?`min="${min}"`:''}>`;
  return `<label class="field" for="${esc(id)}"><span>${esc(label)}</span>${input}${hint?`<small>${esc(hint)}</small>`:''}</label>`;
}
const number=(label,path,v,hint='')=>field(label,path,v,{type:'number',min:0,step:1,hint});
function toast(message,error=false) {const n=$('#notice');n.textContent=message;n.classList.toggle('error',error);n.hidden=false;}
function markDirty() {dirty=true;$('#save-state').textContent='● 未保存';$('#save').disabled=!ready||saving;}
function refresh() {renderLibrary();renderEditor();renderPreview();}
function renderLibrary() {
  const query=$('#search').value.trim().toLocaleLowerCase(),filter=$('#status-filter').value;
  const filtered=library.cards.filter(d=>(!filter||d.status===filter)&&(!query||JSON.stringify([d.card.name,d.card.skills,d.notes,d.history,d.tags,d.gameCardId,d.id,...M.slots.flatMap(([k])=>d.card.skills[k].effects.map(e=>defs().find(f=>f.id===e.typeId)?.name))]).toLocaleLowerCase().includes(query)));
  $('#library-count').textContent=library.cards.length;
  $('#card-list').innerHTML=filtered.map(d=>`<button class="library-card ${d.id===selected?'active':''}" data-open="${esc(d.id)}"><div class="card-list-top"><span class="rarity r-${d.card.rarity}">${d.card.rarity}</span><span class="status status-${d.status}">${stateNames[d.status]}</span></div><b>${esc(d.card.name||'名称未設定')}</b><small>${esc(d.card.classification)} · ${d.card.cost} / α${d.card.alphaCost}</small><span class="slot-summary">${M.slots.map(([key,label])=>`<span><small>${label.replace('スキル','')}</small><strong>${d.card.skills[key].enabled?d.card.skills[key].effects.map(e=>esc(defs().find(f=>f.id===e.typeId)?.icon||'◇')).join('')||'—':'—'}</strong></span>`).join('')}</span></button>`).join('')||'<p class="empty-list">該当するカードはありません</p>';
}
function renderEditor() {
  const d=current();if(!d)return;
  const c=d.card;
  $('#main').innerHTML=`<header class="editor-head"><div><span class="eyebrow">DESIGN WORKSPACE</span><h1 id="editor-title">${esc(c.name||'名称未設定')}</h1><small class="design-id">${esc(d.id)}</small></div><div class="head-actions"><button class="quiet" data-action="duplicate">複製</button><button class="quiet" data-action="export-card">仕様JSON</button></div></header><nav class="tabs" aria-label="編集項目">${[['basic','01','基本情報'],['effects','02','行動・効果'],['notes','03','設計メモ'],['history','04','調整履歴']].map(([key,n,label])=>`<button data-tab="${key}" aria-current="${tab===key?'page':'false'}" class="${tab===key?'active':''}"><small>${n}</small> ${label}</button>`).join('')}</nav><div class="editor-body">${tab==='basic'?basicForm(d):tab==='effects'?effectsForm(d):tab==='notes'?notesForm(d):historyForm(d)}</div>`;
}
function basicForm(d) {
  const c=d.card;
  return `<div class="section-heading"><h2>カードの輪郭</h2><p>定型の16項目。行動の詳細は次のタブで作成します。</p></div><section class="panel"><div class="form-grid">${field('カード名','card.name',c.name)}${field('レアリティ','card.rarity',c.rarity,{select:['C','R','SR','UR']})}${number('コスト','card.cost',c.cost)}${number('αコスト','card.alphaCost',c.alphaCost,'αとして採用したときの総コスト')}${field('分類','card.classification',c.classification,{select:[...new Set([...M.classes,c.classification])]})}${field('ゲーム側カードID（任意）','gameCardId',d.gameCardId,{placeholder:'採用先との照合用'})}</div><div class="stat-fields">${number('HP','card.hp',c.hp)}${number('AT','card.at',c.at)}${number('AG','card.ag',c.ag)}</div></section><section class="panel"><h3>イラスト</h3><div class="art-input">${c.artwork?`<img src="${esc(c.artwork)}" alt="登録イラスト">`:'<div class="art-placeholder">✧</div>'}<div><button data-action="upload-art">画像を選ぶ</button> ${c.artwork?'<button class="quiet" data-action="clear-art">画像を外す</button>':''}<p class="muted">PNG・JPEG・WebP / 1枚2MiBまで</p></div></div>${field('出典・制作メモ（開発用）','artCredit',d.artCredit,{placeholder:'作者、ファイルの出所など'})}</section><section class="panel"><h3>得意地形</h3><p class="muted">複数選択可。選択がない場合はカード上を空欄にします。</p><div class="choice-chips">${[...new Set([...M.terrains.map(x=>x[0]),...c.terrains])].map(name=>`<label><input type="checkbox" data-terrain="${esc(name)}" ${c.terrains.includes(name)?'checked':''}><span>${esc(M.terrains.find(x=>x[0]===name)?.[1]||'◇')} ${esc(name)}</span></label>`).join('')}</div><button class="quiet" data-action="add-terrain">＋ 地形名を追加</button></section><section class="panel"><div class="panel-title"><h3>特性 <span class="muted">${c.traits.length?c.traits.length:'なし'}</span></h3><button class="quiet" data-action="add-trait">＋ 特性</button></div>${c.traits.map((t,i)=>traitForm(t,i)).join('')}<button class="quiet" data-action="new-trait-definition">＋ 共通特性を登録</button></section>`;
}
function traitForm(t,i) {
  const p=`card.traits.${i}`,choices=[['',t.name?`既存の個別特性：${t.name}`:'特性を選択'],...M.traitDefinitions(library).map(def=>[def.id,def.name])];
  return `<div class="trait-editor"><div class="form-grid">${field('共通特性',p+'.definitionId',t.definitionId||'',{select:choices})}${field('数値（任意）',p+'.value',t.value,{placeholder:'5'})}</div>${field('効果量（任意）',p+'.effectAmount',t.effectAmount||'',{placeholder:'AT×1.0',hint:'数値欄とは別に、反撃の攻撃倍率などを指定'})}${t.definitionId?`<div class="field"><span>共通の説明</span><p class="muted prewrap">${esc(t.description)}</p></div>`:`${field('既存の特性名',p+'.name',t.name)}${field('タップ時の説明',p+'.description',t.description,{area:true})}`}<button class="quiet danger" data-action="remove-trait" data-index="${i}">この特性を外す</button></div>`;
}
function traitDefinitionDialog() {
  showDialog('<div class="dialog-heading"><h2>共通特性を登録</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div><form id="trait-definition-form"><label class="field"><span>特性名</span><input name="traitName" required maxlength="60" placeholder="共通で使う特性名"></label><label class="field"><span>共通の説明</span><textarea name="description" required rows="3" placeholder="数値や倍率を除いた、共通の効果説明"></textarea></label><p class="muted">数値と効果量はカードごとに設定できます。</p><p id="trait-definition-error" class="error-text" role="alert"></p><button class="primary" type="submit">共通特性を登録</button></form>');
}
function gridHtml(target,interactive=false,index=0,skillSlot=slot) {
  return `<div class="target-pair ${interactive?'editable':''}">${['ally','enemy'].map(side=>`<div class="target-half ${side}"><small>${side==='ally'?'味方':'敵'}${target.selection==='search'?'候補':''}</small><div class="ranks">${(side==='ally'?['後','中','前']:['前','中','後']).map(x=>`<span>${x}</span>`).join('')}</div><div class="target-grid">${[0,1,2].flatMap(row=>(side==='ally'?[2,1,0]:[0,1,2]).map(col=>{const cell=row*3+col,active=M.targetCells(target,side,skillSlot).includes(cell),origin=side==='ally'&&cell===M.originCell(skillSlot);const attrs=interactive?`data-action="cell" data-index="${index}" data-side="${side}" data-cell="${cell}" aria-pressed="${active}" aria-label="${side==='ally'?'味方':'敵'} ${['左','中央','右'][row]} ${['前衛','中衛','後衛'][col]}" type="button"`:'';return `<${interactive?'button':'span'} ${attrs} class="cell ${active?'selected':''} ${target.selection==='search'?'candidate':''} ${origin?'origin':''}">${origin?'●':''}</${interactive?'button':'span'}>`;})).join('')}</div></div>`).join('')}</div>`;
}
function effectsForm(d) {
  const s=d.card.skills[slot],p=`card.skills.${slot}`;
  return `<div class="section-heading"><h2>行動を組み立てる</h2><p>上の効果から順に実行。各効果に対象・量・条件を設定します。</p></div><nav class="slot-tabs" aria-label="行動枠">${M.slots.map(([key,label])=>`<button data-slot="${key}" class="${slot===key?'active':''}" aria-current="${slot===key?'page':'false'}">${label}<small>${d.card.skills[key].enabled?d.card.skills[key].effects.length+'効果':'なし'}</small></button>`).join('')}</nav><section class="panel"><div class="panel-title"><h3>${M.slots.find(x=>x[0]===slot)[1]}</h3><label class="switch"><input type="checkbox" data-bind="${p}.enabled" ${s.enabled?'checked':''}> この枠を使う</label></div>${s.enabled?`<div class="form-grid">${field('カード固有の行動名',p+'.name',s.name,{placeholder:'このカードだけの名称'})}${slot==='ultimate'?number('発動に必要なターン',p+'.turns',s.turns,'カード上では「5T」などと表示'):''}${field('共通の発動時点',p+'.trigger',s.trigger,{placeholder:'戦闘開始時 / 毎ターン開始時 など'})}${field('共通の発動条件',p+'.condition',s.condition,{placeholder:'HP50%以下 など'})}</div>`:'<p class="muted">カード上には「なし」と表示します。入力済みの内容は保持します。</p>'}</section>${s.enabled?`${s.effects.map((e,i)=>effectForm(e,i)).join('')}<button class="add-effect" data-action="add-effect" ${s.effects.length>=2?'disabled':''}>＋ 効果を追加 <small>${s.effects.length} / 2</small></button><p class="muted">同じ対象で条件により量だけが変わる場合は、効果内の「条件別の効果量」を使います。</p>`:''}`;
}
function effectForm(e,i) {
  const p=`card.skills.${slot}.effects.${i}`,def=defs().find(x=>x.id===e.typeId);
  return `<section class="panel effect-editor" data-effect-index="${i}"><div class="panel-title"><h3><span class="step-number">${i+1}</span> ${esc(def.name)}</h3><div class="effect-actions"><button class="icon-button" data-action="move-effect" data-index="${i}" title="${i?'上へ':'下へ'}" aria-label="効果${i+1}を${i?'上':'下'}へ" ${current().card.skills[slot].effects.length<2?'disabled':''}>${i?'↑':'↓'}</button><button class="quiet" data-action="duplicate-effect" data-index="${i}" ${current().card.skills[slot].effects.length>=2?'disabled':''}>複製</button><button class="quiet danger" data-action="remove-effect" data-index="${i}">削除</button></div></div><div class="form-grid">${field('効果の種類',p+'.typeId',e.typeId,{select:defs().map(x=>[x.id,x.icon+' '+x.name])})}<div class="field"><span>再利用できる効果定義</span><button data-action="new-definition">＋ 新しい効果種類</button></div></div><div class="target-editor"><div><h4>対象マス</h4>${gridHtml(e.target,true,i)}<p class="muted">${e.target.basis==='relative'?'●はこの行動枠の自身の位置。自身からの相対図。':'●はこの行動枠の自身の位置。対象は陣営ごとの固定位置。'}${e.target.selection==='search'?'枠線はサーチ候補。':'塗ったマス全てが対象。'}</p><div class="preset-buttons">${[['enemyAll','敵全体'],['enemyFront','敵前衛'],['allyFront','味方前衛'],['allyAll','味方全体'],['self','自身'],['clear','クリア']].map(([key,label])=>`<button class="quiet" data-action="target-preset" data-index="${i}" data-preset="${key}">${label}</button>`).join('')}</div></div><div class="target-fields">${field('範囲の基準',p+'.target.basis',e.target.basis,{select:[['absolute','絶対位置'],['relative','自身を基準にした相対位置']]})}${field('対象の決め方',p+'.target.selection',e.target.selection,{select:[['all','範囲内すべて'],['search','範囲からサーチ']]})}${e.target.selection==='search'?`${number('選ぶ対象数',p+'.target.count',e.target.count)}${field('対象決定条件',p+'.target.rule',e.target.rule,{placeholder:'残HPが最も低い対象'})}`:''}</div></div>${e.target.selection==='search'?`<details class="subsection"><summary>同値時・候補なし時の規則</summary>${field('同値時の優先順',p+'.target.tie',e.target.tie)}${field('候補がいない場合',p+'.target.fallback',e.target.fallback,{placeholder:'空欄＝効果を実行しない。代替対象があれば明記'})}</details>`:''}<div class="form-grid effect-amount">${field('効果量の書き方',p+'.amount.mode',e.amount.mode,{select:[['multiplier','能力値 × 倍率'],['fixed','固定値'],['percent','能力値 × 割合（%）'],['expression','自由記述の式'],['none','効果量なし']]})}${e.amount.mode==='expression'?field('式・効果量',p+'.amount.expression',e.amount.expression,{placeholder:'対象のAT×0.5 + 10'}):e.amount.mode!=='none'?field(e.amount.mode==='multiplier'?'倍率':e.amount.mode==='percent'?'割合（%）':'固定値',p+'.amount.value',e.amount.value,{type:'number',min:0,step:e.amount.mode==='multiplier'?.05:'any'}):''}${['multiplier','percent'].includes(e.amount.mode)?field('参照元',p+'.amount.reference',e.amount.reference,{placeholder:'AT / 対象のAT / 自身の最大HP',hint:'自身のATだけ「AT」と略記'}):''}${field('期間',p+'.duration.mode',e.duration.mode,{select:[['instant','即時（表示なし）'],['turns','持続する'],['always','常時']]})}${e.duration.mode==='turns'?number('持続ターン数',p+'.duration.turns',e.duration.turns):''}</div>${field('この効果だけの条件',p+'.condition',e.condition,{placeholder:'対象が毒状態の場合 など'})}<details class="subsection" ${e.alternate.condition?'open':''}><summary>条件別の効果量</summary><div class="form-grid">${field('量が変わる条件',p+'.alternate.condition',e.alternate.condition,{placeholder:'対象が毒'})}${field('条件成立時の量',p+'.alternate.amount',e.alternate.amount,{placeholder:'AT×1.5'})}</div></details>${def.parameters.length?`<div class="form-grid custom-params">${def.parameters.map(param=>field(param.label,p+'.params.'+param.key,e.params[param.key]??'',{type:param.type==='number'?'number':'text',step:'any'})).join('')}</div>`:''}${field('補足する効果内容',p+'.details',e.details,{area:true,placeholder:'付与する状態名、移動先、解除する効果など。新しい効果も短い項目形式で。'})}</section>`;
}
function notesForm(d) {
  return `<div class="section-heading"><h2>設計の意図を残す</h2><p>ここで入力する内容は開発用DBに保存します。</p></div><section class="panel"><div class="form-grid">${field('設計状態','status',d.status,{select:Object.entries(stateNames)})}${field('検索タグ（カンマ区切り）','tags',d.tags.join(', '),{placeholder:'低コスト, 回復, 前衛支援'})}</div></section><section class="panel"><h3>カードコンセプト</h3>${M.conceptFields.map(([key,label,placeholder])=>field(label,'notes.'+key,d.notes[key],{area:true,placeholder})).join('')}</section><section class="panel"><h3>性能評価・検証</h3>${M.evaluationFields.map(([key,label,placeholder])=>field(label,'notes.'+key,d.notes[key],{area:true,placeholder})).join('')}</section>`;
}
function historyForm(d) {
  const log=logs[d.id]||{},v=val=>esc(typeof val==='object'?JSON.stringify(val,null,2):val??'—');
  return `<div class="section-heading"><h2>調整の経緯</h2><p>保存時に変更前後を記録します。検証だけの記録も残せます。</p></div><section class="panel"><h3>今回の記録</h3><label class="field"><span>変更理由・仮説</span><textarea data-log="reason" rows="3" placeholder="なぜ変更したか">${esc(log.reason||'')}</textarea></label><label class="field"><span>検証条件・結果・学び</span><textarea data-log="result" rows="3" placeholder="比較条件、結果、今後に活かすこと">${esc(log.result||'')}</textarea></label><label class="field"><span>今回の判断</span><select data-log="decision">${options(Object.entries(stateNames),log.decision||d.status)}</select></label><p class="muted">内容を入力して右上の「保存」。設計状態は「設計メモ」で変更します。</p></section><div class="timeline">${[...d.history].reverse().map((h,i)=>`<article class="history-entry"><div><span class="history-dot"></span><b>${esc(h.reason)}</b><small>${date(h.at)} · ${esc(stateNames[h.decision]||h.decision)}</small></div>${h.result?`<p class="prewrap">${esc(h.result)}</p>`:''}<details><summary>変更内容 ${h.changes.length}項目</summary>${h.changes.map(change=>`<div class="change"><code>${esc(change.path)}</code><div><pre>${v(change.before)}</pre><span>→</span><pre>${v(change.after)}</pre></div></div>`).join('')||'<p>検証・判断のみの記録</p>'}</details></article>`).join('')||'<p class="muted">最初の保存で、ここに履歴が残ります。</p>'}</div>`;
}
function tip(label,description,display=label) {return `<button class="term" data-help="${esc(description)}" data-help-title="${esc(label)}" aria-label="${esc(label)}の説明">${esc(display)}</button>`;}
function renderPreview() {
  const d=current();if(!d)return;const c=d.card,warnings=M.warnings(d);
  $('#preview').innerHTML=`<div class="section-label">LIVE PREVIEW <span>カード詳細</span></div><article class="preview-card"><div class="preview-art ${c.artwork?'has-art':''}">${c.artwork?`<img src="${esc(c.artwork)}" alt="${esc(c.name)}のイラスト">`:'<span>✧</span>'}<div class="cost-tokens"><b>${c.cost}</b><b>α${c.alphaCost}</b></div><span class="rarity r-${c.rarity}">${c.rarity}</span></div><div class="preview-core"><h2>${esc(c.name||'名称未設定')}</h2><div class="preview-meta">${tip(c.classification,`${c.classification}。カードが属する生物・存在のまとまり。分類そのものに共通効果はありません。`,M.classIcons[c.classification]||'◈')}<div class="terrain-icons">${c.terrains.map(name=>tip('得意地形',`得意地形はカードが得意とする地形です。このカードの得意地形：${c.terrains.join('・')}。各地形での具体的な補正はゲームの地形定義に従います。`,M.terrains.find(x=>x[0]===name)?.[1]||'◇')).join('')}</div></div><div class="preview-stats">${[['HP',c.hp],['AT',c.at],['AG',c.ag]].map(([k,n])=>`<div><small>${k}</small><b>${n}</b></div>`).join('')}</div><div class="preview-traits"><small>特性</small><div>${c.traits.length?c.traits.map(t=>tip(t.name,[t.description||'説明未入力',t.effectAmount?'効果量：'+t.effectAmount:''].filter(Boolean).join('\n'),t.name+t.value+(t.effectAmount?' / '+t.effectAmount:''))).join(''):'なし'}</div></div>${[['alpha','αスキル'],['ultimate','必殺技'],['front','前衛行動'],['middle','中衛行動'],['rear','後衛行動']].map(([key,label])=>{
    const s=c.skills[key];return `<section class="preview-skill"><div class="preview-skill-title"><small>${label}</small>${s.enabled&&key==='ultimate'?tip('必殺技の必要ターン',`発動に必要なターン：${s.turns}T。効果の持続期間とは別の値です。`,s.turns+'T'):''}</div>${s.enabled?`<h3>${esc(s.name||'名称未設定')}</h3>${s.trigger||s.condition?`<p class="condition">${esc([s.trigger,s.condition].filter(Boolean).join(' / '))}</p>`:''}${s.effects.map((e,i)=>{const def=defs().find(f=>f.id===e.typeId);return `<div class="preview-effect">${gridHtml(e.target,false,i,key)}<div class="effect-description"><b>${tip(def.name,def.description,def.icon)} ${esc(M.effectText(e,defs()))}</b>${e.target.selection==='search'?`<p>${esc(e.target.rule)}・${e.target.count}体</p>${e.target.tie?`<p class="muted">同値：${esc(e.target.tie)}</p>`:''}${e.target.fallback?`<p>候補なし：${esc(e.target.fallback)}</p>`:''}`:''}${e.target.basis==='relative'?'<p class="muted">相対範囲（●が自身）</p>':''}${e.condition?`<p class="condition">条件：${esc(e.condition)}</p>`:''}${Object.keys(e.params).length?`<p>${def.parameters.filter(p=>e.params[p.key]!==undefined&&e.params[p.key]!=='').map(p=>`${esc(p.label)}：${esc(e.params[p.key])}`).join(' / ')}</p>`:''}${e.details?`<p class="prewrap">${esc(e.details)}</p>`:''}</div></div>`;}).join('')}`:'<p class="none">なし</p>'}</section>`;
  }).join('')}</div></article><details class="readiness" ${warnings.length?'':'open'}><summary>${warnings.length?`○ 作りかけの項目 ${warnings.length}`:'✓ 基本項目を入力済み'}</summary>${warnings.length?`<ul>${warnings.map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p>下書きのまま保存できます。</p>`:'<p>効果の実装・バランス検証は採用時に確認します。</p>'}</details><p class="preview-caption">表示規格の確認用プレビュー<br>設計内容のゲームへの登録は未実施</p>`;
}
function showDialog(html) {$('#dialog-body').innerHTML=html;if(!$('#dialog').open)$('#dialog').showModal();}
function newDialog() {showDialog(`<div class="dialog-heading"><div><span class="eyebrow">NEW DESIGN</span><h2>新しいカード</h2></div><button data-action="close-dialog" aria-label="閉じる">×</button></div><p>入力例を選んで、自由に作り替えられます。</p><div class="starter-grid">${[['blank','＋','白紙から'],['attack','⚔','攻撃型から'],['support','✚','支援型から']].map(([key,icon,label])=>`<button data-template="${key}"><span>${icon}</span><b>${label}</b></button>`).join('')}</div>`);}
function addCard(kind) {if(!ready)return;const d=M.template(kind);library.cards.unshift(d);selected=d.id;tab='basic';markDirty();$('#dialog').close();refresh();}
function catalogDialog() {showDialog(`<div class="dialog-heading"><div><span class="eyebrow">EFFECT CATALOG</span><h2>効果の定義</h2></div><button data-action="close-dialog" aria-label="閉じる">×</button></div><p>定義を追加すると、全カードの「効果の種類」から選べます。</p><button class="primary" data-action="new-definition">＋ 新しい効果種類</button><div class="catalog-list">${defs().map(def=>`<div><span class="catalog-icon">${esc(def.icon)}</span><div><b>${esc(def.name)}</b><code>${esc(def.id)}</code><small>${esc(def.description)}</small></div>${library.definitions.some(x=>x.id===def.id)?`<button class="quiet" data-edit-definition="${esc(def.id)}">編集</button>`:'<small>標準</small>'}</div>`).join('')}</div><p class="muted">ここで追加するのは設計用の定義です。戦闘処理への接続は採用時に実装します。</p>`);}
function definitionDialog(editId='') {
  const def=library.definitions.find(x=>x.id===editId)||{id:'',name:'',icon:'◇',description:'',parameters:[]};
  showDialog(`<div class="dialog-heading"><h2>${editId?'効果定義を編集':'新しい効果種類'}</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div><form id="definition-form" data-edit-id="${esc(editId)}"><div class="form-grid"><label class="field"><span>効果名</span><input name="name" required maxlength="60" value="${esc(def.name)}" placeholder="例：障壁付与"></label><label class="field"><span>種類アイコン</span><input name="icon" required maxlength="8" value="${esc(def.icon)}"></label></div><label class="field"><span>定義ID（英小文字から始まる英数・_・-）</span><input name="id" required value="${esc(def.id)}" placeholder="barrier" ${editId?'readonly':''}></label><label class="field"><span>効果の説明</span><textarea name="description" rows="3" placeholder="どのような効果か。細かい条件や量はカードごとに設定。">${esc(def.description)}</textarea></label><h3>追加の入力項目 <small>任意</small></h3><p class="muted">対象・量・期間に加え、効果専用の項目を作れます。</p><div id="parameter-rows">${def.parameters.map(p=>parameterRow(p)).join('')}</div><button type="button" data-action="add-parameter">＋ 入力項目</button><p id="definition-error" class="error-text" role="alert"></p><div class="dialog-footer"><button type="button" data-action="catalog">戻る</button><button class="primary" type="submit">${editId?'定義を更新':'定義を追加'}</button></div></form>`);
}
function parameterRow(p={key:'',label:'',type:'text'}) {return `<div class="parameter-row"><label><span>項目名</span><input data-param="label" required value="${esc(p.label)}" placeholder="障壁名"></label><label><span>キー</span><input data-param="key" required pattern="[a-z][a-zA-Z0-9_]{0,39}" value="${esc(p.key)}" placeholder="barrierName"></label><label><span>入力形式</span><select data-param="type">${options([['text','文字'],['number','数値']],p.type)}</select></label><button type="button" data-action="remove-parameter" aria-label="入力項目を削除">×</button></div>`;}
function download(filename,obj) {const url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function save() {
  if(!ready||saving||!dirty)return;
  let next;try {next=M.prepareSave(library,baseline,logs);if(new TextEncoder().encode(JSON.stringify(next)).length>25*1024*1024)throw Error('DBが25MiBを超えています。DBを書き出して退避し、登録画像を小さくしてから保存してください。');}catch(e){toast(e.message,true);return;}
  saving=true;$('#save').disabled=true;$('.workspace').inert=true;$('.top-actions').inert=true;$('#save-state').textContent='保存中…';
  try {
    library=M.validateLibrary(await storage.save(next));baseline=M.clone(library);dirty=false;logs={};$('#save-state').textContent='✓ 保存済み '+new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});toast(storage.mode==='device'?'この端末に保存しました。PCへ移すときは「DB書き出し」を使ってください。':'開発用DBに保存しました。');refresh();
  } catch(e) {toast(e.message,true);$('#save-state').textContent='● 保存できませんでした';}
  finally {saving=false;$('.workspace').inert=false;$('.top-actions').inert=false;$('#save').disabled=!dirty;}
}
function setPath(obj,path,value) {const keys=path.split('.');const last=keys.pop();for(const key of keys)obj=obj[key];obj[last]=value;}
function changeBound(el) {
  const d=current();if(!d)return;
  const path=el.dataset.bind;
  let value=el.type==='checkbox'?el.checked:el.type==='number'?(Number.isFinite(el.valueAsNumber)?el.valueAsNumber:0):el.value;
  if(path==='tags')value=value.split(/[,、]/).map(x=>x.trim()).filter(Boolean);
  if(path.endsWith('.typeId')) {
    const parts=path.split('.');parts.pop();let e=d;for(const k of parts)e=e[k];e.params={};
  }
  if(path.endsWith('.target.basis')) {
    const e=d.card.skills[slot].effects[Number(path.split('.')[4])];M.changeTargetBasis(e.target,slot,value);
  }
  if(/^card\.traits\.\d+\.definitionId$/.test(path)) {
    const trait=d.card.traits[Number(path.split('.')[2])],def=M.traitDefinitions(library).find(x=>x.id===value);
    if(def){trait.name=def.name;trait.description=def.description;}
  }
  setPath(d,path,value);markDirty();renderPreview();renderLibrary();
  if(path==='card.name')$('#editor-title').textContent=value||'名称未設定';
}
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.dataset.bind&&el.tagName!=='SELECT'&&el.type!=='checkbox')changeBound(el);
  if(el.dataset.log) {logs[selected]||={};logs[selected][el.dataset.log]=el.value;markDirty();}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.dataset.bind&&(el.tagName==='SELECT'||el.type==='checkbox')){changeBound(el);renderEditor();}
  if(el.dataset.terrain) {const c=current().card;c.terrains=el.checked?[...c.terrains,el.dataset.terrain]:c.terrains.filter(x=>x!==el.dataset.terrain);markDirty();renderPreview();}
});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.template){addCard(button.dataset.template);return;}
  if(button.dataset.open){selected=button.dataset.open;refresh();return;}
  if(button.dataset.tab){tab=button.dataset.tab;renderEditor();return;}
  if(button.dataset.slot){slot=button.dataset.slot;renderEditor();return;}
  if(button.dataset.help!==undefined){showDialog(`<div class="dialog-heading"><h2>${esc(button.dataset.helpTitle)}</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div><p class="prewrap">${esc(button.dataset.help)}</p>`);return;}
  if(button.dataset.editDefinition){definitionDialog(button.dataset.editDefinition);return;}
  const action=button.dataset.action,d=current(),i=Number(button.dataset.index),s=d?.card.skills[slot];
  if(!action)return;
  if(action==='close-dialog'){$('#dialog').close();return;}
  if(action==='catalog'){catalogDialog();return;}
  if(action==='export-backup'){storage.latestBackup().then(data=>data?download('card-studio-backup.json',data):toast('更新前のバックアップはまだありません。')).catch(e=>toast(e.message,true));return;}
  if(action==='new-definition'){definitionDialog();return;}
  if(action==='add-parameter'){if($('#parameter-rows').children.length<20)$('#parameter-rows').insertAdjacentHTML('beforeend',parameterRow());return;}
  if(action==='remove-parameter'){button.closest('.parameter-row').remove();return;}
  if(action==='upload-art'){$('#art-file').click();return;}
  if(action==='export-card'){download(`card-spec-${d.id}.json`,{...M.exportCard(d),traitDefinitions:M.clone(M.traitDefinitions(library).filter(def=>d.card.traits.some(t=>t.definitionId===def.id))),definitions:M.clone(defs().filter(def=>Object.values(d.card.skills).some(sk=>sk.effects.some(e=>e.typeId===def.id))))});return;}
  if(action==='add-terrain'){showDialog('<div class="dialog-heading"><h2>地形名を追加</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div><form id="terrain-form"><label class="field"><span>新しい地形名</span><input name="terrain" required maxlength="30"></label><p class="muted">設計用の地形名です。補正と専用アイコンは採用時に実装します。</p><button class="primary">追加</button></form>');return;}
  if(action==='duplicate'){const copy=M.duplicate(d);library.cards.unshift(copy);selected=copy.id;tab='basic';}
  if(action==='clear-art')d.card.artwork='';
  if(action==='new-trait-definition'){traitDefinitionDialog();return;}
  if(action==='add-trait')d.card.traits.push({definitionId:'',name:'',value:'',effectAmount:'',description:''});
  if(action==='remove-trait')d.card.traits.splice(i,1);
  if(action==='add-effect'&&s.effects.length<2)s.effects.push(M.effect());
  if(action==='duplicate-effect'&&s.effects.length<2){const e=M.clone(s.effects[i]);e.id=M.id('fx');s.effects.splice(i+1,0,e);}
  if(action==='remove-effect')s.effects.splice(i,1);
  if(action==='move-effect'&&s.effects.length===2)s.effects.reverse();
  if(action==='cell'){const t=s.effects[i].target,side=button.dataset.side,cell=Number(button.dataset.cell);M.toggleTargetCell(t,side,slot,cell);markDirty();button.classList.toggle('selected');button.setAttribute('aria-pressed',String(M.targetCells(t,side,slot).includes(cell)));renderPreview();return;}
  if(action==='target-preset') {
    const t=s.effects[i].target,key=button.dataset.preset;t.ally=[];t.enemy=[];delete t.allyOffsets;
    if(key==='enemyAll')t.enemy=[0,1,2,3,4,5,6,7,8];
    if(key==='enemyFront')t.enemy=[0,3,6];
    if(key==='allyAll')t.ally=[0,1,2,3,4,5,6,7,8];
    if(key==='allyFront')t.ally=[0,3,6];
    if(key==='self'){t.ally=[4];t.basis='relative';t.selection='all';}else t.basis='absolute';
  }
  markDirty();refresh();
});
document.addEventListener('submit',event=>{
  const form=event.target;event.preventDefault();
  if(form.getAttribute('id')==='trait-definition-form') {
    const values=new FormData(form),def={id:M.id('trait'),name:values.get('traitName').trim(),description:values.get('description').trim()},next=M.clone(library);
    next.traitDefinitions||=[];next.traitDefinitions.push(def);
    try {M.validateLibrary(next);library=next;markDirty();$('#dialog').close();refresh();toast(`共通特性「${def.name}」を登録しました。一覧から選べます。`);}catch(e){$('#trait-definition-error').textContent=e.message;}
  }
  if(form.getAttribute('id')==='terrain-form'){const value=new FormData(form).get('terrain').trim();if(value&&!current().card.terrains.includes(value))current().card.terrains.push(value);$('#dialog').close();markDirty();refresh();}
  if(form.getAttribute('id')==='definition-form') {
    const values=new FormData(form),def={id:values.get('id').trim(),name:values.get('name').trim(),icon:values.get('icon').trim(),description:values.get('description').trim(),parameters:[...$('#parameter-rows').children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-param]')].map(el=>[el.dataset.param,el.value.trim()])))},next=M.clone(library),editId=form.dataset.editId;
    const idx=next.definitions.findIndex(x=>x.id===editId);if(idx>=0)next.definitions[idx]=def;else next.definitions.push(def);
    try {M.validateLibrary(next);library=next;markDirty();$('#dialog').close();refresh();toast(`効果定義「${def.name}」を${editId?'更新':'追加'}しました。DB保存で確定します。`);}catch(e){$('#definition-error').textContent=e.message;}
  }
});
$('#new-card').addEventListener('click',newDialog);
$('#catalog').addEventListener('click',catalogDialog);
$('#search').addEventListener('input',renderLibrary);
$('#status-filter').addEventListener('change',renderLibrary);
$('#save').addEventListener('click',save);
$('#export-library').addEventListener('click',()=>download(`card-studio-${new Date().toISOString().slice(0,10)}.json`,M.prepareSave(library,baseline,logs)));
$('#import-library').addEventListener('click',()=>$('#json-file').click());
$('#json-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {if(file.size>25*1024*1024)throw Error('25MiB以下のJSONを指定してください。');const incoming=JSON.parse(await file.text()),result=M.mergeLibraries(library,incoming);library=result.library;selected||=library.cards[0]?.id;markDirty();refresh();toast(`取り込みました：新規${result.added}件、同じIDで内容が異なる設計の複製${result.copied}件。元データは保持しています。保存で確定します。`);}catch(e){toast('取り込めませんでした：'+e.message,true);}finally{event.target.value='';}
});
$('#art-file').addEventListener('change',async event=>{
  const file=event.target.files[0],design=current();if(!file)return;
  try {if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw Error('PNG・JPEG・WebPで2MiB以下の画像を指定してください。');
    const url=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
    await new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=()=>reject(Error('画像を読み取れませんでした。'));img.src=url;});
    design.card.artwork=url;markDirty();refresh();
  }catch(e){toast(e.message,true);}finally{event.target.value='';}
});
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save();}});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
(async()=>{
  try {
    storage=await window.StudioStorage.connect();library=M.validateLibrary(storage.initialLibrary);baseline=M.clone(library);ready=true;selected=library.cards[0]?.id;
    $('#save-state').textContent=storage.mode==='device'?'✓ この端末のDBに接続':'✓ ローカルDBに接続';
    if(storage.mode==='device'){
      $('.library-footer').innerHTML='<div><span class="local-dot"></span> この端末の開発用DB<small>PCとの受け渡しはJSONで</small></div><button class="quiet wide" data-action="export-backup">前回の保存を書き出す</button><button class="quiet wide" data-action="catalog">◇ 効果の定義を管理</button>';
      toast('この端末のブラウザに保存します。サイトデータを消す前やPCへ移すときは「DB書き出し」でファイルに残してください。');
    }
    refresh();
  }
  catch(e){toast('読み込みを停止しました：'+e.message,true);$('.workspace').inert=true;$('.top-actions').inert=true;$('#save-state').textContent='接続できません';}
})();

(async function(){
 'use strict';
 const M=window.TreeModel,$=s=>document.querySelector(s),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const state={library:null,store:null,id:null,tab:'basic',slot:'front',dirty:false,change:0,saving:false,search:'',bindings:new Map(),actions:new Map(),opened:new Set(),pendingSchema:null};
 const card=()=>state.library?.cards.find(x=>x.id===state.id),schema=()=>state.library.schema;
 const pathOf=(base,key)=>base?base+'.'+key:key;
 function notice(text,error=false){const n=$('#notice');n.textContent=text;n.classList.toggle('error',error);n.hidden=false;}
 function mark(){state.dirty=true;state.change++;$('#save-state').textContent='未保存の変更';$('#save').disabled=false;}
 function actionData(callback){const id='a'+state.actions.size;state.actions.set(id,callback);return `data-callback="${id}"`;}
 function bind(form,obj,key,path,ctx,row){const id='b'+state.bindings.size;state.bindings.set(id,{form,obj,key,path,ctx,row});return `data-bind="${esc(path)}" data-binding="${id}"`;}
 function download(value,name){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function options(row,obj,ctx,value){
   const values=M.choices(schema(),row,obj,ctx);let html='<option value="">選択してください</option>';
   if(value!=null&&!values.some(x=>x.id===value))html+=`<option value="${esc(value)}" selected>未定義：${esc(value)}</option>`;
   let prior='';for(const v of values){const group=['candidate','proposal'].includes(v.adoption)?'候補・入力案':v.adoption==='compat'?'既存設定との互換':'登録済み';if(group!==prior){if(prior)html+='</optgroup>';html+=`<optgroup label="${group}">`;prior=group;}html+=`<option value="${esc(v.id)}"${v.id===value?' selected':''}>${esc(v.label)}</option>`;}
   return html+(prior?'</optgroup>':'');
 }
 function renderGrid(value,onToggle,label,{side='ally',relative=false,search=false,forbidden=false}={}){
   const order=side==='ally'?[2,1,0,5,4,3,8,7,6]:[0,1,2,3,4,5,6,7,8];
   return `<div class="board"><div class="board-title"><span>${esc(label)}</span><span>${relative?'相対範囲':'3 × 3'}</span></div><div class="grid-board">${order.map(n=>`<button type="button" class="cell ${search?'search-cell':''} ${forbidden?'forbidden':''}" aria-label="${esc(label)} ${['左','中央','右'][Math.floor(n/3)]}${['前衛','中衛','後衛'][n%3]}" aria-pressed="${(value||[]).includes(n)}" ${actionData(()=>onToggle(n))}>${forbidden&&(value||[]).includes(n)?'×':relative&&n===4?'●':''}</button>`).join('')}</div><div class="board-caption">${relative?'中央●が基準のカード':side==='ally'?'後衛　・　中衛　・　前衛':'前衛　・　中衛　・　後衛'}</div></div>`;
 }
 function field(row,form,obj,path,ctx,depth){
   const value=M.get(obj,row.key),p=pathOf(path,row.key),attrs=()=>bind(form,obj,row.key,p,ctx,row),label=esc(row.label),child=M.resolve(schema(),row,obj,ctx),c=M.context(row,ctx,form,obj);
   const wrap=(html,wide=false)=>`<label class="field ${wide?'wide-field':''}"><span>${label}</span>${html}</label>`;
   if(row.widget==='number')return wrap(`<input ${attrs()} aria-label="${label}" type="number" step="${row.type.includes('integer')?'1':row.constraints.unit==='ratio'?'0.05':'any'}" ${row.constraints.minimum!==undefined?`min="${row.constraints.minimum}"`:''} ${row.constraints.maximum!==undefined?`max="${row.constraints.maximum}"`:''} value="${esc(value)}" placeholder="${row.type.includes('null')?'制限なし':'未入力'}">`);
   if(row.widget==='text')return wrap(`<input ${attrs()} aria-label="${label}" type="text" value="${esc(value)}">`,row.key==='codexText');
   if(row.widget==='select')return wrap(`<select ${attrs()} aria-label="${label}">${options(row,obj,c,value)}</select>`);
   if(row.widget==='toggle')return wrap(`<span><input ${attrs()} aria-label="${label}" type="checkbox"${value?' checked':''}> 有効</span>`);
   if(row.widget==='multi')return `<div class="field wide-field"><span>${label}</span><div class="chip-options">${M.choices(schema(),row,obj,c).map(v=>`<label><input type="checkbox" aria-label="${label} ${esc(v.label)}"${(value||[]).includes(v.id)?' checked':''} ${actionData(()=>{const next=(M.get(obj,row.key)||[]).filter(x=>x!==v.id);if(!(M.get(obj,row.key)||[]).includes(v.id))next.push(v.id);M.set(obj,row.key,next);mark();render();})}>${esc(v.label)}</label>`).join('')}</div></div>`;
   if(row.widget==='grid')return renderGrid(value,n=>{const next=(M.get(obj,row.key)||[]).includes(n)?value.filter(x=>x!==n):[...(value||[]),n].sort((a,b)=>a-b);M.set(obj,row.key,next);mark();render();},row.label,{forbidden:row.key==='initialPlacementForbidden'});
   if(row.widget==='image')return '';
   if(row.widget==='json')return wrap(`<textarea ${attrs()} data-json="true" aria-label="${label}">${esc(JSON.stringify(value??{},null,2))}</textarea>`,true);
   if(row.widget==='parameterValue'){
     const param=M.parameterFields(schema(),ctx.effect||{}).find(r=>r.key===obj.parameter);
     if(!param)return '<p class="hint">先に変更する項目を選んでください。</p>';
     return field({...param,id:row.id,key:row.key,label:row.label},form,obj,path,ctx,depth);
   }
   if(row.widget==='form'){
     if(!child)return `<p class="hint">${form==='effect'?'付与する状態':'定義'}を選ぶと、専用の入力が現れます。</p>`;
     if(!M.plain(value))return `<button type="button" class="optional-add" ${actionData(()=>{M.set(obj,row.key,M.defaults(schema(),child,{},c));mark();render();})}>＋ ${label}を設定</button>`;
     const body=renderForm(child,value,p,c,depth+1);
     const removable=['alternate','fieldDuration'].includes(row.key)?`<button class="text-button" ${actionData(()=>{M.set(obj,row.key,null);mark();render();})}>この設定を外す</button>`:'';
     return `<fieldset class="input-group${body?'':' empty-group'}" data-form="${esc(child)}"><legend>${label}</legend>${body||'<p class="empty-param">追加の数値設定はありません。</p>'}${removable}</fieldset>`;
   }
   if(row.widget==='list'){
     const items=value||[],limit=row.constraints.maxItemsByContext?.[ctx.slot]??row.constraints.maxItemsByContext?.default??(child==='predicate'?40:50);
     const listLabel=label.replace(/を追加$/,'');
     return `<div class="wide-field"><div class="section-heading"><h2>${listLabel}</h2><span class="hint">${items.length}件</span></div>${items.map((x,i)=>`<section class="array-item"><div class="array-head"><span>${listLabel} ${i+1}</span><button ${actionData(()=>{items.splice(i,1);mark();render();})}>削除</button></div>${renderForm(child,x,p+'.'+i,c,depth+1)}</section>`).join('')}<button class="add-button"${items.length>=limit||depth>=9?' disabled':''} ${actionData(()=>{const a=M.get(obj,row.key)||[];a.push(M.defaults(schema(),child,{},c));M.set(obj,row.key,a);mark();render();})}>＋ ${listLabel}を追加</button></div>`;
   }return '';
 }
 function configured(rows,obj){return rows.filter(r=>{const v=M.get(obj,r.key);return v!==undefined&&v!==null&&JSON.stringify(v)!==JSON.stringify(r.default);}).length;}
 function rowsHtml(rows,form,obj,path,ctx,depth=0){return rows.map(r=>field(r,form,obj,path,ctx,depth)).join('');}
 function renderForm(form,obj,path,ctx={},depth=0,exclude=[]){
   if(depth>12)return '<p class="hint">条件の階層が深すぎます。</p>';
   if(form==='area')return areaForm(obj,path,ctx);
   const rows=(schema().forms[form]||[]).filter(r=>r.view!=='auto'&&!exclude.includes(r.key)&&M.visible(r,obj,ctx));
   const basic=rows.filter(r=>r.view==='basic'),details=rows.filter(r=>r.view==='detail');
   let html=rowsHtml(basic,form,obj,path,ctx,depth);
   if(form==='target')html=targetPresets(obj,path)+html;
   if(details.length){const n=configured(details,obj),key=path+'.details';html+=`<details class="details" data-open-key="${esc(key)}"${state.opened.has(key)?' open':''}><summary>詳細設定 ${n?`<span class="badge">設定あり ${n}</span>`:''}</summary><div class="form-grid">${rowsHtml(details,form,obj,path,ctx,depth)}</div></details>`;}
   return html?`<div class="form-grid" data-form-content="${esc(form)}">${html}</div>`:'';
 }
 function targetPresets(obj,path){
   const presets=[['self','自身'],['allyFront','味方前衛'],['enemyFront','敵前衛'],['enemyAll','敵全体'],['lowHP','低HPの敵1体']];
   return `<div class="target-presets wide-field">${presets.map(([id,name])=>`<button type="button" data-preset="${id}" data-target-path="${esc(path)}" ${actionData(()=>{if(id==='self'){obj.mode='context';obj.source='self';}else{obj.mode=id==='lowHP'?'search':'area';obj.area={basis:'absolute',ally:id==='allyFront'?[0,3,6]:[],enemy:id==='enemyFront'?[0,3,6]:id==='allyFront'?[]:[0,1,2,3,4,5,6,7,8]};if(id==='lowHP'){obj.pick='rank';obj.sortStat='currentHP';obj.direction='asc';obj.count=1;}}M.defaults(schema(),'target',obj);mark();render();})}>${name}</button>`).join('')}</div>`;
 }
 function areaForm(obj,path,ctx){
   const row=schema().forms.area.find(r=>r.key==='basis');
   function toggle(side,n){const values=obj[side]||[];obj[side]=values.includes(n)?values.filter(x=>x!==n):[...values,n].sort((a,b)=>a-b);mark();render();}
   return `<div class="form-grid">${field(row,'area',obj,path,ctx,0)}<div class="range-wrapper">${['ally','enemy'].map(side=>renderGrid(obj[side],n=>toggle(side,n),side==='ally'?'味方の範囲':'敵の範囲',{side,relative:obj.basis==='relative',search:ctx.effect?.target?.mode==='search'})).join('')}</div>${obj.basis==='relative'?'<p class="hint wide-field">中央●を基準にした相対位置。配置する衛が変わっても同じ相対範囲を使います。</p>':''}</div>`;
 }
 function library(){
   const d=state.library;$('#count').textContent=d.cards.length;$('#archives').hidden=!d.legacyArchives.length;
   const cards=d.cards.filter(x=>!state.search||JSON.stringify([x.card,x.notes]).toLowerCase().includes(state.search.toLowerCase()));
   $('#card-list').innerHTML=cards.length?cards.map(x=>`<button class="card-list-item${x.id===state.id?' active':''}" data-card="${esc(x.id)}"><b>${esc(x.card.name||'名称未入力')}</b><small>${esc(M.label(schema(),'class',x.card.classification))} · COST ${esc(x.card.cost??'—')} · ${Object.values(x.card.skills||{}).filter(s=>s.mode!=='none').length}行動</small></button>`).join(''):'<p class="empty-list">ここにカードが並びます</p>';
 }
 function basicEditor(d){
   const rows=schema().forms.card, row=key=>rows.find(r=>r.key===key), f=key=>field(row(key),'card',d.card,'card',{},0);
   const art=/^data:image\/(png|jpeg|webp);base64,/.test(d.card.artwork||'')?`<img src="${esc(d.card.artwork)}" alt="カードのイラスト">`:'<span class="art-symbol">✧</span><small>ILLUSTRATION</small>';
   return `<div class="section-heading"><div><h2>カードの基本情報</h2><p>個性を決める数値と分類を設定します。</p></div><span class="badge">BASE</span></div><div class="basic-top"><div class="art-box">${art}<button data-action="art">${d.card.artwork?'画像を変更':'画像を選ぶ'}</button>${d.card.artwork?'<button data-action="clear-art">画像を外す</button>':''}</div><div class="form-grid">${['name','classification','rarity'].map(f).join('')}</div></div><div class="form-grid">${['cost','alphaCost'].map(f).join('')}</div><div class="stat-grid">${['hp','at','ag'].map(f).join('')}</div>${renderForm('card',d.card,'card',{},0,['name','classification','rarity','artwork','cost','alphaCost','hp','at','ag','traits',...['front','middle','rear','ultimate','alpha'].map(s=>'skills.'+s)])}`;
 }
 function effectsEditor(d){
   const slot=state.slot,skill=d.card.skills[slot],limit=slot==='ultimate'?3:2,ctx={slot};
   const enabled=skill.mode==='custom';
   const slotButtons=schema().enums.slot.map(v=>{const x=d.card.skills[v.id];return `<button data-slot="${esc(v.id)}" class="${slot===v.id?'active':''}" aria-pressed="${slot===v.id}">${esc(v.label)}<small>${x.mode==='custom'?`${x.effects?.length||0}効果`:x.mode==='preset'?'登録済み':'なし'}</small></button>`;}).join('');
   let h=`<div class="slot-tabs">${slotButtons}</div>${renderForm('skill',skill,'card.skills.'+slot,ctx,0,['effects','repeatCount','condition'])}`;
   if(enabled){
     h+=(skill.effects||[]).map((e,i)=>`<section class="effect-box" data-effect-index="${i}"><header class="effect-head"><span class="index">${String(i+1).padStart(2,'0')}</span><b>${esc(e.type==='status'?(schema().definitions.state[e.stateId]?.label||'状態付与'):M.label(schema(),'effectType',e.type))}</b>${e.type==='status'&&schema().definitions.state[e.stateId]?.adoption==='candidate'?'<span class="badge pending">候補</span>':''}<button aria-label="効果${i+1}を上へ"${i===0?' disabled':''} ${actionData(()=>{[skill.effects[i-1],skill.effects[i]]=[skill.effects[i],skill.effects[i-1]];mark();render();})}>↑</button><button aria-label="効果${i+1}を下へ"${i===skill.effects.length-1?' disabled':''} ${actionData(()=>{[skill.effects[i+1],skill.effects[i]]=[skill.effects[i],skill.effects[i+1]];mark();render();})}>↓</button><button aria-label="効果${i+1}を削除" ${actionData(()=>{skill.effects.splice(i,1);mark();render();})}>×</button></header><div class="effect-body">${renderForm('effect',e,`card.skills.${slot}.effects.${i}`,{slot,effect:e})}</div></section>`).join('');
     h+=`<button class="add-button" data-action="add-effect"${skill.effects?.length>=limit?' disabled':''}>＋ 効果を追加 <span class="hint">${skill.effects?.length||0} / ${limit}</span></button>`;
     const rows=schema().forms.skill.filter(r=>['repeatCount','condition'].includes(r.key));
     h+=`<details class="details" data-open-key="skill.${slot}.details"${state.opened.has('skill.'+slot+'.details')?' open':''}><summary>行動全体の条件・繰り返し ${skill.repeatCount>1?`<span class="badge">${skill.repeatCount}セット</span>`:''}</summary><div class="form-grid">${rowsHtml(rows,'skill',skill,'card.skills.'+slot,ctx)}</div></details>`;
   }else if(skill.mode==='none')h+='<p class="effect-list-hint">この位置では行動しません。<br>「効果を組み立てる」を選ぶと入力を始められます。</p>';
   return h;
 }
 function traitsEditor(d){return `<div class="section-heading"><div><h2>共通の特性</h2><p>特性を選び、その特性に必要な値だけを設定します。</p></div><button class="text-button" data-action="catalog">定義を見る ↗</button></div>${field(schema().forms.card.find(r=>r.key==='traits'),'card',d.card,'card',{},0)}<p class="hint">新しい特性は定義DBで追加します。自然言語での説明はこのチャットで固定キー・条件・数値へ整理できます。</p>`;}
 function render(){
   state.bindings.clear();state.actions.clear();library();const d=card();
   if(!d){$('#editor').innerHTML=`<section class="welcome"><span class="eyebrow">DESIGN WITH LESS</span><h1>必要な項目だけで、<br>次の一枚を。</h1><p>効果を選ぶと、それに合う入力が現れます。<br>細かな条件は必要になったときに。カードの姿は右側で確認できます。</p><div class="starter"><button data-template="blank"><span>＋</span>白紙から<small>基本情報から始める</small></button><button data-template="attack"><span>↗</span>攻撃型<small>低HPの敵をサーチ</small></button><button data-template="defense"><span>◇</span>防御型<small>被ダメ倍率を指定</small></button></div><p class="hint">テンプレートは入力例です。数値・効果は自由に変更できます。</p></section>`;$('#preview').innerHTML='<div class="card-preview"><div class="preview-art">✧</div><div class="preview-copy"><div class="preview-name">まだ見ぬ一枚</div><p class="hint">カードを作ると、ここに表示されます。</p></div></div>';return;}
   $('#editor').innerHTML=`<div class="editor-heading"><div><span class="eyebrow">CARD WORKSPACE</span><h1 id="card-heading">${esc(d.card.name||'名称未入力')}</h1></div><div class="actions"><button data-action="duplicate">複製</button><button data-action="spec">設計JSON</button></div></div><nav class="tabs" aria-label="カードの編集項目">${[['basic','基本情報'],['effects','行動'],['traits','特性'],['notes','メモ']].map(([id,label],i)=>`<button data-tab="${id}" class="${state.tab===id?'active':''}" aria-pressed="${state.tab===id}"><span class="tab-no">0${i+1}</span>${label}</button>`).join('')}</nav><div id="fields">${state.tab==='basic'?basicEditor(d):state.tab==='effects'?effectsEditor(d):state.tab==='traits'?traitsEditor(d):`<div class="notes"><div class="section-heading"><h2>設計メモ</h2><span class="hint">任意</span></div><label class="field"><span>意図・調整内容</span><textarea id="notes" aria-label="設計メモ" placeholder="このカードで実現したいこと、試した結果など">${esc(d.notes)}</textarea></label><p class="hint">保存履歴 ${d.history.length}件</p><button data-action="history">過去の保存を確認</button></div>`}</div>`;
   document.querySelectorAll('details[data-open-key]').forEach(el=>el.addEventListener('toggle',()=>{if(el.open)state.opened.add(el.dataset.openKey);else state.opened.delete(el.dataset.openKey);}));
   preview();
 }
 function preview(){
   const d=card();if(!d)return;const c=d.card,sc=schema(),issue=M.issues(sc,'card',c);
   const art=/^data:image\/(png|jpeg|webp);base64,/.test(c.artwork||'')?`<img src="${esc(c.artwork)}" alt="カードのイラスト">`:'✧';
   const traits=(c.traits||[]).map(t=>{const def=sc.definitions.trait[t.definitionId];return `${def?.label||'特性未設定'}${Object.entries(t.params||{}).map(([k,v])=>' '+(sc.forms[def?.formId]?.find(r=>r.key===k)?.label||k)+':'+(typeof v==='object'?M.quantityText(sc,v):v)).join('')}`;}).join(' / ');
   $('#preview').innerHTML=`<div class="card-preview"><div class="preview-art">${art}<span class="cost-badge">${esc(c.cost??'—')}</span><span class="rarity">${esc(c.rarity||'')}</span></div><div class="preview-copy"><div class="preview-name">${esc(c.name||'名称未入力')}</div><div class="preview-meta">${esc(M.label(sc,'class',c.classification))} · α${esc(c.alphaCost??'—')} ${c.terrains?.length?'· '+c.terrains.map(x=>esc(M.label(sc,'terrain',x))).join(' / '):''}</div><div class="preview-stats">${[['hp','HP'],['at','AT'],['ag','AG']].map(([key,l])=>`<div><small>${l}</small><b>${esc(c[key]??'—')}</b></div>`).join('')}</div><div class="preview-traits">特性：${esc(traits||'なし')}</div>${sc.enums.slot.map(s=>{const x=c.skills[s.id];if(!x||x.mode==='none')return `<section class="preview-skill"><h4>${esc(s.label)}<span>—</span></h4></section>`;return `<section class="preview-skill"><h4>${esc(s.label)}<span>${s.id==='ultimate'?esc(x.turns)+'T':''}</span></h4><b>${esc(x.mode==='preset'?sc.definitions.alpha[x.presetId]?.label||'未設定':x.name||'名称未設定')}</b>${x.mode==='custom'?(x.effects||[]).map((e,i)=>`<p>${x.effects.length>1?(i+1)+'. ':''}${esc(M.effectText(sc,e))}</p>`).join(''):''}${x.trigger?.event&&x.trigger.event!=='inherit'?`<p>${esc(M.label(sc,'event',x.trigger.event))}${x.trigger.turn?' '+esc(x.trigger.turn)+'T':''}</p>`:''}${x.repeatCount>1?`<p>［上の効果を順に］× ${esc(x.repeatCount)}セット</p>`:''}${x.condition?.kind&&x.condition.kind!=='none'?'<p>行動の発動条件あり</p>':''}</section>`;}).join('')}${c.initialPlacementForbidden?.length?`<p class="hint">初期配置：${c.initialPlacementForbidden.length}マス禁止</p>`:''}${c.deckLimit!=null?`<p class="hint">${esc(c.deckLimit)}枚制限</p>`:''}</div></div><div class="preview-foot"><span class="badge">${issue.length?`記入待ち ${issue.length}`:'入力済み'}</span>${issue.length?`<ul class="review-list">${issue.slice(0,5).map(x=>`<li>${esc(x.path)}：${esc(x.message)}</li>`).join('')}</ul>`:''}<p>入力途中でも保存できます。<br>候補のルールやゲームへの反映は別途確認します。</p></div>`;
   if($('#card-heading'))$('#card-heading').textContent=c.name||'名称未入力';
 }
 function showDialog(title,body){$('#dialog-body').innerHTML=`<div class="dialog-header"><h2>${esc(title)}</h2><button data-action="close-dialog" aria-label="閉じる">×</button></div>${body}`;if(!$('#dialog').open)$('#dialog').showModal();}
 function catalog(){
   const defs=Object.entries(schema().definitions).flatMap(([cat,ds])=>Object.values(ds).map(d=>({...d,category:cat})));
   showDialog('入力を決める定義DB',`<p class="hint">入力ツリーから生成した定義です。表示条件・選択肢・専用パラメータを更新できます。旧版の定義や保存データは変更しません。</p><div class="dialog-actions"><button data-action="import-schema">定義JSONを取り込む</button><button data-action="export-schema">現在の定義を書き出す</button><button data-action="backup">前回の保存を書き出す</button></div><div class="definition-list">${defs.map(d=>`<div class="definition-row"><b>${esc(d.label)}</b><span class="badge ${d.adoption==='candidate'?'pending':''}">${d.adoption==='candidate'?'候補':d.runtime==='metadata_only'?'分類用の定義':'登録済み'}</span><small>設定する値：${esc((schema().forms[d.formId]||[]).map(r=>r.label).join('・')||'追加なし')}${d.blockers.length?' · 仕様確認・接続待ち':''}</small></div>`).join('')}</div>`);
 }
 async function save(){
   if(state.saving)return;state.saving=true;$('#save').disabled=true;const change=state.change;
   try{
     const next=M.clone(state.library),prior=state.saved?.cards||[];
     for(const d of next.cards){const old=prior.find(x=>x.id===d.id);if(old&&JSON.stringify([old.card,old.notes])!==JSON.stringify([d.card,d.notes]))d.history.push({date:new Date().toISOString(),card:M.clone(old.card),notes:old.notes});d.updatedAt=new Date().toISOString();}
     const saved=await state.store.save(next);state.saved=M.clone(saved);state.library.revision=saved.revision;
     for(const d of state.library.cards){const s=saved.cards.find(x=>x.id===d.id);if(s)d.history=s.history;}
     if(change===state.change){state.dirty=false;$('#save-state').textContent='保存済み';notice('この端末に保存しました。');}else notice('保存中に加えた変更は未保存です。もう一度保存してください。');
   }catch(e){notice(e.message,true);}finally{state.saving=false;$('#save').disabled=!state.dirty;}
 }
 function newCard(kind){const d=M.template(schema(),kind);state.library.cards.push(d);state.id=d.id;state.tab=kind==='blank'?'basic':'effects';state.slot='front';mark();render();$('#dialog').close();}
 function archives(){
   showDialog('旧版データの保管庫',`<p class="hint">旧版のカード・画像・メモ・履歴・能力案を原本のまま保持しています。自由文の能力を自動で効果へ変換しません。</p>${state.library.legacyArchives.map((a,i)=>`<div class="definition-row"><b>${esc(a.date.slice(0,10))} · ${a.data.cards.length}枚</b><p class="hint">${a.data.cards.map(d=>esc(d.card.name)).join(' / ')}</p><button data-archive="${i}">原本JSONを書き出す</button></div>`).join('')}<div class="dialog-actions"><a href="../card-studio/" target="_blank" rel="noopener">旧版で開いて編集する ↗</a></div>`);
 }
 async function command(name){
   const d=card();
   if(name==='save')return save();
   if(name==='new')return showDialog('新しいカード',`<div class="starter"><button data-template="blank">白紙から</button> <button data-template="attack">攻撃型から</button> <button data-template="defense">防御型から</button></div>`);
   if(name==='close-dialog')return $('#dialog').close();
   if(name==='export')return download(state.library,'card-studio-v2-db.json');
   if(name==='import')return $('#json-file').click();
   if(name==='catalog')return catalog();
   if(name==='import-schema')return $('#schema-file').click();
   if(name==='export-schema')return download(schema(),'card-studio-v2-definitions.json');
   if(name==='backup'){const backup=await state.store.backup();if(backup)download(backup,'card-studio-v2-backup.json');else notice('前回の保存はまだありません。');return;}
   if(name==='apply-schema'){
     const candidate=M.applySchema(state.library,state.pendingSchema);
     state.library=candidate;state.pendingSchema=null;mark();$('#dialog').close();render();notice('定義を更新しました。入力値は保持しています。保存するとこの端末に記録されます。');return;
   }
   if(name==='archives')return archives();
   if(!d)return;
   if(name==='duplicate'){const copy=M.clone(d);copy.id=M.uid();copy.card.name+='（コピー）';copy.history=[];copy.createdAt=new Date().toISOString();state.library.cards.push(copy);state.id=copy.id;mark();return render();}
   if(name==='spec')return download(M.specification(schema(),d),'card-design-v2.json');
   if(name==='add-effect'){const skill=d.card.skills[state.slot];if((skill.effects||[]).length>=(state.slot==='ultimate'?3:2))return;skill.effects||=[];skill.effects.push(M.effect(schema()));mark();return render();}
   if(name==='art')return $('#art-file').click();
   if(name==='clear-art'){d.card.artwork='';mark();return render();}
   if(name==='history')return showDialog('保存履歴',d.history.length?d.history.map((h,i)=>`<details class="details"><summary>${esc(h.date)} · ${esc(h.card.name)}</summary><div><pre class="json-view">${esc(JSON.stringify(h,null,2))}</pre></div></details>`).join(''):'<p class="hint">変更して保存すると、変更前の記録がここに残ります。</p>');
 }
 document.addEventListener('click',async event=>{
   const el=event.target.closest('button,a,input[data-callback]');if(!el)return;
   try{
     if(el.dataset.callback){const callback=state.actions.get(el.dataset.callback);if(callback)callback();}
     else if(el.dataset.action)await command(el.dataset.action);
     else if(el.dataset.template)newCard(el.dataset.template);
     else if(el.dataset.tab){state.tab=el.dataset.tab;render();}
     else if(el.dataset.slot){state.slot=el.dataset.slot;render();}
     else if(el.dataset.card){state.id=el.dataset.card;render();}
     else if(el.dataset.archive!==undefined)download(state.library.legacyArchives[Number(el.dataset.archive)].data,'card-studio-v1-original.json');
   }catch(e){notice(e.message,true);}
 });
 function input(event){
   if(event.target.id==='search'){state.search=event.target.value;return library();}
   if(event.target.id==='notes'){card().notes=event.target.value;mark();return;}
   const el=event.target,b=state.bindings.get(el.dataset.binding);if(!b)return;
   if(event.type==='input'&&['SELECT','checkbox'].includes(el.tagName==='SELECT'?'SELECT':el.type))return;
   if(event.type==='change'&&el.tagName!=='SELECT'&&el.type!=='checkbox'&&!el.dataset.json)return;
   let v=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?null:Number(el.value)):el.value;
   if(el.dataset.json){try{v=JSON.parse(v);M.safe(v);}catch{notice('JSONの書式を確認してください。元の値は保持しています。',true);return;}}
   const structural=el.tagName==='SELECT';
   if(structural&&v==='')v=null;
   M.change(schema(),b.obj,b.form,b.key,v,b.ctx);mark();
   if(structural)render();else{preview();library();}
 }
 document.addEventListener('input',input);document.addEventListener('change',input);
 $('#json-file').addEventListener('change',async event=>{try{const f=event.target.files[0];if(!f)return;const result=M.importLibrary(state.library,JSON.parse(await f.text()));state.library=result.library;state.id||=state.library.cards[0]?.id;mark();render();notice(result.message);}catch(e){notice(e.message,true);}finally{event.target.value='';}});
 $('#schema-file').addEventListener('change',async event=>{try{const f=event.target.files[0];if(!f)return;if(f.size>2*1024*1024)throw Error('定義は2MiB以下にしてください。');const next=M.validateSchema(JSON.parse(await f.text()));state.pendingSchema=next;showDialog('定義DBの更新',`<p>入力項目 ${Object.values(next.forms).reduce((n,r)=>n+r.length,0)}件を読み込みました。</p><p class="hint">カードの入力値を保持して、新しい選択肢と表示条件を適用します。現在の定義も履歴に残します。</p><div class="dialog-actions"><button class="primary" data-action="apply-schema">この定義を適用</button><button data-action="close-dialog">キャンセル</button></div>`);}catch(e){notice(e.message,true);}finally{event.target.value='';}});
 $('#art-file').addEventListener('change',async event=>{try{const f=event.target.files[0];if(!f)return;if(!['image/png','image/jpeg','image/webp'].includes(f.type)||f.size>2*1024*1024)throw Error('PNG・JPEG・WebPの2MiB以下の画像を選んでください。');const id=state.id,r=new FileReader();r.onload=()=>{const d=state.library.cards.find(x=>x.id===id);if(d){d.card.artwork=r.result;mark();render();}};r.readAsDataURL(f);}catch(e){notice(e.message,true);}finally{event.target.value='';}});
 document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save();}});
 window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});
 try{
   const response=await fetch('schema.json',{cache:'no-store'});if(!response.ok)throw Error('定義を読み込めません。');const sc=M.validateSchema(await response.json());
   state.store=await window.TreeStorage.connect(sc);state.library=state.store.initial;state.saved=M.clone(state.library);state.id=state.library.cards[0]?.id??null;$('#save-state').textContent='端末のDBに接続';render();
 }catch(e){$('#editor').innerHTML='<p class="loading">起動できませんでした。ページを再読み込みしてください。</p>';notice(e.message,true);}
})();

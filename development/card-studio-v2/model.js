(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TreeModel=factory();})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)), uid=()=>globalThis.crypto.randomUUID();
 const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
 const forbidden=new Set(['__proto__','constructor','prototype']);
 const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const typed=(type,v)=>type.split('|').some(t=>({string:typeof v==='string',number:typeof v==='number'&&Number.isFinite(v),integer:Number.isInteger(v),boolean:typeof v==='boolean',array:Array.isArray(v),object:plain(v),null:v===null}[t]));
 const slots=['front','middle','rear','ultimate','alpha'];
 function safe(value,depth=0){
   if(depth>64)throw Error('データの階層が深すぎます。');
   if(value===null||typeof value==='string'||typeof value==='boolean')return;
   if(typeof value==='number'&&Number.isFinite(value))return;
   if(typeof value!=='object')throw Error('保存できない値が含まれています。');
   if(Array.isArray(value)){if(value.length>10000)throw Error('配列が大きすぎます。');value.forEach(v=>safe(v,depth+1));return;}
   for(const [k,v]of Object.entries(value)){if(forbidden.has(k))throw Error('使用できないキーです。');safe(v,depth+1);}
 }
 function get(o,path){return path.split('.').reduce((v,k)=>v?.[k],o);}
 function set(o,path,value){const ks=path.split('.');if(ks.some(k=>forbidden.has(k)))throw Error('不正な項目キー');const end=ks.pop();for(const k of ks){if(!plain(o[k])&&!Array.isArray(o[k]))o[k]={};o=o[k];}o[end]=value;}
 function matches(clause,obj,ctx={}){
   if(clause.all)return clause.all.every(c=>matches(c,obj,ctx));
   if(clause.any)return clause.any.some(c=>matches(c,obj,ctx));
   if(clause.not)return !matches(clause.not,obj,ctx);
   const v=clause.field.startsWith('$')?ctx[clause.field.slice(1)]:get(obj,clause.field);
   return clause.in.some(x=>JSON.stringify(x)===JSON.stringify(v));
 }
 function visible(row,obj,ctx={}){return row.showIf.every(c=>matches(c,obj,ctx));}
 function choices(schema,row,obj,ctx={}){
   const ref=row.ref||'';
   if(ref.startsWith('enum:'))return schema.enums[ref.slice(5)].map(x=>({...x}));
   if(ref.startsWith('def:'))return Object.values(schema.definitions[ref.slice(4)]).map(x=>({...x}));
   if(ref.startsWith('dynamicChoice:')){
     const map=schema.contract.dynamicChoice, resolved=map[obj[ref.split(':')[1]]];
     return resolved?choices(schema,{ref:resolved},obj,ctx):[];
   }
   if(ref==='context:effectParameters')return parameterFields(schema,ctx.effect||{}).map(x=>({id:x.key,label:x.label}));
   return [];
 }
 function resolve(schema,row,obj,ctx={}){
   const ref=row.ref||'';
   if(ref.startsWith('form:'))return ref.slice(5);
   if(ref.startsWith('dynamic:')){const[,cat,key]=ref.split(':');return schema.definitions[cat]?.[get(obj,key)]?.formId||null;}
   return null;
 }
 function context(row,parent,form,obj){return {...parent,...(form==='effect'?{effect:obj}:{}),...(row.constraints.context||{})};}
 function parameterFields(schema,effect){
   let fields=(schema.forms.effect||[]).filter(r=>visible(r,effect,{})&&(['number','integer'].includes(r.type)||r.key==='amount'));
   fields=fields.filter(r=>!['attackCount','repetitionCount'].includes(r.key));
   if(effect.type==='status'){
     const form=schema.definitions.state[effect.stateId]?.formId;
     fields.push(...(schema.forms[form]||[]).filter(r=>['number','integer'].includes(r.type)||r.ref==='form:quantity').map(r=>({...r,key:'params.'+r.key})));
   }
   return fields;
 }
 function defaults(schema,form,value={},ctx={},depth=0){
   if(depth>12)return value;
   for(const row of schema.forms[form]||[]){
     if(row.view==='auto'||!visible(row,value,ctx))continue;
     let v=get(value,row.key);
     if(v===undefined&&row.default!==null){v=clone(row.default);set(value,row.key,v);}
     const child=resolve(schema,row,value,ctx);
     if(child&&plain(v))defaults(schema,child,v,context(row,ctx,form,value),depth+1);
     if(child&&Array.isArray(v))v.forEach(x=>defaults(schema,child,x,context(row,ctx,form,value),depth+1));
   }return value;
 }
 function change(schema,obj,form,key,value,ctx={}){
   if(form==='effect'&&key==='stateId'&&obj.stateId!==value){
     obj._states||={};
     if(obj.stateId)obj._states[obj.stateId]={params:clone(obj.params||{}),duration:clone(obj.duration||{mode:'turns',turns:2})};
     const prior=obj._states[value],def=schema.definitions.state[value];
     obj.stateId=value;
     obj.params=prior?clone(prior.params):{};
     obj.duration=prior?clone(prior.duration):{mode:'turns',turns:def?.rules.duration??2};
   }else if(form==='trait'&&key==='definitionId'&&obj.definitionId!==value){
     obj._definitions||={};if(obj.definitionId)obj._definitions[obj.definitionId]=clone(obj.params||{});
     obj.definitionId=value;obj.params=clone(obj._definitions[value]||{});
   }else set(obj,key,value);
   return defaults(schema,form,obj,ctx);
 }
 function active(schema,form,value,ctx={},depth=0){
   if(value==null||depth>16)return value;
   const out={};
   for(const row of schema.forms[form]||[]){
     if(row.view==='auto'||!visible(row,value,ctx))continue;
     const v=get(value,row.key);if(v===undefined)continue;
     const child=resolve(schema,row,value,ctx), c=context(row,ctx,form,value);
     let selected=v;
     if(child&&plain(v))selected=active(schema,child,v,c,depth+1);
     if(child&&Array.isArray(v))selected=v.map(x=>active(schema,child,x,c,depth+1));
     if(row.widget==='parameterValue'&&plain(v))selected=active(schema,'quantity',v,c,depth+1);
     set(out,row.key,clone(selected));
   }return out;
 }
 function validateSchema(schema){
   safe(schema);
   if(schema?.schemaVersion!=='card-ui-tree/2.0-draft'||!plain(schema.forms)||!plain(schema.enums)||!plain(schema.definitions)||!plain(schema.contract?.dynamicChoice))throw Error('入力ツリーv2の定義JSONを選んでください。');
   const widgets=new Set(['number','text','select','multi','list','form','image','grid','toggle','json','generated','parameterValue']);
   const types=new Set(['number','integer','string','array','object','boolean','integer|null','number|object']);
   const ids=new Set();let count=0;
   for(const [name,rows]of Object.entries(schema.forms)){
     if(!Array.isArray(rows))throw Error('フォームは配列が必要です。');
     const keys=new Set(rows.map(r=>r.key));
     function check(c){
       if(!plain(c))throw Error('表示条件が不正です。');
       if(c.all||c.any){const group=c.all||c.any;if(!Array.isArray(group))throw Error('表示条件が不正です。');group.forEach(check);return;}
       if(c.not){check(c.not);return;}
       if(typeof c.field!=='string'||!Array.isArray(c.in)||(!keys.has(c.field)&&!['$slot','$allowInherit','$predicateUse'].includes(c.field)))throw Error('表示条件の参照先が不正です。');
     }
     for(const r of rows){
       if(++count>1500||ids.has(r.id)||typeof r.id!=='string'||typeof r.key!=='string'||r.key.split('.').some(x=>!x||forbidden.has(x))||!widgets.has(r.widget)||!types.has(r.type)||!plain(r.constraints)||!Array.isArray(r.showIf)||!['basic','detail','auto'].includes(r.view))throw Error('入力定義のID・型・操作が不正です。');
       ids.add(r.id);r.showIf.forEach(check);
       if(typeof r.label!=='string'||!own(r,'default')||(r.default!==null&&!typed(r.type,r.default)))throw Error('入力定義の既定値の型が不正です。');
       const widgetTypes={number:['number','integer','integer|null'],text:['string'],select:['string'],multi:['array'],list:['array'],form:['object'],image:['string'],grid:['array'],toggle:['boolean'],json:['object'],generated:['string'],parameterValue:['number|object']};
       if(!widgetTypes[r.widget].includes(r.type))throw Error('操作と値の型が一致しません。');
       if(r.widget==='list'&&!Array.isArray(r.default))throw Error('一覧の既定値は配列が必要です。');
       const ref=r.ref||'';
       if(ref.startsWith('form:')&&!schema.forms[ref.slice(5)])throw Error('フォーム参照がありません。');
       if(ref.startsWith('enum:')&&!schema.enums[ref.slice(5)])throw Error('選択肢参照がありません。');
       if(ref.startsWith('def:')&&!schema.definitions[ref.slice(4)])throw Error('共通定義参照がありません。');
       if(ref.startsWith('dynamic:')){const[,cat,key]=ref.split(':');if(!schema.definitions[cat]||!keys.has(key))throw Error('動的フォーム参照が不正です。');}
       if(ref.startsWith('dynamicChoice:')&&!keys.has(ref.slice(14)))throw Error('選択肢を切り替える項目がありません。');
       if(ref&&!/^(form:|enum:|def:|dynamic:|dynamicChoice:|dynamicParameter:|context:effectParameters$)/.test(ref))throw Error('未対応の定義参照です。');
     }
   }
   for(const rows of Object.values(schema.enums)){if(!Array.isArray(rows)||rows.some(x=>!plain(x)||typeof x.id!=='string'||typeof x.label!=='string')||new Set(rows.map(x=>x.id)).size!==rows.length)throw Error('選択肢のID・表示名が不正です。');}
   for(const defs of Object.values(schema.definitions)){if(!plain(defs))throw Error('共通定義の形式が不正です。');for(const [id,d]of Object.entries(defs)){if(!plain(d)||d.id!==id||typeof d.label!=='string'||!schema.forms[d.formId]||!Array.isArray(d.blockers)||!plain(d.rules))throw Error('共通定義の参照が不正です。');}}
   for(const form of ['card','skill','effect','target','area','quantity','duration','trigger','predicate','trait'])if(!schema.forms[form])throw Error('必須の入力定義がありません。');
   const required={card:{name:'string',classification:'string',rarity:'string',cost:'integer',alphaCost:'integer',hp:'integer',at:'integer',ag:'integer',traits:'array',...Object.fromEntries(slots.map(s=>['skills.'+s,'object']))},skill:{mode:'string',effects:'array',repeatCount:'integer',condition:'object'},effect:{type:'string'},area:{basis:'string',ally:'array',enemy:'array'},trait:{definitionId:'string',params:'object'}};
   for(const [form,fields]of Object.entries(required))for(const [key,type]of Object.entries(fields))if(!schema.forms[form].some(r=>r.key===key&&r.type===type&&r.view!=='auto'))throw Error('必須の入力定義がありません：'+form+'.'+key);
   if(JSON.stringify((schema.enums.slot||[]).map(x=>x.id))!==JSON.stringify(slots))throw Error('行動枠のIDと順序は変更できません。');
   for(const cat of ['state','trait','alpha','cell'])if(!plain(schema.definitions[cat]))throw Error('必須の共通定義がありません。');
   for(const ref of Object.values(schema.contract.dynamicChoice))if(typeof ref!=='string'||!(ref.startsWith('enum:')?schema.enums[ref.slice(5)]:ref.startsWith('def:')?schema.definitions[ref.slice(4)]:false))throw Error('動的選択肢の参照がありません。');
   for(const [form,key,ref]of [['card','traits','form:trait'],...slots.map(s=>['card','skills.'+s,'form:skill']),['skill','effects','form:effect']])if(!schema.forms[form].some(r=>r.key===key&&r.ref===ref))throw Error('基本構造のフォーム参照は変更できません。');
   for(const [name,rows]of Object.entries(schema.forms))for(const row of rows){if(row.default===null)continue;const child=resolve(schema,row,{},{});if(child&&plain(row.default))structure(schema,child,row.default);if(child&&Array.isArray(row.default))row.default.forEach(v=>structure(schema,child,v));}
   cardStructure(schema,defaults(schema,'card',{}));
   return schema;
 }
 function structure(schema,form,obj,depth=0){
   if(!plain(obj)||depth>16)throw Error('入力データの構造が不正です：'+form);
   for(const row of schema.forms[form]||[]){
     const v=get(obj,row.key);if(v==null)continue;
     // Fractional/empty numeric drafts remain editable; broken containers cannot render.
     if(!typed(row.type.replace(/integer/g,'number'),v))throw Error('入力データの型が不正です：'+form+'.'+row.key);
     const child=resolve(schema,row,obj);if(child&&plain(v))structure(schema,child,v,depth+1);
     if(child&&Array.isArray(v))v.forEach(x=>structure(schema,child,x,depth+1));
     if(row.widget==='parameterValue'&&plain(v))structure(schema,'quantity',v,depth+1);
   }
 }
 function cardStructure(schema,card){
   structure(schema,'card',card);
   if(!plain(card.skills)||slots.some(slot=>!plain(card.skills[slot])))throw Error('カードの行動枠が不足しています。');
   for(const skill of Object.values(card.skills))if(skill.mode==='custom'&&!Array.isArray(skill.effects))throw Error('効果一覧は配列が必要です。');
 }
 function issues(schema,form,obj,ctx={},path='',depth=0){
   if(depth>12)return [{path,message:'条件の入れ子が深すぎます。'}];
   const found=[];
   for(const row of schema.forms[form]||[]){
     if(row.view==='auto'||!visible(row,obj,ctx))continue;
     const v=get(obj,row.key), p=path?path+' / '+row.label:row.label, c=context(row,ctx,form,obj), lim=row.constraints;
     const err=message=>found.push({path:p,message});
     if(v==null||v===''){
       if(row.view==='basic'&&!row.type.includes('null')&&!['image','json'].includes(row.widget)&&!(form==='skill'&&row.key==='name'))err('未入力');
       continue;
     }
     const valid=typed(row.type,v);
     if(!valid){err('値の型を確認してください');continue;}
     if(typeof v==='number'){
       if(lim.minimum!==undefined&&v<lim.minimum)err(lim.minimum+'以上');
       if(lim.maximum!==undefined&&v>lim.maximum)err(lim.maximum+'以下');
       if(lim.exclusiveMinimum!==undefined&&v<=lim.exclusiveMinimum)err(lim.exclusiveMinimum+'より大きい値');
       if(lim.exclusiveMaximum!==undefined&&v>=lim.exclusiveMaximum)err(lim.exclusiveMaximum+'未満');
     }
     if(row.widget==='select'||row.widget==='multi'){
       const opts=choices(schema,row,obj,c);for(const item of Array.isArray(v)?v:[v])if(!opts.some(o=>o.id===item))err('定義にない選択肢');
     }
     if(row.widget==='grid'&&v.some(x=>!Number.isInteger(x)||x<0||x>8))err('マスは0〜8');
     if(Array.isArray(v)&&lim.uniqueItems&&new Set(v).size!==v.length)err('値が重複しています');
     const max=lim.maxItemsByContext?.[ctx.slot]??lim.maxItemsByContext?.default;
     if(Array.isArray(v)&&max!==undefined&&v.length>max)err('最大'+max+'件');
     const child=resolve(schema,row,obj,c);
     if(child&&plain(v))found.push(...issues(schema,child,v,c,p,depth+1));
     if(child&&Array.isArray(v))v.forEach((x,i)=>{if(plain(x))found.push(...issues(schema,child,x,c,p+' '+(i+1),depth+1));else err('項目が不正です');});
     if(row.widget==='parameterValue'){
       const parameter=parameterFields(schema,c.effect||{}).find(r=>r.key===obj.parameter);
       if(!parameter)err('変更する項目を選んでください');
       else if(parameter.ref==='form:quantity'&&plain(v))found.push(...issues(schema,'quantity',v,c,p,depth+1));
       else if(parameter.ref==='form:quantity'||!typed(parameter.type,v))err('変更対象と同じ型が必要です');
       else for(const [key,test]of [['minimum',(a,b)=>a>=b],['maximum',(a,b)=>a<=b],['exclusiveMinimum',(a,b)=>a>b],['exclusiveMaximum',(a,b)=>a<b]])if(parameter.constraints[key]!==undefined&&!test(v,parameter.constraints[key]))err('変更対象の範囲外です');
     }
   }
   if(form==='area'&&!(obj.ally?.length||obj.enemy?.length))found.push({path,message:'対象のマスを選んでください'});
   if(form==='predicate'&&obj.kind==='group'&&!(obj.items?.length))found.push({path,message:'子条件を追加してください'});
   return found;
 }
 function blank(schema){
   const now=new Date().toISOString();
   return {id:uid(),createdAt:now,updatedAt:now,status:'draft',card:defaults(schema,'card',{name:'新しいカード'}),notes:'',history:[]};
 }
 function effect(schema,type='attack'){const x=defaults(schema,'effect',{type});x.target={mode:'area',area:{basis:'absolute',ally:[],enemy:[0,1,2,3,4,5,6,7,8]}};return x;}
 function template(schema,kind){
   const d=blank(schema);if(kind==='blank')return d;
   d.card.name=kind==='defense'?'防御型のカード':'攻撃型のカード';
   const skill=d.card.skills.front;skill.mode='custom';skill.name=kind==='defense'?'防壁':'一閃';defaults(schema,'skill',skill,{slot:'front'});
   const e=effect(schema,kind==='defense'?'status':'attack');
   if(kind==='defense'){change(schema,e,'effect','stateId','armorRatio');e.params.receivedMultiplier=0.7;e.target={mode:'context',source:'self'};}
   else e.target={mode:'search',area:{basis:'absolute',ally:[],enemy:[0,1,2,3,4,5,6,7,8]},filter:{kind:'none'},pick:'rank',sortStat:'currentHP',direction:'asc',count:1};
   skill.effects=[e];return d;
 }
 function empty(schema){return {format:'card-studio-v2-library',schemaVersion:2,revision:0,schema:clone(schema),cards:[],legacyArchives:[],schemaHistory:[]};}
 function validateLibrary(lib){
   safe(lib);if(lib?.format!=='card-studio-v2-library'||lib.schemaVersion!==2||!Number.isInteger(lib.revision)||lib.revision<0||!Array.isArray(lib.cards)||lib.cards.length>1000||!Array.isArray(lib.legacyArchives)||!Array.isArray(lib.schemaHistory))throw Error('改良版のDB形式ではありません。');
   validateSchema(lib.schema);const ids=new Set();
   for(const d of lib.cards){if(!plain(d)||typeof d.id!=='string'||ids.has(d.id)||!plain(d.card)||typeof d.notes!=='string'||!Array.isArray(d.history))throw Error('カードのIDまたは形式が不正です。');ids.add(d.id);cardStructure(lib.schema,d.card);for(const h of d.history)if(!plain(h)||typeof h.date!=='string'||!plain(h.card)||typeof h.notes!=='string')throw Error('カード履歴の形式が不正です。');}
   for(const a of lib.legacyArchives)if(!plain(a)||typeof a.id!=='string'||typeof a.date!=='string'||a.data?.schemaVersion!==1||!Array.isArray(a.data.cards)||!a.data.cards.every(d=>plain(d)&&plain(d.card))||!Array.isArray(a.data.definitions))throw Error('旧版原本の形式が不正です。');
   for(const h of lib.schemaHistory){if(!plain(h)||typeof h.date!=='string')throw Error('定義履歴の形式が不正です。');validateSchema(h.schema);}
   return lib;
 }
 function importLibrary(current,incoming){
   safe(incoming);const next=clone(current);
   if(incoming.schemaVersion===1&&Array.isArray(incoming.cards)&&Array.isArray(incoming.definitions)){
     if(!incoming.cards.every(d=>plain(d)&&typeof d.id==='string'&&plain(d.card)))throw Error('旧版DBのカード形式が不正です。');
     if(!next.legacyArchives.some(a=>JSON.stringify(a.data)===JSON.stringify(incoming)))next.legacyArchives.push({id:uid(),date:new Date().toISOString(),data:clone(incoming)});
     return {library:next,message:`旧版の${incoming.cards.length}枚と関連データを原本のまま保管しました。`};
   }
   validateLibrary(incoming);
   if(JSON.stringify(incoming.schema)!==JSON.stringify(current.schema))throw Error('定義DBが異なります。先に対応する定義JSONを確認してください。取込は行っていません。');
   for(const card of incoming.cards){const prior=next.cards.find(x=>x.id===card.id);if(prior&&JSON.stringify(prior)===JSON.stringify(card))continue;const copy=clone(card);if(prior){copy.id=uid();copy.card.name+='（取込コピー）';}next.cards.push(copy);}
   for(const a of incoming.legacyArchives)if(!next.legacyArchives.some(x=>JSON.stringify(x.data)===JSON.stringify(a.data)))next.legacyArchives.push(clone(a));
   for(const h of incoming.schemaHistory)if(!next.schemaHistory.some(x=>JSON.stringify(x)===JSON.stringify(h)))next.schemaHistory.push(clone(h));
   validateLibrary(next);return {library:next,message:'取り込みました。保存すると端末に記録されます。'};
 }
 function applySchema(current,nextSchema){
   validateSchema(nextSchema);const next=clone(current);
   for(const entry of next.cards){const spec=active(current.schema,'card',entry.card);for(const t of spec.traits||[])if(t.definitionId&&!nextSchema.definitions.trait[t.definitionId])throw Error('使用中の特性IDが新定義にありません。');for(const s of Object.values(spec.skills||{}))for(const e of s.effects||[])if(e.stateId&&!nextSchema.definitions.state[e.stateId])throw Error('使用中の状態IDが新定義にありません。');}
   next.schemaHistory.push({date:new Date().toISOString(),schema:clone(current.schema)});next.schema=clone(nextSchema);
   return validateLibrary(next);
 }
 const label=(schema,group,id)=>schema.enums[group]?.find(x=>x.id===id)?.label??String(id??'未設定');
 function quantityText(schema,q){if(!q)return '量未設定';if(q.mode==='fixed')return q.value==null?'量未設定':String(q.value);if(q.mode==='statScale')return `${q.owner==='self'?'':label(schema,'owner',q.owner)+'の'}${label(schema,'referenceStat',q.stat)}×${q.factor??'?'}`;return `${q.base??0}＋該当数×${q.perUnit??'?'}`;}
 function targetText(schema,t){if(!t)return '対象未設定';if(t.mode==='context')return label(schema,'targetSource',t.source);
   const a=t.area||{},sides=[a.ally?.length?'味方'+(a.ally.length===9?'全体':a.ally.length+'マス'):'',a.enemy?.length?'敵'+(a.enemy.length===9?'全体':a.enemy.length+'マス'):''].filter(Boolean).join('・')||'範囲未設定';
   const filter=t.mode==='search'&&t.filter?.kind&&t.filter.kind!=='none'?'・条件あり':'';
   return sides+(t.mode==='search'?(t.pick==='rank'?`の${label(schema,'stat',t.sortStat)}${t.direction==='desc'?'上位':'下位'}${t.count??'?'}体`:'の条件一致全員'):'')+filter;
 }
 function effectText(schema,e){
   let title=label(schema,'effectType',e.type),amount='';
   if(['attack','heal'].includes(e.type))amount=quantityText(schema,e.amount);
   if(['buff','debuff'].includes(e.type))amount=label(schema,'changeStat',e.modifiedStat)+(e.operation==='multiply'?'×'+(e.factor??'?'):(e.type==='buff'?'+':'−')+quantityText(schema,e.amount));
   if(e.type==='status'){
     const d=schema.definitions.state[e.stateId];title=d?.label||'状態未設定';
     amount=(schema.forms[d?.formId]||[]).map(r=>{const v=get(e.params||{},r.key);if(r.ref==='form:quantity')return r.label+' '+quantityText(schema,v);if(r.ref==='form:target')return r.label+' '+targetText(schema,v);if(r.ref==='form:area')return r.label+' '+targetText(schema,{mode:'area',area:v});return r.label+' '+(v??'?');}).join(' / ');
   }
   if(e.type==='remove')amount=label(schema,'removeMask',e.removeMask)+(e.removeMask==='oneState'?' '+(schema.definitions.state[e.removeStateId]?.label||'?'):'');
   if(e.type==='move')amount=label(schema,'moveMode',e.movement?.mode);
   if(e.type==='special'){title=label(schema,'specialKind',e.specialKind);amount=e.specialKind==='ultimateCharge'?`${e.chargeTurns??'?'}T`:e.specialKind==='revive'?quantityText(schema,e.reviveHP):e.specialKind==='terrain'?label(schema,'terrain',e.terrainId):'';}
   const duration=['buff','debuff','status'].includes(e.type)&&e.duration?(e.duration.mode==='always'?'常時':`${e.duration.turns??'?'}T`):'';
   const target=e.type==='special'&&['terrain','cellEffect'].includes(e.specialKind)?targetText(schema,{mode:'area',area:e.cells}):targetText(schema,e.target);
   return [title,target,amount,duration,e.type==='attack'&&e.attackCount>1?`同じ対象へ${e.attackCount}回`:'',e.repetitionCount>1?`対象選びから${e.repetitionCount}セット`:'',e.condition?.kind&&e.condition.kind!=='none'?'発動条件あり':'',e.alternate?'条件で量を変更':'',e.trigger?.event&&e.trigger.event!=='inherit'?label(schema,'event',e.trigger.event):''].filter(Boolean).join(' / ');
 }
 function specification(schema,d){return {format:'card-studio-v2-design',schemaVersion:2,definitionVersion:schema.schemaVersion,designId:d.id,runtimeReady:false,card:active(schema,'card',d.card),issues:issues(schema,'card',d.card)};}
 return {clone,uid,plain,safe,get,set,matches,visible,choices,resolve,context,defaults,change,active,validateSchema,issues,blank,effect,template,empty,validateLibrary,importLibrary,applySchema,label,quantityText,targetText,effectText,specification,parameterFields};
});

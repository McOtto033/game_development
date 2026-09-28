'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./model'),schema=require('./schema.json');
const keys=(form,obj,ctx={})=>schema.forms[form].filter(r=>M.visible(r,obj,ctx)).map(r=>r.key);
test('schema references and all card fields',()=>{M.validateSchema(schema);const d=M.blank(schema);assert.equal(Object.keys(d.card.skills).length,5);assert.equal(d.card.hp,100);assert.equal(schema.enums.class.length,13);});
test('state changes cache parameters and durations separately',()=>{const e=M.effect(schema,'status');M.change(schema,e,'effect','stateId','poison');assert.equal(e.duration.turns,3);e.params.damage.value=9;e.duration.turns=4;M.change(schema,e,'effect','stateId','armorRatio');assert.deepEqual(e.params,{});e.params.receivedMultiplier=.7;M.change(schema,e,'effect','stateId','poison');assert.equal(e.params.damage.value,9);assert.equal(e.duration.turns,4);M.change(schema,e,'effect','stateId','armorRatio');assert.equal(e.params.receivedMultiplier,.7);});
test('area mode ignores hidden search filters without deleting them',()=>{const e=M.template(schema,'attack').card.skills.front.effects[0];const original=M.clone(e.target);M.change(schema,e.target,'target','mode','area');const x=M.active(schema,'target',e.target);assert.deepEqual(Object.keys(x),['mode','area']);assert.deepEqual(e.target.filter,original.filter);});
test('stale terrain choice cannot hide normal attack target',()=>{assert.ok(keys('effect',{type:'attack',specialKind:'terrain'}).includes('target'));assert.ok(!keys('effect',{type:'special',specialKind:'terrain'}).includes('target'));});
test('search evaluates candidates while activation can choose subject',()=>{assert.ok(!keys('predicate',{kind:'stat'},{predicateUse:'candidate'}).includes('subject'));assert.ok(keys('predicate',{kind:'stat'},{predicateUse:'activation'}).includes('subject'));});
test('alpha top trigger has no inherit choice',()=>{const r=schema.forms.trigger.find(r=>M.visible(r,{}, {allowInherit:false}));assert.equal(r.ref,'enum:eventTop');assert.ok(!M.choices(schema,r,{}).some(x=>x.id==='inherit'));});
test('armor form does not expose attack amount; stealth needs no amount',()=>{const e=M.effect(schema,'status');M.change(schema,e,'effect','stateId','armorRatio');e.amount={mode:'fixed',value:900};const x=M.active(schema,'effect',e);assert.ok(!Object.hasOwn(x,'amount'));assert.deepEqual(schema.forms['state.stealth'],[]);});
test('invalid ratio, fractional turn and unknown choice produce issues',()=>{assert.ok(M.issues(schema,'state.armorRatio',{receivedMultiplier:1}).length);assert.ok(M.issues(schema,'duration',{mode:'turns',turns:1.2}).length);assert.ok(M.issues(schema,'trait',{definitionId:'bad',params:{}}).length);});
test('blank number is not zero and inactive values are excluded',()=>{const e=M.effect(schema);M.change(schema,e.amount,'quantity','factor',null);assert.equal(e.amount.factor,null);M.change(schema,e.amount,'quantity','mode','fixed');e.amount.value=0;assert.equal(M.quantityText(schema,e.amount),'0');assert.deepEqual(M.active(schema,'quantity',e.amount),{mode:'fixed',value:0});});
test('repeat semantics remain distinct and skill effects limit enforced',()=>{const d=M.template(schema,'attack'),s=d.card.skills.front,e=s.effects[0];e.attackCount=3;e.repetitionCount=2;s.repeatCount=4;const x=M.specification(schema,d);assert.equal(x.card.skills.front.effects[0].attackCount,3);assert.equal(x.card.skills.front.effects[0].repetitionCount,2);assert.equal(x.card.skills.front.repeatCount,4);s.effects.push(M.effect(schema),M.effect(schema));assert.ok(M.issues(schema,'card',d.card).some(x=>x.message==='最大2件'));});
test('new definition extends form through data only',()=>{const sc=M.clone(schema);sc.forms['state.test']=[{...sc.forms['state.armorRatio'][0],id:'state.test.cut',key:'cut',label:'試験軽減',constraints:{minimum:0}}];sc.definitions.state.test={...sc.definitions.state.armorRatio,id:'test',label:'試験状態',formId:'state.test'};M.validateSchema(sc);const row=sc.forms.effect.find(r=>r.key==='params');assert.equal(M.resolve(sc,row,{stateId:'test'}),'state.test');});
test('schema rejects broken reference, dangerous keys and unknown widget',()=>{let x=M.clone(schema);x.forms.card[0].ref='form:missing';assert.throws(()=>M.validateSchema(x));x=M.clone(schema);x.forms.card[0].widget='execute';assert.throws(()=>M.validateSchema(x));assert.throws(()=>M.safe(JSON.parse('{"__proto__":{"x":1}}')));});
test('legacy JSON archives all raw content and does not overwrite cards',()=>{const lib=M.empty(schema),old={schemaVersion:1,revision:5,cards:[{id:'old',card:{name:'旧カード',artwork:'data:image/png;base64,AA'},notes:{intent:'原文'},history:[{text:'履歴'}]}],definitions:[{id:'custom'}],abilityIdeas:[{id:'idea',text:'自然文'}]};lib.cards.push(M.blank(schema));const before=M.clone(lib);const result=M.importLibrary(lib,old);assert.deepEqual(result.library.legacyArchives[0].data,old);assert.deepEqual(result.library.cards,before.cards);assert.deepEqual(lib,before);});
test('v2 import protects ID conflicts and rejects differing definitions atomically',()=>{const lib=M.empty(schema);lib.cards.push(M.blank(schema));let next=M.clone(lib);next.cards[0].card.name='別の編集';let r=M.importLibrary(lib,next).library;assert.equal(r.cards.length,2);assert.notEqual(r.cards[0].id,r.cards[1].id);next.schema.forms.card[0].label='変更';assert.throws(()=>M.importLibrary(lib,next));assert.equal(lib.cards.length,1);});
test('design exports are explicitly not battle execution data',()=>{const x=M.specification(schema,M.template(schema,'defense'));assert.equal(x.runtimeReady,false);assert.equal(x.format,'card-studio-v2-design');assert.ok(!JSON.stringify(x.card).includes('_states'));});
test('schema update rejects missing core rows and malformed defaults without changing the DB',()=>{
 const lib=M.empty(schema);lib.cards.push(M.template(schema,'defense'));const before=M.clone(lib);
 for(const corrupt of [s=>s.forms.card=s.forms.card.filter(r=>r.key!=='name'),s=>s.forms.skill.find(r=>r.key==='effects').default='bad',s=>s.forms.card.find(r=>r.key==='hp').default='bad',s=>s.forms.card.find(r=>r.key==='skills.front').default={mode:'custom',effects:'bad'},s=>s.contract.dynamicChoice.class='enum:absent']){
  const sc=M.clone(schema);corrupt(sc);assert.throws(()=>M.applySchema(lib,sc));assert.deepEqual(lib,before);
 }
});
test('import rejects broken card, archive, and history structures atomically',()=>{
 const lib=M.empty(schema);lib.cards.push(M.blank(schema));const before=M.clone(lib);
 for(const corrupt of [x=>x.cards[0].card={},x=>x.cards[0].card.skills.front={mode:'custom',effects:'bad'},x=>x.cards[0].history=[{}],x=>x.legacyArchives=[{}],x=>x.schemaHistory=[{}]]){
  const incoming=M.clone(lib);corrupt(incoming);assert.throws(()=>M.importLibrary(lib,incoming));assert.deepEqual(lib,before);
 }
 const incoming=M.clone(lib);incoming.cards[0].card.hp=100.5;incoming.cards[0].card.name='';M.validateLibrary(incoming);assert.ok(M.issues(schema,'card',incoming.cards[0].card).length);
});
test('conditional integer parameter rejects a fractional replacement',()=>{
 const e=M.effect(schema,'special');e.specialKind='ultimateCharge';e.alternate={condition:{kind:'none'},parameter:'chargeTurns',value:1.5};
 assert.ok(M.issues(schema,'effect',e).some(x=>x.message==='変更対象と同じ型が必要です'));
 e.alternate.value=2;assert.ok(!M.issues(schema,'effect',e).some(x=>x.message==='変更対象と同じ型が必要です'));
});
test('definition history survives DB transfer without duplicates',()=>{
 const incoming=M.empty(schema);incoming.schemaHistory.push({date:'2026-09-28',schema:M.clone(schema)});
 const moved=M.importLibrary(M.empty(schema),incoming).library;assert.deepEqual(moved.schemaHistory,incoming.schemaHistory);
 assert.equal(M.importLibrary(moved,incoming).library.schemaHistory.length,1);
});
test('schema application checks existing containers before swapping definitions',()=>{
 const lib=M.empty(schema);lib.cards.push(M.template(schema,'defense'));const sc=M.clone(schema);sc.forms['state.armorRatio'][0].type='object';sc.forms['state.armorRatio'][0].widget='json';sc.forms['state.armorRatio'][0].default={};
 const before=M.clone(lib);assert.throws(()=>M.applySchema(lib,sc));assert.deepEqual(lib,before);
 const labels=M.clone(schema);labels.forms.card[0].label='新しい表示名';const updated=M.applySchema(lib,labels);assert.equal(updated.schema.forms.card[0].label,'新しい表示名');assert.deepEqual(updated.cards,lib.cards);assert.equal(updated.schemaHistory.length,1);
});

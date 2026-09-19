'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('./model');
const empty=()=>({schemaVersion:1,revision:0,cards:[],definitions:[]});
const idea=(cardId='')=>Object.assign(M.abilityIdea(cardId),{description:'  攻撃を受けるたび反撃する。\n3回当たれば3回。',examples:'反撃倍率はAT×0.5。'});
test('能力案はカードなし・説明だけで保存でき、旧DBを自動変更しない',()=>{
  const old=empty(),before=M.clone(old);M.validateLibrary(old);assert.deepEqual(old,before);
  const a=idea();a.examples='';const saved=M.prepareSave({...old,abilityIdeas:[a]},old);
  assert.equal(saved.cards.length,0);assert.equal(saved.abilityIdeas[0].revisions[0].description,a.description);assert.equal(a.revisions.length,0);
  assert.throws(()=>M.validateLibrary({...old,abilityIdeas:[M.abilityIdea()]}),/説明は必須/);
});
test('保存前後の原文・補足・関連先を履歴に保持し、無変更保存で履歴が増えない',()=>{
  const old=empty(),a=idea(),first=M.prepareSave({...old,abilityIdeas:[a]},old),edited=M.clone(first);
  edited.abilityIdeas[0].description='攻撃終了後に一度だけ反撃する。';edited.abilityIdeas[0].examples='3連撃でも1回。';edited.abilityIdeas[0].slot='trait';
  const saved=M.prepareSave(edited,first),revs=saved.abilityIdeas[0].revisions;
  assert.equal(revs.length,2);assert.equal(revs[0].description,a.description);assert.equal(revs[0].examples,a.examples);assert.equal(revs[1].description,edited.abilityIdeas[0].description);
  assert.deepEqual(M.prepareSave(saved,saved).abilityIdeas,saved.abilityIdeas);
  const imported=M.mergeLibraries(empty(),saved).library;assert.deepEqual(M.prepareSave(imported,empty()).abilityIdeas,saved.abilityIdeas);
});
test('能力案はカード仕様と分離し、整理用JSONには原文履歴と関連基本値だけを含む',()=>{
  const d=M.template('attack'),a=idea(d.id);d.notes.intent='開発用の別メモ';const lib=M.prepareSave({...empty(),cards:[d],abilityIdeas:[a]},empty());
  const before=M.clone(d.card),corpus=M.exportIdeas(lib);assert.deepEqual(d.card,before);
  assert.equal(corpus.relatedCards[0].name,d.card.name);assert.equal(corpus.abilityIdeas[0].revisions[0].description,a.description);
  assert.equal(JSON.stringify(M.exportCard(d)).includes('abilityIdeas'),false);assert.equal(JSON.stringify(corpus).includes('開発用の別メモ'),false);
});
test('能力案の同一取込は重複せず、競合は原文履歴を残す別案になる',()=>{
  const first=M.prepareSave({...empty(),abilityIdeas:[idea()]},empty()),same=M.mergeLibraries(first,first);assert.equal(same.library.abilityIdeas.length,1);
  const incoming=M.clone(first);incoming.abilityIdeas[0].description='別端末の異なる案';const result=M.mergeLibraries(first,incoming);
  assert.equal(result.ideasCopied,1);assert.equal(result.library.abilityIdeas.length,2);assert.deepEqual(first.abilityIdeas[0],result.library.abilityIdeas[0]);assert.notEqual(result.library.abilityIdeas[1].id,first.abilityIdeas[0].id);
  assert.deepEqual(result.library.abilityIdeas[1].revisions,first.abilityIdeas[0].revisions);
});
test('カード取込コピーに合わせ能力案と履歴の参照先を付け替える',()=>{
  const d=M.blank(),base=M.prepareSave({...empty(),cards:[d],abilityIdeas:[idea(d.id)]},empty()),incoming=M.clone(base);incoming.cards[0].card.name='別端末カード';
  const result=M.mergeLibraries(base,incoming),lib=result.library;
  assert.equal(lib.cards.length,2);assert.equal(lib.abilityIdeas.length,2);assert.equal(lib.abilityIdeas[1].cardId,lib.cards[1].id);assert.equal(lib.abilityIdeas[1].revisions[0].cardId,lib.cards[1].id);
  assert.equal(lib.abilityIdeas[1].revisions[0].description,base.abilityIdeas[0].description);assert.equal(base.cards.length,1);
});
test('カード複製と保管でも原文を残し、未取込のカード参照も消さない',()=>{
  const d=M.blank(),lib=M.prepareSave({...empty(),cards:[d],abilityIdeas:[idea(d.id)]},empty()),copy=M.duplicate(d);lib.cards.push(copy);M.duplicateIdeas(lib,d.id,copy.id);
  assert.equal(lib.abilityIdeas[1].cardId,copy.id);assert.equal(lib.abilityIdeas[1].revisions[0].description,lib.abilityIdeas[0].description);
  lib.abilityIdeas[1].archived=true;lib.abilityIdeas[1].cardId='not-imported';M.validateLibrary(lib);
  assert.equal(M.exportIdeas(lib).abilityIdeas.length,2);
});
test('能力案の不正な型・重複ID・不正履歴・危険キーを拒否する',()=>{
  for(const patch of [{description:' '},{slot:'unknown'},{archived:'true'},{revisions:[{}]}])assert.throws(()=>M.validateLibrary({...empty(),abilityIdeas:[Object.assign(idea(),patch)]}));
  const a=idea();assert.throws(()=>M.validateLibrary({...empty(),abilityIdeas:[a,a]}),/重複/);
  const lib={...empty(),abilityIdeas:[a]};a.extra=JSON.parse('{"__proto__":{}}');assert.throws(()=>M.validateLibrary(lib),/使用できない/);
});

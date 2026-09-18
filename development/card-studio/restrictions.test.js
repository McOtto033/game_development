'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('./model'),T=require('./targeting');
test('新規カードは制限なしの2項目を持ち、旧データも制限なしとして仕様出力できる',()=>{
  const d=M.blank();assert.deepEqual(d.card.initialPlacementForbidden,[]);assert.equal(d.card.deckLimit,null);
  delete d.card.initialPlacementForbidden;delete d.card.deckLimit;const before=M.clone(d);
  M.validateLibrary({schemaVersion:1,revision:0,cards:[d],definitions:[]});assert.deepEqual(d,before);
  const c=M.exportCard(d).card;assert.deepEqual(c.initialPlacementForbidden,[]);assert.equal(c.deckLimit,null);
});
test('初期配置の禁止マスと枚数区分を保存・受渡しし、マスの重複と不正な上限は拒否する',()=>{
  const d=M.blank(),lib={schemaVersion:1,revision:0,cards:[d],definitions:[]};d.card.initialPlacementForbidden=[0,3,6,1];d.card.deckLimit=2;
  assert.equal(M.placementText(d.card),'前衛不可・左中衛不可');M.validateLibrary(lib);
  const saved=M.prepareSave(lib,{cards:[]}),merged=M.mergeLibraries({schemaVersion:1,revision:0,cards:[],definitions:[]},JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(merged.library.cards[0].card,d.card);assert.equal(M.exportCard(d).card.deckLimit,2);
  d.card.initialPlacementForbidden=[1,1];assert.throws(()=>M.validateLibrary(lib),/禁止マス/);d.card.initialPlacementForbidden=[];
  for(const n of [0,-1,2.5,'2']){d.card.deckLimit=n;assert.throws(()=>M.validateLibrary(lib),/枚数制限/);}
});
test('全範囲モードは隠したサーチ条件を適用せず、切替で元の条件を保持する',()=>{
  const t=M.effect().target;t.query.conditions.items=[{...T.condition(),stat:'AT',value:20}];t.query.pick.count=3;t.query.timing.mode='each';const stored=M.clone(t.query);
  assert.equal(T.mode(t),'area');assert.deepEqual(T.effective(t).conditions.items,[]);assert.equal(T.effective(t).pick.mode,'all');assert.equal(T.effective(t).timing.mode,'each');
  t.mode='search';assert.deepEqual(T.effective(t),stored);assert.deepEqual(t.query,stored);
  const old={...t};delete old.mode;assert.equal(T.mode(old),'search');old.query=T.create();old.query.pick.mode='all';assert.equal(T.mode(old),'area');
});
test('効果の発動タイミングと対象再判定を独立して保存する',()=>{
  const d=M.template('attack'),e=d.card.skills.front.effects[0];e.triggerTiming='afterAttacked';e.target.query.timing.mode='each';
  M.validateLibrary({schemaVersion:1,revision:0,cards:[d],definitions:[]});assert.equal(M.effectTimingText(e),'自身が攻撃を受けた直後');
  e.triggerTiming='custom';e.customTriggerTiming='味方が倒れた直後';assert.equal(M.effectTimingText(e),'味方が倒れた直後');assert.equal(e.target.query.timing.mode,'each');
});
test('既存の行動参照に対する陣営条件・対象不在規則を簡易モードで隠さない',()=>{
  const t=M.effect().target;delete t.mode;t.query.pick.mode='all';t.query.side='enemy';
  assert.equal(T.mode(t),'area');t.source='attackSource';assert.equal(T.mode(t),'search','行動参照の候補は保存済みマスと無関係');
  t.query.side='both';t.query.absence.mode='stop';assert.equal(T.mode(t),'search');
  const legacy={...t,selection:'all',fallback:'同じ列のカードへ変更する'};delete legacy.query;
  legacy.query=T.fromLegacy(legacy);assert.equal(T.mode(legacy),'search');assert.equal(T.effective(legacy).absence.text,legacy.fallback);
});

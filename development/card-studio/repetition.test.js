'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('./model');
const library=d=>({schemaVersion:1,revision:0,cards:[d],definitions:[]});
test('対象3体・毎回再サーチ3セット・同対象3連撃を異なる値で表現する',()=>{
  const d=M.template('attack'),s=d.card.skills.front,e=s.effects[0];Object.assign(e.target.query.pick,{stat:'hp',direction:'desc',count:3});
  assert.deepEqual(M.execution(e),{hits:1,repeat:1,event:false});
  e.target.query.pick.count=1;M.setExecution(e,{hits:1,repeat:3});assert.deepEqual(M.execution(e),{hits:1,repeat:3,event:false});
  assert.match(M.executionText(s),/［対象選択 → 1\. 攻撃 1回（対象固定）］×3/);
  M.setExecution(e,{hits:3,repeat:1});assert.deepEqual(M.execution(e),{hits:3,repeat:1,event:false});assert.equal(e.target.query.timing.mode,'once');
  assert.equal(M.executionText(s),'1. 攻撃 3回（対象固定）');M.validateLibrary(library(d));
});
test('攻撃を3セットしてから状態付与する形と、攻撃＋状態付与を3セットする形を区別する',()=>{
  const d=M.template('attack'),s=d.card.skills.front,a=s.effects[0],b=M.effect('status');b.statusId='defenseDown';b.target.source='previousEffectTarget';s.effects.push(b);
  M.setExecution(a,{repeat:3});const separate=M.executionText(s);assert.equal(separate,'［対象選択 → 1. 攻撃 1回（対象固定）］×3 → 2. 防御低下');
  M.setExecution(a,{repeat:1});s.repeatCount=3;assert.equal(M.executionText(s),'［1. 攻撃 1回（対象固定） → 2. 防御低下］×3（行動全体）');
  M.setExecution(a,{hits:2,repeat:2});assert.match(M.executionText(s),/［［対象選択 → 1\. 攻撃 2回（対象固定）］×2 → 2\. 防御低下］×3/);M.validateLibrary(library(d));
});
test('旧各回再サーチを変更せず読み、回数編集時に同じ意味で新書式へ移す',()=>{
  const d=M.template('attack'),e=d.card.skills.front.effects[0];delete e.repetition;e.repeatCount=3;e.target.query.timing.mode='each';e.target.query.conditions.items=[{kind:'custom',text:'任意の追加条件'}];e.target.query.absence={mode:'custom',text:'代替対象を探す'};const before=M.clone(e);
  assert.deepEqual(M.execution(e),{hits:1,repeat:3,event:false});M.validateLibrary(library(d));assert.deepEqual(e,before);
  M.setExecution(e);assert.equal(e.repeatCount,1);assert.equal(e.repetition.count,3);assert.equal(e.target.query.timing.mode,'once');
  assert.deepEqual(e.target.query.conditions,before.target.query.conditions);assert.deepEqual(e.target.query.absence,before.target.query.absence);M.validateLibrary(library(d));
});
test('旧対象固定と旧イベント判定を区別し、イベント指定を回数編集で消さない',()=>{
  const d=M.template('attack'),e=d.card.skills.front.effects[0];delete e.repetition;e.repeatCount=3;assert.deepEqual(M.execution(e),{hits:3,repeat:1,event:false});
  e.target.query.timing={mode:'event',event:'custom',text:'味方の攻撃後'};const before=M.clone(e);M.validateLibrary(library(d));assert.equal(M.execution(e).event,true);assert.throws(()=>M.setExecution(e,{repeat:2}),/イベント/);assert.deepEqual(e,before);
  e.repetition={count:3};assert.throws(()=>M.validateLibrary(library(d)),/旧再判定/);
});
test('攻撃以外にも効果繰り返しを設定でき、非表示の攻撃回数は保持する',()=>{
  const d=M.template('support'),e=d.card.skills.rear.effects[0];e.repeatCount=4;M.setExecution(e,{repeat:3});assert.equal(e.repeatCount,4);assert.deepEqual(M.execution(e),{hits:1,repeat:3,event:false});M.validateLibrary(library(d));
});
test('効果と行動の繰り返しは正の安全な整数に限定する',()=>{
  for(const v of [0,-1,1.5,'3',null,Infinity,Number.MAX_SAFE_INTEGER+1]){
    const d=M.template('attack'),s=d.card.skills.front;s.repeatCount=v;assert.throws(()=>M.validateLibrary(library(d)),/行動全体/);delete s.repeatCount;s.effects[0].repetition={count:v};assert.throws(()=>M.validateLibrary(library(d)),/効果の繰り返し/);
  }
});
test('二層の繰り返しと攻撃回数が履歴・仕様出力・複製・別DBへ残る',()=>{
  const d=M.template('attack'),before=library(M.clone(d)),s=d.card.skills.front;s.repeatCount=3;M.setExecution(s.effects[0],{hits:2,repeat:4});
  const saved=M.prepareSave(library(d),before),copy=M.duplicate(saved.cards[0]),merged=M.mergeLibraries({schemaVersion:1,revision:0,cards:[],definitions:[]},saved).library;
  for(const card of [copy.card,M.exportCard(d).card,merged.cards[0].card]){assert.equal(card.skills.front.repeatCount,3);assert.deepEqual(M.execution(card.skills.front.effects[0]),{hits:2,repeat:4,event:false});}
  assert.ok(saved.cards[0].history[0].changes.some(c=>c.path==='card.skills.front.repeatCount'));assert.ok(saved.cards[0].history[0].changes.some(c=>c.path==='card.skills.front.effects'));
});

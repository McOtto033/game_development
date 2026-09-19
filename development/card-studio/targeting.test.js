'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const T=require('./targeting');const M=require('./model');
test('条件・選択・判定時点を独立させ、閾値・極値・各属性・行動順・自然文を組み合わせて保存する',()=>{
  const d=M.template('attack'),t=d.card.skills.front.effects[0].target,q=t.query;
  q.side='enemy';q.conditions.items=[{...T.condition(),stat:'AT',operator:'gte',value:20},{...T.condition(),stat:'hp',operator:'min'},{kind:'group',op:'any',items:[{...T.condition('attribute'),value:'毒'},{...T.condition('attribute'),key:'class',value:'植物'}]},{kind:'group',op:'none',items:[{...T.condition('attribute'),key:'trait',value:'待ち伏せ'}]},...['terrain','preferredTerrain'].map(key=>({...T.condition('attribute'),key,value:'森'})),T.condition('order'),{...T.condition('custom'),text:'今回まだ選ばれていないカード'}];
  q.pick={...q.pick,stat:'AG',direction:'desc',count:2};
  const lib={schemaVersion:1,revision:0,cards:[d],definitions:[]};M.validateLibrary(lib);
  const saved=M.prepareSave(lib,{cards:[]}),merged=M.mergeLibraries({schemaVersion:1,revision:0,cards:[],definitions:[]},JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(merged.library.cards[0].card,d.card);assert.deepEqual(M.exportCard(d).card.skills.front.effects[0].target,t);
  const text=T.summary(q).join('\n');for(const phrase of ['ATが20以上','最低','同率を含む',' OR ','NOT','待ち伏せ','現在の地形','得意地形','行動順','AGが高い順に2体'])assert.ok(text.includes(phrase),phrase);
});
test('同倍率3回攻撃の固定と各回再サーチは別値・別表示で、条件と範囲を変えない',()=>{
  const e=M.effect();delete e.repetition;e.amount.value=.25;e.repeatCount=3;const before=M.clone(e.target);e.target.query.side='enemy';
  assert.match(T.summary(e.target.query).join(''),/効果開始時に1回（対象を固定）/);
  e.target.query.timing.mode='each';assert.match(T.summary(e.target.query).join(''),/各回の実行直前（毎回選び直す）/);
  assert.deepEqual(e.target.enemy,before.enemy);assert.deepEqual(e.target.query.conditions,before.query.conditions);assert.equal(e.repeatCount,3);assert.match(M.effectText(e),/AT×0.25 \/ 3回/);
});
test('全員指定と上位X体を区別し、同値の追加・イベント・対象不在を明記する',()=>{
  const q=T.create();q.pick.mode='all';q.side='both';assert.ok(!T.summary(q).some(x=>x.startsWith('同値')));assert.match(T.summary(q).join(''),/条件に合う全員/);
  q.pick.mode='rank';q.pick.ties='include';q.timing.mode='event';q.timing.event='custom';q.timing.text='味方が攻撃した直後';q.absence.mode='stop';T.validate(q);
  assert.match(T.summary(q).join(''),/X体を超える/);assert.match(T.summary(q).join(''),/味方が攻撃した直後/);assert.match(T.summary(q).join(''),/残り回数を打ち切る/);
  const order=T.condition('order');order.direction='next';order.scope='ally';assert.match(T.conditionText(order),/味方内.*直後/);order.scope='global';assert.match(T.conditionText(order),/全体/);
});
test('旧自由文は解釈せず移し、元の範囲と文は変更しない',()=>{
  const t=M.effect().target;delete t.query;t.rule='特殊な優先順で対象を決める';t.fallback='前衛に切り替える';const before=M.clone(t),q=T.fromLegacy(t);
  assert.equal(q.pick.mode,'custom');assert.equal(q.pick.text,t.rule+' / '+t.count+'体');assert.equal(q.absence.text,t.fallback);assert.deepEqual(t,before);T.validate(q);
  t.rule='残HPが最も低い対象';assert.equal(T.fromLegacy(t).pick.stat,'hp');t.selection='all';assert.equal(T.fromLegacy(t).pick.mode,'all');
});
test('壊れた構造・過剰な入れ子・対象数を拒否し、書きかけは記入待ちにする',()=>{
  for(const change of [q=>q.pick.count=0,q=>q.pick.count=1.5,q=>q.timing.mode='unknown',q=>q.conditions.items.push({kind:'invalid'}),q=>q.conditions.items=Array.from({length:40},()=>T.condition())]){const q=T.create();change(q);assert.throws(()=>T.validate(q),/対象指定/);}
  const q=T.create();let g=q.conditions;for(let i=0;i<6;i++){const next=T.group();g.items.push(next);g=next;}assert.throws(()=>T.validate(q),/入れ子/);
  const draft=T.create();draft.conditions.items=[T.condition('custom')];draft.side='enemy';draft.self='only';T.validate(draft);assert.ok(T.warnings(draft).length>=2);
});

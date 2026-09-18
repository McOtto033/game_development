'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const M=require('./model');
const library=()=>({schemaVersion:1,revision:0,cards:[M.template('attack')],definitions:[]});

test('旧特性を保持し、共通特性と独立した数値・効果量を保存・取り込みできる',()=>{
  const old=library();old.cards[0].card.traits=[{name:'旧特性',value:'5',description:'既存の説明'}];M.validateLibrary(old);
  const next=M.clone(old);next.traitDefinitions=[{id:'custom_trait',name:'独自の共通特性',description:'共通説明'}];
  next.cards[0].card.traits.push({definitionId:'ambush',name:'待ち伏せ',value:'2',effectAmount:'AT×1.25',description:'常時反撃状態'});
  next.cards[0].card.traits.push({definitionId:'custom_trait',name:'独自の共通特性',value:'',effectAmount:'AT×0.5',description:'共通説明'});
  M.validateLibrary(next);const merged=M.mergeLibraries({schemaVersion:1,revision:0,cards:[],definitions:[]},next);
  assert.deepEqual(merged.library.cards[0].card.traits,next.cards[0].card.traits);assert.deepEqual(merged.library.traitDefinitions,next.traitDefinitions);
  next.traitDefinitions.push({id:'another_id',name:'待ち伏せ',description:''});assert.throws(()=>M.validateLibrary(next),/重複/);
});
test('行動枠に合う自身位置へ相対対象を投影し、旧データと範囲外の指定を保持する',()=>{
  const t=M.effect().target;t.basis='relative';t.ally=[4];const original=M.clone(t);
  for(const [slot,cell] of [['front',3],['middle',4],['rear',5]]){assert.equal(M.originCell(slot),cell);assert.deepEqual(M.targetCells(t,'ally',slot),[cell]);}
  assert.deepEqual(t,original);
  t.ally=[3,4,5];assert.deepEqual(M.targetCells(t,'ally','front'),[3,4]);assert.deepEqual(t.ally,[3,4,5]);
  M.toggleTargetCell(t,'ally','front',5);assert.deepEqual(M.targetCells(t,'ally','front'),[3,4,5]);assert.ok(t.allyOffsets.some(p=>p[1]===-1));
  const absolute=M.effect().target;absolute.ally=[0,4,8];M.changeTargetBasis(absolute,'front','relative');assert.deepEqual(M.targetCells(absolute,'ally','front'),[0,4,8]);M.changeTargetBasis(absolute,'front','absolute');assert.deepEqual(absolute.ally,[0,4,8]);
});

test('テンプレートは五つの行動枠を持ち、未入力の下書きでも保存できる',()=>{
  for(const kind of ['blank','attack','support']) {
    const lib=library();lib.cards=[M.template(kind)];M.validateLibrary(lib);
    assert.equal(Object.keys(lib.cards[0].card.skills).length,5);
    assert.ok(M.warnings(lib.cards[0]).includes('イラストを登録する'));
  }
});
test('表記規格：AT略記、即時省略、持続T、常時、条件別量は同一効果',()=>{
  const e=M.effect();assert.equal(M.effectText(e),'攻撃：AT×1.0');
  e.duration.mode='turns';assert.equal(M.effectText(e),'攻撃：AT×1.0 / 2T');
  e.duration.mode='always';e.amount.reference='対象のAT';e.amount.value=.5;
  e.alternate={condition:'対象が毒',amount:'対象のAT×1.5'};
  assert.equal(M.effectText(e),'攻撃：対象のAT×0.5（対象が毒：対象のAT×1.5） / 常時');
});
test('カード仕様の書き出しには設計メモ・履歴・状態が入らない',()=>{
  const d=M.blank();d.notes.intent='内部限定の意図';d.history=[{reason:'内部限定の調整'}];d.artCredit='内部限定の出典';
  const out=M.exportCard(d);assert.ok(!JSON.stringify(out).includes('内部限定'));
  assert.deepEqual(Object.keys(out).sort(),['card','designId','format','gameCardId','schemaVersion']);
});
test('保存時に実際の差分と検証ログを記録し、無変更時には増やさない',()=>{
  const before=library();const edit=M.clone(before);edit.cards[0].card.at=35;
  const id=edit.cards[0].id;
  const saved=M.prepareSave(edit,before,{[id]:{reason:'火力不足を調整',result:'同じ配置で比較',decision:'testing'}});
  assert.deepEqual(saved.cards[0].history[0].changes,[{path:'card.at',before:30,after:35}]);
  assert.equal(saved.cards[0].history[0].reason,'火力不足を調整');
  assert.equal(M.prepareSave(saved,saved).cards[0].history.length,1);
  assert.equal(M.prepareSave(saved,saved,{[id]:{result:'追加検証'}}).cards[0].history.length,2);
  assert.equal(before.cards[0].history.length,0);
});
test('新効果の専用パラメーターは再利用・検証され、不明IDや型違いは拒否する',()=>{
  const lib=library();lib.definitions=[{id:'barrier',name:'障壁',icon:'◇',description:'設計例',parameters:[{key:'layers',label:'重ね数',type:'number'}]}];
  const e=lib.cards[0].card.skills.front.effects[0];e.typeId='barrier';e.params={layers:2};M.validateLibrary(lib);
  e.params.layers='two';assert.throws(()=>M.validateLibrary(lib),/型/);
  e.params.layers=2;e.typeId='not-defined';assert.throws(()=>M.validateLibrary(lib),/未登録/);
});
test('不正JSON・危険キー・重複・3効果・危険画像を拒否する',()=>{
  assert.throws(()=>M.validateLibrary(JSON.parse('{"__proto__":{}}')),/キー/);
  const lib=library();lib.cards.push(M.clone(lib.cards[0]));assert.throws(()=>M.validateLibrary(lib),/重複/);
  lib.cards.pop();lib.cards[0].card.skills.front.effects.push(M.effect(),M.effect());assert.throws(()=>M.validateLibrary(lib),/最大2/);
  lib.cards[0].card.skills.front.effects.splice(1);lib.cards[0].card.artwork='javascript:alert(1)';assert.throws(()=>M.validateLibrary(lib),/イラスト/);
});
test('取込時は同一データを重複させず、ID競合は履歴を維持したコピーを追加する',()=>{
  const base=library();assert.equal(M.mergeLibraries(base,base).library.cards.length,1);
  const incoming=M.prepareSave(base,{cards:[]});incoming.cards[0].card.at=40;
  const merged=M.mergeLibraries(base,incoming);assert.equal(merged.copied,1);assert.equal(merged.library.revision,0);
  assert.equal(merged.library.cards[0].card.at,30);assert.equal(merged.library.cards[1].card.at,40);
  assert.equal(merged.library.cards[1].history.length,1);assert.notEqual(merged.library.cards[1].id,base.cards[0].id);
  assert.equal(base.cards.length,1);
});
test('効果IDの内容競合は取込全体を止め、既存ライブラリを変更しない',()=>{
  const base=library();base.definitions=[{id:'custom',name:'新効果',icon:'◇',description:'元',parameters:[]}];
  const incoming=M.clone(base);incoming.definitions[0].description='異なる意味';
  assert.throws(()=>M.mergeLibraries(base,incoming),/定義が異なります/);assert.equal(base.definitions[0].description,'元');
});

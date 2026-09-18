'use strict';
const assert=require('node:assert/strict');
async function editEffects(page) {
  const input=path=>page.locator(`[data-bind="card.skills.${path}"]`);
  const preview=page.locator('#preview');
  const action=(name,index,extra='')=>page.locator(`[data-action="${name}"]${index===undefined?'':`[data-index="${index}"]`}${extra}`);
  await page.locator('[data-tab="effects"]').tap();await page.locator('[data-slot="front"]').tap();
  await input('front.effects.0.amount.value').fill('0.25');await input('front.effects.0.repeatCount').fill('3');
  await input('front.effects.0.target.source').selectOption('attackSource');
  await input('front.effects.0.target.context').fill('発動契機となった攻撃');
  assert.equal(await page.locator('[data-effect-index="0"] .target-grid').count(),0);
  assert.match(await preview.textContent(),/攻撃：AT×0.25 \/ 3回/);
  assert.match(await preview.textContent(),/対象：自身を攻撃してきた相手/);
  await input('front.effects.0.target.source').selectOption('grid');
  assert.equal(await page.locator('[data-effect-index="0"] [data-side="ally"][data-cell="3"]').getAttribute('aria-pressed'),'true','マス指定の編集内容を保持する');
  for(const [value,label] of [['attackTarget','自身が攻撃した相手'],['effectSource','発動契機となった効果の発生元']]){
    await input('front.effects.0.target.source').selectOption(value);assert.ok((await preview.textContent()).includes('対象：'+label));
  }
  await input('front.effects.0.target.source').selectOption('custom');await input('front.effects.0.target.context').fill('このターンに味方を回復したカード <条件>');
  assert.match(await preview.textContent(),/対象：このターンに味方を回復したカード <条件>/);
  await input('front.effects.0.target.source').selectOption('attackSource');await input('front.effects.0.target.context').fill('発動契機となった攻撃');
  await action('add-effect').tap();await input('front.effects.1.typeId').selectOption('buff');
  await input('front.effects.1.stat').selectOption('custom');await input('front.effects.1.customStat').fill('反撃倍率');
  assert.match(await preview.textContent(),/強化（反撃倍率）/);
  await input('front.effects.1.stat').selectOption('AG');await input('front.effects.1.amount.value').fill('0.5');
  assert.match(await preview.textContent(),/強化（AG）：AT×0.5/);
  await input('front.effects.1.typeId').selectOption('debuff');assert.match(await preview.textContent(),/弱体（AG）：AT×0.5/);
  assert.equal(await action('add-effect').isDisabled(),true);
  await page.locator('[data-slot="ultimate"]').tap();await input('ultimate.enabled').check();await input('ultimate.name').fill('三段の検証');
  await action('add-effect').tap();await input('ultimate.effects.0.amount.value').fill('0.25');await input('ultimate.effects.0.repeatCount').fill('3');await input('ultimate.effects.0.target.source').selectOption('attackTarget');
  await action('add-effect').tap();await input('ultimate.effects.1.typeId').selectOption('buff');await input('ultimate.effects.1.stat').selectOption('AT');await input('ultimate.effects.1.target.source').selectOption('previousEffectTarget');
  await action('duplicate-effect',0).tap();assert.equal(await page.locator('.effect-editor').count(),3);assert.equal(await action('add-effect').isDisabled(),true);
  for(let i=0;i<3;i++)assert.equal(await action('duplicate-effect',i).isDisabled(),true);
  await action('remove-effect',1).tap();await action('add-effect').tap();await input('ultimate.effects.2.typeId').selectOption('heal');await input('ultimate.effects.2.target.source').selectOption('effectSource');
  await action('move-effect',2,'[data-direction="up"]').tap();assert.equal(await input('ultimate.effects.1.typeId').inputValue(),'heal');
  await action('move-effect',1,'[data-direction="down"]').tap();assert.equal(await input('ultimate.effects.2.typeId').inputValue(),'heal');
  assert.equal(await action('move-effect',0,'[data-direction="up"]').isDisabled(),true);assert.equal(await action('move-effect',2,'[data-direction="down"]').isDisabled(),true);
  assert.match(await action('add-effect').textContent(),/3 \/ 3/);
  for(const width of [1440,820,390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'表示幅 '+width);}
  await page.setViewportSize({width:390,height:844});
}
function assertEffects(card) {
  const [attack,debuff]=card.skills.front.effects;
  assert.equal(attack.amount.value,.25);assert.equal(attack.repeatCount,3);assert.equal(attack.target.source,'attackSource');assert.equal(attack.target.context,'発動契機となった攻撃');
  assert.equal(debuff.stat,'AG');assert.equal(debuff.amount.reference,'AT');assert.equal(debuff.amount.value,.5);
  assert.deepEqual(card.skills.ultimate.effects.map(e=>e.typeId),['attack','buff','heal']);assert.equal(card.skills.ultimate.effects[1].target.source,'previousEffectTarget');
}
async function editStatusEffects(page) {
  const input=path=>page.locator(`[data-bind="card.skills.middle.effects.${path}"]`);
  await page.locator('[data-tab="effects"]').tap();await page.locator('[data-slot="middle"]').tap();
  await input('0.typeId').selectOption('status');await input('0.details').fill('以前の補足も残す');
  await input('0.statusId').selectOption('poison');await input('0.amount.mode').selectOption('none');await input('0.duration.mode').selectOption('turns');await input('0.duration.turns').fill('3');
  assert.match(await page.locator('#preview').textContent(),/状態付与（毒） \/ 3T/);
  await page.locator('#search').fill('毒');assert.equal(await page.locator('.library-card').count(),1);await page.locator('#search').fill('');
  await input('0.statusId').selectOption('counter');await input('0.amount.mode').selectOption('multiplier');await input('0.amount.value').fill('0.5');
  assert.match(await page.locator('#preview').textContent(),/状態付与（反撃）：AT×0.5 \/ 3T/);
  await input('0.typeId').selectOption('heal');assert.equal(await input('0.statusId').count(),0);
  await input('0.typeId').selectOption('status');assert.equal(await input('0.statusId').inputValue(),'counter');
  await page.locator('[data-action="duplicate-effect"][data-index="0"]').tap();await input('1.statusId').selectOption('custom');await input('1.customStatus').fill('独自状態 <試作>');
  assert.match(await page.locator('#preview').textContent(),/状態付与（独自状態 <試作>）/);
  await input('1.statusId').selectOption('poison');await input('1.statusId').selectOption('custom');assert.equal(await input('1.customStatus').inputValue(),'独自状態 <試作>');
  for(const width of [390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'状態欄の表示幅 '+width);}
  await page.setViewportSize({width:390,height:844});
}
function assertStatusEffects(card) {
  const [counter,custom]=card.skills.middle.effects;
  assert.equal(counter.statusId,'counter');assert.equal(counter.amount.value,.5);assert.equal(counter.duration.turns,3);assert.equal(counter.details,'以前の補足も残す');
  assert.equal(custom.statusId,'custom');assert.equal(custom.customStatus,'独自状態 <試作>');
}
async function editTargeting(page) {
  const originalId=await page.locator('.library-card.active').getAttribute('data-open');
  const base='card.skills.rear.effects.0.target.query',root=base+'.conditions';
  const input=path=>page.locator(`[data-bind="${path}"]`);
  const add=(path,group=false)=>page.locator(`[data-action="add-condition"][data-condition-path="${path}"]${group?'[data-kind="group"]':':not([data-kind])'}`);
  await page.locator('[data-tab="effects"]').tap();await page.locator('[data-slot="rear"]').tap();
  await page.locator('[data-action="target-preset"][data-index="0"][data-preset="enemyAll"]').tap();
  const cells=()=>page.locator('[data-effect-index="0"] .cell.selected').evaluateAll(nodes=>nodes.map(n=>n.dataset.side+':'+n.dataset.cell));const before=await cells();
  await add(root).tap();await input(root+'.items.0.stat').selectOption('AT');await input(root+'.items.0.operator').selectOption('gte');await input(root+'.items.0.value').fill('20');
  await add(root,true).tap();const nested=root+'.items.1';await input(nested+'.op').selectOption('any');
  await add(nested).tap();await input(nested+'.items.0.kind').selectOption('attribute');await input(nested+'.items.0.value').selectOption('毒');
  await add(nested).tap();await input(nested+'.items.1.kind').selectOption('attribute');
  for(const [key,value] of [['trait','待ち伏せ'],['terrain','森'],['preferredTerrain','海'],['class','植物']]){await input(nested+'.items.1.key').selectOption(key);await input(nested+'.items.1.value').selectOption(value);}
  await add(root).tap();await input(root+'.items.2.kind').selectOption('order');await input(root+'.items.2.direction').selectOption('next');await input(root+'.items.2.scope').selectOption('ally');assert.match(await page.locator('#preview').textContent(),/味方内の行動順.*直後/);await input(root+'.items.2.scope').selectOption('global');
  await add(root).tap();await input(root+'.items.3.kind').selectOption('custom');await input(root+'.items.3.text').fill('このターンに味方を回復したカード <条件>');
  await add(root,true).tap();await input(root+'.items.4.op').selectOption('none');await add(root+'.items.4').tap();await input(root+'.items.4.items.0.operator').selectOption('max');assert.match(await page.locator('#preview').textContent(),/同率を含む/);
  await page.locator(`[data-action="remove-condition"][data-condition-path="${root}.items.4"]`).tap();
  await input(base+'.pick.mode').selectOption('rank');await input(base+'.pick.stat').selectOption('AG');await input(base+'.pick.direction').selectOption('desc');await input(base+'.pick.count').fill('2');await input(base+'.pick.ties').selectOption('include');
  assert.match(await page.locator('#preview').textContent(),/AGが高い順に2体/);assert.match(await page.locator('#preview').textContent(),/X体を超える/);
  await input(base+'.timing.mode').selectOption('event');await input(base+'.timing.event').selectOption('custom');await input(base+'.timing.text').fill('味方が攻撃を受けた直後');assert.match(await page.locator('#preview').textContent(),/味方が攻撃を受けた直後/);
  await page.locator('[data-action="query-preset"][data-index="0"][data-preset="all"]').tap();assert.equal(await input(base+'.pick.count').count(),0);assert.match(await page.locator('#preview').textContent(),/条件に合う全員/);
  await page.locator('[data-action="query-preset"][data-index="0"][data-preset="fixed"]').tap();assert.match(await page.locator('#preview').textContent(),/効果開始時に1回/);
  await page.locator('[data-action="query-preset"][data-index="0"][data-preset="repeat"]').tap();await input(base+'.pick.ties').selectOption('position');
  await page.locator('[data-bind="card.skills.rear.effects.0.repeatCount"]').fill('3');await page.locator('[data-bind="card.skills.rear.effects.0.amount.value"]').fill('0.25');
  assert.match(await page.locator('#preview').textContent(),/毎回選び直す/);assert.match(await page.locator('#preview').textContent(),/ATが20以上.* OR /);assert.deepEqual(await cells(),before,'条件・人数・時点の編集で対象範囲を変えない');
  for(const width of [1440,820,390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'条件書式の表示幅 '+width);}await page.setViewportSize({width:390,height:844});
  const M=require('./model'),old=M.template('attack');old.card.name='旧対象記述の検証';delete old.card.skills.front.effects[0].target.query;old.card.skills.front.effects[0].target.rule='独自の選定順';
  await page.locator('#json-file').setInputFiles({name:'legacy-target.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:1,revision:0,cards:[old],definitions:[]}))});
  await page.locator(`[data-open="${old.id}"]`).tap();await page.locator('[data-slot="front"]').tap();assert.equal(await page.locator('[data-bind="card.skills.front.effects.0.target.rule"]').inputValue(),'独自の選定順');
  await page.locator('[data-action="structure-target"]').tap();assert.equal(await page.locator('[data-bind="card.skills.front.effects.0.target.query.pick.text"]').inputValue(),'独自の選定順 / 1体');
  await page.locator(`[data-open="${originalId}"]`).tap();await page.locator('[data-slot="rear"]').tap();
}
function assertTargeting(card) {
  const e=card.skills.rear.effects[0],q=e.target.query;
  assert.equal(q.side,'enemy');assert.equal(q.conditions.items.length,4);assert.equal(q.conditions.items[0].value,20);assert.equal(q.conditions.items[1].op,'any');assert.equal(q.conditions.items[1].items[1].value,'植物');assert.equal(q.conditions.items[2].direction,'next');assert.equal(q.conditions.items[2].scope,'global');assert.match(q.conditions.items[3].text,/<条件>/);
  assert.equal(q.pick.stat,'hp');assert.equal(q.pick.count,1);assert.equal(q.timing.mode,'each');assert.equal(e.repeatCount,3);assert.deepEqual(e.target.enemy,[0,1,2,3,4,5,6,7,8]);
}
module.exports={editEffects,assertEffects,editStatusEffects,assertStatusEffects,editTargeting,assertTargeting};

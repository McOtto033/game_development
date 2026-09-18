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
module.exports={editEffects,assertEffects,editStatusEffects,assertStatusEffects};

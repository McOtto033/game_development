'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),M=require('./model');
async function checkRepetition(page,artifactDir){
  const input=p=>page.locator(`[data-bind="${p}"]`),p='card.skills.front',e=p+'.effects.0',q=e+'.target.query';
  const save=async()=>{await page.locator('#save').tap();await page.locator('#save-state').filter({hasText:'保存済み'}).waitFor();};
  const snapshot=async(name,locator)=>{if(artifactDir){await fs.mkdir(artifactDir,{recursive:true});await locator.screenshot({path:path.join(artifactDir,name+'.png')});}};
  const plan=()=>page.locator('#main .execution-plan').textContent();
  await page.locator('#new-card').tap();await page.locator('[data-template="attack"]').tap();await input('card.name').fill('繰り返しの検証');
  const id=await page.locator('.library-card.active').getAttribute('data-open');
  await page.locator('[data-tab="effects"]').tap();await page.locator('[data-slot="front"]').tap();
  assert.equal(await page.locator('.target-timing').count(),0);assert.equal(await input(e+'.triggerTiming').isVisible(),false);
  await page.locator('[data-effect-index="0"] .execution-examples summary').tap();
  for(const [key,targets,hits,repeats] of [['three',3,1,1],['rescan',1,1,3],['fixed',1,3,1]]){
    await page.locator(`[data-action="execution-preset"][data-preset="${key}"]`).tap();
    assert.equal(await input(q+'.pick.count').inputValue(),String(targets));assert.equal(await input(q+'.pick.stat').inputValue(),'hp');assert.equal(await input(q+'.pick.direction').inputValue(),'desc');
    assert.equal(await input(e+'.repeatCount').inputValue(),String(hits));assert.equal(await input(e+'.repetition.count').inputValue(),String(repeats));
    assert.match(await page.locator('[data-effect-index="0"] .execution-note').textContent(),new RegExp('各対象に'+hits+'回攻撃.*×'+repeats));
    await snapshot('repetition-'+key,page.locator('.preview-skill').filter({has:page.locator('h3',{hasText:'一閃'})}));
  }
  await page.locator('[data-action="add-effect"]').tap();await input(p+'.effects.1.typeId').selectOption('status');await input(p+'.effects.1.statusId').selectOption('defenseDown');await input(p+'.effects.1.target.source').selectOption('previousEffectTarget');await input(p+'.effects.1.amount.mode').selectOption('none');
  await page.locator('[data-action="execution-preset"][data-preset="rescan"]').tap();
  assert.match(await plan(),/］×3 → 2\. 防御低下/);assert.match(await page.locator('#preview').textContent(),/今回の行動セットで、前の効果が対象にした全員/);
  await input(e+'.repetition.count').fill('1');await input(p+'.repeatCount').fill('3');
  assert.match(await plan(),/［1\. 攻撃 1回（対象固定） → 2\. 防御低下］×3（行動全体）/);
  await snapshot('repetition-action-preview',page.locator('.preview-skill').filter({has:page.locator('h3',{hasText:'一閃'})}));
  for(const width of [1440,820,390,320]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'繰り返しUI '+width);}
  await page.setViewportSize({width:390,height:844});await snapshot('repetition-action-editor',page.locator('.action-repeat-group'));
  await page.locator('[data-action="move-effect"][data-index="1"][data-direction="up"]').tap();assert.match(await page.locator('.readiness').textContent(),/先頭の効果/);
  await page.locator('[data-action="move-effect"][data-index="0"][data-direction="down"]').tap();assert.doesNotMatch(await page.locator('.readiness').textContent(),/先頭の効果/);
  await save();await page.reload();await input('card.name').waitFor();await page.locator('[data-tab="effects"]').tap();await page.locator('[data-slot="front"]').tap();assert.equal(await input(p+'.repeatCount').inputValue(),'3');assert.equal(await input(e+'.repetition.count').inputValue(),'1');
  const db=await page.evaluate(async()=>(await StudioStorage.connect()).initialLibrary),stored=db.cards.find(c=>c.id===id);assert.equal(stored.card.skills.front.repeatCount,3);assert.equal(stored.card.skills.front.effects[1].target.source,'previousEffectTarget');
  const exported=page.waitForEvent('download');await page.locator('[data-action="export-card"]').tap();const spec=JSON.parse(await fs.readFile(await(await exported).path(),'utf8'));assert.equal(spec.card.skills.front.repeatCount,3);assert.equal(spec.card.skills.front.effects[0].repetition.count,1);
  // Previously saved per-attack searches are displayed in the new notation without rewriting on read/save.
  const old=M.template('attack');old.card.name='旧毎回サーチ';const oldE=old.card.skills.front.effects[0];delete oldE.repetition;oldE.repeatCount=3;oldE.target.query.timing.mode='each';
  const event=M.clone(old);event.id=M.id('design');event.card.name='旧イベント';event.card.skills.front.effects[0].target.query.timing={mode:'event',event:'custom',text:'味方が回復した直後'};
  await page.locator('#json-file').setInputFiles({name:'old-execution.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schemaVersion:1,revision:0,cards:[old,event],definitions:[]}))});
  await page.locator(`[data-open="${old.id}"]`).tap();await page.locator('[data-slot="front"]').tap();
  assert.equal(await input(e+'.repeatCount').inputValue(),'1');assert.equal(await input(e+'.repetition.count').inputValue(),'3');await save();
  const untouched=await page.evaluate(async id=>(await StudioStorage.connect()).initialLibrary.cards.find(c=>c.id===id),old.id);assert.equal(untouched.card.skills.front.effects[0].repeatCount,3);assert.equal(untouched.card.skills.front.effects[0].repetition,undefined);
  await input(e+'.repetition.count').fill('4');await save();await page.reload();await page.locator(`[data-open="${old.id}"]`).tap();await page.locator('[data-tab="effects"]').tap();await page.locator('[data-slot="front"]').tap();assert.equal(await input(e+'.repeatCount').inputValue(),'1');assert.equal(await input(e+'.repetition.count').inputValue(),'4');
  await page.locator(`[data-open="${event.id}"]`).tap();assert.equal(await page.locator('.legacy-execution').count(),1);assert.equal(await input(e+'.repetition.count').count(),0);assert.equal(await input(e+'.target.query.timing.text').inputValue(),'味方が回復した直後');
  await page.locator(`[data-open="${id}"]`).tap();
  return {patterns:3,effectRepeat:true,actionRepeat:true,referenceScope:'actionIteration',legacyEach:true,legacyEvent:true,saved:true};
}
module.exports={checkRepetition};

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
async function checkAbilityIdeas(page,artifactDir){
  const input=k=>page.locator(`[data-idea-bind="idea-${k}"]`),save=async()=>{await page.locator('#save').tap();await page.locator('#save-state').filter({hasText:'保存済み'}).waitFor();};
  const open=async id=>{await page.locator('[data-view="ideas"]').tap();await page.locator('#search').fill('');await page.locator('#idea-filter').selectOption('all');await page.locator(`[data-open-idea="${id}"]`).tap();};
  const original='攻撃を受けるたび反撃する。\n3回当たれば3回。 <未決> & AT×0.5',revised='攻撃終了後に一度だけ反撃する。';
  await page.locator('[data-view="ideas"]').tap();await page.locator('#new-idea').tap();
  await input('description').fill(original);await save();
  let db=await page.evaluate(async()=>(await StudioStorage.connect()).initialLibrary);const id=db.abilityIdeas.find(a=>a.description===original).id;
  assert.equal(db.abilityIdeas.find(a=>a.id===id).cardId,'');assert.equal(db.abilityIdeas.find(a=>a.id===id).name,'');
  await page.reload();await page.locator('#save-state').filter({hasText:'接続'}).waitFor();await open(id);assert.equal(await input('description').inputValue(),original);
  await input('description').fill(revised);await input('name').fill('反撃のタイミング案');await input('examples').fill('3連撃でも1回。先に倒れた場合は要確認。');await save();
  await page.locator('.idea-history>details').first().locator('summary').tap();assert.equal(await page.locator('.original-description').textContent(),original);
  await page.locator('[data-view="cards"]').tap();await page.locator('#new-card').tap();await page.locator('#dialog [data-template="blank"]').tap();await page.getByLabel('カード名',{exact:true}).fill('能力案の関連カード');await page.getByLabel('AT',{exact:true}).fill('42');await save();
  db=await page.evaluate(async()=>(await StudioStorage.connect()).initialLibrary);const card=db.cards.find(d=>d.card.name==='能力案の関連カード'),before=JSON.stringify(card.card);
  await open(id);await page.locator('.idea-links summary').tap();await input('cardId').selectOption(card.id);await input('slot').selectOption('trait');await save();
  await page.locator('[data-action="idea-card"]').tap();assert.match(await page.locator('.linked-ideas').textContent(),/反撃のタイミング案/);
  await page.locator('[data-action="add-card-idea"]').tap();await input('description').fill('回復を受けたとき、その量に応じて行動順を変える状態。');await page.locator('[data-action="next-idea"]').tap();await input('description').filter({hasText:''}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-idea-bind="idea-description"]').value==='');assert.equal(await input('cardId').inputValue(),card.id);await page.locator('[data-action="discard-idea"]').tap();await save();
  db=await page.evaluate(async()=>(await StudioStorage.connect()).initialLibrary);assert.equal(JSON.stringify(db.cards.find(d=>d.id===card.id).card),before);
  const secondId=db.abilityIdeas.find(a=>a.description.startsWith('回復を')).id;
  await page.locator('#search').fill('3回当たれば3回');assert.equal(await page.locator('.idea-list-card').count(),1);await page.locator('.idea-list-card').tap();
  await page.locator('[data-action="archive-idea"]').tap();assert.equal(await page.locator('.idea-list-card').count(),0);await page.locator('#idea-filter').selectOption('archived');assert.equal(await page.locator('.idea-list-card').count(),1);await save();
  await page.locator('[data-action="archive-idea"]').tap();await save();await page.locator('#search').fill('');await page.locator('#idea-filter').selectOption('active');
  await page.locator('#new-idea').tap();await page.locator('#save').tap();await page.locator('#notice').filter({hasText:'説明は必須'}).waitFor();await page.locator('[data-action="discard-idea"]').tap();await save();await open(secondId);
  const corpusDownload=page.waitForEvent('download');await page.locator('[data-action="export-ideas"]').tap();const corpus=JSON.parse(await fs.readFile(await(await corpusDownload).path(),'utf8'));
  assert.equal(corpus.format,'card-ability-corpus');assert.equal(corpus.abilityIdeas.find(a=>a.id===id).revisions[0].description,original);assert.equal(corpus.relatedCards.find(d=>d.designId===card.id).at,42);
  const dbDownload=page.waitForEvent('download');await page.locator('#export-library').tap();const dbPath=await(await dbDownload).path(),exported=JSON.parse(await fs.readFile(dbPath,'utf8'));
  const storageMode=await page.evaluate(async()=>(await StudioStorage.connect()).mode);
  if(storageMode==='device'){
    const other=await page.context().browser().newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    try{const clean=await other.newPage();await clean.goto(page.url());await clean.locator('#save-state').filter({hasText:'接続'}).waitFor();await clean.locator('#json-file').setInputFiles(dbPath);await clean.locator('#save').tap();await clean.locator('#save-state').filter({hasText:'保存済み'}).waitFor();await clean.reload();await clean.locator('#save-state').filter({hasText:'接続'}).waitFor();
      const transferred=await clean.evaluate(async()=>(await StudioStorage.connect()).initialLibrary);assert.deepEqual(transferred.abilityIdeas,exported.abilityIdeas);assert.deepEqual(transferred.cards.map(d=>d.card),exported.cards.map(d=>d.card));
    }finally{await other.close();}
  }
  for(const width of [1440,820,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'ideas width '+width);}
  await page.setViewportSize({width:390,height:844});await open(id);await page.locator('.idea-history>details').first().locator('summary').tap();
  if(artifactDir){await fs.mkdir(artifactDir,{recursive:true});await page.locator('#main').screenshot({path:path.join(artifactDir,'ability-ideas-mobile.png')});await page.locator('#preview').screenshot({path:path.join(artifactDir,'ability-ideas-preview.png')});}
  await page.locator('[data-action="idea-card"]').tap();if(artifactDir)await page.locator('#main').screenshot({path:path.join(artifactDir,'ability-card-tab.png')});
  return {passed:true,independent:true,linked:true,originalHistory:true,search:true,archive:true,export:true,transfer:storageMode==='device',widths:[1440,820,390,320],realIphoneTested:false};
}
module.exports={checkAbilityIdeas};

'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {checkRepetition}=require('./repetition-browser-checks');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {editEffects,assertEffects,editStatusEffects,assertStatusEffects,editTargeting,assertTargeting,editCompactForms,assertCompactForms}=require('./effect-browser-checks');
const base='/game_development/card-studio/';
const allowed=['index.html','app.js','model.js','targeting.js','storage.js','styles.css','favicon.svg'];
const requests=[];
(async()=>{
  const server=http.createServer(async(req,res)=>{
    requests.push({method:req.method,url:req.url});
    const name=req.url.slice(base.length)||'index.html';
    if(req.method!=='GET'||!req.url.startsWith(base)||!allowed.includes(name)){res.writeHead(404).end();return;}
    const types={html:'text/html',js:'application/javascript',css:'text/css',svg:'image/svg+xml'};
    res.setHeader('Content-Type',types[name.split('.').pop()]+'; charset=utf-8');res.end(await fs.readFile(path.join(__dirname,name)));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}${base}`;
  let browser;const errors=[];
  try {
    browser=await chromium.launch({channel:'msedge',headless:true});
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,acceptDownloads:true});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);await page.getByText('✓ この端末のDBに接続',{exact:true}).waitFor();
    await page.locator('[data-template="attack"]').tap();await page.getByLabel('カード名',{exact:true}).fill('iPhoneの新カード');
    await page.locator('[data-action="add-trait"]').tap();await page.locator('[data-bind="card.traits.0.definitionId"]').selectOption('ambush');
    await page.locator('[data-bind="card.traits.0.value"]').fill('5');await page.locator('[data-bind="card.traits.0.effectAmount"]').fill('AT×1.25');
    assert.match(await page.locator('.preview-traits').textContent(),/待ち伏せ5 \/ AT×1.25/);
    await page.getByRole('button',{name:'待ち伏せの説明',exact:true}).tap();assert.match(await page.locator('#dialog-body').textContent(),/常時反撃状態/);await page.keyboard.press('Escape');
    await page.locator('[data-action="new-trait-definition"]').tap();await page.locator('[name="traitName"]').fill('共通特性の検証');await page.locator('#trait-definition-form [name="description"]').fill('再利用する説明');await page.locator('#trait-definition-form button[type="submit"]').tap();
    await page.locator('[data-action="add-trait"]').tap();await page.locator('[data-bind="card.traits.1.definitionId"]').selectOption({label:'共通特性の検証'});
    await page.locator('[data-tab="effects"]').tap();
    for(const [slot,cell] of [['front',3],['middle',4],['rear',5]]) {
      await page.locator(`[data-slot="${slot}"]`).tap();
      if(slot!=='front'){await page.locator(`[data-bind="card.skills.${slot}.enabled"]`).check();await page.locator('[data-action="add-effect"]').tap();}
      assert.equal(await page.locator('[data-effect-index="0"] .origin').count(),0,'絶対位置に自身マークを表示しない');
      await page.locator('[data-action="target-preset"][data-index="0"][data-preset="self"]').tap();
      assert.equal(await page.locator('[data-effect-index="0"] .origin').getAttribute('data-cell'),String(cell));
      assert.equal(await page.locator(`[data-effect-index="0"] [data-side="ally"][data-cell="${cell}"]`).getAttribute('aria-pressed'),'true');
    }
    await editEffects(page);
    await editStatusEffects(page);
    await editTargeting(page);
    await editCompactForms(page,path.join(__dirname,'data','verification'));
    await page.locator('[data-tab="notes"]').tap();await page.locator('[data-bind="notes.intent"]').fill('端末にだけ残す設計意図');
    await page.locator('#save').tap();await page.locator('#save-state').filter({hasText:'保存済み'}).waitFor();
    await page.reload();await page.getByLabel('カード名',{exact:true}).waitFor();assert.equal(await page.getByLabel('カード名',{exact:true}).inputValue(),'iPhoneの新カード');
    const second=await context.newPage();await second.goto(url);await second.getByLabel('カード名',{exact:true}).waitFor();
    await page.getByLabel('AT',{exact:true}).fill('35');await page.locator('#save').tap();await page.locator('#save-state').filter({hasText:'保存済み'}).waitFor();
    await second.getByLabel('AT',{exact:true}).fill('90');await second.locator('#save').click();await second.locator('#notice').filter({hasText:'別の画面'}).waitFor();
    assert.equal(await second.getByLabel('AT',{exact:true}).inputValue(),'90');
    const db=await page.evaluate(async()=>{const s=await StudioStorage.connect();return s.initialLibrary;});assert.equal(db.cards[0].card.at,35);assert.equal(db.cards[0].notes.intent,'端末にだけ残す設計意図');
    assert.equal(db.cards[0].card.traits[0].effectAmount,'AT×1.25');assert.equal(db.cards[0].card.traits[0].value,'5');assert.equal(db.traitDefinitions[0].name,'共通特性の検証');
    assertEffects(db.cards[0].card);
    assertStatusEffects(db.cards[0].card);
    assertTargeting(db.cards[0].card);
    assertCompactForms(db.cards[0].card);
    const backupEvent=page.waitForEvent('download');await page.locator('[data-action="export-backup"]').tap();
    const backup=JSON.parse(await fs.readFile(await(await backupEvent).path(),'utf8'));assert.equal(backup.cards[0].card.at,30);
    const exportEvent=page.waitForEvent('download');await page.locator('#export-library').tap();const exported=await(await exportEvent).path();
    const isolated=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const clean=await isolated.newPage();await clean.goto(url);
    await clean.getByText('✓ この端末のDBに接続',{exact:true}).waitFor();assert.equal(await clean.locator('.library-card').count(),0);
    await clean.locator('#json-file').setInputFiles(exported);await clean.locator('#save').tap();await clean.locator('#save-state').filter({hasText:'保存済み'}).waitFor();await clean.reload();assert.equal(await clean.getByLabel('AT',{exact:true}).inputValue(),'35');
    assertEffects(await clean.evaluate(async()=>(await StudioStorage.connect()).initialLibrary.cards[0].card));
    assertStatusEffects(await clean.evaluate(async()=>(await StudioStorage.connect()).initialLibrary.cards[0].card));
    assertTargeting(await clean.evaluate(async()=>(await StudioStorage.connect()).initialLibrary.cards[0].card));
    assertCompactForms(await clean.evaluate(async()=>(await StudioStorage.connect()).initialLibrary.cards[0].card));
    await page.locator('[data-tab="effects"]').tap();await page.locator('[data-bind="card.skills.front.effects.0.target.source"]').selectOption('grid');await page.locator('[data-action="cell"][data-index="0"][data-side="ally"][data-cell="4"]').tap();
    assert.equal(await page.locator('[data-action="cell"][data-index="0"][data-side="ally"][data-cell="4"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const artifactDir=path.join(__dirname,'data','verification');await fs.mkdir(artifactDir,{recursive:true});await page.screenshot({path:path.join(artifactDir,'iphone-static.png'),fullPage:true});
    assert.equal(requests.filter(r=>r.method!=='GET').length,0,'静的公開先にカードデータを送信しない');assert.deepEqual(errors,[]);
    await page.locator('[data-bind="card.skills.front.effects.0.target.source"]').selectOption('attackSource');await page.locator('[data-effect-index="0"]').screenshot({path:path.join(artifactDir,'attack-context-mobile.png')});await page.locator('[data-effect-index="1"]').screenshot({path:path.join(artifactDir,'debuff-mobile.png')});
    await page.locator('[data-slot="ultimate"]').tap();await page.locator('.preview-skill').filter({has:page.locator('h3',{hasText:'三段の検証'})}).screenshot({path:path.join(artifactDir,'ultimate-preview-mobile.png')});
    await page.locator('[data-slot="middle"]').tap();await page.locator('.editor-body').screenshot({path:path.join(artifactDir,'status-mobile.png')});
    await page.locator('[data-slot="rear"]').tap();await page.locator('.target-query').screenshot({path:path.join(artifactDir,'target-query-mobile.png')});
    const repetition=await checkRepetition(page,artifactDir);assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(artifactDir,'repetition-results.json'),JSON.stringify(repetition,null,2));
    await fs.writeFile(path.join(artifactDir,'static-results.json'),JSON.stringify({passed:true,checks:['サブパス配信','端末内保存と再読込','タブ競合の保護','前回バックアップ出力','独立端末へのJSON取込','対象マスタップと390px表示','強化弱体する能力の独立指定','行動効果による対象指定','3回攻撃を1効果として保存','必殺技3効果の追加複製並替と上限','付与状態の選択・独自名・検索・切替保持','対象条件の複合・属性・行動順・自然文・全員/順位・固定/再サーチ・旧形式移行','初期配置制限・枚数区分の保存と再読込','直接範囲とサーチの切替・条件保持・発動時点','絶対位置の自身マーク非表示・相対位置の表示・塗り分け','1440/820/390/320px表示','公開先への書込通信なし'],webkitTested:false},null,2));
    console.log('PASS: static subpath, device persistence, conflict, backup, JSON transfer, mobile touch, no remote writes');
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

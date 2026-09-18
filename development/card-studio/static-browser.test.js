'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base='/game_development/card-studio/';
const allowed=['index.html','app.js','model.js','storage.js','styles.css','favicon.svg'];
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
    await page.locator('[data-tab="notes"]').tap();await page.locator('[data-bind="notes.intent"]').fill('端末にだけ残す設計意図');
    await page.locator('#save').tap();await page.locator('#save-state').filter({hasText:'保存済み'}).waitFor();
    await page.reload();await page.getByLabel('カード名',{exact:true}).waitFor();assert.equal(await page.getByLabel('カード名',{exact:true}).inputValue(),'iPhoneの新カード');
    const second=await context.newPage();await second.goto(url);await second.getByLabel('カード名',{exact:true}).waitFor();
    await page.getByLabel('AT',{exact:true}).fill('35');await page.locator('#save').tap();await page.locator('#save-state').filter({hasText:'保存済み'}).waitFor();
    await second.getByLabel('AT',{exact:true}).fill('90');await second.locator('#save').click();await second.locator('#notice').filter({hasText:'別の画面'}).waitFor();
    assert.equal(await second.getByLabel('AT',{exact:true}).inputValue(),'90');
    const db=await page.evaluate(async()=>{const s=await StudioStorage.connect();return s.initialLibrary;});assert.equal(db.cards[0].card.at,35);assert.equal(db.cards[0].notes.intent,'端末にだけ残す設計意図');
    const backupEvent=page.waitForEvent('download');await page.locator('[data-action="export-backup"]').tap();
    const backup=JSON.parse(await fs.readFile(await(await backupEvent).path(),'utf8'));assert.equal(backup.cards[0].card.at,30);
    const exportEvent=page.waitForEvent('download');await page.locator('#export-library').tap();const exported=await(await exportEvent).path();
    const isolated=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const clean=await isolated.newPage();await clean.goto(url);
    await clean.getByText('✓ この端末のDBに接続',{exact:true}).waitFor();assert.equal(await clean.locator('.library-card').count(),0);
    await clean.locator('#json-file').setInputFiles(exported);await clean.locator('#save').tap();await clean.locator('#save-state').filter({hasText:'保存済み'}).waitFor();await clean.reload();assert.equal(await clean.getByLabel('AT',{exact:true}).inputValue(),'35');
    await page.locator('[data-tab="effects"]').tap();await page.locator('[data-action="cell"][data-index="0"][data-side="ally"][data-cell="4"]').tap();
    assert.equal(await page.locator('[data-action="cell"][data-index="0"][data-side="ally"][data-cell="4"]').getAttribute('aria-pressed'),'true');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const artifactDir=path.join(__dirname,'data','verification');await fs.mkdir(artifactDir,{recursive:true});await page.screenshot({path:path.join(artifactDir,'iphone-static.png'),fullPage:true});
    assert.equal(requests.filter(r=>r.method!=='GET').length,0,'静的公開先にカードデータを送信しない');assert.deepEqual(errors,[]);
    await fs.writeFile(path.join(artifactDir,'static-results.json'),JSON.stringify({passed:true,checks:['サブパス配信','端末内保存と再読込','タブ競合の保護','前回バックアップ出力','独立端末へのJSON取込','対象マスタップと390px表示','公開先への書込通信なし'],webkitTested:false},null,2));
    console.log('PASS: static subpath, device persistence, conflict, backup, JSON transfer, mobile touch, no remote writes');
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});

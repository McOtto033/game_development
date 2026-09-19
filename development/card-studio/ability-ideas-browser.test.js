'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {createServer}=require('./server'),{checkAbilityIdeas}=require('./ability-ideas-browser-checks');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true}),results=[];
  try{for(const mode of ['server','static']){
    const dir=await fs.mkdtemp(path.join(os.tmpdir(),'card-studio-ideas-'));
    const server=mode==='server'?createServer({dataDir:dir}):http.createServer(async(req,res)=>{
      const name=req.url.slice('/card-studio/'.length)||'index.html';
      if(req.method!=='GET'||!req.url.startsWith('/card-studio/')||!['index.html','app.js','model.js','targeting.js','storage.js','styles.css','favicon.svg'].includes(name)){res.writeHead(404).end();return;}
      res.setHeader('Content-Type',({'html':'text/html','js':'text/javascript','css':'text/css','svg':'image/svg+xml'})[name.split('.').pop()]+'; charset=utf-8');res.end(await fs.readFile(path.join(__dirname,name)));
    });
    await new Promise(r=>server.listen(0,'127.0.0.1',r));const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,acceptDownloads:true});
    try{const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
      await page.goto(`http://127.0.0.1:${server.address().port}/${mode==='static'?'card-studio/':''}`);await page.locator('#save-state').filter({hasText:'接続'}).waitFor();
      const result=await checkAbilityIdeas(page,path.join(__dirname,'data','verification','ideas-'+mode));assert.deepEqual(errors,[]);if(mode==='static')assert.deepEqual(writes,[]);
      if(mode==='server'){const saved=JSON.parse(await fs.readFile(path.join(dir,'library.json'),'utf8'));assert.equal(saved.abilityIdeas.length,2);assert.equal(saved.abilityIdeas.find(a=>a.name==='反撃のタイミング案').revisions[0].description.includes('3回当たれば3回'),true);}
      results.push({mode,...result});
    }finally{await context.close();await new Promise(r=>server.close(r));}
  }}finally{await browser.close();}
  await fs.writeFile(path.join(__dirname,'data','verification','ability-ideas-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exitCode=1;});

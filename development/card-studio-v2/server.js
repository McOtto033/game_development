'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const files=['index.html','app.js','model.js','storage.js','styles.css','schema.json','favicon.svg'];
const oldFiles=['index.html','app.js','model.js','targeting.js','storage.js','styles.css','favicon.svg'];
function createServer(){return http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
  if(url.pathname==='/'){res.writeHead(302,{Location:'/card-studio-v2/'}).end();return;}
  const old=url.pathname.startsWith('/card-studio/'),prefix=old?'/card-studio/':'/card-studio-v2/';
  const file=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length)||'index.html':'';
  if(!(old?oldFiles:files).includes(file)){res.writeHead(404).end();return;}
  try{const data=await fs.readFile(path.join(__dirname,old?'../card-studio':'.',file));res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)])+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}catch{res.writeHead(404).end();}
});}
if(require.main===module){const port=Number(process.env.CARD_STUDIO_V2_PORT||4318);createServer().listen(port,'127.0.0.1',()=>console.log('カード設計室 v2: http://127.0.0.1:'+port+'/card-studio-v2/'));}
module.exports={createServer,files};

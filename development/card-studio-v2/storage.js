(function(){
 'use strict';const M=window.TreeModel;
 const databaseName='card-studio-v2:'+new URL('.',location.href).pathname;
 const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(databaseName,1);r.onupgradeneeded=()=>{r.result.createObjectStore('library');r.result.createObjectStore('backups');};r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result);};r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('別の改良版タブを閉じて再読み込みしてください。'));});
 const read=(db,store,key)=>new Promise((resolve,reject)=>{const r=db.transaction(store,'readonly').objectStore(store).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 async function connect(schema){
   const db=await open(),initial=M.validateLibrary((await read(db,'library','current'))??M.empty(schema));
   return {initial,databaseName,save(proposed){
     M.validateLibrary(proposed);const snapshot=M.clone(proposed);
     return new Promise((resolve,reject)=>{
       const tx=db.transaction(['library','backups'],'readwrite'),s=tx.objectStore('library');let saved,problem;
       tx.oncomplete=()=>resolve(saved);tx.onabort=()=>reject(problem||Error('保存に失敗しました。入力は保持されています。DB書き出しで退避できます。'));
       const req=s.get('current');req.onsuccess=()=>{try{
         const current=req.result??M.empty(schema);
         if(current.revision!==snapshot.revision)throw Error('別のタブで更新されています。入力は保持しています。DB書き出しで退避してから再読み込みしてください。');
         saved={...snapshot,revision:current.revision+1};if(current.revision)tx.objectStore('backups').put(current,current.revision);s.put(saved,'current');
       }catch(e){problem=e;tx.abort();}};
     });
   },backup(){return new Promise((resolve,reject)=>{const r=db.transaction('backups','readonly').objectStore('backups').openCursor(null,'prev');r.onsuccess=()=>resolve(r.result?.value??null);r.onerror=()=>reject(r.error);});}};
 }
 window.TreeStorage={connect};
})();

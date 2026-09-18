(function () {
  'use strict';
  const M=window.StudioModel;
  const conflict=()=>Object.assign(new Error('別の画面で更新されています。編集中の内容は保持しています。「DB書き出し」で退避してから画面を再読み込みし、退避JSONを取り込んでください。'),{status:409});
  const empty=()=>({schemaVersion:1,revision:0,cards:[],definitions:[]});
  const databaseName='card-studio-v1:'+new URL('.',location.href).pathname;
  function openDatabase() {
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(databaseName,1);
      request.onupgradeneeded=()=>{request.result.createObjectStore('library');request.result.createObjectStore('backups');};
      request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
      request.onerror=()=>reject(request.error);
      request.onblocked=()=>reject(Error('端末内DBを開けません。他のカード設計室のタブを閉じて再読み込みしてください。'));
    });
  }
  function read(db,store,key) {
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(store,'readonly'),request=tx.objectStore(store).get(key);
      request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
    });
  }
  async function deviceStore() {
    let db;
    try {db=await openDatabase();}catch {throw Error('このブラウザでは端末内DBを開けません。Safariの通常タブで開き直してください。');}
    const initialLibrary=M.validateLibrary((await read(db,'library','current'))??empty());
    return {
      mode:'device',initialLibrary,
      save(proposed) {
        M.validateLibrary(proposed);
        return new Promise((resolve,reject)=>{
          const tx=db.transaction(['library','backups'],'readwrite'),store=tx.objectStore('library');let saved,issue;
          tx.oncomplete=()=>resolve(saved);
          tx.onabort=()=>reject(issue||(tx.error?.name==='QuotaExceededError'?Error('端末の保存容量が不足しています。編集内容は保持しています。DB書き出しで退避してください。'):Error('端末内DBへの保存に失敗しました。編集内容は保持しています。')));
          const request=store.get('current');
          request.onsuccess=()=>{
            try {
              const current=M.validateLibrary(request.result??empty());
              if(current.revision!==proposed.revision)throw conflict();
              saved={...M.clone(proposed),revision:current.revision+1};
              if(current.revision>0)tx.objectStore('backups').put(current,current.revision);
              store.put(saved,'current');
            }catch(error){issue=error;tx.abort();}
          };
        });
      },
      latestBackup() {
        return new Promise((resolve,reject)=>{
          const request=db.transaction('backups','readonly').objectStore('backups').openCursor(null,'prev');
          request.onsuccess=()=>resolve(request.result?.value??null);request.onerror=()=>reject(request.error);
        });
      }
    };
  }
  async function connect() {
    // GitHub Pages is static. Never send design data to the public host.
    if(location.hostname.endsWith('.github.io'))return deviceStore();
    const api=new URL('api/library',new URL('.',location.href));
    const response=await fetch(api,{cache:'no-store'});
    if(response.status===404)return deviceStore();
    const initialLibrary=await response.json();
    if(!response.ok)throw Error(initialLibrary.error||'DBを読み込めません。');
    M.validateLibrary(initialLibrary);
    return {mode:'server',initialLibrary,async save(proposed){
      const response=await fetch(api,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(proposed)});
      const data=await response.json();if(response.status===409)throw conflict();
      if(!response.ok)throw Error(data.error||'保存に失敗しました。');return M.validateLibrary(data);
    }};
  }
  window.StudioStorage={connect};
})();

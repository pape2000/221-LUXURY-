(function(){
  'use strict';
  if(window.__221LUXURY_MANAGER_BOOTSTRAP__) return;
  window.__221LUXURY_MANAGER_BOOTSTRAP__=true;

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));

  async function waitForManagerDb(maxMs){
    const start=Date.now();
    while(Date.now()-start<maxMs){
      const manager=window.__221LUXURY_SUPABASE_MANAGER__;
      if(manager && manager.db) return manager.db;
      await sleep(250);
    }
    throw new Error('Gestionnaire Supabase non initialisé.');
  }

  async function waitForStoreAndEmptyCatalog(db,maxMs){
    const start=Date.now();
    while(Date.now()-start<maxMs){
      const {data:{session}}=await db.auth.getSession();
      if(!session){ await sleep(500); continue; }
      const {data:stores,error:se}=await db.from('stores').select('id').eq('owner_id',session.user.id).eq('slug','221-luxury').limit(1);
      if(se){ console.warn('[221 LUXURY] bootstrap store check:',se); await sleep(1000); continue; }
      if(stores && stores.length){
        const {count,error:pe}=await db.from('products').select('id',{count:'exact',head:true}).eq('store_id',stores[0].id);
        if(!pe) return {storeId:stores[0].id,count:count||0};
      }
      await sleep(700);
    }
    return null;
  }

  async function migrateCurrentPublicCatalog(db,storeId){
    const {count,error}=await db.from('products').select('id',{count:'exact',head:true}).eq('store_id',storeId);
    if(error || (count||0)>0) return false;
    const response=await fetch('/index.html',{cache:'no-store'});
    if(!response.ok) throw new Error('Impossible de lire le catalogue public actuel.');
    const html=await response.text();
    const file=new File([html],'index.html',{type:'text/html'});
    if(typeof window.loadFile!=='function') throw new Error('Importeur du catalogue indisponible.');
    window.loadFile({target:{files:[file]}});
    return true;
  }

  async function init(){
    try{
      const db=await waitForManagerDb(15000);
      const state=await waitForStoreAndEmptyCatalog(db,30000);
      if(!state || state.count>0) return;
      await migrateCurrentPublicCatalog(db,state.storeId);
    }catch(err){
      console.warn('[221 LUXURY] automatic catalog bootstrap skipped:',err);
    }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
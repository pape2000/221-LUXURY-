(function(){
  'use strict';
  if(window.__221LUXURY_MANAGER_ENHANCEMENTS__) return;
  window.__221LUXURY_MANAGER_ENHANCEMENTS__=true;

  const CFG=window.__221LUXURY_SUPABASE__||{};
  const STORE_SLUG='221-luxury';
  const BUCKET='product-images';

  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  async function waitDb(maxMs){
    const start=Date.now();
    while(Date.now()-start<maxMs){
      const mgr=window.__221LUXURY_SUPABASE_MANAGER__;
      if(mgr&&mgr.db) return mgr.db;
      await sleep(250);
    }
    throw new Error('Gestionnaire Supabase non initialisé.');
  }
  async function getStore(db){
    const {data:{session}}=await db.auth.getSession();
    if(!session) throw new Error('Session administrateur absente.');
    const {data,error}=await db.from('stores').select('id,owner_id,slug').eq('owner_id',session.user.id).eq('slug',STORE_SLUG).maybeSingle();
    if(error) throw error;
    if(!data) throw new Error('Boutique 221 LUXURY introuvable.');
    return {store:data,user:session.user};
  }
  function notify(message,type){
    if(typeof window.notify==='function') return window.notify(message,type||'info');
    if(typeof window.showToast==='function') return window.showToast(message,type||'info');
  }
  function selectedIds(){
    const s=window.selectedIds;
    return s instanceof Set ? [...s] : [];
  }
  function reloadManager(delay){
    setTimeout(()=>window.location.reload(),Math.max(0,delay||150));
  }

  window.bulkSetNew=async function(flag){
    const ids=selectedIds();
    if(!ids.length) return;
    try{
      const db=await waitDb(10000);
      const {store}=await getStore(db);
      const products=Array.isArray(window.products)?window.products:[];
      const dbIds=ids.map(id=>products.find(p=>p.id===id)?._dbId).filter(Boolean);
      if(!dbIds.length) throw new Error('Aucun produit Supabase correspondant à la sélection.');
      const {error}=await db.from('products').update({is_new:!!flag}).eq('store_id',store.id).in('id',dbIds);
      if(error) throw error;
      notify(dbIds.length+' produit(s) mis à jour dans Supabase.','success');
      reloadManager();
    }catch(err){console.error(err);notify(err?.message||'Mise à jour des nouveautés impossible.','error');}
  };

  window.bulkSetBadge=async function(badge){
    const ids=selectedIds();
    if(!ids.length) return;
    try{
      const db=await waitDb(10000);
      const {store}=await getStore(db);
      const products=Array.isArray(window.products)?window.products:[];
      const dbIds=ids.map(id=>products.find(p=>p.id===id)?._dbId).filter(Boolean);
      if(!dbIds.length) throw new Error('Aucun produit Supabase correspondant à la sélection.');
      const {error}=await db.from('products').update({badge:badge||null}).eq('store_id',store.id).in('id',dbIds);
      if(error) throw error;
      notify(dbIds.length+' produit(s) mis à jour dans Supabase.','success');
      reloadManager();
    }catch(err){console.error(err);notify(err?.message||'Mise à jour des badges impossible.','error');}
  };

  function makeSlug(base){return (String(base||'produit').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'produit')+'-copie-'+Date.now();}

  window.duplicateProduct=async function(id){
    try{
      const db=await waitDb(10000);
      const {store}=await getStore(db);
      const products=Array.isArray(window.products)?window.products:[];
      const src=products.find(p=>p.id===id);
      if(!src||!src._dbId) throw new Error('Produit introuvable.');
      const {data:row,error:pe}=await db.from('products').select('*').eq('id',src._dbId).eq('store_id',store.id).single();
      if(pe) throw pe;

      const copyPayload={
        store_id:store.id,
        slug:makeSlug(row.name),
        name:(row.name||'')+' (Copie)',
        description:row.description||'',
        details:row.details||'',
        price:Number(row.price)||0,
        old_price:row.old_price==null?null:Number(row.old_price),
        stock:Math.max(0,Number(row.stock)||0),
        stock_threshold:Math.max(0,Number(row.stock_threshold??5)),
        category:row.category||'',
        categories:Array.isArray(row.categories)?row.categories:[],
        badge:row.badge||null,
        is_new:!!row.is_new,
        published:row.published!==false,
        rating:row.rating==null?null:Number(row.rating),
        reviews:row.reviews==null?null:Number(row.reviews),
        personalization:row.personalization||{enabled:false,tiers:[]},
        photo_personalization:row.photo_personalization||{enabled:false,required:false}
      };

      const {data:copy,error:ce}=await db.from('products').insert(copyPayload).select('*').single();
      if(ce) throw ce;

      const {data:colors,error:coErr}=await db.from('product_colors').select('*').eq('product_id',row.id).order('sort_order');
      if(coErr) throw coErr;
      const colorMap=new Map();
      if((colors||[]).length){
        const colorRows=(colors||[]).map((c,i)=>({product_id:copy.id,name:c.name||'',hex:c.hex||'#D4AF37',sort_order:c.sort_order??i}));
        const {data:newColors,error}=await db.from('product_colors').insert(colorRows).select('*');
        if(error) throw error;
        (newColors||[]).forEach((c,i)=>colorMap.set((colors||[])[i].id,c.id));
      }

      const {data:variants,error:vaErr}=await db.from('product_variants').select('*').eq('product_id',row.id).order('sort_order');
      if(vaErr) throw vaErr;
      const variantMap=new Map();
      if((variants||[]).length){
        const variantRows=(variants||[]).map((v,i)=>({
          product_id:copy.id,
          color_id:v.color_id?colorMap.get(v.color_id)||null:null,
          size:v.size||'',
          price:Number(v.price)||0,
          old_price:v.old_price==null?null:Number(v.old_price),
          stock:v.stock==null?null:Math.max(0,Number(v.stock)||0),
          sort_order:v.sort_order??i
        }));
        const {data:newVariants,error}=await db.from('product_variants').insert(variantRows).select('*');
        if(error) throw error;
        (newVariants||[]).forEach((v,i)=>variantMap.set((variants||[])[i].id,v.id));
      }

      const {data:images,error:imErr}=await db.from('product_images').select('*').eq('product_id',row.id).order('sort_order');
      if(imErr) throw imErr;
      for(let i=0;i<(images||[]).length;i++){
        const im=images[i];
        let newPath='';
        if(im.storage_path){
          newPath=store.owner_id+'/'+store.id+'/'+copy.id+'/'+crypto.randomUUID()+'.jpg';
          const {error}=await db.storage.from(BUCKET).copy(im.storage_path,newPath);
          if(error) throw error;
        }
        if(newPath){
          const {error}=await db.from('product_images').insert({
            product_id:copy.id,
            color_id:im.color_id?colorMap.get(im.color_id)||null:null,
            variant_id:im.variant_id?variantMap.get(im.variant_id)||null:null,
            storage_path:newPath,
            is_cover:!!im.is_cover,
            sort_order:im.sort_order??i
          });
          if(error) throw error;
        }
      }

      notify('Produit dupliqué et enregistré dans Supabase.','success');
      reloadManager(300);
    }catch(err){
      console.error(err);
      notify(err?.message||'Duplication impossible.','error');
    }
  };
})();
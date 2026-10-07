(function(){
  'use strict';
  if(window.__221LUXURY_MANAGER_ENHANCEMENTS__) return;
  window.__221LUXURY_MANAGER_ENHANCEMENTS__=true;

  const STORE_SLUG='221-luxury';
  const BUCKET='product-images';

  function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
  async function waitDb(maxMs){
    const start=Date.now();
    while(Date.now()-start<maxMs){
      const manager=window.__221LUXURY_SUPABASE_MANAGER__;
      if(manager && manager.db) return manager.db;
      await sleep(200);
    }
    throw new Error('Gestionnaire Supabase non initialisé.');
  }
  async function getStore(db){
    const {data:{session}}=await db.auth.getSession();
    if(!session) throw new Error('Session administrateur absente.');
    const {data,error}=await db.from('stores').select('id,owner_id,slug')
      .eq('owner_id',session.user.id).eq('slug',STORE_SLUG).maybeSingle();
    if(error) throw error;
    if(!data) throw new Error('Boutique 221 LUXURY introuvable.');
    return {store:data,user:session.user};
  }
  function notify(message,type){
    if(typeof window.notify==='function') return window.notify(message,type||'info');
    if(typeof window.showToast==='function') return window.showToast(message,type||'info');
  }
  function getSelectedSlugs(){
    return [...document.querySelectorAll('#sidebarList .bulk-select:checked')]
      .map(el=>String(el.getAttribute('onclick')||'').match(/toggleSelect\('([^']+)'/)?.[1])
      .filter(Boolean);
  }
  function reloadManager(delay=150){ setTimeout(()=>window.location.reload(),delay); }

  window.bulkSetNew=async function(flag){
    const slugs=getSelectedSlugs();
    if(!slugs.length) return;
    try{
      const db=await waitDb(10000);
      const {store}=await getStore(db);
      const {data:rows,error}=await db.from('products').select('id').eq('store_id',store.id).in('slug',slugs);
      if(error) throw error;
      const ids=(rows||[]).map(row=>row.id);
      if(!ids.length) throw new Error('Aucun produit Supabase correspondant à la sélection.');
      const {error:updateError}=await db.from('products').update({is_new:!!flag}).eq('store_id',store.id).in('id',ids);
      if(updateError) throw updateError;
      notify(ids.length+' produit(s) mis à jour dans Supabase.','success');
      reloadManager();
    }catch(err){console.error(err);notify(err?.message||'Mise à jour impossible.','error');}
  };

  window.bulkSetBadge=async function(badge){
    const slugs=getSelectedSlugs();
    if(!slugs.length) return;
    try{
      const db=await waitDb(10000);
      const {store}=await getStore(db);
      const {data:rows,error}=await db.from('products').select('id').eq('store_id',store.id).in('slug',slugs);
      if(error) throw error;
      const ids=(rows||[]).map(row=>row.id);
      if(!ids.length) throw new Error('Aucun produit Supabase correspondant à la sélection.');
      const {error:updateError}=await db.from('products').update({badge:badge||null}).eq('store_id',store.id).in('id',ids);
      if(updateError) throw updateError;
      notify(ids.length+' produit(s) mis à jour dans Supabase.','success');
      reloadManager();
    }catch(err){console.error(err);notify(err?.message||'Mise à jour impossible.','error');}
  };

  function makeSlug(base){
    const clean=String(base||'produit').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'produit';
    return clean+'-copie-'+Date.now();
  }

  window.duplicateProduct=async function(slug){
    try{
      const db=await waitDb(10000);
      const {store}=await getStore(db);
      const {data:row,error}=await db.from('products').select('*').eq('slug',slug).eq('store_id',store.id).single();
      if(error) throw error;

      const {data:copy,error:copyError}=await db.from('products').insert({
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
      }).select('*').single();
      if(copyError) throw copyError;

      const {data:colors,error:colorError}=await db.from('product_colors').select('*').eq('product_id',row.id).order('sort_order');
      if(colorError) throw colorError;
      const colorMap=new Map();
      if((colors||[]).length){
        const {data:newColors,error}=await db.from('product_colors').insert((colors||[]).map((c,i)=>({
          product_id:copy.id,name:c.name||'',hex:c.hex||'#D4AF37',sort_order:c.sort_order??i
        }))).select('*');
        if(error) throw error;
        (newColors||[]).forEach((c,i)=>colorMap.set((colors||[])[i].id,c.id));
      }

      const {data:variants,error:variantError}=await db.from('product_variants').select('*').eq('product_id',row.id).order('sort_order');
      if(variantError) throw variantError;
      const variantMap=new Map();
      if((variants||[]).length){
        const {data:newVariants,error}=await db.from('product_variants').insert((variants||[]).map((v,i)=>({
          product_id:copy.id,
          color_id:v.color_id?colorMap.get(v.color_id)||null:null,
          size:v.size||'',
          price:Number(v.price)||0,
          old_price:v.old_price==null?null:Number(v.old_price),
          stock:v.stock==null?null:Math.max(0,Number(v.stock)||0),
          sort_order:v.sort_order??i
        }))).select('*');
        if(error) throw error;
        (newVariants||[]).forEach((v,i)=>variantMap.set((variants||[])[i].id,v.id));
      }

      const {data:images,error:imageError}=await db.from('product_images').select('*').eq('product_id',row.id).order('sort_order');
      if(imageError) throw imageError;
      for(let i=0;i<(images||[]).length;i++){
        const image=images[i];
        if(!image.storage_path) continue;
        const newPath=store.owner_id+'/'+store.id+'/'+copy.id+'/'+crypto.randomUUID()+'.jpg';
        const {error}=await db.storage.from(BUCKET).copy(image.storage_path,newPath);
        if(error) throw error;
        const {error:insertError}=await db.from('product_images').insert({
          product_id:copy.id,
          color_id:image.color_id?colorMap.get(image.color_id)||null:null,
          variant_id:image.variant_id?variantMap.get(image.variant_id)||null:null,
          storage_path:newPath,
          is_cover:!!image.is_cover,
          sort_order:image.sort_order??i
        });
        if(insertError) throw insertError;
      }

      notify('Produit dupliqué et enregistré dans Supabase.','success');
      reloadManager(300);
    }catch(err){
      console.error(err);
      notify(err?.message||'Duplication impossible.','error');
    }
  };

  function boot(){
    installAddProductBridge();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
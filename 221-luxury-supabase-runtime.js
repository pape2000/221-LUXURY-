(function(){
  'use strict';
  if (window.__221LUXURY_SUPABASE_RUNTIME__) return;
  window.__221LUXURY_SUPABASE_RUNTIME__ = true;

  const CONFIG_SRC = './supabase-config.js';
  const SUPABASE_SRC = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  const BUCKET = 'product-images';
  const STORE_SLUG = '221-luxury';

  function loadScript(src){
    return new Promise(function(resolve, reject){
      const existing = document.querySelector('script[src="' + src + '"]');
      if(existing){
        if(window.__221LUXURY_SUPABASE_CONFIG__ || window.supabase) return resolve();
        existing.addEventListener('load', resolve, {once:true});
        existing.addEventListener('error', reject, {once:true});
        return;
      }
      const s=document.createElement('script');
      s.src=src;
      s.onload=resolve;
      s.onerror=reject;
      document.head.appendChild(s);
    });
  }

  function buildClient(){
    const cfg=window.__221LUXURY_SUPABASE__||{};
    if(!cfg.url || !cfg.publishableKey) throw new Error('Supabase configuration missing');
    if(!window.supabase || !window.supabase.createClient) throw new Error('Supabase client missing');
    return window.supabase.createClient(cfg.url, cfg.publishableKey);
  }

  function storageUrl(client, path){
    return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl || '';
  }

  function normalize(row, client){
    const colors=(row.product_colors||[]).slice().sort(function(a,b){return (a.sort_order||0)-(b.sort_order||0);});
    const colorIndex=new Map(colors.map(function(c,i){return [c.id,i];}));
    const images=(row.product_images||[]).slice().sort(function(a,b){
      if(!!b.is_cover!==!!a.is_cover) return b.is_cover ? 1 : -1;
      return (a.sort_order||0)-(b.sort_order||0);
    }).map(function(p){
      return {src:storageUrl(client,p.storage_path),colorIdx:p.color_id && colorIndex.has(p.color_id)?colorIndex.get(p.color_id):null,isCover:!!p.is_cover};
    }).filter(function(p){return !!p.src;});
    const variants=(row.product_variants||[]).slice().sort(function(a,b){return (a.sort_order||0)-(b.sort_order||0);}).map(function(v){
      return {size:String(v.size||''),price:Number(v.price)||0,oldPrice:v.old_price==null?null:Number(v.old_price)||0,stock:v.stock==null?null:Math.max(0,Number(v.stock)||0)};
    }).filter(function(v){return !!v.size;});
    const cover=images.find(function(p){return p.isCover;})||images[0]||null;
    return {
      id:row.slug,
      dbId:row.id,
      name:row.name||'',
      category:row.category||((row.categories||[])[0]||''),
      categories:Array.isArray(row.categories)?row.categories:[],
      img:cover ? cover.src : '',
      price:Number(row.price)||0,
      oldPrice:row.old_price==null?null:Number(row.old_price)||0,
      badge:row.badge||null,
      isNew:!!row.is_new,
      published:row.published!==false,
      stock:Math.max(0,Number(row.stock)||0),
      stockThreshold:Math.max(0,Number(row.stock_threshold)||0),
      colors:colors.map(function(c){return c.hex||'#ccc';}),
      colorData:colors.map(function(c){return {hex:c.hex,label:c.name};}),
      sizes:variants.map(function(v){return v.size;}),
      sizePrices:Object.fromEntries(variants.map(function(v){return [v.size,v.price];})),
      sizeVariants:variants,
      images:images.map(function(p){return p.src;}),
      photos:images,
      personalization:row.personalization||{enabled:false,tiers:[]},
      photoPersonalization:row.photo_personalization||{enabled:false,required:false},
      description:row.description||'',
      details:row.details||'',
      rating:row.rating==null?null:Number(row.rating),
      reviews:row.reviews==null?null:Number(row.reviews)
    };
  }

  function repaint(){
    try{
      const cats=[...new Set((PRODUCTS||[]).flatMap(function(p){
        return (Array.isArray(p.categories)&&p.categories.length?p.categories:(p.category?[p.category]:[])).filter(Boolean);
      }))];
      if(typeof CATEGORIES!=='undefined' && Array.isArray(CATEGORIES)){
        CATEGORIES.splice(0,CATEGORIES.length,...cats);
      }
      if(typeof CATEGORIES_COMING_SOON!=='undefined' && Array.isArray(CATEGORIES_COMING_SOON)){
        CATEGORIES_COMING_SOON.splice(0,CATEGORIES_COMING_SOON.length);
      }
      if(typeof renderManagedCategoryTiles==='function') renderManagedCategoryTiles();
      if(typeof renderCategoryFilters==='function' && typeof shopState!=='undefined') renderCategoryFilters();
      if(typeof renderProductGrid==='function'){
        const novelty=(PRODUCTS||[]).filter(function(p){return p&&(p.isNew===true||p.badge==='Nouveau'||p.badge==='Nouveauté'||p.badge==='Nouveaute');});
        if(document.getElementById('homeNouveautesGrid')){renderProductGrid('homeNouveautesGrid',novelty); if(typeof initProductCarousel==='function') initProductCarousel('homeNouveautesGrid');}
        if(document.getElementById('homeGrid')){renderProductGrid('homeGrid',PRODUCTS); if(typeof initProductCarousel==='function') initProductCarousel('homeGrid');}
        if(document.getElementById('bestsellersGrid')){renderProductGrid('bestsellersGrid',PRODUCTS); if(typeof initProductCarousel==='function') initProductCarousel('bestsellersGrid');}
      }
      if(typeof applyShopFilters==='function' && typeof shopState!=='undefined' && document.getElementById('shopGrid')) applyShopFilters();
      if(typeof renderRoute==='function') renderRoute();
    }catch(e){ console.error('221 LUXURY Supabase repaint error',e); }
  }

  async function init(){
    try{
      await loadScript(CONFIG_SRC);
      await loadScript(SUPABASE_SRC);
      const client=buildClient();
      const storeResult=await client.from('stores').select('id,slug,is_active').eq('slug',STORE_SLUG).eq('is_active',true).maybeSingle();
      if(storeResult.error) throw storeResult.error;
      if(!storeResult.data){ console.warn('221 LUXURY: store not created yet; keeping current catalog.'); return; }
      const result=await client.from('products').select('id,store_id,slug,name,description,details,price,old_price,stock,stock_threshold,category,categories,badge,is_new,published,rating,reviews,personalization,photo_personalization,product_colors(id,name,hex,sort_order),product_variants(id,color_id,size,price,old_price,stock,sort_order),product_images(id,color_id,variant_id,storage_path,is_cover,sort_order)').eq('store_id',storeResult.data.id).eq('published',true).order('created_at',{ascending:false});
      if(result.error) throw result.error;
      if(typeof PRODUCTS==='undefined' || !Array.isArray(PRODUCTS)) return;
      const next=(result.data||[]).map(function(row){return normalize(row,client);});
      PRODUCTS.splice(0,PRODUCTS.length,...next);
      repaint();
      document.documentElement.dataset.supabaseCatalog='ready';
    }catch(e){
      console.error('221 LUXURY Supabase catalog load failed',e);
    }
  }

  if(document.readyState==='complete') setTimeout(init,50);
  else window.addEventListener('load',function(){setTimeout(init,50);},{once:true});
})();
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DIST=path.join(ROOT,'dist');

function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});}
function copy(name){fs.copyFileSync(path.join(ROOT,name),path.join(DIST,name));}

function findArrayEnd(source,start){
  let depth=0;
  let quote='';
  let escaped=false;

  for(let i=start;i<source.length;i++){
    const ch=source[i];

    if(quote){
      if(escaped) escaped=false;
      else if(ch==='\\') escaped=true;
      else if(ch===quote) quote='';
      continue;
    }

    if(ch==='"' || ch==="'" || ch.charCodeAt(0)===96){
      quote=ch;
      continue;
    }

    if(ch==='['){
      depth++;
      continue;
    }

    if(ch===']'){
      depth--;
      if(depth===0) return i;
    }
  }

  return -1;
}

function preparePublicCatalog(html){
  const marker='const PRODUCTS = [';
  const markerIndex=html.indexOf(marker);
  if(markerIndex<0) throw new Error('const PRODUCTS = [ not found');

  const arrayStart=markerIndex+marker.length-1;
  const arrayEnd=findArrayEnd(html,arrayStart);
  if(arrayEnd<0) throw new Error('PRODUCTS array end not found');

  // The catalog section is valid JSON today. Parse it so we can remove only
  // the heavy embedded product-image payload while preserving all UI logic.
  const raw=html.slice(arrayStart,arrayEnd+1);
  const products=JSON.parse(raw);

  const transparent='data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  for(const product of products){
    product.img=transparent;
    product.images=[];
    product.photos=[];
    if(Array.isArray(product.variantPhotos)) product.variantPhotos=[];
  }

  const seed=JSON.stringify(products);

  // Keep the original main script and every function after PRODUCTS intact.
  return html.slice(0,markerIndex)+'var PRODUCTS = '+seed+html.slice(arrayEnd+1);
}

ensureDir(DIST);

const original=fs.readFileSync(path.join(ROOT,'static-index.html'),'utf8');
let publicHtml=preparePublicCatalog(original);

const mobileCss='<link rel="stylesheet" href="/221-luxury-mobile.css?v=5" media="(max-width: 768px)">';
const headIndex=publicHtml.lastIndexOf('</head>');
if(headIndex<0) throw new Error('</head> not found');
if(!publicHtml.includes('/221-luxury-mobile.css')){
  publicHtml=publicHtml.slice(0,headIndex)+mobileCss+'\n'+publicHtml.slice(headIndex);
}

const runtimeTags=[
  '<script src="/supabase-config.js?v=public-live-1"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
  '<script src="/221-luxury-supabase-runtime.js?v=public-live-1"></script>'
].join('\n');

const bodyIndex=publicHtml.lastIndexOf('</body>');
if(bodyIndex<0) throw new Error('</body> not found');
publicHtml=publicHtml.slice(0,bodyIndex)+runtimeTags+'\n'+publicHtml.slice(bodyIndex);

fs.writeFileSync(path.join(DIST,'index.html'),publicHtml,'utf8');

// Keep static-index only in the source repository. The public deployment
// doesn't need to ship the 16+ MB source catalog.
for(const name of [
  'supabase-config.js',
  '221-luxury-supabase-runtime.js',
  '221-luxury-mobile.css',
  'gestionnaire-shell.html',
  'gestionnaire-221-luxury.html',
  '221-luxury-manager-bootstrap.js',
  '221-luxury-manager-enhancements.js'
]) copy(name);

const productCount=(publicHtml.match(/var PRODUCTS = ([\\s\\S]*?);/)||[])[1];
console.log('221 LUXURY build complete:',{
  originalBytes:Buffer.byteLength(original),
  publicBytes:Buffer.byteLength(publicHtml),
  productCount:productCount?JSON.parse(productCount).length:0,
  publicCatalog:'Supabase runtime'
});

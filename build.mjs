import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const DIST=path.join(ROOT,'dist');

function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});}
function copy(name){fs.copyFileSync(path.join(ROOT,name),path.join(DIST,name));}

function findArrayEnd(source,start){
  let depth=0,inString='',escaped=false;
  for(let i=start;i<source.length;i++){
    const ch=source[i];
    if(inString){
      if(escaped) escaped=false;
      else if(ch==='\\') escaped=true;
      else if(ch===inString) inString='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch.charCodeAt(0)===96){inString=ch;continue;}
    if(ch==='['){depth++;continue;}
    if(ch===']'){
      depth--;
      if(depth===0)return i;
    }
  }
  return -1;
}

function prepareCatalogSeed(html){
  const marker='const PRODUCTS = [';
  const markerIndex=html.indexOf(marker);
  if(markerIndex<0)throw new Error('const PRODUCTS = [ not found');
  const arrayStart=markerIndex+marker.length-1;
  const arrayEnd=findArrayEnd(html,arrayStart);
  if(arrayEnd<0)throw new Error('PRODUCTS array end not found');

  const raw=html.slice(arrayStart,arrayEnd+1);
  const products=JSON.parse(raw);

  // Keep the product metadata needed for the first paint, but remove the
  // enormous embedded product-image payload. Live images come from Supabase.
  for(const product of products){
    product.img='';
    product.images=[];
    product.photos=[];
  }

  const seed=JSON.stringify(products);
  return html.slice(0,markerIndex)+'var PRODUCTS = '+seed+html.slice(arrayEnd+1);
}

ensureDir(DIST);

const original=fs.readFileSync(path.join(ROOT,'static-index.html'),'utf8');
let publicHtml=prepareCatalogSeed(original);

const mobileCss='<link rel="stylesheet" href="/221-luxury-mobile.css?v=4" media="(max-width: 768px)">';
if(!publicHtml.includes('221-luxury-mobile.css')){
  publicHtml=publicHtml.replace('</head>',mobileCss+'\n</head>');
}

const runtimeTags=[
  '<script src="/supabase-config.js?v=public-build-3"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
  '<script src="/221-luxury-supabase-runtime.js?v=public-build-10"></script>'
].join('\n');

const bodyIndex=publicHtml.lastIndexOf('</body>');
if(bodyIndex<0) throw new Error('</body> not found');
publicHtml=publicHtml.slice(0,bodyIndex)+runtimeTags+'\n'+publicHtml.slice(bodyIndex);

fs.writeFileSync(path.join(DIST,'index.html'),publicHtml,'utf8');
fs.writeFileSync(path.join(DIST,'static-index.html'),original,'utf8');

for(const name of [
  'supabase-config.js',
  '221-luxury-supabase-runtime.js',
  'gestionnaire-shell.html',
  'gestionnaire-221-luxury.html',
  '221-luxury-manager-bootstrap.js',
  '221-luxury-manager-enhancements.js',
  '221-luxury-mobile.css'
]) copy(name);

console.log('221 LUXURY build complete:',{
  originalBytes:Buffer.byteLength(original),
  publicBytes:Buffer.byteLength(publicHtml),
  productCount:JSON.parse(publicHtml.match(/var PRODUCTS = ([\s\S]*?);/)?.[1]||'[]').length
});

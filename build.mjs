import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function copy(name){ fs.copyFileSync(path.join(ROOT,name), path.join(DIST,name)); }

function findArrayEnd(source,start){
  let depth=0,quote='',escaped=false;
  for(let i=start;i<source.length;i++){
    const ch=source[i];
    if(quote){
      if(escaped) escaped=false;
      else if(ch==='\\') escaped=true;
      else if(ch===quote) quote='';
      continue;
    }
    if(ch==='"'||ch==="'"||ch.charCodeAt(0)===96){quote=ch;continue;}
    if(ch==='['){depth++;continue;}
    if(ch===']'){depth--;if(depth===0)return i;}
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
  return html.slice(0,markerIndex)+'const PRODUCTS = '+seed+';\nwindow.__221LUXURY_PRODUCTS_REF__ = PRODUCTS;\n'+html.slice(arrayEnd+1);
}

ensureDir(DIST);
const original=fs.readFileSync(path.join(ROOT,'static-index.html'),'utf8');
let publicHtml=preparePublicCatalog(original);

const headIndex=publicHtml.lastIndexOf('</head>');
if(headIndex<0) throw new Error('</head> not found');
const headAssets=[
  '<link rel="stylesheet" href="/221-luxury-mobile.css?v=final-1" media="(max-width: 768px)">',
  '<script src="/supabase-config.js?v=final-1"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
].join('\n');
if(!publicHtml.includes('supabase-config.js?v=final-1')) publicHtml=publicHtml.slice(0,headIndex)+headAssets+'\n'+publicHtml.slice(headIndex);

const bodyIndex=publicHtml.lastIndexOf('</body>');
if(bodyIndex<0) throw new Error('</body> not found');
const runtime='<script src="/221-luxury-supabase-runtime.js?v=final-1"></script>';
if(!publicHtml.includes('/221-luxury-supabase-runtime.js?v=final-1')) publicHtml=publicHtml.slice(0,bodyIndex)+runtime+'\n'+publicHtml.slice(bodyIndex);

fs.writeFileSync(path.join(DIST,'index.html'),publicHtml,'utf8');

for(const name of ['supabase-config.js','221-luxury-supabase-runtime.js','221-luxury-mobile.css','gestionnaire-shell.html','gestionnaire-221-luxury.html','221-luxury-manager-bootstrap.js','221-luxury-manager-enhancements.js']) copy(name);

const productCount=(publicHtml.match(/const PRODUCTS = ([\\s\\S]*?);\\s*window\\.__221LUXURY_PRODUCTS_REF__/)||[])[1];
console.log('221 LUXURY public build ready:',{originalBytes:Buffer.byteLength(original),publicBytes:Buffer.byteLength(publicHtml),embeddedProductCount:productCount?JSON.parse(productCount).length:0,liveSource:'Supabase'});

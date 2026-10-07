import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

function ensureDir(dir){ fs.mkdirSync(dir,{recursive:true}); }
function copy(name){
  const src=path.join(ROOT,name);
  const dst=path.join(DIST,name);
  fs.copyFileSync(src,dst);
}

function findProductsEnd(source,start){
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

function stripLegacyProducts(html){
  const marker='const PRODUCTS = [';
  const markerIndex=html.indexOf(marker);
  if(markerIndex<0) throw new Error('const PRODUCTS = [ not found');
  const arrayStart=markerIndex+marker.length-1;
  const arrayEnd=findProductsEnd(html,arrayStart);
  if(arrayEnd<0) throw new Error('PRODUCTS array end not found');
  return html.slice(0,arrayStart)+'[]'+html.slice(arrayEnd+1);
}

ensureDir(DIST);

// The original catalog is kept intact as static-index.html. The deployed
// public index removes its huge embedded product payload and hydrates it
// from Supabase at runtime.
const original=fs.readFileSync(path.join(ROOT,'static-index.html'),'utf8');
let publicHtml=stripLegacyProducts(original);

const headMarker='</head>';
const mobileCss='<link rel="stylesheet" href="/221-luxury-mobile.css?v=1" media="(max-width: 768px)">';
if(!publicHtml.includes(headMarker)) throw new Error('</head> not found');
publicHtml=publicHtml.replace(headMarker,mobileCss+'\n'+headMarker);

const bodyMarker='</body>';
const runtimeTags=[
  '<script src="/supabase-config.js?v=public-build-1"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
  '<script src="/221-luxury-supabase-runtime.js?v=public-build-7"></script>'
].join('\n');
if(!publicHtml.includes(bodyMarker)) throw new Error('</body> not found');
publicHtml=publicHtml.replace(bodyMarker,runtimeTags+'\n'+bodyMarker);

fs.writeFileSync(path.join(DIST,'index.html'),publicHtml,'utf8');
fs.writeFileSync(path.join(DIST,'static-index.html'),original,'utf8');

for(const name of [
  'supabase-config.js',
  '221-luxury-supabase-runtime.js',
  'gestionnaire-shell.html',
  'gestionnaire-221-luxury.html',
  '221-luxury-manager-bootstrap.js',
  '221-luxury-manager-enhancements.js'
]) copy(name);

console.log('221 LUXURY build complete:',{
  originalBytes:Buffer.byteLength(original),
  publicBytes:Buffer.byteLength(publicHtml),
  savedBytes:Buffer.byteLength(original)-Buffer.byteLength(publicHtml)
});
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

ensureDir(DIST);

const original=fs.readFileSync(path.join(ROOT,'static-index.html'),'utf8');
let publicHtml=original.replace('const PRODUCTS = [','let PRODUCTS = [');

const headMarker='</head>';
const mobileCss='<link rel="stylesheet" href="/221-luxury-mobile.css?v=3" media="(max-width: 768px)">';
if(!publicHtml.includes(headMarker)) throw new Error('</head> not found');
if(!publicHtml.includes('221-luxury-mobile.css')) publicHtml=publicHtml.replace(headMarker,mobileCss+'\n'+headMarker);

const bodyMarker='</body>';
const runtimeTags=[
  '<script src="/supabase-config.js?v=public-build-2"></script>',
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>',
  '<script src="/221-luxury-supabase-runtime.js?v=public-build-9"></script>'
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
  '221-luxury-manager-enhancements.js',
  '221-luxury-mobile.css'
]) copy(name);

console.log('221 LUXURY build complete:',{
  originalBytes:Buffer.byteLength(original),
  publicBytes:Buffer.byteLength(publicHtml),
  catalogMode:'runtime'
});

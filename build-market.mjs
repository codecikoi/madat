import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {localizePage,localizeScript} from './localize.mjs';
import {build} from 'esbuild';
const files={'/MedeoSansVariable.woff2':['MedeoSansVariable.woff2','font/woff2'],'/medeo-license.txt':['medeo-license.txt','text/plain; charset=utf-8'],'/tourmesh-ai.mjs':['tourmesh-ai.mjs','text/javascript; charset=utf-8'],'/tourmesh-lattice-reference.png':['tourmesh-lattice-reference.png','image/png'],'/tourmesh-concept-ornament.svg':['tourmesh-concept-ornament.svg','image/svg+xml']};
const assets=Object.fromEntries(Object.entries(files).map(([url,[path,type]])=>[url,[type,readFileSync('dist/'+path).toString('base64')]]));
assets['/demo-calendar.mjs']=['text/javascript; charset=utf-8',readFileSync('demo-calendar.mjs').toString('base64')];
assets['/tourmesh-relief.jpg']=['image/jpeg',readFileSync('dist/tourmesh-relief.jpg').toString('base64')];
const html=readFileSync('dist/index.html','utf8');
assets.hashes={};
const calendar=readFileSync('demo-calendar.mjs','utf8');
for(const lang of ['ru','en','uz']){
 const page=localizePage(html,lang);
 const js=page.match(/<script>([\s\S]+?)<\/script>/)[1].replace(/\r\n?/g,'\n');
 assets.hashes[lang]=createHash('sha256').update(js).digest('base64');
 assets['page:'+lang]=['text/html; charset=utf-8',Buffer.from(page).toString('base64')];
 assets['/demo-calendar.'+lang+'.mjs']=['text/javascript; charset=utf-8',Buffer.from(localizeScript(calendar,lang)).toString('base64')];
}
await build({
 entryPoints:['market-worker.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',
 plugins:[{name:'worker-inputs',setup(build){
  build.onResolve({filter:/^tourmesh:assets$/},()=>({path:'assets',namespace:'embedded'}));
  build.onLoad({filter:/.*/,namespace:'embedded'},()=>({contents:JSON.stringify(assets),loader:'json'}));
  // bcryptjs uses Web Crypto first. Workers have no Node fallback.
  build.onResolve({filter:/^crypto$/},()=>({path:'crypto',namespace:'web-crypto'}));
  build.onLoad({filter:/.*/,namespace:'web-crypto'},()=>({contents:'export default {}'}));
 }}]
});

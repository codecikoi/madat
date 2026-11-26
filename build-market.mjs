import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {localizePage,localizeScript} from './localize.mjs';
import {build} from 'esbuild';
// The old landing page and its assets (Medeo font, relief photo, lattice, browser AI) stay in dist/ but are no longer served.
const assets={};
for(const name of readdirSync('app/fonts'))assets['/fonts/'+name]=[name.endsWith('.txt')?'text/plain; charset=utf-8':'font/woff2',readFileSync('app/fonts/'+name).toString('base64')];
const logoTypes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'};
if(existsSync('assets/partners'))for(const name of readdirSync('assets/partners')){const type=logoTypes[name.split('.').pop().toLowerCase()];if(type&&/^[a-z0-9._-]+$/i.test(name))assets['/partners/'+name]=[type,readFileSync('assets/partners/'+name).toString('base64')]}
const html=readFileSync('app/index.html','utf8');
assets.hashes={};
for(const lang of ['ru','en','uz']){
 const page=localizePage(html,lang);
 const js=page.match(/<script>([\s\S]+?)<\/script>/)[1].replace(/\r\n?/g,'\n');
 assets.hashes[lang]=createHash('sha256').update(js).digest('base64');
 assets['page:'+lang]=['text/html; charset=utf-8',Buffer.from(page).toString('base64')];
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

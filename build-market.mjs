import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {localizePage,localizeScript} from './localize.mjs';
import {build} from 'esbuild';
// The old landing page and its assets (Medeo font, relief photo, lattice, browser AI) stay in dist/ but are no longer served.
const assets={};
for(const name of readdirSync('app/fonts'))assets['/fonts/'+name]=[name.endsWith('.txt')?'text/plain; charset=utf-8':'font/woff2',readFileSync('app/fonts/'+name).toString('base64')];
const logoTypes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'};
if(existsSync('assets/partners'))for(const name of readdirSync('assets/partners')){const type=logoTypes[name.split('.').pop().toLowerCase()];if(type&&/^[a-z0-9._-]+$/i.test(name))assets['/partners/'+name]=[type,readFileSync('assets/partners/'+name).toString('base64')]}
const html=readFileSync('app/index.html','utf8');
const calendar=readFileSync('demo-calendar.mjs','utf8');
assets.hashes={};
for(const lang of ['ru','en','uz']){
 assets['/demo-calendar.'+lang+'.mjs']=['text/javascript; charset=utf-8',Buffer.from(localizeScript(calendar,lang)).toString('base64')];
 const page=localizePage(html,lang);
 const js=page.match(/<script>([\s\S]+?)<\/script>/)[1].replace(/\r\n?/g,'\n');
 assets.hashes[lang]=createHash('sha256').update(js).digest('base64');
 assets['page:'+lang]=['text/html; charset=utf-8',Buffer.from(page).toString('base64')];
}
// /demo: a self-playing walk through the pitch slide, drawn with the site's own favicon, styles and icons.
// A copy with the fonts inlined goes to dist/demo/ to open from disk when the venue has no internet.
const part=re=>html.match(re)[0];
const demo=readFileSync('app/demo.html','utf8')
 .replace('<!--SITE-ICON-->',()=>part(/<link rel="icon"[^>]*>/))
 .replace('<!--SITE-STYLE-->',()=>part(/<style>[\s\S]*?<\/style>/))
 .replace('<!--SITE-SPRITE-->',()=>part(/<svg width="0" height="0"[\s\S]*?<\/svg>/));
assets.hashes.demo=createHash('sha256').update(demo.match(/<script>([\s\S]+?)<\/script>/)[1].replace(/\r\n?/g,'\n')).digest('base64');
assets['page:demo']=['text/html; charset=utf-8',Buffer.from(demo).toString('base64')];
mkdirSync('dist/demo',{recursive:true});
writeFileSync('dist/demo/tourmesh-demo.html',demo.replace(/url\(\/fonts\/([a-z0-9.-]+)\)/g,(m,name)=>'url(data:font/woff2;base64,'+readFileSync('app/fonts/'+name).toString('base64')+')'));
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

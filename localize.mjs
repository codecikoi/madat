import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('./languages.json',import.meta.url),'utf8'));
const escape=value=>value.replace(/[.*+?^\${}()|[\]\\]/g,'\\$&');
const sourceKeys=Object.keys(catalog).map(escape).sort((a,b)=>b.length-a.length);
const literal=new RegExp("'("+sourceKeys.join('|')+")'",'gu');
const translate=(key,lang)=>catalog[key]?.[lang==='en'?0:1]??key;
export function localizeScript(script,lang){
 if(lang==='ru')return script;
 return script.replace(literal,(_,key)=>JSON.stringify(translate(key,lang)));
}
export function localizePage(html,lang){
 const calendar='/demo-calendar.'+lang+'.mjs';
 if(lang==='ru')return html.replace('/demo-calendar.mjs',calendar);
 const [markup,script]=html.split('<script>');
 const localized=markup.split(/(<style>[\s\S]*?<\/style>|<[^>]+>)/g).map(part=>{
  if(part.startsWith('<style>'))return part;
  if(part.startsWith('<'))return part.replace(/(aria-label|title|alt|placeholder)="([^"]+)"/g,(_,name,value)=>name+'="'+translate(value,lang).replaceAll('"','&quot;')+'"');
  const key=part.trim();return key?part.replace(key,()=>translate(key,lang)):part;
 }).join('').replace('lang="ru"','lang="'+lang+'"');
 return localized+'<script>'+localizeScript(script,lang).replace('/demo-calendar.mjs',calendar);
}

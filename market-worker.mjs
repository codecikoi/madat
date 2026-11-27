import {demoBooking,demoReminders} from './demo-booking.mjs';
import {auth, me, session} from './accounts.mjs';
import {exchange, telegramHook} from './exchange.mjs';
import {telegramLogin} from './telegram.mjs';
import translations from './languages.json';
import assets from 'tourmesh:assets';
const categories=['hotel','transport','restaurant','guide'];
const cities=['Самарканд','Бухара','Ташкент','Хива'];
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const error=(message,status)=>json({error:message},status);
const textValue=(value,min,max)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max;
const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
const can=(profile,role)=>profile?.role===role||profile?.role==='both';
const decode=value=>Uint8Array.from(atob(value),character=>character.charCodeAt(0));
async function body(request,limit=620000){
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new Error();
 const reader=request.body?.getReader();
 if(!reader)throw new Error();
 const decoder=new TextDecoder();
 let size=0,raw='';
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;if(size>limit){await reader.cancel();throw new Error()}
   raw+=decoder.decode(value,{stream:true});
  }
  return JSON.parse(raw+decoder.decode());
 }finally{reader.releaseLock()}
}
const unpack=row=>({...JSON.parse(row.data),id:row.id,photo:JSON.parse(row.data).photo?'/api/photos/'+row.id:''});
async function api(request,env,url,ctx,lang){
 if(!env.DB)return error('Сервис профилей временно недоступен.',503);
 const db=env.DB,path=url.pathname,method=request.method;
 if(path==='/api/telegram/hook'&&method==='POST')return telegramHook(request,env,db);
 if(method==='POST'&&request.headers.get('origin')!==url.origin)return error('Запрос отклонён.',403);
 if(path==='/api/partners'&&method==='GET'){
  const {results}=await db.prepare('SELECT name,city,category,services,contacts FROM trusted_partners ORDER BY rowid').all();
  return json({partners:results.map(row=>({...row,contacts:JSON.parse(row.contacts)}))});
 }
 const profile=await session(request,db);
 if(path==='/api/demo-calendar')return demoBooking({request,env,db,readBody:body,json,profile,lang,later:promise=>ctx?.waitUntil?ctx.waitUntil(promise):promise});
 if(path==='/api/me'&&method==='GET')return me(request,db,profile);
 if(path.startsWith('/api/auth/telegram/')&&method==='POST'){
  let data;
  try{data=await body(request,1024);if(!data||typeof data!=='object'||Array.isArray(data))throw Error()}catch{return error('Проверьте поля формы.',400)}
  return telegramLogin(path.slice('/api/auth/telegram/'.length),{request,env,db,data,lang,origin:url.origin,later:promise=>ctx?.waitUntil?ctx.waitUntil(promise):promise});
 }
 if(path.startsWith('/api/auth/')&&method==='POST'){
  let data;
  try{data=await body(request,4096);if(!data||typeof data!=='object'||Array.isArray(data))throw Error()}catch{return error('Проверьте поля формы.',400)}
  return auth(path.slice('/api/auth/'.length),request,db,data,profile);
 }
 const handled=await exchange({request,env,ctx,url,path,method,db,profile,body,json,error,lang});
 if(handled)return handled;
 if(!profile)return error('Войдите, чтобы открыть кабинет.',401);
 const id=profile.id;
 if(method==='GET'){
  if(path==='/api/offers'){
   const {results}=await db.prepare('SELECT o.id,o.data,p.name AS supplier FROM offers o JOIN profiles p ON p.id=o.owner WHERE o.visible=1 LIMIT 500').all();
   return json({offers:results.map(row=>({...unpack(row),supplier:row.supplier}))});
  }
  if(path==='/api/office'){
   const [{results:offers},{results:requests}]=await Promise.all([
    db.prepare('SELECT id,data,visible FROM offers WHERE owner=? LIMIT 200').bind(id).all(),
    db.prepare('SELECT r.id,r.brief,r.snapshot,r.status,r.response,r.created,r.seller=? AS incoming,p.name AS buyerName FROM requests r JOIN profiles p ON p.id=r.buyer WHERE r.buyer=? OR r.seller=? ORDER BY r.created DESC LIMIT 200').bind(id,id,id).all()
   ]);
   return json({offers:offers.map(row=>({...unpack(row),visible:!!row.visible})),requests:requests.map(row=>({...row,snapshot:JSON.parse(row.snapshot)}))});
  }
  const image=path.match(/^\/api\/photos\/([a-f0-9-]{36})$/);
  if(image){
   const found=await db.prepare('SELECT id FROM offers WHERE id=? AND (visible=1 OR owner=?)').bind(image[1],id).first();
   const asset=found&&await env.BUCKET?.get(image[1]);
   return asset?new Response(asset.body,{headers:{'content-type':'image/webp','cache-control':'private,no-store','x-content-type-options':'nosniff'}}):error('Фото не найдено.',404);
  }
  return error('Не найдено.',404);
 }
 if(method!=='POST'||request.headers.get('origin')!==url.origin)return error('Запрос отклонён.',403);
 let data;
 try{data=await body(request);if(!data||typeof data!=='object')throw Error()}catch{return error('Некорректные данные или слишком большой файл.',400)}
 if(path==='/api/offers'){
  if(!can(profile,'supplier'))return error('Выберите роль поставщика в кабинете.',403);
  const {name,category,city,price,capacity,rooms}=data;
  const destination=category==='transport'?data.destination||'':'';
  if(!textValue(name,2,90)||!categories.includes(category)||!cities.includes(city)||(destination&&!cities.includes(destination))||!integer(price,1,1e9)||!integer(capacity,1,500)||(category==='hotel'&&!integer(rooms,1,500)))return error('Проверьте параметры услуги.',400);
  const offer=crypto.randomUUID();
  if(data.photo){
   if(!env.BUCKET)return error('Хранилище фото недоступно.',503);
   if(typeof data.photo!=='string'||!/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/.test(data.photo))return error('Фото должно быть в формате WebP.',400);
   const bytes=decode(data.photo.split(',')[1]);
   if(bytes.length<16||new TextDecoder().decode(bytes.slice(0,4))!=='RIFF'||new TextDecoder().decode(bytes.slice(8,12))!=='WEBP')return error('Не удалось прочитать фото.',400);
   await env.BUCKET.put(offer,bytes);
  }
  try{await db.prepare('INSERT INTO offers(id,owner,data) VALUES(?,?,?)').bind(offer,id,JSON.stringify({name:name.trim(),category,city,destination,price,capacity,rooms:category==='hotel'?rooms:null,photo:!!data.photo})).run()}
  catch(failure){if(data.photo)await env.BUCKET.delete(offer);throw failure}
  return json({id:offer},201);
 }
 if(path==='/api/visibility'){
  if(!can(profile,'supplier')||typeof data.visible!=='boolean')return error('Действие недоступно.',403);
  const result=await db.prepare('UPDATE offers SET visible=? WHERE id=? AND owner=?').bind(+data.visible,data.id??'',id).run();
  return result.meta.changes?json({ok:true}):error('Услуга не найдена.',404);
 }
 if(path==='/api/requests'){
  if(!can(profile,'operator'))return error('Выберите роль оператора в кабинете.',403);
  if(!textValue(data.brief,1,1800)||!textValue(data.offer,36,36))return error('Добавьте описание поездки.',400);
  const requestId=data.requestId??crypto.randomUUID();
  if(typeof requestId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestId))return error('Откройте форму заявки ещё раз.',400);
  const brief=data.brief.trim();
  const previous=()=>db.prepare('SELECT buyer,offer,brief FROM requests WHERE id=?').bind(requestId).first();
  const replay=row=>row?.buyer===id&&row.offer===data.offer&&row.brief===brief?json({ok:true,id:requestId}):error('Проверьте отправленные заявки в кабинете.',409);
  if(data.requestId){const sent=await previous();if(sent)return replay(sent)}
  const row=await db.prepare('SELECT id,owner,data FROM offers WHERE id=? AND visible=1').bind(data.offer).first();
  if(!row||row.owner===id)return error('Выберите услугу другого поставщика.',400);
  const snapshot=unpack(row);delete snapshot.photo;
  const saved=await db.prepare('INSERT INTO requests(id,offer,buyer,seller,brief,snapshot,created) VALUES(?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(requestId,row.id,id,row.owner,brief,JSON.stringify(snapshot),Date.now()).run();
  return saved.meta.changes?json({ok:true,id:requestId},201):replay(await previous());
 }
 if(path==='/api/respond'){
  if(!can(profile,'supplier')||!['accepted','declined'].includes(data.status)||!textValue(data.response,0,500))return error('Проверьте ответ поставщика.',400);
  const result=await db.prepare("UPDATE requests SET status=?,response=? WHERE id=? AND seller=? AND status='sent'").bind(data.status,data.response.trim(),data.id??'',id).run();
  return result.meta.changes?json({ok:true}):error('Заявка уже обработана или недоступна.',409);
 }
 return error('Не найдено.',404);
}
// Pages has no cron, so any request may send the demo reminders that are due, at most once a minute per isolate.
let reminded=0;
export default {async scheduled(event,env,ctx){ctx.waitUntil(demoReminders(env,env.DB))},
async fetch(request,env,ctx){
 if(env.DB&&ctx?.waitUntil&&Date.now()-reminded>60000){reminded=Date.now();ctx.waitUntil(demoReminders(env,env.DB).catch(()=>{}))}
 const url=new URL(request.url);
 const requested=url.searchParams.get('lang');
 const stored=request.headers.get('cookie')?.match(/(?:^|;\s*)tm_lang=(en|uz|ru)(?:;|$)/)?.[1];
 const lang=['ru','en','uz'].includes(requested)?requested:stored||'ru';
 if(url.pathname.startsWith('/api/')){
  let response;
  try{response=await api(request,env,url,ctx,lang)}catch{response=error('Не удалось сохранить или загрузить данные. Попробуйте ещё раз.',500)}
  if(lang!=='ru'&&!response.ok){
   const data=await response.clone().json();
   const translated=translations[data.error]?.[lang==='en'?0:1];
   if(translated)return json({...data,error:translated},response.status);
  }
  return response;
 }
 const page=/^\/(?:start|jobs|my|account|new|(?:jobs|chat)\/[a-f0-9-]{36})?$/.test(url.pathname);
 // /demo is a self-playing walk through the product for the pitch (app/demo.html), in Russian only.
 const demo=url.pathname==='/demo';
 const assetPath=demo?'page:demo':page?'page:'+lang:url.pathname;
 if(!page && !demo && !assetPath.startsWith('/'))return new Response(null,{status:404});
 if(!Object.hasOwn(assets,assetPath)||!['GET','HEAD'].includes(request.method))return new Response('Not found',{status:404});
 const [type,value]=assets[assetPath];
 const headers={'content-type':type,'x-content-type-options':'nosniff','referrer-policy':'same-origin','cache-control':page?'private,no-store':'public,max-age=300'};
 if(page){
  headers['content-language']=lang;
  if(requested===lang)headers['set-cookie']='tm_lang='+lang+'; Path=/; Max-Age=31536000; Secure; SameSite=Lax';
 }
 if(page||demo)headers['content-security-policy']="default-src 'self'; script-src 'self' 'sha256-"+assets.hashes[demo?'demo':lang]+"'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'";
 if(assetPath==='/tourmesh-ai.mjs')headers['content-security-policy']="default-src 'none'; script-src https://cdn.jsdelivr.net 'wasm-unsafe-eval'; connect-src https://cdn.jsdelivr.net https://*.huggingface.co https://huggingface.co https://*.hf.co";
 return new Response(request.method==='HEAD'?null:decode(value),{headers});
}};

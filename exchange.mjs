// Request exchange between travel agencies: post a request, collect bids, choose one, chat.
import {limited} from './accounts.mjs';
import {tg,botUsername,hookSecret,hookUpdates,loginUpdate} from './telegram.mjs';
import {demoUpdate} from './demo-booking.mjs';
import catalog from './languages.json';
// Sample content (demo agencies, reviews, canned notes) is stored in Russian and shown in the viewer's language.
const tr=(value,lang)=>lang&&lang!=='ru'&&typeof value==='string'&&catalog[value]?catalog[value][lang==='en'?0:1]:value;

export const services=['tour','transport','hotel','guide','food','other'];
const units=['person','group','day','night','total'];
const includesList=['hotel','meals','guide','transport','tickets'];
const currencies=['USD','UZS'];
const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const str=(value,max)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
const int=(value,min,max)=>{const n=Math.round(Number(value));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min};
const esc=value=>String(value).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);

// ---------- free text -> structured request ----------
const schema={type:'object',properties:{
 title:{type:'string'},services:{type:'array',items:{type:'string',enum:services}},other:{type:'string'},city:{type:'string'},from:{type:'string'},
 start:{type:'string'},days:{type:'integer'},groups:{type:'integer'},people:{type:'integer'},
 language:{type:'string'},hotel:{type:'string'},meals:{type:'string'},transport:{type:'string'},budget:{type:'string'},
 details:{type:'array',items:{type:'string'}}
},required:['title','services','city','days','groups','people','details']};
const languageName={ru:'русском',en:'английском',uz:'узбекском (латиница, новый алфавит 2026: ç ş ö ğ)'};
function prompt(lang){
 const today=new Date().toISOString().slice(0,10);
 return `Ты помогаешь турагентствам Узбекистана. Агентство своими словами пишет, что ему нужно от других агентств (взять группу туристов, дать автобус, гида, гостиницу и т.п.). Преврати сообщение в аккуратную заявку. Верни только JSON по схеме. Все текстовые значения пиши на ${languageName[lang]||languageName.ru} языке.
Поля:
- title: короткий понятный заголовок до 60 символов: что нужно и где. Например «Тур в Самарканд на 7 дней, 2 группы», «Автобус на 50 мест, Ташкент → Хива», «Автобус, гид и обед: Самарканд → Бухара». Если нужны отдельные услуги, назови их, а не «тур».
- services: всё, что нужно, списком: tour (принять группу, тур целиком), transport (автобус, машина, трансфер), hotel (размещение), guide (гид), food (питание), other (что-то ещё). Если нужен тур целиком — только tour; если отдельно нужны, например, автобус и гид — ["transport","guide"].
- other: если в services есть other — коротко, что именно нужно (например «Визовая поддержка»); иначе пустая строка.
- city: главный город, где нужна услуга. from: откуда едут, если сказано.
- start: дата начала в формате ГГГГ-ММ-ДД, если указана (сегодня ${today}; «с 3 декабря» — ближайшее 3 декабря); иначе пустая строка.
- days: сколько дней (0, если не сказано). groups: сколько групп (1 по умолчанию). people: всего человек (если «2 группы по 15» — 30; 0, если не сказано).
- language: язык гида или туристов. hotel: уровень гостиницы. meals: питание, если упомянуто («обед», «завтраки»). transport: транспорт, если упомянут («автобус», «минивэн на 7 мест»). budget: бюджет, как написано.
- details: 2–5 коротких пунктов — что именно нужно и на каких условиях, по одному на услугу или требование (например «Автобус на всю группу», «Гид на английском все 3 дня», «Обед каждый день»). Не повторяй заголовок.
Ничего не придумывай: чего нет в тексте, оставь пустым.`;
}
export function normalizeDraft(raw){
 const d=raw&&typeof raw==='object'?raw:{};
 // Several services can be asked for at once; `service` stays the first of them for older readers.
 const asked=new Set([...(Array.isArray(d.services)?d.services:[]),d.service]);
 const list=services.filter(s=>asked.has(s));
 if(!list.length)list.push('other');
 return {
  title:str(d.title,80),service:list[0],services:list,other:list.includes('other')?str(d.other,80):'',city:str(d.city,40),from:str(d.from,40),
  start:/^\d{4}-\d{2}-\d{2}$/.test(d.start||'')?d.start:'',days:int(d.days,0,60),groups:int(d.groups||1,1,50),people:int(d.people,0,2000),
  language:str(d.language,60),hotel:str(d.hotel,60),meals:str(d.meals,60),transport:str(d.transport,80),budget:str(d.budget,60),
  details:(Array.isArray(d.details)?d.details:[]).map(x=>str(x,120)).filter(Boolean).slice(0,6)
 };
}
const cityWords={'Самарканд':/самарканд|samarqand|samarkand/i,'Бухара':/бухар|buxoro|bukhara/i,'Хива':/хив|xiva|khiva/i,'Ташкент':/ташкент|toshkent|tashkent/i,'Фергана':/фергана|farg.ona|fergana/i,'Нукус':/нукус|nukus/i,'Шахрисабз':/шахрисабз|shahrisabz/i};
function roughDraft(text){
 const n=re=>{const m=text.match(re);return m?+m[1]:0};
 const city=Object.keys(cityWords).filter(c=>cityWords[c].test(text));
 const groups=n(/(\d+)\s*(?:групп|guruh|group)/i)||1;
 const each=n(/по\s*(\d+)\s*(?:чел|человек)/i);
 const people=each?each*groups:n(/(\d+)\s*(?:чел|человек|турист|kishi|people|pax)/i);
 const days=n(/(\d+)\s*(?:дн|ден|сут|kun|day)/i);
 const service=/автобус|машин|трансфер|avtobus|bus|транспорт/i.test(text)?'transport':/гид\b|гида|экскурсовод|gid\b|guide/i.test(text)&&!/тур|групп/i.test(text)?'guide':/гостиниц|отел|mehmonxona|hotel/i.test(text)&&!/тур/i.test(text)?'hotel':'tour';
 const target=city.length>1?city[city.length-1]:city[0]||'';
 return normalizeDraft({title:str(text,60),service,city:target,from:city.length>1?city[0]:'',days,groups,people,details:[]});
}
export async function parseRequest(env,text,lang){
 if(env.AI){
  try{
   const result=await env.AI.run(MODEL,{messages:[{role:'system',content:prompt(lang)},{role:'user',content:text}],response_format:{type:'json_schema',json_schema:schema},max_tokens:700,temperature:0.1});
   let data=result?.response;
   if(typeof data==='string')data=JSON.parse(data.slice(data.indexOf('{'),data.lastIndexOf('}')+1));
   const draft=normalizeDraft(data);
   if(draft.title)return {draft,ai:true};
  }catch{}
 }
 return {draft:roughDraft(text),ai:false};
}

// ---------- telegram ----------
function notify(env,chat,text,link,button){
 if(!chat)return Promise.resolve();
 const https=/^https:\/\//.test(link)&&!/localhost|127\.0\.0\.1/.test(link);
 return tg(env,'sendMessage',{chat_id:chat,text:text+(https?'':'\n\n'+link),parse_mode:'HTML',disable_web_page_preview:true,
  ...(https?{reply_markup:{inline_keyboard:[[{text:button,url:link}]]}}:{})});
}
const unitText={person:'за человека',group:'за группу',day:'в день',night:'за ночь',total:'за всё'};
const money=(price,currency)=>currency==='USD'?'$'+price.toLocaleString('ru-RU'):price.toLocaleString('ru-RU')+' сум';
async function rating(db,id){
 return db.prepare('SELECT ROUND(AVG(rating),1) AS score,COUNT(*) AS count FROM reviews WHERE target=?').bind(id).first();
}
// Each offer is announced once, by whichever gets to it first: the sender, the owner's page, or a demo timer.
async function bidNotice(env,db,origin,id){
 const bid=await db.prepare('UPDATE bids SET notified=1 WHERE id=? AND notified=0 RETURNING price,currency,data').bind(id).first();
 if(!bid)return;
 const row=await db.prepare('SELECT j.id,j.data,o.tg_chat,p.name,p.id AS agency FROM bids b JOIN jobs j ON j.id=b.job JOIN profiles o ON o.id=j.owner JOIN profiles p ON p.id=b.owner WHERE b.id=?').bind(id).first();
 if(!row?.tg_chat)return;
 const job=JSON.parse(row.data),score=await rating(db,row.agency);
 const stars=score?.count?' · ★ '+score.score:'';
 await notify(env,row.tg_chat,`🔔 <b>Новый отклик на вашу заявку</b>\n«${esc(job.title)}»\n\n<b>${esc(row.name)}</b>${stars}\n${money(bid.price,bid.currency)} ${unitText[JSON.parse(bid.data).unit]||''}`,origin+'/jobs/'+row.id,'Открыть заявку');
}

// ---------- sample answers for the presenter's demo requests ----------
// A sample agency answers only for what it does, about the city asked for, at the hotel level asked for.
// Better-rated agencies ask a little more, so "cheapest" and "best rated" land on different offers.
// Every sentence is fixed and listed in languages.json, so a sample offer reads in the viewer's language.
const demoDoes={
 'demo:registan':['tour','guide','hotel','food'],
 'demo:zarafshon':['tour','transport','hotel','food','guide'],
 'demo:karvon':['tour','transport','hotel','food','guide'],
 'demo:darvoza':['tour','guide','hotel','food'],
 'demo:ekspress':['transport'],
 'demo:gidlar':['guide']
};
const demoSights={
 'Самарканд':['Программа: Регистан, Шахи-Зинда, Гур-Эмир, мастерская бумаги в Конигиле.','Программа: Регистан, Биби-Ханым, обсерватория Улугбека, базар Сиаб.'],
 'Бухара':['Программа: Арк, Пои-Калян, Ляби-Хауз, дворец Ситораи Мохи-Хоса.','Программа: Ляби-Хауз, торговые купола, медресе Мири-Араб, мавзолей Саманидов.'],
 'Хива':['Программа: Ичан-Кала, Кальта-Минор, мечеть Джума, дворец Таш-Хаули.','Программа: Ичан-Кала, Куня-Арк, минарет Ислам-Ходжа, крепости Хорезма.'],
 'Ташкент':['Программа: Хаст-Имам, базар Чорсу, станции метро, сквер Амира Темура.','Программа: Старый город, медресе Кукельдаш, Музей прикладного искусства.'],
 'Фергана':['Программа: керамика Риштана, шёлковая фабрика «Ёдгорлик» в Маргилане.','Программа: Маргилан, Риштан, Коканд и дворец Худояр-хана.'],
 'Нукус':['Программа: музей Савицкого, поездка в Муйнак к Аральскому морю.','Программа: музей Савицкого, крепости Топрак-Кала и Аяз-Кала.'],
 'Шахрисабз':['Программа: дворец Ак-Сарай, Дорут-Тиловат, Дорус-Саодат.','Программа: Ак-Сарай, мечеть Кок-Гумбаз, родина Амира Темура.']
};
const demoNear={'Самарканд':'у Регистана','Бухара':'у Ляби-Хауза','Хива':'у Ичан-Калы'};
const demoLines={
 tour:{'demo:registan':'Свои гиды на 6 языках, 12 лет на рынке.','demo:zarafshon':'Встретим группу на вокзале, автобус с кондиционером все дни.',
  'demo:karvon':'Свой транспорт, ужин с национальной программой в последний вечер.','demo:darvoza':'Входные билеты включены, обеды в чайхане.'},
 transport:{'demo:ekspress':'Если автобус сломается в пути, подменный будет через 3 часа.','demo:zarafshon':'Встреча на вокзале или в аэропорту включена.',
  'demo:karvon':'Водители с опытом дальних рейсов через Кызылкум.'},
 guide:{'demo:gidlar':'Лицензированный гид, опыт 8 лет, работает с группами до 30 человек.','demo:darvoza':'Гид-историк, авторская программа по старому городу.',
  'demo:registan':'Гид из нашей команды, наушники для группы бесплатно.','demo:karvon':'Гид с опытом работы с группами из Европы и Азии.'},
 guideAny:'Гид встретит группу в гостинице и будет с ней все дни.',
 hotel:['Двухместные номера, завтрак включён, парковка для автобуса.','Номера для всей группы на одном этаже, ранний заезд по запросу.'],
 food:['Групповое меню: плов, шашлык, салаты, чай. Зал на 60 мест.','Обеды в чайхане, ужин с национальной программой.'],
 other:'Возьмёмся, подробности обсудим в чате.'
};
const demoVehicles=[[7,'Hyundai Staria на 7 мест, кондиционер.','Kia Carnival на 7 мест, кондиционер.'],
 [18,'Mercedes Sprinter на 18 мест, кондиционер, место для багажа.','Ford Transit на 18 мест, кондиционер.'],
 [35,'Isuzu на 35 мест, кондиционер, микрофон для гида.','Higer на 35 мест 2023 года, кондиционер, USB-зарядки.'],
 [Infinity,'Yutong на 51 место, кондиционер, Wi-Fi.','King Long на 53 места, кондиционер, микрофон для гида.']];
// What a typical agency asks, in USD: [price per unit, unit, what the whole trip costs at that price].
function demoRate(service,need){
 const {days,people,stars,seats}=need;
 if(service==='tour')return [days*(stars>=5?95:stars>=4?62:44),'person'];
 if(service==='transport'){const p=seats<=7?70:seats<=18?100:seats<=35?120:150;return [p,'day',p*days]}
 if(service==='guide')return [60,'day',60*days];
 if(service==='hotel'){const p=stars>=5?140:stars>=4?80:50;return [p,'night',p*Math.max(1,days-1)*Math.ceil(people/2)]}
 if(service==='food')return [15,'person',15*people*days];
 return [250,'group',250];
}
const roundPrice=p=>p<100?Math.max(5,Math.round(p/5)*5):Math.round(p/10)*10;
async function demoBids(db,job,draft,now){
 const {results}=await db.prepare('SELECT p.id,p.city,AVG(r.rating) AS score,COUNT(r.id) AS count FROM profiles p LEFT JOIN reviews r ON r.target=p.id WHERE p.demo=1 GROUP BY p.id').all();
 const asked=(draft.services||[draft.service]).filter(s=>services.includes(s));
 const tour=asked.includes('tour');
 // A tour agency can put together any mix of services; a specialist answers only for its own.
 const fits=p=>{const does=demoDoes[p.id]||['tour'];return asked.every(s=>does.includes(s))||(does.includes('tour')&&(asked.length>1||asked[0]==='other'))};
 const canon=name=>Object.keys(cityWords).find(c=>cityWords[c].test(name))||name;
 const city=canon(draft.city),from=asked.includes('transport')&&draft.from?canon(draft.from):'';
 // Agencies from the city come first; for a bus, so do those where the trip starts.
 const pick=results.filter(fits).map(p=>({...p,rank:(p.city===city||p.city===from?2:0)+Math.random()})).sort((a,b)=>b.rank-a.rank).slice(0,4);
 if(!pick.length)return;
 const text=[draft.hotel,draft.transport,...draft.details].join(' ');
 const stars=+(text.match(/([345])\s*(?:★|\*|зв|звезд|star|yulduz)/i)?.[1]||3);
 const seatsAsked=+(text.match(/(\d+)\s*(?:мест|o.?rin|örin|seat)/i)?.[1]||0);
 const need={days:draft.days||(tour?3:1),people:draft.people||15*draft.groups,stars,seats:seatsAsked||(draft.people?draft.people+1:51)};
 // Price: the trip's usual cost, then up to 12% more for the best rated and 12% less for the least.
 const rates=(tour?['tour']:asked).map(s=>demoRate(s,need));
 const daily=!tour&&asked.every(s=>s==='transport'||s==='guide');
 const base=rates.length===1?rates[0][0]:daily?rates.reduce((sum,r)=>sum+r[0],0):rates.reduce((sum,r)=>sum+r[2],0);
 const unit=rates.length===1?rates[0][1]:daily?'day':'total';
 const byRating=[...pick].sort((a,b)=>(b.score||0)-(a.score||0)||b.count-a.count);
 // The last one stays under 30 s: that is how long a Worker may keep running after it answers (see /api/jobs).
 const delays=[5,11,18,26],made=[];
 await db.batch(pick.map((agency,i)=>{
  const step=pick.length>1?byRating.indexOf(agency)/(pick.length-1):.5;
  const price=roundPrice(base*(1.12-.24*step)*(.97+Math.random()*.06));
  const includes=tour?['hotel','meals','guide','transport',...(agency.id==='demo:darvoza'?['tickets']:[])]
   :[...new Set(asked.map(s=>({transport:'transport',guide:'guide',hotel:'hotel',food:'meals'})[s]).filter(Boolean))];
  const notes=[];
  if(tour){notes.push(demoSights[city]?.[i%2]||'Программу по городу составим под вашу группу.',demoLines.tour[agency.id]);if(draft.groups>1)notes.push('Возьмём все группы на одни даты.')}
  else for(const s of asked){
   if(s==='transport'){notes.push(demoVehicles.find(v=>need.seats<=v[0])[1+i%2]);if(asked.length===1&&demoLines.transport[agency.id])notes.push(demoLines.transport[agency.id])}
   else if(s==='guide')notes.push(demoLines.guide[agency.id]||demoLines.guideAny);
   else if(s==='hotel'||s==='food')notes.push(demoLines[s][i%2]);
   else notes.push(demoLines.other);
  }
  const data={unit,includes,hotel:includes.includes('hotel')?stars+'★ '+(i%2&&demoNear[city]||'в центре'):'',language:includes.includes('guide')?draft.language:'',notes:notes.filter(Boolean)};
  made.push({id:crypto.randomUUID(),delay:delays[i]});
  return db.prepare('INSERT INTO bids(id,job,owner,price,currency,data,created) VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(made[i].id,job,agency.id,price,'USD',JSON.stringify(data),now+delays[i]*1000);
 }));
 return made;
}

// ---------- views ----------
const profileFields='p.name,p.city,p.about,p.logo,p.demo';
const agencyView=(row,lang)=>({id:row.id,name:row.name,city:tr(row.city,lang),logo:row.logo,demo:row.demo===1});
function jobView(row,lang){
 const d=JSON.parse(row.data);
 for(const k of ['title','city','from','language','hotel','meals','transport','budget','other'])d[k]=tr(d[k],lang);
 d.services=d.services||[d.service];
 d.details=(d.details||[]).map(x=>tr(x,lang));
 return {id:row.id,text:tr(row.text,lang),...d,status:row.status,chosen:row.chosen,created:row.created,owner:row.ownerName?{name:row.ownerName,city:tr(row.ownerCity,lang)}:undefined,bids:row.bids};
}
function bidView(row,lang){
 const d=JSON.parse(row.data);
 // Sample offers keep their text as separate catalog sentences; "4★ у Ляби-Хауза" translates the part after the stars.
 if(Array.isArray(d.notes)){d.note=d.notes.map(x=>tr(x,lang)).join(' ');delete d.notes}
 const stars=typeof d.hotel==='string'&&!catalog[d.hotel]&&d.hotel.match(/^(\d★ )(.+)$/);
 if(stars)d.hotel=stars[1]+tr(stars[2],lang);
 for(const k of ['hotel','language','note'])d[k]=tr(d[k],lang);
 return {id:row.id,price:row.price,currency:row.currency,...d,created:row.created};
}
async function reviewsFor(db,ids,lang){
 if(!ids.length)return {};
 const marks=ids.map(()=>'?').join(',');
 const [{results:scores},{results:texts}]=await Promise.all([
  db.prepare(`SELECT target,ROUND(AVG(rating),1) AS score,COUNT(*) AS count FROM reviews WHERE target IN (${marks}) GROUP BY target`).bind(...ids).all(),
  db.prepare(`SELECT target,author,rating,text FROM reviews WHERE target IN (${marks}) ORDER BY created DESC`).bind(...ids).all()
 ]);
 const out={};
 for(const id of ids)out[id]={score:0,count:0,items:[]};
 for(const s of scores)Object.assign(out[s.target],{score:s.score,count:s.count});
 for(const t of texts)if(out[t.target].items.length<5)out[t.target].items.push({author:t.author,rating:t.rating,text:tr(t.text,lang)});
 return out;
}

// ---------- API ----------
export async function exchange({request,env,ctx,url,path,method,db,profile,body,json,error,lang}){
 const origin=url.origin,now=Date.now();
 const later=promise=>ctx?.waitUntil?ctx.waitUntil(promise):promise;

 if(path==='/api/parse'&&method==='POST'){
  let data;try{data=await body(request,8192)}catch{return error('Опишите, что нужно.',400)}
  const text=str(data?.text,1500);
  if(text.length<8)return error('Опишите подробнее: куда, сколько людей, на сколько дней.',400);
  const ip=request.headers.get('cf-connecting-ip')||'local';
  if(await limited(db,'parse|'+ip,40,now))return error('Много запросов. Повторите через 15 минут.',429);
  const lang=['ru','en','uz'].includes(data.lang)?data.lang:'ru';
  return json({text,...await parseRequest(env,text,lang)});
 }
 if(path==='/api/voice'&&method==='POST'){
  if(!/^audio\//.test(request.headers.get('content-type')||''))return error('Запись не получилась. Попробуйте ещё раз.',400);
  if(+request.headers.get('content-length')>3e6)return error('Слишком длинная запись. Уложитесь в минуту.',413);
  const ip=request.headers.get('cf-connecting-ip')||'local';
  if(await limited(db,'voice|'+ip,30,now))return error('Много запросов. Повторите через 15 минут.',429);
  const bytes=new Uint8Array(await request.arrayBuffer());
  if(bytes.length<400)return error('Запись не получилась. Попробуйте ещё раз.',400);
  if(bytes.length>3e6)return error('Слишком длинная запись. Уложитесь в минуту.',413);
  if(!env.AI)return error('Распознавание речи недоступно.',503);
  let binary='';
  for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  const lang=url.searchParams.get('lang');
  const hint={ru:'Турагентство. Самарканд, Бухара, Хива, Ташкент. Группа, гид, автобус, гостиница.',en:'Travel agency. Samarkand, Bukhara, Khiva, Tashkent. Group, guide, bus, hotel.',uz:'Turagentlik. Samarqand, Buxoro, Xiva, Toshkent. Guruh, gid, avtobus, mehmonxona.'}[lang]||'';
  try{
   const result=await env.AI.run('@cf/openai/whisper-large-v3-turbo',{audio:btoa(binary),task:'transcribe',vad_filter:true,...(hint?{initial_prompt:hint}:{})});
   const text=str(result?.text,1500);
   // Whisper invents these on silence or noise (subtitle credits from its training data).
   if(!text||/субтитр|dimatorzok|продолжение следует|редактор субтитров|корректор|спасибо за просмотр|подписывайтесь|thank you for watching|thanks for watching|please subscribe|amara\.org/i.test(text)||text===hint)throw Error();
   return json({text});
  }catch{return error('Не удалось распознать речь. Попробуйте ещё раз.',502)}
 }
 if(path==='/api/jobs/latest'&&method==='GET'){
  const [{results},open]=await Promise.all([
   db.prepare(`SELECT j.*,p.name AS ownerName,p.city AS ownerCity,(SELECT COUNT(*) FROM bids b WHERE b.job=j.id AND b.created<=?) AS bids FROM jobs j JOIN profiles p ON p.id=j.owner WHERE j.status='open' ORDER BY j.created DESC LIMIT 30`).bind(now).all(),
   db.prepare(`SELECT COUNT(*) AS n FROM jobs WHERE status='open'`).first('n')
  ]);
  return json({open,jobs:results.map(row=>{const v=jobView(row,lang);delete v.text;return v})});
 }
 if(!profile)return null;
 const me=profile.id;

 if(method==='GET'){
  if(path==='/api/profile'){
   const row=await db.prepare("SELECT p.id,p.name,p.city,p.about,p.phone,p.telegram,p.logo,p.tg_chat,p.demo,a.password_hash<>'' AS password FROM profiles p LEFT JOIN accounts a ON a.user_id=p.id WHERE p.id=?").bind(me).first();
   return json({profile:{name:row.name,city:row.city,about:row.about,phone:row.phone,telegram:row.telegram,telegramConnected:!!row.tg_chat,demo:row.demo===2,password:!!row.password},bot:env.TELEGRAM_BOT_TOKEN?await botUsername(env):''});
  }
  if(path==='/api/jobs'){
   const {results}=await db.prepare(`SELECT j.*,p.name AS ownerName,p.city AS ownerCity,(SELECT COUNT(*) FROM bids b WHERE b.job=j.id AND b.created<=?) AS bids,EXISTS(SELECT 1 FROM bids b WHERE b.job=j.id AND b.owner=?) AS mine FROM jobs j JOIN profiles p ON p.id=j.owner WHERE j.status='open' AND j.owner<>? ORDER BY j.created DESC LIMIT 100`).bind(now,me,me).all();
   return json({jobs:results.map(row=>({...jobView(row,lang),answered:!!row.mine}))});
  }
  if(path==='/api/my'){
   const [{results:jobs},{results:bids}]=await Promise.all([
    db.prepare('SELECT j.*,(SELECT COUNT(*) FROM bids b WHERE b.job=j.id AND b.created<=?) AS bids FROM jobs j WHERE j.owner=? ORDER BY j.created DESC LIMIT 100').bind(now,me).all(),
    db.prepare('SELECT b.*,j.data AS jobData,j.status AS jobStatus,j.chosen,p.name AS ownerName FROM bids b JOIN jobs j ON j.id=b.job JOIN profiles p ON p.id=j.owner WHERE b.owner=? ORDER BY b.created DESC LIMIT 100').bind(me).all()
   ]);
   return json({jobs:jobs.map(row=>jobView(row,lang)),bids:bids.map(row=>({...bidView(row,lang),job:{id:row.job,title:tr(JSON.parse(row.jobData).title,lang),city:tr(JSON.parse(row.jobData).city,lang),owner:row.ownerName},status:row.chosen===row.id?'chosen':row.jobStatus==='open'?'sent':'closed'}))});
  }
  const jobMatch=path.match(/^\/api\/jobs\/([a-f0-9-]{36})$/);
  if(jobMatch){
   const row=await db.prepare('SELECT j.*,p.name AS ownerName,p.city AS ownerCity FROM jobs j JOIN profiles p ON p.id=j.owner WHERE j.id=?').bind(jobMatch[1]).first();
   if(!row)return error('Заявка не найдена.',404);
   const job=jobView(row,lang),isOwner=row.owner===me;
   if(isOwner){
    const {results}=await db.prepare(`SELECT b.*,${profileFields} FROM bids b JOIN profiles p ON p.id=b.owner WHERE b.job=? AND b.created<=? ORDER BY b.created`).bind(row.id,now).all();
    const reviews=await reviewsFor(db,results.map(r=>r.owner),lang);
    const pending=results.filter(r=>!r.notified);
    if(pending.length)later(Promise.all(pending.map(r=>bidNotice(env,db,origin,r.id))));
    const upcoming=await db.prepare('SELECT COUNT(*) AS n FROM bids WHERE job=? AND created>?').bind(row.id,now).first();
    return json({job,owner:true,waiting:upcoming.n>0,bids:results.map(r=>({...bidView(r,lang),agency:{...agencyView({...r,id:r.owner},lang),rating:reviews[r.owner]}}))});
   }
   const mine=await db.prepare('SELECT * FROM bids WHERE job=? AND owner=?').bind(row.id,me).first();
   return json({job,owner:false,myBid:mine?{...bidView(mine,lang),chosen:row.chosen===mine.id}:null});
  }
  const chatMatch=path.match(/^\/api\/chat\/([a-f0-9-]{36})$/);
  if(chatMatch){
   const thread=await chatAccess(db,chatMatch[1],me);
   if(!thread)return error('Чат недоступен.',404);
   const after=int(url.searchParams.get('after')||0,0,Number.MAX_SAFE_INTEGER);
   const {results}=await db.prepare('SELECT id,sender,text,created FROM messages WHERE bid=? AND id>? ORDER BY id LIMIT 200').bind(thread.bid,after).all();
   const other=await db.prepare('SELECT name,city,phone,telegram FROM profiles WHERE id=?').bind(thread.jobOwner===me?thread.bidOwner:thread.jobOwner).first();
   return json({title:tr(JSON.parse(thread.jobData).title,lang),job:thread.job,owner:thread.jobOwner===me,other:other&&{...other,city:tr(other.city,lang)},messages:results.map(m=>({id:m.id,mine:m.sender===me,text:tr(m.text,lang),created:m.created}))});
  }
  return undefined;
 }

 if(method!=='POST')return undefined;
 let data;
 try{data=await body(request,16384);if(!data||typeof data!=='object'||Array.isArray(data))throw Error()}catch{return error('Проверьте поля формы.',400)}

 if(path==='/api/profile'){
  const name=str(data.name,90);
  if(name.length<2)return error('Укажите название компании.',400);
  const phone=str(data.phone,40),telegram=str(data.telegram,40).replace(/^@|^https?:\/\/t\.me\//,'');
  if(telegram&&!/^[A-Za-z0-9_]{4,32}$/.test(telegram))return error('Проверьте username в Telegram.',400);
  await db.prepare('UPDATE profiles SET name=?,city=?,about=?,phone=?,telegram=? WHERE id=?').bind(name,str(data.city,40),str(data.about,500),phone,telegram,me).run();
  return json({ok:true});
 }
 if(path==='/api/jobs'){
  const text=str(data.text,1500),draft=normalizeDraft(data.draft);
  if(!draft.title||draft.title.length<4)return error('Добавьте заголовок заявки.',400);
  if(await limited(db,'jobs|'+me,20,now))return error('Много заявок подряд. Повторите через 15 минут.',429);
  const id=crypto.randomUUID();
  await db.prepare('INSERT INTO jobs(id,owner,text,data,created) VALUES(?,?,?,?,?)').bind(id,me,text,JSON.stringify(draft),now).run();
  const flag=await db.prepare('SELECT demo,tg_chat FROM profiles WHERE id=?').bind(me).first();
  const sample=flag?.demo===2||env.DEMO_BIDS==='all'?await demoBids(db,id,draft,now)||[]:[];
  // Telegram confirms the request went out, then announces each offer as it arrives.
  // Sample offers are announced on their own timers, so the pings keep coming while the presenter's page is hidden (it polls only while visible).
  later(Promise.all([
   notify(env,flag?.tg_chat,`📤 <b>Заявка опубликована</b>\n«${esc(draft.title)}»\n\nАгентства уже видят её — отклики придут сюда.`,origin+'/jobs/'+id,'Открыть заявку'),
   ...sample.map(b=>new Promise(r=>setTimeout(r,b.delay*1000)).then(()=>bidNotice(env,db,origin,b.id)))
  ]));
  return json({id},201);
 }
 if(path==='/api/bids'){
  if(!uuid.test(data.job||''))return error('Заявка не найдена.',404);
  const job=await db.prepare('SELECT owner,status FROM jobs WHERE id=?').bind(data.job).first();
  if(!job)return error('Заявка не найдена.',404);
  if(job.owner===me)return error('Это ваша заявка.',400);
  if(job.status!=='open')return error('Заказчик уже выбрал исполнителя.',409);
  const currency=currencies.includes(data.currency)?data.currency:'USD';
  const price=Math.round(Number(data.price));
  if(!Number.isFinite(price)||price<1||price>(currency==='UZS'?1e11:1e7))return error('Укажите цену.',400);
  const details={unit:units.includes(data.unit)?data.unit:'person',includes:(Array.isArray(data.includes)?data.includes:[]).filter(x=>includesList.includes(x)),hotel:str(data.hotel,60),language:str(data.language,60),note:str(data.note,800)};
  const id=crypto.randomUUID();
  const saved=await db.prepare('INSERT INTO bids(id,job,owner,price,currency,data,created) VALUES(?,?,?,?,?,?,?) ON CONFLICT(job,owner) DO NOTHING').bind(id,data.job,me,price,currency,JSON.stringify(details),now).run();
  if(!saved.meta.changes)return error('Вы уже откликнулись на эту заявку.',409);
  later(bidNotice(env,db,origin,id));
  return json({id},201);
 }
 if(path==='/api/choose'){
  if(!uuid.test(data.bid||''))return error('Отклик не найден.',404);
  const row=await db.prepare('SELECT b.id,b.job,b.owner,j.owner AS jobOwner,j.data,p.tg_chat FROM bids b JOIN jobs j ON j.id=b.job JOIN profiles p ON p.id=b.owner WHERE b.id=? AND b.created<=?').bind(data.bid,now).first();
  if(!row||row.jobOwner!==me)return error('Отклик не найден.',404);
  const result=await db.prepare("UPDATE jobs SET status='chosen',chosen=? WHERE id=? AND owner=? AND status='open'").bind(row.id,row.job,me).run();
  if(!result.meta.changes)return error('Исполнитель уже выбран.',409);
  later(notify(env,row.tg_chat,`✅ <b>Вас выбрали исполнителем</b>\n«${esc(JSON.parse(row.data).title)}»\nЗаказчик: ${esc(profile.name)}\n\nОткройте чат, чтобы договориться о деталях.`,origin+'/chat/'+row.id,'Открыть чат'));
  return json({ok:true,chat:row.id});
 }
 if(path==='/api/chat'){
  if(!uuid.test(data.bid||''))return error('Чат недоступен.',404);
  const text=typeof data.text==='string'?data.text.trim().slice(0,2000):'';
  if(!text)return error('Напишите сообщение.',400);
  const thread=await chatAccess(db,data.bid,me);
  if(!thread)return error('Чат недоступен.',404);
  const saved=await db.prepare('INSERT INTO messages(bid,sender,text,created) VALUES(?,?,?,?) RETURNING id').bind(thread.bid,me,text,now).first();
  const target=thread.jobOwner===me?thread.bidOwner:thread.jobOwner;
  const peer=await db.prepare('SELECT tg_chat FROM profiles WHERE id=?').bind(target).first();
  later(notify(env,peer?.tg_chat,`💬 <b>${esc(profile.name)}</b>: ${esc(text.slice(0,300))}`,origin+'/chat/'+thread.bid,'Ответить'));
  const agency=await db.prepare('SELECT demo FROM profiles WHERE id=?').bind(target).first();
  if(agency?.demo===1){
   const answered=await db.prepare('SELECT 1 FROM messages WHERE bid=? AND sender=?').bind(thread.bid,target).first();
   if(!answered)later(new Promise(r=>setTimeout(r,3500)).then(()=>db.prepare('INSERT INTO messages(bid,sender,text,created) VALUES(?,?,?,?)').bind(thread.bid,target,'Здравствуйте! Спасибо, что выбрали нас. Программу и договор пришлём сегодня. Удобно созвониться через 15 минут?',Date.now()).run()));
  }
  return json({id:saved.id},201);
 }
 if(path==='/api/telegram/link'){
  if(!env.TELEGRAM_BOT_TOKEN)return error('Telegram-бот ещё не подключён.',503);
  const code=Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>b.toString(16).padStart(2,'0')).join('');
  await db.batch([db.prepare('DELETE FROM tg_links WHERE expires<=?').bind(now),db.prepare('INSERT INTO tg_links(code,profile,expires) VALUES(?,?,?)').bind(code,me,now+15*60*1000)]);
  return json({url:'https://t.me/'+await botUsername(env)+'?start='+code});
 }
 if(path==='/api/telegram/setup'){
  if(!env.TELEGRAM_BOT_TOKEN)return error('Telegram-бот ещё не подключён.',503);
  const result=await tg(env,'setWebhook',{url:origin+'/api/telegram/hook',secret_token:await hookSecret(env),allowed_updates:hookUpdates});
  return json({ok:!!result?.ok,description:result?.description||''});
 }
 return undefined;
}
async function chatAccess(db,bid,me){
 const row=await db.prepare('SELECT b.id AS bid,b.owner AS bidOwner,j.id AS job,j.owner AS jobOwner,j.chosen,j.data AS jobData FROM bids b JOIN jobs j ON j.id=b.job WHERE b.id=?').bind(bid).first();
 return row&&row.chosen===row.bid&&(row.bidOwner===me||row.jobOwner===me)?row:null;
}

// Telegram webhook: links a chat to a profile after /start <code>.
export async function telegramHook(request,env,db){
 if(!env.TELEGRAM_BOT_TOKEN||request.headers.get('x-telegram-bot-api-secret-token')!==await hookSecret(env))return new Response('forbidden',{status:403});
 let update;try{update=await request.json()}catch{return new Response('ok')}
 if(await loginUpdate(update,env,db))return new Response('ok');
 if(await demoUpdate(update,env,db))return new Response('ok');
 const message=update?.message,chat=message?.chat?.id,text=typeof message?.text==='string'?message.text:'';
 if(!chat||message.chat.type!=='private')return new Response('ok');
 const code=text.match(/^\/start\s+([a-f0-9]{24})$/)?.[1];
 if(code){
  const link=await db.prepare('DELETE FROM tg_links WHERE code=? AND expires>? RETURNING profile').bind(code,Date.now()).first();
  if(link){
   await db.batch([db.prepare('UPDATE profiles SET tg_chat=NULL WHERE tg_chat=?').bind(String(chat)),db.prepare('UPDATE profiles SET tg_chat=? WHERE id=?').bind(String(chat),link.profile)]);
   const p=await db.prepare('SELECT name FROM profiles WHERE id=?').bind(link.profile).first();
   await tg(env,'sendMessage',{chat_id:chat,text:`Готово! Уведомления TOURMESH подключены для «${p?.name||''}».\nСюда будут приходить новые отклики на ваши заявки и сообщения из чата.`});
   return new Response('ok');
  }
  await tg(env,'sendMessage',{chat_id:chat,text:'Ссылка устарела. Откройте кабинет на сайте и нажмите «Подключить Telegram» ещё раз.'});
  return new Response('ok');
 }
 await tg(env,'sendMessage',{chat_id:chat,text:'Это бот уведомлений TOURMESH. Чтобы подключить его, откройте кабинет на сайте и нажмите «Подключить Telegram».'});
 return new Response('ok');
}

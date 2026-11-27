// Demo bookings: a 30-minute slot on weekdays 09:00–14:00 in Tashkent, one per browser (cookie tm_demo).
//
// Telegram: every booking is announced to the team chats in DEMO_TG_CHAT (comma-separated chat ids).
// The person who booked gets a confirmation and, an hour before, a reminder — straight away when signed in
// with Telegram connected; otherwise after opening t.me/<bot>?start=demo_<code>, which the receipt links to.
import {limited} from './accounts.mjs';
import {tg,botUsername} from './telegram.mjs';
const halfHour = 1800000;
const hour = 3600000;
// A slot booked this close to its start gets no separate reminder: the confirmation is enough.
const soon = hour + halfHour;
const horizon = 90 * 86400000;
const hostZone = 'Asia/Tashkent';
const calendar = new Intl.DateTimeFormat('en-US',{timeZone:hostZone,weekday:'short',hour:'2-digit',hourCycle:'h23',minute:'2-digit'});

function validStart(start,now) {
 if (!Number.isSafeInteger(start) || start <= now || start >= now+horizon || start % halfHour !== 0) return false;
 const {weekday,hour,minute} = Object.fromEntries(calendar.formatToParts(start).map(p=>[p.type,p.value]));
 return !['Sat','Sun'].includes(weekday) && +hour>=9 && +hour<14 && ['00','30'].includes(minute);
}
function validZone(zone) {
 if (typeof zone!=='string' || zone.length>64) return false;
 try { new Intl.DateTimeFormat('en',{timeZone:zone}); return true } catch { return false }
}
const esc=value=>String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
const freshCode=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('');

// ---------- messages: [ru, en, uz] ----------
const say={
 booked:['✅ <b>Вы записаны на демо TOURMESH</b>','✅ <b>You are booked for a TOURMESH demo</b>','✅ <b>Siz TOURMESH namoyişiga yozildingiz</b>'],
 later:['Напомним здесь за час до начала.','We will remind you here an hour before it starts.','Boşlanişidan bir soat oldin şu yerda eslatamiz.'],
 soon:['⏰ <b>Скоро демо TOURMESH</b>','⏰ <b>Your TOURMESH demo is coming up</b>','⏰ <b>Tez orada TOURMESH namoyişi</b>'],
 minutes:[m=>'Начнём через '+m+' мин.',m=>'Starts in '+m+' min.',m=>m+' daqiqadan keyin boşlaymiz.'],
 tashkent:['по Ташкенту','Tashkent time','Toşkent vaqti'],
 old:['Эта ссылка больше не действует. Запишитесь на демо на сайте.','This link no longer works. Book a demo on the website.','Bu havola endi işlamaydi. Saytda namoyişga yoziling.']
};
const at=lang=>lang==='en'?1:lang==='uz'?2:0;
// Browsers and Workers ship no Uzbek month or weekday names, so Uzbek dates are composed by hand (as in demo-calendar.mjs).
const UZ_MONTHS=['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentyabr','oktyabr','noyabr','dekabr'];
const UZ_DAYS={Mon:'duşanba',Tue:'seşanba',Wed:'çorşanba',Thu:'payşanba',Fri:'juma',Sat:'şanba',Sun:'yakşanba'};
function when(start,zone,lang){
 let date;
 if(lang==='uz'){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,weekday:'short',month:'numeric',day:'numeric'}).formatToParts(start).map(x=>[x.type,x.value]));
  date=UZ_DAYS[p.weekday]+', '+p.day+'-'+UZ_MONTHS[p.month-1];
 }else date=new Intl.DateTimeFormat(lang==='en'?'en-US':'ru-RU',{timeZone:zone,weekday:'long',day:'numeric',month:'long'}).format(start);
 const time=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const label=zone===hostZone?say.tashkent[at(lang)]:new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(start).find(p=>p.type==='timeZoneName')?.value||zone;
 return date+', '+time.format(start)+'–'+time.format(start+halfHour)+' ('+label+')';
}
const confirmation=(start,zone,lang,reminded)=>say.booked[at(lang)]+'\n'+when(start,zone,lang)+(reminded?'':'\n\n'+say.later[at(lang)]);
const send=(env,chat,text)=>tg(env,'sendMessage',{chat_id:chat,text,parse_mode:'HTML',disable_web_page_preview:true});
function tellTeam(env,text){
 const chats=(env.DEMO_TG_CHAT||'').split(/[\s,]+/).filter(Boolean);
 return Promise.all(chats.map(chat=>send(env,chat,text)));
}
const agency=owner=>'«'+esc(owner.name)+'»'+[owner.city,owner.phone,owner.telegram&&'@'+owner.telegram].filter(Boolean).map(x=>' · '+esc(x)).join('');
async function announce(env,{start,zone,lang,owner,reminded}){
 const lines=['📅 <b>Новая запись на демо</b>',when(start,hostZone,'ru'),owner?agency(owner):'Гость, без входа на сайт'];
 if(zone!==hostZone)lines.push('Местное время: '+when(start,zone,'ru').replace(/\)$/,', '+esc(zone)+')'));
 lines.push(owner?.tg_chat?'Telegram: подтверждение отправлено':'Telegram: не подключён — ждём, пока откроет ссылку из записи');
 await Promise.all([tellTeam(env,lines.join('\n')),owner?.tg_chat&&send(env,owner.tg_chat,confirmation(start,zone,lang,reminded))]);
}

// What the receipt says about Telegram: already connected, or the link that connects it.
async function reach(env,db,row){
 if(row.telegram)return {telegram:true};
 const bot=env.TELEGRAM_BOT_TOKEN?await botUsername(env):'';
 if(!bot)return {telegram:false};
 // Bookings made before Telegram links existed get their code on first look.
 const code=row.tg_code||(await db.prepare('UPDATE demo_slots SET tg_code=COALESCE(tg_code,?) WHERE start_ms=? RETURNING tg_code').bind(freshCode(),row.start_ms).first())?.tg_code;
 return code?{telegram:false,link:'https://t.me/'+bot+'?start=demo_'+code}:{telegram:false};
}
const slotColumns='SELECT d.start_ms,d.tg_code,COALESCE(d.tg_chat,p.tg_chat) IS NOT NULL AS telegram FROM demo_slots d LEFT JOIN profiles p ON p.id=d.profile ';

export async function demoBooking({request,env,db,readBody,json,profile,lang,later}) {
 const now=Date.now();
 const visitor=request.headers.get('cookie')?.match(/(?:^|;\s*)tm_demo=([a-f0-9-]{36})(?:;|$)/)?.[1];
 if(request.method==='GET'){
  const [{results},mine]=await Promise.all([
   db.prepare('SELECT start_ms FROM demo_slots WHERE start_ms>? AND start_ms<? ORDER BY start_ms').bind(now,now+horizon).all(),
   visitor?db.prepare(slotColumns+'WHERE d.visitor_id=?').bind(visitor).first():Promise.resolve(null)
  ]);
  const response=json({busy:results.map(row=>row.start_ms),now,mine:mine?.start_ms??null,...mine?await reach(env,db,mine):{}});
  if(!visitor)response.headers.set('set-cookie','tm_demo='+crypto.randomUUID()+'; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Lax');
  return response;
 }
 if(request.method!=='POST')return json({error:'method'},405);
 if(!visitor)return json({error:'session'},403);
 let data;
 try{data=await readBody(request,512)}catch{return json({error:'invalid'},400)}
 if(!validStart(data?.start,now)||typeof data?.requestId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(data.requestId))return json({error:'invalid'},400);
 const ip=request.headers.get('cf-connecting-ip');
 if(await limited(db,'demo|'+(ip||'shared'),ip?8:150,now))return json({error:'limit'},429);
 const {start,requestId}=data;
 const zone=validZone(data.zone)?data.zone:hostZone;
 const pageLang=['ru','en','uz'].includes(data.lang)?data.lang:lang;
 const owner=profile?await db.prepare('SELECT id,name,city,phone,telegram,tg_chat FROM profiles WHERE id=?').bind(profile.id).first():null;
 const reminded=start-now<=soon?1:0;
 const inserted=await db.prepare('INSERT INTO demo_slots(start_ms,request_id,visitor_id,profile,zone,lang,tg_code,reminded) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING start_ms,tg_code')
  .bind(start,requestId,visitor,owner?.id??null,zone,pageLang,freshCode(),reminded).first();
 if(inserted){
  later(announce(env,{start,zone,lang:pageLang,owner,reminded}));
  return json({start,...await reach(env,db,{start_ms:start,tg_code:inserted.tg_code,telegram:!!owner?.tg_chat})},201);
 }
 const prior=await db.prepare(slotColumns+'WHERE d.request_id=? AND d.visitor_id=?').bind(requestId,visitor).first();
 if(prior?.start_ms===start)return json({start,...await reach(env,db,prior)});
 const mine=await db.prepare('SELECT start_ms FROM demo_slots WHERE visitor_id=?').bind(visitor).first();
 return mine?json({error:'already',start:mine.start_ms},409):json({error:'occupied'},409);
}

// /start demo_<code> in the bot: this chat now gets the confirmation and the reminder. Returns true when the update was one.
export async function demoUpdate(update,env,db){
 const message=update?.message,text=typeof message?.text==='string'?message.text:'';
 const code=text.match(/^\/start\s+demo_([a-f0-9]{32})$/)?.[1];
 if(!code)return false;
 const chat=message.chat,from=message.from||{};
 if(chat?.type!=='private')return true;
 const now=Date.now();
 const row=await db.prepare('SELECT d.start_ms,d.zone,d.lang,d.tg_chat,d.reminded,p.name,p.city,p.phone,p.telegram FROM demo_slots d LEFT JOIN profiles p ON p.id=d.profile WHERE d.tg_code=? AND d.start_ms>?').bind(code,now).first();
 if(!row){await send(env,chat.id,say.old[at(from.language_code)]);return true}
 const reminded=row.reminded||row.start_ms-now<=soon?1:0;
 await db.prepare('UPDATE demo_slots SET tg_chat=?,reminded=? WHERE tg_code=?').bind(String(chat.id),reminded,code).run();
 const person='<a href="tg://user?id='+Number(from.id)+'">'+esc([from.first_name,from.last_name].filter(Boolean).join(' ')||'Telegram')+'</a>'+(from.username?' · @'+esc(from.username):'');
 await Promise.all([
  send(env,chat.id,confirmation(row.start_ms,row.zone||hostZone,row.lang,reminded)),
  // The team hears about the first chat only, not about repeat taps on the same link.
  row.tg_chat||tellTeam(env,['🔗 <b>Подключили Telegram к записи на демо</b>',when(row.start_ms,hostZone,'ru'),row.name?agency(row):'Гость, без входа на сайт','Telegram: '+person].join('\n'))
 ]);
 return true;
}

// Sends the reminders due within the hour. Runs on a cron where there is one, and opportunistically on requests;
// each slot is claimed atomically, so overlapping runs never remind twice.
export async function demoReminders(env,db){
 if(!env.TELEGRAM_BOT_TOKEN||!db)return;
 const now=Date.now();
 const chat='COALESCE(tg_chat,(SELECT tg_chat FROM profiles WHERE id=demo_slots.profile))';
 const {results}=await db.prepare(`UPDATE demo_slots SET reminded=1 WHERE reminded=0 AND start_ms>? AND start_ms<=? AND ${chat} IS NOT NULL RETURNING start_ms,zone,lang,${chat} AS chat`).bind(now,now+hour).all();
 await Promise.all(results.map(row=>{
  const i=at(row.lang);
  return send(env,row.chat,say.soon[i]+'\n'+when(row.start_ms,row.zone||hostZone,row.lang)+'\n'+say.minutes[i](Math.max(1,Math.round((row.start_ms-now)/60000))));
 }));
}

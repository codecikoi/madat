import {limited} from './accounts.mjs';
const halfHour = 1800000;
const horizon = 90 * 86400000;
const calendar = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tashkent',weekday:'short',hour:'2-digit',hourCycle:'h23',minute:'2-digit'});

function validStart(start,now) {
 if (!Number.isSafeInteger(start) || start <= now || start >= now+horizon || start % halfHour !== 0) return false;
 const {weekday,hour,minute} = Object.fromEntries(calendar.formatToParts(start).map(p=>[p.type,p.value]));
 return !['Sat','Sun'].includes(weekday) && +hour>=9 && +hour<14 && ['00','30'].includes(minute);
}
export async function demoBooking(request,db,readBody,json) {
 const now=Date.now();
 const visitor=request.headers.get('cookie')?.match(/(?:^|;\s*)tm_demo=([a-f0-9-]{36})(?:;|$)/)?.[1];
 if(request.method==='GET'){
  const [{results},mine]=await Promise.all([
   db.prepare('SELECT start_ms FROM demo_slots WHERE start_ms>? AND start_ms<? ORDER BY start_ms').bind(now,now+horizon).all(),
   visitor?db.prepare('SELECT start_ms FROM demo_slots WHERE visitor_id=?').bind(visitor).first():Promise.resolve(null)
  ]);
  const response=json({busy:results.map(row=>row.start_ms),now,mine:mine?.start_ms??null});
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
 const inserted=await db.prepare('INSERT INTO demo_slots(start_ms,request_id,visitor_id) VALUES(?,?,?) ON CONFLICT DO NOTHING RETURNING start_ms').bind(start,requestId,visitor).first();
 if(inserted)return json({start},201);
 const prior=await db.prepare('SELECT start_ms FROM demo_slots WHERE request_id=?').bind(requestId).first();
 if(prior?.start_ms===start)return json({start});
 const mine=await db.prepare('SELECT start_ms FROM demo_slots WHERE visitor_id=?').bind(visitor).first();
 return mine?json({error:'already',start:mine.start_ms},409):json({error:'occupied'},409);
}

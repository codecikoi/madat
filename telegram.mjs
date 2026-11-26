// Telegram Bot API helpers, and signing in to TOURMESH through the same bot.
//
// Sign-in: the page asks /api/auth/telegram/start for a one-time link t.me/<bot>?start=login_<code>.
// The bot answers /start login_<code> with a confirm button; pressing it records the Telegram user on the code.
// Meanwhile the page polls with its secret, gets a session, and (first time only) names the new agency.
import {newSession, limited} from './accounts.mjs';

let botName;
export async function tg(env,method,payload){
 if(!env.TELEGRAM_BOT_TOKEN)return null;
 try{
  const response=await fetch('https://api.telegram.org/bot'+env.TELEGRAM_BOT_TOKEN+'/'+method,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
  return await response.json();
 }catch{return null}
}
export async function botUsername(env){
 if(env.TELEGRAM_BOT_USERNAME)return env.TELEGRAM_BOT_USERNAME;
 if(!botName){const me=await tg(env,'getMe',{});botName=me?.result?.username||''}
 return botName;
}
export async function hookSecret(env){
 const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('tourmesh-hook:'+env.TELEGRAM_BOT_TOKEN)));
 return Array.from(bytes.slice(0,24),b=>b.toString(16).padStart(2,'0')).join('');
}
export const hookUpdates=['message','callback_query'];

// Webhooks registered before sign-in existed receive messages only; the confirm button also needs callback queries.
let hookChecked=false;
async function ensureHook(env,origin){
 if(hookChecked)return;
 hookChecked=true;
 const info=(await tg(env,'getWebhookInfo',{}))?.result;
 if(!info||info.url!==origin+'/api/telegram/hook'||!info.allowed_updates||info.allowed_updates.includes('callback_query'))return;
 await tg(env,'setWebhook',{url:info.url,secret_token:await hookSecret(env),allowed_updates:hookUpdates});
}

const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const random=size=>hex(crypto.getRandomValues(new Uint8Array(size)));
const sha=async value=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))));
const reply=(value,status=200,cookie)=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...(cookie?{'set-cookie':cookie}:{})}});
const fail=(message,status)=>reply({error:message},status);
const TTL=10*60*1000;
const expired='Ссылка для входа устарела. Нажмите «Войти через Telegram» ещё раз.';

// The bot speaks the language of the page that started the sign-in: [ru, en, uz].
const say={
 ask:['<b>Вход в TOURMESH</b>\n\nНажмите кнопку ниже, чтобы войти на сайте.\nЕсли вы не нажимали «Войти через Telegram» только что, ничего не делайте.',
  '<b>Sign in to TOURMESH</b>\n\nTap the button below to sign in on the website.\nIf you did not just press “Sign in with Telegram”, do nothing.',
  '<b>TOURMESHga kiriş</b>\n\nSaytga kiriş uçun quyidagi tugmani bosing.\nAgar hozirgina «Telegram orqali kiriş» tugmasini bosmagan bölsangiz, heç narsa qilmang.'],
 button:['Войти на сайт','Sign in on the website','Saytga kiriş'],
 done:['✅ Вы вошли в TOURMESH. Вернитесь в браузер — страница обновится сама.\n\nСюда же будут приходить новые отклики и сообщения.',
  '✅ You are signed in to TOURMESH. Go back to your browser — the page updates by itself.\n\nNew offers and messages will arrive here too.',
  '✅ Siz TOURMESHga kirdingiz. Brauzerga qayting — sahifa özi yangilanadi.\n\nYangi takliflar va xabarlar ham şu yerga keladi.'],
 old:['Ссылка для входа устарела. Вернитесь на сайт и нажмите «Войти через Telegram» ещё раз.',
  'This sign-in link has expired. Go back to the website and press “Sign in with Telegram” again.',
  'Kiriş havolasi eskirgan. Saytga qayting va «Telegram orqali kiriş» tugmasini yana bosing.']
};
const pick=(key,lang)=>say[key][lang==='en'?1:lang==='uz'?2:0];
const langOf=user=>['en','uz'].includes(user?.language_code)?user.language_code:'ru';

async function accountFor(db,user){
 const columns='SELECT a.user_id,a.version,p.name,p.role FROM ';
 const found=await db.prepare(columns+'accounts a JOIN profiles p ON p.id=a.user_id WHERE a.tg_user=?').bind(user).first();
 if(found)return found;
 // A profile that already gets notifications in this chat proved it owns the chat, so the chat may sign in to it.
 const linked=await db.prepare(columns+'profiles p JOIN accounts a ON a.user_id=p.id WHERE p.tg_chat=? AND a.tg_user IS NULL').bind(user).first();
 if(!linked)return null;
 const result=await db.prepare('UPDATE accounts SET tg_user=? WHERE user_id=? AND tg_user IS NULL').bind(user,linked.user_id).run();
 return result.meta.changes?linked:null;
}
// Each confirmed code signs in once.
const claim=(db,code)=>db.prepare('DELETE FROM tg_logins WHERE code=? AND tg_user IS NOT NULL RETURNING tg_user').bind(code).first();
async function signIn(db,user,account,writes=[],status=200){
 const fresh=await newSession(db,account.user_id,account.version);
 await db.batch([...writes,fresh.insert,
  // Signing in through the bot also turns on notifications in that chat.
  db.prepare('UPDATE profiles SET tg_chat=NULL WHERE tg_chat=? AND id<>?').bind(user,account.user_id),
  db.prepare('UPDATE profiles SET tg_chat=? WHERE id=?').bind(user,account.user_id)]);
 return reply({profile:{name:account.name,role:account.role}},status,fresh.cookie);
}

export async function telegramLogin(action,{request,env,db,data,lang,origin,later}){
 if(!env.TELEGRAM_BOT_TOKEN)return fail('Вход через Telegram пока недоступен.',503);
 const now=Date.now();
 if(action==='start'){
  const ip=request.headers.get('cf-connecting-ip');
  if(await limited(db,'tg-start|'+(ip||'shared'),ip?60:300,now))return fail('Много попыток. Повторите через 15 минут.',429);
  const bot=await botUsername(env);
  if(!bot)return fail('Вход через Telegram пока недоступен.',503);
  const code=random(16),secret=random(32);
  await db.batch([db.prepare('DELETE FROM tg_logins WHERE expires<=?').bind(now),
   db.prepare('INSERT INTO tg_logins(code,secret_hash,lang,expires) VALUES(?,?,?,?)').bind(code,await sha(secret),['en','uz'].includes(data.lang)?data.lang:lang,now+TTL)]);
  later(ensureHook(env,origin));
  return reply({url:'https://t.me/'+bot+'?start=login_'+code,secret,ttl:TTL});
 }
 if(!['poll','finish'].includes(action))return fail('Страница не найдена.',404);
 const secret=typeof data.secret==='string'&&/^[0-9a-f]{64}$/.test(data.secret)?data.secret:'';
 const row=secret&&await db.prepare('SELECT code,tg_user,expires FROM tg_logins WHERE secret_hash=?').bind(await sha(secret)).first();
 if(!row||row.expires<=now)return fail(expired,410);
 if(!row.tg_user)return reply({status:'waiting'});
 if(action==='poll'){
  const account=await accountFor(db,row.tg_user);
  if(!account)return reply({status:'name'});
  if(!await claim(db,row.code))return fail(expired,410);
  return signIn(db,row.tg_user,account);
 }
 const name=typeof data.name==='string'?data.name.trim():'';
 if(name.length<2||name.length>90)return fail('Укажите название агентства.',400);
 const existing=await accountFor(db,row.tg_user);
 if(!await claim(db,row.code))return fail(expired,410);
 if(existing)return signIn(db,row.tg_user,existing);
 const account={user_id:'tm:'+crypto.randomUUID(),version:1,name,role:'both'};
 try{
  return await signIn(db,row.tg_user,account,[
   db.prepare('INSERT INTO profiles(id,name,role) VALUES(?,?,?)').bind(account.user_id,name,'both'),
   db.prepare("INSERT INTO accounts(user_id,login,password_hash,tg_user) VALUES(?,?,'',?)").bind(account.user_id,'tg:'+row.tg_user,row.tg_user)],201);
 }catch(err){if(/unique|constraint/i.test(String(err)))return fail(expired,409);throw err}
}

// Returns true when the update belonged to sign-in.
export async function loginUpdate(update,env,db){
 const now=Date.now(),query=update?.callback_query;
 if(query){
  const code=typeof query.data==='string'?query.data.match(/^login:([a-f0-9]{32})$/)?.[1]:null;
  if(!code)return false;
  const chat=query.message?.chat,user=query.from?.id;
  const row=chat?.type==='private'&&chat.id===user
   ?await db.prepare('UPDATE tg_logins SET tg_user=?,expires=? WHERE code=? AND expires>? AND tg_user IS NULL RETURNING lang').bind(String(user),now+TTL,code,now).first()
   :null;
  const lang=row?.lang||langOf(query.from);
  await tg(env,'answerCallbackQuery',{callback_query_id:query.id,...(row?{}:{text:pick('old',lang),show_alert:true})});
  if(chat&&query.message.message_id)await tg(env,'editMessageText',{chat_id:chat.id,message_id:query.message.message_id,text:pick(row?'done':'old',lang)});
  return true;
 }
 const message=update?.message,text=typeof message?.text==='string'?message.text:'';
 const code=text.match(/^\/start\s+login_([a-f0-9]{32})$/)?.[1];
 if(!code)return false;
 if(message.chat?.type!=='private')return true;
 const row=await db.prepare('SELECT lang FROM tg_logins WHERE code=? AND expires>? AND tg_user IS NULL').bind(code,now).first();
 if(!row){await tg(env,'sendMessage',{chat_id:message.chat.id,text:pick('old',langOf(message.from))});return true}
 await tg(env,'sendMessage',{chat_id:message.chat.id,text:pick('ask',row.lang),parse_mode:'HTML',
  reply_markup:{inline_keyboard:[[{text:pick('button',row.lang),callback_data:'login:'+code}]]}});
 return true;
}

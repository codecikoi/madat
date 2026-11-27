const id = name => document.getElementById('demo-' + name);
const hostZone = 'Asia/Tashkent';
const halfHour = 30 * 60000;
const day = 24 * 60 * 60000;
const zoneNames = new Map(Object.entries({
 'Asia/Tashkent':'Ташкент','Asia/Almaty':'Алматы','Asia/Dubai':'Дубай','Asia/Kolkata':'Калькутта','Asia/Tokyo':'Токио',
 'Europe/Moscow':'Москва','Europe/Istanbul':'Стамбул','Europe/London':'Лондон','Europe/Berlin':'Берлин',
 'America/New_York':'Нью-Йорк','America/Los_Angeles':'Лос-Анджелес','UTC':'UTC'
}));
const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone || hostZone;
if (!zoneNames.has(deviceZone)) zoneNames.set(deviceZone,deviceZone.replaceAll('_',' '));
for (const [key,label] of zoneNames) id('zone').add(new Option(label+' · '+key,key));
const otherZones = document.createElement('optgroup');
otherZones.label = 'Другие часовые пояса';
for (const zone of Intl.supportedValuesOf?.('timeZone') || []) {
 if (!zoneNames.has(zone)) otherZones.append(new Option(zone.replaceAll('_',' '),zone));
}
if (otherZones.childElementCount) id('zone').append(otherZones);
id('zone').value = deviceZone;

// Enumerate actual instants so the two ends of a session keep their local dates,
// including in time zones that change their clocks or use half-hour offsets.
const hostClock = new Intl.DateTimeFormat('en-US',{timeZone:hostZone,weekday:'short',hour:'2-digit',hourCycle:'h23',minute:'2-digit'});
function workingStarts(now) {
 const starts=[];
 for (let t=(Math.floor(now/halfHour)+1)*halfHour; t<now+90*day; t+=halfHour) {
  const parts=Object.fromEntries(hostClock.formatToParts(t).map(p=>[p.type,p.value]));
  if (parts.weekday!=='Sat' && parts.weekday!=='Sun' && +parts.hour>=9 && +parts.hour<14) starts.push(t);
 }
 return starts;
}
let starts=[], days=new Map(), selected='', month='', timeFormat, localDayFormat, chosen=null, busy=new Set(), sending=false, ready=false, revision=0, attempt=null;
// Browsers ship no Uzbek month or weekday names (Chrome prints "M11 27, Fri"), so Uzbek dates are composed by hand.
const UZ_MONTHS=['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentyabr','oktyabr','noyabr','dekabr'];
const UZ_DAYS={Mon:'duşanba',Tue:'seşanba',Wed:'çorşanba',Thu:'payşanba',Fri:'juma',Sat:'şanba',Sun:'yakşanba'};
const localeDate=(timeZone,options)=>{
 if(document.documentElement.lang!=='uz'||!options.month)return new Intl.DateTimeFormat(document.documentElement.lang,{timeZone,...options});
 const numeric=new Intl.DateTimeFormat('en-US',{timeZone,weekday:'short',year:'numeric',month:'numeric',day:'numeric'});
 return {format(date){
  const p=Object.fromEntries(numeric.formatToParts(date).map(part=>[part.type,part.value])),name=UZ_MONTHS[p.month-1];
  if(!options.day)return name+' '+p.year;
  return (options.weekday?UZ_DAYS[p.weekday]+', ':'')+p.day+'-'+name+(options.year?', '+p.year+'-yil':'');
 }};
};
function rebuild(preferredDate) {
 const zone=id('zone').value;
 const keyFormat=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'});
 localDayFormat=keyFormat;
 timeFormat=localeDate(zone,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 days=new Map();
 for (const instant of starts) {
  const parts=Object.fromEntries(keyFormat.formatToParts(instant).map(p=>[p.type,p.value]));
  const key=[parts.year,parts.month,parts.day].join('-');
  if (!days.has(key)) days.set(key,[]);
  days.get(key).push(instant);
 }
 selected=days.has(preferredDate)?preferredDate:days.keys().next().value;
 month=selected.slice(0,7);renderMonth();renderHours();
}
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');
motionPreference.addEventListener('change',()=>{
 if(motionPreference.matches)for(const animation of id('dialog').getAnimations({subtree:true}))if(animation.id==='calendar-change')animation.cancel();
});
function animate(element,direction=0) {
 if (!element.animate) return;
 for(const a of element.getAnimations())if(a.id==='calendar-change')a.cancel();
 if (motionPreference.matches) return;
 element.animate([{opacity:.45,transform:'translate('+direction*8+'px,3px)'},{opacity:1,transform:'none'}],
  {id:'calendar-change',duration:180,easing:'cubic-bezier(.18,.75,.25,1)'});
}
function renderHours() {
 const instants=days.get(selected), zone=id('zone').value;
 id('date').textContent=localeDate(zone,{weekday:'long',day:'numeric',month:'long'}).format(instants[0]);
 const offset=localeDate(zone,{timeZoneName:'longOffset'}).formatToParts(instants[0]).find(p=>p.type==='timeZoneName')?.value;
 id('offset').textContent=[zoneNames.get(zone)||zone.replaceAll('_',' '),offset].filter(Boolean).join(' · ');
 for(const option of id('zone').children){
  if(option.tagName!=='OPTION')continue;
  const gmt=localeDate(option.value,{timeZoneName:'longOffset'}).formatToParts(instants[0]).find(p=>p.type==='timeZoneName')?.value;
  option.textContent=zoneNames.get(option.value)+' ('+gmt+') · '+option.value;
 }
 if(!instants.includes(chosen))chosen=null;
 id('confirm').disabled=!ready||sending||chosen===null;
 const fragment=document.createDocumentFragment();
 for(const instant of instants){
  const label=document.createElement('button');label.type='button';label.dataset.start=String(instant);
  const end=instant+halfHour,nextDay=localDayFormat.format(instant)!==localDayFormat.format(end);
  label.textContent=timeFormat.format(instant)+'–'+timeFormat.format(end)+(nextDay?' (+1 день)':'');
  if(busy.has(instant)){const mark=document.createElement('small');mark.textContent='Занято';label.append(mark)}
  label.disabled=!ready||sending||busy.has(instant);
  label.setAttribute('aria-pressed',String(instant===chosen));
  fragment.append(label);
 }
 id('times').replaceChildren(fragment);
}
function renderMonth(){
 const first=new Date(month+'-01T12:00:00Z');
 id('month').textContent=localeDate('UTC',{year:'numeric',month:'long'}).format(first);
 const months=[...new Set([...days.keys()].map(key=>key.slice(0,7)))];
 id('prev').disabled=month===months[0];id('next').disabled=month===months.at(-1);
 const firstColumn=(first.getUTCDay()+6)%7;
 const length=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
 const fragment=document.createDocumentFragment();
 for(let n=1;n<=length;n++){
  const key=month+'-'+String(n).padStart(2,'0'),button=document.createElement('button');
  button.type='button';button.textContent=String(n);button.disabled=!days.has(key);button.dataset.date=key;
  button.setAttribute('aria-pressed',String(key===selected));
  button.setAttribute('aria-label',localeDate('UTC',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(key+'T12:00:00Z')));
  if(n===1)button.style.gridColumnStart=String(firstColumn+1);
  fragment.append(button);
 }
 id('days').replaceChildren(fragment);
}
id('days').onclick=event=>{
 const key=event.target.closest('button')?.dataset.date;
 if(!days.has(key)||selected===key)return;
 id('days').querySelector('[aria-pressed=true]')?.setAttribute('aria-pressed','false');
 selected=key;event.target.closest('button').setAttribute('aria-pressed','true');renderHours();animate(id('times'));
};
function changeMonth(direction){
 const months=[...new Set([...days.keys()].map(key=>key.slice(0,7)))];
 const next=months[months.indexOf(month)+direction];if(!next)return;
 month=next;selected=[...days.keys()].find(key=>key.startsWith(next));
 renderMonth();renderHours();animate(id('days'),direction);animate(id('times'),direction);
}
id('prev').onclick=()=>changeMonth(-1);id('next').onclick=()=>changeMonth(1);
id('zone').onchange=()=>{rebuild(selected);animate(id('times'))};
id('times').onclick=event=>{
 const button=event.target.closest('button[data-start]');
 if(!button||button.disabled)return;
 chosen=Number(button.dataset.start);
 if(attempt?.start!==chosen)attempt=null;
 id('status').textContent='';renderHours();
 id('times').querySelector('[aria-pressed=true]')?.focus();
};
const fetchCalendar=()=>fetch('/api/demo-calendar',{cache:'no-store',signal:AbortSignal.timeout(8000)}).then(res=>{if(!res.ok)throw Error();return res.json()});
// The schedule starts loading when the pointer reaches the button, so the dialog can open already filled in.
let warm=null;
function warmUp(){
 if(!warm||Date.now()-warm.at>20000){warm={at:Date.now(),data:fetchCalendar()};warm.data.catch(()=>{})}
 return warm.data;
}
async function loadCalendar(message='',source=null){
 const current=++revision;
 ready=false;chosen=null;id('hours').hidden=true;id('retry').hidden=true;
 id('status').textContent='Загружаем расписание…';
 try{
  const data=await (source||fetchCalendar());
  if(current!==revision)return;
  if(data.mine){showReceipt(data);return}
  id('receipt').hidden=true;
  starts=workingStarts(data.now);busy=new Set(data.busy);ready=true;
  id('hours').hidden=false;rebuild(selected);id('status').textContent=message;
 }catch{
  if(current!==revision)return;
  id('status').textContent='Не удалось загрузить расписание.';id('retry').hidden=false;
 }
}
id('confirm').onclick=async()=>{
 if(sending||!ready||chosen===null)return;
 const start=chosen;
 if(attempt?.start!==start)attempt={start,requestId:crypto.randomUUID()};
 sending=true;renderHours();id('status').textContent='Сохраняем заявку…';
 try{
  const res=await fetch('/api/demo-calendar',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...attempt,zone:id('zone').value,lang:document.documentElement.lang}),signal:AbortSignal.timeout(10000)});
  if(res.status===409||res.status===400){
   const result=await res.json();
   attempt=null;
   if(result.error==='already'){await loadCalendar();return}
   await loadCalendar('Это время уже недоступно. Выберите другое.');return;
  }
  if(res.status===429){id('status').textContent='Слишком много попыток. Попробуйте позже.';return}
  if(!res.ok)throw Error();
  const result=await res.json();
  if(result.start!==start)throw Error();
  busy.add(start);chosen=null;attempt=null;
  showReceipt({...result,mine:start});
 }catch{id('status').textContent='Не удалось подтвердить запись. Попробуйте снова.'}
 finally{sending=false;if(ready)renderHours()}
};
// The receipt names the slot in the visitor's time zone and says how Telegram will tell them about it.
function showReceipt(data){
 const zone=id('zone').value,time=localeDate(zone,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const line=(text,className)=>{const p=document.createElement('p');p.textContent=text;if(className)p.className=className;return p};
 const parts=[line('Заявка подана. Ждём вас на демо.'),
  line(localeDate(zone,{weekday:'long',day:'numeric',month:'long'}).format(data.mine)+', '+time.format(data.mine)+'–'+time.format(data.mine+halfHour)+' · '+(zoneNames.get(zone)||zone.replaceAll('_',' ')),'demo-slot')];
 if(data.telegram)parts.push(line('Подтверждение отправили в Telegram.','demo-telegram'));
 else if(data.link){
  const open=document.createElement('a');
  open.className='btn line';open.href=data.link;open.target='_blank';open.rel='noopener';open.textContent='Открыть Telegram';
  parts.push(line('Получите подтверждение и напоминание в Telegram.','demo-telegram'),open);
 }
 id('receipt').dataset.waiting=data.link&&!data.telegram?'1':'';
 id('receipt').replaceChildren(...parts);
 id('hours').hidden=true;id('receipt').hidden=false;id('status').textContent='';
}
// Back from Telegram: the receipt switches to "sent" once the bot has the chat.
function recheck(){
 if(document.hidden||!id('dialog').open||id('receipt').hidden||!id('receipt').dataset.waiting)return;
 fetchCalendar().then(data=>{if(data.mine&&data.telegram)showReceipt(data)}).catch(()=>{});
}
addEventListener('focus',recheck);document.addEventListener('visibilitychange',recheck);
let opening=false;
async function openDemo(){
 if(id('dialog').open||opening)return;
 if(sending){id('dialog').showModal();return}
 opening=true;
 const source=warmUp();warm=null;
 let arrived=false;source.then(()=>arrived=true,()=>arrived=true);
 // Wait briefly for the schedule so the dialog does not jump from a loading line to the full calendar.
 await Promise.race([source.then(()=>{},()=>{}),new Promise(resolve=>setTimeout(resolve,450))]);
 const loading=loadCalendar('',source);
 if(arrived)await loading;
 opening=false;id('dialog').showModal();
}
for(const type of ['pointerenter','focus','touchstart'])id('open').addEventListener(type,warmUp,{passive:true});
id('open').onclick=openDemo;id('close').onclick=()=>id('dialog').close();id('retry').onclick=()=>loadCalendar();
if(new URLSearchParams(location.search).has('demo'))openDemo();

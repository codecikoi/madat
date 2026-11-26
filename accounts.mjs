import bcrypt from 'bcryptjs';

const cookieName = '__Host-tourmesh';
const lifetime = 7 * 86400;
const dummyHash = '$2b$12$.RRUUt3NuTuufAIKB0csXe5fqhxqbl8v/p2oKn4ATzem.aDHzryZ2';
const encode = new TextEncoder();
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const randomSecret = bytes => hex(crypto.getRandomValues(new Uint8Array(bytes)));
const digest = async value => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encode.encode(value))));
const reply = (value, status = 200, cookie) => Response.json(value, {
  status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(cookie ? {'set-cookie': cookie} : {}) }
});
const fail = (message, status) => reply({error: message}, status);
const cookie = (token, seconds) => cookieName + '=' + token + '; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=' + seconds;
function tokenFrom(request) {
  const pair = (request.headers.get('cookie') || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='));
  const value = pair?.slice(cookieName.length + 1);
  return /^[0-9a-f]{64}$/.test(value || '') ? value : null;
}
export async function session(request, db) {
  const token = tokenFrom(request);
  if (!token) return null;
  return db.prepare('SELECT p.id,p.name,p.role FROM sessions s JOIN accounts a ON a.user_id=s.user_id AND a.version=s.version JOIN profiles p ON p.id=a.user_id WHERE s.token_hash=? AND s.expires>?')
    .bind(await digest(token), Date.now()).first();
}
export async function previousProfile(request, db) {
  // Only IDs provisioned by the old Sites login can own these profiles.
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id || id.startsWith('tm:')) return null;
  return db.prepare('SELECT id,name,role FROM profiles WHERE id=? AND NOT EXISTS(SELECT 1 FROM accounts WHERE user_id=profiles.id)').bind(id).first();
}
function profileView({name,role}) { return {name,role}; }
export async function me(request, db, current) {
  if (current) return reply({profile:profileView(current)});
  const previous = await previousProfile(request, db);
  return reply({profile:null,previous:previous ? profileView(previous) : null});
}
async function newSession(db, id, version) {
  const token = randomSecret(32);
  const insert = db.prepare('INSERT INTO sessions(token_hash,user_id,version,expires) VALUES(?,?,?,?)')
    .bind(await digest(token), id, version, Date.now() + lifetime * 1000);
  return {insert,cookie:cookie(token,lifetime)};
}
export async function limited(db, key, maximum, now) {
  const bucket = await digest(key);
  const end = now + 15 * 60 * 1000;
  const row = await db.prepare('INSERT INTO auth_limits(bucket,hits,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET hits=CASE WHEN expires<=? THEN 1 ELSE hits+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING hits')
    .bind(bucket,end,now,now).first();
  return row.hits > maximum;
}
const validPassword = value => typeof value === 'string' && [...value].length >= 15 && !bcrypt.truncates(value);
const passwordHint = 'Используйте фразу от 15 символов и до 72 байт. Пробелы разрешены.';
export async function auth(action, request, db, data, current) {
  if (action === 'logout') {
    const token = tokenFrom(request);
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(token)).run();
    return reply({ok:true},200,cookie('',0));
  }
  if (!['register','login','recover','recovery-code'].includes(action)) return fail('Страница не найдена.',404);
  const now = Date.now();
  const ip = request.headers.get('cf-connecting-ip');
  // A shared bucket is used when the trusted edge does not provide a client address.
  if (await limited(db, 'network|' + (ip || 'shared') + '|' + action, ip ? 30 : 180, now)) return fail('Много попыток. Повторите через 15 минут.',429);
  const login = typeof data.login === 'string' ? data.login.trim().toLowerCase() : '';
  if (action !== 'recovery-code' && !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(login)) return fail('Логин должен содержать от 3 до 40 латинских букв, цифр, точек, дефисов или подчёркиваний.',400);
  if (action === 'recovery-code' && !current) return fail('Войдите в кабинет.',401);
  if (await limited(db, action + '|' + (current?.id || login), 10, now)) return fail('Много попыток. Повторите через 15 минут.',429);
  await db.batch([db.prepare('DELETE FROM auth_limits WHERE expires<=?').bind(now),db.prepare('DELETE FROM sessions WHERE expires<=?').bind(now)]);
  if (action === 'register') {
    if (current) return fail('Сначала выйдите из кабинета.',409);
    if (!validPassword(data.password)) return fail(passwordHint,400);
    const previous = data.linkPrevious === true ? await previousProfile(request,db) : null;
    if (data.linkPrevious === true && !previous) return fail('Этот кабинет уже привязан или недоступен.',409);
    const profile = previous || {id:'tm:'+crypto.randomUUID(),name:typeof data.name === 'string' ? data.name.trim() : '',role:data.role};
    if (profile.name.length < 2 || profile.name.length > 90 || (!previous && !['operator','supplier'].includes(profile.role))) return fail('Выберите роль и укажите название компании.',400);
    const exists = await db.prepare('SELECT 1 FROM accounts WHERE login=?').bind(login).first();
    if (exists) return fail('Этот логин уже занят. Выберите другой.',409);
    const passwordHash = await bcrypt.hash(data.password,12);
    const fresh = await newSession(db,profile.id,1);
    const writes = [];
    if (!previous) writes.push(db.prepare('INSERT INTO profiles(id,name,role) VALUES(?,?,?)').bind(profile.id,profile.name,profile.role));
    writes.push(db.prepare('INSERT INTO accounts(user_id,login,password_hash) VALUES(?,?,?)').bind(profile.id,login,passwordHash),fresh.insert);
    try { await db.batch(writes); }
    catch (err) { if (/unique|constraint/i.test(String(err))) return fail('Профиль или логин уже занят.',409); throw err; }
    return reply({profile:profileView(profile)},201,fresh.cookie);
  }
  if (action === 'recover') {
    if (!validPassword(data.password)) return fail(passwordHint,400);
    const code = typeof data.code === 'string' ? data.code.replace(/[-\s]/g,'').toLowerCase() : '';
    if (!/^[a-f0-9]{32}$/.test(code)) return fail('Проверьте логин и резервный код.',400);
    const hash = await digest(code);
    const found = await db.prepare('SELECT user_id FROM accounts WHERE login=? AND recovery_hash=?').bind(login,hash).first();
    if (!found) return fail('Проверьте логин и резервный код.',400);
    const result = await db.prepare('UPDATE accounts SET password_hash=?,version=version+1,recovery_hash=NULL WHERE user_id=? AND recovery_hash=?').bind(await bcrypt.hash(data.password,12),found.user_id,hash).run();
    return result.meta.changes ? reply({ok:true}) : fail('Код уже использован.',409);
  }
  const account = action === 'login'
    ? await db.prepare('SELECT a.user_id,a.password_hash,a.version,p.name,p.role FROM accounts a JOIN profiles p ON p.id=a.user_id WHERE a.login=?').bind(login).first()
    : await db.prepare('SELECT user_id,password_hash,version FROM accounts WHERE user_id=?').bind(current.id).first();
  if (typeof data.password !== 'string' || !data.password || bcrypt.truncates(data.password)) return fail('Проверьте логин и пароль.',401);
  const matches = await bcrypt.compare(data.password,account?.password_hash || dummyHash);
  if (!account || !matches) return fail('Проверьте логин и пароль.',401);
  if (action === 'recovery-code') {
    const code = randomSecret(16);
    const result = await db.prepare('UPDATE accounts SET recovery_hash=? WHERE user_id=? AND version=?').bind(await digest(code),current.id,account.version).run();
    return result.meta.changes ? reply({code:code.match(/.{4}/g).join('-')}) : fail('Войдите в кабинет ещё раз.',401);
  }
  const fresh = await newSession(db,account.user_id,account.version);
  await fresh.insert.run();
  return reply({profile:profileView(account)},200,fresh.cookie);
}

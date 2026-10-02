'use strict';
// Correzioni della revisione di sicurezza su account e sessioni (S-02…S-17).
require('./helpers/setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
  createTestApp, mailsTo, linkIn, uniqueEmail, registeredAgent, registrationBody, verificationTokenFor, request,
} = require('./helpers/app');

let app;
let ctx;

before(async () => {
  ({ app, ctx } = await createTestApp({ scheduleAccountCleanup: false }));
});

after(async () => {
  await ctx.db.close();
});

function cookieValue(res, name) {
  const all = [].concat(res.headers['set-cookie'] || []);
  const c = all.find((x) => x.startsWith(`${name}=`));
  return c ? c.split(';')[0].slice(name.length + 1) : null;
}

function refreshCookieOf(agent) {
  const cookies = agent.jar.getCookies({ path: '/', domain: '127.0.0.1', secure: false, script: false });
  return cookies.find((c) => c.name === 'refreshToken')?.value || null;
}

// ------------------------------------------------------------ S-03 / S-11: scrypt
test('password: hash scrypt, nessun bcrypt per i nuovi account (S-03)', async () => {
  const passwords = require('../server/lib/passwords');
  const hash = await passwords.hashPassword('Password.Sicura2026');
  assert.match(hash, /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.equal((await passwords.verifyPassword('Password.Sicura2026', hash)).ok, true);
  assert.equal((await passwords.verifyPassword('Password.Sicura2027', hash)).ok, false);
  // oltre i 72 byte conta tutta la password (con bcrypt no)
  const long = `${'A1!'.repeat(30)}x`;
  const longHash = await passwords.hashPassword(long);
  assert.equal((await passwords.verifyPassword(`${'A1!'.repeat(30)}y`, longHash)).ok, false);

  const { userId } = await registeredAgent(app);
  assert.ok(passwords.isScryptHash(ctx.db.findById(userId).password));
});

test('password: i vecchi hash bcrypt vengono convertiti al primo login riuscito (S-03)', async () => {
  const bcrypt = require('bcryptjs');
  const email = uniqueEmail('legacy');
  const password = 'Vecchia.Password2024';
  const user = {
    id: crypto.randomUUID(),
    name: 'Utente Storico',
    email,
    password: await bcrypt.hash(password, 4),
    emailVerified: true,
    createdAt: new Date().toISOString(),
    tokenVersion: 0,
    sessions: [],
    progress: ctx.defaultProgress(),
  };
  await ctx.db.insert(user);

  const wrong = await request(app).post('/api/auth/login').send({ email, password: 'Sbagliata.2024xx' });
  assert.equal(wrong.status, 401);
  assert.match(ctx.db.findById(user.id).password, /^\$2/, 'password sbagliata: hash invariato');

  await request(app).post('/api/auth/login').send({ email, password }).expect(200);
  const stored = ctx.db.findById(user.id).password;
  assert.match(stored, /^scrypt\$/, 'hash convertito in scrypt');
  await request(app).post('/api/auth/login').send({ email, password }).expect(200);
});

test('password: calcoli limitati, coda piena → errore "occupato" (S-03)', async () => {
  const passwords = require('../server/lib/passwords');
  process.env.PASSWORD_HASH_CONCURRENCY = '1';
  process.env.PASSWORD_HASH_QUEUE = '1';
  try {
    const results = await Promise.allSettled([1, 2, 3, 4].map((i) => passwords.hashPassword(`Password.${i}xxxxxx`)));
    const busy = results.filter((r) => r.status === 'rejected');
    assert.ok(busy.length >= 1, 'almeno una richiesta rifiutata');
    assert.ok(busy.every((r) => r.reason.code === 'EVIL_HASH_BUSY'));
    assert.ok(results.some((r) => r.status === 'fulfilled'));
  } finally {
    delete process.env.PASSWORD_HASH_CONCURRENCY;
    delete process.env.PASSWORD_HASH_QUEUE;
  }
  assert.equal(passwords.stats().running, 0);
});

test('password: oltre 200 caratteri rifiutata con messaggio chiaro (S-11)', async () => {
  const long = `Aa1!${'x'.repeat(200)}`;
  const reg = await request(app).post('/api/auth/register').send(registrationBody({ password: long }));
  assert.equal(reg.status, 400);
  assert.match(reg.body.error, /massimo 200 caratteri/);
  const login = await request(app).post('/api/auth/login').send({ email: uniqueEmail(), password: long });
  assert.equal(login.status, 400);
  assert.match(login.body.error, /massimo 200 caratteri/);
});

// ------------------------------------------------------------ S-06
test('registrazione: email esistente e nuova indistinguibili (S-06)', async () => {
  const { email } = await registeredAgent(app);
  const a = await request(app).post('/api/auth/register').send(registrationBody({ email }));
  const b = await request(app).post('/api/auth/register').send(registrationBody({ email: uniqueEmail() }));
  assert.equal(a.status, b.status);
  const strip = (body) => ({ ...body, userId: typeof body.userId, email: typeof body.email });
  assert.deepEqual(strip(a.body), strip(b.body));
  // l'id restituito non è utilizzabile per sapere se l'account esiste
  const status = await request(app).get('/api/auth/verification-status').query({ userId: a.body.userId });
  assert.equal(status.body.status, 'pending');
});

// ------------------------------------------------------------ S-05
test('reset password su account non verificato: l\'indirizzo risulta verificato (S-05)', async () => {
  const email = uniqueEmail();
  const reg = await request(app).post('/api/auth/register').send(registrationBody({ email })).expect(201);
  await request(app).post('/api/auth/forgot-password').send({ email }).expect(200);
  let link = null;
  for (let i = 0; i < 40 && !link; i++) {
    await new Promise((r) => setTimeout(r, 25));
    const mail = mailsTo(email).find((m) => m.includes('reset-password'));
    link = mail && linkIn(mail, 'reset-password');
  }
  const token = new URL(`http://x${link}`).searchParams.get('token');
  await request(app)
    .post('/api/auth/reset-password')
    .send({ token, newPassword: 'NuovaPassword!2026', confirmPassword: 'NuovaPassword!2026' })
    .expect(200);
  assert.equal(ctx.db.findById(reg.body.userId).emailVerified, true);
  await request(app).post('/api/auth/login').send({ email, password: 'NuovaPassword!2026' }).expect(200);
});

// ------------------------------------------------------------ S-10
test('refresh token: ruotato a ogni rinnovo, il vecchio vale solo nella finestra di tolleranza (S-10)', async () => {
  const { createSessionManager } = require('../server/lib/sessions');
  const sessions = createSessionManager({
    store: ctx.db,
    accessSecret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_SECRET_REFRESH,
    graceMs: 150,
  });
  const { userId } = await registeredAgent(app);
  const user = ctx.db.findById(userId);
  const created = await sessions.createSession(user, { userAgent: 'test' });

  const first = await sessions.refresh(created.refreshToken);
  assert.ok(first.user && first.refreshToken, 'nuovo refresh token');
  assert.notEqual(first.refreshToken, created.refreshToken);

  const concurrent = await sessions.refresh(created.refreshToken);
  assert.ok(concurrent.user, 'scheda parallela entro 30 s: accettata');
  assert.equal(concurrent.refreshToken, undefined, 'senza ruotare di nuovo');

  await new Promise((r) => setTimeout(r, 200));
  const reused = await sessions.refresh(created.refreshToken);
  assert.equal(reused.error, 'reused');
  const after = await sessions.refresh(first.refreshToken);
  assert.ok(!after.user, 'il riuso chiude la sessione anche per il token nuovo');
});

test('refresh-token via API: nuovo cookie di sessione a ogni rinnovo (S-10)', async () => {
  const { agent } = await registeredAgent(app);
  const before = refreshCookieOf(agent);
  const res = await request(app).post('/api/auth/refresh-token').set('Cookie', `refreshToken=${before}`).expect(200);
  const rotated = cookieValue(res, 'refreshToken');
  assert.ok(rotated && rotated !== before);
  await request(app).post('/api/auth/refresh-token').set('Cookie', `refreshToken=${rotated}`).expect(200);
});

test('POST /api/auth/sessions/revoke-all: chiude le altre sessioni o tutte (S-10)', async () => {
  const { agent, email, password } = await registeredAgent(app);
  const other = request.agent(app);
  await other.post('/api/auth/login').send({ email, password }).expect(200);
  await other.get('/api/auth/profile').expect(200);

  const keep = await agent.post('/api/auth/sessions/revoke-all').send({ keepCurrent: true }).expect(200);
  assert.equal(keep.body.keptCurrent, true);
  assert.equal(keep.body.revoked, 1);
  await agent.get('/api/auth/profile').expect(200);
  assert.equal((await other.get('/api/auth/profile')).status, 401, 'l\'altro dispositivo è fuori');

  const all = await agent.post('/api/auth/sessions/revoke-all').send({}).expect(200);
  assert.equal(all.body.keptCurrent, false);
  assert.equal((await agent.get('/api/auth/profile')).status, 401);
  assert.equal((await request(app).post('/api/auth/sessions/revoke-all').send({})).status, 401, 'serve una sessione');
});

// ------------------------------------------------------------ S-15
test('GET /api/auth/account/export: dati personali senza segreti (S-15)', async () => {
  const { agent, email } = await registeredAgent(app);
  const res = await agent.get('/api/auth/account/export').expect(200);
  assert.match(res.headers['content-disposition'], /attachment/);
  const body = JSON.parse(res.text);
  assert.equal(body.account.email, email);
  assert.ok(body.account.acceptedTermsAt);
  assert.ok(Array.isArray(body.account.sessions) && body.account.sessions.length === 1);
  assert.equal(body.account.sessions[0].current, true);
  const text = JSON.stringify(body);
  assert.doesNotMatch(text, /scrypt\$|"password"|"hash"|prevHash|TokenHash|tokenVersion/);
  assert.equal((await request(app).get('/api/auth/account/export')).status, 401);
});

test('DELETE /api/auth/account: password obbligatoria, poi utente, sessioni e progressi cancellati (S-15)', async () => {
  const { agent, email, password, userId } = await registeredAgent(app);
  await agent.post('/api/progress/save').send({ achievements: [] });

  const bad = await agent.delete('/api/auth/account').send({ password: 'Sbagliata.2026xx' });
  assert.equal(bad.status, 401);
  assert.equal(bad.body.code, 'INVALID_PASSWORD');
  assert.ok(ctx.db.findById(userId));

  const ok = await agent.delete('/api/auth/account').send({ password }).expect(200);
  assert.equal(ok.body.code, 'ACCOUNT_DELETED');
  assert.equal(ctx.db.findById(userId), null);
  assert.equal(ctx.db.findByEmail(email), null);
  assert.equal((await agent.get('/api/auth/profile')).status, 401);
  assert.equal((await request(app).post('/api/auth/login').send({ email, password })).status, 401);
});

test('DELETE /api/auth/account senza password: solo subito dopo il login (S-15)', async () => {
  const { agent, userId } = await registeredAgent(app);
  const user = ctx.db.findById(userId);
  user.sessions[0].createdAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = await agent.delete('/api/auth/account').send({});
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'REAUTH_REQUIRED');
  user.sessions[0].createdAt = new Date().toISOString();
  await agent.delete('/api/auth/account').send({}).expect(200);
});

// ------------------------------------------------------------ lingua
test('messaggi delle API in inglese con X-EVIL-Lang: en', async () => {
  const wrong = await request(app)
    .post('/api/auth/login')
    .set('X-EVIL-Lang', 'en')
    .send({ email: uniqueEmail(), password: 'Sbagliata.2026xx' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, 'Incorrect email or password.');

  const weak = await request(app).post('/api/auth/register').set('X-EVIL-Lang', 'en').send(registrationBody({ password: 'corta' }));
  assert.equal(weak.body.error, 'The password must be at least 12 characters long.');

  const terms = registrationBody();
  delete terms.acceptedTerms;
  const noTerms = await request(app).post('/api/auth/register').set('X-EVIL-Lang', 'en').send(terms);
  assert.equal(noTerms.body.error, 'To sign up you must accept the terms of use and the privacy notice.');

  const noSession = await request(app).get('/api/auth/profile').set('X-EVIL-Lang', 'en');
  assert.equal(noSession.body.error, 'Sign in to continue.');

  const notFound = await request(app).get('/api/nessuna-route').set('X-EVIL-Lang', 'en');
  assert.equal(notFound.body.error, 'Resource not found.');

  const it = await request(app).post('/api/auth/login').send({ email: uniqueEmail(), password: 'Sbagliata.2026xx' });
  assert.equal(it.body.error, 'Email o password non corretti.');
});

test('registrazione in inglese: lingua salvata, email e link in inglese', async () => {
  const email = uniqueEmail('english');
  const password = 'Password.Sicura2026';
  const res = await request(app)
    .post('/api/auth/register')
    .set('X-EVIL-Lang', 'en')
    .send(registrationBody({ name: 'Jane Smith', email, password }))
    .expect(201);
  assert.match(res.body.message, /Check your inbox/);
  assert.equal(ctx.db.findById(res.body.userId).lang, 'en');
  const mail = mailsTo(email).pop();
  assert.match(mail, /Confirm your email/);
  assert.match(linkIn(mail, 'verify-email'), /^\/en\/verify-email\.html#token=/);

  const verified = await request(app).post('/api/auth/verify').set('X-EVIL-Lang', 'en').send({ token: verificationTokenFor(email) });
  assert.equal(verified.body.message, 'Address confirmed: you can now sign in with your email and password.');

  // email successive nella lingua dell'account, anche da una richiesta in italiano
  await request(app).post('/api/auth/register').send(registrationBody({ email, password }));
  assert.match(mailsTo(email).pop(), /You already have an EVIL account/);
});

// ------------------------------------------------------------ S-09
test('ritardo progressivo dopo errori ripetuti sulla stessa email (S-09)', async () => {
  const { createLoginDelay } = require('../middleware/limiter');
  const d = createLoginDelay({ after: 2, baseMs: 10, maxMs: 40 });
  const email = 'chi@example.com';
  assert.equal(d.delayFor(email), 0);
  d.fail(email);
  d.fail(email);
  assert.equal(d.delayFor(email), 10);
  d.fail(email);
  assert.equal(d.delayFor(email), 20);
  for (let i = 0; i < 5; i++) d.fail(email);
  assert.equal(d.delayFor(email), 40, 'tetto massimo');
  assert.equal(d.delayFor('Chi@Example.com '), 40, 'stessa email con maiuscole e spazi');
  assert.equal(d.delayFor('altro@example.com'), 0);
  d.reset(email);
  assert.equal(d.delayFor(email), 0);
});

test('limite per account: tentativi falliti da IP diversi contano insieme (S-09)', async () => {
  const limiter = require('../middleware/limiter');
  assert.equal(typeof limiter.accountLoginLimiter, 'function');
  const { emailKey, emailHash } = limiter._internals;
  const key = (ip) => `acct:${emailHash(emailKey({ body: { email: ' Vittima@Example.com ' }, ip }))}`;
  assert.equal(key('1.1.1.1'), key('2.2.2.2'), 'la chiave non dipende dall\'IP');
  assert.doesNotMatch(key('1.1.1.1'), /vittima/i, 'nella chiave c\'è un hash, non l\'email');
});

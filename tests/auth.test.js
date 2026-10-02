'use strict';
require('./helpers/setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const {
  createTestApp, mailsTo, linkIn, uniqueEmail, registeredAgent, registrationBody, verificationTokenFor, request,
} = require('./helpers/app');

let app;
let ctx;

before(async () => {
  ({ app, ctx } = await createTestApp());
});

after(async () => {
  await ctx.db.close();
});

test('registrazione: password debole rifiutata con messaggio in italiano', async () => {
  const email = uniqueEmail();
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Anna Verdi', email, password: 'corta', confirmPassword: 'corta', acceptedTerms: true });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /almeno 12 caratteri/);
});

test('registrazione: nomi accentati e con apostrofo accettati (UX-04)', async () => {
  for (const name of ['Nicolò Bianchi', "Chloé D'Alò", 'José Álvarez']) {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/register')
      .send(registrationBody({ name, email }));
    assert.equal(res.status, 201, `${name}: ${JSON.stringify(res.body)}`);
  }
});

test('registrazione: email già usata → stessa risposta 201 e avviso al proprietario (S-06)', async () => {
  const { email, userId } = await registeredAgent(app);
  const fresh = await request(app).post('/api/auth/register').send(registrationBody({ email: uniqueEmail() }));
  const res = await request(app).post('/api/auth/register').send(registrationBody({ name: 'Altro Nome', email }));
  assert.equal(res.status, 201);
  assert.deepEqual(Object.keys(res.body).sort(), Object.keys(fresh.body).sort(), 'stessi campi di una registrazione nuova');
  assert.notEqual(res.body.userId, userId, 'l\'id dell\'account esistente non esce');
  const mails = mailsTo(email);
  assert.match(mails[mails.length - 1], /Hai già un account/);
  // il vecchio account non cambia: la password originale funziona ancora
  const login = await request(app).post('/api/auth/login').send({ email, password: 'Password.Sicura2026' });
  assert.equal(login.status, 200);
});

test('registrazione: acceptedTerms obbligatorio, data di accettazione salvata (S-15)', async () => {
  const email = uniqueEmail();
  const body = registrationBody({ email });
  delete body.acceptedTerms;
  const res = await request(app).post('/api/auth/register').send(body);
  assert.equal(res.status, 400);
  assert.match(res.body.error, /termini/);
  const ok = await request(app).post('/api/auth/register').send({ ...body, acceptedTerms: true }).expect(201);
  const user = ctx.db.findById(ok.body.userId);
  assert.ok(Date.parse(user.acceptedTermsAt), 'data di accettazione');
  assert.equal(user.lang, 'it');
});

test('verifica email: il link non fa accedere, serve POST /api/auth/verify (S-05)', async () => {
  const agent = request.agent(app);
  const email = uniqueEmail();
  const password = 'Password.Sicura2026';
  await agent.post('/api/auth/register').send(registrationBody({ name: 'Marco Rossi', email, password })).expect(201);

  const blocked = await agent.post('/api/auth/login').send({ email, password });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.requiresVerification, true);

  const link = linkIn(mailsTo(email).pop(), 'verify-email');
  assert.match(link, /^\/verify-email\.html#token=[a-f0-9]{64}$/, 'il link porta alla pagina, token nel frammento');
  const token = verificationTokenFor(email);

  // vecchio formato GET: solo redirect alla pagina, nessun cookie e nessuna attivazione
  const legacy = await agent.get(`/api/auth/verify-email?token=${token}`).expect(302);
  assert.equal(legacy.headers['set-cookie'], undefined);
  assert.match(legacy.headers.location, /verify-email\.html#token=/);
  assert.equal(ctx.db.findByEmail(email).emailVerified, false);

  const res = await agent.post('/api/auth/verify').send({ token }).expect(200);
  assert.equal(res.body.code, 'EMAIL_VERIFIED');
  assert.equal(res.headers['set-cookie'], undefined, 'nessun login automatico');
  const session = await agent.get('/api/auth/session').expect(200);
  assert.equal(session.body.authenticated, false);

  const again = await agent.post('/api/auth/verify').send({ token });
  assert.equal(again.status, 400, 'token monouso');
  assert.equal((await agent.post('/api/auth/verify').send({})).status, 400);

  const login = await agent.post('/api/auth/login').send({ email, password }).expect(200);
  assert.equal(login.body.user.emailVerified, true);

  const wrong = await request(app).post('/api/auth/login').send({ email, password: 'Sbagliata.2026x' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, 'Email o password non corretti.');
});

test('registrazione ripetuta su email non verificata: password e token sostituiti (S-05)', async () => {
  const email = uniqueEmail();
  await request(app).post('/api/auth/register').send(registrationBody({ email, password: 'Primo.Tentativo2026' })).expect(201);
  const firstToken = verificationTokenFor(email);
  await request(app).post('/api/auth/register').send(registrationBody({ email, password: 'Secondo.Tentativo2026' })).expect(201);
  const secondToken = verificationTokenFor(email);
  assert.notEqual(firstToken, secondToken);
  assert.equal((await request(app).post('/api/auth/verify').send({ token: firstToken })).status, 400, 'il primo token non vale più');
  await request(app).post('/api/auth/verify').send({ token: secondToken }).expect(200);
  assert.equal((await request(app).post('/api/auth/login').send({ email, password: 'Primo.Tentativo2026' })).status, 401);
  await request(app).post('/api/auth/login').send({ email, password: 'Secondo.Tentativo2026' }).expect(200);
});

test('account non verificati scaduti vengono cancellati (S-05)', async () => {
  const { purgeExpiredUnverified } = require('../server/lib/account-cleanup');
  const email = uniqueEmail();
  const res = await request(app).post('/api/auth/register').send(registrationBody({ email })).expect(201);
  const user = ctx.db.findById(res.body.userId);
  const { email: verifiedEmail } = await registeredAgent(app);
  user.registeredAt = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
  const removed = await purgeExpiredUnverified(ctx.db);
  assert.ok(removed >= 1);
  assert.equal(ctx.db.findByEmail(email), null);
  assert.ok(ctx.db.findByEmail(verifiedEmail), 'gli account verificati restano');
});

test('profilo: dati completi dal server (UX-03)', async () => {
  const { agent } = await registeredAgent(app);
  const res = await agent.get('/api/auth/profile').expect(200);
  assert.equal(res.body.user.emailVerified, true);
  assert.ok(res.body.user.createdAt);
  assert.equal(res.body.user.activeSessions, 1);
  assert.equal(res.body.user.password, undefined, 'l\'hash della password non deve uscire');
});

test('sessione: l\'accesso scaduto si rinnova da solo con il cookie di sessione', async () => {
  const { agent } = await registeredAgent(app);
  // senza access token (come dopo un'ora): resta solo il refresh token
  const cookies = agent.jar.getCookies({ path: '/', domain: '127.0.0.1', secure: false, script: false });
  const refresh = cookies.find((c) => c.name === 'refreshToken');
  assert.ok(refresh, 'cookie di sessione presente');
  const res = await request(app).get('/api/auth/profile').set('Cookie', `refreshToken=${refresh.value}`);
  assert.equal(res.status, 200);
  assert.ok(String(res.headers['set-cookie']).includes('accessToken='), 'nuovo access token nella risposta');
});

test('reset password: chiude tutte le sessioni aperte (EVL-07)', async () => {
  const { agent, email } = await registeredAgent(app);
  await agent.get('/api/auth/profile').expect(200);

  await request(app).post('/api/auth/forgot-password').send({ email }).expect(200);
  // la risposta parte prima dell'invio: si aspetta l'email
  let link = null;
  for (let i = 0; i < 40 && !link; i++) {
    await new Promise((r) => setTimeout(r, 25));
    const mail = mailsTo(email).find((m) => m.includes('reset-password'));
    link = mail && linkIn(mail, 'reset-password');
  }
  assert.ok(link, 'email di reset ricevuta');
  const token = new URL(`http://x${link}`).searchParams.get('token');
  await request(app)
    .post('/api/auth/reset-password')
    .send({ token, newPassword: 'NuovaPassword!2026', confirmPassword: 'NuovaPassword!2026' })
    .expect(200);

  const old = await agent.get('/api/auth/profile');
  assert.equal(old.status, 401, 'la vecchia sessione non vale più');
  const reuse = await request(app)
    .post('/api/auth/reset-password')
    .send({ token, newPassword: 'AltraPassword!2026', confirmPassword: 'AltraPassword!2026' });
  assert.equal(reuse.status, 403, 'il link di reset vale una volta sola');
});

test('password dimenticata: stessa risposta per email esistenti e inesistenti', async () => {
  const { email } = await registeredAgent(app);
  const a = await request(app).post('/api/auth/forgot-password').send({ email });
  const b = await request(app).post('/api/auth/forgot-password').send({ email: uniqueEmail('nessuno') });
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, b.body);
});

test('login: 5 errori non bloccano l\'account del proprietario (EVL-06)', async () => {
  const { email, password } = await registeredAgent(app);
  for (let i = 0; i < 6; i++) {
    await request(app).post('/api/auth/login').send({ email, password: `Sbagliata.${i}xx2026` });
  }
  const ok = await request(app).post('/api/auth/login').send({ email, password });
  assert.equal(ok.status, 200);
});

test('logout: la sessione viene chiusa anche lato server', async () => {
  const { agent } = await registeredAgent(app);
  const cookies = agent.jar.getCookies({ path: '/', domain: '127.0.0.1', secure: false, script: false });
  const refresh = cookies.find((c) => c.name === 'refreshToken').value;
  await agent.post('/api/auth/logout').expect(200);
  const reuse = await request(app).post('/api/auth/refresh-token').set('Cookie', `refreshToken=${refresh}`);
  assert.equal(reuse.status, 401);
});

test('endpoint legacy rimossi (EVL-15)', async () => {
  const res = await request(app).post('/api/auth/confirm-email').send({});
  assert.equal(res.status, 404);
});

'use strict';
require('./helpers/setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, mailsTo, linkIn, uniqueEmail, registeredAgent, request } = require('./helpers/app');

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
    .send({ name: 'Anna Verdi', email, password: 'corta', confirmPassword: 'corta' });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /almeno 12 caratteri/);
});

test('registrazione: nomi accentati e con apostrofo accettati (UX-04)', async () => {
  for (const name of ['Nicolò Bianchi', "Chloé D'Alò", 'José Álvarez']) {
    const email = uniqueEmail();
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name, email, password: 'Password.Sicura2026', confirmPassword: 'Password.Sicura2026' });
    assert.equal(res.status, 201, `${name}: ${JSON.stringify(res.body)}`);
  }
});

test('registrazione: email già usata → 409', async () => {
  const { email } = await registeredAgent(app);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Altro Nome', email, password: 'Password.Sicura2026', confirmPassword: 'Password.Sicura2026' });
  assert.equal(res.status, 409);
});

test('login: bloccato finché l\'email non è verificata, poi funziona', async () => {
  const agent = request.agent(app);
  const email = uniqueEmail();
  const password = 'Password.Sicura2026';
  await agent.post('/api/auth/register').send({ name: 'Marco Rossi', email, password, confirmPassword: password }).expect(201);

  const blocked = await agent.post('/api/auth/login').send({ email, password });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.requiresVerification, true);

  await agent.get(linkIn(mailsTo(email).pop(), 'verify-email')).expect(302);
  const session = await agent.get('/api/auth/session').expect(200);
  assert.equal(session.body.authenticated, true);
  assert.equal(session.body.user.emailVerified, true);

  const wrong = await request(app).post('/api/auth/login').send({ email, password: 'Sbagliata.2026x' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, 'Email o password non corretti.');
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

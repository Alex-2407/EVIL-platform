'use strict';
require('./helpers/setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, request } = require('./helpers/app');

let app;
let ctx;

before(async () => {
  ({ app, ctx } = await createTestApp());
});

after(async () => {
  await ctx.db.close();
});

test('header di sicurezza su pagine HTML, statici e API (EVL-03)', async () => {
  for (const url of ['/', '/login.html', '/html/help.html', '/css/style.css', '/js/evil-site-chrome.js', '/api/auth/session']) {
    const res = await request(app).get(url);
    assert.equal(res.status, 200, url);
    assert.ok(res.headers['content-security-policy'], `CSP su ${url}`);
    assert.equal(res.headers['x-frame-options'], 'DENY', url);
    assert.equal(res.headers['x-content-type-options'], 'nosniff', url);
    assert.equal(res.headers['x-powered-by'], undefined, url);
  }
  const csp = (await request(app).get('/')).headers['content-security-policy'];
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
});

test('CORS: richieste da un altro sito respinte con 403 (EVL-10)', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', 'https://sito-malevolo.example')
    .send({ email: 'a@example.com', password: 'x' });
  assert.equal(res.status, 403);
  assert.equal(res.body.code, 'CORS_FORBIDDEN');

  const same = await request(app).get('/api/auth/session').set('Origin', 'http://localhost:5000');
  assert.equal(same.status, 200);
  assert.equal(same.headers['access-control-allow-origin'], 'http://localhost:5000');
});

test('fuori da NODE_ENV=development niente route di debug (EVL-10)', async () => {
  const res = await request(app).get('/__debug/files');
  assert.equal(res.status, 404);
});

test('errori: 404 e JSON malformato senza stack né dettagli interni', async () => {
  const missing = await request(app).get('/api/non-esiste');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'NOT_FOUND');

  const broken = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email": ');
  assert.equal(broken.status, 400);
  assert.equal(broken.body.stack, undefined);
  assert.match(broken.body.error, /JSON/);
});

test('strumenti: senza login rispondono 401', async () => {
  for (const url of ['/api/scan', '/api/vulnerability-scan', '/api/dns-enum', '/api/ssl-analyzer']) {
    const res = await request(app).post(url).send({ url: 'https://example.com', domain: 'example.com' });
    assert.equal(res.status, 401, url);
  }
});

test('diagnostica email nascosta in produzione senza DIAGNOSTICS_TOKEN', async () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.equal((await request(app).get('/api/health/smtp')).status, 404);
    assert.equal((await request(app).get('/api/health/smtp?key=sbagliata')).status, 404);
  } finally {
    process.env.NODE_ENV = prev;
  }
});

test('health check pubblico e leggero', async () => {
  const res = await request(app).get('/api/health').expect(200);
  assert.equal(res.body.status, 'ok');
});

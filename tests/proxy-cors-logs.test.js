'use strict';
// S-02 (trust proxy), S-07 (CORS localhost), S-14 (dati personali nei log), S-17 (isProduction).
require('./helpers/setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test('TRUST_PROXY: disattivato per default anche in produzione (S-02)', () => {
  const { parseTrustProxy } = require('../utils/trust-proxy');
  const env = require('../utils/env');
  withEnv({ NODE_ENV: 'production', TRUST_PROXY: undefined }, () => {
    assert.equal(parseTrustProxy().value, false);
    assert.equal(env.trustProxy(), false);
  });
  assert.equal(parseTrustProxy('0').value, false);
  assert.equal(parseTrustProxy('1').value, 1);
  assert.equal(parseTrustProxy('2').value, 2);
  assert.equal(parseTrustProxy('true').value, 1, 'mai "fidati di tutti"');
  assert.deepEqual(parseTrustProxy('10.0.0.0/8, 192.168.1.10,loopback').value, ['10.0.0.0/8', '192.168.1.10', 'loopback']);
  assert.equal(parseTrustProxy('99').value, false);
  assert.ok(parseTrustProxy('99').error);
  assert.ok(parseTrustProxy('non-un-ip').error);
});

test('TRUST_PROXY: X-Forwarded-For letto solo dai proxy dichiarati (S-02)', () => {
  const { clientIpFromRequest } = require('../utils/trust-proxy');
  const req = (remote, xff) => ({ headers: xff ? { 'x-forwarded-for': xff } : {}, socket: { remoteAddress: remote } });
  withEnv({ TRUST_PROXY: undefined }, () => {
    assert.equal(clientIpFromRequest(req('10.0.0.5', '6.6.6.6')), '10.0.0.5');
  });
  withEnv({ TRUST_PROXY: '1' }, () => {
    // il client può aggiungere voci a sinistra: conta quella scritta dal proxy (l'ultima)
    assert.equal(clientIpFromRequest(req('10.0.0.5', '6.6.6.6, 203.0.113.7')), '203.0.113.7');
  });
  withEnv({ TRUST_PROXY: '10.0.0.0/8' }, () => {
    assert.equal(clientIpFromRequest(req('10.0.0.5', '203.0.113.7')), '203.0.113.7');
    assert.equal(clientIpFromRequest(req('198.51.100.1', '203.0.113.7')), '198.51.100.1', 'proxy non fidato: header ignorato');
  });
});

test('Express: trust proxy configurato da TRUST_PROXY (S-02)', async () => {
  const { createTestApp, request } = require('./helpers/app');
  process.env.TRUST_PROXY = '1';
  try {
    const { app: proxied, ctx: proxiedCtx } = await createTestApp({ scheduleAccountCleanup: false });
    assert.equal(proxied.get('trust proxy'), 1);
    await proxiedCtx.db.close();
  } finally {
    process.env.TRUST_PROXY = '0';
  }
  const { app, ctx } = await createTestApp({ scheduleAccountCleanup: false });
  assert.equal(app.get('trust proxy'), false);
  await request(app).get('/api/health').expect(200);
  await ctx.db.close();
});

test('CORS: localhost ammesso solo in sviluppo (S-07)', () => {
  const { allowedOrigins, isOriginAllowed } = require('../server/lib/origins');
  withEnv({ NODE_ENV: 'production', CORS_ORIGINS: undefined, BASE_URL: 'https://www.projectevil.it' }, () => {
    assert.equal(isOriginAllowed('http://localhost:5000', 'www.projectevil.it'), false);
    assert.equal(isOriginAllowed('http://127.0.0.1:5000', 'www.projectevil.it'), false);
    assert.equal(isOriginAllowed('https://www.projectevil.it', 'www.projectevil.it'), true);
  });
  withEnv({ NODE_ENV: 'production', CORS_ORIGINS: 'https://projectevil.it,http://localhost:3000' }, () => {
    assert.ok(!allowedOrigins().has('http://localhost:3000'), 'ignorato anche se configurato');
  });
  withEnv({ NODE_ENV: 'development', CORS_ORIGINS: undefined }, () => {
    assert.ok(allowedOrigins().has('http://localhost:5000'));
  });
});

test('log: email mascherate, token tolti dagli URL (S-14)', () => {
  const { maskEmail, maskUrlSecrets, maskDetails } = require('../utils/mask');
  assert.equal(maskEmail('giulia.neri@example.com'), 'gi***@example.com');
  assert.equal(maskEmail('a@b.it'), 'a***@b.it');
  assert.equal(maskEmail('niente'), '***');
  assert.equal(maskUrlSecrets('/api/auth/verify-email?token=abc123&x=1'), '/api/auth/verify-email?token=***&x=1');
  assert.equal(maskUrlSecrets('/reset-password.html?resetToken=zzz'), '/reset-password.html?resetToken=***');
  assert.deepEqual(maskDetails({ userId: 'u1', email: 'mario.rossi@example.com' }), { userId: 'u1', email: 'ma***@example.com' });
});

test('HTTPS e CSP usano isProduction(), non NODE_ENV alla lettera (S-17)', () => {
  const { shouldEnforceHttps } = require('../middleware/https-enforce');
  withEnv({ NODE_ENV: 'prod', FORCE_HTTPS: undefined, BASE_URL: undefined }, () => {
    assert.equal(shouldEnforceHttps(), true, 'NODE_ENV scritto male vale come produzione');
  });
  withEnv({ NODE_ENV: 'development', FORCE_HTTPS: undefined, BASE_URL: undefined }, () => {
    assert.equal(shouldEnforceHttps(), false);
  });
});

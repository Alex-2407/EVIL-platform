'use strict';
require('./helpers/setup');
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const safeHttp = require('../server/lib/safe-http');

const { defaultIsPublicAddress, assertUrlAllowed, assertPublicDestination, isBlockedError, configureForTests, resetForTests } = safeHttp;

test('indirizzi privati, loopback, link-local e metadata non sono pubblici (EVL-13)', () => {
  const blocked = [
    '127.0.0.1', '10.0.0.5', '172.16.3.4', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
    '224.0.0.1', '255.255.255.255', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1',
    '64:ff9b::7f00:1', '2002:7f00:1::1',
  ];
  for (const ip of blocked) assert.equal(defaultIsPublicAddress(ip), false, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(defaultIsPublicAddress(ip), true, ip);
});

test('URL: porte e nomi riservati rifiutati prima di connettersi', () => {
  assert.throws(() => assertUrlAllowed('http://localhost/'), isBlockedError);
  assert.throws(() => assertUrlAllowed('http://metadata.google.internal/'), isBlockedError);
  assert.throws(() => assertUrlAllowed('http://example.com:22/'), isBlockedError);
  assert.throws(() => assertUrlAllowed('ftp://example.com/'), isBlockedError);
  assert.throws(() => assertUrlAllowed('http://127.0.0.1/'), isBlockedError);
  assert.doesNotThrow(() => assertUrlAllowed('https://example.com/'));
  assert.doesNotThrow(() => assertUrlAllowed('http://example.com:8080/'));
});

test('DNS che punta a un IP privato: bloccato', async () => {
  configureForTests({ lookup: (host, opts, cb) => cb(null, [{ address: '10.1.2.3', family: 4 }]) });
  await assert.rejects(() => assertPublicDestination('https://interno.example/'), isBlockedError);
});

afterEach(() => resetForTests());

// Redirect verso la rete interna: il server "pubblico" (127.0.0.1, considerato pubblico
// solo in questo test) risponde 302 verso 127.0.0.2, che resta privato.
let publicServer;
let privateServer;
let privateHits = 0;

before(async () => {
  privateServer = http.createServer((req, res) => {
    privateHits += 1;
    res.end('segreto');
  });
  await new Promise((r) => privateServer.listen(0, '127.0.0.2', r));
  const privatePort = privateServer.address().port;
  publicServer = http.createServer((req, res) => {
    res.writeHead(302, { Location: `http://127.0.0.2:${privatePort}/admin` });
    res.end();
  });
  await new Promise((r) => publicServer.listen(0, '127.0.0.1', r));
});

after(() => {
  publicServer.close();
  privateServer.close();
});

test('redirect verso un IP privato bloccato, il server interno non riceve nulla (EVL-02)', async () => {
  const publicPort = publicServer.address().port;
  const privatePort = privateServer.address().port;
  configureForTests({
    isPublicAddress: (ip) => ip === '127.0.0.1',
    allowedPorts: new Set([publicPort, privatePort]),
  });
  await assert.rejects(() => safeHttp.axios.get(`http://127.0.0.1:${publicPort}/`), isBlockedError);
  assert.equal(privateHits, 0);
});

test('senza configurazione di test anche il loopback è bloccato a livello di connessione', async () => {
  const publicPort = publicServer.address().port;
  configureForTests({ allowedPorts: new Set([publicPort]) });
  await assert.rejects(() => safeHttp.axios.get(`http://127.0.0.1:${publicPort}/`), isBlockedError);
});

test('configureForTests rifiuta di funzionare fuori dai test', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    assert.throws(() => configureForTests({ isPublicAddress: () => true }));
  } finally {
    process.env.NODE_ENV = prev;
  }
});

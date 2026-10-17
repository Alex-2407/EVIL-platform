'use strict';
require('./helpers/setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createTestApp, request } = require('./helpers/app');
const { versionAssetUrls, fileVersion, root } = require('../server/pages');
const path = require('path');

let app;
let ctx;
before(async () => {
  ({ app, ctx } = await createTestApp());
});
after(async () => {
  await ctx.db.close();
});

test('gli asset nelle pagine ricevono la versione dal contenuto', () => {
  const html = '<link rel="stylesheet" href="/css/style.css?v=vecchia"><script src="/js/evil-site-chrome.js"></script><a href="/css/nonesiste.css">';
  const out = versionAssetUrls(html);
  const v = fileVersion(path.join(root, 'css', 'style.css'));
  assert.match(v, /^[0-9a-f]{10}$/);
  assert.ok(out.includes(`/css/style.css?v=${v}`));
  assert.match(out, /\/js\/evil-site-chrome\.js\?v=[0-9a-f]{10}/);
  assert.ok(out.includes('href="/css/nonesiste.css"'), 'i file inesistenti restano com\'erano');
});

test('cache: un anno con la versione giusta, rivalidazione senza', async () => {
  const page = await request(app).get('/').expect(200);
  const href = page.text.match(/href="(\/css\/style\.css\?v=[0-9a-f]+)"/)[1];
  const versioned = await request(app).get(href).expect(200);
  assert.match(versioned.headers['cache-control'], /immutable/);
  const plain = await request(app).get('/css/style.css').expect(200);
  assert.equal(plain.headers['cache-control'], 'no-cache');
  await request(app).get('/css/style.css').set('If-None-Match', plain.headers.etag).expect(304);
  assert.equal(page.headers['cache-control'], 'no-cache');
});

test('home: un solo foglio di stile della home, niente CSS della vecchia home', async () => {
  const page = await request(app).get('/').expect(200);
  assert.equal((page.text.match(/home-v7\.css/g) || []).length, 1);
  assert.equal((page.text.match(/home-footer\.css/g) || []).length, 0);
  assert.equal((page.text.match(/home\.bundle\.css/g) || []).length, 0);
  assert.doesNotMatch(page.text, /Gli attacchi non si temono/);
});

test('ogni pagina carica responsive.css (menù mobile), anche se non lo dichiara', async () => {
  const fs = require('fs');
  const path = require('path');
  const files = fs
    .readdirSync(path.join(__dirname, '..', 'html'))
    .filter((f) => f.endsWith('.html') && !/preview-local/.test(f));
  for (const f of files) {
    const res = await request(app).get(`/${f}`);
    if (res.status !== 200) continue;
    assert.match(res.text, /\/css\/responsive\.css/, `${f} senza responsive.css`);
  }
});

test('home: i numeri in pagina sono quelli calcolati dai dati', async () => {
  const { computeStats } = require('../server/stats');
  const stats = computeStats();
  for (const lang of ['', '/en']) {
    const page = await request(app).get(`${lang}/`).expect(200);
    for (const key of ['labs', 'quizQuestions', 'malwareFamilies', 'breaches']) {
      assert.ok(Number.isFinite(stats[key]), `${key} calcolato`);
      assert.match(page.text, new RegExp(`data-stat="${key}">${stats[key]}<`), `${lang || 'it'}: ${key}`);
    }
    assert.match(page.text, /data-stat="area:impara">\d+</, `${lang || 'it'}: pagine per area`);
  }
});

test('robots.txt indica la sitemap sul dominio canonico e security.txt è raggiungibile', async () => {
  const prev = process.env.BASE_URL;
  process.env.BASE_URL = 'https://esempio.test';
  try {
    const robots = await request(app).get('/robots.txt').expect(200);
    assert.match(robots.text, /^Sitemap: https:\/\/esempio\.test\/sitemap\.xml$/m);
    assert.equal((robots.text.match(/^Sitemap:/gim) || []).length, 1, 'una sola riga Sitemap');
    assert.match(robots.text, /Disallow: \/api\//);
    const sec = await request(app).get('/.well-known/security.txt').expect(200);
    assert.match(sec.headers['content-type'], /text\/plain/);
    assert.match(sec.text, /^Contact: mailto:\S+@\S+$/m);
    assert.match(sec.text, /^Expires: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/m);
    assert.match(sec.text, /^Canonical: https:\/\/esempio\.test\/\.well-known\/security\.txt$/m);
  } finally {
    if (prev === undefined) delete process.env.BASE_URL;
    else process.env.BASE_URL = prev;
  }
});

test('robots.txt, sitemap.xml e favicon nella radice (UX-07)', async () => {
  const robots = await request(app).get('/robots.txt').expect(200);
  assert.match(robots.text, /Sitemap: /);
  const sitemap = await request(app).get('/sitemap.xml').expect(200);
  assert.match(sitemap.headers['content-type'], /xml/);
  const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  assert.ok(locs.includes('/quiz-hub.html'));
  assert.ok(!locs.includes('/register.html'));
  for (const p of locs) {
    const res = await request(app).get(p);
    assert.equal(res.status, 200, `la sitemap elenca solo pagine esistenti: ${p}`);
  }
  await request(app).get('/favicon.ico').expect(200).expect('Content-Type', /icon/);
});

test('ogni pagina ha descrizione, anteprima Open Graph e canonical propria', async () => {
  for (const p of ['/crypto-studio.html', '/virtual-lab.html', '/web-simulator.html', '/login.html']) {
    const res = await request(app).get(p).expect(200);
    assert.match(res.text, /<meta name="description" content="[^"]{20,}"/, p);
    assert.match(res.text, /property="og:image"/, p);
    assert.match(res.text, new RegExp(`rel="canonical" href="[^"]*${p.replace('.', '\\.')}"`), p);
  }
});

test('pagina inesistente: 404 in JSON', async () => {
  const res = await request(app).get('/pagina-che-non-esiste.html');
  assert.equal(res.status, 404);
});

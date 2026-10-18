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

test('Aiuto: la pagina mostra numeri, contatti verificati e il pulsante Esci subito', async () => {
  const res = await request(app).get('/aiuto.html').expect(200);
  const html = res.text;
  assert.match(html, /<body class="evil-theme pt-page/);
  assert.match(html, /\/css\/per-tutti\.css/);
  assert.match(html, /\/js\/per-tutti\.js/);
  assert.match(html, /class="pt-help-numbers"/);
  assert.match(html, /href="tel:112"/);
  assert.match(html, /data-contact="telefono-azzurro-19696"/);
  assert.match(html, /verificato il 18 ottobre 2026/);
  assert.match(html, /data-pt-exit="https:\/\/www\.google\.com\/search\?q=meteo"/);
  assert.doesNotMatch(html, /<!--evil:fragment:/, 'nessun segnaposto rimasto');
  assert.doesNotMatch(html, /progress-manager\.js/, 'niente trofei nella pagina di aiuto');
  // quattro pannelli, uno per chi legge
  for (const id of ['a-me', 'ho-visto', 'genitori', 'docenti']) assert.match(html, new RegExp(`id="${id}" role="tabpanel"`));
});

test('Aiuto in inglese: testi tradotti e contatti nella lingua della pagina', async () => {
  const res = await request(app).get('/en/aiuto.html').expect(200);
  assert.match(res.text, /<html lang="en"/);
  assert.match(res.text, /It can be stopped/);
  assert.match(res.text, /checked on 18 October 2026/);
  assert.match(res.text, /Exit this page/);
  assert.doesNotMatch(res.text, /Qualcosa online ti fa stare male/);
});

test('menu: l’area "Per tutti" è la prima e porta ad Aiuto subito', async () => {
  const res = await request(app).get('/').expect(200);
  const header = res.text.slice(res.text.indexOf('<header'), res.text.indexOf('</header>'));
  const perTutti = header.indexOf('Per tutti');
  assert.ok(perTutti > 0, 'area presente nel menu');
  assert.ok(perTutti < header.indexOf('Impara'), 'prima delle altre aree');
  assert.match(header, /href="\/aiuto\.html"/);
  const en = await request(app).get('/en/').expect(200);
  assert.match(en.text, /For everyone/);
  assert.match(en.text, /href="\/en\/aiuto\.html"/);
});

test('sitemap: Aiuto subito in tutte le lingue', async () => {
  const res = await request(app).get('/sitemap.xml').expect(200);
  assert.match(res.text, /\/aiuto\.html<\/loc>/);
  assert.match(res.text, /\/en\/aiuto\.html<\/loc>/);
});

test('Lù: il carattere e i file della mascotte sono serviti', async () => {
  await request(app).get('/assets/fonts/atkinson/atkinson-hyperlegible-next-latin-wght-normal.woff2').expect(200);
  await request(app).get('/assets/fonts/atkinson/OFL-Atkinson-Hyperlegible-Next.txt').expect(200);
  const res = await request(app).get('/aiuto.html').expect(200);
  assert.match(res.text, /class="lu"/);
  assert.match(res.text, /lu--help/);
});

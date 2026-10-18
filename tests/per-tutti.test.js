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

test('pulsante Aiuto su ogni pagina (tranne Aiuto) e numeri sopra il modulo di help', async () => {
  const home = await request(app).get('/').expect(200);
  assert.match(home.text, /<a class="evil-help-fab" href="\/aiuto\.html" aria-label="Aiuto subito: cyberbullismo, ricatti, minacce">/);
  const en = await request(app).get('/en/news.html').expect(200);
  assert.match(en.text, /<a class="evil-help-fab" href="\/en\/aiuto\.html" aria-label="Get help now/);
  const aiuto = await request(app).get('/aiuto.html').expect(200);
  assert.doesNotMatch(aiuto.text, /evil-help-fab/, 'nella pagina Aiuto il pulsante non serve');
  const help = await request(app).get('/help.html').expect(200);
  assert.match(help.text, /id="help-urgent"/);
  assert.match(help.text, /class="pt-help-numbers"/);
  assert.ok(help.text.indexOf('id="help-urgent"') < help.text.indexOf('id="helpContactForm"'), 'i numeri vengono prima del modulo');
});

test('home "Chi sei?": un ingresso per ogni pubblico, aiuto in evidenza, anche in inglese', async () => {
  const res = await request(app).get('/').expect(200);
  const html = res.text;
  assert.match(html, /\/css\/per-tutti\.css/);
  assert.match(html, /\/js\/per-tutti\.js/);
  assert.match(html, /<a class="hv-start-here[^"]*" href="#chi-sei">/, 'il riquadro "Prima volta qui?" porta alla scelta');
  const start = html.indexOf('id="chi-sei"');
  assert.ok(start > 0, 'sezione presente');
  const room = html.slice(start, html.indexOf('id="hv-aree"'));
  for (const href of ['/primi-passi.html', '/pp-truffe.html', '/learning-paths.html', '/aiuto.html', '/aiuto.html#genitori', '/aiuto.html#docenti', '#hv-aree']) {
    assert.ok(room.includes(`href="${href}"`), `link a ${href}`);
  }
  assert.match(room, /class="lu-wrap lu-wrap--md/, 'Lù nella stanza con la luce');
  assert.ok(html.indexOf('id="chi-sei"') < html.indexOf('id="hv-aree"'), 'subito dopo l’apertura');
  const en = await request(app).get('/en/').expect(200);
  assert.match(en.text, /Who are you\? We’ll take you to the right place\./);
  assert.match(en.text, /href="\/en\/primi-passi\.html"/);
  assert.match(en.text, /href="\/en\/aiuto\.html#docenti"/);
});

test('sorprese di Lù: script su ogni pagina, premio finto nel footer tranne che in Aiuto, pagina che spiega i segnali', async () => {
  const home = await request(app).get('/').expect(200);
  assert.match(home.text, /<script src="\/js\/sorprese\.js[^"]*" defer><\/script>/);
  assert.match(home.text, /class="evil-site-foot__link evil-site-foot__prize" href="\/trappola-finta\.html">Hai vinto un buono da 500 €!/);
  const aiuto = await request(app).get('/aiuto.html').expect(200);
  assert.doesNotMatch(aiuto.text, /evil-site-foot__prize/, 'niente sorprese nella pagina Aiuto');
  const trap = await request(app).get('/trappola-finta.html').expect(200);
  assert.match(trap.text, /data-pt-egg="prize"/);
  assert.match(trap.text, /<meta name="robots" content="noindex">/);
  assert.match(trap.text, /I segnali che dovevano insospettirti/);
  const en = await request(app).get('/en/trappola-finta.html').expect(200);
  assert.match(en.text, /It was a trap… a fake one/);
  assert.match(en.text, /href="\/en\/trappola-finta\.html">You’ve won a €500 voucher!/);
  // le pagine sorpresa non stanno nella sitemap né nella ricerca del sito
  const map = await request(app).get('/sitemap.xml').expect(200);
  assert.doesNotMatch(map.text, /trappola-finta|404\.html/);
});

test('tutela dei minori: sezione nelle regole del sito, collegata dalla pagina Aiuto', async () => {
  const it = await request(app).get('/site-policies.html').expect(200);
  assert.match(it.text, /id="policy-minors"/);
  assert.match(it.text, /Sotto i 14 anni niente account/);
  assert.match(it.text, /href="#policy-minors"/);
  const en = await request(app).get('/en/site-policies.html').expect(200);
  assert.match(en.text, /8\. Protecting minors/);
  const aiuto = await request(app).get('/aiuto.html').expect(200);
  assert.match(aiuto.text, /href="\/site-policies\.html#policy-minors"/);
});

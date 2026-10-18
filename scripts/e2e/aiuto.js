#!/usr/bin/env node
/**
 * Prova nel browser della pagina Aiuto: schede, tastiera, link diretti, senza JavaScript,
 * "Esci subito" (anche con Esc Esc), versione inglese.
 *
 *   PLAYWRIGHT=/percorso/node_modules/playwright node scripts/e2e/aiuto.js [http://localhost:3999]
 *
 * Serve Playwright con Chromium (non è una dipendenza del progetto) e il server avviato.
 */
'use strict';

const assert = require('assert');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = (process.argv[2] || 'http://localhost:3999').replace(/\/$/, '');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'it-IT' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  // 1. schede: una sola visibile, il clic cambia pannello e indirizzo
  await p.goto(`${BASE}/aiuto.html`, { waitUntil: 'networkidle' });
  const visible = async () => p.$$eval('.pt-panel', (ps) => ps.filter((x) => !x.hidden).map((x) => x.id));
  assert.deepStrictEqual(await visible(), ['a-me']);
  await p.click('#tab-genitori');
  assert.deepStrictEqual(await visible(), ['genitori']);
  assert.ok(p.url().endsWith('#genitori'), 'hash aggiornato');
  // 2. tastiera: la freccia a destra porta a "docenti" con il fuoco
  await p.focus('#tab-genitori');
  await p.keyboard.press('ArrowRight');
  assert.deepStrictEqual(await visible(), ['docenti']);
  assert.strictEqual(await p.evaluate(() => document.activeElement.id), 'tab-docenti');
  // 3. la scelta resta dopo il ricaricamento (senza hash)
  await p.goto(`${BASE}/aiuto.html`, { waitUntil: 'networkidle' });
  assert.deepStrictEqual(await visible(), ['docenti']);
  // 4. un link diretto con l'hash vince sulla scelta salvata
  await p.goto(`${BASE}/aiuto.html#ho-visto`, { waitUntil: 'networkidle' });
  assert.deepStrictEqual(await visible(), ['ho-visto']);
  // 5. senza JavaScript tutti i pannelli sono visibili e le schede nascoste
  const ctxNoJs = await b.newContext({ javaScriptEnabled: false });
  const q = await ctxNoJs.newPage();
  await q.goto(`${BASE}/aiuto.html`);
  const noJs = await q.$$eval('.pt-panel', (ps) => ps.map((x) => getComputedStyle(x).display));
  assert.ok(noJs.every((d) => d !== 'none'), 'senza JS si vede tutto');
  assert.strictEqual(await q.$eval('.pt-switch__list', (x) => getComputedStyle(x).display), 'none');
  await ctxNoJs.close();
  // 6. Esci subito: sostituisce la pagina (niente "indietro") con il meteo
  await p.route('https://www.google.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>meteo</title>ok' }));
  await p.goto(`${BASE}/aiuto.html`, { waitUntil: 'networkidle' });
  await Promise.all([p.waitForURL(/google\.com\/search\?q=meteo/), p.click('[data-pt-exit]')]);
  // 7. Esc due volte
  await p.goto(`${BASE}/aiuto.html`, { waitUntil: 'networkidle' });
  await p.keyboard.press('Escape');
  await Promise.all([p.waitForURL(/google\.com/), p.keyboard.press('Escape')]);
  // 8. versione inglese
  await p.goto(`${BASE}/en/aiuto.html`, { waitUntil: 'networkidle' });
  assert.ok((await p.textContent('h1')).includes('It can be stopped'));
  assert.ok((await p.textContent('#chi-chiamare')).includes('checked on 18 October 2026'));
  await b.close();
  if (errs.length) throw new Error(`errori JavaScript: ${errs.join(' | ')}`);
  console.log('e2e Aiuto: tutto ok');
})().catch((e) => {
  console.error('FALLITO:', e.message);
  process.exit(1);
});

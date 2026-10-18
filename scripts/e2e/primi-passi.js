#!/usr/bin/env node
/**
 * Prova nel browser di Primi passi: i quattro giochi (con errori, aiuti e "Gioca di nuovo"),
 * "Fai subito", livelli di spiegazione, riquadro "La tua tappa", progressi, lucciola d'oro,
 * patentino (anche in stampa), ricominciare da zero, inglese, telefono, senza JavaScript.
 *
 *   PLAYWRIGHT=/percorso/node_modules/playwright node scripts/e2e/primi-passi.js [http://localhost:3999]
 *
 * Serve Playwright con Chromium (non è una dipendenza del progetto) e il server avviato.
 * Le schermate e il PDF del patentino vanno in E2E_OUT (predefinita: la cartella temporanea).
 */
'use strict';

const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = (process.argv[2] || 'http://localhost:3999').replace(/\/$/, '');
const OUT = process.env.E2E_OUT || require('os').tmpdir();
let fails = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) fails++;
};

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 900 }, locale: 'it-IT' });
  const errors = [];
  ctx.on('page', (p) => {
    p.on('pageerror', (e) => errors.push(`${p.url()} JS: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${p.url()} console: ${m.text().slice(0, 140)}`); });
  });
  const p = await ctx.newPage();
  const status = () => p.textContent('[data-pp-status]');

  // ---------------------------------------------------- 1. classifica
  await p.goto(`${BASE}/pp-cosa-proteggere.html`, { waitUntil: 'networkidle' });
  ok(await p.isVisible('.pp-item__picks'), 'classifica: pulsanti delle categorie creati');
  ok(!(await p.isVisible('.pp-item__answer')), 'classifica: risposte senza JS sostituite');
  const items = await p.$$('.pp-item');
  // errore sul primo elemento
  const cat0 = await items[0].getAttribute('data-cat');
  const wrong0 = await items[0].$(`.pp-pick:not([data-cat="${cat0}"])`);
  await wrong0.click();
  ok((await items[0].textContent()).includes('Quasi! Riprova.'), 'classifica: risposta sbagliata → "Quasi! Riprova."');
  ok((await wrong0.getAttribute('aria-disabled')) === 'true', 'classifica: scelta sbagliata disattivata');
  for (const it of items) {
    const cat = await it.getAttribute('data-cat');
    await (await it.$(`.pp-pick[data-cat="${cat}"]`)).click();
  }
  ok(await p.$eval('[data-pp-game]', (e) => e.classList.contains('is-solved')), 'classifica: gioco risolto');
  ok((await status()).includes('Al primo colpo: 5 su 6'), `classifica: punteggio (${await status()})`);
  ok(await p.$eval('[data-pp-badge]', (e) => e.classList.contains('is-won')), 'classifica: badge guadagnato');
  ok((await status()).includes('Badge guadagnato: Custode'), 'classifica: annuncio del badge');
  ok(await p.$eval('[data-pp-dot="cosa-proteggere"]', (e) => e.classList.contains('is-done')), 'percorso: puntino 1 completato');
  ok((await p.textContent('[data-pp-dot="cosa-proteggere"] .pt-sr')).includes('completata'), 'percorso: etichetta "completata" per i lettori di schermo');
  await p.click('[data-pp-replay]');
  ok(!(await p.$eval('[data-pp-game]', (e) => e.classList.contains('is-solved'))), 'classifica: "Gioca di nuovo" riparte');
  await p.screenshot({ path: `${OUT}/e2e-classify.png`, fullPage: false });

  // fai subito: si ricorda
  await p.click('[data-pp-done]');
  ok((await p.getAttribute('[data-pp-done]', 'aria-pressed')) === 'true', 'fai subito: premuto');
  ok(await p.isVisible('[data-pp-done-msg]'), 'fai subito: messaggio');
  await p.reload({ waitUntil: 'networkidle' });
  ok((await p.getAttribute('[data-pp-done]', 'aria-pressed')) === 'true', 'fai subito: ricordato dopo il ricaricamento');
  ok(await p.$eval('[data-pp-badge]', (e) => e.classList.contains('is-won')), 'badge: resta guadagnato dopo il ricaricamento');

  // storia e livelli
  await p.click('details.pp-choice[data-good] > summary');
  ok(await p.isVisible('details.pp-choice[data-good] .pp-verdict--good'), 'storia: risposta giusta aperta');
  ok((await p.getAttribute('#tab-pp-all', 'aria-selected')) === 'true', 'livelli: "Per tutti" scelto all’inizio');
  ok(await p.isHidden('#pp-kids'), 'livelli: gli altri pannelli sono nascosti');
  await p.click('#tab-pp-kids');
  ok(await p.isVisible('#pp-kids'), 'livelli: "Per i più piccoli" si apre');
  await p.keyboard.press('ArrowRight');
  ok((await p.getAttribute('#tab-pp-all', 'aria-selected')) === 'true', 'livelli: freccia a destra');
  await p.keyboard.press('End');
  ok((await p.getAttribute('#tab-pp-deep', 'aria-selected')) === 'true', 'livelli: tasto Fine');

  // pannello laterale
  await p.evaluate(() => window.scrollTo(0, 1500));
  await p.waitForTimeout(500);
  ok(await p.$eval('[data-pp-side]', (e) => e.classList.contains('is-shown')), 'riquadro "La tua tappa" visibile durante la lettura');
  ok(await p.$eval('[data-pp-step="story"]', (e) => e.classList.contains('is-done')), 'riquadro: storia spuntata');
  ok(await p.$eval('[data-pp-step="do"]', (e) => e.classList.contains('is-done')), 'riquadro: fai subito spuntato');
  ok(await p.$eval('[data-pp-step="game"]', (e) => e.classList.contains('is-done')), 'riquadro: gioco spuntato (tappa già completata)');
  await p.screenshot({ path: `${OUT}/e2e-side.png`, fullPage: false });

  // ---------------------------------------------------- 2. metti in ordine
  await p.goto(`${BASE}/pp-password.html`, { waitUntil: 'networkidle' });
  ok((await p.getAttribute('#tab-pp-deep', 'aria-selected')) === 'true', 'livelli: la scelta resta da una tappa all’altra');
  await p.click('[data-pp-check]');
  ok((await status()).startsWith('Quasi! Al posto giusto:'), `ordine: controllo con ordine sbagliato (${await status()})`);
  // ordina con i pulsanti ↑ (come farebbe una persona)
  for (let guard = 0; guard < 30; guard++) {
    const pos = await p.$$eval('[data-pp-order] > li', (ls) => ls.map((l) => Number(l.dataset.pos)));
    const i = pos.findIndex((v, k) => k > 0 && pos[k - 1] > v);
    if (i < 0) break;
    await p.click(`[data-pp-order] > li:nth-child(${i + 1}) .pp-move--up`);
  }
  const focused = await p.evaluate(() => document.activeElement && document.activeElement.className);
  ok(/pp-move/.test(focused || ''), 'ordine: il fuoco resta sui pulsanti di spostamento');
  await p.click('[data-pp-check]');
  ok(await p.$eval('[data-pp-game]', (e) => e.classList.contains('is-solved')), 'ordine: risolto');
  ok((await status()).includes('Tentativi: 2'), `ordine: tentativi (${await status()})`);
  ok(await p.isVisible('[data-pp-solution] .pp-solution__list'), 'ordine: spiegazione mostrata');
  await p.screenshot({ path: `${OUT}/e2e-order.png`, fullPage: false });

  // ---------------------------------------------------- 3. scegli le trappole
  await p.goto(`${BASE}/pp-due-passaggi.html`, { waitUntil: 'networkidle' });
  const opts = await p.$$('.pp-option');
  const safe = [];
  const traps = [];
  for (const o of opts) ((await o.getAttribute('data-trap')) ? traps : safe).push(o);
  await (await safe[0].$('.pp-option__btn')).click();
  await p.click('[data-pp-check]');
  ok((await status()).includes('Trappole trovate: 0 su 3') && (await status()).includes('innocuo'), `scegli: messaggio (${await status()})`);
  ok(await p.isHidden('[data-pp-hint]'), 'scegli: aiuto non ancora offerto');
  await p.click('[data-pp-check]');
  ok(await p.isVisible('[data-pp-hint]'), 'scegli: dopo due tentativi arriva "Dammi un aiuto"');
  await p.click('[data-pp-hint]');
  ok(await traps[0].evaluate((e) => e.classList.contains('is-hinted')), 'scegli: l’aiuto indica una trappola non scelta');
  await (await safe[0].$('.pp-option__btn')).click();
  for (const t of traps) await (await t.$('.pp-option__btn')).click();
  await p.click('[data-pp-check]');
  ok(await p.$eval('[data-pp-game]', (e) => e.classList.contains('is-solved')), 'scegli: risolto');
  ok(await safe[0].evaluate((e) => e.classList.contains('is-safe')), 'scegli: le innocue segnate');
  await p.screenshot({ path: `${OUT}/e2e-select.png`, fullPage: false });

  // ---------------------------------------------------- 4. trova le trappole (anche da tastiera)
  await p.goto(`${BASE}/pp-truffe.html`, { waitUntil: 'networkidle' });
  ok(!(await p.isVisible('[data-pp-hint]')), 'trova: aiuto nascosto all’inizio');
  await p.focus('.pp-seg[data-seg="0"]');
  await p.keyboard.press('Enter');
  ok((await status()) === 'Questa parte è normale.', `trova: parte normale con Invio (${await status()})`);
  for (const s of await p.$$('.pp-seg[data-trap]')) await s.click();
  ok(await p.$eval('[data-pp-game]', (e) => e.classList.contains('is-solved') && e.classList.contains('is-busted')), 'trova: risolto');
  ok(await p.isVisible('[data-pp-stamp]'), 'trova: timbro "Truffa smascherata"');
  ok((await p.$$('.pp-spot__notes > li')).length === 4, 'trova: una spiegazione per ogni parte toccata');
  await p.locator('[data-pp-game]').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/e2e-spot.png`, fullPage: false });

  // ---------------------------------------------------- 5. pagina del percorso
  await p.goto(`${BASE}/primi-passi.html`, { waitUntil: 'networkidle' });
  ok((await p.textContent('[data-pp-count]')) === '4', 'percorso: 4 tappe completate');
  ok((await p.$$('[data-pp-light].is-on')).length === 4, 'percorso: 4 luci accese');
  ok((await p.textContent('[data-pp-start]')).trim() === 'Continua dalla tappa 4', `percorso: pulsante "continua" (${await p.textContent('[data-pp-start]')})`);
  ok((await p.getAttribute('[data-pp-start]', 'href')) === '/pp-aggiornamenti-backup.html', 'percorso: porta alla prima tappa da fare');
  ok(await p.isVisible('[data-pp-cert-locked]'), 'patentino: bloccato');
  await p.screenshot({ path: `${OUT}/e2e-overview-4.png`, fullPage: true });

  // tutte le tappe fatte → lucciola d'oro e patentino
  await p.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('evil-pp-v1'));
    document.querySelectorAll('[data-pp-tile]').forEach((c, i) => { d.done[c.dataset.ppTile] = { at: Date.UTC(2026, 9, 18, 10, i) }; });
    localStorage.setItem('evil-pp-v1', JSON.stringify(d));
  });
  await p.reload({ waitUntil: 'networkidle' });
  ok((await p.textContent('[data-pp-count]')) === '10', 'percorso: 10 su 10');
  ok(await p.isVisible('[data-pp-gold]'), 'lucciola d’oro visibile');
  ok(await p.$eval('.pp-hero [data-lu]', (e) => e.classList.contains('lu--gold')), 'Lù diventa d’oro');
  ok(await p.isVisible('[data-pp-cert-tools]'), 'patentino: nome e stampa disponibili');
  ok((await p.textContent('[data-pp-cert-date]')).includes('18 ottobre 2026'), `patentino: data (${await p.textContent('[data-pp-cert-date]')})`);
  ok((await p.textContent('[data-pp-start]')).trim() === 'Ritira il tuo patentino', 'percorso: pulsante verso il patentino');
  await p.fill('[data-pp-cert-input]', 'Giulia R.');
  ok((await p.textContent('[data-pp-cert-name]')) === 'Giulia R.', 'patentino: il nome appare');
  ok(!(await p.evaluate(() => localStorage.getItem('evil-pp-v1'))).includes('Giulia'), 'patentino: il nome non viene salvato');
  await p.locator('#patentino').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${OUT}/e2e-cert.png`, fullPage: false });
  await p.emulateMedia({ media: 'print' });
  await p.evaluate(() => document.body.classList.add('pp-printing'));
  await p.pdf({ path: `${OUT}/e2e-cert.pdf`, preferCSSPageSize: true, printBackground: true });
  await p.evaluate(() => document.body.classList.remove('pp-printing'));
  await p.emulateMedia({ media: 'screen' });

  // ricominciare da zero
  await p.click('[data-pp-reset]');
  ok((await p.textContent('[data-pp-reset]')).startsWith('Sicuro?'), 'reset: chiede conferma');
  await p.click('[data-pp-reset]');
  ok((await p.textContent('[data-pp-count]')) === '0', 'reset: progressi cancellati');
  ok((await p.textContent('[data-pp-start]')).trim() === 'Inizia dalla tappa 1', 'reset: si riparte dalla tappa 1');

  // ---------------------------------------------------- 6. inglese
  await p.goto(`${BASE}/en/pp-truffe.html`, { waitUntil: 'networkidle' });
  await p.click('.pp-seg[data-trap]');
  ok((await status()).startsWith('Got it! Traps: 1 of 3'), `inglese: testi del gioco (${await status()})`);
  ok((await p.textContent('.pp-sms__from')).includes('LuParcel'), 'inglese: marchio inventato tradotto');

  // ---------------------------------------------------- 7. telefono
  const m = await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'it-IT', hasTouch: true, isMobile: true });
  const mp = await m.newPage();
  await mp.goto(`${BASE}/pp-cosa-proteggere.html`, { waitUntil: 'networkidle' });
  const over = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 1, `telefono: niente scorrimento orizzontale (${over})`);
  ok(!(await mp.isVisible('[data-pp-side]')), 'telefono: niente riquadro laterale');
  const small = await mp.$$eval('button, a, [role="button"]', (els) => els.filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width && r.height && e.closest('main') && (r.height < 40) && !e.closest('.pp-trail, .pp-sources, .pp-links, p, li:not(.pp-item)');
  }).map((e) => e.className || e.tagName));
  ok(small.length === 0, `telefono: zone da toccare abbastanza grandi (${small.join(', ')})`);
  await m.close();

  // ---------------------------------------------------- 8. senza JavaScript
  const nojs = await b.newContext({ viewport: { width: 1366, height: 900 }, javaScriptEnabled: false });
  const np = await nojs.newPage();
  await np.goto(`${BASE}/pp-due-passaggi.html`, { waitUntil: 'networkidle' });
  ok(await np.isVisible('#pp-kids') && await np.isVisible('#pp-deep'), 'senza JS: tutti i livelli visibili');
  ok(!(await np.isVisible('.pt-switch__list')), 'senza JS: niente schede');
  ok(!(await np.isVisible('[data-pp-check]')), 'senza JS: niente pulsanti del gioco');
  await np.click('.pp-option:first-child .pp-option__answer > summary');
  ok(await np.isVisible('.pp-option:first-child .pp-option__why'), 'senza JS: la risposta si apre');
  await nojs.close();

  console.log(errors.length ? `\nERRORI:\n${errors.join('\n')}` : '\nnessun errore in console');
  console.log(fails ? `\n${fails} controlli falliti` : '\ntutti i controlli passati');
  await b.close();
  process.exit(fails || errors.length ? 1 : 0);
})();

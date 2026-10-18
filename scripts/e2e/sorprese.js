#!/usr/bin/env node
/**
 * Prova nel browser delle sorprese di Lù (docs/evil-per-tutti/STILE.md): password famosa nella
 * ricerca, "luce" (torcia), Lù toccata 5 volte, premio finto nel footer, pagina 404, badge
 * Esploratore nella pagina di Primi passi; e nessuna sorpresa nella pagina Aiuto.
 *
 *   PLAYWRIGHT=/percorso/node_modules/playwright node scripts/e2e/sorprese.js [http://localhost:3999]
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
    p.on('console', (m) => {
      if (m.type() === 'error' && !/status of 40[14]/.test(m.text())) errors.push(`${p.url()} console: ${m.text().slice(0, 140)}`);
    });
  });
  const p = await ctx.newPage();
  const logs = [];
  p.on('console', (m) => logs.push(m.text()));
  const toasts = () => p.$$eval('.evil-egg-toast', (ts) => ts.map((t) => t.textContent));
  const eggs = () => p.evaluate(() => JSON.parse(localStorage.getItem('evil-pt-eggs-v1') || '[]'));

  // ---------------------------------------------------- nella pagina Aiuto niente sorprese
  await p.goto(`${BASE}/aiuto.html`, { waitUntil: 'networkidle' });
  ok(!(await p.$('.evil-site-foot__prize')), 'Aiuto: niente premio finto nel footer');
  await p.keyboard.type('luce');
  ok(!(await p.$('.pt-torch')), 'Aiuto: "luce" non accende la torcia');
  await p.keyboard.press('Control+k');
  await p.fill('.evil-search__input', '123456');
  ok(!(await p.$('.evil-search__opt--egg')), 'Aiuto: la ricerca non mostra la sorpresa');
  await p.keyboard.press('Escape');
  ok((await eggs()).length === 0, 'Aiuto: nessuna sorpresa segnata');
  ok(!logs.some((l) => l.includes('sotto il cofano')), 'Aiuto: niente messaggio in console');

  // ---------------------------------------------------- 1. password famosa nella ricerca
  await p.goto(`${BASE}/news.html`, { waitUntil: 'networkidle' });
  ok(logs.some((l) => l.includes('sotto il cofano')), 'console: messaggio per chi guarda sotto il cofano');
  await p.keyboard.press('Control+k');
  await p.fill('.evil-search__input', 'password');
  ok(await p.isVisible('.evil-search__opt--egg'), 'ricerca: Lù arrossisce per "password"');
  ok((await p.getAttribute('.evil-search__opt--egg a', 'href')) === '/pp-password.html', 'ricerca: porta alla tappa sulle password');
  ok((await toasts()).some((t) => t.includes('Sorpresa 1 di 5')), 'ricerca: avviso "Sorpresa 1 di 5"');
  await p.screenshot({ path: `${OUT}/egg-search.png` });
  await p.keyboard.press('Enter');
  await p.waitForURL(/pp-password\.html/);
  ok(true, 'ricerca: Invio apre la tappa');

  // ---------------------------------------------------- 2. "luce": la torcia
  await p.mouse.move(400, 400);
  await p.keyboard.type('luce');
  ok(await p.isVisible('.pt-torch'), 'torcia accesa scrivendo "luce"');
  ok((await p.$$('.pt-torch__tip')).length === 3, 'torcia: tre consigli nascosti nel buio');
  await p.mouse.move(700, 450);
  ok((await p.$eval('.pt-torch', (e) => e.style.getPropertyValue('--x'))) === '700px', 'torcia: la luce segue il puntatore');
  await p.screenshot({ path: `${OUT}/egg-torch.png` });
  await p.keyboard.press('Escape');
  ok(!(await p.$('.pt-torch')), 'torcia: Esc la spegne');
  ok((await eggs()).includes('light'), 'torcia: sorpresa segnata');

  // ---------------------------------------------------- 3. Lù toccata 5 volte
  for (let i = 0; i < 5; i++) await p.click('.pp-hero [data-lu]');
  ok(await p.isVisible('.pt-fact'), 'Lù: dopo 5 tocchi racconta una curiosità');
  const src = await p.getAttribute('.pt-fact__src a', 'href');
  ok(/^https:\/\//.test(src || ''), `Lù: la curiosità ha la fonte (${src})`);
  await p.screenshot({ path: `${OUT}/egg-fact.png` });
  await p.click('.pt-fact__close');
  ok(!(await p.$('.pt-fact')), 'Lù: la curiosità si chiude');

  // ---------------------------------------------------- 4. il premio finto nel footer
  await p.click('.evil-site-foot__prize');
  await p.waitForURL(/trappola-finta\.html/);
  ok((await p.textContent('h1')).includes('Nessun buono da 500 €'), 'premio finto: la pagina spiega i segnali');
  ok((await eggs()).includes('prize'), 'premio finto: sorpresa segnata');

  // ---------------------------------------------------- 5. la pagina 404 (l'ultima: badge Esploratore)
  const res = await p.goto(`${BASE}/questa-pagina-non-esiste.html`, { waitUntil: 'networkidle' });
  ok(res.status() === 404, 'pagina 404: stato 404');
  ok((await p.textContent('h1')).includes('post-it'), 'pagina 404: la password sul post-it');
  await p.waitForTimeout(4200);
  ok((await toasts()).some((t) => t.includes('Esploratore')), 'badge segreto "Esploratore" quando si trovano tutte');
  await p.screenshot({ path: `${OUT}/egg-404.png` });
  await p.click('[data-evil-search]');
  ok(await p.isVisible('.evil-search__input'), 'pagina 404: "Cerca nel sito" apre la ricerca');
  await p.keyboard.press('Escape');

  // ---------------------------------------------------- badge segreti nella pagina del percorso
  await p.goto(`${BASE}/primi-passi.html`, { waitUntil: 'networkidle' });
  ok((await p.textContent('[data-pp-eggs]')) === '5', 'percorso: 5 sorprese su 5');
  ok(await p.$eval('[data-pp-secret="explorer"]', (e) => e.classList.contains('is-won')), 'percorso: badge Esploratore acceso');

  // ---------------------------------------------------- inglese
  const en = await b.newContext({ viewport: { width: 1366, height: 900 } });
  const ep = await en.newPage();
  const r404 = await ep.goto(`${BASE}/en/nope.html`, { waitUntil: 'networkidle' });
  ok(r404.status() === 404 && (await ep.textContent('h1')).includes('sticky note'), 'inglese: pagina 404');
  ok((await ep.$$eval('.evil-egg-toast', (ts) => ts.map((t) => t.textContent))).some((t) => t.includes('Surprise 1 of 5')), 'inglese: avviso tradotto');
  await en.close();

  console.log(errors.length ? `\nERRORI:\n${errors.join('\n')}` : '\nnessun errore in console');
  console.log(fails ? `\n${fails} controlli falliti` : '\ntutti i controlli passati');
  await b.close();
  process.exit(fails || errors.length ? 1 : 0);
})();

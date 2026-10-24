'use strict';
require('./helpers/setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestApp, request } = require('./helpers/app');
const S = require('../server/lib/scuola-content');
const { ICON } = require('../server/icons');
const { PAGES } = require('../server/site-map');
const i18n = require('../server/i18n');
const build = require('../scripts/build-scuola');

const root = path.resolve(__dirname, '..');
let app;
let ctx;
before(async () => {
  ({ app, ctx } = await createTestApp());
});
after(async () => {
  await ctx.db.close();
});

const isPair = (o) => o && typeof o === 'object' && !Array.isArray(o) && 'it' in o && 'en' in o;
function pairs(o, where, out = []) {
  if (Array.isArray(o)) o.forEach((v, i) => pairs(v, `${where}[${i}]`, out));
  else if (isPair(o)) out.push([where, o]);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) pairs(v, `${where}.${k}`, out);
  return out;
}

test('EVIL Scuola: i file generati sono aggiornati (node scripts/build-scuola.js)', () => {
  assert.deepEqual(build.check(), []);
});

test('EVIL Scuola: ogni testo esiste in italiano e in inglese, con la stessa forma', () => {
  for (const [where, p] of pairs({ PAGE: S.PAGE, UI: S.UI, KITS: S.KITS, PLANNED: S.PLANNED, CYCLES: S.CYCLES }, 'S')) {
    assert.equal(Array.isArray(p.it), Array.isArray(p.en), `${where}: tipo diverso`);
    if (Array.isArray(p.it)) assert.equal(p.it.length, p.en.length, `${where}: lunghezze diverse`);
    else assert.ok(String(p.it).trim() && String(p.en).trim(), `${where}: testo vuoto`);
  }
});

test('EVIL Scuola: kit completi, da 50 minuti, con tappe e fonti vere', () => {
  const nums = [...S.KITS, ...S.PLANNED].map((k) => k.n).sort((a, b) => a - b);
  assert.deepEqual(nums, [1, 2, 3, 4, 5, 6], 'sei kit, numerati');
  for (const cycle of Object.keys(S.CYCLES)) {
    assert.equal([...S.KITS, ...S.PLANNED].filter((k) => k.cycle === cycle).length, 2, `due kit per ciclo: ${cycle}`);
  }
  const stages = new Set(require('../server/lib/primi-passi-content').TAPPE.map((t) => t.slug));
  for (const k of S.KITS) {
    const at = `kit ${k.n}`;
    assert.ok(ICON[k.icon], `${at}: icona`);
    // i momenti della lezione si susseguono senza buchi da 0 a 50 minuti
    assert.equal(k.plan[0].from, 0, at);
    k.plan.forEach((p, i) => i && assert.equal(p.from, k.plan[i - 1].to, `${at}: minuto ${p.from}`));
    assert.equal(k.plan[k.plan.length - 1].to, 50, `${at}: 50 minuti`);
    for (const s of k.stages) assert.ok(stages.has(s), `${at}: tappa ${s}`);
    const ids = k.game.categories.map((c) => c.id);
    assert.equal(ids.length, 2, `${at}: due colonne`);
    for (const id of ids) assert.ok(k.game.items.filter((it) => it.cat === id).length >= 2, `${at}: carte per ${id}`);
    for (const it of k.game.items) assert.ok(ids.includes(it.cat), `${at}: categoria ${it.cat}`);
    assert.ok(k.discussion.length >= 3, `${at}: domande per la discussione`);
    for (const s of k.sources) assert.match(s.url, /^https:\/\//, `${at}: fonte https`);
  }
});

test('EVIL Scuola: pagina nel menu, kit nella sitemap, serviti in italiano e in inglese', async () => {
  const sk = PAGES.filter((p) => p.file === 'scuola.html' || p.file.startsWith('scuola-'));
  assert.equal(sk.length, 2 + S.KITS.length);
  assert.equal(sk.filter((p) => p.nav).length, 1, 'solo la pagina dei kit nel menu');
  for (const file of [S.PAGE.file, S.FAMILY.file, ...S.KITS.map((k) => k.file)]) {
    const src = fs.readFileSync(path.join(root, 'html', file), 'utf8');
    assert.deepEqual(i18n.translateHtml(src, 'en', file).missing, [], `${file}: testi senza traduzione`);
    const it = await request(app).get(`/${file}`).expect(200);
    assert.match(it.text, /\/css\/scuola\.css/);
    assert.doesNotMatch(it.text, /<!--evil:fragment:/, `${file}: segnaposto rimasti`);
    const en = await request(app).get(`/en/${file}`).expect(200);
    assert.match(en.text, /<html lang="en"/);
  }
  const landing = await request(app).get('/scuola.html').expect(200);
  assert.match(landing.text, /href="tel:114"/, 'numeri di aiuto per i docenti');
  assert.match(landing.text, /href="\/scuola-chiavi-di-casa\.html"/);
  const kit = await request(app).get('/en/scuola-trappole-nel-telefono.html').expect(200);
  assert.match(kit.text, /Traps in your phone/);
  assert.match(kit.text, /href="\/en\/pp-truffe\.html\?classe=1"/, 'i link alle tappe restano in inglese e aprono la modalità classe');
  // i kit sui temi delicati sono segnati da rivedere e mostrano i numeri di aiuto
  assert.deepEqual(S.KITS.filter((k) => k.sensitive).map((k) => k.n), [2, 3, 6]);
  const delicate = await request(app).get('/scuola-le-mie-foto-i-miei-diritti.html').expect(200);
  assert.match(delicate.text, /class="sk-review"/);
  assert.match(delicate.text, /href="tel:114"/);
  const plain = await request(app).get('/scuola-chiavi-di-casa.html').expect(200);
  assert.doesNotMatch(plain.text, /class="sk-review"/);
  // senza JavaScript i pulsanti di stampa restano nascosti: si stampa dal browser
  assert.match(kit.text, /data-sk-print-bar hidden/);
});

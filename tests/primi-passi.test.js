'use strict';
require('./helpers/setup');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createTestApp, request } = require('./helpers/app');
const C = require('../server/lib/primi-passi-content');
const { ICON } = require('../server/icons');
const { PAGES } = require('../server/site-map');
const i18n = require('../server/i18n');
const build = require('../scripts/build-primi-passi');

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

/** Tutte le coppie {it, en} dentro un oggetto, con il loro percorso */
function pairs(o, where, out = []) {
  if (Array.isArray(o)) o.forEach((v, i) => pairs(v, `${where}[${i}]`, out));
  else if (isPair(o)) out.push([where, o]);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) pairs(v, `${where}.${k}`, out);
  return out;
}

test('Primi passi: i file generati sono aggiornati (node scripts/build-primi-passi.js)', () => {
  assert.deepEqual(build.check(), []);
});

test('Primi passi: ogni testo esiste in italiano e in inglese, con la stessa forma', () => {
  for (const [where, p] of pairs(C, 'C')) {
    assert.equal(Array.isArray(p.it), Array.isArray(p.en), `${where}: tipo diverso`);
    if (Array.isArray(p.it)) {
      assert.equal(p.it.length, p.en.length, `${where}: lunghezze diverse`);
      for (const s of [...p.it, ...p.en]) assert.ok(String(s).trim(), `${where}: voce vuota`);
    } else {
      assert.ok(String(p.it).trim() && String(p.en).trim(), `${where}: testo vuoto`);
    }
  }
});

test('Primi passi: dieci tappe complete, con giochi risolvibili e fonti https', () => {
  assert.equal(C.TAPPE.length, 10);
  assert.equal(new Set(C.TAPPE.map((t) => t.slug)).size, 10, 'slug unici');
  C.TAPPE.forEach((t, i) => {
    const at = `tappa ${t.slug}`;
    assert.equal(t.n, i + 1, at);
    assert.ok(ICON[t.icon], `${at}: icona ${t.icon} in server/icons.js`);
    assert.ok(['tech', 'deep'].includes(t.deepKind), `${at}: livello 3`);
    assert.ok(t.minutes >= 3 && t.minutes <= 6, `${at}: durata onesta`);
    assert.equal(t.story.choices.filter((c) => c.good).length, 1, `${at}: una sola risposta giusta`);
    assert.ok(t.story.choices.length >= 2, `${at}: almeno due scelte`);
    assert.ok(t.doNow.steps.it.length >= 2, `${at}: passi di "Fai subito"`);
    const g = t.game;
    if (g.kind === 'classify') {
      const ids = g.categories.map((c) => c.id);
      assert.equal(ids.length, 2, `${at}: due categorie`);
      for (const it of g.items) assert.ok(ids.includes(it.cat), `${at}: categoria ${it.cat}`);
      for (const id of ids) assert.ok(g.items.some((it) => it.cat === id), `${at}: categoria ${id} usata`);
    } else if (g.kind === 'order') {
      assert.ok(g.items.length >= 3, `${at}: almeno tre elementi da ordinare`);
    } else if (g.kind === 'select') {
      assert.ok(g.options.some((o) => o.trap) && g.options.some((o) => !o.trap), `${at}: trappole e non trappole`);
    } else if (g.kind === 'spot') {
      assert.ok(g.segments.some((s) => s.trap) && g.segments.some((s) => !s.trap), `${at}: parti sospette e parti normali`);
    } else {
      assert.fail(`${at}: gioco sconosciuto ${g.kind}`);
    }
    for (const s of t.sources) assert.match(s.url, /^https:\/\//, `${at}: fonte https`);
    assert.ok(t.links.length >= 1, `${at}: almeno un collegamento a EVIL`);
  });
  // le tappe su adescamento e cyberbullismo mostrano i numeri di aiuto
  for (const slug of ['persone-online', 'cyberbullismo']) assert.ok(C.TAPPE.find((t) => t.slug === slug).help, slug);
});

test('Primi passi: i link interni portano a pagine, corsi e quiz che esistono', () => {
  const { COURSES } = require('../server/lib/course-content');
  const courseIds = new Set(COURSES.map((c) => c.id));
  const quizMeta = fs.readFileSync(path.join(root, 'js', 'quiz-hub-meta.js'), 'utf8');
  const files = build.build().filter((f) => f.path.endsWith('.html'));
  let checked = 0;
  for (const f of files) {
    for (const m of f.content.matchAll(/href="(\/[^"#?]*)(\?[^"#]*)?(#[^"]*)?"/g)) {
      const [, file, query = '', hash = ''] = m;
      if (!file.endsWith('.html')) continue;
      checked++;
      const name = file.slice(1);
      assert.ok(fs.existsSync(path.join(root, 'html', name)), `${path.basename(f.path)}: ${file} non esiste`);
      const c = /[?&]c=([a-z0-9-]+)/.exec(query);
      if (c) assert.ok(courseIds.has(c[1]), `corso ${c[1]}`);
      const cat = /[?&]cat=([a-z0-9-]+)/.exec(query);
      if (cat) assert.ok(quizMeta.includes(`q('${cat[1]}'`), `quiz ${cat[1]}`);
      if (hash && name === C.OVERVIEW.file) assert.equal(hash, '#patentino');
    }
  }
  assert.ok(checked > 50, `link controllati: ${checked}`);
});

test('Primi passi: percorso nel menu, tappe fuori dal menu ma nella sitemap', async () => {
  const pp = PAGES.filter((p) => p.file === 'primi-passi.html' || p.file.startsWith('pp-'));
  assert.equal(pp.length, 11);
  assert.equal(pp.filter((p) => p.nav).length, 1, 'solo il percorso nel menu');
  assert.ok(pp.every((p) => p.area === 'per-tutti' && p.sitemap > 0));
  const home = await request(app).get('/').expect(200);
  const header = home.text.slice(home.text.indexOf('<header'), home.text.indexOf('</header>'));
  assert.match(header, /href="\/primi-passi\.html"/);
  const map = await request(app).get('/sitemap.xml').expect(200);
  assert.match(map.text, /\/pp-password\.html<\/loc>/);
  assert.match(map.text, /\/en\/pp-se-succede\.html<\/loc>/);
});

test('Primi passi: ogni pagina è servita in italiano e in inglese, tutta tradotta', async () => {
  for (const file of [C.OVERVIEW.file, ...C.TAPPE.map((t) => t.file)]) {
    const src = fs.readFileSync(path.join(root, 'html', file), 'utf8');
    assert.deepEqual(i18n.translateHtml(src, 'en', file).missing, [], `${file}: testi senza traduzione`);
    const it = await request(app).get(`/${file}`).expect(200);
    assert.match(it.text, /\/css\/primi-passi\.css/);
    assert.match(it.text, /\/js\/primi-passi\.js/);
    assert.doesNotMatch(it.text, /<!--evil:fragment:/, `${file}: segnaposto rimasti`);
    const en = await request(app).get(`/en/${file}`).expect(200);
    assert.match(en.text, /<html lang="en"/);
    assert.doesNotMatch(en.text, /data-pp-str="right">Giusto!/, `${file}: testi del gioco in italiano`);
  }
  const stage = await request(app).get('/en/pp-truffe.html').expect(200);
  assert.match(stage.text, /Find the three traps/);
  assert.match(stage.text, /LuParcel/);
  assert.match(stage.text, /href="\/en\/pp-condividere\.html"/, 'il link alla tappa dopo resta in inglese');
});

test('Primi passi: le tappe delicate mostrano i numeri di aiuto, le altre no', async () => {
  const groom = await request(app).get('/pp-persone-online.html').expect(200);
  assert.match(groom.text, /class="pt-help-numbers"/);
  assert.match(groom.text, /href="tel:114"/);
  const pw = await request(app).get('/pp-password.html').expect(200);
  assert.doesNotMatch(pw.text, /class="pt-help-numbers"/);
});

test('Primi passi: ogni tappa ha una scena in tre quadri, con sottotitoli e disegni senza parole', async () => {
  const { SCENES, sceneSvg } = require('../server/lib/primi-passi-scenes');
  assert.deepEqual(Object.keys(SCENES).sort(), C.TAPPE.map((t) => t.slug).sort(), 'una scena per tappa');
  for (const t of C.TAPPE) {
    assert.equal(t.scene.it.length, 3, `${t.slug}: tre didascalie`);
    for (let i = 0; i < 3; i++) {
      const svg = sceneSvg(t.slug, i);
      assert.match(svg, /^<svg class="pp-scene-svg" viewBox="0 0 320 200" aria-hidden="true" focusable="false">/, `${t.slug}/${i}`);
      // niente id (si ripeterebbero nella pagina) e nessuna parola dentro i disegni: le dice la didascalia
      assert.doesNotMatch(svg, /\sid="/, `${t.slug}/${i}: id nel disegno`);
      for (const m of svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)) assert.equal(m[1], '?', `${t.slug}/${i}: testo nel disegno`);
    }
  }
  const it = await request(app).get('/pp-truffe.html').expect(200);
  assert.match(it.text, /<figure class="pp-anim" data-pp-anim aria-label="La storia in tre immagini">/);
  assert.equal((it.text.match(/<li class="pp-anim__frame" data-frame="\d">/g) || []).length, 3);
  // senza JavaScript restano i tre quadri uno accanto all'altro: i comandi compaiono solo con lo script
  assert.match(it.text, /<div class="pp-anim__bar" data-pp-anim-bar hidden>/);
  const en = await request(app).get('/en/pp-truffe.html').expect(200);
  assert.match(en.text, new RegExp(`> ${C.TAPPE.find((t) => t.slug === 'truffe').scene.en[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</p>`));
  assert.match(en.text, /aria-label="Play the story"|aria-label="Pause"/);
});

test('Primi passi: senza JavaScript le risposte restano leggibili', async () => {
  const res = await request(app).get('/pp-cosa-proteggere.html').expect(200);
  assert.match(res.text, /<details class="pp-choice" data-good="1">/);
  assert.match(res.text, /<details class="pp-item__answer">/);
  const order = await request(app).get('/pp-password.html').expect(200);
  assert.match(order.text, /<details class="pp-solution" data-pp-solution>/);
  // l'ordine mostrato non è già quello giusto
  const shown = [...order.text.matchAll(/class="pp-order__item" data-pos="(\d)"/g)].map((m) => Number(m[1]));
  assert.equal(shown.length, 4);
  assert.ok(shown.every((pos, i) => pos !== i));
});

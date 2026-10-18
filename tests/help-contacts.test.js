'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  MAX_AGE_DAYS,
  GROUPS,
  CONTACTS,
  renderHelpContacts,
  renderHelpNumbers,
  staleContacts,
} = require('../server/lib/help-contacts');
const { fillFragments } = require('../server/fragments');

const LANGS = ['it', 'en'];
const groupIds = new Set(GROUPS.map((g) => g.id));

test('ogni contatto ha testi in tutte le lingue, un gruppo valido e fonti https', () => {
  const ids = new Set();
  for (const c of CONTACTS) {
    assert.ok(!ids.has(c.id), `id ripetuto: ${c.id}`);
    ids.add(c.id);
    assert.ok(groupIds.has(c.group), `${c.id}: gruppo sconosciuto ${c.group}`);
    for (const lang of LANGS) {
      for (const field of ['name', 'for', 'how']) {
        assert.ok(c[field] && typeof c[field][lang] === 'string' && c[field][lang].trim().length > 2, `${c.id}: manca ${field}.${lang}`);
      }
    }
    assert.ok(c.phone || c.url, `${c.id}: serve un numero o un sito`);
    if (c.phone) assert.match(c.phone, /^\d{3,12}$/, `${c.id}: il numero per tel: deve avere solo cifre`);
    if (c.url) assert.match(c.url, /^https:\/\//, `${c.id}: il sito deve essere https`);
    assert.ok(Array.isArray(c.sources) && c.sources.length > 0, `${c.id}: manca la fonte`);
    for (const src of c.sources) {
      assert.match(src.url, /^https:\/\//, `${c.id}: fonte non https`);
      for (const lang of LANGS) assert.ok(src.label[lang], `${c.id}: etichetta della fonte senza ${lang}`);
    }
    assert.ok(c.reviewedBy === null || (typeof c.reviewedBy === 'string' && c.reviewedBy.trim()), `${c.id}: reviewedBy è null o un nome`);
  }
});

test(`i contatti di aiuto sono stati verificati negli ultimi ${MAX_AGE_DAYS} giorni`, () => {
  const stale = staleContacts();
  assert.deepEqual(
    stale.map((c) => `${c.id} (verificato il ${c.verifiedOn})`),
    [],
    'Riaprire le fonti in server/lib/help-contacts.js, ricontrollare numeri e orari e aggiornare verifiedOn'
  );
});

test('la verifica scade davvero: un contatto vecchio viene segnalato', () => {
  const future = Date.parse('2026-10-18T00:00:00Z') + (MAX_AGE_DAYS + 1) * 864e5;
  assert.ok(staleContacts(future).length > 0);
});

test('i contatti sono resi con chiamata, sito, fonte e data nella lingua della pagina', () => {
  const it = renderHelpContacts('it');
  const en = renderHelpContacts('en');
  assert.match(it, /href="tel:112"/);
  assert.match(it, /href="tel:19696"/);
  assert.match(it, /Chiama 1\.96\.96/);
  assert.match(en, /Call 1\.96\.96/);
  assert.match(it, /verificato il 18 ottobre 2026/);
  assert.match(en, /checked on 18 October 2026/);
  assert.match(it, /target="_blank" rel="noopener noreferrer"/);
  for (const g of GROUPS) assert.match(it, new RegExp(`id="pt-help-${g.id}"`));
  for (const c of CONTACTS) assert.ok(it.includes(`data-contact="${c.id}"`), `${c.id} manca nella pagina`);
  assert.doesNotMatch(it, /<script/i);
  const only = renderHelpContacts('it', { groups: ['urgent'], heading: 'h2' });
  assert.match(only, /<h2 class="pt-help-group__title"/);
  assert.doesNotMatch(only, /data-contact="stop-it"/);
});

test('i numeri da chiamare subito: 112, 114 e 1.96.96', () => {
  const html = renderHelpNumbers('it');
  assert.match(html, /tel:112/);
  assert.match(html, /tel:114/);
  assert.match(html, /tel:19696/);
  assert.match(renderHelpNumbers('en'), /Child emergency line/);
});

test('i segnaposto noti diventano contenuto, quelli sconosciuti restano commenti', () => {
  const html = '<main><div class="x"><!--evil:fragment:help-numbers--></div><!--evil:fragment:non-esiste--></main>';
  const out = fillFragments(html, 'it');
  assert.match(out, /pt-help-numbers/);
  assert.ok(out.includes('<!--evil:fragment:non-esiste-->'));
  assert.equal(fillFragments('<p>niente</p>', 'it'), '<p>niente</p>');
  assert.ok(!fillFragments('<!--evil:fragment:constructor-->', 'it').includes('function'), 'niente proprietà ereditate');
});

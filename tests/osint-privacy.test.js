'use strict';
require('./helpers/setup');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const registry = require('../services/tools/public-info-registry-service');

const territory = {
  country: { qid: 'Q38' },
  municipality: { qid: 'Q220' },
  region: null,
  province: null,
};

test('S-04: il filtro professione rifiuta caratteri che potrebbero uscire dalla stringa SPARQL', () => {
  const bad = [
    'x") } UNION { ?s ?p ?o } #',
    'medico\\',
    'a\\") FILTER(true',
    'ingegnere"',
    'x\ny',
    'a'.repeat(61),
    '<script>',
    'ruolo; DROP',
  ];
  for (const profession of bad) {
    assert.throws(
      () => registry.normalizeTerritoryInput({ country: 'Italia', profession }),
      (err) => err.expose === true && err.status === 400,
      JSON.stringify(profession),
    );
  }
});

test('S-04: professioni legittime (accenti, apostrofi, trattini) restano accettate', () => {
  for (const profession of ['medico', 'Ingegnere informatico', "maestra d'asilo", 'avvocato’', 'medico-chirurgo', 'Ärztin']) {
    const q = registry.normalizeTerritoryInput({ country: 'Italia', profession });
    assert.equal(q.profession, profession);
  }
  assert.equal(registry.normalizeTerritoryInput({ country: 'Italia' }).profession, null);
});

test('S-04: escape SPARQL completo (prima la barra rovesciata, poi le virgolette)', () => {
  assert.equal(registry.sparqlString('a\\"b'), 'a\\\\\\"b');
  assert.equal(registry.sparqlString('x\ny'), 'x\\ny');
  // anche se la validazione venisse aggirata, la query resta una sola stringa chiusa
  const sparql = registry.buildRegistrySparql(territory, { profession: 'x\\") } #', limit: 10, offset: 0 });
  const line = sparql.split('\n').find((l) => l.includes('CONTAINS'));
  assert.equal(line.trim(), 'FILTER(CONTAINS(LCASE(?occLabel), LCASE("x\\\\\\") } #")))');
});

test('ID Wikidata non validi non entrano nella query', () => {
  assert.throws(() => registry.buildRegistrySparql({ ...territory, municipality: { qid: 'Q1. } #' } }, { limit: 10, offset: 0 }));
});

test('solo figure pubbliche: serve una voce su Wikipedia', () => {
  assert.equal(registry.hasWikipediaArticle({ sitelinks: { itwiki: { title: 'X' } } }), true);
  assert.equal(registry.hasWikipediaArticle({ sitelinks: { zh_yuewiki: { title: 'X' } } }), true);
  assert.equal(registry.hasWikipediaArticle({ sitelinks: { commonswiki: { title: 'X' } } }), false);
  assert.equal(registry.hasWikipediaArticle({ sitelinks: {} }), false);
});

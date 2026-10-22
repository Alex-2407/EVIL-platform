#!/usr/bin/env node
/**
 * Genera le pagine di Primi passi da server/lib/primi-passi-content.js.
 *
 *   node scripts/build-primi-passi.js           scrive html/primi-passi.html, html/pp-<tappa>.html
 *                                               e i dizionari i18n/<lingua>/pages/<pagina>.json
 *   node scripts/build-primi-passi.js --check   controlla che i file sul disco siano aggiornati
 *                                               (esce con 1 se non lo sono; lo usa anche un test)
 *
 * Come funziona la generazione: scripts/lib/generated-pages.js.
 */
'use strict';

const C = require('../server/lib/primi-passi-content');
const { renderStage, renderOverview } = require('../server/lib/primi-passi-pages');
const { createGenerator } = require('./lib/generated-pages');

const gen = createGenerator({
  label: 'Primi passi',
  script: 'scripts/build-primi-passi.js',
  contentFile: 'server/lib/primi-passi-content.js',
  owns: /^pp-[a-z0-9-]+\.html$/,
  pages: () => [
    { file: C.OVERVIEW.file, render: (lang) => renderOverview(lang) },
    ...C.TAPPE.map((t) => ({ file: t.file, render: (lang) => renderStage(t, lang) })),
  ],
});

if (require.main === module) gen.main();

module.exports = { build: gen.build, check: gen.check, dictionary: gen.dictionary };

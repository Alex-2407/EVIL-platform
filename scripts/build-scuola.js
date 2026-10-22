#!/usr/bin/env node
/**
 * Genera le pagine di EVIL Scuola da server/lib/scuola-content.js.
 *
 *   node scripts/build-scuola.js           scrive html/scuola.html, html/scuola-<kit>.html
 *                                          e i dizionari i18n/<lingua>/pages/<pagina>.json
 *   node scripts/build-scuola.js --check   controlla che i file sul disco siano aggiornati
 *
 * Come funziona la generazione: scripts/lib/generated-pages.js.
 */
'use strict';

const S = require('../server/lib/scuola-content');
const { renderKit, renderLanding } = require('../server/lib/scuola-pages');
const { createGenerator } = require('./lib/generated-pages');

const gen = createGenerator({
  label: 'EVIL Scuola',
  script: 'scripts/build-scuola.js',
  contentFile: 'server/lib/scuola-content.js',
  owns: /^scuola-[a-z0-9-]+\.html$/,
  pages: () => [
    { file: S.PAGE.file, render: (lang) => renderLanding(lang) },
    ...S.KITS.map((k) => ({ file: k.file, render: (lang) => renderKit(k, lang) })),
  ],
});

if (require.main === module) gen.main();

module.exports = { build: gen.build, check: gen.check };

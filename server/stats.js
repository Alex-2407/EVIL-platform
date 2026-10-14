'use strict';
// Numeri mostrati in home (domande, lab, famiglie malware…) letti dai file di dati,
// così non vanno mai aggiornati a mano.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function loadBrowserData(files) {
  const ctx = vm.createContext({ console: { log() {}, warn() {}, error() {} } });
  ctx.window = ctx;
  for (const f of files) {
    try {
      vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f, timeout: 2000 });
    } catch (_) {
      /* un file mancante non deve fermare il server */
    }
  }
  return ctx;
}

function count(fn) {
  try {
    const n = fn();
    return Number.isFinite(n) ? n : null;
  } catch (_) {
    return null;
  }
}

function computeStats() {
  const w = loadBrowserData([
    'quiz-hub-data.js',
    'quiz-hub-data-extra.js',
    'malware-db-data.js',
    'historic-attacks-data.js',
    'hacked-timeline-data.js',
    'malware-classification-data.js',
    'quiz-hub-glossary.js',
    'virtual-lab-guides.js',
    'crypto-algorithms-data.js',
  ]);
  let labs = null;
  try {
    const lab = require('../services/virtual-lab-service');
    const cat = lab.catalogForClient();
    labs = Array.isArray(cat) ? cat.length : Object.keys(cat || {}).length;
  } catch (_) { /* opzionale */ }

  const cats = count(() => Object.keys(w.QUIZ_HUB.CATEGORIES).length);
  return {
    quizQuestions: count(() => Object.values(w.QUIZ_HUB.CATEGORIES).reduce((a, c) => a + (c.questions || []).length, 0)),
    quizCategories: cats,
    labs,
    malwareFamilies: count(() => w.MALWARE_DATABASE.length),
    breaches: count(() => w.HISTORIC_ATTACKS.length),
    irScenarios: count(() => {
      const s = w.INCIDENT_TIMELINE.SCENARIOS;
      return Array.isArray(s) ? s.length : Object.keys(s).length;
    }),
    cryptoAlgorithms: count(() => w.CRYPTO_ALGORITHMS.length),
    webVulns: 5,
    // termini distinti tra glossario del Centro quiz e del Lab virtuale (come la pagina Glossario)
    glossaryTerms: count(
      () =>
        new Set(
          [...Object.keys(w.QUIZ_GLOSSARY || {}), ...Object.keys(w.VLAB_GLOSSARY || {})].map((k) =>
            String(k).trim().toLowerCase()
          )
        ).size
    ),
    malwareCategories: count(() => w.MALWARE_TAXONOMY.categories.length),
  };
}

module.exports = { computeStats };

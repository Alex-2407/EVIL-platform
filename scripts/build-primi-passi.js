#!/usr/bin/env node
/**
 * Genera le pagine di Primi passi da server/lib/primi-passi-content.js.
 *
 *   node scripts/build-primi-passi.js           scrive html/primi-passi.html, html/pp-<tappa>.html
 *                                               e i dizionari i18n/<lingua>/pages/<pagina>.json
 *   node scripts/build-primi-passi.js --check   controlla che i file sul disco siano aggiornati
 *                                               (esce con 1 se non lo sono; lo usa anche un test)
 *
 * Ogni pagina viene costruita una volta per lingua con la stessa struttura: i blocchi traducibili
 * (server/i18n, listUnits) si accoppiano in ordine e diventano il dizionario della pagina.
 * Lo script si ferma se le due versioni non hanno la stessa struttura o se lo stesso testo
 * italiano avrebbe due traduzioni diverse.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const i18n = require('../server/i18n');
const C = require('../server/lib/primi-passi-content');
const { renderStage, renderOverview } = require('../server/lib/primi-passi-pages');

const root = path.resolve(__dirname, '..');
const HTML_DIR = path.join(root, 'html');
const MARKER = 'Generato da scripts/build-primi-passi.js';
const NOTE = 'Generato da scripts/build-primi-passi.js: modifica i testi in server/lib/primi-passi-content.js e rigenera.';

const OTHER_LANGS = i18n.LANGS.filter((l) => l !== i18n.DEFAULT_LANG);

function pages() {
  return [
    { file: C.OVERVIEW.file, render: (lang) => renderOverview(lang) },
    ...C.TAPPE.map((t) => ({ file: t.file, render: (lang) => renderStage(t, lang) })),
  ];
}

/** Dizionario di una pagina: blocchi italiani → blocchi nella lingua, nello stesso ordine. */
function dictionary(file, itHtml, otherHtml, lang) {
  const src = i18n.listUnits(itHtml);
  const dst = i18n.listUnits(otherHtml);
  if (src.length !== dst.length) {
    const firstDiff = src.findIndex((u, i) => !dst[i] || dst[i].kind !== u.kind);
    throw new Error(`${file} (${lang}): ${src.length} blocchi in italiano, ${dst.length} in ${lang}. Primo diverso: ${JSON.stringify(src[firstDiff])} / ${JSON.stringify(dst[firstDiff])}`);
  }
  const common = i18n.readJson(path.join(i18n.I18N_DIR, lang, 'common.json')) || {};
  const out = {};
  const problems = [];
  src.forEach((u, i) => {
    const v = dst[i];
    if (u.kind !== v.kind || u.name !== v.name) {
      problems.push(`blocco ${i}: ${u.kind}/${u.name} contro ${v.kind}/${v.name} (${u.key})`);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(common, u.key)) {
      if (common[u.key] !== v.key) problems.push(`«${u.key}» è già in common.json con un'altra traduzione: «${common[u.key]}» / «${v.key}»`);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(out, u.key) && out[u.key] !== v.key) {
      problems.push(`«${u.key}» ha due traduzioni: «${out[u.key]}» / «${v.key}»`);
      return;
    }
    out[u.key] = v.key;
  });
  if (problems.length) throw new Error(`${file} (${lang}):\n  ${problems.join('\n  ')}`);
  // stesso ordine e stessa forma che produrrebbe `node scripts/i18n.js extract`
  return { ...out, _note: NOTE };
}

/** Tutti i file da scrivere: [{ path, content }] */
function build() {
  const files = [];
  for (const p of pages()) {
    const it = p.render(i18n.DEFAULT_LANG);
    files.push({ path: path.join(HTML_DIR, p.file), content: it });
    for (const lang of OTHER_LANGS) {
      const dict = dictionary(p.file, it, p.render(lang), lang);
      files.push({
        path: path.join(i18n.I18N_DIR, lang, 'pages', p.file.replace(/\.html$/, '.json')),
        content: `${JSON.stringify(dict, null, 2)}\n`,
      });
    }
  }
  return files;
}

/** Pagine generate in passato che non esistono più nel contenuto (es. una tappa tolta). */
function staleFiles(files) {
  const wanted = new Set(files.map((f) => f.path));
  const out = [];
  for (const f of fs.readdirSync(HTML_DIR)) {
    if (!/^pp-[a-z0-9-]+\.html$/.test(f)) continue;
    const p = path.join(HTML_DIR, f);
    if (wanted.has(p) || !fs.readFileSync(p, 'utf8').includes(MARKER)) continue;
    out.push(p);
    for (const lang of OTHER_LANGS) {
      const j = path.join(i18n.I18N_DIR, lang, 'pages', f.replace(/\.html$/, '.json'));
      if (fs.existsSync(j)) out.push(j);
    }
  }
  return out;
}

function read(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_) {
    return null;
  }
}

/** Differenze tra i file generati e quelli sul disco (vuoto = tutto aggiornato). */
function check() {
  const files = build();
  const rel = (p) => path.relative(root, p).split(path.sep).join('/');
  const diff = files.filter((f) => read(f.path) !== f.content).map((f) => `da rigenerare: ${rel(f.path)}`);
  for (const p of staleFiles(files)) diff.push(`non più nel contenuto: ${rel(p)}`);
  return diff;
}

function main() {
  if (process.argv.includes('--check')) {
    const diff = check();
    if (diff.length) {
      console.error(`${diff.join('\n')}\n\nEsegui: node scripts/build-primi-passi.js`);
      process.exit(1);
    }
    console.log('Primi passi: file generati aggiornati.');
    return;
  }
  const files = build();
  let written = 0;
  for (const f of files) {
    if (read(f.path) === f.content) continue;
    fs.mkdirSync(path.dirname(f.path), { recursive: true });
    fs.writeFileSync(f.path, f.content);
    written++;
  }
  const stale = staleFiles(files);
  for (const p of stale) fs.unlinkSync(p);
  console.log(`Primi passi: ${files.length} file, ${written} aggiornati${stale.length ? `, ${stale.length} tolti` : ''}.`);
}

if (require.main === module) main();

module.exports = { build, check, dictionary };

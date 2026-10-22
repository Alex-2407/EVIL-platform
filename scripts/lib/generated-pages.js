'use strict';
/**
 * Pagine generate da un modulo di contenuti (Primi passi, EVIL Scuola).
 *
 * Ogni pagina viene costruita una volta per lingua con la stessa struttura: i blocchi traducibili
 * (server/i18n, listUnits) si accoppiano in ordine e diventano il dizionario della pagina.
 * Il generatore si ferma se le due versioni non hanno la stessa struttura o se lo stesso testo
 * italiano avrebbe due traduzioni diverse.
 *
 *   const gen = createGenerator({ label, script, contentFile, pages, owns });
 *   gen.main()    scrive i file (con --check controlla soltanto)
 *   gen.build()   [{ path, content }]
 *   gen.check()   differenze tra i file generati e quelli sul disco (vuoto = aggiornati)
 */

const fs = require('fs');
const path = require('path');
const i18n = require('../../server/i18n');

const root = path.resolve(__dirname, '..', '..');
const HTML_DIR = path.join(root, 'html');
const OTHER_LANGS = i18n.LANGS.filter((l) => l !== i18n.DEFAULT_LANG);

/**
 * @param {object} o
 * @param {string} o.label        nome per i messaggi ("Primi passi")
 * @param {string} o.script       percorso dello script ("scripts/build-primi-passi.js")
 * @param {string} o.contentFile  dove stanno i testi
 * @param {() => {file: string, render: (lang: string) => string}[]} o.pages
 * @param {RegExp} o.owns         nomi dei file html che questo generatore può creare (e togliere)
 */
function createGenerator({ label, script, contentFile, pages, owns }) {
  const MARKER = `Generato da ${script}`;
  const NOTE = `Generato da ${script}: modifica i testi in ${contentFile} e rigenera.`;

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

  /** Pagine generate in passato che non esistono più nel contenuto. */
  function staleFiles(files) {
    const wanted = new Set(files.map((f) => f.path));
    const out = [];
    for (const f of fs.readdirSync(HTML_DIR)) {
      if (!owns.test(f)) continue;
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

  function check() {
    const files = build();
    const rel = (p) => path.relative(root, p).split(path.sep).join('/');
    const diff = files.filter((f) => read(f.path) !== f.content).map((f) => `da rigenerare: ${rel(f.path)}`);
    for (const p of staleFiles(files)) diff.push(`non più nel contenuto: ${rel(p)}`);
    return diff;
  }

  function main(argv = process.argv) {
    if (argv.includes('--check')) {
      const diff = check();
      if (diff.length) {
        console.error(`${diff.join('\n')}\n\nEsegui: node ${script}`);
        process.exit(1);
      }
      console.log(`${label}: file generati aggiornati.`);
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
    console.log(`${label}: ${files.length} file, ${written} aggiornati${stale.length ? `, ${stale.length} tolti` : ''}.`);
  }

  return { build, check, main, dictionary };
}

module.exports = { createGenerator };

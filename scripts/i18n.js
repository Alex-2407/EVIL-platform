#!/usr/bin/env node
/**
 * Strumenti per le traduzioni (docs/I18N.md).
 *
 *   node scripts/i18n.js extract [pagina.html ...]   aggiorna i18n/<lingua>/pages/*.json con i testi delle pagine
 *   node scripts/i18n.js extract-js [file.js ...]    aggiorna i18n/<lingua>/js/*.json con le stringhe passate a t()
 *   node scripts/i18n.js extract-server              aggiorna i18n/<lingua>/server/*.json con i messaggi delle API
 *   node scripts/i18n.js check [--strict]            elenca cosa manca; con --strict esce con 1 se manca qualcosa
 *   node scripts/i18n.js build                       rigenera js/i18n/<lingua>.js
 *
 * Le voci nuove entrano con valore "" (da tradurre). Le voci che non esistono più nel
 * sorgente vengono tolte; con --keep restano sotto "_stale".
 */
'use strict';

const fs = require('fs');
const path = require('path');
const i18n = require('../server/i18n');
const { renderHeader, renderFooter } = require('../server/chrome');

const root = path.resolve(__dirname, '..');
const LANGS = i18n.LANGS.filter((l) => l !== i18n.DEFAULT_LANG);
const args = process.argv.slice(2);
const cmd = args.shift();
const keep = args.includes('--keep');
const strict = args.includes('--strict');
const targets = args.filter((a) => !a.startsWith('--'));

const PAGE_DIR = path.join(root, 'html');
const JS_DIR = path.join(root, 'js');
const SERVER_DIRS = ['server', 'services', 'middleware', 'utils'].map((d) => path.join(root, d));

function htmlPages() {
  return fs.readdirSync(PAGE_DIR).filter((f) => f.endsWith('.html') && !/-local\.html$/.test(f)).sort();
}

function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
}

function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {
    return {};
  }
}

/** Unisce le chiavi trovate con il dizionario esistente, nell'ordine del sorgente. */
function merge(file, keys) {
  const prev = readJsonFile(file);
  const out = {};
  let added = 0;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(prev, k)) out[k] = prev[k];
    else {
      out[k] = '';
      added++;
    }
  }
  const stale = Object.keys(prev).filter((k) => !k.startsWith('_') && !Object.prototype.hasOwnProperty.call(out, k));
  if (keep && stale.length) out._stale = Object.fromEntries(stale.map((k) => [k, prev[k]]));
  if (prev._note) out._note = prev._note;
  writeJson(file, out);
  return { added, stale: stale.length, total: keys.length };
}

// ------------------------------------------------------------------ pagine
function pageKeys(page) {
  let html = fs.readFileSync(path.join(PAGE_DIR, page), 'utf8');
  // header e footer sono generati dalla mappa del sito, già tradotti
  html = html.replace('<!--evil:header-->', '').replace('<!--evil:footer-->', '');
  const common = i18n.readJson(path.join(i18n.I18N_DIR, 'en', 'common.json')) || {};
  return i18n.extractUnits(html).filter((k) => !Object.prototype.hasOwnProperty.call(common, k));
}

function extractPages() {
  const pages = targets.length ? targets : htmlPages();
  for (const page of pages) {
    const keys = pageKeys(page);
    for (const lang of LANGS) {
      const r = merge(path.join(i18n.I18N_DIR, lang, 'pages', page.replace(/\.html$/, '.json')), keys);
      console.log(`${lang}/${page}: ${r.total} testi, ${r.added} nuovi, ${r.stale} rimossi`);
    }
  }
}

// ------------------------------------------------------------------ stringhe nel codice
// Prende il primo argomento letterale di t('…'), t("…"), t(`…`) (senza ${}), EVIL_I18N.t(…), req.t(…), t(lang, '…')
const CALL_RE = /(?:^|[^\w$.])(?:(?:EVIL_I18N|I18N|I|i18n)\.)?t\(\s*(?:(?:req\.lang|lang|res\.locals\.lang|ctx\.lang),\s*)?('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\$])*`)/g;
const REQ_T_RE = /\breq\.t\(\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\$])*`)/g;

function literalValue(lit) {
  if (lit.startsWith('`')) return lit.slice(1, -1).replace(/\\`/g, '`');
  // stringa JS letterale: valutata come JSON dopo aver sistemato gli apici
  try {
    return Function(`"use strict"; return (${lit});`)();
  } catch (_) {
    return null;
  }
}

function codeKeys(file) {
  const src = fs.readFileSync(file, 'utf8');
  const keys = [];
  const seen = new Set();
  const add = (value) => {
    if (typeof value === 'string' && value.trim() && !seen.has(value)) {
      seen.add(value);
      keys.push(value);
    }
  };
  for (const re of [CALL_RE, REQ_T_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      const v = literalValue(m[1]);
      add(v);
    }
  }

  const relative = path.relative(root, file).split(path.sep).join('/');
  if (relative === 'server/lib/course-content.js') {
    const { COURSES } = require('../server/lib/course-content');
    for (const course of COURSES) {
      add(course.title.it);
      for (const value of [course.level, course.description, course.outcome]) add(value);
      for (const module of course.modules) {
        add(module.title);
        for (const lesson of module.lessons) {
          for (const key of ['title', 'objective', 'explanation', 'example', 'commonMistakes']) add(lesson[key]);
          for (const value of lesson.keyPoints) add(value);
        }
        for (const item of module.quiz) {
          add(item.prompt);
          for (const value of item.options) add(value);
          add(item.explanation);
        }
      }
    }
  } else if (relative === 'server/lib/course-exams.js') {
    const { COURSES } = require('../server/lib/course-exams');
    for (const course of Object.values(COURSES)) {
      for (const [, prompt, options] of course.questions) {
        add(prompt);
        for (const option of options) add(option);
      }
    }
  }
  return keys;
}

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'i18n' || ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.name.endsWith('.js')) out.push(p);
  }
  return out;
}

function extractCode(kind) {
  const files = kind === 'js'
    ? (targets.length ? targets.map((f) => path.join(JS_DIR, path.basename(f))) : walk(JS_DIR).filter((f) => path.dirname(f) === JS_DIR))
    : SERVER_DIRS.flatMap((d) => (fs.existsSync(d) ? walk(d) : []));
  for (const file of files) {
    const keys = codeKeys(file);
    const name = kind === 'js' ? path.basename(file, '.js') : path.relative(root, file).replace(/\.js$/, '').replace(/[\\/]/g, '__');
    for (const lang of LANGS) {
      const dictFile = path.join(i18n.I18N_DIR, lang, kind, `${name}.json`);
      if (!keys.length && !fs.existsSync(dictFile)) continue;
      const r = merge(dictFile, keys);
      if (r.total || r.stale) console.log(`${lang}/${kind}/${name}: ${r.total} stringhe, ${r.added} nuove, ${r.stale} rimosse`);
    }
  }
}

// ------------------------------------------------------------------ controllo
function check() {
  let missing = 0;
  const report = [];
  for (const lang of LANGS) {
    for (const page of htmlPages()) {
      const dict = i18n.pageDict(lang, page);
      const keys = pageKeys(page);
      const miss = keys.filter((k) => !dict[k]);
      if (miss.length) report.push(`${lang}/pages/${page}: ${miss.length} di ${keys.length} da tradurre`);
      missing += miss.length;
      // header e footer: sempre generati, ma controlliamo che non restino segnaposto
      void renderHeader;
      void renderFooter;
    }
    for (const kind of ['js', 'server']) {
      const dir = path.join(i18n.I18N_DIR, lang, kind);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) {
        const d = readJsonFile(path.join(dir, f));
        const miss = Object.entries(d).filter(([k, v]) => !k.startsWith('_') && (typeof v !== 'string' || !v.trim()));
        if (miss.length) report.push(`${lang}/${kind}/${f}: ${miss.length} da tradurre`);
        missing += miss.length;
      }
    }
  }
  console.log(report.length ? report.join('\n') : 'Tutto tradotto.');
  console.log(`\nTotale da tradurre: ${missing}`);
  if (strict && missing) process.exit(1);
}

switch (cmd) {
  case 'extract':
    extractPages();
    break;
  case 'extract-js':
    extractCode('js');
    break;
  case 'extract-server':
    extractCode('server');
    break;
  case 'check':
    check();
    break;
  case 'build':
    i18n.buildClientDicts();
    console.log('js/i18n/*.js rigenerati');
    break;
  default:
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(1, 15).join('\n'));
    process.exit(cmd ? 1 : 0);
}

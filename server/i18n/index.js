'use strict';
// Traduzioni di EVIL.
//
// L'italiano è la lingua sorgente: le pagine in html/ sono scritte in italiano e
// la versione inglese (/en/...) si ottiene sostituendo i "blocchi di testo" con le
// traduzioni dei dizionari in i18n/<lingua>/:
//   pages/<pagina>.json   blocchi di testo e attributi di una pagina HTML
//   common.json           blocchi comuni a più pagine
//   js/<file>.json        stringhe dei file in js/ passate a EVIL_I18N.t()
//   server/<file>.json    messaggi delle API passati a t(lang, …)
// Le chiavi sono il testo italiano normalizzato (spazi compressi), i valori la traduzione.
// Vedi docs/I18N.md.

const fs = require('fs');
const path = require('path');
const { parse } = require('node-html-parser');
const { LANGS, DEFAULT_LANG } = require('../site-map');

const root = path.resolve(__dirname, '..', '..');
const I18N_DIR = path.join(root, 'i18n');

// ------------------------------------------------------------------ dizionari
const jsonCache = new Map();

function readJson(file) {
  let st;
  try {
    st = fs.statSync(file);
  } catch (_) {
    return null;
  }
  const hit = jsonCache.get(file);
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.data;
  let data = null;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn(`⚠️ i18n: ${path.relative(root, file)} non è JSON valido: ${err.message}`);
  }
  jsonCache.set(file, { mtimeMs: st.mtimeMs, size: st.size, data });
  return data;
}

function readDir(lang, kind) {
  const dir = path.join(I18N_DIR, lang, kind);
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  } catch (_) {
    return {};
  }
  const out = {};
  for (const f of files) Object.assign(out, cleanDict(readJson(path.join(dir, f))));
  return out;
}

/** Toglie le voci vuote (non ancora tradotte) e le chiavi di servizio che iniziano con "_". */
function cleanDict(d) {
  const out = {};
  if (!d || typeof d !== 'object') return out;
  for (const [k, v] of Object.entries(d)) {
    if (k.startsWith('_') || typeof v !== 'string' || !v.trim()) continue;
    out[k] = v;
  }
  return out;
}

function pageDict(lang, pageName) {
  const common = cleanDict(readJson(path.join(I18N_DIR, lang, 'common.json')));
  const page = pageName ? cleanDict(readJson(path.join(I18N_DIR, lang, 'pages', `${pageName.replace(/\.html$/, '')}.json`))) : {};
  return { ...common, ...page };
}

const serverDictCache = new Map();
function serverDict(lang) {
  // in sviluppo si rilegge (mtime in cache), in produzione basta una volta
  const key = lang;
  if (process.env.NODE_ENV === 'production' && serverDictCache.has(key)) return serverDictCache.get(key);
  const d = readDir(lang, 'server');
  serverDictCache.set(key, d);
  return d;
}

function format(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m));
}

/** Traduce un messaggio del server. Il testo italiano è la chiave. */
function t(lang, str, vars) {
  if (!lang || lang === DEFAULT_LANG) return format(str, vars);
  const d = serverDict(lang);
  return format(Object.prototype.hasOwnProperty.call(d, str) ? d[str] : str, vars);
}

// ------------------------------------------------------------------ lingua della richiesta
function normalizeLang(v) {
  const l = String(v || '').toLowerCase().slice(0, 2);
  return LANGS.includes(l) ? l : null;
}

/**
 * Lingua di una richiesta API: header X-EVIL-Lang, poi cookie evil_lang (lo imposta
 * js/i18n.js a ogni pagina), poi la pagina di provenienza (/en/...). Default italiano.
 */
function langOf(req) {
  if (!req) return DEFAULT_LANG;
  const h = normalizeLang(req.get && req.get('x-evil-lang'));
  if (h) return h;
  const c = normalizeLang(req.cookies && req.cookies.evil_lang);
  if (c) return c;
  const ref = (req.get && req.get('referer')) || '';
  const m = /^https?:\/\/[^/]+\/([a-z]{2})(?:\/|$)/i.exec(ref);
  if (m && normalizeLang(m[1]) && m[1].toLowerCase() !== DEFAULT_LANG) return m[1].toLowerCase();
  return DEFAULT_LANG;
}

function i18nMiddleware(req, res, next) {
  req.lang = langOf(req);
  req.t = (str, vars) => t(req.lang, str, vars);
  next();
}

// ------------------------------------------------------------------ blocchi di testo nelle pagine
// Un "blocco" è un elemento che contiene testo e solo elementi in linea (a, strong, em, code…):
// si traduce tutto il suo innerHTML, così la frase resta intera con i suoi link.
const INLINE = new Set([
  'a', 'abbr', 'b', 'bdi', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'img', 'kbd', 'mark', 'q', 's',
  'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr',
]);
const SKIP = new Set(['script', 'style', 'noscript', 'template', 'svg', 'pre', 'textarea', 'math']);
const ATTRS = ['title', 'alt', 'placeholder', 'aria-label', 'aria-description', 'aria-roledescription', 'data-tooltip', 'data-label', 'label'];
const META_CONTENT = /^(description|og:title|og:description|twitter:title|twitter:description)$/i;

function normalize(s) {
  return String(s).replace(/\s+/g, ' ').trim();
}

function hasWords(s) {
  return /\p{L}{2,}/u.test(String(s).replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, ' '));
}

function tagOf(el) {
  return (el.rawTagName || el.tagName || '').toLowerCase();
}

function isSkipped(el) {
  const tag = tagOf(el);
  if (SKIP.has(tag)) return true;
  const tr = el.getAttribute && el.getAttribute('translate');
  if (tr === 'no') return true;
  const di = el.getAttribute && el.getAttribute('data-i18n');
  return di === 'skip';
}

function inlineOnly(el) {
  for (const c of el.childNodes) {
    if (c.nodeType === 1) {
      if (!INLINE.has(tagOf(c)) || isSkipped(c) || !inlineOnly(c)) return false;
    }
  }
  return true;
}

function hasText(el) {
  return el.childNodes.some((c) => (c.nodeType === 3 ? c.rawText.trim() !== '' : c.nodeType === 1 && hasText(c)));
}

/**
 * Visita i blocchi traducibili. visit(unit) riceve:
 *   { kind: 'html', el, key } | { kind: 'text', node, key } | { kind: 'attr', el, name, key }
 */
function collectUnits(node, visit) {
  if (node.nodeType === 3) {
    const key = normalize(node.rawText);
    if (key && hasWords(key)) visit({ kind: 'text', node, key });
    return;
  }
  if (node.nodeType !== 1 && !node.childNodes) return;
  const el = node;
  const tag = tagOf(el);
  if (tag && isSkipped(el)) return;

  if (tag && el.getAttribute) {
    for (const name of ATTRS) {
      const v = el.getAttribute(name);
      if (v && hasWords(v)) visit({ kind: 'attr', el, name, key: normalize(v) });
    }
    if (tag === 'meta') {
      const n = el.getAttribute('name') || el.getAttribute('property') || '';
      const v = el.getAttribute('content');
      if (META_CONTENT.test(n) && v && hasWords(v)) visit({ kind: 'attr', el, name: 'content', key: normalize(v) });
    }
    if (tag === 'input') {
      const type = (el.getAttribute('type') || '').toLowerCase();
      const v = el.getAttribute('value');
      if (/^(submit|button|reset)$/.test(type) && v && hasWords(v)) visit({ kind: 'attr', el, name: 'value', key: normalize(v) });
    }
  }

  const container = !tag || tag === 'html' || tag === 'head' || tag === 'body';
  if (!container && el.childNodes.length && hasText(el) && inlineOnly(el)) {
    const key = normalize(el.innerHTML);
    // gli attributi degli elementi in linea (title di un link, alt di un'immagine) fanno
    // parte dell'innerHTML: si traducono insieme alla frase
    if (hasWords(key)) visit({ kind: 'html', el, key });
    return;
  }
  for (const c of el.childNodes || []) collectUnits(c, visit);
}

const PARSE_OPTS = { comment: true, blockTextElements: { script: true, noscript: true, style: true, pre: true, textarea: true } };

function escapeAttr(s) {
  return String(s).replace(/&(?!(?:[a-z]+|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Elenca i blocchi traducibili di un HTML (per lo script di estrazione). */
function extractUnits(html) {
  const doc = parse(html, PARSE_OPTS);
  const keys = [];
  const seen = new Set();
  collectUnits(doc, (u) => {
    if (seen.has(u.key)) return;
    seen.add(u.key);
    keys.push(u.key);
  });
  return keys;
}

/**
 * Traduce un HTML italiano. Restituisce { html, missing } dove missing sono i blocchi
 * senza traduzione (restano in italiano).
 */
function translateHtml(html, lang, pageName) {
  if (!lang || lang === DEFAULT_LANG) return { html, missing: [] };
  const dict = pageDict(lang, pageName);
  const doc = parse(html, PARSE_OPTS);
  const missing = [];
  collectUnits(doc, (u) => {
    const tr = dict[u.key];
    if (tr == null) {
      missing.push(u.key);
      return;
    }
    if (u.kind === 'html') u.el.set_content(tr);
    else if (u.kind === 'text') {
      const raw = u.node.rawText;
      const lead = raw.match(/^\s*/)[0];
      const trail = raw.match(/\s*$/)[0];
      u.node.rawText = lead + tr + trail;
    } else u.el.setAttribute(u.name, escapeAttr(tr));
  });
  return { html: doc.toString(), missing };
}

// ------------------------------------------------------------------ dizionario per il browser
/** Scrive js/i18n/<lang>.js con le stringhe dei file JS (window.EVIL_I18N_DICT). */
function buildClientDicts() {
  const outDir = path.join(root, 'js', 'i18n');
  fs.mkdirSync(outDir, { recursive: true });
  for (const lang of LANGS) {
    if (lang === DEFAULT_LANG) continue;
    const dict = readDir(lang, 'js');
    const body =
      '/* Generato da server/i18n (npm run build): non modificare a mano, modifica i18n/' +
      `${lang}/js/*.json */\nwindow.EVIL_I18N_DICT = ${JSON.stringify(dict)};\n`;
    const file = path.join(outDir, `${lang}.js`);
    let prev = null;
    try {
      prev = fs.readFileSync(file, 'utf8');
    } catch (_) { /* nuovo */ }
    if (prev !== body) fs.writeFileSync(file, body);
  }
}

module.exports = {
  LANGS,
  DEFAULT_LANG,
  I18N_DIR,
  t,
  format,
  langOf,
  normalizeLang,
  i18nMiddleware,
  translateHtml,
  extractUnits,
  normalize,
  pageDict,
  buildClientDicts,
  readJson,
};

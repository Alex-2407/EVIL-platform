#!/usr/bin/env node
/**
 * Cerca caratteri corrotti nei file del sito (HTML, CSS, JS, JSON, Markdown).
 * Esce con codice 1 se trova qualcosa: viene eseguito anche dalla CI.
 *
 * Cosa riconosce:
 * - testo UTF-8 letto come Windows-1252 ("âš–" al posto di "⚖", "Ã¨" al posto di "è")
 * - carattere di sostituzione U+FFFD
 * - emoji diventate "??" nel testo delle pagine e nelle stringhe
 * - lettere accentate diventate un trattino lungo attaccato alla parola ("propriet—")
 *
 * Uso: node scripts/find-encoding-issues.js [cartella]
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'logs', 'data', 'uploads', 'coverage']);
const EXTS = new Set(['.html', '.css', '.js', '.json', '.md']);
const SELF = path.resolve(__filename);

// Caratteri che compaiono quando i byte di un carattere UTF-8 vengono letti come Windows-1252
const CP1252_TAIL = '[\\u0080-\\u00BF\\u0152\\u0153\\u0160\\u0161\\u0178\\u017D\\u017E\\u0192\\u02C6\\u02DC\\u2013\\u2014\\u2018-\\u201E\\u2020-\\u2022\\u2026\\u2030\\u2039\\u203A\\u20AC\\u2122]';

const CHECKS = [
  { label: 'UTF-8 letto come Windows-1252', re: new RegExp(`[âðÃ]${CP1252_TAIL}`, 'g') },
  { label: 'UTF-8 letto come Latin-1 (Â)', re: /Â[\u0080-¿]/g },
  { label: 'carattere di sostituzione U+FFFD', re: /�/g },
  { label: 'lettera accentata diventata "—"', re: /[A-Za-z]—(?=[\s.,;:!?)<'"`/]|$)/gm },
  { label: '"×" diventato "—"', re: /[">]—\d/g },
];

// "??" come emoji perduta: nell'HTML fuori dagli script, nel JS solo dentro le stringhe
// (così l'operatore ?? non viene segnalato)
const QQ_TEXT = /(?:^|[>\s])\?\?(?=[\s<]|$)/gm;
const QQ_STRING = /(['"`])\?\?\s/g;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (EXTS.has(path.extname(name)) && path.resolve(p) !== SELF && !name.endsWith('.min.js')) out.push(p);
  }
  return out;
}

function report(file, text, index, label) {
  const line = text.slice(0, index).split('\n').length;
  const ctx = text.slice(Math.max(0, index - 30), index + 40).replace(/\s+/g, ' ');
  console.log(`${path.relative(root, file)}:${line}  ${label}\n    …${ctx}…`);
}

let total = 0;
for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const { re, label } of CHECKS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      total += 1;
      report(file, text, m.index, label);
    }
  }
  const ext = path.extname(file);
  if (ext === '.html' || ext === '.md') {
    // solo il testo fuori da <script> e <style>
    const visible = text.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (m) => ' '.repeat(m.length));
    for (const m of visible.matchAll(QQ_TEXT)) {
      total += 1;
      report(file, text, m.index, 'emoji diventata "??"');
    }
  }
  if (ext === '.html' || ext === '.js') {
    for (const m of text.matchAll(QQ_STRING)) {
      total += 1;
      report(file, text, m.index, 'emoji diventata "??" in una stringa');
    }
  }
}

if (total) {
  console.log(`\n${total} problemi di codifica trovati.`);
  process.exit(1);
}
console.log('Nessun problema di codifica trovato.');

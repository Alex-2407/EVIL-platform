#!/usr/bin/env node
/**
 * Corregge sequenze UTF-8 interpretate come Latin-1 (â–¾, Â·, â€", …).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'html');

const REPLACEMENTS = [
  ['â–¾', '▾'],
  ['â–¼', '▾'],
  ['Â·', '·'],
  ['Â«', '«'],
  ['Â»', '»'],
  ['Â©', '©'],
  ['â€"', '—'],
  ['â€"', '—'],
  ['â€¦', '…'],
  ['â€º', '›'],
  ['â€"', '—'],
  ['piÃ¹', 'più'],
  ['PiÃ¹', 'Più'],
  ['piÃƒÂ¹', 'più'],
  ['vulnerabilitÃ ', 'vulnerabilità'],
  ['vulnerabilitÃ\u00a0', 'vulnerabilità'],
  ['vulnerabilitÃ\u00a0', 'vulnerabilità'],
  ['PerchÃ©', 'Perché'],
  ['perchÃ©', 'perché'],
  ['attivitÃ ', 'attività'],
  ['lâ€™', "l'"],
  ['Lâ€™', "L'"],
  ['Ã¨', 'è'],
  ['Ã©', 'é'],
  ['Ã¹', 'ù'],
  ['Ã²', 'ò'],
  ['Ã ', 'à'],
  ['â€™', "'"],
  ['â€œ', '"'],
  ['â€\u009d', '"'],
];

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

function fix(text) {
  let s = text;
  for (const [from, to] of REPLACEMENTS) {
    s = s.split(from).join(to);
  }
  return s;
}

let n = 0;
for (const fp of walk(root)) {
  const before = fs.readFileSync(fp, 'utf8');
  const after = fix(before);
  if (after !== before) {
    fs.writeFileSync(fp, after, 'utf8');
    n++;
    console.log('fixed:', path.relative(root, fp));
  }
}
console.log(n ? `\n${n} file corretti` : 'Nessun mojibake trovato');

#!/usr/bin/env node
/**
 * Corregge UTF-8 salvato come testo Latin-1/CP1252 (â€", Ã¨, ðŸ'¡, â†', …).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skipDirs = new Set(['node_modules', '.git', 'dist', 'build']);
const skipFiles = new Set(['fix-mojibake-html.js', 'fix-encoding.js', 'fix-encoding-pass2.js', 'find-encoding-issues.js']);
const exts = new Set(['.html', '.js', '.css', '.md', '.json', '.txt']);

/** Unicode (da byte UTF-8 letto come CP1252) → byte originale */
const CP1252_TO_BYTE = new Map([
  [0x20ac, 0x80],
  [0x2019, 0x92],
  [0x2018, 0x91],
  [0x201c, 0x93],
  [0x201d, 0x94],
  [0x2020, 0x86],
  [0x2021, 0x87],
  [0x2013, 0x96],
  [0x2014, 0x97],
  [0x2026, 0x85],
  [0x2039, 0x8b],
  [0x203a, 0x9b],
  [0x0178, 0x9f],
  [0x0192, 0x83],
  [0x02dc, 0x98],
  [0x2122, 0x99],
]);

const REPLACEMENTS = [
  ['\u00e2\u20ac\u201d', '—'],
  ['\u00e2\u20ac\u201c', '—'],
  ['\u00e2\u20ac\u2013', '–'],
  ['\u00e2\u20ac\u2014', '—'],
  ['\u00e2\u20ac\u2019', "'"],
  ['\u00e2\u20ac\u2018', "'"],
  ['\u00e2\u20ac\u2026', '…'],
  ['\u00e2\u2013\u00b6', '▶'],
  ['\u00e2\u2020\u2019', '→'],
  ['\u00e2\u2020\u0090', '←'],
  ['â–¾', '▾'],
  ['â–¶', '▶'],
  ['Â·', '·'],
  ['Â«', '«'],
  ['Â»', '»'],
  ['Â©', '©'],
];

function repairUtf8Runs(s) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const cp = s.charCodeAt(i);
    const maybeMojibake =
      cp === 0xf0 ||
      cp === 0xe2 ||
      cp === 0xc3 ||
      (cp > 0x7f && CP1252_TO_BYTE.has(cp));

    if (maybeMojibake) {
      const bytes = [];
      let j = i;
      while (j < s.length && j < i + 14) {
        const c = s.charCodeAt(j);
        if (c <= 0xff) {
          bytes.push(c);
          j++;
          continue;
        }
        if (CP1252_TO_BYTE.has(c)) {
          bytes.push(CP1252_TO_BYTE.get(c));
          j++;
          continue;
        }
        break;
      }
      if (bytes.length >= 2) {
        try {
          const decoded = Buffer.from(bytes).toString('utf8');
          if (decoded && !decoded.includes('\uFFFD')) {
            out += decoded;
            i = j;
            continue;
          }
        } catch {
          /* keep scanning */
        }
      }
    }
    out += s[i++];
  }
  return out;
}

function fixUtf8Pairs(s) {
  return s.replace(/[\u00c0-\u00df][\u0080-\u00bf\u00a0]/g, (m) => {
    try {
      const out = Buffer.from([m.charCodeAt(0), m.charCodeAt(1)]).toString('utf8');
      return out.length === 1 ? out : m;
    } catch {
      return m;
    }
  });
}

function fix(text) {
  let s = text;
  for (const [from, to] of REPLACEMENTS) {
    s = s.split(from).join(to);
  }
  s = repairUtf8Runs(s);
  s = fixUtf8Pairs(s);
  return s;
}

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(name).toLowerCase()) && !skipFiles.has(name)) out.push(p);
  }
  return out;
}

const badRe = /â€|â†|â–|ðŸ|Ã[\u0080-\u00bf\u00a0]|Â[^a-z·«»©]/;

let files = 0;
for (const fp of walk(root)) {
  let before = fs.readFileSync(fp, 'utf8');
  let after = fix(before);
  let pass = 0;
  while (after !== before && pass < 5) {
    before = after;
    after = fix(before);
    pass++;
  }
  if (after !== fs.readFileSync(fp, 'utf8')) {
    fs.writeFileSync(fp, after, 'utf8');
    files++;
    console.log('fixed:', path.relative(root, fp));
  }
}

const left = walk(root).filter((fp) => badRe.test(fs.readFileSync(fp, 'utf8')));
if (left.length) {
  console.log('\nRimanenti:', left.map((f) => path.relative(root, f)).join(', '));
}
console.log(files ? `\n${files} file corretti` : 'Nessun mojibake trovato');

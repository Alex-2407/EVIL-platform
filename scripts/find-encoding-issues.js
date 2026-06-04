#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const skip = new Set(['node_modules', '.git', 'dist', 'build']);
const exts = new Set(['.html', '.css', '.js', '.json', '.md']);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (exts.has(path.extname(name))) out.push(p);
  }
  return out;
}

const checks = [
  { re: /\uFFFD/g, label: 'U+FFFD replacement' },
  { re: /Ã[\x80-\xBF]?./g, label: 'UTF-8 mojibake (Ã)' },
  { re: /â€[™œžŸ]/g, label: 'UTF-8 mojibake (â€)' },
  { re: /Â[\x80-\xBF]?./g, label: 'UTF-8 mojibake (Â)' },
  { re: /[\x80-\x9F]/g, label: 'Windows-1252 control chars' },
];

let total = 0;
for (const file of walk(root)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const { re, label } of checks) {
    const m = text.match(re);
    if (m && m.length) {
      total += m.length;
      const rel = path.relative(root, file);
      const idx = text.search(re);
      const line = text.slice(0, idx).split('\n').length;
      const ctx = text.slice(Math.max(0, idx - 20), idx + 40).replace(/\n/g, ' ');
      console.log(`${rel}:${line} [${label}] x${m.length}`);
      console.log(`  ...${ctx}...`);
    }
  }
}
console.log(total ? `\nTotal issues: ${total}` : 'No encoding issues found');

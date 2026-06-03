#!/usr/bin/env node
/** Sostituisce ethical-hacking → crypto-studio in tutte le pagine HTML */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlDir = path.join(root, 'html');

const FROM_LINK = 'ethical-hacking.html';
const TO_LINK = 'crypto-studio.html';
const FROM_LABEL = 'Tutorial Ethical Hacking';
const TO_LABEL = 'Studio Cifratura';

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (name === 'components' || !name.startsWith('.')) walk(p, acc);
    } else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

let n = 0;
for (const file of walk(htmlDir)) {
  let c = fs.readFileSync(file, 'utf8');
  const before = c;
  c = c.split(FROM_LINK).join(TO_LINK).split(FROM_LABEL).join(TO_LABEL);
  if (c !== before) {
    fs.writeFileSync(file, c, 'utf8');
    console.log('✓', path.relative(root, file));
    n++;
  }
}

console.log(`\nAggiornati ${n} file HTML.`);

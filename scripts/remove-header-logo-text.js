const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const re = /\r?\n\s*<div class="logo">EVIL<\/div>/g;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.endsWith('.html')) continue;
    const html = fs.readFileSync(full, 'utf8');
    const next = html.replace(re, '');
    if (next !== html) {
      fs.writeFileSync(full, next, 'utf8');
      console.log('OK:', path.relative(htmlDir, full));
    }
  }
}

walk(htmlDir);

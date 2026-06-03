#!/usr/bin/env node
/**
 * Ripristina la home alla Versione 1 (backup in backups/home-version-1/)
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'backups', 'home-version-1');
const files = [
  ['home.html', path.join(root, 'html', 'home.html')],
  ['home.css', path.join(root, 'css', 'home.css')],
  ['home-experience.js', path.join(root, 'js', 'home-experience.js')]
];

let ok = 0;
files.forEach(([name, dest]) => {
  const from = path.join(src, name);
  if (!fs.existsSync(from)) {
    console.error('Manca backup:', from);
    return;
  }
  fs.copyFileSync(from, dest);
  console.log('✓', dest);
  ok++;
});

if (ok === files.length) {
  console.log('\nHome ripristinata alla Versione 1.');
} else {
  process.exit(1);
}

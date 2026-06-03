#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'backups', 'home-version-5');
const files = [
  ['home.html', 'html/home.html'],
  ['home.css', 'css/home.css'],
  ['home-experience.js', 'js/home-experience.js']
];
files.forEach(([name, rel]) => {
  const from = path.join(src, name);
  if (!fs.existsSync(from)) {
    console.error('Manca backup:', from);
    process.exit(1);
  }
  fs.copyFileSync(from, path.join(root, rel));
  console.log('✓', rel);
});
console.log('\nHome ripristinata alla Versione 5.');

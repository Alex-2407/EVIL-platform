#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = path.join(root, 'backups', 'home-version-2');
[['home.html', 'html/home.html'], ['home.css', 'css/home.css'], ['home-experience.js', 'js/home-experience.js']].forEach(
  ([name, rel]) => {
    fs.copyFileSync(path.join(src, name), path.join(root, rel));
    console.log('✓', rel);
  }
);
console.log('\nHome ripristinata alla Versione 2.');

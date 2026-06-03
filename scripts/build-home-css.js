/**
 * Rigenera css/home.bundle.css da hero + unified + motion + footer.
 * Esegui dopo modifiche: node scripts/build-home-css.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cssDir = path.join(root, 'css');
const parts = ['home-hero.css', 'home-unified.css', 'home-motion.css', 'home-footer.css'];

let bundle = '/* home.bundle.css — generato da scripts/build-home-css.js */\n';

for (const file of parts) {
  const full = path.join(cssDir, file);
  if (!fs.existsSync(full)) {
    console.error('Manca:', file);
    process.exit(1);
  }
  bundle += `\n/* === ${file} === */\n`;
  bundle += fs.readFileSync(full, 'utf8');
}

const out = path.join(cssDir, 'home.bundle.css');
fs.writeFileSync(out, bundle, 'utf8');
console.log('OK:', out, `(${bundle.length} byte)`);

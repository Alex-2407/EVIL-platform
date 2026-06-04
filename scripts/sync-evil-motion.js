#!/usr/bin/env node
/**
 * Inietta evil-motion.css/js in tutte le pagine HTML (backup oltre a server injectPageAssets).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlDir = path.join(root, 'html');
const MOTION_CSS = '  <link rel="stylesheet" href="/css/evil-motion.css?v=20260626">';
const MOTION_JS = '  <script src="/js/evil-motion.js?v=20260626" defer></script>';
const SKIP = new Set(['logo-easter-egg.html', 'confirm-email.html', 'trophy-preview-local.html']);

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walkHtml(full, out);
      continue;
    }
    if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function injectMotion(content) {
  let out = content;
  if (!out.includes('evil-motion.css')) {
    if (out.includes('site-header.css')) {
      out = out.replace(
        /(<link rel="stylesheet" href="[^"]*site-header\.css[^"]*">)/,
        `$1\n${MOTION_CSS}`
      );
    } else if (out.includes('</head>')) {
      out = out.replace('</head>', `${MOTION_CSS}\n</head>`);
    }
  }
  if (!out.includes('evil-motion.js') && out.includes('</head>')) {
    out = out.replace('</head>', `${MOTION_JS}\n</head>`);
  }
  return out;
}

let updated = 0;
walkHtml(htmlDir).forEach((filePath) => {
  const rel = path.relative(htmlDir, filePath).replace(/\\/g, '/');
  if (SKIP.has(rel) || rel.startsWith('components/')) return;
  const before = fs.readFileSync(filePath, 'utf8');
  const after = injectMotion(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after, 'utf8');
    updated += 1;
    console.log('✓', rel);
  }
});

console.log(`Completato: ${updated} file aggiornati.`);

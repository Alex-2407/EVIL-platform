#!/usr/bin/env node
/**
 * Aggiunge il link Help nel footer (colonna Legale) senza alterare layout/CSS.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlDir = path.join(root, 'html');
const HELP = '<a href="help.html" class="evil-site-foot__link">Help</a>';

function patch(content) {
  if (content.includes('href="help.html"')) return null;

  let next = content;

  // Policy · GitHub → Policy · Help · GitHub
  if (next.includes('site-policies.html') && next.includes('github.com')) {
    next = next.replace(
      /(<a href="site-policies\.html" class="evil-site-foot__link">Policy del sito<\/a>)\s*·\s*/,
      `$1\n        ·\n        ${HELP}\n        ·\n        `
    );
    if (next !== content) return next;
  }

  // Solo Policy → Policy · Help
  if (next.includes('site-policies.html')) {
    next = next.replace(
      /(<p class="evil-site-foot__copy">\s*\n?\s*<a href="site-policies\.html" class="evil-site-foot__link">Policy del sito<\/a>)\s*(\n\s*<\/p>)/,
      `$1\n        ·\n        ${HELP}$2`
    );
    if (next !== content) return next;
  }

  // Solo GitHub → Help · GitHub
  if (next.includes('evil-site-foot__link') && next.includes('github.com')) {
    next = next.replace(
      /(<p class="evil-site-foot__copy">\s*\n?\s*)(<a href="https:\/\/github\.com")/g,
      `$1${HELP}\n        ·\n        $2`
    );
    if (next !== content) return next;
  }

  // Solo copyright → aggiungi riga Help
  next = next.replace(
    /(<p class="evil-site-foot__copy evil-site-foot__meta">© 2026 · EVIL Cybersecurity Platform<\/p>)(\s*)(?=<\/section>)/g,
    (m, meta, ws) => {
      const indent = ws.includes('\n        ') ? '        ' : ws.trim() ? ws : '\n        ';
      return `${meta}${indent}<p class="evil-site-foot__copy">\n${indent}  ${HELP}\n${indent}</p>${ws}`;
    }
  );

  return next !== content ? next : null;
}

let updated = 0;
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.endsWith('.html')) continue;
    const raw = fs.readFileSync(full, 'utf8');
    if (!raw.includes('evil-site-foot')) continue;
    const out = patch(raw);
    if (out) {
      fs.writeFileSync(full, out, 'utf8');
      updated++;
      console.log('✓', path.relative(root, full));
    }
  }
}

walk(htmlDir);
console.log(`\nFooter aggiornati: ${updated}`);

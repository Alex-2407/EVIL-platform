#!/usr/bin/env node
/**
 * Sincronizza chrome responsive su tutte le pagine HTML:
 * load-header.js, responsive.css, site-header/footer, system-theme, viewport safe-area
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlDir = path.join(root, 'html');
const SKIP = new Set(['components/header.html', 'components/footer.html']);
const RESPONSIVE = '/css/responsive.css?v=20260717';
const SYSTEM_THEME = '/css/system-theme.css?v=20260717';
const EVIL_SCROLLBAR = '/css/evil-scrollbar.css?v=20260717';
const SITE_HEADER = '/css/site-header.css?v=20260611';
const SITE_FOOTER = '/css/site-footer.css?v=20260606';
const LOAD_HEADER = '<script src="/js/load-header.js" defer></script>';

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(htmlDir, full).replace(/\\/g, '/');
    if (fs.statSync(full).isDirectory()) {
      walkHtml(full, out);
      continue;
    }
    if (!name.endsWith('.html') || SKIP.has(rel)) continue;
    out.push(full);
  }
  return out;
}

function normalizeAssetPaths(content) {
  return content
    .replace(/href="\.\.\/css\//g, 'href="/css/')
    .replace(/src="\.\.\/js\//g, 'src="/js/')
    .replace(/src="\.\.\/css\//g, 'src="/css/');
}

function ensureViewport(content) {
  if (!content.includes('viewport-fit=cover')) {
    content = content.replace(
      /content="width=device-width, initial-scale=1\.0"/,
      'content="width=device-width, initial-scale=1.0, viewport-fit=cover"'
    );
  }
  return content;
}

function ensureStylesheet(content, href, marker) {
  if (content.includes(marker)) return content;
  const link = `  <link rel="stylesheet" href="${href}">`;
  const before = content;
  if (content.includes('/css/style.css')) {
    content = content.replace(
      /<link rel="stylesheet" href="(\/?\.\.\/)?css\/style\.css[^"]*">/,
      (m) => `${m}\n${link}`
    );
  }
  if (content === before) {
    content = content.replace('</head>', `${link}\n</head>`);
  }
  return content;
}

function ensureLoadHeader(content) {
  if (!/<header[\s>]/i.test(content) || content.includes('load-header.js')) {
    return content;
  }
  return content.replace('</head>', `${LOAD_HEADER}\n</head>`);
}

const files = walkHtml(htmlDir);
let updated = 0;

files.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const before = content;

  content = normalizeAssetPaths(content);
  content = ensureViewport(content);
  content = ensureStylesheet(content, RESPONSIVE, 'responsive.css');
  content = ensureStylesheet(content, SYSTEM_THEME, 'system-theme.css');
  content = ensureStylesheet(content, EVIL_SCROLLBAR, 'evil-scrollbar.css');
  if (/<header[\s>]/i.test(content)) {
    content = ensureStylesheet(content, SITE_HEADER, 'site-header.css');
    content = ensureLoadHeader(content);
  }
  if (content.includes('evil-site-foot')) {
    content = ensureStylesheet(content, SITE_FOOTER, 'site-footer.css');
  }

  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf8');
    updated += 1;
    console.log('✓', path.relative(htmlDir, filePath));
  }
});

console.log(`\nCompletato: ${updated} file aggiornati.`);

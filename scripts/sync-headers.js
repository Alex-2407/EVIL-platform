#!/usr/bin/env node
/**
 * Sincronizza header canonico (components/header.html) su tutte le pagine HTML.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const headerPath = path.join(root, 'html', 'components', 'header.html');
const headerHtml = fs.readFileSync(headerPath, 'utf8').trim();
const htmlDir = path.join(root, 'html');

const LOGO_SRC = '/html/generated-image.png';
const SKIP_FILES = new Set(['components/header.html', 'components/footer.html']);

function walkHtml(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(htmlDir, full).replace(/\\/g, '/');
    if (fs.statSync(full).isDirectory()) {
      walkHtml(full, out);
      continue;
    }
    if (!name.endsWith('.html') || SKIP_FILES.has(rel)) continue;
    out.push(full);
  }
  return out;
}

function injectResponsiveCss(content) {
  if (content.includes('/css/responsive.css')) return content;
  if (content.includes('/css/style.css')) {
    return content.replace(
      /<link rel="stylesheet" href="\/css\/style\.css">/,
      '<link rel="stylesheet" href="/css/style.css">\n  <link rel="stylesheet" href="/css/responsive.css">'
    );
  }
  return content.replace(
    '</head>',
    '  <link rel="stylesheet" href="/css/style.css">\n  <link rel="stylesheet" href="/css/responsive.css">\n</head>'
  );
}

function fixLogoSrc(content) {
  return content
    .replace(/src="\/public\/evil-logo\.svg"/g, `src="${LOGO_SRC}"`)
    .replace(/src="\/public\/generated-image\.png"/g, `src="${LOGO_SRC}"`)
    .replace(/src="\/public\/evil-logo\.png"/g, `src="${LOGO_SRC}"`);
}

function ensureDropdownCarets(content) {
  return content
    .replace(/<a href="#">Didattica<\/a>/g, '<a href="#">Didattica ▾</a>')
    .replace(/<a href="#">Intelligence<\/a>/g, '<a href="#">Intelligence ▾</a>')
    .replace(/<a href="#">Strumenti<\/a>/g, '<a href="#">Strumenti ▾</a>')
    .replace(/<a href="#">Didattica \?<\/a>/g, '<a href="#">Didattica ▾</a>')
    .replace(/<a href="#">Intelligence \?<\/a>/g, '<a href="#">Intelligence ▾</a>')
    .replace(/<a href="#">Strumenti \?<\/a>/g, '<a href="#">Strumenti ▾</a>');
}

const files = walkHtml(htmlDir);
let updated = 0;

files.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  const before = content;

  if (/<header[\s>]/i.test(content)) {
    content = content.replace(/<header[\s\S]*?<\/header>/i, headerHtml);
  }

  content = injectResponsiveCss(content);
  content = fixLogoSrc(content);
  content = ensureDropdownCarets(content);

  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf8');
    updated += 1;
    console.log('✓', path.relative(htmlDir, filePath));
  }
});

console.log(`\nCompletato: ${updated} file aggiornati.`);

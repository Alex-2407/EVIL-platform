#!/usr/bin/env node
/**
 * Sincronizza header canonico + responsive.css su tutte le pagine HTML.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const headerPath = path.join(root, 'html', 'components', 'header.html');
const headerHtml = fs.readFileSync(headerPath, 'utf8').trim();
const htmlDir = path.join(root, 'html');

const LOGO_SRC = '/html/generated-image.png';

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

const files = fs.readdirSync(htmlDir).filter((f) => f.endsWith('.html'));

let updated = 0;

files.forEach((file) => {
  const filePath = path.join(htmlDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  const before = content;

  if (/<header[\s>]/i.test(content)) {
    content = content.replace(/<header[\s\S]*?<\/header>/i, headerHtml);
  }

  content = injectResponsiveCss(content);
  content = fixLogoSrc(content);

  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf8');
    updated += 1;
    console.log('✓', file);
  }
});

console.log(`\nCompletato: ${updated} file aggiornati (logo + header + responsive.css).`);

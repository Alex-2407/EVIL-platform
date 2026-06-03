/**
 * Aggiunge css/site-header.css a tutte le pagine html/ (dopo style.css).
 */
const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const cssAbs = '/css/site-header.css?v=20260609';
const cssRel = '../css/site-header.css?v=20260609';
const marker = 'site-header.css';

function injectCss(html) {
  if (html.includes(marker)) return html;
  if (html.includes('href="/css/style.css"')) {
    return html.replace(
      /<link rel="stylesheet" href="\/css\/style\.css">/,
      `<link rel="stylesheet" href="/css/style.css">\n  <link rel="stylesheet" href="${cssAbs}">`
    );
  }
  if (html.includes('href="../css/style.css"')) {
    return html.replace(
      /<link rel="stylesheet" href="\.\.\/css\/style\.css">/,
      `<link rel="stylesheet" href="../css/style.css">\n  <link rel="stylesheet" href="${cssRel}">`
    );
  }
  return html.replace('</head>', `  <link rel="stylesheet" href="${cssAbs}">\n</head>`);
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.endsWith('.html')) continue;
    const html = fs.readFileSync(full, 'utf8');
    const next = injectCss(html);
    if (next !== html) {
      fs.writeFileSync(full, next, 'utf8');
      console.log('OK:', path.relative(htmlDir, full));
    }
  }
}

walk(htmlDir);

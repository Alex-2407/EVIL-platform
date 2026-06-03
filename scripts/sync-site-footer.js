/**
 * Sostituisce il footer in tutte le pagine html/ con components/footer.html
 * e aggiunge il link a css/site-footer.css se manca.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlDir = path.join(root, 'html');
const footerPath = path.join(htmlDir, 'components', 'footer.html');
const footerHtml = fs.readFileSync(footerPath, 'utf8').trim();
const cssAbs = '/css/site-footer.css?v=20260606';
const cssRel = '../css/site-footer.css?v=20260606';

const footerRe = /<footer[\s\S]*?<\/footer>/i;

function injectCss(html, cssHref) {
  if (html.includes('site-footer.css')) return html;
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

const files = fs
  .readdirSync(htmlDir)
  .filter((f) => f.endsWith('.html'))
  .map((f) => path.join(htmlDir, f));

let updated = 0;
for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  if (!footerRe.test(html)) continue;

  const useRel = html.includes('../css/style.css');
  html = html.replace(footerRe, footerHtml);
  html = injectCss(html, useRel ? cssRel : cssAbs);

  // Rimuovi blocco style inline footer home (legacy)
  html = html.replace(/\s*<style id="ev-home-sitefoot-styles">[\s\S]*?<\/style>/, '');

  fs.writeFileSync(file, html, 'utf8');
  updated++;
  console.log('OK:', path.basename(file));
}

console.log(`\nAggiornate ${updated} pagine.`);

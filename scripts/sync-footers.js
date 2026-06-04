#!/usr/bin/env node
/**
 * Sincronizza footer canonico (components/footer.html) su tutte le pagine HTML.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const footerPath = path.join(root, 'html', 'components', 'footer.html');
const footerHtml = fs.readFileSync(footerPath, 'utf8').trim();
const htmlDir = path.join(root, 'html');

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

function normalizeFooter(content) {
  let next = content;

  if (/<footer class="evil-site-foot"[\s>]/i.test(next)) {
    next = next.replace(/<footer class="evil-site-foot"[\s\S]*?<\/footer>/i, footerHtml);
    return next;
  }

  if (/<footer[\s>]/i.test(next)) {
    next = next.replace(/<footer[\s\S]*?<\/footer>/i, footerHtml);
    return next;
  }

  if (/<\/main>/i.test(next)) {
    return next.replace(/<\/main>/i, `</main>\n\n  ${footerHtml.replace(/\n/g, '\n  ')}\n`);
  }

  return next.replace(/<\/body>/i, `\n  ${footerHtml.replace(/\n/g, '\n  ')}\n</body>`);
}

const files = walkHtml(htmlDir);
let updated = 0;

files.forEach((filePath) => {
  const before = fs.readFileSync(filePath, 'utf8');
  const content = normalizeFooter(before);

  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf8');
    updated += 1;
    console.log('✓', path.relative(htmlDir, filePath));
  }
});

console.log(`\nCompletato: ${updated} file aggiornati.`);

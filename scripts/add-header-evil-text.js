const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');
const wordmark =
  '        <a href="home.html" class="header-evil-wordmark" aria-label="EVIL — torna alla home">EVIL</a>\n';

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!name.endsWith('.html')) continue;

    let html = fs.readFileSync(full, 'utf8');
    let next = html;

    next = next.replace(
      /<span class="header-evil-title">EVIL<\/span>/g,
      '<a href="home.html" class="header-evil-wordmark" aria-label="EVIL — torna alla home">EVIL</a>'
    );
    next = next.replace(
      /<div class="logo">EVIL<\/div>/g,
      '<a href="home.html" class="header-evil-wordmark" aria-label="EVIL — torna alla home">EVIL</a>'
    );

    if (next.includes('logo-section') && !next.includes('header-evil-wordmark')) {
      next = next.replace(
        /(<button class="img-btn"[\s\S]*?<\/button>)(\s*\r?\n\s*<\/div>)/,
        `$1\n${wordmark}      $2`
      );
    }

    next = next.replace(
      /aria-label="EVIL [^\u2014-]+ torna alla home"/g,
      'aria-label="EVIL — torna alla home"'
    );

    if (next !== html) {
      fs.writeFileSync(full, next, 'utf8');
      console.log('updated:', path.relative(htmlDir, full));
    }
  }
}

walk(htmlDir);

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'html');

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.name.endsWith('.html')) {
      const c = fs.readFileSync(p, 'utf8');
      const n = c.replace(
        /href="historic-attacks\.html">Attacchi Storici/g,
        'href="historic-attacks.html">Violazioni Storiche'
      );
      if (n !== c) {
        fs.writeFileSync(p, n);
        console.log('updated', path.relative(root, p));
      }
    }
  }
}

walk(root);

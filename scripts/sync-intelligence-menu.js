/** Rimuove template scheda obsoleto e allinea voci menu Intelligence */
const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');

const OLD_BLOCK = `              <a href="attacks-map.html">Mappa Incidenti Documentati</a>
              <a href="historic-attacks.html">Violazioni Storiche</a>
              <a href="malware-db.html">Database Malware</a>
              <a href="malware-classification.html">Classificazione Malware</a>
              <a href="malware-card-template.html">Template Scheda Malware</a>
              <a href="manipulation-techniques.html">Tecniche di Manipolazione</a>`;

const NEW_BLOCK = `              <a href="attacks-map.html">Mappa incidenti</a>
              <a href="historic-attacks.html">Violazioni storiche</a>
              <a href="malware-db.html">Catalogo malware</a>
              <a href="malware-classification.html">Tassonomia malware</a>
              <a href="manipulation-techniques.html">Persistenza ed evasione</a>`;

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

let updated = 0;
for (const file of walk(htmlDir)) {
  if (file.includes('malware-card-template.html')) continue;
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  if (c.includes(OLD_BLOCK)) c = c.replace(OLD_BLOCK, NEW_BLOCK);
  c = c.replace(/\s*<a href="malware-card-template\.html">[^<]*<\/a>\s*/g, '\n');
  if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    updated += 1;
    console.log('updated:', path.relative(htmlDir, file));
  }
}

console.log('files updated:', updated);

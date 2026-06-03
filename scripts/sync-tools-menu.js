/** Allinea menu Strumenti su tutte le pagine HTML */
const fs = require('fs');
const path = require('path');

const htmlDir = path.join(__dirname, '..', 'html');

const OLD_BLOCK = `              <a href="security-check.html">Security Check URL</a>
              <a href="vulnerability-scanner.html">Scanner Vulnerabilità</a>
              <a href="dns-enumerator.html">DNS Enumerator</a>
              <a href="subdomain-finder.html">Subdomain Finder</a>
              <a href="ssl-analyzer.html">SSL Analyzer</a>
              <a href="file-analysis.html">Analisi File</a>
              <a href="report-generator.html">Generazione Report</a>
              <a href="social-profiling.html">Profilazione Social (OSINT)</a>
              <a href="public-info.html">Info Pubbliche (OSINT)</a>`;

const NEW_BLOCK = `              <a href="security-check.html">Check URL</a>
              <a href="vulnerability-scanner.html">Header HTTP</a>
              <a href="domain-recon.html">Ricognizione dominio</a>
              <a href="file-analysis.html">Analisi file</a>
              <a href="osint-hub.html">OSINT</a>`;

const ALT_OLD = `              <a href="security-check.html">Check URL</a>
              <a href="vulnerability-scanner.html">Scanner CVE</a>
              <a href="domain-recon.html">Ricognizione dominio</a>
              <a href="file-analysis.html">Analisi file</a>
              <a href="osint-hub.html">OSINT</a>`;

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
  let c = fs.readFileSync(file, 'utf8');
  const orig = c;
  if (c.includes(OLD_BLOCK)) c = c.replace(OLD_BLOCK, NEW_BLOCK);
  if (c.includes(ALT_OLD)) c = c.replace(ALT_OLD, NEW_BLOCK);
  if (c !== orig) {
    fs.writeFileSync(file, c, 'utf8');
    updated += 1;
    console.log('updated:', path.relative(htmlDir, file));
  }
}

console.log('files updated:', updated);

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (['node_modules', '.git'].includes(name)) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

function fixPass2(t) {
  let s = t;

  // Apostrofi e accenti rovinati dal fallback "—"
  s = s.replace(/l—/g, "l'");
  s = s.replace(/L—/g, "L'");
  s = s.replace(/finalit—/g, 'finalità');
  s = s.replace(/PI—/g, 'PIÙ');

  // è (verbo) — pattern sicuri
  const eReplacements = [
    [/ — autenticato/g, ' è autenticato'],
    [/l'utente — autenticato/g, "l'utente è autenticato"],
    [/Qual — il/g, 'Qual è il'],
    [/Qual — un/g, 'Qual è un'],
    [/Qual — il tipo/g, 'Qual è il tipo'],
    [/Qual — il primo/g, 'Qual è il primo'],
    [/Qual — il segnale/g, 'Qual è il segnale'],
    [/L'email — in/g, "L'email è in"],
    [/Solo se — in spam/g, 'Solo se è in spam'],
    [/engineering — efficace/g, 'engineering è efficace'],
    [/verificare se — legittimo/g, 'verificare se è legittimo'],
    [/Bitwarden, ecc\.\) — il modo/g, 'Bitwarden, ecc.) è il modo'],
    [/Il display — acceso/g, 'Il display è acceso'],
    [/URL — sicuro/g, 'URL è sicuro'],
    [/Clicco - — solo/g, 'Clicco - è solo'],
    [/Non clicco - — chiaramente/g, 'Non clicco - è chiaramente'],
    [/dominio ufficiale, — una/g, 'dominio ufficiale, è una'],
    [/non — un AV/g, 'non è un AV'],
    [/Il verdetto EVIL — euristico/g, 'Il verdetto EVIL è euristico'],
    [/non — un /g, 'non è un '],
  ];
  for (const [re, rep] of eReplacements) s = s.replace(re, rep);

  // Frecce / navigazione
  s = s.replace(/>\? OSINT</g, '>← OSINT<');
  s = s.replace(/>\? Ricognizione dominio</g, '>← Ricognizione dominio<');
  s = s.replace(/\) \? lista/g, ') → lista');

  // Log simulatore
  s = s.replace(/\[SERVER\] \? Cookie/g, '[SERVER] ✓ Cookie');
  s = s.replace(/\[SERVER\] \? CSRF/g, '[SERVER] ✗ CSRF');
  s = s.replace(/\[SERVER\] \? Referer/g, '[SERVER] ✗ Referer');
  s = s.replace(/\[SERVER\] \? Utente/g, '[SERVER] ✓ Utente');
  s = s.replace(/\[\?\?\?  DIFESA/g, '[🛡️ DIFESA');
  s = s.replace(/\[\?\?\?\] PASSWORD/g, '[🔑] PASSWORD');
  s = s.replace(/\[\?\?\?  LEZIONE\]/g, '[💡 LEZIONE]');
  s = s.replace(/ PREPARED STATEMENTS \? /g, ' PREPARED STATEMENTS → ');
  s = s.replace(/innerHTML \? div/g, 'innerHTML → div');
  s = s.replace(/fallimenti \? lockout/g, 'fallimenti → lockout');
  s = s.replace(/\.htaccess \? php/g, '.htaccess → php');
  s = s.replace(/ogni form \? token/g, 'ogni form → token');
  s = s.replace(/SameSite=Strict \? Invia/g, 'SameSite=Strict → Invia');

  // HTML rotto da fix precedente
  s = s.replace(/—<\/span>/g, '—</span>');
  s = s.replace(/×<\/button>/g, '×</button>');
  s = s.replace(/<\/\/span>/g, '</span>');
  s = s.replace(/<\/\/button>/g, '</button>');

  return s;
}

let changed = 0;
for (const fp of walk(path.join(root, 'html'))) {
  const before = fs.readFileSync(fp, 'utf8');
  const after = fixPass2(before);
  if (after !== before) {
    fs.writeFileSync(fp, after, 'utf8');
    changed++;
    console.log('fixed:', path.relative(root, fp));
  }
}
console.log(`\n${changed} file aggiornati`);

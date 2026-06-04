#!/usr/bin/env node
/**
 * Ripristina caratteri UTF-8 corrotti (U+FFFD) nei file del sito.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const REPL = '\uFFFD';

const files = [
  'html/web-simulator.html',
  'html/vulnerability-scanner.html',
  'html/virtual-lab.html',
  'html/ssl-analyzer.html',
  'html/social-profiling.html',
  'html/social-engineering.html',
  'html/report-generator.html',
  'html/public-info.html',
  'html/phishing-quiz.html',
  'html/malware-db.html',
  'html/malware-classification.html',
  'html/historic-attacks.html',
  'html/hacked-timeline.html',
  'html/file-analysis.html',
  'html/ethical-hacking.html',
];

function applyRules(text) {
  let t = text;

  // Parole italiane (accentate)
  const wordFixes = [
    [/pi\uFFFD/g, 'più'],
    [/pu\uFFFD/g, 'può'],
    [/Perch\uFFFD/g, 'Perché'],
    [/perch\uFFFD/g, 'perché'],
    [/Poich\uFFFD/g, 'Poiché'],
    [/realt\uFFFD/g, 'realtà'],
    [/vulnerabilit\uFFFD/g, 'vulnerabilità'],
    [/VULNERABILIT\uFFFD/g, 'VULNERABILITÀ'],
    [/Velocit\uFFFD/g, 'Velocità'],
    [/validit\uFFFD/g, 'validità'],
    [/Severit\uFFFD/g, 'Severità'],
    [/attivit\uFFFD/g, 'attività'],
    [/luned\uFFFD/g, 'lunedì'],
    [/razionalit\uFFFD/g, 'razionalità'],
    [/responsabilit\uFFFD/g, 'responsabilità'],
    [/confidenzialit\uFFFD/g, 'confidenzialità'],
    [/citt\uFFFD/g, 'città'],
    [/integrit\uFFFD/g, 'integrità'],
    [/c'\uFFFD/g, "c'è"],
  ];
  for (const [re, rep] of wordFixes) t = t.replace(re, rep);

  // « »
  t = t.replace(/:\uFFFDesiste/g, ': «esiste');
  t = t.replace(/coppia\?\uFFFD\./g, 'coppia?».');
  t = t.replace(/distingue \uFFFDcomandi SQL\uFFFD da \uFFFDdati\uFFFD \uFFFD legge/g,
    'distingue «comandi SQL» da «dati» — legge');
  t = t.replace(/HTML \uFFFDvivo\uFFFD/g, 'HTML «vivo»');
  t = t.replace(/browser \uFFFDporta\uFFFD/g, 'browser «porta»');
  t = t.replace(/Richiesta \uFFFDautomatica\uFFFD/g, 'Richiesta «automatica»');

  // è (verbo)
  t = t.replace(/\uFFFD SEMPRE/g, 'è SEMPRE');
  t = t.replace(/sotto \uFFFD solo/g, 'sotto è solo');
  t = t.replace(/Utente \uFFFD autenticato/g, 'Utente è autenticato');
  t = t.replace(/l'utente \uFFFD autenticato/g, "l'utente è autenticato");
  t = t.replace(/La vittima \uFFFD AUTENTICATA/g, 'La vittima è AUTENTICATA');
  t = t.replace(/Violare queste regole \uFFFD ILLEGALE/g, 'Violare queste regole è ILLEGALE');
  t = t.replace(/Non \uFFFD l/g, "Non è l");
  t = t.replace(/S\uFFFD, /g, 'Sì, ');
  t = t.replace(/ \uFFFD un'/g, " è un'");
  t = t.replace(/ \uFFFD un /g, ' è un ');
  t = t.replace(/ \uFFFD una /g, ' è una ');
  t = t.replace(/ \uFFFD PROBABILMENTE/g, ' è PROBABILMENTE');
  t = t.replace(/S\uFFFD, \uFFFD quasi/g, 'Sì, è quasi');
  t = t.replace(/ \uFFFD scritta/g, ' È scritta');
  t = t.replace(/ \uFFFD un'email importante/g, " È un'email importante");
  t = t.replace(/ \uFFFD un'email con/g, " È un'email con");
  t = t.replace(/ \uFFFD un'email da/g, " È un'email da");
  t = t.replace(/ \uFFFD un'email con oggetto/g, " È un'email con oggetto");
  t = t.replace(/ \uFFFD un classico/g, ' È un classico');
  t = t.replace(/ \uFFFD una tattica/g, ' È una tattica');
  t = t.replace(/ \uFFFD quasi certamente/g, ' È quasi certamente');
  t = t.replace(/ \uFFFD phishing\?/g, ' È phishing?');
  t = t.replace(/ \uFFFD il processo/g, ' è il processo');
  t = t.replace(/ \uFFFD fondamentale/g, ' È fondamentale');
  t = t.replace(/ \uFFFD lo standard/g, ' è lo standard');
  t = t.replace(/ \uFFFD il protocollo/g, ' è il protocollo');
  t = t.replace(/ \uFFFD essenziale/g, ' è essenziale');
  t = t.replace(/ \uFFFD la ricerca/g, ' è la ricerca');
  t = t.replace(/ \uFFFD ILLEGALE se/g, ' è ILLEGALE se');
  t = t.replace(/non \uFFFD encryption/g, "non è encryption");
  t = t.replace(/90 giorni \uFFFD standard/g, '90 giorni è standard');
  t = t.replace(/Qualcuno \uFFFD entrato/g, 'Qualcuno è entrato');
  t = t.replace(/indirizzi email \uFFFD PROBABILMENTE/g, 'indirizzi email È PROBABILMENTE');
  t = t.replace(/conto \uFFFD sospetto/g, 'conto è sospetto');
  t = t.replace(/Cosa \uFFFD sospetto/g, 'Cosa è sospetto');
  t = t.replace(/email \uFFFD stata/g, 'email è stata');
  t = t.replace(/collega di confermare che \uFFFD davvero/g, 'collega di confermare che è davvero');
  t = t.replace(/tattica NON \uFFFD tipica/g, 'tattica NON è tipica');
  t = t.replace(/lettera certificata \uFFFD meno/g, 'lettera certificata è meno');

  // Trattini e separatori
  t = t.replace(/Impara \uFFFD Laboratorio/g, 'Impara · Laboratorio');
  t = t.replace(/Impara \uFFFD Simula \uFFFD Difendi/g, 'Impara · Simula · Difendi');
  t = t.replace(/Strumenti \uFFFD /g, 'Strumenti · ');
  t = t.replace(/Console \uFFFD /g, 'Console — ');
  t = t.replace(/Fase (\d+) \uFFFD /g, 'Fase $1 — ');
  t = t.replace(/didattico \uFFFD nessun/g, 'didattico — nessun');
  t = t.replace(/didattico \uFFFD mai/g, 'didattico — mai');
  t = t.replace(/dashboard \uFFFD il/g, 'dashboard — il');
  t = t.replace(/client \uFFFD entrambi/g, 'client — entrambi');
  t = t.replace(/Analisi passiva via GET \uFFFD /g, 'Analisi passiva via GET — ');
  t = t.replace(/ header HTTP \uFFFD EVIL/g, ' header HTTP — EVIL');
  t = t.replace(/ Certificate Analyzer \uFFFD EVIL/g, ' Certificate Analyzer — EVIL');
  t = t.replace(/ Profilazione Social \uFFFD EVIL/g, ' Profilazione Social — EVIL');
  t = t.replace(/ Raccolta Info Pubbliche \uFFFD EVIL/g, ' Raccolta Info Pubbliche — EVIL');
  t = t.replace(/Lab completato \uFFFD flag/g, 'Lab completato — flag');
  t = t.replace(/jumpbox\.evil\.lab \uFFFD VLAN/g, 'jumpbox.evil.lab — VLAN');
  t = t.replace(/TLS 1\.2\+ \uFFFD SAN/g, 'TLS 1.2+ · SAN');
  t = t.replace(/ \uFFFD SAN \uFFFD trust/g, ' · SAN · trust');
  t = t.replace(/ \uFFFD cipher \uFFFD ~/g, ' · cipher · ~');
  t = t.replace(/ \uFFFD GitHub API \uFFFD/g, ' · GitHub API ·');
  t = t.replace(/ \uFFFD Reddit JSON \uFFFD/g, ' · Reddit JSON ·');
  t = t.replace(/ piattaforme \uFFFD /g, ' piattaforme · ');
  t = t.replace(/ \uFFFD comune nascita/g, ' · comune nascita');
  t = t.replace(/Wikidata SPARQL \uFFFD /g, 'Wikidata SPARQL · ');
  t = t.replace(/9 header \uFFFD cookie/g, '9 header · cookie');
  t = t.replace(/ cookie \uFFFD raw/g, ' cookie · raw');
  t = t.replace(/ raw headers \uFFFD ~/g, ' raw headers · ~');
  t = t.replace(/Nessun dato inventato \uFFFD solo/g, 'Nessun dato inventato — solo');
  t = t.replace(/didattica \uFFFD non provengono/g, 'didattica — non provengono');
  t = t.replace(/~5\uFFFD15/g, '~5–15');
  t = t.replace(/~3\uFFFD12/g, '~3–12');
  t = t.replace(/~5\uFFFD25/g, '~5–25');

  // Ellissi e simboli UI
  t = t.replace(/Caricamento\uFFFD/g, 'Caricamento…');
  t = t.replace(/curl\uFFFD/g, 'curl…');
  t = t.replace(/nmap, ssh, curl\uFFFD/g, 'nmap, ssh, curl…');
  t = t.replace(/aria-label="Chiudi guida">\uFFFD<\/button>/g, 'aria-label="Chiudi guida">×</button>');
  t = t.replace(/vlab-session-timer">\uFFFD<\/span>/g, 'vlab-session-timer">—</span>');
  t = t.replace(/vlab-session-timer">\uFFFD</g, 'vlab-session-timer">—</');
  t = t.replace(/ \uFFFD scade tra/g, ' — scade tra');
  t = t.replace(/content: "\uFFFD"/g, 'content: "·"');

  // Elenchi tutorial (ethical-hacking)
  t = t.replace(/<br>\uFFFD /g, '<br>· ');
  t = t.replace(/<br>\? /g, '<br>✓ ');

  // Log / emoji
  t = t.replace(/\[\?\? LEZIONE\]/g, '[💡 LEZIONE]');
  t = t.replace(/\[SERVER\] \? Utente/g, '[SERVER] ✓ Utente');
  t = t.replace(/autenticato \? PROCEDI/g, 'autenticato → PROCEDI');

  const remaining = (t.match(/\uFFFD/g) || []).length;
  if (remaining) {
    console.warn(`  ⚠️ ${remaining} caratteri U+FFFD non mappati — esegui fix-encoding-pass2.js`);
  }

  return t;
}

let remaining = 0;
for (const rel of files) {
  const fp = path.join(root, rel);
  if (!fs.existsSync(fp)) {
    console.warn('skip missing:', rel);
    continue;
  }
  const before = fs.readFileSync(fp, 'utf8');
  const countBefore = (before.match(/\uFFFD/g) || []).length;
  if (!countBefore) continue;

  const after = applyRules(before);
  const countAfter = (after.match(/\uFFFD/g) || []).length;
  fs.writeFileSync(fp, after, 'utf8');
  remaining += countAfter;
  console.log(`${rel}: ${countBefore} → ${countAfter} remaining`);
}

if (remaining) {
  console.error(`\n⚠️ ${remaining} caratteri ancora da correggere manualmente`);
  process.exit(1);
}
console.log('\n✅ Encoding fix completato');

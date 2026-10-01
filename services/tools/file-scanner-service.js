/**
 * EVIL — Analisi file: analisi statica in memoria, il file non viene mai eseguito.
 *
 * Sicurezza (S-01): le stringhe estratte sono troncate (MAX_STRING_LEN) e contate
 * (MAX_STRINGS), e ogni espressione regolare ha quantificatori limitati, così un file
 * costruito apposta non può bloccare il processo con il backtracking (ReDoS).
 */
const crypto = require('crypto');
const { t } = require('../../server/i18n');

/** Byte analizzati per stringhe e pattern (i primi 2 MB). */
const STRING_SCAN_BYTES = 2 * 1024 * 1024;
/** Lunghezza massima di ogni stringa estratta. */
const MAX_STRING_LEN = 512;
/** Numero massimo di stringhe estratte. */
const MAX_STRINGS = 400;
/** Stringhe usate per la ricerca di pattern. */
const PATTERN_STRINGS = 200;

function scanLimitations(lang) {
  return [
    t(lang, 'Il file viene inviato al server di EVIL, analizzato in memoria e scartato: non viene eseguito né salvato su disco. Nel tuo profilo restano solo nome, dimensione, SHA-256 e verdetto.'),
    t(lang, 'Non è un antivirus: usa euristiche (tipo reale, entropia, stringhe sospette), non firme aggiornate di malware.'),
    t(lang, 'Per un parere di più motori antivirus cerca lo SHA-256 su VirusTotal; per il comportamento serve una sandbox.'),
    t(lang, 'Analizza solo file tuoi o che sei autorizzato a esaminare: non caricare documenti con dati personali di altri.'),
  ];
}

// Firme all'inizio del file (magic bytes). code = identificativo stabile, label tradotta in describeType().
const MAGIC_SIGNATURES = [
  { code: 'pe', magic: [0x4d, 0x5a], extensions: ['.exe', '.dll', '.sys', '.scr'] },
  { code: 'pdf', magic: [0x25, 0x50, 0x44, 0x46], extensions: ['.pdf'] },
  { code: 'zip', magic: [0x50, 0x4b, 0x03, 0x04], extensions: ['.zip', '.docx', '.xlsx', '.pptx', '.jar', '.apk'] },
  { code: 'zip_empty', magic: [0x50, 0x4b, 0x05, 0x06], extensions: ['.zip'] },
  { code: 'ole', magic: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], extensions: ['.doc', '.xls', '.ppt', '.msi'] },
  { code: 'rar', magic: [0x52, 0x61, 0x72, 0x21], extensions: ['.rar'] },
  { code: '7z', magic: [0x37, 0x7a, 0xbc, 0xaf], extensions: ['.7z'] },
  { code: 'png', magic: [0x89, 0x50, 0x4e, 0x47], extensions: ['.png', '.img'] },
  { code: 'jpeg', magic: [0xff, 0xd8, 0xff], extensions: ['.jpg', '.jpeg', '.img'] },
  { code: 'elf', magic: [0x7f, 0x45, 0x4c, 0x46], extensions: ['.elf', '.so', '.bin'] },
  { code: 'macho', magic: [0xcf, 0xfa, 0xed, 0xfe], extensions: ['.bin', '.dylib'] },
  { code: 'macho', magic: [0xce, 0xfa, 0xed, 0xfe], extensions: ['.bin', '.dylib'] },
  { code: 'macho', magic: [0xfe, 0xed, 0xfa, 0xcf], extensions: ['.bin', '.dylib'] },
  { code: 'macho', magic: [0xfe, 0xed, 0xfa, 0xce], extensions: ['.bin', '.dylib'] },
  { code: 'xar', magic: [0x78, 0x61, 0x72, 0x21], extensions: ['.pkg'] },
];

const TEXT_EXT = new Set(['.txt', '.log', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.html', '.htm', '.hta', '.wsf', '.csv', '.json', '.xml']);
/** Estensioni che di solito non hanno una firma iniziale riconoscibile. */
const NO_MAGIC_EXT = new Set(['.dat', '.bin', '.img', '.iso', '.dmg']);

const HIGH_RISK_EXT = new Set([
  '.exe', '.dll', '.sys', '.scr', '.msi', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.jar', '.apk', '.hta', '.wsf',
]);

// Tutte le regex hanno quantificatori limitati: niente .* su testo controllato da chi carica il file.
const STRING_PATTERNS = [
  { id: 'eicar', pattern: 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE', severity: 'info', category: 'test' },
  { id: 'ps_encode', pattern: /-(?:enc|encodedcommand)\s{1,8}[A-Za-z0-9+/=]{8}/i, severity: 'high', category: 'script' },
  { id: 'ps_iex', pattern: /IEX\s{0,8}\(|DownloadString|DownloadFile/i, severity: 'high', category: 'script' },
  { id: 'cmd_exec', pattern: /\b(?:cmd|powershell|wscript|cscript|mshta)\.exe\b/i, severity: 'medium', category: 'script' },
  { id: 'reg_run', pattern: /CurrentVersion\\Run/i, severity: 'medium', category: 'persistence' },
  { id: 'mimikatz', pattern: /mimikatz|sekurlsa|lsadump/i, severity: 'critical', category: 'malware' },
  { id: 'ransom', pattern: /your files have been encrypted|bitcoin|\.locked\b|decrypt[^\n]{0,64}key/i, severity: 'high', category: 'ransomware' },
  { id: 'amsi_bypass', pattern: /amsi\.dll|AmsiScanBuffer/i, severity: 'high', category: 'evasion' },
  { id: 'url_http', pattern: /https?:\/\/[^\s"'<>]{8,200}/i, severity: 'low', category: 'network' },
];

function patternName(lang, id) {
  switch (id) {
    case 'eicar': return t(lang, 'File di test EICAR (innocuo, usato per provare gli antivirus)');
    case 'ps_encode': return t(lang, 'Comando PowerShell codificato (-EncodedCommand)');
    case 'ps_iex': return t(lang, 'PowerShell che scarica ed esegue codice (IEX / DownloadString)');
    case 'cmd_exec': return t(lang, 'Avvio di interpreti di comandi (cmd, powershell, wscript…)');
    case 'reg_run': return t(lang, 'Chiave di registro Run (avvio automatico)');
    case 'mimikatz': return t(lang, 'Riferimenti a strumenti di furto credenziali (mimikatz)');
    case 'ransom': return t(lang, 'Testo tipico dei ransomware (riscatto, file cifrati)');
    case 'amsi_bypass': return t(lang, 'Riferimenti ad AMSI (possibile elusione dell’antivirus)');
    case 'url_http': return t(lang, 'Indirizzi web (URL) nel contenuto');
    default: return id;
  }
}

function categoryLabel(lang, category) {
  switch (category) {
    case 'test': return t(lang, 'test');
    case 'script': return t(lang, 'script');
    case 'persistence': return t(lang, 'persistenza');
    case 'malware': return t(lang, 'malware');
    case 'ransomware': return t(lang, 'ransomware');
    case 'evasion': return t(lang, 'evasione');
    case 'network': return t(lang, 'rete');
    default: return category;
  }
}

function describeType(lang, code) {
  switch (code) {
    case 'pe': return t(lang, 'Eseguibile Windows (PE)');
    case 'pdf': return t(lang, 'Documento PDF');
    case 'zip': return t(lang, 'Archivio ZIP (anche docx/xlsx/pptx/jar/apk)');
    case 'zip_empty': return t(lang, 'Archivio ZIP vuoto');
    case 'ole': return t(lang, 'Documento Office legacy / MSI (OLE)');
    case 'rar': return t(lang, 'Archivio RAR');
    case '7z': return t(lang, 'Archivio 7-Zip');
    case 'png': return t(lang, 'Immagine PNG');
    case 'jpeg': return t(lang, 'Immagine JPEG');
    case 'elf': return t(lang, 'Eseguibile Linux (ELF)');
    case 'macho': return t(lang, 'Eseguibile macOS (Mach-O)');
    case 'xar': return t(lang, 'Pacchetto macOS (XAR)');
    case 'iso': return t(lang, 'Immagine disco ISO 9660');
    case 'text': return t(lang, 'Testo');
    default: return t(lang, 'Sconosciuto');
  }
}

function matchesMagic(buffer, magic, offset = 0) {
  if (buffer.length < offset + magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buffer[offset + i] !== magic[i]) return false;
  }
  return true;
}

/** true se i primi KB sono testo (ASCII stampabile o UTF-8, senza byte nulli). */
function looksLikeText(buffer) {
  const sample = buffer.subarray(0, 4096);
  if (!sample.length) return false;
  let printable = 0;
  for (const c of sample) {
    if (c === 0) return false;
    if (c === 9 || c === 10 || c === 13 || (c >= 0x20 && c !== 0x7f)) printable++;
  }
  return printable / sample.length > 0.95;
}

function detectFileType(buffer, ext) {
  for (const sig of MAGIC_SIGNATURES) {
    if (matchesMagic(buffer, sig.magic)) {
      const extOk = !ext || sig.extensions.includes(ext);
      return { code: sig.code, magicMatch: true, extensionMatch: extOk };
    }
  }
  // ISO 9660: "CD001" a 0x8001
  if (matchesMagic(buffer, [0x43, 0x44, 0x30, 0x30, 0x31], 0x8001)) {
    return { code: 'iso', magicMatch: true, extensionMatch: !ext || ext === '.iso' || ext === '.img' };
  }
  if (looksLikeText(buffer)) {
    return { code: 'text', magicMatch: false, isText: true, extensionMatch: !ext || TEXT_EXT.has(ext) };
  }
  return { code: 'unknown', magicMatch: false, extensionMatch: null };
}

function computeHashes(buffer) {
  return {
    md5: crypto.createHash('md5').update(buffer).digest('hex'),
    sha1: crypto.createHash('sha1').update(buffer).digest('hex'),
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    sha512: crypto.createHash('sha512').update(buffer).digest('hex'),
  };
}

function shannonEntropy(buffer) {
  if (!buffer.length) return 0;
  const freq = new Uint32Array(256);
  for (let i = 0; i < buffer.length; i++) freq[buffer[i]]++;
  let ent = 0;
  const len = buffer.length;
  for (let i = 0; i < 256; i++) {
    if (!freq[i]) continue;
    const p = freq[i] / len;
    ent -= p * Math.log2(p);
  }
  return Math.round(ent * 1000) / 1000;
}

/**
 * Sequenze di caratteri ASCII stampabili lunghe almeno minLen.
 * Ogni stringa è troncata a MAX_STRING_LEN caratteri e se ne tengono al massimo maxStrings.
 */
function extractStrings(buffer, minLen = 6, maxStrings = MAX_STRINGS) {
  const strings = [];
  const end = Math.min(buffer.length, STRING_SCAN_BYTES);
  let start = -1;
  const flush = (i) => {
    if (start >= 0 && i - start >= minLen) {
      strings.push(buffer.toString('latin1', start, Math.min(i, start + MAX_STRING_LEN)));
    }
    start = -1;
  };
  for (let i = 0; i < end && strings.length < maxStrings; i++) {
    const c = buffer[i];
    if (c >= 0x20 && c <= 0x7e) {
      if (start < 0) start = i;
    } else {
      flush(i);
    }
  }
  if (strings.length < maxStrings) flush(end);
  return strings;
}

function scanStringPatterns(strings, lang) {
  const hits = [];
  const blob = strings.slice(0, PATTERN_STRINGS).join('\n');
  for (const rule of STRING_PATTERNS) {
    const match = typeof rule.pattern === 'string' ? blob.includes(rule.pattern) : rule.pattern.test(blob);
    if (match) {
      hits.push({
        id: rule.id,
        name: patternName(lang, rule.id),
        severity: rule.severity,
        category: rule.category,
        categoryLabel: categoryLabel(lang, rule.category),
      });
    }
  }
  return hits;
}

function extractNetworkIndicators(strings) {
  const urls = new Set();
  const ips = new Set();
  const urlRe = /https?:\/\/[^\s"'<>]{8,200}/gi;
  const ipRe = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g;

  for (const s of strings.slice(0, 150)) {
    let m;
    urlRe.lastIndex = 0;
    ipRe.lastIndex = 0;
    while ((m = urlRe.exec(s)) !== null && urls.size < 20) urls.add(m[0]);
    while ((m = ipRe.exec(s)) !== null && ips.size < 20) ips.add(m[0]);
  }

  return { urls: [...urls], ips: [...ips] };
}

function parsePeHints(buffer) {
  if (buffer.length < 0x40 || buffer[0] !== 0x4d || buffer[1] !== 0x5a) return null;
  const peOffset = buffer.readUInt32LE(0x3c);
  // intestazione COFF (24 byte) + magic dell'optional header (2 byte)
  if (peOffset + 26 > buffer.length) return null;
  if (buffer.toString('latin1', peOffset, peOffset + 4) !== 'PE\0\0') return null;

  const machine = buffer.readUInt16LE(peOffset + 4);
  const numSections = buffer.readUInt16LE(peOffset + 6);
  const characteristics = buffer.readUInt16LE(peOffset + 0x16);
  const machineMap = { 0x14c: 'x86 (i386)', 0x8664: 'x64 (AMD64)', 0xaa64: 'ARM64', 0x1c4: 'ARMv7' };

  const optStart = peOffset + 24;
  const magic = buffer.readUInt16LE(optStart);
  const isPe32Plus = magic === 0x20b;

  // Subsystem: offset 68 nell'optional header, sia PE32 sia PE32+
  let subsystem = null;
  if (optStart + 70 <= buffer.length) subsystem = buffer.readUInt16LE(optStart + 68);
  const subMap = { 1: 'Native', 2: 'GUI', 3: 'Console', 9: 'Windows CE', 10: 'EFI', 11: 'EFI', 12: 'EFI', 14: 'Xbox' };

  return {
    format: isPe32Plus ? 'PE32+' : 'PE32',
    machine: machineMap[machine] || `0x${machine.toString(16)}`,
    sections: numSections,
    subsystem: subsystem == null ? null : subMap[subsystem] || String(subsystem),
    isDll: (characteristics & 0x2000) !== 0,
  };
}

function finding(severity, title, detail, module) {
  return { severity, title, detail, module };
}

function buildFindings(ctx, lang) {
  const findings = [];
  const ft = ctx.fileType;

  if (ft.code === 'unknown') {
    if (NO_MAGIC_EXT.has(ctx.extension)) {
      findings.push(finding('low', t(lang, 'Formato non riconosciuto'),
        t(lang, 'Nessuna firma nota all’inizio del file: è normale per dati grezzi ({ext}), ma il contenuto non è verificabile.', { ext: ctx.extension }), 'format'));
    } else {
      findings.push(finding('medium', t(lang, 'Formato non riconosciuto (magic bytes)'),
        t(lang, 'I primi byte non corrispondono a nessun formato noto: il contenuto potrebbe non essere quello che l’estensione dichiara.'), 'format'));
    }
  } else if (ft.extensionMatch === false) {
    findings.push(finding('high', t(lang, 'Estensione e contenuto non coincidono'),
      t(lang, 'Il contenuto è «{type}» ma l’estensione è {ext}: è una tecnica comune per mascherare un file.', { type: describeType(lang, ft.code), ext: ctx.extension || '—' }), 'format'));
  }

  if (ctx.entropy >= 7.5 && !['zip', 'zip_empty', 'rar', '7z', 'png', 'jpeg', 'pdf'].includes(ft.code)) {
    findings.push(finding('medium', t(lang, 'Entropia elevata'),
      t(lang, 'Entropia di Shannon {e} su 8: il contenuto sembra compresso o cifrato. In un eseguibile può indicare un packer usato per nascondere il codice.', { e: ctx.entropy }), 'entropy'));
  }

  if (ctx.highRiskExtension) {
    findings.push(finding('medium', t(lang, 'Estensione eseguibile o script'),
      t(lang, 'I file {ext} possono eseguire codice quando vengono aperti: aprili solo se ne conosci la provenienza.', { ext: ctx.extension }), 'extension'));
  }

  for (const hit of ctx.patternHits) {
    if (hit.severity === 'info') continue;
    findings.push(finding(hit.severity, hit.name,
      t(lang, 'Stringa sospetta trovata nel contenuto (categoria: {cat}). Da sola non prova che il file sia dannoso.', { cat: hit.categoryLabel }), 'signatures'));
  }

  if (ctx.pe && ctx.pe.isDll) {
    findings.push(finding('low', t(lang, 'Libreria Windows (DLL)'),
      t(lang, 'Codice che altri programmi possono caricare: controlla firma digitale e provenienza.'), 'pe'));
  }

  if (ctx.network.urls.length > 5) {
    findings.push(finding('low', t(lang, 'Molti indirizzi web nel contenuto'),
      t(lang, '{n} URL trovati tra le stringhe: verifica a cosa si collegherebbe il file.', { n: ctx.network.urls.length }), 'network'));
  }

  if (!findings.length) {
    findings.push(finding('info', t(lang, 'Nessun segnale statico rilevante'),
      t(lang, 'L’analisi statica non ha trovato indicatori. Non è una garanzia: controlla comunque lo SHA-256 su VirusTotal.'), 'summary'));
  }

  return findings;
}

function computeScore(findings, patternHits, lang) {
  const breakdown = [];
  let score = 100;

  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity });
  };

  const penalty = { critical: -40, high: -18, medium: -10, low: -4 };
  for (const f of findings) {
    if (f.module === 'summary' || !penalty[f.severity]) continue;
    add(f.module, f.title, penalty[f.severity], f.severity);
  }

  const critPatterns = patternHits.filter((p) => p.severity === 'critical').length;
  if (critPatterns) add('crit_sig', t(lang, 'Indicatori critici'), -critPatterns * 15, 'critical');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';
  const risk = score < 55 ? 'critical' : score < 70 ? 'high' : score < 85 ? 'medium' : 'low';

  return { score, grade, risk, breakdown };
}

function verdictFromScore(score, patternHits) {
  if (patternHits.some((p) => p.severity === 'critical')) return 'malicious_likely';
  if (score < 55) return 'suspicious';
  if (score < 75) return 'investigate';
  return 'clean_static';
}

function verdictLabel(lang, code) {
  switch (code) {
    case 'malicious_likely': return t(lang, 'Probabilmente dannoso');
    case 'suspicious': return t(lang, 'Sospetto');
    case 'investigate': return t(lang, 'Da approfondire');
    default: return t(lang, 'Nessun segnale statico forte');
  }
}

function entropyLabel(lang, e) {
  if (e >= 7.5) return t(lang, 'alta');
  if (e >= 6.5) return t(lang, 'media');
  return t(lang, 'normale');
}

function analyzeFileBuffer(buffer, originalName, clientMime, lang) {
  const name = String(originalName || 'unknown');
  const ext = name.includes('.') ? '.' + name.split('.').pop().toLowerCase() : '';

  const hashes = computeHashes(buffer);
  const entropy = shannonEntropy(buffer);
  const fileType = detectFileType(buffer, ext);
  const strings = extractStrings(buffer);
  const patternHits = scanStringPatterns(strings, lang);
  const network = extractNetworkIndicators(strings);
  const pe = parsePeHints(buffer);

  const ctx = {
    extension: ext,
    fileType,
    entropy,
    highRiskExtension: HIGH_RISK_EXT.has(ext),
    patternHits,
    pe,
    network,
  };

  const findings = buildFindings(ctx, lang);
  const scoring = computeScore(findings, patternHits, lang);
  const verdict = verdictFromScore(scoring.score, patternHits);

  return {
    originalName: name,
    size: buffer.length,
    clientMime: clientMime || null,
    extension: ext.replace(/^\./, '') || 'none',
    hashes,
    fileType: { ...fileType, detected: describeType(lang, fileType.code) },
    entropy: {
      shannon: entropy,
      level: entropy >= 7.5 ? 'high' : entropy >= 6.5 ? 'medium' : 'normal',
      label: entropyLabel(lang, entropy),
    },
    pe,
    strings: {
      count: strings.length,
      sample: strings.slice(0, 25).map((s) => (s.length > 120 ? s.slice(0, 120) + '…' : s)),
    },
    patternHits,
    network,
    findings,
    ...scoring,
    scoreBreakdown: scoring.breakdown,
    verdict: {
      code: verdict,
      label: verdictLabel(lang, verdict),
      mode: 'static_heuristic',
      note: t(lang, 'È un giudizio euristico su un’analisi statica: non sostituisce un antivirus con più motori. Conferma con VirusTotal o in una sandbox.'),
    },
    virusTotalUrl: `https://www.virustotal.com/gui/file/${hashes.sha256}`,
    limitations: scanLimitations(lang),
    scanType: 'static_file_scan',
    status: 'success',
  };
}

function runFileScan(file, lang) {
  if (!file?.buffer?.length) {
    throw new Error('File vuoto o non ricevuto');
  }
  return analyzeFileBuffer(file.buffer, file.originalname || 'unknown', file.mimetype, lang);
}

module.exports = {
  runFileScan,
  analyzeFileBuffer,
  extractStrings,
  scanLimitations,
  MAX_STRING_LEN,
  MAX_STRINGS,
};

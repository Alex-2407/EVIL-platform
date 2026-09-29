/**
 * EVIL Static File Scanner — analisi in memoria, zero esecuzione
 */
const crypto = require('crypto');

const SCAN_LIMITATIONS = [
  'Analisi statica in RAM: il file non viene eseguito né scritto su disco.',
  'Non è un motore antivirus con firme cloud — usa euristiche, entropia e pattern noti.',
  'Per verdict multi-engine usa SHA-256 su VirusTotal o una sandbox professionale.',
  'Carica solo campioni di cui hai autorizzazione legale (proprietà o mandato).'
];

const MAGIC_SIGNATURES = [
  { type: 'PE executable', magic: [0x4d, 0x5a], extensions: ['.exe', '.dll', '.sys', '.scr', '.msi'] },
  { type: 'PDF document', magic: [0x25, 0x50, 0x44, 0x46], extensions: ['.pdf'] },
  { type: 'ZIP archive', magic: [0x50, 0x4b, 0x03, 0x04], extensions: ['.zip', '.docx', '.xlsx', '.pptx', '.jar', '.apk'] },
  { type: 'ZIP archive (empty)', magic: [0x50, 0x4b, 0x05, 0x06], extensions: ['.zip'] },
  { type: 'RAR archive', magic: [0x52, 0x61, 0x72, 0x21], extensions: ['.rar'] },
  { type: '7-Zip archive', magic: [0x37, 0x7a, 0xbc, 0xaf], extensions: ['.7z'] },
  { type: 'PNG image', magic: [0x89, 0x50, 0x4e, 0x47], extensions: ['.png'] },
  { type: 'JPEG image', magic: [0xff, 0xd8, 0xff], extensions: ['.jpg', '.jpeg'] },
  { type: 'ELF executable', magic: [0x7f, 0x45, 0x4c, 0x46], extensions: ['.elf', '.so', '.bin'] },
  { type: 'Mach-O', magic: [0xfe, 0xed, 0xfa, 0xce], extensions: ['.dmg', '.pkg'] },
  { type: 'Mach-O 64', magic: [0xfe, 0xed, 0xfa, 0xcf], extensions: ['.dmg', '.pkg'] }
];

const HIGH_RISK_EXT = new Set([
  '.exe', '.dll', '.sys', '.scr', '.msi', '.bat', '.cmd', '.ps1', '.vbs', '.js', '.jar', '.apk', '.hta', '.wsf'
]);

const STRING_PATTERNS = [
  { id: 'eicar', name: 'EICAR test standard', pattern: 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE', severity: 'info', category: 'test' },
  { id: 'ps_encode', name: 'PowerShell encoded command', pattern: /-(enc|encodedcommand)\s+/i, severity: 'high', category: 'script' },
  { id: 'ps_iex', name: 'PowerShell IEX/download cradle', pattern: /IEX\s*\(|DownloadString|DownloadFile/i, severity: 'high', category: 'script' },
  { id: 'cmd_exec', name: 'CMD/shell invocation', pattern: /\bcmd\.exe\b|\bpowershell\.exe\b|\bwscript\.exe\b/i, severity: 'medium', category: 'script' },
  { id: 'reg_run', name: 'Registry Run persistence', pattern: /CurrentVersion\\Run/i, severity: 'medium', category: 'persistence' },
  { id: 'mimikatz', name: 'Credential tool string', pattern: /mimikatz|sekurlsa|lsadump/i, severity: 'critical', category: 'malware' },
  { id: 'ransom', name: 'Ransomware indicator', pattern: /your files have been encrypted|bitcoin|\.locked|decrypt.*key/i, severity: 'high', category: 'ransomware' },
  { id: 'amsi_bypass', name: 'AMSI bypass hint', pattern: /amsi\.dll|AmsiScanBuffer/i, severity: 'high', category: 'evasion' },
  { id: 'url_http', name: 'HTTP(S) URL embedded', pattern: /https?:\/\/[^\s"'<>]{8,}/i, severity: 'low', category: 'network' }
];

function matchesMagic(buffer, magic) {
  if (buffer.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) return false;
  }
  return true;
}

function detectFileType(buffer, ext) {
  for (const sig of MAGIC_SIGNATURES) {
    if (matchesMagic(buffer, sig.magic)) {
      const extOk = !ext || sig.extensions.includes(ext);
      return { detected: sig.type, magicMatch: true, extensionMatch: extOk };
    }
  }
  return { detected: 'Unknown', magicMatch: false, extensionMatch: null };
}

function computeHashes(buffer) {
  return {
    md5: crypto.createHash('md5').update(buffer).digest('hex'),
    sha1: crypto.createHash('sha1').update(buffer).digest('hex'),
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    sha512: crypto.createHash('sha512').update(buffer).digest('hex')
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

function extractStrings(buffer, minLen = 6, maxStrings = 400) {
  const strings = [];
  let current = '';
  const sample = buffer.length > 2 * 1024 * 1024 ? buffer.subarray(0, 2 * 1024 * 1024) : buffer;

  for (let i = 0; i < sample.length && strings.length < maxStrings; i++) {
    const c = sample[i];
    if (c >= 0x20 && c <= 0x7e) {
      current += String.fromCharCode(c);
    } else {
      if (current.length >= minLen) strings.push(current);
      current = '';
    }
  }
  if (current.length >= minLen && strings.length < maxStrings) strings.push(current);
  return strings;
}

function scanStringPatterns(strings) {
  const hits = [];
  const blob = strings.slice(0, 200).join('\n');
  for (const rule of STRING_PATTERNS) {
    const match =
      typeof rule.pattern === 'string' ? blob.includes(rule.pattern) : rule.pattern.test(blob);
    if (match) {
      hits.push({
        id: rule.id,
        name: rule.name,
        severity: rule.severity,
        category: rule.category
      });
    }
  }
  return hits;
}

function extractNetworkIndicators(strings) {
  const urls = new Set();
  const ips = new Set();
  const urlRe = /https?:\/\/[^\s"'<>]{8,}/gi;
  const ipRe = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g;

  for (const s of strings.slice(0, 150)) {
    let m;
    while ((m = urlRe.exec(s)) !== null && urls.size < 20) urls.add(m[0].slice(0, 200));
    while ((m = ipRe.exec(s)) !== null && ips.size < 20) ips.add(m[0]);
  }

  return { urls: [...urls], ips: [...ips] };
}

function parsePeHints(buffer) {
  if (buffer.length < 0x40 || buffer[0] !== 0x4d || buffer[1] !== 0x5a) return null;
  const peOffset = buffer.readUInt32LE(0x3c);
  if (peOffset + 24 > buffer.length) return null;
  if (buffer.toString('ascii', peOffset, peOffset + 4) !== 'PE\0\0') return null;

  const machine = buffer.readUInt16LE(peOffset + 4);
  const numSections = buffer.readUInt16LE(peOffset + 6);
  const machineMap = {
    0x14c: 'i386',
    0x8664: 'AMD64',
    0xaa64: 'ARM64'
  };

  const optStart = peOffset + 24;
  const magic = buffer.readUInt16LE(optStart);
  const isPe32Plus = magic === 0x20b;

  let subsystem = null;
  if (isPe32Plus && optStart + 0x44 < buffer.length) {
    subsystem = buffer.readUInt16LE(optStart + 0x44);
  } else if (optStart + 0x38 < buffer.length) {
    subsystem = buffer.readUInt16LE(optStart + 0x38);
  }

  const subMap = { 2: 'GUI', 3: 'Console', 12: 'EFI' };

  return {
    format: 'PE32+',
    machine: machineMap[machine] || `0x${machine.toString(16)}`,
    sections: numSections,
    subsystem: subMap[subsystem] || subsystem,
    isDll: (buffer.readUInt16LE(peOffset + 0x16) & 0x2000) !== 0
  };
}

function buildFindings(ctx) {
  const findings = [];

  if (ctx.fileType && !ctx.fileType.magicMatch) {
    findings.push({
      severity: 'medium',
      title: 'Tipo file non riconosciuto (magic bytes)',
      detail: 'Estensione e contenuto potrebbero non coincidere — possibile mascheramento.',
      module: 'format'
    });
  } else if (ctx.fileType && ctx.fileType.magicMatch && ctx.fileType.extensionMatch === false) {
    findings.push({
      severity: 'high',
      title: 'Disallineamento estensione / contenuto',
      detail: `Rilevato ${ctx.fileType.detected} ma estensione diversa.`,
      module: 'format'
    });
  }

  if (ctx.entropy >= 7.5) {
    findings.push({
      severity: 'medium',
      title: 'Entropia elevata',
      detail: `Shannon ${ctx.entropy} — possibile packing/cifratura.`,
      module: 'entropy'
    });
  }

  if (ctx.highRiskExtension) {
    findings.push({
      severity: 'medium',
      title: 'Estensione eseguibile/script',
      detail: `Estensione ${ctx.extension} — superficie di esecuzione.`,
      module: 'extension'
    });
  }

  for (const hit of ctx.patternHits) {
    if (hit.severity === 'info') continue;
    findings.push({
      severity: hit.severity,
      title: hit.name,
      detail: `Pattern statico (${hit.category}).`,
      module: 'signatures'
    });
  }

  if (ctx.pe && ctx.pe.isDll) {
    findings.push({
      severity: 'low',
      title: 'Modulo PE (DLL)',
      detail: 'Libreria caricabile — verifica firma e provenienza.',
      module: 'pe'
    });
  }

  if (ctx.network.urls.length > 5) {
    findings.push({
      severity: 'low',
      title: 'Molti URL embedded',
      detail: `${ctx.network.urls.length} URL estratti dalle stringhe.`,
      module: 'network'
    });
  }

  if (!findings.length) {
    findings.push({
      severity: 'info',
      title: 'Nessun indicatore statico prioritario',
      detail: 'Controlla comunque SHA-256 su VirusTotal.',
      module: 'summary'
    });
  }

  return findings;
}

function computeScore(findings, patternHits) {
  const breakdown = [];
  let score = 100;

  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity });
  };

  for (const f of findings) {
    if (f.module === 'summary') continue;
    if (f.severity === 'critical') add(f.module, f.title, -40, 'critical');
    else if (f.severity === 'high') add(f.module, f.title, -18, 'high');
    else if (f.severity === 'medium') add(f.module, f.title, -10, 'medium');
    else if (f.severity === 'low') add(f.module, f.title, -4, 'low');
  }

  const critPatterns = patternHits.filter((p) => p.severity === 'critical').length;
  if (critPatterns) add('crit_sig', 'Firme critiche', -critPatterns * 15, 'critical');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';
  const risk =
    score < 55 ? 'critical' : score < 70 ? 'high' : score < 85 ? 'medium' : 'low';

  return { score, grade, risk, breakdown };
}

function verdictFromScore(score, patternHits) {
  if (patternHits.some((p) => p.severity === 'critical')) return 'malicious_likely';
  if (score < 55) return 'suspicious';
  if (score < 75) return 'investigate';
  return 'clean_static';
}

function analyzeFileBuffer(buffer, originalName, clientMime) {
  const ext = originalName.includes('.')
    ? ('.' + originalName.split('.').pop().toLowerCase())
    : '';

  const hashes = computeHashes(buffer);
  const entropy = shannonEntropy(buffer);
  const fileType = detectFileType(buffer, ext);
  const strings = extractStrings(buffer);
  const patternHits = scanStringPatterns(strings);
  const network = extractNetworkIndicators(strings);
  const pe = parsePeHints(buffer);

  const ctx = {
    extension: ext,
    fileType,
    entropy,
    highRiskExtension: HIGH_RISK_EXT.has(ext),
    patternHits,
    pe,
    network
  };

  const findings = buildFindings(ctx);
  const scoring = computeScore(findings, patternHits);
  const verdict = verdictFromScore(scoring.score, patternHits);

  return {
    originalName,
    size: buffer.length,
    clientMime: clientMime || null,
    extension: ext.replace(/^\./, '') || 'none',
    hashes,
    fileType,
    entropy: {
      shannon: entropy,
      label: entropy >= 7.5 ? 'high' : entropy >= 6.5 ? 'medium' : 'normal'
    },
    pe,
    strings: {
      count: strings.length,
      sample: strings.slice(0, 25).map((s) => (s.length > 120 ? s.slice(0, 120) + '…' : s))
    },
    patternHits,
    network,
    findings,
    ...scoring,
    scoreBreakdown: scoring.breakdown,
    verdict: {
      code: verdict,
      label:
        verdict === 'malicious_likely'
          ? 'Sospetto (statico)'
          : verdict === 'suspicious'
            ? 'Sospetto'
            : verdict === 'investigate'
              ? 'Da approfondire'
              : 'Nessun segnale statico forte',
      mode: 'static_heuristic',
      note: 'Non sostituisce antivirus multi-engine. Conferma con VirusTotal o sandbox.'
    },
    virusTotalUrl: `https://www.virustotal.com/gui/file/${hashes.sha256}`,
    limitations: SCAN_LIMITATIONS,
    scanType: 'static_file_scan',
    status: 'success'
  };
}

function runFileScan(file) {
  if (!file?.buffer?.length) {
    throw new Error('File vuoto o non ricevuto');
  }
  return analyzeFileBuffer(file.buffer, file.originalname || 'unknown', file.mimetype);
}

module.exports = { runFileScan, analyzeFileBuffer, SCAN_LIMITATIONS };

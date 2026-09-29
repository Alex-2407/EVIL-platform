/**
 * EVIL SSL Certificate Analyzer — TLS handshake + analisi certificato
 */
const tls = require('tls');
const { normalizeDomain } = require('./dns-enumerator-service');

const OBSOLETE_PROTOCOLS = ['SSLv2', 'SSLv3', 'TLSv1', 'TLSv1.1'];
const WEAK_CIPHERS = [/NULL/i, /EXPORT/i, /DES/i, /RC4/i, /MD5/i, /anon/i];

const AUDIT_LIMITATIONS = [
  'Analisi da singola connessione TLS sulla porta 443 — non scansiona tutte le versioni/cipher supportate dal server.',
  'rejectUnauthorized disabilitato per leggere certificati anche se non trusted (didattica/OSINT).',
  'Non verifica OCSP stapling, CT logs né configurazioni HSTS lato HTTP.',
  'Solo su domini per cui hai autorizzazione esplicita.'
];

function parseCertField(field) {
  if (!field) return {};
  if (typeof field === 'object' && !Array.isArray(field)) {
    return {
      CN: field.CN,
      O: field.O,
      C: field.C,
      OU: field.OU,
      ST: field.ST,
      L: field.L
    };
  }
  const parts = {};
  const re = /(\w+)=([^,]+)/g;
  let m;
  const str = String(field);
  while ((m = re.exec(str)) !== null) parts[m[1]] = m[2].trim();
  return parts;
}

function parseSans(cert) {
  if (!cert.subjectaltname) return [];
  return cert.subjectaltname
    .split(',')
    .map((s) => s.trim().replace(/^DNS:/i, ''))
    .filter(Boolean);
}

function countChain(cert) {
  let count = 0;
  let node = cert;
  const seen = new Set();
  while (node && node.subject) {
    const fp = node.fingerprint || JSON.stringify(node.subject);
    if (seen.has(fp)) break;
    seen.add(fp);
    count++;
    if (!node.issuerCertificate || node.issuerCertificate === node) break;
    node = node.issuerCertificate;
  }
  return count;
}

function hostnameMatches(domain, cn, sans) {
  const d = domain.toLowerCase();
  const candidates = [cn, ...(sans || [])].filter(Boolean).map((n) => n.toLowerCase());

  for (const name of candidates) {
    if (name === d) return true;
    if (name.startsWith('*.')) {
      const base = name.slice(2);
      if (d === base) return true;
      const suffix = '.' + base;
      if (d.endsWith(suffix) && d.slice(0, -suffix.length).indexOf('.') === -1) return true;
    }
  }
  return false;
}

function fetchTlsCertificate(domain) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      443,
      domain,
      { servername: domain, rejectUnauthorized: false, timeout: 12000 },
      function onConnect() {
        const cert = socket.getPeerCertificate(true);
        const result = {
          protocol: socket.getProtocol?.() || null,
          cipher: socket.getCipher?.() || null,
          authorized: socket.authorized,
          authorizationError: socket.authorizationError || null,
          cert
        };
        socket.end();
        resolve(result);
      }
    );

    socket.on('error', (err) => resolve({ error: err.message }));
    socket.setTimeout(12000, () => {
      socket.destroy();
      resolve({ error: 'Timeout connessione TLS (12s)' });
    });
  });
}

function buildAnalysis(domain, raw) {
  const cert = raw.cert;
  const subject = parseCertField(cert.subject);
  const issuer = parseCertField(cert.issuer);
  const sans = parseSans(cert);
  const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
  const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
  const now = new Date();
  const daysUntilExpiry = validTo
    ? Math.floor((validTo - now) / 86400000)
    : null;
  const isExpired = validTo ? validTo < now : false;
  const notYetValid = validFrom ? validFrom > now : false;
  const cn = subject.CN || null;
  const hostnameOk = hostnameMatches(domain, cn, sans);
  const selfSigned =
    subject.CN &&
    issuer.CN &&
    subject.CN === issuer.CN &&
    (subject.O || '') === (issuer.O || '');

  const sigalg = cert.sigalg || '';
  const keyBits = cert.bits || null;
  const weakSig = /sha1|md5/i.test(sigalg);
  const weakKey = keyBits != null && keyBits < 2048;
  const obsoleteProto = raw.protocol && OBSOLETE_PROTOCOLS.includes(raw.protocol);
  const weakCipher = raw.cipher?.name && WEAK_CIPHERS.some((re) => re.test(raw.cipher.name));

  let lifecycle = 'valid';
  if (isExpired) lifecycle = 'expired';
  else if (notYetValid) lifecycle = 'not_yet_valid';
  else if (daysUntilExpiry != null && daysUntilExpiry < 14) lifecycle = 'critical_expiry';
  else if (daysUntilExpiry != null && daysUntilExpiry < 30) lifecycle = 'warning_expiry';

  return {
    lifecycle,
    isValid: !isExpired && !notYetValid,
    isExpired,
    notYetValid,
    daysUntilExpiry,
    hostnameMatch: hostnameOk,
    selfSigned,
    weakSignature: weakSig,
    weakKey,
    obsoleteProtocol: obsoleteProto,
    weakCipher,
    chainLength: countChain(cert),
    protocol: raw.protocol,
    cipher: raw.cipher
      ? { name: raw.cipher.name, version: raw.cipher.version }
      : null,
    authorized: raw.authorized,
    authorizationError: raw.authorizationError,
    algorithm: sigalg || 'Unknown',
    keySize: keyBits,
    subjectAltNames: sans,
    wildcard: sans.some((s) => s.startsWith('*.')) || (cn && cn.startsWith('*.'))
  };
}

function buildFindings(domain, analysis, cert) {
  const findings = [];

  if (analysis.isExpired) {
    findings.push({
      severity: 'critical',
      title: 'Certificato scaduto',
      detail: `Scadenza: ${cert.valid_to}`,
      module: 'validity'
    });
  } else if (analysis.notYetValid) {
    findings.push({
      severity: 'critical',
      title: 'Certificato non ancora valido',
      detail: `Valido da: ${cert.valid_from}`,
      module: 'validity'
    });
  } else if (analysis.lifecycle === 'critical_expiry') {
    findings.push({
      severity: 'high',
      title: `Scadenza imminente (${analysis.daysUntilExpiry} giorni)`,
      detail: 'Rinnovare il certificato entro 14 giorni.',
      module: 'validity'
    });
  } else if (analysis.lifecycle === 'warning_expiry') {
    findings.push({
      severity: 'medium',
      title: `Scadenza tra ${analysis.daysUntilExpiry} giorni`,
      detail: 'Pianificare il rinnovo del certificato.',
      module: 'validity'
    });
  }

  if (!analysis.hostnameMatch) {
    findings.push({
      severity: 'high',
      title: 'Hostname non coperto dal certificato',
      detail: `CN/SAN non corrispondono a ${domain}.`,
      module: 'names',
      recommendation: 'Aggiungi il dominio ai SAN o usa un certificato corretto.'
    });
  }

  if (!analysis.authorized) {
    findings.push({
      severity: 'high',
      title: 'Catena non trusted',
      detail: analysis.authorizationError || 'Validazione catena fallita.',
      module: 'trust'
    });
  }

  if (analysis.selfSigned) {
    findings.push({
      severity: 'medium',
      title: 'Possibile certificato self-signed',
      detail: 'Subject e Issuer coincidono.',
      module: 'trust'
    });
  }

  if (analysis.obsoleteProtocol) {
    findings.push({
      severity: 'critical',
      title: `Protocollo TLS obsoleto (${analysis.protocol})`,
      detail: 'Abilitare TLS 1.2+ e disabilitare versioni legacy.',
      module: 'protocol'
    });
  }

  if (analysis.weakCipher) {
    findings.push({
      severity: 'high',
      title: 'Cipher suite debole',
      detail: analysis.cipher?.name || 'Cipher non sicuro negoziato.',
      module: 'cipher'
    });
  }

  if (analysis.weakSignature) {
    findings.push({
      severity: 'medium',
      title: 'Algoritmo firma debole',
      detail: analysis.algorithm,
      module: 'crypto'
    });
  }

  if (analysis.weakKey) {
    findings.push({
      severity: 'high',
      title: 'Chiave RSA troppo corta',
      detail: `${analysis.keySize} bit — minimo consigliato 2048.`,
      module: 'crypto'
    });
  }

  if (analysis.chainLength < 2 && !analysis.selfSigned) {
    findings.push({
      severity: 'low',
      title: 'Catena corta',
      detail: `Solo ${analysis.chainLength} certificato/i nella catena fornita.`,
      module: 'chain'
    });
  }

  if (!findings.length) {
    findings.push({
      severity: 'info',
      title: 'Profilo TLS adeguato',
      detail: 'Nessun gap prioritario sui controlli eseguiti.',
      module: 'summary'
    });
  }

  return findings;
}

function computeScore(analysis, findings) {
  const breakdown = [];
  let score = 100;

  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity });
  };

  if (analysis.isExpired) add('expired', 'Certificato scaduto', -50, 'critical');
  if (analysis.notYetValid) add('not_valid_yet', 'Non ancora valido', -40, 'critical');
  if (analysis.lifecycle === 'critical_expiry') add('expiry_14', 'Scade <14 giorni', -18, 'high');
  else if (analysis.lifecycle === 'warning_expiry') add('expiry_30', 'Scade <30 giorni', -10, 'medium');
  if (!analysis.hostnameMatch) add('hostname', 'Hostname mismatch', -15, 'high');
  if (!analysis.authorized) add('untrusted', 'Catena non trusted', -12, 'high');
  if (analysis.selfSigned) add('self_signed', 'Self-signed', -10, 'medium');
  if (analysis.obsoleteProtocol) add('old_tls', 'TLS obsoleto', -25, 'critical');
  if (analysis.weakCipher) add('weak_cipher', 'Cipher debole', -15, 'high');
  if (analysis.weakSignature) add('weak_sig', 'Firma debole', -8, 'medium');
  if (analysis.weakKey) add('weak_key', 'Chiave corta', -15, 'high');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';

  return { score, grade, breakdown };
}

async function runSslAnalysis(inputDomain) {
  const started = Date.now();
  const domain = normalizeDomain(inputDomain);

  const raw = await fetchTlsCertificate(domain);
  if (raw.error) {
    return {
      domain,
      timestamp: new Date().toISOString(),
      scanDurationMs: Date.now() - started,
      error: raw.error,
      status: 'failed',
      scanType: 'ssl_analysis'
    };
  }

  const cert = raw.cert;
  const subject = parseCertField(cert.subject);
  const issuer = parseCertField(cert.issuer);
  const analysis = buildAnalysis(domain, raw);
  const findings = buildFindings(domain, analysis, cert);
  const scoring = computeScore(analysis, findings);

  return {
    domain,
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - started,
    certificate: {
      subject,
      issuer,
      validFrom: cert.valid_from,
      validTo: cert.valid_to,
      fingerprint: cert.fingerprint,
      fingerprint256: cert.fingerprint256 || null,
      serialNumber: cert.serialNumber || null,
      status: analysis.isExpired ? 'expired' : 'valid'
    },
    tls: {
      protocol: analysis.protocol,
      cipher: analysis.cipher,
      authorized: analysis.authorized,
      authorizationError: analysis.authorizationError,
      chainLength: analysis.chainLength
    },
    analysis,
    findings,
    ...scoring,
    scoreBreakdown: scoring.breakdown,
    limitations: AUDIT_LIMITATIONS,
    note: 'Handshake TLS su :443 con estrazione certificato peer e controlli su validità, SAN, trust e crittografia.',
    scanType: 'ssl_analysis',
    status: 'success'
  };
}

module.exports = { runSslAnalysis };

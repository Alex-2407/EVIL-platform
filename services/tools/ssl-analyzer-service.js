/**
 * EVIL — Certificato TLS: handshake sulla porta 443 e analisi del certificato presentato.
 * Testi per l'utente nella lingua della richiesta (t(lang, …)).
 */
const { connectTls, assertPublicDestination } = require('../../server/lib/safe-http');
const { t } = require('../../server/i18n');
const { normalizeToolDomain } = require('./tool-i18n');

const OBSOLETE_PROTOCOLS = ['SSLv2', 'SSLv3', 'TLSv1', 'TLSv1.1'];
const WEAK_CIPHERS = [/NULL/i, /EXPORT/i, /DES/i, /RC4/i, /MD5/i, /anon/i];

function auditLimitations(lang) {
  return [
    t(lang, 'Una sola connessione TLS sulla porta 443: mostra il protocollo e la cipher suite negoziati, non tutte le versioni che il server accetta.'),
    t(lang, 'Il certificato viene letto anche quando non è considerato affidabile, proprio per poterlo esaminare: la connessione serve solo all’analisi.'),
    t(lang, 'Non controlla la revoca (OCSP, CRL), i registri Certificate Transparency né l’header HSTS (per quello usa l’Audit header HTTP).'),
  ];
}

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
    let socket;
    try {
      socket = connectTls(domain, 443, { rejectUnauthorized: false, timeout: 12000 });
    } catch (err) {
      resolve({ error: err.message, cause: err });
      return;
    }
    socket.once('secureConnect', function onConnect() {
      const cert = socket.getPeerCertificate(true);
      const result = {
        protocol: socket.getProtocol?.() || null,
        cipher: socket.getCipher?.() || null,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError
          ? String(socket.authorizationError.code || socket.authorizationError)
          : null,
        cert
      };
      socket.end();
      resolve(result);
    });

    socket.on('error', (err) => resolve({ error: err.message, code: err.code || null }));
    socket.setTimeout(12000, () => {
      socket.destroy();
      resolve({ error: 'TLS handshake timeout', code: 'ETIMEDOUT' });
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
    algorithm: sigalg || '—',
    keySize: keyBits,
    subjectAltNames: sans,
    wildcard: sans.some((s) => s.startsWith('*.')) || (cn && cn.startsWith('*.'))
  };
}

function lifecycleLabel(lang, lc) {
  switch (lc) {
    case 'expired': return t(lang, 'Scaduto');
    case 'not_yet_valid': return t(lang, 'Non ancora valido');
    case 'critical_expiry': return t(lang, 'Scade a breve');
    case 'warning_expiry': return t(lang, 'In scadenza');
    default: return t(lang, 'Valido');
  }
}

function severityLabel(lang, sev) {
  switch (sev) {
    case 'critical': return t(lang, 'critica');
    case 'high': return t(lang, 'alta');
    case 'medium': return t(lang, 'media');
    case 'low': return t(lang, 'bassa');
    default: return t(lang, 'informativa');
  }
}

/** Messaggi di OpenSSL sulla validazione della catena, in parole semplici. */
function trustErrorText(lang, code) {
  switch (code) {
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
    case 'SELF_SIGNED_CERT_IN_CHAIN':
      return t(lang, 'Il certificato è autofirmato: nessuna autorità di certificazione riconosciuta ne garantisce l’identità.');
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY':
    case 'UNABLE_TO_GET_ISSUER_CERT':
      return t(lang, 'Manca un certificato intermedio: il server non invia la catena completa fino a un’autorità riconosciuta.');
    case 'CERT_HAS_EXPIRED':
      return t(lang, 'Un certificato della catena è scaduto.');
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
    case 'HOSTNAME_MISMATCH':
      return t(lang, 'Il certificato non è stato emesso per questo nome.');
    case 'CERT_NOT_YET_VALID':
      return t(lang, 'Un certificato della catena non è ancora valido.');
    default:
      return code ? t(lang, 'Validazione della catena non riuscita ({code}).', { code }) : t(lang, 'Validazione della catena non riuscita.');
  }
}

function buildFindings(domain, analysis, cert, lang) {
  const findings = [];

  if (analysis.isExpired) {
    findings.push({
      severity: 'critical',
      title: t(lang, 'Certificato scaduto'),
      detail: t(lang, 'Scaduto il {date}: i browser mostrano un avviso di sicurezza ai visitatori.', { date: cert.valid_to }),
      module: 'validity',
      recommendation: t(lang, 'Rinnova subito il certificato e automatizza i rinnovi (per esempio con ACME/Let’s Encrypt).'),
    });
  } else if (analysis.notYetValid) {
    findings.push({
      severity: 'critical',
      title: t(lang, 'Certificato non ancora valido'),
      detail: t(lang, 'Valido solo dal {date}: controlla la data del server o il certificato installato.', { date: cert.valid_from }),
      module: 'validity',
    });
  } else if (analysis.lifecycle === 'critical_expiry') {
    findings.push({
      severity: 'high',
      title: t(lang, 'Scade tra {n} giorni', { n: analysis.daysUntilExpiry }),
      detail: t(lang, 'Mancano meno di 14 giorni alla scadenza.'),
      module: 'validity',
      recommendation: t(lang, 'Rinnova il certificato adesso.'),
    });
  } else if (analysis.lifecycle === 'warning_expiry') {
    findings.push({
      severity: 'medium',
      title: t(lang, 'Scade tra {n} giorni', { n: analysis.daysUntilExpiry }),
      detail: t(lang, 'Mancano meno di 30 giorni alla scadenza.'),
      module: 'validity',
      recommendation: t(lang, 'Pianifica il rinnovo del certificato.'),
    });
  }

  if (!analysis.hostnameMatch) {
    findings.push({
      severity: 'high',
      title: t(lang, 'Il certificato non copre questo nome'),
      detail: t(lang, 'Né il Common Name né i SAN corrispondono a {domain}: il browser segnalerà un errore.', { domain }),
      module: 'names',
      recommendation: t(lang, 'Emetti un certificato che includa questo nome tra i SAN.'),
    });
  }

  if (!analysis.authorized) {
    findings.push({
      severity: 'high',
      title: t(lang, 'Catena di fiducia non valida'),
      detail: trustErrorText(lang, analysis.authorizationError),
      module: 'trust',
      recommendation: t(lang, 'Configura il server perché invii il certificato con tutti gli intermedi, emesso da un’autorità riconosciuta.'),
    });
  }

  if (analysis.selfSigned) {
    findings.push({
      severity: 'medium',
      title: t(lang, 'Probabile certificato autofirmato'),
      detail: t(lang, 'Soggetto ed emittente coincidono: va bene in laboratorio, non su un sito pubblico.'),
      module: 'trust',
    });
  }

  if (analysis.obsoleteProtocol) {
    findings.push({
      severity: 'critical',
      title: t(lang, 'Protocollo obsoleto ({protocol})', { protocol: analysis.protocol }),
      detail: t(lang, 'Le versioni precedenti a TLS 1.2 hanno debolezze note e non sono più accettate dai browser moderni.'),
      module: 'protocol',
      recommendation: t(lang, 'Abilita solo TLS 1.2 e TLS 1.3.'),
    });
  }

  if (analysis.weakCipher) {
    findings.push({
      severity: 'high',
      title: t(lang, 'Cipher suite debole'),
      detail: t(lang, 'È stata negoziata {cipher}, che usa algoritmi non più sicuri.', { cipher: analysis.cipher?.name || '—' }),
      module: 'cipher',
      recommendation: t(lang, 'Disattiva le cipher suite con RC4, DES, 3DES, NULL, EXPORT o senza autenticazione.'),
    });
  }

  if (analysis.weakSignature) {
    findings.push({
      severity: 'medium',
      title: t(lang, 'Algoritmo di firma debole'),
      detail: t(lang, '{alg}: SHA-1 e MD5 non sono più considerati sicuri per firmare certificati.', { alg: analysis.algorithm }),
      module: 'crypto',
    });
  }

  if (analysis.weakKey) {
    findings.push({
      severity: 'high',
      title: t(lang, 'Chiave troppo corta'),
      detail: t(lang, '{bits} bit: per RSA il minimo raccomandato è 2048 bit.', { bits: analysis.keySize }),
      module: 'crypto',
    });
  }

  if (analysis.chainLength < 2 && !analysis.selfSigned) {
    findings.push({
      severity: 'low',
      title: t(lang, 'Catena incompleta'),
      detail: t(lang, 'Il server ha inviato solo {n} certificato: di solito servono anche gli intermedi.', { n: analysis.chainLength }),
      module: 'chain',
    });
  }

  if (!findings.length) {
    findings.push({
      severity: 'info',
      title: t(lang, 'Configurazione TLS adeguata'),
      detail: t(lang, 'Nessun problema importante nei controlli eseguiti.'),
      module: 'summary',
    });
  }

  return findings.map((f) => ({ ...f, severityLabel: severityLabel(lang, f.severity) }));
}

function computeScore(analysis, lang) {
  const breakdown = [];
  let score = 100;

  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity, severityLabel: severityLabel(lang, severity) });
  };

  if (analysis.isExpired) add('expired', t(lang, 'Certificato scaduto'), -50, 'critical');
  if (analysis.notYetValid) add('not_valid_yet', t(lang, 'Certificato non ancora valido'), -40, 'critical');
  if (analysis.lifecycle === 'critical_expiry') add('expiry_14', t(lang, 'Scade entro 14 giorni'), -18, 'high');
  else if (analysis.lifecycle === 'warning_expiry') add('expiry_30', t(lang, 'Scade entro 30 giorni'), -10, 'medium');
  if (!analysis.hostnameMatch) add('hostname', t(lang, 'Nome non coperto dal certificato'), -15, 'high');
  if (!analysis.authorized) add('untrusted', t(lang, 'Catena di fiducia non valida'), -12, 'high');
  if (analysis.selfSigned) add('self_signed', t(lang, 'Certificato autofirmato'), -10, 'medium');
  if (analysis.obsoleteProtocol) add('old_tls', t(lang, 'Protocollo TLS obsoleto'), -25, 'critical');
  if (analysis.weakCipher) add('weak_cipher', t(lang, 'Cipher suite debole'), -15, 'high');
  if (analysis.weakSignature) add('weak_sig', t(lang, 'Algoritmo di firma debole'), -8, 'medium');
  if (analysis.weakKey) add('weak_key', t(lang, 'Chiave troppo corta'), -15, 'high');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';

  return { score, grade, breakdown };
}

async function runSslAnalysis(inputDomain, lang) {
  const started = Date.now();
  const domain = normalizeToolDomain(inputDomain, lang);
  await assertPublicDestination(`https://${domain}/`);

  const raw = await fetchTlsCertificate(domain);
  if (raw.error) {
    return {
      domain,
      timestamp: new Date().toISOString(),
      scanDurationMs: Date.now() - started,
      error: raw.error,
      code: raw.code || null,
      cause: raw.cause || null,
      status: 'failed',
      scanType: 'ssl_analysis',
    };
  }

  const cert = raw.cert;
  const subject = parseCertField(cert.subject);
  const issuer = parseCertField(cert.issuer);
  const analysis = buildAnalysis(domain, raw);
  analysis.lifecycleLabel = lifecycleLabel(lang, analysis.lifecycle);
  analysis.authorizationErrorText = analysis.authorized ? null : trustErrorText(lang, analysis.authorizationError);
  const findings = buildFindings(domain, analysis, cert, lang);
  const scoring = computeScore(analysis, lang);

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
      status: analysis.isExpired ? 'expired' : 'valid',
    },
    tls: {
      protocol: analysis.protocol,
      cipher: analysis.cipher,
      authorized: analysis.authorized,
      authorizationError: analysis.authorizationError,
      chainLength: analysis.chainLength,
    },
    analysis,
    findings,
    ...scoring,
    scoreBreakdown: scoring.breakdown,
    limitations: auditLimitations(lang),
    note: t(lang, 'Handshake TLS sulla porta 443: validità, nomi coperti (SAN), catena di fiducia, protocollo, cipher suite e robustezza della chiave.'),
    scanType: 'ssl_analysis',
    status: 'success',
  };
}

module.exports = { runSslAnalysis, hostnameMatches };

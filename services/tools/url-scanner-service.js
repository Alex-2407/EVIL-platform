/**
 * EVIL — Check URL: analisi passiva di un indirizzo.
 * DNS · rete di appartenenza (RDAP) · TLS · header HTTP · redirect · file pubblici · punteggio.
 *
 * S-15: la vecchia geolocalizzazione via ip-api.com usava HTTP in chiaro (l'HTTPS di ip-api
 * richiede una chiave a pagamento): sostituita da RDAP, il servizio pubblico dei registri
 * Internet (RIR) che risponde in HTTPS senza chiave.
 * Testi per l'utente nella lingua della richiesta (t(lang, …)).
 */
const dns = require('dns').promises;
const { axios, connectTls, assertPublicDestination, isPublicAddress } = require('../../server/lib/safe-http');
const { t } = require('../../server/i18n');
const { toolError } = require('../../server/lib/tool-errors');
const { localizeToolMessage } = require('./tool-i18n');

/** Errore di rete in parole semplici, nella lingua della richiesta. */
function netError(lang, err) {
  return localizeToolMessage(lang, toolError(err).error);
}

// Cosa questa analisi NON verifica: mostrato nel report, così il voto non viene
// scambiato per un giudizio di affidabilità del sito.
function scanLimitations(lang) {
  return [
    {
      id: 'reputation',
      title: t(lang, 'Reputazione del dominio non verificata'),
      detail: t(lang, 'Il voto misura la configurazione tecnica (HTTPS, certificato, header), non se il sito è di phishing o distribuisce malware: anche un sito truffa può avere un voto alto. Per la reputazione usa Google Safe Browsing o VirusTotal.'),
      links: [
        { label: 'Google Safe Browsing', url: 'https://transparencyreport.google.com/safe-browsing/search' },
        { label: 'VirusTotal', url: 'https://www.virustotal.com/gui/home/url' },
      ],
    },
    {
      id: 'passive',
      title: t(lang, 'Solo controlli passivi'),
      detail: t(lang, 'Nessun test di vulnerabilità: vengono lette solo le risposte pubbliche del server, come farebbe un browser.'),
    },
  ];
}

const HEADER_CHECKS = [
  { id: 'hsts', header: 'strict-transport-security', label: 'Strict-Transport-Security', severity: 'high', httpsOnly: true },
  { id: 'csp', header: 'content-security-policy', label: 'Content-Security-Policy', severity: 'high' },
  { id: 'xfo', header: 'x-frame-options', label: 'X-Frame-Options', severity: 'medium', altHeader: 'content-security-policy', altMatch: /frame-ancestors/i },
  { id: 'xcto', header: 'x-content-type-options', label: 'X-Content-Type-Options', severity: 'medium' },
  { id: 'referrer', header: 'referrer-policy', label: 'Referrer-Policy', severity: 'low' },
  { id: 'permissions', header: 'permissions-policy', label: 'Permissions-Policy', severity: 'low', altHeader: 'feature-policy' },
  { id: 'coop', header: 'cross-origin-opener-policy', label: 'Cross-Origin-Opener-Policy', severity: 'low' },
];

function headerAdvice(lang, id) {
  switch (id) {
    case 'hsts': return t(lang, 'Imposta HSTS con max-age di almeno 31536000 e includeSubDomains se tutti i sottodomini usano HTTPS.');
    case 'csp': return t(lang, 'Definisci una Content-Security-Policy restrittiva: è la difesa principale contro XSS e iniezioni di contenuti.');
    case 'xfo': return t(lang, 'Imposta X-Frame-Options: DENY o SAMEORIGIN, oppure frame-ancestors nella CSP, contro il clickjacking.');
    case 'xcto': return t(lang, 'Imposta X-Content-Type-Options: nosniff, così il browser non indovina il tipo dei file.');
    case 'referrer': return t(lang, 'Usa Referrer-Policy: strict-origin-when-cross-origin o più restrittiva.');
    case 'permissions': return t(lang, 'Disattiva con Permissions-Policy le funzioni del browser non usate (fotocamera, geolocalizzazione…).');
    case 'coop': return t(lang, 'Valuta Cross-Origin-Opener-Policy: same-origin per isolare la finestra da altri siti.');
    default: return '';
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

function parseCertSubject(subject) {
  if (!subject) return {};
  if (typeof subject === 'object' && !Array.isArray(subject)) {
    return { CN: subject.CN, O: subject.O, C: subject.C };
  }
  const str = String(subject);
  const out = {};
  const re = /(\w+)=([^,/]+)/g;
  let m;
  while ((m = re.exec(str)) !== null) out[m[1]] = m[2].trim();
  return out;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), ms)
    )
  ]);
}

async function resolveIp(domain) {
  try {
    const { address } = await dns.lookup(domain, { family: 4 });
    return address;
  } catch {
    const { address } = await dns.lookup(domain, { family: 6 });
    return address;
  }
}

async function gatherDns(domain) {
  const records = {};
  const safe = async (fn, fallback) => {
    try { return await fn(); } catch { return fallback; }
  };
  records.A = await safe(() => dns.resolve4(domain), []);
  records.AAAA = await safe(() => dns.resolve6(domain), []);
  records.NS = await safe(() => dns.resolveNs(domain), []);
  records.MX = await safe(() => dns.resolveMx(domain), []);
  records.TXT = await safe(() => dns.resolveTxt(domain), []);
  records.CAA = await safe(() => dns.resolveCaa(domain), []);
  let reverse = null;
  if (records.A[0]) {
    try {
      reverse = await dns.reverse(records.A[0]);
    } catch { reverse = null; }
  }
  return { records, reverse };
}

/**
 * Rete a cui appartiene l'indirizzo (organizzazione, blocco, paese) dal registro Internet
 * competente, via RDAP su HTTPS (rdap.org reindirizza al RIR giusto). Nessuna chiave API.
 */
async function lookupNetwork(ip, lang) {
  if (!ip || !isPublicAddress(ip)) return { source: 'rdap', error: t(lang, 'Indirizzo non pubblico: nessun dato di registrazione.') };
  try {
    const { data, status } = await axios.get(`https://rdap.org/ip/${encodeURIComponent(ip)}`, {
      timeout: 6000,
      maxRedirects: 3,
      maxContentLength: 512 * 1024,
      validateStatus: () => true,
      headers: { Accept: 'application/rdap+json, application/json' },
    });
    if (status !== 200 || !data || typeof data !== 'object') {
      return { source: 'rdap', error: t(lang, 'Il registro RDAP non ha restituito dati per questo indirizzo.') };
    }
    const cidr = Array.isArray(data.cidr0_cidrs) && data.cidr0_cidrs[0]
      ? `${data.cidr0_cidrs[0].v4prefix || data.cidr0_cidrs[0].v6prefix}/${data.cidr0_cidrs[0].length}`
      : data.startAddress && data.endAddress ? `${data.startAddress} – ${data.endAddress}` : null;
    let org = null;
    for (const ent of Array.isArray(data.entities) ? data.entities.slice(0, 10) : []) {
      const fn = Array.isArray(ent?.vcardArray?.[1]) ? ent.vcardArray[1].find((f) => f[0] === 'fn') : null;
      if (fn && fn[3]) {
        org = String(fn[3]).slice(0, 120);
        break;
      }
    }
    return {
      source: 'rdap',
      ip,
      name: data.name ? String(data.name).slice(0, 80) : null,
      handle: data.handle ? String(data.handle).slice(0, 80) : null,
      org,
      country: data.country ? String(data.country).slice(0, 8) : null,
      cidr,
    };
  } catch (_) {
    return { source: 'rdap', error: t(lang, 'Il registro RDAP non ha risposto.') };
  }
}

function getTlsProfile(domain, lang) {
  return new Promise((resolve) => {
    let socket;
    try {
      socket = connectTls(domain, 443, { rejectUnauthorized: false });
    } catch (err) {
      resolve({ error: netError(lang, err), status: 'failed' });
      return;
    }
    socket.once('secureConnect', function () {
      const cert = socket.getPeerCertificate(true);
      const sans = cert.subjectaltname
        ? cert.subjectaltname.split(',').map(s => s.trim().replace(/^DNS:/i, ''))
        : [];
      const daysUntilExpiry = cert.valid_to
        ? Math.floor((new Date(cert.valid_to) - new Date()) / 86400000)
        : null;
      resolve({
        protocol: socket.getProtocol(),
        cipher: socket.getCipher(),
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ? String(socket.authorizationError.code || socket.authorizationError) : null,
        subject: parseCertSubject(cert.subject),
        issuer: parseCertSubject(cert.issuer),
        validFrom: cert.valid_from,
        validTo: cert.valid_to,
        daysUntilExpiry,
        isExpired: cert.valid_to ? new Date(cert.valid_to) < new Date() : false,
        fingerprintSha1: cert.fingerprint,
        fingerprintSha256: cert.fingerprint256 || null,
        serialNumber: cert.serialNumber || null,
        subjectAltNames: sans,
        keyBits: cert.bits || null,
        signatureAlgorithm: cert.sigalg || null,
        status: cert.valid_to && new Date(cert.valid_to) >= new Date() ? 'valid' : 'expired'
      });
      socket.destroy();
    });
    socket.on('error', (err) => resolve({ error: netError(lang, err), status: 'failed' }));
    setTimeout(() => {
      socket.destroy();
      resolve({ error: t(lang, 'Il server non ha completato l’handshake TLS in tempo.'), status: 'failed' });
    }, 8000);
  });
}

async function traceRedirects(startUrl, lang, max = 8) {
  const chain = [];
  let current = startUrl;
  let hops = max;
  while (hops > 0) {
    try {
      const response = await axios.head(current, {
        timeout: 6000,
        maxRedirects: 0,
        validateStatus: () => true,
        headers: { 'User-Agent': 'EVIL-URL-Scanner/1.0 (+passive; security-assessment)' }
      });
      const isRedirect = [301, 302, 303, 307, 308].includes(response.status);
      chain.push({
        url: current,
        status: response.status,
        type: isRedirect ? 'redirect' : 'final',
        location: response.headers.location || null
      });
      if (isRedirect && response.headers.location) {
        current = new URL(response.headers.location, current).toString();
        hops--;
      } else {
        break;
      }
    } catch (err) {
      chain.push({ url: current, error: netError(lang, err), type: 'error' });
      break;
    }
  }
  const final = chain[chain.length - 1];
  const finalUrl = final && !final.error ? final.url : startUrl;
  return { chain, finalUrl, hopCount: chain.filter(c => c.type === 'redirect').length };
}

async function readStreamPrefix(stream, maxBytes = 16384) {
  return new Promise((resolve) => {
    let buf = '';
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      try {
        stream.destroy();
      } catch (_) {
        /* ignore */
      }
      resolve(buf);
    };
    stream.on('data', (chunk) => {
      const need = maxBytes - buf.length;
      if (need <= 0) return done();
      buf += chunk.toString('utf8', 0, Math.min(chunk.length, need));
      if (buf.length >= maxBytes) done();
    });
    stream.on('end', done);
    stream.on('error', done);
    setTimeout(done, 4000);
  });
}

async function probeHttp(url, lang) {
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      responseType: 'stream',
      validateStatus: () => true,
      headers: {
        'User-Agent': 'EVIL-URL-Scanner/1.0 (+passive; security-assessment)',
        Accept: 'text/html,application/xhtml+xml'
      }
    });
    const bodyPrefix = response.data ? await readStreamPrefix(response.data) : '';
    const h = response.headers;
    const raw = {};
    for (const [k, v] of Object.entries(h)) raw[k.toLowerCase()] = v;

    const headerAudit = HEADER_CHECKS.map(check => {
      let present = !!raw[check.header];
      let value = raw[check.header] || null;
      if (!present && check.altHeader) {
        const alt = raw[check.altHeader];
        if (alt && (!check.altMatch || check.altMatch.test(String(alt)))) {
          present = true;
          value = alt;
        }
      }
      return {
        id: check.id,
        label: check.label,
        severity: check.severity,
        present,
        severityLabel: severityLabel(lang, check.severity),
        value: present ? (String(value).length > 120 ? String(value).slice(0, 120) + '…' : value) : null,
        recommendation: headerAdvice(lang, check.id)
      };
    });

    const titleMatch = bodyPrefix.match(/<title[^>]{0,200}>([^<]{1,200})<\/title>/i);

    return {
      finalUrl: response.request?.res?.responseUrl || url,
      status: response.status,
      statusText: response.statusText,
      responseTimeMs: response.headers['x-response-time'] || null,
      server: raw.server || null,
      poweredBy: raw['x-powered-by'] || null,
      contentType: raw['content-type'] || null,
      headersRaw: raw,
      headerAudit,
      title: titleMatch ? titleMatch[1].trim() : null,
      cookies: parseCookies(raw['set-cookie'])
    };
  } catch (err) {
    return { error: netError(lang, err) };
  }
}

function parseCookies(setCookie) {
  if (!setCookie) return [];
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  return list.map(line => {
    const parts = line.split(';').map(p => p.trim());
    const [nameVal] = parts;
    const flags = parts.slice(1).map(p => p.toLowerCase());
    return {
      name: nameVal.split('=')[0],
      secure: flags.includes('secure'),
      httpOnly: flags.includes('httponly'),
      sameSite: flags.find(f => f.startsWith('samesite=')) || 'missing'
    };
  });
}

async function fetchDiscovery(domain) {
  const base = `https://${domain}`;
  const paths = [
    { id: 'security_txt', path: '/.well-known/security.txt', label: 'security.txt' },
    { id: 'security_txt_root', path: '/security.txt', label: '/security.txt' },
    { id: 'robots', path: '/robots.txt', label: 'robots.txt' }
  ];
  const results = [];
  for (const item of paths) {
    try {
      const res = await axios.get(base + item.path, {
        timeout: 5000,
        maxRedirects: 2,
        maxContentLength: 16384,
        validateStatus: s => s === 200,
        headers: { 'User-Agent': 'EVIL-URL-Scanner/1.0' }
      });
      results.push({
        id: item.id,
        label: item.label,
        url: base + item.path,
        found: true,
        preview: String(res.data).slice(0, 2000).split('\n').slice(0, 8).join('\n')
      });
    } catch {
      results.push({ id: item.id, label: item.label, url: base + item.path, found: false });
    }
  }
  return results;
}

function gradeFromScore(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 55) return 'D';
  return 'F';
}

function computeScore(ctx, lang) {
  const breakdown = [];
  let score = 100;
  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity, severityLabel: severityLabel(lang, severity) });
  };

  if (!ctx.isHttps) {
    add('transport_http', t(lang, 'Connessione senza HTTPS'), -35, 'critical');
  }

  if (ctx.tls?.error) {
    add('tls_fail', t(lang, 'Connessione TLS non riuscita'), -25, 'critical');
  } else if (ctx.tls && !ctx.tls.skipped) {
    if (ctx.tls.isExpired) add('tls_expired', t(lang, 'Certificato scaduto'), -30, 'critical');
    else if (ctx.tls.daysUntilExpiry != null && ctx.tls.daysUntilExpiry < 7) {
      add('tls_expiry_7', t(lang, 'Il certificato scade entro 7 giorni'), -15, 'high');
    } else if (ctx.tls.daysUntilExpiry != null && ctx.tls.daysUntilExpiry < 30) {
      add('tls_expiry_30', t(lang, 'Il certificato scade entro 30 giorni'), -8, 'medium');
    }
    if (!ctx.tls.authorized) add('tls_trust', t(lang, 'Catena di fiducia del certificato non valida'), -12, 'high');
    if (ctx.tls.protocol && ['SSLv2', 'SSLv3', 'TLSv1', 'TLSv1.1'].includes(ctx.tls.protocol)) {
      add('tls_old', t(lang, 'Protocollo obsoleto ({protocol})', { protocol: ctx.tls.protocol }), -20, 'critical');
    }
  }

  if (ctx.isHttps && ctx.http?.headerAudit) {
    for (const h of ctx.http.headerAudit) {
      if (h.present) continue;
      const label = t(lang, 'Manca {header}', { header: h.label });
      if (h.severity === 'high') add(`missing_${h.id}`, label, -12, 'high');
      else if (h.severity === 'medium') add(`missing_${h.id}`, label, -6, 'medium');
      else add(`missing_${h.id}`, label, -3, 'low');
    }
  }

  if (ctx.http?.cookies?.length) {
    const bad = ctx.http.cookies.filter((c) => !c.secure || !c.httpOnly);
    if (bad.length) add('cookies_insecure', t(lang, 'Cookie senza Secure o HttpOnly'), -8, 'medium');
  }

  if (ctx.redirects?.hopCount > 3) {
    add('redirect_chain', t(lang, 'Troppi reindirizzamenti'), -5, 'low');
  }

  const secTxt = ctx.discovery?.find((d) => d.found && d.id.includes('security'));
  if (secTxt) add('security_txt_bonus', t(lang, 'security.txt presente'), +3, 'info');

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, grade: gradeFromScore(score), breakdown };
}

function buildFindings(ctx, lang) {
  const findings = [];
  const push = (severity, title, detail, module) => findings.push({ severity, severityLabel: severityLabel(lang, severity), title, detail, module });

  if (!ctx.isHttps) {
    push('critical', t(lang, 'Traffico non cifrato'), t(lang, 'Il sito risponde in HTTP: password e sessioni viaggiano in chiaro e possono essere lette o modificate da chi controlla la rete.'), 'transport');
  }
  if (ctx.tls?.error) {
    push('high', t(lang, 'Connessione TLS non riuscita'), ctx.tls.error, 'tls');
  }
  if (ctx.tls?.isExpired) {
    push('critical', t(lang, 'Certificato TLS scaduto'), t(lang, 'Scaduto il {date}.', { date: ctx.tls.validTo }), 'tls');
  }
  if (ctx.tls && !ctx.tls.skipped && !ctx.tls.authorized && !ctx.tls.error) {
    push('high', t(lang, 'Certificato non riconosciuto come affidabile'), t(lang, 'La catena di certificati non porta a un’autorità riconosciuta (codice: {code}).', { code: ctx.tls.authorizationError || '—' }), 'tls');
  }
  if (ctx.http?.headerAudit) {
    for (const h of ctx.http.headerAudit.filter((x) => !x.present && (x.severity === 'high' || x.severity === 'medium'))) {
      push(h.severity === 'high' ? 'high' : 'medium', t(lang, 'Manca {header}', { header: h.label }), h.recommendation, 'headers');
    }
  }
  if (!findings.length) {
    push('info', t(lang, 'Nessun problema urgente'), t(lang, 'I controlli passivi non hanno trovato problemi ad alta priorità.'), 'summary');
  }
  return findings;
}

function moduleName(lang, id) {
  switch (id) {
    case 'dns': return t(lang, 'DNS e indirizzo IP');
    case 'network': return t(lang, 'Rete di appartenenza (RDAP)');
    case 'tls': return t(lang, 'Certificato TLS');
    case 'headers': return t(lang, 'Header di sicurezza HTTP');
    case 'redirects': return t(lang, 'Reindirizzamenti');
    case 'discovery': return t(lang, 'File pubblici (security.txt, robots.txt)');
    default: return id;
  }
}

/**
 * Esegue la scansione passiva completa
 * @param {string} fullUrl
 * @param {string} domain
 * @param {boolean} isHttps
 * @param {string} [lang]
 */
async function runUrlScan(fullUrl, domain, isHttps, lang) {
  const started = Date.now();
  const modules = [];

  await assertPublicDestination(fullUrl);

  const ip = await withTimeout(resolveIp(domain), 8000, 'DNS');
  const [dnsIntel, network, redirectData] = await Promise.all([
    withTimeout(gatherDns(domain), 10000, 'DNS records'),
    lookupNetwork(ip, lang),
    withTimeout(traceRedirects(fullUrl, lang), 15000, 'Redirects'),
  ]);

  modules.push({ id: 'dns', name: moduleName(lang, 'dns'), status: 'complete' });
  modules.push({ id: 'network', name: moduleName(lang, 'network'), status: network.error ? 'partial' : 'complete' });

  const probeUrl = redirectData.finalUrl || fullUrl;
  const probeHost = new URL(probeUrl).hostname;
  const httpsTarget = isHttps || probeUrl.startsWith('https');

  const [tls, http, discovery] = await Promise.all([
    httpsTarget
      ? withTimeout(getTlsProfile(probeHost, lang), 10000, 'TLS').catch(() => ({ error: t(lang, 'Il server non ha completato l’handshake TLS in tempo.'), status: 'failed' }))
      : Promise.resolve({ skipped: true, reason: t(lang, 'Il sito usa solo HTTP: nessun certificato da analizzare.') }),
    withTimeout(probeHttp(probeUrl, lang), 12000, 'HTTP').catch((err) => ({ error: netError(lang, err) })),
    withTimeout(fetchDiscovery(domain), 12000, 'Discovery').catch(() => []),
  ]);

  modules.push(
    { id: 'tls', name: moduleName(lang, 'tls'), status: tls.skipped ? 'skipped' : tls.error ? 'failed' : 'complete' },
    { id: 'headers', name: moduleName(lang, 'headers'), status: http.error ? 'failed' : 'complete' },
    { id: 'redirects', name: moduleName(lang, 'redirects'), status: 'complete', hops: redirectData.hopCount },
    { id: 'discovery', name: moduleName(lang, 'discovery'), status: 'complete' },
  );

  // Indirizzi non pubblici nei record DNS: non mostrati (S-12)
  for (const type of ['A', 'AAAA']) {
    if (Array.isArray(dnsIntel.records[type])) dnsIntel.records[type] = dnsIntel.records[type].filter((a) => isPublicAddress(a));
  }

  const scoreCtx = { isHttps: httpsTarget, tls, http, redirects: redirectData, discovery };
  const { score, grade, breakdown } = computeScore(scoreCtx, lang);
  const findings = buildFindings(scoreCtx, lang);

  return {
    domain,
    url: fullUrl,
    finalUrl: probeUrl,
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - started,
    security_score: score,
    score,
    grade,
    scoreBreakdown: breakdown,
    findings,
    modules,
    analysis: {
      ip,
      network,
      dns: dnsIntel,
      tls,
      http,
      redirects: redirectData.chain,
      redirectMeta: { finalUrl: redirectData.finalUrl, hopCount: redirectData.hopCount },
      discovery,
    },
    limitations: scanLimitations(lang),
    status: 'success',
  };
}

module.exports = { runUrlScan, lookupNetwork };

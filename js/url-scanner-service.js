/**
 * EVIL Advanced URL Scanner — motore analisi passiva professionale
 * DNS · TLS · HTTP headers · redirect · discovery · scoring ponderato
 */
const dns = require('dns').promises;
const tls = require('tls');
const axios = require('axios');

const THREAT_DB = {
  'phishing-domain.xyz': { threat: 'phishing', score: 15 },
  'malware-host.net': { threat: 'malware', score: 10 },
  'scam-site.ru': { threat: 'scam', score: 20 }
};

const HEADER_CHECKS = [
  {
    id: 'hsts',
    header: 'strict-transport-security',
    label: 'Strict-Transport-Security',
    severity: 'high',
    httpsOnly: true,
    recommendation: 'Imposta HSTS con max-age ≥ 31536000 e includeSubDomains se applicabile.'
  },
  {
    id: 'csp',
    header: 'content-security-policy',
    label: 'Content-Security-Policy',
    severity: 'high',
    recommendation: 'Definisci una CSP restrittiva per mitigare XSS e injection.'
  },
  {
    id: 'xfo',
    header: 'x-frame-options',
    label: 'X-Frame-Options',
    severity: 'medium',
    altHeader: 'content-security-policy',
    altMatch: /frame-ancestors/i,
    recommendation: 'Imposta DENY/SAMEORIGIN o frame-ancestors in CSP.'
  },
  {
    id: 'xcto',
    header: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    severity: 'medium',
    recommendation: 'Imposta nosniff per bloccare MIME sniffing.'
  },
  {
    id: 'referrer',
    header: 'referrer-policy',
    label: 'Referrer-Policy',
    severity: 'low',
    recommendation: 'Usa strict-origin-when-cross-origin o più restrittivo.'
  },
  {
    id: 'permissions',
    header: 'permissions-policy',
    label: 'Permissions-Policy',
    severity: 'low',
    altHeader: 'feature-policy',
    recommendation: 'Limita API browser non necessarie (camera, geolocation, …).'
  },
  {
    id: 'coop',
    header: 'cross-origin-opener-policy',
    label: 'Cross-Origin-Opener-Policy',
    severity: 'low',
    recommendation: 'Considera same-origin per isolamento tab.'
  }
];

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

async function lookupGeo(ip) {
  if (!ip || ip.includes(':')) return { source: 'none', note: 'GeoIP non disponibile per IPv6' };
  try {
    const { data } = await axios.get(`http://ip-api.com/json/${ip}`, {
      params: { fields: 'status,message,country,countryCode,isp,org,as,query,reverse,hosting' },
      timeout: 5000
    });
    if (data.status !== 'success') return { source: 'ip-api', error: data.message || 'Lookup failed' };
    const asnMatch = String(data.as || '').match(/^(AS\d+)/);
    return {
      source: 'ip-api',
      ip: data.query,
      country: data.country,
      countryCode: data.countryCode,
      isp: data.isp,
      org: data.org,
      asn: asnMatch ? asnMatch[1] : null,
      asnLabel: data.as,
      hosting: data.hosting,
      reverse: data.reverse
    };
  } catch (err) {
    return { source: 'ip-api', error: err.message };
  }
}

function getTlsProfile(domain) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      443,
      domain,
      { servername: domain, rejectUnauthorized: false },
      function () {
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
          authorizationError: socket.authorizationError || null,
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
      }
    );
    socket.on('error', (err) => resolve({ error: err.message, status: 'failed' }));
    setTimeout(() => {
      socket.destroy();
      resolve({ error: 'TLS handshake timeout', status: 'failed' });
    }, 8000);
  });
}

async function traceRedirects(startUrl, max = 8) {
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
      chain.push({ url: current, error: err.message, type: 'error' });
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

async function probeHttp(url) {
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
        value: present ? (String(value).length > 120 ? String(value).slice(0, 120) + '…' : value) : null,
        recommendation: check.recommendation
      };
    });

    const titleMatch = bodyPrefix.match(/<title[^>]*>([^<]{1,200})<\/title>/i);

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
    return { error: err.message };
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
    { id: 'security_txt_root', path: '/security.txt', label: 'security.txt (root)' },
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
        preview: String(res.data).split('\n').slice(0, 8).join('\n')
      });
    } catch {
      results.push({ id: item.id, label: item.label, url: base + item.path, found: false });
    }
  }
  return results;
}

function checkThreat(domain) {
  const d = domain.toLowerCase();
  for (const [needle, data] of Object.entries(THREAT_DB)) {
    if (d.includes(needle)) return data;
  }
  return null;
}

function gradeFromScore(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 55) return 'D';
  return 'F';
}

function computeScore(ctx) {
  const breakdown = [];
  let score = 100;
  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity });
  };

  if (!ctx.isHttps) {
    add('transport_http', 'Connessione non HTTPS', -35, 'critical');
  }

  if (ctx.tls?.error) {
    add('tls_fail', 'TLS non raggiungibile', -25, 'critical');
  } else if (ctx.tls) {
    if (ctx.tls.isExpired) add('tls_expired', 'Certificato scaduto', -30, 'critical');
    else if (ctx.tls.daysUntilExpiry != null && ctx.tls.daysUntilExpiry < 7) {
      add('tls_expiry_7', 'Certificato scade entro 7 giorni', -15, 'high');
    } else if (ctx.tls.daysUntilExpiry != null && ctx.tls.daysUntilExpiry < 30) {
      add('tls_expiry_30', 'Certificato scade entro 30 giorni', -8, 'medium');
    }
    if (!ctx.tls.authorized) add('tls_trust', 'Catena certificato non trusted', -12, 'high');
    if (ctx.tls.protocol && ['SSLv2', 'SSLv3', 'TLSv1', 'TLSv1.1'].includes(ctx.tls.protocol)) {
      add('tls_old', `Protocollo obsoleto (${ctx.tls.protocol})`, -20, 'critical');
    }
  }

  if (ctx.isHttps && ctx.http?.headerAudit) {
    for (const h of ctx.http.headerAudit) {
      if (h.present) continue;
      if (h.severity === 'high') add(`missing_${h.id}`, `${h.label} assente`, -12, 'high');
      else if (h.severity === 'medium') add(`missing_${h.id}`, `${h.label} assente`, -6, 'medium');
      else add(`missing_${h.id}`, `${h.label} assente`, -3, 'low');
    }
  }

  if (ctx.http?.cookies?.length) {
    const bad = ctx.http.cookies.filter(c => !c.secure || !c.httpOnly);
    if (bad.length) add('cookies_insecure', 'Cookie senza Secure/HttpOnly', -8, 'medium');
  }

  if (ctx.redirects?.hopCount > 3) {
    add('redirect_chain', 'Catena redirect eccessiva', -5, 'low');
  }

  const secTxt = ctx.discovery?.find(d => d.found && d.id.includes('security'));
  if (secTxt) add('security_txt_bonus', 'security.txt presente', +3, 'info');

  if (ctx.threat) {
    score = Math.min(score, ctx.threat.score);
    breakdown.push({ id: 'threat_intel', label: `Threat intel: ${ctx.threat.threat}`, delta: ctx.threat.score - 100, severity: 'critical' });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, grade: gradeFromScore(score), breakdown };
}

function buildFindings(ctx) {
  const findings = [];
  const push = (severity, title, detail, module) => findings.push({ severity, title, detail, module });

  if (!ctx.isHttps) {
    push('critical', 'Trasporto non cifrato', 'Il target usa HTTP — credenziali e sessioni esposte.', 'transport');
  }
  if (ctx.tls?.isExpired) {
    push('critical', 'Certificato TLS scaduto', `Scadenza: ${ctx.tls.validTo}`, 'tls');
  }
  if (ctx.tls && !ctx.tls.authorized && !ctx.tls.error) {
    push('high', 'Certificato non trusted', ctx.tls.authorizationError || 'Chain validation failed', 'tls');
  }
  if (ctx.http?.headerAudit) {
    for (const h of ctx.http.headerAudit.filter(x => !x.present && (x.severity === 'high' || x.severity === 'medium'))) {
      push(h.severity === 'high' ? 'high' : 'medium', `${h.label} mancante`, h.recommendation, 'headers');
    }
  }
  if (ctx.threat) {
    push('critical', 'Match threat intelligence', `Categoria: ${ctx.threat.threat}`, 'intel');
  }
  if (!findings.length) {
    push('info', 'Nessuna criticità immediata', 'Controlli passivi completati senza alert ad alta priorità.', 'summary');
  }
  return findings;
}

/**
 * Esegue scansione passiva completa
 * @param {string} fullUrl
 * @param {string} domain
 * @param {boolean} isHttps
 */
async function runUrlScan(fullUrl, domain, isHttps) {
  const started = Date.now();
  const modules = [];

  const ip = await withTimeout(resolveIp(domain), 8000, 'DNS');
  const [dnsIntel, geo, redirectData] = await Promise.all([
    withTimeout(gatherDns(domain), 10000, 'DNS records'),
    lookupGeo(ip),
    withTimeout(traceRedirects(fullUrl), 15000, 'Redirects')
  ]);

  modules.push({ id: 'dns', name: 'DNS & IP', status: 'complete', durationMs: null });
  modules.push({ id: 'geo', name: 'GeoIP / ASN', status: geo.error ? 'partial' : 'complete' });

  const probeUrl = redirectData.finalUrl || fullUrl;
  const probeHost = new URL(probeUrl).hostname;

  const [tls, http, discovery] = await Promise.all([
    isHttps || probeUrl.startsWith('https')
      ? withTimeout(getTlsProfile(probeHost), 10000, 'TLS')
      : Promise.resolve({ skipped: true, reason: 'HTTP only target' }),
    withTimeout(probeHttp(probeUrl), 12000, 'HTTP'),
    withTimeout(fetchDiscovery(domain), 12000, 'Discovery')
  ]);

  modules.push(
    { id: 'tls', name: 'TLS / Certificate', status: tls.error ? 'failed' : 'complete' },
    { id: 'headers', name: 'HTTP Security Headers', status: http.error ? 'failed' : 'complete' },
    { id: 'redirects', name: 'Redirect Chain', status: 'complete', hops: redirectData.hopCount },
    { id: 'discovery', name: 'Surface Discovery', status: 'complete' }
  );

  const threat = checkThreat(domain);
  const scoreCtx = { isHttps: isHttps || probeUrl.startsWith('https'), tls, http, redirects: redirectData, discovery, threat };
  const { score, grade, breakdown } = computeScore(scoreCtx);
  const findings = buildFindings(scoreCtx);

  return {
    domain,
    url: fullUrl,
    finalUrl: probeUrl,
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - started,
    security_score: score,
    grade,
    scoreBreakdown: breakdown,
    findings,
    modules,
    analysis: {
      ip,
      geo,
      dns: dnsIntel,
      tls,
      http,
      redirects: redirectData.chain,
      redirectMeta: { finalUrl: redirectData.finalUrl, hopCount: redirectData.hopCount },
      discovery,
      threat: threat || null
    },
    threatData: threat ? { threat: threat.threat, score: threat.score } : null,
    status: 'success'
  };
}

module.exports = { runUrlScan };

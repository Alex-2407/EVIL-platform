/**
 * EVIL HTTP Header Audit — analisi passiva header di sicurezza
 */
const axios = require('axios');

const HEADER_CHECKS = [
  {
    id: 'hsts',
    header: 'strict-transport-security',
    label: 'Strict-Transport-Security',
    severity: 'high',
    httpsOnly: true,
    owasp: 'A02:2021',
    recommendation: 'HSTS: max-age≥31536000; includeSubDomains se applicabile.'
  },
  {
    id: 'csp',
    header: 'content-security-policy',
    label: 'Content-Security-Policy',
    severity: 'high',
    owasp: 'A03:2021',
    recommendation: 'CSP restrittiva per mitigare XSS e injection.'
  },
  {
    id: 'xfo',
    header: 'x-frame-options',
    label: 'X-Frame-Options',
    severity: 'medium',
    altHeader: 'content-security-policy',
    altMatch: /frame-ancestors/i,
    owasp: 'A04:2021',
    recommendation: 'DENY/SAMEORIGIN o frame-ancestors in CSP.'
  },
  {
    id: 'xcto',
    header: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    severity: 'medium',
    owasp: 'A05:2021',
    recommendation: 'Imposta nosniff.'
  },
  {
    id: 'referrer',
    header: 'referrer-policy',
    label: 'Referrer-Policy',
    severity: 'low',
    owasp: 'A01:2021',
    recommendation: 'strict-origin-when-cross-origin o più restrittivo.'
  },
  {
    id: 'permissions',
    header: 'permissions-policy',
    label: 'Permissions-Policy',
    severity: 'low',
    altHeader: 'feature-policy',
    owasp: 'A01:2021',
    recommendation: 'Disabilita API browser non necessarie.'
  },
  {
    id: 'coop',
    header: 'cross-origin-opener-policy',
    label: 'Cross-Origin-Opener-Policy',
    severity: 'low',
    optional: true,
    owasp: 'A01:2021',
    recommendation: 'same-origin per isolamento tab (solo se serve isolation/SAB).'
  },
  {
    id: 'corp',
    header: 'cross-origin-resource-policy',
    label: 'Cross-Origin-Resource-Policy',
    severity: 'low',
    optional: true,
    recommendation: 'same-origin o same-site dove appropriato (hardening avanzato).'
  },
  {
    id: 'coep',
    header: 'cross-origin-embedder-policy',
    label: 'Cross-Origin-Embedder-Policy',
    severity: 'low',
    optional: true,
    recommendation: 'require-corp se usi SharedArrayBuffer/isolation.'
  }
];

const SEVERITY_IT = { critical: 'critica', high: 'alta', medium: 'media', low: 'bassa', info: 'bassa' };

const COOKIE_CLASSIFIERS = [
  {
    type: 'session',
    label: 'Sessione / auth',
    risk: 'high',
    patterns: [
      /session/i, /^sid$/i, /^sess/i, /auth/i, /token/i, /jwt/i, /login/i,
      /connect\.sid/i, /phpsessid/i, /laravel_session/i, /aspsession/i, /jsessionid/i,
      /remember/i, /credential/i
    ]
  },
  {
    type: 'csrf',
    label: 'CSRF / anti-replay',
    risk: 'medium',
    patterns: [/csrf/i, /xsrf/i, /nonce/i, /anti.?forgery/i]
  },
  {
    type: 'preference',
    label: 'Preferenza / analytics',
    risk: 'low',
    patterns: [
      /^geo/i, /lang/i, /locale/i, /consent/i, /gdpr/i, /theme/i, /^pref/i,
      /cookie.?banner/i, /analytics/i, /^_ga/i, /^_gid/i, /^_fbp/i, /^_gcl/i, /^opt/i
    ]
  }
];

const AUDIT_LIMITATIONS = [
  'Valuta solo header HTTP e Set-Cookie osservati in una singola risposta GET.',
  'Non copre autenticazione applicativa, API, autorizzazioni, upload o business logic.',
  'Cross-Origin headers (COOP/CORP/COEP) sono informativi: utili per isolation, spesso opzionali su siti pubblici.',
  'Il punteggio non sostituisce un penetration test o un audit architetturale completo.'
];

function gradeFromScore(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 55) return 'D';
  return 'F';
}

function classifyCookie(name) {
  for (const rule of COOKIE_CLASSIFIERS) {
    if (rule.patterns.some((p) => p.test(name))) {
      return { type: rule.type, typeLabel: rule.label, risk: rule.risk };
    }
  }
  return { type: 'unknown', typeLabel: 'Non classificato', risk: 'medium' };
}

function cookieHardeningIssues(cookie) {
  const issues = [];
  const cls = classifyCookie(cookie.name);
  if (cls.risk === 'low') {
    if (!cookie.secure && cls.type === 'preference') issues.push({ flag: 'Secure', severity: 'info' });
    return issues;
  }
  if (!cookie.secure) issues.push({ flag: 'Secure', severity: cls.risk === 'high' ? 'high' : 'medium' });
  if (!cookie.httpOnly && cls.type !== 'csrf') {
    issues.push({ flag: 'HttpOnly', severity: cls.risk === 'high' ? 'high' : 'medium' });
  }
  if (cookie.sameSite === 'missing' || cookie.sameSite === 'none') {
    issues.push({
      flag: 'SameSite',
      severity: cls.risk === 'high' ? 'medium' : 'low',
      detail: cookie.sameSite === 'none' ? 'SameSite=None richiede Secure' : 'SameSite assente'
    });
  }
  return issues;
}

function parseCookies(setCookie) {
  if (!setCookie) return [];
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  return list.map((line) => {
    const parts = line.split(';').map((p) => p.trim());
    const [nameVal] = parts;
    const flags = parts.slice(1).map((p) => p.toLowerCase());
    const sameSite = flags.find((f) => f.startsWith('samesite='));
    const name = nameVal.split('=')[0];
    const cls = classifyCookie(name);
    const cookie = {
      name,
      secure: flags.includes('secure'),
      httpOnly: flags.includes('httponly'),
      sameSite: sameSite ? sameSite.split('=')[1] : 'missing',
      ...cls
    };
    cookie.issues = cookieHardeningIssues(cookie);
    cookie.hardened = cookie.issues.length === 0;
    return cookie;
  });
}

function analyzeCsp(rawHeaders) {
  const csp = rawHeaders['content-security-policy'] || rawHeaders['content-security-policy-report-only'];
  if (!csp) return { present: false, mode: null, issues: [], directives: [] };

  const value = String(csp);
  const mode = rawHeaders['content-security-policy'] ? 'enforce' : 'report-only';
  const directives = value.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const [name, ...rest] = d.split(/\s+/);
    return { name: name.toLowerCase(), values: rest };
  });

  const issues = [];
  const scriptSrc = directives.find((d) => d.name === 'script-src')?.values.join(' ') || '';
  const defaultSrc = directives.find((d) => d.name === 'default-src')?.values.join(' ') || '';

  if (/unsafe-inline/i.test(value)) {
    issues.push({
      severity: 'medium',
      title: 'CSP consente unsafe-inline',
      detail: 'script/style inline riducono la protezione XSS offerta dalla CSP.'
    });
  }
  if (/unsafe-eval/i.test(value)) {
    issues.push({
      severity: 'medium',
      title: 'CSP consente unsafe-eval',
      detail: 'eval() e simili aumentano la superficie XSS.'
    });
  }
  if (/\b\*(\s|;|$)/.test(scriptSrc) || (/\*\s*(;|$)/.test(defaultSrc) && !scriptSrc)) {
    issues.push({
      severity: 'high',
      title: 'CSP con wildcard permissiva',
      detail: 'script-src o default-src troppo ampie (*).'
    });
  }
  if (/data:/i.test(scriptSrc)) {
    issues.push({
      severity: 'medium',
      title: 'CSP: data: in script-src',
      detail: 'Permette script inline via data URI.'
    });
  }
  if (mode === 'report-only') {
    issues.push({
      severity: 'low',
      title: 'CSP solo in report-only',
      detail: 'La policy non blocca ancora le violazioni in produzione.'
    });
  }

  return { present: true, mode, value: value.length > 200 ? value.slice(0, 200) + '…' : value, issues, directives };
}

function buildFingerprint(probe, raw) {
  const items = [];
  if (probe.server) {
    items.push({
      kind: 'Server',
      value: probe.server,
      severity: /\d+\.\d+/.test(probe.server) ? 'medium' : 'low',
      note: 'Header Server può rivelare prodotto/versione.'
    });
  }
  if (probe.poweredBy) {
    items.push({
      kind: 'X-Powered-By',
      value: probe.poweredBy,
      severity: 'medium',
      note: 'Stack tecnologico esposto.'
    });
  }
  for (const [header, label] of [
    ['x-aspnet-version', 'ASP.NET version'],
    ['x-aspnetmvc-version', 'ASP.NET MVC'],
    ['x-generator', 'Generator'],
    ['x-drupal-cache', 'Drupal'],
    ['x-powered-cms', 'CMS']
  ]) {
    if (raw[header]) {
      items.push({ kind: label, value: String(raw[header]), severity: 'low', note: 'Fingerprint componente.' });
    }
  }
  return items;
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

async function probeHeaders(url) {
  const started = Date.now();
  const response = await axios.get(url, {
    timeout: 12000,
    maxRedirects: 5,
    responseType: 'stream',
    validateStatus: () => true,
    headers: {
      'User-Agent': 'EVIL-Header-Audit/1.0 (+passive; security-assessment)',
      Accept: 'text/html,application/xhtml+xml'
    }
  });

  const bodyPrefix = response.data ? await readStreamPrefix(response.data) : '';

  const raw = {};
  for (const [k, v] of Object.entries(response.headers)) raw[k.toLowerCase()] = v;

  const finalUrl = response.request?.res?.responseUrl || url;
  const isHttps = finalUrl.startsWith('https:');
  const titleMatch = bodyPrefix.match(/<title[^>]*>([^<]{1,200})<\/title>/i);

  const headerAudit = HEADER_CHECKS.map((check) => {
    if (check.httpsOnly && !isHttps) {
      return {
        id: check.id,
        label: check.label,
        severity: check.severity,
        optional: !!check.optional,
        present: false,
        skipped: true,
        value: null,
        recommendation: check.recommendation,
        owasp: check.owasp || null
      };
    }
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
      optional: !!check.optional,
      present,
      skipped: false,
      value: present ? (String(value).length > 140 ? String(value).slice(0, 140) + '…' : value) : null,
      recommendation: check.recommendation,
      owasp: check.owasp || null
    };
  });

  const cookies = parseCookies(raw['set-cookie']);
  const cspAnalysis = analyzeCsp(raw);
  const fingerprint = buildFingerprint(
    { server: raw.server || null, poweredBy: raw['x-powered-by'] || null },
    raw
  );

  return {
    finalUrl,
    isHttps,
    status: response.status,
    statusText: response.statusText,
    durationMs: Date.now() - started,
    server: raw.server || null,
    poweredBy: raw['x-powered-by'] || null,
    contentType: raw['content-type'] || null,
    title: titleMatch ? titleMatch[1].trim() : null,
    headerAudit,
    cookies,
    cspAnalysis,
    fingerprint,
    rawHeaders: Object.entries(raw)
      .filter(([k]) => !k.startsWith('x-evil'))
      .slice(0, 40)
      .map(([name, value]) => ({
        name,
        value: String(value).length > 100 ? String(value).slice(0, 100) + '…' : value
      }))
  };
}

function buildFindings(probe) {
  const findings = [];

  if (!probe.isHttps) {
    findings.push({
      severity: 'critical',
      title: 'HTTPS non utilizzato',
      detail: 'Il target risponde su HTTP — traffico intercettabile (MITM).',
      module: 'transport',
      recommendation: 'Abilita HTTPS con certificato valido e redirect da HTTP.'
    });
  }

  for (const h of probe.headerAudit) {
    if (h.skipped || h.present || h.optional) continue;
    findings.push({
      severity: h.severity === 'high' ? 'high' : h.severity === 'medium' ? 'medium' : 'low',
      title: `${h.label} assente`,
      detail: h.recommendation,
      module: 'headers',
      owasp: h.owasp,
      header: h.label
    });
  }

  for (const c of probe.cookies) {
    if (c.hardened) continue;
    for (const issue of c.issues) {
      if (issue.severity === 'info') continue;
      findings.push({
        severity: issue.severity,
        title: `Cookie "${c.name}" (${c.typeLabel}): ${issue.flag} insufficiente`,
        detail: issue.detail || `Secure: ${c.secure}, HttpOnly: ${c.httpOnly}, SameSite: ${c.sameSite}`,
        module: 'cookies',
        recommendation:
          c.risk === 'high'
            ? 'Cookie di sessione: Secure + HttpOnly + SameSite=Lax/Strict obbligatori.'
            : 'Valuta Secure e SameSite anche su cookie non sessione.'
      });
    }
  }

  if (probe.cspAnalysis?.present) {
    for (const issue of probe.cspAnalysis.issues) {
      findings.push({
        severity: issue.severity,
        title: issue.title,
        detail: issue.detail,
        module: 'csp',
        recommendation: 'Restringi script-src/default-src; evita unsafe-* e wildcard.'
      });
    }
  } else if (probe.isHttps) {
    /* CSP assente già coperto dalla checklist header */
  }

  for (const fp of probe.fingerprint || []) {
    if (fp.severity === 'medium') {
      findings.push({
        severity: 'low',
        title: `Fingerprint: ${fp.kind}`,
        detail: `${fp.value} — ${fp.note}`,
        module: 'disclosure',
        recommendation: 'Riduci information disclosure negli header di risposta.'
      });
    }
  }

  if (probe.poweredBy && !probe.fingerprint?.some((f) => f.kind === 'X-Powered-By')) {
    findings.push({
      severity: 'low',
      title: 'Information disclosure: X-Powered-By',
      detail: `Espone stack: ${probe.poweredBy}`,
      module: 'disclosure',
      recommendation: 'Rimuovi X-Powered-By dal server.'
    });
  }

  if (!findings.length) {
    findings.push({
      severity: 'info',
      title: 'Header di sicurezza adeguati',
      detail: 'Nessun gap ad alta priorità rilevato sui controlli configurati.',
      module: 'summary'
    });
  }

  return findings;
}

function computeScore(probe, findings) {
  const breakdown = [];
  let score = 100;

  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity });
  };

  if (!probe.isHttps) add('no_https', 'Trasporto HTTP', -40, 'critical');

  for (const h of probe.headerAudit) {
    if (h.skipped || h.present || h.optional) continue;
    if (h.severity === 'high') add(`missing_${h.id}`, `${h.label} assente`, -12, 'high');
    else if (h.severity === 'medium') add(`missing_${h.id}`, `${h.label} assente`, -7, 'medium');
    else add(`missing_${h.id}`, `${h.label} assente`, -3, 'low');
  }

  for (const c of probe.cookies) {
    if (c.hardened || c.risk === 'low') continue;
    const penalty = c.risk === 'high' ? -10 : -5;
    add(`cookie_${c.name}`, `Cookie ${c.name} (${c.typeLabel})`, penalty, c.risk === 'high' ? 'high' : 'medium');
  }

  if (probe.cspAnalysis?.present) {
    probe.cspAnalysis.issues.forEach((issue, i) => {
      if (issue.severity === 'high') add(`csp_${i}`, issue.title, -8, 'high');
      else if (issue.severity === 'medium') add(`csp_${i}`, issue.title, -5, 'medium');
      else add(`csp_${i}`, issue.title, -1, 'low');
    });
  }

  if (probe.fingerprint?.some((f) => f.severity === 'medium')) {
    add('fingerprint', 'Fingerprint stack/versione', -3, 'low');
  } else if (probe.poweredBy) add('powered_by', 'X-Powered-By esposto', -2, 'low');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const maxSev = findings.find((f) => f.severity === 'critical')
    || findings.find((f) => f.severity === 'high')
    || findings.find((f) => f.severity === 'medium')
    || findings[0];

  return {
    score,
    grade: gradeFromScore(score),
    risk: SEVERITY_IT[maxSev?.severity] || 'bassa',
    breakdown
  };
}

function toLegacyVulnerabilities(findings) {
  const cvssMap = { critical: 9.0, high: 7.5, medium: 5.5, low: 3.5, info: 0 };
  return findings
    .filter((f) => f.module !== 'summary')
    .map((f) => ({
      title: f.title,
      severity: SEVERITY_IT[f.severity] || 'bassa',
      category: f.module === 'headers' ? 'Security Headers' : f.module,
      description: f.detail,
      impact: f.detail,
      recommendation: f.recommendation || f.detail,
      cvss: cvssMap[f.severity] || 4,
      owasp: f.owasp || '—'
    }));
}

async function runHttpHeaderAudit(inputUrl) {
  const started = Date.now();
  let fullUrl = inputUrl.trim();
  if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl;

  const parsed = new URL(fullUrl);
  const probe = await probeHeaders(fullUrl);
  if (probe.error) throw new Error(probe.error);

  const findings = buildFindings(probe);
  const { score, grade, risk, breakdown } = computeScore(probe, findings);
  const vulnerabilities = toLegacyVulnerabilities(findings);

  return {
    url: fullUrl,
    finalUrl: probe.finalUrl,
    domain: parsed.hostname,
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - started,
    security_score: score,
    score,
    grade,
    risk,
    scoreBreakdown: breakdown,
    findings,
    headerAudit: probe.headerAudit,
    cookies: probe.cookies,
    cspAnalysis: probe.cspAnalysis,
    fingerprint: probe.fingerprint,
    disclosure: {
      server: probe.server,
      poweredBy: probe.poweredBy,
      contentType: probe.contentType
    },
    limitations: AUDIT_LIMITATIONS,
    scope: 'http_headers_passive',
    http: {
      status: probe.status,
      statusText: probe.statusText,
      isHttps: probe.isHttps,
      probeDurationMs: probe.durationMs
    },
    rawHeaders: probe.rawHeaders,
    vulnerabilities,
    scanType: 'http_header_audit',
    note: 'Audit passivo header HTTP + Set-Cookie + analisi CSP. Non sostituisce test su auth, API, upload o business logic.',
    status: 'success'
  };
}

module.exports = { runHttpHeaderAudit };

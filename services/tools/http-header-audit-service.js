/**
 * EVIL — Audit header HTTP: analisi passiva degli header di sicurezza e dei cookie
 * di una singola risposta GET. Tutti i testi per l'utente sono nella lingua della
 * richiesta (t(lang, …)).
 */
const { axios, assertPublicDestination } = require('../../server/lib/safe-http');
const { t } = require('../../server/i18n');

// Riferimenti OWASP Top 10 2021 associati a ogni header mancante
const HEADER_CHECKS = [
  { id: 'hsts', header: 'strict-transport-security', label: 'Strict-Transport-Security', severity: 'high', httpsOnly: true, owasp: 'A02:2021' },
  { id: 'csp', header: 'content-security-policy', label: 'Content-Security-Policy', severity: 'high', owasp: 'A03:2021' },
  {
    id: 'xfo', header: 'x-frame-options', label: 'X-Frame-Options', severity: 'medium',
    altHeader: 'content-security-policy', altMatch: /frame-ancestors/i, owasp: 'A04:2021',
  },
  { id: 'xcto', header: 'x-content-type-options', label: 'X-Content-Type-Options', severity: 'medium', owasp: 'A05:2021' },
  { id: 'referrer', header: 'referrer-policy', label: 'Referrer-Policy', severity: 'low', owasp: 'A01:2021' },
  { id: 'permissions', header: 'permissions-policy', label: 'Permissions-Policy', severity: 'low', altHeader: 'feature-policy', owasp: 'A01:2021' },
  { id: 'coop', header: 'cross-origin-opener-policy', label: 'Cross-Origin-Opener-Policy', severity: 'low', optional: true, owasp: 'A01:2021' },
  { id: 'corp', header: 'cross-origin-resource-policy', label: 'Cross-Origin-Resource-Policy', severity: 'low', optional: true },
  { id: 'coep', header: 'cross-origin-embedder-policy', label: 'Cross-Origin-Embedder-Policy', severity: 'low', optional: true },
];

function headerAdvice(lang, id) {
  switch (id) {
    case 'hsts': return t(lang, 'Imposta Strict-Transport-Security con max-age di almeno 31536000 (un anno) e includeSubDomains se tutti i sottodomini usano HTTPS: il browser non userà più HTTP per questo sito.');
    case 'csp': return t(lang, 'Definisci una Content-Security-Policy che elenchi le sole origini da cui caricare script e risorse: è la difesa principale contro XSS e iniezioni di contenuti.');
    case 'xfo': return t(lang, 'Imposta X-Frame-Options: DENY (o SAMEORIGIN) oppure la direttiva frame-ancestors nella CSP, così altri siti non possono incorporare le tue pagine (clickjacking).');
    case 'xcto': return t(lang, 'Imposta X-Content-Type-Options: nosniff, così il browser non «indovina» il tipo dei file e non esegue come script ciò che non lo è.');
    case 'referrer': return t(lang, 'Imposta Referrer-Policy: strict-origin-when-cross-origin (o più restrittiva) per non inviare ad altri siti indirizzi completi con parametri sensibili.');
    case 'permissions': return t(lang, 'Imposta Permissions-Policy per disattivare le funzioni del browser che il sito non usa (fotocamera, microfono, geolocalizzazione…).');
    case 'coop': return t(lang, 'Facoltativo: Cross-Origin-Opener-Policy: same-origin isola la finestra da quelle aperte da altri siti.');
    case 'corp': return t(lang, 'Facoltativo: Cross-Origin-Resource-Policy: same-origin o same-site limita chi può caricare le tue risorse.');
    case 'coep': return t(lang, 'Facoltativo: Cross-Origin-Embedder-Policy: require-corp serve solo se il sito ha bisogno dell’isolamento tra origini (per esempio SharedArrayBuffer).');
    default: return '';
  }
}

const COOKIE_CLASSIFIERS = [
  {
    type: 'session',
    risk: 'high',
    patterns: [
      /session/i, /^sid$/i, /^sess/i, /auth/i, /token/i, /jwt/i, /login/i,
      /connect\.sid/i, /phpsessid/i, /laravel_session/i, /aspsession/i, /jsessionid/i,
      /remember/i, /credential/i,
    ],
  },
  { type: 'csrf', risk: 'medium', patterns: [/csrf/i, /xsrf/i, /nonce/i, /anti.?forgery/i] },
  {
    type: 'preference',
    risk: 'low',
    patterns: [
      /^geo/i, /lang/i, /locale/i, /consent/i, /gdpr/i, /theme/i, /^pref/i,
      /cookie.?banner/i, /analytics/i, /^_ga/i, /^_gid/i, /^_fbp/i, /^_gcl/i, /^opt/i,
    ],
  },
];

function cookieTypeLabel(lang, type) {
  switch (type) {
    case 'session': return t(lang, 'Sessione / autenticazione');
    case 'csrf': return t(lang, 'Protezione CSRF');
    case 'preference': return t(lang, 'Preferenze / statistiche');
    default: return t(lang, 'Non classificato');
  }
}

function riskLabel(lang, risk) {
  switch (risk) {
    case 'critical': return t(lang, 'critica');
    case 'high': return t(lang, 'alta');
    case 'medium': return t(lang, 'media');
    default: return t(lang, 'bassa');
  }
}

function auditLimitations(lang) {
  return [
    t(lang, 'Valuta solo gli header HTTP e i cookie (Set-Cookie) di una singola risposta GET alla pagina indicata.'),
    t(lang, 'Non verifica autenticazione, API, permessi, caricamento di file né la logica dell’applicazione.'),
    t(lang, 'Gli header Cross-Origin (COOP, CORP, COEP) sono facoltativi: utili per isolare il sito, non sempre necessari su un sito pubblico.'),
    t(lang, 'Il punteggio non sostituisce un penetration test né una revisione dell’architettura.'),
  ];
}

function gradeFromScore(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 55) return 'D';
  return 'F';
}

function classifyCookie(name, lang) {
  for (const rule of COOKIE_CLASSIFIERS) {
    if (rule.patterns.some((p) => p.test(name))) {
      return { type: rule.type, typeLabel: cookieTypeLabel(lang, rule.type), risk: rule.risk };
    }
  }
  return { type: 'unknown', typeLabel: cookieTypeLabel(lang, 'unknown'), risk: 'medium' };
}

function cookieHardeningIssues(cookie, lang) {
  const issues = [];
  if (cookie.risk === 'low') {
    if (!cookie.secure && cookie.type === 'preference') issues.push({ flag: 'Secure', severity: 'info' });
    return issues;
  }
  if (!cookie.secure) issues.push({ flag: 'Secure', severity: cookie.risk === 'high' ? 'high' : 'medium' });
  if (!cookie.httpOnly && cookie.type !== 'csrf') {
    issues.push({ flag: 'HttpOnly', severity: cookie.risk === 'high' ? 'high' : 'medium' });
  }
  if (cookie.sameSite === 'missing' || cookie.sameSite === 'none') {
    issues.push({
      flag: 'SameSite',
      severity: cookie.risk === 'high' ? 'medium' : 'low',
      detail: cookie.sameSite === 'none'
        ? t(lang, 'SameSite=None: il cookie viene inviato anche nelle richieste da altri siti (e richiede Secure).')
        : t(lang, 'SameSite non impostato: il comportamento dipende dal browser.'),
    });
  }
  return issues;
}

function parseCookies(setCookie, lang) {
  if (!setCookie) return [];
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  return list.slice(0, 40).map((line) => {
    const parts = String(line).split(';').map((p) => p.trim());
    const [nameVal] = parts;
    const flags = parts.slice(1).map((p) => p.toLowerCase());
    const sameSite = flags.find((f) => f.startsWith('samesite='));
    const name = String(nameVal || '').split('=')[0].slice(0, 100);
    const cookie = {
      name,
      secure: flags.includes('secure'),
      httpOnly: flags.includes('httponly'),
      sameSite: sameSite ? sameSite.split('=')[1] : 'missing',
      ...classifyCookie(name, lang),
    };
    cookie.riskLabel = riskLabel(lang, cookie.risk);
    cookie.issues = cookieHardeningIssues(cookie, lang);
    cookie.hardened = cookie.issues.length === 0;
    return cookie;
  });
}

function analyzeCsp(rawHeaders, lang) {
  const csp = rawHeaders['content-security-policy'] || rawHeaders['content-security-policy-report-only'];
  if (!csp) return { present: false, mode: null, issues: [], directives: [] };

  const value = String(csp);
  const mode = rawHeaders['content-security-policy'] ? 'enforce' : 'report-only';
  const directives = value.split(';').map((d) => d.trim()).filter(Boolean).slice(0, 60).map((d) => {
    const [name, ...rest] = d.split(/\s+/);
    return { name: name.toLowerCase(), values: rest.slice(0, 40) };
  });

  const issues = [];
  const scriptSrc = directives.find((d) => d.name === 'script-src')?.values.join(' ') || '';
  const defaultSrc = directives.find((d) => d.name === 'default-src')?.values.join(' ') || '';

  if (/unsafe-inline/i.test(value)) {
    issues.push({
      severity: 'medium',
      title: t(lang, 'La CSP consente unsafe-inline'),
      detail: t(lang, 'Script e stili scritti dentro la pagina sono permessi: un attacco XSS può inserirne di propri, e la CSP protegge molto meno.'),
    });
  }
  if (/unsafe-eval/i.test(value)) {
    issues.push({
      severity: 'medium',
      title: t(lang, 'La CSP consente unsafe-eval'),
      detail: t(lang, 'eval() e funzioni simili trasformano testo in codice eseguibile: aumentano le possibilità di XSS.'),
    });
  }
  if (/(^|\s)\*(\s|$)/.test(scriptSrc) || (/(^|\s)\*(\s|$)/.test(defaultSrc) && !scriptSrc)) {
    issues.push({
      severity: 'high',
      title: t(lang, 'La CSP usa un carattere jolly (*)'),
      detail: t(lang, 'script-src o default-src accettano script da qualsiasi sito: la policy non limita nulla.'),
    });
  }
  if (/data:/i.test(scriptSrc)) {
    issues.push({
      severity: 'medium',
      title: t(lang, 'La CSP accetta data: in script-src'),
      detail: t(lang, 'Permette di eseguire script scritti direttamente in un URL data:.'),
    });
  }
  if (mode === 'report-only') {
    issues.push({
      severity: 'low',
      title: t(lang, 'CSP solo in modalità report-only'),
      detail: t(lang, 'La policy segnala le violazioni ma non le blocca ancora.'),
    });
  }

  const modeLabel = mode === 'enforce' ? t(lang, 'applicata') : t(lang, 'solo segnalazione (report-only)');
  return { present: true, mode, modeLabel, value: value.length > 200 ? value.slice(0, 200) + '…' : value, issues, directives };
}

function buildFingerprint(probe, raw, lang) {
  const items = [];
  if (probe.server) {
    items.push({
      kind: 'Server',
      value: String(probe.server).slice(0, 120),
      severity: /\d+\.\d+/.test(probe.server) ? 'medium' : 'low',
      note: t(lang, 'L’header Server può rivelare prodotto e versione del software.'),
    });
  }
  if (probe.poweredBy) {
    items.push({
      kind: 'X-Powered-By',
      value: String(probe.poweredBy).slice(0, 120),
      severity: 'medium',
      note: t(lang, 'Rivela la tecnologia usata dal sito (linguaggio o framework).'),
    });
  }
  for (const [header, label] of [
    ['x-aspnet-version', 'X-AspNet-Version'],
    ['x-aspnetmvc-version', 'X-AspNetMvc-Version'],
    ['x-generator', 'X-Generator'],
    ['x-drupal-cache', 'X-Drupal-Cache'],
    ['x-powered-cms', 'X-Powered-CMS'],
  ]) {
    if (raw[header]) {
      items.push({ kind: label, value: String(raw[header]).slice(0, 120), severity: 'low', note: t(lang, 'Indica un componente del sito.') });
    }
  }
  return items.map((i) => ({ ...i, severityLabel: riskLabel(lang, i.severity) }));
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

async function probeHeaders(url, lang) {
  const started = Date.now();
  const response = await axios.get(url, {
    timeout: 12000,
    maxRedirects: 5,
    responseType: 'stream',
    validateStatus: () => true,
    headers: {
      'User-Agent': 'EVIL-Header-Audit/1.0 (+passive; security-assessment)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  const bodyPrefix = response.data ? await readStreamPrefix(response.data) : '';

  const raw = {};
  for (const [k, v] of Object.entries(response.headers)) raw[k.toLowerCase()] = v;

  const finalUrl = response.request?.res?.responseUrl || url;
  const isHttps = finalUrl.startsWith('https:');
  const titleMatch = bodyPrefix.match(/<title[^>]{0,200}>([^<]{1,200})<\/title>/i);

  const headerAudit = HEADER_CHECKS.map((check) => {
    const base = {
      id: check.id,
      label: check.label,
      severity: check.severity,
      severityLabel: riskLabel(lang, check.severity),
      optional: !!check.optional,
      recommendation: headerAdvice(lang, check.id),
      owasp: check.owasp || null,
    };
    if (check.httpsOnly && !isHttps) {
      return { ...base, present: false, skipped: true, value: null };
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
      ...base,
      present,
      skipped: false,
      value: present ? (String(value).length > 140 ? String(value).slice(0, 140) + '…' : value) : null,
    };
  });

  const cookies = parseCookies(raw['set-cookie'], lang);
  const cspAnalysis = analyzeCsp(raw, lang);
  const fingerprint = buildFingerprint({ server: raw.server || null, poweredBy: raw['x-powered-by'] || null }, raw, lang);

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
        value: String(value).length > 100 ? String(value).slice(0, 100) + '…' : value,
      })),
  };
}

function buildFindings(probe, lang) {
  const findings = [];

  if (!probe.isHttps) {
    findings.push({
      severity: 'critical',
      title: t(lang, 'Il sito non usa HTTPS'),
      detail: t(lang, 'La pagina arriva in chiaro su HTTP: chi controlla la rete (per esempio un Wi-Fi pubblico) può leggere e modificare il traffico.'),
      module: 'transport',
      recommendation: t(lang, 'Attiva HTTPS con un certificato valido e reindirizza tutto il traffico HTTP verso HTTPS.'),
    });
  }

  for (const h of probe.headerAudit) {
    if (h.skipped || h.present || h.optional) continue;
    findings.push({
      severity: h.severity === 'high' ? 'high' : h.severity === 'medium' ? 'medium' : 'low',
      title: t(lang, 'Manca {header}', { header: h.label }),
      detail: h.recommendation,
      module: 'headers',
      owasp: h.owasp,
      header: h.label,
    });
  }

  for (const c of probe.cookies) {
    if (c.hardened) continue;
    for (const issue of c.issues) {
      if (issue.severity === 'info') continue;
      findings.push({
        severity: issue.severity,
        title: t(lang, 'Cookie «{name}» ({type}): manca {flag}', { name: c.name, type: c.typeLabel, flag: issue.flag }),
        detail: issue.detail || t(lang, 'Secure: {secure} · HttpOnly: {httpOnly} · SameSite: {sameSite}', {
          secure: c.secure ? t(lang, 'sì') : t(lang, 'no'),
          httpOnly: c.httpOnly ? t(lang, 'sì') : t(lang, 'no'),
          sameSite: c.sameSite === 'missing' ? t(lang, 'assente') : c.sameSite,
        }),
        module: 'cookies',
        recommendation: c.risk === 'high'
          ? t(lang, 'Un cookie di sessione deve avere Secure, HttpOnly e SameSite=Lax o Strict.')
          : t(lang, 'Valuta Secure e SameSite anche per i cookie che non riguardano la sessione.'),
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
        recommendation: t(lang, 'Restringi script-src e default-src alle origini necessarie ed evita unsafe-inline, unsafe-eval e il carattere jolly.'),
      });
    }
  }

  for (const fp of probe.fingerprint || []) {
    if (fp.severity === 'medium') {
      findings.push({
        severity: 'low',
        title: t(lang, 'Informazioni sul software esposte: {header}', { header: fp.kind }),
        detail: `${fp.value} — ${fp.note}`,
        module: 'disclosure',
        recommendation: t(lang, 'Togli o generalizza questi header: non servono ai visitatori e aiutano chi cerca versioni vulnerabili.'),
      });
    }
  }

  if (!findings.length) {
    findings.push({
      severity: 'info',
      title: t(lang, 'Header di sicurezza adeguati'),
      detail: t(lang, 'Nessuna lacuna importante nei controlli eseguiti.'),
      module: 'summary',
    });
  }

  return findings.map((f) => ({ ...f, severityLabel: riskLabel(lang, f.severity) }));
}

function computeScore(probe, findings, lang) {
  const breakdown = [];
  let score = 100;

  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity, severityLabel: riskLabel(lang, severity) });
  };

  if (!probe.isHttps) add('no_https', t(lang, 'Sito senza HTTPS'), -40, 'critical');

  for (const h of probe.headerAudit) {
    if (h.skipped || h.present || h.optional) continue;
    const label = t(lang, 'Manca {header}', { header: h.label });
    if (h.severity === 'high') add(`missing_${h.id}`, label, -12, 'high');
    else if (h.severity === 'medium') add(`missing_${h.id}`, label, -7, 'medium');
    else add(`missing_${h.id}`, label, -3, 'low');
  }

  for (const c of probe.cookies) {
    if (c.hardened || c.risk === 'low') continue;
    const penalty = c.risk === 'high' ? -10 : -5;
    add(`cookie_${c.name}`, t(lang, 'Cookie {name} ({type})', { name: c.name, type: c.typeLabel }), penalty, c.risk === 'high' ? 'high' : 'medium');
  }

  if (probe.cspAnalysis?.present) {
    probe.cspAnalysis.issues.forEach((issue, i) => {
      if (issue.severity === 'high') add(`csp_${i}`, issue.title, -8, 'high');
      else if (issue.severity === 'medium') add(`csp_${i}`, issue.title, -5, 'medium');
      else add(`csp_${i}`, issue.title, -1, 'low');
    });
  }

  if (probe.fingerprint?.some((f) => f.severity === 'medium')) {
    add('fingerprint', t(lang, 'Prodotto o versione del software esposti'), -3, 'low');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const maxSev = findings.find((f) => f.severity === 'critical')
    || findings.find((f) => f.severity === 'high')
    || findings.find((f) => f.severity === 'medium')
    || findings[0];
  const risk = ['critical', 'high', 'medium'].includes(maxSev?.severity) ? maxSev.severity : 'low';

  return { score, grade: gradeFromScore(score), risk, riskLabel: riskLabel(lang, risk), breakdown };
}

async function runHttpHeaderAudit(inputUrl, lang) {
  const started = Date.now();
  let fullUrl = String(inputUrl || '').trim();
  if (!/^https?:\/\//i.test(fullUrl)) fullUrl = 'https://' + fullUrl;

  const parsed = new URL(fullUrl);
  await assertPublicDestination(parsed); // errore chiaro subito; il controllo vale comunque a ogni connessione
  const probe = await probeHeaders(fullUrl, lang);

  const findings = buildFindings(probe, lang);
  const { score, grade, risk, riskLabel: riskText, breakdown } = computeScore(probe, findings, lang);

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
    riskLabel: riskText,
    scoreBreakdown: breakdown,
    findings,
    headerAudit: probe.headerAudit,
    cookies: probe.cookies,
    cspAnalysis: probe.cspAnalysis,
    fingerprint: probe.fingerprint,
    disclosure: {
      server: probe.server,
      poweredBy: probe.poweredBy,
      contentType: probe.contentType,
    },
    limitations: auditLimitations(lang),
    scope: 'http_headers_passive',
    http: {
      status: probe.status,
      statusText: probe.statusText,
      isHttps: probe.isHttps,
      probeDurationMs: probe.durationMs,
    },
    rawHeaders: probe.rawHeaders,
    scanType: 'http_header_audit',
    note: t(lang, 'Lettura passiva degli header HTTP, dei cookie e della Content-Security-Policy di una risposta. Non prova attacchi e non sostituisce un test su autenticazione, API o logica dell’applicazione.'),
    status: 'success',
  };
}

module.exports = { runHttpHeaderAudit, analyzeCsp, parseCookies };

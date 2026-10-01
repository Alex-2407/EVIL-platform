/**
 * EVIL Social Profiling — OSINT passivo su username (fonti pubbliche)
 */
// Client HTTP con protezione SSRF (anche i redirect vengono verificati)
const { axios } = require('../../server/lib/safe-http');
const { t } = require('../../server/i18n');

const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,30}[a-zA-Z0-9])?$/;

const PLATFORMS = [
  { id: 'github', name: 'GitHub', category: 'dev', buildUrl: (u) => `https://github.com/${u}`, probe: 'github' },
  { id: 'reddit', name: 'Reddit', category: 'social', buildUrl: (u) => `https://www.reddit.com/user/${u}`, probe: 'reddit' },
  { id: 'twitter', name: 'X (Twitter)', category: 'social', buildUrl: (u) => `https://x.com/${u}`, probe: 'head' },
  { id: 'instagram', name: 'Instagram', category: 'social', buildUrl: (u) => `https://www.instagram.com/${u}/`, probe: 'head' },
  { id: 'linkedin', name: 'LinkedIn', category: 'professional', buildUrl: (u) => `https://www.linkedin.com/in/${u}`, probe: 'head' },
  { id: 'youtube', name: 'YouTube', category: 'media', buildUrl: (u) => `https://www.youtube.com/@${u}`, probe: 'head' },
  { id: 'tiktok', name: 'TikTok', category: 'social', buildUrl: (u) => `https://www.tiktok.com/@${u}`, probe: 'head' },
  { id: 'gitlab', name: 'GitLab', category: 'dev', buildUrl: (u) => `https://gitlab.com/${u}`, probe: 'head' },
  { id: 'medium', name: 'Medium', category: 'blog', buildUrl: (u) => `https://medium.com/@${u}`, probe: 'head' },
  { id: 'pypi', name: 'PyPI', category: 'dev', buildUrl: (u) => `https://pypi.org/user/${u}/`, probe: 'head' }
];

function auditLimitations(lang) {
  return [
    t(lang, 'Analizza solo lo username e fonti pubbliche: niente login, niente scraping di aree riservate.'),
    t(lang, 'I controlli HTTP (HEAD) sui social sono indicativi: molte piattaforme rispondono 200 anche se il profilo non esiste.'),
    t(lang, 'Il controllo dei data breach riguarda solo l\'email del tuo account EVIL.'),
    t(lang, 'Usalo sul tuo account o su un profilo per cui hai il consenso scritto della persona interessata. La profilazione di terzi senza base giuridica viola il GDPR.')
  ];
}

/** Errore con messaggio già scritto per l'utente (la route lo restituisce così com'è). */
function userError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

function normalizeUsername(input, lang) {
  let u = String(input || '').trim();
  u = u.replace(/^@/, '').replace(/\s+/g, '');
  if (!u || !USERNAME_RE.test(u)) {
    throw userError(t(lang, 'Username non valido: da 1 a 32 caratteri tra lettere, numeri, punto, trattino e trattino basso.'));
  }
  return u;
}

function normalizeEmail(input) {
  if (!input) return null;
  const e = String(input).trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  return e;
}

async function probeGithub(username) {
  try {
    const { data } = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      timeout: 8000,
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'EVIL-Social-OSINT/1.0' }
    });
    return {
      found: true,
      confidence: 'high',
      dataSource: 'api.github.com',
      url: data.html_url,
      profile: {
        login: data.login,
        name: data.name,
        bio: data.bio,
        company: data.company,
        location: data.location,
        blog: data.blog,
        publicRepos: data.public_repos,
        followers: data.followers,
        following: data.following,
        createdAt: data.created_at
      }
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return { found: false, confidence: 'high', dataSource: 'api.github.com', url: `https://github.com/${username}` };
    }
    return { found: null, confidence: 'low', dataSource: 'api.github.com', error: err.message, url: `https://github.com/${username}` };
  }
}

async function probeReddit(username) {
  try {
    const { status, data } = await axios.get(
      `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
      {
        timeout: 8000,
        headers: { 'User-Agent': 'EVIL-Social-OSINT/1.0' },
        validateStatus: () => true
      }
    );
    if (status === 404 || data?.error === 404) {
      return { found: false, confidence: 'high', dataSource: 'reddit.com/about.json', url: `https://www.reddit.com/user/${username}` };
    }
    if (status === 200 && data?.data?.name) {
      return {
        found: true,
        confidence: 'high',
        dataSource: 'reddit.com/about.json',
        url: `https://www.reddit.com/user/${username}`,
        profile: {
          name: data.data.name,
          linkKarma: data.data.link_karma,
          commentKarma: data.data.comment_karma,
          createdUtc: data.data.created_utc
        }
      };
    }
    return { found: null, confidence: 'low', dataSource: 'reddit.com/about.json', url: `https://www.reddit.com/user/${username}` };
  } catch (err) {
    return { found: null, confidence: 'low', dataSource: 'reddit.com/about.json', error: err.message };
  }
}

async function probeHead(url, lang) {
  try {
    const res = await axios.head(url, {
      timeout: 5000,
      maxRedirects: 0,
      validateStatus: () => true,
      headers: { 'User-Agent': 'EVIL-Social-OSINT/1.0' }
    });
    // Mai affermare "account trovato" da HEAD: molti siti rispondono 200/302 anche senza profilo.
    if (res.status === 404) {
      return {
        found: false,
        confidence: 'low',
        httpStatus: res.status,
        dataSource: 'http-head',
        note: t(lang, 'HTTP 404: probabilmente il profilo non esiste (conferma aprendo il link).')
      };
    }
    return {
      found: null,
      confidence: 'low',
      httpStatus: res.status,
      dataSource: 'http-head',
      note: t(lang, 'HTTP {status}: non prova che l\'account esista; verifica aprendo il link.', { status: res.status })
    };
  } catch (err) {
    return {
      found: null,
      confidence: 'low',
      error: err.message,
      dataSource: 'http-head',
      note: t(lang, 'Richiesta bloccata o scaduta: verifica aprendo il link.')
    };
  }
}

async function probePlatform(platform, username, lang) {
  const url = platform.buildUrl(username);
  const base = { platform: platform.name, id: platform.id, category: platform.category, url };

  if (platform.probe === 'github') {
    return { ...base, ...(await probeGithub(username)) };
  }
  if (platform.probe === 'reddit') {
    return { ...base, ...(await probeReddit(username)) };
  }
  const head = await probeHead(url, lang);
  return { ...base, ...head };
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function checkBreaches(email, lang) {
  if (!email) return { checked: false, reason: t(lang, 'Controllo non richiesto.') };
  try {
    const res = await axios.get(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`,
      {
        timeout: 8000,
        headers: { 'hibp-api-key': process.env.HIBP_API_KEY || '', 'User-Agent': 'EVIL-Social-OSINT' },
        validateStatus: () => true
      }
    );
    if (res.status === 401) {
      return { checked: false, reason: t(lang, 'Il controllo automatico non è configurato su questo server: verifica la tua email direttamente su haveibeenpwned.com.') };
    }
    if (res.status === 404) {
      return { checked: true, breachCount: 0, breaches: [] };
    }
    if (res.status === 200 && Array.isArray(res.data)) {
      return {
        checked: true,
        breachCount: res.data.length,
        breaches: res.data.map((b) => ({
          name: b.Name,
          date: b.BreachDate,
          dataClasses: b.DataClasses || []
        }))
      };
    }
    return { checked: false, reason: t(lang, 'Have I Been Pwned ha risposto con HTTP {status}: riprova più tardi.', { status: res.status }) };
  } catch (_) {
    return { checked: false, reason: t(lang, 'Have I Been Pwned non è raggiungibile in questo momento: riprova più tardi.') };
  }
}

function buildFindings(username, platforms, breaches, lang) {
  const findings = [];
  const confirmed = platforms.filter((p) => p.found === true && p.confidence === 'high');

  if (confirmed.length >= 4) {
    findings.push({
      severity: 'medium',
      title: t(lang, 'Impronta digitale ampia'),
      detail: t(lang, '{n} piattaforme con verifica affidabile per @{username}.', { n: confirmed.length, username }),
      module: 'footprint'
    });
  }

  if (platforms.some((p) => p.id === 'github' && p.found && p.profile?.publicRepos > 0)) {
    findings.push({
      severity: 'low',
      title: t(lang, 'Profilo GitHub pubblico'),
      detail: t(lang, 'Repository e metadati possono rivelare tecnologie usate, progetti e collaborazioni.'),
      module: 'dev'
    });
  }

  const manualLinks = platforms.filter((p) => p.dataSource === 'http-head');
  if (manualLinks.length) {
    findings.push({
      severity: 'info',
      title: t(lang, 'Link a profili da verificare'),
      detail: t(lang, '{n} link generati: una risposta HTTP non prova che l\'account esista.', { n: manualLinks.length }),
      module: 'footprint'
    });
  }

  if (breaches.checked && breaches.breachCount > 0) {
    findings.push({
      severity: 'high',
      title: breaches.breachCount === 1
        ? t(lang, 'La tua email compare in 1 data breach')
        : t(lang, 'La tua email compare in {n} data breach', { n: breaches.breachCount }),
      detail: breaches.breaches.map((b) => b.name).slice(0, 5).join(', '),
      module: 'breach'
    });
  }

  if (!findings.length) {
    findings.push({
      severity: 'info',
      title: t(lang, 'Esposizione limitata'),
      detail: t(lang, 'Poche corrispondenze automatiche: completa con una ricerca manuale sul tuo nome e sui tuoi username.'),
      module: 'summary'
    });
  }

  return findings;
}

function computeScore(platforms, breaches, lang) {
  const breakdown = [];
  let score = 100;
  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity });
  };

  const confirmed = platforms.filter((p) => p.found === true && p.confidence === 'high').length;
  if (confirmed >= 4) add('many_accounts', t(lang, '{n} account verificati tramite API', { n: confirmed }), -15, 'medium');
  else if (confirmed >= 2) add('some_accounts', t(lang, '{n} account verificati tramite API', { n: confirmed }), -8, 'low');

  if (breaches.breachCount > 0) add('breaches', t(lang, 'Email in {n} data breach', { n: breaches.breachCount }), -20, 'high');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';
  const footprint =
    confirmed >= 6 ? 'high' : confirmed >= 3 ? 'medium' : confirmed >= 1 ? 'low' : 'minimal';

  return { score, grade, footprint, breakdown };
}

/**
 * @param {{ username: string, email?: string }} input  email: solo quella dell'account (la route lo garantisce)
 * @param {{ lang?: string }} opts
 */
async function runSocialProfiling(input, { lang } = {}) {
  const started = Date.now();
  const username = normalizeUsername(input.username, lang);
  const email = normalizeEmail(input.email);

  const platforms = await mapPool(PLATFORMS, 4, (p) => probePlatform(p, username, lang));
  const breaches = await checkBreaches(email, lang);

  const summary = {
    platformsChecked: platforms.length,
    confirmedFound: platforms.filter((p) => p.found === true && p.confidence === 'high').length,
    // prima era identico a confirmedFound (stesso filtro copiato)
    possibleFound: platforms.filter((p) => p.found === true && p.confidence !== 'high').length,
    manualLinks: platforms.filter((p) => p.dataSource === 'http-head').length,
    notFound: platforms.filter((p) => p.found === false).length,
    inconclusive: platforms.filter((p) => p.found == null).length
  };

  const findings = buildFindings(username, platforms, breaches, lang);
  const scoring = computeScore(platforms, breaches, lang);

  return {
    username,
    email: email || null,
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - started,
    platforms,
    breaches,
    summary,
    findings,
    ...scoring,
    scoreBreakdown: scoring.breakdown,
    searchLinks: [
      { label: 'Google', url: `https://www.google.com/search?q="${encodeURIComponent(username)}"` },
      { label: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${encodeURIComponent(username)}` }
    ],
    limitations: auditLimitations(lang),
    note: t(lang, 'OSINT passivo sullo username: corrispondenze tra account e metadati pubblici, senza accesso autenticato.'),
    scanType: 'social_profiling',
    status: 'success'
  };
}

module.exports = {
  runSocialProfiling,
  normalizeUsername,
  probeGithub,
  probeReddit
};

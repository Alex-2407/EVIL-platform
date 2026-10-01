/**
 * EVIL — Sottodomini: wordlist + Certificate Transparency (crt.sh)
 *
 * S-12: il dominio passa dalla guardia anti-SSRF (niente *.internal, *.corp…) e gli
 * indirizzi non pubblici a cui risolvono i sottodomini non compaiono nei risultati.
 */
const dns = require('dns').promises;
// Client HTTP con protezione SSRF (anche i redirect vengono verificati)
const { axios, isPublicAddress } = require('../../server/lib/safe-http');
const { t } = require('../../server/i18n');
const { normalizeToolDomain } = require('./tool-i18n');

const WORDLIST = [
  'www', 'mail', 'ftp', 'webmail', 'smtp', 'pop', 'imap', 'ns1', 'ns2',
  'cpanel', 'whm', 'autodiscover', 'autoconfig', 'api', 'admin', 'test',
  'portal', 'beta', 'dev', 'staging', 'prod', 'app', 'blog', 'shop', 'cdn',
  'image', 'images', 'static', 'assets', 'download', 'uploads', 'files',
  'vpn', 'remote', 'git', 'gitlab', 'jenkins', 'ci', 'grafana', 'kibana',
  'status', 'docs', 'help', 'support', 'sso', 'auth', 'login', 'm', 'mobile'
];

const CATEGORY_RULES = [
  { id: 'admin', risk: 'high', patterns: [/^admin/i, /^cpanel$/i, /^whm$/i, /^panel$/i, /^plesk$/i] },
  { id: 'api', risk: 'medium', patterns: [/^api(?:$|[\d-])/i, /^gateway$/i, /^graphql$/i] },
  { id: 'auth', risk: 'medium', patterns: [/^auth/i, /^sso$/i, /^login$/i, /^idp$/i] },
  { id: 'dev', risk: 'high', patterns: [/^dev(?:$|[\d-])/i, /^staging/i, /^stage$/i, /^test(?:$|[\d-])/i, /^beta$/i, /^uat$/i, /^qa$/i] },
  { id: 'mail', risk: 'low', patterns: [/^mail/i, /^smtp/i, /^webmail$/i, /^mx\d*$/i, /^imap$/i, /^pop3?$/i, /^autodiscover$/i, /^autoconfig$/i] },
  { id: 'cdn', risk: 'low', patterns: [/^cdn/i, /^static$/i, /^assets$/i, /^img$/i, /^images?$/i, /^media$/i] },
  { id: 'infra', risk: 'medium', patterns: [/^vpn/i, /^remote$/i, /^jenkins$/i, /^git(?:lab)?$/i, /^grafana$/i, /^kibana$/i, /^ci$/i, /^ftp$/i] },
  { id: 'web', risk: 'low', patterns: [/^www\d*$/i, /^app$/i, /^portal$/i, /^shop$/i, /^blog$/i, /^m$/i, /^mobile$/i] },
];

function categoryLabel(lang, id) {
  switch (id) {
    case 'admin': return t(lang, 'Amministrazione');
    case 'api': return t(lang, 'API / integrazione');
    case 'auth': return t(lang, 'Autenticazione');
    case 'dev': return t(lang, 'Sviluppo / test');
    case 'mail': return t(lang, 'Posta');
    case 'cdn': return t(lang, 'CDN / contenuti statici');
    case 'infra': return t(lang, 'Infrastruttura');
    case 'web': return t(lang, 'Sito pubblico');
    default: return t(lang, 'Altro');
  }
}

function auditLimitations(lang) {
  return [
    t(lang, 'La wordlist contiene circa 50 prefissi comuni: non è un elenco completo dei sottodomini.'),
    t(lang, 'crt.sh riporta i nomi presenti nei certificati, anche vecchi: non tutti esistono ancora nel DNS.'),
    t(lang, 'Solo risoluzione DNS: nessuna scansione di porte e nessuna richiesta ai siti trovati.'),
    t(lang, 'Gli indirizzi non pubblici (reti private, loopback) non vengono mostrati.'),
  ];
}

async function mapPool(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function apexFromHost(host, domain) {
  const h = host.toLowerCase();
  const d = domain.toLowerCase();
  if (h === d) return '@';
  if (h.endsWith('.' + d)) return h.slice(0, -(d.length + 1)).split('.')[0];
  return h.split('.')[0];
}

function classifyHost(host, domain, lang) {
  const prefix = apexFromHost(host, domain);
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(prefix))) {
      return { category: rule.id, categoryLabel: categoryLabel(lang, rule.id), risk: rule.risk, prefix };
    }
  }
  return { category: 'other', categoryLabel: categoryLabel(lang, 'other'), risk: 'low', prefix };
}

async function resolveHost(fqdn) {
  let ipv4 = null;
  let ipv6 = null;
  let cname = null;
  try {
    const a = await dns.resolve4(fqdn);
    ipv4 = a[0] || null;
  } catch {
    /* no A */
  }
  try {
    const aaaa = await dns.resolve6(fqdn);
    ipv6 = aaaa[0] || null;
  } catch {
    /* no AAAA */
  }
  try {
    const cn = await dns.resolveCname(fqdn);
    cname = cn[0] || null;
  } catch {
    /* no CNAME */
  }
  if (!ipv4 && !ipv6 && !cname) return null;
  // Indirizzi non pubblici: il nome esiste ma l'indirizzo non viene mostrato (S-12)
  const hidden = (ipv4 && !isPublicAddress(ipv4)) || (ipv6 && !isPublicAddress(ipv6));
  if (ipv4 && !isPublicAddress(ipv4)) ipv4 = null;
  if (ipv6 && !isPublicAddress(ipv6)) ipv6 = null;
  return { ipv4, ipv6, cname, hiddenAddress: !!hidden };
}

async function fetchCrtShNames(domain) {
  const names = new Set();
  try {
    const response = await axios.get(
      `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
      { timeout: 18000, validateStatus: () => true, maxContentLength: 20 * 1024 * 1024 }
    );
    if (!Array.isArray(response.data)) return names;
    for (const entry of response.data.slice(0, 300)) {
      if (!entry.name_value) continue;
      for (const name of String(entry.name_value).split('\n')) {
        const n = name.trim().toLowerCase().replace(/^\*\./, '');
        if (!n || n.includes(' ')) continue;
        if (n === domain || n.endsWith('.' + domain)) names.add(n);
      }
    }
  } catch {
    /* CT opzionale */
  }
  return names;
}

function buildFindings(found, summary, lang) {
  const findings = [];
  const risky = found.filter((s) => s.risk === 'high');
  const medium = found.filter((s) => s.risk === 'medium');

  if (risky.length) {
    findings.push({
      severity: 'high',
      title: risky.length === 1
        ? t(lang, '1 host sensibile raggiungibile dal DNS pubblico')
        : t(lang, '{n} host sensibili raggiungibili dal DNS pubblico', { n: risky.length }),
      detail: risky.map((s) => s.subdomain).slice(0, 5).join(', ') + (risky.length > 5 ? '…' : ''),
      module: 'surface',
      recommendation: t(lang, 'Verifica che pannelli di amministrazione e ambienti di sviluppo o test siano protetti (VPN, autenticazione forte) o non pubblicati.'),
    });
  }

  if (medium.length >= 3) {
    findings.push({
      severity: 'medium',
      title: t(lang, 'Molti servizi di API, autenticazione o infrastruttura'),
      detail: t(lang, '{n} host di questo tipo: ognuno è un punto di accesso da inventariare e aggiornare.', { n: medium.length }),
      module: 'surface',
    });
  }

  if (summary.activeCount >= 15) {
    findings.push({
      severity: 'low',
      title: t(lang, 'Superficie esposta ampia'),
      detail: t(lang, '{n} sottodomini risolti: più punti di ingresso da tenere monitorati.', { n: summary.activeCount }),
      module: 'surface',
    });
  }

  if (summary.hiddenCount > 0) {
    findings.push({
      severity: 'low',
      title: t(lang, 'Sottodomini che puntano a indirizzi interni'),
      detail: t(lang, '{n} nomi pubblici risolvono a reti private o riservate: rivelano la struttura della rete interna (indirizzi non mostrati).', { n: summary.hiddenCount }),
      module: 'surface',
    });
  }

  if (summary.ctNames > 0 && summary.ctUnresolved > summary.ctChecked * 0.7) {
    findings.push({
      severity: 'info',
      title: t(lang, 'Molti nomi dai certificati non esistono più'),
      detail: t(lang, 'È normale per domini attivi da anni: i certificati vecchi restano nei registri pubblici.'),
      module: 'ct',
    });
  }

  if (!found.length) {
    findings.push({
      severity: 'info',
      title: t(lang, 'Nessun sottodominio trovato'),
      detail: t(lang, 'Né la wordlist né crt.sh hanno restituito nomi che risolvono nel DNS.'),
      module: 'summary',
    });
  } else if (!findings.length) {
    findings.push({
      severity: 'info',
      title: t(lang, 'Superficie contenuta'),
      detail: t(lang, 'Nessun host sensibile evidente tra quelli trovati.'),
      module: 'summary',
    });
  }

  return findings;
}

function computeScore(found, lang) {
  const breakdown = [];
  let score = 100;

  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity });
  };

  const high = found.filter((s) => s.risk === 'high').length;
  const med = found.filter((s) => s.risk === 'medium').length;

  if (high) add('risky_high', t(lang, 'Host sensibili: {n}', { n: high }), -Math.min(high * 12, 48), 'high');
  if (med) add('risky_med', t(lang, 'Host di API, autenticazione o infrastruttura: {n}', { n: med }), -Math.min(med * 5, 20), 'medium');
  if (found.length > 12) add('many_hosts', t(lang, 'Superficie ampia (più di 12 host)'), -8, 'low');
  if (found.length > 20) add('very_many', t(lang, 'Superficie molto ampia (più di 20 host)'), -7, 'low');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';

  return { score, grade, breakdown };
}

function summarizeByCategory(found) {
  const map = {};
  for (const s of found) {
    map[s.category] = (map[s.category] || 0) + 1;
  }
  return Object.entries(map).map(([category, count]) => ({
    category,
    label: found.find((f) => f.category === category)?.categoryLabel || category,
    count
  }));
}

async function runSubdomainFinder(inputDomain, lang) {
  const started = Date.now();
  const domain = normalizeToolDomain(inputDomain, lang);
  const domainLower = domain.toLowerCase();

  const wordlistHosts = WORDLIST.map((p) => `${p}.${domainLower}`);
  const ctNames = await fetchCrtShNames(domainLower);
  const ctList = [...ctNames].filter((n) => n !== domainLower).slice(0, 60);

  const candidates = [...new Set([...wordlistHosts, ...ctList])];
  const seen = new Map();

  const resolved = await mapPool(candidates, 10, async (host) => {
    const rec = await resolveHost(host);
    if (!rec) return { host, resolved: false };
    return { host, resolved: true, ...rec };
  });

  const ctUnresolved = [];

  for (const item of resolved) {
    if (!item.resolved) {
      if (ctList.includes(item.host)) ctUnresolved.push(item.host);
      continue;
    }
    const key = item.host.toLowerCase();
    const sources = [];
    if (wordlistHosts.includes(key)) sources.push('wordlist');
    if (ctNames.has(key)) sources.push('crt.sh');

    const cls = classifyHost(key, domainLower, lang);
    const entry = {
      subdomain: key,
      ip: item.ipv4,
      ipv6: item.ipv6,
      cname: item.cname,
      prefix: cls.prefix,
      category: cls.category,
      categoryLabel: cls.categoryLabel,
      risk: cls.risk,
      hiddenAddress: !!item.hiddenAddress,
      sources
    };

    if (seen.has(key)) {
      const existing = seen.get(key);
      existing.sources = [...new Set([...existing.sources, ...sources])];
      if (!existing.ipv4 && item.ipv4) existing.ipv4 = item.ipv4;
      if (!existing.ipv6 && item.ipv6) existing.ipv6 = item.ipv6;
      if (!existing.cname && item.cname) existing.cname = item.cname;
    } else {
      seen.set(key, entry);
    }
  }

  const found = [...seen.values()].sort((a, b) => a.subdomain.localeCompare(b.subdomain));

  const summary = {
    activeCount: found.length,
    wordlistChecked: WORDLIST.length,
    ctNames: ctNames.size,
    ctChecked: ctList.length,
    ctUnresolved: ctUnresolved.length,
    totalCandidates: candidates.length,
    riskyCount: found.filter((s) => s.risk === 'high').length,
    hiddenCount: found.filter((s) => s.hiddenAddress).length,
    byCategory: summarizeByCategory(found)
  };

  const findings = buildFindings(found, summary, lang);
  const scoring = computeScore(found, lang);

  return {
    domain,
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - started,
    found,
    foundCount: found.length,
    ctUnresolved: ctUnresolved.slice(0, 25),
    methods: {
      wordlist: WORDLIST.length,
      certificateTransparency: ctList.length,
      ctNamesTotal: ctNames.size
    },
    summary,
    findings,
    ...scoring,
    scoreBreakdown: scoring.breakdown,
    limitations: auditLimitations(lang),
    note: t(lang, 'Ricerca passiva: prefissi comuni e nomi dai registri pubblici dei certificati (crt.sh), verificati con il DNS (A, AAAA, CNAME).'),
    scanType: 'subdomain_finder',
    status: 'success'
  };
}

module.exports = { runSubdomainFinder, WORDLIST };

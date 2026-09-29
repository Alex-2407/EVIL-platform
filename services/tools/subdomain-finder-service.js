/**
 * EVIL Subdomain Finder — wordlist + Certificate Transparency (crt.sh)
 */
const dns = require('dns').promises;
const axios = require('axios');
const { normalizeDomain } = require('./dns-enumerator-service');

const WORDLIST = [
  'www', 'mail', 'ftp', 'webmail', 'smtp', 'pop', 'imap', 'ns1', 'ns2',
  'cpanel', 'whm', 'autodiscover', 'autoconfig', 'api', 'admin', 'test',
  'portal', 'beta', 'dev', 'staging', 'prod', 'app', 'blog', 'shop', 'cdn',
  'image', 'images', 'static', 'assets', 'download', 'uploads', 'files',
  'vpn', 'remote', 'git', 'gitlab', 'jenkins', 'ci', 'grafana', 'kibana',
  'status', 'docs', 'help', 'support', 'sso', 'auth', 'login', 'm', 'mobile'
];

const CATEGORY_RULES = [
  { id: 'admin', label: 'Amministrazione', risk: 'high', patterns: [/^admin/i, /^cpanel/i, /^whm/i, /^panel/i] },
  { id: 'api', label: 'API / integrazione', risk: 'medium', patterns: [/^api/i, /^gateway/i, /^graphql/i] },
  { id: 'auth', label: 'Autenticazione', risk: 'medium', patterns: [/^auth/i, /^sso/i, /^login/i, /^idp/i] },
  { id: 'dev', label: 'Sviluppo / staging', risk: 'high', patterns: [/^dev/i, /^staging/i, /^stage/i, /^test/i, /^beta/i, /^uat/i, /^qa/i] },
  { id: 'mail', label: 'Posta', risk: 'low', patterns: [/^mail/i, /^smtp/i, /^webmail/i, /^mx/i, /^imap/i, /^pop/i] },
  { id: 'cdn', label: 'CDN / asset', risk: 'low', patterns: [/^cdn/i, /^static/i, /^assets/i, /^img/i, /^media/i] },
  { id: 'infra', label: 'Infrastruttura', risk: 'medium', patterns: [/^vpn/i, /^jenkins/i, /^gitlab/i, /^grafana/i, /^kibana/i, /^ci/i] },
  { id: 'web', label: 'Web pubblico', risk: 'low', patterns: [/^www/i, /^app/i, /^portal/i, /^shop/i, /^blog/i] }
];

const AUDIT_LIMITATIONS = [
  'Wordlist limitata (~50 prefix comuni) — non è un brute-force completo.',
  'crt.sh fornisce nomi da certificati storici; non tutti risolvono ancora in A record.',
  'Solo risoluzione DNS passiva — nessun port scan o probe HTTP.',
  'Usare solo su domini per cui hai autorizzazione esplicita.'
];

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

function classifyHost(host, domain) {
  const prefix = apexFromHost(host, domain);
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((p) => p.test(prefix))) {
      return { category: rule.id, categoryLabel: rule.label, risk: rule.risk, prefix };
    }
  }
  return { category: 'other', categoryLabel: 'Altro', risk: 'low', prefix };
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
  return { ipv4, ipv6, cname };
}

async function fetchCrtShNames(domain) {
  const names = new Set();
  try {
    const response = await axios.get(
      `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
      { timeout: 18000, validateStatus: () => true }
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

function buildFindings(found, summary) {
  const findings = [];
  const risky = found.filter((s) => s.risk === 'high');
  const medium = found.filter((s) => s.risk === 'medium');

  if (risky.length) {
    findings.push({
      severity: 'high',
      title: `${risky.length} host ad alto rischio esposti`,
      detail: risky.map((s) => s.subdomain).slice(0, 5).join(', ') + (risky.length > 5 ? '…' : ''),
      module: 'surface',
      recommendation: 'Verifica che admin/dev/staging non siano esposti pubblicamente senza hardening.'
    });
  }

  if (medium.length >= 3) {
    findings.push({
      severity: 'medium',
      title: 'Superficie API/auth ampia',
      detail: `${medium.length} host classificati come API, auth o infrastruttura.`,
      module: 'surface'
    });
  }

  if (summary.activeCount >= 15) {
    findings.push({
      severity: 'low',
      title: 'Ampia superficie di sottodomini',
      detail: `${summary.activeCount} host risolti — più entry point da monitorare.`,
      module: 'surface'
    });
  }

  if (summary.ctNames > 0 && summary.ctUnresolved > summary.ctNames * 0.7) {
    findings.push({
      severity: 'info',
      title: 'Molti nomi CT senza A record',
      detail: 'Certificati storici con hostname non più attivi — normale su domini maturi.',
      module: 'ct'
    });
  }

  if (!found.length) {
    findings.push({
      severity: 'info',
      title: 'Nessun sottodominio risolto',
      detail: 'Wordlist e crt.sh non hanno prodotto host con A/AAAA/CNAME nella finestra analizzata.',
      module: 'summary'
    });
  } else if (!findings.length) {
    findings.push({
      severity: 'info',
      title: 'Superficie contenuta',
      detail: 'Nessun pattern ad alto rischio evidente nei host trovati.',
      module: 'summary'
    });
  }

  return findings;
}

function computeScore(found, findings) {
  const breakdown = [];
  let score = 100;

  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity });
  };

  const high = found.filter((s) => s.risk === 'high').length;
  const med = found.filter((s) => s.risk === 'medium').length;

  if (high) add('risky_high', `${high} host ad alto rischio`, -high * 12, 'high');
  if (med) add('risky_med', `${med} host a rischio medio`, -Math.min(med * 5, 20), 'medium');
  if (found.length > 12) add('many_hosts', 'Superficie ampia', -8, 'low');
  if (found.length > 20) add('very_many', 'Superficie molto ampia', -7, 'low');

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

async function runSubdomainFinder(inputDomain) {
  const started = Date.now();
  const domain = normalizeDomain(inputDomain);
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

    const cls = classifyHost(key, domainLower);
    const entry = {
      subdomain: key,
      ip: item.ipv4,
      ipv6: item.ipv6,
      cname: item.cname,
      prefix: cls.prefix,
      category: cls.category,
      categoryLabel: cls.categoryLabel,
      risk: cls.risk,
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
    byCategory: summarizeByCategory(found)
  };

  const findings = buildFindings(found, summary);
  const scoring = computeScore(found, findings);

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
    limitations: AUDIT_LIMITATIONS,
    note: 'Enumerazione passiva: wordlist comune + nomi da crt.sh, risoluzione A/AAAA/CNAME.',
    scanType: 'subdomain_finder',
    status: 'success'
  };
}

module.exports = { runSubdomainFinder, WORDLIST };

/**
 * EVIL — DNS e WHOIS: risoluzione dei record pubblici di un dominio + analisi passiva.
 *
 * S-12: i nomi interni (localhost, *.internal, *.corp…) sono rifiutati prima di interrogare
 * il DNS e gli indirizzi non pubblici eventualmente restituiti non compaiono nei risultati.
 */
const dns = require('dns').promises;
const { t } = require('../../server/i18n');
const { normalizeToolDomain, splitPublicAddresses } = require('./tool-i18n');

const RECORD_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'];

function recordTitle(lang, key) {
  switch (key) {
    case 'A': return t(lang, 'Indirizzi IPv4');
    case 'AAAA': return t(lang, 'Indirizzi IPv6');
    case 'MX': return t(lang, 'Server di posta');
    case 'NS': return t(lang, 'Name server');
    case 'TXT': return t(lang, 'Record di testo');
    case 'CNAME': return t(lang, 'Alias (nome canonico)');
    case 'SOA': return t(lang, 'Zona (start of authority)');
    default: return key;
  }
}

const PROVIDER_HINTS = [
  { name: 'Cloudflare', patterns: [/\.ns\.cloudflare\.com$/i] },
  { name: 'Amazon Route 53', patterns: [/awsdns/i] },
  { name: 'Google Cloud DNS', patterns: [/googledomains\.com$/i, /^ns-cloud-[a-e]\d\.googledomains/i] },
  { name: 'Microsoft Azure DNS', patterns: [/azure-dns\./i] },
  { name: 'OVHcloud', patterns: [/\.ovh\.net$/i] },
  { name: 'GoDaddy', patterns: [/domaincontrol\.com$/i] },
  { name: 'Aruba', patterns: [/\.aruba\.it$/i] },
];

const CDN_HINTS = [
  { name: 'Cloudflare', patterns: [/cloudflare/i] },
  { name: 'Fastly', patterns: [/fastly/i] },
  { name: 'Akamai', patterns: [/akamai/i, /edgesuite/i, /edgekey/i] },
  { name: 'Amazon CloudFront', patterns: [/cloudfront\.net/i] },
  { name: 'Azure Front Door / CDN', patterns: [/azureedge\.net/i, /azurefd\.net/i] },
];

function auditLimitations(lang) {
  return [
    t(lang, 'Legge solo i record pubblici del nome inserito: non tenta trasferimenti di zona (AXFR) né la ricerca di sottodomini.'),
    t(lang, 'SPF e DMARC sono letti dai record TXT; DKIM non è verificabile senza conoscere il selettore usato dal mittente.'),
    t(lang, 'Il WHOIS usa RDAP (HTTPS) e, se non disponibile, il servizio WHOIS del registro sulla porta 43: alcuni registri mostrano pochi dati per privacy.'),
    t(lang, 'Gli indirizzi non pubblici (reti private, loopback) eventualmente presenti nei record non vengono mostrati.'),
  ];
}

/** Compatibilità: alcuni moduli importano normalizeDomain da qui. */
function normalizeDomain(input, lang) {
  return normalizeToolDomain(input, lang);
}

async function safeResolve(fn, fallback) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

function flattenTxt(txtRecords) {
  return (txtRecords || []).map((r) => (Array.isArray(r) ? r.join('') : String(r)));
}

function classifyTxtRecord(text, lang) {
  const s = String(text);
  if (/^v=spf1/i.test(s)) return { kind: 'spf', label: 'SPF' };
  if (/^v=DMARC1/i.test(s)) return { kind: 'dmarc', label: 'DMARC' };
  if (/^v=DKIM1/i.test(s)) return { kind: 'dkim', label: 'DKIM' };
  if (/google-site-verification|facebook-domain-verification|^ms=|apple-domain-verification|_?globalsign|atlassian-domain-verification/i.test(s)) {
    return { kind: 'verification', label: t(lang, 'Verifica di proprietà') };
  }
  return { kind: 'other', label: t(lang, 'Altro') };
}

function analyzeSpf(spf, lang) {
  const issues = [];
  if (/\+all\b/i.test(spf)) {
    issues.push({ id: 'spf_plus_all', severity: 'high', title: t(lang, 'SPF permissivo (+all)'), detail: t(lang, 'Qualsiasi server al mondo è autorizzato a inviare posta a nome del dominio: l’SPF non protegge.') });
  } else if (/\?all\b/i.test(spf)) {
    issues.push({ id: 'spf_neutral', severity: 'medium', title: t(lang, 'SPF neutro (?all)'), detail: t(lang, 'Non dice cosa fare con i server non elencati: protezione contro lo spoofing quasi nulla.') });
  } else if (/~all\b/i.test(spf)) {
    issues.push({ id: 'spf_softfail', severity: 'low', title: t(lang, 'SPF in soft fail (~all)'), detail: t(lang, 'I messaggi non autorizzati vengono solo marcati: accettabile se c’è DMARC con policy restrittiva, altrimenti meglio -all.') });
  } else if (!/-all\b/i.test(spf) && !/redirect=/i.test(spf)) {
    issues.push({ id: 'spf_no_all', severity: 'low', title: t(lang, 'SPF senza regola finale'), detail: t(lang, 'Manca il meccanismo «all» finale: i server non elencati restano in uno stato neutro.') });
  }
  const lookups = (spf.match(/\b(?:include:|a\b|a:|mx\b|mx:|ptr\b|ptr:|exists:|redirect=)/gi) || []).length;
  if (lookups > 10) {
    issues.push({ id: 'spf_lookups', severity: 'medium', title: t(lang, 'SPF oltre il limite di 10 lookup'), detail: t(lang, 'Il record richiede {n} interrogazioni DNS: oltre 10 la verifica fallisce (RFC 7208) e l’SPF diventa inefficace.', { n: lookups }) });
  }
  return issues;
}

function extractDmarcPolicy(txt) {
  const m = String(txt).match(/(?:^|;)\s*p\s*=\s*([a-z]+)/i);
  return m ? m[1].toLowerCase() : 'unknown';
}

async function lookupDmarc(domain) {
  const host = `_dmarc.${domain}`;
  try {
    const raw = await dns.resolveTxt(host);
    const records = flattenTxt(raw);
    const policy = records.find((r) => /^v=DMARC1/i.test(r));
    return {
      host,
      present: !!policy,
      records,
      policy: policy ? extractDmarcPolicy(policy) : null,
      value: policy || records[0] || null,
    };
  } catch {
    return { host, present: false, records: [], policy: null, value: null };
  }
}

async function reversePtr(ip) {
  try {
    const names = await dns.reverse(ip);
    return names[0] || null;
  } catch {
    return null;
  }
}

function detectProviders(nsList) {
  const found = [];
  for (const p of PROVIDER_HINTS) {
    if (nsList.some((ns) => p.patterns.some((re) => re.test(ns)))) found.push(p.name);
  }
  return [...new Set(found)];
}

function detectCdn(cnameList) {
  const haystack = cnameList.join(' ').toLowerCase();
  for (const c of CDN_HINTS) {
    if (c.patterns.some((re) => re.test(haystack))) return c.name;
  }
  return null;
}

function formatRecordValue(key, value) {
  if (key === 'MX' && value && typeof value === 'object') return `${value.priority} ${value.exchange}`;
  if (key === 'SOA' && value && typeof value === 'object') {
    return `${value.nsname} · ${value.hostmaster} · serial ${value.serial} · refresh ${value.refresh}s`;
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function summarizeRecords(records) {
  const populated = RECORD_TYPES.filter((key) => {
    const v = records[key];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });

  return {
    typesFound: populated.length,
    typesTotal: RECORD_TYPES.length,
    ipv4Count: records.A?.length || 0,
    ipv6Count: records.AAAA?.length || 0,
    dualStack: (records.A?.length || 0) > 0 && (records.AAAA?.length || 0) > 0,
    mxCount: records.MX?.length || 0,
    txtCount: records.TXT?.length || 0,
    nsCount: records.NS?.length || 0,
    hasCname: (records.CNAME?.length || 0) > 0,
  };
}

function buildEmailPosture(records, dmarcLookup, lang) {
  const txtFlat = flattenTxt(records.TXT);
  const spfValue = txtFlat.find((x) => /^v=spf1/i.test(x));
  const spf = spfValue
    ? { present: true, value: spfValue, issues: analyzeSpf(spfValue, lang) }
    : { present: false, value: null, issues: [] };

  const dmarc = dmarcLookup.present
    ? { present: true, host: dmarcLookup.host, value: dmarcLookup.value, policy: dmarcLookup.policy, records: dmarcLookup.records }
    : { present: false, host: dmarcLookup.host, value: null, policy: null, records: [] };

  return {
    hasMx: (records.MX?.length || 0) > 0,
    mx: [...(records.MX || [])].sort((a, b) => a.priority - b.priority),
    spf,
    dmarc,
    txtAnalysis: txtFlat.map((text) => ({ text: text.length > 160 ? text.slice(0, 160) + '…' : text, ...classifyTxtRecord(text, lang) })),
  };
}

function buildFindings(summary, email, infra, hiddenAddresses, lang) {
  const findings = [];
  const push = (f) => findings.push(f);

  if (summary.ipv4Count === 0 && summary.ipv6Count === 0 && !summary.hasCname) {
    push({
      severity: 'medium',
      title: t(lang, 'Nessun indirizzo IP per il nome'),
      detail: t(lang, 'Mancano i record A e AAAA: il nome non punta a un server web. Può essere voluto (dominio solo per la posta) o un errore di configurazione.'),
      module: 'resolution',
    });
  }

  if (hiddenAddresses > 0) {
    push({
      severity: 'low',
      title: t(lang, 'Il DNS pubblico espone indirizzi interni'),
      detail: t(lang, '{n} indirizzi di reti private o riservate sono pubblicati nei record: rivelano informazioni sulla rete interna (non vengono mostrati qui).', { n: hiddenAddresses }),
      module: 'resolution',
      recommendation: t(lang, 'Pubblica gli indirizzi interni solo nel DNS interno (split-horizon).'),
    });
  }

  if (email.hasMx && !email.spf.present) {
    push({
      severity: 'medium',
      title: t(lang, 'Posta attiva senza SPF'),
      detail: t(lang, 'Ci sono record MX ma nessun record TXT «v=spf1»: chiunque può spacciarsi più facilmente per il dominio (spoofing).'),
      module: 'email',
      recommendation: t(lang, 'Pubblica un record SPF che elenchi i server autorizzati e termini con -all o ~all.'),
    });
  }

  if (email.hasMx && !email.dmarc.present) {
    push({
      severity: 'medium',
      title: t(lang, 'Posta attiva senza DMARC'),
      detail: t(lang, 'Nessun record DMARC su {host}: chi riceve la posta non sa come trattare i messaggi falsificati.', { host: email.dmarc.host }),
      module: 'email',
      recommendation: t(lang, 'Aggiungi un record TXT su _dmarc con policy p=quarantine o p=reject (si può partire da p=none per raccogliere i report).'),
    });
  }

  if (email.dmarc.present && email.dmarc.policy === 'none') {
    push({
      severity: 'low',
      title: t(lang, 'DMARC solo in monitoraggio (p=none)'),
      detail: t(lang, 'La policy raccoglie i report ma non chiede di mettere in quarantena o rifiutare i messaggi falsificati.'),
      module: 'email',
    });
  }

  for (const issue of email.spf.issues || []) {
    push({ ...issue, module: 'email', recommendation: t(lang, 'Rivedi il record SPF.') });
  }

  if (summary.nsCount === 1) {
    push({
      severity: 'low',
      title: t(lang, 'Un solo name server'),
      detail: t(lang, 'Con un solo NS, se quel server non risponde il dominio sparisce da Internet. Le buone pratiche (RFC 2182) chiedono almeno due name server su reti diverse.'),
      module: 'infra',
    });
  }

  if (infra.cdn) {
    push({
      severity: 'info',
      title: t(lang, 'Probabile CDN: {cdn}', { cdn: infra.cdn }),
      detail: t(lang, 'Dedotto dal record CNAME: gli indirizzi IP sono quelli della CDN, non del server di origine.'),
      module: 'infra',
    });
  }

  if (!findings.length) {
    push({
      severity: 'info',
      title: t(lang, 'Configurazione DNS coerente'),
      detail: t(lang, 'Nessun problema rilevato nei controlli eseguiti.'),
      module: 'summary',
    });
  }

  return findings;
}

function computeScore(summary, email, lang) {
  const breakdown = [];
  let score = 100;

  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity });
  };

  if (summary.ipv4Count === 0 && summary.ipv6Count === 0 && !summary.hasCname) add('no_a', t(lang, 'Nessun record A/AAAA'), -20, 'medium');
  if (email.hasMx && !email.spf.present) add('no_spf', t(lang, 'Posta senza SPF'), -12, 'medium');
  if (email.hasMx && !email.dmarc.present) add('no_dmarc', t(lang, 'Posta senza DMARC'), -10, 'medium');
  if (email.dmarc.present && email.dmarc.policy === 'none') add('dmarc_none', t(lang, 'DMARC p=none'), -4, 'low');
  for (const issue of email.spf.issues || []) {
    const delta = issue.severity === 'high' ? -15 : issue.severity === 'medium' ? -8 : -3;
    add(issue.id, issue.title, delta, issue.severity);
  }
  if (summary.nsCount === 1) add('single_ns', t(lang, 'Un solo name server'), -3, 'low');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';
  return { score, grade, breakdown };
}

async function enumerateRecords(domain, lang) {
  const [rawA, rawAAAA, MX, NS, TXT, CNAME, SOA, dmarcLookup] = await Promise.all([
    safeResolve(() => dns.resolve4(domain), []),
    safeResolve(() => dns.resolve6(domain), []),
    safeResolve(() => dns.resolveMx(domain), []),
    safeResolve(() => dns.resolveNs(domain), []),
    safeResolve(() => dns.resolveTxt(domain), []),
    safeResolve(() => dns.resolveCname(domain), []),
    safeResolve(() => dns.resolveSoa(domain), null),
    lookupDmarc(domain),
  ]);

  // Indirizzi non pubblici: contati ma non mostrati (S-12)
  const v4 = splitPublicAddresses(rawA);
  const v6 = splitPublicAddresses(rawAAAA);
  const hiddenAddresses = v4.hidden + v6.hidden;
  const A = v4.shown;
  const AAAA = v6.shown;

  const records = { A, AAAA, MX, NS, TXT, CNAME, SOA };
  const summary = summarizeRecords(records);
  summary.hiddenAddresses = hiddenAddresses;
  const email = buildEmailPosture(records, dmarcLookup, lang);

  const ptr = A[0] ? await reversePtr(A[0]) : null;
  const infra = {
    providers: detectProviders(NS),
    cdn: detectCdn(CNAME),
    ptr,
    primaryIpv4: A[0] || null,
  };

  const findings = buildFindings(summary, email, infra, hiddenAddresses, lang);
  const scoring = computeScore(summary, email, lang);

  const recordSections = RECORD_TYPES.map((key) => {
    const raw = records[key];
    let values = [];
    if (raw == null) values = [];
    else if (Array.isArray(raw)) {
      values = key === 'TXT'
        ? flattenTxt(raw).map((text) => ({ text, ...classifyTxtRecord(text, lang) }))
        : raw.map((v) => formatRecordValue(key, v));
    } else {
      values = [formatRecordValue(key, raw)];
    }
    return { key, label: key, title: recordTitle(lang, key), count: values.length, values, empty: !values.length };
  });

  return {
    domain,
    timestamp: new Date().toISOString(),
    records,
    recordSections,
    summary,
    email,
    infra,
    findings,
    ...scoring,
    scoreBreakdown: scoring.breakdown,
    limitations: auditLimitations(lang),
    note: t(lang, 'Lettura passiva dei record DNS pubblici, con controllo di SPF e DMARC e riconoscimento di provider DNS e CDN.'),
    scanType: 'dns_enumeration',
    status: 'success',
  };
}

async function runDnsEnumeration(inputDomain, lang) {
  const domain = normalizeToolDomain(inputDomain, lang);
  const started = Date.now();
  const result = await enumerateRecords(domain, lang);
  result.scanDurationMs = Date.now() - started;
  return result;
}

module.exports = { runDnsEnumeration, normalizeDomain, analyzeSpf, extractDmarcPolicy };

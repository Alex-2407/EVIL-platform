/**
 * EVIL DNS Records Enumerator — risoluzione + analisi passiva
 */
const dns = require('dns').promises;

const RECORD_TYPES = [
  { key: 'A', label: 'A', title: 'Indirizzi IPv4', icon: 'ipv4' },
  { key: 'AAAA', label: 'AAAA', title: 'Indirizzi IPv6', icon: 'ipv6' },
  { key: 'MX', label: 'MX', title: 'Mail exchange', icon: 'mail' },
  { key: 'NS', label: 'NS', title: 'Name server', icon: 'ns' },
  { key: 'TXT', label: 'TXT', title: 'Record testuali', icon: 'txt' },
  { key: 'CNAME', label: 'CNAME', title: 'Alias canonico', icon: 'cname' },
  { key: 'SOA', label: 'SOA', title: 'Start of authority', icon: 'soa' }
];

const PROVIDER_HINTS = [
  { id: 'cloudflare', name: 'Cloudflare', patterns: [/cloudflare/i, /\.ns\.cloudflare\.com$/i] },
  { id: 'aws', name: 'Amazon Route 53', patterns: [/awsdns/i, /amazonaws/i] },
  { id: 'google', name: 'Google Cloud DNS', patterns: [/googledomains/i, /google\.com$/i] },
  { id: 'azure', name: 'Microsoft Azure DNS', patterns: [/azure/i, /microsoft/i] },
  { id: 'ovh', name: 'OVH', patterns: [/ovh/i] },
  { id: 'godaddy', name: 'GoDaddy', patterns: [/domaincontrol\.com/i, /godaddy/i] }
];

const CDN_HINTS = [
  { name: 'Cloudflare', patterns: [/cloudflare/i] },
  { name: 'Fastly', patterns: [/fastly/i] },
  { name: 'Akamai', patterns: [/akamai/i, /edgesuite/i] },
  { name: 'AWS CloudFront', patterns: [/cloudfront/i] },
  { name: 'Azure CDN', patterns: [/azureedge/i] }
];

const AUDIT_LIMITATIONS = [
  'Risolve record pubblici del dominio inserito — non effettua zone transfer (AXFR) né brute-force sottodomini.',
  'SPF/DMARC sono inferiti da TXT e _dmarc; non verifica consegna email né reputation IP.',
  'WHOIS dipende dal comando di sistema e dalla registry — può essere incompleto o assente.',
  'Non sostituisce un audit infrastrutturale completo (firewall, TLS, applicazione).'
];

function normalizeDomain(input) {
  let d = String(input || '').trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/\.$/, '');
  if (!d || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+\.?$/i.test(d)) {
    throw new Error('Formato dominio non valido');
  }
  return d.replace(/\.$/, '');
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

function classifyTxtRecord(text) {
  const t = String(text);
  if (/^v=spf1/i.test(t)) return { kind: 'spf', label: 'SPF' };
  if (/^v=DMARC1/i.test(t)) return { kind: 'dmarc', label: 'DMARC' };
  if (/google-site-verification|facebook-domain-verification|ms=|apple-domain-verification/i.test(t)) {
    return { kind: 'verification', label: 'Verifica dominio' };
  }
  if (/^v=DKIM1/i.test(t) || /dkim/i.test(t)) return { kind: 'dkim', label: 'DKIM' };
  return { kind: 'other', label: 'Generico' };
}

function analyzeSpf(spf) {
  const issues = [];
  if (/\+all/i.test(spf)) {
    issues.push({ severity: 'high', title: 'SPF permissivo (+all)', detail: 'Qualsiasi server può inviare mail per il dominio.' });
  } else if (/\?all/i.test(spf)) {
    issues.push({ severity: 'medium', title: 'SPF neutro (?all)', detail: 'Protezione anti-spoofing debole.' });
  } else if (/\~all/i.test(spf)) {
    issues.push({ severity: 'low', title: 'SPF soft fail (~all)', detail: 'Accettabile; preferibile -all in produzione.' });
  }
  if (/include:[^;]+/gi.test(spf) && spf.split('include:').length > 6) {
    issues.push({ severity: 'low', title: 'SPF con molti include', detail: 'Catena SPF lunga — rischio lookup DNS >10.' });
  }
  return issues;
}

function extractDmarcPolicy(txt) {
  const m = String(txt).match(/;\s*p=([^;\s]+)/i);
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
      value: policy || records[0] || null
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

function detectProviders(nsList, cnameList) {
  const haystack = [...nsList, ...cnameList].join(' ').toLowerCase();
  const found = [];
  for (const p of PROVIDER_HINTS) {
    if (p.patterns.some((re) => re.test(haystack))) found.push(p.name);
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
  if (key === 'MX' && value && typeof value === 'object') {
    return `${value.priority} ${value.exchange}`;
  }
  if (key === 'SOA' && value && typeof value === 'object') {
    return `${value.nsname} · serial ${value.serial} · refresh ${value.refresh}s`;
  }
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function summarizeRecords(records) {
  const populated = RECORD_TYPES.filter(({ key }) => {
    const v = records[key];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).map((t) => t.key);

  return {
    typesFound: populated.length,
    typesTotal: RECORD_TYPES.length,
    ipv4Count: records.A?.length || 0,
    ipv6Count: records.AAAA?.length || 0,
    dualStack: (records.A?.length || 0) > 0 && (records.AAAA?.length || 0) > 0,
    mxCount: records.MX?.length || 0,
    txtCount: records.TXT?.length || 0,
    nsCount: records.NS?.length || 0,
    hasCname: (records.CNAME?.length || 0) > 0
  };
}

function buildEmailPosture(records, dmarcLookup) {
  const txtFlat = flattenTxt(records.TXT);
  const spfValue = txtFlat.find((t) => /^v=spf1/i.test(t));
  const spf = spfValue
    ? { present: true, value: spfValue, issues: analyzeSpf(spfValue) }
    : { present: false, value: null, issues: [] };

  const dmarc = dmarcLookup.present
    ? {
        present: true,
        host: dmarcLookup.host,
        value: dmarcLookup.value,
        policy: dmarcLookup.policy,
        records: dmarcLookup.records
      }
    : { present: false, host: dmarcLookup.host, value: null, policy: null, records: [] };

  const txtAnalysis = txtFlat.map((text) => ({
    text: text.length > 160 ? text.slice(0, 160) + '…' : text,
    ...classifyTxtRecord(text)
  }));

  return {
    hasMx: (records.MX?.length || 0) > 0,
    mx: [...(records.MX || [])].sort((a, b) => a.priority - b.priority),
    spf,
    dmarc,
    txtAnalysis
  };
}

function buildFindings(records, summary, email, infra) {
  const findings = [];

  if (summary.ipv4Count === 0 && summary.ipv6Count === 0) {
    findings.push({
      severity: 'high',
      title: 'Dominio non risolvibile (A/AAAA)',
      detail: 'Nessun record IPv4/IPv6 — il nome potrebbe essere inattivo o errato.',
      module: 'resolution'
    });
  }

  if (email.hasMx && !email.spf.present) {
    findings.push({
      severity: 'medium',
      title: 'Posta attiva senza SPF',
      detail: 'Record MX presenti ma nessun v=spf1 in TXT — rischio spoofing email.',
      module: 'email',
      recommendation: 'Pubblica un record SPF con meccanismo -all o ~all appropriato.'
    });
  }

  if (email.hasMx && !email.dmarc.present) {
    findings.push({
      severity: 'medium',
      title: 'Posta attiva senza DMARC',
      detail: `Nessun record DMARC su ${email.dmarc.host}.`,
      module: 'email',
      recommendation: 'Aggiungi TXT su _dmarc con policy p=quarantine o p=reject.'
    });
  }

  if (email.dmarc.present && email.dmarc.policy === 'none') {
    findings.push({
      severity: 'low',
      title: 'DMARC in monitoraggio (p=none)',
      detail: 'La policy non applica ancora quarantena/rifiuto.',
      module: 'email'
    });
  }

  for (const issue of email.spf.issues || []) {
    findings.push({ ...issue, module: 'email', recommendation: 'Rivedi la policy SPF.' });
  }

  if (summary.nsCount === 1) {
    findings.push({
      severity: 'low',
      title: 'Singolo name server',
      detail: 'Un solo NS riduce la resilienza DNS.',
      module: 'infra'
    });
  }

  if (infra.cdn) {
    findings.push({
      severity: 'info',
      title: `Possibile CDN: ${infra.cdn}`,
      detail: 'Rilevato da CNAME — utile per mappare la superficie.',
      module: 'infra'
    });
  }

  if (!findings.length) {
    findings.push({
      severity: 'info',
      title: 'Profilo DNS coerente',
      detail: 'Nessun gap prioritario sui controlli configurati.',
      module: 'summary'
    });
  }

  return findings;
}

function computeScore(findings, summary, email) {
  const breakdown = [];
  let score = 100;

  const add = (id, label, delta, severity) => {
    score += delta;
    breakdown.push({ id, label, delta, severity });
  };

  if (summary.ipv4Count === 0 && summary.ipv6Count === 0) add('no_a', 'Nessun A/AAAA', -35, 'high');
  if (email.hasMx && !email.spf.present) add('no_spf', 'MX senza SPF', -12, 'medium');
  if (email.hasMx && !email.dmarc.present) add('no_dmarc', 'MX senza DMARC', -10, 'medium');
  if (email.dmarc.present && email.dmarc.policy === 'none') add('dmarc_none', 'DMARC p=none', -4, 'low');
  for (const issue of email.spf.issues || []) {
    if (issue.severity === 'high') add('spf_permissive', issue.title, -15, 'high');
    else if (issue.severity === 'medium') add('spf_weak', issue.title, -8, 'medium');
    else add('spf_note', issue.title, -3, 'low');
  }
  if (summary.nsCount === 1) add('single_ns', 'Singolo NS', -3, 'low');

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 55 ? 'D' : 'F';

  return { score, grade, breakdown };
}

async function enumerateRecords(domain) {
  const [A, AAAA, MX, NS, TXT, CNAME, SOA, dmarcLookup] = await Promise.all([
    safeResolve(() => dns.resolve4(domain), []),
    safeResolve(() => dns.resolve6(domain), []),
    safeResolve(() => dns.resolveMx(domain), []),
    safeResolve(() => dns.resolveNs(domain), []),
    safeResolve(() => dns.resolveTxt(domain), []),
    safeResolve(() => dns.resolveCname(domain), []),
    safeResolve(() => dns.resolveSoa(domain), null),
    lookupDmarc(domain)
  ]);

  const records = { A, AAAA, MX, NS, TXT, CNAME, SOA };
  const summary = summarizeRecords(records);
  const email = buildEmailPosture(records, dmarcLookup);

  const ptr = A[0] ? await reversePtr(A[0]) : null;
  const infra = {
    providers: detectProviders(NS, CNAME),
    cdn: detectCdn(CNAME),
    ptr,
    primaryIpv4: A[0] || null
  };

  const findings = buildFindings(records, summary, email, infra);
  const scoring = computeScore(findings, summary, email);

  const recordSections = RECORD_TYPES.map(({ key, label, title }) => {
    const raw = records[key];
    let values = [];
    if (raw == null) values = [];
    else if (Array.isArray(raw)) {
      values = key === 'TXT'
        ? flattenTxt(raw).map((text) => ({ text, ...classifyTxtRecord(text) }))
        : raw.map((v) => formatRecordValue(key, v));
    } else if (key === 'SOA') {
      values = [formatRecordValue(key, raw)];
    } else {
      values = [formatRecordValue(key, raw)];
    }
    return { key, label, title, count: Array.isArray(values) ? values.length : values ? 1 : 0, values, empty: !values.length };
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
    limitations: AUDIT_LIMITATIONS,
    note: 'Enumerazione DNS passiva con analisi SPF/DMARC e fingerprint infrastruttura.',
    scanType: 'dns_enumeration',
    status: 'success'
  };
}

async function runDnsEnumeration(inputDomain) {
  const domain = normalizeDomain(inputDomain);
  const started = Date.now();
  const result = await enumerateRecords(domain);
  result.scanDurationMs = Date.now() - started;
  return result;
}

module.exports = { runDnsEnumeration, normalizeDomain };

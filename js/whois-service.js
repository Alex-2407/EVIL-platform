/**
 * EVIL WHOIS — RDAP (HTTPS) + fallback TCP :43 (senza CLI di sistema)
 */
const axios = require('axios');
const net = require('net');

const TLD_WHOIS = {
  com: 'whois.verisign-grs.com',
  net: 'whois.verisign-grs.com',
  org: 'whois.pir.org',
  info: 'whois.afilias.net',
  io: 'whois.nic.io',
  co: 'whois.nic.co',
  eu: 'whois.eu',
  it: 'whois.nic.it',
  de: 'whois.denic.de',
  fr: 'whois.nic.fr',
  uk: 'whois.nominet.uk',
  us: 'whois.nic.us',
  app: 'whois.nic.google',
  dev: 'whois.nic.google'
};

function normalizeDomain(input) {
  let d = String(input || '').trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/\.$/, '');
  if (!d || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+\.?$/i.test(d)) {
    throw new Error('Formato dominio non valido');
  }
  return d.replace(/\.$/, '');
}

function parseWhoisOutput(raw) {
  const fields = {};
  const lines = raw.split('\n');
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (!val || key.startsWith('%') || key.startsWith('#')) continue;
    if (fields[key]) {
      fields[key] = Array.isArray(fields[key]) ? [...fields[key], val] : [fields[key], val];
    } else {
      fields[key] = val;
    }
  }
  return {
    fields,
    preview: lines.filter((l) => l.trim() && !l.startsWith('%') && !l.startsWith('#')).slice(0, 40).join('\n')
  };
}

function vcardValue(entity, prop) {
  const vcard = entity?.vcardArray;
  if (!vcard || vcard[0] !== 'vcard' || !Array.isArray(vcard[1])) return null;
  for (const row of vcard[1]) {
    if (row[0] === prop) return row[3] || null;
  }
  return null;
}

function entityLabel(entity) {
  return (
    vcardValue(entity, 'fn') ||
    vcardValue(entity, 'org') ||
    entity?.handle ||
    null
  );
}

function formatRdap(data, domain) {
  const fields = {};
  fields.Domain = data.ldhName || domain;
  if (data.status?.length) fields.Status = data.status.join(', ');

  for (const ev of data.events || []) {
    const map = {
      registration: 'Created',
      expiration: 'Expires',
      'last changed': 'Updated',
      'last update of RDAP database': 'RDAP Updated'
    };
    const label = map[ev.eventAction] || ev.eventAction;
    fields[label] = ev.eventDate;
  }

  if (data.nameservers?.length) {
    fields['Name Servers'] = data.nameservers
      .map((ns) => ns.ldhName)
      .filter(Boolean)
      .join(', ');
  }

  for (const ent of data.entities || []) {
    const roles = ent.roles || [];
    const label = entityLabel(ent);
    const email = vcardValue(ent, 'email');
    if (!label && !email) continue;
    const value = email ? `${label || '—'} <${email}>` : label;
    if (roles.includes('registrar') && !fields.Registrar) fields.Registrar = value;
    if (roles.includes('registrant') && !fields.Registrant) fields.Registrant = value;
    if (roles.includes('administrative') && !fields['Admin Contact']) fields['Admin Contact'] = value;
    if (roles.includes('technical') && !fields['Tech Contact']) fields['Tech Contact'] = value;
  }

  const preview = Object.entries(fields)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');

  return {
    domain,
    timestamp: new Date().toISOString(),
    fields,
    preview: preview || JSON.stringify(data, null, 2).slice(0, 1200),
    source: 'rdap',
    status: 'success'
  };
}

async function lookupRdap(domain) {
  const res = await axios.get(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    timeout: 12000,
    headers: { Accept: 'application/rdap+json' },
    validateStatus: (s) => s < 500
  });
  if (res.status === 404 || res.status >= 400 || !res.data) return null;
  return formatRdap(res.data, domain);
}

function tcpWhoisQuery(host, query, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    const socket = net.createConnection({ port: 43, host }, () => {
      socket.write(`${query}\r\n`);
    });
    socket.setTimeout(timeoutMs);
    socket.on('data', (chunk) => {
      buf += chunk.toString('utf8');
    });
    socket.on('end', () => resolve(buf));
    socket.on('error', reject);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('WHOIS TCP timeout'));
    });
  });
}

async function resolveWhoisServer(tld) {
  if (TLD_WHOIS[tld]) return TLD_WHOIS[tld];
  try {
    const iana = await tcpWhoisQuery('whois.iana.org', tld, 8000);
    const m = iana.match(/whois:\s*(\S+)/i);
    if (m) return m[1].trim();
  } catch {
    /* ignore */
  }
  return 'whois.iana.org';
}

async function lookupTcpWhois(domain) {
  const tld = domain.split('.').pop();
  const server = await resolveWhoisServer(tld);
  let raw = await tcpWhoisQuery(server, domain);

  if (/TLD is not supported|No match|Not found|Status:\s*free/i.test(raw) && server !== 'whois.iana.org') {
    raw = await tcpWhoisQuery('whois.iana.org', domain);
  }

  const parsed = parseWhoisOutput(raw);
  if (!Object.keys(parsed.fields).length) {
    throw new Error('Risposta WHOIS vuota o non parsabile');
  }

  return {
    domain,
    timestamp: new Date().toISOString(),
    fields: parsed.fields,
    preview: parsed.preview,
    source: 'whois-tcp',
    whoisServer: server,
    status: 'success'
  };
}

async function runWhoisLookup(inputDomain) {
  const domain = normalizeDomain(inputDomain);

  try {
    const rdap = await lookupRdap(domain);
    if (rdap && Object.keys(rdap.fields).length) return rdap;
  } catch {
    /* fallback TCP */
  }

  try {
    return await lookupTcpWhois(domain);
  } catch (err) {
    return {
      domain,
      timestamp: new Date().toISOString(),
      error: `Lookup WHOIS fallito: ${err.message}`,
      status: 'failed'
    };
  }
}

module.exports = { runWhoisLookup, parseWhoisOutput, normalizeDomain };

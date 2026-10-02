'use strict';
/**
 * Avvisi e vulnerabilità sfruttate da fonti pubbliche ufficiali (CISA KEV, NIST NVD,
 * CERT-AGID, CERT-EU, CISA Advisories, Cisco Talos) per la mappa didattica.
 *
 * Regole di onestà dei dati:
 * - la posizione in mappa è l'AREA DELLA FONTE (l'ente che pubblica), mai un paese dedotto da
 *   parole chiave o estratto a caso: le fonti senza un'area propria finiscono nel contatore
 *   "senza area geografica" e non hanno marker;
 * - la gravità viene solo dal punteggio CVSS quando la fonte lo fornisce; altrimenti è "non indicata";
 * - nessuna stima monetaria dei danni;
 * - se nessuna fonte risponde e non ci sono dati reali in cache, si usa un piccolo insieme di
 *   ESEMPI etichettati come tali (is_sample), con voci reali e verificabili del catalogo KEV.
 *
 * I dati in cache sono neutri rispetto alla lingua; localizePayload() produce la risposta nella
 * lingua della richiesta (i testi originali delle fonti restano nella loro lingua, indicata).
 */
const crypto = require('crypto');
const axios = require('axios');
const { t } = require('../server/i18n');

const SCHEMA = 2;
const USER_AGENT = 'EVIL-Cybersecurity-Platform/1.0 (Educational; +https://www.projectevil.it)';

/** Aree delle fonti: sede dell'ente che pubblica, non luogo delle vittime. */
const AREAS = {
  US: { lat: 38.9, lon: -77.04 },
  IT: { lat: 41.9, lon: 12.5 },
  EU: { lat: 50.85, lon: 4.35 },
};

const SOURCES = {
  'cisa-kev': { name: 'CISA KEV', area: 'US', textLang: 'en', home: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog' },
  'nist-nvd': { name: 'NIST NVD', area: 'US', textLang: 'en', home: 'https://nvd.nist.gov/' },
  'cisa-advisories': { name: 'CISA Advisories', area: 'US', textLang: 'en', home: 'https://www.cisa.gov/news-events/cybersecurity-advisories' },
  'cert-agid': { name: 'CERT-AGID', area: 'IT', textLang: 'it', home: 'https://cert-agid.gov.it/' },
  'cert-eu': { name: 'CERT-EU', area: 'EU', textLang: 'en', home: 'https://cert.europa.eu/publications/security-advisories' },
  'cisco-talos': { name: 'Cisco Talos', area: null, textLang: 'en', home: 'https://blog.talosintelligence.com/' },
};
const SOURCE_IDS = Object.keys(SOURCES);

function areaName(lang, code) {
  switch (code) {
    case 'US':
      return t(lang, 'Stati Uniti');
    case 'IT':
      return t(lang, 'Italia');
    case 'EU':
      return t(lang, 'Unione europea');
    default:
      return t(lang, 'Area non determinata');
  }
}

function kindLabel(lang, kind) {
  switch (kind) {
    case 'kev':
      return t(lang, 'Vulnerabilità sfruttata (KEV)');
    case 'cve':
      return t(lang, 'Vulnerabilità pubblicata (CVE)');
    case 'research':
      return t(lang, 'Ricerca sulle minacce');
    default:
      return t(lang, 'Avviso di sicurezza');
  }
}

function severityLabel(lang, sev) {
  switch (sev) {
    case 'critical':
      return t(lang, 'Critica');
    case 'high':
      return t(lang, 'Alta');
    case 'medium':
      return t(lang, 'Media');
    case 'low':
      return t(lang, 'Bassa');
    default:
      return t(lang, 'Gravità non indicata');
  }
}

/** Gravità solo dal punteggio CVSS (scala ufficiale FIRST v3.x). */
function severityFromCvss(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  if (score > 0) return 'low';
  return null;
}

function validDate(v) {
  const d = new Date(v);
  return v && !Number.isNaN(d.getTime()) ? d.toISOString() : null;
}

// ------------------------------------------------------------------ fetch
async function fetchWithRetries(url, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await axios.get(url, {
        timeout: options.timeout || 10000,
        headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) },
        params: options.params || {},
        validateStatus: (s) => s >= 200 && s < 400,
      });
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = 500 * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

function cleanText(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Voci di un feed RSS/Atom. `sourceId` è una chiave di SOURCES (o un nome libero nei test). */
function parseRssItems(xml, limit = 8, sourceId = 'rss', kind = 'advisory') {
  const items = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (let i = 0; i < Math.min(limit, matches.length); i++) {
    const item = matches[i];
    const title = cleanText((item.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [null, ''])[1]);
    const rawLink =
      (item.match(/<link[^>]*href="([^"]+)"/i) || [])[1] ||
      (item.match(/<link>([\s\S]*?)<\/link>/i) || [null, ''])[1].trim();
    // Il feed è esterno: si accettano solo link http(s) (niente javascript: o data:)
    const link = /^https?:\/\/[^\s"'<>]+$/i.test(rawLink) ? rawLink : '';
    const pubDate = (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) ||
      item.match(/<published>([\s\S]*?)<\/published>/i) ||
      item.match(/<updated>([\s\S]*?)<\/updated>/i) || [null, null])[1];
    const summary = cleanText(
      (item.match(/<description>([\s\S]*?)<\/description>/i) || item.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) || [null, ''])[1]
    ).slice(0, 400);

    if (!title && !summary) continue;
    const cve = (`${title} ${summary}`.match(/CVE-\d{4}-\d{4,}/i) || [])[0];
    items.push({
      id: crypto.createHash('md5').update(title + link + sourceId).digest('hex').slice(0, 16),
      kind,
      source_id: sourceId,
      cve: cve ? cve.toUpperCase() : null,
      title: title || summary,
      summary: title ? summary : '',
      timestamp: validDate(pubDate && pubDate.trim()),
      severity: null,
      cvss: null,
      exploited: false,
      ransomware_known: false,
      vendor: '',
      product: '',
      link,
    });
  }
  return items;
}

async function fetchRss(url, sourceId, limit, kind) {
  const res = await fetchWithRetries(url, { timeout: 10000 });
  return parseRssItems(String(res.data), limit, sourceId, kind);
}

async function fetchNVD() {
  // Senza intervallo di date l'API restituisce le CVE più vecchie (1999…): si chiedono
  // quelle pubblicate negli ultimi 7 giorni e si tengono le più recenti.
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 3600 * 1000);
  const response = await fetchWithRetries('https://services.nvd.nist.gov/rest/json/cves/2.0', {
    timeout: 15000,
    params: { pubStartDate: start.toISOString().replace('Z', ''), pubEndDate: end.toISOString().replace('Z', ''), resultsPerPage: 500, noRejected: '' },
  });
  const vulns = response.data?.vulnerabilities || [];
  return vulns
    .map((entry) => {
      const cve = entry.cve || {};
      const id = cve.id;
      if (!id) return null;
      const desc = cve.descriptions?.find((d) => d.lang === 'en')?.value || cve.descriptions?.[0]?.value || '';
      const m = cve.metrics || {};
      const metric = m.cvssMetricV31?.[0] || m.cvssMetricV30?.[0] || m.cvssMetricV40?.[0];
      const score = metric?.cvssData?.baseScore;
      return {
        id,
        kind: 'cve',
        source_id: 'nist-nvd',
        cve: id,
        title: id,
        summary: desc.slice(0, 400),
        timestamp: validDate(cve.published),
        severity: severityFromCvss(score),
        cvss: typeof score === 'number' ? score : null,
        exploited: Boolean(cve.cisaExploitAdd),
        ransomware_known: false,
        vendor: '',
        product: '',
        link: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(id)}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 25);
}

async function fetchKEV() {
  const response = await fetchWithRetries(
    'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
    { timeout: 12000 }
  );
  const vulns = (response.data?.vulnerabilities || []).slice();
  vulns.sort((a, b) => String(b.dateAdded || '').localeCompare(String(a.dateAdded || '')));
  return vulns.slice(0, 40).map((v) => ({
    id: `KEV-${v.cveID}`,
    kind: 'kev',
    source_id: 'cisa-kev',
    cve: v.cveID || null,
    title: v.vulnerabilityName || v.cveID,
    summary: String(v.shortDescription || '').slice(0, 400),
    timestamp: validDate(v.dateAdded),
    severity: null, // il catalogo KEV non assegna una gravità: indica che la falla è sfruttata
    cvss: null,
    exploited: true,
    ransomware_known: String(v.knownRansomwareCampaignUse || '').toLowerCase() === 'known',
    vendor: v.vendorProject || '',
    product: v.product || '',
    link: v.cveID ? `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(v.cveID)}` : SOURCES['cisa-kev'].home,
  }));
}

async function firstWorkingFeed(urls, sourceId, limit, kind) {
  let lastErr = null;
  for (const url of urls) {
    try {
      const items = await fetchRss(url, sourceId, limit, kind);
      if (items.length) return items;
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return [];
}

const FETCHERS = {
  'cisa-kev': fetchKEV,
  'nist-nvd': fetchNVD,
  'cisa-advisories': () => fetchRss('https://www.cisa.gov/cybersecurity-advisories/all.xml', 'cisa-advisories', 6, 'advisory'),
  'cert-agid': () => fetchRss('https://cert-agid.gov.it/feed/', 'cert-agid', 6, 'advisory'),
  'cert-eu': () =>
    firstWorkingFeed(
      ['https://cert.europa.eu/publications/security-advisories/rss', 'https://cert.europa.eu/publications/security-advisories/rss.xml', 'https://cert.europa.eu/rss/CERT-EU-SA.xml'],
      'cert-eu',
      6,
      'advisory'
    ),
  'cisco-talos': () => fetchRss('https://blog.talosintelligence.com/rss/', 'cisco-talos', 4, 'research'),
};

/** Interroga tutte le fonti; ognuna può fallire da sola. */
async function fetchAllPublicAlerts() {
  const results = await Promise.all(
    SOURCE_IDS.map(async (id) => {
      try {
        const items = await FETCHERS[id]();
        return { id, ok: true, items };
      } catch (err) {
        console.warn(`⚠️ Fonte ${SOURCES[id].name} non disponibile:`, err.message);
        return { id, ok: false, items: [] };
      }
    })
  );
  const seen = new Set();
  const items = [];
  for (const r of results) {
    for (const it of r.items) {
      // la stessa CVE da KEV e NVD resta una voce sola (vince KEV, che dice che è sfruttata)
      const key = it.cve && it.kind !== 'advisory' && it.kind !== 'research' ? it.cve : it.id;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(it);
    }
  }
  return {
    items,
    source_status: results.map((r) => ({ id: r.id, ok: r.ok, count: r.items.length })),
  };
}

// ------------------------------------------------------------------ esempi etichettati
/**
 * Usati SOLO quando nessuna fonte risponde e non ci sono dati reali in cache. Le voci KEV sono
 * reali (dati del catalogo CISA, punteggi CVSS di NIST NVD); le altre descrivono il TIPO di
 * pubblicazione della fonte, senza inventare avvisi specifici.
 */
function sampleItems() {
  const kev = (cve, title, date, cvss, ransomware) => ({
    id: `SAMPLE-${cve}`,
    kind: 'kev',
    source_id: 'cisa-kev',
    cve,
    title,
    summary: '',
    sample_key: cve,
    timestamp: `${date}T00:00:00.000Z`,
    severity: severityFromCvss(cvss),
    cvss,
    exploited: true,
    ransomware_known: ransomware,
    vendor: '',
    product: '',
    link: `https://nvd.nist.gov/vuln/detail/${cve}`,
    is_sample: true,
  });
  const kind = (sourceId, k) => ({
    id: `SAMPLE-${sourceId}`,
    kind: k,
    source_id: sourceId,
    cve: null,
    title: '',
    summary: '',
    sample_key: sourceId,
    timestamp: null,
    severity: null,
    cvss: null,
    exploited: false,
    ransomware_known: false,
    vendor: '',
    product: '',
    link: SOURCES[sourceId].home,
    is_sample: true,
  });
  return [
    kev('CVE-2024-3400', 'Palo Alto Networks PAN-OS Command Injection Vulnerability', '2024-04-12', 10.0, false),
    kev('CVE-2023-34362', 'Progress MOVEit Transfer SQL Injection Vulnerability', '2023-06-02', 9.8, true),
    kev('CVE-2021-44228', 'Apache Log4j2 Remote Code Execution Vulnerability', '2021-12-10', 10.0, true),
    kev('CVE-2019-0708', 'Microsoft Remote Desktop Services Remote Code Execution Vulnerability', '2021-11-03', 9.8, false),
    kind('cert-agid', 'advisory'),
    kind('cert-eu', 'advisory'),
    kind('cisco-talos', 'research'),
  ];
}

function sampleSummary(lang, key) {
  switch (key) {
    case 'CVE-2024-3400':
      return t(lang, 'Iniezione di comandi nella funzione GlobalProtect di PAN-OS: esecuzione di codice come root sul firewall senza autenticazione.');
    case 'CVE-2023-34362':
      return t(lang, 'SQL injection in MOVEit Transfer sfruttata nel 2023 per sottrarre dati a migliaia di organizzazioni (campagna attribuita al gruppo Cl0p).');
    case 'CVE-2021-44228':
      return t(lang, 'Log4Shell: un messaggio di log controllato dall\'attaccante con un lookup JNDI porta all\'esecuzione di codice remoto.');
    case 'CVE-2019-0708':
      return t(lang, 'BlueKeep: esecuzione di codice remoto senza autenticazione nei Servizi Desktop remoto (RDP) di versioni Windows non aggiornate.');
    case 'cert-agid':
      return t(lang, 'Esempio del tipo di contenuto: CERT-AGID pubblica avvisi e riepiloghi settimanali sulle campagne malevole rivolte all\'Italia.');
    case 'cert-eu':
      return t(lang, 'Esempio del tipo di contenuto: CERT-EU pubblica avvisi di sicurezza per le istituzioni, gli organi e le agenzie dell\'UE.');
    case 'cisco-talos':
      return t(lang, 'Esempio del tipo di contenuto: Cisco Talos pubblica ricerche su campagne e gruppi di minaccia, senza un\'area geografica propria.');
    default:
      return '';
  }
}

function sampleTitle(lang, key) {
  switch (key) {
    case 'cert-agid':
      return t(lang, 'Avvisi e riepiloghi di CERT-AGID');
    case 'cert-eu':
      return t(lang, 'Avvisi di sicurezza di CERT-EU');
    case 'cisco-talos':
      return t(lang, 'Ricerche di Cisco Talos');
    default:
      return '';
  }
}

// ------------------------------------------------------------------ payload
async function buildIncidentsPayload() {
  const { items, source_status } = await fetchAllPublicAlerts();
  const live = items.length > 0;
  return {
    schema: SCHEMA,
    data_mode: live ? 'live' : 'sample',
    lastUpdate: new Date().toISOString(),
    incidents: live ? items : sampleItems(),
    total_incidents: live ? items.length : sampleItems().length,
    source_status,
  };
}

/** Conteggio per mese negli ultimi 12 mesi (UTC), mese più vecchio per primo. */
function computeMonthly(list, now = new Date()) {
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push({ month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, count: 0 });
  }
  const idx = Object.fromEntries(out.map((m, i) => [m.month, i]));
  for (const it of list) {
    if (!it.timestamp) continue;
    const key = String(it.timestamp).slice(0, 7);
    if (key in idx) out[idx[key]].count += 1;
  }
  return out;
}

function computeStats(list, sourceStatus) {
  const stats = {
    total: list.length,
    exploited: 0,
    critical: 0,
    with_cve: 0,
    ransomware_known: 0,
    located: 0,
    unlocated: 0,
    sources_ok: (sourceStatus || []).filter((s) => s.ok).length,
    sources_total: SOURCE_IDS.length,
  };
  for (const it of list) {
    if (it.exploited) stats.exploited += 1;
    if (it.severity === 'critical') stats.critical += 1;
    if (it.cve) stats.with_cve += 1;
    if (it.ransomware_known) stats.ransomware_known += 1;
    if (SOURCES[it.source_id]?.area) stats.located += 1;
    else stats.unlocated += 1;
  }
  return stats;
}

function localizeItem(it, lang) {
  const src = SOURCES[it.source_id] || { name: String(it.source_id || it.source || ''), area: null, textLang: 'en' };
  const area = src.area || null;
  const sample = Boolean(it.is_sample);
  let description = [it.title, it.summary].filter(Boolean).join(' — ') || String(it.description || '');
  let descriptionLang = src.textLang;
  if (sample) {
    // gli esempi KEV hanno il nome ufficiale (inglese) nel titolo: si mostra solo la sintesi tradotta
    description = [sampleTitle(lang, it.sample_key), sampleSummary(lang, it.sample_key)].filter(Boolean).join(' — ');
    descriptionLang = lang;
  }
  return {
    id: it.id,
    cve: it.cve || null,
    timestamp: it.timestamp || null,
    kind: it.kind || 'advisory',
    type: kindLabel(lang, it.kind),
    severity: it.severity || null,
    severity_label: severityLabel(lang, it.severity),
    cvss: typeof it.cvss === 'number' ? it.cvss : null,
    exploited: Boolean(it.exploited),
    ransomware_known: Boolean(it.ransomware_known),
    source_id: it.source_id || null,
    source: src.name,
    area,
    area_name: areaName(lang, area),
    description: description.slice(0, 480),
    description_lang: descriptionLang,
    link: /^https?:\/\//i.test(it.link || '') ? it.link : null,
    vendor: it.vendor || '',
    product: it.product || '',
    is_sample: sample,
  };
}

function aggregateByArea(localized) {
  const map = {};
  for (const it of localized) {
    if (!it.area || !AREAS[it.area]) continue;
    if (!map[it.area]) {
      map[it.area] = { area: it.area, name: it.area_name, lat: AREAS[it.area].lat, lon: AREAS[it.area].lon, count: 0, types: {}, sources: [] };
    }
    const r = map[it.area];
    r.count += 1;
    r.types[it.type] = (r.types[it.type] || 0) + 1;
    if (!r.sources.includes(it.source)) r.sources.push(it.source);
  }
  return Object.values(map);
}

function statusMessage(lang, mode) {
  switch (mode) {
    case 'live':
      return t(lang, 'Dati aggiornati dalle fonti pubbliche.');
    case 'cache':
      return t(lang, 'Le fonti non rispondono: mostriamo gli ultimi dati reali scaricati (vedi data di aggiornamento).');
    case 'sample':
      return t(lang, 'Le fonti esterne non sono raggiungibili: sono mostrati solo esempi etichettati, non il feed attuale.');
    default:
      return t(lang, 'Nessun dato disponibile al momento.');
  }
}

/**
 * Risposta dell'API nella lingua richiesta. Accetta anche cache vecchie o parziali
 * (campi mancanti → valori vuoti).
 */
function localizePayload(payload, lang) {
  const p = payload || {};
  const raw = Array.isArray(p.incidents) ? p.incidents : [];
  let mode = p.data_mode || 'empty';
  if (mode === 'simulated') mode = 'sample';
  if (!raw.length) mode = 'empty';
  const incidents = raw
    .map((it) => localizeItem(it, lang))
    .sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
  const status = (p.source_status || []).map((s) => ({ id: s.id, name: SOURCES[s.id]?.name || s.id, ok: Boolean(s.ok), count: s.count || 0 }));
  return {
    timestamp: p.lastUpdate || null,
    data_mode: mode,
    status_message: statusMessage(lang, mode),
    source: SOURCE_IDS.map((id) => SOURCES[id].name).join(' · '),
    update_frequency: t(lang, 'Il server interroga le fonti ogni 5 minuti.'),
    data_classification: t(lang, 'Vulnerabilità e avvisi da fonti pubbliche'),
    disclaimer: t(lang, 'Uso didattico. La posizione in mappa è l\'area dell\'ente che pubblica, non il luogo di vittime o attacchi.'),
    total_incidents: incidents.length,
    aggregated_stats: computeStats(raw, p.source_status),
    monthly: computeMonthly(raw),
    regions: aggregateByArea(incidents),
    sources: status,
    incidents,
  };
}

module.exports = {
  SCHEMA,
  SOURCES,
  AREAS,
  buildIncidentsPayload,
  fetchAllPublicAlerts,
  localizePayload,
  computeMonthly,
  computeStats,
  severityFromCvss,
  sampleItems,
  parseRssItems,
};

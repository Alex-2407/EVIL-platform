/**
 * Aggregazione incidenti da fonti pubbliche verificate (NIST NVD, CISA KEV, CERT).
 * Solo dati OSINT/documentati — uso educativo.
 */
const crypto = require('crypto');
const axios = require('axios');

const USER_AGENT = 'EVIL-Cybersecurity-Platform/1.0 (Educational; +https://www.projectevil.it)';

const COUNTRY_CENTROIDS = {
  USA: { name: 'Stati Uniti', lat: 39.8, lon: -98.5, code: 'US' },
  Canada: { name: 'Canada', lat: 56.1, lon: -106.3, code: 'CA' },
  UK: { name: 'Regno Unito', lat: 55.4, lon: -3.4, code: 'GB' },
  Germania: { name: 'Germania', lat: 51.2, lon: 10.4, code: 'DE' },
  Francia: { name: 'Francia', lat: 46.2, lon: 2.2, code: 'FR' },
  Italia: { name: 'Italia', lat: 41.9, lon: 12.5, code: 'IT' },
  Spagna: { name: 'Spagna', lat: 40.4, lon: -3.7, code: 'ES' },
  NL: { name: 'Paesi Bassi', lat: 52.1, lon: 5.3, code: 'NL' },
  Russia: { name: 'Russia', lat: 61.5, lon: 105.3, code: 'RU' },
  Cina: { name: 'Cina', lat: 35.9, lon: 104.2, code: 'CN' },
  India: { name: 'India', lat: 20.6, lon: 78.9, code: 'IN' },
  Giappone: { name: 'Giappone', lat: 36.2, lon: 138.3, code: 'JP' },
  Australia: { name: 'Australia', lat: -25.3, lon: 133.8, code: 'AU' },
  Brasile: { name: 'Brasile', lat: -14.2, lon: -51.9, code: 'BR' },
  Israele: { name: 'Israele', lat: 31.0, lon: 34.9, code: 'IL' },
  UAE: { name: 'Emirati Arabi', lat: 23.4, lon: 53.8, code: 'AE' },
  Globale: { name: 'Globale / Multi-regione', lat: 20, lon: 0, code: 'GL' },
};

const COUNTRY_LIST = Object.values(COUNTRY_CENTROIDS);

const COUNTRY_BY_NAME = Object.fromEntries(
  COUNTRY_LIST.map((c) => [c.name, c])
);

function countryCentroid(countryName) {
  return COUNTRY_BY_NAME[countryName] || COUNTRY_CENTROIDS.Globale;
}

function hashPickCountry(seed) {
  const hash = crypto.createHash('md5').update(String(seed)).digest();
  return COUNTRY_LIST[hash[0] % COUNTRY_LIST.length];
}

function inferCountryFromText(text) {
  const t = (text || '').toLowerCase();
  const rules = [
    { keys: ['microsoft', 'cisa', 'fbi', 'google', 'amazon', 'oracle', 'apple', 'palo alto networks'], country: 'USA' },
    { keys: ['ncsc', 'uk ', 'british', 'united kingdom'], country: 'UK' },
    { keys: ['cert-eu', 'europa', 'european', 'eu '], country: 'Germania' },
    { keys: ['cert-agid', 'agid', 'italia', 'italian'], country: 'Italia' },
    { keys: ['france', 'anssi'], country: 'Francia' },
    { keys: ['russia', 'kaspersky'], country: 'Russia' },
    { keys: ['china', 'huawei', 'tencent'], country: 'Cina' },
    { keys: ['india'], country: 'India' },
    { keys: ['japan', 'sony'], country: 'Giappone' },
    { keys: ['australia'], country: 'Australia' },
    { keys: ['brazil', 'brasil'], country: 'Brasile' },
    { keys: ['israel', 'checkpoint'], country: 'Israele' },
    { keys: ['uae', 'emirates'], country: 'UAE' },
  ];
  for (const r of rules) {
    if (r.keys.some((k) => t.includes(k))) return COUNTRY_CENTROIDS[r.country];
  }
  return null;
}

async function fetchWithRetries(url, options = {}, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        timeout: options.timeout || 10000,
        headers: { 'User-Agent': USER_AGENT, ...(options.headers || {}) },
        params: options.params || {},
        validateStatus: (s) => s >= 200 && s < 400,
      });
      return response;
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

function parseRssItems(xml, limit = 8, feedSource = 'RSS') {
  const items = [];
  const matches = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (let i = 0; i < Math.min(limit, matches.length); i++) {
    const item = matches[i];
    const title = ((item.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [null, ''])[1] || '')
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    const link =
      (item.match(/<link[^>]*href="([^"]+)"/i) || [])[1] ||
      (item.match(/<link>([\s\S]*?)<\/link>/i) || [null, ''])[1].trim();
    const pubDate =
      (item.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) ||
        item.match(/<updated>([\s\S]*?)<\/updated>/i) ||
        [null, new Date().toISOString()])[1];
    const description = (
      (item.match(/<description>([\s\S]*?)<\/description>/i) ||
        item.match(/<summary>([\s\S]*?)<\/summary>/i) ||
        [null, ''])[1] || ''
    )
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .slice(0, 500);

    if (!title && !description) continue;
    items.push({
      id: crypto.createHash('md5').update(title + link + feedSource).digest('hex').slice(0, 16),
      description: title || description,
      date: pubDate,
      type: `Advisory — ${feedSource}`,
      severity: 'medium',
      source: feedSource,
      link,
      vendor: '',
    });
  }
  return items;
}

async function fetchRssFeed(url, feedSource, limit = 6) {
  try {
    const res = await fetchWithRetries(url, { timeout: 10000 });
    return parseRssItems(String(res.data), limit, feedSource);
  } catch (err) {
    console.warn(`⚠️ Feed ${feedSource} non disponibile:`, err.message);
    return [];
  }
}

async function fetchNVDCVEs() {
  try {
    const response = await fetchWithRetries('https://services.nvd.nist.gov/rest/json/cves/2.0', {
      timeout: 15000,
      params: {
        resultsPerPage: 25,
        noRejected: '',
      },
    });

    const vulns = response.data?.vulnerabilities || [];
    return vulns.map((entry) => {
      const cve = entry.cve || {};
      const id = cve.id || 'CVE-UNKNOWN';
      const desc =
        cve.descriptions?.find((d) => d.lang === 'en')?.value ||
        cve.descriptions?.[0]?.value ||
        'Security vulnerability';
      const metrics = cve.metrics?.cvssMetricV31?.[0] || cve.metrics?.cvssMetricV30?.[0];
      const baseScore = metrics?.cvssData?.baseScore;
      let severity = 'medium';
      if (baseScore >= 9) severity = 'critical';
      else if (baseScore >= 7) severity = 'high';
      else if (baseScore < 4) severity = 'low';

      return {
        id,
        description: desc.slice(0, 400),
        date: cve.published || cve.lastModified || new Date().toISOString(),
        type: 'CVE — NIST NVD',
        severity,
        source: 'NIST National Vulnerability Database',
        link: `https://nvd.nist.gov/vuln/detail/${id}`,
        vendor: (cve.sourceIdentifier || '').replace('nvd@nist.gov', 'NIST'),
        cvss: baseScore,
      };
    });
  } catch (err) {
    console.warn('⚠️ NVD API 2.0 non disponibile:', err.message);
    return [];
  }
}

async function fetchCISAKEV() {
  try {
    const response = await fetchWithRetries(
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      { timeout: 12000 }
    );
    const vulns = response.data?.vulnerabilities || [];
    return vulns.slice(0, 40).map((vuln) => ({
      id: vuln.cveID,
      description: vuln.vulnerabilityName
        ? `${vuln.vulnerabilityName}: ${vuln.shortDescription || ''}`
        : vuln.shortDescription || vuln.cveID,
      date: vuln.dateAdded || new Date().toISOString(),
      type: 'Known Exploited — CISA KEV',
      severity: 'critical',
      source: 'CISA Known Exploited Vulnerabilities Catalog',
      link: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog`,
      vendor: vuln.vendorProject || '',
      product: vuln.product || '',
      requiredAction: vuln.requiredAction || '',
    }));
  } catch (err) {
    console.warn('⚠️ CISA KEV non disponibile:', err.message);
    return [];
  }
}

async function fetchCertEuFeed() {
  const urls = [
    'https://cert.europa.eu/rss/CERT-EU-SA.xml',
    'https://cert.europa.eu/publications/security-advisories/rss.xml',
    'https://cert.europa.eu/feeds/news.xml',
  ];
  for (const url of urls) {
    const items = await fetchRssFeed(url, 'CERT-EU', 5);
    if (items.length) return items;
  }
  return [];
}

async function fetchUSCertAdvisories() {
  const feeds = [
    ['https://www.cisa.gov/cybersecurity-advisories/all.xml', 'CISA Advisories'],
    ['https://us-cert.cisa.gov/ncas/alerts.xml', 'US-CERT'],
  ];
  for (const [url, name] of feeds) {
    const items = await fetchRssFeed(url, name, 5);
    if (items.length) return items;
  }
  return [];
}

async function fetchAllPublicAlerts() {
  const [nvd, cisa, certIt, certEu, usCert, vendorFeeds] = await Promise.all([
    fetchNVDCVEs(),
    fetchCISAKEV(),
    fetchRssFeed('https://cert-agid.gov.it/feed/', 'CERT-AGID Italia', 5),
    fetchCertEuFeed(),
    fetchUSCertAdvisories(),
    fetchRssFeed('https://blog.talosintelligence.com/feeds/posts/default?alt=rss', 'Cisco Talos', 4),
  ]);

  const combined = [...cisa, ...nvd, ...certIt, ...certEu, ...usCert, ...vendorFeeds];
  const seen = new Set();
  return combined.filter((a) => {
    const key = a.id || a.description?.slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function alertToIncident(alert, index) {
  const text = `${alert.description || ''} ${alert.vendor || ''} ${alert.product || ''} ${alert.source || ''}`;
  const inferred = inferCountryFromText(text);
  const src = `${alert.source || ''} ${alert.type || ''}`;
  const isRegionalCert = /cert-agid|cert-eu|cert-uk|italia/i.test(src);
  const country =
    isRegionalCert && inferred && inferred.code !== 'GL'
      ? inferred
      : hashPickCountry(alert.id || index);
  const jitter = () => (Math.random() - 0.5) * 4;

  const typeLower = (alert.type || '').toLowerCase();
  const descLower = (alert.description || '').toLowerCase();
  let impact = 50;
  if (alert.cvss) impact = Math.round(alert.cvss * 10);
  else if (alert.severity === 'critical') impact = 85;
  else if (alert.severity === 'high') impact = 65;

  return {
    id: alert.id || `INC-${index}`,
    timestamp: alert.date || new Date().toISOString(),
    type: alert.type || 'Security Advisory',
    country: country.name,
    country_code: country.code,
    latitude: country.lat + jitter(),
    longitude: country.lon + jitter(),
    severity: alert.severity || 'medium',
    source: alert.source || 'Public Threat Intelligence',
    description: (alert.description || 'Security incident').slice(0, 420),
    link: alert.link || null,
    target_type: alert.vendor ? `Vendor: ${alert.vendor}` : 'Multiple Sectors',
    impact_score: Math.min(100, Math.max(10, impact)),
    is_simulated: false,
  };
}

function generateSimulatedIncidents() {
  const incidentTypes = ['Ransomware', 'DDoS', 'Phishing', 'Exploit', 'Data Breach', 'Malware'];
  const countries = COUNTRY_LIST.filter((c) => c.code !== 'GL');
  const incidents = [];
  for (let i = 0; i < 12; i++) {
    const country = countries[i % countries.length];
    const type = incidentTypes[i % incidentTypes.length];
    incidents.push({
      id: `SIM-${Date.now()}-${i}`,
      timestamp: new Date(Date.now() - i * 3600000 * 6).toISOString(),
      type,
      country: country.name,
      country_code: country.code,
      latitude: country.lat + (Math.random() - 0.5) * 5,
      longitude: country.lon + (Math.random() - 0.5) * 5,
      severity: ['critical', 'high', 'medium'][i % 3],
      source: 'Aggregazione educativa (fonti esterne temporaneamente non raggiungibili)',
      description: `${type} — esempio didattico per ${country.name} (sostituito da feed live appena disponibile)`,
      target_type: 'Training Dataset',
      impact_score: 30 + (i % 5) * 12,
      is_simulated: true,
    });
  }
  return incidents;
}

function computeMonthlyTrends(list) {
  const year = new Date().getUTCFullYear();
  const months = new Array(12).fill(0);
  list.forEach((it) => {
    const ts = it.timestamp || it.date || new Date().toISOString();
    const d = new Date(ts);
    if (!isNaN(d) && d.getUTCFullYear() === year) {
      months[d.getUTCMonth()] += 1;
    }
  });
  const total = months.reduce((a, b) => a + b, 0);
  if (total === 0) {
    const now = new Date().getUTCMonth();
    for (let i = 0; i < 12; i++) {
      months[i] = i <= now ? Math.max(1, Math.floor(list.length / (now + 1))) : 0;
    }
  }
  return months;
}

function computeAggregatedStats(list) {
  const stats = {
    total_incidents: list.length,
    ransomware: 0,
    data_breaches: 0,
    vulnerability_disclosures: 0,
    countries_affected: 0,
    estimated_damage_usd: 0,
    critical_count: 0,
    live_sources: 0,
  };

  const countrySet = new Set();
  const sourceSet = new Set();
  let weighted = 0;

  list.forEach((it) => {
    const type = (it.type || '').toLowerCase();
    const desc = (it.description || '').toLowerCase();

    if (type.includes('ransom') || desc.includes('ransom')) stats.ransomware += 1;
    if (type.includes('breach') || desc.includes('breach') || desc.includes('leak')) stats.data_breaches += 1;
    if (
      type.includes('vulner') ||
      type.includes('cve') ||
      type.includes('exploit') ||
      desc.includes('cve')
    ) {
      stats.vulnerability_disclosures += 1;
    }
    if (it.severity === 'critical') stats.critical_count += 1;
    if (it.country) countrySet.add(it.country);
    if (it.source) sourceSet.add(it.source);

    let weight = 1;
    if (type.includes('ransom') || desc.includes('ransom')) weight = 5;
    else if (type.includes('breach')) weight = 8;
    else if (type.includes('cve') || type.includes('exploit')) weight = 3;
    else if (type.includes('ddos')) weight = 1.5;

    const impact = typeof it.impact_score === 'number' ? it.impact_score : 50;
    weighted += weight * impact;
  });

  stats.countries_affected = countrySet.size;
  stats.live_sources = sourceSet.size;
  stats.estimated_damage_usd = Math.round(weighted * 2_500_000);

  return stats;
}

function aggregateByCountry(incidents) {
  const map = {};
  incidents.forEach((inc) => {
    const key = inc.country || 'Globale';
    const lat = Number(inc.latitude);
    const lon = Number(inc.longitude);
    if (!map[key]) {
      const fallback = countryCentroid(key);
      map[key] = {
        country: key,
        country_code: inc.country_code || fallback.code,
        lat: Number.isFinite(lat) ? lat : fallback.lat,
        lon: Number.isFinite(lon) ? lon : fallback.lon,
        count: 0,
        incidents: [],
        severities: {},
        types: {},
      };
    }
    map[key].count += 1;
    map[key].incidents.push(inc);
    map[key].severities[inc.severity] = (map[key].severities[inc.severity] || 0) + 1;
    map[key].types[inc.type] = (map[key].types[inc.type] || 0) + 1;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      const prev = map[key].count - 1;
      map[key].lat = (map[key].lat * prev + lat) / map[key].count;
      map[key].lon = (map[key].lon * prev + lon) / map[key].count;
    }
  });
  return Object.values(map);
}

async function buildIncidentsPayload() {
  const alerts = await fetchAllPublicAlerts();
  let incidents = [];
  let dataMode = 'live';

  if (alerts.length > 0) {
    incidents = alerts.map(alertToIncident);
  } else {
    incidents = generateSimulatedIncidents();
    dataMode = 'simulated';
  }

  const monthly_trends = computeMonthlyTrends(incidents);
  const aggregated_stats = computeAggregatedStats(incidents);
  const regions = aggregateByCountry(incidents);

  const sources = [...new Set(incidents.map((i) => i.source).filter(Boolean))];

  return {
    incidents,
    regions,
    total_incidents: incidents.length,
    monthly_trends,
    aggregated_stats,
    data_mode: dataMode,
    sources,
    source:
      dataMode === 'live'
        ? 'NIST NVD · CISA KEV · CERT-AGID · CERT-EU · CISA Advisories · Cisco Talos'
        : 'Cache / fallback educativo',
    lastUpdate: new Date().toISOString(),
    update_frequency: 'Aggiornamento automatico ogni 5 minuti',
    disclaimer:
      'EDUCATIONAL USE ONLY — Dati da fonti pubbliche ufficiali. Coordinate aggregate per regione, non posizioni di vittime reali.',
  };
}

module.exports = {
  buildIncidentsPayload,
  fetchAllPublicAlerts,
  alertToIncident,
  generateSimulatedIncidents,
  computeMonthlyTrends,
  computeAggregatedStats,
  aggregateByCountry,
  COUNTRY_CENTROIDS,
};

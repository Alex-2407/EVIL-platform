'use strict';
/**
 * Notizie di cybersicurezza da feed RSS/Atom pubblici delle testate di settore.
 *
 * Regole:
 * - si leggono solo i feed elencati in SOURCES (indirizzi fissi nel codice: nessun URL arriva dall'utente);
 * - di ogni articolo si tengono titolo, estratto breve, data e link all'originale: il testo completo
 *   resta alla testata, che è sempre citata;
 * - le etichette (ransomware, violazioni, vulnerabilità…) sono assegnate in automatico da parole chiave
 *   nel titolo e nell'estratto e sono dichiarate come tali nell'interfaccia;
 * - se una fonte non risponde restano gli ultimi articoli reali già salvati, mai dati inventati.
 */
const crypto = require('crypto');
const axios = require('axios');

const USER_AGENT = 'EVIL-Cybersecurity-Platform/1.0 (Educational news reader; +https://www.projectevil.it)';
const MAX_AGE_MS = 10 * 24 * 3600 * 1000;
const MAX_ITEMS = 180;
const PER_SOURCE_LIMIT = 25;

const SOURCES = [
  { id: 'thehackernews', name: 'The Hacker News', lang: 'en', url: 'https://feeds.feedburner.com/TheHackersNews', home: 'https://thehackernews.com/' },
  { id: 'bleepingcomputer', name: 'BleepingComputer', lang: 'en', url: 'https://www.bleepingcomputer.com/feed/', home: 'https://www.bleepingcomputer.com/' },
  { id: 'krebs', name: 'Krebs on Security', lang: 'en', url: 'https://krebsonsecurity.com/feed/', home: 'https://krebsonsecurity.com/' },
  { id: 'securityweek', name: 'SecurityWeek', lang: 'en', url: 'https://feeds.feedburner.com/securityweek', home: 'https://www.securityweek.com/' },
  { id: 'darkreading', name: 'Dark Reading', lang: 'en', url: 'https://www.darkreading.com/rss.xml', home: 'https://www.darkreading.com/' },
  { id: 'cisa', name: 'CISA', lang: 'en', url: 'https://www.cisa.gov/cybersecurity-advisories/all.xml', home: 'https://www.cisa.gov/news-events/cybersecurity-advisories', official: true },
  { id: 'sans-isc', name: 'SANS ISC', lang: 'en', url: 'https://isc.sans.edu/rssfeed.xml', home: 'https://isc.sans.edu/' },
  { id: 'redhotcyber', name: 'Red Hot Cyber', lang: 'it', url: 'https://www.redhotcyber.com/feed/', home: 'https://www.redhotcyber.com/' },
  { id: 'cert-agid', name: 'CERT-AGID', lang: 'it', url: 'https://cert-agid.gov.it/feed/', home: 'https://cert-agid.gov.it/', official: true },
];

/** Argomenti riconosciuti dalle parole chiave (inglese e italiano). */
const TAGS = [
  { id: 'ransomware', re: /ransomware|riscatto|extortion|estorsion|lockbit|blackcat|alphv|akira|clop|cl0p|qilin|play ransomware/i },
  { id: 'breach', re: /data breach|breach(ed)?|data leak|leaked|stolen data|exposed data|violazione dei dati|violazione|data[- ]?breach|fuga di dati|esfiltrat|compromised accounts|dati rubati|dump/i },
  { id: 'vuln', re: /\bCVE-\d{4}-\d{4,}|zero[- ]?day|vulnerabilit|vulnerability|patch(es|ed)?|remote code execution|\bRCE\b|privilege escalation|exploit(ed|ation)?|aggiornament/i },
  { id: 'malware', re: /malware|trojan|botnet|backdoor|infostealer|stealer|spyware|rootkit|loader|worm\b|rat\b|keylogger|cryptominer|wiper/i },
  { id: 'phishing', re: /phishing|smishing|vishing|spear[- ]?phish|social engineering|scam|truffa|fraud|frode|business email compromise|\bBEC\b|clickfix|credential theft/i },
  { id: 'apt', re: /\bAPT\d*\b|nation[- ]state|state[- ]sponsored|espionage|spionaggio|lazarus|sandworm|fancy bear|volt typhoon|salt typhoon|hacktivis|north korea|corea del nord|chinese hackers|russian hackers|iranian/i },
  { id: 'ddos', re: /\bDDoS\b|denial[- ]of[- ]service|disservizio/i },
  { id: 'supply', re: /supply[- ]chain|npm\b|pypi|typosquat|malicious package|github action|dependency/i },
  { id: 'privacy', re: /gdpr|privacy|garante|fine[sd]?\b|sanzion|regulat|compliance|nis2|cyber resilience act|\bDORA\b|legge|law\b/i },
  { id: 'ai', re: /\bAI\b|artificial intelligence|intelligenza artificiale|llm|chatgpt|copilot|deepfake|prompt injection|machine learning/i },
];

// ------------------------------------------------------------------ testo
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', euro: '€' };
function decodeEntities(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 8 && code < 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return Object.prototype.hasOwnProperty.call(ENTITIES, e.toLowerCase()) ? ENTITIES[e.toLowerCase()] : m;
  });
}
/** Da HTML/CDATA a testo semplice: niente tag, entità decodificate, spazi normalizzati. */
function toText(s) {
  return decodeEntities(
    String(s || '')
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|li|br|h\d)>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}
function shorten(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  if (stop > max * 0.55) return cut.slice(0, stop + 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : max).trim()}…`;
}
function pick(block, names) {
  for (const n of names) {
    const m = block.match(new RegExp(`<${n}(?:\\s[^>]*)?>([\\s\\S]*?)</${n}>`, 'i'));
    if (m) return m[1];
  }
  return '';
}
function isoDate(v, now) {
  const d = new Date(String(v || '').trim());
  if (!v || Number.isNaN(d.getTime())) return null;
  // date nel futuro (orologi dei feed sballati): si riportano a "ora"
  return new Date(Math.min(d.getTime(), now + 3600 * 1000)).toISOString();
}

function classify(text) {
  const tags = TAGS.filter((t) => t.re.test(text)).map((t) => t.id);
  return tags.slice(0, 3);
}

/** Articoli di un feed RSS 2.0 o Atom. */
function parseFeed(xml, source, now = Date.now()) {
  const blocks = String(xml).match(/<item[\s>][\s\S]*?<\/item>/gi) || String(xml).match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  const out = [];
  for (const block of blocks) {
    const title = toText(pick(block, ['title']));
    const linkAttr = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) || block.match(/<link[^>]*href=["']([^"']+)["']/i);
    const rawLink = decodeEntities((linkAttr && linkAttr[1]) || toText(pick(block, ['link'])) || toText(pick(block, ['guid']))).trim();
    // il feed è esterno: solo http(s)
    const link = /^https?:\/\/[^\s"'<>]+$/i.test(rawLink) ? rawLink : '';
    if (!title || !link) continue;
    const published = isoDate(toText(pick(block, ['pubDate', 'published', 'updated', 'dc:date'])), now);
    if (!published) continue;
    const summary = shorten(toText(pick(block, ['description', 'summary', 'content:encoded', 'content'])), 520);
    const text = `${title} ${summary}`;
    const cve = [...new Set((text.match(/CVE-\d{4}-\d{4,7}/gi) || []).map((c) => c.toUpperCase()))].slice(0, 4);
    out.push({
      id: crypto.createHash('sha1').update(link).digest('hex').slice(0, 14),
      title: shorten(title, 220),
      summary: summary === title ? '' : summary,
      link,
      source: source.id,
      sourceName: source.name,
      lang: source.lang,
      official: Boolean(source.official),
      published,
      tags: classify(text),
      cve,
    });
    if (out.length >= PER_SOURCE_LIMIT) break;
  }
  return out;
}

async function defaultFetchText(url) {
  const res = await axios.get(url, {
    timeout: 12000,
    maxRedirects: 3,
    maxContentLength: 4 * 1024 * 1024,
    responseType: 'text',
    transformResponse: [(d) => d],
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5' },
    validateStatus: (s) => s >= 200 && s < 300,
  });
  return String(res.data);
}

/**
 * @param {{fetchText?: (url:string)=>Promise<string>, now?: ()=>number, sources?: object[]}} [options]
 */
function createNewsService(options = {}) {
  const fetchText = options.fetchText || defaultFetchText;
  const nowFn = options.now || Date.now;
  const sources = options.sources || SOURCES;

  let state = { items: [], sources: [], updatedAt: null };

  function load(saved) {
    if (saved && Array.isArray(saved.items)) {
      state = { items: saved.items, sources: saved.sources || [], updatedAt: saved.updatedAt || null };
    }
  }

  async function refresh() {
    const now = nowFn();
    const results = await Promise.allSettled(sources.map(async (s) => parseFeed(await fetchText(s.url), s, now)));
    const status = [];
    const fresh = new Map(); // id → articolo
    const failed = new Set();
    results.forEach((r, i) => {
      const s = sources[i];
      if (r.status === 'fulfilled' && r.value.length) {
        r.value.forEach((it) => fresh.set(it.id, it));
        status.push({ id: s.id, name: s.name, lang: s.lang, ok: true, count: r.value.length, fetchedAt: new Date(now).toISOString() });
      } else {
        failed.add(s.id);
        const prev = (state.sources || []).find((x) => x.id === s.id);
        status.push({ id: s.id, name: s.name, lang: s.lang, ok: false, count: prev ? prev.count : 0, fetchedAt: prev ? prev.fetchedAt : null });
      }
    });
    // le fonti che non hanno risposto mantengono gli ultimi articoli reali già raccolti
    state.items.filter((it) => failed.has(it.source)).forEach((it) => fresh.set(it.id, it));
    // gli articoli delle fonti che hanno risposto ma non sono più nel feed restano finché sono recenti
    state.items.filter((it) => !failed.has(it.source) && !fresh.has(it.id)).forEach((it) => fresh.set(it.id, it));

    const items = [...fresh.values()]
      .filter((it) => now - Date.parse(it.published) < MAX_AGE_MS)
      .sort((a, b) => b.published.localeCompare(a.published))
      .slice(0, MAX_ITEMS);
    const anyOk = status.some((s) => s.ok);
    state = { items, sources: status, updatedAt: anyOk ? new Date(now).toISOString() : state.updatedAt };
    return state;
  }

  return { refresh, load, snapshot: () => state, SOURCES: sources };
}

module.exports = { createNewsService, parseFeed, classify, toText, shorten, SOURCES, TAGS };

/**
 * EVIL Public Info — OSINT su persone fisiche (solo fonti pubbliche, disambiguazione rigorosa)
 */
const axios = require('axios');
const { probeGithub, probeReddit } = require('./social-profiling-service');
const {
  buildAugmentedSearch,
  countryNameToIso,
  applyDossierFilters,
  getActiveFilters
} = require('./public-info-filters');

const HTTP = {
  timeout: 45000,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'EVIL-Platform/1.0 (https://projectevil.it; osint-education@projectevil.it)'
  },
  validateStatus: () => true
};

const LIMITATIONS = [
  'Ogni scheda (CAND-xxx) è una possibile identità — non vengono unite automaticamente.',
  'Solo dati da API e archivi pubblici (OpenAlex, ORCID, Wikidata, Wikipedia, Crossref, GitHub/Reddit su alias).',
  'Nessuna inferenza di email, telefono, indirizzo o dati non pubblici.',
  'Link LinkedIn/social generati richiedono verifica manuale — non provano identità.',
  'Usare esclusivamente per formazione etica e con autorizzazione sul soggetto.'
];

const CATEGORY_KEYS = [
  'professional_profiles',
  'websites',
  'public_quotes',
  'organizations',
  'social_profiles',
  'public_images',
  'articles_publications',
  'associated_domains',
  'corporate_data'
];

function emptyCategories() {
  return Object.fromEntries(CATEGORY_KEYS.map((k) => [k, []]));
}

function sourceEntry(name, url, reliability = 'medium') {
  return { name, url: url || null, retrievedAt: new Date().toISOString(), reliability };
}

function parseTimeRange(input) {
  if (!input) return null;
  const s = String(input).trim();
  const range = s.match(/^(\d{4})\s*[-–]\s*(\d{4})$/);
  if (range) return { from: +range[1], to: +range[2] };
  const year = s.match(/^(\d{4})$/);
  if (year) return { from: +year[1], to: +year[1] };
  return null;
}

function yearInRange(year, range) {
  if (!range || year == null) return true;
  return year >= range.from && year <= range.to;
}

function normalizePersonInput(input) {
  const firstName = String(input.firstName || '').trim();
  const lastName = String(input.lastName || '').trim();
  if (!firstName || !lastName) {
    throw new Error('Nome e cognome obbligatori');
  }
  if (firstName.length > 64 || lastName.length > 64) {
    throw new Error('Nome o cognome troppo lunghi');
  }
  const filters = {
    city: String(input.filters?.city || input.city || '').trim() || null,
    province: String(input.filters?.province || input.province || '').trim() || null,
    region: String(input.filters?.region || input.region || '').trim() || null,
    country: String(input.filters?.country || input.country || '').trim() || null,
    profession: String(input.filters?.profession || input.profession || '').trim() || null,
    company: String(input.filters?.company || input.company || '').trim() || null,
    timeRange: String(input.filters?.timeRange || input.timeRange || '').trim() || null
  };
  const aliases = (input.aliases || [])
    .map((a) => String(a).trim().replace(/^@/, ''))
    .filter(Boolean)
    .slice(0, 5);
  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    filters,
    aliases,
    timeRangeParsed: parseTimeRange(filters.timeRange)
  };
}

function filterHaystack(candidate) {
  return JSON.stringify({
    label: candidate.label,
    categories: candidate.categories,
    meta: candidate.meta
  }).toLowerCase();
}

function scoreCandidate(candidate, query) {
  const gaps = [...(candidate.gaps || [])];
  const conflicts = [...(candidate.conflicts || [])];
  let score = 30;
  const hay = filterHaystack(candidate);
  const { filters } = query;

  const bump = (pts, reason) => {
    score += pts;
    candidate.matchReasons = candidate.matchReasons || [];
    candidate.matchReasons.push(reason);
  };

  if (filters.city && hay.includes(filters.city.toLowerCase())) bump(12, `Comune: ${filters.city}`);
  if (filters.province && hay.includes(filters.province.toLowerCase())) bump(8, `Provincia: ${filters.province}`);
  if (filters.region && hay.includes(filters.region.toLowerCase())) bump(8, `Regione: ${filters.region}`);
  if (filters.country && hay.includes(filters.country.toLowerCase())) bump(10, `Nazione: ${filters.country}`);
  if (filters.profession && hay.includes(filters.profession.toLowerCase())) bump(10, `Professione: ${filters.profession}`);
  if (filters.company) {
    const orgHit = (candidate.categories.organizations || []).some((o) =>
      String(o.name || o).toLowerCase().includes(filters.company.toLowerCase())
    );
    if (orgHit) bump(18, `Organizzazione: ${filters.company}`);
    else gaps.push(`Filtro azienda "${filters.company}" non confermato su questa scheda`);
  }

  if ((candidate.sources || []).length === 1) {
    gaps.push('Identità supportata da una sola fonte — non verificabile cross-fonte');
    score -= 5;
  }

  if (candidate.sourceType === 'manual_link') {
    score = Math.min(score, 35);
    gaps.push('Solo link di ricerca — nessun dato strutturato recuperato');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const confidence =
    score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low';

  return { confidence, confidenceScore: score, gaps, conflicts };
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function addUrlCategories(categories, url, label) {
  if (!url) return;
  categories.websites.push({ label, url });
  const dom = extractDomain(url);
  if (dom && !categories.associated_domains.some((d) => d.domain === dom)) {
    categories.associated_domains.push({ domain: dom, note: label });
  }
}

function nameMatchesQuery(displayName, firstName, lastName) {
  const dn = String(displayName || '').toLowerCase();
  const ln = lastName.toLowerCase();
  const fn = firstName.toLowerCase();
  if (!dn.includes(ln)) return false;
  return dn.includes(fn) || dn.includes(`${fn.charAt(0)}.`) || dn.includes(`${fn.charAt(0)} `);
}

async function fetchOpenAlexAuthors(fullName, lastName, firstName, filters = {}) {
  const queries = [`${lastName}, ${firstName}`, fullName];
  const seen = new Set();
  const authors = [];
  const countryCode = countryNameToIso(filters.country);
  for (const q of queries) {
    const params = { search: q, per_page: 8 };
    if (countryCode) params.filter = `last_known_institutions.country_code:${countryCode}`;
    const res = await axios.get('https://api.openalex.org/authors', {
      ...HTTP,
      params
    });
    for (const a of res.data?.results || []) {
      if (seen.has(a.id)) continue;
      if (!nameMatchesQuery(a.display_name, firstName, lastName)) continue;
      seen.add(a.id);
      authors.push(a);
    }
  }
  authors.sort((x, y) => {
    const ex = (a) => a.display_name?.toLowerCase() === fullName.toLowerCase() ? 0 : 1;
    return ex(x) - ex(y);
  });
  return authors.slice(0, 5);
}

async function fetchOpenAlexWorks(authorId, timeRange) {
  const id = authorId.replace('https://openalex.org/', '');
  const res = await axios.get('https://api.openalex.org/works', {
    ...HTTP,
    params: { filter: `author.id:${id}`, per_page: 5, sort: 'publication_date:desc' }
  });
  return (res.data?.results || []).filter((w) =>
    yearInRange(w.publication_year, timeRange)
  );
}

async function fetchWikipedia(lang, searchText) {
  const res = await axios.get(`https://${lang}.wikipedia.org/w/api.php`, {
    ...HTTP,
    params: {
      action: 'query',
      list: 'search',
      srsearch: searchText,
      format: 'json',
      origin: '*',
      srlimit: 4
    }
  });
  const hits = res.data?.query?.search || [];
  const detailed = [];
  for (const hit of hits.slice(0, 3)) {
    const page = await axios.get(`https://${lang}.wikipedia.org/w/api.php`, {
      ...HTTP,
      params: {
        action: 'query',
        pageids: hit.pageid,
        prop: 'extracts|pageimages|info',
        exintro: 1,
        explaintext: 1,
        piprop: 'thumbnail',
        inprop: 'url',
        format: 'json',
        origin: '*'
      }
    });
    const p = page.data?.query?.pages?.[hit.pageid];
    if (p) detailed.push({ lang, hit, page: p });
  }
  return detailed;
}

async function fetchWikidataEntities(searchText) {
  const res = await axios.get('https://www.wikidata.org/w/api.php', {
    ...HTTP,
    params: {
      action: 'wbsearchentities',
      search: searchText,
      language: 'it',
      limit: 5,
      format: 'json',
      origin: '*'
    }
  });
  const entities = [];
  for (const hit of (res.data?.search || []).slice(0, 4)) {
    const data = await axios.get(`https://www.wikidata.org/wiki/Special:EntityData/${hit.id}.json`, HTTP);
    const entity = data.data?.entities?.[hit.id];
    if (entity) entities.push({ hit, entity });
  }
  return entities;
}

async function fetchOrcidRecords(firstName, lastName, filters = {}) {
  let q = `given-names:${firstName} AND family-name:${lastName}`;
  if (filters.company) q += ` AND affiliation-org-name:"${filters.company.replace(/"/g, '')}"`;
  if (filters.country) q += ` AND affiliation-org-name:${filters.country}`;
  if (filters.profession) q += ` AND keyword:${filters.profession}`;
  const res = await axios.get('https://pub.orcid.org/v3.0/expanded-search/', {
    ...HTTP,
    params: { q, rows: 6 }
  });
  return res.data?.['expanded-result'] || [];
}

async function fetchCrossrefWorks(lastName, firstName, timeRange) {
  const res = await axios.get('https://api.crossref.org/works', {
    ...HTTP,
    params: {
      'query.author': `${lastName}, ${firstName}`,
      rows: 8,
      sort: 'published',
      order: 'desc'
    }
  });
  return (res.data?.message?.items || []).filter((w) => {
    const parts = w.published?.['date-parts']?.[0];
    const year = parts?.[0];
    return yearInRange(year, timeRange);
  });
}

function buildManualSearchLinks(query) {
  const { fullName, filters } = query;
  const parts = [`"${fullName}"`];
  if (filters.city) parts.push(`"${filters.city}"`);
  if (filters.company) parts.push(`"${filters.company}"`);
  if (filters.profession) parts.push(`"${filters.profession}"`);
  const q = parts.join(' ');
  return [
    { label: 'Google (verifica manuale)', url: `https://www.google.com/search?q=${encodeURIComponent(q)}`, category: 'manual' },
    { label: 'DuckDuckGo', url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`, category: 'manual' },
    {
      label: 'LinkedIn search (manuale)',
      url: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(fullName)}`,
      category: 'professional_profiles'
    }
  ];
}

function candidateShell(id, sourceType, label, primarySource) {
  return {
    id,
    sourceType,
    label,
    confidence: 'low',
    confidenceScore: 0,
    matchReasons: [],
    categories: emptyCategories(),
    sources: [primarySource],
    gaps: [],
    conflicts: [],
    meta: {},
    verified: false
  };
}

async function enrichWikidataCandidate(c, entity) {
  const claims = entity.claims || {};
  const pick = (prop) =>
    (claims[prop] || [])
      .map((cl) => cl.mainsnak?.datavalue?.value?.id)
      .filter(Boolean)
      .slice(0, 3);
  const ids = [...pick('P19'), ...pick('P551'), ...pick('P106'), ...pick('P27')];
  if (!ids.length) return;
  const res = await axios.get('https://www.wikidata.org/w/api.php', {
    ...HTTP,
    params: { action: 'wbgetentities', ids: ids.join('|'), props: 'labels', languages: 'it|en', format: 'json', origin: '*' }
  });
  const ents = res.data?.entities || {};
  const label = (id) => ents[id]?.labels?.it?.value || ents[id]?.labels?.en?.value;
  for (const id of pick('P19')) {
    const n = label(id);
    if (n) {
      c.meta.birthPlace = n;
      c.categories.organizations.push({ name: n, type: 'birth_place', source: 'Wikidata' });
    }
  }
  for (const id of pick('P551')) {
    const n = label(id);
    if (n) c.meta.residence = n;
  }
  for (const id of pick('P106')) {
    const n = label(id);
    if (n) c.meta.occupation = n;
  }
  for (const id of pick('P27')) {
    const n = label(id);
    if (n) c.meta.citizenship = n;
  }
}

async function buildOpenAlexCandidates(query, startIdx) {
  const authors = await fetchOpenAlexAuthors(query.fullName, query.lastName, query.firstName, query.filters);
  const out = [];
  let idx = startIdx;
  for (const a of authors) {
    const id = `CAND-${String(idx++).padStart(3, '0')}`;
    const src = sourceEntry('OpenAlex', a.id, 'high');
    const c = candidateShell(id, 'openalex', a.display_name, src);
    c.meta = { openalexId: a.id, orcid: a.orcid || null, worksCount: a.works_count };
    c.categories.professional_profiles.push({
      type: 'OpenAlex Author',
      name: a.display_name,
      url: a.id,
      orcid: a.orcid
    });
    if (a.orcid) {
      c.categories.professional_profiles.push({
        type: 'ORCID (da OpenAlex)',
        url: `https://orcid.org/${a.orcid}`
      });
    }
    for (const inst of a.last_known_institutions || []) {
      c.categories.organizations.push({
        name: inst.display_name,
        country: inst.country_code,
        type: inst.type
      });
      if (inst.type === 'company') {
        c.categories.corporate_data.push({ name: inst.display_name, source: 'OpenAlex institution' });
      }
    }
    const works = await fetchOpenAlexWorks(a.id, query.timeRangeParsed);
    for (const w of works) {
      c.categories.articles_publications.push({
        title: w.title || w.display_name,
        year: w.publication_year,
        doi: w.doi,
        url: w.id,
        source: 'OpenAlex'
      });
    }
    addUrlCategories(c.categories, a.id, 'OpenAlex author');
    const scored = scoreCandidate(c, query);
    Object.assign(c, scored);
    out.push(c);
  }
  return { candidates: out, nextIdx: idx };
}

async function buildWikipediaCandidates(query, startIdx) {
  const searchText = buildAugmentedSearch(query);
  const out = [];
  let idx = startIdx;
  for (const lang of ['it', 'en']) {
    const pages = await fetchWikipedia(lang, searchText);
    for (const { hit, page } of pages) {
      const id = `CAND-${String(idx++).padStart(3, '0')}`;
      const pageUrl = page.fullurl || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(hit.title)}`;
      const src = sourceEntry(`Wikipedia (${lang})`, pageUrl, 'high');
      const c = candidateShell(id, 'wikipedia', hit.title, src);
      c.meta = { wikipediaTitle: hit.title, lang, pageid: hit.pageid };
      if (page.extract) {
        c.categories.public_quotes.push({
          text: page.extract.slice(0, 600) + (page.extract.length > 600 ? '…' : ''),
          source: `Wikipedia (${lang})`
        });
      }
      if (page.thumbnail?.source) {
        c.categories.public_images.push({
          url: page.thumbnail.source,
          caption: hit.title,
          source: `Wikipedia (${lang})`
        });
      }
      addUrlCategories(c.categories, pageUrl, `Wikipedia ${lang}`);
      c.categories.articles_publications.push({
        title: hit.title,
        type: 'voce enciclopedica',
        url: pageUrl,
        source: 'Wikipedia'
      });
      const scored = scoreCandidate(c, query);
      Object.assign(c, scored);
      out.push(c);
    }
  }
  return { candidates: out, nextIdx: idx };
}

async function buildWikidataCandidates(query, startIdx) {
  const entities = await fetchWikidataEntities(buildAugmentedSearch(query));
  const out = [];
  let idx = startIdx;
  for (const { hit, entity } of entities) {
    const id = `CAND-${String(idx++).padStart(3, '0')}`;
    const pageUrl = `https://www.wikidata.org/wiki/${hit.id}`;
    const src = sourceEntry('Wikidata', pageUrl, 'high');
    const label = entity.labels?.it?.value || entity.labels?.en?.value || hit.label;
    const desc = entity.descriptions?.it?.value || entity.descriptions?.en?.value;
    const c = candidateShell(id, 'wikidata', label, src);
    c.meta = { wikidataId: hit.id, description: desc };
    await enrichWikidataCandidate(c, entity);
    if (desc) {
      c.categories.public_quotes.push({ text: desc, source: 'Wikidata description' });
    }
    addUrlCategories(c.categories, pageUrl, 'Wikidata');
    c.categories.professional_profiles.push({ type: 'Wikidata entity', id: hit.id, label, url: pageUrl });
    const scored = scoreCandidate(c, query);
    Object.assign(c, scored);
    out.push(c);
  }
  return { candidates: out, nextIdx: idx };
}

async function buildOrcidCandidates(query, startIdx) {
  const records = await fetchOrcidRecords(query.firstName, query.lastName, query.filters);
  const out = [];
  let idx = startIdx;
  for (const r of records.slice(0, 6)) {
    const id = `CAND-${String(idx++).padStart(3, '0')}`;
    const orcidId = r['orcid-id'];
    const pageUrl = `https://orcid.org/${orcidId}`;
    const src = sourceEntry('ORCID Public API', pageUrl, 'high');
    const name = [r['given-names'], r['family-names']].filter(Boolean).join(' ');
    const c = candidateShell(id, 'orcid', name, src);
    c.meta = { orcid: orcidId };
    c.categories.professional_profiles.push({ type: 'ORCID record', orcid: orcidId, url: pageUrl });
    for (const inst of r['institution-name'] || []) {
      c.categories.organizations.push({ name: inst, source: 'ORCID' });
    }
    addUrlCategories(c.categories, pageUrl, 'ORCID');
    const scored = scoreCandidate(c, query);
    Object.assign(c, scored);
    out.push(c);
  }
  return { candidates: out, nextIdx: idx };
}

async function buildAliasCandidates(query, startIdx) {
  const out = [];
  let idx = startIdx;
  for (const alias of query.aliases) {
    const gh = await probeGithub(alias);
    if (gh.found === true && gh.confidence === 'high') {
      const id = `CAND-${String(idx++).padStart(3, '0')}`;
      const src = sourceEntry('GitHub API', gh.url, 'high');
      const c = candidateShell(id, 'alias_github', `@${alias} (GitHub)`, src);
      c.meta = { alias, platform: 'github', profile: gh.profile };
      c.categories.social_profiles.push({
        platform: 'GitHub',
        username: alias,
        url: gh.url,
        verified: true,
        profile: gh.profile
      });
      c.categories.professional_profiles.push({
        type: 'GitHub',
        name: gh.profile?.name,
        url: gh.url
      });
      if (gh.profile?.company) {
        c.categories.organizations.push({ name: gh.profile.company, source: 'GitHub bio' });
      }
      addUrlCategories(c.categories, gh.url, 'GitHub');
      c.gaps.push('Profilo alias — collegamento al nome/cognome non dimostrato automaticamente');
      const scored = scoreCandidate(c, query);
      Object.assign(c, scored);
      out.push(c);
    }
    const rd = await probeReddit(alias);
    if (rd.found === true && rd.confidence === 'high') {
      const id = `CAND-${String(idx++).padStart(3, '0')}`;
      const src = sourceEntry('Reddit API', rd.url, 'high');
      const c = candidateShell(id, 'alias_reddit', `@${alias} (Reddit)`, src);
      c.meta = { alias, platform: 'reddit' };
      c.categories.social_profiles.push({ platform: 'Reddit', username: alias, url: rd.url, verified: true });
      addUrlCategories(c.categories, rd.url, 'Reddit');
      c.gaps.push('Profilo alias — collegamento al nome/cognome non dimostrato automaticamente');
      const scored = scoreCandidate(c, query);
      Object.assign(c, scored);
      out.push(c);
    }
  }
  return { candidates: out, nextIdx: idx };
}

function detectPotentialLinks(candidates) {
  const links = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const orcidA = a.meta?.orcid;
      const orcidB = b.meta?.orcid;
      if (orcidA && orcidB && orcidA === orcidB) {
        links.push({
          type: 'shared_orcid',
          candidateA: a.id,
          candidateB: b.id,
          evidence: orcidA,
          note: 'Stesso ORCID — possibile stessa persona, ma schede mantenute separate fino a verifica umana'
        });
        a.conflicts.push(`Possibile collegamento con ${b.id} (ORCID condiviso) — non uniti automaticamente`);
        b.conflicts.push(`Possibile collegamento con ${a.id} (ORCID condiviso) — non uniti automaticamente`);
      }
    }
  }
  return links;
}

function buildGlobalFindings(candidates, query) {
  const findings = [];
  if (!candidates.length) {
    findings.push({
      severity: 'high',
      title: 'Nessuna identità strutturata',
      detail: 'Nessun record pubblico trovato nelle fonti interrogabili. Usa i link manuali.'
    });
  }
  if (candidates.length > 1) {
    findings.push({
      severity: 'medium',
      title: 'Omonimia / disambiguazione',
      detail: `${candidates.length} schede separate — non assumere che siano la stessa persona.`
    });
  }
  const allLow = candidates.length && candidates.every((c) => c.confidence === 'low');
  if (allLow) {
    findings.push({
      severity: 'medium',
      title: 'Identità non verificabile',
      detail: 'Tutte le schede hanno confidenza bassa — servono filtri aggiuntivi o verifica manuale.'
    });
  }
  if (query.aliases.length && !candidates.some((c) => c.sourceType.startsWith('alias_'))) {
    findings.push({
      severity: 'info',
      title: 'Alias non confermati',
      detail: 'Nessun alias verificato via API GitHub/Reddit.'
    });
  }
  return findings;
}

async function runPublicInfoPersonSearch(input) {
  const started = Date.now();
  const query = normalizePersonInput(input);
  let idx = 1;
  const allCandidates = [];

  const chunks = await Promise.all([
    buildOpenAlexCandidates(query, idx),
    buildWikipediaCandidates(query, 100),
    buildWikidataCandidates(query, 200),
    buildOrcidCandidates(query, 300),
    query.aliases.length ? buildAliasCandidates(query, 400) : Promise.resolve({ candidates: [], nextIdx: 400 })
  ]);

  for (const chunk of chunks) {
    for (const c of chunk.candidates) {
      c.id = `CAND-${String(idx++).padStart(3, '0')}`;
      allCandidates.push(c);
    }
  }

  const crossrefWorks = await fetchCrossrefWorks(query.lastName, query.firstName, query.timeRangeParsed);
  const unassignedPublications = crossrefWorks.map((w) => ({
    title: (w.title || [])[0],
    year: w.published?.['date-parts']?.[0]?.[0],
    doi: w.DOI,
    url: w.URL,
    source: 'Crossref',
    note: 'Non associato automaticamente a una scheda identità'
  }));

  const potentialLinks = detectPotentialLinks(allCandidates);
  const manualSearchLinks = buildManualSearchLinks(query);
  const { matched, excluded, filtersApplied } = applyDossierFilters(allCandidates, query);
  const finalCandidates = filtersApplied ? matched : allCandidates;
  const findings = buildGlobalFindings(finalCandidates, query);

  if (filtersApplied && excluded.length) {
    findings.unshift({
      severity: 'info',
      title: `${excluded.length} schede escluse dai filtri`,
      detail: `Filtri attivi: ${getActiveFilters(query.filters).map(([k]) => k).join(', ')}. Restano ${finalCandidates.length} corrispondenze.`
    });
  }
  if (filtersApplied && !finalCandidates.length) {
    findings.unshift({
      severity: 'medium',
      title: 'Nessuna corrispondenza ai filtri',
      detail: 'Prova a rimuovere un filtro o verifica ortografia (es. comune, nazione, professione).'
    });
  }

  const verifiedCount = finalCandidates.filter((c) => c.confidence === 'high').length;

  return {
    query: {
      firstName: query.firstName,
      lastName: query.lastName,
      fullName: query.fullName,
      filters: query.filters,
      aliases: query.aliases
    },
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - started,
    candidateCount: finalCandidates.length,
    excludedByFilters: excluded.length,
    filtersApplied,
    verifiedCandidateCount: verifiedCount,
    candidates: finalCandidates,
    excludedCandidates: filtersApplied ? excluded.slice(0, 10) : [],
    unassignedPublications,
    potentialLinks,
    manualSearchLinks,
    findings,
    limitations: LIMITATIONS,
    note: 'Dossier OSINT — ogni CAND-xxx è una possibile identità. Nessuna unione automatica.',
    scanType: 'public_info_person',
    status: 'success'
  };
}

/** Legacy: dominio (organizzazione) — delega a servizi esistenti */
async function runPublicInfoDomainSearch(domainInput) {
  const { runDnsEnumeration } = require('./dns-enumerator-service');
  const { runWhoisLookup } = require('./whois-service');
  const domain = String(domainInput || '')
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .trim();
  if (!domain) throw new Error('Dominio obbligatorio');
  const [dns, whois] = await Promise.all([
    runDnsEnumeration(domain).catch((e) => ({ error: e.message })),
    runWhoisLookup(domain).catch((e) => ({ error: e.message }))
  ]);
  return {
    target: domain,
    type: 'domain',
    timestamp: new Date().toISOString(),
    scanType: 'public_info_domain',
    data: { dns, whois },
    status: 'success'
  };
}

module.exports = { runPublicInfoPersonSearch, runPublicInfoDomainSearch, normalizePersonInput };

/**
 * EVIL Public Info Registry — elenco persone da Wikidata (fonte pubblica, persone documentate)
 * NON è anagrafe nazionale: solo individui presenti in Wikidata/Wikipedia.
 */
// Client HTTP con protezione SSRF (anche i redirect vengono verificati)
const { axios } = require('../../server/lib/safe-http');
const {
  buildTerritorySearch,
  applyRegistryPostFilters
} = require('./public-info-filters');
const { t } = require('../../server/i18n');

// Filtro professione: solo lettere, spazi, apostrofi e trattini (finisce in una stringa SPARQL)
const PROFESSION_RE = /^[\p{L} '’-]{1,60}$/u; // spazio semplice: niente a capo o tab
const QID_RE = /^Q\d{1,12}$/;

/** Escape per un letterale stringa SPARQL tra virgolette doppie: prima \, poi " e i caratteri di controllo. */
function sparqlString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/** Errore con messaggio già scritto per l'utente (la route lo restituisce così com'è). */
function userError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  err.expose = true;
  return err;
}

function assertQid(qid) {
  if (!QID_RE.test(String(qid || ''))) throw userError('ID Wikidata non valido');
  return qid;
}

const HTTP = {
  timeout: 45000,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'EVIL-Platform/1.0 (https://projectevil.it; osint-education@projectevil.it)'
  },
  validateStatus: () => true
};

const SPARQL_HTTP = {
  timeout: 90000,
  headers: {
    Accept: 'application/sparql-results+json',
    'User-Agent': 'EVIL-Platform/1.0 (https://projectevil.it; osint-education@projectevil.it)'
  },
  validateStatus: () => true
};

const COUNTRY_QID = {
  italia: 'Q38',
  italy: 'Q38',
  francia: 'Q142',
  france: 'Q142',
  germania: 'Q183',
  germany: 'Q183',
  spagna: 'Q29',
  spain: 'Q29',
  'stati uniti': 'Q30',
  usa: 'Q30',
  'united states': 'Q30',
  'regno unito': 'Q145',
  uk: 'Q145',
  'united kingdom': 'Q145'
};

const COUNTRY_WIKI_CATEGORIES = {
  Q38: ['Categoria:Italiani', 'Categoria:Persone italiane', 'Category:Italian people'],
  Q142: ['Categoria:Francesi', 'Category:French people'],
  Q183: ['Categoria:Tedeschi', 'Category:German people'],
  Q29: ['Categoria:Spagnoli', 'Category:Spanish people'],
  Q30: ['Categoria:Statunitensi', 'Category:American people'],
  Q145: ['Categoria:Britannici', 'Category:British people']
};

const REGISTRY_LIMITATIONS = [
  'Elenco da Wikidata/Wikipedia: persone pubblicamente documentate, NON l’intera popolazione nazionale.',
  'Anagrafe, codice fiscale, indirizzi e registri civili non sono consultabili via OSINT legittimo.',
  'Comune di nascita/residenza mostrato solo se presente come dato pubblico su Wikidata.',
  'Omonimia possibile: verifica sempre la scheda Wikidata prima di trarre conclusioni.'
];

function normalizeProfession(value, lang) {
  const profession = String(value || '').trim();
  if (!profession) return null;
  if (!PROFESSION_RE.test(profession)) {
    throw userError(t(lang, 'Professione non valida: usa solo lettere, spazi, apostrofi e trattini (massimo 60 caratteri).'));
  }
  return profession;
}

function normalizeTerritoryInput(input, lang) {
  const country = String(input.country || '').trim();
  if (!country) throw userError(t(lang, 'La nazione è obbligatoria.'));
  return {
    country,
    region: String(input.region || '').trim() || null,
    province: String(input.province || '').trim() || null,
    municipality: String(input.municipality || input.city || input.comune || '').trim() || null,
    profession: normalizeProfession(input.profession, lang),
    limit: Math.min(100, Math.max(10, parseInt(input.limit, 10) || 50)),
    offset: Math.max(0, parseInt(input.offset, 10) || 0)
  };
}

function countryToQid(name) {
  const key = name.toLowerCase().trim();
  if (COUNTRY_QID[key]) return { qid: COUNTRY_QID[key], label: name, source: 'preset' };
  return null;
}

async function resolveWikidataEntity(search, typeHint, countryLabel) {
  const terms = countryLabel
    ? [buildTerritorySearch(search, countryLabel), `${search} regione ${countryLabel}`, `${search} ${countryLabel}`, search]
    : [search];
  let hits = [];
  for (const term of terms) {
    const res = await axios.get('https://www.wikidata.org/w/api.php', {
      ...HTTP,
      params: {
        action: 'wbsearchentities',
        search: term,
        language: 'it',
        limit: 8,
        format: 'json',
        origin: '*'
      }
    });
    hits = res.data?.search || [];
    if (hits.length) break;
  }
  if (!hits.length) return null;

  const prefer = (list) => {
    if (typeHint === 'country') {
      return list.find((h) => /country|stato|nation/i.test(h.description || '')) || list[0];
    }
    if (typeHint === 'municipality') {
      return (
        list.find((h) => /comune|city|municipality|town/i.test(h.description || '')) ||
        list.find((h) => /capoluogo|città/i.test(h.description || '')) ||
        list[0]
      );
    }
    if (typeHint === 'region') {
      return (
        list.find((h) => /region|regione|administrative territorial entity/i.test(h.description || '')) ||
        list[0]
      );
    }
    if (typeHint === 'province') {
      return (
        list.find((h) => /province|provincia|administrative territorial entity/i.test(h.description || '')) ||
        list[0]
      );
    }
    return list[0];
  };

  const hit = prefer(hits);
  return {
    qid: hit.id,
    label: hit.label,
    description: hit.description,
    url: `https://www.wikidata.org/wiki/${hit.id}`
  };
}

async function resolveTerritory(query) {
  const territory = { country: null, region: null, province: null, municipality: null, unresolved: [] };

  territory.country = countryToQid(query.country) || (await resolveWikidataEntity(query.country, 'country'));
  if (!territory.country) {
    throw new Error(`Nazione non risolta su Wikidata: "${query.country}"`);
  }
  const countryLabel = query.country;

  if (query.region) {
    territory.region = await resolveWikidataEntity(query.region, 'region', countryLabel);
    if (!territory.region) territory.unresolved.push(`Regione: ${query.region}`);
  }
  const [province, municipality] = await Promise.all([
    query.province
      ? resolveWikidataEntity(query.province, 'province', countryLabel).then((r) => r || null)
      : Promise.resolve(null),
    query.municipality
      ? resolveWikidataEntity(query.municipality, 'municipality', countryLabel).then((r) => r || null)
      : Promise.resolve(null)
  ]);
  if (query.province) {
    territory.province = province;
    if (!province) territory.unresolved.push(`Provincia: ${query.province}`);
  }
  if (query.municipality) {
    territory.municipality = municipality;
    if (!municipality) territory.unresolved.push(`Comune: ${query.municipality}`);
  }

  if (query.region && !territory.region) {
    throw new Error(`Regione non trovata su Wikidata: "${query.region}". Prova "Lombardia", "Lazio", ecc.`);
  }
  if (query.province && !territory.province) {
    throw new Error(`Provincia non trovata su Wikidata: "${query.province}". Verifica nome e nazione.`);
  }
  if (query.municipality && !territory.municipality) {
    throw new Error(`Comune non trovato su Wikidata: "${query.municipality}". Esempio: Roma, Milano, Napoli.`);
  }

  return territory;
}

function buildCountryOnlySparql(countryQid, query) {
  return [
    'SELECT DISTINCT ?person ?personLabel ?birthPlaceLabel ?birthPlace ?occupationLabel ?birthDate WHERE {',
    '  ?person wdt:P31 wd:Q5;',
    '          wdt:P19 ?birthPlace.',
    `  ?birthPlace wdt:P17 wd:${countryQid}.`,
    '  OPTIONAL { ?person wdt:P106 ?occ. }',
    '  OPTIONAL { ?person wdt:P569 ?birthDate. }',
    '  SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }',
    '  FILTER(BOUND(?personLabel))',
    '}',
    'ORDER BY ?personLabel',
    `LIMIT ${query.limit}`,
    `OFFSET ${query.offset}`
  ].join('\n');
}

function buildRegistrySparql(territory, query) {
  const country = assertQid(territory.country.qid);
  for (const k of ['region', 'province', 'municipality']) if (territory[k]) assertQid(territory[k].qid);

  if (!territory.municipality && !territory.region && !territory.province) {
    return buildCountryOnlySparql(country, query);
  }

  const lines = [
    'SELECT DISTINCT ?person ?personLabel ?birthPlaceLabel ?birthPlace ?residenceLabel ?residence ?occupationLabel ?birthDate WHERE {',
    '  ?person wdt:P31 wd:Q5.',
    '  {'
  ];

  if (territory.municipality) {
    const m = territory.municipality.qid;
    lines.push(`    { ?person wdt:P19 wd:${m}. }`);
    lines.push(`    UNION { ?person wdt:P551 wd:${m}. }`);
    lines.push(`    UNION { ?person wdt:P19 ?bp. ?bp wdt:P131 wd:${m}. }`);
  } else if (territory.region) {
    const r = territory.region.qid;
    lines.push(`    ?person wdt:P19 ?place.`);
    lines.push(`    ?place wdt:P17 wd:${country}.`);
    lines.push(`    { ?place wdt:P131* wd:${r}. }`);
    lines.push(`    UNION { ?person wdt:P551 ?rplace. ?rplace wdt:P131* wd:${r}. ?rplace wdt:P17 wd:${country}. }`);
  } else if (territory.province) {
    const p = territory.province.qid;
    lines.push(`    ?person wdt:P19 ?place.`);
    lines.push(`    ?place wdt:P17 wd:${country}.`);
    lines.push(`    { ?place wdt:P131* wd:${p}. }`);
    lines.push(`    UNION { ?person wdt:P551 ?rplace. ?rplace wdt:P131* wd:${p}. ?rplace wdt:P17 wd:${country}. }`);
  } else {
    lines.push(`    { ?person wdt:P27 wd:${country}. }`);
    lines.push(`    UNION { ?person wdt:P19 ?place. ?place wdt:P17 wd:${country}. }`);
  }

  lines.push('  }');
  lines.push('  OPTIONAL { ?person wdt:P19 ?birthPlace. }');
  lines.push('  OPTIONAL { ?person wdt:P551 ?residence. }');
  if (query.profession) {
    // validato in normalizeTerritoryInput; l'escape completo resta come seconda difesa
    const safe = sparqlString(query.profession);
    lines.push('  ?person wdt:P106 ?occ.');
    lines.push('  ?occ rdfs:label ?occLabel.');
    lines.push('  FILTER(LANG(?occLabel) IN ("it", "en"))');
    lines.push(`  FILTER(CONTAINS(LCASE(?occLabel), LCASE("${safe}")))`);
  } else {
    lines.push('  OPTIONAL { ?person wdt:P106 ?occ. }');
  }
  lines.push('  OPTIONAL { ?person wdt:P569 ?birthDate. }');
  lines.push('  SERVICE wikibase:label { bd:serviceParam wikibase:language "it,en". }');
  lines.push('  FILTER(BOUND(?personLabel))');
  lines.push('}');
  lines.push('ORDER BY ?personLabel');
  lines.push(`LIMIT ${query.limit}`);
  lines.push(`OFFSET ${query.offset}`);
  return lines.join('\n');
}

async function runSparql(query, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await axios.get('https://query.wikidata.org/sparql', {
      ...SPARQL_HTTP,
      params: { query, format: 'json' }
    });
    if (res.status === 200) return res.data?.results?.bindings || [];
    if (attempt < retries && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    throw new Error(`Wikidata SPARQL HTTP ${res.status} — restringi con regione o comune`);
  }
  return [];
}

async function resolvePersonLabelsBatch(qids, lang) {
  const unique = [...new Set(qids.filter(Boolean))];
  if (!unique.length) return {};
  const res = await axios.get('https://www.wikidata.org/w/api.php', {
    ...HTTP,
    params: {
      action: 'wbgetentities',
      ids: unique.slice(0, 50).join('|'),
      props: 'labels',
      languages: 'it|en',
      format: 'json',
      origin: '*'
    }
  });
  const map = {};
  for (const [id, entity] of Object.entries(res.data?.entities || {})) {
    map[id] = pickText(entity.labels, lang) || id;
  }
  return map;
}

function isQidLabel(name) {
  return /^Q\d+$/i.test(String(name || '').trim());
}

function parseBindingRow(row, idx, offset) {
  const qid = (row.person?.value || '').replace('http://www.wikidata.org/entity/', '');
  const rawName = row.personLabel?.value || qid;
  const birthDateRaw = row.birthDate?.value;
  let birthYear = null;
  if (birthDateRaw) {
    const m = birthDateRaw.match(/^(\d{4})/);
    if (m) birthYear = +m[1];
  }
  return {
    id: `REG-${String(offset + idx + 1).padStart(4, '0')}`,
    wikidataId: qid,
    name: rawName,
    _needsLabel: isQidLabel(rawName),
    birthMunicipality: row.birthPlaceLabel?.value || null,
    birthPlaceQid: row.birthPlace?.value?.split('/').pop() || null,
    residenceMunicipality: row.residenceLabel?.value || null,
    residenceQid: row.residence?.value?.split('/').pop() || null,
    occupation: row.occupationLabel?.value || null,
    birthYear,
    confidence: row.birthPlaceLabel?.value ? 'medium' : 'low',
    confidenceScore: row.birthPlaceLabel?.value ? 55 : 35,
    sources: [
      {
        name: 'Wikidata SPARQL',
        url: `https://www.wikidata.org/wiki/${qid}`,
        reliability: 'high'
      }
    ],
    gaps: row.birthPlaceLabel?.value
      ? []
      : ['Comune di nascita non presente in Wikidata per questo record'],
    wikidataUrl: `https://www.wikidata.org/wiki/${qid}`
  };
}

async function fetchCountryWikipediaPeople(countryQid, query) {
  const categories = COUNTRY_WIKI_CATEGORIES[countryQid] || [`Category:People of ${query.country}`];
  const people = [];
  for (const cmtitle of categories) {
    const res = await axios.get('https://it.wikipedia.org/w/api.php', {
      ...HTTP,
      params: {
        action: 'query',
        list: 'categorymembers',
        cmtitle,
        cmlimit: Math.min(50, query.limit + query.offset),
        cmtype: 'page',
        format: 'json',
        origin: '*'
      }
    });
    const members = res.data?.query?.categorymembers || [];
    const slice = members.slice(query.offset, query.offset + query.limit);
    if (!slice.length) continue;

    const pageids = slice.map((m) => m.pageid).join('|');
    const props = await axios.get('https://it.wikipedia.org/w/api.php', {
      ...HTTP,
      params: {
        action: 'query',
        pageids,
        prop: 'pageprops|info',
        inprop: 'url',
        format: 'json',
        origin: '*'
      }
    });
    const pages = props.data?.query?.pages || {};

    slice.forEach((m, i) => {
      if (['Italiani', 'Persone italiane', 'Italian people', 'Francesi', 'French people'].includes(m.title)) {
        return;
      }
      const page = pages[m.pageid];
      const qid = page?.pageprops?.wikibase_item;
      people.push({
        id: `NAT-${String(query.offset + i + 1).padStart(4, '0')}`,
        wikidataId: qid || null,
        name: m.title,
        birthMunicipality: null,
        residenceMunicipality: null,
        occupation: null,
        birthYear: null,
        confidence: 'medium',
        confidenceScore: 45,
        sources: [
          {
            name: 'Wikipedia categoria nazionale',
            url: page?.fullurl || `https://it.wikipedia.org/wiki/${encodeURIComponent(m.title)}`,
            reliability: 'medium'
          }
        ],
        gaps: ['Comune di nascita: apri Scheda Wikidata per visualizzarlo'],
        wikipediaUrl: page?.fullurl,
        wikidataUrl: qid ? `https://www.wikidata.org/wiki/${qid}` : null
      });
    });
    if (people.length) break;
  }
  return people;
}

async function fetchWikipediaCategoryMembers(municipalityLabel, municipalityQuery) {
  const names = [...new Set([municipalityQuery, municipalityLabel].filter(Boolean))];
  const titles = [];
  for (const n of names) {
    titles.push(
      `Categoria:Persone di ${n}`,
      `Categoria:Nati a ${n}`,
      `Category:People from ${n}`,
      `Category:Births in ${n}`
    );
  }
  const people = [];
  for (const title of titles) {
    const res = await axios.get('https://it.wikipedia.org/w/api.php', {
      ...HTTP,
      params: {
        action: 'query',
        list: 'categorymembers',
        cmtitle: title,
        cmlimit: 30,
        cmtype: 'page',
        format: 'json',
        origin: '*'
      }
    });
    for (const m of res.data?.query?.categorymembers || []) {
      if (m.title.startsWith('Categoria:') || m.title.startsWith('Category:')) continue;
      people.push({
        id: `WIKI-${m.pageid}`,
        name: m.title,
        birthMunicipality: municipalityLabel,
        residenceMunicipality: null,
        occupation: null,
        birthYear: null,
        confidence: 'medium',
        confidenceScore: 50,
        sources: [{ name: 'Wikipedia categoria', url: `https://it.wikipedia.org/wiki/${encodeURIComponent(m.title)}`, reliability: 'medium' }],
        gaps: [`Voce Wikipedia in categoria "${title}" — verifica comune su Wikidata`],
        wikipediaUrl: `https://it.wikipedia.org/wiki/${encodeURIComponent(m.title)}`
      });
    }
    if (people.length) break;
  }
  return people;
}

async function fetchRegionWikipediaPeople(territory, query) {
  const label = territory.region?.label || territory.province?.label || query.region || query.province;
  const titles = [
    `Categoria:Persone del ${label}`,
    `Categoria:Persone della ${label}`,
    `Categoria:Nati nel ${label}`,
    `Categoria:Nati in ${label}`,
    `Category:People from ${label}`,
    `Category:Births in ${label}`
  ];
  const people = [];
  for (const cmtitle of titles) {
    const res = await axios.get('https://it.wikipedia.org/w/api.php', {
      ...HTTP,
      params: {
        action: 'query',
        list: 'categorymembers',
        cmtitle,
        cmlimit: Math.min(50, query.limit + query.offset),
        cmtype: 'page',
        format: 'json',
        origin: '*'
      }
    });
    const members = res.data?.query?.categorymembers || [];
    const slice = members.slice(query.offset, query.offset + query.limit);
    if (!slice.length) continue;

    const pageids = slice.map((m) => m.pageid).join('|');
    const props = await axios.get('https://it.wikipedia.org/w/api.php', {
      ...HTTP,
      params: { action: 'query', pageids, prop: 'pageprops|info', inprop: 'url', format: 'json', origin: '*' }
    });
    const pages = props.data?.query?.pages || {};

    slice.forEach((m, i) => {
      const page = pages[m.pageid];
      const qid = page?.pageprops?.wikibase_item;
      people.push({
        id: `REG-${String(query.offset + i + 1).padStart(4, '0')}`,
        wikidataId: qid || null,
        name: m.title,
        birthMunicipality: null,
        residenceMunicipality: null,
        occupation: null,
        birthYear: null,
        confidence: 'medium',
        confidenceScore: 48,
        sources: [{ name: `Wikipedia (${cmtitle})`, url: page?.fullurl, reliability: 'medium' }],
        gaps: ['Comune di nascita: apri Scheda Wikidata'],
        wikipediaUrl: page?.fullurl,
        wikidataUrl: qid ? `https://www.wikidata.org/wiki/${qid}` : null
      });
    });
    if (people.length) break;
  }
  return people;
}

async function runPublicInfoRegistrySearch(input, { lang } = {}) {
  const started = Date.now();
  const query = normalizeTerritoryInput(input, lang);
  const territory = await resolveTerritory(query);
  const isCountryOnly = !territory.municipality && !territory.region && !territory.province;

  let people = [];

  if (isCountryOnly) {
    people = await fetchCountryWikipediaPeople(territory.country.qid, query);
  } else if (territory.municipality) {
    const sparql = buildRegistrySparql(territory, query);
    const bindings = await runSparql(sparql);
    const rows = bindings.map((b, i) => parseBindingRow(b, i, query.offset));
    const needLabels = rows.filter((p) => p._needsLabel).map((p) => p.wikidataId);
    const labelMap = await resolvePersonLabelsBatch(needLabels);
    for (const p of rows) {
      if (p._needsLabel) p.name = labelMap[p.wikidataId] || p.name;
      delete p._needsLabel;
      if (!isQidLabel(p.name)) people.push(p);
    }
    if (!people.length) {
      const wikiPeople = await fetchWikipediaCategoryMembers(
        territory.municipality.label,
        query.municipality
      );
      people = wikiPeople.slice(0, query.limit);
    }
  } else if (territory.region || territory.province) {
    people = await fetchRegionWikipediaPeople(territory, query);
  }

  const beforeFilter = people.length;
  people = applyRegistryPostFilters(people, query);
  const filteredOut = beforeFilter - people.length;

  const withBirth = people.filter((p) => p.birthMunicipality).length;
  const limitations = [...REGISTRY_LIMITATIONS];
  if (territory.region || territory.province) {
    limitations.unshift(
      'Elenco regione/provincia via categorie Wikipedia. Per comune di nascita in tabella aggiungi il filtro Comune.'
    );
  } else if (isCountryOnly) {
    limitations.unshift(
      'Elenco nazionale da categorie Wikipedia. Per comune di nascita in tabella: filtra per comune o clicca Scheda Wikidata.'
    );
  }

  return {
    mode: 'registry',
    scanType: 'public_info_registry',
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - started,
    territory: {
      country: territory.country,
      region: territory.region,
      province: territory.province,
      municipality: territory.municipality,
      unresolved: territory.unresolved
    },
    query: {
      country: query.country,
      region: query.region,
      province: query.province,
      municipality: query.municipality,
      profession: query.profession,
      limit: query.limit,
      offset: query.offset
    },
    totalReturned: people.length,
    withBirthMunicipality: withBirth,
    filteredOut,
    appliedFilters: {
      country: query.country,
      region: query.region,
      province: query.province,
      municipality: query.municipality,
      profession: query.profession
    },
    people,
    pagination: {
      limit: query.limit,
      offset: query.offset,
      nextOffset: people.length >= query.limit ? query.offset + query.limit : null,
      prevOffset: query.offset >= query.limit ? query.offset - query.limit : null
    },
    limitations,
    note: 'Elenco territoriale da Wikidata (e categorie Wikipedia). Non sostituisce registri anagrafici.',
    status: 'success'
  };
}

// ------------------------------------------------------------------ figure pubbliche
// La ricerca per nome è limitata alle figure pubbliche: persone (Q5) con almeno una voce
// su Wikipedia. Niente dossier su privati cittadini (GDPR art. 5, 6 e 14).

/** true se l'entità ha almeno una voce su una Wikipedia (itwiki, enwiki, zh_yuewiki…). */
function hasWikipediaArticle(entity) {
  return Object.keys(entity?.sitelinks || {}).some((k) => /^[a-z]{2,3}(?:_[a-z]+)?wiki$/.test(k));
}

function isHuman(entity) {
  return (entity?.claims?.P31 || []).some((c) => c.mainsnak?.datavalue?.value?.id === 'Q5');
}

function wikipediaUrlOf(entity, lang) {
  const links = entity?.sitelinks || {};
  const pref = lang === 'en' ? ['enwiki', 'itwiki'] : ['itwiki', 'enwiki'];
  for (const key of pref) {
    if (links[key]?.title) {
      const host = key.replace(/wiki$/, '');
      return `https://${host}.wikipedia.org/wiki/${encodeURIComponent(links[key].title.replace(/ /g, '_'))}`;
    }
  }
  const any = Object.keys(links).find((k) => /^[a-z]{2,3}wiki$/.test(k));
  return any ? `https://${any.replace(/wiki$/, '')}.wikipedia.org/wiki/${encodeURIComponent(links[any].title.replace(/ /g, '_'))}` : null;
}

function pickText(map, lang) {
  const order = lang === 'en' ? ['en', 'it'] : ['it', 'en'];
  for (const l of order) if (map?.[l]?.value) return map[l].value;
  return null;
}

function yearOf(entity, prop) {
  const time = entity?.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value?.time;
  const m = time && String(time).match(/^\+?(\d{4})/);
  return m ? +m[1] : null;
}

const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'’.-]{1,79}$/u;

/**
 * Cerca figure pubbliche per nome su Wikidata. Restituisce solo persone con una voce
 * su Wikipedia: nessuna informazione su privati cittadini.
 */
async function runPublicFigureSearch(input, { lang } = {}) {
  const started = Date.now();
  const name = String(input?.name || '').trim().replace(/\s+/g, ' ');
  if (!NAME_RE.test(name)) {
    throw userError(t(lang, 'Scrivi nome e cognome della figura pubblica (2-80 caratteri, solo lettere, spazi, apostrofi, punti e trattini).'));
  }
  const res = await axios.get('https://www.wikidata.org/w/api.php', {
    ...HTTP,
    params: {
      action: 'wbsearchentities',
      search: name,
      language: lang === 'en' ? 'en' : 'it',
      uselang: lang === 'en' ? 'en' : 'it',
      type: 'item',
      limit: 20,
      format: 'json',
      origin: '*'
    }
  });
  const ids = (res.data?.search || []).map((h) => h.id).filter((id) => QID_RE.test(id));
  let people = [];
  if (ids.length) {
    const ent = await axios.get('https://www.wikidata.org/w/api.php', {
      ...HTTP,
      params: {
        action: 'wbgetentities',
        ids: ids.join('|'),
        props: 'labels|descriptions|claims|sitelinks',
        languages: 'it|en',
        format: 'json',
        origin: '*'
      }
    });
    const entities = ent.data?.entities || {};
    people = ids
      .map((id) => entities[id])
      .filter((e) => e && isHuman(e) && hasWikipediaArticle(e))
      .slice(0, 10)
      .map((e) => ({
        wikidataId: e.id,
        name: pickText(e.labels, lang) || e.id,
        description: pickText(e.descriptions, lang),
        birthYear: yearOf(e, 'P569'),
        deathYear: yearOf(e, 'P570'),
        wikipediaUrl: wikipediaUrlOf(e, lang),
        wikidataUrl: `https://www.wikidata.org/wiki/${e.id}`
      }));
  }
  return {
    mode: 'public_figure',
    scanType: 'public_figure_search',
    timestamp: new Date().toISOString(),
    scanDurationMs: Date.now() - started,
    query: { name },
    totalReturned: people.length,
    people,
    limitations: [
      t(lang, 'Sono mostrate solo persone con una voce su Wikipedia (figure pubbliche). I privati cittadini sono esclusi.'),
      t(lang, 'Omonimie possibili: controlla descrizione e voce di Wikipedia prima di trarre conclusioni.'),
      t(lang, 'I dati vengono da Wikidata e possono essere incompleti o sbagliati: verifica sempre la fonte.')
    ],
    status: 'success'
  };
}

async function runPublicInfoPersonDetail(wikidataId, { lang } = {}) {
  const qid = String(wikidataId || '').trim().replace(/^.*:/, '').toUpperCase();
  if (!QID_RE.test(qid)) throw userError(t(lang, 'ID Wikidata non valido (esempio: Q7186).'));

  const res = await axios.get(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`, HTTP);
  const entity = res.data?.entities?.[qid];
  if (!entity) throw userError(t(lang, 'Voce Wikidata non trovata.'), 404);
  if (!isHuman(entity) || !hasWikipediaArticle(entity)) {
    throw userError(t(lang, 'La scheda è disponibile solo per figure pubbliche con una voce su Wikipedia.'), 403);
  }

  const label = pickText(entity.labels, lang) || qid;
  const description = pickText(entity.descriptions, lang);
  const claims = entity.claims || {};

  const getClaimLabels = async (prop) => {
    const ids = (claims[prop] || [])
      .map((c) => c.mainsnak?.datavalue?.value?.id)
      .filter((id) => QID_RE.test(String(id || '')))
      .slice(0, 5);
    if (!ids.length) return [];
    const labels = await resolvePersonLabelsBatch(ids, lang);
    return ids.map((id) => ({
      qid: id,
      label: labels[id] || id,
      url: `https://www.wikidata.org/wiki/${id}`
    }));
  };

  // Niente residenza (P551): non serve a capire il ruolo pubblico di una persona (minimizzazione)
  const [birthPlaces, occupations, citizenships, employers] = await Promise.all([
    getClaimLabels('P19'),
    getClaimLabels('P106'),
    getClaimLabels('P27'),
    getClaimLabels('P108')
  ]);

  return {
    mode: 'person_detail',
    scanType: 'public_info_person_detail',
    wikidataId: qid,
    name: label,
    description,
    birthYear: yearOf(entity, 'P569'),
    deathYear: yearOf(entity, 'P570'),
    birthPlaces,
    occupations,
    citizenships,
    employers,
    wikidataUrl: `https://www.wikidata.org/wiki/${qid}`,
    wikipediaUrl: wikipediaUrlOf(entity, lang),
    sources: [{ name: 'Wikidata EntityData', url: `https://www.wikidata.org/wiki/${qid}`, reliability: 'high' }],
    status: 'success'
  };
}

module.exports = {
  runPublicInfoRegistrySearch,
  runPublicInfoPersonDetail,
  runPublicFigureSearch,
  normalizeTerritoryInput,
  buildRegistrySparql,
  sparqlString,
  hasWikipediaArticle,
  PROFESSION_RE
};

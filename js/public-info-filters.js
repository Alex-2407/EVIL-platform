/**
 * Filtri condivisi — dossier e elenco territoriale
 */
const COUNTRY_ISO = {
  italia: 'IT',
  italy: 'IT',
  francia: 'FR',
  france: 'FR',
  germania: 'DE',
  germany: 'DE',
  spagna: 'ES',
  spain: 'ES',
  'stati uniti': 'US',
  usa: 'US',
  'united states': 'US',
  'regno unito': 'GB',
  uk: 'GB',
  'united kingdom': 'GB'
};

function normalizeForMatch(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function textMatch(hay, needle) {
  if (!needle) return true;
  const h = normalizeForMatch(hay);
  const n = normalizeForMatch(needle);
  if (!n) return true;
  if (h.includes(n)) return true;
  const aliases = {
    italia: ['italy', 'italian', ' it ', ' q38'],
    polonia: ['poland', 'polish', 'polska'],
    francia: ['france', 'french'],
    roma: ['rome'],
    milano: ['milan'],
    napoli: ['naples'],
    torino: ['turin'],
    firenze: ['florence']
  };
  for (const [k, vals] of Object.entries(aliases)) {
    if (n.includes(k) || k.includes(n)) {
      if (vals.some((v) => h.includes(v))) return true;
    }
  }
  return false;
}

function countryNameToIso(name) {
  if (!name) return null;
  return COUNTRY_ISO[normalizeForMatch(name)] || null;
}

function buildAugmentedSearch(query) {
  const { fullName, filters = {} } = query;
  return [fullName, filters.city, filters.province, filters.region, filters.country, filters.profession, filters.company]
    .filter(Boolean)
    .join(' ');
}

function buildTerritorySearch(term, country) {
  return [term, country].filter(Boolean).join(' ');
}

function getActiveFilters(filters = {}) {
  return Object.entries(filters).filter(([k, v]) => v && k !== 'timeRange');
}

function candidateHaystack(c) {
  return JSON.stringify({
    label: c.label,
    meta: c.meta,
    categories: c.categories,
    birthMunicipality: c.birthMunicipality,
    residenceMunicipality: c.residenceMunicipality,
    occupation: c.occupation
  });
}

function candidateMatchesFilters(c, query) {
  const { filters } = query;
  const hay = candidateHaystack(c);
  const failed = [];

  if (filters.city && !textMatch(hay, filters.city)) failed.push('city');
  if (filters.province && !textMatch(hay, filters.province)) failed.push('province');
  if (filters.region && !textMatch(hay, filters.region)) failed.push('region');
  if (filters.country) {
    const iso = countryNameToIso(filters.country);
    const countryOk =
      textMatch(hay, filters.country) ||
      (iso && (textMatch(hay, iso) || (c.categories?.organizations || []).some((o) => String(o.country || '').toUpperCase() === iso)));
    const citizenship = c.meta?.citizenship;
    if (!countryOk && citizenship && textMatch(citizenship, filters.country)) {
      /* ok via Wikidata citizenship */
    } else if (!countryOk) failed.push('country');
  }
  if (filters.profession && !textMatch(hay, filters.profession)) failed.push('profession');
  if (filters.company) {
    const orgHit = (c.categories?.organizations || []).some((o) =>
      textMatch(String(o.name || o), filters.company)
    );
    if (!orgHit && !textMatch(hay, filters.company)) failed.push('company');
  }
  return failed;
}

function applyDossierFilters(candidates, query) {
  if (!getActiveFilters(query.filters).length) {
    return { matched: candidates, excluded: [], filtersApplied: false };
  }
  const matched = [];
  const excluded = [];
  for (const c of candidates) {
    const failed = candidateMatchesFilters(c, query);
    if (!failed.length) matched.push(c);
    else excluded.push({ ...c, filterMismatch: failed });
  }
  return { matched, excluded, filtersApplied: true };
}

function applyRegistryPostFilters(people, query) {
  let out = [...people];
  const { profession, municipality, region, province, country } = query;

  if (profession) {
    out = out.filter((p) => textMatch(JSON.stringify({ occupation: p.occupation, name: p.name }), profession));
  }
  if (municipality) {
    out = out.filter(
      (p) => textMatch(p.birthMunicipality, municipality) || textMatch(p.residenceMunicipality, municipality)
    );
  }

  return out;
}

module.exports = {
  normalizeForMatch,
  textMatch,
  countryNameToIso,
  buildAugmentedSearch,
  buildTerritorySearch,
  getActiveFilters,
  candidateMatchesFilters,
  applyDossierFilters,
  applyRegistryPostFilters
};

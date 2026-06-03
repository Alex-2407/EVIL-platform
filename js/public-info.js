/**
 * EVIL Public Info — elenco territoriale + dossier
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let lastReport = null;
  let uiMode = 'registry';
  let registryOffset = 0;

  const CAT_LABELS = {
    professional_profiles: 'Profili professionali',
    websites: 'Siti web',
    public_quotes: 'Citazioni pubbliche',
    organizations: 'Organizzazioni',
    social_profiles: 'Profili social (API)',
    public_images: 'Immagini pubbliche',
    articles_publications: 'Articoli / pubblicazioni',
    associated_domains: 'Domini associati',
    corporate_data: 'Dati aziendali pubblici'
  };

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function log(msg, type) {
    const box = $('piLog');
    box.classList.add('is-active');
    const line = document.createElement('div');
    line.className = 'sc-log__line sc-log__line--' + (type || 'run');
    line.textContent = `[${new Date().toLocaleTimeString('it-IT')}] ${msg}`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  function bindSections(root) {
    (root || document).querySelectorAll('.sc-section__head').forEach((head) => {
      head.addEventListener('click', () => {
        const body = head.nextElementSibling;
        body.hidden = !body.hidden;
      });
    });
  }

  function setMode(mode) {
    uiMode = mode;
    $('piTabRegistry')?.classList.toggle('is-active', mode === 'registry');
    $('piTabDossier')?.classList.toggle('is-active', mode === 'dossier');
    $('piPanelRegistry').hidden = mode !== 'registry';
    $('piPanelDossier').hidden = mode !== 'dossier';
    $('piScanBtn').textContent = mode === 'registry' ? 'Carica elenco' : 'Avvia dossier OSINT';
    $('piMeta').textContent =
      mode === 'registry'
        ? 'Wikidata SPARQL · comune nascita/residenza · paginazione 50 · ~5–25 s'
        : 'OpenAlex · ORCID · Wikipedia · Crossref · ~5–20 s';
    syncBtn();
  }

  function syncBtn() {
    const auth = $('piAuth').checked;
    if (uiMode === 'registry') {
      $('piScanBtn').disabled = !auth || !$('piRegCountry').value.trim();
    } else {
      $('piScanBtn').disabled = !auth || !$('piFirstName').value.trim() || !$('piLastName').value.trim();
    }
  }

  function renderRegistryReport(data) {
    lastReport = data;
    registryOffset = data.query?.offset || 0;
    const t = data.territory || {};
    const terrLine = [
      t.country?.label,
      t.region?.label,
      t.province?.label,
      t.municipality?.label
    ]
      .filter(Boolean)
      .join(' → ');

    const rows = (data.people || [])
      .map(
        (p) => `<tr>
          <td>${esc(p.id)}</td>
          <td><strong>${esc(p.name)}</strong>${p.wikidataId ? `<br><span class="sc-muted">${esc(p.wikidataId)}</span>` : ''}</td>
          <td>${esc(p.birthMunicipality || '—')}</td>
          <td>${esc(p.residenceMunicipality || '—')}</td>
          <td>${esc(p.occupation || '—')}</td>
          <td>${esc(p.birthYear || '—')}</td>
          <td class="pi-conf--${esc(p.confidence)}">${esc(p.confidence)}</td>
          <td>${p.wikidataId ? `<button type="button" class="pi-detail-btn" data-qid="${esc(p.wikidataId)}">Scheda</button>` : p.wikipediaUrl ? `<a class="evil-external-link" href="${esc(p.wikipediaUrl)}" target="_blank" rel="noopener">Wiki</a>` : '—'}</td>
        </tr>`
      )
      .join('');

    const limitList = (data.limitations || []).map((l) => `<li>${esc(l)}</li>`).join('');
    const pag = data.pagination || {};

    const q = data.query || {};
    const applied = data.appliedFilters || {};
    const filterLine = Object.entries(applied)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');

    $('piResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring sc-score-ring--b">
          <span class="sc-score-ring__num">${data.totalReturned}</span>
          <span class="sc-score-ring__grade">Persone</span>
        </div>
        <div>
          <div class="sc-summary-grid">
            <div><div class="sc-kv__label">Territorio</div><div class="sc-kv__val">${esc(terrLine)}</div></div>
            <div><div class="sc-kv__label">Con comune nascita</div><div class="sc-kv__val">${data.withBirthMunicipality ?? 0}</div></div>
            <div><div class="sc-kv__label">Filtri attivi</div><div class="sc-kv__val">${esc(filterLine || 'solo nazione')}</div></div>
            <div><div class="sc-kv__label">Durata</div><div class="sc-kv__val">${esc(data.scanDurationMs)} ms</div></div>
          </div>
          <div class="sc-export-row">
            <button type="button" class="sc-btn sc-btn--ghost" id="piExportJson">Esporta JSON elenco</button>
          </div>
        </div>
      </div>
      <p class="sc-callout"><strong>Nota:</strong> ${esc(data.note)}</p>
      ${limitList ? `<div class="sc-callout sc-callout--muted"><ul class="sc-limit-list">${limitList}</ul></div>` : ''}
      <div class="sc-section">
        <div class="sc-section__head"><h2>Elenco persone (fonte Wikidata/Wikipedia)</h2></div>
        <div class="sc-section__body" style="overflow-x:auto">
          <table class="pi-registry-table">
            <thead><tr>
              <th>ID</th><th>Nome</th><th>Comune nascita</th><th>Residenza</th><th>Professione</th><th>Anno</th><th>Conf.</th><th></th>
            </tr></thead>
            <tbody>${rows || '<tr><td colspan="8">Nessun record — prova ad aggiungere comune o regione.</td></tr>'}</tbody>
          </table>
          <div class="pi-pagination">
            ${pag.prevOffset != null ? `<button type="button" class="sc-btn sc-btn--ghost" id="piPrevPage">← Precedenti</button>` : ''}
            ${pag.nextOffset != null ? `<button type="button" class="sc-btn sc-btn--ghost" id="piNextPage">Successivi →</button>` : ''}
          </div>
        </div>
      </div>`;

    $('piResults').classList.add('is-active');
    bindSections($('piResults'));

    document.getElementById('piExportJson')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `evil-elenco-${Date.now()}.json`;
      a.click();
    });
    document.getElementById('piPrevPage')?.addEventListener('click', () => runRegistry(pag.prevOffset));
    document.getElementById('piNextPage')?.addEventListener('click', () => runRegistry(pag.nextOffset));
    $('piResults').querySelectorAll('.pi-detail-btn').forEach((btn) => {
      btn.addEventListener('click', () => loadPersonDetail(btn.dataset.qid));
    });
  }

  async function loadPersonDetail(wikidataId) {
    $('piDetail').innerHTML = '<p class="sc-muted">Caricamento scheda…</p>';
    $('piDetail').classList.add('is-active');
    try {
      const d = await EvilTools.postToolJson('/api/osint-search', { mode: 'person_detail', wikidataId });
      const list = (arr) => (arr || []).map((x) => `<li><a class="evil-external-link" href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.label)}</a></li>`).join('') || '<li>—</li>';
      $('piDetail').innerHTML = `
        <div class="sc-section">
          <div class="sc-section__head"><h2>Scheda ${esc(d.wikidataId)} — ${esc(d.name)}</h2></div>
          <div class="sc-section__body">
            ${d.description ? `<p>${esc(d.description)}</p>` : ''}
            <div class="sc-summary-grid">
              <div><div class="sc-kv__label">Anno nascita</div><div class="sc-kv__val">${esc(d.birthYear || '—')}</div></div>
            </div>
            <p><strong>Luoghi di nascita</strong></p><ul>${list(d.birthPlaces)}</ul>
            <p><strong>Residenze</strong></p><ul>${list(d.residences)}</ul>
            <p><strong>Professioni</strong></p><ul>${list(d.occupations)}</ul>
            <p><strong>Cittadinanze</strong></p><ul>${list(d.citizenships)}</ul>
            <p><strong>Organizzazioni</strong></p><ul>${list(d.employers)}</ul>
            <p><a class="evil-external-link sc-btn sc-btn--ghost" href="${esc(d.wikidataUrl)}" target="_blank" rel="noopener">Apri Wikidata →</a></p>
          </div>
        </div>`;
      bindSections($('piDetail'));
      log(`Scheda ${d.wikidataId} caricata`, 'ok');
    } catch (err) {
      $('piDetail').innerHTML = `<div class="sc-callout">${esc(err.message)}</div>`;
    }
  }

  async function runRegistry(offset) {
    registryOffset = offset || 0;
    const body = {
      mode: 'registry',
      country: $('piRegCountry').value.trim(),
      region: $('piRegRegion').value.trim() || undefined,
      province: $('piRegProvince').value.trim() || undefined,
      municipality: $('piRegMunicipality').value.trim() || undefined,
      profession: $('piRegProfession').value.trim() || undefined,
      limit: 50,
      offset: registryOffset
    };
    $('piScanBtn').disabled = true;
    $('piResults').innerHTML = '';
    $('piDetail').innerHTML = '';
    try {
      log('Risoluzione territorio Wikidata…', 'run');
      log('Query SPARQL elenco persone…', 'run');
      const data = await EvilTools.postToolJson('/api/osint-search', body);
      log(`${data.totalReturned} record · ${data.withBirthMunicipality} con comune nascita`, 'ok');
      renderRegistryReport(data);
      window.progressManager?.logActivity?.('osint_collection', { mode: body.mode, total: data.totalReturned });
    } catch (err) {
      log(err.message, 'err');
      const hint =
        /timeout/i.test(err.message)
          ? '<br><span class="sc-muted">Wikidata può essere lento: riprova con comune obbligatorio (es. Roma) o attendi e riprova.</span>'
          : '';
      $('piResults').innerHTML = `<div class="sc-callout"><strong>Elenco non disponibile</strong><br>${esc(err.message)}${hint}</div>`;
      $('piResults').classList.add('is-active');
    } finally {
      syncBtn();
    }
  }

  function formatCatItem(item) {
    if (typeof item === 'string') return esc(item);
    const parts = [];
    if (item.title) parts.push(`<strong>${esc(item.title)}</strong>`);
    if (item.name) parts.push(esc(item.name));
    if (item.text) parts.push(esc(item.text));
    if (item.url) parts.push(`<a class="evil-external-link" href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.url)}</a>`);
    return parts.join(' ') || esc(JSON.stringify(item));
  }

  function renderCandidate(c) {
    const cats = Object.entries(c.categories || {})
      .filter(([, items]) => items?.length)
      .map(
        ([key, items]) =>
          `<div class="pi-cat-block"><h4>${esc(CAT_LABELS[key] || key)}</h4><ul>${items.map((i) => `<li>${formatCatItem(i)}</li>`).join('')}</ul></div>`
      )
      .join('');
    return `<article class="pi-candidate"><div class="pi-candidate__head"><span class="pi-candidate__id">${esc(c.id)}</span> <strong>${esc(c.label)}</strong> <span class="pi-conf--${esc(c.confidence)}">${esc(c.confidence)}</span></div><div class="pi-cat-grid">${cats}</div></article>`;
  }

  function renderDossierReport(data) {
    lastReport = data;
    const q = data.query || {};
    const f = q.filters || {};
    const filterLine = Object.entries(f)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
    const candidates = (data.candidates || []).map(renderCandidate).join('');
    const excluded =
      data.excludedByFilters > 0
        ? `<p class="sc-muted">${data.excludedByFilters} schede escluse dai filtri${filterLine ? ` (${esc(filterLine)})` : ''}.</p>`
        : '';
    $('piResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring sc-score-ring--b"><span class="sc-score-ring__num">${data.candidateCount}</span><span class="sc-score-ring__grade">Schede</span></div>
        <div><p class="sc-muted">${esc(q.fullName)}${filterLine ? ` · Filtri: ${esc(filterLine)}` : ''}</p>${excluded}</div>
      </div>
      <div class="sc-section"><div class="sc-section__head"><h2>Identità candidate</h2></div><div class="sc-section__body">${candidates || '<p class="sc-muted">Nessuna corrispondenza — modifica i filtri.</p>'}</div></div>`;
    $('piResults').classList.add('is-active');
  }

  async function runDossier() {
    const body = {
      firstName: $('piFirstName').value.trim(),
      lastName: $('piLastName').value.trim(),
      filters: {
        city: $('piCity').value.trim() || undefined,
        province: $('piProvince').value.trim() || undefined,
        region: $('piRegion').value.trim() || undefined,
        country: $('piCountry').value.trim() || undefined,
        profession: $('piProfession').value.trim() || undefined,
        company: $('piCompany').value.trim() || undefined,
        timeRange: $('piTimeRange').value.trim() || undefined
      },
      aliases: $('piAliases').value.split(/[,;\s]+/).filter(Boolean).slice(0, 5)
    };
    $('piScanBtn').disabled = true;
    $('piLog').innerHTML = '';
    $('piResults').innerHTML = '';
    try {
      log('Interrogazione fonti con filtri…', 'run');
      const data = await EvilTools.postToolJson('/api/osint-search', body);
      log(`${data.candidateCount} schede${data.excludedByFilters ? ` (${data.excludedByFilters} escluse)` : ''}`, 'ok');
      renderDossierReport(data);
    } catch (err) {
      log(err.message, 'err');
    } finally {
      syncBtn();
    }
  }

  function runSearch() {
    if (!$('piAuth').checked) {
      alert('Conferma autorizzazione.');
      return;
    }
    $('piLog').innerHTML = '';
    if (uiMode === 'registry') runRegistry(0);
    else runDossier();
  }

  function resetForm() {
    ['piRegCountry', 'piRegRegion', 'piRegProvince', 'piRegMunicipality', 'piRegProfession', 'piFirstName', 'piLastName', 'piCity', 'piProvince', 'piRegion', 'piCountry', 'piProfession', 'piCompany', 'piTimeRange', 'piAliases'].forEach((id) => {
      if ($(id)) $(id).value = '';
    });
    $('piAuth').checked = false;
    $('piLog').innerHTML = '';
    $('piResults').innerHTML = '';
    $('piDetail').innerHTML = '';
    registryOffset = 0;
    syncBtn();
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('piAuth').addEventListener('change', syncBtn);
    ['piRegCountry', 'piFirstName', 'piLastName'].forEach((id) => $(id)?.addEventListener('input', syncBtn));
    $('piScanBtn').addEventListener('click', runSearch);
    $('piResetBtn').addEventListener('click', resetForm);
    $('piTabRegistry').addEventListener('click', () => setMode('registry'));
    $('piTabDossier').addEventListener('click', () => setMode('dossier'));
    setMode('registry');
  });
})();

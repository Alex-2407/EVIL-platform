/**
 * EVIL — La tua esposizione online (public-info.html)
 * - Autovalutazione: ricerche su sé stessi da aprire nel browser e checklist con punteggio,
 *   tutto locale (nessun dato inviato o salvato).
 * - Figure pubbliche: ricerca su Wikidata limitata a persone con una voce su Wikipedia
 *   (POST /api/osint-search, mode public_figure / person_detail).
 */
(function () {
  'use strict';

  const { t, fmtNumber } = window.EVIL_I18N;
  const $ = (id) => document.getElementById(id);
  let uiMode = 'self';

  // peso: quanto la voce aumenta il rischio (furto d'identità, phishing mirato, stalking)
  const CHECKLIST = [
    {
      id: 'realName',
      weight: 1,
      label: () => t('Ho profili social pubblici con nome e cognome reali'),
      tip: () => t('Rendi privati i profili personali o limita chi vede post, amici e foto.'),
    },
    {
      id: 'birthDate',
      weight: 2,
      label: () => t('La mia data di nascita completa è visibile online'),
      tip: () => t('Nascondi giorno e anno di nascita: servono spesso per verificare l\'identità e recuperare account.'),
    },
    {
      id: 'address',
      weight: 3,
      label: () => t('Il mio indirizzo di casa si trova online'),
      tip: () => t('Chiedi la rimozione ai siti che lo pubblicano e non indicarlo in annunci o curriculum pubblici.'),
    },
    {
      id: 'phone',
      weight: 2,
      label: () => t('Il mio numero di cellulare personale è pubblicato'),
      tip: () => t('Toglilo dai profili pubblici: è usato per smishing e per attacchi di SIM swap.'),
    },
    {
      id: 'email',
      weight: 1,
      label: () => t('La mia email personale compare su pagine pubbliche (CV, forum, siti)'),
      tip: () => t('Usa un indirizzo diverso per i contatti pubblici e uno privato per banca e account importanti.'),
    },
    {
      id: 'breach',
      weight: 2,
      label: () => t('La mia email compare in un data breach noto (verificalo su haveibeenpwned.com)'),
      tip: () => t('Cambia la password dei servizi coinvolti e attiva l\'autenticazione a più fattori.'),
    },
    {
      id: 'reuse',
      weight: 3,
      label: () => t('Uso la stessa password, o quasi, su più siti'),
      tip: () => t('Usa un password manager e una password diversa per ogni servizio.'),
    },
    {
      id: 'username',
      weight: 1,
      label: () => t('Uso lo stesso username su molte piattaforme'),
      tip: () => t('Uno username unico rende facile collegare tra loro tutti i tuoi account: usane di diversi per ambiti diversi.'),
    },
    {
      id: 'location',
      weight: 2,
      label: () => t('Pubblico foto o post che rivelano dove sono in tempo reale o i luoghi che frequento'),
      tip: () => t('Pubblica a posteriori e togli la posizione dalle foto (metadati EXIF e geotag).'),
    },
    {
      id: 'family',
      weight: 2,
      label: () => t('Familiari o figli sono riconoscibili nelle mie foto pubbliche'),
      tip: () => t('Limita il pubblico dei post di famiglia ed evita nomi, scuole e luoghi abituali dei minori.'),
    },
    {
      id: 'work',
      weight: 1,
      label: () => t('Il mio profilo professionale descrive in dettaglio ruolo, strumenti e colleghi'),
      tip: () => t('Ruolo e tecnologie bastano: elenchi di sistemi interni e organigrammi aiutano il phishing mirato.'),
    },
    {
      id: 'mfa',
      weight: 2,
      label: () => t('Non ho attivato l\'autenticazione a più fattori su email e social'),
      tip: () => t('Attivala subito, preferendo app di autenticazione o chiavi di sicurezza agli SMS.'),
    },
  ];

  const esc = window.EVIL_UTILS.escapeHtml;

  function safeUrl(u) {
    return /^https:\/\//i.test(String(u || '')) ? String(u) : '';
  }

  function log(msg, type) {
    const box = $('piLog');
    box.classList.add('is-active');
    const line = document.createElement('div');
    line.className = 'sc-log__line sc-log__line--' + (type || 'run');
    line.textContent = msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  // ------------------------------------------------------------------ autovalutazione
  function renderSearchLinks() {
    const box = $('piSearchLinks');
    const name = $('piSelfName').value.trim().replace(/\s+/g, ' ');
    box.replaceChildren();
    if (name.length < 3) return;
    const q = encodeURIComponent(`"${name}"`);
    const links = [
      { label: t('Google: il tuo nome'), href: `https://www.google.com/search?q=${q}` },
      { label: t('Google Immagini'), href: `https://www.google.com/search?tbm=isch&q=${q}` },
      { label: t('DuckDuckGo'), href: `https://duckduckgo.com/?q=${q}` },
      { label: t('Bing'), href: `https://www.bing.com/search?q=${q}` },
    ];
    links.forEach((l) => {
      const a = document.createElement('a');
      a.className = 'sc-btn sc-btn--ghost evil-external-link';
      a.href = l.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = l.label;
      box.appendChild(a);
    });
    const hint = document.createElement('p');
    hint.className = 'sc-muted';
    hint.textContent = t('Annota cosa trovi: indirizzi, numeri di telefono, foto, vecchi profili. Puoi chiedere la rimozione al sito o, per i motori di ricerca, la deindicizzazione (diritto all\'oblio, art. 17 GDPR).');
    box.appendChild(hint);
  }

  function renderChecklist() {
    const box = $('piChecklist');
    box.replaceChildren();
    CHECKLIST.forEach((item) => {
      const label = document.createElement('label');
      label.className = 'pi-check';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = item.id;
      input.addEventListener('change', updateScore);
      const span = document.createElement('span');
      span.textContent = item.label();
      label.append(input, span);
      box.appendChild(label);
    });
    updateScore();
  }

  function updateScore() {
    const checked = Array.from($('piChecklist').querySelectorAll('input:checked')).map((el) => el.value);
    const items = CHECKLIST.filter((i) => checked.includes(i.id));
    const max = CHECKLIST.reduce((sum, i) => sum + i.weight, 0);
    const points = items.reduce((sum, i) => sum + i.weight, 0);
    const pct = Math.round((points / max) * 100);
    let level;
    let cls;
    if (pct === 0) {
      level = t('Esposizione minima');
      cls = 'low';
    } else if (pct < 25) {
      level = t('Esposizione bassa');
      cls = 'low';
    } else if (pct < 50) {
      level = t('Esposizione media');
      cls = 'medium';
    } else {
      level = t('Esposizione alta');
      cls = 'high';
    }

    const score = $('piScore');
    score.className = `pi-score pi-score--${cls}`;
    score.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = level;
    const span = document.createElement('span');
    span.textContent = t('Indice di esposizione: {pct} su 100', { pct: fmtNumber(pct) });
    score.append(strong, span);

    const advice = $('piAdvice');
    advice.replaceChildren();
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'sc-muted';
      p.textContent = t('Nessun punto spuntato. Ripeti il controllo ogni tanto: profili e servizi cambiano.');
      advice.appendChild(p);
      return;
    }
    const h = document.createElement('h3');
    h.textContent = t('Cosa fare, dalle azioni più importanti');
    const ol = document.createElement('ol');
    items
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .forEach((i) => {
        const li = document.createElement('li');
        li.textContent = i.tip();
        ol.appendChild(li);
      });
    advice.append(h, ol);
  }

  // ------------------------------------------------------------------ figure pubbliche
  function setMode(mode) {
    uiMode = mode;
    $('piTabSelf').classList.toggle('is-active', mode === 'self');
    $('piTabFigure').classList.toggle('is-active', mode === 'figure');
    $('piTabSelf').setAttribute('aria-selected', String(mode === 'self'));
    $('piTabFigure').setAttribute('aria-selected', String(mode === 'figure'));
    $('piPanelSelf').hidden = mode !== 'self';
    $('piPanelFigure').hidden = mode !== 'figure';
    ['piLog', 'piResults', 'piDetail'].forEach((id) => { $(id).hidden = mode !== 'figure'; });
    syncBtn();
  }

  function syncBtn() {
    $('piScanBtn').disabled = !$('piAuth').checked || $('piFigureName').value.trim().length < 2;
  }

  function years(p) {
    if (p.birthYear && p.deathYear) return `${p.birthYear}–${p.deathYear}`;
    if (p.birthYear) return t('nascita: {year}', { year: p.birthYear });
    return '—';
  }

  function renderFigures(data) {
    const people = data.people || [];
    const rows = people
      .map((p) => {
        const wiki = safeUrl(p.wikipediaUrl);
        return `<tr>
          <td><strong>${esc(p.name)}</strong></td>
          <td>${esc(p.description || '—')}</td>
          <td>${esc(years(p))}</td>
          <td class="pi-actions-cell">
            <button type="button" class="pi-detail-btn" data-qid="${esc(p.wikidataId)}">${esc(t('Scheda'))}</button>
            ${wiki ? `<a class="evil-external-link" href="${esc(wiki)}" target="_blank" rel="noopener">${esc(t('Wikipedia'))}</a>` : ''}
          </td>
        </tr>`;
      })
      .join('');
    const limits = (data.limitations || []).map((l) => `<li>${esc(l)}</li>`).join('');
    $('piResults').innerHTML = `
      <div class="sc-section">
        <div class="sc-section__head"><h2>${esc(t('Figure pubbliche trovate: {n}', { n: fmtNumber(people.length) }))}</h2></div>
        <div class="sc-section__body pi-table-wrap">
          <table class="pi-registry-table">
            <thead><tr>
              <th scope="col">${esc(t('Nome'))}</th><th scope="col">${esc(t('Descrizione'))}</th><th scope="col">${esc(t('Anni'))}</th><th scope="col"><span class="pi-sr-only">${esc(t('Azioni'))}</span></th>
            </tr></thead>
            <tbody>${rows || `<tr><td colspan="4">${esc(t('Nessuna figura pubblica con questo nome. Controlla l\'ortografia o prova con il nome completo.'))}</td></tr>`}</tbody>
          </table>
        </div>
      </div>
      ${limits ? `<div class="sc-callout sc-callout--limits"><ul>${limits}</ul></div>` : ''}`;
    $('piResults').classList.add('is-active');
    $('piResults').querySelectorAll('.pi-detail-btn').forEach((btn) => {
      btn.addEventListener('click', () => loadPersonDetail(btn.dataset.qid));
    });
  }

  async function loadPersonDetail(wikidataId) {
    const box = $('piDetail');
    box.innerHTML = `<p class="sc-muted">${esc(t('Caricamento della scheda…'))}</p>`;
    box.classList.add('is-active');
    try {
      const d = await window.EvilTools.postToolJson('/api/osint-search', { mode: 'person_detail', wikidataId });
      const list = (arr) =>
        (arr || [])
          .map((x) => {
            const u = safeUrl(x.url);
            return u
              ? `<li><a class="evil-external-link" href="${esc(u)}" target="_blank" rel="noopener">${esc(x.label)}</a></li>`
              : `<li>${esc(x.label)}</li>`;
          })
          .join('') || '<li>—</li>';
      const wiki = safeUrl(d.wikipediaUrl);
      const wd = safeUrl(d.wikidataUrl);
      box.innerHTML = `
        <div class="sc-section">
          <div class="sc-section__head"><h2>${esc(d.name)} <span class="sc-muted">${esc(d.wikidataId)}</span></h2></div>
          <div class="sc-section__body">
            ${d.description ? `<p>${esc(d.description)}</p>` : ''}
            <div class="sc-summary-grid">
              <div><div class="sc-kv__label">${esc(t('Anno di nascita'))}</div><div class="sc-kv__val">${esc(d.birthYear || '—')}</div></div>
              ${d.deathYear ? `<div><div class="sc-kv__label">${esc(t('Anno di morte'))}</div><div class="sc-kv__val">${esc(d.deathYear)}</div></div>` : ''}
            </div>
            <h3>${esc(t('Luogo di nascita'))}</h3><ul>${list(d.birthPlaces)}</ul>
            <h3>${esc(t('Professioni'))}</h3><ul>${list(d.occupations)}</ul>
            <h3>${esc(t('Cittadinanze'))}</h3><ul>${list(d.citizenships)}</ul>
            <h3>${esc(t('Organizzazioni'))}</h3><ul>${list(d.employers)}</ul>
            <p class="pi-detail-links">
              ${wiki ? `<a class="evil-external-link sc-btn sc-btn--ghost" href="${esc(wiki)}" target="_blank" rel="noopener">${esc(t('Apri Wikipedia'))}</a>` : ''}
              ${wd ? `<a class="evil-external-link sc-btn sc-btn--ghost" href="${esc(wd)}" target="_blank" rel="noopener">${esc(t('Apri Wikidata'))}</a>` : ''}
            </p>
            <p class="sc-muted">${esc(t('Dati di Wikidata: possono essere incompleti o sbagliati. Verifica sempre la fonte prima di citarli.'))}</p>
          </div>
        </div>`;
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      box.innerHTML = `<div class="sc-callout">${esc(err.message)}</div>`;
    }
  }

  async function runFigureSearch() {
    if (!$('piAuth').checked) return;
    const name = $('piFigureName').value.trim();
    $('piScanBtn').disabled = true;
    $('piLog').replaceChildren();
    $('piResults').innerHTML = '';
    $('piDetail').innerHTML = '';
    try {
      log(t('Ricerca su Wikidata in corso…'), 'run');
      const data = await window.EvilTools.postToolJson('/api/osint-search', { mode: 'public_figure', name });
      const n = data.totalReturned || 0;
      log(n === 1 ? t('1 figura pubblica trovata') : t('{n} figure pubbliche trovate', { n: fmtNumber(n) }), 'ok');
      renderFigures(data);
      window.progressManager?.logActivity?.('osint_collection', { mode: 'public_figure', total: n });
    } catch (err) {
      log(err.message, 'err');
      $('piResults').innerHTML = `<div class="sc-callout"><strong>${esc(t('Ricerca non riuscita'))}</strong><br>${esc(err.message)}</div>`;
      $('piResults').classList.add('is-active');
    } finally {
      syncBtn();
    }
  }

  function resetFigure() {
    $('piFigureName').value = '';
    $('piAuth').checked = false;
    $('piLog').replaceChildren();
    $('piLog').classList.remove('is-active');
    $('piResults').innerHTML = '';
    $('piDetail').innerHTML = '';
    syncBtn();
  }

  function init() {
    if (!$('piChecklist')) return;
    renderChecklist();
    $('piSelfName').addEventListener('input', renderSearchLinks);
    $('piAuth').addEventListener('change', syncBtn);
    $('piFigureName').addEventListener('input', syncBtn);
    $('piFigureName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !$('piScanBtn').disabled) runFigureSearch();
    });
    $('piScanBtn').addEventListener('click', runFigureSearch);
    $('piResetBtn').addEventListener('click', resetFigure);
    $('piTabSelf').addEventListener('click', () => setMode('self'));
    $('piTabFigure').addEventListener('click', () => setMode('figure'));
    setMode(uiMode);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

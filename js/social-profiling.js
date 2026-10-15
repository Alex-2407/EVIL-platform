/**
 * EVIL — Profilazione social (social-profiling.html)
 * Impronta digitale di uno username; il controllo dei data breach riguarda solo
 * l'email dell'account EVIL (il server usa quella della sessione: checkOwnEmail).
 */
(function () {
  'use strict';

  const { t, fmtNumber } = window.EVIL_I18N;
  const $ = (id) => document.getElementById(id);
  let lastReport = null;

  const esc = window.EVIL_UTILS.escapeHtml;

  function safeUrl(u) {
    return /^https:\/\//i.test(String(u || '')) ? String(u) : '';
  }

  function log(msg, type) {
    const box = $('spLog');
    box.classList.add('is-active');
    const line = document.createElement('div');
    line.className = 'sc-log__line sc-log__line--' + (type || 'run');
    line.textContent = msg;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  function gradeClass(g) {
    return 'sc-score-ring--' + String(g || 'f').toLowerCase();
  }

  const SEVERITY = {
    critical: { badge: 'fail', label: () => t('critica') },
    high: { badge: 'fail', label: () => t('alta') },
    medium: { badge: 'warn', label: () => t('media') },
    low: { badge: 'info', label: () => t('bassa') },
    info: { badge: 'info', label: () => t('informativa') },
  };
  const sev = (s) => SEVERITY[s] || SEVERITY.info;

  function bindSections(root) {
    root.querySelectorAll('.sc-section__head').forEach((head) => {
      head.addEventListener('click', () => {
        const body = head.nextElementSibling;
        body.hidden = !body.hidden;
      });
    });
  }

  function platformStatus(p) {
    if (p.found === true && p.confidence === 'high') return { label: t('Confermato (API)'), cls: 'sp-platform-card--found', badge: 'ok' };
    if (p.found === false && p.confidence === 'high') return { label: t('Assente (API)'), cls: 'sp-platform-card--absent', badge: 'info' };
    if (p.found === false) return { label: t('Probabilmente assente'), cls: 'sp-platform-card--absent', badge: 'info' };
    if (p.dataSource === 'http-head') return { label: t('Da verificare aprendo il link'), cls: 'sp-platform-card--unknown', badge: 'warn' };
    return { label: t('Esito incerto'), cls: 'sp-platform-card--unknown', badge: 'info' };
  }

  function renderReport(data) {
    lastReport = data;
    const sum = data.summary || {};

    const findingRows = (data.findings || [])
      .map((f) => `<div class="sc-finding sc-finding--${esc(f.severity)}"><strong>${esc(f.title)}</strong><span>${esc(f.detail)}</span></div>`)
      .join('');

    const breakdownRows = (data.scoreBreakdown || [])
      .filter((b) => b.delta !== 0)
      .map(
        (b) =>
          `<tr><td>${esc(b.label)}</td><td>${b.delta > 0 ? '+' : ''}${esc(b.delta)}</td><td><span class="sc-badge sc-badge--${sev(b.severity).badge}">${esc(sev(b.severity).label())}</span></td></tr>`
      )
      .join('');

    const platformCards = (data.platforms || [])
      .map((p) => {
        const st = platformStatus(p);
        const link = safeUrl(p.url);
        let meta = '';
        if (p.profile?.name) meta += `<p class="sc-muted">${esc(t('Nome mostrato: {name}', { name: p.profile.name }))}</p>`;
        if (p.profile?.publicRepos != null) meta += `<p class="sc-muted">${esc(t('Repository pubblici: {n}', { n: fmtNumber(p.profile.publicRepos) }))}</p>`;
        if (p.dataSource) meta += `<p class="sc-muted">${esc(t('Fonte: {source}', { source: p.dataSource }))}</p>`;
        if (p.note) meta += `<p class="sc-muted">${esc(p.note)}</p>`;
        return `<div class="sp-platform-card ${st.cls}">
          <div class="sp-platform-card__head">
            <strong>${esc(p.platform)}</strong>
            <span class="sc-badge sc-badge--${st.badge}">${esc(st.label)}</span>
          </div>
          ${link ? `<p class="sp-platform-card__link"><a class="evil-external-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(link)}</a></p>` : ''}
          ${meta}
        </div>`;
      })
      .join('');

    const searchLinks = (data.searchLinks || [])
      .filter((l) => safeUrl(l.url))
      .map((l) => `<li><a class="evil-external-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`)
      .join('');

    let breachBlock;
    const br = data.breaches || {};
    if (!data.email) {
      breachBlock = `<p class="sc-muted">${esc(t('Controllo non richiesto. Spunta l\'opzione per verificare l\'email del tuo account.'))}</p>`;
    } else if (!br.checked) {
      breachBlock = `<p class="sc-muted">${esc(br.reason || t('Controllo dei data breach non eseguito.'))}</p>`;
    } else if (br.breachCount === 0) {
      breachBlock = `<p class="sc-muted">${esc(t('L\'email del tuo account non compare in data breach noti a Have I Been Pwned.'))}</p>`;
    } else {
      breachBlock = (br.breaches || [])
        .map(
          (b) =>
            `<div class="sc-finding sc-finding--high"><strong>${esc(b.name)}</strong><span>${esc(b.date)} — ${esc((b.dataClasses || []).join(', '))}</span></div>`
        )
        .join('');
    }

    const limitList = (data.limitations || []).map((l) => `<li>${esc(l)}</li>`).join('');
    const footprintLabel =
      { high: t('Alta'), medium: t('Media'), low: t('Bassa'), minimal: t('Minima') }[data.footprint] || data.footprint;

    $('spResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring ${gradeClass(data.grade)}">
          <span class="sc-score-ring__num">${esc(Math.round(data.score))}</span>
          <span class="sc-score-ring__grade">${esc(t('Voto {grade}', { grade: data.grade }))}</span>
        </div>
        <div>
          <div class="sc-summary-grid">
            <div><div class="sc-kv__label">${esc(t('Username'))}</div><div class="sc-kv__val">@${esc(data.username)}</div></div>
            <div><div class="sc-kv__label">${esc(t('Impronta digitale'))}</div><div class="sc-kv__val">${esc(footprintLabel)}</div></div>
            <div><div class="sc-kv__label">${esc(t('Account confermati (API)'))}</div><div class="sc-kv__val">${esc(sum.confirmedFound ?? 0)}</div></div>
            <div><div class="sc-kv__label">${esc(t('Link da verificare'))}</div><div class="sc-kv__val">${esc(sum.manualLinks ?? 0)}</div></div>
            <div><div class="sc-kv__label">${esc(t('Durata'))}</div><div class="sc-kv__val">${esc(t('{ms} ms', { ms: fmtNumber(data.scanDurationMs) }))}</div></div>
          </div>
          <div class="sc-export-row">
            <button type="button" class="sc-btn sc-btn--ghost" id="spExportJson">${esc(t('Esporta JSON'))}</button>
          </div>
        </div>
      </div>

      <p class="sc-callout"><strong>${esc(t('Nota:'))}</strong> ${esc(data.note)}</p>
      ${limitList ? `<div class="sc-callout sc-callout--muted"><strong>${esc(t('Limiti'))}</strong><ul class="sc-limit-list">${limitList}</ul></div>` : ''}

      <div class="sc-section">
        <div class="sc-section__head"><h2>${esc(t('Risultati'))}</h2><span class="sc-badge sc-badge--info">${esc((data.findings || []).length)}</span></div>
        <div class="sc-section__body">${findingRows}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>${esc(t('Piattaforme ({n})', { n: sum.platformsChecked ?? 0 }))}</h2></div>
        <div class="sc-section__body">${platformCards}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>${esc(t('Data breach dell\'email del tuo account'))}</h2></div>
        <div class="sc-section__body">${breachBlock}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>${esc(t('Ricerca manuale'))}</h2></div>
        <div class="sc-section__body"><ul class="sc-limit-list">${searchLinks}</ul></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>${esc(t('Dettaglio del punteggio'))}</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th scope="col">${esc(t('Controllo'))}</th><th scope="col">${esc(t('Punti'))}</th><th scope="col">${esc(t('Severità'))}</th></tr></thead><tbody>${breakdownRows || `<tr><td colspan="3">${esc(t('Nessuna detrazione'))}</td></tr>`}</tbody></table></div>
      </div>
    `;

    $('spResults').classList.add('is-active');
    bindSections($('spResults'));
    $('spExportJson')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = href;
      link.download = `evil-social-${data.username}-${Date.now()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    });
  }

  function syncBtn() {
    $('spScanBtn').disabled = !$('spAuth').checked || !$('spUsername').value.trim();
  }

  async function runProfile() {
    const username = $('spUsername').value.trim();
    if (!username || !$('spAuth').checked) return;

    const btn = $('spScanBtn');
    btn.disabled = true;
    btn.textContent = t('Controllo in corso…');
    $('spLog').replaceChildren();
    $('spResults').classList.remove('is-active');
    $('spResults').innerHTML = '';

    try {
      [t('Controllo dello username'), t('Interrogazione delle API di GitHub e Reddit'), t('Controllo delle altre piattaforme'), t('Analisi dell\'impronta digitale')]
        .forEach((p) => log(`${p}…`, 'run'));
      const body = { username };
      if ($('spOwnEmail').checked) body.checkOwnEmail = true;
      const data = await window.EvilTools.postToolJson('/api/social-profile', body);
      log(t('Completato: voto {grade}, {n} account confermati', { grade: data.grade, n: data.summary?.confirmedFound ?? 0 }), 'ok');
      renderReport(data);
    } catch (err) {
      log(err.message, 'err');
      $('spResults').innerHTML = `<div class="sc-callout"><strong>${esc(t('Controllo non riuscito'))}</strong><br>${esc(err.message)}</div>`;
      $('spResults').classList.add('is-active');
    } finally {
      btn.textContent = t('Avvia il controllo');
      syncBtn();
    }
  }

  function resetForm() {
    $('spUsername').value = '';
    $('spOwnEmail').checked = false;
    $('spAuth').checked = false;
    $('spLog').replaceChildren();
    $('spLog').classList.remove('is-active');
    $('spResults').classList.remove('is-active');
    $('spResults').innerHTML = '';
    lastReport = null;
    syncBtn();
  }

  function init() {
    const user = $('spUsername');
    if (!user) return;
    $('spAuth').addEventListener('change', syncBtn);
    user.addEventListener('input', syncBtn);
    $('spScanBtn').addEventListener('click', runProfile);
    $('spResetBtn').addEventListener('click', resetForm);
    user.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !$('spScanBtn').disabled) runProfile();
    });
    syncBtn();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/**
 * EVIL Social Profiling — UI
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let lastReport = null;

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function log(msg, type) {
    const box = $('spLog');
    box.classList.add('is-active');
    const line = document.createElement('div');
    line.className = 'sc-log__line sc-log__line--' + (type || 'run');
    line.textContent = `[${new Date().toLocaleTimeString('it-IT')}] ${msg}`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  function gradeClass(g) {
    return 'sc-score-ring--' + String(g || 'f').toLowerCase();
  }

  function sevBadge(sev) {
    const map = { critical: 'fail', high: 'fail', medium: 'warn', low: 'info', info: 'info' };
    return map[sev] || 'info';
  }

  function bindSections() {
    document.querySelectorAll('.sc-section__head').forEach((head) => {
      head.addEventListener('click', () => {
        const body = head.nextElementSibling;
        body.hidden = !body.hidden;
      });
    });
  }

  function platformStatus(p) {
    if (p.found === true && p.confidence === 'high') return { label: 'Confermato (API)', cls: 'sp-platform-card--found', badge: 'ok' };
    if (p.found === false && p.confidence === 'high') return { label: 'Assente (API)', cls: 'sp-platform-card--absent', badge: 'info' };
    if (p.found === false) return { label: 'Probabile assente', cls: 'sp-platform-card--absent', badge: 'info' };
    if (p.dataSource === 'http-head') return { label: 'Link — verifica manuale', cls: 'sp-platform-card--unknown', badge: 'warn' };
    return { label: 'Inconclusivo', cls: 'sp-platform-card--unknown', badge: 'info' };
  }

  function renderReport(data) {
    lastReport = data;
    const sum = data.summary || {};

    const findingRows = (data.findings || [])
      .map(
        (f) =>
          `<div class="sc-finding sc-finding--${esc(f.severity)}"><strong>${esc(f.title)}</strong><span>${esc(f.detail)}</span></div>`
      )
      .join('');

    const breakdownRows = (data.scoreBreakdown || [])
      .filter((b) => b.delta !== 0)
      .map(
        (b) =>
          `<tr><td>${esc(b.label)}</td><td>${b.delta > 0 ? '+' : ''}${b.delta}</td><td><span class="sc-badge sc-badge--${sevBadge(b.severity)}">${esc(b.severity)}</span></td></tr>`
      )
      .join('');

    const platformCards = (data.platforms || [])
      .map((p) => {
        const st = platformStatus(p);
        let meta = '';
        if (p.profile?.name) meta += `<p class="sc-muted">Nome: ${esc(p.profile.name)}</p>`;
        if (p.profile?.publicRepos != null) meta += `<p class="sc-muted">Repo pubblici: ${esc(p.profile.publicRepos)}</p>`;
        if (p.dataSource) meta += `<p class="sc-muted">Fonte: ${esc(p.dataSource)}</p>`;
        if (p.note) meta += `<p class="sc-muted">${esc(p.note)}</p>`;
        if (p.httpStatus) meta += `<p class="sc-muted">HTTP ${esc(p.httpStatus)}</p>`;
        return `<div class="sp-platform-card ${st.cls}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap">
            <strong>${esc(p.platform)}</strong>
            <span class="sc-badge sc-badge--${st.badge}">${esc(st.label)}</span>
          </div>
          <p style="margin:0.35rem 0"><a class="evil-external-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(p.url)}</a></p>
          ${meta}
        </div>`;
      })
      .join('');

    const searchLinks = (data.searchLinks || [])
      .map(
        (l) =>
          `<li><a class="evil-external-link" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`
      )
      .join('');

    let breachBlock = '';
    const br = data.breaches || {};
    if (!data.email) {
      breachBlock =
        '<p class="sc-muted">Nessuna email fornita — per i data breach inserisci un indirizzo email opzionale (solo il tuo o con autorizzazione).</p>';
    } else if (!br.checked) {
      breachBlock = `<p class="sc-muted">${esc(br.reason || 'Controllo breach non eseguito')}</p>`;
    } else if (br.breachCount === 0) {
      breachBlock = '<p class="sc-muted">Nessun breach noto su HIBP per questa email.</p>';
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
      { high: 'Alta', medium: 'Media', low: 'Bassa', minimal: 'Minima' }[data.footprint] || data.footprint;

    $('spResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring ${gradeClass(data.grade)}">
          <span class="sc-score-ring__num">${Math.round(data.score)}</span>
          <span class="sc-score-ring__grade">Grade ${esc(data.grade)}</span>
        </div>
        <div>
          <div class="sc-summary-grid">
            <div><div class="sc-kv__label">Username</div><div class="sc-kv__val">@${esc(data.username)}</div></div>
            <div><div class="sc-kv__label">Impronta</div><div class="sc-kv__val">${esc(footprintLabel)}</div></div>
            <div><div class="sc-kv__label">Account confermati (API)</div><div class="sc-kv__val">${sum.confirmedFound ?? 0}</div></div>
            <div><div class="sc-kv__label">Link da verificare</div><div class="sc-kv__val">${sum.manualLinks ?? 0}</div></div>
            <div><div class="sc-kv__label">Durata</div><div class="sc-kv__val">${esc(data.scanDurationMs)} ms</div></div>
          </div>
          <div class="sc-export-row">
            <button type="button" class="sc-btn sc-btn--ghost" id="spExportJson">Esporta JSON</button>
            <a class="sc-btn sc-btn--ghost" href="public-info.html">Info pubbliche →</a>
          </div>
        </div>
      </div>

      <p class="sc-callout"><strong>Nota:</strong> ${esc(data.note)}</p>
      ${limitList ? `<div class="sc-callout sc-callout--muted"><strong>Limiti</strong><ul class="sc-limit-list">${limitList}</ul></div>` : ''}

      <div class="sc-section">
        <div class="sc-section__head"><h2>Findings</h2><span class="sc-badge sc-badge--info">${(data.findings || []).length}</span></div>
        <div class="sc-section__body">${findingRows}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Piattaforme (${sum.platformsChecked})</h2></div>
        <div class="sc-section__body">${platformCards}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Data breach (email)</h2></div>
        <div class="sc-section__body">${breachBlock}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Ricerca manuale</h2></div>
        <div class="sc-section__body"><ul class="sc-limit-list">${searchLinks}</ul></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Score breakdown</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Controllo</th><th>Punti</th><th>Severità</th></tr></thead><tbody>${breakdownRows || '<tr><td colspan="3">Nessuna detrazione</td></tr>'}</tbody></table></div>
      </div>
    `;

    $('spResults').classList.add('is-active');
    bindSections();
    document.getElementById('spExportJson')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `evil-social-${data.username}-${Date.now()}.json`;
      link.click();
    });
  }

  async function runProfile() {
    const username = $('spUsername').value.trim();
    const email = $('spEmail').value.trim();
    if (!username || !$('spAuth').checked) {
      alert('Inserisci username e conferma autorizzazione.');
      return;
    }

    const btn = $('spScanBtn');
    btn.disabled = true;
    btn.textContent = 'Profilazione…';
    $('spLog').innerHTML = '';
    $('spResults').classList.remove('is-active');
    $('spResults').innerHTML = '';

    try {
      ['Normalizzazione username', 'Probe GitHub / Reddit', 'Check piattaforme (parallelo)', 'Analisi impronta'].forEach((p) => log(p + '…', 'run'));
      const body = { username };
      if (email) body.email = email;
      const data = await EvilTools.postToolJson('/api/social-profile', body);
      log(`Completato — Grade ${data.grade} · ${data.summary?.confirmedFound} account confermati`, 'ok');
      renderReport(data);
    } catch (err) {
      log(err.message, 'err');
      $('spResults').innerHTML = `<div class="sc-callout"><strong>Profilazione fallita</strong><br>${esc(err.message)}</div>`;
      $('spResults').classList.add('is-active');
    } finally {
      btn.disabled = !$('spAuth').checked || !$('spUsername').value.trim();
      btn.textContent = 'Avvia profilazione';
    }
  }

  function resetForm() {
    $('spUsername').value = '';
    $('spEmail').value = '';
    $('spAuth').checked = false;
    $('spScanBtn').disabled = true;
    $('spLog').innerHTML = '';
    $('spLog').classList.remove('is-active');
    $('spResults').classList.remove('is-active');
    $('spResults').innerHTML = '';
    lastReport = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const auth = $('spAuth');
    const user = $('spUsername');
    const btn = $('spScanBtn');
    const sync = () => {
      btn.disabled = !auth.checked || !user.value.trim();
    };
    auth.addEventListener('change', sync);
    user.addEventListener('input', sync);
    btn.addEventListener('click', runProfile);
    $('spResetBtn').addEventListener('click', resetForm);
    user.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btn.disabled) runProfile();
    });
  });
})();

/**
 * EVIL HTTP Header Audit — UI
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
    const box = $('ahLog');
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

  function renderReport(data) {
    lastReport = data;

    const headerRows = (data.headerAudit || [])
      .map((h) => {
        let state;
        if (h.skipped) state = '<span class="sc-badge sc-badge--info">N/A (HTTP)</span>';
        else if (h.present) state = '<span class="sc-badge sc-badge--ok">Presente</span>';
        else if (h.optional) state = '<span class="sc-badge sc-badge--info">Opzionale</span>';
        else state = '<span class="sc-badge sc-badge--fail">Assente</span>';
        const prio = h.optional
          ? '<span class="sc-badge sc-badge--info">hardening</span>'
          : `<span class="sc-badge sc-badge--${sevBadge(h.severity)}">${esc(h.severity)}</span>`;
        return `<tr><td>${esc(h.label)}</td><td>${state}</td><td>${prio}</td><td>${esc(h.value || '—')}</td></tr>`;
      })
      .join('');

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

    const cookieRows = (data.cookies || []).length
      ? data.cookies
          .map((c) => {
            const riskBadge = c.risk === 'high' ? 'fail' : c.risk === 'medium' ? 'warn' : 'info';
            return `<tr><td>${esc(c.name)}</td><td>${esc(c.typeLabel || c.type)}</td><td><span class="sc-badge sc-badge--${riskBadge}">${esc(c.risk)}</span></td><td>${c.secure ? '✓' : '✗'}</td><td>${c.httpOnly ? '✓' : '✗'}</td><td>${esc(c.sameSite)}</td></tr>`;
          })
          .join('')
      : '<tr><td colspan="6">Nessun Set-Cookie nella risposta</td></tr>';

    const csp = data.cspAnalysis;
    const cspBlock = csp?.present
      ? `<div class="sc-kv"><div class="sc-kv__label">Modalità</div><div class="sc-kv__val">${esc(csp.mode)}</div></div>
         <div class="sc-kv"><div class="sc-kv__label">Policy</div><div class="sc-kv__val"><code>${esc(csp.value)}</code></div></div>
         ${(csp.issues || []).length ? (csp.issues.map((i) => `<div class="sc-finding sc-finding--${esc(i.severity)}"><strong>${esc(i.title)}</strong><span>${esc(i.detail)}</span></div>`).join('')) : '<p class="sc-muted">Nessuna debolezza CSP evidente nelle direttive analizzate.</p>'}`
      : '<p class="sc-muted">Content-Security-Policy non presente nella risposta.</p>';

    const fpRows = (data.fingerprint || []).length
      ? data.fingerprint
          .map((f) => `<tr><td>${esc(f.kind)}</td><td>${esc(f.value)}</td><td><span class="sc-badge sc-badge--${sevBadge(f.severity)}">${esc(f.severity)}</span></td><td>${esc(f.note)}</td></tr>`)
          .join('')
      : '<tr><td colspan="4">Nessun fingerprint rilevante</td></tr>';

    const limitList = (data.limitations || [])
      .map((l) => `<li>${esc(l)}</li>`)
      .join('');

    const rawRows = (data.rawHeaders || [])
      .slice(0, 25)
      .map((h) => `<tr><td><code>${esc(h.name)}</code></td><td>${esc(h.value)}</td></tr>`)
      .join('');

    $('ahResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring ${gradeClass(data.grade)}">
          <span class="sc-score-ring__num">${Math.round(data.security_score)}</span>
          <span class="sc-score-ring__grade">Grade ${esc(data.grade)}</span>
        </div>
        <div>
          <div class="sc-summary-grid">
            <div><div class="sc-kv__label">URL</div><div class="sc-kv__val">${esc(data.url)}</div></div>
            <div><div class="sc-kv__label">URL finale</div><div class="sc-kv__val">${esc(data.finalUrl)}</div></div>
            <div><div class="sc-kv__label">HTTP status</div><div class="sc-kv__val">${esc(data.http?.status)} ${esc(data.http?.statusText || '')}</div></div>
            <div><div class="sc-kv__label">Trasporto</div><div class="sc-kv__val">${data.http?.isHttps ? 'HTTPS' : 'HTTP'}</div></div>
            <div><div class="sc-kv__label">Server</div><div class="sc-kv__val">${esc(data.disclosure?.server || '—')}</div></div>
            <div><div class="sc-kv__label">Durata</div><div class="sc-kv__val">${esc(data.scanDurationMs)} ms</div></div>
          </div>
          <div class="sc-export-row">
            <button type="button" class="sc-btn sc-btn--ghost" id="ahExportJson">Esporta JSON</button>
            <a class="sc-btn sc-btn--ghost" href="security-check.html">URL Scanner completo →</a>
          </div>
        </div>
      </div>

      <p class="sc-callout"><strong>Nota:</strong> ${esc(data.note)}</p>
      ${limitList ? `<div class="sc-callout sc-callout--muted"><strong>Limiti dello strumento</strong><ul class="sc-limit-list">${limitList}</ul></div>` : ''}

      <div class="sc-section">
        <div class="sc-section__head"><h2>Findings</h2><span class="sc-badge sc-badge--info">${(data.findings || []).length}</span></div>
        <div class="sc-section__body">${findingRows}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Checklist header di sicurezza</h2></div>
        <div class="sc-section__body">
          <table class="sc-table"><thead><tr><th>Header</th><th>Stato</th><th>Priorità</th><th>Valore</th></tr></thead><tbody>${headerRows}</tbody></table>
        </div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Score breakdown</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Controllo</th><th>Punti</th><th>Severità</th></tr></thead><tbody>${breakdownRows || '<tr><td colspan="3">Nessuna detrazione</td></tr>'}</tbody></table></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Analisi CSP</h2></div>
        <div class="sc-section__body">${cspBlock}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Fingerprint componenti</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Tipo</th><th>Valore</th><th>Rischio</th><th>Nota</th></tr></thead><tbody>${fpRows}</tbody></table></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Cookie (Set-Cookie)</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Nome</th><th>Classificazione</th><th>Rischio</th><th>Secure</th><th>HttpOnly</th><th>SameSite</th></tr></thead><tbody>${cookieRows}</tbody></table></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Header raw (anteprima)</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Nome</th><th>Valore</th></tr></thead><tbody>${rawRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table></div>
      </div>
    `;

    $('ahResults').classList.add('is-active');
    bindSections();
    document.getElementById('ahExportJson')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `evil-header-audit-${Date.now()}.json`;
      link.click();
    });
  }

  async function runAudit() {
    const urlRaw = $('ahUrl').value.trim();
    if (!urlRaw || !$('ahAuth').checked) {
      alert('Inserisci URL e conferma autorizzazione.');
      return;
    }

    let url = urlRaw;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
      new URL(url);
    } catch {
      alert('URL non valido.');
      return;
    }

    const btn = $('ahScanBtn');
    btn.disabled = true;
    btn.textContent = 'Audit in corso…';
    $('ahLog').innerHTML = '';
    $('ahResults').classList.remove('is-active');
    $('ahResults').innerHTML = '';

    ['Connessione target', 'Fetch HTTP(S)', 'Audit header', 'Analisi cookie', 'Calcolo score'].forEach((p) =>
      log(p + '…', 'run')
    );

    try {
      const data = await EvilTools.postToolJson('/api/vulnerability-scan', { url });
      log(`Completato — Grade ${data.grade} · Score ${data.security_score}`, 'ok');
      renderReport(data);
      window.progressManager?.logActivity?.('vulnerability_found', { url, grade: data.grade, source: 'header_audit' });
    } catch (err) {
      log(err.message, 'err');
      $('ahResults').innerHTML = `<div class="sc-callout"><strong>Audit fallito</strong><br>${esc(err.message)}</div>`;
      $('ahResults').classList.add('is-active');
    } finally {
      btn.disabled = !urlRaw || !$('ahAuth').checked;
      btn.textContent = 'Avvia audit header';
    }
  }

  function resetAudit() {
    $('ahUrl').value = '';
    $('ahAuth').checked = false;
    $('ahScanBtn').disabled = true;
    $('ahLog').innerHTML = '';
    $('ahLog').classList.remove('is-active');
    $('ahResults').classList.remove('is-active');
    $('ahResults').innerHTML = '';
    lastReport = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const auth = $('ahAuth');
    const input = $('ahUrl');
    const btn = $('ahScanBtn');
    const sync = () => {
      btn.disabled = !auth.checked || !input.value.trim();
    };
    auth.addEventListener('change', sync);
    input.addEventListener('input', sync);
    btn.addEventListener('click', runAudit);
    $('ahResetBtn').addEventListener('click', resetAudit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btn.disabled) runAudit();
    });
  });
})();

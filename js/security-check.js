/**
 * EVIL Advanced URL Scanner — UI
 */
(function () {
  const $ = (id) => document.getElementById(id);
  const page = window.location.pathname.split('/').pop() || 'security-check.html';
  const LOGIN_URL = 'login.html?redirect=' + encodeURIComponent(page);
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
    const box = $('scLog');
    box.classList.add('is-active');
    const line = document.createElement('div');
    line.className = 'sc-log__line sc-log__line--' + (type || 'run');
    line.textContent = `[${new Date().toLocaleTimeString('it-IT')}] ${msg}`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  function clearLog() {
    $('scLog').innerHTML = '';
    $('scLog').classList.remove('is-active');
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
    const a = data.analysis || {};
    const ringClass = gradeClass(data.grade);

    let findingsHtml = (data.findings || [])
      .map(
        (f) =>
          `<div class="sc-finding sc-finding--${esc(f.severity)}"><strong>${esc(f.title)}</strong><span>${esc(f.detail)} · ${esc(f.module)}</span></div>`
      )
      .join('');

    const headerRows = (a.http?.headerAudit || [])
      .map(
        (h) =>
          `<tr><td>${esc(h.label)}</td><td>${h.present ? '<span class="sc-badge sc-badge--ok">Presente</span>' : '<span class="sc-badge sc-badge--fail">Assente</span>'}</td><td><span class="sc-badge sc-badge--${sevBadge(h.severity)}">${esc(h.severity)}</span></td><td>${esc(h.value || '—')}</td></tr>`
      )
      .join('');

    const dns = a.dns?.records || {};
    const dnsRows = ['A', 'AAAA', 'NS', 'MX', 'TXT', 'CAA']
      .map((type) => {
        const val = dns[type];
        const text = !val || (Array.isArray(val) && !val.length) ? '—' : esc(JSON.stringify(val));
        return `<tr><td>${type}</td><td>${text}</td></tr>`;
      })
      .join('');

    const geo = a.geo || {};
    const tls = a.tls || {};
    const redirectRows = (a.redirects || [])
      .map(
        (r) =>
          `<tr><td>${esc(r.url)}</td><td>${esc(r.status || r.error || '—')}</td><td>${esc(r.type)}</td></tr>`
      )
      .join('');

    const discoveryRows = (a.discovery || [])
      .map(
        (d) =>
          `<tr><td>${esc(d.label)}</td><td>${d.found ? '<span class="sc-badge sc-badge--ok">Trovato</span>' : '<span class="sc-badge sc-badge--warn">Assente</span>'}</td><td><pre class="sc-pre">${esc(d.preview || '—')}</pre></td></tr>`
      )
      .join('');

    const breakdownRows = (data.scoreBreakdown || [])
      .filter((b) => b.delta !== 0)
      .map(
        (b) =>
          `<tr><td>${esc(b.label)}</td><td>${b.delta > 0 ? '+' : ''}${b.delta}</td><td><span class="sc-badge sc-badge--${sevBadge(b.severity)}">${esc(b.severity)}</span></td></tr>`
      )
      .join('');

    const sans = (tls.subjectAltNames || []).slice(0, 12).map((s) => esc(s)).join(', ') || '—';

    $('scResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring ${ringClass}">
          <span class="sc-score-ring__num">${Math.round(data.security_score)}</span>
          <span class="sc-score-ring__grade">Grade ${esc(data.grade)}</span>
        </div>
        <div>
          <div class="sc-summary-grid">
            <div><div class="sc-kv__label">Target</div><div class="sc-kv__val">${esc(data.domain)}</div></div>
            <div><div class="sc-kv__label">URL finale</div><div class="sc-kv__val">${esc(data.finalUrl || data.url)}</div></div>
            <div><div class="sc-kv__label">IP</div><div class="sc-kv__val">${esc(a.ip || '—')}</div></div>
            <div><div class="sc-kv__label">Durata</div><div class="sc-kv__val">${esc(data.scanDurationMs)} ms</div></div>
            <div><div class="sc-kv__label">ASN / Org</div><div class="sc-kv__val">${esc(geo.asnLabel || geo.org || geo.error || '—')}</div></div>
            <div><div class="sc-kv__label">Paese</div><div class="sc-kv__val">${esc(geo.country || '—')}</div></div>
          </div>
          <div class="sc-export-row">
            <button type="button" class="sc-btn sc-btn--ghost" id="scExportJson">Esporta JSON</button>
            <a class="sc-btn sc-btn--ghost" href="domain-recon.html">Ricognizione dominio →</a>
          </div>
        </div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Findings prioritizzati</h2><span class="sc-badge sc-badge--info">${(data.findings || []).length}</span></div>
        <div class="sc-section__body">${findingsHtml}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Score breakdown</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Controllo</th><th>Punti</th><th>Severità</th></tr></thead><tbody>${breakdownRows || '<tr><td colspan="3">Nessuna detrazione</td></tr>'}</tbody></table></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>TLS &amp; certificato</h2></div>
        <div class="sc-section__body">
          ${tls.error ? `<p class="sc-pre">${esc(tls.error)}</p>` : `
          <table class="sc-table">
            <tr><th>Protocollo</th><td>${esc(tls.protocol || '—')}</td></tr>
            <tr><th>Cipher</th><td>${esc(tls.cipher?.name || '—')}</td></tr>
            <tr><th>Subject CN</th><td>${esc(tls.subject?.CN || '—')}</td></tr>
            <tr><th>Issuer</th><td>${esc(tls.issuer?.CN || tls.issuer?.O || '—')}</td></tr>
            <tr><th>Valido fino</th><td>${esc(tls.validTo || '—')} (${esc(tls.daysUntilExpiry)} gg)</td></tr>
            <tr><th>Trusted</th><td>${tls.authorized ? '<span class="sc-badge sc-badge--ok">Sì</span>' : '<span class="sc-badge sc-badge--fail">No</span>'}</td></tr>
            <tr><th>SAN</th><td>${sans}</td></tr>
            <tr><th>SHA-256</th><td><code class="sc-pre">${esc(tls.fingerprintSha256 || '—')}</code></td></tr>
          </table>`}
        </div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>HTTP security headers</h2></div>
        <div class="sc-section__body">
          ${a.http?.error ? `<p class="sc-pre">${esc(a.http.error)}</p>` : `
          <p style="font-size:0.82rem;color:#64748b;margin:0 0 0.75rem;">HTTP ${esc(a.http.status)} · Server: ${esc(a.http.server || '—')} · Title: ${esc(a.http.title || '—')}</p>
          <table class="sc-table"><thead><tr><th>Header</th><th>Stato</th><th>Severità</th><th>Valore</th></tr></thead><tbody>${headerRows}</tbody></table>`}
        </div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>DNS &amp; infrastruttura</h2></div>
        <div class="sc-section__body">
          <table class="sc-table"><thead><tr><th>Tipo</th><th>Record</th></tr></thead><tbody>${dnsRows}</tbody></table>
          ${a.dns?.reverse ? `<p class="sc-meta">PTR: ${esc(a.dns.reverse.join(', '))}</p>` : ''}
        </div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Redirect chain</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>URL</th><th>Status</th><th>Tipo</th></tr></thead><tbody>${redirectRows || '<tr><td colspan="3">Nessun hop</td></tr>'}</tbody></table></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Surface discovery</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Risorsa</th><th>Stato</th><th>Anteprima</th></tr></thead><tbody>${discoveryRows}</tbody></table></div>
      </div>
    `;

    $('scResults').classList.add('is-active');
    bindSections();
    const exportBtn = document.getElementById('scExportJson');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `evil-url-scan-${Date.now()}.json`;
        link.click();
      });
    }
  }

  async function runScan() {
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
      window.location.href = LOGIN_URL;
      return;
    }

    const urlRaw = $('scUrl').value.trim();
    const authorized = $('scAuth').checked;
    if (!urlRaw || !authorized) {
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

    const btn = $('scScanBtn');
    btn.disabled = true;
    btn.textContent = 'Scansione in corso…';
    clearLog();
    $('scResults').classList.remove('is-active');
    $('scResults').innerHTML = '';

    const phases = [
      'Risoluzione DNS & GeoIP',
      'Tracciamento redirect',
      'Handshake TLS & certificato',
      'Audit header HTTP',
      'Discovery (robots.txt, security.txt)'
    ];
    phases.forEach((p) => log(p + '…', 'run'));

    try {
      const fetchFn = typeof fetchAuthenticated === 'function' ? fetchAuthenticated : fetch;
      const response = await fetchFn('/api/scan', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await response.json();
      if (response.status === 401) {
        window.location.href = LOGIN_URL;
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Errore server ' + response.status);
      log(`Completato — Grade ${data.grade} · Score ${data.security_score}`, 'ok');
      renderReport(data);
      if (typeof incrementScans === 'function' && isAuthenticated()) {
        await incrementScans({ scanType: 'advanced_url_scanner', grade: data.grade });
      }
    } catch (err) {
      log(err.message, 'err');
      $('scResults').innerHTML = `<div class="sc-callout"><strong>Scansione fallita</strong><br>${esc(err.message)}</div>`;
      $('scResults').classList.add('is-active');
    } finally {
      btn.disabled = !authorized || !urlRaw;
      btn.textContent = 'Avvia scansione';
    }
  }

  function resetScan() {
    $('scUrl').value = '';
    $('scAuth').checked = false;
    $('scScanBtn').disabled = true;
    clearLog();
    $('scResults').classList.remove('is-active');
    $('scResults').innerHTML = '';
    lastReport = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
      window.location.replace(LOGIN_URL);
      return;
    }

    const auth = $('scAuth');
    const input = $('scUrl');
    const btn = $('scScanBtn');
    const sync = () => {
      btn.disabled = !auth.checked || !input.value.trim();
    };
    auth.addEventListener('change', sync);
    input.addEventListener('input', sync);
    btn.addEventListener('click', runScan);
    $('scResetBtn').addEventListener('click', resetScan);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btn.disabled) runScan();
    });
  });
})();

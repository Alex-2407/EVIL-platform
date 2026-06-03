/**
 * EVIL Subdomain Finder — UI
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
    const box = $('sfLog');
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

  function riskBadge(risk) {
    return risk === 'high' ? 'fail' : risk === 'medium' ? 'warn' : 'info';
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

    const hostRows = (data.found || []).length
      ? data.found
          .map((s) => {
            const ip = s.ip || s.ipv6 || (s.cname ? `CNAME → ${s.cname}` : '—');
            const src = (s.sources || []).join(', ');
            return `<tr class="sf-host-row">
              <td><code>${esc(s.subdomain)}</code></td>
              <td>${esc(s.categoryLabel)}</td>
              <td><span class="sc-badge sc-badge--${riskBadge(s.risk)}">${esc(s.risk)}</span></td>
              <td><code>${esc(ip)}</code></td>
              <td>${esc(src)}</td>
            </tr>`;
          })
          .join('')
      : '<tr><td colspan="5">Nessun host risolto nella scansione</td></tr>';

    const catRows = (sum.byCategory || [])
      .map((c) => `<tr><td>${esc(c.label)}</td><td>${c.count}</td></tr>`)
      .join('');

    const ctRows = (data.ctUnresolved || []).length
      ? data.ctUnresolved.map((h) => `<li><code>${esc(h)}</code></li>`).join('')
      : '<li class="sc-muted">Nessuno o tutti risolti</li>';

    const limitList = (data.limitations || []).map((l) => `<li>${esc(l)}</li>`).join('');

    $('sfResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring ${gradeClass(data.grade)}">
          <span class="sc-score-ring__num">${Math.round(data.score)}</span>
          <span class="sc-score-ring__grade">Grade ${esc(data.grade)}</span>
        </div>
        <div>
          <div class="sc-summary-grid">
            <div><div class="sc-kv__label">Dominio</div><div class="sc-kv__val">${esc(data.domain)}</div></div>
            <div><div class="sc-kv__label">Host attivi</div><div class="sc-kv__val">${sum.activeCount ?? data.foundCount}</div></div>
            <div><div class="sc-kv__label">Alto rischio</div><div class="sc-kv__val">${sum.riskyCount ?? 0}</div></div>
            <div><div class="sc-kv__label">Durata</div><div class="sc-kv__val">${esc(data.scanDurationMs)} ms</div></div>
            <div><div class="sc-kv__label">Wordlist</div><div class="sc-kv__val">${data.methods?.wordlist ?? '—'} prefix</div></div>
            <div><div class="sc-kv__label">crt.sh</div><div class="sc-kv__val">${data.methods?.ctNamesTotal ?? 0} nomi · ${data.methods?.certificateTransparency ?? 0} testati</div></div>
          </div>
          <div class="sc-export-row">
            <button type="button" class="sc-btn sc-btn--ghost" id="sfExportJson">Esporta JSON</button>
            <a class="sc-btn sc-btn--ghost" href="ssl-analyzer.html">SSL Analyzer →</a>
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
        <div class="sc-section__head"><h2>Host risolti</h2><span class="sc-badge sc-badge--info">${(data.found || []).length}</span></div>
        <div class="sc-section__body">
          <table class="sc-table"><thead><tr><th>Hostname</th><th>Categoria</th><th>Rischio</th><th>Risoluzione</th><th>Fonte</th></tr></thead><tbody>${hostRows}</tbody></table>
        </div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Per categoria</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Categoria</th><th>Count</th></tr></thead><tbody>${catRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Score breakdown</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Controllo</th><th>Punti</th><th>Severità</th></tr></thead><tbody>${breakdownRows || '<tr><td colspan="3">Nessuna detrazione</td></tr>'}</tbody></table></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>CT senza A record (campione)</h2></div>
        <div class="sc-section__body"><ul class="sc-limit-list">${ctRows}</ul></div>
      </div>
    `;

    $('sfResults').classList.add('is-active');
    bindSections();
    document.getElementById('sfExportJson')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `evil-subdomains-${data.domain}-${Date.now()}.json`;
      link.click();
    });
  }

  async function runScan() {
    const domainRaw = $('sfDomain').value.trim();
    if (!domainRaw || !$('sfAuth').checked) {
      alert('Inserisci dominio e conferma autorizzazione.');
      return;
    }

    const btn = $('sfScanBtn');
    btn.disabled = true;
    btn.textContent = 'Scansione…';
    $('sfLog').innerHTML = '';
    $('sfResults').classList.remove('is-active');
    $('sfResults').innerHTML = '';

    ['Normalizzazione dominio', 'Query crt.sh (CT)', 'Risoluzione wordlist', 'Classificazione host'].forEach((p) => log(p + '…', 'run'));

    try {
      const data = await EvilTools.postToolJson('/api/subdomain-finder', { domain: domainRaw });
      log(`Completato — ${data.foundCount} host · Grade ${data.grade}`, 'ok');
      renderReport(data);
    } catch (err) {
      log(err.message, 'err');
      $('sfResults').innerHTML = `<div class="sc-callout"><strong>Scansione fallita</strong><br>${esc(err.message)}</div>`;
      $('sfResults').classList.add('is-active');
    } finally {
      btn.disabled = !domainRaw || !$('sfAuth').checked;
      btn.textContent = 'Avvia enumerazione';
    }
  }

  function resetScan() {
    $('sfDomain').value = '';
    $('sfAuth').checked = false;
    $('sfScanBtn').disabled = true;
    $('sfLog').innerHTML = '';
    $('sfLog').classList.remove('is-active');
    $('sfResults').classList.remove('is-active');
    $('sfResults').innerHTML = '';
    lastReport = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const auth = $('sfAuth');
    const input = $('sfDomain');
    const btn = $('sfScanBtn');
    const sync = () => {
      btn.disabled = !auth.checked || !input.value.trim();
    };
    auth.addEventListener('change', sync);
    input.addEventListener('input', sync);
    btn.addEventListener('click', runScan);
    $('sfResetBtn').addEventListener('click', resetScan);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btn.disabled) runScan();
    });
  });
})();

/**
 * EVIL DNS Records Enumerator — UI
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let lastReport = null;
  let lookupMode = 'dns';

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function log(msg, type) {
    const box = $('deLog');
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

  function setMode(mode) {
    lookupMode = mode;
    document.getElementById('tab-dns')?.classList.toggle('is-active', mode === 'dns');
    document.getElementById('tab-whois')?.classList.toggle('is-active', mode === 'whois');
    $('deScanBtn').textContent = mode === 'dns' ? 'Enumera record DNS' : 'Lookup WHOIS';
  }

  function renderDnsReport(data) {
    lastReport = data;

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

    const email = data.email || {};
    const emailRows = [
      ['MX', email.hasMx ? `${email.mx?.length || 0} host` : 'Assenti'],
      ['SPF', email.spf?.present ? 'Presente' : 'Assente'],
      ['DMARC', email.dmarc?.present ? `p=${email.dmarc.policy}` : 'Assente']
    ]
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`)
      .join('');

    const infra = data.infra || {};
    const infraBlock = `
      <div class="sc-summary-grid">
        <div><div class="sc-kv__label">Provider DNS</div><div class="sc-kv__val">${esc(infra.providers?.join(', ') || '—')}</div></div>
        <div><div class="sc-kv__label">CDN (CNAME)</div><div class="sc-kv__val">${esc(infra.cdn || '—')}</div></div>
        <div><div class="sc-kv__label">IPv4 primario</div><div class="sc-kv__val">${esc(infra.primaryIpv4 || '—')}</div></div>
        <div><div class="sc-kv__label">PTR reverse</div><div class="sc-kv__val">${esc(infra.ptr || '—')}</div></div>
      </div>`;

    const recordBlocks = (data.recordSections || [])
      .map((sec) => {
        let body;
        if (sec.empty) {
          body = '<p class="sc-muted">Nessun record trovato per questo tipo.</p>';
        } else if (sec.key === 'TXT') {
          body = sec.values
            .map(
              (v) =>
                `<div class="sc-finding sc-finding--info"><span class="de-txt-kind">${esc(v.label)}</span><code>${esc(v.text)}</code></div>`
            )
            .join('');
        } else {
          body = sec.values.map((v) => `<div class="sc-record-line"><code>${esc(v)}</code></div>`).join('');
        }
        return `<div class="sc-section"><div class="sc-section__head"><h2>${esc(sec.title)} (${esc(sec.label)})</h2><span class="sc-badge sc-badge--info">${sec.count}</span></div><div class="sc-section__body">${body}</div></div>`;
      })
      .join('');

    const limitList = (data.limitations || []).map((l) => `<li>${esc(l)}</li>`).join('');
    const sum = data.summary || {};

    $('deResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring ${gradeClass(data.grade)}">
          <span class="sc-score-ring__num">${Math.round(data.score)}</span>
          <span class="sc-score-ring__grade">Grade ${esc(data.grade)}</span>
        </div>
        <div>
          <div class="sc-summary-grid">
            <div><div class="sc-kv__label">Dominio</div><div class="sc-kv__val">${esc(data.domain)}</div></div>
            <div><div class="sc-kv__label">Tipi record</div><div class="sc-kv__val">${sum.typesFound}/${sum.typesTotal}</div></div>
            <div><div class="sc-kv__label">Dual-stack</div><div class="sc-kv__val">${sum.dualStack ? 'Sì (A+AAAA)' : 'No'}</div></div>
            <div><div class="sc-kv__label">Durata</div><div class="sc-kv__val">${esc(data.scanDurationMs)} ms</div></div>
          </div>
          <div class="sc-export-row">
            <button type="button" class="sc-btn sc-btn--ghost" id="deExportJson">Esporta JSON</button>
            <a class="sc-btn sc-btn--ghost" href="subdomain-finder.html">Subdomain Finder →</a>
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
        <div class="sc-section__head"><h2>Postura email (SPF / DMARC)</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Controllo</th><th>Stato</th></tr></thead><tbody>${emailRows}</tbody></table>
        ${email.spf?.value ? `<p class="sc-muted" style="margin-top:0.75rem"><strong>SPF:</strong> <code>${esc(email.spf.value)}</code></p>` : ''}
        ${email.dmarc?.value ? `<p class="sc-muted"><strong>DMARC:</strong> <code>${esc(email.dmarc.value)}</code></p>` : ''}
        </div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Infrastruttura</h2></div>
        <div class="sc-section__body">${infraBlock}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Score breakdown</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Controllo</th><th>Punti</th><th>Severità</th></tr></thead><tbody>${breakdownRows || '<tr><td colspan="3">Nessuna detrazione</td></tr>'}</tbody></table></div>
      </div>

      ${recordBlocks}
    `;

    $('deResults').classList.add('is-active');
    bindSections();
    document.getElementById('deExportJson')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `evil-dns-${data.domain}-${Date.now()}.json`;
      link.click();
    });
  }

  function renderWhoisReport(data) {
    lastReport = data;
    if (data.error) {
      $('deResults').innerHTML = `<div class="sc-callout"><strong>WHOIS non disponibile</strong><br>${esc(data.error)}</div>`;
      $('deResults').classList.add('is-active');
      return;
    }

    const fields = data.fields || {};
    const keys = Object.keys(fields).slice(0, 16);
    const fieldRows = keys
      .map((k) => {
        const v = Array.isArray(fields[k]) ? fields[k].join(', ') : fields[k];
        return `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`;
      })
      .join('');

    $('deResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring sc-score-ring--b"><span class="sc-score-ring__num">WHOIS</span><span class="sc-score-ring__grade">${esc(data.domain)}</span></div>
        <div><p class="sc-muted">Fonte: <strong>${esc(data.source || '—')}</strong> (RDAP o TCP :43 — nessun comando di sistema richiesto).</p></div>
      </div>
      <div class="sc-section">
        <div class="sc-section__head"><h2>Campi principali</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Campo</th><th>Valore</th></tr></thead><tbody>${fieldRows || '<tr><td colspan="2">Nessun campo parsato</td></tr>'}</tbody></table></div>
      </div>
      <div class="sc-section">
        <div class="sc-section__head"><h2>Anteprima raw</h2></div>
        <div class="sc-section__body"><pre class="sc-pre">${esc(data.preview || 'N/A')}</pre></div>
      </div>
    `;
    $('deResults').classList.add('is-active');
    bindSections();
  }

  async function runLookup() {
    const domainRaw = $('deDomain').value.trim();
    if (!domainRaw || !$('deAuth').checked) {
      alert('Inserisci dominio e conferma autorizzazione.');
      return;
    }

    const btn = $('deScanBtn');
    btn.disabled = true;
    btn.textContent = lookupMode === 'dns' ? 'Enumerazione…' : 'WHOIS…';
    $('deLog').innerHTML = '';
    $('deResults').classList.remove('is-active');
    $('deResults').innerHTML = '';

    try {
      if (lookupMode === 'whois') {
        log('Recupero WHOIS…', 'run');
        const data = await EvilTools.postToolJson('/api/whois', { domain: domainRaw });
        log('WHOIS completato', 'ok');
        renderWhoisReport(data);
      } else {
        ['Normalizzazione dominio', 'Risoluzione A/AAAA/MX/NS/TXT', 'Lookup DMARC', 'Analisi postura email'].forEach((p) => log(p + '…', 'run'));
        const data = await EvilTools.postToolJson('/api/dns-enum', { domain: domainRaw });
        log(`Completato — Grade ${data.grade} · Score ${data.score} · ${data.summary?.typesFound} tipi record`, 'ok');
        renderDnsReport(data);
        window.progressManager?.logActivity?.('dns_enumeration', { domain: domainRaw, grade: data.grade });
      }
    } catch (err) {
      log(err.message, 'err');
      $('deResults').innerHTML = `<div class="sc-callout"><strong>Lookup fallito</strong><br>${esc(err.message)}</div>`;
      $('deResults').classList.add('is-active');
    } finally {
      btn.disabled = !domainRaw || !$('deAuth').checked;
      btn.textContent = lookupMode === 'dns' ? 'Enumera record DNS' : 'Lookup WHOIS';
    }
  }

  function resetLookup() {
    $('deDomain').value = '';
    $('deAuth').checked = false;
    $('deScanBtn').disabled = true;
    $('deLog').innerHTML = '';
    $('deLog').classList.remove('is-active');
    $('deResults').classList.remove('is-active');
    $('deResults').innerHTML = '';
    lastReport = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const auth = $('deAuth');
    const input = $('deDomain');
    const btn = $('deScanBtn');
    const sync = () => {
      btn.disabled = !auth.checked || !input.value.trim();
    };
    auth.addEventListener('change', sync);
    input.addEventListener('input', sync);
    btn.addEventListener('click', runLookup);
    $('deResetBtn').addEventListener('click', resetLookup);
    document.getElementById('tab-dns')?.addEventListener('click', () => setMode('dns'));
    document.getElementById('tab-whois')?.addEventListener('click', () => setMode('whois'));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btn.disabled) runLookup();
    });
    setMode('dns');
  });
})();

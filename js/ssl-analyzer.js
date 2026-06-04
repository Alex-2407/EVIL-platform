/**
 * EVIL SSL Certificate Analyzer — UI
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
    const box = $('sslLog');
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

  function lifecycleLabel(lc) {
    const map = {
      valid: 'Valido',
      warning_expiry: 'In scadenza',
      critical_expiry: 'Scade a breve',
      expired: 'Scaduto',
      not_yet_valid: 'Non ancora valido'
    };
    return map[lc] || lc;
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
    const cert = data.certificate || {};
    const tls = data.tls || {};

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

    const sanRows = (a.subjectAltNames || []).length
      ? a.subjectAltNames
          .slice(0, 30)
          .map((san) => `<tr><td><code>${esc(san)}</code></td></tr>`)
          .join('')
      : '<tr><td class="sc-muted">Nessun SAN DNS nel certificato</td></tr>';

    const checks = [
      ['Hostname match', a.hostnameMatch ? 'Sì' : 'No', a.hostnameMatch ? 'ok' : 'fail'],
      ['Catena trusted', a.authorized ? 'Sì' : 'No', a.authorized ? 'ok' : 'fail'],
      ['Self-signed', a.selfSigned ? 'Sì' : 'No', a.selfSigned ? 'warn' : 'ok'],
      ['Protocollo', tls.protocol || '—', a.obsoleteProtocol ? 'fail' : 'ok'],
      ['Cipher', tls.cipher?.name || '—', a.weakCipher ? 'fail' : 'ok'],
      ['Chiave', a.keySize ? `${a.keySize} bit` : '—', a.weakKey ? 'fail' : 'ok'],
      ['Firma', a.algorithm || '—', a.weakSignature ? 'warn' : 'ok']
    ]
      .map(
        ([label, val, badge]) =>
          `<tr><td>${esc(label)}</td><td>${esc(val)}</td><td><span class="sc-badge sc-badge--${badge}">${badge === 'ok' ? 'OK' : 'Attenzione'}</span></td></tr>`
      )
      .join('');

    const limitList = (data.limitations || []).map((l) => `<li>${esc(l)}</li>`).join('');

    $('sslResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring ${gradeClass(data.grade)}">
          <span class="sc-score-ring__num">${Math.round(data.score)}</span>
          <span class="sc-score-ring__grade">Grade ${esc(data.grade)}</span>
        </div>
        <div>
          <div class="sc-summary-grid">
            <div><div class="sc-kv__label">Dominio</div><div class="sc-kv__val">${esc(data.domain)}</div></div>
            <div><div class="sc-kv__label">Stato</div><div class="sc-kv__val"><span class="ssl-lifecycle ssl-lifecycle--${esc(a.lifecycle)}">${esc(lifecycleLabel(a.lifecycle))}</span></div></div>
            <div><div class="sc-kv__label">Giorni alla scadenza</div><div class="sc-kv__val">${a.daysUntilExpiry != null ? esc(a.daysUntilExpiry) : '—'}</div></div>
            <div><div class="sc-kv__label">TLS</div><div class="sc-kv__val">${esc(tls.protocol || '—')}</div></div>
            <div><div class="sc-kv__label">CN</div><div class="sc-kv__val">${esc(cert.subject?.CN || '—')}</div></div>
            <div><div class="sc-kv__label">Durata</div><div class="sc-kv__val">${esc(data.scanDurationMs)} ms</div></div>
          </div>
          <div class="sc-export-row">
            <button type="button" class="sc-btn sc-btn--ghost" id="sslExportJson">Esporta JSON</button>
            <a class="sc-btn sc-btn--ghost" href="security-check.html">URL Scanner →</a>
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
        <div class="sc-section__head"><h2>Checklist TLS</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Controllo</th><th>Valore</th><th>Esito</th></tr></thead><tbody>${checks}</tbody></table></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Soggetto &amp; emittente</h2></div>
        <div class="sc-section__body">
          <div class="sc-summary-grid">
            <div><div class="sc-kv__label">Subject CN</div><div class="sc-kv__val">${esc(cert.subject?.CN)}</div></div>
            <div><div class="sc-kv__label">Subject O</div><div class="sc-kv__val">${esc(cert.subject?.O || '—')}</div></div>
            <div><div class="sc-kv__label">Issuer CN</div><div class="sc-kv__val">${esc(cert.issuer?.CN)}</div></div>
            <div><div class="sc-kv__label">Issuer O</div><div class="sc-kv__val">${esc(cert.issuer?.O || '—')}</div></div>
            <div><div class="sc-kv__label">Valido da</div><div class="sc-kv__val">${cert.validFrom ? esc(new Date(cert.validFrom).toLocaleString('it-IT')) : '—'}</div></div>
            <div><div class="sc-kv__label">Scade il</div><div class="sc-kv__val">${cert.validTo ? esc(new Date(cert.validTo).toLocaleString('it-IT')) : '—'}</div></div>
          </div>
        </div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Subject Alternative Names</h2><span class="sc-badge sc-badge--info">${(a.subjectAltNames || []).length}</span></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>DNS</th></tr></thead><tbody>${sanRows}</tbody></table></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Fingerprint</h2></div>
        <div class="sc-section__body">
          <p class="sc-muted"><strong>SHA-1:</strong> <code>${esc(cert.fingerprint)}</code></p>
          ${cert.fingerprint256 ? `<p class="sc-muted"><strong>SHA-256:</strong> <code>${esc(cert.fingerprint256)}</code></p>` : ''}
          <p class="sc-muted"><strong>Serial:</strong> <code>${esc(cert.serialNumber || '—')}</code></p>
          <p class="sc-muted"><strong>Catena (peer):</strong> ${esc(tls.chainLength)} certificato/i</p>
        </div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Score breakdown</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Controllo</th><th>Punti</th><th>Severità</th></tr></thead><tbody>${breakdownRows || '<tr><td colspan="3">Nessuna detrazione</td></tr>'}</tbody></table></div>
      </div>
    `;

    $('sslResults').classList.add('is-active');
    bindSections();
    document.getElementById('sslExportJson')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `evil-ssl-${data.domain}-${Date.now()}.json`;
      link.click();
    });
  }

  async function runScan() {
    const domainRaw = $('sslDomain').value.trim();
    if (!domainRaw || !$('sslAuth').checked) {
      alert('Inserisci dominio e conferma autorizzazione.');
      return;
    }

    const btn = $('sslScanBtn');
    btn.disabled = true;
    btn.textContent = 'Analisi TLS…';
    $('sslLog').innerHTML = '';
    $('sslResults').classList.remove('is-active');
    $('sslResults').innerHTML = '';

    ['Connessione :443', 'Handshake TLS', 'Estrazione certificato', 'Analisi validità e SAN'].forEach((p) => log(p + '…', 'run'));

    try {
      const data = await EvilTools.postToolJson('/api/ssl-analyzer', { domain: domainRaw });
      if (data.status === 'failed' || data.error) {
        throw new Error(data.error || 'Analisi TLS fallita');
      }
      log(`Completato — Grade ${data.grade} · ${data.tls?.protocol || 'TLS'} · ${data.analysis?.daysUntilExpiry} giorni`, 'ok');
      renderReport(data);
      window.progressManager?.logActivity?.('ssl_analysis', { domain: domainRaw, grade: data.grade });
    } catch (err) {
      log(err.message, 'err');
      $('sslResults').innerHTML = `<div class="sc-callout"><strong>Analisi fallita</strong><br>${esc(err.message)}</div>`;
      $('sslResults').classList.add('is-active');
    } finally {
      btn.disabled = !domainRaw || !$('sslAuth').checked;
      btn.textContent = 'Analizza certificato';
    }
  }

  function resetScan() {
    $('sslDomain').value = '';
    $('sslAuth').checked = false;
    $('sslScanBtn').disabled = true;
    $('sslLog').innerHTML = '';
    $('sslLog').classList.remove('is-active');
    $('sslResults').classList.remove('is-active');
    $('sslResults').innerHTML = '';
    lastReport = null;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const auth = $('sslAuth');
    const input = $('sslDomain');
    const btn = $('sslScanBtn');
    const sync = () => {
      btn.disabled = !auth.checked || !input.value.trim();
    };
    auth.addEventListener('change', sync);
    input.addEventListener('input', sync);
    btn.addEventListener('click', runScan);
    $('sslResetBtn').addEventListener('click', resetScan);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !btn.disabled) runScan();
    });
  });
})();

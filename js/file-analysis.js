/**
 * EVIL Static File Scanner — UI
 */
(function () {
  const $ = (id) => document.getElementById(id);
  let lastReport = null;
  let pendingFile = null;

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function log(msg, type) {
    const box = $('faLog');
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

  function verdictClass(code) {
    if (code === 'clean_static') return 'clean';
    if (code === 'investigate') return 'investigate';
    return 'suspicious';
  }

  async function sha256Local(file) {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
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
    const v = data.verdict || {};

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

    const patternRows = (data.patternHits || []).length
      ? data.patternHits
          .map(
            (p) =>
              `<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td><span class="sc-badge sc-badge--${sevBadge(p.severity)}">${esc(p.severity)}</span></td></tr>`
          )
          .join('')
      : '<tr><td colspan="3">Nessun pattern noto</td></tr>';

    const stringSample = (data.strings?.sample || [])
      .map((s) => `<li><code>${esc(s)}</code></li>`)
      .join('');

    const limitList = (data.limitations || []).map((l) => `<li>${esc(l)}</li>`).join('');

    $('faResults').innerHTML = `
      <div class="sc-summary">
        <div class="sc-score-ring ${gradeClass(data.grade)}">
          <span class="sc-score-ring__num">${Math.round(data.score)}</span>
          <span class="sc-score-ring__grade">Grade ${esc(data.grade)}</span>
        </div>
        <div>
          <div class="sc-summary-grid">
            <div><div class="sc-kv__label">File</div><div class="sc-kv__val">${esc(data.originalName)}</div></div>
            <div><div class="sc-kv__label">Dimensione</div><div class="sc-kv__val">${(data.size / 1024).toFixed(1)} KB</div></div>
            <div><div class="sc-kv__label">Tipo rilevato</div><div class="sc-kv__val">${esc(data.fileType?.detected)}</div></div>
            <div><div class="sc-kv__label">Entropia</div><div class="sc-kv__val">${esc(data.entropy?.shannon)} (${esc(data.entropy?.label)})</div></div>
            <div><div class="sc-kv__label">Verdetto</div><div class="sc-kv__val"><span class="fa-verdict fa-verdict--${verdictClass(v.code)}">${esc(v.label)}</span></div></div>
            <div><div class="sc-kv__label">Durata</div><div class="sc-kv__val">${esc(data.scanDurationMs || '—')} ms</div></div>
          </div>
          <div class="sc-export-row">
            <button type="button" class="sc-btn sc-btn--ghost" id="faExportJson">Esporta JSON</button>
            <a class="sc-btn sc-btn--ghost evil-external-link" href="${esc(data.virusTotalUrl)}" target="_blank" rel="noopener noreferrer">VirusTotal →</a>
          </div>
        </div>
      </div>

      <p class="sc-callout"><strong>Nota:</strong> ${esc(v.note)}</p>
      ${limitList ? `<div class="sc-callout sc-callout--muted"><strong>Sicurezza &amp; limiti</strong><ul class="sc-limit-list">${limitList}</ul></div>` : ''}

      <div class="sc-section">
        <div class="sc-section__head"><h2>Findings</h2><span class="sc-badge sc-badge--info">${(data.findings || []).length}</span></div>
        <div class="sc-section__body">${findingRows}</div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Hash crittografici</h2></div>
        <div class="sc-section__body">
          <p class="sc-muted"><strong>MD5:</strong> <code>${esc(data.hashes?.md5)}</code></p>
          <p class="sc-muted"><strong>SHA-1:</strong> <code>${esc(data.hashes?.sha1)}</code></p>
          <p class="sc-muted"><strong>SHA-256:</strong> <code>${esc(data.hashes?.sha256)}</code></p>
          <p class="sc-muted"><strong>SHA-512:</strong> <code>${esc(data.hashes?.sha512?.slice(0, 64))}…</code></p>
        </div>
      </div>

      ${
        data.pe
          ? `<div class="sc-section"><div class="sc-section__head"><h2>PE header</h2></div><div class="sc-section__body"><div class="sc-summary-grid">
          <div><div class="sc-kv__label">Architettura</div><div class="sc-kv__val">${esc(data.pe.machine)}</div></div>
          <div><div class="sc-kv__label">Sezioni</div><div class="sc-kv__val">${esc(data.pe.sections)}</div></div>
          <div><div class="sc-kv__label">Subsystem</div><div class="sc-kv__val">${esc(data.pe.subsystem)}</div></div>
          <div><div class="sc-kv__label">DLL</div><div class="sc-kv__val">${data.pe.isDll ? 'Sì' : 'No'}</div></div>
        </div></div></div>`
          : ''
      }

      <div class="sc-section">
        <div class="sc-section__head"><h2>Pattern statici</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Indicatore</th><th>Categoria</th><th>Severità</th></tr></thead><tbody>${patternRows}</tbody></table></div>
      </div>

      <div class="sc-section">
        <div class="sc-section__head"><h2>Stringhe (campione)</h2><span class="sc-badge sc-badge--info">${data.strings?.count || 0}</span></div>
        <div class="sc-section__body"><ul class="sc-limit-list">${stringSample || '<li class="sc-muted">Nessuna stringa ASCII significativa</li>'}</ul></div>
      </div>

      ${
        (data.network?.urls?.length || data.network?.ips?.length)
          ? `<div class="sc-section"><div class="sc-section__head"><h2>Indicatori di rete</h2></div><div class="sc-section__body">
          ${data.network.urls?.length ? `<p class="sc-muted"><strong>URL:</strong> ${data.network.urls.map((u) => `<code>${esc(u)}</code>`).join(' ')}</p>` : ''}
          ${data.network.ips?.length ? `<p class="sc-muted"><strong>IP:</strong> ${data.network.ips.map((i) => `<code>${esc(i)}</code>`).join(' ')}</p>` : ''}
        </div></div>`
          : ''
      }

      <div class="sc-section">
        <div class="sc-section__head"><h2>Score breakdown</h2></div>
        <div class="sc-section__body"><table class="sc-table"><thead><tr><th>Controllo</th><th>Punti</th><th>Severità</th></tr></thead><tbody>${breakdownRows || '<tr><td colspan="3">Nessuna detrazione</td></tr>'}</tbody></table></div>
      </div>
    `;

    $('faResults').classList.add('is-active');
    bindSections();
    document.getElementById('faExportJson')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `evil-file-scan-${Date.now()}.json`;
      link.click();
    });
  }

  function renderLocalHashOnly(file, sha256) {
    $('faResults').innerHTML = `
      <div class="sc-callout">
        <strong>Hash locale (file non inviato al server)</strong>
        <p style="margin-top:0.5rem">SHA-256: <code>${esc(sha256)}</code></p>
        <p class="sc-muted" style="margin-top:0.5rem">Per analisi statica completa (entropia, PE, pattern) attiva «Scansione completa» e ricarica.</p>
        <a class="sc-btn sc-btn--ghost evil-external-link" style="margin-top:0.75rem;display:inline-block" href="https://www.virustotal.com/gui/file/${esc(sha256)}" target="_blank" rel="noopener noreferrer">VirusTotal →</a>
      </div>
    `;
    $('faResults').classList.add('is-active');
  }

  async function runScan() {
    const file = pendingFile || $('faFile').files?.[0];
    if (!file || !$('faAuth').checked) {
      alert('Seleziona un file e conferma autorizzazione.');
      return;
    }

    const mode = document.querySelector('input[name="faMode"]:checked')?.value || 'full';
    const btn = $('faScanBtn');
    btn.disabled = true;
    $('faLog').innerHTML = '';
    $('faResults').classList.remove('is-active');
    $('faResults').innerHTML = '';

    try {
      log(`File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'info');

      if (mode === 'hash') {
        log('Calcolo SHA-256 in locale (Web Crypto)…', 'run');
        const sha256 = await sha256Local(file);
        log('Hash calcolato — file non trasmesso', 'ok');
        renderLocalHashOnly(file, sha256);
        return;
      }

      ['Lettura buffer', 'Hash MD5/SHA', 'Magic bytes & entropia', 'Pattern & stringhe', 'Scoring'].forEach((p) =>
        log(p + '…', 'run')
      );

      const data = await EvilTools.uploadToolFile('/api/file-scan', file);
      const r = data.result;
      r.scanDurationMs = data.scanDurationMs;
      log(`Completato — Grade ${r.grade} · ${r.verdict?.label}`, 'ok');
      renderReport(r);
    } catch (err) {
      log(err.message, 'err');
      $('faResults').innerHTML = `<div class="sc-callout"><strong>Scansione fallita</strong><br>${esc(err.message)}</div>`;
      $('faResults').classList.add('is-active');
    } finally {
      btn.disabled = !file || !$('faAuth').checked;
      btn.textContent = 'Avvia scansione statica';
    }
  }

  function resetScan() {
    pendingFile = null;
    $('faFile').value = '';
    $('faAuth').checked = false;
    $('faScanBtn').disabled = true;
    $('faLog').innerHTML = '';
    $('faLog').classList.remove('is-active');
    $('faResults').classList.remove('is-active');
    $('faResults').innerHTML = '';
    $('faFileName').textContent = 'Trascina un file o clicca per selezionare';
    lastReport = null;
  }

  function setFile(file) {
    if (!file) return;
    pendingFile = file;
    $('faFileName').textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB`;
    $('faScanBtn').disabled = !$('faAuth').checked;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const drop = $('faDrop');
    const input = $('faFile');
    const auth = $('faAuth');

    auth.addEventListener('change', () => {
      $('faScanBtn').disabled = !auth.checked || !(pendingFile || input.files?.[0]);
    });

    input.addEventListener('change', () => setFile(input.files?.[0]));

    drop.addEventListener('click', () => input.click());
    drop.addEventListener('dragover', (e) => {
      e.preventDefault();
      drop.classList.add('is-dragover');
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        setFile(file);
        try {
          const dt = new DataTransfer();
          dt.items.add(file);
          input.files = dt.files;
        } catch {
          /* ignore */
        }
      }
    });

    $('faScanBtn').addEventListener('click', runScan);
    $('faResetBtn').addEventListener('click', resetScan);
  });
})();

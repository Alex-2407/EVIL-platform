/**
 * EVIL Analisi file — interfaccia (analisi statica: il file non viene mai eseguito né salvato)
 */
(function () {
  'use strict';
  const { t } = window.EVIL_I18N;
  const R = window.EvilToolReport;
  const esc = R.esc;
  const $ = (id) => document.getElementById(id);
  let pendingFile = null;

  const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
  const kv = (rows) => `<dl class="tr-kv">${rows.filter((r) => r[1] != null && r[1] !== '').map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

  function showError(msg) {
    const el = $('faError');
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  async function sha256Local(file) {
    const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const safeVt = (u) => (/^https:\/\/www\.virustotal\.com\//.test(u || '') ? u : 'https://www.virustotal.com');

  function tabOverview(d) {
    const v = d.verdict || {};
    const vt = safeVt(d.virusTotalUrl);
    const hero = `<div class="tr-hero">
      ${R.ring(d.score, d.grade)}
      <div>
        <h2>${esc(v.label || R.verdict(d.grade).title)}</h2>
        <p>${esc(v.note || '')}</p>
        <dl class="tr-facts">
          <div><dt>${esc(t('File'))}</dt><dd>${esc(d.originalName)}</dd></div>
          <div><dt>${esc(t('Dimensione'))}</dt><dd>${esc(kb(d.size))}</dd></div>
          <div><dt>${esc(t('Tipo rilevato'))}</dt><dd>${esc((d.fileType && d.fileType.detected) || '—')}</dd></div>
        </dl>
        <div class="tr-actions">
          <button type="button" class="sc-btn sc-btn--primary" data-act="copy">${esc(t('Copia riepilogo'))}</button>
          <button type="button" class="sc-btn sc-btn--ghost" data-act="print">${esc(t('Stampa / salva PDF'))}</button>
          <a class="sc-btn sc-btn--ghost evil-external-link" href="${esc(vt)}" target="_blank" rel="noopener noreferrer">VirusTotal →</a>
        </div>
      </div>
    </div>`;
    const list = (d.findings || []).length
      ? `<h3>${esc(t('Cosa abbiamo trovato'))}</h3>${R.findings(d.findings)}`
      : `<p class="tr-muted">${esc(t('Nessun elemento sospetto rilevato dall’analisi statica.'))}</p>`;
    return `${hero}${list}<h3>${esc(t('Perché questo voto'))}</h3>${R.breakdown(d.scoreBreakdown)}`;
  }

  function tabDetails(d) {
    let html = `<h3>${esc(t('Impronte digitali (hash)'))}</h3><p class="tr-muted">${esc(t('Servono a riconoscere lo stesso file ovunque: incolla lo SHA-256 su VirusTotal per vedere cosa ne dicono gli antivirus.'))}</p>`;
    html += kv([['MD5', d.hashes && d.hashes.md5], ['SHA-1', d.hashes && d.hashes.sha1], ['SHA-256', d.hashes && d.hashes.sha256]]);
    html += `<h3>${esc(t('Struttura del file'))}</h3>`;
    html += kv([
      [t('Entropia'), d.entropy ? `${d.entropy.shannon} (${d.entropy.label})` : null],
      [t('Architettura'), d.pe && d.pe.machine],
      [t('Sezioni'), d.pe && d.pe.sections],
      [t('Libreria (DLL)'), d.pe ? (d.pe.isDll ? t('Sì') : t('No')) : null],
    ]);
    html += `<p class="tr-muted">${esc(t('Entropia alta (vicino a 8) significa dati compressi o cifrati: normale negli archivi, sospetto negli eseguibili.'))}</p>`;
    return html;
  }

  function tabIndicators(d) {
    const pats = d.patternHits || [];
    const net = d.network || {};
    let html = `<h3>${esc(t('Schemi noti'))}</h3>`;
    html += pats.length
      ? `<div class="tr-checks">${pats.map((p) => `<div class="tr-check tr-check--${p.severity === 'high' || p.severity === 'critical' ? 'bad' : 'warn'}"><div class="tr-check__body" style="padding:0.7rem 1rem"><strong>${esc(p.name)}</strong> <span class="tr-chip">${esc(p.category)}</span></div></div>`).join('')}</div>`
      : `<p class="tr-muted">${esc(t('Nessuno schema noto.'))}</p>`;
    html += `<h3>${esc(t('Indirizzi dentro il file'))}</h3>`;
    html += (net.urls || []).length || (net.ips || []).length
      ? kv([['URL', (net.urls || []).join(' · ')], ['IP', (net.ips || []).join(' · ')]])
      : `<p class="tr-muted">${esc(t('Nessun URL o IP trovato.'))}</p>`;
    const sample = (d.strings && d.strings.sample) || [];
    html += `<h3>${esc(t('Testo leggibile (campione)'))}</h3>`;
    html += sample.length ? `<div class="tr-check__body" style="padding:0">${sample.slice(0, 30).map((s) => `<code>${esc(s)}</code>`).join('')}</div>` : `<p class="tr-muted">${esc(t('Nessun testo leggibile significativo.'))}</p>`;
    return html;
  }

  function render(d) {
    const host = $('faResults');
    host.hidden = false;
    host.innerHTML = '<div id="faTabs"></div>';
    R.tabs($('faTabs'), [
      { id: 'overview', label: t('Panoramica'), html: tabOverview(d), badge: (d.findings || []).length || null },
      { id: 'details', label: t('Dettagli tecnici'), html: tabDetails(d) },
      { id: 'ind', label: t('Indizi'), html: tabIndicators(d) },
    ]);
    if ((d.limitations || []).length) {
      host.insertAdjacentHTML('beforeend', `<details class="tr-more"><summary>${esc(t('Sicurezza e limiti'))}</summary><div><ul>${d.limitations.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div></details>`);
    }
    R.animateRings(host);
    R.bindActions(host, () => R.summaryText(
      t('Analisi file — {name}', { name: d.originalName }),
      [[t('Voto'), `${d.grade} (${Math.round(d.score)}/100)`], [t('Verdetto'), (d.verdict && d.verdict.label) || ''], ['SHA-256', (d.hashes && d.hashes.sha256) || '']],
      d.findings
    ));
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderHashOnly(sha256) {
    const host = $('faResults');
    host.hidden = false;
    host.innerHTML = `<div class="tr-hero"><div><h2>${esc(t('Hash calcolato sul tuo dispositivo'))}</h2><p>${esc(t('Il file non è stato inviato a nessun server.'))}</p>
      ${kv([['SHA-256', sha256]])}
      <div class="tr-actions"><a class="sc-btn sc-btn--primary evil-external-link" href="https://www.virustotal.com/gui/file/${esc(sha256)}" target="_blank" rel="noopener noreferrer">${esc(t('Cerca su VirusTotal'))} →</a></div></div></div>`;
  }

  async function runScan() {
    showError('');
    const file = pendingFile || ($('faFile').files && $('faFile').files[0]);
    if (!file) { showError(t('Scegli prima un file.')); return; }
    if (!$('faAuth').checked) { showError(t('Conferma di essere autorizzato ad analizzare il file.')); return; }
    const mode = (document.querySelector('input[name="faMode"]:checked') || {}).value || 'full';
    const btn = $('faScanBtn');
    btn.disabled = true;
    $('faResults').hidden = true;
    $('faResults').innerHTML = '';

    if (mode === 'hash') {
      try {
        renderHashOnly(await sha256Local(file));
      } catch (_) {
        showError(t('Impossibile calcolare l’hash di questo file.'));
      }
      btn.disabled = false;
      return;
    }

    const steps = R.stepper($('faSteps'), [t('Lettura del file'), t('Hash e tipo di file'), t('Entropia e struttura'), t('Schemi e testo'), t('Calcolo del voto')]);
    steps.start();
    try {
      const data = await EvilTools.uploadToolFile('/api/file-scan', file);
      const r = data.result;
      r.scanDurationMs = data.scanDurationMs;
      steps.finish(true);
      setTimeout(() => steps.hide(), 600);
      render(r);
    } catch (err) {
      steps.finish(false);
      showError(err.message || t('Analisi non riuscita.'));
    } finally {
      btn.disabled = !$('faAuth').checked;
    }
  }

  function reset() {
    pendingFile = null;
    $('faFile').value = '';
    $('faAuth').checked = false;
    $('faScanBtn').disabled = true;
    showError('');
    $('faSteps').hidden = true;
    $('faSteps').innerHTML = '';
    $('faResults').hidden = true;
    $('faResults').innerHTML = '';
    $('faFileName').textContent = t('Trascina un file o clicca per selezionare');
  }

  function setFile(file) {
    if (!file) return;
    pendingFile = file;
    showError('');
    $('faFileName').textContent = `${file.name} · ${kb(file.size)}`;
    $('faScanBtn').disabled = !$('faAuth').checked;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const drop = $('faDrop');
    const input = $('faFile');
    const auth = $('faAuth');
    auth.addEventListener('change', () => { $('faScanBtn').disabled = !auth.checked || !(pendingFile || (input.files && input.files[0])); });
    input.addEventListener('change', () => setFile(input.files && input.files[0]));
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('is-dragover'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
    drop.addEventListener('drop', (e) => {
      e.preventDefault();
      drop.classList.remove('is-dragover');
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) setFile(file);
    });
    $('faScanBtn').addEventListener('click', runScan);
    $('faResetBtn').addEventListener('click', reset);
  });
})();

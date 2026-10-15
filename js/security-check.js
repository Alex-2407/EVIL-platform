/**
 * EVIL Check URL — interfaccia (risultati a schede, riepilogo copiabile, stampa)
 */
(function () {
  'use strict';
  const { t, url: localUrl } = window.EVIL_I18N;
  const R = window.EvilToolReport;
  const esc = R.esc;
  const $ = (id) => document.getElementById(id);
  const page = window.location.pathname.split('/').pop() || 'security-check.html';
  const LOGIN_URL = localUrl('/account.html?redirect=' + encodeURIComponent(page));

  function showError(msg) {
    const el = $('scError');
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  const kv = (rows) => `<dl class="tr-kv">${rows.filter((r) => r[1] != null && r[1] !== '').map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  const safeHref = (u) => (/^https?:\/\//i.test(u) ? esc(u) : '#');

  function tabOverview(d) {
    const v = R.verdict(d.grade);
    const a = d.analysis || {};
    const hero = `<div class="tr-hero" style="--g:${esc(({ A: '#34d399', B: '#86efac', C: '#f59e0b', D: '#fb923c', F: '#fb7185' })[d.grade] || '#94a3b8')}">
      ${R.ring(d.security_score, d.grade)}
      <div>
        <h2>${esc(v.title)}</h2>
        <p>${esc(v.text)}</p>
        <dl class="tr-facts">
          <div><dt>${esc(t('Sito'))}</dt><dd>${esc(d.domain)}</dd></div>
          <div><dt>${esc(t('Indirizzo IP'))}</dt><dd>${esc(a.ip || '—')}</dd></div>
          <div><dt>${esc(t('Durata'))}</dt><dd>${esc(((d.scanDurationMs || 0) / 1000).toFixed(1))} s</dd></div>
        </dl>
        <div class="tr-actions">
          <button type="button" class="sc-btn sc-btn--primary" data-act="copy">${esc(t('Copia riepilogo'))}</button>
          <button type="button" class="sc-btn sc-btn--ghost" data-act="print">${esc(t('Stampa / salva PDF'))}</button>
        </div>
      </div>
    </div>`;
    const list = (d.findings || []).length
      ? `<h3>${esc(t('Cosa sistemare'))}</h3>${R.findings(d.findings)}`
      : `<p class="tr-muted">${esc(t('Nessun problema rilevato.'))}</p>`;
    return `${hero}${list}<h3>${esc(t('Perché questo voto'))}</h3>${R.breakdown(d.scoreBreakdown)}`;
  }

  function tabConnection(d) {
    const a = d.analysis || {};
    const tls = a.tls || {};
    let html = `<h3>${esc(t('Certificato HTTPS'))}</h3>`;
    if (tls.skipped) html += `<p class="tr-muted">${esc(t('Il sito non usa HTTPS: nessun certificato da controllare.'))}</p>`;
    else if (tls.error) html += `<p class="tr-error">${esc(tls.error)}</p>`;
    else {
      html += kv([
        [t('Valido'), tls.isExpired ? t('Scaduto') : tls.authorized ? t('Sì, di un’autorità riconosciuta') : t('Non riconosciuto')],
        [t('Scade tra'), tls.daysUntilExpiry != null ? t('{n} giorni', { n: tls.daysUntilExpiry }) : null],
        [t('Rilasciato da'), tls.issuer && (tls.issuer.O || tls.issuer.CN)],
        [t('Intestato a'), tls.subject && (tls.subject.CN || tls.subject.O)],
        [t('Protocollo'), tls.protocol],
        [t('Cifratura'), tls.cipher && tls.cipher.name],
        [t('Valido dal'), tls.validFrom],
        [t('Valido fino al'), tls.validTo],
      ]);
      if ((tls.subjectAltNames || []).length) html += `<h3>${esc(t('Nomi coperti'))}</h3><p class="tr-muted">${esc(tls.subjectAltNames.slice(0, 12).join(', '))}${tls.subjectAltNames.length > 12 ? '…' : ''}</p>`;
    }
    const chain = a.redirects || [];
    html += `<h3>${esc(t('Percorso della richiesta'))}</h3>`;
    html += chain.length
      ? `<ol class="tr-chain">${chain.map((h) => `<li>${esc(h.url)}<em>${esc(h.error ? t('errore') : h.status)}</em></li>`).join('')}</ol>`
      : `<p class="tr-muted">${esc(t('Nessun dato.'))}</p>`;
    return html;
  }

  function tabHeaders(d) {
    const rows = (d.analysis && d.analysis.http && d.analysis.http.headerAudit) || [];
    if (!rows.length) return `<p class="tr-muted">${esc(t('Nessun dato.'))}</p>`;
    return `<div class="tr-checks">${rows.filter((h) => !h.skipped).map((h) => {
      const cls = h.present ? 'ok' : (h.severity === 'info' || h.severity === 'low' ? 'warn' : 'bad');
      return `<details class="tr-check tr-check--${cls}"><summary><span class="tr-check__icon">${h.present ? '✓' : '!'}</span><div><strong>${esc(h.label)}</strong></div><span class="tr-chip tr-chip--${cls}">${esc(h.present ? t('Presente') : t('Assente'))}</span></summary>
      <div class="tr-check__body">${h.recommendation ? esc(h.recommendation) : ''}${h.value ? `<code>${esc(h.value)}</code>` : ''}</div></details>`;
    }).join('')}</div>`;
  }

  function tabNetwork(d) {
    const a = d.analysis || {};
    const n = a.network || {};
    const rec = (a.dns && a.dns.records) || {};
    const fmt = (arr, f) => (arr && arr.length ? arr.slice(0, 6).map(f || String).join(', ') : null);
    let html = `<h3>${esc(t('Chi ospita il sito'))}</h3>`;
    html += kv([[t('Organizzazione'), n.org || n.name], [t('Paese'), n.country], [t('Blocco di rete'), n.cidr], [t('Nome inverso (PTR)'), fmt(a.dns && a.dns.reverse)]]);
    if (n.error) html += `<p class="tr-muted">${esc(t('Informazioni di rete non disponibili in questo momento.'))}</p>`;
    html += `<h3>${esc(t('Record DNS'))}</h3>`;
    html += kv([
      ['A', fmt(rec.A)], ['AAAA', fmt(rec.AAAA)], ['NS', fmt(rec.NS)],
      ['MX', fmt(rec.MX, (m) => m.exchange || m)],
      ['CAA', fmt(rec.CAA, (c) => `${c.issue || c.issuewild || c.iodef || ''}`)],
    ]);
    return html;
  }

  function tabFiles(d) {
    const files = (d.analysis && d.analysis.discovery) || [];
    if (!files.length) return `<p class="tr-muted">${esc(t('Nessun dato.'))}</p>`;
    return `<div class="tr-checks">${files.map((f) => `<details class="tr-check tr-check--${f.found ? 'ok' : 'warn'}"${f.found && f.preview ? '' : ' open'}><summary><span class="tr-check__icon">${f.found ? '✓' : '–'}</span><div><strong>${esc(f.label)}</strong><small>${esc(f.url)}</small></div><span class="tr-chip tr-chip--${f.found ? 'ok' : 'warn'}">${esc(f.found ? t('Trovato') : t('Non trovato'))}</span></summary>${f.found && f.preview ? `<div class="tr-check__body"><code>${esc(f.preview)}</code></div>` : ''}</details>`).join('')}</div>`;
  }

  function limitations(d) {
    const l = d.limitations || [];
    if (!l.length) return '';
    return `<details class="tr-more"><summary>${esc(t('Cosa questa analisi non può dirti'))}</summary><div><ul>${l.map((x) => `<li><strong>${esc(x.title)}.</strong> ${esc(x.detail)}${(x.links || []).filter((k) => /^https:\/\//i.test(k.url || '')).map((k) => ` <a href="${esc(k.url)}" target="_blank" rel="noopener noreferrer">${esc(k.label || k.url)}</a>`).join('')}</li>`).join('')}</ul></div></details>`;
  }

  function render(d) {
    const host = $('scResults');
    host.hidden = false;
    host.innerHTML = '<div id="scTabs"></div>';
    R.tabs($('scTabs'), [
      { id: 'overview', label: t('Panoramica'), html: tabOverview(d), badge: (d.findings || []).length || null },
      { id: 'conn', label: t('Connessione'), html: tabConnection(d) },
      { id: 'headers', label: t('Header'), html: tabHeaders(d) },
      { id: 'net', label: t('Rete e DNS'), html: tabNetwork(d) },
      { id: 'files', label: t('File pubblici'), html: tabFiles(d) },
    ]);
    host.insertAdjacentHTML('beforeend', limitations(d));
    R.animateRings(host);
    R.bindActions(host, () => R.summaryText(
      t('Check URL — {site}', { site: d.domain }),
      [[t('Voto'), `${d.grade} (${d.security_score}/100)`], [t('Indirizzo'), d.finalUrl || d.url]],
      d.findings
    ));
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function runScan() {
    showError('');
    if (typeof ensureAuthenticatedOrRedirect === 'function') {
      if (!(await ensureAuthenticatedOrRedirect(page))) return;
    } else if (typeof isAuthenticated === 'function' && !isAuthenticated()) {
      window.location.href = LOGIN_URL;
      return;
    }
    const target = R.normalizeUrl($('scUrl').value);
    if (!target) { showError(t('Scrivi un indirizzo valido, ad esempio esempio.it')); return; }
    if (!$('scAuth').checked) { showError(t('Conferma di essere autorizzato ad analizzare il sito.')); return; }

    const btn = $('scScanBtn');
    btn.disabled = true;
    btn.textContent = t('Scansione in corso…');
    $('scResults').hidden = true;
    $('scResults').innerHTML = '';
    const steps = R.stepper($('scSteps'), [
      t('Risoluzione DNS e rete'), t('Percorso dei redirect'), t('Certificato HTTPS'), t('Header di sicurezza'), t('File pubblici'),
    ]);
    steps.start();
    try {
      const fetchFn = typeof fetchAuthenticated === 'function' ? fetchAuthenticated : fetch;
      const response = await fetchFn('/api/scan', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      if (response.status === 401) { window.location.href = LOGIN_URL; return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t('Errore del server ({status})', { status: response.status }));
      steps.finish(true);
      setTimeout(() => steps.hide(), 600);
      render(data);
      if (typeof incrementScans === 'function' && typeof isAuthenticated === 'function' && isAuthenticated()) {
        await incrementScans({ scanType: 'advanced_url_scanner', grade: data.grade });
      }
    } catch (err) {
      steps.finish(false);
      showError(err.message || t('Scansione non riuscita.'));
    } finally {
      btn.textContent = t('Avvia scansione');
      btn.disabled = !$('scAuth').checked || !$('scUrl').value.trim();
    }
  }

  function reset() {
    $('scUrl').value = '';
    $('scAuth').checked = false;
    $('scScanBtn').disabled = true;
    showError('');
    $('scSteps').hidden = true;
    $('scSteps').innerHTML = '';
    $('scResults').hidden = true;
    $('scResults').innerHTML = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sync = () => { $('scScanBtn').disabled = !$('scAuth').checked || !$('scUrl').value.trim(); };
    $('scAuth').addEventListener('change', sync);
    $('scUrl').addEventListener('input', sync);
    $('scForm').addEventListener('submit', (e) => { e.preventDefault(); if (!$('scScanBtn').disabled) runScan(); });
    $('scResetBtn').addEventListener('click', reset);
  });
})();

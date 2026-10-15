/**
 * EVIL Audit header HTTP — interfaccia (risultati a schede in linguaggio semplice)
 */
(function () {
  'use strict';
  const { t } = window.EVIL_I18N;
  const R = window.EvilToolReport;
  const esc = R.esc;
  const $ = (id) => document.getElementById(id);

  function showError(msg) {
    const el = $('ahError');
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  /** A cosa serve ogni header, in una riga. */
  function purpose(id) {
    switch (id) {
      case 'hsts': return t('Obbliga il browser a usare sempre HTTPS con questo sito.');
      case 'csp': return t('Dice al browser da dove può caricare script e risorse: la difesa principale contro gli script iniettati (XSS).');
      case 'xfo': return t('Impedisce ad altri siti di mostrare le tue pagine dentro un riquadro nascosto (clickjacking).');
      case 'xcto': return t('Evita che il browser “indovini” il tipo dei file e li esegua come script.');
      case 'referrer': return t('Decide quanto dell’indirizzo di partenza viene inviato agli altri siti quando clicchi un link.');
      case 'permissions': return t('Spegne le funzioni del browser che il sito non usa (camera, microfono, posizione).');
      case 'coop': return t('Isola la finestra del sito da quelle di altri siti aperti insieme (avanzato).');
      case 'corp': return t('Impedisce ad altri siti di incorporare le tue risorse (avanzato).');
      case 'coep': return t('Richiede che le risorse caricate diano il permesso esplicito (avanzato).');
      default: return '';
    }
  }

  const kv = (rows) => `<dl class="tr-kv">${rows.filter((r) => r[1] != null && r[1] !== '').map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

  function tabOverview(d) {
    const v = R.verdict(d.grade);
    const audit = (d.headerAudit || []).filter((h) => !h.skipped && !h.optional);
    const ok = audit.filter((h) => h.present).length;
    const hero = `<div class="tr-hero">
      ${R.ring(d.security_score, d.grade)}
      <div>
        <h2>${esc(v.title)}</h2>
        <p>${esc(t('{ok} protezioni su {tot} attive.', { ok, tot: audit.length }))} ${esc(v.text)}</p>
        <dl class="tr-facts">
          <div><dt>${esc(t('Sito'))}</dt><dd>${esc(d.domain)}</dd></div>
          <div><dt>${esc(t('Risposta'))}</dt><dd>${esc(d.http ? `${d.http.status} ${d.http.statusText || ''}`.trim() : '—')}</dd></div>
          <div><dt>HTTPS</dt><dd>${esc(d.http && d.http.isHttps ? t('Sì') : t('No'))}</dd></div>
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
    return `${hero}${list}`;
  }

  function tabHeaders(d) {
    const rows = (d.headerAudit || []).filter((h) => !h.skipped);
    return `<p class="tr-muted">${esc(t('Tocca una voce per leggere a cosa serve e come attivarla.'))}</p><div class="tr-checks">${rows.map((h) => {
      const cls = h.present ? 'ok' : (h.optional || h.severity === 'low' ? 'warn' : 'bad');
      const chip = h.present ? t('Attivo') : h.optional ? t('Facoltativo') : t('Manca');
      return `<details class="tr-check tr-check--${cls}"><summary><span class="tr-check__icon">${h.present ? '✓' : h.optional ? '–' : '!'}</span><div><strong>${esc(h.label)}</strong><small>${esc(purpose(h.id))}</small></div><span class="tr-chip tr-chip--${cls}">${esc(chip)}</span></summary>
      <div class="tr-check__body">${h.present ? '' : `<b>${esc(t('Come sistemare'))}:</b> ${esc(h.recommendation || '')}`}${h.value ? `<code>${esc(h.value)}</code>` : ''}</div></details>`;
    }).join('')}</div>`;
  }

  function tabCookies(d) {
    const c = d.cookies || [];
    if (!c.length) return `<p class="tr-muted">${esc(t('Questa pagina non imposta cookie.'))}</p>`;
    const yes = (b) => esc(b ? t('Sì') : t('No'));
    return `<p class="tr-muted">${esc(t('Secure = viaggia solo su HTTPS · HttpOnly = gli script della pagina non possono leggerlo · SameSite = non parte dalle richieste di altri siti.'))}</p><div class="tr-checks">${c.map((k) => `<details class="tr-check tr-check--${k.hardened ? 'ok' : 'warn'}"><summary><span class="tr-check__icon">${k.hardened ? '✓' : '!'}</span><div><strong>${esc(k.name)}</strong><small>Secure: ${yes(k.secure)} · HttpOnly: ${yes(k.httpOnly)} · SameSite: ${esc(k.sameSite)}</small></div><span class="tr-chip tr-chip--${k.hardened ? 'ok' : 'warn'}">${esc(k.hardened ? t('Ben protetto') : t('Da rinforzare'))}</span></summary>${(k.issues || []).length ? `<div class="tr-check__body">${esc(t('Mancano: {flags}', { flags: k.issues.map((i) => i.flag).join(', ') }))}</div>` : ''}</details>`).join('')}</div>`;
  }

  function tabCsp(d) {
    const c = d.cspAnalysis || {};
    if (!c.present) return `<p class="tr-muted">${esc(t('Nessuna Content-Security-Policy: è la voce più importante da aggiungere.'))}</p>`;
    let html = kv([[t('Modalità'), c.mode === 'enforce' ? t('Attiva (blocca)') : t('Solo segnalazione')], [t('Direttive'), (c.directives || []).length]]);
    html += (c.issues || []).length
      ? `<h3>${esc(t('Punti deboli'))}</h3>${R.findings(c.issues)}`
      : `<p class="tr-muted">${esc(t('Nessun punto debole evidente nella policy.'))}</p>`;
    return html;
  }

  function tabSoftware(d) {
    const f = d.fingerprint || [];
    if (!f.length) return `<p class="tr-muted">${esc(t('Il sito non rivela software o versioni negli header.'))}</p>`;
    return `<p class="tr-muted">${esc(t('Mostrare nome e versione del software aiuta chi cerca falle note: meglio nasconderli.'))}</p><div class="tr-checks">${f.map((i) => `<div class="tr-check tr-check--warn"><div class="tr-check__body" style="padding:0.8rem 1rem"><strong>${esc(i.kind)}</strong><code>${esc(i.value)}</code>${esc(i.note || '')}</div></div>`).join('')}</div>`;
  }

  function render(d) {
    const host = $('ahResults');
    host.hidden = false;
    host.innerHTML = '<div id="ahTabs"></div>';
    R.tabs($('ahTabs'), [
      { id: 'overview', label: t('Panoramica'), html: tabOverview(d), badge: (d.findings || []).length || null },
      { id: 'headers', label: t('Header'), html: tabHeaders(d) },
      { id: 'cookies', label: t('Cookie'), html: tabCookies(d), badge: (d.cookies || []).length || null },
      { id: 'csp', label: 'CSP', html: tabCsp(d) },
      { id: 'sw', label: t('Software esposto'), html: tabSoftware(d), badge: (d.fingerprint || []).length || null },
    ]);
    if ((d.limitations || []).length) {
      host.insertAdjacentHTML('beforeend', `<details class="tr-more"><summary>${esc(t('Cosa questo audit non può dirti'))}</summary><div><ul>${d.limitations.map((x) => `<li>${esc(typeof x === 'string' ? x : `${x.title}. ${x.detail || ''}`)}</li>`).join('')}</ul></div></details>`);
    }
    R.animateRings(host);
    R.bindActions(host, () => R.summaryText(
      t('Audit header HTTP — {site}', { site: d.domain }),
      [[t('Voto'), `${d.grade} (${d.security_score}/100)`], [t('Indirizzo'), d.finalUrl || d.url || d.domain]],
      d.findings
    ));
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function runAudit() {
    showError('');
    const page = window.location.pathname.split('/').pop() || 'vulnerability-scanner.html';
    if (typeof ensureAuthenticatedOrRedirect === 'function' && !(await ensureAuthenticatedOrRedirect(page))) return;
    const target = R.normalizeUrl($('ahUrl').value);
    if (!target) { showError(t('Scrivi un indirizzo valido, ad esempio esempio.it')); return; }
    if (!$('ahAuth').checked) { showError(t('Conferma di essere autorizzato ad analizzare il sito.')); return; }

    const btn = $('ahScanBtn');
    btn.disabled = true;
    btn.textContent = t('Audit in corso…');
    $('ahResults').hidden = true;
    $('ahResults').innerHTML = '';
    const steps = R.stepper($('ahSteps'), [t('Connessione al sito'), t('Lettura degli header'), t('Controllo cookie e CSP'), t('Calcolo del voto')]);
    steps.start();
    try {
      const data = await EvilTools.postToolJson('/api/vulnerability-scan', { url: target });
      steps.finish(true);
      setTimeout(() => steps.hide(), 600);
      render(data);
      if (window.progressManager && window.progressManager.logActivity) {
        window.progressManager.logActivity('vulnerability_found', { url: target, grade: data.grade, source: 'header_audit' });
      }
    } catch (err) {
      steps.finish(false);
      showError(err.message || t('Audit non riuscito.'));
    } finally {
      btn.textContent = t('Avvia audit');
      btn.disabled = !$('ahAuth').checked || !$('ahUrl').value.trim();
    }
  }

  function reset() {
    $('ahUrl').value = '';
    $('ahAuth').checked = false;
    $('ahScanBtn').disabled = true;
    showError('');
    $('ahSteps').hidden = true;
    $('ahSteps').innerHTML = '';
    $('ahResults').hidden = true;
    $('ahResults').innerHTML = '';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const sync = () => { $('ahScanBtn').disabled = !$('ahAuth').checked || !$('ahUrl').value.trim(); };
    $('ahAuth').addEventListener('change', sync);
    $('ahUrl').addEventListener('input', sync);
    $('ahForm').addEventListener('submit', (e) => { e.preventDefault(); if (!$('ahScanBtn').disabled) runAudit(); });
    $('ahResetBtn').addEventListener('click', reset);
  });
})();

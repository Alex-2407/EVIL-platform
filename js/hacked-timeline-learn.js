/**
 * Timeline incident response — scelta scenario, metriche, controlli, allenamento al triage e report.
 * Lavora sui dati reali dello scenario caricato (window.INCIDENT_TIMELINE) senza duplicarli.
 */
(function () {
  'use strict';
  const { t } = window.EVIL_I18N;
  const api = window.IR_TIMELINE;
  const data = window.INCIDENT_TIMELINE;
  if (!api || !data) return;
  const esc = window.EVIL_UTILS.escapeHtml;

  const SEV = ['info', 'warning', 'alert', 'critical'];
  const SEV_LABEL = { info: t('informativo'), warning: t('attenzione'), alert: t('allarme'), critical: t('critico') };
  const SEV_HELP = {
    info: t('Attività da registrare: nessuna azione immediata.'),
    warning: t('Anomalia da verificare: potrebbe essere un falso positivo.'),
    alert: t('Compromissione probabile: serve intervento.'),
    critical: t('Impatto in corso o dati a rischio: priorità massima.'),
  };

  /* ───────────── utilità ───────────── */
  const secs = (hms) => { const [h, m, s] = hms.split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };
  const span = (a, b) => {
    const d = Math.max(0, secs(b) - secs(a));
    const h = Math.floor(d / 3600); const m = Math.floor((d % 3600) / 60);
    return h ? t('{h} h {m} min', { h, m }) : t('{m} min', { m });
  };
  const events = () => api.scenario().events;

  /* ───────────── scelta scenario ───────────── */
  function renderPicker() {
    const box = document.getElementById('ir-picker');
    if (!box) return;
    const cur = api.key();
    box.innerHTML = Object.values(data.SCENARIOS).map((sc) => {
      const ev = sc.events;
      const crit = ev.filter((e) => e.severity === 'critical').length;
      return `<button type="button" class="ir-pick${sc.id === cur ? ' is-on' : ''}" data-key="${esc(sc.id)}" style="--accent:${esc(sc.accent || '#fb7185')}" aria-pressed="${sc.id === cur}">
        <b>${esc(sc.name)}</b>
        <span>${esc(sc.tagline)}</span>
        <em>${esc(t('{n} eventi', { n: ev.length }))} · ${esc(span(ev[0].time, ev[ev.length - 1].time))} · ${esc(t('{n} critici', { n: crit }))}</em>
      </button>`;
    }).join('');
  }
  document.getElementById('ir-picker')?.addEventListener('click', (e) => {
    const b = e.target.closest('.ir-pick');
    if (b) api.load(b.dataset.key);
  });

  /* ───────────── metriche + controlli ───────────── */
  function renderInsights() {
    const box = document.getElementById('ir-insights');
    if (!box) return;
    const ev = events();
    const first = ev[0];
    const firstAlert = ev.find((e) => e.severity === 'alert' || e.severity === 'critical');
    const firstContain = ev.find((e) => e.phase === 'containment');
    const last = ev[ev.length - 1];
    const metrics = [
      { k: t('Dal primo segnale al primo allarme'), v: firstAlert ? span(first.time, firstAlert.time) : '—', h: t('Quanto resta debole il segnale prima di diventare evidente.') },
      { k: t('Dal primo allarme al contenimento'), v: firstAlert && firstContain ? span(firstAlert.time, firstContain.time) : '—', h: t('Tempo in cui l’attaccante agisce mentre il SOC già sa.') },
      { k: t('Durata dell’incidente'), v: span(first.time, last.time), h: t('Dal primo evento al ripristino.') },
      { k: t('Eventi critici'), v: String(ev.filter((e) => e.severity === 'critical').length), h: t('Quelli con impatto in corso o dati a rischio.') },
    ];
    const ctl = new Map();
    ev.forEach((e, i) => (e.mitigations || []).forEach((m) => { if (!ctl.has(m)) ctl.set(m, []); ctl.get(m).push(i); }));
    const phaseOf = (i) => (data.PHASES.find((p) => p.id === ev[i].phase) || {}).label || '';
    box.innerHTML = `
      <div class="ir-metrics">${metrics.map((m) => `<div class="ir-metric"><span>${esc(m.k)}</span><b>${esc(m.v)}</b><small>${esc(m.h)}</small></div>`).join('')}</div>
      <h4 class="ir-sub">${esc(t('Controlli che avrebbero cambiato l’esito'))}</h4>
      <p class="ir-note">${esc(t('Raccolti da tutte le tappe di questo scenario. Ogni controllo rimanda all’evento in cui sarebbe intervenuto.'))}</p>
      <ul class="ir-controls-list">${[...ctl.entries()].map(([m, idx]) => `<li><span>${esc(m)}</span>${idx.map((i) => `<button type="button" class="ir-jump" data-i="${i}" title="${esc(ev[i].title)}">${esc(ev[i].time.slice(0, 5))} · ${esc(phaseOf(i))}</button>`).join('')}</li>`).join('')}</ul>`;
  }
  document.getElementById('ir-insights')?.addEventListener('click', (e) => {
    const b = e.target.closest('.ir-jump');
    if (!b) return;
    api.jump(Number(b.dataset.i));
    document.getElementById('ir-events')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ───────────── triage ───────────── */
  let tri = { i: 0, score: 0, answered: null, order: [] };
  function triReset() { tri = { i: 0, score: 0, answered: null, order: events().map((_, i) => i) }; renderTriage(); }
  function renderTriage() {
    const box = document.getElementById('ir-triage');
    if (!box) return;
    const ev = events();
    if (tri.i >= tri.order.length) {
      const pct = Math.round((tri.score / ev.length) * 100);
      box.innerHTML = `<div class="ir-tri-end"><b>${esc(t('{score} su {total} classificati come previsto', { score: tri.score, total: ev.length }))}</b>
        <p>${esc(pct >= 75 ? t('Ottimo: leggi bene i segnali deboli e sai quando alzare la gravità.') : t('Rivedi le tappe in cui hai sbagliato: la gravità dipende da impatto in corso e dati coinvolti, non solo dalla tecnica.'))}</p>
        <button type="button" class="ir-btn" data-act="restart">${esc(t('Rifai il triage'))}</button></div>`;
      return;
    }
    const e = ev[tri.order[tri.i]];
    const done = tri.answered !== null;
    box.innerHTML = `
      <p class="ir-tri-step">${esc(t('Evento {n} di {total}', { n: tri.i + 1, total: ev.length }))} · <time>${esc(e.time)}</time></p>
      <h4 class="ir-tri-title">${esc(e.title)}</h4>
      <p>${esc(e.description)}</p>
      <p class="ir-tri-soc"><b>${esc(t('Cosa vede il SOC'))}</b> ${esc(e.soc)}</p>
      <div class="ir-tri-opts" role="group" aria-label="${esc(t('Quale gravità assegni?'))}">${SEV.map((s) => `<button type="button" class="ir-tri-opt ir-tri-opt--${s}${done && s === e.severity ? ' is-right' : ''}${done && s === tri.answered && s !== e.severity ? ' is-wrong' : ''}" data-sev="${s}" ${done ? 'disabled' : ''}><b>${esc(SEV_LABEL[s])}</b><small>${esc(SEV_HELP[s])}</small></button>`).join('')}</div>
      ${done ? `<div class="ir-tri-fb" role="status"><p><b>${esc(tri.answered === e.severity ? t('Esatto.') : t('Qui la gravità è: {sev}.', { sev: SEV_LABEL[e.severity] }))}</b></p>
        ${e.decision ? `<p><b>${esc(t('Decisione corretta'))}</b> ${esc(e.decision)}</p>` : ''}
        <button type="button" class="ir-btn" data-act="next">${esc(tri.i + 1 >= ev.length ? t('Vedi il risultato') : t('Prossimo evento'))}</button></div>` : ''}`;
  }
  document.getElementById('ir-triage')?.addEventListener('click', (ev) => {
    const opt = ev.target.closest('[data-sev]');
    if (opt && tri.answered === null) {
      tri.answered = opt.dataset.sev;
      if (tri.answered === events()[tri.order[tri.i]].severity) tri.score += 1;
      renderTriage();
      return;
    }
    const act = ev.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'next') { tri.i += 1; tri.answered = null; renderTriage(); }
    if (act.dataset.act === 'restart') triReset();
  });

  /* ───────────── report ───────────── */
  function buildReport() {
    const sc = api.scenario(); const ev = sc.events;
    const first = ev[0]; const last = ev[ev.length - 1];
    const breach = ev.some((e) => e.phase === 'exfiltration');
    const mit = [...new Set(ev.flatMap((e) => e.mitigations || []))];
    const mitre = [...new Set(ev.map((e) => e.mitre).filter(Boolean))];
    const lines = [];
    lines.push(`# ${t('Report di incidente')} — ${sc.name}`, '');
    lines.push(`> ${t('Esercitazione didattica EVIL: dati e orari simulati.')}`, '');
    lines.push(`## ${t('Sintesi')}`, sc.tagline, '');
    lines.push(`- **${t('Durata')}:** ${span(first.time, last.time)} (${first.time} → ${last.time})`);
    lines.push(`- **${t('Dati a rischio')}:** ${sc.recordsAtRisk}`);
    lines.push(`- **${t('Eventi')}:** ${ev.length}, ${t('di cui critici')}: ${ev.filter((e) => e.severity === 'critical').length}`, '');
    lines.push(`## ${t('Contesto')}`, sc.context, '');
    lines.push(`## ${t('Cronologia')}`, '', `| ${t('Ora')} | ${t('Gravità')} | ${t('Evento')} | ${t('Riferimento')} |`, '|---|---|---|---|');
    ev.forEach((e) => lines.push(`| ${e.time} | ${SEV_LABEL[e.severity]} | ${e.title} | ${e.mitre || ''} |`));
    lines.push('', `## ${t('Decisioni chiave')}`);
    ev.filter((e) => e.decision).forEach((e) => lines.push(`- **${e.time} ${e.title}:** ${e.decision}`));
    lines.push('', `## ${t('Azioni correttive raccomandate')}`);
    mit.forEach((m) => lines.push(`- ${m}`));
    lines.push('', `## ${t('Riferimenti MITRE ATT&CK')}`);
    mitre.forEach((m) => lines.push(`- ${m}`));
    if (breach) {
      lines.push('', `## ${t('Obblighi di notifica')}`, t('Se sono coinvolti dati personali, il titolare notifica la violazione al Garante entro 72 ore dalla scoperta (art. 33 GDPR) e valuta la comunicazione agli interessati (art. 34).'));
    }
    lines.push('', `## ${t('Lezioni apprese')}`, `- ${t('Cosa ha funzionato:')} `, `- ${t('Cosa va migliorato:')} `, `- ${t('Responsabile e scadenza delle azioni:')} `, '');
    return lines.join('\n');
  }
  function renderReport() {
    const pre = document.getElementById('ir-report-text');
    if (pre) pre.value = buildReport();
  }
  document.getElementById('ir-report-copy')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget; const txt = document.getElementById('ir-report-text').value;
    try { await navigator.clipboard.writeText(txt); btn.textContent = t('Copiato'); } catch (_) { document.getElementById('ir-report-text').select(); btn.textContent = t('Seleziona e copia con Ctrl+C'); }
    setTimeout(() => { btn.textContent = t('Copia il report'); }, 1800);
  });
  document.getElementById('ir-report-dl')?.addEventListener('click', () => {
    const blob = new Blob([document.getElementById('ir-report-text').value], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `report-incidente-${api.key()}.md`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 500);
  });

  /* ───────────── schede ───────────── */
  const tabs = [...document.querySelectorAll('.ir-tab')];
  function showTab(id) {
    tabs.forEach((b) => { const on = b.dataset.tab === id; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll('.ir-tabpanel').forEach((p) => { p.hidden = p.id !== 'ir-tab-' + id; });
  }
  tabs.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  function refresh() { renderPicker(); renderInsights(); renderReport(); triReset(); }
  document.addEventListener('ir:scenario', refresh);
  refresh();
})();

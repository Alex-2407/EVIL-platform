/**
 * Componenti condivisi dei risultati degli strumenti (Check URL, Audit header):
 * punteggio animato, avanzamento a passi, elenco "cosa sistemare", schede a tab,
 * riepilogo da copiare e stampa. Tutto il testo che arriva dal server passa da escapeHtml.
 */
(function () {
  'use strict';

  const { t } = window.EVIL_I18N;
  const esc = window.EVIL_UTILS.escapeHtml;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const SEV_ICON = { critical: '⛔', high: '🔴', medium: '🟠', low: '🟡', info: '🟢' };

  function sevLabel(s) {
    return { critical: t('Critica'), high: t('Alta'), medium: t('Media'), low: t('Bassa'), info: t('Info') }[s] || s;
  }

  function verdict(grade) {
    const g = String(grade || 'F').toUpperCase();
    return {
      A: { title: t('Ottima configurazione'), text: t('Le difese di base ci sono tutte. Restano al massimo piccoli ritocchi.') },
      B: { title: t('Buona configurazione'), text: t('Quasi tutto a posto: sistema le voci qui sotto per arrivare al massimo.') },
      C: { title: t('Configurazione discreta'), text: t('Mancano alcune protezioni importanti: partendo dalle prime della lista si migliora in fretta.') },
      D: { title: t('Da migliorare'), text: t('Ci sono lacune serie. Comincia dalle voci in cima alla lista.') },
      F: { title: t('Insufficiente'), text: t('Mancano protezioni fondamentali: conviene intervenire presto.') },
    }[g] || { title: '', text: '' };
  }

  const gradeColor = (g) => ({ A: '#34d399', B: '#86efac', C: '#f59e0b', D: '#fb923c', F: '#fb7185' }[String(g).toUpperCase()] || '#94a3b8');

  /** Anello del punteggio: l'arco si riempie con un'animazione. */
  function ring(score, grade) {
    const r = 52;
    const c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, Number(score) || 0));
    return `<div class="tr-ring" style="--c:${gradeColor(grade)}" role="img" aria-label="${esc(t('Punteggio {n} su 100, voto {g}', { n: Math.round(pct), g: grade }))}">
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle class="tr-ring__bg" cx="60" cy="60" r="${r}"/>
        <circle class="tr-ring__fg" cx="60" cy="60" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-offset="${(c * (1 - pct / 100)).toFixed(1)}"/>
      </svg>
      <div class="tr-ring__txt"><strong data-count="${Math.round(pct)}">0</strong><span>${esc(grade)}</span></div>
    </div>`;
  }

  /** Avvia le animazioni dell'anello e del contatore (da chiamare dopo l'inserimento nel DOM). */
  function animateRings(root) {
    root.querySelectorAll('.tr-ring').forEach((el) => {
      const fg = el.querySelector('.tr-ring__fg');
      const num = el.querySelector('[data-count]');
      const to = Number(num.dataset.count);
      if (reduced) {
        fg.style.strokeDashoffset = fg.dataset.offset;
        num.textContent = String(to);
        return;
      }
      requestAnimationFrame(() => { fg.style.strokeDashoffset = fg.dataset.offset; });
      const t0 = performance.now();
      (function step(now) {
        const p = Math.min(1, (now - t0) / 1100);
        num.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  /** Elenco "cosa sistemare": per gravità, con spiegazione e rimedio. */
  function findings(list) {
    const items = (list || []).slice().sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
    return `<ol class="tr-findings">${items.map((f, i) => `
      <li class="tr-finding tr-finding--${esc(f.severity)}" style="--i:${i}">
        <span class="tr-finding__icon" aria-hidden="true">${SEV_ICON[f.severity] || '•'}</span>
        <div>
          <strong>${esc(f.title)}</strong>
          <p>${esc(f.detail || '')}</p>
          ${f.recommendation && f.recommendation !== f.detail ? `<p class="tr-fix"><b>${esc(t('Come sistemare'))}:</b> ${esc(f.recommendation)}</p>` : ''}
        </div>
        <span class="tr-sev tr-sev--${esc(f.severity)}">${esc(sevLabel(f.severity))}</span>
      </li>`).join('')}</ol>`;
  }

  /** "Perché questo voto": detrazioni come barre. */
  function breakdown(list) {
    const rows = (list || []).filter((b) => b.delta < 0).sort((a, b) => a.delta - b.delta);
    if (!rows.length) return `<p class="tr-muted">${esc(t('Nessuna detrazione: il punteggio è il massimo.'))}</p>`;
    const max = Math.max(...rows.map((b) => -b.delta));
    return `<ul class="tr-break">${rows.map((b) => `<li><span>${esc(b.label)}</span><i style="--w:${Math.round((-b.delta / max) * 100)}%"></i><b>${b.delta}</b></li>`).join('')}</ul>`;
  }

  /** Passi di avanzamento. start() li anima in sequenza, finish() li chiude. */
  function stepper(host, labels) {
    host.innerHTML = `<ol class="tr-steps">${labels.map((l) => `<li><i></i><span>${esc(l)}</span></li>`).join('')}</ol>`;
    host.hidden = false;
    const items = [...host.querySelectorAll('li')];
    let idx = 0;
    let timer = null;
    const mark = () => {
      items.forEach((li, i) => {
        li.classList.toggle('is-done', i < idx);
        li.classList.toggle('is-active', i === idx);
      });
    };
    return {
      start() {
        mark();
        timer = setInterval(() => { if (idx < items.length - 1) { idx += 1; mark(); } }, 1100);
      },
      finish(ok = true) {
        clearInterval(timer);
        items.forEach((li) => { li.classList.remove('is-active'); li.classList.toggle('is-done', ok); li.classList.toggle('is-fail', !ok); });
      },
      hide() { clearInterval(timer); host.hidden = true; host.innerHTML = ''; },
    };
  }

  /** Schede a tab accessibili: tabs = [{id,label,html,badge?}] */
  function tabs(host, defs) {
    host.innerHTML = `<div class="tr-tabs" role="tablist">${defs.map((d, i) => `<button type="button" role="tab" id="trt-${esc(d.id)}" aria-controls="trp-${esc(d.id)}" aria-selected="${i === 0}" data-tab="${esc(d.id)}">${esc(d.label)}${d.badge != null ? `<b>${esc(d.badge)}</b>` : ''}</button>`).join('')}</div>
      ${defs.map((d, i) => `<section class="tr-panel" role="tabpanel" id="trp-${esc(d.id)}" aria-labelledby="trt-${esc(d.id)}" ${i ? 'hidden' : ''}>${d.html}</section>`).join('')}`;
    const btns = [...host.querySelectorAll('[role="tab"]')];
    const select = (id) => {
      btns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
      host.querySelectorAll('[role="tabpanel"]').forEach((p) => { p.hidden = p.id !== `trp-${id}`; });
    };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => select(b.dataset.tab));
      b.addEventListener('keydown', (e) => {
        const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
        if (n == null) return;
        const next = btns[(n + btns.length) % btns.length];
        next.focus();
        select(next.dataset.tab);
      });
    });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_e) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  /** Bottoni "Copia riepilogo" e "Stampa / salva PDF" collegati a una funzione che produce il testo. */
  function bindActions(root, getText) {
    const copy = root.querySelector('[data-act="copy"]');
    const print = root.querySelector('[data-act="print"]');
    if (copy) {
      copy.addEventListener('click', async () => {
        const ok = await copyText(getText());
        const old = copy.textContent;
        copy.textContent = ok ? t('Copiato ✓') : t('Copia non riuscita');
        setTimeout(() => { copy.textContent = old; }, 1800);
      });
    }
    if (print) print.addEventListener('click', () => window.print());
  }

  function summaryText(title, rows, list) {
    const lines = [title, ''];
    rows.forEach(([k, v]) => lines.push(`${k}: ${v}`));
    lines.push('', `${t('Cosa sistemare')}:`);
    (list || []).slice().sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9)).forEach((f) => {
      lines.push(`- [${sevLabel(f.severity)}] ${f.title}${f.recommendation ? ` → ${f.recommendation}` : f.detail ? ` → ${f.detail}` : ''}`);
    });
    lines.push('', t('Generato con EVIL (projectevil.it) — lettura passiva, solo su target autorizzati.'));
    return lines.join('\n');
  }

  /** Normalizza l'indirizzo scritto dall'utente; restituisce null se non è un URL http(s) valido. */
  function normalizeUrl(raw) {
    let v = String(raw || '').trim();
    if (!v) return null;
    if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
    try {
      const u = new URL(v);
      if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return null;
      return u.toString();
    } catch (_) {
      return null;
    }
  }

  window.EvilToolReport = { ring, animateRings, findings, breakdown, stepper, tabs, bindActions, summaryText, normalizeUrl, verdict, sevLabel, esc };
})();

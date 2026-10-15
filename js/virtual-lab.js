/**
 * Laboratorio Virtuale EVIL — frontend terminale + sessioni API + modal Studia
 */
(function () {
  const { t, url } = window.EVIL_I18N;
  const catalogEl = document.getElementById('vlab-catalog');
  const gridEl = document.getElementById('vlab-grid');
  const workspaceEl = document.getElementById('vlab-workspace');
  const terminalBody = document.getElementById('vlab-terminal-body');
  const terminalInput = document.getElementById('vlab-terminal-input');
  const promptEl = document.getElementById('vlab-prompt');
  const objectivesEl = document.getElementById('vlab-objectives');
  const networkEl = document.getElementById('vlab-network');
  const sessionTitleEl = document.getElementById('vlab-session-title');
  const sessionTimerEl = document.getElementById('vlab-session-timer');
  const completeBanner = document.getElementById('vlab-complete-banner');
  const backBtn = document.getElementById('vlab-back-btn');
  const stopBtn = document.getElementById('vlab-stop-btn');
  const studyModal = document.getElementById('vlab-study-modal');
  const studyModalTitle = document.getElementById('vlab-study-title');
  const studyModalIntro = document.getElementById('vlab-study-intro');
  const studyModalSteps = document.getElementById('vlab-study-steps');
  const studyModalLaunch = document.getElementById('vlab-study-launch');
  const studySideBtn = document.getElementById('vlab-study-side-btn');

  let sessionId = null;
  let pendingPassword = false;
  let timerInterval = null;
  let expiresAt = null;
  let activeStudyLabId = null;
  let activeSessionLabId = null;

  const TERM_RE = /\{\{([a-z0-9-]+)(?:\|([^}]+))?\}\}/gi;

  const escapeHtml = window.EVIL_UTILS.escapeHtml;

  function enrichTerms(text) {
    if (!text) return '';
    const glossary = window.VLAB_GLOSSARY || {};
    return escapeHtml(text).replace(TERM_RE, (_, key, label) => {
      const def = glossary[key.toLowerCase()];
      const display = label || key;
      if (!def) return escapeHtml(display);
      return (
        `<span class="vlab-term" tabindex="0" role="button" data-def="${escapeHtml(def)}">` +
        `${escapeHtml(display)}</span>`
      );
    });
  }

  const termTooltip = document.getElementById('vlab-term-tooltip');
  let activeTerm = null;

  function hideTermTooltip() {
    activeTerm = null;
    if (!termTooltip) return;
    termTooltip.classList.remove('is-visible', 'is-above');
    termTooltip.hidden = true;
    termTooltip.textContent = '';
    studyModal?.querySelectorAll('.vlab-term.is-active').forEach((t) => t.classList.remove('is-active'));
  }

  function positionTermTooltip(term) {
    if (!termTooltip || !term?.dataset.def) return;
    activeTerm = term;
    termTooltip.textContent = term.dataset.def;
    termTooltip.hidden = false;

    termTooltip.style.left = '-9999px';
    termTooltip.style.top = '0';
    termTooltip.classList.add('is-visible');

    const rect = term.getBoundingClientRect();
    const gap = 10;
    const pad = 12;
    const tipW = termTooltip.offsetWidth;
    const tipH = termTooltip.offsetHeight;

    let above = false;
    let top = rect.bottom + gap;
    if (top + tipH > window.innerHeight - pad) {
      top = rect.top - tipH - gap;
      above = true;
    }
    top = Math.max(pad, Math.min(top, window.innerHeight - tipH - pad));

    let left = rect.left + rect.width / 2 - tipW / 2;
    left = Math.max(pad, Math.min(left, window.innerWidth - tipW - pad));

    termTooltip.style.left = `${left}px`;
    termTooltip.style.top = `${top}px`;
    termTooltip.classList.toggle('is-above', above);
  }

  function openStudy(labId) {
    const guide = window.VLAB_STUDY?.[labId];
    if (!guide || !studyModal) return;
    activeStudyLabId = labId;

    studyModalTitle.textContent = guide.title || t('Guida didattica');
    studyModalIntro.innerHTML = enrichTerms(guide.intro || '');

    studyModalSteps.innerHTML = (guide.steps || [])
      .map(
        (step, i) => `
        <li class="vlab-study-step">
          <span class="vlab-study-step__n">${escapeHtml(t('Passo {n}', { n: i + 1 }))}</span>
          <h4>${escapeHtml(step.title || '')}</h4>
          <p>${enrichTerms(step.body || '')}</p>
          ${step.command ? `<code>${escapeHtml(step.command)}</code>` : ''}
        </li>`
      )
      .join('');

    studyModalLaunch.dataset.labId = labId;
    studyModal.classList.add('is-open');
    studyModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    studyModal.querySelector('.vlab-modal__close')?.focus();
  }

  function closeStudy() {
    if (!studyModal) return;
    hideTermTooltip();
    studyModal.classList.remove('is-open');
    studyModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    activeStudyLabId = null;
  }

  function appendLine(text, className) {
    const div = document.createElement('div');
    div.className = 'vlab-line' + (className ? ' ' + className : '');
    div.textContent = text;
    terminalBody.appendChild(div);
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  function appendOutput(text, className) {
    if (!text) return;
    String(text)
      .split('\n')
      .forEach((line) => appendLine(line, className));
  }

  function setPrompt(prompt) {
    promptEl.textContent = prompt || 'evil-kali@jumpbox:~$';
  }

  function updateObjectives(objectives, completed) {
    if (!objectivesEl || !objectives) return;
    objectivesEl.innerHTML = objectives
      .map((obj, i) => `<li class="${completed ? 'is-done' : ''}" data-idx="${i}">${escapeHtml(obj)}</li>`)
      .join('');
  }

  function updateNetwork(lab, attacker) {
    if (!networkEl || !lab) return;
    networkEl.innerHTML = [
      `${escapeHtml(t('Jump box'))}: <code>${escapeHtml(attacker.ip)}</code> (${escapeHtml(attacker.hostname)})`,
      `Target: <code>${escapeHtml(lab.targetIp)}</code> (${escapeHtml(lab.hostname)})`,
      escapeHtml(t('Rete isolata EVIL — nessun host esterno.')),
    ].join('<br>');
  }

  function startTimer(expires) {
    expiresAt = expires;
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      if (!expiresAt) return;
      const left = Math.max(0, expiresAt - Date.now());
      const min = Math.floor(left / 60000);
      const sec = Math.floor((left % 60000) / 1000);
      sessionTimerEl.textContent = `${min}:${String(sec).padStart(2, '0')}`;
      if (left <= 0) {
        clearInterval(timerInterval);
        appendLine(t('Sessione scaduta.'), 'vlab-line--error');
        sessionId = null;
      }
    }, 1000);
  }

  const API_TIMEOUT_MS = 12000;

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    let res;
    try {
      res = await fetch(path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        credentials: 'include',
        signal: controller.signal,
        ...options,
      });
    } catch (networkErr) {
      if (networkErr.name === 'AbortError') {
        throw new Error(t('Tempo scaduto: il server non risponde. Riprova tra qualche istante.'));
      }
      throw new Error(t('Impossibile contattare il server. Controlla la connessione e riprova.'));
    } finally {
      clearTimeout(timeoutId);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Errore ${res.status}`);
    }
    return data;
  }

  function showCardError(labId, message) {
    const card = gridEl?.querySelector(`[data-lab-id="${labId}"]`);
    if (!card) return;
    let errEl = card.querySelector('.vlab-card__error');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'vlab-card__error';
      card.appendChild(errEl);
    }
    errEl.textContent = message;
  }

  function clearCardErrors() {
    gridEl?.querySelectorAll('.vlab-card__error').forEach((el) => el.remove());
  }

  async function loadCatalog() {
    if (!gridEl) return;
    gridEl.innerHTML = `<p class="vlab-loading">${escapeHtml(t('Caricamento scenari…'))}</p>`;
    try {
      const data = await api('/api/virtual-lab/catalog');
      const labs = data.labs || [];
      if (!labs.length) {
        gridEl.innerHTML =
          `<p class="vlab-loading">${escapeHtml(t('Nessuno scenario disponibile.'))}</p>`;
        return;
      }
      renderCatalog(labs);
    } catch (err) {
      console.error('[Virtual Lab] catalog:', err);
      gridEl.innerHTML = `
        <div class="vlab-load-error">
          <p class="vlab-loading">${escapeHtml(err.message)}</p>
          <p class="vlab-loading vlab-loading--hint">${escapeHtml(t('Non è stato possibile caricare gli scenari. Riprova.'))}</p>
          <button type="button" class="vlab-card__btn vlab-card__btn--start" id="vlab-retry-catalog">${escapeHtml(t('Riprova'))}</button>
        </div>`;
      document.getElementById('vlab-retry-catalog')?.addEventListener('click', loadCatalog);
    }
  }

  const META = window.VLAB_META || { pick: (o) => o, FAMILIES: {}, LABS: {}, TRACKS: [] };
  const filters = { family: 'all', level: 0, track: '' };
  let allLabs = [];

  function dots(level) {
    return '<span class="vlab-dots" aria-hidden="true">' + [1, 2, 3].map((n) => `<i${n <= level ? ' class="on"' : ''}></i>`).join('') + '</span>';
  }

  function cardHtml(lab, step) {
    const m = META.LABS[lab.id] || {};
    const fam = META.FAMILIES[m.f] || {};
    return `
      <article class="vlab-card" data-lab-id="${escapeHtml(lab.id)}" style="--fam:${fam.color || '#f59e0b'}">
        <div class="vlab-card__top">
          <span class="vlab-card__icon" aria-hidden="true">${escapeHtml(m.g || lab.icon || '◈')}</span>
          <span class="vlab-card__fam">${escapeHtml(META.pick(fam.name))}</span>
          ${step ? `<span class="vlab-card__step" aria-label="${escapeHtml(t('Passo {n}', { n: step }))}">${step}</span>` : ''}
        </div>
        <h3>${escapeHtml(lab.title)}</h3>
        <div class="vlab-card__meta">
          <span class="vlab-tag vlab-tag--lv">${dots(m.lv || 1)} ${escapeHtml(lab.level)}</span>
          <span class="vlab-tag">${escapeHtml(lab.duration)}</span>
          <span class="vlab-tag">${escapeHtml(t('{n} obiettivi', { n: lab.objectiveCount }))}</span>
        </div>
        <p class="vlab-card__skill"><b>${escapeHtml(t('Imparerai a'))}</b> ${escapeHtml(META.pick(m.skill) || lab.description)}</p>
        ${m.risk ? `<dl class="vlab-card__duo"><div><dt>${escapeHtml(t('Rischio'))}</dt><dd>${escapeHtml(META.pick(m.risk))}</dd></div><div><dt>${escapeHtml(t('Difesa'))}</dt><dd>${escapeHtml(META.pick(m.fix))}</dd></div></dl>` : ''}
        ${lab.prerequisites ? `<details class="vlab-card__prereq"><summary>${escapeHtml(t('Prima di iniziare'))}</summary>${escapeHtml(lab.prerequisites)}</details>` : ''}
        <div class="vlab-card__actions">
          <button type="button" class="vlab-card__btn vlab-card__btn--study" data-study="${escapeHtml(lab.id)}">${escapeHtml(t('Studia'))}</button>
          <button type="button" class="vlab-card__btn vlab-card__btn--start" data-start="${escapeHtml(lab.id)}">${escapeHtml(t('Avvia scenario'))}</button>
        </div>
      </article>`;
  }

  function visibleLabs() {
    const track = META.TRACKS.find((x) => x.id === filters.track);
    let list = allLabs.slice();
    if (track) list = track.ids.map((id) => allLabs.find((l) => l.id === id)).filter(Boolean);
    else list.sort((a, b) => ((META.LABS[a.id] || {}).lv || 9) - ((META.LABS[b.id] || {}).lv || 9));
    return list.filter((lab) => {
      const m = META.LABS[lab.id] || {};
      return (filters.family === 'all' || m.f === filters.family) && (!filters.level || m.lv === filters.level);
    });
  }

  function paintGrid() {
    const track = META.TRACKS.find((x) => x.id === filters.track);
    const list = visibleLabs();
    const count = document.getElementById('vlab-count');
    if (count) count.textContent = t('{n} scenari', { n: list.length });
    if (!list.length) {
      gridEl.innerHTML = `<p class="vlab-loading">${escapeHtml(t('Nessuno scenario con questi filtri.'))}</p>`;
      return;
    }
    gridEl.innerHTML = list.map((lab, i) => cardHtml(lab, track ? i + 1 : 0)).join('');
  }

  function paintControls() {
    const bar = document.getElementById('vlab-filters');
    if (!bar) return;
    const fams = Object.keys(META.FAMILIES);
    const chip = (attr, value, label, on, color) =>
      `<button type="button" class="vlab-chip${on ? ' is-on' : ''}" ${attr}="${value}" aria-pressed="${on}"${color ? ` style="--fam:${color}"` : ''}>${escapeHtml(label)}</button>`;
    bar.innerHTML =
      `<div class="vlab-filter" role="group" aria-label="${escapeHtml(t('Famiglia'))}">` +
      chip('data-fam', 'all', t('Tutti'), filters.family === 'all') +
      fams.map((f) => chip('data-fam', f, META.pick(META.FAMILIES[f].name), filters.family === f, META.FAMILIES[f].color)).join('') +
      '</div>' +
      `<div class="vlab-filter" role="group" aria-label="${escapeHtml(t('Livello'))}">` +
      chip('data-lv', '0', t('Ogni livello'), !filters.level) +
      [[1, t('Base')], [2, t('Intermedio')], [3, t('Avanzato')]].map(([n, label]) => chip('data-lv', n, label, filters.level === n)).join('') +
      '</div>';

    const tracks = document.getElementById('vlab-tracks');
    if (tracks) {
      tracks.innerHTML = META.TRACKS.map((tr) => `
        <button type="button" class="vlab-track${filters.track === tr.id ? ' is-on' : ''}" data-track="${tr.id}" aria-pressed="${filters.track === tr.id}">
          <b>${escapeHtml(META.pick(tr.name))}</b>
          <span>${escapeHtml(META.pick(tr.blurb))}</span>
          <em>${escapeHtml(t('{n} scenari', { n: tr.ids.length }))}</em>
        </button>`).join('');
    }
  }

  function renderCatalog(labs) {
    clearCardErrors();
    if (!labs.length) {
      gridEl.innerHTML = `<p class="vlab-loading">${escapeHtml(t('Nessuno scenario disponibile.'))}</p>`;
      return;
    }
    allLabs = labs;
    paintControls();
    paintGrid();
  }

  catalogEl?.addEventListener('click', (event) => {
    const start = event.target.closest('[data-start]');
    if (start) { startLab(start.dataset.start, start); return; }
    const study = event.target.closest('[data-study]');
    if (study) { openStudy(study.dataset.study); return; }
    const fam = event.target.closest('[data-fam]');
    const lv = event.target.closest('[data-lv]');
    const tr = event.target.closest('[data-track]');
    if (fam) { filters.family = fam.dataset.fam; filters.track = ''; }
    else if (lv) { filters.level = Number(lv.dataset.lv); filters.track = ''; }
    else if (tr) { filters.track = filters.track === tr.dataset.track ? '' : tr.dataset.track; filters.family = 'all'; filters.level = 0; }
    else return;
    paintControls();
    paintGrid();
  });

  async function startLab(labId, btn) {
    if (btn) btn.disabled = true;
    clearCardErrors();
    closeStudy();
    try {
      const data = await api('/api/virtual-lab/sessions', {
        method: 'POST',
        body: JSON.stringify({ labId }),
      });
      if (!data.session?.id) {
        throw new Error(t('Risposta del server non valida (sessione mancante).'));
      }
      sessionId = data.session.id;
      activeSessionLabId = labId;
      pendingPassword = false;
      terminalBody.innerHTML = '';
      showWorkspace(data.session);

      appendLine(t('Connessione alla jump box EVIL (rete isolata 10.42.0.0/16).'), 'vlab-line--system');
      appendLine(t('Digita "help" per i comandi disponibili.'), 'vlab-line--system');
      appendLine('');
      setPrompt(data.session.prompt);

      if (data.completed && window.progressManager?.logActivity) {
        window.progressManager.logActivity('lab_completed', { labId: data.session.labId });
      }
    } catch (err) {
      showCardError(labId, err.message);
      if (sessionId) {
        appendLine(err.message, 'vlab-line--error');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function showWorkspace(session) {
    catalogEl.classList.add('is-hidden');
    workspaceEl.classList.add('is-active');
    sessionTitleEl.textContent = session.lab?.title || t('Scenario');
    activeSessionLabId = session.labId || session.lab?.id || activeSessionLabId;
    updateObjectives(session.lab?.objectives || [], session.completed);
    updateNetwork(session.lab, session.attacker || { ip: '10.42.0.2', hostname: 'jumpbox.evil.lab' });
    startTimer(session.expiresAt);
    completeBanner.classList.toggle('is-visible', session.completed);
    terminalInput.focus();
  }

  function showCatalog() {
    workspaceEl.classList.remove('is-active');
    catalogEl.classList.remove('is-hidden');
    sessionId = null;
    activeSessionLabId = null;
    if (timerInterval) clearInterval(timerInterval);
    terminalBody.innerHTML = '';
    loadCatalog();
  }

  async function execCommand(command) {
    if (!sessionId || !command.trim()) return;
    const displayPrompt = pendingPassword ? '(password)' : promptEl.textContent;
    appendLine(`${displayPrompt} ${pendingPassword ? '••••••' : command}`);

    try {
      const data = await api(`/api/virtual-lab/sessions/${sessionId}/exec`, {
        method: 'POST',
        body: JSON.stringify({ command }),
      });
      pendingPassword = !!data.pendingPassword;
      appendOutput(data.output, data.completed ? 'vlab-line--success' : '');
      setPrompt(data.prompt);
      if (data.session) {
        updateObjectives(data.session.lab?.objectives || [], data.completed);
        completeBanner.classList.toggle('is-visible', data.completed);
        if (data.completed && window.progressManager?.logActivity) {
          window.progressManager.logActivity('lab_completed', { labId: data.session.labId });
        }
      }
    } catch (err) {
      appendLine(err.message, 'vlab-line--error');
      if (err.message.includes('scaduta') || err.message.includes('non trovata')) {
        sessionId = null;
      }
    }
  }

  async function stopLab() {
    if (!sessionId) {
      showCatalog();
      return;
    }
    try {
      await api(`/api/virtual-lab/sessions/${sessionId}`, { method: 'DELETE' });
    } catch (_) {
      /* session may already be gone */
    }
    sessionId = null;
    showCatalog();
  }

  studyModal?.querySelector('.vlab-modal__backdrop')?.addEventListener('click', closeStudy);
  studyModal?.querySelector('.vlab-modal__close')?.addEventListener('click', closeStudy);
  studyModalLaunch?.addEventListener('click', () => {
    const labId = studyModalLaunch.dataset.labId;
    closeStudy();
    if (labId) startLab(labId);
  });
  studySideBtn?.addEventListener('click', () => {
    if (activeSessionLabId) openStudy(activeSessionLabId);
  });

  const studyModalBody = studyModal?.querySelector('.vlab-modal__body');
  studyModalBody?.addEventListener(
    'scroll',
    () => {
      if (activeTerm) positionTermTooltip(activeTerm);
    },
    { passive: true }
  );

  studyModal?.addEventListener('mouseover', (e) => {
    const term = e.target.closest('.vlab-term');
    if (!term || !studyModal.contains(term)) return;
    term.classList.add('is-active');
    positionTermTooltip(term);
  });

  studyModal?.addEventListener('mouseout', (e) => {
    const term = e.target.closest('.vlab-term');
    if (!term || term.contains(e.relatedTarget)) return;
    hideTermTooltip();
  });

  studyModal?.addEventListener('focusin', (e) => {
    const term = e.target.closest('.vlab-term');
    if (term) {
      term.classList.add('is-active');
      positionTermTooltip(term);
    }
  });

  studyModal?.addEventListener('focusout', (e) => {
    const term = e.target.closest('.vlab-term');
    if (term && !term.contains(e.relatedTarget)) hideTermTooltip();
  });

  studyModal?.addEventListener('click', (e) => {
    const term = e.target.closest('.vlab-term');
    if (!term) return;
    e.preventDefault();
    if (activeTerm === term && termTooltip?.classList.contains('is-visible')) {
      hideTermTooltip();
      return;
    }
    studyModal.querySelectorAll('.vlab-term.is-active').forEach((t) => t.classList.remove('is-active'));
    term.classList.add('is-active');
    positionTermTooltip(term);
  });

  window.addEventListener(
    'resize',
    () => {
      if (activeTerm) positionTermTooltip(activeTerm);
    },
    { passive: true }
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && studyModal?.classList.contains('is-open')) {
      closeStudy();
    }
  });

  terminalInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = terminalInput.value;
      terminalInput.value = '';
      execCommand(cmd);
    }
  });

  backBtn?.addEventListener('click', stopLab);
  stopBtn?.addEventListener('click', stopLab);

  function boot() {
    if (!gridEl || !workspaceEl) {
      console.error('[Virtual Lab] Elementi pagina mancanti');
      return;
    }
    loadCatalog();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

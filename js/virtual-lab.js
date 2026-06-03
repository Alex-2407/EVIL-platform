/**
 * Laboratorio Virtuale EVIL — frontend terminale + sessioni API + modal Studia
 */
(function () {
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

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

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

    studyModalTitle.textContent = guide.title || 'Guida didattica';
    studyModalIntro.innerHTML = enrichTerms(guide.intro || '');

    studyModalSteps.innerHTML = (guide.steps || [])
      .map(
        (step, i) => `
        <li class="vlab-study-step">
          <span class="vlab-study-step__n">Passo ${i + 1}</span>
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
      `Jump box: <code>${attacker.ip}</code> (${attacker.hostname})`,
      `Target: <code>${lab.targetIp}</code> (${lab.hostname})`,
      'Rete isolata EVIL — nessun host esterno.',
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
        appendLine('Sessione scaduta.', 'vlab-line--error');
        sessionId = null;
      }
    }, 1000);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      credentials: 'same-origin',
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || `Errore ${res.status}`);
    }
    return data;
  }

  async function loadCatalog() {
    gridEl.innerHTML = '<p class="vlab-loading">Caricamento ambienti lab…</p>';
    try {
      const data = await api('/api/virtual-lab/catalog');
      renderCatalog(data.labs || []);
    } catch (err) {
      gridEl.innerHTML = `<p class="vlab-loading">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderCatalog(labs) {
    if (!labs.length) {
      gridEl.innerHTML = '<p class="vlab-loading">Nessun lab disponibile.</p>';
      return;
    }
    gridEl.innerHTML = labs
      .map(
        (lab) => `
      <article class="vlab-card" data-lab-id="${lab.id}">
        <span class="vlab-card__icon" aria-hidden="true">${lab.icon || '◈'}</span>
        <p class="vlab-card__name">${escapeHtml(lab.name)}</p>
        <h3>${escapeHtml(lab.title)}</h3>
        <div class="vlab-card__meta">
          <span class="vlab-tag">${escapeHtml(lab.difficulty)}</span>
          <span class="vlab-tag">${escapeHtml(lab.duration)}</span>
          <span class="vlab-tag vlab-tag--ip">${escapeHtml(lab.targetIp)}</span>
        </div>
        <p>${escapeHtml(lab.description)}</p>
        <div class="vlab-card__actions">
          <button type="button" class="vlab-card__btn vlab-card__btn--study" data-study="${lab.id}">Studia</button>
          <button type="button" class="vlab-card__btn vlab-card__btn--start" data-start="${lab.id}">Avvia VM</button>
        </div>
      </article>`
      )
      .join('');

    gridEl.querySelectorAll('[data-start]').forEach((btn) => {
      btn.addEventListener('click', () => startLab(btn.dataset.start, btn));
    });
    gridEl.querySelectorAll('[data-study]').forEach((btn) => {
      btn.addEventListener('click', () => openStudy(btn.dataset.study));
    });
  }

  async function startLab(labId, btn) {
    if (btn) btn.disabled = true;
    closeStudy();
    try {
      const data = await api('/api/virtual-lab/sessions', {
        method: 'POST',
        body: JSON.stringify({ labId }),
      });
      sessionId = data.session.id;
      activeSessionLabId = labId;
      pendingPassword = false;
      terminalBody.innerHTML = '';
      showWorkspace(data.session);

      appendLine('Connessione alla jump box EVIL (rete isolata 10.42.0.0/16).', 'vlab-line--system');
      appendLine('Digita "help" per i comandi disponibili.', 'vlab-line--system');
      appendLine('');
      setPrompt(data.session.prompt);

      if (data.completed && window.progressManager?.logActivity) {
        window.progressManager.logActivity('lab_completed', { labId: data.session.labId });
      }
    } catch (err) {
      appendLine(err.message, 'vlab-line--error');
      alert(err.message);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function showWorkspace(session) {
    catalogEl.classList.add('is-hidden');
    workspaceEl.classList.add('is-active');
    sessionTitleEl.textContent = session.lab?.title || 'Lab';
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

  document.addEventListener('DOMContentLoaded', loadCatalog);
})();

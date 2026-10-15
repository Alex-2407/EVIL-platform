(function () {
  'use strict';

  const { t, url, fmtNumber } = window.EVIL_I18N;

  const STORAGE_KEY = 'evil_quiz_hub_v1';
  const PASS_THRESHOLD = 80;
  const TRANSITIONS = ['tx-fade-up', 'tx-slide-left', 'tx-slide-right', 'tx-zoom', 'tx-cascade'];

  const hub = window.QUIZ_HUB;
  if (!hub?.CATEGORIES) return;

  const LEVEL_ORDER = ['base', 'intermedio', 'avanzato'];
  const LEVELS = hub.LEVELS || { base: 'Base', intermedio: 'Intermedio', avanzato: 'Avanzato' };
  const GLOSSARY = window.QUIZ_GLOSSARY || {};
  const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const els = {
    grid: document.getElementById('quiz-hub-grid'),
    catalog: document.getElementById('quiz-hub-catalog'),
    arena: document.getElementById('quiz-hub-arena'),
    search: document.getElementById('quiz-hub-search'),
    filterBar: document.getElementById('quiz-hub-filter'),
    levelBar: document.getElementById('quiz-hub-level-filter'),
    empty: document.getElementById('quiz-hub-empty'),
    statCats: document.getElementById('qh-stat-cats'),
    statQs: document.getElementById('qh-stat-qs'),
    statDone: document.getElementById('qh-stat-done'),
    back: document.getElementById('quiz-hub-back'),
    progressFill: document.getElementById('quiz-hub-progress-fill'),
    progressBar: document.getElementById('quiz-hub-progress'),
    progressLabel: document.getElementById('quiz-hub-progress-label'),
    stage: document.getElementById('quiz-hub-stage'),
    nextBtn: document.getElementById('quiz-hub-next'),
    arenaTitle: document.getElementById('quiz-hub-arena-title'),
    particles: document.getElementById('quiz-hub-particles'),
    meshWrap: document.getElementById('quiz-hub-mesh-wrap'),
    hero: document.getElementById('quiz-hub-hero'),
    tooltip: document.getElementById('quiz-term-tooltip'),
  };

  let pinnedTerm = null;

  let state = {
    filter: 'all',
    level: 'all',
    query: '',
    categoryId: null,
    questionIndex: 0,
    score: 0,
    answered: false,
    transitionIdx: 0,
    progress: loadProgress(),
  };

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
    } catch {
      /* archiviazione non disponibile: il punteggio vale solo per questa visita */
    }
  }

  function allCategories() {
    return Object.values(hub.CATEGORIES);
  }

  function totalQuestions() {
    return allCategories().reduce((n, c) => n + c.questions.length, 0);
  }

  function completedCount() {
    return Object.values(state.progress).filter((p) => p.completed).length;
  }

  function categoryProgress(id) {
    return state.progress[id] || { bestScore: 0, completed: false, attempts: 0 };
  }

  function escapeHtml(t) {
    return String(t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const TERM_PATTERN = GLOSSARY_TERMS.length
    ? new RegExp(`(?<![\\w-])(${GLOSSARY_TERMS.map(escapeRegex).join('|')})(?![\\w-])`, 'gi')
    : null;

  function enrichTerms(text) {
    if (!text) return '';
    const escaped = escapeHtml(text);
    if (!TERM_PATTERN) return escaped;
    return escaped.replace(TERM_PATTERN, (match) => {
      const key = match.toLowerCase();
      const def = GLOSSARY[key];
      if (!def) return match;
      return `<span class="quiz-term" role="button" tabindex="0" data-term="${escapeHtml(key)}" aria-describedby="quiz-term-tooltip">${match}</span>`;
    });
  }

  function positionTooltip(btn) {
    const key = btn.dataset.term?.toLowerCase();
    const def = key && GLOSSARY[key];
    if (!def || !els.tooltip) return;
    els.tooltip.textContent = def;
    els.tooltip.hidden = false;
    els.tooltip.style.left = '-9999px';
    els.tooltip.classList.add('is-visible');
    const rect = btn.getBoundingClientRect();
    const tw = els.tooltip.offsetWidth;
    const th = els.tooltip.offsetHeight;
    let top = rect.bottom + 8;
    let left = rect.left + rect.width / 2 - tw / 2;
    if (top + th > window.innerHeight - 12) top = rect.top - th - 8;
    left = Math.max(12, Math.min(left, window.innerWidth - tw - 12));
    els.tooltip.style.left = `${left}px`;
    els.tooltip.style.top = `${top}px`;
  }

  function hideTooltip(unpin) {
    if (unpin) pinnedTerm = null;
    els.tooltip?.classList.remove('is-visible');
    if (els.tooltip) els.tooltip.hidden = true;
    document.querySelectorAll('.quiz-term.is-pinned').forEach((t) => t.classList.remove('is-pinned'));
  }

  function bindTermEvents() {
    const root = document.querySelector('.quiz-hub-page');
    if (!root) return;

    root.addEventListener('mouseover', (e) => {
      const btn = e.target.closest('.quiz-term');
      if (!btn || !btn.closest('#quiz-hub-stage')) return;
      if (pinnedTerm && pinnedTerm !== btn) return;
      positionTooltip(btn);
    });

    root.addEventListener('mouseout', (e) => {
      const btn = e.target.closest('.quiz-term');
      if (!btn || !btn.closest('#quiz-hub-stage')) return;
      if (pinnedTerm === btn) return;
      if (e.relatedTarget?.closest?.('.quiz-term') === btn) return;
      hideTooltip(false);
    });

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.quiz-term');
      if (btn?.closest('#quiz-hub-stage')) {
        e.preventDefault();
        e.stopPropagation();
        if (pinnedTerm === btn) {
          hideTooltip(true);
          return;
        }
        pinnedTerm = btn;
        document.querySelectorAll('.quiz-term.is-pinned').forEach((t) => t.classList.remove('is-pinned'));
        btn.classList.add('is-pinned');
        positionTooltip(btn);
        return;
      }
      if (pinnedTerm) hideTooltip(true);
    });

    root.addEventListener('focusin', (e) => {
      const btn = e.target.closest('.quiz-term');
      if (btn?.closest('#quiz-hub-stage')) positionTooltip(btn);
    });

    root.addEventListener('focusout', (e) => {
      const btn = e.target.closest('.quiz-term');
      if (btn && pinnedTerm !== btn) hideTooltip(false);
    });
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function nextTransition() {
    const cls = TRANSITIONS[state.transitionIdx % TRANSITIONS.length];
    state.transitionIdx += 1;
    return cls;
  }

  function updateStats() {
    if (els.statCats) els.statCats.textContent = fmtNumber(allCategories().length);
    if (els.statQs) els.statQs.textContent = fmtNumber(totalQuestions());
    if (els.statDone) els.statDone.textContent = fmtNumber(completedCount());
  }

  function levelLabel(level) {
    return LEVELS[level] || level || '';
  }

  function renderPillGroup(bar, pills, active, onPick) {
    if (!bar) return;
    bar.innerHTML = pills.map((p) =>
      `<button type="button" data-filter="${escapeHtml(p.id)}" class="${active === p.id ? 'is-active' : ''}" aria-pressed="${active === p.id}">${escapeHtml(p.label)}</button>`
    ).join('');
    bar.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => onPick(btn.dataset.filter));
    });
  }

  function renderFilters() {
    const pillars = [{ id: 'all', label: t('Tutte le aree') }];
    Object.entries(hub.PILLARS).forEach(([id, label]) => pillars.push({ id, label }));
    renderPillGroup(els.filterBar, pillars, state.filter, (id) => {
      state.filter = id;
      renderFilters();
      renderGrid();
    });
    const levels = [{ id: 'all', label: t('Tutti i livelli') }];
    LEVEL_ORDER.forEach((id) => levels.push({ id, label: levelLabel(id) }));
    renderPillGroup(els.levelBar, levels, state.level, (id) => {
      state.level = id;
      renderFilters();
      renderGrid();
    });
  }

  function matchesFilter(cat) {
    if (state.filter !== 'all' && cat.pillar !== state.filter) return false;
    if (state.level !== 'all' && cat.level !== state.level) return false;
    if (!state.query) return true;
    const q = state.query.toLowerCase();
    return cat.name.toLowerCase().includes(q) ||
      cat.description.toLowerCase().includes(q) ||
      (hub.PILLARS[cat.pillar] || '').toLowerCase().includes(q);
  }

  function questionCountLabel(n) {
    return n === 1 ? t('{n} domanda', { n: fmtNumber(n) }) : t('{n} domande', { n: fmtNumber(n) });
  }

  function cardStatus(prog, pct) {
    if (prog.completed && pct >= PASS_THRESHOLD) return t('Superato · {pct}%', { pct });
    if (prog.completed) return t('Miglior risultato: {pct}%', { pct });
    return t('Da iniziare');
  }

  function renderGrid() {
    if (!els.grid) return;
    const cats = allCategories().filter(matchesFilter);
    els.grid.innerHTML = cats.map((cat) => {
      const prog = categoryProgress(cat.id);
      const pct = cat.questions.length
        ? Math.round((prog.bestScore / cat.questions.length) * 100)
        : 0;
      const pillarLabel = hub.PILLARS[cat.pillar] || cat.pillar;
      return `
        <article class="quiz-hub-card" data-id="${escapeHtml(cat.id)}" role="button" tabindex="0">
          <span class="quiz-hub-card__icon" aria-hidden="true">${escapeHtml(cat.icon)}</span>
          <span class="quiz-hub-card__pillar">${escapeHtml(pillarLabel)}</span>
          <span class="quiz-hub-level quiz-hub-level--${escapeHtml(cat.level)}">${escapeHtml(levelLabel(cat.level))}</span>
          <h3>${escapeHtml(cat.name)}</h3>
          <p>${escapeHtml(cat.description)}</p>
          <div class="quiz-hub-card__meta">
            <span>${escapeHtml(questionCountLabel(cat.questions.length))}</span>
            <span>${escapeHtml(cardStatus(prog, pct))}</span>
          </div>
          <div class="quiz-hub-card__bar" aria-hidden="true"><span></span></div>
        </article>`;
    }).join('');

    els.grid.querySelectorAll('.quiz-hub-card').forEach((card, i) => {
      const cat = hub.CATEGORIES[card.dataset.id];
      const prog = categoryProgress(cat.id);
      const pct = cat.questions.length ? Math.round((prog.bestScore / cat.questions.length) * 100) : 0;
      card.style.setProperty('--qh-accent', cat.accent);
      card.style.setProperty('--i', String(i));
      const bar = card.querySelector('.quiz-hub-card__bar span');
      if (bar) bar.style.width = `${pct}%`;
      card.setAttribute('aria-label', t('Inizia il quiz: {name}', { name: cat.name }));
      card.addEventListener('click', () => startQuiz(card.dataset.id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startQuiz(card.dataset.id);
        }
      });
    });
    if (els.empty) els.empty.hidden = cats.length > 0;
  }

  function learnLinksHtml(cat) {
    const links = cat.learn || [];
    if (!links.length) return '';
    return `<p class="quiz-hub-learn"><span>${escapeHtml(t('Approfondisci:'))}</span> ${links.map((l) =>
      `<a href="${escapeHtml(url(l.href))}">${escapeHtml(l.label)}</a>`).join(' · ')}</p>`;
  }

  function showCatalog() {
    hideTooltip(true);
    els.catalog?.classList.remove('is-hidden');
    els.arena?.classList.remove('is-active');
    state.categoryId = null;
    renderGrid();
    updateStats();
  }

  function startQuiz(categoryId) {
    const cat = hub.CATEGORIES[categoryId];
    if (!cat) return;
    state.categoryId = categoryId;
    state.questionIndex = 0;
    state.score = 0;
    state.answered = false;
    els.catalog?.classList.add('is-hidden');
    els.arena?.classList.add('is-active');
    if (els.arenaTitle) els.arenaTitle.textContent = cat.name;
    els.arena?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    renderQuestion();
  }

  function currentCategory() {
    return hub.CATEGORIES[state.categoryId];
  }

  function renderQuestion() {
    hideTooltip(true);
    const cat = currentCategory();
    if (!cat) return;
    const q = cat.questions[state.questionIndex];
    const total = cat.questions.length;
    const pct = Math.round(((state.questionIndex) / total) * 100);
    if (els.progressFill) els.progressFill.style.width = `${pct}%`;
    if (els.progressLabel) {
      els.progressLabel.textContent = t('Domanda {n} di {total}', { n: state.questionIndex + 1, total });
    }
    els.progressBar?.setAttribute('aria-valuenow', String(pct));

    const tx = reducedMotion ? 'tx-fade-up' : nextTransition();
    const options = shuffle(q.options.map((o, i) => ({ ...o, origIndex: i })));

    els.stage.innerHTML = `
      <div class="quiz-hub-question tx-enter ${tx}" role="group" aria-labelledby="qh-q-text">
        <div class="quiz-hub-question__head">
          <span class="quiz-hub-question__n">${String(state.questionIndex + 1).padStart(2, '0')}</span>
          <span class="quiz-hub-level quiz-hub-level--${escapeHtml(q.level || cat.level)}">${escapeHtml(t('Livello: {level}', { level: levelLabel(q.level || cat.level) }))}</span>
        </div>
        <p class="quiz-hub-question__text" id="qh-q-text">${enrichTerms(q.question)}</p>
        <div class="quiz-hub-options" id="quiz-hub-options">
          ${options.map((opt, i) => `
            <label class="quiz-hub-option" data-correct="${opt.correct}" data-i="${i}">
              <input type="radio" name="qh-opt" value="${i}">
              <span class="quiz-hub-option__face">
                <span class="quiz-hub-option__dot"></span>
                <span class="quiz-hub-option__text">${enrichTerms(opt.text)}</span>
              </span>
            </label>`).join('')}
        </div>
        <div class="quiz-hub-feedback" id="quiz-hub-feedback" aria-live="polite"></div>
        <div class="quiz-hub-actions">
          <button type="button" class="quiz-hub-btn" id="quiz-hub-check" disabled>${escapeHtml(t('Verifica'))}</button>
        </div>
      </div>`;

    const checkBtn = document.getElementById('quiz-hub-check');
    const feedback = document.getElementById('quiz-hub-feedback');
    const optionEls = els.stage.querySelectorAll('.quiz-hub-option');
    optionEls.forEach((el) => el.style.setProperty('--opt-i', el.dataset.i));

    optionEls.forEach((label) => {
      label.querySelector('input').addEventListener('change', () => {
        if (state.answered) return;
        checkBtn.disabled = false;
      });
    });

    checkBtn.addEventListener('click', () => {
      if (state.answered) {
        if (state.questionIndex + 1 >= total) finishQuiz();
        else {
          state.questionIndex += 1;
          state.answered = false;
          renderQuestion();
        }
        return;
      }
      const selected = els.stage.querySelector('input[name="qh-opt"]:checked');
      if (!selected) return;
      state.answered = true;
      const label = selected.closest('.quiz-hub-option');
      const correct = label.dataset.correct === 'true';
      if (correct) state.score += 1;

      optionEls.forEach((el) => {
        el.querySelector('input').disabled = true;
        if (el.dataset.correct === 'true') el.classList.add('is-correct');
        else if (el === label && !correct) el.classList.add('is-wrong');
      });

      feedback.classList.add('is-visible', correct ? 'is-correct' : 'is-wrong');
      feedback.innerHTML = `<p><strong>${escapeHtml(correct ? t('Risposta corretta.') : t('Risposta non corretta.'))}</strong> ${enrichTerms(q.explanation)}</p>${learnLinksHtml(cat)}`;
      checkBtn.textContent = state.questionIndex + 1 >= total ? t('Vedi i risultati') : t('Domanda successiva');
      checkBtn.focus();
    });
  }

  function fireConfetti() {
    const wrap = document.createElement('div');
    wrap.className = 'quiz-hub-confetti';
    const colors = ['#f59e0b', '#a78bfa', '#00ff9c', '#fb7185', '#22d3ee'];
    for (let i = 0; i < 48; i++) {
      const s = document.createElement('span');
      s.style.left = `${Math.random() * 100}%`;
      s.style.top = `${-10 - Math.random() * 20}%`;
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = `${Math.random() * 0.8}s`;
      s.style.animationDuration = `${2 + Math.random() * 1.5}s`;
      wrap.appendChild(s);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 3500);
  }

  function logAchievements(catId, accuracy) {
    const pm = window.progressManager;
    if (!pm?.logActivity) return;
    if (catId === 'phishing-email' && accuracy === 100) {
      pm.logActivity('phishing_quiz_completed', { accuracy: 100, source: 'quiz-hub' });
    }
    if (catId === 'social-engineering') {
      pm.logActivity('social_engineering_completed', { source: 'quiz-hub' });
    }
    const done = completedCount();
    if (done >= 10) {
      pm.logActivity('quiz_hub_milestone', { categoriesCompleted: done });
    }
  }

  function finishQuiz() {
    const cat = currentCategory();
    if (!cat) return;
    const total = cat.questions.length;
    const accuracy = Math.round((state.score / total) * 100);
    const prev = categoryProgress(cat.id);
    const record = {
      bestScore: Math.max(prev.bestScore, state.score),
      completed: true,
      attempts: (prev.attempts || 0) + 1,
      lastAccuracy: accuracy,
      lastAt: Date.now(),
    };
    state.progress[cat.id] = record;
    saveProgress();
    logAchievements(cat.id, accuracy);

    if (els.progressFill) els.progressFill.style.width = '100%';
    if (accuracy >= PASS_THRESHOLD) fireConfetti();

    const verdict = accuracy >= PASS_THRESHOLD
      ? t('Ottimo lavoro: categoria superata.')
      : accuracy >= 50
        ? t('Buona base: rileggi le spiegazioni e riprova.')
        : t('Conviene ripassare l’argomento prima di riprovare.');

    els.stage.innerHTML = `
      <div class="quiz-hub-results">
        <div class="quiz-hub-results__ring">${accuracy}%</div>
        <h2>${escapeHtml(verdict)}</h2>
        <p>${escapeHtml(t('Hai risposto correttamente a {score} domande su {total} in «{name}».', { score: state.score, total, name: cat.name }))}</p>
        <p class="quiz-hub-results__best">${escapeHtml(t('Miglior risultato in questa categoria: {pct}%', { pct: Math.round((record.bestScore / total) * 100) }))}</p>
        ${learnLinksHtml(cat)}
        <p class="quiz-hub-results__paths"><a href="${escapeHtml(url('/learning-paths.html'))}">${escapeHtml(t('Scegli un percorso di apprendimento'))}</a></p>
        <div class="quiz-hub-actions quiz-hub-actions--center">
          <button type="button" class="quiz-hub-btn" id="qh-retry">${escapeHtml(t('Riprova'))}</button>
          <button type="button" class="quiz-hub-btn quiz-hub-btn--ghost" id="qh-home">${escapeHtml(t('Torna al catalogo'))}</button>
        </div>
      </div>`;

    document.getElementById('qh-retry')?.addEventListener('click', () => startQuiz(cat.id));
    document.getElementById('qh-home')?.addEventListener('click', showCatalog);
    updateStats();
  }

  function initParticles() {
    if (!els.particles || reducedMotion || !window.EvilParticles) return;
    window.EvilParticles.start(els.particles, {
      count: 70,
      speed: 0.175,
      radius: [0.6, 2.4],
      link: 120,
      linkAlpha: 0.08,
      dot: (p) => {
        p.hue = 260 + p.seed * 80;
        return `hsla(${p.hue.toFixed(1)}, 70%, 65%, 0.4)`;
      },
      // tonalità arrotondata a 5°: stesse sfumature, linee disegnate a gruppi
      line: (a, b) => `hsl(${Math.round((a.hue + b.hue) / 10) * 5}, 60%, 60%)`,
    });
  }

  function initParallax() {
    if (reducedMotion || !els.meshWrap) return;
    window.addEventListener(
      'mousemove',
      (e) => {
        const px = (e.clientX / window.innerWidth - 0.5) * 28;
        const py = (e.clientY / window.innerHeight - 0.5) * 20;
        els.meshWrap.style.transform = `translate3d(${px}px, ${py}px, 0)`;
      },
      { passive: true }
    );
  }

  function initHeroMotion() {
    requestAnimationFrame(() => els.hero?.classList.add('is-ready'));
    if (reducedMotion) return;
    [els.statCats, els.statQs, els.statDone].forEach((el, i) => {
      if (!el) return;
      const target = parseInt(el.textContent.replace(/\D/g, ''), 10);
      if (Number.isNaN(target)) return;
      el.textContent = '0';
      const start = performance.now() + i * 120;
      const dur = 900;
      function tick(now) {
        if (now < start) {
          requestAnimationFrame(tick);
          return;
        }
        const p = Math.min(1, (now - start) / dur);
        el.textContent = fmtNumber(Math.round(target * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function initReveal() {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('is-visible')),
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );
    document.querySelectorAll('.qh-reveal').forEach((el) => obs.observe(el));
  }

  function bindEvents() {
    els.back?.addEventListener('click', showCatalog);
    els.search?.addEventListener('input', (e) => {
      state.query = e.target.value.trim();
      renderGrid();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && pinnedTerm) hideTooltip(true);
      else if (e.key === 'Escape' && state.categoryId) showCatalog();
    });
  }

  function boot() {
    renderFilters();
    renderGrid();
    updateStats();
    bindEvents();
    bindTermEvents();
    initParticles();
    initParallax();
    initHeroMotion();
    initReveal();

    const params = new URLSearchParams(window.location.search);
    const cat = params.get('cat');
    if (cat && hub.CATEGORIES[cat]) startQuiz(cat);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

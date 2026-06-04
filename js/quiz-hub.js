(function () {
  'use strict';

  const STORAGE_KEY = 'evil_quiz_hub_v1';
  const TRANSITIONS = ['tx-fade-up', 'tx-slide-left', 'tx-slide-right', 'tx-zoom', 'tx-cascade'];

  const hub = window.QUIZ_HUB;
  if (!hub?.CATEGORIES) return;

  const GLOSSARY = window.QUIZ_GLOSSARY || {};
  const GLOSSARY_TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const els = {
    grid: document.getElementById('quiz-hub-grid'),
    catalog: document.getElementById('quiz-hub-catalog'),
    arena: document.getElementById('quiz-hub-arena'),
    search: document.getElementById('quiz-hub-search'),
    filterBar: document.getElementById('quiz-hub-filter'),
    statCats: document.getElementById('qh-stat-cats'),
    statQs: document.getElementById('qh-stat-qs'),
    statDone: document.getElementById('qh-stat-done'),
    back: document.getElementById('quiz-hub-back'),
    progressFill: document.getElementById('quiz-hub-progress-fill'),
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
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
    if (els.statCats) els.statCats.textContent = String(allCategories().length);
    if (els.statQs) els.statQs.textContent = String(totalQuestions());
    if (els.statDone) els.statDone.textContent = String(completedCount());
  }

  function renderFilters() {
    if (!els.filterBar) return;
    const pills = [{ id: 'all', label: 'Tutti' }];
    Object.entries(hub.PILLARS).forEach(([id, label]) => pills.push({ id, label }));
    els.filterBar.innerHTML = pills.map((p) =>
      `<button type="button" data-filter="${p.id}" class="${state.filter === p.id ? 'is-active' : ''}">${p.label}</button>`
    ).join('');
    els.filterBar.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.filter = btn.dataset.filter;
        renderFilters();
        renderGrid();
      });
    });
  }

  function matchesFilter(cat) {
    if (state.filter !== 'all' && cat.pillar !== state.filter) return false;
    if (!state.query) return true;
    const q = state.query.toLowerCase();
    return cat.name.toLowerCase().includes(q) ||
      cat.description.toLowerCase().includes(q) ||
      (hub.PILLARS[cat.pillar] || '').toLowerCase().includes(q);
  }

  function renderGrid() {
    if (!els.grid) return;
    const cats = allCategories().filter(matchesFilter);
    els.grid.innerHTML = cats.map((cat, i) => {
      const prog = categoryProgress(cat.id);
      const pct = cat.questions.length
        ? Math.round((prog.bestScore / cat.questions.length) * 100)
        : 0;
      const pillarLabel = hub.PILLARS[cat.pillar] || cat.pillar;
      return `
        <article class="quiz-hub-card${matchesFilter(cat) ? '' : ' is-hidden'}" data-id="${cat.id}" style="--card-accent:${cat.accent};--i:${i}">
          <span class="quiz-hub-card__icon" aria-hidden="true">${cat.icon}</span>
          <span class="quiz-hub-card__pillar">${pillarLabel}</span>
          <h3>${cat.name}</h3>
          <p>${cat.description}</p>
          <div class="quiz-hub-card__meta">
            <span>${cat.questions.length} domande</span>
            <span>${prog.completed ? 'Completato' : pct ? `Miglior: ${pct}%` : 'Nuovo'}</span>
          </div>
          <div class="quiz-hub-card__bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
        </article>`;
    }).join('');

    els.grid.querySelectorAll('.quiz-hub-card').forEach((card) => {
      card.addEventListener('click', () => startQuiz(card.dataset.id));
    });
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
      els.progressLabel.textContent = `Domanda ${state.questionIndex + 1} di ${total}`;
    }

    const tx = reducedMotion ? 'tx-fade-up' : nextTransition();
    const options = shuffle(q.options.map((o, i) => ({ ...o, origIndex: i })));

    els.stage.innerHTML = `
      <div class="quiz-hub-question tx-enter ${tx}" role="group" aria-labelledby="qh-q-text">
        <span class="quiz-hub-question__n">${String(state.questionIndex + 1).padStart(2, '0')}</span>
        <p class="quiz-hub-question__text" id="qh-q-text">${enrichTerms(q.question)}</p>
        <div class="quiz-hub-options" id="quiz-hub-options">
          ${options.map((opt, i) => `
            <label class="quiz-hub-option" data-correct="${opt.correct}" style="--opt-i:${i}">
              <input type="radio" name="qh-opt" value="${i}">
              <span class="quiz-hub-option__face">
                <span class="quiz-hub-option__dot"></span>
                <span class="quiz-hub-option__text">${enrichTerms(opt.text)}</span>
              </span>
            </label>`).join('')}
        </div>
        <div class="quiz-hub-feedback" id="quiz-hub-feedback" aria-live="polite"></div>
        <div class="quiz-hub-actions">
          <button type="button" class="quiz-hub-btn" id="quiz-hub-check" disabled>Verifica</button>
        </div>
      </div>`;

    const checkBtn = document.getElementById('quiz-hub-check');
    const feedback = document.getElementById('quiz-hub-feedback');
    const optionEls = els.stage.querySelectorAll('.quiz-hub-option');

    optionEls.forEach((label) => {
      label.querySelector('input').addEventListener('change', () => {
        if (state.answered) return;
        checkBtn.disabled = false;
      });
    });

    checkBtn.addEventListener('click', () => {
      if (state.answered) return;
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
      feedback.innerHTML = `<strong>${correct ? 'Corretto!' : 'Non esatto.'}</strong> ${enrichTerms(q.explanation)}`;
      checkBtn.textContent = state.questionIndex + 1 >= total ? 'Vedi risultati' : 'Prossima domanda';
      checkBtn.disabled = false;
      checkBtn.onclick = () => {
        if (state.questionIndex + 1 >= total) finishQuiz();
        else {
          state.questionIndex += 1;
          state.answered = false;
          renderQuestion();
        }
      };
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
    if (accuracy >= 80) fireConfetti();

    els.stage.innerHTML = `
      <div class="quiz-hub-results">
        <div class="quiz-hub-results__ring">${accuracy}%</div>
        <h2>${accuracy >= 80 ? 'Ottimo lavoro!' : accuracy >= 50 ? 'Buon tentativo' : 'Continua a studiare'}</h2>
        <p>Hai risposto correttamente a <strong>${state.score}</strong> su <strong>${total}</strong> domande in <em>${cat.name}</em>.</p>
        <div class="quiz-hub-actions" style="justify-content:center;margin-top:1.25rem">
          <button type="button" class="quiz-hub-btn" id="qh-retry">Riprova</button>
          <button type="button" class="quiz-hub-btn quiz-hub-btn--ghost" id="qh-home">Torna al catalogo</button>
        </div>
      </div>`;

    document.getElementById('qh-retry')?.addEventListener('click', () => startQuiz(cat.id));
    document.getElementById('qh-home')?.addEventListener('click', showCatalog);
    updateStats();
  }

  function initParticles() {
    const canvas = els.particles;
    if (!canvas || reducedMotion) return;
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    const dots = [];

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    resize();

    for (let i = 0; i < 70; i++) {
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        hue: 260 + Math.random() * 80,
      });
    }

    function frame() {
      ctx.clearRect(0, 0, w, h);
      dots.forEach((d) => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1;
        if (d.y < 0 || d.y > h) d.vy *= -1;
      });
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120) {
            ctx.strokeStyle = `hsla(${(dots[i].hue + dots[j].hue) / 2}, 60%, 60%, ${0.08 * (1 - dist / 120)})`;
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.stroke();
          }
        }
      }
      dots.forEach((d) => {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${d.hue}, 70%, 65%, 0.4)`;
        ctx.fill();
      });
      requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize, { passive: true });
    frame();
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
      const target = parseInt(el.textContent, 10);
      if (Number.isNaN(target)) return;
      el.textContent = '0';
      const start = performance.now() + i * 120;
      const dur = 900;
      function tick(now) {
        if (now < start) {
          requestAnimationFrame(tick);
          return;
        }
        const t = Math.min(1, (now - start) / dur);
        el.textContent = String(Math.round(target * (1 - Math.pow(1 - t, 3))));
        if (t < 1) requestAnimationFrame(tick);
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

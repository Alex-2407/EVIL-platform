(function () {
  'use strict';

  const I18N = window.EVIL_I18N || null;
  const t = (text, vars) => (I18N && typeof I18N.t === 'function' ? I18N.t(text, vars) : text);
  const esc = window.EVIL_UTILS.escapeHtml;
  const overview = document.getElementById('cp-overview');
  const stage = document.getElementById('cp-stage');
  const statusLine = document.getElementById('cp-status');
  const courseId = new URLSearchParams(window.location.search).get('c') || '';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let course = null; // dettaglio con progresso (utente collegato)
  let catalog = null; // programma pubblico (sempre disponibile)
  let session = null; // stato della schermata attiva

  /* ───────────── utilità ───────────── */

  const lang = () => (I18N && I18N.lang ? I18N.lang : 'it');
  const pageUrl = (path) => (I18N && typeof I18N.url === 'function' ? I18N.url(path) : path);

  async function api(path, options) {
    const response = await fetch(path, Object.assign({
      credentials: 'include',
      cache: 'no-store',
      headers: { 'X-EVIL-Lang': lang() },
    }, options || {}));
    let body = {};
    try { body = await response.json(); } catch { body = {}; }
    if (!response.ok) {
      const error = new Error(body.error || t('Richiesta non riuscita. Riprova.'));
      error.status = response.status;
      error.code = body.code;
      throw error;
    }
    return body;
  }

  function post(path, payload) {
    return api(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-EVIL-Lang': lang() },
      body: JSON.stringify(payload || {}),
    });
  }

  const base = () => '/api/courses/' + encodeURIComponent(courseId);

  function say(text, isError) {
    statusLine.textContent = text || '';
    statusLine.dataset.state = isError ? 'error' : '';
  }

  function loginHref() {
    return pageUrl('/login.html') + '?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
  }

  function hoursLabel(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return t('{m} min', { m: m });
    return m ? t('{h} h {m} min', { h: h, m: m }) : t('{h} h', { h: h });
  }

  function ring(percent, label) {
    const r = 34;
    const c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, percent));
    return '<div class="cp-ring" role="img" aria-label="' + esc(label) + '"><svg viewBox="0 0 80 80" width="84" height="84">' +
      '<circle cx="40" cy="40" r="' + r + '" class="cp-ring__bg"/>' +
      '<circle cx="40" cy="40" r="' + r + '" class="cp-ring__fg" stroke-dasharray="' + (c * p / 100).toFixed(1) + ' ' + c.toFixed(1) +
      '" transform="rotate(-90 40 40)"/></svg><b>' + p + '%</b></div>';
  }

  /* ───────────── effetti (rispettano prefers-reduced-motion) ───────────── */

  function popXp(amount, anchor) {
    if (!amount) return;
    const node = document.createElement('div');
    node.className = 'cp-xp-pop';
    node.textContent = '+' + amount + ' XP';
    (anchor || stage).appendChild(node);
    setTimeout(() => node.remove(), 1600);
  }

  function confetti() {
    if (reduceMotion) return;
    const layer = document.createElement('div');
    layer.className = 'cp-confetti';
    layer.setAttribute('aria-hidden', 'true');
    const colors = ['#00ff9c', '#f59e0b', '#7dd3fc', '#c4b5fd'];
    for (let i = 0; i < 34; i += 1) {
      const piece = document.createElement('i');
      piece.style.left = Math.round(Math.random() * 100) + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 0.4).toFixed(2) + 's';
      piece.style.setProperty('--dx', Math.round(Math.random() * 160 - 80) + 'px');
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 2600);
  }

  /* ───────────── panoramica ───────────── */

  function nextStepInfo() {
    const next = course.next || { type: 'lesson' };
    const level = course.levels.find((item) => item.id === next.moduleId);
    if (next.type === 'lesson' && level) {
      const lesson = level.lessons.find((item) => item.id === next.lessonId);
      const started = course.lessonsDone > 0;
      return { label: (started ? t('Continua: ') : t('Inizia: ')) + (lesson ? lesson.title : ''), action: 'lesson', moduleId: level.id, lessonId: next.lessonId };
    }
    if (next.type === 'lab' && level) return { label: t('Laboratorio: {title}', { title: level.labTitle }), action: 'lab', moduleId: level.id };
    if (next.type === 'quiz' && level) return { label: t('Test del livello {n}', { n: level.number }), action: 'quiz', moduleId: level.id };
    if (next.type === 'diploma') return { label: t('Apri il tuo diploma'), action: 'diploma' };
    return { label: t('Affronta l’esame finale'), action: 'exam' };
  }

  function levelStatus(level) {
    if (level.passed) return { cls: 'done', text: t('Superato') };
    if (!level.unlocked) return { cls: 'locked', text: t('Bloccato') };
    return { cls: 'active', text: t('In corso') };
  }

  function renderGoals(goals, doneFlags) {
    return '<section class="cp-goals" aria-labelledby="cp-goals-title"><p class="cp-kicker">' + esc(t('Obiettivi del corso')) + '</p>' +
      '<h2 id="cp-goals-title">' + esc(t('Alla fine sarai in grado di')) + '</h2><ul>' +
      goals.map((goal, index) => '<li class="' + (doneFlags && doneFlags[index] ? 'is-done' : '') + '"><span class="cp-goals__mark" aria-hidden="true">' +
        (doneFlags && doneFlags[index] ? '✓' : String(index + 1)) + '</span><span>' + esc(goal) + '</span>' +
        (doneFlags && doneFlags[index] ? '<small class="cp-sr">' + esc(t('Raggiunto')) + '</small>' : '') + '</li>').join('') + '</ul></section>';
  }

  function lessonButton(level, lesson) {
    const state = lesson.done ? 'is-done' : lesson.open ? 'is-open' : 'is-locked';
    return '<li><button type="button" class="cp-chip ' + state + '" data-lesson="' + esc(lesson.id) + '" data-module="' + esc(level.id) + '"' +
      (lesson.open ? '' : ' disabled') + '><span class="cp-chip__mark" aria-hidden="true">' + (lesson.done ? '✓' : lesson.open ? '▸' : '🔒') + '</span>' +
      '<span>' + esc(lesson.title) + '</span><small>' + esc(t('{m} min', { m: lesson.minutes })) + '</small></button></li>';
  }

  function renderLevel(level) {
    const status = levelStatus(level);
    const labState = level.labPassed ? 'is-done' : level.labOpen ? 'is-open' : 'is-locked';
    const quizState = level.quizPassed ? 'is-done' : level.quizOpen ? 'is-open' : 'is-locked';
    return '<li class="cp-level cp-level--' + status.cls + '" id="cp-level-' + esc(level.id) + '">' +
      '<div class="cp-level__node" aria-hidden="true">' + (level.passed ? '✓' : level.number) + '</div>' +
      '<div class="cp-level__body"><header><p class="cp-kicker">' + esc(t('Livello {n}', { n: level.number })) + '</p>' +
      '<h3>' + esc(level.title) + '</h3><span class="cp-badge cp-badge--' + status.cls + '">' + esc(status.text) + '</span></header>' +
      '<p class="cp-level__mission">' + esc(level.mission) + '</p>' +
      '<p class="cp-level__skill"><b>' + esc(t('Abilità che sblocchi')) + '</b> ' + esc(level.skill) + '</p>' +
      '<ul class="cp-chips">' + level.lessons.map((lesson) => lessonButton(level, lesson)).join('') +
      '<li><button type="button" class="cp-chip cp-chip--lab ' + labState + '" data-lab="' + esc(level.id) + '"' + (level.labOpen ? '' : ' disabled') + '>' +
      '<span class="cp-chip__mark" aria-hidden="true">' + (level.labPassed ? '✓' : level.labOpen ? '⚗' : '🔒') + '</span><span>' + esc(level.labTitle) + '</span>' +
      '<small>' + (level.labScore == null ? esc(t('{m} min', { m: level.labMinutes })) : level.labScore + '%') + '</small></button></li>' +
      '<li><button type="button" class="cp-chip cp-chip--quiz ' + quizState + '" data-quiz="' + esc(level.id) + '"' + (level.quizOpen ? '' : ' disabled') + '>' +
      '<span class="cp-chip__mark" aria-hidden="true">' + (level.quizPassed ? '✓' : level.quizOpen ? '✎' : '🔒') + '</span><span>' + esc(t('Test del livello')) + '</span>' +
      '<small>' + (level.quizScore == null ? esc(t('{n} domande', { n: level.quizCount })) : level.quizScore + '%') + '</small></button></li>' +
      '</ul></div></li>';
  }

  function renderOverview() {
    stage.hidden = true;
    overview.hidden = false;
    const title = course.title[lang()] || course.title.it;
    const info = nextStepInfo();
    document.title = title + ' - EVIL';
    const doneFlags = course.levels.map((level) => level.passed);
    const examState = course.diplomaCode ? 'done' : course.examUnlocked ? 'active' : 'locked';
    overview.innerHTML =
      '<a class="cp-back" href="' + esc(pageUrl('/learning-paths.html')) + '">← ' + esc(t('Tutti i corsi')) + '</a>' +
      '<section class="cp-hero"><div class="cp-hero__text"><p class="cp-kicker">' + esc(course.level) + ' · ' +
      esc(t('circa {time}', { time: hoursLabel(course.minutes) })) + ' · ' + esc(t('{l} lezioni · {n} livelli', { l: course.lessonTotal, n: course.levelTotal })) + '</p>' +
      '<h1>' + esc(title) + '</h1><p class="cp-hero__tagline">' + esc(course.tagline) + '</p><p class="cp-hero__audience">' + esc(course.audience) + '</p>' +
      '<div class="cp-hero__cta"><button type="button" class="cp-btn cp-btn--go" data-next>' + esc(info.label) + '</button></div></div>' +
      '<aside class="cp-dash" aria-label="' + esc(t('I tuoi progressi')) + '">' + ring(course.percent, t('{p}% completato', { p: course.percent })) +
      '<dl><div><dt>' + esc(t('Punti')) + '</dt><dd>' + course.stats.xp + ' XP</dd></div>' +
      '<div><dt>' + esc(t('Serie')) + '</dt><dd>' + esc(t('{d} giorni', { d: course.stats.streak })) + '</dd></div>' +
      '<div><dt>' + esc(t('Lezioni')) + '</dt><dd>' + course.lessonsDone + '/' + course.lessonTotal + '</dd></div>' +
      '<div><dt>' + esc(t('Livelli')) + '</dt><dd>' + course.levelsPassed + '/' + course.levelTotal + '</dd></div></dl></aside></section>' +
      renderGoals(course.goals, doneFlags) +
      '<section class="cp-path" aria-labelledby="cp-path-title"><p class="cp-kicker">' + esc(t('Il percorso')) + '</p><h2 id="cp-path-title">' + esc(t('Quattro livelli, uno dopo l’altro')) + '</h2>' +
      '<ol class="cp-levels">' + course.levels.map(renderLevel).join('') +
      '<li class="cp-level cp-level--' + examState + ' cp-level--exam"><div class="cp-level__node" aria-hidden="true">' + (course.diplomaCode ? '★' : '🎓') + '</div>' +
      '<div class="cp-level__body"><header><p class="cp-kicker">' + esc(t('Traguardo')) + '</p><h3>' + esc(t('Esame finale e diploma')) + '</h3></header>' +
      '<p class="cp-level__mission">' + esc(t('Dieci domande a risposta mescolata e un diploma con firma digitale, QR e codice, verificabile da chiunque.')) + '</p>' +
      '<ul class="cp-chips"><li><button type="button" class="cp-chip ' + (course.diplomaCode ? 'is-done' : course.examUnlocked ? 'is-open' : 'is-locked') + '" data-exam' +
      (course.examUnlocked || course.diplomaCode ? '' : ' disabled') + '><span class="cp-chip__mark" aria-hidden="true">' + (course.diplomaCode ? '✓' : course.examUnlocked ? '▸' : '🔒') + '</span><span>' +
      esc(course.diplomaCode ? t('Apri il diploma') : t('Esame finale')) + '</span></button></li></ul></div></li></ol></section>';
  }

  function renderPublic() {
    stage.hidden = true;
    const title = catalog.title;
    document.title = title + ' - EVIL';
    overview.innerHTML =
      '<a class="cp-back" href="' + esc(pageUrl('/learning-paths.html')) + '">← ' + esc(t('Tutti i corsi')) + '</a>' +
      '<section class="cp-hero cp-hero--single"><div class="cp-hero__text"><p class="cp-kicker">' + esc(catalog.level) + ' · ' +
      esc(t('circa {time}', { time: hoursLabel(catalog.minutes) })) + ' · ' + esc(t('{l} lezioni · {n} livelli', { l: catalog.lessonTotal, n: catalog.levelTotal })) + '</p>' +
      '<h1>' + esc(title) + '</h1><p class="cp-hero__tagline">' + esc(catalog.tagline) + '</p><p class="cp-hero__audience">' + esc(catalog.audience) + '</p>' +
      '<div class="cp-hero__cta"><a class="cp-btn cp-btn--go" href="' + esc(loginHref()) + '">' + esc(t('Accedi per iniziare')) + '</a>' +
      '<a class="cp-btn cp-btn--ghost" href="' + esc(pageUrl('/account.html')) + '">' + esc(t('Crea un account')) + '</a></div></div></section>' +
      renderGoals(catalog.goals, null) +
      '<section class="cp-path"><p class="cp-kicker">' + esc(t('Il percorso')) + '</p><h2>' + esc(t('Quattro livelli, uno dopo l’altro')) + '</h2><ol class="cp-levels">' +
      catalog.levels.map((level) => '<li class="cp-level cp-level--active"><div class="cp-level__node" aria-hidden="true">' + level.number + '</div><div class="cp-level__body">' +
        '<header><p class="cp-kicker">' + esc(t('Livello {n}', { n: level.number })) + '</p><h3>' + esc(level.title) + '</h3></header>' +
        '<p class="cp-level__mission">' + esc(level.mission) + '</p><p class="cp-level__skill"><b>' + esc(t('Abilità che sblocchi')) + '</b> ' + esc(level.skill) + '</p>' +
        '<ul class="cp-chips">' + level.lessons.map((title2) => '<li><span class="cp-chip is-static"><span class="cp-chip__mark" aria-hidden="true">▸</span><span>' + esc(title2) + '</span></span></li>').join('') +
        '<li><span class="cp-chip cp-chip--lab is-static"><span class="cp-chip__mark" aria-hidden="true">⚗</span><span>' + esc(level.labTitle) + '</span></span></li></ul></div></li>').join('') +
      '</ol></section>';
  }

  /* ───────────── palcoscenico ───────────── */

  function openStage(html, soft) {
    overview.hidden = true;
    stage.hidden = false;
    stage.innerHTML = html;
    if (soft) return;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    const heading = stage.querySelector('h2');
    if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
  }

  function stageBar(label, current, total) {
    const percent = total ? Math.round(current / total * 100) : 0;
    return '<div class="cp-bar"><button type="button" class="cp-btn cp-btn--ghost cp-btn--sm" data-home>← ' + esc(t('Torna al percorso')) + '</button>' +
      '<span class="cp-bar__label">' + esc(label) + '</span><span class="cp-bar__xp">' + course.stats.xp + ' XP · ' + esc(t('serie {d}', { d: course.stats.streak })) + '</span></div>' +
      '<div class="cp-steps" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + current + '"><span style="width:' + percent + '%"></span></div>';
  }

  async function refresh() {
    const data = await api(base());
    course = data.course;
  }

  function levelById(id) { return course.levels.find((item) => item.id === id); }

  /* ───────────── lezione ───────────── */

  async function openLesson(moduleId, lessonId) {
    say('');
    try {
      const data = await api(base() + '/lessons/' + encodeURIComponent(lessonId));
      const steps = [];
      if (data.recall) steps.push('recall');
      steps.push('hook', 'explain', 'example', 'mistakes', 'check', 'summary');
      session = { kind: 'lesson', moduleId: moduleId, lessonId: lessonId, data: data, steps: steps, index: 0, recallDone: false, checkDone: data.checkDone, xpEarned: 0 };
      renderLessonStep();
    } catch (error) {
      say(error.message, true);
    }
  }

  function optionButtons(options, name) {
    return '<div class="cp-options" role="group">' + options.map((option) => '<button type="button" class="cp-option" data-' + name + '="' + option.i + '">' +
      '<span class="cp-option__key" aria-hidden="true"></span><span>' + esc(option.text) + '</span></button>').join('') + '</div>';
  }

  function renderLessonStep() {
    const s = session;
    const data = s.data;
    const lesson = data.lesson;
    const kind = s.steps[s.index];
    const level = levelById(s.moduleId);
    const label = esc(level ? t('Livello {n} · {title}', { n: level.number, title: level.title }) : data.moduleTitle) + ' · ' +
      esc(t('Lezione {current} di {total}', { current: data.position + 1, total: data.total }));
    let body = '';
    let canNext = true;
    if (kind === 'recall') {
      body = '<p class="cp-kicker">' + esc(t('Ripasso lampo')) + '</p><h2>' + esc(data.recall.prompt) + '</h2>' +
        '<p class="cp-hint">' + esc(t('Richiamare ciò che hai già visto è il modo migliore per ricordarlo.')) + '</p>' + optionButtons(data.recall.options, 'recall') +
        '<div class="cp-feedback" data-feedback aria-live="polite"></div>';
      canNext = s.recallDone;
    } else if (kind === 'hook') {
      body = '<p class="cp-kicker">' + esc(t('Perché ti riguarda')) + '</p><h2 class="cp-lesson-title">' + esc(lesson.title) + '</h2>' +
        (data.hook ? '<blockquote class="cp-hook">' + esc(data.hook) + '</blockquote>' : '') +
        '<p class="cp-goal"><b>' + esc(t('Obiettivo')) + '</b> ' + esc(lesson.objective) + '</p><p class="cp-meta">' + esc(t('{m} min di lettura', { m: data.minutes })) + '</p>';
    } else if (kind === 'explain') {
      body = '<p class="cp-kicker">' + esc(t('Spiegazione')) + '</p><h2>' + esc(lesson.title) + '</h2><p class="cp-prose">' + esc(lesson.explanation) + '</p>';
    } else if (kind === 'example') {
      body = '<p class="cp-kicker">' + esc(t('Esempio difensivo')) + '</p><h2>' + esc(lesson.title) + '</h2><p class="cp-prose cp-prose--example">' + esc(lesson.example) + '</p>';
    } else if (kind === 'mistakes') {
      body = '<p class="cp-kicker">' + esc(t('Errori comuni')) + '</p><h2>' + esc(lesson.title) + '</h2><p class="cp-prose cp-prose--warn">' + esc(lesson.commonMistakes) + '</p>';
    } else if (kind === 'check') {
      body = '<p class="cp-kicker">' + esc(t('Verifica rapida')) + '</p><h2>' + esc(data.check.prompt) + '</h2>' + optionButtons(data.check.options, 'check') +
        '<div class="cp-feedback" data-feedback aria-live="polite">' + (s.checkDone ? '<p class="cp-ok">' + esc(t('Risposta già corretta: puoi proseguire.')) + '</p>' : '') + '</div>';
      canNext = s.checkDone;
    } else {
      const done = data.done;
      body = '<p class="cp-kicker">' + esc(t('Punti chiave')) + '</p><h2>' + esc(lesson.title) + '</h2><ul class="cp-keys">' +
        lesson.keyPoints.map((point) => '<li>' + esc(point) + '</li>').join('') + '</ul>' +
        '<button type="button" class="cp-btn cp-btn--go" data-complete' + (done ? ' hidden' : '') + '>' + esc(t('Completa la lezione')) + '</button>';
      canNext = false;
    }
    openStage(stageBar(label, s.index + 1, s.steps.length) + '<article class="cp-card cp-card--' + kind + '">' + body +
      '<nav class="cp-nav"><button type="button" class="cp-btn cp-btn--ghost" data-prev' + (s.index === 0 ? ' disabled' : '') + '>' + esc(t('Indietro')) + '</button>' +
      (kind === 'summary' && data.done ? '<button type="button" class="cp-btn cp-btn--go" data-after>' + esc(afterLessonLabel()) + '</button>' :
        kind === 'summary' ? '' : '<button type="button" class="cp-btn cp-btn--go" data-next-step' + (canNext ? '' : ' disabled') + '>' + esc(t('Avanti')) + '</button>') + '</nav></article>');
    const firstOption = stage.querySelector('.cp-option');
    if (firstOption) firstOption.focus({ preventScroll: true });
  }

  function afterLessonLabel() {
    const level = levelById(session.moduleId);
    if (session.data.nextId) return t('Prossima lezione');
    return level && level.labOpen ? t('Vai al laboratorio') : t('Torna al percorso');
  }

  async function answerOption(button, mode) {
    const s = session;
    const group = button.parentElement;
    const feedback = stage.querySelector('[data-feedback]');
    const answer = Number(button.dataset[mode]);
    const lessonId = mode === 'recall' ? s.data.recall.lessonId : s.lessonId;
    group.querySelectorAll('button').forEach((item) => { item.disabled = true; });
    try {
      const result = await post(base() + '/lessons/' + encodeURIComponent(lessonId) + '/check', { answer: answer, recall: mode === 'recall' });
      if (result.correct) {
        button.classList.add('is-right');
        feedback.innerHTML = '<p class="cp-ok">' + esc(t('Esatto.')) + ' ' + esc(result.why || '') + '</p>';
        if (mode === 'recall') s.recallDone = true; else s.checkDone = true;
        if (result.xp) { s.xpEarned += result.xp; popXp(result.xp, feedback); }
        const next = stage.querySelector('[data-next-step]');
        if (next) { next.disabled = false; next.focus({ preventScroll: true }); }
      } else {
        button.classList.add('is-wrong');
        feedback.innerHTML = '<p class="cp-bad">' + esc(mode === 'recall'
          ? t('Non è questa: nessun problema, ci ripasserai più avanti.')
          : t('Non ancora. Rileggi la spiegazione e riprova con un’altra opzione.')) + '</p>';
        group.querySelectorAll('button').forEach((item) => { item.disabled = item.classList.contains('is-wrong'); });
        if (mode === 'recall') { s.recallDone = true; group.querySelectorAll('button').forEach((item) => { item.disabled = true; }); stage.querySelector('[data-next-step]').disabled = false; }
      }
    } catch (error) {
      group.querySelectorAll('button').forEach((item) => { item.disabled = false; });
      say(error.message, true);
    }
  }

  async function completeLesson() {
    const s = session;
    try {
      const result = await post(base() + '/lessons/' + encodeURIComponent(s.lessonId) + '/complete');
      course = result.course;
      s.data.done = true;
      s.xpEarned += result.xp || 0;
      renderLessonStep();
      popXp(result.xp);
      const button = stage.querySelector('[data-after]');
      if (button) button.focus({ preventScroll: true });
    } catch (error) {
      say(error.message, true);
    }
  }

  function afterLesson() {
    const s = session;
    if (s.data.nextId) return openLesson(s.moduleId, s.data.nextId);
    const level = levelById(s.moduleId);
    if (level && level.labOpen && !level.labPassed) return openLab(s.moduleId);
    return goHome();
  }

  /* ───────────── laboratorio ───────────── */

  async function openLab(moduleId) {
    say('');
    try {
      const data = await api(base() + '/levels/' + encodeURIComponent(moduleId) + '/lab');
      session = { kind: 'lab', moduleId: moduleId, lab: data.lab, answers: { classify: {}, order: null, selected: [] } };
      if (session.lab.kind === 'order') session.answers.order = session.lab.items.map((item) => item.id);
      renderLab();
    } catch (error) {
      say(error.message, true);
    }
  }

  function renderLab(result, soft) {
    const s = session;
    const lab = s.lab;
    const level = levelById(s.moduleId);
    let body = '';
    const mark = (item) => (result ? (result.items.find((entry) => entry.id === item.id) || {}) : {});
    if (lab.kind === 'classify') {
      body = '<ul class="cp-lab-list">' + lab.items.map((item) => {
        const info = mark(item);
        return '<li class="cp-lab-item' + (result ? (info.correct ? ' is-right' : ' is-wrong') : '') + '"><p>' + esc(item.text) + '</p><div class="cp-seg" role="radiogroup" aria-label="' + esc(item.text) + '">' +
          lab.categories.map((category, index) => '<button type="button" role="radio" class="cp-seg__btn' + (s.answers.classify[item.id] === index ? ' is-on' : '') + '" aria-checked="' +
            (s.answers.classify[item.id] === index) + '" data-classify="' + esc(item.id) + '" data-cat="' + index + '"' + (result ? ' disabled' : '') + '>' + esc(category) + '</button>').join('') + '</div>' +
          (result && info.why ? '<small>' + esc(info.why) + '</small>' : '') + '</li>';
      }).join('') + '</ul>';
    } else if (lab.kind === 'order') {
      const byId = {};
      lab.items.forEach((item) => { byId[item.id] = item; });
      body = '<ol class="cp-lab-list cp-lab-list--order">' + s.answers.order.map((id, position) => {
        const info = result ? (result.items[position] || {}) : {};
        return '<li class="cp-lab-item' + (result ? (info.correct ? ' is-right' : ' is-wrong') : '') + '"><span class="cp-lab-item__n" aria-hidden="true">' + (position + 1) + '</span><p>' + esc(byId[id].text) + '</p>' +
          (result ? '' : '<div class="cp-move"><button type="button" class="cp-btn cp-btn--ghost cp-btn--sm" data-move="-1" data-pos="' + position + '" aria-label="' + esc(t('Sposta su')) + '"' + (position === 0 ? ' disabled' : '') + '>↑</button>' +
            '<button type="button" class="cp-btn cp-btn--ghost cp-btn--sm" data-move="1" data-pos="' + position + '" aria-label="' + esc(t('Sposta giù')) + '"' + (position === lab.items.length - 1 ? ' disabled' : '') + '>↓</button></div>') + '</li>';
      }).join('') + '</ol>';
      if (result && result.passed) {
        body += '<h3 class="cp-sub">' + esc(t('Ordine corretto')) + '</h3><ol class="cp-lab-list">' + result.items.map((item) => '<li class="cp-lab-item is-right"><p>' + esc(item.text) + '</p><small>' + esc(item.why) + '</small></li>').join('') + '</ol>';
      }
    } else {
      body = '<ul class="cp-lab-list">' + lab.options.map((item) => {
        const info = mark(item);
        const on = s.answers.selected.includes(item.id);
        return '<li class="cp-lab-item' + (result ? (info.correct ? ' is-right' : ' is-wrong') : '') + '"><label class="cp-check"><input type="checkbox" data-select="' + esc(item.id) + '"' + (on ? ' checked' : '') + (result ? ' disabled' : '') + '><span>' + esc(item.text) + '</span></label>' +
          (result && info.why ? '<small>' + esc(info.why) + '</small>' : '') + '</li>';
      }).join('') + '</ul>';
    }
    let footer = '';
    if (result) {
      footer = '<div class="cp-result cp-result--' + (result.passed ? 'pass' : 'fail') + '">' + ring(result.score, t('{p}%', { p: result.score })) + '<div><b>' +
        esc(result.passed ? t('Laboratorio superato') : t('Quasi: serve almeno il {n}%', { n: result.passScore })) + '</b>' +
        (result.passed ? '<p>' + esc(result.debrief) + '</p>' : '<p>' + esc(t('Controlla gli elementi segnati in rosso, rivedi le lezioni del livello e riprova.')) + '</p>') + '</div></div>' +
        '<nav class="cp-nav"><button type="button" class="cp-btn cp-btn--ghost" data-home>' + esc(t('Torna al percorso')) + '</button>' +
        (result.passed ? '<button type="button" class="cp-btn cp-btn--go" data-to-quiz>' + esc(t('Vai al test del livello')) + '</button>' :
          '<button type="button" class="cp-btn cp-btn--go" data-retry-lab>' + esc(t('Riprova il laboratorio')) + '</button>') + '</nav>';
    } else {
      footer = '<nav class="cp-nav"><span></span><button type="button" class="cp-btn cp-btn--go" data-submit-lab>' + esc(t('Verifica il laboratorio')) + '</button></nav>';
    }
    openStage(stageBar(t('Laboratorio · livello {n}', { n: level ? level.number : '' }), result && result.passed ? 1 : 0, 1) +
      '<article class="cp-card cp-card--lab"><p class="cp-kicker">' + esc(t('Laboratorio pratico')) + '</p><h2>' + esc(lab.title) + '</h2><p class="cp-prose">' + esc(lab.brief) + '</p>' + body + footer + '</article>', soft);
    if (result && result.passed) { popXp(result.xp); confetti(); }
  }

  function readClassifyComplete() {
    return session.lab.items.every((item) => Number.isInteger(session.answers.classify[item.id]));
  }

  async function submitLab() {
    const s = session;
    let answers;
    if (s.lab.kind === 'classify') {
      if (!readClassifyComplete()) { say(t('Assegna una categoria a ogni elemento prima di verificare.'), true); return; }
      answers = s.answers.classify;
    } else if (s.lab.kind === 'order') answers = { order: s.answers.order };
    else answers = { selected: s.answers.selected };
    say('');
    try {
      const result = await post(base() + '/levels/' + encodeURIComponent(s.moduleId) + '/lab/submit', { answers: answers });
      course = result.course;
      s.result = result;
      renderLab(result);
    } catch (error) {
      say(error.message, true);
    }
  }

  /* ───────────── test di livello ───────────── */

  async function openQuiz(moduleId) {
    say('');
    try {
      const data = await api(base() + '/levels/' + encodeURIComponent(moduleId) + '/quiz');
      session = { kind: 'quiz', moduleId: moduleId, questions: data.questions, index: 0, answers: {}, passScore: data.passScore };
      renderQuiz();
    } catch (error) {
      say(error.message, true);
    }
  }

  function renderQuiz() {
    const s = session;
    const question = s.questions[s.index];
    const level = levelById(s.moduleId);
    const picked = s.answers[question.id];
    openStage(stageBar(t('Test del livello {n}', { n: level ? level.number : '' }), s.index + 1, s.questions.length) +
      '<article class="cp-card cp-card--quiz"><p class="cp-kicker">' + esc(t('Domanda {current} di {total}', { current: s.index + 1, total: s.questions.length })) + '</p>' +
      '<h2>' + esc(question.prompt) + '</h2><div class="cp-options" role="radiogroup">' + question.options.map((option) => '<button type="button" role="radio" class="cp-option' + (picked === option.i ? ' is-picked' : '') +
        '" aria-checked="' + (picked === option.i) + '" data-pick="' + option.i + '"><span class="cp-option__key" aria-hidden="true"></span><span>' + esc(option.text) + '</span></button>').join('') + '</div>' +
      '<nav class="cp-nav"><button type="button" class="cp-btn cp-btn--ghost" data-quiz-prev' + (s.index === 0 ? ' disabled' : '') + '>' + esc(t('Indietro')) + '</button>' +
      '<button type="button" class="cp-btn cp-btn--go" data-quiz-next' + (picked == null ? ' disabled' : '') + '>' + esc(s.index === s.questions.length - 1 ? t('Invia il test') : t('Avanti')) + '</button></nav></article>');
  }

  async function submitQuiz() {
    const s = session;
    say('');
    try {
      const result = await post(base() + '/levels/' + encodeURIComponent(s.moduleId) + '/quiz/submit', { answers: s.answers });
      course = result.course;
      renderQuizResult(result);
    } catch (error) {
      say(error.message, true);
    }
  }

  function renderQuizResult(result) {
    const s = session;
    const level = levelById(s.moduleId);
    const rows = s.questions.map((question, index) => {
      const info = result.items.find((item) => item.id === question.id) || {};
      const right = result.passed ? question.options.find((option) => option.i === info.correctIndex) : null;
      return '<li class="cp-lab-item ' + (info.correct ? 'is-right' : 'is-wrong') + '"><p><b>' + (index + 1) + '.</b> ' + esc(question.prompt) + '</p>' +
        (result.passed && right ? '<small>' + esc(t('Risposta corretta: {text}', { text: right.text })) + ' — ' + esc(info.explanation) + '</small>' : '') + '</li>';
    }).join('');
    const next = course.levels.find((item) => !item.passed);
    let cta;
    if (result.passed && next) cta = '<button type="button" class="cp-btn cp-btn--go" data-home>' + esc(t('Vai al livello successivo')) + '</button>';
    else if (result.passed) cta = '<button type="button" class="cp-btn cp-btn--go" data-exam>' + esc(t('Affronta l’esame finale')) + '</button>';
    else cta = '<button type="button" class="cp-btn cp-btn--go" data-retry-quiz>' + esc(t('Riprova il test')) + '</button>';
    const celebrate = result.levelCompleted
      ? '<div class="cp-unlock" role="status"><p class="cp-kicker">' + esc(t('Livello {n} completato', { n: level ? level.number : '' })) + '</p><h3>' + esc(t('Abilità sbloccata')) + '</h3><p>' + esc(result.skill) + '</p></div>' : '';
    openStage(stageBar(t('Test del livello {n}', { n: level ? level.number : '' }), result.passed ? 1 : 0, 1) +
      '<article class="cp-card cp-card--quiz"><div class="cp-result cp-result--' + (result.passed ? 'pass' : 'fail') + '">' + ring(result.score, t('{p}%', { p: result.score })) + '<div><b>' +
      esc(result.passed ? t('Test superato') : t('Non ancora: serve almeno il {n}%', { n: result.passScore })) + '</b><p>' +
      esc(result.passed ? t('Ottimo lavoro: ecco le spiegazioni.') : t('Ripassa le lezioni del livello: le risposte in rosso indicano dove tornare.')) + '</p></div></div>' + celebrate +
      '<h2 class="cp-sub">' + esc(t('Riepilogo')) + '</h2><ul class="cp-lab-list">' + rows + '</ul>' +
      '<nav class="cp-nav"><button type="button" class="cp-btn cp-btn--ghost" data-home>' + esc(t('Torna al percorso')) + '</button>' + cta + '</nav></article>');
    if (result.passed) { popXp(result.xp); }
    if (result.levelCompleted) confetti();
  }

  /* ───────────── esame finale e diploma ───────────── */

  function goDiploma(code) {
    window.location.href = pageUrl('/diploma.html') + '?c=' + encodeURIComponent(code);
  }

  async function openExam() {
    if (course.diplomaCode) { goDiploma(course.diplomaCode); return; }
    say('');
    try {
      const result = await post(base() + '/exam/start');
      if (result.completed && result.certificate) { goDiploma(result.certificate.code); return; }
      session = { kind: 'exam', exam: result };
      renderExam();
    } catch (error) {
      say(error.message, true);
    }
  }

  function renderExam() {
    const exam = session.exam;
    openStage(stageBar(t('Esame finale'), 0, 1) + '<article class="cp-card cp-card--quiz"><p class="cp-kicker">' + esc(t('Traguardo')) + '</p><h2>' +
      esc(t('Esame finale: {title}', { title: exam.courseTitle })) + '</h2><p class="cp-prose">' +
      esc(t('Rispondi a tutte le domande. Superi l’esame con almeno {score}%. Hai 30 minuti.', { score: exam.passScore })) + '</p>' +
      '<form data-exam-form>' + exam.questions.map((question, index) => '<fieldset class="cp-fieldset"><legend>' + (index + 1) + '. ' + esc(question.question) + '</legend>' +
        question.options.map((option, optionIndex) => {
          const id = 'cp-exam-' + question.id + '-' + optionIndex;
          return '<label class="cp-check" for="' + esc(id) + '"><input required type="radio" id="' + esc(id) + '" name="' + esc(question.id) + '" value="' + optionIndex + '"><span>' + esc(option) + '</span></label>';
        }).join('') + '</fieldset>').join('') +
      '<nav class="cp-nav"><button type="button" class="cp-btn cp-btn--ghost" data-home>' + esc(t('Torna al percorso')) + '</button><button type="submit" class="cp-btn cp-btn--go">' + esc(t('Invia le risposte')) + '</button></nav></form></article>');
  }

  async function submitExam(form) {
    const answers = {};
    for (const fieldset of form.querySelectorAll('.cp-fieldset')) {
      const picked = fieldset.querySelector('input:checked');
      if (!picked) { say(t('Completa tutte le risposte prima di inviare.'), true); fieldset.scrollIntoView({ block: 'center' }); return; }
      answers[picked.name] = Number(picked.value);
    }
    say('');
    form.querySelector('[type="submit"]').disabled = true;
    try {
      const result = await post(base() + '/exam/submit', { attemptId: session.exam.attemptId, answers: answers });
      if (result.passed && result.certificate) {
        confetti();
        openStage(stageBar(t('Esame finale'), 1, 1) + '<article class="cp-card cp-card--diploma"><p class="cp-kicker">' + esc(t('Traguardo raggiunto')) + '</p><h2>' +
          esc(t('Esame superato: {score}%', { score: result.score })) + '</h2><p class="cp-prose">' + esc(t('Il tuo diploma è stato firmato e porta il tuo nome, un codice univoco e un QR di verifica.')) + '</p>' +
          '<nav class="cp-nav"><span></span><a class="cp-btn cp-btn--go" href="' + esc(pageUrl('/diploma.html') + '?c=' + encodeURIComponent(result.certificate.code)) + '">' + esc(t('Apri il diploma')) + '</a></nav></article>');
        try { await refresh(); } catch { /* il diploma è comunque emesso */ }
      } else {
        openStage(stageBar(t('Esame finale'), 0, 1) + '<article class="cp-card cp-card--quiz"><div class="cp-result cp-result--fail">' + ring(result.score, t('{p}%', { p: result.score })) + '<div><b>' +
          esc(t('Esame non superato: serve almeno il {n}%', { n: result.passScore })) + '</b><p>' + esc(t('Rivedi i livelli e riprova: le domande si presentano in ordine diverso.')) + '</p></div></div>' +
          '<nav class="cp-nav"><button type="button" class="cp-btn cp-btn--ghost" data-home>' + esc(t('Torna al percorso')) + '</button><button type="button" class="cp-btn cp-btn--go" data-exam>' + esc(t('Riprova l’esame')) + '</button></nav></article>');
      }
    } catch (error) {
      say(error.message, true);
      form.querySelector('[type="submit"]').disabled = false;
    }
  }

  /* ───────────── navigazione ───────────── */

  async function goHome() {
    session = null;
    try { await refresh(); } catch (error) { say(error.message, true); }
    renderOverview();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  function runNext() {
    const info = nextStepInfo();
    if (info.action === 'lesson') openLesson(info.moduleId, info.lessonId);
    else if (info.action === 'lab') openLab(info.moduleId);
    else if (info.action === 'quiz') openQuiz(info.moduleId);
    else openExam();
  }

  document.addEventListener('click', (event) => {
    const el = event.target.closest('button, a');
    if (!el || !course) return;
    const d = el.dataset;
    if ('home' in d) goHome();
    else if ('next' in d) runNext();
    else if (d.lesson) openLesson(d.module, d.lesson);
    else if (d.lab && !('submitLab' in d)) openLab(d.lab);
    else if (d.quiz) openQuiz(d.quiz);
    else if ('exam' in d) openExam();
    else if ('toQuiz' in d) openQuiz(session.moduleId);
    else if ('retryLab' in d) openLab(session.moduleId);
    else if ('retryQuiz' in d) openQuiz(session.moduleId);
    else if ('submitLab' in d) submitLab();
    else if ('complete' in d) completeLesson();
    else if ('after' in d) afterLesson();
    else if ('nextStep' in d) { session.index = Math.min(session.steps.length - 1, session.index + 1); renderLessonStep(); }
    else if ('prev' in d) { session.index = Math.max(0, session.index - 1); renderLessonStep(); }
    else if (d.check !== undefined) answerOption(el, 'check');
    else if (d.recall !== undefined) answerOption(el, 'recall');
    else if (d.classify) {
      session.answers.classify[d.classify] = Number(d.cat);
      el.parentElement.querySelectorAll('button').forEach((item) => {
        const on = item === el;
        item.classList.toggle('is-on', on);
        item.setAttribute('aria-checked', String(on));
      });
    }
    else if (d.move) {
      const pos = Number(d.pos);
      const to = pos + Number(d.move);
      const order = session.answers.order;
      if (to >= 0 && to < order.length) {
        [order[pos], order[to]] = [order[to], order[pos]];
        renderLab(null, true);
        const again = stage.querySelector('[data-move="' + d.move + '"][data-pos="' + to + '"]:not([disabled])') ||
          stage.querySelector('[data-pos="' + to + '"]:not([disabled])');
        if (again) again.focus({ preventScroll: true });
      }
    } else if (d.pick !== undefined) {
      session.answers[session.questions[session.index].id] = Number(d.pick);
      el.parentElement.querySelectorAll('button').forEach((item) => {
        const on = item === el;
        item.classList.toggle('is-picked', on);
        item.setAttribute('aria-checked', String(on));
      });
      const go = stage.querySelector('[data-quiz-next]');
      if (go) { go.disabled = false; go.focus({ preventScroll: true }); }
    } else if ('quizNext' in d) {
      if (session.index === session.questions.length - 1) submitQuiz(); else { session.index += 1; renderQuiz(); }
    } else if ('quizPrev' in d) { session.index = Math.max(0, session.index - 1); renderQuiz(); }
  });

  document.addEventListener('change', (event) => {
    const box = event.target.closest('[data-select]');
    if (!box || !session) return;
    const list = session.answers.selected;
    const at = list.indexOf(box.dataset.select);
    if (box.checked && at < 0) list.push(box.dataset.select);
    if (!box.checked && at >= 0) list.splice(at, 1);
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('[data-exam-form]');
    if (!form) return;
    event.preventDefault();
    submitExam(form);
  });

  document.addEventListener('keydown', (event) => {
    if (!session || session.kind !== 'lesson' || event.target.closest('input, textarea')) return;
    if (event.key === 'ArrowRight') {
      const next = stage.querySelector('[data-next-step]:not([disabled])');
      if (next) next.click();
    } else if (event.key === 'ArrowLeft') {
      const prev = stage.querySelector('[data-prev]:not([disabled])');
      if (prev) prev.click();
    }
  });

  async function init() {
    if (!courseId) {
      overview.innerHTML = '<p class="cp-loading">' + esc(t('Corso non trovato.')) + ' <a href="' + esc(pageUrl('/learning-paths.html')) + '">' + esc(t('Tutti i corsi')) + '</a></p>';
      return;
    }
    try {
      await refresh();
      renderOverview();
      const hash = window.location.hash;
      if (hash === '#esame' && course.examUnlocked) openExam();
    } catch (error) {
      if (error.status !== 401) { overview.innerHTML = '<p class="cp-loading">' + esc(error.message) + '</p>'; return; }
      try {
        const data = await api('/api/courses/catalog');
        catalog = (data.courses || []).find((item) => item.id === courseId) || null;
        if (!catalog) throw new Error(t('Corso non trovato.'));
        renderPublic();
      } catch (inner) {
        overview.innerHTML = '<p class="cp-loading">' + esc(inner.message) + '</p>';
      }
    }
  }

  init();
})();

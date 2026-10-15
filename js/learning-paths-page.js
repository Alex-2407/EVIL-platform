/**
 * Pagina Percorsi di apprendimento — mostra i corsi definiti in evil-course.js,
 * con programma, progressi e pulsanti Inizia / Riprendi / Ricomincia.
 * La navigazione guidata (barra in basso) è gestita da evil-course.js.
 */
(function () {
  'use strict';

  var I18N = window.EVIL_I18N || null;
  function t(s, vars) {
    if (I18N && typeof I18N.t === 'function') return I18N.t(s, vars);
    if (vars) return s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
    return s;
  }
  const esc = window.EVIL_UTILS.escapeHtml;
  function escAttr(s) {
    return esc(s).replace(/"/g, '&quot;');
  }

  var grid = document.getElementById('lp-grid');
  var resume = document.getElementById('lp-resume');
  var api = window.EVIL_COURSE_API;
  var courses = window.EVIL_COURSES || [];

  function doneCount(course) {
    if (!api) return 0;
    var done = api.getDone(course.id) || [];
    return done.filter(function (i) { return i < course.steps.length; }).length;
  }

  function cardHtml(course) {
    var total = course.steps.length;
    var done = doneCount(course);
    var started = done > 0 || (api && api.isActive(course.id));
    var pct = Math.round((done / total) * 100);

    var steps = course.steps
      .map(function (step, i) {
        var isDone = api && (api.getDone(course.id) || []).indexOf(i) !== -1;
        return (
          '<li class="lp-step' + (isDone ? ' is-done' : '') + '">' +
          '<span class="lp-step__n">' + (i + 1) + '</span>' +
          '<span class="lp-step__body"><b>' + esc(step.title) + '</b>' +
          '<small>' + esc(step.goal) + '</small></span>' +
          '</li>'
        );
      })
      .join('');

    var primary = started
      ? '<button type="button" class="lp-btn lp-btn--go" data-resume="' + escAttr(course.id) + '">' +
        esc(done >= total ? t('Rivedi il percorso') : t('Riprendi →')) + '</button>'
      : '<button type="button" class="lp-btn lp-btn--go" data-start="' + escAttr(course.id) + '">' +
        esc(t('Inizia il percorso →')) + '</button>';
    var secondary = started
      ? '<button type="button" class="lp-btn lp-btn--ghost" data-reset="' + escAttr(course.id) + '">' +
        esc(t('Ricomincia')) + '</button>'
      : '';

    return (
      '<article class="lp-card lp-card--' + esc(course.color) + '" data-course="' + escAttr(course.id) + '">' +
      '<div class="lp-card__top">' +
      '<span class="lp-card__num">' + esc(course.num) + '</span>' +
      '<span class="lp-card__time">' + esc(course.duration) + '</span>' +
      '</div>' +
      '<p class="lp-card__level">' + esc(course.level) + '</p>' +
      '<h2>' + esc(course.title) + '</h2>' +
      '<p class="lp-card__desc">' + esc(course.tagline) + '</p>' +
      '<div class="lp-progress" role="progressbar" aria-valuemin="0" aria-valuemax="' + total +
      '" aria-valuenow="' + done + '" aria-label="' + escAttr(t('Tappe completate')) + '">' +
      '<span class="lp-progress__bar" style="width:' + pct + '%"></span>' +
      '</div>' +
      '<p class="lp-progress__label">' + esc(t('{n} di {m} tappe', { n: done, m: total })) + '</p>' +
      '<ol class="lp-steps">' + steps + '</ol>' +
      '<p class="lp-card__goal"><strong>' + esc(t('Alla fine:')) + '</strong> ' + esc(course.outcome) + '</p>' +
      '<div class="lp-card__actions">' + primary + secondary + '</div>' +
      '</article>'
    );
  }

  function render() {
    if (!grid) return;
    if (!courses.length || !api) {
      grid.innerHTML = '<p class="lp-loading">' + esc(t('Percorsi non disponibili.')) + '</p>';
      return;
    }
    grid.innerHTML = courses.map(cardHtml).join('');
    renderResume();
  }

  function renderResume() {
    if (!resume || !api) return;
    var active = null;
    for (var i = 0; i < courses.length; i++) {
      if (api.isActive(courses[i].id)) { active = courses[i]; break; }
    }
    if (!active) { resume.hidden = true; resume.innerHTML = ''; return; }
    var done = doneCount(active);
    resume.hidden = false;
    resume.className = 'lp-resume lp-resume--' + active.color;
    resume.innerHTML =
      '<div class="lp-resume__inner">' +
      '<div><span class="lp-resume__tag">' + esc(t('In corso')) + '</span>' +
      '<b>' + esc(active.title) + '</b>' +
      '<small>' + esc(t('{n} di {m} tappe completate', { n: done, m: active.steps.length })) + '</small></div>' +
      '<button type="button" class="lp-btn lp-btn--go" data-resume="' + escAttr(active.id) + '">' +
      esc(t('Riprendi →')) + '</button>' +
      '</div>';
  }

  function showDoneBanner(courseId) {
    var course = null;
    for (var i = 0; i < courses.length; i++) if (courses[i].id === courseId) course = courses[i];
    if (!course || !resume) return;
    resume.hidden = false;
    resume.className = 'lp-resume lp-resume--' + course.color + ' is-done';
    resume.innerHTML =
      '<div class="lp-resume__inner">' +
      '<div><span class="lp-resume__tag">' + esc(t('Completato')) + '</span>' +
      '<b>' + esc(t('Hai finito: {title}', { title: course.title })) + '</b>' +
      '<small>' + esc(course.outcome) + '</small></div>' +
      '</div>';
  }

  grid && grid.addEventListener('click', function (e) {
    var el = e.target.closest('[data-start],[data-resume],[data-reset]');
    if (!el || !api) return;
    if (el.hasAttribute('data-start')) { api.start(el.getAttribute('data-start')); return; }
    if (el.hasAttribute('data-resume')) { api.resume(el.getAttribute('data-resume')); return; }
    if (el.hasAttribute('data-reset')) {
      api.reset(el.getAttribute('data-reset'));
      render();
    }
  });

  resume && resume.addEventListener('click', function (e) {
    var el = e.target.closest('[data-resume]');
    if (el && api) api.resume(el.getAttribute('data-resume'));
  });

  render();

  // messaggio di fine percorso (?done=<id>) impostato da evil-course.js
  try {
    var params = new URLSearchParams(window.location.search);
    var finished = params.get('done');
    if (finished) {
      showDoneBanner(finished);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (e) { /* ignora */ }
})();

(function () {
  'use strict';

  const I18N = window.EVIL_I18N || null;
  const t = (text, vars) => (I18N && typeof I18N.t === 'function' ? I18N.t(text, vars) : text);
  const esc = window.EVIL_UTILS.escapeHtml;
  const grid = document.getElementById('lp-grid');
  const statsBox = document.getElementById('lp-stats');
  const lang = () => (I18N && I18N.lang ? I18N.lang : 'it');
  const pageUrl = (path) => (I18N && typeof I18N.url === 'function' ? I18N.url(path) : path);
  const ACCENTS = ['cyan', 'amber', 'green'];

  async function api(path) {
    const response = await fetch(path, { credentials: 'include', cache: 'no-store', headers: { 'X-EVIL-Lang': lang() } });
    let body = {};
    try { body = await response.json(); } catch { body = {}; }
    if (!response.ok) {
      const error = new Error(body.error || t('Richiesta non riuscita. Riprova.'));
      error.status = response.status;
      throw error;
    }
    return body;
  }

  function hours(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (!h) return t('{m} min', { m: m });
    return m ? t('{h} h {m} min', { h: h, m: m }) : t('{h} h', { h: h });
  }

  function cta(course, signedIn) {
    if (!signedIn) return t('Scopri il corso');
    if (course.diplomaCode) return t('Rivedi il corso');
    if (course.percent > 0) return t('Continua il corso');
    return t('Inizia il corso');
  }

  function card(course, index, signedIn) {
    const title = course.title[lang()] || course.title.it;
    const percent = Math.max(0, Math.min(100, Number(course.percent) || 0));
    const href = pageUrl('/course.html') + '?c=' + encodeURIComponent(course.id);
    return '<article class="lp-card lp-card--' + ACCENTS[index % ACCENTS.length] + '">' +
      '<p class="lp-card__level">' + esc(course.level) + ' · ' + esc(t('circa {time}', { time: hours(course.minutes) })) + '</p>' +
      '<h2>' + esc(title) + '</h2><p class="lp-card__desc">' + esc(course.tagline) + '</p>' +
      '<p class="lp-card__goals-title">' + esc(t('Alla fine saprai')) + '</p>' +
      '<ul class="lp-card__goals">' + course.goals.slice(0, 3).map((goal) => '<li>' + esc(goal) + '</li>').join('') + '</ul>' +
      '<p class="lp-card__meta">' + esc(t('{l} lezioni · {n} livelli · diploma verificabile', { l: course.lessonTotal, n: course.levelTotal })) + '</p>' +
      (signedIn
        ? '<div class="lp-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent + '" aria-label="' + esc(t('Avanzamento corso')) +
          '"><span class="lp-progress__bar" style="width:' + percent + '%"></span></div><p class="lp-progress__label">' +
          esc(t('{percent}% completato · {passed} di {total} livelli', { percent: percent, passed: course.levelsPassed, total: course.levelTotal })) + '</p>'
        : '') +
      '<a class="lp-btn lp-btn--go" href="' + esc(href) + '">' + esc(cta(course, signedIn)) + '</a></article>';
  }

  function renderStats(stats) {
    statsBox.hidden = false;
    statsBox.innerHTML = '<div><b>' + (stats.xp || 0) + '</b><span>' + esc(t('punti')) + '</span></div><div><b>' + (stats.streak || 0) +
      '</b><span>' + esc(t('giorni di fila')) + '</span></div>';
  }

  async function init() {
    try {
      const data = await api('/api/courses');
      grid.innerHTML = (data.courses || []).map((course, index) => card(Object.assign({ goals: course.goals || [] }, course), index, true)).join('');
      if (data.stats) renderStats(data.stats);
    } catch (error) {
      if (error.status !== 401) { grid.textContent = error.message; return; }
      try {
        const data = await api('/api/courses/catalog');
        grid.innerHTML = (data.courses || []).map((course, index) => card(course, index, false)).join('');
      } catch (inner) {
        grid.textContent = inner.message;
      }
    }
  }

  init();
})();

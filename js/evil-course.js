/**
 * Percorsi guidati ("corsi") di EVIL.
 *
 * Un corso è una sequenza di tappe: ogni tappa è una pagina del sito (con un
 * eventuale ancoraggio a una sezione) e un breve obiettivo. Quando un corso è
 * attivo, questo script mostra su ogni pagina una barra in basso che dice a che
 * punto sei e ti porta alla tappa successiva. Lo stato è salvato nel browser
 * (localStorage), così il percorso continua mentre navighi tra le pagine.
 *
 * Nessun dato lascia il browser: progressi e tappa corrente restano in locale.
 */
(function () {
  'use strict';

  var I18N = window.EVIL_I18N || null;
  function t(s, vars) {
    if (I18N && typeof I18N.t === 'function') return I18N.t(s, vars);
    if (vars) {
      return s.replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] != null ? vars[k] : m;
      });
    }
    return s;
  }
  function localize(path) {
    if (I18N && typeof I18N.url === 'function') return I18N.url(path);
    return path;
  }

  // --- Definizione dei corsi -------------------------------------------------
  // page: file della pagina · hash: sezione · goal: cosa fare qui.
  var COURSES = [
    {
      id: 'fondamenti',
      num: '01',
      color: 'cyan',
      title: t('Fondamenti'),
      level: t('Base · nessun prerequisito'),
      duration: '~3h',
      tagline: t('Parti da zero: capisci come funzionano attacchi e difese di base.'),
      outcome: t('Riconosci le vulnerabilità web più comuni e sai perché una password va protetta con un hash lento.'),
      steps: [
        {
          page: 'glossary.html',
          title: t('I termini di base'),
          goal: t('Scorri il glossario e cerca due o tre parole che non conosci: ti serviranno in tutte le tappe successive.'),
        },
        {
          page: 'crypto-studio.html',
          hash: 'cs-lab',
          title: t('Hash e password'),
          goal: t('Nel laboratorio, scrivi un messaggio e osserva il digest. Cambia un carattere e guarda l’effetto valanga.'),
        },
        {
          page: 'web-simulator.html',
          hash: 'sim-pick-title',
          title: t('La prima vulnerabilità'),
          goal: t('Scegli SQL Injection e segui le quattro fasi: contesto, bug, effetto, difesa.'),
        },
        {
          page: 'quiz-hub.html',
          title: t('Metti alla prova'),
          goal: t('Fai un quiz di una categoria di base per misurare cosa hai imparato finora.'),
        },
      ],
    },
    {
      id: 'sicurezza-web',
      num: '02',
      color: 'amber',
      title: t('Sicurezza web'),
      level: t('Intermedio · basi di web e reti'),
      duration: '~4h',
      tagline: t('Per chi sviluppa: capisci e chiudi i bug prima che lo facciano altri.'),
      outcome: t('Sai dove nasce ogni vulnerabilità nel codice e quale difesa verificabile applicare.'),
      steps: [
        {
          page: 'web-simulator.html',
          hash: 'sim-pick-title',
          title: t('Le cinque vulnerabilità'),
          goal: t('Passa in rassegna tutti e cinque gli attacchi del simulatore e leggi la difesa di ciascuno.'),
        },
        {
          page: 'virtual-lab.html',
          title: t('Prova sul campo'),
          goal: t('Scegli uno scenario web del Lab virtuale e completalo seguendo la guida passo passo.'),
        },
        {
          page: 'vulnerability-scanner.html',
          title: t('Controlla un sito'),
          goal: t('Usa l’audit degli header HTTP su un sito tuo e guarda quali protezioni mancano.'),
        },
        {
          page: 'quiz-hub.html',
          title: t('Fissa i concetti'),
          goal: t('Nel Centro quiz scegli la categoria «Sicurezza web (OWASP)».'),
        },
      ],
    },
    {
      id: 'difesa-analisi',
      num: '03',
      color: 'green',
      title: t('Difesa e analisi'),
      level: t('Intermedio · chi difende (blue team / SOC)'),
      duration: '~4h',
      tagline: t('Impara a leggere gli attacchi come un analista di un centro operativo di sicurezza.'),
      outcome: t('Sai ricostruire un incidente, riconoscere le cause ricorrenti e scrivere un report leggibile.'),
      steps: [
        {
          page: 'attacks-map.html',
          title: t('La situazione attuale'),
          goal: t('Leggi la mappa di avvisi e vulnerabilità da fonti pubbliche: cosa viene pubblicato adesso e da chi.'),
        },
        {
          page: 'historic-attacks.html',
          hash: 'ha-grid-title',
          title: t('I casi che insegnano'),
          goal: t('Scorri le violazioni storiche: per ognuna, individua la causa e la difesa che l’avrebbe fermata.'),
        },
        {
          page: 'hacked-timeline.html',
          title: t('Gestisci un incidente'),
          goal: t('Segui uno scenario minuto per minuto e osserva come un analista decide le priorità.'),
        },
        {
          page: 'report-generator.html',
          title: t('Scrivi il report'),
          goal: t('Metti in ordine i risultati in un report con la struttura usata nei team di incident response.'),
        },
      ],
    },
  ];

  var COURSE_BY_ID = {};
  COURSES.forEach(function (c) {
    COURSE_BY_ID[c.id] = c;
  });
  window.EVIL_COURSES = COURSES;

  // --- Stato persistente -----------------------------------------------------
  var ACTIVE_KEY = 'evil-course-active'; // { id, step }
  function progressKey(id) {
    return 'evil-course-done-' + id;
  }

  function readJSON(key, fallback) {
    try {
      var raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* storage non disponibile: il corso funziona solo nella pagina corrente */
    }
  }
  function removeKey(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      /* ignora */
    }
  }

  function getActive() {
    var a = readJSON(ACTIVE_KEY, null);
    if (!a || !COURSE_BY_ID[a.id]) return null;
    var course = COURSE_BY_ID[a.id];
    var step = Math.max(0, Math.min(Number(a.step) || 0, course.steps.length - 1));
    return { course: course, step: step };
  }
  function getDone(id) {
    var d = readJSON(progressKey(id), []);
    return Array.isArray(d) ? d : [];
  }
  function markDone(id, index) {
    var d = getDone(id);
    if (d.indexOf(index) === -1) {
      d.push(index);
      writeJSON(progressKey(id), d);
    }
  }
  window.EVIL_COURSE_API = {
    start: function (id) {
      if (!COURSE_BY_ID[id]) return;
      writeJSON(ACTIVE_KEY, { id: id, step: 0 });
      goToStep(COURSE_BY_ID[id], 0);
    },
    resume: function (id) {
      var course = COURSE_BY_ID[id];
      if (!course) return;
      var done = getDone(id);
      var next = 0;
      for (var i = 0; i < course.steps.length; i++) {
        if (done.indexOf(i) === -1) {
          next = i;
          break;
        }
        next = course.steps.length - 1;
      }
      writeJSON(ACTIVE_KEY, { id: id, step: next });
      goToStep(course, next);
    },
    reset: function (id) {
      removeKey(progressKey(id));
      var a = getActive();
      if (a && a.course.id === id) removeKey(ACTIVE_KEY);
    },
    getDone: getDone,
    isActive: function (id) {
      var a = getActive();
      return !!(a && a.course.id === id);
    },
  };

  // --- Navigazione -----------------------------------------------------------
  // confronta la pagina corrente con quella di una tappa, ignorando il prefisso lingua
  function currentPageFile() {
    var p = window.location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '');
    p = p.replace(/^\//, '');
    if (p === '' || p === 'index.html') return 'home.html';
    return p;
  }
  function stepUrl(step) {
    return localize('/' + step.page) + (step.hash ? '#' + step.hash : '');
  }
  function goToStep(course, index) {
    writeJSON(ACTIVE_KEY, { id: course.id, step: index });
    window.location.href = stepUrl(course.steps[index]);
  }

  // --- Interfaccia: barra del corso -----------------------------------------
  var bar = null;

  function buildBar() {
    if (bar) return bar;
    bar = document.createElement('div');
    bar.className = 'evil-course-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', t('Percorso guidato'));
    document.body.appendChild(bar);
    return bar;
  }

  function dotsHtml(course, step, done) {
    var out = '';
    for (var i = 0; i < course.steps.length; i++) {
      var cls = 'evil-course-dot';
      if (done.indexOf(i) !== -1) cls += ' is-done';
      if (i === step) cls += ' is-current';
      out +=
        '<button type="button" class="' +
        cls +
        '" data-goto="' +
        i +
        '" aria-label="' +
        escapeAttr(t('Tappa {n}: {title}', { n: i + 1, title: course.steps[i].title })) +
        '"><span>' +
        (i + 1) +
        '</span></button>';
    }
    return out;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }

  function render() {
    var active = getActive();
    var b = buildBar();
    if (!active) {
      b.classList.remove('is-visible');
      b.innerHTML = '';
      document.body.classList.remove('has-course-bar');
      return;
    }
    var course = active.course;
    var step = active.step;
    var done = getDone(course.id);
    var current = course.steps[step];
    var onThisPage = currentPageFile() === current.page;
    var isLast = step === course.steps.length - 1;
    var allDone = done.length >= course.steps.length;

    var actions = '';
    if (!onThisPage) {
      actions +=
        '<a class="evil-course-btn evil-course-btn--go" href="' +
        escapeAttr(stepUrl(current)) +
        '">' +
        t('Vai alla pagina della tappa') +
        '</a>';
    } else if (allDone) {
      actions +=
        '<button type="button" class="evil-course-btn evil-course-btn--go" data-finish="1">' +
        t('Concludi il percorso') +
        '</button>';
    } else if (isLast) {
      actions +=
        '<button type="button" class="evil-course-btn evil-course-btn--go" data-done-finish="1">' +
        t('Ho finito · concludi') +
        '</button>';
    } else {
      actions +=
        '<button type="button" class="evil-course-btn evil-course-btn--go" data-next="1">' +
        t('Fatto · tappa successiva →') +
        '</button>';
    }

    b.className = 'evil-course-bar is-visible evil-course-bar--' + course.color;
    b.innerHTML =
      '<div class="evil-course-bar__inner">' +
      '<div class="evil-course-bar__head">' +
      '<span class="evil-course-bar__tag">' +
      escapeHtml(t('Percorso')) +
      '</span>' +
      '<span class="evil-course-bar__name">' +
      escapeHtml(course.title) +
      '</span>' +
      '<span class="evil-course-bar__count">' +
      escapeHtml(t('Tappa {n} di {m}', { n: step + 1, m: course.steps.length })) +
      '</span>' +
      '<button type="button" class="evil-course-bar__exit" data-exit="1" aria-label="' +
      escapeAttr(t('Esci dal percorso')) +
      '">' +
      t('Esci') +
      '</button>' +
      '</div>' +
      '<div class="evil-course-bar__body">' +
      '<div class="evil-course-dots">' +
      dotsHtml(course, step, done) +
      '</div>' +
      '<div class="evil-course-bar__step">' +
      '<strong>' +
      escapeHtml(current.title) +
      '</strong>' +
      '<span>' +
      escapeHtml(current.goal) +
      '</span>' +
      '</div>' +
      '<div class="evil-course-bar__actions">' +
      (step > 0
        ? '<button type="button" class="evil-course-btn evil-course-btn--back" data-prev="1">' +
          t('← Indietro') +
          '</button>'
        : '') +
      actions +
      '</div>' +
      '</div>' +
      '</div>';
    document.body.classList.add('has-course-bar');
  }

  function onBarClick(e) {
    var active = getActive();
    if (!active) return;
    var course = active.course;
    var step = active.step;
    var el = e.target.closest('[data-goto],[data-next],[data-prev],[data-exit],[data-finish],[data-done-finish]');
    if (!el) return;

    if (el.hasAttribute('data-exit')) {
      removeKey(ACTIVE_KEY);
      render();
      return;
    }
    if (el.hasAttribute('data-prev')) {
      goToStep(course, Math.max(0, step - 1));
      return;
    }
    if (el.hasAttribute('data-next')) {
      markDone(course.id, step);
      goToStep(course, Math.min(course.steps.length - 1, step + 1));
      return;
    }
    if (el.hasAttribute('data-done-finish')) {
      markDone(course.id, step);
      finishCourse(course);
      return;
    }
    if (el.hasAttribute('data-finish')) {
      finishCourse(course);
      return;
    }
    if (el.hasAttribute('data-goto')) {
      var idx = Number(el.getAttribute('data-goto'));
      goToStep(course, idx);
    }
  }

  function finishCourse(course) {
    removeKey(ACTIVE_KEY);
    if (window.progressManager && typeof window.progressManager.logActivity === 'function') {
      window.progressManager.logActivity('course_completed', { courseId: course.id });
    }
    window.location.href = localize('/learning-paths.html') + '?done=' + encodeURIComponent(course.id);
  }

  function boot() {
    buildBar().addEventListener('click', onBarClick);
    render();
    // se lo stato cambia in un'altra scheda, aggiorna la barra
    window.addEventListener('storage', function (e) {
      if (e.key === ACTIVE_KEY) render();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

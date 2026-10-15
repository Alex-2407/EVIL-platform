(function () {
  'use strict';

  var I18N = window.EVIL_I18N || null;
  var t = function (text, vars) {
    return I18N && typeof I18N.t === 'function' ? I18N.t(text, vars) : text;
  };
  var esc = window.EVIL_UTILS.escapeHtml;
  var grid = document.getElementById('lp-grid');
  var panel = document.getElementById('lp-course');
  var activeCourse = null;
  var activeModuleId = null;
  var activeLesson = null;
  var lastQuizResult = null;
  var busy = false;

  function apiLanguage() {
    return I18N && I18N.lang ? I18N.lang : 'it';
  }

  async function api(path, options) {
    var response = await fetch(path, Object.assign({
      credentials: 'include',
      cache: 'no-store',
      headers: { 'X-EVIL-Lang': apiLanguage() },
    }, options || {}));
    var body = await response.json();
    if (!response.ok) {
      var error = new Error(body.error || t('Richiesta non riuscita. Riprova.'));
      error.status = response.status;
      error.code = body.code;
      throw error;
    }
    return body;
  }

  function loginLink() {
    var returnTo = window.location.pathname + window.location.search;
    var login = I18N && typeof I18N.url === 'function' ? I18N.url('/login.html') : '/login.html';
    return login + '?redirect=' + encodeURIComponent(returnTo);
  }

  function statusMessage(text, isError) {
    var status = document.getElementById('lp-status');
    if (!status) return;
    status.textContent = text;
    status.dataset.state = isError ? 'error' : '';
  }

  function renderCourseCards(courses) {
    if (!courses.length) {
      grid.textContent = t('Nessun corso disponibile.');
      return;
    }
    grid.innerHTML = courses.map(function (course, index) {
      var percent = Math.max(0, Math.min(100, Number(course.percent) || 0));
      var courseTitle = I18N && I18N.lang === 'en' ? course.title.en : course.title.it;
      return '<article class="lp-card lp-card--' + ['cyan', 'amber', 'green'][index % 3] + '">' +
        '<p class="lp-card__level">' + esc(course.level) + '</p>' +
        '<h2>' + esc(courseTitle) + '</h2>' +
        '<p class="lp-card__desc">' + esc(course.description) + '</p>' +
        '<div class="lp-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + percent +
        '" aria-label="' + esc(t('Avanzamento corso')) + '"><span class="lp-progress__bar" style="width:' + percent + '%"></span></div>' +
        '<p class="lp-progress__label">' + esc(t('{percent}% completato · {passed} di {total} moduli', {
          percent: percent, passed: course.modulesPassed, total: course.moduleTotal,
        })) + '</p>' +
        '<p class="lp-card__goal"><strong>' + esc(t('Alla fine:')) + '</strong> ' + esc(course.outcome) + '</p>' +
        '<button class="lp-btn lp-btn--go" type="button" data-open-course="' + esc(course.id) + '">' +
        esc(t('Apri il corso')) + '</button></article>';
    }).join('');
  }

  function stateLabel(module) {
    if (module.passed) return t('Superato');
    if (!module.unlocked) return t('Bloccato');
    return t('In corso');
  }

  function renderModuleIndex(course) {
    return '<nav class="lp-module-index" aria-label="' + esc(t('Indice dei moduli')) + '">' +
      '<h3>' + esc(t('Moduli del corso')) + '</h3>' +
      '<ol>' + course.modules.map(function (module, index) {
        var first = module.lessons[0];
        var disabled = !module.unlocked || !first;
        return '<li class="lp-module-index__item' + (module.passed ? ' is-passed' : '') + (!module.unlocked ? ' is-locked' : '') + '">' +
          '<button type="button" data-open-lesson="' + esc(module.id) + '" data-lesson-id="' + esc(first ? first.id : '') +
          '" aria-describedby="lp-module-state-' + esc(module.id) + '"' + (disabled ? ' disabled' : '') + '>' +
          '<span class="lp-module-index__number">' + (index + 1) + '</span><span class="lp-module-index__text"><b>' +
          esc(module.title) + '</b><small id="lp-module-state-' + esc(module.id) + '">' + esc(stateLabel(module)) +
          (module.score == null ? '' : ' · ' + esc(t('{score}% al test', { score: module.score }))) + '</small></span></button>' +
          '<ol class="lp-module-index__lessons">' + module.lessons.map(function (lesson) {
            return '<li><button type="button" data-open-lesson="' + esc(module.id) + '" data-lesson-id="' + esc(lesson.id) +
              '"' + (!module.unlocked ? ' disabled' : '') + '>' + (lesson.done ? '✓ ' : '') + esc(lesson.title) + '</button></li>';
          }).join('') + '</ol>' +
          (module.unlocked ? '<button type="button" class="lp-quiz-launch" data-open-quiz="' + esc(module.id) +
            '"' + (!module.lessonsComplete ? ' disabled' : '') + '>' + esc(module.passed ? t('Rivedi il test') : t('Test del modulo')) +
            '</button>' : '') +
          '</li>';
      }).join('') + '</ol></nav>';
  }

  function renderCourse(course) {
    activeCourse = course;
    panel.hidden = false;
    grid.hidden = true;
    var percentage = Math.max(0, Math.min(100, Number(course.percent) || 0));
    var courseTitle = I18N && I18N.lang === 'en' ? course.title.en : course.title.it;
    panel.innerHTML = '<div class="lp-course__toolbar"><button class="lp-btn lp-btn--ghost" type="button" data-course-back>' +
      esc(t('Tutti i corsi')) + '</button><span class="lp-course__level">' + esc(course.level) + '</span></div>' +
      '<header class="lp-course__header"><h2 id="lp-course-title">' + esc(courseTitle) + '</h2><p>' +
      esc(course.description) + '</p><div class="lp-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
      percentage + '" aria-label="' + esc(t('Avanzamento corso')) + '"><span class="lp-progress__bar" style="width:' + percentage +
      '%"></span></div><p class="lp-progress__label">' + esc(t('{percent}% completato', { percent: percentage })) + '</p></header>' +
      '<div class="lp-course__layout">' + renderModuleIndex(course) +
      '<section class="lp-study" aria-label="' + esc(t('Contenuto del corso')) + '">' +
      '<div id="lp-study-content"><p class="lp-study__empty">' + esc(t('Scegli un modulo per iniziare.')) + '</p></div>' +
      '<div id="lp-quiz-feedback" aria-live="polite"></div>' +
      '<div id="lp-exam" class="lp-exam" aria-live="polite"></div></section></div>' +
      '<p id="lp-status" class="lp-status" role="status" aria-live="polite"></p>';
    if (lastQuizResult && lastQuizResult.moduleId) showQuizFeedback(lastQuizResult.moduleId, lastQuizResult.result);
    if (course.examUnlocked) {
      var examButton = document.createElement('button');
      examButton.type = 'button';
      examButton.className = 'lp-btn lp-btn--go lp-final-exam';
      examButton.dataset.startExam = course.id;
      examButton.textContent = t('Esame finale');
      document.getElementById('lp-exam').appendChild(examButton);
    }
  }

  async function openCourse(courseId) {
    if (busy) return;
    busy = true;
    grid.setAttribute('aria-busy', 'true');
    try {
      var data = await api('/api/courses/' + encodeURIComponent(courseId));
      activeModuleId = null;
      activeLesson = null;
      lastQuizResult = null;
      renderCourse(data.course);
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      if (error.status === 401) window.location.href = loginLink();
      else {
        grid.textContent = error.message;
        grid.setAttribute('role', 'alert');
      }
    } finally {
      busy = false;
      grid.removeAttribute('aria-busy');
    }
  }

  function renderLesson(data) {
    var lesson = data.lesson;
    var module = activeCourse.modules.find(function (item) { return item.id === data.moduleId; });
    activeModuleId = data.moduleId;
    activeLesson = lesson.id;
    var lessonIndex = module.lessons.findIndex(function (item) { return item.id === lesson.id; });
    var previous = lessonIndex > 0 ? module.lessons[lessonIndex - 1] : null;
    var next = lessonIndex + 1 < module.lessons.length ? module.lessons[lessonIndex + 1] : null;
    var keyPoints = lesson.keyPoints.map(function (point) { return '<li>' + esc(point) + '</li>'; }).join('');
    document.getElementById('lp-study-content').innerHTML =
      '<article class="lp-lesson"><p class="lp-kicker">' + esc(module.title) + ' · ' +
      esc(t('Lezione {current} di {total}', { current: lessonIndex + 1, total: module.lessons.length })) + '</p>' +
      '<h3>' + esc(lesson.title) + '</h3><p class="lp-lesson__objective"><strong>' + esc(t('Obiettivo')) +
      '</strong> ' + esc(lesson.objective) + '</p><h4>' + esc(t('Spiegazione')) + '</h4><p>' + esc(lesson.explanation) +
      '</p><h4>' + esc(t('Esempio difensivo')) + '</h4><p class="lp-lesson__example">' + esc(lesson.example) +
      '</p><h4>' + esc(t('Errori comuni')) + '</h4><p>' + esc(lesson.commonMistakes) +
      '</p><h4>' + esc(t('Punti chiave')) + '</h4><ul>' + keyPoints + '</ul>' +
      '<div class="lp-lesson__actions"><button class="lp-btn lp-btn--ghost" type="button" data-prev-lesson="' +
      esc(module.id) + '" data-lesson-id="' + esc(previous ? previous.id : '') + '"' + (!previous ? ' disabled' : '') +
      '>' + esc(t('Precedente')) + '</button>' +
      '<button class="lp-btn lp-btn--go" type="button" data-complete-lesson="' + esc(module.id) + '" data-lesson-id="' +
      esc(lesson.id) + '"' + (lesson.done ? ' disabled' : '') + '>' + esc(lesson.done ? t('Lezione completata') : t('Completa la lezione')) + '</button>' +
      '<button class="lp-btn lp-btn--ghost" type="button" data-next-lesson="' + esc(module.id) + '" data-lesson-id="' +
      esc(next ? next.id : '') + '"' + (!next || !lesson.done ? ' disabled' : '') + '>' + esc(t('Successiva')) + '</button></div>' +
      '<p class="lp-lesson__progress">' + esc(t('Avanzamento: {done} di {total} lezioni', {
        done: module.lessons.filter(function (entry) { return entry.done; }).length + (lesson.done ? 0 : 1),
        total: module.lessonCount,
      })) + '</p></article>';
    document.getElementById('lp-quiz-feedback').replaceChildren();
    document.getElementById('lp-study-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function openLesson(moduleId, lessonId) {
    try {
      var data = await api('/api/courses/' + encodeURIComponent(activeCourse.id) + '/lessons/' + encodeURIComponent(lessonId));
      renderLesson(data);
    } catch (error) {
      statusMessage(error.message, true);
    }
  }

  async function completeLesson(moduleId, lessonId) {
    try {
      var data = await api('/api/courses/' + encodeURIComponent(activeCourse.id) + '/lessons/' + encodeURIComponent(lessonId) + '/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-EVIL-Lang': apiLanguage() },
        body: '{}',
      });
      var currentModule = activeCourse.modules.find(function (item) { return item.id === moduleId; });
      var position = currentModule.lessons.findIndex(function (entry) { return entry.id === lessonId; });
      activeCourse = data.course;
      lastQuizResult = null;
      renderCourse(activeCourse);
      var updatedModule = activeCourse.modules.find(function (item) { return item.id === moduleId; });
      var next = updatedModule.lessons[position + 1];
      if (next) await openLesson(moduleId, next.id);
      else openQuiz(moduleId);
      statusMessage(t('Progresso salvato.'), false);
    } catch (error) {
      statusMessage(error.message, true);
    }
  }

  function renderQuiz(moduleId) {
    var module = activeCourse.modules.find(function (item) { return item.id === moduleId; });
    if (!module || !module.unlocked || !module.lessonsComplete || !module.quiz.length) {
      statusMessage(t('Completa le lezioni del modulo per sbloccare il test.'), true);
      return;
    }
    activeModuleId = moduleId;
    activeLesson = null;
    document.getElementById('lp-study-content').innerHTML =
      '<section class="lp-quiz"><p class="lp-kicker">' + esc(module.title) + '</p><h3>' + esc(t('Test del modulo')) +
      '</h3><p>' + esc(t('Rispondi a tutte le domande. Per superare il test serve almeno il 70%.')) + '</p>' +
      '<form data-quiz-module="' + esc(moduleId) + '">' + module.quiz.map(function (question, index) {
        return '<fieldset class="lp-exam__question"><legend>' + (index + 1) + '. ' + esc(question.prompt) + '</legend>' +
          question.options.map(function (option, optionIndex) {
            var id = 'lp-quiz-' + question.id + '-' + optionIndex;
            return '<label class="lp-exam__option" for="' + esc(id) + '"><input required type="radio" id="' + esc(id) +
              '" name="' + esc(question.id) + '" value="' + optionIndex + '"><span>' + esc(option) + '</span></label>';
          }).join('') + '</fieldset>';
      }).join('') + '<button class="lp-btn lp-btn--go" type="submit">' + esc(t('Invia il test')) + '</button></form>' +
      '<div id="lp-quiz-feedback" aria-live="polite"></div></section>';
    document.getElementById('lp-study-content').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function showQuizFeedback(moduleId, result) {
    var module = activeCourse && activeCourse.modules.find(function (item) { return item.id === moduleId; });
    var mount = document.getElementById('lp-quiz-feedback');
    if (!module || !mount) return;
    var title = result.passed ? t('Modulo superato') : t('Test non superato');
    mount.innerHTML = '<section class="lp-feedback" role="status"><h4>' + esc(title) + ' · ' +
      esc(t('{score}%', { score: result.score })) + '</h4><ol>' + result.feedback.map(function (item) {
        var question = module.quiz.find(function (entry) { return entry.id === item.id; });
        var correct = question.options[item.correctOptionIndex];
        return '<li><b>' + esc(item.prompt) + '</b><p class="' + (item.isCorrect ? 'is-correct' : 'is-incorrect') + '">' +
          esc(item.isCorrect ? t('Risposta corretta') : t('Risposta corretta: {answer}', { answer: correct })) +
          '</p><p>' + esc(item.explanation) + '</p></li>';
      }).join('') + '</ol></section>';
  }

  async function submitQuiz(form) {
    var moduleId = form.dataset.quizModule;
    var module = activeCourse.modules.find(function (item) { return item.id === moduleId; });
    var answers = {};
    for (var index = 0; index < module.quiz.length; index += 1) {
      var question = module.quiz[index];
      var selected = form.querySelector('input[name="' + CSS.escape(question.id) + '"]:checked');
      if (!selected) {
        statusMessage(t('Completa tutte le risposte prima di inviare.'), true);
        form.querySelector('fieldset:nth-of-type(' + (index + 1) + ')').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      answers[question.id] = Number(selected.value);
    }
    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      var result = await api('/api/courses/' + encodeURIComponent(activeCourse.id) + '/modules/' +
        encodeURIComponent(moduleId) + '/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-EVIL-Lang': apiLanguage() },
        body: JSON.stringify({ answers: answers }),
      });
      activeCourse = result.course;
      lastQuizResult = { moduleId: moduleId, result: result };
      renderCourse(activeCourse);
      showQuizFeedback(moduleId, result);
      if (!result.passed) statusMessage(t('Puoi ripetere il test dopo aver rivisto le lezioni.'), false);
      else statusMessage(t('Modulo superato. Il modulo successivo è sbloccato.'), false);
    } catch (error) {
      statusMessage(error.message, true);
      button.disabled = false;
    }
  }

  function examMessage(message, isError) {
    var mount = document.getElementById('lp-exam');
    if (!mount) return;
    mount.innerHTML = '<p class="lp-exam__message' + (isError ? ' is-error' : '') + '" role="status" aria-live="polite">' +
      esc(message) + '</p>';
  }

  function renderExam(courseId, exam) {
    var mount = document.getElementById('lp-exam');
    var questions = exam.questions.map(function (question, index) {
      return '<fieldset class="lp-exam__question"><legend>' + (index + 1) + '. ' + esc(question.question) + '</legend>' +
        question.options.map(function (option, optionIndex) {
          var id = 'lp-final-' + question.id + '-' + optionIndex;
          return '<label class="lp-exam__option" for="' + esc(id) + '"><input required type="radio" id="' + esc(id) +
            '" name="' + esc(question.id) + '" value="' + optionIndex + '"><span>' + esc(option) + '</span></label>';
        }).join('') + '</fieldset>';
    }).join('');
    mount.innerHTML = '<section class="lp-exam__panel"><h3>' + esc(t('Esame finale: {title}', { title: exam.courseTitle })) +
      '</h3><p>' + esc(t('Rispondi a tutte le domande. Superi l’esame con almeno {score}%.', { score: exam.passScore })) +
      '</p><p class="lp-exam__timer">' + esc(t('Hai 30 minuti per completarlo.')) + '</p>' +
      '<form data-exam-submit="' + esc(courseId) + '" data-attempt="' + esc(exam.attemptId) + '">' +
      questions + '<button type="submit" class="lp-btn lp-btn--go">' + esc(t('Invia le risposte')) + '</button></form></section>';
    mount.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function startExam(courseId) {
    if (!activeCourse || !activeCourse.examUnlocked) {
      statusMessage(t('Completa tutti i moduli per sbloccare l’esame finale.'), true);
      return;
    }
    examMessage(t('Preparazione dell’esame…'), false);
    try {
      var result = await api('/api/courses/' + encodeURIComponent(courseId) + '/exam/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-EVIL-Lang': apiLanguage() },
        body: '{}',
      });
      if (result.completed && result.certificate) {
        var diplomaPath = I18N && typeof I18N.url === 'function' ? I18N.url('/diploma.html') : '/diploma.html';
        document.getElementById('lp-exam').innerHTML =
          '<p class="lp-exam__message">' + esc(t('Hai già ottenuto il diploma.')) + '</p><a class="lp-btn lp-btn--go" href="' +
          esc(diplomaPath + '?c=' + encodeURIComponent(result.certificate.code)) + '">' + esc(t('Apri il diploma')) + '</a>';
      } else renderExam(courseId, result);
    } catch (error) {
      if (error.status === 401) window.location.href = loginLink();
      else examMessage(error.message, true);
    }
  }

  async function submitExam(form) {
    var fields = Array.from(form.querySelectorAll('.lp-exam__question'));
    var answers = {};
    for (var index = 0; index < fields.length; index += 1) {
      var selected = fields[index].querySelector('input[type="radio"]:checked');
      if (!selected) {
        examMessage(t('Completa tutte le risposte prima di inviare.'), true);
        fields[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      answers[selected.name] = Number(selected.value);
    }
    var button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    examMessage(t('Verifica delle risposte…'), false);
    try {
      var result = await api('/api/courses/' + encodeURIComponent(form.dataset.examSubmit) + '/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-EVIL-Lang': apiLanguage() },
        body: JSON.stringify({ attemptId: form.dataset.attempt, answers: answers }),
      });
      if (result.passed && result.certificate) {
        var diplomaPath = I18N && typeof I18N.url === 'function' ? I18N.url('/diploma.html') : '/diploma.html';
        document.getElementById('lp-exam').innerHTML =
          '<p class="lp-exam__message">' + esc(t('Esame superato: {score}%. Il diploma verificabile è pronto.', {
            score: result.score,
          })) + '</p><a class="lp-btn lp-btn--go" href="' + esc(diplomaPath + '?c=' +
            encodeURIComponent(result.certificate.code)) + '">' + esc(t('Apri il diploma')) + '</a>';
      } else {
        examMessage(t('Esame non superato: {score}%. Serve almeno {required}%.', {
          score: result.score, required: result.passScore,
        }), true);
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'lp-btn lp-btn--go';
        retry.dataset.startExam = form.dataset.examSubmit;
        retry.textContent = t('Riprova l’esame');
        document.getElementById('lp-exam').appendChild(retry);
      }
    } catch (error) {
      examMessage(error.message, true);
      button.disabled = false;
    }
  }

  function openQuiz(moduleId) {
    renderQuiz(moduleId);
  }

  panel.addEventListener('click', function (event) {
    var button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-course-back')) {
      panel.hidden = true;
      grid.hidden = false;
      return;
    }
    if (button.hasAttribute('data-open-lesson')) {
      openLesson(button.dataset.openLesson, button.dataset.lessonId);
    } else if (button.hasAttribute('data-complete-lesson')) {
      completeLesson(button.dataset.completeLesson, button.dataset.lessonId);
    } else if (button.hasAttribute('data-prev-lesson') || button.hasAttribute('data-next-lesson')) {
      openLesson(button.dataset.prevLesson || button.dataset.nextLesson, button.dataset.lessonId);
    } else if (button.hasAttribute('data-open-quiz')) {
      openQuiz(button.dataset.openQuiz);
    } else if (button.hasAttribute('data-start-exam')) {
      startExam(button.dataset.startExam);
    }
  });

  panel.addEventListener('submit', function (event) {
    var quizForm = event.target.closest('[data-quiz-module]');
    var examForm = event.target.closest('[data-exam-submit]');
    if (!quizForm && !examForm) return;
    event.preventDefault();
    if (quizForm) submitQuiz(quizForm);
    else submitExam(examForm);
  });

  grid.addEventListener('click', function (event) {
    var button = event.target.closest('[data-open-course]');
    if (button) openCourse(button.dataset.openCourse);
  });

  async function init() {
    try {
      var result = await api('/api/courses');
      renderCourseCards(result.courses || []);
    } catch (error) {
      if (error.status === 401) {
        grid.innerHTML = '<p class="lp-loading">' + esc(t('Accedi per seguire i corsi e salvare i progressi.')) +
          ' <a href="' + esc(loginLink()) + '">' + esc(t('Accedi')) + '</a></p>';
      } else grid.textContent = error.message;
    }
  }

  init();
})();

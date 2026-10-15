'use strict';

const crypto = require('crypto');
const exams = require('../lib/course-exams');
const content = require('../lib/course-content');
const engine = require('../lib/course-engine');
const certificates = require('../lib/certificates');

const ATTEMPT_TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS_STORED = 10;
const PASS_SCORE = engine.PASS_SCORE;
const t = (s) => s;

function shuffle(length) {
  const result = Array.from({ length }, (_, i) => i);
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function questionPayload(course, answerOrder, req) {
  const data = exams.publicCourse(course, req.lang, (text) => req.t(t(text)));
  return data.questions.map((question) => ({
    ...question,
    options: answerOrder[question.id].map((i) => question.options[i]),
  }));
}

async function saveOrFail(db, user, logger, req, res, message, code, meta) {
  try {
    await db.save(user);
    return true;
  } catch (err) {
    logger.error('Course progress save failed', { error: err.message, userId: user.id, ...meta });
    res.status(500).json({ error: req.t(message), code });
    return false;
  }
}

module.exports = function registerCourses(app, ctx) {
  const { db, logger, authenticateToken, courseExamLimiter, courseContentLimiter } = ctx;

  /** Corso dal parametro, oppure null dopo aver risposto 404. */
  function courseOr404(req, res) {
    const course = content.getCourse(req.params.courseId);
    if (!course) {
      res.status(404).json({ error: req.t(t('Corso non trovato.')), code: 'COURSE_NOT_FOUND' });
      return null;
    }
    return course;
  }

  /** Livello dal parametro, oppure null dopo aver risposto 404/403. */
  function levelOr404(req, res, course) {
    const index = course.modules.findIndex((item) => item.id === req.params.moduleId);
    if (index < 0) {
      res.status(404).json({ error: req.t(t('Livello non trovato.')), code: 'MODULE_NOT_FOUND' });
      return null;
    }
    return { module: course.modules[index], index };
  }

  function locked(req, res, message, code) {
    res.status(403).json({ error: req.t(message), code });
    return null;
  }

  // Programma pubblico: serve anche a chi non ha ancora un account.
  app.get('/api/courses/catalog', courseContentLimiter, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ courses: content.COURSES.map((course) => engine.catalogEntry(course, req)) });
  });

  app.get('/api/courses', authenticateToken, courseContentLimiter, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      courses: content.COURSES.map((course) => engine.summary(course, req.userRecord, req)),
      stats: { xp: engine.totalXp(req.userRecord), streak: engine.streakOf(req.userRecord) },
    });
  });

  app.get('/api/courses/:courseId', authenticateToken, courseContentLimiter, (req, res) => {
    const course = courseOr404(req, res);
    if (!course) return undefined;
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ course: engine.detail(course, req.userRecord, req) });
  });

  app.get('/api/courses/:courseId/lessons/:lessonId', authenticateToken, courseContentLimiter, (req, res) => {
    const course = courseOr404(req, res);
    if (!course) return undefined;
    const found = engine.findLesson(course, req.params.lessonId);
    if (!found) return res.status(404).json({ error: req.t(t('Lezione non trovata.')), code: 'LESSON_NOT_FOUND' });
    const progress = engine.progressFor(req.userRecord, course.id);
    if (!engine.levelUnlocked(course, progress, found.moduleIndex)) {
      return locked(req, res, t('Supera il livello precedente per sbloccare questa lezione.'), 'COURSE_MODULE_LOCKED');
    }
    if (!engine.lessonOpen(course, progress, found.moduleIndex, found.lessonIndex)) {
      return locked(req, res, t('Completa prima le lezioni precedenti di questo livello.'), 'COURSE_LESSON_LOCKED');
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json(engine.lessonPayload(course, req.userRecord, found, req));
  });

  // Verifica immediata di una lezione. Con recall:true è una domanda di ripasso: non cambia il progresso.
  app.post('/api/courses/:courseId/lessons/:lessonId/check', authenticateToken, courseContentLimiter, async (req, res) => {
    const course = courseOr404(req, res);
    if (!course) return undefined;
    const found = engine.findLesson(course, req.params.lessonId);
    if (!found) return res.status(404).json({ error: req.t(t('Lezione non trovata.')), code: 'LESSON_NOT_FOUND' });
    const user = req.userRecord;
    const progress = engine.progressFor(user, course.id);
    const recall = req.body && req.body.recall === true;
    const open = recall
      ? progress.lessonsDone.includes(found.lesson.id)
      : engine.lessonOpen(course, progress, found.moduleIndex, found.lessonIndex);
    if (!open) return locked(req, res, t('Questa lezione non è ancora disponibile.'), 'COURSE_LESSON_LOCKED');
    const answer = req.body && req.body.answer;
    const result = engine.gradeCheck(course.id, found, answer, req);
    if (!result) return res.status(400).json({ error: req.t(t('Seleziona una risposta valida.')), code: 'COURSE_CHECK_INVALID' });
    let earned = 0;
    if (result.correct && !recall && !progress.checksDone.includes(found.lesson.id)) {
      progress.checksDone.push(found.lesson.id);
      engine.saveProgress(user, course.id, progress);
      earned = engine.XP.check;
      if (!await saveOrFail(db, user, logger, req, res, t('Impossibile salvare i progressi del corso. Riprova.'), 'COURSE_PROGRESS_SAVE_FAILED', { courseId: course.id })) return undefined;
    }
    return res.json({ correct: result.correct, why: result.why, xp: earned });
  });

  app.post('/api/courses/:courseId/lessons/:lessonId/complete', authenticateToken, courseContentLimiter, async (req, res) => {
    const course = courseOr404(req, res);
    if (!course) return undefined;
    const found = engine.findLesson(course, req.params.lessonId);
    if (!found) return res.status(404).json({ error: req.t(t('Lezione non trovata.')), code: 'LESSON_NOT_FOUND' });
    const user = req.userRecord;
    const progress = engine.progressFor(user, course.id);
    if (!engine.lessonOpen(course, progress, found.moduleIndex, found.lessonIndex)) {
      return locked(req, res, t('Completa prima le lezioni precedenti di questo livello.'), 'COURSE_LESSON_LOCKED');
    }
    if (!progress.checksDone.includes(found.lesson.id)) {
      return locked(req, res, t('Rispondi correttamente alla verifica per completare la lezione.'), 'COURSE_CHECK_REQUIRED');
    }
    let earned = 0;
    if (!progress.lessonsDone.includes(found.lesson.id)) {
      progress.lessonsDone.push(found.lesson.id);
      earned = engine.XP.lesson;
    }
    engine.saveProgress(user, course.id, progress);
    if (!await saveOrFail(db, user, logger, req, res, t('Impossibile salvare i progressi del corso. Riprova.'), 'COURSE_PROGRESS_SAVE_FAILED', { courseId: course.id })) return undefined;
    return res.json({ completed: true, xp: earned, course: engine.detail(course, user, req) });
  });

  app.get('/api/courses/:courseId/levels/:moduleId/lab', authenticateToken, courseContentLimiter, (req, res) => {
    const course = courseOr404(req, res);
    if (!course) return undefined;
    const level = levelOr404(req, res, course);
    if (!level) return undefined;
    const progress = engine.progressFor(req.userRecord, course.id);
    if (!engine.levelUnlocked(course, progress, level.index) || !engine.lessonsComplete(progress, level.module)) {
      return locked(req, res, t('Completa tutte le lezioni del livello per aprire il laboratorio.'), 'COURSE_LESSONS_INCOMPLETE');
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ lab: engine.labPayload(course.id, level.module, req) });
  });

  app.post('/api/courses/:courseId/levels/:moduleId/lab/submit', authenticateToken, courseContentLimiter, async (req, res) => {
    const course = courseOr404(req, res);
    if (!course) return undefined;
    const level = levelOr404(req, res, course);
    if (!level) return undefined;
    const user = req.userRecord;
    const progress = engine.progressFor(user, course.id);
    if (!engine.levelUnlocked(course, progress, level.index) || !engine.lessonsComplete(progress, level.module)) {
      return locked(req, res, t('Completa tutte le lezioni del livello per aprire il laboratorio.'), 'COURSE_LESSONS_INCOMPLETE');
    }
    const graded = engine.gradeLab(course.id, level.module, req.body && req.body.answers, req);
    if (!graded) return res.status(400).json({ error: req.t(t('Completa il laboratorio prima di inviarlo.')), code: 'COURSE_LAB_INVALID' });
    const wasPassed = engine.labPassed(progress, level.module);
    progress.labScores[level.module.id] = Math.max(Number(progress.labScores[level.module.id]) || 0, graded.score);
    engine.saveProgress(user, course.id, progress);
    if (!await saveOrFail(db, user, logger, req, res, t('Impossibile salvare il risultato. Riprova.'), 'COURSE_LAB_SAVE_FAILED', { courseId: course.id })) return undefined;
    const feedback = engine.labFeedback(course.id, level.module, graded, req);
    return res.json({ ...feedback, xp: feedback.passed && !wasPassed ? engine.XP.lab : 0, course: engine.detail(course, user, req) });
  });

  app.get('/api/courses/:courseId/levels/:moduleId/quiz', authenticateToken, courseContentLimiter, (req, res) => {
    const course = courseOr404(req, res);
    if (!course) return undefined;
    const level = levelOr404(req, res, course);
    if (!level) return undefined;
    const progress = engine.progressFor(req.userRecord, course.id);
    if (!engine.levelUnlocked(course, progress, level.index) || !engine.lessonsComplete(progress, level.module) || !engine.labPassed(progress, level.module)) {
      return locked(req, res, t('Supera il laboratorio del livello per aprire il test.'), 'COURSE_LAB_REQUIRED');
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ passScore: PASS_SCORE, questions: engine.quizPayload(level.module, req) });
  });

  app.post('/api/courses/:courseId/levels/:moduleId/quiz/submit', authenticateToken, courseContentLimiter, async (req, res) => {
    const course = courseOr404(req, res);
    if (!course) return undefined;
    const level = levelOr404(req, res, course);
    if (!level) return undefined;
    const user = req.userRecord;
    const progress = engine.progressFor(user, course.id);
    if (!engine.levelUnlocked(course, progress, level.index) || !engine.lessonsComplete(progress, level.module) || !engine.labPassed(progress, level.module)) {
      return locked(req, res, t('Supera il laboratorio del livello per aprire il test.'), 'COURSE_LAB_REQUIRED');
    }
    const graded = engine.gradeQuiz(level.module, req.body && req.body.answers, req);
    if (!graded) return res.status(400).json({ error: req.t(t('Seleziona una risposta valida per ogni domanda.')), code: 'COURSE_QUIZ_INVALID' });
    const wasPassed = engine.quizPassed(progress, level.module);
    progress.moduleScores[level.module.id] = Math.max(Number(progress.moduleScores[level.module.id]) || 0, graded.score);
    engine.saveProgress(user, course.id, progress);
    if (!await saveOrFail(db, user, logger, req, res, t('Impossibile salvare il risultato del test. Riprova.'), 'COURSE_QUIZ_SAVE_FAILED', { courseId: course.id, moduleId: level.module.id })) return undefined;
    const detail = engine.detail(course, user, req);
    const levelNow = detail.levels.find((item) => item.id === level.module.id);
    return res.json({
      ...graded,
      xp: graded.passed && !wasPassed ? engine.XP.quiz : 0,
      levelCompleted: Boolean(levelNow && levelNow.passed),
      skill: levelNow && levelNow.passed ? levelNow.skill : '',
      course: detail,
    });
  });

  app.post('/api/courses/:courseId/exam/start', authenticateToken, courseExamLimiter, async (req, res) => {
    const course = exams.getCourse(req.params.courseId);
    if (!course) return res.status(404).json({ error: req.t(t('Corso non trovato.')), code: 'COURSE_NOT_FOUND' });

    const user = req.userRecord;
    const existing = (user.certificates || []).find((certificate) => certificate.courseId === req.params.courseId);
    if (existing) {
      return res.json({
        completed: true,
        certificate: certificates.publicCertificate(existing, req.lang),
        diplomaUrl: `/diploma.html?c=${encodeURIComponent(existing.code)}`,
      });
    }
    if (!engine.courseComplete(content.getCourse(req.params.courseId), engine.progressFor(user, req.params.courseId))) {
      return res.status(403).json({ error: req.t(t('Completa tutti i livelli per sbloccare l’esame finale.')), code: 'COURSE_NOT_COMPLETED' });
    }

    const now = Date.now();
    user.courseExamAttempts = Array.isArray(user.courseExamAttempts) ? user.courseExamAttempts : [];
    user.courseExamAttempts = user.courseExamAttempts.filter((attempt) => {
      if (attempt.courseId !== req.params.courseId) return now - Date.parse(attempt.startedAt) < 7 * 24 * 60 * 60 * 1000;
      return attempt.completedAt && now - Date.parse(attempt.completedAt) < 7 * 24 * 60 * 60 * 1000;
    });

    const exam = exams.publicCourse(req.params.courseId, req.lang, (text) => req.t(t(text)));
    const answerOrder = Object.fromEntries(exam.questions.map((question) => [question.id, shuffle(question.options.length)]));
    const attempt = {
      id: crypto.randomUUID(),
      courseId: req.params.courseId,
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ATTEMPT_TTL_MS).toISOString(),
      completedAt: null,
      answerOrder,
    };
    user.courseExamAttempts.push(attempt);
    user.courseExamAttempts = user.courseExamAttempts.slice(-MAX_ATTEMPTS_STORED);
    try {
      await db.save(user);
    } catch (err) {
      logger.error('Course exam start save failed', { error: err.message, userId: user.id, courseId: req.params.courseId });
      return res.status(500).json({ error: req.t(t('Impossibile avviare l’esame. Riprova.')), code: 'COURSE_EXAM_SAVE_FAILED' });
    }

    return res.json({
      completed: false,
      attemptId: attempt.id,
      courseId: req.params.courseId,
      courseTitle: req.lang === 'en' ? course.title.en : course.title.it,
      passScore: PASS_SCORE,
      expiresAt: attempt.expiresAt,
      questions: questionPayload(req.params.courseId, answerOrder, req),
    });
  });

  app.post('/api/courses/:courseId/exam/submit', authenticateToken, courseExamLimiter, async (req, res) => {
    const courseId = req.params.courseId;
    const course = exams.getCourse(courseId);
    if (!course) return res.status(404).json({ error: req.t(t('Corso non trovato.')), code: 'COURSE_NOT_FOUND' });

    const { attemptId, answers } = req.body || {};
    if (typeof attemptId !== 'string' || !/^[a-f0-9-]{36}$/i.test(attemptId) ||
        !answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: req.t(t('Risposte d’esame non valide.')), code: 'COURSE_EXAM_INVALID' });
    }

    const user = req.userRecord;
    if (!engine.courseComplete(content.getCourse(courseId), engine.progressFor(user, courseId))) {
      return res.status(403).json({ error: req.t(t('Completa tutti i livelli per sbloccare l’esame finale.')), code: 'COURSE_NOT_COMPLETED' });
    }
    const attempts = Array.isArray(user.courseExamAttempts) ? user.courseExamAttempts : [];
    const attempt = attempts.find((item) => item.id === attemptId && item.courseId === courseId);
    if (!attempt) return res.status(404).json({ error: req.t(t('Tentativo d’esame non trovato.')), code: 'COURSE_EXAM_NOT_FOUND' });
    if (attempt.completedAt) return res.status(409).json({ error: req.t(t('Questo tentativo d’esame è già stato inviato.')), code: 'COURSE_EXAM_COMPLETED' });
    if (!Number.isFinite(Date.parse(attempt.expiresAt)) || Date.parse(attempt.expiresAt) < Date.now()) {
      return res.status(410).json({ error: req.t(t('Il tempo dell’esame è scaduto. Avvia un nuovo tentativo.')), code: 'COURSE_EXAM_EXPIRED' });
    }

    const ids = course.questions.map(([id]) => id);
    const keys = Object.keys(answers);
    if (keys.length !== ids.length || keys.some((id) => !ids.includes(id)) ||
        ids.some((id) => !Number.isInteger(answers[id]) || answers[id] < 0 || answers[id] > 3)) {
      return res.status(400).json({ error: req.t(t('Completa tutte le risposte dell’esame.')), code: 'COURSE_EXAM_INCOMPLETE' });
    }

    const score = exams.grade(courseId, attempt.answerOrder, answers);
    if (score === null) return res.status(400).json({ error: req.t(t('Esame non valido.')), code: 'COURSE_EXAM_INVALID' });
    attempt.completedAt = new Date().toISOString();
    attempt.score = score;

    let certificate = null;
    if (score >= PASS_SCORE) {
      try {
        certificate = await certificates.issueCertificate({
          db,
          user,
          courseId,
          courseTitle: course.title,
          name: user.name,
          score,
          prefix: course.prefix,
          logger,
        });
      } catch (err) {
        attempt.completedAt = null;
        delete attempt.score;
        if (err.code === 'CERT_UNAVAILABLE') {
          logger.error('Course exam passed but certificate signing is unavailable', { userId: user.id, courseId });
          return res.status(503).json({ error: req.t(t('Esame superato, ma il diploma non è disponibile al momento. Riprova più tardi.')), code: 'CERT_UNAVAILABLE' });
        }
        logger.error('Certificate issue failed', { error: err.message, userId: user.id, courseId });
        return res.status(500).json({ error: req.t(t('Esame superato, ma non è stato possibile salvare il diploma. Riprova.')), code: 'CERT_SAVE_FAILED' });
      }
    } else {
      try {
        await db.save(user);
      } catch (err) {
        logger.error('Course exam result save failed', { error: err.message, userId: user.id, courseId });
        return res.status(500).json({ error: req.t(t('Impossibile salvare il risultato dell’esame. Riprova.')), code: 'COURSE_EXAM_SAVE_FAILED' });
      }
    }

    const result = {
      passed: score >= PASS_SCORE,
      score,
      passScore: PASS_SCORE,
    };
    if (certificate) {
      result.certificate = certificates.publicCertificate(certificate, req.lang);
      result.diplomaUrl = `/diploma.html?c=${encodeURIComponent(certificate.code)}`;
    }
    return res.json(result);
  });
};

'use strict';

const crypto = require('crypto');
const exams = require('../lib/course-exams');
const content = require('../lib/course-content');
const certificates = require('../lib/certificates');

const PASS_SCORE = 70;
const ATTEMPT_TTL_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS_STORED = 10;
const t = (s) => s;

function progressFor(user, courseId) {
  const progress = user.courseProgress && user.courseProgress[courseId];
  return progress && typeof progress === 'object'
    ? {
      lessonsDone: Array.isArray(progress.lessonsDone) ? progress.lessonsDone : [],
      moduleScores: progress.moduleScores && typeof progress.moduleScores === 'object' ? progress.moduleScores : {},
      startedAt: progress.startedAt || null,
      updatedAt: progress.updatedAt || null,
    }
    : { lessonsDone: [], moduleScores: {}, startedAt: null, updatedAt: null };
}

function moduleUnlocked(course, progress, moduleIndex) {
  return course.modules.slice(0, moduleIndex).every((module) => Number(progress.moduleScores[module.id]) >= PASS_SCORE);
}

function lessonsComplete(module, progress) {
  return module.lessons.every((lesson) => progress.lessonsDone.includes(lesson.id));
}

function courseComplete(course, progress) {
  return course.modules.every((module) => Number(progress.moduleScores[module.id]) >= PASS_SCORE);
}

function publicQuiz(quiz, req) {
  return quiz.map((item) => ({
    id: item.id,
    prompt: req.t(item.prompt),
    options: item.options.map((option) => req.t(option)),
  }));
}

function publicCourse(course, user, req) {
  const progress = progressFor(user, course.id);
  const lessonTotal = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const lessonsDone = course.modules.reduce(
    (sum, module) => sum + module.lessons.filter((item) => progress.lessonsDone.includes(item.id)).length,
    0
  );
  const modulesPassed = course.modules.filter((module) => Number(progress.moduleScores[module.id]) >= PASS_SCORE).length;
  const totalUnits = lessonTotal + course.modules.length;
  const doneUnits = lessonsDone + modulesPassed;
  return {
    id: course.id,
    title: course.title,
    level: req.t(course.level),
    description: req.t(course.description),
    outcome: req.t(course.outcome),
    percent: Math.round((doneUnits / totalUnits) * 100),
    lessonsDone,
    lessonTotal,
    modulesPassed,
    moduleTotal: course.modules.length,
    examUnlocked: courseComplete(course, progress),
  };
}

function publicCourseDetail(course, user, req) {
  const progress = progressFor(user, course.id);
  return {
    ...publicCourse(course, user, req),
    modules: course.modules.map((module, index) => {
      const unlocked = moduleUnlocked(course, progress, index);
      const passed = Number(progress.moduleScores[module.id]) >= PASS_SCORE;
      return {
        id: module.id,
        title: req.t(module.title),
        unlocked,
        passed,
        score: Number.isFinite(Number(progress.moduleScores[module.id])) ? Number(progress.moduleScores[module.id]) : null,
        lessons: module.lessons.map((item) => ({
          id: item.id,
          title: req.t(item.title),
          done: progress.lessonsDone.includes(item.id),
        })),
        lessonCount: module.lessons.length,
        lessonsComplete: lessonsComplete(module, progress),
        quiz: unlocked ? publicQuiz(module.quiz, req) : [],
        quizCount: module.quiz.length,
      };
    }),
  };
}

function saveProgress(user, courseId, progress) {
  user.courseProgress = user.courseProgress && typeof user.courseProgress === 'object' ? user.courseProgress : {};
  const now = new Date().toISOString();
  user.courseProgress[courseId] = {
    ...progress,
    startedAt: progress.startedAt || now,
    updatedAt: now,
  };
}

async function saveWithError(db, user, logger, req, res, message, code, meta) {
  try {
    await db.save(user);
    return true;
  } catch (err) {
    logger.error('Course progress save failed', { error: err.message, userId: user.id, ...meta });
    res.status(500).json({ error: req.t(t(message)), code });
    return false;
  }
}

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

module.exports = function registerCourses(app, ctx) {
  const { db, logger, authenticateToken, courseExamLimiter, courseContentLimiter } = ctx;

  app.get('/api/courses', authenticateToken, courseContentLimiter, (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ courses: content.COURSES.map((course) => publicCourse(course, req.userRecord, req)) });
  });

  app.get('/api/courses/:courseId', authenticateToken, courseContentLimiter, (req, res) => {
    const course = content.getCourse(req.params.courseId);
    if (!course) return res.status(404).json({ error: req.t(t('Corso non trovato.')), code: 'COURSE_NOT_FOUND' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ course: publicCourseDetail(course, req.userRecord, req) });
  });

  app.get('/api/courses/:courseId/lessons/:lessonId', authenticateToken, courseContentLimiter, (req, res) => {
    const course = content.getCourse(req.params.courseId);
    if (!course) return res.status(404).json({ error: req.t(t('Corso non trovato.')), code: 'COURSE_NOT_FOUND' });
    const moduleIndex = course.modules.findIndex((item) => item.lessons.some((entry) => entry.id === req.params.lessonId));
    if (moduleIndex < 0) return res.status(404).json({ error: req.t(t('Lezione non trovata.')), code: 'LESSON_NOT_FOUND' });
    const module = course.modules[moduleIndex];
    const lessonIndex = module.lessons.findIndex((entry) => entry.id === req.params.lessonId);
    const progress = progressFor(req.userRecord, course.id);
    if (!moduleUnlocked(course, progress, moduleIndex)) {
      return res.status(403).json({ error: req.t(t('Completa il modulo precedente per sbloccare questa lezione.')), code: 'COURSE_MODULE_LOCKED' });
    }
    if (module.lessons.slice(0, lessonIndex).some((entry) => !progress.lessonsDone.includes(entry.id))) {
      return res.status(403).json({ error: req.t(t('Completa le lezioni precedenti di questo modulo.')), code: 'COURSE_LESSON_LOCKED' });
    }
    const item = module.lessons[lessonIndex];
    const lessonData = Object.fromEntries(
      Object.entries(item).map(([key, value]) => [key, Array.isArray(value) ? value.map((entry) => req.t(entry)) : req.t(value)])
    );
    return res.json({
      lesson: lessonData,
      moduleId: module.id,
      position: lessonIndex,
      total: module.lessons.length,
      done: progress.lessonsDone.includes(item.id),
    });
  });

  app.post('/api/courses/:courseId/lessons/:lessonId/complete', authenticateToken, courseContentLimiter, async (req, res) => {
    const course = content.getCourse(req.params.courseId);
    if (!course) return res.status(404).json({ error: req.t(t('Corso non trovato.')), code: 'COURSE_NOT_FOUND' });
    const moduleIndex = course.modules.findIndex((item) => item.lessons.some((entry) => entry.id === req.params.lessonId));
    if (moduleIndex < 0) return res.status(404).json({ error: req.t(t('Lezione non trovata.')), code: 'LESSON_NOT_FOUND' });
    const module = course.modules[moduleIndex];
    const lessonIndex = module.lessons.findIndex((entry) => entry.id === req.params.lessonId);
    const user = req.userRecord;
    const progress = progressFor(user, course.id);
    if (!moduleUnlocked(course, progress, moduleIndex)) {
      return res.status(403).json({ error: req.t(t('Completa il modulo precedente per sbloccare questa lezione.')), code: 'COURSE_MODULE_LOCKED' });
    }
    if (module.lessons.slice(0, lessonIndex).some((entry) => !progress.lessonsDone.includes(entry.id))) {
      return res.status(403).json({ error: req.t(t('Completa le lezioni precedenti di questo modulo.')), code: 'COURSE_LESSON_LOCKED' });
    }
    if (!progress.lessonsDone.includes(req.params.lessonId)) progress.lessonsDone.push(req.params.lessonId);
    saveProgress(user, course.id, progress);
    if (!await saveWithError(db, user, logger, req, res, 'Impossibile salvare i progressi del corso. Riprova.', 'COURSE_PROGRESS_SAVE_FAILED', { courseId: course.id })) return;
    return res.json({ completed: true, course: publicCourseDetail(course, user, req) });
  });

  app.post('/api/courses/:courseId/modules/:moduleId/quiz/submit', authenticateToken, courseContentLimiter, async (req, res) => {
    const course = content.getCourse(req.params.courseId);
    if (!course) return res.status(404).json({ error: req.t(t('Corso non trovato.')), code: 'COURSE_NOT_FOUND' });
    const moduleIndex = course.modules.findIndex((item) => item.id === req.params.moduleId);
    if (moduleIndex < 0) return res.status(404).json({ error: req.t(t('Modulo non trovato.')), code: 'MODULE_NOT_FOUND' });
    const module = course.modules[moduleIndex];
    const user = req.userRecord;
    const progress = progressFor(user, course.id);
    if (!moduleUnlocked(course, progress, moduleIndex)) {
      return res.status(403).json({ error: req.t(t('Supera il modulo precedente per sbloccare questo test.')), code: 'COURSE_MODULE_LOCKED' });
    }
    if (!lessonsComplete(module, progress)) {
      return res.status(403).json({ error: req.t(t('Completa tutte le lezioni del modulo prima del test.')), code: 'COURSE_LESSONS_INCOMPLETE' });
    }
    const answers = req.body && req.body.answers;
    const questionIds = module.quiz.map((item) => item.id);
    if (!answers || typeof answers !== 'object' || Array.isArray(answers) ||
        Object.keys(answers).length !== questionIds.length ||
        Object.keys(answers).some((id) => !questionIds.includes(id)) ||
        questionIds.some((id) => !Number.isInteger(answers[id]) || answers[id] < 0 || answers[id] >= 4)) {
      return res.status(400).json({ error: req.t(t('Seleziona una risposta valida per ogni domanda.')), code: 'COURSE_QUIZ_INVALID' });
    }
    const correctCount = module.quiz.reduce((sum, item) => sum + (answers[item.id] === item.correctIndex ? 1 : 0), 0);
    const score = Math.round((correctCount / module.quiz.length) * 100);
    progress.moduleScores[module.id] = Math.max(Number(progress.moduleScores[module.id]) || 0, score);
    saveProgress(user, course.id, progress);
    if (!await saveWithError(db, user, logger, req, res, 'Impossibile salvare il risultato del test. Riprova.', 'COURSE_QUIZ_SAVE_FAILED', { courseId: course.id, moduleId: module.id })) return;
    return res.json({
      passed: score >= PASS_SCORE,
      score,
      passScore: PASS_SCORE,
      feedback: module.quiz.map((item) => ({
        id: item.id,
        isCorrect: answers[item.id] === item.correctIndex,
        correctOptionIndex: item.correctIndex,
        explanation: req.t(item.explanation),
        selectedOptionIndex: answers[item.id],
        prompt: req.t(item.prompt),
      })),
      course: publicCourseDetail(course, user, req),
    });
  });

  app.post('/api/courses/:courseId/exam/start', authenticateToken, courseExamLimiter, async (req, res) => {
    const course = exams.getCourse(req.params.courseId);
    if (!course) return res.status(404).json({ error: req.t(t('Corso non trovato.')), code: 'COURSE_NOT_FOUND' });

    const user = req.userRecord;
    if (!courseComplete(content.getCourse(req.params.courseId), progressFor(user, req.params.courseId))) {
      return res.status(403).json({ error: req.t(t('Completa tutti i moduli per sbloccare l’esame finale.')), code: 'COURSE_NOT_COMPLETED' });
    }
    const existing = (user.certificates || []).find((certificate) => certificate.courseId === req.params.courseId);
    if (existing) {
      return res.json({
        completed: true,
        certificate: certificates.publicCertificate(existing, req.lang),
        diplomaUrl: `/diploma.html?c=${encodeURIComponent(existing.code)}`,
      });
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
    if (!courseComplete(content.getCourse(courseId), progressFor(user, courseId))) {
      return res.status(403).json({ error: req.t(t('Completa tutti i moduli per sbloccare l’esame finale.')), code: 'COURSE_NOT_COMPLETED' });
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

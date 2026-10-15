'use strict';
/**
 * Logica dei corsi: progresso, sblocchi, punti, serie giornaliera, valutazione.
 * Funzioni pure sul record utente: nessun accesso a rete o disco.
 * Le risposte corrette non lasciano mai questo modulo prima dell'invio.
 */
const crypto = require('crypto');
const content = require('./course-content');
const design = require('./course-design');

const PASS_SCORE = 70;
const XP = { lesson: 10, check: 5, lab: 40, quiz: 30, diploma: 100 };
const QUIZ_MINUTES = 5;
const EXAM_MINUTES = 10;
const ACTIVITY_DAYS_KEPT = 120;

/* ───────────── progresso ───────────── */

function emptyProgress() {
  return { lessonsDone: [], checksDone: [], labScores: {}, moduleScores: {}, startedAt: null, updatedAt: null };
}

function asStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function asScores(value) {
  const out = {};
  if (value && typeof value === 'object') {
    for (const [key, score] of Object.entries(value)) {
      const n = Number(score);
      if (Number.isFinite(n)) out[key] = Math.max(0, Math.min(100, Math.round(n)));
    }
  }
  return out;
}

function progressFor(user, courseId) {
  const raw = user && user.courseProgress && user.courseProgress[courseId];
  if (!raw || typeof raw !== 'object') return emptyProgress();
  return {
    lessonsDone: asStringArray(raw.lessonsDone),
    checksDone: asStringArray(raw.checksDone),
    labScores: asScores(raw.labScores),
    moduleScores: asScores(raw.moduleScores),
    startedAt: raw.startedAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

function todayKey(now) {
  return new Date(now || Date.now()).toISOString().slice(0, 10);
}

function touchActivity(user, now) {
  const day = todayKey(now);
  const days = asStringArray(user.courseActivity);
  if (!days.includes(day)) days.push(day);
  user.courseActivity = days.sort().slice(-ACTIVITY_DAYS_KEPT);
}

function saveProgress(user, courseId, progress, now) {
  const stamp = new Date(now || Date.now()).toISOString();
  user.courseProgress = user.courseProgress && typeof user.courseProgress === 'object' ? user.courseProgress : {};
  user.courseProgress[courseId] = { ...progress, startedAt: progress.startedAt || stamp, updatedAt: stamp };
  touchActivity(user, now);
}

/** Giorni consecutivi con attività, fino a oggi (o a ieri: la serie non si perde finché c'è tempo). */
function streakOf(user, now) {
  const set = new Set(asStringArray(user && user.courseActivity));
  const DAY = 86400000;
  let cursor = Date.parse(`${todayKey(now)}T00:00:00Z`);
  if (!set.has(todayKey(cursor))) cursor -= DAY;
  let streak = 0;
  while (set.has(todayKey(cursor))) {
    streak += 1;
    cursor -= DAY;
  }
  return streak;
}

/* ───────────── livelli e sblocchi ───────────── */

function levelDesign(courseId, moduleId) {
  const d = design.getDesign(courseId);
  return d && d.modules[moduleId] ? d.modules[moduleId] : null;
}

function quizPassed(progress, module) {
  return Number(progress.moduleScores[module.id]) >= PASS_SCORE;
}

function labPassed(progress, module) {
  return Number(progress.labScores[module.id]) >= PASS_SCORE;
}

function levelPassed(progress, module) {
  return quizPassed(progress, module) && labPassed(progress, module);
}

function lessonsComplete(progress, module) {
  return module.lessons.every((item) => progress.lessonsDone.includes(item.id));
}

function levelUnlocked(course, progress, index) {
  return course.modules.slice(0, index).every((module) => levelPassed(progress, module));
}

function courseComplete(course, progress) {
  return course.modules.every((module) => levelPassed(progress, module));
}

function lessonOpen(course, progress, moduleIndex, lessonIndex) {
  if (!levelUnlocked(course, progress, moduleIndex)) return false;
  const lessons = course.modules[moduleIndex].lessons;
  return lessons.slice(0, lessonIndex).every((item) => progress.lessonsDone.includes(item.id));
}

function findLesson(course, lessonId) {
  for (let m = 0; m < course.modules.length; m += 1) {
    const l = course.modules[m].lessons.findIndex((item) => item.id === lessonId);
    if (l >= 0) return { moduleIndex: m, lessonIndex: l, module: course.modules[m], lesson: course.modules[m].lessons[l] };
  }
  return null;
}

/* ───────────── punti ───────────── */

function courseXp(user, course) {
  const progress = progressFor(user, course.id);
  let xp = progress.lessonsDone.length * XP.lesson + progress.checksDone.length * XP.check;
  for (const module of course.modules) {
    if (labPassed(progress, module)) xp += XP.lab;
    if (quizPassed(progress, module)) xp += XP.quiz;
  }
  if ((user.certificates || []).some((certificate) => certificate.courseId === course.id)) xp += XP.diploma;
  return xp;
}

function totalXp(user) {
  return content.COURSES.reduce((sum, course) => sum + courseXp(user, course), 0);
}

/* ───────────── durata e prossimo passo ───────────── */

function courseMinutes(course) {
  const d = design.getDesign(course.id);
  let total = EXAM_MINUTES;
  for (const module of course.modules) {
    total += QUIZ_MINUTES;
    const md = d && d.modules[module.id];
    if (md && md.lab) total += md.lab.minutes || 0;
    for (const item of module.lessons) {
      const ld = md && md.lessons[item.id];
      total += ld ? ld.minutes : 5;
    }
  }
  return total;
}

function nextStep(user, course) {
  const progress = progressFor(user, course.id);
  for (let m = 0; m < course.modules.length; m += 1) {
    const module = course.modules[m];
    if (levelPassed(progress, module)) continue;
    const pending = module.lessons.find((item) => !progress.lessonsDone.includes(item.id));
    if (pending) return { type: 'lesson', moduleId: module.id, lessonId: pending.id };
    if (!labPassed(progress, module)) return { type: 'lab', moduleId: module.id };
    return { type: 'quiz', moduleId: module.id };
  }
  const hasDiploma = (user.certificates || []).some((certificate) => certificate.courseId === course.id);
  return { type: hasDiploma ? 'diploma' : 'exam' };
}

/* ───────────── presentazione ───────────── */

function lang(req) {
  return req && req.lang === 'en' ? 'en' : 'it';
}

function shuffled(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function summary(course, user, req) {
  const progress = progressFor(user, course.id);
  const d = design.getDesign(course.id);
  const lessonTotal = course.modules.reduce((sum, module) => sum + module.lessons.length, 0);
  const levelsPassed = course.modules.filter((module) => levelPassed(progress, module)).length;
  const lessonsDone = course.modules.reduce((sum, module) => sum + module.lessons.filter((item) => progress.lessonsDone.includes(item.id)).length, 0);
  const units = lessonTotal + course.modules.length * 2;
  const doneUnits = lessonsDone + course.modules.filter((module) => labPassed(progress, module)).length +
    course.modules.filter((module) => quizPassed(progress, module)).length;
  const certificate = (user.certificates || []).find((item) => item.courseId === course.id) || null;
  return {
    id: course.id,
    title: course.title,
    level: req.t(course.level),
    description: req.t(course.description),
    outcome: req.t(course.outcome),
    tagline: d ? design.pick(d.tagline, lang(req)) : '',
    audience: d ? design.pick(d.audience, lang(req)) : '',
    goals: d ? d.goals.map((goal) => design.pick(goal, lang(req))) : [],
    minutes: courseMinutes(course),
    percent: Math.min(100, Math.round((doneUnits / units) * 100)),
    lessonTotal,
    lessonsDone,
    levelTotal: course.modules.length,
    levelsPassed,
    examUnlocked: courseComplete(course, progress),
    xp: courseXp(user, course),
    diplomaCode: certificate ? certificate.code : null,
    next: nextStep(user, course),
  };
}

function detail(course, user, req) {
  const progress = progressFor(user, course.id);
  const l = lang(req);
  return {
    ...summary(course, user, req),
    stats: { xp: totalXp(user), streak: streakOf(user) },
    levels: course.modules.map((module, index) => {
      const md = levelDesign(course.id, module.id) || {};
      const unlocked = levelUnlocked(course, progress, index);
      const allLessons = lessonsComplete(progress, module);
      return {
        id: module.id,
        number: index + 1,
        title: req.t(module.title),
        mission: md.mission ? design.pick(md.mission, l) : '',
        skill: md.skill ? design.pick(md.skill, l) : '',
        unlocked,
        passed: levelPassed(progress, module),
        lessonsComplete: allLessons,
        labTitle: md.lab ? design.pick(md.lab.title, l) : '',
        labMinutes: md.lab ? md.lab.minutes : 0,
        labScore: Number.isFinite(progress.labScores[module.id]) ? progress.labScores[module.id] : null,
        labPassed: labPassed(progress, module),
        labOpen: unlocked && allLessons,
        quizScore: Number.isFinite(progress.moduleScores[module.id]) ? progress.moduleScores[module.id] : null,
        quizPassed: quizPassed(progress, module),
        quizOpen: unlocked && allLessons && labPassed(progress, module),
        quizCount: module.quiz.length,
        lessons: module.lessons.map((item, lessonIndex) => {
          const ld = md.lessons && md.lessons[item.id];
          return {
            id: item.id,
            title: req.t(item.title),
            minutes: ld ? ld.minutes : 5,
            done: progress.lessonsDone.includes(item.id),
            open: lessonOpen(course, progress, index, lessonIndex),
          };
        }),
      };
    }),
  };
}

/** Programma pubblico del corso (nessun progresso, nessuna risposta): visibile anche senza account. */
function catalogEntry(course, req) {
  const base = summary(course, {}, req);
  const l = lang(req);
  return {
    id: base.id,
    title: base.title,
    level: base.level,
    description: base.description,
    outcome: base.outcome,
    tagline: base.tagline,
    audience: base.audience,
    goals: base.goals,
    minutes: base.minutes,
    lessonTotal: base.lessonTotal,
    levelTotal: base.levelTotal,
    levels: course.modules.map((module, index) => {
      const md = levelDesign(course.id, module.id) || {};
      return {
        id: module.id,
        number: index + 1,
        title: req.t(module.title),
        mission: md.mission ? design.pick(md.mission, l) : '',
        skill: md.skill ? design.pick(md.skill, l) : '',
        lessons: module.lessons.map((item) => req.t(item.title)),
        labTitle: md.lab ? design.pick(md.lab.title, l) : '',
      };
    }),
  };
}

function lessonPayload(course, user, found, req) {
  const progress = progressFor(user, course.id);
  const l = lang(req);
  const md = levelDesign(course.id, found.module.id) || {};
  const ld = (md.lessons && md.lessons[found.lesson.id]) || null;
  const text = Object.fromEntries(Object.entries(found.lesson).map(([key, value]) => [
    key, Array.isArray(value) ? value.map((entry) => req.t(entry)) : req.t(value),
  ]));
  const previous = found.lessonIndex > 0 ? found.module.lessons[found.lessonIndex - 1] : null;
  const next = found.lessonIndex + 1 < found.module.lessons.length ? found.module.lessons[found.lessonIndex + 1] : null;
  return {
    lesson: text,
    hook: ld ? design.pick(ld.hook, l) : '',
    minutes: ld ? ld.minutes : 5,
    moduleId: found.module.id,
    moduleTitle: req.t(found.module.title),
    position: found.lessonIndex,
    total: found.module.lessons.length,
    previousId: previous ? previous.id : null,
    nextId: next ? next.id : null,
    done: progress.lessonsDone.includes(found.lesson.id),
    checkDone: progress.checksDone.includes(found.lesson.id),
    check: ld ? {
      prompt: design.pick(ld.check.prompt, l),
      options: shuffled(ld.check.options.map((option, i) => ({ i, text: design.pick(option, l) }))),
    } : null,
    recall: recallFor(course, progress, found, l),
  };
}

/** Domanda di ripasso su una lezione già completata (recupero a distanza: aiuta a ricordare). */
function recallFor(course, progress, found, l) {
  const pool = [];
  course.modules.forEach((module) => {
    const md = levelDesign(course.id, module.id);
    module.lessons.forEach((item) => {
      if (item.id === found.lesson.id || !progress.lessonsDone.includes(item.id)) return;
      const ld = md && md.lessons[item.id];
      if (ld) pool.push({ lessonId: item.id, title: item.title, ld });
    });
  });
  if (!pool.length) return null;
  const pickOne = pool[crypto.randomInt(pool.length)];
  return {
    lessonId: pickOne.lessonId,
    prompt: design.pick(pickOne.ld.check.prompt, l),
    options: shuffled(pickOne.ld.check.options.map((option, i) => ({ i, text: design.pick(option, l) }))),
  };
}

function gradeCheck(courseId, found, answer, req) {
  const md = levelDesign(courseId, found.module.id);
  const ld = md && md.lessons[found.lesson.id];
  if (!ld || !Number.isInteger(answer) || answer < 0 || answer >= ld.check.options.length) return null;
  const correct = answer === ld.check.correct;
  return { correct, why: correct ? design.pick(ld.check.why, lang(req)) : null };
}

/* ───────────── laboratori ───────────── */

function labPayload(courseId, module, req) {
  const md = levelDesign(courseId, module.id);
  const lab = md && md.lab;
  if (!lab) return null;
  const l = lang(req);
  const base = { id: lab.id, kind: lab.kind, minutes: lab.minutes, title: design.pick(lab.title, l), brief: design.pick(lab.brief, l), passScore: PASS_SCORE };
  if (lab.kind === 'classify') {
    return { ...base, categories: lab.categories.map((c) => design.pick(c, l)), items: shuffled(lab.items.map((item) => ({ id: item.id, text: design.pick(item.text, l) }))) };
  }
  if (lab.kind === 'order') {
    return { ...base, items: shuffled(lab.items.map((item) => ({ id: item.id, text: design.pick(item.text, l) }))) };
  }
  return { ...base, options: shuffled(lab.options.map((item) => ({ id: item.id, text: design.pick(item.text, l) }))) };
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

/** Restituisce { score, items } oppure null se la risposta non è valida. */
function gradeLab(courseId, module, answers, req) {
  const md = levelDesign(courseId, module.id);
  const lab = md && md.lab;
  if (!lab || !isPlainObject(answers)) return null;
  const l = lang(req);

  if (lab.kind === 'classify') {
    const ids = lab.items.map((item) => item.id);
    const keys = Object.keys(answers);
    if (keys.length !== ids.length || keys.some((key) => !ids.includes(key)) ||
        ids.some((id) => !Number.isInteger(answers[id]) || answers[id] < 0 || answers[id] >= lab.categories.length)) return null;
    const items = lab.items.map((item) => ({
      id: item.id, text: design.pick(item.text, l), correct: answers[item.id] === item.cat,
      answer: design.pick(lab.categories[item.cat], l), why: design.pick(item.why, l),
    }));
    return { score: Math.round((items.filter((item) => item.correct).length / items.length) * 100), items };
  }

  if (lab.kind === 'order') {
    const ids = lab.items.map((item) => item.id);
    const order = answers.order;
    if (!Array.isArray(order) || order.length !== ids.length || new Set(order).size !== ids.length || order.some((id) => !ids.includes(id))) return null;
    const items = lab.items.map((item, position) => ({
      id: item.id, text: design.pick(item.text, l), position: position + 1, correct: order[position] === item.id, why: design.pick(item.why, l),
    }));
    return { score: Math.round((items.filter((item) => item.correct).length / items.length) * 100), items };
  }

  const selected = answers.selected;
  const ids = lab.options.map((option) => option.id);
  if (!Array.isArray(selected) || new Set(selected).size !== selected.length || selected.some((id) => !ids.includes(id))) return null;
  const totalRight = lab.options.filter((option) => option.right).length;
  const picked = new Set(selected);
  let hits = 0;
  let misses = 0;
  const items = lab.options.map((option) => {
    const chosen = picked.has(option.id);
    if (chosen && option.right) hits += 1;
    if (chosen && !option.right) misses += 1;
    return { id: option.id, text: design.pick(option.text, l), chosen, right: option.right, correct: chosen === option.right, why: design.pick(option.why, l) };
  });
  return { score: Math.max(0, Math.round(((hits - misses) / totalRight) * 100)), items };
}

function labFeedback(courseId, module, result, req) {
  const md = levelDesign(courseId, module.id);
  const passed = result.score >= PASS_SCORE;
  const debrief = md && md.lab ? design.pick(md.lab.debrief, lang(req)) : '';
  return {
    score: result.score,
    passed,
    passScore: PASS_SCORE,
    // Se non superato mostriamo solo l'esito per elemento: l'obiettivo è ripensarci, non copiare.
    items: result.items.map((item) => (passed ? item : { id: item.id, correct: item.correct, position: item.position })),
    debrief: passed ? debrief : '',
  };
}

/* ───────────── test di livello ───────────── */

function quizPayload(module, req) {
  return module.quiz.map((item) => ({
    id: item.id,
    prompt: req.t(item.prompt),
    options: shuffled(item.options.map((option, i) => ({ i, text: req.t(option) }))),
  }));
}

function gradeQuiz(module, answers, req) {
  const ids = module.quiz.map((item) => item.id);
  if (!isPlainObject(answers)) return null;
  const keys = Object.keys(answers);
  if (keys.length !== ids.length || keys.some((key) => !ids.includes(key)) ||
      module.quiz.some((item) => !Number.isInteger(answers[item.id]) || answers[item.id] < 0 || answers[item.id] >= item.options.length)) return null;
  const items = module.quiz.map((item) => ({
    id: item.id,
    correct: answers[item.id] === item.correctIndex,
    correctIndex: item.correctIndex,
    explanation: req.t(item.explanation),
  }));
  const score = Math.round((items.filter((item) => item.correct).length / items.length) * 100);
  const passed = score >= PASS_SCORE;
  return {
    score,
    passed,
    passScore: PASS_SCORE,
    items: items.map((item) => (passed ? item : { id: item.id, correct: item.correct })),
  };
}

module.exports = {
  PASS_SCORE,
  XP,
  progressFor,
  saveProgress,
  streakOf,
  levelUnlocked,
  levelPassed,
  labPassed,
  quizPassed,
  lessonsComplete,
  lessonOpen,
  courseComplete,
  findLesson,
  courseXp,
  totalXp,
  summary,
  catalogEntry,
  detail,
  lessonPayload,
  gradeCheck,
  labPayload,
  gradeLab,
  labFeedback,
  quizPayload,
  gradeQuiz,
  touchActivity,
};

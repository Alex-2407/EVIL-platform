'use strict';
require('./helpers/setup');

const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');
const { createTestApp, registeredAgent } = require('./helpers/app');
const content = require('../server/lib/course-content');
const design = require('../server/lib/course-design');
const exams = require('../server/lib/course-exams');
const engine = require('../server/lib/course-engine');
const certificates = require('../server/lib/certificates');

const api = (courseId) => `/api/courses/${courseId}`;
const { doLessons, doLab, doQuiz, completeCourse } = require('./helpers/course-flow');

test('corsi: ogni lezione, livello e laboratorio ha il suo progetto didattico', () => {
  for (const course of content.COURSES) {
    const d = design.getDesign(course.id);
    assert.ok(d && d.goals.length >= 3, `${course.id}: obiettivi`);
    assert.equal(course.modules.length, Object.keys(d.modules).length);
    for (const module of course.modules) {
      const md = d.modules[module.id];
      assert.ok(md && md.mission.it && md.mission.en && md.skill.it && md.skill.en, `${module.id}: missione e abilità`);
      assert.equal(module.lessons.length, Object.keys(md.lessons).length);
      for (const lesson of module.lessons) {
        const ld = md.lessons[lesson.id];
        assert.ok(ld && ld.hook.it && ld.hook.en, `${lesson.id}: gancio`);
        assert.ok(ld.check.options.length >= 3 && ld.check.correct < ld.check.options.length, `${lesson.id}: verifica`);
        assert.ok(ld.check.options.every((option) => option.it && option.en), `${lesson.id}: opzioni bilingui`);
      }
      const lab = md.lab;
      assert.ok(['classify', 'order', 'select'].includes(lab.kind));
      if (lab.kind === 'select') {
        const right = lab.options.filter((option) => option.right).length;
        assert.ok(right >= 2 && right < lab.options.length, `${lab.id}: serve un mix di corrette e sbagliate`);
      }
      assert.equal(module.quiz.length, 5);
    }
  }
});

test('corsi: il programma pubblico non richiede login e non contiene risposte', async () => {
  const { app } = await createTestApp();
  const res = await request(app).get('/api/courses/catalog').expect(200);
  assert.equal(res.body.courses.length, 3);
  assert.ok(res.body.courses[0].goals.length >= 3 && res.body.courses[0].levels.length === 4);
  const text = JSON.stringify(res.body);
  assert.equal(/correct|right|explanation/i.test(text), false);
  await request(app).get('/api/courses').expect(401);
});

test('corsi: sblocchi in ordine, nessuna risposta trapela, quiz con opzioni mescolate', async () => {
  const { app } = await createTestApp();
  const { agent } = await registeredAgent(app);
  const course = content.getCourse('fondamenti');
  const first = course.modules[0];
  const [l1, l2] = first.lessons;

  await agent.get(`${api('inesistente')}`).expect(404);
  await agent.get(`${api('fondamenti')}/lessons/inesistente`).expect(404);
  await agent.get(`${api('fondamenti')}/levels/inesistente/lab`).expect(404);
  await agent.get(`${api('fondamenti')}/lessons/${l2.id}`).expect(403);
  await agent.get(`${api('fondamenti')}/levels/${first.id}/lab`).expect(403);
  await agent.get(`${api('fondamenti')}/levels/${first.id}/quiz`).expect(403);
  await agent.post(`${api('fondamenti')}/lessons/${l1.id}/complete`).send({}).expect(403)
    .then(({ body }) => assert.equal(body.code, 'COURSE_CHECK_REQUIRED'));

  const wrong = await agent.post(`${api('fondamenti')}/lessons/${l1.id}/check`).send({ answer: 1 === design.getDesign('fondamenti').modules[first.id].lessons[l1.id].check.correct ? 0 : 1 }).expect(200);
  assert.equal(wrong.body.correct, false);
  assert.equal(wrong.body.why, null);
  await agent.post(`${api('fondamenti')}/lessons/${l1.id}/check`).send({ answer: 99 }).expect(400);

  const detail = await agent.get(api('fondamenti')).expect(200);
  assert.equal(/correct|explanation|"right"/i.test(JSON.stringify(detail.body)), false);

  await doLessons(agent, 'fondamenti', first);
  await agent.get(`${api('fondamenti')}/levels/${first.id}/quiz`).expect(403)
    .then(({ body }) => assert.equal(body.code, 'COURSE_LAB_REQUIRED'));

  // laboratorio: un invio sbagliato non supera e non rivela la soluzione
  const lab = design.getDesign('fondamenti').modules[first.id].lab;
  const wrongAnswers = lab.kind === 'classify'
    ? Object.fromEntries(lab.items.map((item) => [item.id, (item.cat + 1) % lab.categories.length]))
    : lab.kind === 'order' ? { order: lab.items.map((item) => item.id).reverse() } : { selected: lab.options.filter((o) => !o.right).map((o) => o.id) };
  const failed = await doLab(agent, 'fondamenti', first, wrongAnswers);
  assert.equal(failed.body.passed, false);
  assert.equal(failed.body.debrief, '');
  assert.equal(failed.body.items.some((item) => 'why' in item), false);
  await agent.post(`${api('fondamenti')}/levels/${first.id}/lab/submit`).send({ answers: { x: 1 } }).expect(400);
  const passedLab = await doLab(agent, 'fondamenti', first);
  assert.equal(passedLab.body.passed, true);
  assert.ok(passedLab.body.debrief.length > 10);
  assert.equal(passedLab.body.xp, engine.XP.lab);

  // il quiz: nessuna risposta nel payload e opzioni in ordine diverso fra una richiesta e l'altra
  const orders = new Set();
  for (let i = 0; i < 8; i += 1) {
    const q = await agent.get(`${api('fondamenti')}/levels/${first.id}/quiz`).expect(200);
    assert.equal(/correct|explanation/i.test(JSON.stringify(q.body)), false);
    orders.add(q.body.questions[0].options.map((option) => option.i).join(''));
  }
  assert.ok(orders.size > 1, 'le opzioni devono cambiare ordine');

  const bad = await doQuiz(agent, 'fondamenti', first, false);
  assert.equal(bad.body.passed, false);
  assert.equal(bad.body.items.some((item) => 'explanation' in item || 'correctIndex' in item), false);
  const good = await doQuiz(agent, 'fondamenti', first);
  assert.equal(good.body.passed, true);
  assert.equal(good.body.levelCompleted, true);
  assert.ok(good.body.skill.length > 5);
  assert.equal(good.body.course.levels[1].unlocked, true);

  await agent.post(`${api('fondamenti')}/exam/start`).send({}).expect(403)
    .then(({ body }) => assert.equal(body.code, 'COURSE_NOT_COMPLETED'));
});

test('corsi: punti, serie, corso completo, esame e diploma', async () => {
  const { app, ctx } = await createTestApp();
  const { agent, userId } = await registeredAgent(app);

  await completeCourse(agent, 'fondamenti');
  const detail = await agent.get(api('fondamenti')).expect(200);
  const lessons = 12;
  const expectedXp = lessons * (engine.XP.lesson + engine.XP.check) + 4 * (engine.XP.lab + engine.XP.quiz);
  assert.equal(detail.body.course.xp, expectedXp);
  assert.equal(detail.body.course.stats.streak, 1);
  assert.equal(detail.body.course.percent, 100);
  assert.equal(detail.body.course.examUnlocked, true);
  assert.equal(detail.body.course.next.type, 'exam');

  const started = await agent.post(`${api('fondamenti')}/exam/start`).send({}).expect(200);
  assert.equal(started.body.questions.length, 10);
  const user = ctx.db.findById(userId);
  const attempt = user.courseExamAttempts.find((item) => item.id === started.body.attemptId);
  const answers = {};
  for (const [id, , , correctIndex] of exams.COURSES.fondamenti.questions) answers[id] = attempt.answerOrder[id].indexOf(correctIndex);
  const submitted = await agent.post(`${api('fondamenti')}/exam/submit`).send({ attemptId: started.body.attemptId, answers }).expect(200);
  assert.equal(submitted.body.passed, true);
  assert.equal(user.certificates.length, 1);
  assert.equal(certificates.verifyRecord(user.certificates[0]).valid, true);

  // con il diploma già emesso l'avvio dell'esame rimanda al diploma, anche se il progresso fosse perso
  delete user.courseProgress;
  const again = await agent.post(`${api('fondamenti')}/exam/start`).send({}).expect(200);
  assert.equal(again.body.completed, true);
  assert.equal(again.body.certificate.code, user.certificates[0].code);

  const list = await agent.get('/api/courses').expect(200);
  assert.equal(list.body.courses.find((item) => item.id === 'fondamenti').diplomaCode, user.certificates[0].code);
});

test('corsi: la serie giornaliera conta i giorni consecutivi', () => {
  const user = { courseActivity: ['2026-10-12', '2026-10-13', '2026-10-14'] };
  assert.equal(engine.streakOf(user, Date.parse('2026-10-14T10:00:00Z')), 3);
  assert.equal(engine.streakOf(user, Date.parse('2026-10-15T10:00:00Z')), 3); // ieri conta ancora
  assert.equal(engine.streakOf(user, Date.parse('2026-10-16T10:00:00Z')), 0); // interrotta
  assert.equal(engine.streakOf({}, Date.now()), 0);
});

test('diplomi: verifica con la chiave pubblica precedente dopo la rotazione', () => {
  const crypto = require('node:crypto');
  const oldPair = crypto.generateKeyPairSync('ed25519');
  const publicKeyPem = oldPair.publicKey.export({ type: 'spki', format: 'pem' });
  const keyId = crypto.createHash('sha256')
    .update(oldPair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
  const record = {
    version: 1,
    code: 'EVIL-FND-2345-6789-ABCD',
    courseId: 'fondamenti',
    courseTitle: { it: 'Fondamenti', en: 'Foundations' },
    name: 'Giulia Neri',
    issuedAt: '2026-01-01T00:00:00.000Z',
    score: 90,
    holder: '0'.repeat(32),
    keyId,
  };
  record.signature = crypto.sign(null, Buffer.from(certificates.canonicalText(record)), oldPair.privateKey).toString('base64');
  assert.equal(certificates.verifyRecord(record, {
    previousPublicKeys: [{ keyId, publicKeyPem }],
  }).valid, true);
});

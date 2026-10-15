'use strict';
require('./helpers/setup');

const assert = require('node:assert/strict');
const test = require('node:test');
const { createTestApp, registeredAgent } = require('./helpers/app');
const content = require('../server/lib/course-content');
const exams = require('../server/lib/course-exams');
const certificates = require('../server/lib/certificates');

async function completeCourse(agent, courseId) {
  const course = content.getCourse(courseId);
  for (const module of course.modules) {
    for (const lesson of module.lessons) {
      await agent.get(`/api/courses/${courseId}/lessons/${lesson.id}`).expect(200);
      await agent.post(`/api/courses/${courseId}/lessons/${lesson.id}/complete`).send({}).expect(200);
    }
    const result = await agent.post(`/api/courses/${courseId}/modules/${module.id}/quiz/submit`)
      .send({ answers: Object.fromEntries(module.quiz.map((question) => [question.id, question.correctIndex])) })
      .expect(200);
    assert.equal(result.body.score, 100);
    assert.equal(result.body.passed, true);
  }
}

test('corsi: lezioni e moduli bloccati, quiz valutato dal server e diploma dopo esame', async () => {
  const { app, ctx } = await createTestApp();
  const { agent, userId } = await registeredAgent(app);
  const course = content.getCourse('fondamenti');
  const firstModule = course.modules[0];
  const firstLesson = firstModule.lessons[0];
  const nextLesson = firstModule.lessons[1];

  await agent.get('/api/courses/inesistente').expect(404);
  await agent.get('/api/courses/fondamenti/lessons/inesistente').expect(404);
  await agent.get('/api/courses/fondamenti/lessons/' + firstLesson.id).expect(200);
  await agent.get(`/api/courses/fondamenti/lessons/${nextLesson.id}`).expect(403);
  const detail = await agent.get('/api/courses/fondamenti').expect(200);
  assert.equal(detail.body.course.modules[0].quiz[0].correctIndex, undefined);
  assert.equal(detail.body.course.modules[0].quiz[0].explanation, undefined);
  await agent.post('/api/courses/fondamenti/modules/identita/quiz/submit')
    .send({ answers: {} }).expect(403);

  for (const lesson of firstModule.lessons) {
    await agent.post(`/api/courses/fondamenti/lessons/${lesson.id}/complete`).send({}).expect(200);
  }
  const quiz = await agent.get('/api/courses/fondamenti').expect(200);
  assert.equal(JSON.stringify(quiz.body).includes('correctIndex'), false);
  const correct = Object.fromEntries(firstModule.quiz.map((question) => [question.id, question.correctIndex]));
  const scored = await agent.post('/api/courses/fondamenti/modules/principi/quiz/submit')
    .send({ answers: correct }).expect(200);
  assert.equal(scored.body.score, 100);
  assert.equal(scored.body.passed, true);
  assert.equal(scored.body.feedback[0].correctOptionIndex, firstModule.quiz[0].correctIndex);
  await agent.post('/api/courses/fondamenti/modules/inesistente/quiz/submit')
    .send({ answers: {} }).expect(404);
  await agent.post('/api/courses/fondamenti/exam/start').send({}).expect(403)
    .then(({ body }) => assert.equal(body.code, 'COURSE_NOT_COMPLETED'));

  await completeCourse(agent, 'fondamenti');
  const started = await agent.post('/api/courses/fondamenti/exam/start').send({}).expect(200);
  assert.equal(started.body.questions.length, 10);
  const user = ctx.db.findById(userId);
  const attempt = user.courseExamAttempts.find((item) => item.id === started.body.attemptId);
  const answers = {};
  for (const [id, , , correctIndex] of exams.COURSES.fondamenti.questions) {
    answers[id] = attempt.answerOrder[id].indexOf(correctIndex);
  }
  const submitted = await agent.post('/api/courses/fondamenti/exam/submit')
    .send({ attemptId: started.body.attemptId, answers }).expect(200);
  assert.equal(submitted.body.passed, true);
  assert.equal(user.certificates.length, 1);
  assert.equal(certificates.verifyRecord(user.certificates[0]).valid, true);
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

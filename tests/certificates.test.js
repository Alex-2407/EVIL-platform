'use strict';
require('./helpers/setup');

const assert = require('node:assert/strict');
const test = require('node:test');
const { createTestApp, registeredAgent, request } = require('./helpers/app');
const certs = require('../server/lib/certificates');
const exams = require('../server/lib/course-exams');
const courseContent = require('../server/lib/course-content');

async function completeCourse(agent, courseId) {
  const course = courseContent.getCourse(courseId);
  for (const module of course.modules) {
    for (const lesson of module.lessons) {
      await agent.post(`/api/courses/${courseId}/lessons/${lesson.id}/complete`).send({}).expect(200);
    }
    const answers = Object.fromEntries(module.quiz.map((question) => [question.id, question.correctIndex]));
    await agent.post(`/api/courses/${courseId}/modules/${module.id}/quiz/submit`)
      .send({ answers }).expect(200);
  }
}

test('diplomi: emissione unica, verifica della firma, lookup pubblico e impronta deterministica', async () => {
  const { app, ctx } = await createTestApp();
  const { agent, userId } = await registeredAgent(app);
  const user = ctx.db.findById(userId);
  const certificate = await certs.issueCertificate({
    db: ctx.db,
    user,
    courseId: 'fondamenti',
    courseTitle: { it: 'Fondamenti', en: 'Foundations' },
    name: user.name,
    score: 90,
    prefix: 'FND',
  });

  assert.match(certificate.code, certs.CODE_RE);
  assert.equal(certs.verifyRecord(certificate).valid, true);
  assert.deepEqual(certs.fingerprint(certificate.signature), certs.fingerprint(certificate.signature));
  const publicKey = await request(app).get('/api/certificates/public-key').expect(200);
  assert.equal(publicKey.body.algorithm, 'Ed25519');
  assert.equal(publicKey.body.keyId, certificate.keyId);
  assert.match(publicKey.body.publicKeyPem, /BEGIN PUBLIC KEY/);
  const repeated = await certs.issueCertificate({
    db: ctx.db, user, courseId: 'fondamenti', courseTitle: { it: 'Altro', en: 'Other' }, name: user.name, score: 100,
  });
  assert.equal(repeated.code, certificate.code);
  assert.equal(user.certificates.length, 1);

  const publicResult = await request(app).get(`/api/certificates/${certificate.code}`).expect(200);
  assert.equal(publicResult.body.valid, true);
  assert.equal(publicResult.body.certificate.name, user.name);
  assert.equal(publicResult.body.certificate.email, undefined);
  assert.equal(publicResult.body.keyId, certificate.keyId);
  assert.equal(publicResult.body.fingerprint.paths.length > 0, true);
  assert.match(publicResult.body.qrSvg, /^<svg/);
  const englishResult = await request(app).get(`/api/certificates/${certificate.code}`)
    .set('X-EVIL-Lang', 'en')
    .expect(200);
  assert.equal(englishResult.body.certificate.courseTitle, 'Foundations');
  const mine = await agent.get('/api/certificates/mine').expect(200);
  assert.equal(mine.body.certificates.length, 1);
  assert.equal(mine.body.certificates[0].code, certificate.code);

  await request(app).get(`/api/certificates/${certificate.code}/pdf`).expect(401);
  const { agent: otherAgent } = await registeredAgent(app, { name: 'Altra Persona' });
  await otherAgent.get(`/api/certificates/${certificate.code}/pdf`).expect(404);
  const pdf = await agent.get(`/api/certificates/${certificate.code}/pdf`).expect(200);
  assert.match(pdf.headers['content-type'], /application\/pdf/);

  user.certificates[0].name = 'Nome alterato';
  await ctx.db.save(user);
  assert.equal(certs.verifyRecord(user.certificates[0]).valid, false);
  const invalidResult = await request(app).get(`/api/certificates/${certificate.code}`).expect(200);
  assert.equal(invalidResult.body.valid, false);

  user.certificates[0].name = user.name;
  user.certificates[0].courseTitle.it = 'Corso alterato';
  assert.equal(certs.verifyRecord(user.certificates[0]).valid, false);
  await request(app).get('/api/certificates/EVIL-FND-2345-6789-ABCD').expect(404);
  await agent.get(`/api/certificates/${certificate.code}/pdf`).expect(404);
});

test('esame finale: valutazione lato server e diploma emesso solo al superamento', async () => {
  const { app, ctx } = await createTestApp();
  const { agent, userId } = await registeredAgent(app);
  await completeCourse(agent, 'fondamenti');
  const start = await agent.post('/api/courses/fondamenti/exam/start').send({}).expect(200);
  assert.equal(start.body.questions.length, 10);
  assert.equal(start.body.passScore, 70);

  const user = ctx.db.findById(userId);
  const attempt = user.courseExamAttempts.find((item) => item.id === start.body.attemptId);
  const exported = await agent.get('/api/auth/account/export').expect(200);
  assert.equal('answerOrder' in exported.body.account.courseExamAttempts[0], false);
  const answers = {};
  for (const [id, , , correctIndex] of exams.COURSES.fondamenti.questions) {
    answers[id] = attempt.answerOrder[id].indexOf(correctIndex);
  }
  const submission = await agent.post('/api/courses/fondamenti/exam/submit')
    .send({ attemptId: start.body.attemptId, answers })
    .expect(200);
  assert.equal(submission.body.passed, true);
  assert.equal(submission.body.score, 100);
  assert.match(submission.body.certificate.code, certs.CODE_RE);
  assert.equal(user.certificates.length, 1);

  await agent.post('/api/courses/fondamenti/exam/submit')
    .send({ attemptId: start.body.attemptId, answers })
    .expect(409);
});

test('diploma inesistente: la verifica pubblica restituisce 404', async () => {
  const { app } = await createTestApp();
  await request(app).get('/api/certificates/EVIL-WEB-2345-6789-ABCD').expect(404);
});

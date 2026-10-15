'use strict';
const assert = require('node:assert/strict');
const content = require('../../server/lib/course-content');
const design = require('../../server/lib/course-design');

const api = (courseId) => `/api/courses/${courseId}`;

async function doLessons(agent, courseId, module) {
  const md = design.getDesign(courseId).modules[module.id];
  for (const lesson of module.lessons) {
    const loaded = await agent.get(`${api(courseId)}/lessons/${lesson.id}`).expect(200);
    assert.equal(loaded.body.check.options.every((option) => Number.isInteger(option.i) && typeof option.text === 'string'), true);
    await agent.post(`${api(courseId)}/lessons/${lesson.id}/check`).send({ answer: md.lessons[lesson.id].check.correct }).expect(200)
      .then(({ body }) => assert.equal(body.correct, true));
    await agent.post(`${api(courseId)}/lessons/${lesson.id}/complete`).send({}).expect(200);
  }
}

function labAnswers(lab) {
  if (lab.kind === 'classify') return Object.fromEntries(lab.items.map((item) => [item.id, item.cat]));
  if (lab.kind === 'order') return { order: lab.items.map((item) => item.id) };
  return { selected: lab.options.filter((option) => option.right).map((option) => option.id) };
}

async function doLab(agent, courseId, module, answers) {
  const lab = design.getDesign(courseId).modules[module.id].lab;
  await agent.get(`${api(courseId)}/levels/${module.id}/lab`).expect(200);
  return agent.post(`${api(courseId)}/levels/${module.id}/lab/submit`).send({ answers: answers || labAnswers(lab) }).expect(200);
}

async function doQuiz(agent, courseId, module, perfect = true) {
  await agent.get(`${api(courseId)}/levels/${module.id}/quiz`).expect(200);
  const answers = Object.fromEntries(module.quiz.map((question) => [question.id, perfect ? question.correctIndex : (question.correctIndex + 1) % question.options.length]));
  return agent.post(`${api(courseId)}/levels/${module.id}/quiz/submit`).send({ answers }).expect(200);
}

async function completeCourse(agent, courseId) {
  for (const module of content.getCourse(courseId).modules) {
    await doLessons(agent, courseId, module);
    const lab = await doLab(agent, courseId, module);
    assert.equal(lab.body.passed, true);
    const quiz = await doQuiz(agent, courseId, module);
    assert.equal(quiz.body.passed, true);
  }
}

module.exports = { doLessons, doLab, doQuiz, labAnswers, completeCourse };

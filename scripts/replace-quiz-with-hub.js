#!/usr/bin/env node
/** Sostituisce Quiz Phishing + Simulatore SE → Centro Quiz in tutte le pagine HTML */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const htmlDir = path.join(root, 'html');

const OLD_BLOCK = `<a href="phishing-quiz.html">Quiz Phishing</a>
              <a href="social-engineering.html">Simulatore Social Engineering</a>`;

const NEW_BLOCK = `<a href="quiz-hub.html">Centro Quiz</a>`;

const OLD_BLOCK_COMPACT = `<a href="phishing-quiz.html">Quiz Phishing</a>\n              <a href="social-engineering.html">Simulatore Social Engineering</a>`;

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (!name.startsWith('.')) walk(p, acc);
    } else if (name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

let n = 0;
for (const file of walk(htmlDir)) {
  if (file.endsWith('phishing-quiz.html') || file.endsWith('social-engineering.html')) continue;
  let c = fs.readFileSync(file, 'utf8');
  const before = c;
  if (c.includes(OLD_BLOCK)) {
    c = c.replace(OLD_BLOCK, NEW_BLOCK);
  } else if (c.includes(OLD_BLOCK_COMPACT)) {
    c = c.replace(OLD_BLOCK_COMPACT, NEW_BLOCK);
  }
  c = c.split('phishing-quiz.html').join('quiz-hub.html');
  c = c.split('social-engineering.html').join('quiz-hub.html');
  c = c.split('Quiz Phishing').join('Centro Quiz');
  c = c.split('Simulatore Social Engineering').join('Centro Quiz');
  c = c.split('>Centro Quiz</a>\n              <a href="quiz-hub.html">Centro Quiz</a>').join('>Centro Quiz</a>');
  if (c !== before) {
    fs.writeFileSync(file, c, 'utf8');
    console.log('✓', path.relative(root, file));
    n++;
  }
}

console.log(`\nAggiornati ${n} file HTML.`);

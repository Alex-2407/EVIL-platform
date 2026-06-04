const fs = require('fs');
const p = 'C:/Users/Alessandro.branca/Desktop/EVIL-platform-main/html/web-simulator.html';
const t = fs.readFileSync(p, 'utf8');
const i = t.indexOf('Impara');
const slice = t.slice(i, i + 25);
console.log(JSON.stringify(slice));
for (let j = i; j < i + 15; j++) {
  const c = t[j];
  console.log(j - i, c, c.charCodeAt(0).toString(16));
}
console.log('FFFD count', (t.match(/\uFFFD/g) || []).length);

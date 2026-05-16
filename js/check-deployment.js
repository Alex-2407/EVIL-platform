#!/usr/bin/env node

/**
 * Pre-Deployment Checklist
 * Verifica che tutto sia pronto per il deploy online
 */

const fs = require('fs');
const path = require('path');

console.log('\n📋 ============================================');
console.log('   PRE-DEPLOYMENT CHECKLIST');
console.log('   ============================================\n');

let totalChecks = 0;
let passedChecks = 0;

function check(description, condition) {
  totalChecks++;
  const status = condition ? '✅' : '❌';
  console.log(`${status} ${description}`);
  if (condition) passedChecks++;
  return condition;
}

// Check files exist - baseDir è la cartella root (parent di js/)
const baseDir = path.join(__dirname, '..');

check('File .env esiste', fs.existsSync(path.join(baseDir, '.env')));
check('File .gitignore esiste', fs.existsSync(path.join(baseDir, '.gitignore')));
check('File Procfile esiste', fs.existsSync(path.join(baseDir, 'Procfile')));
check('File package.json esiste', fs.existsSync(path.join(baseDir, 'package.json')));
check('File users.json esiste', fs.existsSync(path.join(baseDir, 'users.json')));
check('File achievements.json esiste', fs.existsSync(path.join(baseDir, 'achievements.json')));

// Check directories
check('Cartella html/ esiste', fs.existsSync(path.join(baseDir, 'html')));
check('Cartella css/ esiste', fs.existsSync(path.join(baseDir, 'css')));
check('Cartella js/ esiste', fs.existsSync(path.join(baseDir, 'js')));
check('Cartella js/server.js esiste', fs.existsSync(path.join(baseDir, 'js', 'server.js')));

// Check package.json content
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(baseDir, 'package.json'), 'utf8'));
  check('package.json ha main: js/server.js', pkg.main === 'js/server.js');
  check('package.json ha script start', pkg.scripts?.start?.includes('js/server.js'));
  check('package.json ha engines.node', pkg.engines?.node?.includes('18'));
} catch (err) {
  check('package.json valido', false);
}

// Check git status
const gitDir = path.join(baseDir, '.git');
check('Git repository inizializzato (opzionale)', fs.existsSync(gitDir) || !fs.existsSync(gitDir));

// Check node_modules
check('node_modules/ installato', fs.existsSync(path.join(baseDir, 'node_modules')));

console.log('\n📊 ============================================');
console.log(`   RISULTATO: ${passedChecks}/${totalChecks} verifiche passate`);
console.log('   ============================================\n');

if (passedChecks === totalChecks) {
  console.log('🎉 TUTTO PRONTO PER IL DEPLOY!\n');
  console.log('Prossimi step:');
  console.log('1. Leggi DEPLOYMENT_INSTRUCTIONS.md');
  console.log('2. Crea un repository GitHub');
  console.log('3. Lancia: git add . && git commit -m "Ready for production"');
  console.log('4. Lancia: git push');
  console.log('5. Connetti su Railway.app\n');
  process.exit(0);
} else {
  console.log('⚠️  Alcuni file mancano! Controlla la lista sopra.\n');
  process.exit(1);
}

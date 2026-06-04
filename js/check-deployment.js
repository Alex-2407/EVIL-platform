#!/usr/bin/env node

/**
 * Pre-Deployment Checklist
 * Verifica che tutto sia pronto per il deploy online
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('\n📋 ============================================');
console.log('   PRE-DEPLOYMENT CHECKLIST');
console.log('   ============================================\n');

let totalChecks = 0;
let passedChecks = 0;
let warnings = [];

function check(description, condition) {
  totalChecks++;
  const status = condition ? '✅' : '❌';
  console.log(`${status} ${description}`);
  if (condition) passedChecks++;
  return condition;
}

function warn(description, condition) {
  if (!condition) {
    warnings.push(description);
    console.log(`⚠️  ${description}`);
  } else {
    console.log(`✅ ${description}`);
  }
}

const baseDir = path.join(__dirname, '..');

check('File .env esiste', fs.existsSync(path.join(baseDir, '.env')));
check('File .gitignore esiste', fs.existsSync(path.join(baseDir, '.gitignore')));
check('Procfile usa npm start', (() => {
  try {
    return fs.readFileSync(path.join(baseDir, 'Procfile'), 'utf8').includes('npm start');
  } catch {
    return false;
  }
})());
check('File package.json esiste', fs.existsSync(path.join(baseDir, 'package.json')));
check('File achievements.json esiste', fs.existsSync(path.join(baseDir, 'achievements.json')));

check('Cartella html/ esiste', fs.existsSync(path.join(baseDir, 'html')));
check('Pagina trofei preview', fs.existsSync(path.join(baseDir, 'html', 'trophy-preview-local.html')));
check('Pagina musichette preview', fs.existsSync(path.join(baseDir, 'html', 'jingle-preview-local.html')));
check('js/server.js esiste', fs.existsSync(path.join(baseDir, 'js', 'server.js')));
check('SSRF guard (assertSafePublicUrl)', fs.readFileSync(path.join(baseDir, 'middleware', 'sanitization.js'), 'utf8').includes('assertSafePublicUrl'));
check('Health endpoint in server', fs.readFileSync(path.join(baseDir, 'js', 'server.js'), 'utf8').includes("app.get(['/health', '/api/health']"));
check('Register rate limit attivo', !fs.readFileSync(path.join(baseDir, 'middleware', 'limiter.js'), 'utf8').includes('registerLimiter = (req, res, next) => next()'));

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(baseDir, 'package.json'), 'utf8'));
  check('package.json ha main: js/server.js', pkg.main === 'js/server.js');
  check('package.json ha script start', pkg.scripts?.start?.includes('js/server.js'));
  check('package.json ha engines.node', pkg.engines?.node?.includes('18'));
} catch {
  check('package.json valido', false);
}

check('node_modules/ installato', fs.existsSync(path.join(baseDir, 'node_modules')));

const isProd = process.env.NODE_ENV === 'production';
const jwt = process.env.JWT_SECRET || '';
const weak = ['your_super_secret', 'change_this', 'minimum_32', 'example'];

if (isProd) {
  check('JWT_SECRET impostato (produzione)', jwt.length >= 32);
  check('JWT_SECRET non è placeholder (produzione)', !weak.some((p) => jwt.includes(p)));
  warn('BASE_URL https in produzione', /^https:\/\//i.test(process.env.BASE_URL || ''));
  warn('EMAIL_DEV_OUTBOX disattivato in produzione', process.env.EMAIL_DEV_OUTBOX !== '1');
  warn('EVIL_TOOLS_PUBLIC non forzato a 1 in produzione', process.env.EVIL_TOOLS_PUBLIC !== '1');
} else {
  console.log('\nℹ️  NODE_ENV≠production — controlli JWT/BASE_URL produzione saltati');
  warn('JWT_SECRET personalizzato (consigliato)', jwt.length >= 32 && !weak.some((p) => jwt.includes(p)));
}

console.log('\n📊 ============================================');
console.log(`   RISULTATO: ${passedChecks}/${totalChecks} verifiche passate`);
if (warnings.length) {
  console.log(`   Avvisi: ${warnings.length}`);
}
console.log('   ============================================\n');

if (passedChecks === totalChecks) {
  console.log('🎉 CHECKLIST BASE OK — pronto per deploy.\n');
  console.log('Prossimi step produzione:');
  console.log('1. Imposta NODE_ENV=production, BASE_URL=https://..., JWT_SECRET unico');
  console.log('2. EVIL_TOOLS_PUBLIC lasciato disattivato — login obbligatorio per gli strumenti');
  console.log('3. EMAIL_DEV_OUTBOX=0 + SMTP live');
  console.log('4. REDIS_URL per refresh token condivisi');
  console.log('5. Deploy su Railway/Render con Procfile (npm start)\n');
  process.exit(warnings.length && isProd ? 1 : 0);
}

console.log('⚠️  Alcune verifiche obbligatorie non passate.\n');
process.exit(1);

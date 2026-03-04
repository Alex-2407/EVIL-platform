#!/usr/bin/env node

const http = require('http');

console.log('\n🔍 VERIFICA SERVIZI - TOTAL EVIL SYSTEM\n');
console.log('═'.repeat(60));

let passed = 0;
let failed = 0;

const tests = [
  { name: 'Health Check API', path: '/api/health' },
  { name: 'Home Page', path: '/' },
  { name: 'Login Page', path: '/login.html' },
  { name: 'Progress Manager', path: '/progress-manager.js' },
  { name: 'Auth Manager', path: '/auth-manager.js' },
  { name: 'CSS Resources', path: '/style.css' },
  { name: 'Security Check', path: '/security-check.html' },
  { name: 'Attacks Map', path: '/attacks-map.html' },
];

async function testEndpoint(name, path) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log(`  ✅ ${name.padEnd(25)} [200 OK]`);
        passed++;
      } else {
        console.log(`  ⚠️  ${name.padEnd(25)} [${res.statusCode}]`);
        failed++;
      }
      resolve();
    });

    req.on('error', (err) => {
      console.log(`  ❌ ${name.padEnd(25)} [${err.code}]`);
      failed++;
      resolve();
    });

    req.on('timeout', () => {
      console.log(`  ⏱️  ${name.padEnd(25)} [TIMEOUT]`);
      failed++;
      req.destroy();
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  console.log('  Contacting server on localhost:5000...\n');
  
  for (const test of tests) {
    await testEndpoint(test.name, test.path);
  }

  console.log('\n' + '═'.repeat(60));
  const total = passed + failed;
  console.log(`\n  ✅ Servizi Online:  ${passed}`);
  console.log(`  ❌ Servizi Offline: ${failed}`);
  console.log(`  📊 Percentuale:     ${total > 0 ? Math.round((passed / total) * 100) : 0}%`);
  console.log('\n' + '═'.repeat(60));

  if (failed === 0 && passed > 0) {
    console.log('\n  🎉 TUTTI I SERVIZI FUNZIONANO CORRETTAMENTE!\n');
    process.exit(0);
  } else if (passed > 0) {
    console.log(`\n  ⚠️  ${failed}/${total} servizi hanno problemi\n`);
    process.exit(1);
  } else {
    console.log('\n  ❌ Nessun servizio è raggiungibile\n');
    console.log('  Verifica se il server è avviato:\n');
    console.log('  cd z:\\Quinta\\"Quinta di oggi"\\Info\\TPSI\\20.01.2026\\"Alessandro Branca"\\"TOTAL EVIL"');
    console.log('  node js\\server.js\n');
    process.exit(2);
  }
}

runTests().catch(console.error);

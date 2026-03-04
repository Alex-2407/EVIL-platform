const http = require('http');

console.log('\n🔍 VERIFICA SERVIZI - TOTAL EVIL SYSTEM\n');
console.log('═'.repeat(60));

let passed = 0;
let failed = 0;

const tests = [
  { name: 'Health Check', path: '/api/health', host: 'localhost' },
  { name: 'Home Page', path: '/', host: 'localhost' },
  { name: 'Login Page', path: '/login.html', host: 'localhost' },
  { name: 'Progress Manager', path: '/js/progress-manager.js', host: 'localhost' },
  { name: 'Auth Manager', path: '/js/auth-manager.js', host: 'localhost' },
  { name: 'CSS Resources', path: '/style.css', host: 'localhost' },
  { name: 'Security Check', path: '/security-check.html', host: 'localhost' },
  { name: 'Attacks Map', path: '/attacks-map.html', host: 'localhost' },
];

async function testEndpoint(name, path, host) {
  return new Promise((resolve) => {
    const options = {
      hostname: host,
      port: 5000,
      path: path,
      method: 'GET',
      timeout: 5000
    };

    const req = http.request(options, (res) => {
      if (res.statusCode === 200) {
        console.log(`✅ ${name.padEnd(25)} [${res.statusCode}]`);
        passed++;
      } else {
        console.log(`⚠️  ${name.padEnd(25)} [${res.statusCode}]`);
        failed++;
      }
      resolve();
    });

    req.on('error', (err) => {
      console.log(`❌ ${name.padEnd(25)} [${err.code}]`);
      failed++;
      resolve();
    });

    req.on('timeout', () => {
      console.log(`⏱️  ${name.padEnd(25)} [TIMEOUT]`);
      failed++;
      req.destroy();
      resolve();
    });

    req.end();
  });
}

async function runTests() {
  for (const test of tests) {
    await testEndpoint(test.name, test.path, test.host);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n✅ Servizi Online:  ${passed}`);
  console.log(`❌ Servizi Offline: ${failed}`);
  console.log(`📊 Percentuale:     ${Math.round((passed / (passed + failed)) * 100)}%`);
  console.log('\n' + '═'.repeat(60));

  if (failed === 0) {
    console.log('\n🎉 TUTTI I SERVIZI FUNZIONANO CORRETTAMENTE!\n');
  } else if (passed > 0) {
    console.log(`\n⚠️  ${failed}/${passed + failed} servizi hanno problemi\n`);
  } else {
    console.log('\n❌ Nessun servizio è raggiungibile\n');
  }

  console.log('═'.repeat(60) + '\n');
}

runTests();

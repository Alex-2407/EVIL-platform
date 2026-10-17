/**
 * Laboratorio Virtuale EVIL — VM isolate simulate (solo rete lab 10.42.x.x).
 * Nessuna connessione reale: risposte didattiche controllate lato server.
 */
const crypto = require('crypto');
const { t } = require('../server/i18n');

// I campi rivolti all'utente del catalogo sono oggetti {it, en}: pick() restituisce
// la versione nella lingua della sessione, con l'italiano come ripiego.
function pick(lang, value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return (lang && value[lang]) || value.it || value.en || '';
  }
  return value;
}

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_OWNER = 3;
// Un'aula intera può uscire da un solo IP pubblico: il limite per IP è largo,
// quello per persona (account o cookie anonimo del browser) resta 3.
const MAX_SESSIONS_PER_IP = parseInt(process.env.VLAB_MAX_SESSIONS_PER_IP || '60', 10);
const MAX_TOTAL_SESSIONS = parseInt(process.env.VLAB_MAX_TOTAL_SESSIONS || '3000', 10);
const LAB_ID_PATTERN = /^[a-z0-9-]+$/i;
const SESSION_ID_PATTERN = /^[a-f0-9]{24}$/;
const ANON_COOKIE = 'evil_lab_anon';
const ANON_ID_PATTERN = /^[a-f0-9-]{16,64}$/i;

let redisClient;
function getRedis() {
  if (redisClient !== undefined) return redisClient || null;
  const url = process.env.REDIS_URL && String(process.env.REDIS_URL).trim();
  if (!url) {
    redisClient = null;
    return null;
  }
  try {
    const Redis = require('ioredis');
    redisClient = new Redis(url, { protocol: 2 });
    let logged = false;
    redisClient.on('error', (err) => {
      if (!logged) {
        console.warn('⚠️ Virtual lab Redis:', err.message);
        logged = true;
      }
    });
    return redisClient;
  } catch (err) {
    console.warn('⚠️ Virtual lab Redis init failed:', err.message);
    redisClient = null;
    return null;
  }
}

function sessionRedisKey(id) {
  return `vlab:session:${id}`;
}

function ownerRedisKey(ownerKey) {
  return `vlab:owner:${ownerKey}`;
}

const ATTACKER = {
  hostname: 'jumpbox.evil.lab',
  ip: '10.42.0.2',
  user: 'evil-kali',
  prompt: 'evil-kali@jumpbox:~$',
};

// Livelli didattici (glossario docs/I18N.md: base/intermedio/avanzato).
const LV = {
  base: { it: 'Base', en: 'Beginner' },
  inter: { it: 'Intermedio', en: 'Intermediate' },
  adv: { it: 'Avanzato', en: 'Advanced' },
};

// I testi rivolti all'utente sono oggetti {it, en}: il servizio risponde nella lingua
// della richiesta (vedi pick() e il campo session.lang). I campi tecnici (nmap, ssh, web…)
// restano identici nelle due lingue. Nessun valore di flag compare negli obiettivi o nei
// suggerimenti: la flag si trova sfruttando lo scenario.
const LAB_CATALOG = {
  'network-recon': {
    id: 'network-recon',
    name: 'EVIL-NetProbe',
    title: { it: 'Ricognizione di rete', en: 'Network reconnaissance' },
    level: LV.base,
    duration: '~15 min',
    audience: {
      it: 'Chi inizia con i test di sicurezza autorizzati e vuole imparare a mappare un perimetro.',
      en: 'People starting with authorised security testing who want to learn how to map a perimeter.',
    },
    prerequisites: {
      it: 'Nozioni di base su TCP/IP, porte e servizi di rete.',
      en: 'Basic understanding of TCP/IP, ports and network services.',
    },
    targetIp: '10.42.10.5',
    hostname: 'gateway.evil.lab',
    icon: '◈',
    description: {
      it: 'In un test autorizzato il primo passo è mappare host, porte e servizi in perimetro. Qui lo fai con nmap su un target isolato.',
      en: 'In an authorised test the first step is to map hosts, ports and services in scope. Here you do it with nmap against an isolated target.',
    },
    objectives: {
      it: [
        'Esegui una scansione con nmap sul target 10.42.10.5',
        'Identifica almeno due servizi in ascolto e le loro versioni',
        'Trova la flag e consegnala con submit flag <flag>',
        'Difendi: riduci la superficie esposta e verifica come rilevare una scansione',
      ],
      en: [
        'Run an nmap scan against the target 10.42.10.5',
        'Identify at least two listening services and their versions',
        'Find the flag and submit it with submit flag <flag>',
        'Defend: reduce the exposed surface and check how a scan is detected',
      ],
    },
    flag: 'EVIL{recon_complete}',
    hints: {
      it: [
        'Prova una scansione delle versioni: nmap -sV 10.42.10.5',
        'Guarda le righe con STATE open: annota porte e servizi che potresti approfondire.',
      ],
      en: [
        'Try a version scan: nmap -sV 10.42.10.5',
        'Look at the lines with STATE open: note the ports and services worth investigating.',
      ],
    },
    remediation: {
      fix: {
        it: 'Esponi solo le porte necessarie, chiudi i servizi inutilizzati e metti davanti un firewall con allowlist; tieni aggiornati i servizi raggiungibili.',
        en: 'Expose only the ports you need, close unused services and put an allowlist firewall in front; keep reachable services patched.',
      },
      detect: {
        it: 'Un IDS/IPS e i log del firewall segnalano le scansioni: molte connessioni verso porte diverse dallo stesso IP in pochi secondi.',
        en: 'An IDS/IPS and firewall logs flag scans: many connections to different ports from the same IP within seconds.',
      },
    },
    nmap: {
      ports: [
        { port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 9.6' },
        { port: 80, state: 'open', service: 'http', version: 'nginx 1.26' },
        { port: 443, state: 'open', service: 'https', version: 'nginx 1.26' },
      ],
    },
  },
  'web-app-01': {
    id: 'web-app-01',
    name: 'EVIL-WebTarget',
    title: { it: 'SQL injection sul login', en: 'Login SQL injection' },
    level: LV.base,
    duration: '~20 min',
    audience: {
      it: 'Chi sviluppa o testa applicazioni web e vuole capire da dentro una SQL injection.',
      en: 'People who build or test web apps and want to understand SQL injection from the inside.',
    },
    prerequisites: {
      it: 'Basi di HTTP e di query SQL; saper leggere una richiesta POST.',
      en: 'Basics of HTTP and SQL queries; able to read a POST request.',
    },
    targetIp: '10.42.10.11',
    hostname: 'web-target.evil.lab',
    icon: '◇',
    description: {
      it: 'Un login che costruisce la query SQL concatenando l\'input utente. Scenario autorizzato in rete isolata.',
      en: 'A login that builds its SQL query by concatenating user input. Authorised scenario on an isolated network.',
    },
    objectives: {
      it: [
        'Scansiona 10.42.10.11 e verifica la porta 80',
        'Recupera la pagina di login con curl',
        'Prova un bypass dell\'autenticazione tramite SQL injection',
        'Trova la flag e consegnala con submit flag <flag>',
        'Difendi: correggi la query e indica come rilevare l\'attacco',
      ],
      en: [
        'Scan 10.42.10.11 and confirm port 80',
        'Fetch the login page with curl',
        'Try an authentication bypass through SQL injection',
        'Find the flag and submit it with submit flag <flag>',
        'Defend: fix the query and explain how the attack is detected',
      ],
    },
    flag: 'EVIL{sqli_login_bypass}',
    hints: {
      it: [
        'Scarica prima il form: curl http://10.42.10.11/login',
        'Un login che concatena l\'input accetta una condizione sempre vera nel campo user.',
      ],
      en: [
        'Fetch the form first: curl http://10.42.10.11/login',
        'A login that concatenates input will accept an always-true condition in the user field.',
      ],
    },
    remediation: {
      fix: {
        it: 'Usa query parametrizzate (prepared statement) con binding dei valori, mai concatenazione di stringhe; valida l\'input e dai all\'utente DB il minimo dei privilegi.',
        en: 'Use parameterised queries (prepared statements) with value binding, never string concatenation; validate input and give the DB user least privilege.',
      },
      detect: {
        it: 'Un WAF e i log applicativi segnalano apici e sintassi SQL nei parametri; picchi di errori SQL indicano tentativi di injection.',
        en: 'A WAF and application logs flag quotes and SQL syntax in parameters; spikes of SQL errors indicate injection attempts.',
      },
    },
    nmap: {
      ports: [
        { port: 80, state: 'open', service: 'http', version: 'nginx 1.24' },
        { port: 3306, state: 'filtered', service: 'mysql', version: '' },
      ],
    },
    web: {
      loginHtml: `<!DOCTYPE html>
<html><head><title>EVIL Intranet Login</title></head>
<body><h1>Area riservata</h1>
<form method="POST" action="/login">
  user: <input name="user"><br>
  pass: <input name="pass" type="password"><br>
  <button>Accedi</button>
</form></body></html>`,
    },
  },
  'linux-ssh-01': {
    id: 'linux-ssh-01',
    name: 'EVIL-LinuxBox',
    title: { it: 'Accesso SSH con credenziali deboli', en: 'Weak SSH credentials' },
    level: LV.inter,
    duration: '~15 min',
    audience: {
      it: 'Amministratori di sistema e tester che valutano la robustezza dell\'accesso SSH.',
      en: 'System administrators and testers assessing the strength of SSH access.',
    },
    prerequisites: {
      it: 'Uso base del terminale Linux e del comando ssh.',
      en: 'Basic Linux terminal use and familiarity with the ssh command.',
    },
    targetIp: '10.42.10.21',
    hostname: 'linuxbox.evil.lab',
    icon: '▣',
    description: {
      it: 'Un server Linux con una password prevedibile: uno dei vettori più comuni negli ambienti mal configurati.',
      en: 'A Linux server with a predictable password: one of the most common vectors in misconfigured environments.',
    },
    objectives: {
      it: [
        'Individua la porta SSH con nmap',
        'Accedi con l\'utente di prova documentato (chiedi hint)',
        'Leggi /home/student/notes.txt e trova la flag',
        'Consegnala con submit flag <flag>',
        'Difendi: imposta autenticazione a chiave e indica come rilevare i tentativi',
      ],
      en: [
        'Find the SSH port with nmap',
        'Log in with the documented test account (ask for a hint)',
        'Read /home/student/notes.txt and find the flag',
        'Submit it with submit flag <flag>',
        'Defend: enforce key-based auth and explain how attempts are detected',
      ],
    },
    flag: 'EVIL{weak_ssh_creds}',
    hints: {
      it: [
        'Conferma la porta 22: nmap -p 22 10.42.10.21',
        'In questo scenario l\'utente student ha la password di prova evil-lab-01.',
      ],
      en: [
        'Confirm port 22: nmap -p 22 10.42.10.21',
        'In this scenario the student user has the test password evil-lab-01.',
      ],
    },
    remediation: {
      fix: {
        it: 'Disabilita l\'autenticazione a password (PasswordAuthentication no), usa solo chiavi SSH, imponi password robuste dove servono e aggiungi fail2ban con MFA.',
        en: 'Disable password authentication (PasswordAuthentication no), use SSH keys only, enforce strong passwords where needed and add fail2ban with MFA.',
      },
      detect: {
        it: 'Le righe "Failed password" ripetute in /var/log/auth.log da uno stesso IP indicano un attacco in corso.',
        en: 'Repeated "Failed password" lines in /var/log/auth.log from the same IP indicate an ongoing attack.',
      },
    },
    nmap: {
      ports: [{ port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 9.6' }],
    },
    ssh: {
      user: 'student',
      password: 'evil-lab-01',
      files: {
        '/home/student/notes.txt': 'Appunti lab — la flag di questo scenario è EVIL{weak_ssh_creds}\nNon riutilizzare credenziali deboli in produzione.',
        '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nstudent:x:1000:1000:Lab User:/home/student:/bin/bash',
      },
    },
  },
  'linux-privesc-01': {
    id: 'linux-privesc-01',
    name: 'EVIL-Server',
    title: { it: 'Privilege escalation via sudo', en: 'Privilege escalation via sudo' },
    level: LV.adv,
    duration: '~25 min',
    audience: {
      it: 'Tester e amministratori che vogliono capire come una regola sudo troppo larga porti a root.',
      en: 'Testers and administrators who want to see how an over-broad sudo rule leads to root.',
    },
    prerequisites: {
      it: 'Buona confidenza con la shell Linux, i permessi e il meccanismo sudo.',
      en: 'Good comfort with the Linux shell, permissions and the sudo mechanism.',
    },
    targetIp: '10.42.10.22',
    hostname: 'privesc.evil.lab',
    icon: '⬡',
    description: {
      it: 'Shell limitata e una regola sudo troppo permissiva: da utente normale a root, in uno scenario didattico.',
      en: 'A limited shell and an over-permissive sudo rule: from a normal user to root, in a teaching scenario.',
    },
    objectives: {
      it: [
        'Accedi con l\'utente dev (vedi hint per le credenziali di prova)',
        'Esegui sudo -l e individua il binario sfruttabile',
        'Ottieni una shell con privilegi elevati',
        'Leggi /root/flag.txt, trova la flag e consegnala con submit flag <flag>',
        'Difendi: restringi sudoers e indica come rilevare l\'abuso',
      ],
      en: [
        'Log in as the dev user (see hint for test credentials)',
        'Run sudo -l and spot the abusable binary',
        'Obtain a shell with elevated privileges',
        'Read /root/flag.txt, find the flag and submit it with submit flag <flag>',
        'Defend: tighten sudoers and explain how the abuse is detected',
      ],
    },
    flag: 'EVIL{sudo_find_shell}',
    hints: {
      it: [
        'Credenziali di prova dello scenario: dev / evil-lab-dev.',
        'Un binario con -exec può lanciare una shell: consulta GTFOBins per il comando esatto.',
      ],
      en: [
        'Scenario test credentials: dev / evil-lab-dev.',
        'A binary with -exec can spawn a shell: check GTFOBins for the exact command.',
      ],
    },
    remediation: {
      fix: {
        it: 'Concedi in sudoers solo i comandi strettamente necessari, evita binari che aprono shell (find, vim, less…) con NOPASSWD e preferisci wrapper controllati.',
        en: 'Grant only the strictly necessary commands in sudoers, avoid shell-spawning binaries (find, vim, less…) with NOPASSWD and prefer controlled wrappers.',
      },
      detect: {
        it: 'auditd sulle execve e i log di sudo mostrano un utente normale che lancia /bin/sh tramite un comando sudo: segnale chiaro di escalation.',
        en: 'auditd on execve and sudo logs show a normal user spawning /bin/sh through a sudo command: a clear escalation signal.',
      },
    },
    nmap: {
      ports: [{ port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 9.6' }],
    },
    ssh: {
      user: 'dev',
      password: 'evil-lab-dev',
      files: {
        '/home/dev/readme.txt': 'Utente dev — prova sudo -l per vedere cosa puoi eseguire.',
      },
      sudo: {
        allowed: '/usr/bin/find',
        output: 'User dev may run the following commands on privesc:\n    (ALL) NOPASSWD: /usr/bin/find',
      },
      rootFiles: {
        '/root/flag.txt': 'EVIL{sudo_find_shell}',
      },
    },
  },
  'xss-reflected': {
    id: 'xss-reflected',
    name: 'EVIL-XSSLab',
    title: { it: 'Cross-Site Scripting (XSS) riflesso', en: 'Reflected Cross-Site Scripting (XSS)' },
    level: LV.base,
    duration: '~15 min',
    audience: {
      it: 'Sviluppatori front-end e tester che vogliono capire perché l\'output va sempre codificato.',
      en: 'Front-end developers and testers who want to understand why output must always be encoded.',
    },
    prerequisites: {
      it: 'Basi di HTML/JavaScript e del modo in cui il browser esegue gli script.',
      en: 'Basics of HTML/JavaScript and how the browser executes scripts.',
    },
    targetIp: '10.42.10.12',
    hostname: 'xss-lab.evil.lab',
    icon: '◆',
    description: {
      it: 'Un parametro di ricerca che rimanda l\'input nella pagina senza codifica: il browser lo esegue come codice.',
      en: 'A search parameter that reflects input back into the page without encoding: the browser runs it as code.',
    },
    objectives: {
      it: [
        'Scansiona 10.42.10.12 e apri la pagina di ricerca',
        'Dimostra l\'esecuzione di uno script nel parametro q',
        'Trova la flag e consegnala con submit flag <flag>',
        'Difendi: codifica l\'output e indica come rilevare l\'XSS',
      ],
      en: [
        'Scan 10.42.10.12 and open the search page',
        'Demonstrate script execution through the q parameter',
        'Find the flag and submit it with submit flag <flag>',
        'Defend: encode the output and explain how XSS is detected',
      ],
    },
    flag: 'EVIL{xss_reflected}',
    hints: {
      it: [
        'Osserva come torna l\'input: curl "http://10.42.10.12/search?q=test"',
        'Se l\'input non è codificato, un tag <script> nel parametro q viene eseguito.',
      ],
      en: [
        'See how the input comes back: curl "http://10.42.10.12/search?q=test"',
        'If the input is not encoded, a <script> tag in the q parameter is executed.',
      ],
    },
    remediation: {
      fix: {
        it: 'Codifica l\'output in base al contesto (HTML, attributo, JS), usa l\'escaping automatico del framework e applica una Content-Security-Policy restrittiva.',
        en: 'Encode output according to context (HTML, attribute, JS), rely on the framework\'s auto-escaping and apply a strict Content-Security-Policy.',
      },
      detect: {
        it: 'Un WAF e i report di violazione della CSP segnalano tag <script> o handler on* riflessi nelle risposte.',
        en: 'A WAF and CSP violation reports flag <script> tags or on* handlers reflected in responses.',
      },
    },
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'Apache 2.4' }],
    },
    web: { type: 'xss' },
  },
  'lfi-web': {
    id: 'lfi-web',
    name: 'EVIL-LFILab',
    title: { it: 'Local File Inclusion', en: 'Local File Inclusion' },
    level: LV.inter,
    duration: '~20 min',
    audience: {
      it: 'Sviluppatori e tester che vogliono capire i rischi del path controllato dall\'utente.',
      en: 'Developers and testers who want to understand the risks of user-controlled paths.',
    },
    prerequisites: {
      it: 'Basi di HTTP e del filesystem; conoscere il concetto di web root.',
      en: 'Basics of HTTP and the filesystem; familiarity with the web root concept.',
    },
    targetIp: '10.42.10.15',
    hostname: 'lfi-lab.evil.lab',
    icon: '▤',
    description: {
      it: 'Un parametro file che include percorsi scelti dall\'utente: con il directory traversal si esce dalla web root.',
      en: 'A file parameter that includes user-chosen paths: directory traversal lets you escape the web root.',
    },
    objectives: {
      it: [
        'Trova l\'endpoint /view?file= sulla porta 80',
        'Usa il directory traversal per leggere un file di sistema',
        'Trova la flag e consegnala con submit flag <flag>',
        'Difendi: valida il percorso e indica come rilevare il traversal',
      ],
      en: [
        'Find the /view?file= endpoint on port 80',
        'Use directory traversal to read a system file',
        'Find the flag and submit it with submit flag <flag>',
        'Defend: validate the path and explain how traversal is detected',
      ],
    },
    flag: 'EVIL{lfi_traversal}',
    hints: {
      it: [
        'Guarda la pagina inclusa: curl "http://10.42.10.15/view?file=index.php"',
        'Le sequenze ../ permettono di risalire le cartelle verso file noti come /etc/passwd.',
      ],
      en: [
        'Look at the included page: curl "http://10.42.10.15/view?file=index.php"',
        'The ../ sequences let you climb directories toward known files such as /etc/passwd.',
      ],
    },
    remediation: {
      fix: {
        it: 'Non passare mai l\'input utente a funzioni di inclusione: usa una allowlist di file consentiti, normalizza il percorso e limita con open_basedir/chroot.',
        en: 'Never pass user input to include functions: use an allowlist of permitted files, normalise the path and confine with open_basedir/chroot.',
      },
      detect: {
        it: 'Sequenze ../ o percorsi come /etc/passwd nei parametri, visibili nei log del web server, indicano tentativi di traversal.',
        en: '../ sequences or paths like /etc/passwd in parameters, visible in web server logs, indicate traversal attempts.',
      },
    },
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'nginx 1.26' }],
    },
    web: { type: 'lfi' },
  },
  'csrf-web': {
    id: 'csrf-web',
    name: 'EVIL-CSRFLab',
    title: { it: 'Cross-Site Request Forgery', en: 'Cross-Site Request Forgery' },
    level: LV.inter,
    duration: '~15 min',
    audience: {
      it: 'Sviluppatori web che gestiscono azioni autenticate e vogliono proteggerle.',
      en: 'Web developers who handle authenticated actions and want to protect them.',
    },
    prerequisites: {
      it: 'Basi di HTTP, cookie di sessione e form POST.',
      en: 'Basics of HTTP, session cookies and POST forms.',
    },
    targetIp: '10.42.10.13',
    hostname: 'csrf-lab.evil.lab',
    icon: '◎',
    description: {
      it: 'Un form che cambia l\'email senza token anti-CSRF: un sito terzo può far agire il browser autenticato.',
      en: 'A form that changes the email with no anti-CSRF token: a third-party site can act through the authenticated browser.',
    },
    objectives: {
      it: [
        'Ispeziona il form /account/email con curl',
        'Mostra che la POST viene accettata senza token di protezione',
        'Trova la flag e consegnala con submit flag <flag>',
        'Difendi: aggiungi i token anti-CSRF e indica come rilevare l\'abuso',
      ],
      en: [
        'Inspect the /account/email form with curl',
        'Show that the POST is accepted with no protection token',
        'Find the flag and submit it with submit flag <flag>',
        'Defend: add anti-CSRF tokens and explain how the abuse is detected',
      ],
    },
    flag: 'EVIL{csrf_no_token}',
    hints: {
      it: [
        'Cerca un token nascosto nel form: curl http://10.42.10.13/account/email',
        'Se non c\'è alcun token, una POST con solo il campo email viene accettata.',
      ],
      en: [
        'Look for a hidden token in the form: curl http://10.42.10.13/account/email',
        'If there is no token, a POST with just the email field is accepted.',
      ],
    },
    remediation: {
      fix: {
        it: 'Richiedi un token anti-CSRF per ogni azione che cambia stato, imposta i cookie di sessione con SameSite e chiedi la riautenticazione per le operazioni sensibili.',
        en: 'Require an anti-CSRF token for every state-changing action, set session cookies with SameSite and re-authenticate for sensitive operations.',
      },
      detect: {
        it: 'Il server segnala le richieste senza token valido o con Origin/Referer cross-site inattesi.',
        en: 'The server flags requests with a missing/invalid token or unexpected cross-site Origin/Referer.',
      },
    },
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'nginx 1.24' }],
    },
    web: { type: 'csrf' },
  },
  'dir-discovery': {
    id: 'dir-discovery',
    name: 'EVIL-DirLab',
    title: { it: 'Scoperta di directory nascoste', en: 'Hidden directory discovery' },
    level: LV.base,
    duration: '~10 min',
    audience: {
      it: 'Chi gestisce web server e vuole capire cosa resta esposto per errore.',
      en: 'People who run web servers and want to see what stays exposed by mistake.',
    },
    prerequisites: {
      it: 'Basi di HTTP e dei codici di stato (200, 403, 404).',
      en: 'Basics of HTTP and status codes (200, 403, 404).',
    },
    targetIp: '10.42.10.14',
    hostname: 'dir-lab.evil.lab',
    icon: '▧',
    description: {
      it: 'Percorsi non collegati da nessuna pagina ma ancora raggiungibili: pannelli admin o backup dimenticati.',
      en: 'Paths not linked from any page yet still reachable: forgotten admin panels or backups.',
    },
    objectives: {
      it: [
        'Enumera i percorsi del web server con dirb',
        'Individua un percorso sensibile non pubblicizzato',
        'Trova la flag e consegnala con submit flag <flag>',
        'Difendi: proteggi i percorsi sensibili e indica come rilevare l\'enumerazione',
      ],
      en: [
        'Enumerate the web server paths with dirb',
        'Spot a sensitive, unadvertised path',
        'Find the flag and submit it with submit flag <flag>',
        'Defend: protect sensitive paths and explain how enumeration is detected',
      ],
    },
    flag: 'EVIL{hidden_admin_path}',
    hints: {
      it: [
        'Enumera i percorsi comuni: dirb http://10.42.10.14/',
        'Un codice 200 su un percorso come /admin indica una risorsa raggiungibile senza link.',
      ],
      en: [
        'Enumerate common paths: dirb http://10.42.10.14/',
        'A 200 on a path like /admin points to a resource reachable with no link.',
      ],
    },
    remediation: {
      fix: {
        it: 'Rimuovi o proteggi con autenticazione i percorsi sensibili, disattiva il listing delle directory e non lasciare backup nella web root.',
        en: 'Remove or authenticate sensitive paths, disable directory listing and keep backups out of the web root.',
      },
      detect: {
        it: 'Raffiche di 404/403 verso percorsi comuni dallo stesso IP, nei log di accesso, indicano un\'enumerazione.',
        en: 'Bursts of 404/403 to common paths from the same IP, in access logs, indicate enumeration.',
      },
    },
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'Apache 2.4' }],
    },
    web: { type: 'dir' },
  },
  'brute-force-ssh': {
    id: 'brute-force-ssh',
    name: 'EVIL-BruteLab',
    title: { it: 'Brute force SSH', en: 'SSH brute force' },
    level: LV.inter,
    duration: '~15 min',
    audience: {
      it: 'Amministratori che vogliono capire perché servono MFA e rate limiting su SSH.',
      en: 'Administrators who want to see why MFA and rate limiting matter for SSH.',
    },
    prerequisites: {
      it: 'Conoscere SSH e il concetto di wordlist.',
      en: 'Familiarity with SSH and the concept of a wordlist.',
    },
    targetIp: '10.42.10.23',
    hostname: 'brute.evil.lab',
    icon: '▨',
    description: {
      it: 'Un servizio SSH con una password debole che cade sotto un attacco automatizzato: ecco perché servono difese.',
      en: 'An SSH service with a weak password that falls to an automated attack: this is why defences matter.',
    },
    objectives: {
      it: [
        'Conferma SSH aperto con nmap',
        'Esegui un attacco a dizionario autorizzato con hydra',
        'Trova la flag nel report e consegnala con submit flag <flag>',
        'Difendi: aggiungi MFA e rate limiting, indica come rilevare il brute force',
      ],
      en: [
        'Confirm SSH is open with nmap',
        'Run an authorised dictionary attack with hydra',
        'Find the flag in the report and submit it with submit flag <flag>',
        'Defend: add MFA and rate limiting, explain how brute force is detected',
      ],
    },
    flag: 'EVIL{hydra_ssh_win}',
    hints: {
      it: [
        'Conferma la porta 22: nmap -p 22 10.42.10.23',
        'Lancia hydra sull\'utente admin con una wordlist: hydra -l admin -P /usr/share/wordlists/lab.txt ssh://10.42.10.23',
      ],
      en: [
        'Confirm port 22: nmap -p 22 10.42.10.23',
        'Run hydra against the admin user with a wordlist: hydra -l admin -P /usr/share/wordlists/lab.txt ssh://10.42.10.23',
      ],
    },
    remediation: {
      fix: {
        it: 'Preferisci l\'autenticazione a chiave, aggiungi MFA, limita i tentativi con fail2ban e un rate limit, e vieta login diretti con password deboli.',
        en: 'Prefer key-based authentication, add MFA, throttle attempts with fail2ban and a rate limit, and forbid direct logins with weak passwords.',
      },
      detect: {
        it: 'Molti login falliti in rapida successione da uno stesso IP in /var/log/auth.log sono il segnale tipico del brute force.',
        en: 'Many failed logins in quick succession from the same IP in /var/log/auth.log are the classic brute-force signal.',
      },
    },
    nmap: {
      ports: [{ port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 8.9' }],
    },
    bruteforce: { user: 'admin', password: 'evil-lab-23' },
  },
  'smb-enum': {
    id: 'smb-enum',
    name: 'EVIL-SMBLab',
    title: { it: 'Enumerazione SMB', en: 'SMB enumeration' },
    level: LV.inter,
    duration: '~15 min',
    audience: {
      it: 'Chi gestisce condivisioni di rete e vuole evitare esposizioni accidentali.',
      en: 'People who manage network shares and want to avoid accidental exposure.',
    },
    prerequisites: {
      it: 'Basi di SMB e delle condivisioni di file in rete.',
      en: 'Basics of SMB and network file shares.',
    },
    targetIp: '10.42.10.31',
    hostname: 'smb-lab.evil.lab',
    icon: '▥',
    description: {
      it: 'Condivisioni SMB accessibili senza credenziali: un classico per backup e file sensibili lasciati esposti.',
      en: 'SMB shares accessible with no credentials: a classic for backups and sensitive files left exposed.',
    },
    objectives: {
      it: [
        'Scansiona la porta 445 con nmap',
        'Elenca le share con smbclient -L',
        'Leggi il file nascosto nella share backup',
        'Trova la flag e consegnala con submit flag <flag>',
        'Difendi: disattiva l\'accesso anonimo e indica come rilevare l\'enumerazione',
      ],
      en: [
        'Scan port 445 with nmap',
        'List the shares with smbclient -L',
        'Read the hidden file in the backup share',
        'Find the flag and submit it with submit flag <flag>',
        'Defend: disable anonymous access and explain how enumeration is detected',
      ],
    },
    flag: 'EVIL{smb_open_share}',
    hints: {
      it: [
        'Conferma SMB: nmap -p 445 10.42.10.31',
        'Elenca le share in modo anonimo con smbclient -L //10.42.10.31 -N, poi apri la share backup.',
      ],
      en: [
        'Confirm SMB: nmap -p 445 10.42.10.31',
        'List shares anonymously with smbclient -L //10.42.10.31 -N, then open the backup share.',
      ],
    },
    remediation: {
      fix: {
        it: 'Disattiva l\'accesso guest/anonymous, restringi le share agli utenti autorizzati, abilita la firma SMB e segmenta la rete.',
        en: 'Disable guest/anonymous access, restrict shares to authorised users, enable SMB signing and segment the network.',
      },
      detect: {
        it: 'I log SMB mostrano accessi anonimi e richieste di listing delle share da host non previsti.',
        en: 'SMB logs show anonymous logins and share-listing requests from unexpected hosts.',
      },
    },
    nmap: {
      ports: [
        { port: 445, state: 'open', service: 'microsoft-ds', version: 'Samba 4.19' },
        { port: 139, state: 'open', service: 'netbios-ssn', version: '' },
      ],
    },
    smb: {
      shares: ['backup', 'public'],
      flagFile: 'EVIL{smb_open_share}',
    },
  },
  'command-injection': {
    id: 'command-injection',
    name: 'EVIL-CmdLab',
    title: { it: 'OS command injection', en: 'OS command injection' },
    level: LV.inter,
    duration: '~20 min',
    audience: {
      it: 'Sviluppatori che invocano comandi di sistema e vogliono farlo in modo sicuro.',
      en: 'Developers who invoke system commands and want to do it safely.',
    },
    prerequisites: {
      it: 'Basi di HTTP e di come una shell interpreta ; e |.',
      en: 'Basics of HTTP and how a shell interprets ; and |.',
    },
    targetIp: '10.42.10.16',
    hostname: 'cmdi-lab.evil.lab',
    icon: '▩',
    description: {
      it: 'Un parametro host passato a una chiamata di sistema senza sanitizzazione: si possono concatenare comandi.',
      en: 'A host parameter passed to a system call with no sanitisation: commands can be chained.',
    },
    objectives: {
      it: [
        'Trova /ping?host= sul web target',
        'Mostra l\'esecuzione di un comando concatenato con ; o |',
        'Trova la flag e consegnala con submit flag <flag>',
        'Difendi: elimina la chiamata a shell e indica come rilevare l\'injection',
      ],
      en: [
        'Find /ping?host= on the web target',
        'Show execution of a command chained with ; or |',
        'Find the flag and submit it with submit flag <flag>',
        'Defend: remove the shell call and explain how injection is detected',
      ],
    },
    flag: 'EVIL{cmd_injection}',
    hints: {
      it: [
        'Osserva il comportamento normale: curl "http://10.42.10.16/ping?host=127.0.0.1"',
        'Se l\'input non è filtrato, host=127.0.0.1;whoami esegue whoami dopo il ping.',
      ],
      en: [
        'Observe the normal behaviour: curl "http://10.42.10.16/ping?host=127.0.0.1"',
        'If the input is not filtered, host=127.0.0.1;whoami runs whoami after the ping.',
      ],
    },
    remediation: {
      fix: {
        it: 'Evita di invocare una shell: usa API native con argomenti separati, oppure una allowlist rigida e la validazione dell\'input; mai concatenare stringhe nei comandi.',
        en: 'Avoid invoking a shell: use native APIs with separate arguments, or a strict allowlist plus input validation; never concatenate strings into commands.',
      },
      detect: {
        it: 'Un WAF e i log segnalano metacaratteri come ; | & o backtick nei parametri destinati a comandi.',
        en: 'A WAF and logs flag metacharacters such as ; | & or backticks in parameters meant for commands.',
      },
    },
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'Apache 2.4' }],
    },
    web: { type: 'cmdi' },
  },
  'ssrf-web': {
    id: 'ssrf-web',
    name: 'EVIL-SSRFLab',
    title: { it: 'Server-Side Request Forgery', en: 'Server-Side Request Forgery' },
    level: LV.adv,
    duration: '~20 min',
    audience: {
      it: 'Sviluppatori di servizi che recuperano URL e vogliono bloccare l\'accesso alle risorse interne.',
      en: 'Developers of services that fetch URLs and want to block access to internal resources.',
    },
    prerequisites: {
      it: 'Basi di HTTP, reti interne (RFC1918) e metadata service.',
      en: 'Basics of HTTP, internal networks (RFC1918) and metadata services.',
    },
    targetIp: '10.42.10.17',
    hostname: 'ssrf-lab.evil.lab',
    icon: '◉',
    description: {
      it: 'Il server recupera URL forniti dall\'utente: si possono raggiungere servizi interni non esposti all\'esterno.',
      en: 'The server fetches user-supplied URLs: internal services not exposed outside can be reached.',
    },
    objectives: {
      it: [
        'Ispeziona /fetch?url= con curl',
        'Fai richiedere al server un host interno dello scenario (10.42.0.99)',
        'Trova la flag dal servizio interno e consegnala con submit flag <flag>',
        'Difendi: filtra le destinazioni e indica come rilevare l\'SSRF',
      ],
      en: [
        'Inspect /fetch?url= with curl',
        'Make the server request an internal scenario host (10.42.0.99)',
        'Find the flag from the internal service and submit it with submit flag <flag>',
        'Defend: filter destinations and explain how SSRF is detected',
      ],
    },
    flag: 'EVIL{ssrf_internal}',
    hints: {
      it: [
        'Prova prima un URL esterno: curl "http://10.42.10.17/fetch?url=http://example.com"',
        'Poi punta a un host interno dello scenario, come http://10.42.0.99/internal/flag.',
      ],
      en: [
        'Try an external URL first: curl "http://10.42.10.17/fetch?url=http://example.com"',
        'Then point to an internal scenario host, such as http://10.42.0.99/internal/flag.',
      ],
    },
    remediation: {
      fix: {
        it: 'Usa una allowlist di host e schemi consentiti, blocca gli indirizzi interni e i metadata service, e non passare mai l\'URL grezzo dell\'utente al client HTTP.',
        en: 'Use an allowlist of permitted hosts and schemes, block internal addresses and metadata services, and never pass the raw user URL to the HTTP client.',
      },
      detect: {
        it: 'Richieste in uscita dal server verso indirizzi interni o verso 169.254.169.254 sono un segnale tipico di SSRF.',
        en: 'Outbound requests from the server to internal addresses or to 169.254.169.254 are a classic SSRF signal.',
      },
    },
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'nginx 1.24' }],
    },
    web: { type: 'ssrf' },
  },
  'idor-api': {
    id: 'idor-api',
    name: 'EVIL-IDORLab',
    title: { it: 'IDOR su API REST', en: 'IDOR on a REST API' },
    level: LV.inter,
    duration: '~15 min',
    audience: {
      it: 'Chi progetta API e vuole garantire i controlli di autorizzazione per oggetto.',
      en: 'People who design APIs and want to ensure per-object authorisation checks.',
    },
    prerequisites: {
      it: 'Basi di API REST e di autenticazione/autorizzazione.',
      en: 'Basics of REST APIs and authentication/authorisation.',
    },
    targetIp: '10.42.10.18',
    hostname: 'api-lab.evil.lab',
    icon: '▷',
    description: {
      it: 'Un ID numerico nell\'API senza controllo di autorizzazione: cambiandolo si leggono dati di altri utenti.',
      en: 'A numeric ID in the API with no authorisation check: changing it reads other users\' data.',
    },
    objectives: {
      it: [
        'Chiama /api/user?id=1000 (il tuo profilo)',
        'Mostra che un altro ID restituisce dati non tuoi',
        'Trova la flag nel record esposto e consegnala con submit flag <flag>',
        'Difendi: applica i controlli di autorizzazione e indica come rilevare l\'abuso',
      ],
      en: [
        'Call /api/user?id=1000 (your own profile)',
        'Show that another ID returns data that is not yours',
        'Find the flag in the exposed record and submit it with submit flag <flag>',
        'Defend: enforce authorisation checks and explain how the abuse is detected',
      ],
    },
    flag: 'EVIL{idor_user_data}',
    hints: {
      it: [
        'Guarda il tuo profilo: curl "http://10.42.10.18/api/user?id=1000"',
        'Prova un ID vicino, come 1001, per vedere se l\'API controlla la proprietà del record.',
      ],
      en: [
        'Look at your profile: curl "http://10.42.10.18/api/user?id=1000"',
        'Try a nearby ID, such as 1001, to see whether the API checks record ownership.',
      ],
    },
    remediation: {
      fix: {
        it: 'Verifica a ogni richiesta che l\'utente autenticato possa accedere a quell\'oggetto; preferisci identificatori non indovinabili e nega di default.',
        en: 'Check on every request that the authenticated user may access that object; prefer unguessable identifiers and deny by default.',
      },
      detect: {
        it: 'Accessi sequenziali a molti ID o a record fuori dall\'ambito dell\'utente, nei log dell\'API, indicano un IDOR.',
        en: 'Sequential access to many IDs or to records outside the user\'s scope, in API logs, indicates IDOR.',
      },
    },
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'nginx 1.26' }],
    },
    web: { type: 'idor' },
  },
  'jwt-weak': {
    id: 'jwt-weak',
    name: 'EVIL-JWTLab',
    title: { it: 'Autorizzazione API via JWT', en: 'API authorisation via JWT' },
    level: LV.adv,
    duration: '~25 min',
    audience: {
      it: 'Chi implementa autenticazione basata su token e vuole validarla correttamente.',
      en: 'People who implement token-based authentication and want to validate it correctly.',
    },
    prerequisites: {
      it: 'Conoscere la struttura di un JWT (header, payload, firma) e le API.',
      en: 'Familiarity with JWT structure (header, payload, signature) and APIs.',
    },
    targetIp: '10.42.10.19',
    hostname: 'jwt-lab.evil.lab',
    icon: '▶',
    description: {
      it: 'Un\'API che si fida di un token JWT mal validato: con un token di ruolo admin si ottiene accesso privilegiato.',
      en: 'An API that trusts a poorly validated JWT: an admin-role token grants privileged access.',
    },
    objectives: {
      it: [
        'Richiedi /api/profile senza token (403)',
        'Usa il token admin dello scenario nell\'header Authorization',
        'Trova la flag nella risposta privilegiata e consegnala con submit flag <flag>',
        'Difendi: valida firma e algoritmo e indica come rilevare l\'abuso',
      ],
      en: [
        'Request /api/profile with no token (403)',
        'Use the scenario admin token in the Authorization header',
        'Find the flag in the privileged response and submit it with submit flag <flag>',
        'Defend: validate signature and algorithm and explain how the abuse is detected',
      ],
    },
    flag: 'EVIL{jwt_admin_role}',
    hints: {
      it: [
        'Prova senza credenziali: curl http://10.42.10.19/api/profile',
        'Lo scenario accetta il token di prova evil.admin.token.lab nell\'header Authorization: Bearer.',
      ],
      en: [
        'Try with no credentials: curl http://10.42.10.19/api/profile',
        'The scenario accepts the test token evil.admin.token.lab in the Authorization: Bearer header.',
      ],
    },
    remediation: {
      fix: {
        it: 'Verifica sempre la firma con un secret robusto, accetta solo gli algoritmi previsti (mai alg none), controlla scadenza e claim e ruota le chiavi.',
        en: 'Always verify the signature with a strong secret, allow only the expected algorithms (never alg none), check expiry and claims and rotate keys.',
      },
      detect: {
        it: 'Picchi di token con firma non valida o con header alg none nei log di autenticazione indicano tentativi di manomissione.',
        en: 'Spikes of tokens with invalid signatures or an alg none header in authentication logs indicate tampering attempts.',
      },
    },
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'nginx 1.24' }],
    },
    web: { type: 'jwt' },
  },
  'file-upload': {
    id: 'file-upload',
    name: 'EVIL-UploadLab',
    title: { it: 'Upload di file non validato', en: 'Unvalidated file upload' },
    level: LV.inter,
    duration: '~20 min',
    audience: {
      it: 'Sviluppatori che accettano upload e vogliono evitare l\'esecuzione di codice.',
      en: 'Developers who accept uploads and want to prevent code execution.',
    },
    prerequisites: {
      it: 'Basi di HTTP, upload multipart e web root.',
      en: 'Basics of HTTP, multipart uploads and the web root.',
    },
    targetIp: '10.42.10.20',
    hostname: 'upload-lab.evil.lab',
    icon: '▤',
    description: {
      it: 'Un endpoint di upload senza controllo di tipo o estensione: un file eseguibile sul web root diventa una webshell.',
      en: 'An upload endpoint with no type or extension check: an executable file on the web root becomes a webshell.',
    },
    objectives: {
      it: [
        'Individua l\'endpoint POST /upload',
        'Mostra che un file eseguibile viene accettato senza controlli',
        'Trova la flag dalla risposta e consegnala con submit flag <flag>',
        'Difendi: valida e isola gli upload, indica come rilevare l\'abuso',
      ],
      en: [
        'Find the POST /upload endpoint',
        'Show that an executable file is accepted with no checks',
        'Find the flag in the response and submit it with submit flag <flag>',
        'Defend: validate and isolate uploads, explain how the abuse is detected',
      ],
    },
    flag: 'EVIL{upload_webshell}',
    hints: {
      it: [
        'Guarda il form: curl http://10.42.10.20/upload',
        'Prova a inviare un file con estensione eseguibile con curl -F per vedere se viene rifiutato.',
      ],
      en: [
        'Look at the form: curl http://10.42.10.20/upload',
        'Try sending a file with an executable extension via curl -F to see whether it is rejected.',
      ],
    },
    remediation: {
      fix: {
        it: 'Valida tipo, estensione e contenuto con una allowlist, salva i file fuori dalla web root con nomi casuali e vietane l\'esecuzione.',
        en: 'Validate type, extension and content against an allowlist, store files outside the web root with random names and forbid their execution.',
      },
      detect: {
        it: 'Upload di estensioni eseguibili (.php, .jsp) e successive richieste a quei file, nei log, indicano un tentativo di webshell.',
        en: 'Uploads of executable extensions (.php, .jsp) and later requests to those files, in logs, indicate a webshell attempt.',
      },
    },
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'Apache 2.4' }],
    },
    web: { type: 'upload' },
  },
  'xxe-xml': {
    id: 'xxe-xml',
    name: 'EVIL-XXELab',
    title: { it: 'XML External Entity (XXE)', en: 'XML External Entity (XXE)' },
    level: LV.adv,
    duration: '~25 min',
    audience: {
      it: 'Sviluppatori che elaborano XML e vogliono configurare il parser in modo sicuro.',
      en: 'Developers who process XML and want to configure the parser securely.',
    },
    prerequisites: {
      it: 'Conoscere la sintassi XML, DTD ed entità.',
      en: 'Familiarity with XML syntax, DTDs and entities.',
    },
    targetIp: '10.42.10.24',
    hostname: 'xxe-lab.evil.lab',
    icon: '◐',
    description: {
      it: 'Un parser XML che risolve le entità esterne: si possono leggere file locali o raggiungere la rete interna.',
      en: 'An XML parser that resolves external entities: local files can be read or the internal network reached.',
    },
    objectives: {
      it: [
        'Invia un XML a POST /api/parse',
        'Definisci un\'entità esterna che legge un file locale',
        'Trova la flag nell\'output e consegnala con submit flag <flag>',
        'Difendi: disattiva le entità esterne e indica come rilevare l\'XXE',
      ],
      en: [
        'Send XML to POST /api/parse',
        'Define an external entity that reads a local file',
        'Find the flag in the output and submit it with submit flag <flag>',
        'Defend: disable external entities and explain how XXE is detected',
      ],
    },
    flag: 'EVIL{xxe_entity}',
    hints: {
      it: [
        'Prova un XML normale: curl -d "<user>test</user>" http://10.42.10.24/api/parse',
        'Definisci un\'entità con <!ENTITY x SYSTEM "file:///etc/hostname"> e richiamala nel corpo.',
      ],
      en: [
        'Try a normal XML: curl -d "<user>test</user>" http://10.42.10.24/api/parse',
        'Define an entity with <!ENTITY x SYSTEM "file:///etc/hostname"> and reference it in the body.',
      ],
    },
    remediation: {
      fix: {
        it: 'Disattiva DTD ed entità esterne nel parser (feature "disallow-doctype-decl", nessuna risoluzione di entità esterne) e preferisci formati più semplici dove possibile.',
        en: 'Disable DTDs and external entities in the parser (the "disallow-doctype-decl" feature, no external entity resolution) and prefer simpler formats where possible.',
      },
      detect: {
        it: 'Payload XML con DOCTYPE/ENTITY o schemi file:// nei corpi delle richieste, nei log, indicano tentativi di XXE.',
        en: 'XML payloads with DOCTYPE/ENTITY or file:// schemes in request bodies, in logs, indicate XXE attempts.',
      },
    },
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'Tomcat 10' }],
    },
    web: { type: 'xxe' },
  },
  'ftp-anonymous': {
    id: 'ftp-anonymous',
    name: 'EVIL-FTPLab',
    title: { it: 'Accesso FTP anonimo', en: 'Anonymous FTP access' },
    level: LV.base,
    duration: '~10 min',
    audience: {
      it: 'Chi gestisce server FTP e vuole evitare di esporre file per errore.',
      en: 'People who run FTP servers and want to avoid exposing files by mistake.',
    },
    prerequisites: {
      it: 'Basi di FTP e del login anonimo.',
      en: 'Basics of FTP and anonymous login.',
    },
    targetIp: '10.42.10.32',
    hostname: 'ftp-lab.evil.lab',
    icon: '▥',
    description: {
      it: 'Un server FTP con login anonimo abilitato che espone file sensibili: una misconfigurazione frequente.',
      en: 'An FTP server with anonymous login enabled that exposes sensitive files: a frequent misconfiguration.',
    },
    objectives: {
      it: [
        'Scansiona la porta 21 con nmap',
        'Scarica flag.txt sfruttando il login anonimo',
        'Trova la flag e consegnala con submit flag <flag>',
        'Difendi: disattiva l\'accesso anonimo e indica come rilevare l\'abuso',
      ],
      en: [
        'Scan port 21 with nmap',
        'Download flag.txt using the anonymous login',
        'Find the flag and submit it with submit flag <flag>',
        'Defend: disable anonymous access and explain how the abuse is detected',
      ],
    },
    flag: 'EVIL{ftp_anonymous}',
    hints: {
      it: [
        'Conferma FTP: nmap -p 21 10.42.10.32',
        'Scarica il file in modo non interattivo: curl "ftp://anonymous:anon@10.42.10.32/flag.txt"',
      ],
      en: [
        'Confirm FTP: nmap -p 21 10.42.10.32',
        'Download the file non-interactively: curl "ftp://anonymous:anon@10.42.10.32/flag.txt"',
      ],
    },
    remediation: {
      fix: {
        it: 'Disattiva il login anonimo (in vsftpd: anonymous_enable=NO), usa SFTP/FTPS con account autenticati e limita i permessi alle sole directory necessarie.',
        en: 'Disable anonymous login (in vsftpd: anonymous_enable=NO), use SFTP/FTPS with authenticated accounts and restrict permissions to the directories you actually need.',
      },
      detect: {
        it: 'I log del server FTP mostrano login "anonymous" e download di file: facili da segnalare se non previsti.',
        en: 'The FTP server logs show "anonymous" logins and file downloads: easy to flag when they are not expected.',
      },
    },
    nmap: {
      ports: [{ port: 21, state: 'open', service: 'ftp', version: 'vsftpd 3.0.5' }],
    },
    ftp: { anonymous: true },
  },
};

const sessions = new Map();

async function persistSession(session) {
  sessions.set(session.id, session);
  const redis = getRedis();
  if (!redis) return;
  const ttlSec = Math.max(60, Math.ceil((session.expiresAt - Date.now()) / 1000));
  try {
    await redis.setex(sessionRedisKey(session.id), ttlSec, JSON.stringify(session));
    await redis.sadd(ownerRedisKey(session.ownerKey), session.id);
    await redis.expire(ownerRedisKey(session.ownerKey), ttlSec);
  } catch (err) {
    console.error('Virtual lab persistSession:', err.message);
  }
}

async function loadSessionById(sessionId) {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(sessionRedisKey(sessionId));
      if (raw) {
        const parsed = JSON.parse(raw);
        sessions.set(sessionId, parsed);
        return parsed;
      }
    } catch (err) {
      console.error('Virtual lab loadSession:', err.message);
    }
  }
  return sessions.get(sessionId) || null;
}

async function removeSessionById(sessionId, ownerKey) {
  sessions.delete(sessionId);
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(sessionRedisKey(sessionId));
    await redis.srem(ownerRedisKey(ownerKey), sessionId);
  } catch (err) {
    console.error('Virtual lab removeSession:', err.message);
  }
}

async function countRunningSessions(ownerKey) {
  const now = Date.now();
  const redis = getRedis();
  if (redis) {
    try {
      const ids = await redis.smembers(ownerRedisKey(ownerKey));
      let count = 0;
      for (const id of ids) {
        const s = await loadSessionById(id);
        if (s && s.ownerKey === ownerKey && s.status === 'running' && s.expiresAt >= now) {
          count += 1;
        }
      }
      return count;
    } catch (err) {
      console.error('Virtual lab countRunningSessions:', err.message);
    }
  }
  return [...sessions.values()].filter(
    (s) => s.ownerKey === ownerKey && s.status === 'running' && s.expiresAt >= now
  ).length;
}

function catalogForClient(lang) {
  return Object.values(LAB_CATALOG).map((lab) => {
    const objectives = pick(lang, lab.objectives) || [];
    return {
      id: lab.id,
      name: lab.name,
      title: pick(lang, lab.title),
      level: pick(lang, lab.level),
      duration: lab.duration,
      audience: pick(lang, lab.audience),
      prerequisites: pick(lang, lab.prerequisites),
      targetIp: lab.targetIp,
      hostname: lab.hostname,
      icon: lab.icon,
      description: pick(lang, lab.description),
      objectiveCount: objectives.length,
    };
  });
}

function getLab(labId) {
  return LAB_CATALOG[labId] || null;
}

/**
 * Proprietario della sessione: l'account, oppure per gli ospiti un identificativo casuale
 * nel cookie evil_lab_anon (impostato da ensureAnonOwner). Prima era l'IP letto da
 * X-Forwarded-For, che il client può scrivere a piacere, e tutta un'aula dietro lo stesso
 * IP condivideva il limite di 3 lab.
 */
function ownerKeyFromRequest(req) {
  if (req.user?.id) return `user:${req.user.id}`;
  const anon = req.cookies?.[ANON_COOKIE];
  if (anon && ANON_ID_PATTERN.test(anon)) return `anon:${anon}`;
  return `ip:${req.ip || 'unknown'}`;
}

/** Middleware: assegna il cookie anonimo agli ospiti che aprono il laboratorio. */
function ensureAnonOwner(cookieOptions = {}) {
  return (req, res, next) => {
    if (req.user?.id) return next();
    const current = req.cookies?.[ANON_COOKIE];
    if (current && ANON_ID_PATTERN.test(current)) return next();
    const id = crypto.randomUUID();
    res.cookie(ANON_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/virtual-lab',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      ...cookieOptions,
    });
    req.cookies = { ...(req.cookies || {}), [ANON_COOKIE]: id };
    return next();
  };
}

function countSessions(predicate) {
  const now = Date.now();
  let n = 0;
  for (const s of sessions.values()) {
    if (s.status === 'running' && s.expiresAt >= now && predicate(s)) n += 1;
  }
  return n;
}

function validateLabId(labId) {
  if (typeof labId !== 'string') return '';
  const id = labId.trim();
  return LAB_ID_PATTERN.test(id) ? id : '';
}

function newSessionId() {
  return crypto.randomBytes(12).toString('hex');
}

async function createSession(labId, ownerKey, { ip = null, lang = null } = {}) {
  const lab = getLab(labId);
  if (!lab) {
    const err = new Error(t(lang, 'Scenario non trovato'));
    err.status = 404;
    throw err;
  }

  const running = await countRunningSessions(ownerKey);
  if (running >= MAX_SESSIONS_PER_OWNER) {
    const err = new Error(t(lang, 'Hai già 3 scenari aperti: chiudine uno con "Termina scenario" e riprova. Ogni sessione si chiude comunque da sola dopo 2 ore.'));
    err.status = 429;
    throw err;
  }
  if (ip && countSessions((s) => s.ip === ip) >= MAX_SESSIONS_PER_IP) {
    const err = new Error(t(lang, 'Troppi scenari aperti da questa rete. Riprova tra qualche minuto.'));
    err.status = 429;
    throw err;
  }
  if (countSessions(() => true) >= MAX_TOTAL_SESSIONS) {
    const err = new Error(t(lang, 'Il laboratorio è molto usato in questo momento. Riprova tra qualche minuto.'));
    err.status = 503;
    throw err;
  }

  const id = newSessionId();
  const now = Date.now();
  const session = {
    id,
    labId,
    ownerKey,
    ip,
    lang: lang || null,
    status: 'running',
    startedAt: now,
    expiresAt: now + SESSION_TTL_MS,
    shellContext: 'attacker',
    sshUser: null,
    sshHost: null,
    isRoot: false,
    pendingAuth: null,
    objectivesDone: [],
    completed: false,
    commandCount: 0,
  };
  await persistSession(session);
  return sanitizeSession(session, lab);
}

function sanitizeSession(session, lab) {
  const l = lab || getLab(session.labId);
  const lang = session.lang;
  return {
    id: session.id,
    labId: session.labId,
    status: session.status,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    completed: session.completed,
    shellContext: session.shellContext,
    prompt: currentPrompt(session),
    lab: l
      ? {
          id: l.id,
          name: l.name,
          title: pick(lang, l.title),
          targetIp: l.targetIp,
          hostname: l.hostname,
          objectives: pick(lang, l.objectives),
          level: pick(lang, l.level),
          duration: l.duration,
          prerequisites: pick(lang, l.prerequisites),
          audience: pick(lang, l.audience),
        }
      : null,
    attacker: ATTACKER,
  };
}

async function getSession(sessionId, ownerKey, lang = null) {
  const session = SESSION_ID_PATTERN.test(String(sessionId || '')) ? await loadSessionById(sessionId) : null;
  if (!session) {
    const err = new Error(t(lang, 'Sessione non trovata o scaduta'));
    err.status = 404;
    throw err;
  }
  if (session.ownerKey !== ownerKey) {
    const err = new Error(t(lang, 'Accesso negato a questa sessione'));
    err.status = 403;
    throw err;
  }
  if (session.expiresAt < Date.now()) {
    await removeSessionById(sessionId, ownerKey);
    const err = new Error(t(lang, 'Sessione scaduta'));
    err.status = 410;
    throw err;
  }
  return session;
}

async function stopSession(sessionId, ownerKey) {
  const session = await getSession(sessionId, ownerKey);
  session.status = 'stopped';
  await removeSessionById(sessionId, ownerKey);
  return { ok: true };
}

function currentPrompt(session) {
  if (session.shellContext === 'target' && session.sshHost) {
    const user = session.isRoot ? 'root' : session.sshUser;
    const host = session.sshHost.split('.')[0];
    return `${user}@${host}:~$`;
  }
  return ATTACKER.prompt;
}

function normalizeHost(host) {
  if (!host) return '';
  return host.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
}

function hostMatchesLab(host, lab) {
  const h = normalizeHost(host);
  return h === lab.targetIp || h === lab.hostname || h.includes(lab.hostname);
}

function parseCommandLine(line) {
  const trimmed = (line || '').trim();
  if (!trimmed) return { cmd: '', args: [] };
  const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const unquote = (s) => s.replace(/^['"]|['"]$/g, '');
  const cmd = (parts[0] || '').toLowerCase();
  const args = parts.slice(1).map(unquote);
  return { cmd, args, raw: trimmed };
}

function nmapOutput(lab, args, lang) {
  const targetArg = args.find((a) => !a.startsWith('-'));
  if (!targetArg || !hostMatchesLab(targetArg, lab)) {
    return `Note: Host ${targetArg || 'unknown'} seems down or unreachable on lab network 10.42.10.0/24.\n` +
      t(lang, '(Nello scenario è raggiungibile solo il target assegnato.)');
  }
  const lines = [
    `Starting Nmap 7.94 ( https://nmap.org ) — EVIL lab scanner`,
    `Nmap scan report for ${lab.hostname} (${lab.targetIp})`,
    'Host is up (0.00034s latency).',
    '',
    'PORT     STATE    SERVICE     VERSION',
  ];
  for (const p of lab.nmap.ports) {
    const ver = p.version ? ` ${p.version}` : '';
    lines.push(
      `${String(p.port).padEnd(8)} ${p.state.padEnd(8)} ${p.service.padEnd(11)}${ver}`.trimEnd()
    );
  }
  lines.push('');
  lines.push('Nmap done: 1 IP address (1 host up) scanned in 1.42 seconds');
  return lines.join('\n');
}

// raw = riga di comando completa: serve ai lab JWT, upload e XXE (header -H, -F, corpo XML).
// Prima non veniva passata e quei tre lab andavano in errore a ogni curl ("raw is not defined").
function curlOutput(session, lab, args, raw = args.join(' ')) {
  const lang = session.lang;
  const url = args.find((a) => a.startsWith('http') || a.startsWith('ftp')) || args[0] || '';
  if (!url.includes(lab.targetIp) && !url.includes(lab.hostname)) {
    return 'curl: (7) Failed to connect — ' + t(lang, 'host non autorizzato fuori dalla rete isolata dello scenario.');
  }
  const bodyIdx = args.indexOf('-d');
  const body = bodyIdx >= 0 ? args[bodyIdx + 1] : '';
  const webType = lab.web?.type;

  if (lab.ftp && url.startsWith('ftp://')) {
    if (url.includes('anonymous')) {
      return [
        '230 Anonymous login ok.',
        '150 Opening BINARY mode data connection for flag.txt.',
        lab.flag,
        '226 Transfer complete.',
      ].join('\n');
    }
    return '530 ' + t(lang, 'Login non riuscito: in questo scenario è abilitato il login anonimo.');
  }

  if (webType === 'xss') {
    if (url.includes('search') && (url.includes('<script>') || url.includes('%3Cscript'))) {
      return [
        'HTTP/1.1 200 OK',
        'Content-Type: text/html',
        '',
        '<html><body>Risultati per: <script>alert(1)</script>',
        '<!-- XSS reflected — flag: EVIL{xss_reflected} --></body></html>',
      ].join('\n');
    }
    if (url.includes('/search')) {
      return '<html><body><form action="/search"><input name="q"><button>Cerca</button></form></body></html>';
    }
  }

  if (webType === 'lfi') {
    if (url.includes('../../../etc/passwd') || url.includes('..%2F..%2F..%2Fetc%2Fpasswd')) {
      return [
        'root:x:0:0:root:/root:/bin/bash',
        'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin',
        '# flag: EVIL{lfi_traversal}',
      ].join('\n');
    }
    if (url.includes('/view')) {
      return '<?php echo "EVIL LFI lab — prova path traversal"; ?>';
    }
  }

  if (webType === 'csrf') {
    if (body.includes('email=') || (bodyIdx >= 0 && body)) {
      return [
        'HTTP/1.1 200 OK',
        '',
        '{"status":"changed","message":"Email aggiornata senza CSRF token — flag: EVIL{csrf_no_token}"}',
      ].join('\n');
    }
    if (url.includes('/account/email')) {
      return '<html><body><form method="POST"><input name="email"><button>Salva</button></form><!-- no csrf token --></body></html>';
    }
  }

  if (webType === 'dir') {
    if (url.includes('/admin/flag.txt')) {
      return 'EVIL{hidden_admin_path}';
    }
    return '<html><body><h1>EVIL Dir Lab</h1><p>Home page pubblica</p></body></html>';
  }

  if (webType === 'cmdi') {
    if (url.includes('/ping') && (url.includes(';') || url.includes('|') || url.includes('%3B'))) {
      const hasCmd = url.includes('whoami') || url.includes('id');
      if (hasCmd) {
        return [
          'PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.',
          '---',
          'uid=33(www-data) gid=33(www-data)',
          'flag: EVIL{cmd_injection}',
        ].join('\n');
      }
    }
    if (url.includes('/ping')) {
      return 'PING 127.0.0.1 (127.0.0.1) 56(84) bytes of data.\n64 bytes from 127.0.0.1: icmp_seq=1 ttl=64';
    }
  }

  if (webType === 'ssrf') {
    if (url.includes('10.42.0.99') || url.includes('internal/flag')) {
      return [
        'HTTP/1.1 200 OK',
        '',
        '{"source":"internal-metadata","flag":"EVIL{ssrf_internal}","note":"SSRF verso rete interna lab"}',
      ].join('\n');
    }
    if (url.includes('/fetch')) {
      return '{"status":"ok","body":"Contenuto pagina esterna fetchata dal server"}';
    }
  }

  if (webType === 'idor') {
    if (url.includes('id=1001') || url.includes('id=1002')) {
      return [
        '{"id":1001,"user":"admin","email":"admin@evil.lab","role":"administrator","secret":"EVIL{idor_user_data}"}',
      ].join('\n');
    }
    if (url.includes('/api/user')) {
      return '{"id":1000,"user":"guest","email":"guest@evil.lab","role":"user"}';
    }
  }

  if (webType === 'jwt') {
    let authLine = raw;
    for (let i = 0; i < args.length; i++) {
      if ((args[i] === '-H' || args[i] === '--header') && args[i + 1]) {
        authLine += ' ' + args[i + 1];
      }
    }
    if (authLine.includes('evil.admin.token') || authLine.includes('Bearer admin')) {
      return [
        'HTTP/1.1 200 OK',
        '',
        '{"role":"admin","access":"full","flag":"EVIL{jwt_admin_role}"}',
      ].join('\n');
    }
    if (url.includes('/api/profile')) {
      return 'HTTP/1.1 403 Forbidden\n{"error":"Missing or invalid JWT"}';
    }
  }

  if (webType === 'upload') {
    if (raw.includes('-F') && (raw.includes('.php') || raw.includes('shell'))) {
      return [
        'HTTP/1.1 201 Created',
        '',
        '{"uploaded":"/uploads/shell.php","executable":true,"flag":"EVIL{upload_webshell}"}',
      ].join('\n');
    }
    if (url.includes('/upload')) {
      return '<html><body><form method="POST" enctype="multipart/form-data"><input type="file" name="file"><button>Upload</button></form></body></html>';
    }
  }

  if (webType === 'xxe') {
    const payload = body + raw;
    if (payload.includes('<!ENTITY') || payload.includes('SYSTEM')) {
      return [
        'HTTP/1.1 200 OK',
        'Content-Type: application/xml',
        '',
        '<?xml version="1.0"?><result>xxe-lab-host</result><!-- flag: EVIL{xxe_entity} -->',
      ].join('\n');
    }
    if (url.includes('/api/parse') || body.includes('<user>')) {
      return 'HTTP/1.1 400 Bad Request\n{"error":"XML entity resolution disabled? try ENTITY"}';
    }
  }

  if (lab.web && body.includes("'1'='1")) {
    session.objectivesDone.push('sqli');
    return [
      'HTTP/1.1 200 OK',
      'Set-Cookie: session=admin_lab_token; HttpOnly',
      '',
      '{"status":"ok","user":"admin","message":"Login bypass — flag: EVIL{sqli_login_bypass}"}',
    ].join('\n');
  }
  if (url.includes('/login') || url.endsWith(lab.targetIp) || url.endsWith(lab.hostname)) {
    return lab.web?.loginHtml || '<html><body>EVIL Web Target</body></html>';
  }
  return '<html><body><h1>EVIL Web Target</h1><p><a href="/login">Login</a></p></body></html>';
}

function sshStart(session, lab, args) {
  const target = args[0] || '';
  const [user, hostPart] = target.includes('@') ? target.split('@') : ['', target];
  const host = normalizeHost(hostPart);
  const lang = session.lang;
  if (!hostMatchesLab(host, lab)) {
    return `ssh: connect to host ${host} port 22: Connection refused ` + t(lang, '(non è il target dello scenario).');
  }
  if (!lab.ssh) {
    return 'ssh: ' + t(lang, 'servizio non configurato su questo target.');
  }
  if (user !== lab.ssh.user) {
    return 'Permission denied (publickey,password).\n' + t(lang, '(Suggerimento: usa l\'utente documentato; chiedi un hint.)');
  }
  session.pendingAuth = { type: 'ssh', user, host: lab.targetIp };
  return `${user}@${lab.targetIp}'s password:`;
}

function sshPassword(session, lab, password) {
  const { user } = session.pendingAuth;
  session.pendingAuth = null;
  if (password !== lab.ssh.password) {
    session.shellContext = 'attacker';
    return 'Permission denied, please try again.';
  }
  session.shellContext = 'target';
  session.sshUser = user;
  session.sshHost = lab.hostname;
  session.isRoot = false;
  const lang = session.lang;
  return [
    `Welcome to ${lab.hostname} (EVIL isolated scenario)`,
    'Last login: Tue Jun  2 09:14:22 2026 from 10.42.0.2',
    '',
    t(lang, 'Digita "help" per i comandi dello scenario.') + ` Prompt: ${currentPrompt(session)}`,
  ].join('\n');
}

function readTargetFile(session, lab, filePath) {
  const files =
    session.isRoot && lab.ssh.rootFiles
      ? { ...lab.ssh.files, ...lab.ssh.rootFiles }
      : lab.ssh?.files || {};
  if (files[filePath]) return files[filePath];
  if (filePath === '/root/flag.txt' && !session.isRoot) {
    return 'cat: /root/flag.txt: Permission denied';
  }
  return `cat: ${filePath}: No such file or directory`;
}

function fixText(session, lab) {
  const lang = session.lang;
  const rem = lab.remediation;
  if (!rem) {
    return t(lang, 'Per questo scenario la correzione è descritta negli obiettivi e nella guida "Studia".');
  }
  session.objectivesDone.push('defend');
  return [
    t(lang, '== Come si corregge =='),
    pick(lang, rem.fix),
    '',
    t(lang, '== Come si rileva =='),
    pick(lang, rem.detect),
  ].join('\n');
}

function handleFindPrivesc(session, lab, raw) {
  const lang = session.lang;
  if (!raw.includes('-exec') || !raw.includes('/bin/sh')) {
    return 'find: ' + t(lang, 'espressione non valida (suggerimento: consulta GTFOBins per il comando che apre una shell con -exec).');
  }
  session.isRoot = true;
  return [
    'find: command executed as root',
    'root@privesc:/# id',
    'uid=0(root) gid=0(root) groups=0(root)',
    '',
    t(lang, 'Shell con privilegi di root ottenuta. Leggi /root/flag.txt'),
  ].join('\n');
}

function submitFlag(session, lab, flagValue) {
  const lang = session.lang;
  const val = (flagValue || '').trim();
  if (val === lab.flag) {
    session.completed = true;
    session.objectivesDone.push('flag');
    return [
      t(lang, '✓ Flag corretta!'),
      t(lang, 'Scenario "{title}" completato.', { title: pick(lang, lab.title) }),
      t(lang, 'Ricorda il passo "Difendi": digita fix per vedere la correzione e come si rileva l\'attacco.'),
    ].join('\n');
  }
  return t(lang, 'Flag non valida. Continua l\'analisi e riprova.');
}

function helpText(session) {
  const lang = session.lang;
  const base = [
    t(lang, 'Comandi dello scenario EVIL (rete isolata 10.42.x.x):'),
    '  help          — ' + t(lang, 'questo messaggio'),
    '  objectives    — ' + t(lang, 'obiettivi dello scenario'),
    '  hint          — ' + t(lang, 'suggerimento didattico'),
    '  fix           — ' + t(lang, 'come si corregge la vulnerabilità e come si rileva'),
    '  nmap [opts] IP — ' + t(lang, 'scansione porte (solo target assegnato)'),
    '  ping IP       — ' + t(lang, 'verifica host dello scenario'),
    '  curl URL      — ' + t(lang, 'richiesta HTTP verso il target web'),
    '  dirb URL      — ' + t(lang, 'enumerazione directory (scenario directory)'),
    '  hydra ... ssh — ' + t(lang, 'attacco a dizionario SSH (scenario brute force)'),
    '  smbclient ... — ' + t(lang, 'enumerazione SMB (scenario SMB)'),
    '  ftp ...       — ' + t(lang, 'accesso FTP (scenario FTP anonimo)'),
    '  ssh user@IP   — ' + t(lang, 'accesso SSH simulato (poi inserisci la password)'),
    '  ls [path]     — ' + t(lang, 'elenco file (dopo SSH)'),
    '  cat FILE      — ' + t(lang, 'leggi file (dopo SSH)'),
    '  whoami / id   — ' + t(lang, 'utente corrente'),
    '  sudo -l       — ' + t(lang, 'permessi sudo (scenario privesc)'),
    '  submit flag X — ' + t(lang, 'consegna la flag'),
    '  exit          — ' + t(lang, 'disconnetti dal target SSH'),
  ];
  if (session.shellContext === 'target') {
    base.push('  sudo find ... — ' + t(lang, 'scenario privilege escalation'));
  }
  return base.join('\n');
}

function hydraOutput(lab, args, lang) {
  if (!lab.bruteforce) {
    return 'hydra: ' + t(lang, 'scenario non configurato per il brute force.');
  }
  const target = args.find((a) => a.includes('ssh://') || a.match(/^\d+\.\d+/));
  const host = target?.replace('ssh://', '').split('/')[0] || '';
  if (!hostMatchesLab(host, lab)) {
    return `hydra: ` + t(lang, 'il target {host} non appartiene a questo scenario.', { host: host || '?' });
  }
  return [
    'Hydra v9.5 (c) 2023 — EVIL lab mode',
    `[DATA] attacking ssh://${lab.targetIp}:22/`,
    `[22][ssh] host: ${lab.targetIp}   login: ${lab.bruteforce.user}   password: ${lab.bruteforce.password}`,
    `[STATUS] 1 valid password found`,
    '',
    t(lang, 'Report salvato — flag dello scenario: {flag}', { flag: lab.flag }),
  ].join('\n');
}

function dirbOutput(lab, args, lang) {
  if (lab.web?.type !== 'dir') {
    return 'dirb: ' + t(lang, 'disponibile solo nello scenario di scoperta directory.');
  }
  const url = args.find((a) => a.startsWith('http')) || '';
  if (!url.includes(lab.targetIp) && !url.includes(lab.hostname)) {
    return 'dirb: ' + t(lang, 'target non valido per questo scenario.');
  }
  return [
    'DIRB v2.22 — EVIL lab',
    'URL_BASE: http://' + lab.targetIp + '/',
    'GENERATED WORDS: 4612',
    '',
    '+ http://' + lab.targetIp + '/admin (CODE:200|SIZE:512)',
    '+ http://' + lab.targetIp + '/backup (CODE:403|SIZE:0)',
    '+ http://' + lab.targetIp + '/images (CODE:200|SIZE:1024)',
    '',
    'END_TIME: ' + t(lang, 'scansione completata — prova curl /admin/flag.txt'),
  ].join('\n');
}

function smbclientOutput(lab, args, raw, lang) {
  if (!lab.smb) {
    return 'smbclient: ' + t(lang, 'non disponibile in questo scenario.');
  }
  const targetArg = args.find((a) => a.startsWith('//')) || '';
  const host = targetArg.replace('//', '').split('/')[0];
  if (!hostMatchesLab(host, lab)) {
    return `smbclient: ` + t(lang, 'impossibile connettersi a {host}.', { host: host || '?' });
  }
  if (raw.includes('-L') || raw.includes('--list')) {
    return [
      '',
      '        Sharename       Type      Comment',
      '        ---------       ----      -------',
      '        backup          Disk      EVIL backup share',
      '        public          Disk      Public read-only',
      '        IPC$            IPC       IPC Service',
    ].join('\n');
  }
  if (targetArg.includes('/backup') && (raw.includes('get flag') || raw.includes('-c'))) {
    return [
      'getting file \\flag.txt of size 32 as flag.txt',
      lab.smb.flagFile,
    ].join('\n');
  }
  if (targetArg.includes('/backup')) {
    return 'Try "smbclient //' + lab.targetIp + '/backup -N -c \\"get flag.txt\\""';
  }
  return 'smb: connection established — ' + t(lang, 'usa -L per elencare le share.');
}

function ftpOutput(lab, args, raw, lang) {
  if (!lab.ftp) {
    return 'ftp: ' + t(lang, 'non disponibile in questo scenario.');
  }
  const joined = raw.toLowerCase();
  if (!joined.includes(lab.targetIp) && !joined.includes('ftp-lab')) {
    return `ftp: ` + t(lang, 'host non valido — il target dello scenario è {ip}.', { ip: lab.targetIp });
  }
  if (!joined.includes('anonymous') && !joined.includes('-a')) {
    return [
      `220 ${lab.hostname} FTP server ready.`,
      '530 Login incorrect.',
      t(lang, 'Suggerimento: in questo scenario è abilitato il login anonimo.'),
    ].join('\n');
  }
  if (joined.includes('get flag') || joined.includes('-c') || joined.includes('ls') || joined.includes('dir')) {
    return [
      `230 Anonymous login ok.`,
      `227 Entering Passive Mode (${lab.targetIp}).`,
      '150 Opening BINARY mode for flag.txt.',
      lab.flag,
      '226 Transfer complete.',
    ].join('\n');
  }
  return [
    `Connected to ${lab.hostname}.`,
    '230 Anonymous login ok.',
    '227 Directory listing:',
    'flag.txt  backup/  readme.txt',
    t(lang, 'Suggerimento: scarica il file in modo non interattivo con') +
      ` curl "ftp://anonymous:anon@${lab.targetIp}/flag.txt"`,
  ].join('\n');
}

async function execCommand(sessionId, ownerKey, commandLine) {
  const session = await getSession(sessionId, ownerKey);
  const lab = getLab(session.labId);
  const lang = session.lang;
  session.commandCount += 1;

  if (session.pendingAuth?.type === 'ssh') {
    const out = sshPassword(session, lab, commandLine.trim());
    await persistSession(session);
    return buildExecResult(session, lab, out);
  }

  const { cmd, args, raw } = parseCommandLine(commandLine);
  if (!cmd) {
    await persistSession(session);
    return buildExecResult(session, lab, '');
  }

  let output = '';

  switch (cmd) {
    case 'help':
      output = helpText(session);
      break;
    case 'objectives': {
      const objectives = pick(lang, lab.objectives) || [];
      output = objectives.map((o, i) => `${i + 1}. ${o}`).join('\n');
      break;
    }
    case 'hint': {
      const hints = pick(lang, lab.hints) || [];
      const idx = parseInt(args[0], 10) || 1;
      output = hints[Math.min(idx, hints.length) - 1] || hints[0] || '';
      break;
    }
    case 'fix':
    case 'patch':
      output = fixText(session, lab);
      break;
    case 'clear':
      output = '';
      break;
    case 'nmap':
      output = nmapOutput(lab, args, lang);
      break;
    case 'ping': {
      const host = normalizeHost(args[0]);
      if (hostMatchesLab(host, lab)) {
        output = [
          `PING ${lab.hostname} (${lab.targetIp}) 56(84) bytes of data.`,
          `64 bytes from ${lab.targetIp}: icmp_seq=1 ttl=64 time=0.412 ms`,
          '',
          `--- ${lab.hostname} ping statistics ---`,
          '1 packets transmitted, 1 received, 0% packet loss',
        ].join('\n');
      } else {
        output = `ping: ${host}: Name or service not known (fuori rete lab)`;
      }
      break;
    }
    case 'curl':
      output = curlOutput(session, lab, args, raw);
      break;
    case 'hydra':
      output = hydraOutput(lab, args, lang);
      break;
    case 'dirb':
      output = dirbOutput(lab, args, lang);
      break;
    case 'smbclient':
      output = smbclientOutput(lab, args, raw, lang);
      break;
    case 'ftp':
      output = ftpOutput(lab, args, raw, lang);
      break;
    case 'ssh':
      output = sshStart(session, lab, args);
      break;
    case 'exit':
    case 'logout':
      if (session.shellContext === 'target') {
        session.shellContext = 'attacker';
        session.sshUser = null;
        session.sshHost = null;
        session.isRoot = false;
        output = 'Connection to target closed.\n';
      } else {
        output = t(lang, 'Non sei connesso a un target SSH.');
      }
      break;
    case 'whoami':
      output =
        session.shellContext === 'target'
          ? session.isRoot
            ? 'root'
            : session.sshUser
          : ATTACKER.user;
      break;
    case 'id':
      if (session.shellContext === 'target') {
        output = session.isRoot
          ? 'uid=0(root) gid=0(root) groups=0(root)'
          : `uid=1000(${session.sshUser}) gid=1000(${session.sshUser}) groups=1000(${session.sshUser})`;
      } else {
        output = `uid=1000(${ATTACKER.user}) gid=1000(${ATTACKER.user}) groups=1000(${ATTACKER.user})`;
      }
      break;
    case 'ls': {
      if (session.shellContext !== 'target') {
        output = 'Desktop  lab-tools  scans\n' + t(lang, '(Prima connettiti al target via ssh.)');
        break;
      }
      const path = args[0] || '/home/' + session.sshUser;
      if (path.startsWith('/root') && !session.isRoot) {
        output = 'ls: cannot open directory \'/root\': Permission denied';
      } else if (path.includes('student')) {
        output = 'notes.txt  .bash_history';
      } else if (path.includes('dev')) {
        output = 'readme.txt  projects';
      } else if (path === '/root' || path.startsWith('/root')) {
        output = 'flag.txt';
      } else {
        output = 'readme.txt';
      }
      break;
    }
    case 'cat': {
      if (session.shellContext !== 'target') {
        output = t(lang, 'cat: non disponibile — prima connettiti al target via ssh.');
        break;
      }
      output = readTargetFile(session, lab, args[0] || '');
      break;
    }
    case 'sudo':
      if (args[0] === '-l' && session.shellContext === 'target' && lab.ssh?.sudo) {
        output = lab.ssh.sudo.output;
      } else if (args[0] === 'find' || raw.startsWith('sudo find')) {
        if (session.shellContext !== 'target') {
          output = 'sudo: command not found on jumpbox';
        } else {
          output = handleFindPrivesc(session, lab, raw);
        }
      } else {
        output = 'sudo: command not allowed in this lab context';
      }
      break;
    case 'find':
      if (session.shellContext === 'target' && raw.includes('-exec')) {
        output = handleFindPrivesc(session, lab, raw);
      } else {
        output = './readme.txt\n./projects';
      }
      break;
    case 'submit':
      if ((args[0] || '').toLowerCase() === 'flag') {
        output = submitFlag(session, lab, args.slice(1).join(' '));
      } else {
        output = t(lang, 'Uso: submit flag <flag>');
      }
      break;
    default:
      output = t(lang, '{cmd}: comando non disponibile nello scenario. Digita "help".', { cmd });
  }

  await persistSession(session);
  return buildExecResult(session, lab, output);
}

function buildExecResult(session, lab, output) {
  return {
    output,
    prompt: currentPrompt(session),
    completed: session.completed,
    pendingPassword: !!session.pendingAuth,
    session: sanitizeSession(session, lab),
  };
}

function purgeExpiredSessions() {
  const now = Date.now();
  for (const [id, s] of sessions) {
    if (s.expiresAt < now) sessions.delete(id);
  }
}

setInterval(purgeExpiredSessions, 10 * 60 * 1000).unref();

module.exports = {
  catalogForClient,
  getLab,
  validateLabId,
  ownerKeyFromRequest,
  ensureAnonOwner,
  ANON_COOKIE,
  createSession,
  getSession,
  stopSession,
  execCommand,
  sanitizeSession,
  ATTACKER,
};

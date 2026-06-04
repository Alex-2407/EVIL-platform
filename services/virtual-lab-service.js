/**
 * Laboratorio Virtuale EVIL — VM isolate simulate (solo rete lab 10.42.x.x).
 * Nessuna connessione reale: risposte didattiche controllate lato server.
 */
const crypto = require('crypto');

const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_OWNER = 3;
const LAB_ID_PATTERN = /^[a-z0-9-]+$/i;

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
    redisClient = new Redis(url);
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

const LAB_CATALOG = {
  'network-recon': {
    id: 'network-recon',
    name: 'EVIL-NetProbe',
    title: 'Ricognizione di rete',
    difficulty: 'Principiante',
    duration: '30–45 min',
    targetIp: '10.42.10.5',
    hostname: 'gateway.evil.lab',
    icon: '◈',
    description: 'Mappa la rete isolata EVIL: host attivi, porte e servizi con nmap.',
    objectives: [
      'Esegui una scansione con nmap sul target 10.42.10.5',
      'Identifica almeno due servizi in ascolto',
      'Invia la flag con submit flag EVIL{recon_complete}',
    ],
    flag: 'EVIL{recon_complete}',
    hints: [
      'Prova: nmap -sV 10.42.10.5',
      'Cerca porte 22, 80 e 443 nella risposta di nmap.',
    ],
    nmap: {
      ports: [
        { port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 8.9' },
        { port: 80, state: 'open', service: 'http', version: 'nginx 1.24' },
        { port: 443, state: 'open', service: 'https', version: 'nginx 1.24' },
      ],
    },
  },
  'web-app-01': {
    id: 'web-app-01',
    name: 'EVIL-WebTarget',
    title: 'Applicazione web vulnerabile',
    difficulty: 'Principiante',
    duration: '45–60 min',
    targetIp: '10.42.10.11',
    hostname: 'web-target.evil.lab',
    icon: '◇',
    description: 'Target web in VLAN isolata: login debole e SQL injection simulata.',
    objectives: [
      'Scansiona 10.42.10.11 e verifica la porta 80',
      'Recupera la pagina di login con curl',
      'Bypassa il login con SQL injection nel parametro user',
      'Invia la flag ottenuta con submit flag',
    ],
    flag: 'EVIL{sqli_login_bypass}',
    hints: [
      'curl http://10.42.10.11/login',
      'Prova user=admin\' OR \'1\'=\'1 nel body POST del form.',
    ],
    nmap: {
      ports: [
        { port: 80, state: 'open', service: 'http', version: 'nginx 1.22' },
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
      sqliPayload: "admin' OR '1'='1",
    },
  },
  'linux-ssh-01': {
    id: 'linux-ssh-01',
    name: 'EVIL-LinuxBox',
    title: 'Accesso SSH debole',
    difficulty: 'Intermedio',
    duration: '45–60 min',
    targetIp: '10.42.10.21',
    hostname: 'linuxbox.evil.lab',
    icon: '▣',
    description: 'Server Linux con credenziali prevedibili. Solo rete lab EVIL.',
    objectives: [
      'Individua la porta SSH con nmap',
      'Connettiti via ssh student@10.42.10.21',
      'Leggi /home/student/notes.txt e invia la flag',
    ],
    flag: 'EVIL{weak_ssh_creds}',
    hints: [
      'nmap -p 22 10.42.10.21',
      'Password comune in lab: evil2024 per l\'utente student.',
    ],
    nmap: {
      ports: [{ port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 8.4' }],
    },
    ssh: {
      user: 'student',
      password: 'evil2024',
      files: {
        '/home/student/notes.txt': 'Backup credenziali lab — flag: EVIL{weak_ssh_creds}\nNon riutilizzare in produzione.',
        '/etc/passwd': 'root:x:0:0:root:/root:/bin/bash\nstudent:x:1000:1000:Lab User:/home/student:/bin/bash',
      },
    },
  },
  'linux-privesc-01': {
    id: 'linux-privesc-01',
    name: 'EVIL-Server',
    title: 'Privilege escalation',
    difficulty: 'Avanzato',
    duration: '60–90 min',
    targetIp: '10.42.10.22',
    hostname: 'privesc.evil.lab',
    icon: '⬡',
    description: 'Shell limitata e sudo mal configurato — escalation didattica.',
    objectives: [
      'Accedi via ssh come dev@10.42.10.22',
      'Esegui sudo -l e individua find',
      'Ottieni shell root con sudo find',
      'Leggi /root/flag.txt e invia la flag',
    ],
    flag: 'EVIL{sudo_find_shell}',
    hints: [
      'Credenziali lab: dev / devlab',
      'sudo find . -exec /bin/sh \\; -quit apre una shell root.',
    ],
    nmap: {
      ports: [{ port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 9.0' }],
    },
    ssh: {
      user: 'dev',
      password: 'devlab',
      files: {
        '/home/dev/readme.txt': 'Utente dev — prova sudo -l',
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
    title: 'Cross-Site Scripting (XSS)',
    difficulty: 'Principiante',
    duration: '30–45 min',
    targetIp: '10.42.10.12',
    hostname: 'xss-lab.evil.lab',
    icon: '◆',
    description: 'Parametro di ricerca che riflette input non filtrato nel browser.',
    objectives: [
      'Scansiona 10.42.10.12 e apri la pagina di ricerca',
      'Inietta un payload XSS nel parametro q',
      'Invia la flag ottenuta con submit flag',
    ],
    flag: 'EVIL{xss_reflected}',
    hints: [
      'curl "http://10.42.10.12/search?q=test"',
      'Prova q=<script>alert(1)</script> nell\'URL.',
    ],
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'Apache 2.4' }],
    },
    web: { type: 'xss' },
  },
  'lfi-web': {
    id: 'lfi-web',
    name: 'EVIL-LFILab',
    title: 'Local File Inclusion',
    difficulty: 'Intermedio',
    duration: '45–60 min',
    targetIp: '10.42.10.15',
    hostname: 'lfi-lab.evil.lab',
    icon: '▤',
    description: 'Parametro file che legge path arbitrari sul server web.',
    objectives: [
      'Trova l\'endpoint /view?file= sulla porta 80',
      'Usa directory traversal per leggere /etc/passwd',
      'Invia la flag con submit flag',
    ],
    flag: 'EVIL{lfi_traversal}',
    hints: [
      'curl "http://10.42.10.15/view?file=index.php"',
      'Prova file=../../../etc/passwd',
    ],
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'nginx 1.20' }],
    },
    web: { type: 'lfi' },
  },
  'csrf-web': {
    id: 'csrf-web',
    name: 'EVIL-CSRFLab',
    title: 'Cross-Site Request Forgery',
    difficulty: 'Intermedio',
    duration: '30–45 min',
    targetIp: '10.42.10.13',
    hostname: 'csrf-lab.evil.lab',
    icon: '◎',
    description: 'Form che cambia email senza token anti-CSRF.',
    objectives: [
      'Ispeziona il form /account/email con curl',
      'Simula POST senza token di protezione',
      'Invia la flag restituita dal server',
    ],
    flag: 'EVIL{csrf_no_token}',
    hints: [
      'curl http://10.42.10.13/account/email',
      'curl -d "email=attacker@evil.lab" http://10.42.10.13/account/email',
    ],
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'nginx 1.18' }],
    },
    web: { type: 'csrf' },
  },
  'dir-discovery': {
    id: 'dir-discovery',
    name: 'EVIL-DirLab',
    title: 'Directory brute force',
    difficulty: 'Principiante',
    duration: '30–45 min',
    targetIp: '10.42.10.14',
    hostname: 'dir-lab.evil.lab',
    icon: '▧',
    description: 'Percorsi nascosti su web server — enum con dirb.',
    objectives: [
      'Esegui dirb sul target web',
      'Recupera /admin/flag.txt con curl',
      'Invia la flag con submit flag',
    ],
    flag: 'EVIL{hidden_admin_path}',
    hints: [
      'dirb http://10.42.10.14/',
      'curl http://10.42.10.14/admin/flag.txt',
    ],
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'Apache 2.4' }],
    },
    web: { type: 'dir' },
  },
  'brute-force-ssh': {
    id: 'brute-force-ssh',
    name: 'EVIL-BruteLab',
    title: 'Brute force SSH',
    difficulty: 'Intermedio',
    duration: '45–60 min',
    targetIp: '10.42.10.23',
    hostname: 'brute.evil.lab',
    icon: '▨',
    description: 'Servizio SSH con password debole scoperta via hydra.',
    objectives: [
      'Conferma SSH aperto con nmap',
      'Lancia hydra con wordlist lab su admin',
      'Invia la flag trovata nel report hydra',
    ],
    flag: 'EVIL{hydra_ssh_win}',
    hints: [
      'nmap -p 22 10.42.10.23',
      'hydra -l admin -P /usr/share/wordlists/lab.txt ssh://10.42.10.23',
    ],
    nmap: {
      ports: [{ port: 22, state: 'open', service: 'ssh', version: 'OpenSSH 7.6' }],
    },
    bruteforce: { user: 'admin', password: 'lab2024' },
  },
  'smb-enum': {
    id: 'smb-enum',
    name: 'EVIL-SMBLab',
    title: 'Enumerazione SMB',
    difficulty: 'Intermedio',
    duration: '45–60 min',
    targetIp: '10.42.10.31',
    hostname: 'smb-lab.evil.lab',
    icon: '▥',
    description: 'Condivisioni SMB esposte in rete interna lab.',
    objectives: [
      'Scansiona la porta 445 con nmap',
      'Elenca share con smbclient -L',
      'Leggi flag.txt dalla share backup',
      'Invia la flag con submit flag',
    ],
    flag: 'EVIL{smb_open_share}',
    hints: [
      'nmap -p 445 10.42.10.31',
      'smbclient -L //10.42.10.31 -N',
      'smbclient //10.42.10.31/backup -N -c "get flag.txt"',
    ],
    nmap: {
      ports: [
        { port: 445, state: 'open', service: 'microsoft-ds', version: 'Samba 4.15' },
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
    title: 'Command injection',
    difficulty: 'Intermedio',
    duration: '30–45 min',
    targetIp: '10.42.10.16',
    hostname: 'cmdi-lab.evil.lab',
    icon: '▩',
    description: 'Parametro host passato a system() senza sanitizzazione — OS command injection.',
    objectives: [
      'Trova /ping?host= sul web target',
      'Concatena un comando con ; o |',
      'Invia la flag restituita dal server',
    ],
    flag: 'EVIL{cmd_injection}',
    hints: [
      'curl "http://10.42.10.16/ping?host=127.0.0.1"',
      'curl "http://10.42.10.16/ping?host=127.0.0.1;whoami"',
    ],
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'Apache 2.4' }],
    },
    web: { type: 'cmdi' },
  },
  'ssrf-web': {
    id: 'ssrf-web',
    name: 'EVIL-SSRFLab',
    title: 'Server-Side Request Forgery',
    difficulty: 'Avanzato',
    duration: '45–60 min',
    targetIp: '10.42.10.17',
    hostname: 'ssrf-lab.evil.lab',
    icon: '◉',
    description: 'Il server recupera URL scelti dall\'utente — accesso a risorse interne.',
    objectives: [
      'Ispeziona /fetch?url= con curl',
      'Richiedi un host interno lab (10.42.0.99)',
      'Invia la flag dal metadata service simulato',
    ],
    flag: 'EVIL{ssrf_internal}',
    hints: [
      'curl "http://10.42.10.17/fetch?url=http://example.com"',
      'curl "http://10.42.10.17/fetch?url=http://10.42.0.99/internal/flag"',
    ],
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'nginx 1.22' }],
    },
    web: { type: 'ssrf' },
  },
  'idor-api': {
    id: 'idor-api',
    name: 'EVIL-IDORLab',
    title: 'IDOR su API REST',
    difficulty: 'Intermedio',
    duration: '30–45 min',
    targetIp: '10.42.10.18',
    hostname: 'api-lab.evil.lab',
    icon: '▷',
    description: 'Cambio ID numerico nell\'API espone dati di altri utenti.',
    objectives: [
      'Chiama /api/user?id=1000 (tuo profilo)',
      'Incrementa l\'ID per accedere a dati altrui',
      'Invia la flag del record esposto',
    ],
    flag: 'EVIL{idor_user_data}',
    hints: [
      'curl "http://10.42.10.18/api/user?id=1000"',
      'curl "http://10.42.10.18/api/user?id=1001"',
    ],
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'nginx 1.24' }],
    },
    web: { type: 'idor' },
  },
  'jwt-weak': {
    id: 'jwt-weak',
    name: 'EVIL-JWTLab',
    title: 'JWT / auth API rotta',
    difficulty: 'Avanzato',
    duration: '45–60 min',
    targetIp: '10.42.10.19',
    hostname: 'jwt-lab.evil.lab',
    icon: '▶',
    description: 'Token JWT con secret debole — escalation a ruolo admin via API.',
    objectives: [
      'Richiedi /api/profile senza token (403)',
      'Usa il token admin di lab nell\'header Authorization',
      'Invia la flag dalla risposta privilegiata',
    ],
    flag: 'EVIL{jwt_admin_role}',
    hints: [
      'curl http://10.42.10.19/api/profile',
      'curl -H "Authorization: Bearer evil.admin.token.lab" http://10.42.10.19/api/profile',
    ],
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'nginx 1.22' }],
    },
    web: { type: 'jwt' },
  },
  'file-upload': {
    id: 'file-upload',
    name: 'EVIL-UploadLab',
    title: 'Upload file pericoloso',
    difficulty: 'Intermedio',
    duration: '30–45 min',
    targetIp: '10.42.10.20',
    hostname: 'upload-lab.evil.lab',
    icon: '▤',
    description: 'Endpoint upload senza validazione estensione — webshell simulata.',
    objectives: [
      'Trova POST /upload',
      'Carica un file .php con curl -F',
      'Invia la flag dal percorso di upload',
    ],
    flag: 'EVIL{upload_webshell}',
    hints: [
      'curl http://10.42.10.20/upload',
      'curl -F "file=@shell.php" http://10.42.10.20/upload',
    ],
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'Apache 2.4' }],
    },
    web: { type: 'upload' },
  },
  'xxe-xml': {
    id: 'xxe-xml',
    name: 'EVIL-XXELab',
    title: 'XML External Entity (XXE)',
    difficulty: 'Avanzato',
    duration: '45–60 min',
    targetIp: '10.42.10.24',
    hostname: 'xxe-lab.evil.lab',
    icon: '◐',
    description: 'Parser XML che risolve entità esterne — lettura file lato server.',
    objectives: [
      'Invia XML a POST /api/parse',
      'Inietta entità ENTITY che legge file locali',
      'Invia la flag nell\'output XML',
    ],
    flag: 'EVIL{xxe_entity}',
    hints: [
      'curl -d "<user>test</user>" http://10.42.10.24/api/parse',
      'Usa <!ENTITY x SYSTEM "file:///etc/hostname"> nel payload XML.',
    ],
    nmap: {
      ports: [{ port: 80, state: 'open', service: 'http', version: 'Tomcat 9' }],
    },
    web: { type: 'xxe' },
  },
  'ftp-anonymous': {
    id: 'ftp-anonymous',
    name: 'EVIL-FTPLab',
    title: 'FTP anonymous access',
    difficulty: 'Principiante',
    duration: '20–30 min',
    targetIp: '10.42.10.32',
    hostname: 'ftp-lab.evil.lab',
    icon: '▥',
    description: 'Server FTP con login anonymous e file sensibili esposti.',
    objectives: [
      'Scansiona porta 21 con nmap',
      'Accedi come anonymous via ftp',
      'Scarica flag.txt e invia la flag',
    ],
    flag: 'EVIL{ftp_anonymous}',
    hints: [
      'nmap -p 21 10.42.10.32',
      'ftp anonymous@10.42.10.32 -c "get flag.txt"',
    ],
    nmap: {
      ports: [{ port: 21, state: 'open', service: 'ftp', version: 'vsftpd 3.0' }],
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

function catalogForClient() {
  return Object.values(LAB_CATALOG).map((lab) => ({
    id: lab.id,
    name: lab.name,
    title: lab.title,
    difficulty: lab.difficulty,
    duration: lab.duration,
    targetIp: lab.targetIp,
    hostname: lab.hostname,
    icon: lab.icon,
    description: lab.description,
    objectiveCount: lab.objectives.length,
  }));
}

function getLab(labId) {
  return LAB_CATALOG[labId] || null;
}

function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ip = String(forwarded).split(',')[0].trim();
    if (ip) return ip;
  }
  return req.ip || null;
}

function ownerKeyFromRequest(req) {
  if (req.user?.id) return `user:${req.user.id}`;
  const ip = resolveClientIp(req);
  if (ip) return `ip:${ip}`;
  const ua = req.headers['user-agent'] || 'browser';
  const hash = crypto.createHash('sha256').update(ua).digest('hex').slice(0, 12);
  return `anon:${hash}`;
}

function validateLabId(labId) {
  if (typeof labId !== 'string') return '';
  const id = labId.trim();
  return LAB_ID_PATTERN.test(id) ? id : '';
}

function newSessionId() {
  return crypto.randomBytes(12).toString('hex');
}

async function createSession(labId, ownerKey) {
  const lab = getLab(labId);
  if (!lab) {
    const err = new Error('Lab non trovato');
    err.status = 404;
    throw err;
  }

  const running = await countRunningSessions(ownerKey);
  if (running >= MAX_SESSIONS_PER_OWNER) {
    const err = new Error('Limite sessioni attive raggiunto (max 3). Termina un lab prima.');
    err.status = 429;
    throw err;
  }

  const id = newSessionId();
  const now = Date.now();
  const session = {
    id,
    labId,
    ownerKey,
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
          title: l.title,
          targetIp: l.targetIp,
          hostname: l.hostname,
          objectives: l.objectives,
          difficulty: l.difficulty,
        }
      : null,
    attacker: ATTACKER,
  };
}

async function getSession(sessionId, ownerKey) {
  const session = await loadSessionById(sessionId);
  if (!session) {
    const err = new Error('Sessione non trovata o scaduta');
    err.status = 404;
    throw err;
  }
  if (session.ownerKey !== ownerKey) {
    const err = new Error('Accesso negato a questa sessione');
    err.status = 403;
    throw err;
  }
  if (session.expiresAt < Date.now()) {
    await removeSessionById(sessionId, ownerKey);
    const err = new Error('Sessione scaduta');
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

function nmapOutput(lab, args) {
  const targetArg = args.find((a) => !a.startsWith('-'));
  if (!targetArg || !hostMatchesLab(targetArg, lab)) {
    return `Note: Host ${targetArg || 'unknown'} seems down or unreachable on lab network 10.42.10.0/24.\n(Solo i target EVIL assegnati al lab sono raggiungibili.)`;
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

function curlOutput(session, lab, args) {
  const url = args.find((a) => a.startsWith('http')) || args[0] || '';
  if (!url.includes(lab.targetIp) && !url.includes(lab.hostname)) {
    return `curl: (7) Failed to connect — host non autorizzato fuori VLAN lab.`;
  }
  const bodyIdx = args.indexOf('-d');
  const body = bodyIdx >= 0 ? args[bodyIdx + 1] : '';
  const webType = lab.web?.type;

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
  if (!hostMatchesLab(host, lab)) {
    return `ssh: connect to host ${host} port 22: Connection refused (non è un target del lab).`;
  }
  if (!lab.ssh) {
    return 'ssh: servizio non configurato su questo target.';
  }
  if (user !== lab.ssh.user) {
    return `Permission denied (publickey,password).\n(Hint: utente lab documentato negli obiettivi.)`;
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
  return [
    `Welcome to ${lab.hostname} (EVIL isolated VM)`,
    'Last login: Tue Jun  2 09:14:22 2026 from 10.42.0.2',
    '',
    `Type "help" for lab commands. Prompt: ${currentPrompt(session)}`,
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

function handleFindPrivesc(session, lab, raw) {
  if (!raw.includes('-exec') || !raw.includes('/bin/sh')) {
    return 'find: missing valid expression (hint: sudo find . -exec /bin/sh \\; -quit)';
  }
  session.isRoot = true;
  return [
    'find: command executed as root',
    'root@privesc:/# id',
    'uid=0(root) gid=0(root) groups=0(root)',
    '',
    'Shell root ottenuta. Leggi /root/flag.txt',
  ].join('\n');
}

function submitFlag(session, lab, flagValue) {
  const val = (flagValue || '').trim();
  if (val === lab.flag) {
    session.completed = true;
    session.objectivesDone.push('flag');
    return [
      '✓ Flag corretta!',
      `Lab "${lab.title}" completato.`,
      'Obiettivi didattici soddisfatti in ambiente isolato EVIL.',
    ].join('\n');
  }
  return 'Flag non valida. Continua l\'investigazione e riprova.';
}

function helpText(session) {
  const base = [
    'Comandi lab EVIL (rete isolata 10.42.x.x):',
    '  help          — questo messaggio',
    '  objectives    — obiettivi del lab',
    '  hint          — suggerimento didattico',
    '  nmap [opts] IP — scansione porte (solo target assegnato)',
    '  ping IP       — verifica host lab',
    '  curl URL      — HTTP verso web target',
    '  dirb URL      — brute force directory (lab dir)',
    '  hydra ... ssh — brute force SSH (lab hydra)',
    '  smbclient ... — enum SMB (lab smb)',
    '  ftp ...       — accesso FTP (lab ftp anonymous)',
    '  ssh user@IP   — accesso SSH simulato (poi inserisci password)',
    '  ls [path]     — elenco file (dopo SSH)',
    '  cat FILE      — leggi file (dopo SSH)',
    '  whoami / id   — utente corrente',
    '  sudo -l       — permessi sudo (lab privesc)',
    '  submit flag X — consegna flag CTF',
    '  exit          — disconnetti da target SSH',
  ];
  if (session.shellContext === 'target') {
    base.push('  sudo find ... — lab privilege escalation');
  }
  return base.join('\n');
}

function hydraOutput(lab, args) {
  if (!lab.bruteforce) {
    return 'hydra: lab non configurato per brute force.';
  }
  const target = args.find((a) => a.includes('ssh://') || a.match(/^\d+\.\d+/));
  const host = target?.replace('ssh://', '').split('/')[0] || '';
  if (!hostMatchesLab(host, lab)) {
    return `hydra: target ${host || '?'} non appartiene a questo lab.`;
  }
  return [
    'Hydra v9.5 (c) 2023 — EVIL lab mode',
    `[DATA] attacking ssh://${lab.targetIp}:22/`,
    `[22][ssh] host: ${lab.targetIp}   login: ${lab.bruteforce.user}   password: ${lab.bruteforce.password}`,
    `[STATUS] 1 valid password found`,
    '',
    `Report salvato — flag lab: ${lab.flag}`,
  ].join('\n');
}

function dirbOutput(lab, args) {
  if (lab.web?.type !== 'dir') {
    return 'dirb: disponibile solo nel lab directory discovery.';
  }
  const url = args.find((a) => a.startsWith('http')) || '';
  if (!url.includes(lab.targetIp) && !url.includes(lab.hostname)) {
    return `dirb: target non valido per questo lab.`;
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
    'END_TIME: scan completata — prova curl /admin/flag.txt',
  ].join('\n');
}

function smbclientOutput(lab, args, raw) {
  if (!lab.smb) {
    return 'smbclient: non disponibile in questo lab.';
  }
  const targetArg = args.find((a) => a.startsWith('//')) || '';
  const host = targetArg.replace('//', '').split('/')[0];
  if (!hostMatchesLab(host, lab)) {
    return `smbclient: impossibile connettersi a ${host || '?'}.`;
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
  return 'smb: connection established — usa -L per elencare le share.';
}

function ftpOutput(lab, args, raw) {
  if (!lab.ftp) {
    return 'ftp: non disponibile in questo lab.';
  }
  const joined = raw.toLowerCase();
  if (!joined.includes(lab.targetIp) && !joined.includes('ftp-lab')) {
    return `ftp: host non valido — target lab ${lab.targetIp}.`;
  }
  if (!joined.includes('anonymous') && !joined.includes('-a')) {
    return [
      `220 ${lab.hostname} FTP server ready.`,
      '530 Login incorrect.',
      'Hint: login anonymous abilitato in questo lab.',
    ].join('\n');
  }
  if (joined.includes('get flag') || joined.includes('-c')) {
    return [
      `230 Anonymous login ok.`,
      `227 Entering Passive Mode (${lab.targetIp}).`,
      '150 Opening BINARY mode for flag.txt.',
      lab.flag,
    ].join('\n');
  }
  return [
    `Connected to ${lab.hostname}.`,
    '230 Anonymous login ok.',
    '227 Directory listing:',
    'flag.txt  backup/  readme.txt',
    '214 Help: ftp anonymous@' + lab.targetIp + ' -c "get flag.txt"',
  ].join('\n');
}

async function execCommand(sessionId, ownerKey, commandLine) {
  const session = await getSession(sessionId, ownerKey);
  const lab = getLab(session.labId);
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
    case 'objectives':
      output = lab.objectives.map((o, i) => `${i + 1}. ${o}`).join('\n');
      break;
    case 'hint': {
      const idx = parseInt(args[0], 10) || 1;
      output = lab.hints[Math.min(idx, lab.hints.length) - 1] || lab.hints[0];
      break;
    }
    case 'clear':
      output = '';
      break;
    case 'nmap':
      output = nmapOutput(lab, args);
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
      output = curlOutput(session, lab, args);
      break;
    case 'hydra':
      output = hydraOutput(lab, args);
      break;
    case 'dirb':
      output = dirbOutput(lab, args);
      break;
    case 'smbclient':
      output = smbclientOutput(lab, args, raw);
      break;
    case 'ftp':
      output = ftpOutput(lab, args, raw);
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
        output = 'Non sei connesso a un target SSH.';
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
        output = 'Desktop  lab-tools  scans\n(Uso: connettiti al target via ssh prima.)';
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
        output = 'cat: impossibile — connettiti al target via ssh.';
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
        output = 'Uso: submit flag EVIL{...}';
      }
      break;
    default:
      output = `${cmd}: comando non disponibile nel lab. Digita "help".`;
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

setInterval(purgeExpiredSessions, 10 * 60 * 1000);

module.exports = {
  catalogForClient,
  getLab,
  validateLabId,
  ownerKeyFromRequest,
  createSession,
  getSession,
  stopSession,
  execCommand,
  sanitizeSession,
  ATTACKER,
};

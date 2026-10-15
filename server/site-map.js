'use strict';
// Mappa del sito: unica fonte per menu, footer, home, ricerca rapida e sitemap.
// Ogni pagina ha titolo e descrizione in tutte le lingue supportate.

const AREAS = [
  {
    id: 'impara',
    color: 'cyan',
    label: { it: 'Impara', en: 'Learn' },
    sub: { it: 'Didattica', en: 'Training' },
    desc: {
      it: 'Capisci come nasce una vulnerabilità e come si chiude, con esercizi guidati che non toccano nessun sistema reale.',
      en: 'Understand how a vulnerability is born and how it is fixed, with guided exercises that never touch a real system.',
    },
  },
  {
    id: 'analizza',
    color: 'amber',
    label: { it: 'Analizza', en: 'Analyse' },
    sub: { it: 'Intelligence', en: 'Intelligence' },
    desc: {
      it: 'Studia minacce e incidenti reali da fonti pubbliche: cosa è successo, come, e cosa ha insegnato a chi difende.',
      en: 'Study real threats and incidents from public sources: what happened, how, and what it taught defenders.',
    },
  },
  {
    id: 'verifica',
    color: 'green',
    label: { it: 'Verifica', en: 'Verify' },
    sub: { it: 'Strumenti', en: 'Tools' },
    desc: {
      it: 'Controlla siti e file che hai il diritto di analizzare e ottieni un risultato spiegato, anche per chi non è tecnico.',
      en: 'Check websites and files you are entitled to analyse and get explained results, even for non-technical readers.',
    },
  },
  {
    id: 'progetto',
    color: 'violet',
    label: { it: 'Progetto', en: 'Project' },
    sub: { it: 'Chi siamo e regole', en: 'About and rules' },
    desc: {
      it: 'Missione, etica e legge, privacy e aiuto: le regole che rendono la conoscenza uno strumento di difesa.',
      en: 'Mission, ethics and law, privacy and help: the rules that turn knowledge into a defensive tool.',
    },
  },
];

// nav: compare nel menu in alto · auth: serve un account · sitemap: priorità (null = esclusa)
const PAGES = [
  // ------------------------------------------------------------------ Impara
  {
    file: 'learning-paths.html', area: 'impara', icon: 'route', nav: true, sitemap: 0.9,
    title: { it: 'Percorsi di apprendimento', en: 'Learning paths' },
    desc: {
      it: 'Tre percorsi ordinati, dai fondamenti al lavoro di un SOC: livello, durata e obiettivi di ogni tappa.',
      en: 'Three ordered tracks, from the basics to SOC work: level, duration and goals for every step.',
    },
  },
  {
    file: 'web-simulator.html', area: 'impara', icon: 'code', nav: true, sitemap: 0.9,
    title: { it: 'Simulatore attacchi web', en: 'Web attack simulator' },
    desc: {
      it: 'SQL injection, XSS, CSRF, brute force e upload insicuro in quattro fasi: contesto, bug, effetto, difesa.',
      en: 'SQL injection, XSS, CSRF, brute force and insecure upload in four phases: context, bug, impact, defence.',
    },
  },
  {
    file: 'virtual-lab.html', area: 'impara', icon: 'flask', nav: true, sitemap: 0.9,
    title: { it: 'Lab virtuale', en: 'Virtual lab' },
    desc: {
      it: 'Scenari guidati in un terminale simulato: ricognizione, sfruttamento e, alla fine di ogni lab, la correzione.',
      en: 'Guided scenarios in a simulated terminal: reconnaissance, exploitation and, at the end of every lab, the fix.',
    },
  },
  {
    file: 'crypto-studio.html', area: 'impara', icon: 'key', nav: true, sitemap: 0.9,
    title: { it: 'Studio cifratura', en: 'Cryptography studio' },
    desc: {
      it: 'Hash, cifrari classici e moderni, TLS e crittografia post-quantistica: provi gli algoritmi e vedi cosa cambia.',
      en: 'Hashes, classical and modern ciphers, TLS and post-quantum cryptography: try the algorithms and see what changes.',
    },
  },
  {
    file: 'hacked-timeline.html', area: 'impara', icon: 'clock', nav: true, sitemap: 0.8,
    title: { it: 'Timeline incident response', en: 'Incident response timeline' },
    desc: {
      it: 'Incidenti ricostruiti minuto per minuto: cosa vede chi difende e quali decisioni avrebbero fermato l’attacco.',
      en: 'Incidents rebuilt minute by minute: what defenders see and which decisions would have stopped the attack.',
    },
  },
  {
    file: 'quiz-hub.html', area: 'impara', icon: 'quiz', nav: true, sitemap: 0.9,
    title: { it: 'Centro quiz', en: 'Quiz centre' },
    desc: {
      it: 'Domande per categoria con spiegazione di ogni risposta, per misurare cosa sai e cosa ripassare.',
      en: 'Questions by category with an explanation for every answer, to measure what you know and what to review.',
    },
  },
  {
    file: 'glossary.html', area: 'impara', icon: 'book', nav: true, sitemap: 0.7,
    title: { it: 'Glossario', en: 'Glossary' },
    desc: {
      it: 'I termini della sicurezza informatica spiegati in modo semplice, dalla A alla Z.',
      en: 'Security terms explained in plain language, from A to Z.',
    },
  },
  // ------------------------------------------------------------------ Analizza
  {
    file: 'news.html', area: 'analizza', icon: 'globe', nav: true, sitemap: 0.9,
    title: { it: 'News di cybersicurezza', en: 'Cybersecurity news' },
    desc: {
      it: 'Attacchi, violazioni e vulnerabilità dalle testate di settore e dai CERT, aggiornate ogni ora.',
      en: 'Attacks, breaches and vulnerabilities from trade press and CERTs, refreshed every hour.',
    },
  },
  {
    file: 'historic-attacks.html', area: 'analizza', icon: 'archive', nav: true, sitemap: 0.8,
    title: { it: 'Violazioni storiche', en: 'Historic breaches' },
    desc: {
      it: 'I casi che hanno cambiato la sicurezza: chi è stato colpito, come, quanti dati e cosa abbiamo imparato.',
      en: 'The cases that changed security: who was hit, how, how much data and what we learned.',
    },
  },
  {
    file: 'malware-db.html', area: 'analizza', icon: 'bug', nav: true, sitemap: 0.7,
    title: { it: 'Catalogo malware', en: 'Malware catalogue' },
    desc: {
      it: 'Famiglie malware documentate con comportamento, diffusione e segnali per riconoscerle.',
      en: 'Documented malware families with behaviour, spread and signs to recognise them.',
    },
  },
  {
    file: 'malware-classification.html', area: 'analizza', icon: 'tree', nav: true, sitemap: 0.7,
    title: { it: 'Tassonomia malware', en: 'Malware taxonomy' },
    desc: {
      it: 'Le categorie di malware spiegate con esempi, più un quiz per metterti alla prova.',
      en: 'Malware categories explained with examples, plus a quiz to test yourself.',
    },
  },
  {
    file: 'persistence-evasion.html', area: 'analizza', icon: 'mask', nav: true, sitemap: 0.7,
    title: { it: 'Persistenza ed evasione', en: 'Persistence and evasion' },
    desc: {
      it: 'Come un intruso resta in un sistema e sfugge ai controlli, e quali segnali lo tradiscono a chi difende.',
      en: 'How an intruder stays in a system and evades controls, and which signals give it away to defenders.',
    },
  },
  // ------------------------------------------------------------------ Verifica
  {
    file: 'security-check.html', area: 'verifica', icon: 'link', nav: true, auth: true, sitemap: null,
    title: { it: 'Check URL', en: 'URL check' },
    desc: {
      it: 'Un controllo passivo di un indirizzo: certificato, header, reputazione e segnali di rischio.',
      en: 'A passive check of an address: certificate, headers, reputation and risk signals.',
    },
  },
  {
    file: 'vulnerability-scanner.html', area: 'verifica', icon: 'head', nav: true, auth: true, sitemap: null,
    title: { it: 'Audit header HTTP', en: 'HTTP header audit' },
    desc: {
      it: 'Quali intestazioni di sicurezza mancano a un sito (HSTS, CSP…) e cosa si rischia senza.',
      en: 'Which security headers a site is missing (HSTS, CSP…) and what is at risk without them.',
    },
  },
  {
    file: 'domain-recon.html', area: 'verifica', icon: 'search', nav: true, sitemap: 0.6,
    title: { it: 'Ricognizione dominio', en: 'Domain reconnaissance' },
    desc: {
      it: 'Il punto di partenza per DNS, WHOIS, sottodomini e certificati di un dominio.',
      en: 'The starting point for a domain’s DNS, WHOIS, subdomains and certificates.',
    },
  },
  {
    file: 'dns-enumerator.html', area: 'verifica', icon: 'dns', nav: false, auth: true, sitemap: null,
    title: { it: 'DNS e WHOIS', en: 'DNS and WHOIS' },
    desc: {
      it: 'Record DNS e dati di registrazione di un dominio, letti e spiegati.',
      en: 'A domain’s DNS records and registration data, read and explained.',
    },
  },
  {
    file: 'subdomain-finder.html', area: 'verifica', icon: 'sub', nav: false, auth: true, sitemap: null,
    title: { it: 'Sottodomini', en: 'Subdomains' },
    desc: {
      it: 'I sottodomini pubblici di un dominio, trovati da fonti aperte come i registri dei certificati.',
      en: 'A domain’s public subdomains, found in open sources such as certificate logs.',
    },
  },
  {
    file: 'ssl-analyzer.html', area: 'verifica', icon: 'lock', nav: false, auth: true, sitemap: null,
    title: { it: 'Certificato TLS', en: 'TLS certificate' },
    desc: {
      it: 'Certificato, catena, scadenza e configurazione TLS di un server.',
      en: 'A server’s certificate, chain, expiry and TLS configuration.',
    },
  },
  {
    file: 'file-analysis.html', area: 'verifica', icon: 'file', nav: true, auth: true, sitemap: null,
    title: { it: 'Analisi file', en: 'File analysis' },
    desc: {
      it: 'Un file sospetto letto da vicino: tipo reale, hash, metadati e segnali di pericolo.',
      en: 'A suspicious file read up close: real type, hashes, metadata and danger signs.',
    },
  },
  {
    file: 'osint-hub.html', area: 'verifica', icon: 'eye', nav: true, sitemap: 0.6,
    title: { it: 'OSINT', en: 'OSINT' },
    desc: {
      it: 'Fonti aperte usate nel modo giusto: per capire quanto sei esposto tu, non per profilare altre persone.',
      en: 'Open sources used the right way: to understand your own exposure, not to profile other people.',
    },
  },
  {
    file: 'social-profiling.html', area: 'verifica', icon: 'eye', nav: false, auth: true, sitemap: null,
    title: { it: 'Esposizione social', en: 'Social media exposure' },
    desc: {
      it: 'Cosa rivela un profilo social pubblico: da usare sul tuo account o con il consenso dell’interessato.',
      en: 'What a public social profile reveals: for your own account or with the person’s consent.',
    },
  },
  {
    file: 'public-info.html', area: 'verifica', icon: 'eye', nav: false, auth: true, sitemap: null,
    title: { it: 'La tua esposizione online', en: 'Your online exposure' },
    desc: {
      it: 'Quali informazioni su di te sono pubbliche e come ridurle.',
      en: 'Which information about you is public and how to reduce it.',
    },
  },
  {
    file: 'report-generator.html', area: 'verifica', icon: 'report', nav: true, sitemap: 0.5,
    title: { it: 'Generatore di report', en: 'Report generator' },
    desc: {
      it: 'Metti in ordine i risultati di un’analisi autorizzata in un report da consegnare.',
      en: 'Turn the results of an authorised assessment into a report you can hand over.',
    },
  },
  // ------------------------------------------------------------------ Progetto
  {
    file: 'about.html', area: 'progetto', icon: 'info', nav: true, sitemap: 0.6,
    title: { it: 'Chi siamo', en: 'About' },
    desc: {
      it: 'Missione del progetto, da dove vengono i dati e cosa è reale, simulato o didattico.',
      en: 'The project’s mission, where the data comes from and what is real, simulated or educational.',
    },
  },
  {
    file: 'ethics.html', area: 'progetto', icon: 'scale', nav: true, sitemap: 0.7,
    title: { it: 'Etica e legge', en: 'Ethics and law' },
    desc: {
      it: 'Il codice di condotta di EVIL, le leggi che contano e come segnalare una vulnerabilità in modo responsabile.',
      en: 'EVIL’s code of conduct, the laws that matter and how to report a vulnerability responsibly.',
    },
  },
  {
    file: 'help.html', area: 'progetto', icon: 'help', nav: true, sitemap: 0.4,
    title: { it: 'Aiuto', en: 'Help' },
    desc: {
      it: 'Domande frequenti e modulo per scriverci.',
      en: 'Frequently asked questions and a form to contact us.',
    },
  },
  {
    file: 'site-policies.html', area: 'progetto', icon: 'shield', nav: true, sitemap: 0.3,
    title: { it: 'Privacy e regole', en: 'Privacy and terms' },
    desc: {
      it: 'Come trattiamo i dati, quali cookie usiamo e le regole d’uso della piattaforma.',
      en: 'How we handle data, which cookies we use and the platform’s terms of use.',
    },
  },
];

// Pagine fuori dal menu ma servite (account) — per sitemap e lingua
const ACCOUNT_PAGES = [
  { file: 'login.html', sitemap: 0.3, title: { it: 'Accedi', en: 'Sign in' } },
  { file: 'account.html', sitemap: 0.4, title: { it: 'Crea un account', en: 'Create an account' } },
  { file: 'profile.html', sitemap: null, title: { it: 'Profilo', en: 'Profile' } },
  { file: 'forgot-password.html', sitemap: null, title: { it: 'Password dimenticata', en: 'Forgotten password' } },
  { file: 'reset-password.html', sitemap: null, title: { it: 'Nuova password', en: 'New password' } },
  { file: 'verify-email.html', sitemap: null, title: { it: 'Verifica email', en: 'Verify email' } },
  { file: 'course.html', sitemap: null, title: { it: 'Corso', en: 'Course' } },
  { file: 'diploma.html', sitemap: null, title: { it: 'Diploma', en: 'Diploma' } },
  {
    file: 'verify.html',
    sitemap: 0.3,
    title: { it: 'Verifica un diploma', en: 'Verify a diploma' },
  },
];

const LANGS = ['it', 'en'];
const DEFAULT_LANG = 'it';

function pagesOf(areaId) {
  return PAGES.filter((p) => p.area === areaId);
}

function findPage(file) {
  return PAGES.find((p) => p.file === file) || ACCOUNT_PAGES.find((p) => p.file === file) || null;
}

module.exports = { AREAS, PAGES, ACCOUNT_PAGES, LANGS, DEFAULT_LANG, pagesOf, findPage };

'use strict';
/**
 * Progetto didattico dei corsi (contenuto bilingue).
 *
 * Per ogni corso: obiettivi misurabili ("alla fine sai fare…").
 * Per ogni livello (modulo): missione, abilità sbloccata e laboratorio pratico.
 * Per ogni lezione: gancio iniziale e domanda di verifica immediata.
 *
 * Tutto il materiale è difensivo e basato su principi pubblici (OWASP, NIST, CISA).
 * Le risposte corrette restano sul server: al browser arrivano solo testi e id.
 */

const b = (it, en) => ({ it, en });

/** Lezione: gancio + verifica a risposta singola (opzioni: [[it, en], …]). */
function lesson(minutes, hookIt, hookEn, qIt, qEn, options, correct, whyIt, whyEn) {
  return {
    minutes,
    hook: b(hookIt, hookEn),
    check: {
      prompt: b(qIt, qEn),
      options: options.map(([it, en]) => b(it, en)),
      correct,
      why: b(whyIt, whyEn),
    },
  };
}

/** Laboratorio "classifica": assegna ogni elemento a una categoria. */
function classifyLab(id, minutes, title, brief, categories, items, debrief) {
  return {
    id, kind: 'classify', minutes, title, brief, debrief,
    categories,
    items: items.map(([key, text, cat, why]) => ({ id: key, text, cat, why })),
  };
}

/** Laboratorio "ordina": la sequenza data è quella corretta. */
function orderLab(id, minutes, title, brief, items, debrief) {
  return {
    id, kind: 'order', minutes, title, brief, debrief,
    items: items.map(([key, text, why]) => ({ id: key, text, why })),
  };
}

/** Laboratorio "scegli": seleziona tutte e sole le misure corrette. */
function selectLab(id, minutes, title, brief, options, debrief) {
  return {
    id, kind: 'select', minutes, title, brief, debrief,
    options: options.map(([key, text, right, why]) => ({ id: key, text, right, why })),
  };
}

const DESIGN = {
  /* ───────────────────────────── FONDAMENTI ───────────────────────────── */
  fondamenti: {
    tagline: b(
      'Da zero a un assetto che sai difendere: account, rete e abitudini che fermano la maggior parte degli incidenti.',
      'From zero to a setup you can defend: accounts, network and habits that stop most incidents.'
    ),
    audience: b('Per chi parte da zero: nessun prerequisito tecnico.', 'For beginners: no technical prerequisites.'),
    goals: [
      b('Valutare un rischio (minaccia, vulnerabilità, impatto) e decidere cosa correggere per primo', 'Assess a risk (threat, vulnerability, impact) and decide what to fix first'),
      b('Mettere in sicurezza un account con credenziali corrette, MFA e permessi minimi', 'Secure an account with proper credentials, MFA and least privilege'),
      b('Spiegare cosa protegge davvero HTTPS e dove una rete va segmentata', 'Explain what HTTPS really protects and where a network should be segmented'),
      b('Pianificare backup che si ripristinano e segnalare un evento con le evidenze giuste', 'Plan backups that actually restore and report an event with the right evidence'),
    ],
    modules: {
      principi: {
        mission: b(
          'Una piccola clinica ti chiede aiuto. Prima di scegliere un qualsiasi strumento devi capire cosa può andare storto e cosa conta di più proteggere.',
          'A small clinic asks for your help. Before choosing any tool you must understand what can go wrong and what matters most to protect.'
        ),
        skill: b('Sai valutare un rischio e spiegare quali controlli lo riducono.', 'You can assess a risk and explain which controls reduce it.'),
        lab: classifyLab('pilastri', 8,
          b('Laboratorio: quale pilastro è in gioco?', 'Lab: which pillar is at stake?'),
          b('Per ogni episodio della clinica indica il pilastro della sicurezza che è stato compromesso.', 'For each clinic episode, pick the security pillar that was compromised.'),
          [b('Riservatezza', 'Confidentiality'), b('Integrità', 'Integrity'), b('Disponibilità', 'Availability')],
          [
            ['p1', b('La cartella delle buste paga è visibile a tutti i dipendenti.', 'The payroll folder is visible to every employee.'), 0, b('Chi non è autorizzato può leggere: è un problema di riservatezza.', 'Unauthorized people can read it: confidentiality.')],
            ['p2', b('Un referto viene modificato senza lasciare alcuna traccia.', 'A medical report is altered without leaving any trace.'), 1, b('Una modifica non autorizzata o non tracciabile colpisce l’integrità.', 'An unauthorized or untraceable change affects integrity.')],
            ['p3', b('Il sistema di prenotazioni è irraggiungibile per mezza giornata.', 'The booking system is unreachable for half a day.'), 2, b('Il servizio non è utilizzabile quando serve: disponibilità.', 'The service cannot be used when needed: availability.')],
            ['p4', b('Un portatile con dati dei pazienti non cifrato viene smarrito.', 'A laptop with unencrypted patient data is lost.'), 0, b('I dati possono finire a chi non deve leggerli: riservatezza.', 'Data may reach people who must not read it: confidentiality.')],
            ['p5', b('Uno script non autorizzato altera i prezzi del listino.', 'An unauthorized script alters the price list.'), 1, b('I dati non sono più corretti: integrità.', 'The data is no longer correct: integrity.')],
            ['p6', b('Un guasto lascia la clinica senza un backup ripristinabile.', 'A failure leaves the clinic with no restorable backup.'), 2, b('Senza ripristino il servizio può non tornare: disponibilità.', 'Without a restore the service may not come back: availability.')],
          ],
          b('Un incidente reale tocca spesso più pilastri insieme: la domanda utile è quale conta di più per quel servizio.', 'A real incident often touches several pillars: the useful question is which matters most for that service.')
        ),
        lessons: {
          triade: lesson(5,
            'Nel 2017 il ransomware WannaCry bloccò ospedali del servizio sanitario britannico: nessun segreto rubato, ma sistemi inutilizzabili. Era un attacco alla disponibilità.',
            'In 2017 the WannaCry ransomware locked up hospitals in the UK health service: no secrets stolen, but systems unusable. It was an attack on availability.',
            'Un file di bilancio viene modificato senza lasciare traccia. Quale pilastro è stato violato?',
            'A financial file is modified without leaving a trace. Which pillar was violated?',
            [['Riservatezza', 'Confidentiality'], ['Integrità', 'Integrity'], ['Disponibilità', 'Availability']], 1,
            'Una modifica non autorizzata o non tracciabile colpisce l’integrità del dato.', 'An unauthorized or untraceable change hits the integrity of the data.'),
          rischio: lesson(6,
            'Due server hanno la stessa vulnerabilità. Uno è in una rete interna isolata, l’altro è esposto a Internet: stesso difetto, rischio molto diverso.',
            'Two servers share the same vulnerability. One sits in an isolated internal network, the other is exposed to the Internet: same flaw, very different risk.',
            'Che cosa trasforma una vulnerabilità in un rischio concreto?',
            'What turns a vulnerability into a concrete risk?',
            [['Solo il suo nome tecnico', 'Only its technical name'], ['La probabilità che venga sfruttata e l’impatto nel contesto', 'The likelihood it is exploited and the impact in context'], ['La data in cui è stata pubblicata', 'The date it was published']], 1,
            'Il rischio combina probabilità e impatto nel contesto specifico.', 'Risk combines likelihood and impact in the specific context.'),
          'difesa-livelli': lesson(5,
            'Una cassaforte ha porta, serratura, allarme e telecamere: nessuna misura è perfetta, insieme rendono l’intrusione costosa.',
            'A vault has a door, a lock, an alarm and cameras: no single measure is perfect, together they make intrusion costly.',
            'Perché una sola misura (per esempio solo un firewall) non basta?',
            'Why is a single measure (for example only a firewall) not enough?',
            [['Perché nessun controllo è perfetto e un suo guasto lascerebbe tutto scoperto', 'Because no control is perfect and its failure would leave everything exposed'], ['Perché i firewall sono sconsigliati', 'Because firewalls are discouraged'], ['Perché costa troppo configurarlo', 'Because it is too costly to set up']], 0,
            'I livelli indipendenti riducono l’impatto quando un singolo controllo fallisce.', 'Independent layers reduce impact when a single control fails.'),
        },
      },
      identita: {
        mission: b(
          'L’account amministrativo della clinica ha una password debole usata anche altrove e condivisa tra tre persone. Tocca a te metterlo in sicurezza.',
          'The clinic’s admin account has a weak password reused elsewhere and shared by three people. It is up to you to secure it.'
        ),
        skill: b('Sai configurare un account in modo difendibile: credenziali, MFA e permessi minimi.', 'You can set up an account defensibly: credentials, MFA and least privilege.'),
        lab: selectLab('account-admin', 8,
          b('Laboratorio: metti in sicurezza l’account admin', 'Lab: secure the admin account'),
          b('Seleziona TUTTE le misure corrette e solo quelle. Servono almeno il 70% di precisione.', 'Select ALL the correct measures and only those. You need at least 70% accuracy.'),
          [
            ['a1', b('Chiave di sicurezza FIDO2 come secondo fattore', 'FIDO2 security key as second factor'), true, b('Un fattore di possesso resistente al phishing riduce molto il rischio.', 'A phishing-resistant possession factor sharply reduces the risk.')],
            ['a2', b('Password archiviate con hash lento e salt univoco', 'Passwords stored with a slow hash and a unique salt'), true, b('Rende costoso indovinare le password se l’archivio viene esposto.', 'It makes guessing costly if the store is exposed.')],
            ['a3', b('Un account personale per ciascun amministratore', 'One personal account per administrator'), true, b('Account individuali rendono le azioni attribuibili.', 'Individual accounts make actions attributable.')],
            ['a4', b('Revisione trimestrale degli accessi', 'Quarterly access review'), true, b('Elimina privilegi residui quando i ruoli cambiano.', 'It removes leftover privileges when roles change.')],
            ['a5', b('Condividere la password admin tra i tre colleghi', 'Share the admin password among the three colleagues'), false, b('Un account condiviso non è attribuibile e moltiplica i punti di perdita.', 'A shared account is not attributable and multiplies leak points.')],
            ['a6', b('Usare la stessa password su più servizi per ricordarla', 'Reuse the same password across services to remember it'), false, b('Una violazione altrove compromette anche questo account.', 'A breach elsewhere compromises this account too.')],
            ['a7', b('Annotare la password nel wiki interno', 'Write the password in the internal wiki'), false, b('Le credenziali in chiaro in un documento sono un rischio inutile.', 'Plaintext credentials in a document are an unnecessary risk.')],
            ['a8', b('Un ruolo admin separato dall’account ordinario', 'An admin role separate from the everyday account'), true, b('Separare i compiti limita l’impatto di una compromissione.', 'Separating duties limits the impact of a compromise.')],
          ],
          b('Credenziali, secondo fattore e permessi minimi lavorano insieme: nessuno dei tre basta da solo.', 'Credentials, second factor and least privilege work together: none of the three is enough alone.')
        ),
        lessons: {
          'password-hash': lesson(6,
            'Quando un sito viene violato, la differenza tra un disastro e un fastidio è spesso come conservava le password.',
            'When a site is breached, the difference between a disaster and a nuisance is often how it stored passwords.',
            'A cosa serve il salt?',
            'What is the salt for?',
            [['A rendere uguali gli hash di password uguali', 'To make hashes of identical passwords the same'], ['A far sì che password uguali producano hash diversi', 'To make identical passwords produce different hashes'], ['A recuperare la password originale', 'To recover the original password']], 1,
            'Un salt univoco impedisce di riusare calcoli tra account diversi.', 'A unique salt prevents reusing computation across accounts.'),
          mfa: lesson(5,
            'Una password rubata vale poco se per entrare serve anche qualcosa che solo tu possiedi.',
            'A stolen password is worth little if getting in also needs something only you possess.',
            'Quale combinazione è davvero a più fattori?',
            'Which combination is truly multi-factor?',
            [['Password e domanda segreta', 'Password and secret question'], ['Password e chiave di sicurezza fisica', 'Password and a physical security key'], ['Due password diverse', 'Two different passwords']], 1,
            'Conoscenza più possesso sono categorie diverse; due segreti restano della stessa categoria.', 'Knowledge plus possession are different categories; two secrets stay in the same one.'),
          'privilegio-minimo': lesson(5,
            'L’account del tirocinante non dovrebbe poter cancellare il database di produzione: il privilegio minimo rende un errore (o un attacco) meno costoso.',
            'The intern’s account should not be able to delete the production database: least privilege makes a mistake (or an attack) cheaper.',
            'Un collega deve solo leggere i report per una settimana. Qual è la scelta migliore?',
            'A colleague only needs to read reports for a week. What is the best choice?',
            [['Un ruolo admin permanente', 'A permanent admin role'], ['Accesso in sola lettura con scadenza', 'Read-only access with an expiry'], ['Condividergli il tuo account', 'Share your account with them']], 1,
            'Permessi minimi e temporanei riducono l’esposizione.', 'Minimal, temporary permissions reduce exposure.'),
        },
      },
      reti: {
        mission: b(
          'I dati dei pazienti viaggiano dalla reception ai server. Scopri cosa è davvero protetto durante il percorso e dove una compromissione potrebbe allargarsi.',
          'Patient data travels from reception to the servers. Find out what is really protected along the way and where a compromise could spread.'
        ),
        skill: b('Sai dire cosa garantisce HTTPS e dove tracciare i confini di rete.', 'You can say what HTTPS guarantees and where to draw network boundaries.'),
        lab: classifyLab('tls', 7,
          b('Laboratorio: cosa garantisce (e cosa no) il lucchetto', 'Lab: what the padlock does (and does not) guarantee'),
          b('Per ogni affermazione indica se HTTPS la garantisce oppure no.', 'For each statement, say whether HTTPS guarantees it or not.'),
          [b('HTTPS lo garantisce', 'HTTPS guarantees it'), b('HTTPS NON lo garantisce', 'HTTPS does NOT guarantee it')],
          [
            ['t1', b('Chi intercetta il traffico non può leggerne il contenuto.', 'Someone intercepting the traffic cannot read its content.'), 0, b('È la riservatezza in transito.', 'That is confidentiality in transit.')],
            ['t2', b('Il sito non è un tentativo di phishing.', 'The site is not a phishing attempt.'), 1, b('Anche un sito fraudolento può avere un certificato valido.', 'A fraudulent site can also have a valid certificate.')],
            ['t3', b('Il server presenta un certificato valido per quel dominio.', 'The server presents a valid certificate for that domain.'), 0, b('Il browser verifica la corrispondenza tra certificato e nome.', 'The browser checks that certificate and name match.')],
            ['t4', b('Il dispositivo dell’utente non ha malware.', 'The user’s device has no malware.'), 1, b('TLS protegge il canale, non gli estremi.', 'TLS protects the channel, not the endpoints.')],
            ['t5', b('I dati non vengono alterati in transito senza che lo si noti.', 'Data is not altered in transit without detection.'), 0, b('TLS include controlli di integrità.', 'TLS includes integrity checks.')],
            ['t6', b('L’applicazione web è priva di vulnerabilità.', 'The web application has no vulnerabilities.'), 1, b('Il canale cifrato non corregge i difetti dell’applicazione.', 'An encrypted channel does not fix application flaws.')],
          ],
          b('Il lucchetto riguarda il canale. Fiducia nel sito e sicurezza dell’applicazione vanno valutate altrove.', 'The padlock is about the channel. Trust in the site and application security must be assessed elsewhere.')
        ),
        lessons: {
          https: lesson(6,
            'Il lucchetto nel browser dice che la connessione è cifrata, non che il sito sia onesto.',
            'The padlock in the browser says the connection is encrypted, not that the site is honest.',
            'Che cosa NON garantisce HTTPS?',
            'What does HTTPS NOT guarantee?',
            [['La riservatezza del traffico', 'Traffic confidentiality'], ['Che il sito non sia fraudolento', 'That the site is not fraudulent'], ['L’integrità dei dati in transito', 'Integrity of data in transit']], 1,
            'HTTPS protegge il canale, non l’onestà di chi sta dall’altra parte.', 'HTTPS protects the channel, not the honesty of the other party.'),
          segmentazione: lesson(5,
            'Sulle navi, le paratie stagne impediscono che una falla affondi tutto. La segmentazione di rete fa lo stesso.',
            'On ships, watertight bulkheads stop one breach from sinking everything. Network segmentation does the same.',
            'Qual è il vantaggio principale della segmentazione?',
            'What is the main benefit of segmentation?',
            [['Limita il movimento laterale e l’impatto di una compromissione', 'It limits lateral movement and the impact of a compromise'], ['Rende la rete più veloce', 'It makes the network faster'], ['Elimina la necessità di aggiornamenti', 'It removes the need for updates']], 0,
            'Confini tra zone riducono i percorsi che un problema può seguire.', 'Boundaries between zones reduce the paths a problem can follow.'),
          dns: lesson(5,
            'Prima di aprire un sito il tuo dispositivo chiede al DNS dove si trova. Se la risposta è falsa, tutto il resto si fida del posto sbagliato.',
            'Before opening a site your device asks DNS where it lives. If the answer is false, everything else trusts the wrong place.',
            'Quale misura aiuta a rendere più affidabili le risposte DNS?',
            'Which measure helps make DNS answers more trustworthy?',
            [['Validazione DNSSEC e resolver affidabili', 'DNSSEC validation and trustworthy resolvers'], ['Disattivare HTTPS', 'Turning HTTPS off'], ['Usare nomi di dominio molto lunghi', 'Using very long domain names']], 0,
            'DNSSEC autentica le risposte; un resolver affidabile riduce la superficie di rischio.', 'DNSSEC authenticates answers; a trustworthy resolver reduces the risk surface.'),
        },
      },
      igiene: {
        mission: b(
          'Alla reception un portatile si comporta in modo strano. Come ti comporti nei primi minuti decide se resta un episodio o diventa un incidente.',
          'A reception laptop behaves oddly. How you act in the first minutes decides whether it stays an episode or becomes an incident.'
        ),
        skill: b('Sai pianificare backup che si ripristinano e segnalare un evento con le evidenze giuste.', 'You can plan backups that restore and report an event with the right evidence.'),
        lab: orderLab('segnalazione', 7,
          b('Laboratorio: i primi minuti dopo un sospetto', 'Lab: the first minutes after a suspicion'),
          b('Metti i passaggi nell’ordine corretto, dal primo all’ultimo.', 'Put the steps in the right order, from first to last.'),
          [
            ['s1', b('Fermati: non cliccare né aprire altro', 'Stop: do not click or open anything else'), b('Evita di peggiorare la situazione.', 'Avoid making things worse.')],
            ['s2', b('Annota cosa osservi: orario, mittente, messaggio', 'Note what you observe: time, sender, message'), b('Le evidenze fresche sono le più utili.', 'Fresh evidence is the most useful.')],
            ['s3', b('Non cancellare nulla e conserva il messaggio originale', 'Delete nothing and keep the original message'), b('Cancellare distrugge ciò che serve a capire.', 'Deleting destroys what is needed to understand.')],
            ['s4', b('Segnala l’evento al canale ufficiale', 'Report the event to the official channel'), b('Chi risponde ha il quadro d’insieme.', 'Responders have the overall picture.')],
            ['s5', b('Attendi istruzioni e segui il piano', 'Wait for instructions and follow the plan'), b('Le azioni coordinate evitano di cancellare tracce.', 'Coordinated actions avoid wiping traces.')],
          ],
          b('Prima si ferma il danno, poi si documenta, poi si segnala. Improvvisare di più tende a peggiorare le cose.', 'First stop the damage, then document, then report. Improvising more tends to make things worse.')
        ),
        lessons: {
          aggiornamenti: lesson(5,
            'Molte violazioni sfruttano falle per le quali la correzione esisteva già da mesi. Non sapere cosa hai installato è il primo problema.',
            'Many breaches exploit flaws whose fix had existed for months. Not knowing what you have installed is the first problem.',
            'Che cosa serve prima di poter aggiornare in modo sistematico?',
            'What do you need before you can update systematically?',
            [['Un inventario di sistemi e software', 'An inventory of systems and software'], ['Un antivirus più costoso', 'A more expensive antivirus'], ['Più password', 'More passwords']], 0,
            'Non puoi aggiornare ciò che non sai di avere.', 'You cannot update what you do not know you have.'),
          backup: lesson(5,
            'Un backup mai provato è una speranza, non una protezione.',
            'A backup you have never tested is a hope, not a protection.',
            'Che cosa dice la regola 3-2-1?',
            'What does the 3-2-1 rule say?',
            [['3 copie, su 2 supporti diversi, 1 fuori sede o isolata', '3 copies, on 2 different media, 1 off-site or isolated'], ['3 password, 2 fattori, 1 account', '3 passwords, 2 factors, 1 account'], ['3 server, 2 firewall, 1 router', '3 servers, 2 firewalls, 1 router']], 0,
            'Copie diversificate e isolate sopravvivono a guasti e ransomware.', 'Diversified, isolated copies survive failures and ransomware.'),
          segnalazione: lesson(5,
            'Chi segnala presto trasforma un possibile incidente in un episodio chiuso in poche ore, non in settimane.',
            'Whoever reports early turns a possible incident into an episode closed in hours, not weeks.',
            'Ricevi un’email sospetta con un allegato. Qual è il primo gesto corretto?',
            'You receive a suspicious email with an attachment. What is the right first move?',
            [['Aprirlo da un altro PC per controllare', 'Open it on another PC to check'], ['Non aprirlo e segnalarlo al canale ufficiale', 'Do not open it and report it to the official channel'], ['Inoltrarlo ai colleghi per avvisarli', 'Forward it to colleagues to warn them']], 1,
            'Non interagire e segnalare protegge te e gli altri.', 'Not engaging and reporting protects you and others.'),
        },
      },
    },
  },

  /* ───────────────────────────── SICUREZZA WEB ───────────────────────────── */
  'sicurezza-web': {
    tagline: b(
      'Progetta e verifica applicazioni web che reggono: dal modello delle minacce alle protezioni del browser.',
      'Design and verify web applications that hold up: from threat modelling to browser protections.'
    ),
    audience: b('Per chi conosce le basi del web e vuole costruire in modo sicuro.', 'For people who know web basics and want to build securely.'),
    goals: [
      b('Mappare i confini di fiducia di un’applicazione e scrivere requisiti di sicurezza verificabili', 'Map an application’s trust boundaries and write verifiable security requirements'),
      b('Applicare validazione lato server, codifica dell’output e query parametrizzate', 'Apply server-side validation, output encoding and parameterised queries'),
      b('Configurare CSP, cookie di sessione e difese contro richieste cross-site', 'Configure CSP, session cookies and defences against cross-site requests'),
      b('Separare autenticazione e autorizzazione e tenere sotto controllo le dipendenze', 'Separate authentication from authorization and keep dependencies under control'),
    ],
    modules: {
      progettazione: {
        mission: b(
          'Devi mettere online il portale prenotazioni di un poliambulatorio. Prima di scrivere codice, disegna dove i dati cambiano di mano e chi può mentirti.',
          'You must put an outpatient clinic’s booking portal online. Before writing code, draw where data changes hands and who can lie to you.'
        ),
        skill: b('Sai mappare i confini di fiducia e scrivere requisiti di sicurezza verificabili.', 'You can map trust boundaries and write verifiable security requirements.'),
        lab: classifyLab('confini-fiducia', 8,
          b('Laboratorio: dato fidato o da validare?', 'Lab: trusted data or data to validate?'),
          b('Per ogni dato che entra nel portale decidi se va trattato come non fidato.', 'For each piece of data entering the portal decide whether it must be treated as untrusted.'),
          [b('Non fidato: da validare', 'Untrusted: validate it'), b('Sotto il nostro controllo', 'Under our control')],
          [
            ['c1', b('Parametri della query string', 'Query-string parameters'), 0, b('Chiunque può modificare un URL.', 'Anyone can edit a URL.')],
            ['c2', b('Una costante nel codice sorgente', 'A constant in the source code'), 1, b('È definita dal team e versionata.', 'It is defined by the team and versioned.')],
            ['c3', b('Il file caricato da un utente', 'A file uploaded by a user'), 0, b('Nome, tipo e contenuto sono controllati dall’utente.', 'Name, type and content are user-controlled.')],
            ['c4', b('Header e cookie ricevuti dal browser', 'Headers and cookies received from the browser'), 0, b('Arrivano dal client e possono essere forgiati.', 'They come from the client and can be forged.')],
            ['c5', b('La risposta di un’API di terze parti', 'The response from a third-party API'), 0, b('Un confine esterno: va validata come ogni input.', 'An external boundary: validate it like any input.')],
            ['c6', b('Una variabile d’ambiente impostata dal team operativo', 'An environment variable set by the ops team'), 1, b('È configurazione controllata da chi gestisce il sistema.', 'It is configuration controlled by whoever runs the system.')],
          ],
          b('La regola pratica: tutto ciò che attraversa un confine verso il tuo codice si valida prima di usarlo.', 'The practical rule: everything crossing a boundary into your code is validated before use.')
        ),
        lessons: {
          confini: lesson(5,
            'Ogni volta che i dati attraversano un confine — browser, server, database, servizio esterno — cambia chi può mentirti.',
            'Every time data crosses a boundary — browser, server, database, external service — who can lie to you changes.',
            'Quale di questi dati va trattato come non fidato?',
            'Which of these must be treated as untrusted?',
            [['Un header ricevuto dal browser', 'A header received from the browser'], ['Una costante nel codice', 'A constant in the code'], ['Una configurazione scritta dal team', 'A configuration written by the team']], 0,
            'Tutto ciò che arriva dal client può essere manipolato.', 'Anything coming from the client can be manipulated.'),
          minaccia: lesson(6,
            'Il modo più economico di correggere una falla è trovarla prima di scrivere il codice.',
            'The cheapest way to fix a flaw is to find it before writing the code.',
            'Quando conviene fare la modellazione delle minacce?',
            'When is threat modelling worthwhile?',
            [['Solo dopo un incidente', 'Only after an incident'], ['Già in progettazione e a ogni cambiamento importante', 'Already at design time and at every major change'], ['Mai: bastano i test', 'Never: tests are enough']], 1,
            'Anticipare i rischi costa meno che rimediare dopo il rilascio.', 'Anticipating risks costs less than fixing after release.'),
          requisiti: lesson(5,
            '“Sia sicuro” non è un requisito: “le sessioni scadono dopo 30 minuti di inattività” lo è.',
            '“Make it secure” is not a requirement: “sessions expire after 30 minutes of inactivity” is.',
            'Quale è un requisito verificabile?',
            'Which is a verifiable requirement?',
            [['Il sito deve essere sicuro', 'The site must be secure'], ['Le password sono salvate con hash lento e salt, verificato da un test', 'Passwords are stored with a slow hash and salt, checked by a test'], ['Gli sviluppatori sono attenti', 'Developers are careful']], 1,
            'Un requisito misurabile può essere verificato con un test o un controllo.', 'A measurable requirement can be checked with a test or review.'),
        },
      },
      'input-output': {
        mission: b(
          'Il campo di ricerca del portale riceve di tutto. Il tuo compito è far sì che qualsiasi cosa arrivi non venga mai trattata come istruzione.',
          'The portal’s search box receives everything. Your job is to make sure whatever arrives is never treated as an instruction.'
        ),
        skill: b('Sai applicare validazione, codifica dell’output e query parametrizzate.', 'You can apply validation, output encoding and parameterised queries.'),
        lab: selectLab('input-output', 8,
          b('Laboratorio: la pagina dei commenti', 'Lab: the comments page'),
          b('La pagina salva commenti, li cerca nel database e li mostra. Seleziona TUTTE le difese corrette e solo quelle.', 'The page stores comments, searches the database and shows them. Select ALL the correct defences and only those.'),
          [
            ['o1', b('Query parametrizzate per ricerca e salvataggio', 'Parameterised queries for search and storage'), true, b('Separano dati e istruzioni SQL.', 'They separate data from SQL instructions.')],
            ['o2', b('Codifica contestuale del testo quando lo mostri', 'Context-aware encoding when displaying text'), true, b('Impedisce che il testo venga interpretato come codice.', 'It stops text being interpreted as code.')],
            ['o3', b('Validazione lato server con allowlist, tipo e lunghezza', 'Server-side validation with allowlist, type and length'), true, b('Riduce ciò che può arrivare alle fasi successive.', 'It reduces what can reach later stages.')],
            ['o4', b('Validare solo in JavaScript nel browser', 'Validate only in browser JavaScript'), false, b('Il client può essere aggirato: la validazione che conta è sul server.', 'The client can be bypassed: the validation that counts is on the server.')],
            ['o5', b('Costruire le query concatenando stringhe e togliere gli apostrofi', 'Build queries by concatenating strings and stripping apostrophes'), false, b('Il filtro per caratteri è fragile; serve separare dati e istruzioni.', 'Character filtering is fragile; data and instructions must be separated.')],
            ['o6', b('Inserire il testo dell’utente con innerHTML', 'Insert user text with innerHTML'), false, b('Interpreta il testo come markup: usa textContent o la codifica.', 'It interprets text as markup: use textContent or encoding.')],
          ],
          b('Tre difese complementari, ciascuna al proprio confine: ingresso, database e uscita.', 'Three complementary defences, each at its own boundary: entry, database and output.')
        ),
        lessons: {
          validazione: lesson(5,
            'Il browser è un ospite educato, ma chiunque può parlare al tuo server senza passare dal browser.',
            'The browser is a polite guest, but anyone can talk to your server without going through a browser.',
            'Dove deve avvenire la validazione che conta?',
            'Where must the validation that counts happen?',
            [['Solo in JavaScript lato client', 'Only in client-side JavaScript'], ['Sul server, con allowlist, tipo e limiti', 'On the server, with allowlists, types and limits'], ['Solo nel database', 'Only in the database']], 1,
            'Il client non è un confine di fiducia: il controllo definitivo è sul server.', 'The client is not a trust boundary: the final check is on the server.'),
          output: lesson(6,
            'Lo stesso testo è innocuo in un paragrafo e pericoloso dentro un attributo: la codifica dipende dal contesto.',
            'The same text is harmless in a paragraph and dangerous inside an attribute: encoding depends on context.',
            'Come riduci il rischio di XSS quando mostri testo dell’utente?',
            'How do you reduce XSS risk when displaying user text?',
            [['Codificandolo per il contesto di output', 'By encoding it for the output context'], ['Nascondendo il form', 'By hiding the form'], ['Allungando il limite di caratteri', 'By raising the character limit']], 0,
            'La codifica contestuale impedisce che i dati diventino markup o script.', 'Contextual encoding keeps data from becoming markup or script.'),
          query: lesson(5,
            'La differenza tra dati e istruzioni è tutto: le query parametrizzate rendono impossibile confonderli.',
            'The difference between data and instructions is everything: parameterised queries make mixing them up impossible.',
            'Quale approccio separa dati e istruzioni SQL?',
            'Which approach separates data from SQL instructions?',
            [['Query parametrizzate', 'Parameterised queries'], ['Concatenare stringhe e rimuovere gli apostrofi', 'Concatenating strings and removing apostrophes'], ['Nascondere i messaggi di errore', 'Hiding error messages']], 0,
            'I parametri sono sempre dati, mai parte della query.', 'Parameters are always data, never part of the query.'),
        },
      },
      'web-protections': {
        mission: b(
          'Il portale è online. Ora chiedi al browser di aiutarti: cookie, politiche di caricamento e protezioni contro azioni non volute.',
          'The portal is live. Now ask the browser to help: cookies, loading policies and protection against unwanted actions.'
        ),
        skill: b('Sai configurare CSP, cookie di sessione e difese contro le richieste cross-site.', 'You can configure CSP, session cookies and defences against cross-site requests.'),
        lab: classifyLab('browser-protezioni', 8,
          b('Laboratorio: quale rischio riduce questa protezione?', 'Lab: which risk does this protection reduce?'),
          b('Abbina ogni misura al rischio principale che riduce.', 'Match each measure to the main risk it reduces.'),
          [b('Furto del cookie da script', 'Cookie theft by script'), b('Intercettazione in rete', 'Network interception'), b('Richieste cross-site non volute', 'Unwanted cross-site requests')],
          [
            ['b1', b('Attributo HttpOnly sul cookie di sessione', 'HttpOnly attribute on the session cookie'), 0, b('Il cookie non è leggibile da JavaScript.', 'The cookie is not readable by JavaScript.')],
            ['b2', b('Attributo Secure sul cookie', 'Secure attribute on the cookie'), 1, b('Il cookie viaggia solo su HTTPS.', 'The cookie only travels over HTTPS.')],
            ['b3', b('SameSite impostato in modo appropriato', 'SameSite set appropriately'), 2, b('Limita l’invio del cookie da contesti esterni.', 'It limits sending the cookie from external contexts.')],
            ['b4', b('Content Security Policy restrittiva sugli script', 'Restrictive Content Security Policy for scripts'), 0, b('Riduce l’esecuzione di script non previsti.', 'It reduces the execution of unexpected scripts.')],
            ['b5', b('HSTS attivo sul dominio', 'HSTS enabled on the domain'), 1, b('Obbliga il browser a usare HTTPS.', 'It forces the browser to use HTTPS.')],
            ['b6', b('Token anti-CSRF verificato dal server', 'Anti-CSRF token checked by the server'), 2, b('Conferma che la richiesta nasce dalla tua pagina.', 'It confirms the request originates from your page.')],
          ],
          b('Nessuna protezione copre tutto: la forza sta nella combinazione.', 'No single protection covers everything: strength lies in the combination.')
        ),
        lessons: {
          csp: lesson(6,
            'Una CSP è la cintura di sicurezza del browser: non evita l’incidente, ne riduce le conseguenze.',
            'A CSP is the browser’s seat belt: it does not prevent the accident, it reduces the consequences.',
            'Che cosa fa una Content Security Policy?',
            'What does a Content Security Policy do?',
            [['Limita le origini da cui caricare risorse ed eseguire script', 'Limits the origins from which resources load and scripts run'], ['Cifra il database', 'Encrypts the database'], ['Sostituisce la validazione dell’input', 'Replaces input validation']], 0,
            'È un livello aggiuntivo, non un sostituto della codifica e della validazione.', 'It is an extra layer, not a substitute for encoding and validation.'),
          cookie: lesson(5,
            'Un cookie di sessione è una chiave temporanea: chi lo ruba, entra come te.',
            'A session cookie is a temporary key: whoever steals it gets in as you.',
            'Quale combinazione è adatta a un cookie di sessione?',
            'Which combination suits a session cookie?',
            [['HttpOnly, Secure e SameSite appropriata', 'HttpOnly, Secure and an appropriate SameSite'], ['Leggibile da JavaScript e senza scadenza', 'Readable by JavaScript and without expiry'], ['Passato nell’URL', 'Passed in the URL']], 0,
            'Gli attributi riducono furto, intercettazione e invio cross-site.', 'The attributes reduce theft, interception and cross-site sending.'),
          csrf: lesson(5,
            'Il browser allega i cookie da solo: per questo un altro sito può provare a far compiere azioni a nome tuo.',
            'The browser attaches cookies by itself, so another site can try to make actions happen on your behalf.',
            'Quale controllo aiuta contro il CSRF?',
            'Which control helps against CSRF?',
            [['Un token anti-CSRF verificato dal server', 'An anti-CSRF token verified by the server'], ['Accettare azioni modificanti via GET', 'Accepting state-changing actions via GET'], ['Pubblicare il token nella pagina pubblica', 'Publishing the token on the public page']], 0,
            'Il token lega la richiesta alla sessione e alla pagina legittima.', 'The token ties the request to the session and the legitimate page.'),
        },
      },
      autorizzazione: {
        mission: b(
          'Ultimo livello: chi può fare cosa? Un utente cambia un numero nell’URL e vede i dati di un altro paziente. Chiudi questo tipo di falle.',
          'Last level: who can do what? A user changes a number in the URL and sees another patient’s data. Close this kind of gap.'
        ),
        skill: b('Sai separare autenticazione e autorizzazione, ridurre l’enumerazione e gestire le dipendenze.', 'You can separate authentication from authorization, reduce enumeration and manage dependencies.'),
        lab: orderLab('dipendenze', 8,
          b('Laboratorio: aggiornare una dipendenza in sicurezza', 'Lab: safely updating a dependency'),
          b('Ordina i passaggi di un aggiornamento responsabile di una libreria.', 'Order the steps of a responsible library update.'),
          [
            ['d1', b('Mantieni un inventario delle dipendenze e delle versioni', 'Keep an inventory of dependencies and versions'), b('Senza inventario non sai cosa è esposto.', 'Without an inventory you do not know what is exposed.')],
            ['d2', b('Ricevi un avviso di sicurezza dalla fonte ufficiale', 'Receive a security advisory from the official source'), b('Il segnale arriva da fonti affidabili.', 'The signal comes from trustworthy sources.')],
            ['d3', b('Valuta se la parte vulnerabile è raggiungibile nel tuo uso', 'Assess whether the vulnerable part is reachable in your use'), b('Esposizione e impatto determinano l’urgenza.', 'Exposure and impact determine urgency.')],
            ['d4', b('Aggiorna in un ambiente di test', 'Update in a test environment'), b('Si prova prima fuori da produzione.', 'You try it outside production first.')],
            ['d5', b('Esegui i test automatici e verifica le funzioni critiche', 'Run the automated tests and verify critical functions'), b('Un aggiornamento senza test sposta il problema.', 'An update without tests just moves the problem.')],
            ['d6', b('Rilascia e monitora', 'Release and monitor'), b('Controlli dopo il rilascio chiudono il ciclo.', 'Post-release checks close the loop.')],
          ],
          b('Il ciclo è ripetibile: inventario, segnale, valutazione, prova, rilascio.', 'The cycle is repeatable: inventory, signal, assessment, test, release.')
        ),
        lessons: {
          'authn-authz': lesson(6,
            'Sapere chi sei (autenticazione) non significa poterti far fare tutto (autorizzazione): molti bug sono controlli saltati sulla seconda.',
            'Knowing who you are (authentication) does not mean letting you do everything (authorization): many bugs are checks skipped on the second.',
            'Un utente autenticato cambia l’ID nell’URL e vede i dati di un altro. Che cosa manca?',
            'An authenticated user changes the ID in the URL and sees someone else’s data. What is missing?',
            [['Un controllo di autorizzazione sulla risorsa', 'An authorization check on the resource'], ['Un captcha', 'A captcha'], ['Una password più lunga', 'A longer password']], 0,
            'Ogni richiesta alla risorsa va autorizzata sul server, non solo autenticata.', 'Every request to the resource must be authorized on the server, not merely authenticated.'),
          'errori-auth': lesson(5,
            'Un messaggio d’errore troppo generoso aiuta chi prova a indovinare: “utente inesistente” rivela quali account esistono.',
            'An overly generous error message helps whoever is guessing: “user does not exist” reveals which accounts exist.',
            'Quale messaggio di login riduce l’enumerazione degli account?',
            'Which login message reduces account enumeration?',
            [['Credenziali non valide', 'Invalid credentials'], ['Password errata per questo utente', 'Wrong password for this user'], ['Utente non trovato', 'User not found']], 0,
            'Una risposta uniforme non rivela se l’account esiste.', 'A uniform answer does not reveal whether the account exists.'),
          dipendenze: lesson(5,
            'Il tuo codice è una piccola parte dell’applicazione: il resto sono librerie di altri. Chi le aggiorna?',
            'Your code is a small part of the application: the rest is other people’s libraries. Who updates them?',
            'Qual è una buona pratica per le dipendenze?',
            'What is a good practice for dependencies?',
            [['Inventario, fonti affidabili e aggiornamenti regolari', 'Inventory, trusted sources and regular updates'], ['Non aggiornare mai per non rompere nulla', 'Never update so nothing breaks'], ['Copiare codice da fonti sconosciute', 'Copy code from unknown sources']], 0,
            'Una catena di fornitura sotto controllo riduce il rischio.', 'A supply chain under control reduces risk.'),
        },
      },
    },
  },

  /* ───────────────────────────── DIFESA E ANALISI ───────────────────────────── */
  'difesa-analisi': {
    tagline: b(
      'Leggi i segnali, scegli cosa fare per primo e racconta un incidente in modo che porti miglioramenti.',
      'Read the signals, choose what to do first and tell an incident so it leads to improvements.'
    ),
    audience: b('Per chi vuole lavorare con log, avvisi e risposta agli incidenti.', 'For people who want to work with logs, alerts and incident response.'),
    goals: [
      b('Scegliere quali eventi registrare e ragionare su correlazione senza trarre conclusioni affrettate', 'Choose which events to log and reason about correlation without jumping to conclusions'),
      b('Ordinare gli avvisi per priorità e leggere gli indicatori nel loro contesto', 'Prioritise alerts and read indicators in context'),
      b('Guidare le fasi di una risposta e contenere un problema preservando le evidenze', 'Drive the phases of a response and contain a problem while preserving evidence'),
      b('Ripristinare in modo controllato e scrivere un report che produce miglioramenti', 'Restore in a controlled way and write a report that drives improvement'),
    ],
    modules: {
      telemetria: {
        mission: b(
          'Il tuo SOC virtuale è appena nato e non vede nulla. Decidi quali eventi raccogliere per poter ricostruire una storia quando servirà.',
          'Your virtual SOC has just been born and sees nothing. Decide which events to collect so you can reconstruct a story when it matters.'
        ),
        skill: b('Sai scegliere cosa registrare e ragionare sulla correlazione senza trarre conclusioni affrettate.', 'You can choose what to log and reason about correlation without jumping to conclusions.'),
        lab: selectLab('log-login', 8,
          b('Laboratorio: cosa registrare per il sistema di login', 'Lab: what to log for the login system'),
          b('Seleziona TUTTI gli eventi utili e sicuri da registrare e solo quelli.', 'Select ALL the useful, safe events to log and only those.'),
          [
            ['l1', b('Accessi riusciti e falliti, con orario e origine', 'Successful and failed logins, with time and origin'), true, b('Base per rilevare tentativi anomali.', 'The basis for spotting anomalous attempts.')],
            ['l2', b('Cambi di permessi e di ruolo', 'Permission and role changes'), true, b('Le modifiche ai privilegi sono eventi critici.', 'Privilege changes are critical events.')],
            ['l3', b('Errori applicativi con un identificativo di richiesta', 'Application errors with a request identifier'), true, b('Aiutano a correlare eventi tra componenti.', 'They help correlate events across components.')],
            ['l4', b('Le password inserite, in chiaro', 'The entered passwords, in plaintext'), false, b('Non vanno mai registrate: i log diventerebbero un tesoro per chi li legge.', 'Never log them: logs would become a prize for whoever reads them.')],
            ['l5', b('I token di sessione completi', 'Full session tokens'), false, b('Chi legge il log potrebbe riusarli.', 'Whoever reads the log could reuse them.')],
            ['l6', b('Modifiche alla configurazione di sicurezza', 'Changes to security configuration'), true, b('Servono a ricostruire cosa è cambiato e quando.', 'They help reconstruct what changed and when.')],
          ],
          b('Un buon log racconta cosa è accaduto senza trasformarsi in un nuovo rischio.', 'A good log tells what happened without becoming a new risk.')
        ),
        lessons: {
          'log-value': lesson(5,
            'Senza log un incidente è un’ipotesi; con buoni log diventa una cronologia.',
            'Without logs an incident is a guess; with good logs it becomes a timeline.',
            'Quale evento è utile registrare?',
            'Which event is useful to log?',
            [['Tentativi di accesso falliti con orario e origine', 'Failed login attempts with time and origin'], ['Le password in chiaro', 'Passwords in plaintext'], ['Nulla, per risparmiare spazio', 'Nothing, to save space']], 0,
            'Servono eventi che aiutano a investigare, senza dati segreti.', 'You need events that help investigate, without secret data.'),
          correlazione: lesson(6,
            'Due eventi vicini nel tempo non sono per forza uno la causa dell’altro: correlare è una domanda, non una risposta.',
            'Two events close in time are not necessarily cause and effect: correlating is a question, not an answer.',
            'Un picco di traffico coincide con un accesso sospetto. Che cosa fai?',
            'A traffic spike coincides with a suspicious login. What do you do?',
            [['Concludi che sono collegati', 'Conclude they are linked'], ['Cerchi altre evidenze prima di stabilire un nesso', 'Look for more evidence before establishing a link'], ['Ignori entrambi', 'Ignore both']], 1,
            'Correlazione non è causalità: servono evidenze indipendenti.', 'Correlation is not causation: you need independent evidence.'),
          monitoraggio: lesson(5,
            'Un allarme che nessuno vede, o che non scatta mai, è peggio di nessun allarme: dà una falsa sicurezza.',
            'An alarm nobody sees, or that never fires, is worse than none: it gives false assurance.',
            'Come valuti la copertura del monitoraggio?',
            'How do you assess monitoring coverage?',
            [['Verificando che gli eventi necessari siano raccolti e analizzabili', 'By checking that the needed events are collected and analyzable'], ['Contando quanti dashboard esistono', 'By counting how many dashboards exist'], ['Chiedendo se piace al team', 'By asking whether the team likes it']], 0,
            'La copertura si misura sugli eventi che servono davvero.', 'Coverage is measured on the events you really need.'),
        },
      },
      triage: {
        mission: b(
          'Sono arrivati cento avvisi e c’è un solo analista: tu. Decidi quali guardare per primi e come leggere ciò che gli indicatori dicono davvero.',
          'A hundred alerts have come in and there is one analyst: you. Decide which to look at first and how to read what indicators really say.'
        ),
        skill: b('Sai ordinare gli avvisi per priorità e leggere gli indicatori nel contesto.', 'You can prioritise alerts and read indicators in context.'),
        lab: orderLab('priorita-avvisi', 8,
          b('Laboratorio: ordina gli avvisi per priorità', 'Lab: prioritise the alerts'),
          b('Dal più urgente al meno urgente, considerando impatto, esposizione e qualità delle evidenze.', 'From most to least urgent, considering impact, exposure and quality of evidence.'),
          [
            ['v1', b('Accesso amministrativo da una località insolita, con MFA disattivata', 'Admin login from an unusual location, with MFA disabled'), b('Privilegi alti, controllo mancante, evidenza concreta.', 'High privileges, missing control, concrete evidence.')],
            ['v2', b('Download anomalo e massiccio dal database clienti', 'Unusual, massive download from the customer database'), b('Possibile perdita di dati sensibili.', 'Possible loss of sensitive data.')],
            ['v3', b('Allarme antivirus su un portatile, file messo in quarantena', 'Antivirus alert on a laptop, file quarantined'), b('Contenuto automaticamente; da verificare ma meno urgente.', 'Automatically contained; to verify but less urgent.')],
            ['v4', b('Scansione di porte contro un server di test isolato', 'Port scan against an isolated test server'), b('Bassa esposizione e impatto limitato.', 'Low exposure and limited impact.')],
          ],
          b('La priorità nasce dall’impatto potenziale e dalla solidità delle evidenze, non dall’ordine di arrivo.', 'Priority comes from potential impact and the strength of evidence, not arrival order.')
        ),
        lessons: {
          ioc: lesson(5,
            'Un indirizzo IP in una lista pubblica può essere stato malevolo ieri e pulito oggi: un indicatore si legge nel contesto.',
            'An IP address on a public list may have been malicious yesterday and clean today: an indicator is read in context.',
            'Che cos’è un IOC?',
            'What is an IOC?',
            [['Un indicatore osservabile associato a una possibile attività malevola', 'An observable indicator associated with possible malicious activity'], ['Una prova definitiva di compromissione', 'Definitive proof of compromise'], ['Un tipo di backup', 'A type of backup']], 0,
            'Un IOC è un segnale, non un verdetto.', 'An IOC is a signal, not a verdict.'),
          priorita: lesson(6,
            'Con cento avvisi e due analisti, l’abilità non è trattarli tutti: è scegliere bene i primi cinque.',
            'With a hundred alerts and two analysts, the skill is not handling them all: it is choosing the first five well.',
            'Come ordini gli avvisi?',
            'How do you order alerts?',
            [['Per impatto, esposizione e qualità delle evidenze', 'By impact, exposure and quality of evidence'], ['Per orario di arrivo', 'By arrival time'], ['In ordine alfabetico', 'Alphabetically']], 0,
            'Il contesto decide l’urgenza.', 'Context decides urgency.'),
          'threat-intel': lesson(5,
            'L’intelligence pubblica è come le previsioni del tempo: utile per prepararsi, non per dire che sta piovendo qui.',
            'Public intelligence is like a weather forecast: useful to prepare, not to say it is raining here.',
            'Come usi un feed di intelligence?',
            'How do you use an intelligence feed?',
            [['Come contesto da correlare con la tua telemetria', 'As context to correlate with your telemetry'], ['Bloccando ogni elemento senza verificarlo', 'By blocking every item without checking'], ['Come prova automatica di attacco', 'As automatic proof of an attack']], 0,
            'L’intelligence orienta, la tua telemetria conferma.', 'Intelligence guides, your telemetry confirms.'),
        },
      },
      risposta: {
        mission: b(
          'Squilla il telefono: è un incidente vero. Conosci le fasi, ma ogni decisione ha un costo. Contieni senza cancellare ciò che serve per capire.',
          'The phone rings: it is a real incident. You know the phases, but every decision has a cost. Contain without erasing what you need to understand.'
        ),
        skill: b('Sai guidare le fasi di risposta e contenere un problema preservando le evidenze.', 'You can drive the response phases and contain a problem while preserving evidence.'),
        lab: orderLab('fasi-risposta', 8,
          b('Laboratorio: le fasi della risposta', 'Lab: the response phases'),
          b('Metti nell’ordine corretto le fasi di gestione di un incidente.', 'Put the incident-handling phases in the right order.'),
          [
            ['r1', b('Preparazione: ruoli, canali, strumenti', 'Preparation: roles, channels, tools'), b('Si fa prima che accada qualcosa.', 'It happens before anything occurs.')],
            ['r2', b('Rilevamento e analisi', 'Detection and analysis'), b('Si capisce cosa sta accadendo.', 'You understand what is happening.')],
            ['r3', b('Contenimento', 'Containment'), b('Si limita l’impatto preservando le evidenze.', 'You limit impact while preserving evidence.')],
            ['r4', b('Eradicazione e ripristino', 'Eradication and recovery'), b('Si rimuove la causa e si torna operativi.', 'You remove the cause and return to operations.')],
            ['r5', b('Lezioni apprese', 'Lessons learned'), b('Si trasforma l’esperienza in miglioramento.', 'You turn experience into improvement.')],
          ],
          b('Il ciclo non finisce al ripristino: l’ultima fase prepara la prossima volta.', 'The cycle does not end at recovery: the last phase prepares for next time.')
        ),
        lessons: {
          preparazione: lesson(5,
            'In un incidente non è il momento di scoprire chi decide: ruoli e contatti si stabiliscono prima.',
            'During an incident is not the time to find out who decides: roles and contacts are set beforehand.',
            'Che cosa serve definire in anticipo?',
            'What must be defined in advance?',
            [['Ruoli, canali di comunicazione e piano di risposta', 'Roles, communication channels and a response plan'], ['Solo la marca dei computer', 'Only the brand of the computers'], ['Nulla: si decide al momento', 'Nothing: decide on the spot']], 0,
            'La preparazione accorcia i tempi e riduce gli errori.', 'Preparation shortens time and reduces errors.'),
          contenimento: lesson(6,
            'Spegnere tutto sembra prudente, ma può cancellare proprio le tracce che servono: contenere è dosare.',
            'Shutting everything down seems cautious, but it can erase the very traces you need: containing is dosing.',
            'Quale azione di contenimento è prudente?',
            'Which containment action is prudent?',
            [['Isolare l’host secondo il piano, preservando le evidenze', 'Isolate the host per the plan, preserving evidence'], ['Cancellare i log', 'Delete the logs'], ['Riavviare subito il sistema', 'Reboot the system right away']], 0,
            'Si limita il danno senza distruggere le prove.', 'You limit damage without destroying evidence.'),
          comunicazione: lesson(5,
            'Durante un incidente un aggiornamento chiaro ogni ora vale più di un’ottima analisi che arriva domani.',
            'During an incident a clear update every hour beats an excellent analysis arriving tomorrow.',
            'Che cosa rende efficace un aggiornamento?',
            'What makes an update effective?',
            [['Fatti verificati, impatto, azioni e prossimi passi per il destinatario giusto', 'Verified facts, impact, actions and next steps for the right audience'], ['Ipotesi presentate come certezze', 'Hypotheses presented as certainties'], ['Tutti i dettagli tecnici a tutti', 'Every technical detail to everyone']], 0,
            'La chiarezza e la verificabilità guidano le decisioni.', 'Clarity and verifiability guide decisions.'),
        },
      },
      miglioramento: {
        mission: b(
          'L’incidente è chiuso, ma il lavoro vero comincia ora: ripristinare con cautela e scrivere un report che cambi davvero qualcosa.',
          'The incident is closed, but the real work starts now: restore carefully and write a report that actually changes something.'
        ),
        skill: b('Sai ripristinare in modo controllato e scrivere un report che produce miglioramenti.', 'You can restore in a controlled way and write a report that drives improvement.'),
        lab: selectLab('report-incidente', 8,
          b('Laboratorio: gli ingredienti di un buon report', 'Lab: the ingredients of a good report'),
          b('Seleziona TUTTI gli elementi che un buon report deve contenere e solo quelli.', 'Select ALL the elements a good report must contain and only those.'),
          [
            ['m1', b('Cronologia degli eventi con orari', 'Timeline of events with times'), true, b('Permette di verificare la sequenza.', 'It lets readers verify the sequence.')],
            ['m2', b('Evidenze a supporto delle affermazioni', 'Evidence supporting the claims'), true, b('Distingue i fatti dalle ipotesi.', 'It separates facts from hypotheses.')],
            ['m3', b('Impatto su servizi, dati e persone', 'Impact on services, data and people'), true, b('Serve per decidere e comunicare.', 'It is needed to decide and communicate.')],
            ['m4', b('Azioni correttive con responsabile e scadenza', 'Corrective actions with owner and deadline'), true, b('Trasformano la lezione in miglioramento.', 'They turn the lesson into improvement.')],
            ['m5', b('Credenziali e token in chiaro', 'Credentials and tokens in plaintext'), false, b('Un report non deve diventare una nuova fuga di dati.', 'A report must not become a new data leak.')],
            ['m6', b('Il nome del colpevole', 'The name of the culprit'), false, b('Una revisione utile guarda alle condizioni, non alla colpa.', 'A useful review looks at conditions, not blame.')],
            ['m7', b('Ipotesi non verificate presentate come fatti', 'Unverified hypotheses presented as facts'), false, b('Compromette la fiducia nel report.', 'It undermines trust in the report.')],
          ],
          b('Un report efficace è verificabile, utile a chi decide e sicuro da condividere.', 'An effective report is verifiable, useful to decision-makers and safe to share.')
        ),
        lessons: {
          recupero: lesson(5,
            'Ripristinare in fretta da un backup compromesso significa riportare dentro il problema.',
            'Restoring quickly from a compromised backup means bringing the problem back in.',
            'Prima di ripristinare un servizio, che cosa verifichi?',
            'Before restoring a service, what do you verify?',
            [['L’integrità del backup e la rimozione della causa', 'The backup’s integrity and the removal of the cause'], ['Solo la velocità', 'Only the speed'], ['Niente: si ripristina e basta', 'Nothing: just restore']], 0,
            'Un ripristino controllato evita di reintrodurre il problema.', 'A controlled restore avoids reintroducing the problem.'),
          'post-incident': lesson(5,
            'Le organizzazioni che migliorano non cercano un colpevole: cercano la condizione che ha reso possibile l’errore.',
            'Organizations that improve do not look for a culprit: they look for the condition that made the error possible.',
            'Qual è l’obiettivo di una revisione post-incidente?',
            'What is the goal of a post-incident review?',
            [['Individuare miglioramenti concreti, senza colpevolizzare', 'Identify concrete improvements, without blame'], ['Trovare chi ha sbagliato', 'Find who made the mistake'], ['Archiviare il caso', 'File the case away']], 0,
            'Una cultura senza colpa favorisce segnalazioni oneste.', 'A blameless culture encourages honest reporting.'),
          report: lesson(5,
            'Un buon report si legge in due minuti da chi decide e regge l’esame di chi vuole verificare.',
            'A good report can be read in two minutes by the decision-maker and survives scrutiny from whoever wants to verify.',
            'Quale elemento non deve mancare?',
            'Which element must not be missing?',
            [['Cronologia, evidenze, impatto, azioni e raccomandazioni', 'Timeline, evidence, impact, actions and recommendations'], ['Un giudizio senza prove', 'A verdict without proof'], ['Credenziali in chiaro', 'Plaintext credentials']], 0,
            'Struttura e prove rendono il report utile e verificabile.', 'Structure and evidence make the report useful and verifiable.'),
        },
      },
    },
  },
};

function pick(value, lang) {
  if (value && typeof value === 'object' && 'it' in value) return lang === 'en' ? value.en || value.it : value.it;
  return value;
}

function getDesign(courseId) {
  return Object.prototype.hasOwnProperty.call(DESIGN, courseId) ? DESIGN[courseId] : null;
}

module.exports = { DESIGN, getDesign, pick };

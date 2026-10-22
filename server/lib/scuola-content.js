'use strict';
/**
 * EVIL Scuola (docs/evil-per-tutti/PIANO.md, fase 3): lezioni pronte da 50 minuti sulla sicurezza
 * online, due per ciclo, da stampare e proiettare.
 *
 * Fonte unica dei testi, in italiano e in inglese. scripts/build-scuola.js genera da qui
 * html/scuola.html, html/scuola-<kit>.html e i dizionari i18n/en/pages/*.json; un test controlla che
 * i file generati siano aggiornati. Le fonti della scuola sono state verificate il 22 ottobre 2026
 * (docs/evil-per-tutti/fonti/FASE3.md); quelle sugli argomenti vengono da Primi passi.
 *
 * In classe gli studenti non usano il telefono (note MIM n. 5274/2024 e n. 3392/2025): bastano la
 * LIM del docente e i fogli stampati. I kit su temi delicati restano "da rivedere" finché un esperto
 * non li approva (decisione D3).
 */

const PP = require('./primi-passi-content');

const T = (it, en) => ({ it, en });

const SRC = {
  lineeGuida: { label: T('MIM, Linee guida per l’insegnamento dell’educazione civica (DM 183/2024)', 'Italian Ministry of Education, civic education guidelines (DM 183/2024, Italian)'), url: 'https://www.mim.gov.it/documents/20182/0/Linee+guida+Educazione+civica.pdf/9ffd1e06-db57-1596-c742-216b3f42b995' },
  legge92: { label: T('Legge 92/2019 sull’educazione civica, Normattiva', 'Law 92/2019 on civic education, Normattiva (Italian)'), url: 'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:legge:2019-08-20;92' },
  nota5274: { label: T('MIM, nota n. 5274 dell’11 luglio 2024 (cellulari nel primo ciclo)', 'Italian Ministry of Education, note 5274 of 11 July 2024 (phones in primary and lower secondary, Italian)'), url: 'https://www.mim.gov.it/-/nota-n-5274-dell-11-luglio-2024' },
  nota3392: { label: T('MIM, circolare n. 3392 del 16 giugno 2025 (cellulari nel secondo ciclo)', 'Italian Ministry of Education, circular 3392 of 16 June 2025 (phones in upper secondary, Italian)'), url: 'https://www.mim.gov.it/web/guest/-/circolare-n-3392-del-16-giugno-2025' },
  nota121: { label: T('MIM, nota n. 121 del 20 gennaio 2025 (adempimenti della legge 70/2024)', 'Italian Ministry of Education, note 121 of 20 January 2025 (Law 70/2024 duties, Italian)'), url: 'https://istruzioneveneto.gov.it/20250120_34030/' },
  orientamento: { label: T('MIM, Linee di orientamento su bullismo e cyberbullismo (2021)', 'Italian Ministry of Education, guidelines on bullying and cyberbullying (2021, Italian)'), url: 'https://www.mim.gov.it/documents/20182/0/Linee+di+orientamento+per+la+prevenzione+e+il+contrasto+dei+fenomeni+di+bullismo+e+cyberbullismo-2021.pdf/37003208-7571-0e5f-7730-63fb0f86a0bd' },
  digcomp: { label: T('DigComp 2.2, versione italiana', 'DigComp 2.2, Italian version'), url: 'https://www.agid.gov.it/sites/agid/files/2024-05/digcomp_2.2_italiano.pdf' },
  epolicy: { label: T('Generazioni Connesse, percorso ePolicy per le scuole', 'Generazioni Connesse, ePolicy programme for schools (Italian)'), url: 'https://www.generazioniconnesse.it/site/it/epolicy/' },
  legge132: { label: T('Legge 132/2025 sull’intelligenza artificiale (art. 612-quater c.p.), Gazzetta Ufficiale', 'Law 132/2025 on artificial intelligence (Article 612-quater of the Criminal Code), Official Journal (Italian)'), url: 'https://www.gazzettaufficiale.it/eli/id/2025/09/25/25G00143/sg' },
  aiAct: { label: T('Regolamento UE 2024/1689 sull’intelligenza artificiale (AI Act, art. 50), EUR-Lex', 'EU Regulation 2024/1689 on artificial intelligence (AI Act, Article 50), EUR-Lex'), url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/oj' },
  fbiPsa: { label: T('FBI, avviso IC3 I-120324-PSA sulle truffe con l’IA (3 dicembre 2024)', 'FBI, IC3 alert I-120324-PSA on AI fraud (3 December 2024)'), url: 'https://www.ic3.gov/PSA/2024/PSA241203' },
};

/** Pagina di presentazione (html/scuola.html). */
const PAGE = {
  file: 'scuola.html',
  navTitle: T('EVIL Scuola', 'EVIL for Schools'),
  navDesc: T(
    'Lezioni pronte da 50 minuti sulla sicurezza online, dalla primaria alle superiori: si stampano e si proiettano, senza account e senza telefoni.',
    'Ready-made 50-minute lessons on online safety, from primary to secondary school: print them and project them, no accounts and no phones.'
  ),
  metaTitle: T('EVIL Scuola: lezioni pronte sulla sicurezza online - EVIL', 'EVIL for Schools: ready-made online safety lessons - EVIL'),
  kicker: T('EVIL Scuola · per docenti', 'EVIL for Schools · for teachers'),
  h1: T('Lezioni pronte sulla sicurezza online, dalla primaria alle superiori.', 'Ready-made online safety lessons, from primary to secondary school.'),
  lead: T(
    'Kit da 50 minuti da stampare e proiettare: una storia da discutere, un gioco a gruppi, le domande per la discussione con le risposte, un biglietto d’uscita. Gratis, senza account e senza telefoni degli studenti.',
    '50-minute kits to print and project: a story to discuss, a group game, discussion questions with answers, an exit ticket. Free, with no accounts and no student phones.'
  ),
  goKits: T('Scegli il kit', 'Choose a kit'),
  howTitle: T('Come funziona', 'How it works'),
  how: T(
    [
      '<strong>Scegli il kit</strong> per la tua classe: due per ciclo, ognuno collegato alle tappe di Primi passi.',
      '<strong>Prepara in dieci minuti:</strong> stampa la guida e una copia delle carte per gruppo. La guida dice cosa fare e cosa dire, minuto per minuto.',
      '<strong>In classe basta la LIM:</strong> la storia e la scena animata si proiettano, gli studenti lavorano con le carte. Nessun telefono.',
      '<strong>A casa si continua</strong> con la famiglia: ogni kit finisce con una cosa da fare insieme.',
    ],
    [
      '<strong>Pick the kit</strong> for your class: two per school stage, each linked to stages of First steps.',
      '<strong>Get ready in ten minutes:</strong> print the guide and one set of cards per group. The guide says what to do and what to say, minute by minute.',
      '<strong>All you need in class is a screen:</strong> project the story and the animated scene, students work with the cards. No phones.',
      '<strong>It carries on at home</strong> with the family: every kit ends with something to do together.',
    ]
  ),
  kitsTitle: T('I kit', 'The kits'),
  kitsLead: T('Due kit per ciclo. Quelli segnati «da rivedere» trattano temi delicati e aspettano la revisione di esperti: usali dopo averne parlato con il referente della scuola.', 'Two kits per school stage. Those marked “under review” deal with sensitive topics and are awaiting expert review: use them after talking to your school’s contact person.'),
  planned: T('In preparazione', 'In preparation'),
  open: T('Apri il kit', 'Open the kit'),
  curriculumTitle: T('Nel curricolo', 'In the curriculum'),
  curriculum: T(
    [
      '<strong>Educazione civica:</strong> la legge 92/2019 dedica l’articolo 5 alla cittadinanza digitale e prevede almeno 33 ore l’anno. I kit lavorano sui traguardi e sulle competenze 10, 11 e 12 delle Linee guida del 2024 (DM 183/2024), nucleo «Cittadinanza digitale».',
      '<strong>DigComp 2.2:</strong> il quadro europeo delle competenze digitali, soprattutto l’area 4, «Sicurezza».',
      '<strong>Niente telefoni in classe:</strong> le note del Ministero n. 5274 dell’11 luglio 2024 e n. 3392 del 16 giugno 2025 ne vietano l’uso anche a scopo didattico, salvo eccezioni. I kit funzionano con la LIM del docente e con i fogli stampati.',
    ],
    [
      '<strong>Civic education (Italy):</strong> Law 92/2019 devotes article 5 to digital citizenship and sets at least 33 hours a year. The kits work on goals 10, 11 and 12 of the 2024 guidelines (DM 183/2024), “Digital citizenship” strand.',
      '<strong>DigComp 2.2:</strong> the European digital competence framework, especially area 4, “Safety”.',
      '<strong>No phones in class:</strong> in Italy, Ministry notes 5274 of 11 July 2024 and 3392 of 16 June 2025 ban their use even for teaching, with some exceptions. The kits work with the teacher’s screen and printed sheets.',
    ]
  ),
  careTitle: T('Prima dei temi delicati', 'Before sensitive topics'),
  care: T(
    [
      'Parlane con il <strong>referente per il bullismo e il cyberbullismo</strong> della scuola: ogni scuola deve averne uno (legge 71/2017; nota del Ministero n. 121 del 20 gennaio 2025).',
      'Dai regole chiare alla classe: si parla dei personaggi, non dei compagni; nessuno deve raccontare cose personali; si può sempre passare.',
      'Se uno studente ti racconta qualcosa: ascolta con calma, ringrazia, non promettere di tenere il segreto e segui la procedura della scuola.',
    ],
    [
      'Talk to the school’s <strong>bullying and cyberbullying contact person</strong>: in Italy every school must have one (Law 71/2017; Ministry note 121 of 20 January 2025).',
      'Set clear ground rules: we talk about the characters, not classmates; nobody has to share anything personal; anyone can pass.',
      'If a student tells you something: listen calmly, thank them, don’t promise to keep it secret and follow your school’s procedure.',
    ]
  ),
  careMore: T('Altri consigli per i docenti nella pagina <a href="/aiuto.html#docenti">Aiuto subito</a>.', 'More advice for teachers on the <a href="/aiuto.html#docenti">Get help now</a> page.'),
  resourcesTitle: T('Risorse ufficiali', 'Official resources'),
  privacyTitle: T('Privacy', 'Privacy'),
  privacy: T(
    'Nessun account, nessun dato degli studenti, nessun tracciamento. Le pagine si stampano; i giochi di Primi passi salvano i progressi solo nel browser, e alla LIM si cancellano con un tocco.',
    'No accounts, no student data, no tracking. The pages are made to be printed; First steps games save progress only in the browser, and on a classroom screen it can be wiped with one tap.'
  ),
};

const CYCLES = {
  primaria: T('Scuola primaria', 'Primary school'),
  media: T('Secondaria di primo grado', 'Lower secondary school'),
  superiori: T('Secondaria di secondo grado', 'Upper secondary school'),
};

/** Testi comuni delle pagine dei kit. */
const UI = {
  metaTitle: T('{title} · Kit {n} di EVIL Scuola - EVIL', '{title} · EVIL for Schools kit {n} - EVIL'),
  back: T('Tutti i kit', 'All kits'),
  kicker: T('Kit {n} · {cycle}', 'Kit {n} · {cycle}'),
  facts: T('{classes} · 50 minuti · gruppi da 3–4', '{classes} · 50 minutes · groups of 3–4'),
  printGuide: T('Stampa la guida', 'Print the guide'),
  printCards: T('Stampa le carte', 'Print the cards'),
  printHint: T('Senza i pulsanti: stampa la pagina dal browser, esce tutto.', 'No buttons? Print the page from your browser and you get everything.'),
  stageLink: T('Alla LIM, in modalità classe: tappa {n}, {title}', 'On the whiteboard, in class mode: stage {n}, {title}'),
  printVotes: T('Stampa i cartellini A–D', 'Print the A–D cards'),
  votesSheet: T('Cartellini per votare · una copia per studente · si piegano o si ritagliano', 'Voting cards · one copy per student · fold or cut them out'),
  ideaTitle: T('L’idea da portare a casa', 'The idea to take home'),
  goalsTitle: T('Alla fine della lezione, gli studenti sanno…', 'By the end of the lesson, students can…'),
  materialsTitle: T('Cosa serve', 'What you need'),
  beforeTitle: T('Prima della lezione', 'Before the lesson'),
  planTitle: T('La lezione, minuto per minuto', 'The lesson, minute by minute'),
  minutes: T('{a}–{b} min', '{a}–{b} min'),
  say: T('Puoi dire:', 'You can say:'),
  answersTitle: T('Le risposte del gioco', 'Game answers'),
  discussionTitle: T('Domande per la discussione', 'Discussion questions'),
  where: T('Dove portare la classe:', 'Where to take the class:'),
  disclosureTitle: T('Se uno studente racconta qualcosa', 'If a student tells you something'),
  disclosure: T(
    'Ascolta con calma e ringrazia per la fiducia. Non fare domande insistenti e non promettere di tenere il segreto: spiega che ne parlerai con chi può aiutare. Segui la procedura della scuola e avvisa il referente per il bullismo e il cyberbullismo.',
    'Listen calmly and thank them for trusting you. Don’t press with questions and don’t promise to keep it secret: explain that you’ll talk to someone who can help. Follow your school’s procedure and tell the bullying and cyberbullying contact person.'
  ),
  adaptTitle: T('Per adattare', 'Adapting it'),
  easier: T('Più semplice', 'Easier'),
  harder: T('Più impegnativo', 'More challenging'),
  inclusion: T('Inclusione', 'Inclusion'),
  homeTitle: T('A casa, con la famiglia', 'At home, with the family'),
  curriculumTitle: T('Nel curricolo', 'In the curriculum'),
  civica: T('Educazione civica (Linee guida 2024, nucleo «Cittadinanza digitale»)', 'Civic education (Italian 2024 guidelines, “Digital citizenship”)'),
  digcomp: T('DigComp 2.2', 'DigComp 2.2'),
  sourcesTitle: T('Fonti', 'Sources'),
  sourcesNote: T('Pagine verificate il 22 ottobre 2026.', 'Pages checked on 22 October 2026.'),
  sheetsTitle: T('Da stampare', 'To print'),
  cardsSheet: T('Carte del gioco · una copia per gruppo · ritaglia lungo le linee', 'Game cards · one copy per group · cut along the lines'),
  ticketSheet: T('Biglietto d’uscita · uno per studente', 'Exit ticket · one per student'),
  nameLine: T('Nome (facoltativo)', 'Name (optional)'),
  anonymous: T('Biglietto anonimo: niente nome', 'Anonymous ticket: no name'),
  review: T('Da rivedere', 'Under review'),
  reviewNote: T(
    'Questo kit tratta un tema delicato ed è in attesa della revisione di esperti di ascolto e tutela dei minori. Usalo dopo averne parlato con il referente della scuola.',
    'This kit deals with a sensitive topic and is awaiting review by child safeguarding and helpline experts. Use it after talking to your school’s contact person.'
  ),
};

const KITS = [
  // ------------------------------------------------------------------ kit 1
  {
    n: 1,
    slug: 'chiavi-di-casa',
    cycle: 'primaria',
    icon: 'key',
    classes: T('Primaria, classi 3ª–5ª', 'Primary, ages 8–10'),
    stages: ['cosa-proteggere', 'password'],
    title: T('Le chiavi di casa', 'The house keys'),
    desc: T(
      'Kit 1 di EVIL Scuola, primaria: informazioni personali e password come le chiavi di casa. Lezione pronta da 50 minuti con storia, gioco a gruppi e biglietto d’uscita.',
      'EVIL for Schools kit 1, primary: personal information and passwords as house keys. A ready-made 50-minute lesson with a story, a group game and an exit ticket.'
    ),
    hook: T('Informazioni personali e password sono come le chiavi di casa: si tengono, non si prestano, e per ogni porta ce n’è una.', 'Personal information and passwords are like house keys: you keep them, you don’t lend them, and every door has its own.'),
    idea: T('Le mie informazioni e le mie password sono chiavi: non le do a chi non conosco, la password non la presto a nessuno, e se qualcuno me la chiede lo dico a un adulto di cui mi fido.', 'My information and my passwords are keys: I don’t give them to people I don’t know, I don’t lend my password to anyone, and if someone asks for it I tell an adult I trust.'),
    goals: T(
      [
        'riconoscere quali informazioni sono personali (indirizzo, scuola, password, codici, posizione) e quali si possono raccontare;',
        'spiegare con parole loro perché la password non si presta, nemmeno all’amico del cuore;',
        'dire a chi chiedono aiuto se qualcuno online chiede password o dove abitano.',
      ],
      [
        'tell which information is personal (address, school, passwords, codes, location) and which they can share;',
        'explain in their own words why you don’t lend your password, not even to your best friend;',
        'say who they would ask for help if someone online asks for a password or where they live.',
      ]
    ),
    materials: T(
      [
        'LIM o proiettore con le tappe 1 e 2 di Primi passi (aprile prima: funzionano anche senza registrarsi).',
        'Una copia delle carte del gioco per ogni gruppo, ritagliata.',
        'Un biglietto d’uscita per ogni studente.',
        'Un mazzo di chiavi vere, per cominciare.',
      ],
      [
        'A classroom screen or projector showing stages 1 and 2 of First steps (open them beforehand: no sign-up needed).',
        'One set of game cards per group, cut out.',
        'One exit ticket per student.',
        'A real bunch of keys, to start with.',
      ]
    ),
    before: T(
      [
        'Stampa la guida, le carte (una copia per gruppo) e i biglietti; ritaglia le carte.',
        'Apri la tappa 1 alla LIM e guarda la scena animata: dura pochi secondi.',
        'Leggi le risposte del gioco qui sotto: ogni carta ha il suo perché.',
      ],
      [
        'Print the guide, the cards (one set per group) and the tickets; cut out the cards.',
        'Open stage 1 on the screen and watch the animated scene: it only takes a few seconds.',
        'Read the game answers below: every card comes with its reason.',
      ]
    ),
    plan: [
      {
        from: 0,
        to: 5,
        title: T('Aggancio: le chiavi', 'Hook: the keys'),
        text: T('Mostra il mazzo di chiavi e fai qualche domanda veloce. Ascolta le risposte senza correggere.', 'Show the bunch of keys and ask a few quick questions. Listen to the answers without correcting.'),
        say: T('«Chi di voi ha le chiavi di casa? Le prestereste a uno sconosciuto? E a un amico, per sempre? Oggi scopriamo che online abbiamo tante chiavi.»', '“Who here has a house key? Would you lend it to a stranger? To a friend, for ever? Today we’ll find out that online we have lots of keys.”'),
      },
      {
        from: 5,
        to: 15,
        title: T('La storia di Martina', 'Martina’s story'),
        text: T('Proietta la tappa 1 di Primi passi: guardate la scena e leggi la storia. La classe vota per alzata di mano una delle tre risposte, poi aprite le risposte sulla LIM.', 'Project stage 1 of First steps: watch the scene and read the story. The class votes for one of the three answers by raising hands, then open the answers on the screen.'),
        say: T('«Il telefono è tornato, ma qualcuno ha parlato al posto di Martina, con il suo nome. Cosa c’è nel telefono che vale più della batteria?»', '“The phone came back, but someone spoke in Martina’s place, using her name. What’s in a phone that’s worth more than the battery?”'),
      },
      {
        from: 15,
        to: 30,
        title: T('Gioco a gruppi: lo tengo per me o si può dire?', 'Group game: keep it or share it?'),
        text: T('Gruppi da 3–4, una serie di carte per gruppo. Per dieci minuti i gruppi dividono le carte in due colonne; poi ogni gruppo racconta la carta su cui ha discusso di più e tu dai la risposta con il suo perché.', 'Groups of 3–4, one set of cards each. For ten minutes groups sort the cards into two columns; then each group tells the card they argued about most and you give the answer with its reason.'),
        say: T('«La domanda è sempre questa: online, a una persona che non conosci di persona, lo tieni per te o si può dire?»', '“The question is always the same: online, to someone you don’t know in real life, do you keep it to yourself or can you share it?”'),
      },
      {
        from: 30,
        to: 40,
        title: T('Una chiave per ogni porta', 'A key for every door'),
        text: T('Proietta la scena della tappa 2: una sola password per tutto è una chiave che apre ogni porta. Distribuisci adesso i biglietti d’uscita: ogni studente inventa una password finta fatta di tre parole a caso, la scrive e la disegna. Il biglietto resta sul banco fino alla fine.', 'Project the scene from stage 2: one password for everything is a key that opens every door. Hand out the exit tickets now: each student invents a pretend password made of three random words, writes it and draws it. The ticket stays on the desk until the end.'),
        say: T('«Le password migliori sono lunghe e strane, come “elefante-lampone-ombrello”. Inventatene una finta: quella vera non si scrive e non si dice a nessuno, nemmeno qui.»', '“The best passwords are long and odd, like ‘elephant-raspberry-umbrella’. Make up a pretend one: the real one isn’t written down or told to anyone, not even here.”'),
      },
      {
        from: 40,
        to: 47,
        title: T('Discussione', 'Discussion'),
        text: T('Usa le domande qui sotto. Bastano due o tre: meglio poche domande discusse bene.', 'Use the questions below. Two or three are enough: better a few questions discussed well.'),
      },
      {
        from: 47,
        to: 50,
        title: T('Chiusura', 'Wrap-up'),
        text: T('Ogni studente completa il biglietto d’uscita. Ricorda la cosa da fare a casa con la famiglia.', 'Each student fills in the exit ticket. Remind them of the thing to do at home with their family.'),
        say: T('«Ripetiamo insieme: la password non si presta, e se qualcuno me la chiede lo dico a un adulto.»', '“Let’s say it together: I don’t lend my password, and if someone asks for it, I tell a grown-up.”'),
      },
    ],
    game: {
      categories: [
        { id: 'mine', label: T('Lo tengo per me', 'I keep it to myself') },
        { id: 'share', label: T('Si può dire', 'I can share it') },
      ],
      items: [
        { cat: 'mine', text: T('La mia password', 'My password'), why: T('Non la sa nessuno, nemmeno l’amico del cuore: solo un adulto di casa.', 'Nobody knows it, not even my best friend: only a grown-up at home.') },
        { cat: 'mine', text: T('Il mio indirizzo di casa', 'My home address'), why: T('Dice a chiunque dove trovarmi.', 'It tells anyone where to find me.') },
        { cat: 'share', text: T('Il mio colore preferito', 'My favourite colour'), why: T('Non dice chi sono né dove sono.', 'It doesn’t say who I am or where I am.') },
        { cat: 'mine', text: T('Il nome della mia scuola e la mia classe', 'The name of my school and my class'), why: T('Insieme dicono dove sono ogni mattina.', 'Together they say where I am every morning.') },
        { cat: 'mine', text: T('Una foto della mia cameretta con la finestra sulla via', 'A photo of my bedroom with the window onto the street'), why: T('Lo sfondo può far capire dove abito.', 'The background can show where I live.') },
        { cat: 'share', text: T('Che mi piacciono i dinosauri', 'That I like dinosaurs'), why: T('È una passione, non un dato che serve a trovarmi.', 'It’s a hobby, not something that helps anyone find me.') },
        { cat: 'mine', text: T('Il codice arrivato sul telefono di mamma o papà', 'The code that arrived on Mum’s or Dad’s phone'), why: T('I codici sono chiavi: chi li chiede vuole entrare in un account.', 'Codes are keys: whoever asks for them wants to get into an account.') },
        { cat: 'mine', text: T('Il mio nome e cognome insieme alla mia età', 'My full name together with my age'), why: T('Insieme bastano per sapere chi sono.', 'Together they’re enough to know who I am.') },
        { cat: 'share', text: T('Il titolo del mio libro preferito', 'The title of my favourite book'), why: T('Si può raccontare tranquillamente.', 'That’s fine to share.') },
        { cat: 'mine', text: T('Quando la mia famiglia parte per le vacanze', 'When my family goes away on holiday'), why: T('Dice quando la casa resta vuota.', 'It says when the house will be empty.') },
        { cat: 'share', text: T('Un disegno che ho fatto, senza il mio nome', 'A drawing I made, without my name on it'), why: T('Le mie creazioni si possono mostrare, senza dati personali.', 'My creations can be shown, without personal details.') },
        { cat: 'mine', text: T('Dove sono adesso, in tempo reale', 'Where I am right now, live'), why: T('La posizione la sanno solo le persone di casa.', 'Only the people at home should know my location.') },
      ],
    },
    discussion: [
      {
        q: T('Un amico ti chiede la password del gioco «solo per un attimo». Cosa rispondi?', 'A friend asks for your game password “just for a second”. What do you say?'),
        a: T('No, nemmeno all’amico del cuore: la password è come lo spazzolino, ognuno ha il suo. Se insiste, lo dico a un adulto.', 'No, not even to my best friend: a password is like a toothbrush, everyone has their own. If they keep asking, I tell a grown-up.'),
      },
      {
        q: T('Qualcuno online ti chiede dove abiti o in che scuola vai. Cosa fai?', 'Someone online asks where you live or which school you go to. What do you do?'),
        a: T('Non rispondo e lo dico a un adulto di cui mi fido: online non sai davvero chi c’è dall’altra parte.', 'I don’t answer and I tell an adult I trust: online you can’t really know who’s on the other side.'),
      },
      {
        q: T('Chi è un adulto di fiducia per te?', 'Who is a trusted adult for you?'),
        a: T('Ognuno ci pensa e lo scrive sul biglietto, senza doverlo dire ad alta voce: un genitore, un nonno, una maestra, un allenatore.', 'Everyone thinks of one and writes it on the ticket, without having to say it out loud: a parent, a grandparent, a teacher, a coach.'),
      },
    ],
    ticket: T(
      ['Una cosa che online tengo per me:', 'Se qualcuno mi chiede la password, lo dico a:', 'La mia password finta di tre parole (non quella vera!):'],
      ['One thing I keep to myself online:', 'If someone asks for my password, I tell:', 'My pretend three-word password (not the real one!):']
    ),
    adapt: {
      easier: T('In terza usa otto carte e leggile ad alta voce; nelle tappe scegli il livello «Per i più piccoli».', 'With younger children use eight cards and read them aloud; choose the “For little ones” level in the stages.'),
      harder: T('In quinta aggiungi la «seconda serratura» della tappa 3: il codice che arriva sul telefono non si dice a nessuno.', 'With older children add the “second lock” from stage 3: the code that arrives on a phone isn’t told to anyone.'),
      inclusion: T('Carte lette in coppia o ad alta voce; chi preferisce può disegnare le risposte del biglietto.', 'Cards read in pairs or aloud; anyone who prefers can draw their ticket answers.'),
    },
    home: T(
      'Con un adulto di casa, fate insieme la tappa 1 di Primi passi e l’elenco delle «chiavi» di famiglia: quali account ci sono e chi conosce le password.',
      'With a grown-up at home, do stage 1 of First steps together and make a list of the family’s “keys”: which accounts there are and who knows the passwords.'
    ),
    civica: T('Traguardo n. 12 (primo ciclo): «Gestire l’identità digitale e i dati della rete, salvaguardando la propria e altrui sicurezza negli ambienti digitali…»', 'Goal 12 (primary and lower secondary): managing digital identity and online data, keeping oneself and others safe in digital environments.'),
    digcomp: T('4.1 Proteggere i dispositivi · 4.2 Proteggere i dati personali e la privacy', '4.1 Protecting devices · 4.2 Protecting personal data and privacy'),
    sources: [SRC.lineeGuida, SRC.digcomp, SRC.nota5274, PP.SRC.ncsc],
  },

  // ------------------------------------------------------------------ kit 4
  {
    n: 4,
    slug: 'trappole-nel-telefono',
    cycle: 'media',
    icon: 'search',
    classes: T('Secondaria di primo grado, classi 1ª–3ª', 'Lower secondary, ages 11–14'),
    stages: ['truffe', 'due-passaggi'],
    title: T('Trappole nel telefono', 'Traps in your phone'),
    desc: T(
      'Kit 4 di EVIL Scuola, secondaria di primo grado: SMS truffa, link falsi e codici di verifica. Lezione pronta da 50 minuti con caccia alle trappole a gruppi.',
      'EVIL for Schools kit 4, lower secondary: scam texts, fake links and verification codes. A ready-made 50-minute lesson with a group trap hunt.'
    ),
    hook: T('Le truffe usano sempre la fretta. Tre domande e una regola sul codice bastano per riconoscerle.', 'Scams always use a rush. Three questions and one rule about codes are enough to spot them.'),
    idea: T('Prima di toccare un link mi chiedo: chi me lo manda davvero? Mi mette fretta? Mi chiede soldi, codici o dati? Se sì, controllo da un’altra strada. E il codice che arriva sul telefono non lo do a nessuno.', 'Before I tap a link I ask: who is really sending this? Is it rushing me? Is it asking for money, codes or details? If so, I check another way. And I never give anyone the code that arrives on my phone.'),
    goals: T(
      [
        'trovare in un messaggio i segnali della truffa: fretta, link che non torna, richiesta di soldi, codici o dati;',
        'spiegare perché un codice di verifica non si dà a nessuno, nemmeno a un amico;',
        'controllare «da un’altra strada»: l’app o il sito ufficiale aperti da loro, una telefonata al numero che conoscono, un adulto.',
      ],
      [
        'spot the signs of a scam in a message: rushing, a link that doesn’t add up, a request for money, codes or details;',
        'explain why a verification code is never given to anyone, not even a friend;',
        'check “another way”: the official app or site opened themselves, a call to a number they know, an adult.',
      ]
    ),
    materials: T(
      [
        'LIM o proiettore con le tappe 5 e 3 di Primi passi.',
        'Una copia delle sei carte-messaggio per ogni gruppo, ritagliata, e un evidenziatore o una matita per gruppo.',
        'Un biglietto d’uscita per ogni studente.',
        'Nessun telefono degli studenti: i messaggi sono stampati.',
      ],
      [
        'A classroom screen or projector showing stages 5 and 3 of First steps.',
        'One set of the six message cards per group, cut out, and a highlighter or pencil per group.',
        'One exit ticket per student.',
        'No student phones: the messages are printed.',
      ]
    ),
    before: T(
      [
        'Stampa la guida, le carte (una copia per gruppo) e i biglietti; ritaglia le carte.',
        'Apri la tappa 5 alla LIM e prova il gioco «Trova le tre trappole»: lo farete insieme.',
        'Scrivi alla lavagna le tre domande dell’idea qui sopra, oppure tienile pronte da scrivere.',
      ],
      [
        'Print the guide, the cards (one set per group) and the tickets; cut out the cards.',
        'Open stage 5 on the screen and try the “Find the three traps” game: you’ll play it together.',
        'Write the three questions from the idea above on the board, or have them ready to write.',
      ]
    ),
    plan: [
      {
        from: 0,
        to: 5,
        title: T('Aggancio: la squadra antitruffa', 'Hook: the anti-scam squad'),
        text: T('Chiedi chi ha mai ricevuto un messaggio strano, senza raccontare dettagli personali. Annuncia la missione della lezione.', 'Ask who has ever received a strange message, without sharing personal details. Announce the lesson’s mission.'),
        say: T('«Oggi diventiamo una squadra antitruffa: alla fine riconoscerete al volo il trucco che usano quasi tutte.»', '“Today we become an anti-scam squad: by the end you’ll spot in a flash the trick almost all of them use.”'),
      },
      {
        from: 5,
        to: 15,
        title: T('La storia di Giulia e il messaggio di SpediLù', 'Giulia’s story and the LuParcel text'),
        text: T('Proietta la tappa 5: scena, storia e voto per alzata di mano. Poi fate insieme il gioco del messaggio: gli studenti dicono «trappola!» e tu tocchi la parte sulla LIM.', 'Project stage 5: scene, story and a vote by show of hands. Then play the message game together: students call out “trap!” and you tap that part on the screen.'),
        say: T('«Non rubano 1,99 euro: rubano la carta. Qual è il trucco che fa cliccare Giulia senza pensarci?»', '“They don’t steal €1.99: they steal the card. What trick makes Giulia tap without thinking?”'),
      },
      {
        from: 15,
        to: 30,
        title: T('Caccia alle trappole a gruppi', 'Group trap hunt'),
        text: T('Ogni gruppo riceve le sei carte-messaggio. In dieci minuti sottolinea le parti sospette e decide: truffa, oppure messaggio vero arrivato da un canale ufficiale. Poi ogni gruppo spiega una carta, scelta da te.', 'Each group gets the six message cards. In ten minutes they underline the suspicious parts and decide: scam, or a genuine message from an official channel. Then each group explains one card, chosen by you.'),
        say: T('«Per ogni messaggio, le tre domande: chi lo manda davvero? Mette fretta? Chiede soldi, codici o dati?»', '“For every message, the three questions: who is really sending it? Is it rushing you? Is it asking for money, codes or details?”'),
      },
      {
        from: 30,
        to: 40,
        title: T('Il codice è una chiave', 'The code is a key'),
        text: T('Proietta la scena della tappa 3: la password è la prima serratura, il codice la seconda. Poi a coppie: uno chiede il codice con una scusa, l’altro allena il no. Poi si scambiano.', 'Project the scene from stage 3: the password is the first lock, the code is the second. Then in pairs: one asks for the code with an excuse, the other practises saying no. Then they swap.'),
        say: T('«La frase da allenare: “Il codice non lo giro a nessuno. Se sei davvero tu, ti chiamo.”»', '“The line to practise: ‘I don’t pass codes to anyone. If it’s really you, I’ll call you.’”'),
      },
      {
        from: 40,
        to: 47,
        title: T('Discussione', 'Discussion'),
        text: T('Usa le domande qui sotto. La seconda è la più importante: nessuno deve sentirsi stupido se c’è cascato.', 'Use the questions below. The second is the most important: nobody should feel stupid for falling for it.'),
      },
      {
        from: 47,
        to: 50,
        title: T('Chiusura', 'Wrap-up'),
        text: T('Ogni studente completa il biglietto d’uscita. Ricorda la missione per casa.', 'Each student fills in the exit ticket. Remind them of the mission for home.'),
      },
    ],
    game: {
      categories: [
        { id: 'scam', label: T('Truffa', 'Scam') },
        { id: 'ok', label: T('Vero, se lo controllo dal canale ufficiale', 'Genuine, if I check it in the official channel') },
      ],
      items: [
        { cat: 'scam', text: T('SMS da SpediLù: «Il tuo pacco è fermo. Paga 1,99 € entro oggi: spedilu.consegna-pacchi.top/paga»', 'Text from LuParcel: “Your parcel is held. Pay €1.99 today: luparcel.parcel-delivery.top/pay”'), why: T('Fretta, soldi e un indirizzo che non è quello del corriere.', 'A rush, money and an address that isn’t the courier’s.') },
        { cat: 'scam', text: T('WhatsApp da «Marco»: «Scusa, ti è arrivato un codice per sbaglio, me lo giri?»', 'WhatsApp from “Marco”: “Sorry, a code reached you by mistake, can you send it over?”'), why: T('È la truffa del codice: l’account di Marco è già stato rubato. Si chiama Marco al numero che conosci.', 'It’s the code scam: Marco’s account has already been stolen. Call Marco on the number you know.') },
        { cat: 'scam', text: T('Email da PixelArena: «Il tuo account verrà chiuso tra 24 ore. Inserisci qui la password per confermare.»', 'Email from PixelArena: “Your account will be closed in 24 hours. Enter your password here to confirm.”'), why: T('Minaccia, fretta e richiesta di password: nessun gioco chiede la password per email.', 'A threat, a rush and a password request: no game asks for your password by email.') },
        { cat: 'scam', text: T('SMS: «Hai vinto uno smartphone! Rispondi con nome e indirizzo per la consegna.»', 'Text: “You’ve won a smartphone! Reply with your name and address for delivery.”'), why: T('Premio mai cercato e richiesta di dati: è un regalo troppo bello per essere vero.', 'A prize you never entered and a request for details: too good to be true.') },
        { cat: 'ok', text: T('Nell’app ufficiale del gioco, aperta da te: «Nuovo accesso da un altro dispositivo. Sei tu?»', 'In the game’s official app, opened by you: “New login from another device. Is that you?”'), why: T('Arriva dall’app che hai aperto tu. Se non sei tu, rispondi di no, cambia la password e dillo a un adulto.', 'It comes from the app you opened yourself. If it isn’t you, say no, change your password and tell an adult.') },
        { cat: 'ok', text: T('Sul registro elettronico, aperto da te: «Domani uscita didattica, autorizzazione da firmare.»', 'In the school’s online register, opened by you: “School trip tomorrow, permission slip to sign.”'), why: T('Canale ufficiale aperto da te, nessuna fretta strana, nessun link da toccare.', 'An official channel you opened yourself, no strange rush, no link to tap.') },
      ],
    },
    discussion: [
      {
        q: T('Perché quasi tutte le truffe mettono fretta?', 'Why do almost all scams rush you?'),
        a: T('Con la fretta non ci si ferma a controllare. Chi è onesto ti lascia il tempo di verificare.', 'When you rush, you don’t stop to check. Honest people give you time to check.'),
      },
      {
        q: T('Se hai già cliccato o dato un codice, è troppo tardi?', 'If you’ve already tapped or given a code, is it too late?'),
        a: T('No. Si dice subito a un adulto, si cambia la password dall’app ufficiale e si avvisano gli amici. Capita anche agli adulti: non è una colpa, è un trucco ben fatto (tappa 10, «Se succede»).', 'No. Tell an adult straight away, change the password from the official app and warn your friends. It happens to adults too: it isn’t your fault, it’s a well-made trick (stage 10, “If it happens”).'),
      },
      {
        q: T('Cosa vuol dire controllare «da un’altra strada»?', 'What does checking “another way” mean?'),
        a: T('Aprire tu l’app o il sito ufficiale, chiamare l’amico al numero che conosci, chiedere a un adulto. Mai usare il link o il numero scritti nel messaggio sospetto.', 'Opening the official app or site yourself, calling your friend on the number you know, asking an adult. Never using the link or number in the suspicious message.'),
      },
    ],
    ticket: T(
      ['Le tre domande prima di toccare un link:', 'Il codice che arriva sul mio telefono lo do a:', 'A casa insegno la regola del codice a:'],
      ['The three questions before tapping a link:', 'I give the code that arrives on my phone to:', 'At home I’ll teach the code rule to:']
    ),
    adapt: {
      easier: T('Usa quattro carte e lascia le tre domande alla lavagna per tutta la lezione.', 'Use four cards and keep the three questions on the board for the whole lesson.'),
      harder: T('In terza leggete gli indirizzi dei link da destra (la parte prima della prima barra) e scoprite che il numero sul display di una chiamata si può falsificare.', 'With older students read link addresses from the right (the part before the first slash) and discover that a caller’s number on screen can be faked.'),
      inclusion: T('Carte lette ad alta voce in coppia; chi fatica a scrivere può rispondere a voce o con un disegno.', 'Cards read aloud in pairs; anyone who struggles to write can answer aloud or with a drawing.'),
    },
    home: T(
      'Missione: insegnare a qualcuno di casa, magari ai nonni, le tre domande e la regola del codice, e fare insieme la tappa 5 di Primi passi.',
      'Mission: teach someone at home, perhaps a grandparent, the three questions and the code rule, and do stage 5 of First steps together.'
    ),
    civica: T('Traguardo n. 10: accedere alle informazioni e alle fonti «in modo critico, responsabile e consapevole»; traguardo n. 12: salvaguardare la propria e altrui sicurezza negli ambienti digitali.', 'Goal 10: accessing information and sources critically, responsibly and consciously; goal 12: keeping oneself and others safe in digital environments.'),
    digcomp: T('1.2 Valutare dati, informazioni e contenuti digitali · 4.2 Proteggere i dati personali e la privacy', '1.2 Evaluating data, information and digital content · 4.2 Protecting personal data and privacy'),
    sources: [SRC.lineeGuida, SRC.digcomp, SRC.nota5274, PP.SRC.pacco, PP.SRC.geopop, PP.SRC.abi],
  },

  // ------------------------------------------------------------------ kit 5
  {
    n: 5,
    slug: 'vero-o-falso',
    cycle: 'superiori',
    icon: 'newspaper',
    classes: T('Secondaria di secondo grado, classi 1ª–5ª', 'Upper secondary, ages 14–19'),
    stages: ['vero-falso'],
    title: T('Vero o falso nell’era dell’IA', 'True or false in the age of AI'),
    desc: T(
      'Kit 5 di EVIL Scuola, secondaria di secondo grado: fonti ufficiali, video e voci creati con l’intelligenza artificiale (deepfake) e responsabilità di chi condivide. Lezione pronta da 50 minuti.',
      'EVIL for Schools kit 5, upper secondary: official sources, AI-generated videos and voices (deepfakes) and the responsibility of sharing. A ready-made 50-minute lesson.'
    ),
    hook: T('Vedere non basta più: fonti, deepfake e responsabilità di chi condivide.', 'Seeing is no longer enough: sources, deepfakes and the responsibility of sharing.'),
    idea: T('Un video o una voce realistici non sono una prova: prima di credere o condividere mi chiedo chi lo dice, quando e se una fonte ufficiale o indipendente lo conferma. Contro le voci clonate si richiama sul numero noto; diffondere un falso creato con l’IA che danneggia qualcuno non è uno scherzo.', 'A realistic video or voice isn’t proof: before believing or sharing I ask who is saying it, when, and whether an official or independent source confirms it. Against cloned voices, call back on a known number; spreading an AI fake that harms someone is no joke.'),
    goals: T(
      [
        'verificare una notizia con tre controlli: chi è la fonte originale, quando è uscita e se è confermata da canali ufficiali o indipendenti;',
        'spiegare perché «sembra vero» non basta di fronte a video e voci generati con l’IA (deepfake) e come difendersi dalle truffe con voci clonate;',
        'riconoscere la responsabilità personale, etica e legale di chi crea o diffonde contenuti falsificati che danneggiano altre persone.',
      ],
      [
        'check a piece of news with three questions: who the original source is, when it was published, and whether official or independent channels confirm it;',
        'explain why “it looks real” is no longer enough with AI-generated videos and voices (deepfakes) and how to guard against cloned-voice scams;',
        'recognise the personal, ethical and legal responsibility of creating or sharing falsified content that harms other people.',
      ]
    ),
    materials: T(
      [
        'LIM o proiettore con la tappa 9 di Primi passi.',
        'Una copia delle otto carte del gioco per ogni gruppo, ritagliata.',
        'Un biglietto d’uscita per ogni studente.',
        'Nessun telefono degli studenti: si lavora con la LIM e le carte stampate.',
      ],
      [
        'A classroom screen or projector showing stage 9 of First steps.',
        'One set of the eight game cards per group, cut out.',
        'One exit ticket per student.',
        'No student phones: everything works with the classroom screen and printed cards.',
      ]
    ),
    before: T(
      [
        'Stampa la guida, le carte (una copia per gruppo) e i biglietti; ritaglia le carte.',
        'Apri la tappa 9 alla LIM e controlla la scena animata e il livello «Per tecnici».',
        'Leggi i riferimenti su AI Act (art. 50) e art. 612-quater c.p. nelle note della lezione qui sotto.',
      ],
      [
        'Print the guide, the cards (one set per group) and the tickets; cut out the cards.',
        'Open stage 9 on the screen and check the animated scene and the “For techies” tab.',
        'Read the notes on the EU AI Act (Article 50) and Italian Criminal Code Article 612-quater in the lesson plan below.',
      ]
    ),
    plan: [
      {
        from: 0,
        to: 5,
        title: T('Aggancio: perché ci caschiamo anche quando siamo svegli', 'Hook: why smart people still fall for it'),
        text: T('Chiedi qual è l’ultima notizia assurda o il video più sospetto visto girare sui social o nelle chat, senza fare nomi di compagni. Scrivi alla lavagna: «Chi lo dice? Quando? Chi lo conferma?»', 'Ask what the wildest story or most suspicious video they’ve seen going round on social media or group chats was, without naming classmates. Write on the board: “Who says so? When? Who confirms it?”'),
        say: T('«La disinformazione non funziona perché siamo ingenui: funziona perché colpisce rabbia, paura o tifo in mezzo secondo, prima ancora che parta il pensiero critico.»', '“Disinformation doesn’t work because we’re gullible: it works because it triggers anger, fear or bias in half a second, before critical thinking even kicks in.”'),
      },
      {
        from: 5,
        to: 15,
        title: T('Il video della preside e la prova della fonte', 'The head teacher’s video and the source test'),
        text: T('Proietta la tappa 9 di Primi passi: guardate la scena animata, leggi la storia del video della preside e fai votare la classe per alzata di mano prima di aprire le tre scelte. Poi scorrete insieme i punti di «Fai subito».', 'Project stage 9 of First steps: watch the animated scene, read the story about the head teacher’s video and take a show-of-hands vote before opening the three choices. Then go through “Do it now” together.'),
        say: T('«Oggi l’intelligenza artificiale può imitare un volto e una voce in modo molto realistico: “si vede che è lei” non è più una prova. La prova è il canale ufficiale.»', '“Today artificial intelligence can imitate a face and a voice very realistically: ‘you can see it’s her’ is no longer proof. The official channel is the proof.”'),
      },
      {
        from: 15,
        to: 30,
        title: T('Redazione in classe: mi fido o prima verifico?', 'Classroom newsroom: do I trust it or check first?'),
        text: T('Gruppi da 3–4, una copia completa delle otto carte per gruppo. Per dieci minuti ogni gruppo lavora come una redazione e divide le carte nelle due colonne «Mi fido» e «Prima verifico», annotando l’indizio decisivo; negli ultimi cinque minuti ogni gruppo spiega una carta e tu confermi con le risposte della guida.', 'Groups of 3–4, one full set of eight cards per group. For ten minutes each group acts as a newsroom and sorts the cards into “I trust it” and “I check first”, noting the key clue; in the last five minutes each group explains one card and you confirm using the guide.'),
        say: T('«Siete la redazione di un giornale: se pubblicate un falso fate un danno, se controllate la fonte proteggete chi legge. Quale dettaglio vi fa fermare?»', '“You’re a newsroom: if you publish a fake you cause harm, if you check the source you protect your readers. Which detail makes you stop?”'),
      },
      {
        from: 30,
        to: 40,
        title: T('Deepfake, voci clonate e responsabilità di chi condivide', 'Deepfakes, cloned voices and the responsibility of sharing'),
        text: T('Apri alla LIM il livello «Per tecnici» della tappa 9. Spiega come difendersi dalle voci clonate al telefono (chiudere e richiamare sul numero noto; scegliere una parola segreta di famiglia, come consiglia l’FBI) e riassumi il quadro legale: l’obbligo europeo di dichiarare i deepfake (AI Act, art. 50, dal 2 agosto 2026) e, in Italia, il reato per chi diffonde senza consenso immagini, video o voci falsificati con l’IA causando un danno ingiusto (art. 612-quater c.p., legge 132/2025, reclusione da 1 a 5 anni). Distribuisci i biglietti d’uscita.', 'Open the “For techies” tab of stage 9 on the screen. Explain how to defend against cloned voices on the phone (hang up and call back on a known number; agree on a family secret word, as the FBI advises) and sum up the law: the EU duty to disclose deepfakes (AI Act, Article 50, from 2 August 2026) and, in Italy, the criminal offence of spreading AI-falsified images, videos or voices without consent and causing unjust harm (Article 612-quater of the Criminal Code, Law 132/2025, 1 to 5 years’ imprisonment). Hand out the exit tickets.'),
        say: T('«Inoltrare non è mai neutro: chi rilancia un falso diventa il suo megafono. E se quel video o quell’audio finto danneggia una persona, in Italia non è una bravata: è un reato.»', '“Forwarding is never neutral: whoever passes on a fake becomes its megaphone. And if that fake video or audio harms someone, in Italy it isn’t a prank: it’s a crime.”'),
      },
      {
        from: 40,
        to: 47,
        title: T('Discussione', 'Discussion'),
        text: T('Usa due o tre domande qui sotto per far emergere il legame tra verifica tecnica, emozioni e responsabilità verso gli altri.', 'Use two or three of the questions below to connect technical verification, emotions and responsibility towards others.'),
      },
      {
        from: 47,
        to: 50,
        title: T('Chiusura', 'Wrap-up'),
        text: T('Ogni studente completa il biglietto d’uscita. Ricorda la proposta da portare a casa in famiglia.', 'Each student fills in the exit ticket. Remind them of the idea to take home to their family.'),
        say: T('«Prima di toccare “condividi”: se non so chi l’ha detto, quando e se una fonte ufficiale lo conferma, la catena si ferma a me.»', '“Before tapping ‘share’: if I don’t know who said it, when, and whether an official source confirms it, the chain stops with me.”'),
      },
    ],
    game: {
      categories: [
        { id: 'trust', label: T('Mi fido', 'I trust it') },
        { id: 'check', label: T('Prima verifico', 'I check first') },
      ],
      items: [
        { cat: 'check', text: T('Video sui social: la preside annuncia che domani la scuola è chiusa per lavori. La voce e il volto sembrano i suoi, ma sul sito della scuola non c’è nulla.', 'Video on social media: the head teacher announces school is closed tomorrow for repairs. The voice and face look like hers, but there’s nothing on the school website.'), why: T('Un volto e una voce si possono imitare con l’IA: per gli avvisi ufficiali conta il sito o il registro della scuola.', 'A face and a voice can be imitated with AI: for official notices, only the school website or register counts.') },
        { cat: 'trust', text: T('Circolare pubblicata sul sito ufficiale della scuola e sul registro elettronico, aperto da te: «Domani entrata alle 9:00 per assemblea.»', 'Notice published on the school’s official website and in the online register, opened by you: “Tomorrow lessons start at 9:00 due to a staff meeting.”'), why: T('È la fonte primaria e ufficiale, controllata direttamente sul canale dell’istituto.', 'It’s the primary, official source, checked directly on the school’s own channel.') },
        { cat: 'check', text: T('Vocale inoltrato decine di volte nella chat di classe: «È tutto vero, me l’ha girato il cugino di un amico che lavora in ospedale!»', 'Voice note forwarded dozens of times in the class chat: “It’s all true, my friend’s cousin who works at the hospital sent it to me!”'), why: T('Un audio inoltrato a catena senza nome, data né fonte verificabile è il classico passaparola delle bufale.', 'A chain-forwarded voice note with no name, date or checkable source is classic rumour-mill material.') },
        { cat: 'check', text: T('Screenshot di un articolo con un titolo clamoroso, ritagliato senza data, senza autore e senza link alla pagina originale.', 'Screenshot of an article with a sensational headline, cropped with no date, no author and no link to the original page.'), why: T('Uno screenshot si altera in pochi secondi: bisogna cercare il testo originale sul sito della testata.', 'A screenshot can be doctored in seconds: look for the original piece on the publication’s website.') },
        { cat: 'trust', text: T('Avviso di allerta meteo con data e ora di oggi, letto direttamente sul sito istituzionale della Protezione Civile o del tuo Comune.', 'Weather warning with today’s date and time, read directly on the official Civil Protection or municipal website.'), why: T('Ha un ente pubblico responsabile, data e ora precise ed è verificato alla fonte.', 'It has an accountable public body, an exact date and time, and is checked at the source.') },
        { cat: 'check', text: T('Telefonata da un numero sconosciuto: una voce identica a quella di tua madre dice che ha rotto il telefono e chiede subito un bonifico.', 'Call from an unknown number: a voice identical to your mother’s says she broke her phone and asks for an urgent bank transfer.'), why: T('Bastano pochi secondi di audio per clonare una voce con l’IA: si chiude e si richiama sul numero abituale (o si chiede la parola segreta di famiglia).', 'A few seconds of audio are enough to clone a voice with AI: hang up and call back on her usual number (or ask for the family secret word).') },
        { cat: 'check', text: T('Foto drammatica di un incendio in città con 50.000 condivisioni: cercando l’immagine si scopre che è di quattro anni fa, in un altro Paese.', 'Dramatic photo of a city fire with 50,000 shares: a search shows the picture is from four years ago in another country.'), why: T('Una foto vera ma vecchia o fuori contesto inganna quanto un falso: le condivisioni non misurano la verità.', 'A real photo that is old or out of context misleads just like a fake: shares don’t measure truth.') },
        { cat: 'trust', text: T('Rapporto con data di pubblicazione, nota metodologica e dati scaricabili, letto sul portale ufficiale dell’istituto nazionale di statistica.', 'Report with publication date, methodology note and downloadable data, read on the national statistics institute’s official portal.'), why: T('Dichiara chi ha raccolto i dati, quando e con quale metodo, su una fonte istituzionale verificabile.', 'It states who collected the data, when and how, on a verifiable institutional source.') },
      ],
    },
    discussion: [
      {
        q: T('Perché cercare a occhio i difetti di un video (le mani, le ombre, le labbra) non basta più per capire se è fatto con l’IA?', 'Why is spotting visual glitches in a video (hands, shadows, lips) no longer enough to tell if it was made with AI?'),
        a: T('I modelli generativi migliorano continuamente e i difetti visivi spariscono. L’unico controllo che regge nel tempo è fuori dal video: risalire alla fonte originale, alla data, alle credenziali di provenienza (come C2PA) e alle conferme su canali indipendenti.', 'Generative models keep improving and visual glitches fade away. The only check that holds up over time is outside the video: tracing the original source, date, provenance credentials (such as C2PA) and confirmation on independent channels.'),
      },
      {
        q: T('«Non l’ho creato io, l’ho solo inoltrato nel gruppo»: perché questa scusa non regge, né sul piano umano né per la legge?', '“I didn’t make it, I only forwarded it to the group”: why does that excuse fail, both humanly and legally?'),
        a: T('Senza chi inoltra, un falso resta fermo. Chi condivide gli dà visibilità e credibilità davanti ai propri contatti; inoltre, in Italia, l’art. 612-quater c.p. (legge 132/2025) punisce anche chi cede, pubblica o diffonde senza consenso immagini, video o voci falsificati con l’IA che arrecano un danno ingiusto.', 'Without people forwarding it, a fake goes nowhere. Sharing gives it reach and credibility among your contacts; moreover, in Italy, Article 612-quater of the Criminal Code (Law 132/2025) also punishes anyone who passes on, publishes or spreads AI-falsified images, videos or voices without consent, causing unjust harm.'),
      },
      {
        q: T('Dal 2 agosto 2026 l’articolo 50 dell’AI Act europeo obbliga a dichiarare i deepfake. Allora perché dobbiamo continuare a verificare?', 'From 2 August 2026 Article 50 of the EU AI Act requires deepfakes to be disclosed. Why do we still need to check for ourselves?'),
        a: T('Perché la regola vincola chi rispetta la legge, ma chi costruisce una truffa o una campagna di disinformazione non metterà mai il bollino «creato con l’IA». L’etichetta aiuta, ma il filtro finale resta chi legge.', 'Because the rule binds those who follow the law, whereas someone running a scam or a disinformation campaign will never add an “AI-generated” label. Labels help, but the reader remains the final filter.'),
      },
    ],
    ticket: T(
      ['Le tre domande che mi faccio prima di condividere una notizia o un video:', 'Se una voce identica a quella di un familiare mi chiede soldi al telefono, io:', 'Perché «non l’ho creato io, l’ho solo inoltrato» non basta:'],
      ['The three questions I ask before sharing a story or a video:', 'If a voice identical to a family member’s asks me for money on the phone, I:', 'Why “I didn’t make it, I only forwarded it” isn’t good enough:']
    ),
    adapt: {
      easier: T('Nel biennio usa sei carte e tieni scritte alla lavagna per tutta l’ora le tre domande («Chi lo dice? Quando? Chi lo conferma?»).', 'With younger classes use six cards and keep the three questions (“Who says so? When? Who confirms it?”) on the board for the whole lesson.'),
      harder: T('Nel triennio confrontate come funziona la firma di provenienza C2PA (Content Credentials) e analizzate il testo dell’art. 612-quater c.p. e dell’art. 50 dell’AI Act.', 'With older classes compare how C2PA provenance credentials (Content Credentials) work and analyse the text of Article 612-quater of the Italian Criminal Code and Article 50 of the EU AI Act.'),
      inclusion: T('Carte lette e discusse in coppia; possibilità di completare il biglietto d’uscita con parole chiave o mappa schematica.', 'Cards read and discussed in pairs; students can complete the exit ticket using keywords or a short mind map.'),
    },
    home: T(
      'In famiglia, scegliete insieme una «parola segreta di famiglia» (consiglio dell’FBI contro le truffe con voci clonate) da chiedere al telefono nelle emergenze sospette, e provate insieme la tappa 9 di Primi passi.',
      'At home, agree on a “family secret word” together (as the FBI advises against cloned-voice scams) to ask for during suspicious phone emergencies, and try stage 9 of First steps together.'
    ),
    civica: T('Competenze n. 10, 11 e 12 (secondo ciclo): accedere alle informazioni e alle fonti «in modo critico, responsabile e consapevole»; adottare le regole comportamentali proprie di ciascun contesto comunicativo; salvaguardare la propria e altrui sicurezza negli ambienti digitali.', 'Competences 10, 11 and 12 (upper secondary): accessing information and sources critically, responsibly and consciously; following appropriate rules of conduct for each communication context; keeping oneself and others safe in digital environments.'),
    digcomp: T('1.2 Valutare dati, informazioni e contenuti digitali · 2.5 Netiquette · 4.2 Proteggere i dati personali e la privacy', '1.2 Evaluating data, information and digital content · 2.5 Netiquette · 4.2 Protecting personal data and privacy'),
    sources: [SRC.lineeGuida, SRC.digcomp, SRC.nota3392, SRC.legge132, SRC.aiAct, SRC.fbiPsa, PP.SRC.c2pa, PP.SRC.ftcVoice],
  },
];

/** Kit dei prossimi passi: compaiono nella pagina di presentazione come «in preparazione». */
const PLANNED = [];

// i kit su temi delicati stanno in un modulo a parte (da rivedere, decisione D3)
KITS.push(...require('./scuola-kit-delicati')(T, SRC, PP));
KITS.sort((a, b) => a.n - b.n);
for (const k of KITS) k.file = `scuola-${k.slug}.html`;

/** Voci per server/site-map.js */
function sitePages() {
  return [
    { file: PAGE.file, area: 'per-tutti', icon: 'book', nav: true, sitemap: 0.8, title: PAGE.navTitle, desc: PAGE.navDesc },
    ...KITS.map((k) => ({
      file: k.file, area: 'per-tutti', icon: k.icon, nav: false, sitemap: 0.6,
      title: T(`Kit ${k.n}: ${k.title.it}`, `Kit ${k.n}: ${k.title.en}`),
      desc: k.desc,
    })),
  ];
}

module.exports = { T, SRC, PAGE, CYCLES, UI, KITS, PLANNED, sitePages };

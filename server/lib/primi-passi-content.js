'use strict';
/**
 * Primi passi: il percorso da zero dell'area "Per tutti" (docs/evil-per-tutti/PIANO.md, fase 2).
 *
 * Fonte unica dei testi, in italiano e in inglese. scripts/build-primi-passi.js genera da qui
 * html/primi-passi.html, html/pp-<tappa>.html e i dizionari i18n/en/pages/*.json; un test controlla
 * che i file generati siano aggiornati. Regole di scrittura in docs/evil-per-tutti/STILE.md.
 *
 * Ogni fatto che non sia un consiglio di buon senso ha una fonte in `sources` (pagine aperte e
 * verificate il 18 ottobre 2026). Le storie sono inventate; i numeri nelle storie fanno parte del racconto.
 */

const T = (it, en) => ({ it, en });

const SRC = {
  ncsc: { label: T('NCSC (UK), «Three random words», 2016', 'NCSC (UK), “Three random words”, 2016'), url: 'https://www.ncsc.gov.uk/blog-post/three-random-words-or-thinkrandom-0' },
  owaspStuffing: { label: T('OWASP, prevenzione del credential stuffing', 'OWASP, Credential Stuffing Prevention'), url: 'https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html' },
  owaspStorage: { label: T('OWASP, conservazione delle password', 'OWASP, Password Storage'), url: 'https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html' },
  fido: { label: T('FIDO Alliance, passkey', 'FIDO Alliance, passkeys'), url: 'https://fidoalliance.org/passkeys/' },
  rfc6238: { label: T('IETF, RFC 6238 (TOTP), 2011', 'IETF, RFC 6238 (TOTP), 2011'), url: 'https://datatracker.ietf.org/doc/html/rfc6238' },
  geopop: { label: T('Geopop, la truffa del codice WhatsApp, 2025', 'Geopop, the WhatsApp code scam, 2025 (Italian)'), url: 'https://www.geopop.it/e-tornata-la-truffa-del-codice-a-6-cifre-di-whatsapp-come-proteggervi-dal-furto-del-profilo/' },
  abi: { label: T('Vademecum ABI contro le truffe, sintesi QuiFinanza, 2025', 'ABI anti-fraud guide, QuiFinanza summary, 2025 (Italian)'), url: 'https://quifinanza.it/info-utili/truffe-online-telefono-guida-abi-2025/939235/' },
  kev: { label: T('CISA, catalogo KEV', 'CISA, KEV catalog'), url: 'https://www.cisa.gov/known-exploited-vulnerabilities' },
  cisaBackup: { label: T('CISA, backup dei dati (regola 3-2-1)', 'CISA, Back Up Business Data (3-2-1 rule)'), url: 'https://www.cisa.gov/audiences/small-and-medium-businesses/secure-your-business/back-up-business-data' },
  cisaRansom: { label: T('CISA, guida #StopRansomware', 'CISA, #StopRansomware Guide'), url: 'https://www.cisa.gov/stopransomware/ransomware-guide' },
  fbiRansom: { label: T('FBI, ransomware', 'FBI, ransomware'), url: 'https://www.fbi.gov/how-we-can-help-you/scams-and-safety/common-frauds-and-scams/ransomware' },
  pacco: { label: T('Libero, la truffa del pacco in giacenza, 2026', 'Libero, the parcel-on-hold scam, 2026 (Italian)'), url: 'https://www.liberoquotidiano.it/news/italia/47027268/truffe-dei-pacchi-non-ritirati-come-funzionano-davvero-e-perche-sempre-piu-italiani-ci-cascano/' },
  nspcc: { label: T('NSPCC, adescamento', 'NSPCC, grooming'), url: 'https://learning.nspcc.org.uk/safeguarding-child-protection/grooming' },
  postale2025: { label: T('Cybersecurity360, il report 2025 della Polizia Postale, 13 gennaio 2026', 'Cybersecurity360, the Polizia Postale 2025 report, 13 January 2026 (Italian)'), url: 'https://www.cybersecurity360.it/news/report-annuale-polizia-postale-2025-la-normalita-dellattacco-il-dovere-della-resilienza/' },
  sextortion: { label: T('Sky TG24, sextortion: i consigli delle forze dell’ordine, 2025', 'Sky TG24, sextortion: police advice, 2025 (Italian)'), url: 'https://tg24.sky.it/cronaca/2025/06/09/sextortion-cosa-e-come-difendersi' },
  garanteRp: { label: T('Garante privacy, revenge porn', 'Italian Data Protection Authority, intimate images'), url: 'https://www.garanteprivacy.it/it/temi/revengeporn' },
  takeitdown: { label: T('NCMEC, Take It Down', 'NCMEC, Take It Down'), url: 'https://takeitdown.ncmec.org/' },
  legge71: { label: T('Legge 71/2017, scheda dell’Autorità garante per l’infanzia', 'Law 71/2017, Children’s Ombudsman summary (Italian)'), url: 'https://www.garanteinfanzia.org/sites/default/files/scheda_legge_71.pdf' },
  legge70: { label: T('Legge 70/2024, sintesi Studio Cataldi', 'Law 70/2024, Studio Cataldi summary (Italian)'), url: 'https://www.studiocataldi.it/articoli/46838-bullismo-e-cyberbullismo-cosa-prevede-la-legge-702024.asp' },
  dlgs99: { label: T('D.lgs. 99/2025, Normattiva', 'Legislative Decree 99/2025, Normattiva (Italian)'), url: 'https://www.normattiva.it/eli/id/2025/07/01//25G00100/CONSOLIDATED' },
  c2pa: { label: T('C2PA, Content Credentials', 'C2PA, Content Credentials'), url: 'https://c2pa.org/' },
  ftcVoice: { label: T('FTC, voci clonate con l’IA, 2023', 'FTC, AI voice cloning, 2023'), url: 'https://consumer.ftc.gov/node/80688' },
};

const DEPTH = {
  kids: T('Per i più piccoli', 'For little ones'),
  all: T('Per tutti', 'For everyone'),
  tech: T('Per tecnici', 'For techies'),
  deep: T('Per approfondire', 'Go deeper'),
};

// Pagine di EVIL per chi vuole andare oltre (i link diventano /en/… da soli nella versione inglese)
const GO = {
  fondamenti: '/course.html?c=fondamenti',
  difesa: '/course.html?c=difesa-analisi',
  quiz: (cat) => `/quiz-hub.html?cat=${cat}`,
};

/** Pagina di presentazione del percorso (html/primi-passi.html). */
const OVERVIEW = {
  file: 'primi-passi.html',
  metaTitle: T('Primi passi: la sicurezza online da zero, in 10 tappe - EVIL', 'First steps: online safety from scratch, in 10 stages - EVIL'),
  metaDesc: T(
    'Dieci tappe brevi per chi parte da zero: una storia, una cosa da fare subito e un gioco. Password, truffe, privacy, cyberbullismo. Gratis e senza registrarti.',
    'Ten short stages for absolute beginners: a story, one thing to do right away and a game. Passwords, scams, privacy, cyberbullying. Free, no sign-up.'
  ),
  navTitle: T('Primi passi', 'First steps'),
  navDesc: T(
    'La sicurezza online da zero, in 10 tappe brevi: una storia, una cosa da fare subito e un gioco.',
    'Online safety from scratch, in 10 short stages: a story, one thing to do right away and a game.'
  ),
  kicker: T('Per tutti · 10 tappe', 'For everyone · 10 stages'),
  h1: T('Primi passi: la sicurezza online, da zero.', 'First steps: online safety, from scratch.'),
  lead: T(
    'Dieci tappe brevi per chi parte da zero. Ogni tappa è una storia, una cosa da fare subito sul tuo telefono e un gioco. Non serve registrarsi: i progressi restano sul tuo dispositivo.',
    'Ten short stages for absolute beginners. Each stage is a story, one thing to do right away on your phone, and a game. No sign-up needed: your progress stays on your device.'
  ),
  start: T('Inizia dalla tappa 1', 'Start with stage 1'),
  continueTpl: T('Continua dalla tappa {n}', 'Carry on with stage {n}'),
  progress: T('Tappe completate: <b data-pp-count>0</b> di 10', 'Stages completed: <b data-pp-count>0</b> of 10'),
  lightsNote: T('Ogni tappa completata accende una luce.', 'Every stage you complete switches on a light.'),
  howTitle: T('Com’è fatta una tappa', 'What’s in a stage'),
  how: T(
    [
      '<strong>Una storia</strong> di tutti i giorni, con una scelta da fare.',
      '<strong>Una cosa da fare subito</strong>, con il telefono in mano.',
      '<strong>Un gioco</strong> per vedere se hai capito, e un badge.',
      '<strong>Tre livelli</strong> di spiegazione: per i più piccoli, per tutti, per tecnici.',
    ],
    [
      '<strong>An everyday story</strong>, with a choice to make.',
      '<strong>One thing to do right away</strong>, phone in hand.',
      '<strong>A game</strong> to check you’ve got it, and a badge.',
      '<strong>Three levels</strong> of explanation: for little ones, for everyone, for techies.',
    ]
  ),
  forWhomTitle: T('Per chi è', 'Who it’s for'),
  forWhom: T(
    [
      '<strong>Dai 9 anni in su e per gli adulti:</strong> genitori, nonni, chiunque abbia un telefono.',
      '<strong>I più piccoli</strong> lo seguono con un adulto, scegliendo «Per i più piccoli» in ogni tappa.',
      '<strong>Chi studia informatica</strong> trova in ogni tappa la versione «Per tecnici» e i collegamenti ai corsi di EVIL.',
    ],
    [
      '<strong>Ages 9 and up, and adults:</strong> parents, grandparents, anyone with a phone.',
      '<strong>Little ones</strong> follow it with a grown-up, choosing “For little ones” in each stage.',
      '<strong>Computer science students</strong> find a “For techies” version in each stage and links to EVIL’s courses.',
    ]
  ),
  listTitle: T('Le 10 tappe', 'The 10 stages'),
  listLead: T('Puoi seguirle in ordine o saltare a quella che ti serve adesso.', 'Follow them in order or jump to the one you need right now.'),
  minutes: T('{n} minuti', '{n} minutes'),
  stageN: T('Tappa {n}', 'Stage {n}'),
  statusTodo: T('Da fare', 'To do'),
  statusDone: T('Completata', 'Completed'),
  goldTitle: T('Lucciola d’oro!', 'Golden firefly!'),
  goldText: T(
    'Hai acceso tutte e dieci le luci. Adesso sai proteggerti, e sai aiutare chi ti sta vicino.',
    'You’ve switched on all ten lights. Now you know how to protect yourself, and how to help the people around you.'
  ),
  certTitle: T('Il tuo patentino', 'Your certificate'),
  certLead: T(
    'Completa le 10 tappe e stampa il tuo patentino di EVIL. Il nome serve solo per la stampa: non lo salviamo e non lo mandiamo da nessuna parte.',
    'Complete the 10 stages and print your EVIL certificate. The name is only used for printing: we don’t save it or send it anywhere.'
  ),
  certLocked: T('Si sblocca quando completi tutte le tappe.', 'It unlocks when you complete every stage.'),
  certName: T('Il tuo nome (facoltativo)', 'Your name (optional)'),
  certPrint: T('Stampa il patentino', 'Print the certificate'),
  certHeading: T('Patentino di sicurezza digitale', 'Digital safety certificate'),
  certBody: T(
    'ha completato le 10 tappe di Primi passi su EVIL: password e passkey, verifica in due passaggi, aggiornamenti e backup, truffe, privacy, persone online, cyberbullismo, notizie false e piano d’emergenza.',
    'has completed the 10 stages of First steps on EVIL: passwords and passkeys, two-step verification, updates and backups, scams, privacy, people online, cyberbullying, fake news and an emergency plan.'
  ),
  certIssued: T('Rilasciato il {date}', 'Issued on {date}'),
  secretsTitle: T('Badge segreti', 'Secret badges'),
  secretsLead: T('Due badge non si vedono finché non li trovi.', 'Two badges stay hidden until you find them.'),
  goldHow: T('Si accende quando completi tutte le tappe.', 'It lights up when you complete every stage.'),
  explorerName: T('Esploratore', 'Explorer'),
  explorerHow: T(
    'Trova le cinque sorprese di Lù nascoste nel sito. Indizi: Lù è curiosa, certe password non si cercano, una parola accende la luce, i premi troppo belli…',
    'Find Lu’s five surprises hidden around the site. Clues: Lu is curious, some passwords shouldn’t be searched for, one word switches on the light, prizes that are too good…'
  ),
  eggsCount: T('Sorprese trovate: <b data-pp-eggs>0</b> di 5', 'Surprises found: <b data-pp-eggs>0</b> of 5'),
  privacyTitle: T('I tuoi progressi', 'Your progress'),
  privacy: T(
    'Restano solo su questo dispositivo, nel browser: niente account e niente tracciamento. Su un computer condiviso, per esempio a scuola, puoi cancellarli quando vuoi.',
    'It stays only on this device, in the browser: no account and no tracking. On a shared computer, at school for example, you can erase it whenever you like.'
  ),
  resetBtn: T('Ricomincia da zero', 'Start again from scratch'),
  resetConfirm: T('Sicuro? Tocca di nuovo per cancellare i progressi.', 'Sure? Tap again to erase your progress.'),
  resetDone: T('Progressi cancellati: si riparte dalla tappa 1.', 'Progress erased: back to stage 1.'),
  teachersTitle: T('Sei un docente?', 'Are you a teacher?'),
  teachers: T(
    'Ogni tappa funziona anche proiettata alla LIM: la storia si discute in classe, il gioco si fa insieme. Per lezioni complete da 50 minuti, con carte da stampare, c’è <a href="/scuola.html">EVIL Scuola</a>.',
    'Each stage also works on a classroom screen: discuss the story together and play the game as a class. For complete 50-minute lessons with printable cards, there’s <a href="/scuola.html">EVIL for Schools</a>.'
  ),
};

/** Testi comuni delle pagine di tappa. */
const UI = {
  metaTitle: T('{title} · Primi passi, tappa {n} - EVIL', '{title} · First steps, stage {n} - EVIL'),
  kicker: T('Primi passi · Tappa {n} di 10', 'First steps · Stage {n} of 10'),
  minutes: T('{n} minuti', '{n} minutes'),
  trailLabel: T('Le 10 tappe del percorso', 'The 10 stages of the path'),
  trailItem: T('Tappa {n}: {title}', 'Stage {n}: {title}'),
  inThisStage: T('In questa tappa', 'In this stage'),
  sideTitle: T('La tua tappa', 'Your stage'),
  storyTitle: T('La storia', 'The story'),
  sceneLabel: T('La storia in tre immagini', 'The story in three pictures'),
  scenePrev: T('Immagine precedente', 'Previous picture'),
  sceneNext: T('Immagine successiva', 'Next picture'),
  storyHint: T('Apri le risposte e scopri come va a finire.', 'Open the answers and find out how it ends.'),
  verdictGood: T('Ottima scelta', 'Great choice'),
  verdictBad: T('Ripensaci', 'Think again'),
  helpTitle: T('Se sta succedendo a te', 'If this is happening to you'),
  helpText: T(
    'Succede a tante persone e non è colpa tua. Puoi chiamare a qualsiasi ora, oppure aprire <a href="/aiuto.html">Aiuto subito</a>.',
    'It happens to lots of people and it’s not your fault. You can call at any time, or open <a href="/aiuto.html">Get help now</a>.'
  ),
  whyTitle: T('Te lo spieghiamo', 'Let us explain'),
  whyLead: T('Scegli il livello: la verità è la stessa, cambiano le parole.', 'Pick your level: the truth is the same, only the words change.'),
  depthLabel: T('Livello della spiegazione', 'Explanation level'),
  doNowTitle: T('Fai subito', 'Do it now'),
  doNowLead: T('Prendi il telefono: lo facciamo insieme, adesso.', 'Grab your phone: let’s do it together, right now.'),
  doneBtn: T('Ho fatto!', 'Done it!'),
  doneMsg: T('Fatto! Una porta in più chiusa.', 'Done! One more door closed.'),
  gameTitle: T('Il gioco', 'The game'),
  showAnswer: T('Mostra la risposta', 'Show the answer'),
  showSolution: T('Mostra la soluzione', 'Show the solution'),
  check: T('Controlla', 'Check'),
  hint: T('Dammi un aiuto', 'Give me a hint'),
  replay: T('Gioca di nuovo', 'Play again'),
  spotLabel: T('Messaggio da controllare', 'Message to check'),
  badgeTitle: T('Il tuo badge', 'Your badge'),
  badgeLocked: T('Completa il gioco per guadagnarlo.', 'Finish the game to earn it.'),
  badgeUnlocked: T('Guadagnato! Lo ritrovi nella pagina del percorso.', 'Earned! You’ll find it again on the path page.'),
  nextTitle: T('E adesso?', 'What next?'),
  nextGo: T('Vai alla tappa {n}', 'Go to stage {n}'),
  backAll: T('Tutte le tappe', 'All stages'),
  certGo: T('Ritira il tuo patentino', 'Get your certificate'),
  enough: T('Per oggi basta così? Nessun problema: i progressi restano su questo dispositivo.', 'Enough for today? No problem: your progress stays on this device.'),
  learnMore: T('Su EVIL, per chi vuole di più', 'On EVIL, if you want more'),
  sourcesTitle: T('Fonti', 'Sources'),
  sourcesNote: T('Pagine verificate il 18 ottobre 2026.', 'Pages checked on 18 October 2026.'),
  classOn: T('Modalità classe (LIM)', 'Class mode (whiteboard)'),
  classBar: T('Comandi della lezione', 'Lesson controls'),
  classPrev: T('Indietro', 'Back'),
  classNext: T('Avanti', 'Next'),
  classOff: T('Esci', 'Exit'),
};

/**
 * Frasi che il motore dei giochi (js/primi-passi.js) scrive in pagina. Stanno nell'HTML generato
 * (elenco nascosto, data-pp-str), così si traducono con il dizionario della pagina come il resto.
 */
const STRINGS = {
  right: T('Giusto!', 'Right!'),
  almost: T('Quasi! Riprova.', 'Almost! Try again.'),
  orderScore: T('Quasi! Al posto giusto: {ok} su {n}.', 'Almost! In the right place: {ok} of {n}.'),
  selectScore: T('Quasi! Trappole trovate: {found} su {total}.', 'Almost! Traps found: {found} of {total}.'),
  selectExtra: T('Tra le tue scelte c’è anche qualcosa di innocuo.', 'Your picks also include something harmless.'),
  spotFound: T('Trovata! Trappole: {found} su {total}.', 'Got it! Traps: {found} of {total}.'),
  spotMiss: T('Questa parte è normale.', 'This part is normal.'),
  hintTrap: T('Guarda bene qui.', 'Take a close look here.'),
  solved: T('Perfetto! Gioco completato.', 'Perfect! Game complete.'),
  firstTry: T('Al primo colpo: {ok} su {n}.', 'Right first time: {ok} of {n}.'),
  attempts: T('Tentativi: {n}.', 'Attempts: {n}.'),
  stamp: T('Truffa smascherata', 'Scam busted'),
  labelTrap: T('Trappola', 'Trap'),
  labelSafe: T('Innocua', 'Harmless'),
  badgeEarned: T('Badge guadagnato: {badge}', 'Badge earned: {badge}'),
  doneDot: T('{label}, completata', '{label}, completed'),
  moveUp: T('Sposta su', 'Move up'),
  moveDown: T('Sposta giù', 'Move down'),
  moved: T('{item}: posizione {n} di {total}', '{item}: position {n} of {total}'),
  scenePlay: T('Riproduci la storia', 'Play the story'),
  scenePause: T('Metti in pausa', 'Pause'),
  classStep: T('{n} di {total} · {title}', '{n} of {total} · {title}'),
};

const TAPPE = [
  // ------------------------------------------------------------------ 1
  {
    slug: 'cosa-proteggere',
    minutes: 4,
    icon: 'key',
    title: T('Cosa c’è da proteggere', 'What there is to protect'),
    desc: T(
      'Primi passi, tappa 1: cosa c’è dentro il tuo telefono e perché vale molto più di quanto l’hai pagato.',
      'First steps, stage 1: what is inside your phone and why it is worth much more than what you paid for it.'
    ),
    hook: T('Il tuo telefono vale molto più di quanto l’hai pagato. In 4 minuti scopri perché.', 'Your phone is worth much more than what you paid for it. Find out why in 4 minutes.'),
    scene: T(
      ['Nel telefono ci sono le tue foto, le tue chat e il tuo nome.', 'Basta un attimo in mano ad altri: un messaggio parte a tuo nome.', 'Per questo il telefono si blocca e non si presta.'],
      ['Your phone holds your photos, your chats and your name.', 'A moment in someone else’s hands, and a message goes out in your name.', 'That’s why your phone stays locked and isn’t lent out.']
    ),
    story: {
      text: T(
        ['Martina, 12 anni, presta il telefono a un compagno «solo per un attimo».', 'Dieci minuti dopo, nel gruppo della classe compare un messaggio firmato da lei. Ma Martina non l’ha mai scritto.'],
        ['Martina, 12, lends her phone to a classmate “just for a second”.', 'Ten minutes later, a message signed by her appears in the class group chat. But Martina never wrote it.']
      ),
      question: T('Che cosa ha perso Martina, in quei dieci minuti?', 'What did Martina lose in those ten minutes?'),
      choices: [
        {
          text: T('Niente: il telefono gliel’hanno ridato.', 'Nothing: she got the phone back.'),
          outcome: T('Il telefono è tornato, ma nel frattempo qualcuno ha parlato al posto suo, con il suo nome e con i suoi amici.', 'The phone came back, but meanwhile someone spoke in her place, with her name and with her friends.'),
        },
        {
          good: true,
          text: T('Il controllo del suo nome: qualcuno ha parlato al posto suo.', 'Control of her name: someone spoke in her place.'),
          outcome: T('Esatto. Nel telefono ci sono le tue chat, i tuoi amici, le tue foto e il tuo nome: chi lo usa può fingere di essere te.', 'Exactly. Your phone holds your chats, your friends, your photos and your name: whoever uses it can pretend to be you.'),
        },
        {
          text: T('Un po’ di batteria.', 'Some battery.'),
          outcome: T('Forse anche quella. Ma la batteria si ricarica; la fiducia dei compagni è molto più difficile da ricaricare.', 'Maybe that too. But batteries recharge; your classmates’ trust is much harder to recharge.'),
        },
      ],
    },
    why: T(
      [
        'Nel telefono ci sono le tue chiavi: email, social, chat, giochi, a volte anche i soldi.',
        'Chi entra in un tuo account può fingersi te con le persone che ti conoscono.',
        'La buona notizia: bastano poche abitudini per chiudere molte porte, e le impari in queste dieci tappe.',
      ],
      [
        'Your phone holds your keys: email, social media, chats, games, sometimes even money.',
        'Anyone who gets into one of your accounts can pretend to be you with the people who know you.',
        'The good news: a few habits close many doors, and you’ll learn them in these ten stages.',
      ]
    ),
    doNow: {
      title: T('Fai l’elenco delle tue chiavi', 'List your keys'),
      steps: T(
        [
          'Scrivi su carta o nelle note i tuoi 5 account più importanti: di solito email, social, chat, giochi e l’app per pagare.',
          'Metti una stella accanto all’account email: serve a recuperare le password di tutti gli altri, quindi è la chiave più importante.',
          'Tieni la lista: ti servirà nelle prossime tappe.',
        ],
        [
          'Write down, on paper or in your notes, your 5 most important accounts: usually email, social media, chats, games and your payment app.',
          'Put a star next to your email account: it is used to recover the passwords of all the others, so it is your most important key.',
          'Keep the list: you will need it in the next stages.',
        ]
      ),
    },
    game: {
      kind: 'classify',
      title: T('Da tenere per te o da condividere?', 'Keep it to yourself or share it?'),
      intro: T('Per ogni cosa, scegli dove va.', 'For each item, choose where it belongs.'),
      categories: [
        { id: 'mine', label: T('Tienilo per te', 'Keep it to yourself') },
        { id: 'share', label: T('Puoi condividerlo', 'You can share it') },
      ],
      items: [
        { cat: 'mine', text: T('La password del tuo profilo', 'Your profile password'), why: T('Non la deve sapere nessuno, nemmeno il migliore amico.', 'Nobody should know it, not even your best friend.') },
        { cat: 'mine', text: T('Il codice che ti arriva per SMS', 'The code you get by text message'), why: T('Chi te lo chiede sta cercando di entrare in un tuo account.', 'Whoever asks for it is trying to get into one of your accounts.') },
        { cat: 'mine', text: T('Il tuo indirizzo di casa', 'Your home address'), why: T('Online lo leggono anche persone che non conosci.', 'Online, people you don’t know can read it too.') },
        { cat: 'share', text: T('La tua canzone preferita', 'Your favourite song'), why: T('Non dice niente su chi sei né su dove trovarti.', 'It says nothing about who you are or where to find you.') },
        { cat: 'mine', text: T('La tua posizione in tempo reale', 'Your live location'), why: T('Dice a chiunque dove sei, adesso.', 'It tells anyone where you are, right now.') },
        { cat: 'share', text: T('Un disegno che hai fatto tu', 'A drawing you made'), why: T('Le tue creazioni puoi mostrarle: basta che non ci siano dati personali.', 'You can show what you make: just leave out personal details.') },
      ],
    },
    kids: T(
      '<p>Nel telefono ci sono cose preziose: le foto, gli amici, i giochi. Come i giocattoli più belli, non si lasciano in giro.</p><p>Il telefono si presta solo alle persone di casa. E se qualcuno ti chiede un codice o una password, lo dici subito a un adulto.</p>',
      '<p>Your phone holds precious things: photos, friends, games. Like your favourite toys, you don’t leave them lying around.</p><p>Only lend your phone to people at home. And if someone asks you for a code or a password, tell a grown-up straight away.</p>'
    ),
    deepKind: 'tech',
    deep: T(
      '<p>Uno smartphone concentra identità e credenziali: sessioni attive, token salvati, app di autenticazione, codici via SMS. L’account email è il punto di recupero di quasi tutti gli altri: chi lo controlla può reimpostare le password del resto.</p><p>Per questo l’analisi del rischio parte dall’inventario: quali beni proteggere e quali altri dipendono da loro.</p>',
      '<p>A smartphone concentrates identity and credentials: active sessions, saved tokens, authenticator apps, SMS codes. The email account is the recovery point for almost every other account: whoever controls it can reset the others’ passwords.</p><p>That is why risk analysis starts from an inventory: which assets to protect, and which others depend on them.</p>'
    ),
    links: [{ href: GO.fondamenti, label: T('Corso Fondamenti: minacce, vulnerabilità e rischio', 'Foundations course: threats, vulnerabilities and risk') }],
    sources: [],
    badge: T('Custode', 'Keeper'),
    next: T('Prossima tappa: una password che nessuno indovina e che tu ricordi.', 'Next stage: a password nobody can guess and you can remember.'),
  },

  // ------------------------------------------------------------------ 2
  {
    slug: 'password',
    minutes: 4,
    icon: 'lock',
    title: T('Password e passkey', 'Passwords and passkeys'),
    desc: T(
      'Primi passi, tappa 2: perché una password lunga e diversa per ogni account ti protegge anche quando un sito viene violato, e cosa sono le passkey.',
      'First steps, stage 2: why a long password that is different for every account protects you even when a site is breached, and what passkeys are.'
    ),
    hook: T('Una password lunga batte una password complicata. Ti spieghiamo perché in 4 minuti.', 'A long password beats a complicated one. Here’s why, in 4 minutes.'),
    scene: T(
      ['Una sola password per tutto è una chiave che apre ogni porta.', 'Se un sito perde le password, quella chiave finisce in giro.', 'Una chiave diversa per ogni porta: se ne perdi una, le altre restano chiuse.'],
      ['One password for everything is a key that opens every door.', 'If a site leaks its passwords, that key gets passed around.', 'A different key for each door: lose one and the others stay locked.']
    ),
    story: {
      text: T(
        ['Luca usa la stessa password ovunque: il nome del cane e il suo anno di nascita.', 'Un giorno il sito di un videogioco a cui era iscritto subisce un furto di dati. Il giorno dopo qualcuno entra nel suo profilo social.'],
        ['Luca uses the same password everywhere: his dog’s name and the year he was born.', 'One day a video game site he had signed up to has its data stolen. The next day someone gets into his social media profile.']
      ),
      question: T('Come hanno fatto?', 'How did they do it?'),
      choices: [
        {
          text: T('Hanno indovinato la password.', 'They guessed the password.'),
          outcome: T('Non hanno dovuto indovinare niente: la password l’avevano già, presa dai dati rubati al sito del videogioco.', 'They didn’t have to guess anything: they already had it, taken from the data stolen from the game site.'),
        },
        {
          good: true,
          text: T('Hanno provato la password rubata su altri siti, e ha funzionato.', 'They tried the stolen password on other sites, and it worked.'),
          outcome: T('Proprio così. Si chiama credential stuffing: chi ruba le password le prova ovunque. Se ne usi una sola, una falla le apre tutte.', 'Exactly. It’s called credential stuffing: people who steal passwords try them everywhere. If you only use one, one leak opens everything.'),
        },
        {
          text: T('Il social è stato violato.', 'The social network was hacked.'),
          outcome: T('Il social non c’entra: la porta l’ha aperta la password ripetuta.', 'The social network had nothing to do with it: the reused password opened the door.'),
        },
      ],
    },
    why: T(
      [
        'I furti di dati colpiscono siti di ogni tipo: la tua password può finire in una lista senza nessuna colpa tua.',
        'Se la stessa password apre più account, chi la ruba li apre tutti.',
        'Una password lunga e diversa per ogni account, salvata in un gestore di password, ti protegge anche quando un sito viene violato.',
      ],
      [
        'Data breaches hit all kinds of sites: your password can end up on a list through no fault of your own.',
        'If the same password opens several accounts, whoever steals it opens them all.',
        'A long password that is different for every account, saved in a password manager, protects you even when a site is breached.',
      ]
    ),
    doNow: {
      title: T('Rinforza la chiave più importante', 'Strengthen your most important key'),
      steps: T(
        [
          'Apri le impostazioni dell’account email e scegli «Cambia password».',
          'Crea una password con tre o più parole a caso, unite insieme, che non c’entrano con te: niente nomi di familiari o di animali. Non usare l’esempio di questa pagina.',
          'Se il telefono te lo propone, salvala nel gestore di password, oppure crea una passkey.',
        ],
        [
          'Open your email account settings and choose “Change password”.',
          'Create a password from three or more random words joined together that have nothing to do with you: no family or pet names. Don’t use the example on this page.',
          'If your phone offers to, save it in the password manager, or create a passkey.',
        ]
      ),
    },
    game: {
      kind: 'order',
      mono: true,
      title: T('Dalla più debole alla più forte', 'From weakest to strongest'),
      intro: T('Metti in ordine queste password, dalla più facile da scoprire alla più robusta.', 'Put these passwords in order, from the easiest to crack to the strongest.'),
      items: [
        { text: T('123456', '123456'), why: T('È tra le prime che si provano: si scopre in un istante.', 'It’s one of the first ones anyone tries: it’s cracked instantly.') },
        { text: T('Giulia2012', 'Emma2012'), why: T('Un nome e un anno: è il primo schema che si prova.', 'A name and a year: the first pattern anyone tries.') },
        { text: T('G1ul1@2012!', 'Emm@2012!'), why: T('Rispetta le regole dei siti, ma le sostituzioni come @ al posto della a sono prevedibili.', 'It meets site rules, but swaps like @ for a are predictable.') },
        { text: T('tazza-cometa-forbici-neve', 'mug-comet-scissors-snow'), why: T('Quattro parole a caso: lunga, facile da ricordare, difficile da indovinare.', 'Four random words: long, easy to remember, hard to guess.') },
      ],
    },
    kids: T(
      '<p>La password è come la chiave di casa: non si presta, nemmeno all’amico del cuore. La sa solo un adulto di casa.</p><p>Più è lunga, più è difficile da indovinare. Puoi inventarla con il tuo adulto mettendo insieme parole buffe.</p>',
      '<p>A password is like your house key: you don’t lend it, not even to your best friend. Only a grown-up at home knows it.</p><p>The longer it is, the harder it is to guess. You can make one up with your grown-up by putting funny words together.</p>'
    ),
    deepKind: 'tech',
    deep: T(
      '<p>Attacchi: forza bruta, dizionario e soprattutto <strong>credential stuffing</strong>, cioè provare coppie di nome utente e password rubate a un altro sito. Funziona perché le persone riusano le stesse credenziali.</p><p>Lato utente: password uniche generate da un gestore e, dove possibile, <strong>passkey</strong> FIDO: la chiave privata resta sul dispositivo e ogni passkey è legata a un sito, quindi un sito falso non può ottenerla. Lato server: hash lenti con un salt diverso per ogni password; OWASP consiglia Argon2id, poi scrypt, poi bcrypt.</p>',
      '<p>Attacks: brute force, dictionary and above all <strong>credential stuffing</strong>, that is trying username and password pairs stolen from another site. It works because people reuse the same credentials.</p><p>On the user side: unique passwords generated by a manager and, where possible, FIDO <strong>passkeys</strong>: the private key stays on the device and each passkey is bound to one site, so a fake site cannot obtain it. On the server side: slow hashes with a unique salt per password; OWASP recommends Argon2id, then scrypt, then bcrypt.</p>'
    ),
    links: [
      { href: GO.fondamenti, label: T('Corso Fondamenti: password e archiviazione', 'Foundations course: passwords and storage') },
      { href: GO.quiz('passwords-mfa'), label: T('Quiz «Le chiavi del regno»: password e verifica in due passaggi', '“Keys to the Kingdom” quiz: passwords and two-step verification') },
      { href: '/crypto-studio.html', label: T('Studio cifratura: guarda come funziona un hash', 'Cryptography studio: see how a hash works') },
    ],
    sources: [SRC.ncsc, SRC.owaspStuffing, SRC.owaspStorage, SRC.fido],
    badge: T('Fabbro', 'Locksmith'),
    next: T('Prossima tappa: la seconda serratura che lascia fuori anche chi ha la tua password.', 'Next stage: the second lock that keeps out even someone who has your password.'),
  },

  // ------------------------------------------------------------------ 3
  {
    slug: 'due-passaggi',
    minutes: 4,
    icon: 'shield',
    title: T('Verifica in due passaggi', 'Two-step verification'),
    desc: T(
      'Primi passi, tappa 3: la seconda serratura che lascia fuori chi ha rubato la tua password, e la truffa del codice che arriva «per sbaglio».',
      'First steps, stage 3: the second lock that keeps out whoever stole your password, and the scam of the code sent “by mistake”.'
    ),
    hook: T('Anche se rubano la tua password, possono restare fuori. Serve una seconda serratura.', 'Even if they steal your password, they can stay locked out. You need a second lock.'),
    scene: T(
      ['La password è la prima serratura.', 'La seconda chiede un codice che arriva solo sul tuo telefono.', 'Chi ha rubato la password resta fuori.'],
      ['Your password is the first lock.', 'The second asks for a code that only reaches your phone.', 'Whoever stole the password stays locked out.']
    ),
    story: {
      text: T(
        ['Sono le 23. A Sara arriva un SMS con un codice di sei cifre che non ha chiesto.', 'Un minuto dopo le scrive un’amica su WhatsApp: «Scusa, ti ho mandato un codice per sbaglio, me lo rimandi?»'],
        ['It’s 11 pm. Sara gets a text with a six-digit code she didn’t ask for.', 'A minute later a friend messages her on WhatsApp: “Sorry, I sent you a code by mistake, can you send it back?”']
      ),
      question: T('Cosa fa Sara?', 'What does Sara do?'),
      choices: [
        {
          text: T('Lo rimanda: è un’amica.', 'She sends it back: it’s a friend.'),
          outcome: T('Era il codice per spostare il suo WhatsApp su un altro telefono. L’account dell’amica era già stato rubato: ora tocca a quello di Sara.', 'It was the code to move her WhatsApp to another phone. Her friend’s account had already been stolen: now it’s Sara’s turn.'),
        },
        {
          good: true,
          text: T('Non lo manda a nessuno e chiama l’amica per verificare.', 'She doesn’t send it to anyone and calls her friend to check.'),
          outcome: T('Perfetto. Un codice non si gira mai, nemmeno a un amico: e chiamando, Sara scopre che l’amica non le ha mai scritto.', 'Perfect. You never pass on a code, not even to a friend: and by calling, Sara finds out her friend never wrote to her.'),
        },
        {
          text: T('Lo mette nelle storie per chiedere a tutti cos’è.', 'She posts it in her stories to ask everyone what it is.'),
          outcome: T('Un codice mostrato a tutti è un codice regalato: chiunque potrebbe usarlo per primo.', 'A code shown to everyone is a code given away: anyone could use it first.'),
        },
      ],
    },
    why: T(
      [
        'La verifica in due passaggi chiede, oltre alla password, una seconda prova che sei tu: un codice o una conferma sul telefono.',
        'Chi ha rubato la password resta fuori se non ha anche il tuo telefono.',
        'I codici non si danno a nessuno: chi te li chiede, anche con il nome di un amico, sta cercando di entrare nel tuo account.',
      ],
      [
        'Two-step verification asks, on top of your password, for a second proof that it’s you: a code or a confirmation on your phone.',
        'Whoever stole your password stays locked out unless they also have your phone.',
        'Never give codes to anyone: whoever asks for them, even using a friend’s name, is trying to get into your account.',
      ]
    ),
    doNow: {
      title: T('Metti la seconda serratura', 'Add the second lock'),
      steps: T(
        [
          'Nelle impostazioni di sicurezza dell’email cerca «Verifica in due passaggi» o «Autenticazione a due fattori» e attivala.',
          'Se puoi scegliere, preferisci un’app di autenticazione o una passkey; l’SMS va bene se è l’unica scelta.',
          'Fai lo stesso su WhatsApp: Impostazioni › Account › Verifica in due passaggi, e scegli un PIN.',
          'Salva i codici di recupero in un posto sicuro, lontano dal telefono.',
        ],
        [
          'In your email security settings, look for “2-Step Verification” or “Two-factor authentication” and turn it on.',
          'If you can choose, prefer an authenticator app or a passkey; text messages are fine if they’re the only option.',
          'Do the same on WhatsApp: Settings › Account › Two-step verification, and choose a PIN.',
          'Keep your recovery codes somewhere safe, away from your phone.',
        ]
      ),
    },
    game: {
      kind: 'select',
      title: T('Quali richieste sono trappole?', 'Which requests are traps?'),
      intro: T('Seleziona tutte le trappole, poi controlla.', 'Select all the traps, then check.'),
      options: [
        { trap: true, text: T('Un’amica ti chiede di inoltrarle un codice arrivato per SMS.', 'A friend asks you to forward a code that came by text.'), why: T('È la truffa del codice: l’account dell’amica è già stato rubato.', 'It’s the code scam: your friend’s account has already been stolen.') },
        { trap: false, text: T('L’app della banca ti chiede di confermare un accesso che stai facendo tu, adesso.', 'Your banking app asks you to confirm a login you’re doing yourself, right now.'), why: T('Se l’accesso lo stai facendo tu, nell’app ufficiale, è la seconda serratura che funziona.', 'If you’re the one logging in, in the official app, that’s the second lock doing its job.') },
        { trap: true, text: T('Un «operatore» al telefono ti chiede il codice per annullare un pagamento.', 'An “operator” on the phone asks for your code to cancel a payment.'), why: T('Non fidarti di chi ti chiede codici al telefono: chiudi e contatta tu la banca dai canali ufficiali.', 'Don’t trust anyone who asks for codes on the phone: hang up and contact your bank through its official channels.') },
        { trap: false, text: T('Il sito ti chiede il codice che hai appena richiesto tu, sulla pagina che hai aperto tu.', 'The site asks for the code you just requested, on the page you opened yourself.'), why: T('Qui sei tu a usare il codice, sul sito giusto: va bene.', 'Here you’re the one using the code, on the right site: that’s fine.') },
        { trap: true, text: T('Un messaggio dice: «Ti abbiamo mandato un codice per errore, rimandacelo».', 'A message says: “We sent you a code by mistake, please send it back”.'), why: T('Nessuno ha bisogno di farsi rimandare un codice arrivato a te.', 'Nobody needs you to send back a code that was sent to you.') },
      ],
    },
    kids: T(
      '<p>Alcune porte hanno due serrature: la chiave e un codice segreto. Se sul telefono arriva un codice, non si dice a nessuno, nemmeno agli amici.</p><p>Se qualcuno te lo chiede, chiama subito un adulto.</p>',
      '<p>Some doors have two locks: a key and a secret code. If a code arrives on the phone, you don’t tell anyone, not even your friends.</p><p>If someone asks you for it, call a grown-up straight away.</p>'
    ),
    deepKind: 'tech',
    deep: T(
      '<p>Fattori: qualcosa che sai (password), che hai (telefono, chiave di sicurezza), che sei (biometria). Le app di autenticazione generano codici TOTP (RFC 6238) da un segreto condiviso e dall’ora.</p><p>Gli SMS restano esposti al phishing in tempo reale e al furto del numero; le passkey FIDO resistono al phishing perché sono legate al sito.</p>',
      '<p>Factors: something you know (password), something you have (phone, security key), something you are (biometrics). Authenticator apps generate TOTP codes (RFC 6238) from a shared secret and the time.</p><p>SMS codes remain exposed to real-time phishing and number theft; FIDO passkeys resist phishing because they are bound to the site.</p>'
    ),
    links: [
      { href: GO.fondamenti, label: T('Corso Fondamenti: autenticazione a più fattori', 'Foundations course: multi-factor authentication') },
      { href: GO.quiz('passwords-mfa'), label: T('Quiz «Le chiavi del regno»: password e verifica in due passaggi', '“Keys to the Kingdom” quiz: passwords and two-step verification') },
    ],
    sources: [SRC.geopop, SRC.abi, SRC.rfc6238, SRC.fido],
    badge: T('Doppia mandata', 'Double-locked'),
    next: T('Prossima tappa: due abitudini noiose che ti salvano quando qualcosa va storto.', 'Next stage: two boring habits that save you when something goes wrong.'),
  },

  // ------------------------------------------------------------------ 4
  {
    slug: 'aggiornamenti-backup',
    minutes: 4,
    icon: 'archive',
    title: T('Aggiornamenti e backup', 'Updates and backups'),
    desc: T(
      'Primi passi, tappa 4: perché aggiornare il telefono e tenere una copia dei tuoi file ti salva quando qualcosa va storto, anche contro il ransomware.',
      'First steps, stage 4: why updating your phone and keeping a copy of your files saves you when something goes wrong, even against ransomware.'
    ),
    hook: T('Due abitudini noiose che fanno la differenza il giorno in cui qualcosa va storto.', 'Two boring habits that make all the difference on the day something goes wrong.'),
    scene: T(
      ['Gli aggiornamenti chiudono i buchi che conoscono anche i criminali.', 'Il backup mette una copia dei ricordi al sicuro.', 'Se il telefono si rompe, i ricordi tornano sul telefono nuovo.'],
      ['Updates close holes that criminals know about too.', 'A backup puts a copy of your memories somewhere safe.', 'If your phone breaks, your memories come back on the new one.']
    ),
    story: {
      text: T(
        ['Il computer di casa di Ahmed mostra una scritta rossa: tutti i file sono bloccati e qualcuno chiede soldi per sbloccarli.', 'Dentro ci sono le foto delle vacanze, i compiti, i documenti di famiglia.'],
        ['Ahmed’s family computer shows a red message: all the files are locked and someone is demanding money to unlock them.', 'Inside are the holiday photos, homework and family documents.']
      ),
      question: T('Cosa avrebbe salvato le foto?', 'What would have saved the photos?'),
      choices: [
        {
          text: T('Un antivirus più costoso.', 'A more expensive antivirus.'),
          outcome: T('Aiuta, ma da solo non basta: quando i file sono già bloccati, conta avere una copia altrove.', 'It helps, but on its own it isn’t enough: once the files are locked, what matters is having a copy somewhere else.'),
        },
        {
          good: true,
          text: T('Una copia dei file salvata altrove, aggiornata spesso.', 'A copy of the files saved elsewhere, updated often.'),
          outcome: T('Esatto: con un backup recente si ripristina tutto senza pagare nessuno.', 'Exactly: with a recent backup you restore everything without paying anyone.'),
        },
        {
          text: T('Pagare subito.', 'Paying straight away.'),
          outcome: T('Pagare non garantisce di riavere i file e premia chi attacca: lo dice anche l’FBI.', 'Paying doesn’t guarantee you get the files back and it rewards the attackers: the FBI says so too.'),
        },
      ],
    },
    why: T(
      [
        'Gli aggiornamenti chiudono buchi che chi attacca conosce e sfrutta davvero.',
        'Un backup è una copia dei tuoi file in un altro posto: se il telefono si rompe, si perde o viene bloccato, i ricordi restano.',
        'Entrambi si possono rendere automatici: li imposti una volta e lavorano da soli.',
      ],
      [
        'Updates close holes that attackers know about and actually exploit.',
        'A backup is a copy of your files in another place: if your phone breaks, gets lost or gets locked, your memories are safe.',
        'Both can be automatic: you set them up once and they work on their own.',
      ]
    ),
    doNow: {
      title: T('Metti il pilota automatico', 'Switch on autopilot'),
      steps: T(
        [
          'Attiva gli aggiornamenti automatici del telefono e delle app.',
          'Attiva il backup di foto e file nel servizio cloud del telefono o su un disco esterno.',
          'Controlla la data dell’ultimo backup: dovrebbe essere di questa settimana.',
        ],
        [
          'Turn on automatic updates for your phone and your apps.',
          'Turn on backups of photos and files to your phone’s cloud service or to an external drive.',
          'Check the date of the last backup: it should be from this week.',
        ]
      ),
    },
    game: {
      kind: 'classify',
      title: T('Aggiornamento vero o trappola?', 'Real update or trap?'),
      intro: T('Per ogni avviso, decidi: si fa o è una trappola?', 'For each notice, decide: do it, or is it a trap?'),
      categories: [
        { id: 'ok', label: T('Si fa', 'Do it') },
        { id: 'trap', label: T('È una trappola', 'It’s a trap') },
      ],
      items: [
        { cat: 'ok', text: T('Aggiornamento di sicurezza nelle impostazioni del telefono', 'Security update in your phone’s settings'), why: T('È il canale ufficiale: installalo appena puoi.', 'It’s the official channel: install it as soon as you can.') },
        { cat: 'trap', text: T('SMS: «Il tuo telefono è infetto, scarica questa app per pulirlo»', 'Text: “Your phone is infected, download this app to clean it”'), why: T('Un SMS non può sapere se il telefono è infetto: l’app che ti fa scaricare è spesso proprio il problema.', 'A text message can’t know whether your phone is infected: the app it makes you download is often the problem itself.') },
        { cat: 'ok', text: T('Aggiornamento del browser dalle sue impostazioni', 'Browser update from its own settings'), why: T('Il browser si aggiorna da solo o dalle sue impostazioni: va bene.', 'The browser updates itself or from its settings: that’s fine.') },
        { cat: 'trap', text: T('Finestra su un sito: «Il tuo lettore video è vecchio, scarica qui»', 'Pop-up on a website: “Your video player is out of date, download here”'), why: T('I siti non aggiornano i tuoi programmi: è un modo per farti installare qualcosa.', 'Websites don’t update your programs: it’s a way to make you install something.') },
        { cat: 'ok', text: T('Aggiornamento di un’app dallo store ufficiale', 'App update from the official store'), why: T('Lo store ufficiale è il posto giusto per aggiornare le app.', 'The official store is the right place to update apps.') },
      ],
    },
    kids: T(
      '<p>Ogni tanto il telefono ha bisogno di «vitamine»: si chiamano aggiornamenti e lo rendono più forte. Lascia che li faccia un adulto.</p><p>Le foto più belle si mettono anche in un secondo cassetto, così non si perdono mai.</p>',
      '<p>Now and then your phone needs “vitamins”: they’re called updates and they make it stronger. Let a grown-up install them.</p><p>The best photos also go in a second drawer, so they never get lost.</p>'
    ),
    deepKind: 'tech',
    deep: T(
      '<p>Gestione delle patch: CISA mantiene il catalogo KEV, la fonte di riferimento sulle vulnerabilità sfruttate davvero; dare la precedenza a quelle riduce il rischio più in fretta.</p><p>Backup: regola <strong>3-2-1</strong> (tre copie, due tipi di supporto, una fuori sede) e, contro il ransomware, copie offline e cifrate con prove di ripristino regolari, come raccomanda CISA.</p>',
      '<p>Patch management: CISA maintains the KEV catalog, the reference source on vulnerabilities exploited in the wild; prioritising those reduces risk fastest.</p><p>Backups: the <strong>3-2-1</strong> rule (three copies, two types of media, one off-site) and, against ransomware, offline encrypted copies with regular restore tests, as CISA recommends.</p>'
    ),
    links: [
      { href: GO.fondamenti, label: T('Corso Fondamenti: aggiornamenti, backup e ripristino', 'Foundations course: updates, backups and recovery') },
      { href: GO.quiz('malware-ransomware'), label: T('Quiz «Riscatto»: come entrano i malware e come si limita il danno', '“Ransom Note” quiz: how malware gets in and how to limit the damage') },
    ],
    sources: [SRC.kev, SRC.cisaBackup, SRC.cisaRansom, SRC.fbiRansom],
    badge: T('Guardiano dei ricordi', 'Memory keeper'),
    next: T('Prossima tappa: i messaggi che ti mettono fretta, e perché la fretta è proprio il trucco.', 'Next stage: messages that rush you, and why the rush is the trick.'),
  },

  // ------------------------------------------------------------------ 5
  {
    slug: 'truffe',
    minutes: 5,
    icon: 'search',
    title: T('Truffe: SMS, email e telefonate', 'Scams: texts, emails and calls'),
    desc: T(
      'Primi passi, tappa 5: riconoscere SMS, email e telefonate truffa, dal pacco in giacenza al finto operatore della banca, con tre domande.',
      'First steps, stage 5: spotting scam texts, emails and calls, from the parcel on hold to the fake bank operator, with three questions.'
    ),
    hook: T('Molte truffe usano lo stesso trucco: metterti fretta. Alla fine di questa tappa lo riconoscerai al volo.', 'Many scams use the same trick: rushing you. By the end of this stage you’ll spot it instantly.'),
    scene: T(
      ['Di notte arriva un SMS: c’è un pacco da pagare.', 'Lù guarda l’indirizzo del link: non è il sito del corriere.', 'Si controlla dall’app ufficiale. Truffa evitata.'],
      ['A text arrives at night: there’s a parcel to pay for.', 'Lu checks the link’s address: it isn’t the courier’s site.', 'Check it in the official app. Scam avoided.']
    ),
    story: {
      text: T(
        ['Sono le 23. A Giulia arriva un SMS: «Il tuo pacco è in giacenza. Paga 1,99 € di spese entro oggi o verrà rispedito.» Sotto, un link.', 'Giulia aspetta davvero un pacco.'],
        ['It’s 11 pm. Giulia gets a text: “Your parcel is on hold. Pay a €1.99 fee today or it will be sent back.” Below it, a link.', 'Giulia really is waiting for a parcel.']
      ),
      question: T('Cosa fa Giulia?', 'What does Giulia do?'),
      choices: [
        {
          text: T('Paga: sono solo 1,99 €.', 'She pays: it’s only €1.99.'),
          outcome: T('Il link porta a una pagina che imita il corriere e chiede i dati della carta. Non rubano 1,99 €: rubano la carta.', 'The link leads to a page that imitates the courier and asks for card details. They don’t steal €1.99: they steal the card.'),
        },
        {
          good: true,
          text: T('Controlla la spedizione dall’app o dal sito del corriere, aperti da lei.', 'She checks the delivery in the courier’s app or website, opened herself.'),
          outcome: T('Esatto. I corrieri non chiedono pagamenti via SMS per le consegne normali: per verificare, vai tu sul sito ufficiale.', 'Exactly. Couriers don’t ask for payment by text for normal deliveries: to check, go to the official site yourself.'),
        },
        {
          text: T('Risponde all’SMS chiedendo spiegazioni.', 'She replies to the text asking for details.'),
          outcome: T('Rispondere non serve: chi l’ha mandato non è il corriere. Verifica tu dal sito ufficiale.', 'Replying doesn’t help: whoever sent it isn’t the courier. Check on the official site yourself.'),
        },
      ],
    },
    why: T(
      [
        'Le truffe imitano chi conosci: la banca, il corriere, un parente, un’app.',
        'Il trucco è metterti fretta o paura, così non ti fermi a controllare.',
        'La regola d’oro: se c’è fretta e ti chiedono soldi, codici o dati, chiudi e controlla tu, dal sito o dal numero ufficiale.',
      ],
      [
        'Scams imitate people and companies you know: your bank, the courier, a relative, an app.',
        'The trick is to rush or scare you, so you don’t stop to check.',
        'The golden rule: if there’s a rush and they ask for money, codes or details, stop and check yourself, through the official site or number.',
      ]
    ),
    doNow: {
      title: T('Impara le tre domande', 'Learn the three questions'),
      steps: T(
        [
          '<strong>Chi me lo manda davvero?</strong> Guarda il numero, l’indirizzo email, il dominio del link, non solo il nome.',
          '<strong>Mi mette fretta o paura?</strong>',
          '<strong>Mi chiede soldi, codici o dati?</strong> Se rispondi sì anche a una sola domanda, non cliccare: apri tu l’app o il sito ufficiale.',
          'Se ti chiama la «banca», non fidarti del numero sul display, che si può falsificare: chiudi e contatta tu la banca dai canali ufficiali.',
        ],
        [
          '<strong>Who is really sending this?</strong> Look at the number, the email address, the link’s domain, not just the name.',
          '<strong>Is it rushing or scaring me?</strong>',
          '<strong>Is it asking for money, codes or details?</strong> If the answer to even one question is yes, don’t click: open the official app or site yourself.',
          'If the “bank” calls you, don’t trust the number on the screen, which can be faked: hang up and contact the bank through its official channels.',
        ]
      ),
    },
    game: {
      kind: 'spot',
      title: T('Trova le tre trappole', 'Find the three traps'),
      intro: T('Tocca le parti del messaggio che non tornano.', 'Tap the parts of the message that don’t add up.'),
      from: T('SpediLù', 'LuParcel'),
      segments: [
        { text: T('Gentile cliente, il tuo pacco è in giacenza.', 'Dear customer, your parcel is on hold.'), why: T('Una frase normale: le truffe copiano i messaggi veri.', 'A normal sentence: scams copy real messages.') },
        { trap: true, text: T('Paga 1,99 € di spese', 'Pay a €1.99 fee'), why: T('I corrieri non chiedono pagamenti via SMS per le consegne normali.', 'Couriers don’t ask for payment by text for normal deliveries.') },
        { trap: true, text: T('entro 2 ore o verrà distrutto:', 'within 2 hours or it will be destroyed:'), why: T('Fretta e minaccia: servono a non farti pensare.', 'Rush and threat: they’re there to stop you thinking.') },
        { trap: true, mono: true, text: T('https://spedilu.consegna-pacchi.top/paga', 'https://luparcel.parcel-delivery.top/pay'), why: T('Il nome del corriere c’è, ma l’indirizzo finisce con «consegna-pacchi.top»: è un altro sito. Trucco: guarda la parte prima della prima barra singola e leggila da destra.', 'The courier’s name is there, but the address ends in “parcel-delivery.top”: it’s a different site. Tip: look at the part before the first single slash and read it from the right.') },
      ],
    },
    kids: T(
      '<p>Se un messaggio dice «Hai vinto!» o «Corri, presto!», fermati. Prima di toccare qualsiasi cosa, chiedi a un adulto.</p><p>I trucchi più vecchi del mondo funzionano anche online: la fretta e i regali troppo belli.</p>',
      '<p>If a message says “You’ve won!” or “Hurry, quick!”, stop. Before you tap anything, ask a grown-up.</p><p>The oldest tricks in the world work online too: rushing you and gifts that are too good to be true.</p>'
    ),
    deepKind: 'tech',
    deep: T(
      '<p>Phishing (email), smishing (SMS), vishing (voce, anche con numero falsificato: spoofing). Segnali tecnici: un dominio che non corrisponde al mittente, sottodomini ingannevoli, richieste fuori dai canali soliti, urgenza.</p><p>Difese: passkey e chiavi FIDO resistono al phishing; per le email SPF, DKIM e DMARC; segnalare il messaggio alla piattaforma. Su EVIL puoi analizzare un indirizzo sospetto con Check URL.</p>',
      '<p>Phishing (email), smishing (text), vishing (voice, even with a faked caller ID: spoofing). Technical signs: a domain that doesn’t match the sender, misleading subdomains, requests outside the usual channels, urgency.</p><p>Defences: passkeys and FIDO keys resist phishing; SPF, DKIM and DMARC for email; report the message to the platform. On EVIL you can analyse a suspicious address with URL check.</p>'
    ),
    links: [
      { href: GO.quiz('smishing-vishing'), label: T('Quiz «Squilla il sospetto»: SMS e telefonate truffa', '“Suspicious Ring” quiz: scam texts and calls') },
      { href: GO.quiz('phishing-email'), label: T('Quiz «Non abboccare»: le email truffa', '“Don’t Take the Bait” quiz: scam emails') },
      { href: '/security-check.html', label: T('Check URL: analizza un indirizzo sospetto (serve un account)', 'URL check: analyse a suspicious address (account needed)') },
    ],
    sources: [SRC.pacco, SRC.abi, SRC.fido],
    badge: T('Occhio di lince', 'Eagle eye'),
    next: T('Prossima tappa: cosa racconta di te quello che pubblichi, anche quando non lo scrivi.', 'Next stage: what your posts say about you, even when you don’t write it.'),
  },

  // ------------------------------------------------------------------ 6
  {
    slug: 'condividere',
    minutes: 4,
    icon: 'eye',
    title: T('Cosa condivido', 'What I share'),
    desc: T(
      'Primi passi, tappa 6: cosa raccontano di te foto e storie, anche quando non lo scrivi, e come scegliere chi ti vede.',
      'First steps, stage 6: what your photos and stories say about you, even when you don’t write it, and how to choose who sees you.'
    ),
    hook: T('Una foto può dire dove vivi, a che ora esci e dove vai a scuola. Anche se non lo scrivi.', 'A photo can say where you live, when you go out and where you go to school. Even if you don’t write it.'),
    scene: T(
      ['Una foto racconta più di quanto sembra: lo sfondo, il luogo, l’ora.', 'Messi insieme, i dettagli dicono dove trovarti.', 'Posizione spenta e solo gli amici: decidi tu chi ti vede.'],
      ['A photo says more than it seems: the background, the place, the time.', 'Put together, the details say where to find you.', 'Location off and friends only: you decide who sees you.']
    ),
    story: {
      text: T(
        ['Elena pubblica una storia: la divisa della squadra, il cancello della scuola sullo sfondo e la posizione attiva, «così si vede dov’è».', 'Il suo profilo ha 600 follower. Ne conosce davvero una cinquantina.'],
        ['Elena posts a story: her team kit, the school gate in the background and her location switched on, “so people can see where it is”.', 'Her profile has 600 followers. She actually knows about fifty of them.']
      ),
      question: T('Cosa ha raccontato Elena, senza volerlo?', 'What did Elena give away without meaning to?'),
      choices: [
        {
          text: T('Solo che gioca a pallavolo.', 'Only that she plays volleyball.'),
          outcome: T('Anche dove si allena, dove va a scuola e a che ora: basta mettere insieme i dettagli.', 'Also where she trains, where she goes to school and when: you just have to put the details together.'),
        },
        {
          good: true,
          text: T('Dove va a scuola, dove si allena e quando: chiunque tra i follower può ricostruirlo.', 'Where she goes to school, where she trains and when: any of her followers can piece it together.'),
          outcome: T('Esatto. Ogni dettaglio da solo è innocuo; insieme formano una mappa della sua giornata.', 'Exactly. Each detail on its own is harmless; together they make a map of her day.'),
        },
        {
          text: T('Niente: il profilo è privato.', 'Nothing: her profile is private.'),
          outcome: T('Un profilo privato con 600 follower non è così privato: e una storia si può salvare e girare.', 'A private profile with 600 followers isn’t that private: and a story can be saved and passed around.'),
        },
      ],
    },
    why: T(
      [
        'Ogni foto contiene dettagli: luoghi, nomi, divise, orari, a volte la posizione esatta.',
        'Una volta online, un contenuto può essere salvato e girato da chiunque lo veda.',
        'Decidi tu chi ti vede: le impostazioni della privacy sono il tuo cancello.',
      ],
      [
        'Every photo contains details: places, names, uniforms, times, sometimes your exact location.',
        'Once online, content can be saved and shared by anyone who sees it.',
        'You decide who sees you: privacy settings are your gate.',
      ]
    ),
    doNow: {
      title: T('Chiudi il cancello', 'Close the gate'),
      steps: T(
        [
          'Nelle impostazioni del social controlla chi può vedere i tuoi contenuti e chi può scriverti.',
          'Disattiva la posizione nelle foto e nelle storie.',
          'Guarda le tue ultime 5 foto pubblicate: si vedono scuola, via, targa o numero civico? Toglile o nascondile.',
          'Prima di pubblicare la foto di un amico, chiediglielo.',
        ],
        [
          'In your social media settings, check who can see your posts and who can message you.',
          'Turn off location on photos and stories.',
          'Look at your last 5 posted photos: can you see your school, street, number plate or house number? Remove or hide them.',
          'Before posting a photo of a friend, ask them.',
        ]
      ),
    },
    game: {
      kind: 'classify',
      title: T('Lo pubblichi?', 'Would you post it?'),
      intro: T('Per ogni contenuto, decidi.', 'Decide for each post.'),
      categories: [
        { id: 'ok', label: T('Sì, va bene', 'Yes, that’s fine') },
        { id: 'no', label: T('Meglio di no', 'Better not') },
      ],
      items: [
        { cat: 'ok', text: T('Il tramonto visto dalla finestra', 'The sunset from your window'), why: T('Un bel panorama, senza dati personali.', 'A nice view, with no personal details.') },
        { cat: 'no', text: T('Una foto della carta d’identità', 'A photo of your ID card'), why: T('Con i dati di un documento qualcuno può fingersi te.', 'With the details from an ID, someone can pretend to be you.') },
        { cat: 'no', text: T('Una storia con la posizione in tempo reale', 'A story with your live location'), why: T('Dice a tutti dove sei adesso.', 'It tells everyone where you are right now.') },
        { cat: 'ok', text: T('Un disegno o un video che hai fatto tu', 'A drawing or a video you made'), why: T('Le tue creazioni sono tue: mostrale senza dati personali.', 'Your creations are yours: show them without personal details.') },
        { cat: 'no', text: T('La foto di un amico, senza chiedergli il permesso', 'A photo of a friend, without asking them'), why: T('Prima chiedi: la sua immagine è sua.', 'Ask first: their image belongs to them.') },
        { cat: 'no', text: T('Il cancello della scuola con il nome ben visibile', 'The school gate with its name clearly visible'), why: T('Dice dove trovarti ogni mattina.', 'It says where to find you every morning.') },
      ],
    },
    kids: T(
      '<p>Prima di mettere una foto online, chiedi a un adulto. Online non si mettono mai indirizzo, scuola o nome e cognome.</p><p>Le foto degli amici si pubblicano solo se loro dicono di sì.</p>',
      '<p>Before putting a photo online, ask a grown-up. Never put your address, school or full name online.</p><p>Photos of friends only go online if they say yes.</p>'
    ),
    deepKind: 'tech',
    deep: T(
      '<p>OSINT: dettagli dello sfondo, divise, insegne e riflessi permettono di localizzare una foto. I metadati EXIF possono contenere coordinate GPS e modello del dispositivo: molte piattaforme li rimuovono, ma non è garantito per ogni canale.</p><p>Il rischio vero è l’aggregazione: dati innocui da soli diventano un profilo se messi insieme. Su EVIL puoi misurare la tua esposizione nell’area OSINT.</p>',
      '<p>OSINT: background details, uniforms, signs and reflections can be used to locate a photo. EXIF metadata can contain GPS coordinates and the device model: many platforms strip it, but that isn’t guaranteed for every channel.</p><p>The real risk is aggregation: harmless details become a profile once they’re put together. On EVIL you can measure your exposure in the OSINT area.</p>'
    ),
    links: [
      { href: '/osint-hub.html', label: T('OSINT: quanto sei esposto online', 'OSINT: how exposed you are online') },
      { href: GO.quiz('osint-basics'), label: T('Quiz «Fonti aperte»: informazioni pubbliche e limiti etici', '“Open Sources” quiz: public information and ethical limits') },
    ],
    sources: [],
    badge: T('Regista della privacy', 'Privacy director'),
    next: T('Prossima tappa: le persone online non sono sempre chi dicono di essere.', 'Next stage: people online aren’t always who they say they are.'),
  },

  // ------------------------------------------------------------------ 7
  {
    slug: 'persone-online',
    minutes: 5,
    icon: 'radar',
    help: true,
    title: T('Persone online', 'People online'),
    desc: T(
      'Primi passi, tappa 7: i segnali dell’adescamento online e cosa fare se qualcuno ti ricatta con una foto. Con i numeri di chi può aiutarti.',
      'First steps, stage 7: the signs of online grooming and what to do if someone blackmails you with a photo. With the numbers of people who can help.'
    ),
    hook: T('Online è facile fingersi qualcun altro. Ecco i segnali da riconoscere.', 'Online it’s easy to pretend to be someone else. Here are the signs to watch for.'),
    scene: T(
      ['Nel gioco, un profilo nuovo fa regali.', 'Poi chiede segreti e una chat privata.', 'È il momento di parlarne con un adulto di cui ti fidi.'],
      ['In the game, a new profile gives gifts.', 'Then it asks for secrets and a private chat.', 'That’s the moment to talk to an adult you trust.']
    ),
    story: {
      text: T(
        ['In un gioco online, Leo fa amicizia con «Fede, 13 anni». Giocano insieme ogni sera.', 'Dopo qualche settimana Fede gli regala dei crediti per il gioco. Poi gli chiede di passare su un’altra app, «più privata», e di non dirlo a nessuno.'],
        ['In an online game, Leo makes friends with “Fede, 13”. They play together every evening.', 'After a few weeks Fede gives him some in-game credits. Then Fede asks him to move to another app, “more private”, and not to tell anyone.']
      ),
      question: T('Qual è il segnale più importante?', 'What is the most important warning sign?'),
      choices: [
        {
          text: T('I regali: è un po’ troppo gentile.', 'The gifts: Fede is a bit too nice.'),
          outcome: T('Anche i regali sono un segnale, ma il più forte viene dopo: la richiesta di segreto.', 'Gifts are a sign too, but the strongest one comes next: the request for secrecy.'),
        },
        {
          good: true,
          text: T('Il segreto e il passaggio a una chat privata.', 'The secrecy and the move to a private chat.'),
          outcome: T('Proprio così. Chi chiede di spostarsi in privato e di non dirlo a nessuno sta cercando di isolarti. È il momento di parlarne con un adulto.', 'Exactly. Someone who asks you to move somewhere private and to tell no one is trying to isolate you. It’s time to talk to an adult.'),
        },
        {
          text: T('Nessuno: Fede ha 13 anni.', 'None: Fede is 13.'),
          outcome: T('Online l’età si scrive, non si dimostra: chi adesca può fingere di essere più giovane.', 'Online, age is something you type, not something you prove: groomers may pretend to be younger.'),
        },
      ],
    },
    why: T(
      [
        'Chi vuole approfittarsi di un ragazzo può fingersi un coetaneo, fare regali e chiedere di tenere segreti.',
        'Se qualcuno ti chiede foto, segreti o di vedervi di persona, fermati e parlane con un adulto di cui ti fidi.',
        'Se ti ricattano con una foto: non pagare, non cancellare la chat, salva le prove e chiedi aiuto. Non è colpa tua.',
      ],
      [
        'Someone who wants to take advantage of a young person may pretend to be the same age, give gifts and ask for secrets.',
        'If someone asks you for photos, secrets or to meet in person, stop and talk to an adult you trust.',
        'If someone blackmails you with a photo: don’t pay, don’t delete the chat, keep the evidence and ask for help. It’s not your fault.',
      ]
    ),
    doNow: {
      title: T('Prepara il tuo piano', 'Make your plan'),
      steps: T(
        [
          'Scegli un adulto di cui ti fidi, a cui racconteresti qualsiasi cosa.',
          'Salva in rubrica il 114 e il 1.96.96 di Telefono Azzurro.',
          'Controlla chi può scriverti in privato sui social e nei giochi: meglio solo gli amici.',
        ],
        [
          'Pick an adult you trust, someone you’d tell anything.',
          'If you live in Italy, save 114 and Telefono Azzurro’s 1.96.96 in your contacts; elsewhere, save your country’s child helpline.',
          'Check who can message you privately on social media and in games: friends only is best.',
        ]
      ),
    },
    game: {
      kind: 'select',
      title: T('Quali messaggi sono segnali d’allarme?', 'Which messages are warning signs?'),
      intro: T('Seleziona tutti i segnali d’allarme, poi controlla.', 'Select all the warning signs, then check.'),
      options: [
        { trap: true, text: T('«Non dirlo ai tuoi genitori, è un segreto tra noi.»', '“Don’t tell your parents, it’s our secret.”'), why: T('Chiedere segreti serve a isolarti dalle persone che possono aiutarti.', 'Asking for secrets is a way to cut you off from the people who can help you.') },
        { trap: true, text: T('«Mandami una foto, solo per me.»', '“Send me a photo, just for me.”'), why: T('Una foto inviata non si può più riprendere, e può diventare un ricatto.', 'A photo once sent can’t be taken back, and it can become blackmail.') },
        { trap: true, text: T('«Ti regalo dei crediti se passi su un’altra app.»', '“I’ll give you credits if you move to another app.”'), why: T('Regali e chat private sono modi per guadagnare fiducia e isolarti.', 'Gifts and private chats are ways to gain your trust and isolate you.') },
        { trap: false, text: T('«Bella partita! Domani rigiochiamo?»', '“Good game! Play again tomorrow?”'), why: T('Un messaggio normale tra compagni di gioco.', 'A normal message between teammates.') },
        { trap: true, text: T('«Quanti anni hai? In che scuola vai?»', '“How old are you? Which school do you go to?”'), why: T('Da uno sconosciuto, domande così servono a capire chi sei e dove trovarti.', 'From a stranger, questions like these are about finding out who you are and where to find you.') },
      ],
    },
    kids: T(
      '<p>Online ci sono anche persone che dicono bugie su chi sono. Se qualcuno che non conosci ti scrive, ti chiede una foto o di tenere un segreto, dillo subito a un adulto.</p><p>Non ti sgrida nessuno: hai fatto la cosa giusta.</p>',
      '<p>Online there are also people who lie about who they are. If someone you don’t know messages you, asks for a photo or asks you to keep a secret, tell a grown-up straight away.</p><p>Nobody will be cross with you: you did the right thing.</p>'
    ),
    deepKind: 'deep',
    deep: T(
      '<p><strong>Adescamento.</strong> Chi adesca può fingersi più giovane, fare regali e spostare la conversazione su app private o cifrate. Nel 2025 la Polizia Postale ha trattato 428 casi di adescamento online, 174 con vittime tra 10 e 13 anni.</p><p><strong>Sextortion.</strong> È il ricatto con immagini intime: nel 2025 i casi con vittime minorenni sono stati 220, l’87% tra 14 e 17 anni. Le forze dell’ordine consigliano di non pagare, non cancellare i messaggi, salvare le prove e segnalare su commissariatodips.it. Dai 14 anni puoi chiedere al Garante privacy di bloccare la diffusione delle immagini. Per foto e video fatti prima dei 18 anni c’è anche Take It Down, un servizio internazionale gratuito: il file resta sul tuo telefono e viene inviata solo la sua impronta digitale.</p>',
      '<p><strong>Grooming.</strong> Groomers may pretend to be younger, give gifts and move the conversation to private or encrypted apps. In 2025 Italy’s Polizia Postale handled 428 online grooming cases, 174 with victims aged 10 to 13.</p><p><strong>Sextortion.</strong> It’s blackmail using intimate images: in 2025 there were 220 cases with minor victims in Italy, 87% aged 14 to 17. Police advise not paying, not deleting messages, keeping evidence and reporting it (in Italy at commissariatodips.it). In Italy, from 14 you can ask the Data Protection Authority to block the images from spreading. For photos and videos taken before you were 18 there is also Take It Down, a free international service: the file stays on your phone and only its digital fingerprint is sent.</p>'
    ),
    links: [{ href: '/aiuto.html', label: T('Aiuto subito: cosa fare e chi chiamare', 'Get help now: what to do and who to call') }],
    sources: [SRC.nspcc, SRC.postale2025, SRC.sextortion, SRC.garanteRp, SRC.takeitdown],
    badge: T('Radar', 'Radar'),
    next: T('Prossima tappa: quando il gruppo della classe diventa un posto brutto.', 'Next stage: when the class group chat becomes a bad place.'),
  },

  // ------------------------------------------------------------------ 8
  {
    slug: 'cyberbullismo',
    minutes: 4,
    icon: 'heart',
    help: true,
    title: T('Cyberbullismo', 'Cyberbullying'),
    desc: T(
      'Primi passi, tappa 8: riconoscere il cyberbullismo, cosa fare se lo vedi o lo subisci, e i diritti che la legge dà anche ai ragazzi.',
      'First steps, stage 8: recognising cyberbullying, what to do if you see it or it happens to you, and the rights the law gives young people too.'
    ),
    hook: T('Chi guarda può cambiare tutto. Anche tu.', 'Bystanders can change everything. You too.'),
    scene: T(
      ['Nel gruppo della classe gira un meme, e piovono risate.', 'Per chi è preso di mira non è uno scherzo.', 'Un messaggio a Tommaso e un adulto avvisato cambiano le cose.'],
      ['A meme goes round the class group chat, and the laughs pour in.', 'For the person being targeted, it’s no joke.', 'A message to Tommaso and a grown-up in the loop change everything.']
    ),
    story: {
      text: T(
        ['Nel gruppo della classe gira un meme con la faccia di Tommaso. In due ore arrivano quaranta risate.', 'Tommaso non scrive niente da ieri.'],
        ['A meme with Tommaso’s face is going round the class group chat. In two hours it gets forty laughing reactions.', 'Tommaso hasn’t written anything since yesterday.']
      ),
      question: T('Tu sei nel gruppo. Cosa fai?', 'You’re in the group. What do you do?'),
      choices: [
        {
          text: T('Rido anch’io, tanto è uno scherzo.', 'I laugh too, it’s just a joke.'),
          outcome: T('Per chi è preso di mira non è uno scherzo: ogni risata pesa, e chi attacca si sente più forte.', 'For the person being targeted it isn’t a joke: every laugh weighs on them, and the attacker feels stronger.'),
        },
        {
          good: true,
          text: T('Non rido, scrivo in privato a Tommaso e avviso un adulto.', 'I don’t laugh, I message Tommaso privately and tell an adult.'),
          outcome: T('È la mossa che cambia le cose: Tommaso non è più solo e un adulto può intervenire.', 'That’s the move that changes things: Tommaso isn’t alone any more and an adult can step in.'),
        },
        {
          text: T('Esco dal gruppo e basta.', 'I just leave the group.'),
          outcome: T('Uscire ti protegge, ma Tommaso resta solo. Un messaggio a lui e uno a un adulto fanno la differenza.', 'Leaving protects you, but Tommaso is left alone. One message to him and one to an adult make the difference.'),
        },
      ],
    },
    why: T(
      [
        'Cyberbullismo è offendere, minacciare, deridere o isolare qualcuno online, spesso davanti a tante persone.',
        'Chi attacca cerca pubblico: un like o una risata lo fanno sentire più forte.',
        'La legge protegge chi lo subisce: dai 14 anni puoi chiedere da solo di togliere i contenuti, e ogni scuola ha un referente.',
      ],
      [
        'Cyberbullying is insulting, threatening, mocking or isolating someone online, often in front of lots of people.',
        'Attackers want an audience: a like or a laugh makes them feel stronger.',
        'In Italy the law protects the person targeted: from 14 you can ask for content to be removed yourself, and every school has a contact person.',
      ]
    ),
    doNow: {
      title: T('Preparati a essere un alleato', 'Get ready to be an ally'),
      steps: T(
        [
          'Salva tra i preferiti la pagina <a href="/aiuto.html">Aiuto subito</a>.',
          'Scopri chi è il referente per il cyberbullismo della tua scuola: puoi chiederlo a un insegnante.',
          'Scrivi adesso il messaggio che manderesti a un amico preso di mira: «Ho visto. Mi dispiace. Ci sono.»',
        ],
        [
          'Bookmark the <a href="/aiuto.html">Get help now</a> page.',
          'Find out who your school’s cyberbullying contact person is: you can ask a teacher.',
          'Write now the message you’d send a friend who’s being targeted: “I saw it. I’m sorry. I’m here.”',
        ]
      ),
    },
    game: {
      kind: 'classify',
      title: T('Scherzo o cyberbullismo?', 'Joke or cyberbullying?'),
      intro: T('Per ogni situazione, decidi.', 'Decide for each situation.'),
      categories: [
        { id: 'joke', label: T('Scherzo', 'A joke') },
        { id: 'cb', label: T('Cyberbullismo', 'Cyberbullying') },
      ],
      items: [
        { cat: 'cb', text: T('Un meme con la foto di un compagno, girato senza il suo permesso', 'A meme with a classmate’s photo, shared without their permission'), why: T('Usare la faccia di qualcuno per deriderlo davanti a tutti è cyberbullismo.', 'Using someone’s face to mock them in front of everyone is cyberbullying.') },
        { cat: 'joke', text: T('Un soprannome che piace anche a chi lo riceve', 'A nickname the person likes too'), why: T('Se ride anche lui ed è d’accordo, è uno scherzo. Se smette di ridere, non lo è più.', 'If they laugh too and are happy with it, it’s a joke. If they stop laughing, it isn’t any more.') },
        { cat: 'cb', text: T('Escludere sempre la stessa persona dal gruppo della classe', 'Always leaving the same person out of the class group'), why: T('Isolare qualcuno è una forma di cyberbullismo.', 'Isolating someone is a form of cyberbullying.') },
        { cat: 'cb', text: T('Commenti cattivi ripetuti sotto i post di qualcuno', 'Repeated nasty comments under someone’s posts'), why: T('Offese ripetute fanno male anche se sono «solo parole».', 'Repeated insults hurt even if they’re “just words”.') },
        { cat: 'cb', text: T('Creare un profilo falso a nome di un compagno', 'Creating a fake profile in a classmate’s name'), why: T('Il furto d’identità rientra nella definizione di cyberbullismo della legge 71/2017.', 'Identity theft is part of the definition of cyberbullying in Italian Law 71/2017.') },
      ],
    },
    kids: T(
      '<p>Se qualcuno ti prende in giro online o ti fa stare male, non è colpa tua: dillo subito a un adulto.</p><p>E se succede a un amico, stagli vicino e avvisa un grande.</p>',
      '<p>If someone makes fun of you online or makes you feel bad, it’s not your fault: tell a grown-up straight away.</p><p>And if it happens to a friend, stay close to them and tell a grown-up.</p>'
    ),
    deepKind: 'deep',
    deep: T(
      '<p>La legge 71/2017, aggiornata dalla legge 70/2024, prevede un referente in ogni scuola, la richiesta di rimozione dei contenuti al sito o al social e, se non risponde entro 24 ore o non provvede entro 48, al Garante privacy, e l’ammonimento del questore per chi ha più di 14 anni.</p><p>Dal 2025 il 114 Emergenza Infanzia offre anche prima assistenza psicologica e legale a chi subisce bullismo e cyberbullismo (d.lgs. 99/2025).</p>',
      '<p>In Italy, Law 71/2017, updated by Law 70/2024, provides for a contact person in every school, a request to the site or social network to remove content and, if it doesn’t reply within 24 hours or act within 48, to the Data Protection Authority, and a formal police warning for anyone over 14.</p><p>Since 2025 the 114 child emergency line also offers first psychological and legal support to people targeted by bullying and cyberbullying (Legislative Decree 99/2025).</p>'
    ),
    links: [{ href: '/aiuto.html', label: T('Aiuto subito: cosa fare e chi chiamare', 'Get help now: what to do and who to call') }],
    sources: [SRC.legge71, SRC.legge70, SRC.dlgs99],
    badge: T('Alleato', 'Ally'),
    next: T('Prossima tappa: notizie vere, false e fatte con l’intelligenza artificiale.', 'Next stage: true news, fake news and news made with artificial intelligence.'),
  },

  // ------------------------------------------------------------------ 9
  {
    slug: 'vero-falso',
    minutes: 4,
    icon: 'newspaper',
    title: T('Vero o falso', 'True or false'),
    desc: T(
      'Primi passi, tappa 9: notizie false, video e voci creati con l’intelligenza artificiale, e tre domande da farsi prima di condividere.',
      'First steps, stage 9: fake news, videos and voices made with artificial intelligence, and three questions to ask before you share.'
    ),
    hook: T('Un video può essere finto anche quando sembra vero. Tre domande per non farsi ingannare.', 'A video can be fake even when it looks real. Three questions so you don’t get fooled.'),
    scene: T(
      ['Un video sembra vero e fa il giro dei social.', 'Si controlla la fonte: il sito ufficiale della scuola.', 'La fonte ufficiale vince sul video più convincente.'],
      ['A video looks real and spreads across social media.', 'Check the source: the school’s official website.', 'The official source beats the most convincing video.']
    ),
    story: {
      text: T(
        ['Sui social gira un video: la preside annuncia che domani la scuola è chiusa. La voce è la sua, la faccia anche.','In un’ora lo condividono in centinaia.'],
        ['A video is going round on social media: the head teacher announces that school is closed tomorrow. The voice is hers, the face too.', 'Within an hour hundreds of people have shared it.']
      ),
      question: T('Cosa controlli prima di condividerlo?', 'What do you check before sharing it?'),
      choices: [
        {
          text: T('Niente: si vede che è lei.', 'Nothing: you can see it’s her.'),
          outcome: T('Oggi l’intelligenza artificiale può creare voci e volti molto realistici: vedere non basta più.', 'Today artificial intelligence can create very realistic voices and faces: seeing isn’t enough any more.'),
        },
        {
          good: true,
          text: T('Se la notizia c’è anche sul sito o sul registro della scuola.', 'Whether the news is also on the school’s website or online register.'),
          outcome: T('Esatto: la fonte ufficiale vince sul video più convincente.', 'Exactly: the official source beats the most convincing video.'),
        },
        {
          text: T('Quante visualizzazioni ha.', 'How many views it has.'),
          outcome: T('Le visualizzazioni misurano quanto gira una cosa, non se è vera.', 'Views measure how far something spreads, not whether it’s true.'),
        },
      ],
    },
    why: T(
      [
        'Foto, video e voci si possono modificare o creare da zero con l’intelligenza artificiale.',
        'Le notizie false girano veloci perché fanno arrabbiare, ridere o spaventare: prima arriva l’emozione, poi il controllo.',
        'Prima di condividere: chi lo dice, quando, e c’è una fonte ufficiale?',
      ],
      [
        'Photos, videos and voices can be edited or created from scratch with artificial intelligence.',
        'Fake news spreads fast because it makes people angry, laugh or scared: the emotion comes first, the checking later.',
        'Before sharing: who is saying it, when, and is there an official source?',
      ]
    ),
    doNow: {
      title: T('Le domande prima di condividere', 'Questions before you share'),
      steps: T(
        [
          '<strong>Chi lo dice?</strong> Cerca la fonte originale, non lo screenshot.',
          '<strong>Quando?</strong> Una notizia vecchia può tornare a girare come se fosse nuova.',
          '<strong>Lo confermano fonti affidabili?</strong> Se no, aspetta prima di condividere.',
          'Se una voce al telefono chiede soldi a nome di un familiare, chiudi e richiama tu quella persona a un numero che conosci.',
        ],
        [
          '<strong>Who is saying it?</strong> Look for the original source, not the screenshot.',
          '<strong>When?</strong> Old news can start going round again as if it were new.',
          '<strong>Do reliable sources confirm it?</strong> If not, wait before sharing.',
          'If a voice on the phone asks for money on behalf of a family member, hang up and call that person back on a number you know.',
        ]
      ),
    },
    game: {
      kind: 'classify',
      title: T('Fidarsi o verificare?', 'Trust it or check it?'),
      intro: T('Per ogni contenuto, decidi.', 'Decide for each item.'),
      categories: [
        { id: 'trust', label: T('Fonte affidabile', 'Reliable source') },
        { id: 'check', label: T('Da verificare', 'Needs checking') },
      ],
      items: [
        { cat: 'check', text: T('Un video sensazionale senza fonte né data', 'A sensational video with no source or date'), why: T('Senza fonte e senza data non sai da dove viene.', 'Without a source or a date you don’t know where it comes from.') },
        { cat: 'trust', text: T('Un avviso sul sito ufficiale della scuola', 'A notice on the school’s official website'), why: T('È la fonte diretta.', 'It’s the direct source.') },
        { cat: 'check', text: T('Lo screenshot di un articolo, senza link', 'A screenshot of an article, with no link'), why: T('Uno screenshot si modifica in un attimo: cerca l’articolo originale.', 'A screenshot can be edited in a second: look for the original article.') },
        { cat: 'check', text: T('Una notizia di tre anni fa ricondivisa oggi', 'A three-year-old story shared again today'), why: T('Può essere vera ma non attuale.', 'It may be true, but not current.') },
        { cat: 'trust', text: T('Un comunicato pubblicato sul sito di un ministero', 'A statement published on a government ministry’s website'), why: T('È una fonte istituzionale che puoi verificare.', 'It’s an institutional source you can check.') },
      ],
    },
    kids: T(
      '<p>Non tutto quello che si vede online è vero: anche le foto e i video si possono inventare.</p><p>Se una cosa ti sembra strana o ti spaventa, chiedi a un adulto.</p>',
      '<p>Not everything you see online is true: photos and videos can be made up too.</p><p>If something seems strange or scares you, ask a grown-up.</p>'
    ),
    deepKind: 'tech',
    deep: T(
      '<p>Deepfake: volti e voci sintetizzati con modelli generativi. I segnali visivi (artefatti, sincronia delle labbra, luci) da soli non bastano più.</p><p>Verifica: ricerca inversa delle immagini, data e fonte originale, provenienza con lo standard C2PA (Content Credentials) quando c’è, conferma su un canale indipendente. Contro le truffe con voci clonate la FTC consiglia di richiamare la persona a un numero che conosci.</p>',
      '<p>Deepfakes: faces and voices synthesised with generative models. Visual clues (artefacts, lip sync, lighting) are no longer enough on their own.</p><p>Verification: reverse image search, the original date and source, provenance via the C2PA standard (Content Credentials) when present, confirmation through an independent channel. Against cloned-voice scams the FTC advises calling the person back on a number you know.</p>'
    ),
    links: [
      { href: '/news.html', label: T('News di cybersicurezza, ognuna con la sua fonte', 'Cybersecurity news, each with its source') },
      { href: GO.quiz('social-engineering'), label: T('Quiz «Il manipolatore»: fiducia, urgenza e autorità usate contro di te', '“The Manipulator” quiz: trust, urgency and authority used against you') },
    ],
    sources: [SRC.c2pa, SRC.ftcVoice],
    badge: T('Detective', 'Fact checker'),
    next: T('Ultima tappa: il piano per quando qualcosa va storto.', 'Last stage: the plan for when something goes wrong.'),
  },

  // ------------------------------------------------------------------ 10
  {
    slug: 'se-succede',
    minutes: 4,
    icon: 'flag',
    title: T('Se succede', 'If it happens'),
    desc: T(
      'Primi passi, tappa 10: il piano d’emergenza per account rubati, carte usate da altri, foto e minacce. Cosa fare nei primi minuti.',
      'First steps, stage 10: an emergency plan for stolen accounts, misused cards, photos and threats. What to do in the first few minutes.'
    ),
    hook: T('Può capitare anche ai più attenti. Chi ha un piano sa cosa fare nei primi minuti, quelli che contano di più.', 'It can happen to the most careful people. With a plan, you know what to do in the first few minutes, the ones that matter most.'),
    scene: T(
      ['Una sera l’account non si apre più.', 'Si recupera dalla pagina ufficiale e si cambiano le serrature.', 'Poi si avvisano i contatti. Il piano ha funzionato.'],
      ['One evening the account won’t open.', 'Recover it from the official page and change the locks.', 'Then warn your contacts. The plan worked.']
    ),
    story: {
      text: T(
        ['Domenica sera Paolo non riesce più a entrare nella sua email: la password è cambiata.', 'Sul suo profilo compaiono messaggi che non ha mai scritto.'],
        ['On Sunday evening Paolo can’t get into his email any more: the password has been changed.', 'Messages he never wrote are appearing on his profile.']
      ),
      question: T('Cosa fa per primo?', 'What does he do first?'),
      choices: [
        {
          text: T('Crea un nuovo account e lascia perdere quello vecchio.', 'He creates a new account and forgets the old one.'),
          outcome: T('Il vecchio account resta in mano ad altri, con i suoi contatti e i suoi dati: va recuperato.', 'The old account stays in someone else’s hands, with his contacts and his data: it needs to be recovered.'),
        },
        {
          good: true,
          text: T('Usa la procedura di recupero ufficiale e poi avvisa i contatti.', 'He uses the official recovery process and then warns his contacts.'),
          outcome: T('Giusto. Prima riprendi le chiavi, poi avvisi chi potrebbe ricevere messaggi falsi a tuo nome.', 'Right. First take your keys back, then warn anyone who might get fake messages in your name.'),
        },
        {
          text: T('Scrive a chi l’ha rubato chiedendo di restituirglielo.', 'He writes to whoever stole it asking for it back.'),
          outcome: T('Chi ruba un account non lo restituisce: servono le procedure ufficiali.', 'Whoever steals an account doesn’t give it back: you need the official procedures.'),
        },
      ],
    },
    why: T(
      [
        'Nei primi minuti si può limitare il danno: recuperare l’accesso, avvisare, bloccare.',
        'Ogni servizio ha una procedura di recupero ufficiale: la trovi nella pagina di accesso, mai nei link che ricevi.',
        'Chiedere aiuto è la mossa giusta, non una sconfitta.',
      ],
      [
        'In the first few minutes you can limit the damage: get access back, warn people, block things.',
        'Every service has an official recovery process: you find it on its login page, never in links you receive.',
        'Asking for help is the right move, not a defeat.',
      ]
    ),
    doNow: {
      title: T('Il tuo piano d’emergenza', 'Your emergency plan'),
      steps: T(
        [
          '<strong>Account rubato:</strong> recupero dalla pagina ufficiale, nuova password mai usata, verifica in due passaggi, poi avvisa i contatti.',
          '<strong>Carta o conto usati da altri:</strong> contatta subito la banca dai canali ufficiali e blocca la carta; poi denuncia alla Polizia Postale.',
          '<strong>Foto, minacce, ricatti:</strong> salva le prove, parlane con un adulto e apri <a href="/aiuto.html">Aiuto subito</a>.',
        ],
        [
          '<strong>Stolen account:</strong> recover it from the official page, a new password you’ve never used, two-step verification, then warn your contacts.',
          '<strong>Card or account used by someone else:</strong> contact your bank straight away through its official channels and block the card; then report it to the police.',
          '<strong>Photos, threats, blackmail:</strong> keep the evidence, talk to an adult and open <a href="/aiuto.html">Get help now</a>.',
        ]
      ),
    },
    game: {
      kind: 'order',
      title: T('Account rubato: in che ordine?', 'Stolen account: in what order?'),
      intro: T('Metti in ordine le mosse, dalla prima all’ultima.', 'Put the moves in order, from first to last.'),
      items: [
        { text: T('Recupera l’account dalla pagina di accesso ufficiale', 'Recover the account from the official login page'), why: T('Prima di tutto riprendi le chiavi.', 'First of all, take your keys back.') },
        { text: T('Scegli una password nuova, mai usata altrove', 'Choose a new password you’ve never used anywhere else'), why: T('Così chi aveva la vecchia resta fuori.', 'That way whoever had the old one stays out.') },
        { text: T('Attiva la verifica in due passaggi', 'Turn on two-step verification'), why: T('La seconda serratura evita che succeda di nuovo.', 'The second lock stops it happening again.') },
        { text: T('Avvisa i contatti di non fidarsi dei messaggi arrivati a tuo nome', 'Warn your contacts not to trust messages sent in your name'), why: T('Così nessuno ci casca.', 'So nobody falls for them.') },
      ],
    },
    kids: T(
      '<p>Se succede qualcosa di strano con il telefono o con un gioco, non nasconderlo: dillo subito a un adulto.</p><p>Insieme si risolve tutto più in fretta.</p>',
      '<p>If something strange happens with your phone or a game, don’t hide it: tell a grown-up straight away.</p><p>Together you’ll sort it out faster.</p>'
    ),
    deepKind: 'tech',
    deep: T(
      '<p>La risposta a un furto di account, in piccolo: contenimento (recupero, nuova password, chiusura delle sessioni attive, verifica in due passaggi), pulizia (regole di inoltro della posta e app collegate aggiunte dall’intruso), ripristino (backup), lezioni apprese.</p><p>È lo stesso ciclo che si studia nel corso Difesa e analisi, al livello Risposta agli incidenti.</p>',
      '<p>Responding to an account takeover, in miniature: containment (recovery, new password, ending active sessions, two-step verification), clean-up (mail forwarding rules and connected apps added by the intruder), recovery (backups), lessons learned.</p><p>It’s the same cycle you study in the Defence and analysis course, at the Incident response level.</p>'
    ),
    links: [
      { href: GO.difesa, label: T('Corso Difesa e analisi: risposta agli incidenti', 'Defence and analysis course: incident response') },
      { href: GO.quiz('incident-response'), label: T('Quiz «Ora zero»: cosa fare nei primi minuti', '“Hour Zero” quiz: what to do in the first minutes') },
    ],
    sources: [SRC.abi],
    badge: T('Pronto a tutto', 'Ready for anything'),
    next: T('Hai finito il percorso: ritira il tuo patentino!', 'You’ve finished the path: get your certificate!'),
  },
];

TAPPE.forEach((t, i) => {
  t.n = i + 1;
  t.file = `pp-${t.slug}.html`;
});

/** Voci per la mappa del sito (server/site-map.js). */
function sitePages() {
  return [
    {
      file: OVERVIEW.file, area: 'per-tutti', icon: 'route', nav: true, sitemap: 0.9,
      title: OVERVIEW.navTitle, desc: OVERVIEW.navDesc,
    },
    ...TAPPE.map((t) => ({
      file: t.file, area: 'per-tutti', icon: t.icon, nav: false, sitemap: 0.7,
      title: T(`${t.n}. ${t.title.it}`, `${t.n}. ${t.title.en}`),
      desc: t.desc,
    })),
  ];
}

module.exports = { T, SRC, DEPTH, OVERVIEW, UI, STRINGS, TAPPE, sitePages };

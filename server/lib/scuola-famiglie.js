'use strict';
/**
 * EVIL Scuola, passo 3.3: il kit per le famiglie. Una lettera che il docente consegna dopo le
 * lezioni e il «patto del primo telefono» da compilare a casa. Niente numeri inventati (ore,
 * età giuste): le scelte le fa ogni famiglia, il patto aiuta a farle insieme e a scriverle.
 */

const T = (it, en) => ({ it, en });

module.exports = {
  file: 'scuola-famiglie.html',
  navTitle: T('Kit per le famiglie: lettera e patto del primo telefono', 'Family kit: letter and first-phone agreement'),
  desc: T(
    'EVIL Scuola per le famiglie: una lettera da consegnare dopo le lezioni sulla sicurezza online e il patto del primo telefono da compilare insieme a casa. Da stampare, gratis.',
    'EVIL for Schools for families: a letter to hand out after online safety lessons and a first-phone agreement to fill in together at home. Printable and free.'
  ),
  kicker: T('EVIL Scuola · per le famiglie', 'EVIL for Schools · for families'),
  h1: T('La lettera alle famiglie e il patto del primo telefono', 'The letter to families and the first-phone agreement'),
  lead: T(
    'Dopo le lezioni in classe, la sicurezza online continua a casa. Il docente stampa la lettera; la famiglia compila il patto insieme ai ragazzi, con le regole scelte da loro.',
    'After the lessons in class, online safety carries on at home. The teacher prints the letter; the family fills in the agreement with their children, with rules they choose together.'
  ),
  printLetter: T('Stampa la lettera', 'Print the letter'),
  printPact: T('Stampa il patto', 'Print the agreement'),
  forTeachersTitle: T('Per il docente', 'For the teacher'),
  forTeachers: T(
    [
      'Consegna la lettera dopo uno dei kit di EVIL Scuola: scrivi a mano la classe, la data e il kit fatto.',
      'Il patto è facoltativo e resta a casa: non si riporta a scuola e non si valuta.',
      'Se una famiglia ti chiede aiuto per un problema già successo, indicale la pagina Aiuto subito e segui la procedura della scuola.',
    ],
    [
      'Hand out the letter after one of the EVIL for Schools kits: write the class, the date and the kit by hand.',
      'The agreement is optional and stays at home: it isn’t brought back to school and isn’t graded.',
      'If a family asks for help with something that has already happened, point them to the Get help now page and follow your school’s procedure.',
    ]
  ),
  letterTitle: T('Lettera alle famiglie', 'Letter to families'),
  letterHead: T('Classe ______   Data ______   Kit e tappa di Primi passi: ____________________', 'Class ______   Date ______   Kit and First steps stage: ____________________'),
  letter: T(
    [
      'Gentili famiglie,',
      'in classe abbiamo fatto una lezione sulla sicurezza online con i materiali gratuiti di EVIL (projectevil.it). Abbiamo parlato di come proteggere i propri dati, riconoscere le trappole e chiedere aiuto a un adulto quando qualcosa online fa stare male.',
      'Vi chiediamo dieci minuti per continuare a casa: fate insieme ai ragazzi la tappa di Primi passi indicata qui sopra (projectevil.it/primi-passi.html, senza registrazione) e, se volete, compilate il patto del primo telefono che trovate sul sito.',
      'Il messaggio più importante da dare ai ragazzi è questo: se online succede qualcosa che li spaventa o li mette in imbarazzo, possono dirlo a voi senza paura di essere puniti. Raccontarlo è sempre la mossa giusta.',
      'Se è già successo qualcosa, la pagina projectevil.it/aiuto.html spiega cosa fare e chi chiamare. Per qualsiasi dubbio potete rivolgervi a me o al referente della scuola per il bullismo e il cyberbullismo.',
      'Un cordiale saluto,',
    ],
    [
      'Dear families,',
      'in class we had a lesson on online safety using the free materials from EVIL (projectevil.it). We talked about protecting personal information, spotting traps and asking an adult for help when something online makes us feel bad.',
      'We’d ask you for ten minutes to carry on at home: do the First steps stage named above together with your child (projectevil.it/primi-passi.html, no sign-up) and, if you like, fill in the first-phone agreement you’ll find on the site.',
      'The most important message for children is this: if something online scares or embarrasses them, they can tell you without fear of being punished. Telling is always the right move.',
      'If something has already happened, projectevil.it/aiuto.html explains what to do and who to call. For any questions you can contact me or the school’s bullying and cyberbullying contact person.',
      'Kind regards,',
    ]
  ),
  signature: T('Il docente ______________________', 'The teacher ______________________'),
  pactTitle: T('Il patto del primo telefono', 'The first-phone agreement'),
  pactLead: T(
    'Da compilare insieme, a matita: si può cambiare quando si cresce. Le regole valgono per tutti in casa, adulti compresi, dove ha senso.',
    'Fill it in together, in pencil: it can change as you grow up. Where it makes sense, the rules apply to everyone at home, adults included.'
  ),
  pactSections: [
    {
      title: T('Dove e quando', 'Where and when'),
      lines: T(
        ['Di notte il telefono si ricarica in: ______________________', 'A tavola e durante i compiti il telefono: ______________________', 'Nei giorni di scuola lo usiamo al massimo: ______________________'],
        ['At night the phone charges in: ______________________', 'At meals and during homework the phone: ______________________', 'On school days we use it for at most: ______________________']
      ),
    },
    {
      title: T('Le chiavi', 'The keys'),
      lines: T(
        ['Il telefono si blocca con un codice o con l’impronta.', 'Le password non si prestano agli amici; in casa le conosce: ______________________', 'I codici che arrivano per SMS non si danno a nessuno, mai.'],
        ['The phone is locked with a code or a fingerprint.', 'Passwords aren’t lent to friends; at home they’re known by: ______________________', 'Codes that arrive by text are never given to anyone.']
      ),
    },
    {
      title: T('Cosa condivido', 'What I share'),
      lines: T(
        ['Il profilo è privato e la posizione è spenta, salvo con: ______________________', 'Prima di pubblicare una foto di qualcuno, gli chiedo il permesso.', 'Non scrivo online niente che non direi in faccia.'],
        ['The profile is private and location is off, except with: ______________________', 'Before posting a photo of someone, I ask their permission.', 'I don’t write anything online I wouldn’t say to someone’s face.']
      ),
    },
    {
      title: T('Se qualcosa va storto', 'If something goes wrong'),
      lines: T(
        ['Se qualcuno mi chiede segreti, foto o soldi, lo dico a: ______________________', 'Se ho sbagliato o ho cliccato dove non dovevo, lo dico subito: si rimedia insieme.', 'Chi racconta un problema non viene punito per averlo raccontato. Promesso dagli adulti: ______'],
        ['If someone asks me for secrets, photos or money, I tell: ______________________', 'If I made a mistake or tapped something I shouldn’t have, I say so straight away: we fix it together.', 'Nobody is punished for telling us about a problem. Promised by the adults: ______']
      ),
    },
  ],
  pactSign: T('Firme: ______________________   ______________________   Data: ________', 'Signed: ______________________   ______________________   Date: ________'),
  pactNext: T('Ne riparliamo il: ________', 'We’ll talk about it again on: ________'),
};

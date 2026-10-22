'use strict';
/**
 * EVIL Scuola: i tre kit su temi delicati (adescamento, cyberbullismo, immagini intime).
 * Stesso formato dei kit in scuola-content.js. Restano "da rivedere" (`sensitive: true`) finché
 * un esperto di ascolto e tutela dei minori non li approva (decisione D3 in PIANO.md).
 *
 * Regole: niente dettagli espliciti, mai colpa a chi subisce, si parla di personaggi inventati e
 * mai dei compagni, ogni rischio insieme a cosa fare e a chi chiedere aiuto. Fatti e leggi da
 * docs/evil-per-tutti/fonti/FASE3.md e dalle tappe 7 e 8 di Primi passi.
 */

module.exports = function delicateKits(T, SRC, PP) {
  const codiceRosso = { label: T('Legge 69/2019 (art. 612-ter c.p.), Gazzetta Ufficiale', 'Law 69/2019 (Article 612-ter of the Criminal Code), Official Journal (Italian)'), url: 'https://www.gazzettaufficiale.it/eli/id/2019/07/25/19G00076/sg' };

  const postale = { label: T('Polizia Postale, commissariato di PS online', 'Polizia Postale, online police station (Italian)'), url: 'https://www.commissariatodips.it/' };

  return [
    // ------------------------------------------------------------------ kit 2
    {
      n: 2,
      slug: 'lo-dico-a-un-adulto',
      cycle: 'primaria',
      icon: 'heart',
      sensitive: true,
      classes: T('Primaria, classi 3ª–5ª', 'Primary, ages 8–10'),
      stages: ['persone-online', 'cyberbullismo'],
      title: T('Lo dico a un adulto', 'I tell a grown-up'),
      desc: T(
        'Kit 2 di EVIL Scuola, primaria: segreti che pesano, regali da sconosciuti e messaggi che fanno stare male. Lezione pronta da 50 minuti per imparare a chiedere aiuto.',
        'EVIL for Schools kit 2, primary: secrets that feel heavy, gifts from strangers and messages that hurt. A ready-made 50-minute lesson on asking for help.'
      ),
      hook: T('Segreti che pesano, regali da sconosciuti, messaggi che fanno stare male: si dice a un adulto. Non è fare la spia, è chiedere aiuto.', 'Secrets that feel heavy, gifts from strangers, messages that hurt: you tell a grown-up. It isn’t telling tales, it’s asking for help.'),
      idea: T('Se qualcosa online mi fa stare male, o qualcuno mi chiede un segreto, lo dico a un adulto di cui mi fido. Non è colpa mia e nessuno mi sgrida: ho fatto la cosa giusta.', 'If something online makes me feel bad, or someone asks me to keep a secret, I tell an adult I trust. It isn’t my fault and nobody will be cross with me: I did the right thing.'),
      goals: T(
        [
          'distinguere una sorpresa, che finisce e fa felici, da un segreto che pesa e che qualcuno chiede di tenere per sempre;',
          'riconoscere tre segnali online: regali da chi non si conosce, richiesta di segreti o di foto, messaggi che fanno stare male;',
          'dire chi sono i loro adulti di fiducia e quale frase usare per chiedere aiuto.',
        ],
        [
          'tell a surprise, which ends and makes people happy, from a heavy secret that someone wants kept for ever;',
          'recognise three online signs: gifts from people they don’t know, requests for secrets or photos, messages that make them feel bad;',
          'name their trusted adults and the words to use when asking for help.',
        ]
      ),
      materials: T(
        [
          'LIM o proiettore con la tappa 7 di Primi passi, livello «Per i più piccoli».',
          'Una copia delle carte del gioco per ogni gruppo, ritagliata.',
          'Un biglietto d’uscita per ogni studente e un foglio bianco per la «mano della fiducia».',
        ],
        [
          'A classroom screen or projector showing stage 7 of First steps, “For little ones” level.',
          'One set of game cards per group, cut out.',
          'One exit ticket per student and a blank sheet for the “trust hand”.',
        ]
      ),
      before: T(
        [
          'Parlane prima con il referente per il bullismo e il cyberbullismo della scuola e, se lo ritieni utile, avvisa le famiglie.',
          'Pensa se in classe c’è chi sta vivendo una situazione simile: in quel caso concorda la lezione con il referente.',
          'Stampa la guida, le carte e i biglietti; tieni a portata di mano i numeri di aiuto qui sotto.',
        ],
        [
          'Talk to the school’s bullying and cyberbullying contact person first and, if useful, let families know.',
          'Consider whether anyone in the class is going through something similar: if so, plan the lesson with the contact person.',
          'Print the guide, the cards and the tickets; keep the help numbers below to hand.',
        ]
      ),
      plan: [
        {
          from: 0,
          to: 5,
          title: T('Aggancio: sorpresa o segreto?', 'Hook: surprise or secret?'),
          text: T('Dai le regole della lezione: si parla dei personaggi, non dei compagni, e nessuno deve raccontare cose sue. Poi leggi due esempi e chiedi qual è la differenza.', 'Set the ground rules: we talk about the characters, not classmates, and nobody has to share anything about themselves. Then read two examples and ask what the difference is.'),
          say: T('«La festa a sorpresa per la nonna: domani lo sapranno tutti ed è una gioia. Uno sconosciuto che dice “questa cosa resta tra noi, non dirlo ai tuoi”: questo è un segreto che pesa. Le sorprese finiscono, i segreti che pesano no.»', '“A surprise party for Grandma: tomorrow everyone will know and it’s a joy. A stranger saying ‘this stays between us, don’t tell your parents’: that’s a heavy secret. Surprises end; heavy secrets don’t.”'),
        },
        {
          from: 5,
          to: 15,
          title: T('La storia di Leo', 'Leo’s story'),
          text: T('Proietta la tappa 7 con il livello «Per i più piccoli»: guardate la scena e leggi la storia. La classe vota quale sia il segnale più importante, poi aprite le risposte.', 'Project stage 7 at the “For little ones” level: watch the scene and read the story. The class votes on the most important warning sign, then open the answers.'),
          say: T('«Quando qualcuno ti chiede di non dirlo a nessuno, è proprio il momento di dirlo.»', '“When someone asks you not to tell anyone, that’s exactly the moment to tell.”'),
        },
        {
          from: 15,
          to: 30,
          title: T('Gioco a gruppi: va tutto bene o lo dico?', 'Group game: all fine, or do I tell?'),
          text: T('Gruppi da 3–4: dividono le carte nelle due colonne. Poi ogni gruppo legge una carta e tu dai la risposta con il suo perché. Sottolinea che dirlo non mette nessuno nei guai: serve a farsi aiutare.', 'Groups of 3–4 sort the cards into the two columns. Then each group reads one card and you give the answer with its reason. Stress that telling doesn’t get anyone into trouble: it’s how you get help.'),
          say: T('«Se un messaggio ti fa stare male, non è uno scherzo. E se hai un dubbio, puoi sempre chiedere a un adulto: è a questo che servono gli adulti.»', '“If a message makes you feel bad, it isn’t a joke. And if you’re not sure, you can always ask a grown-up: that’s what grown-ups are for.”'),
        },
        {
          from: 30,
          to: 42,
          title: T('La mano della fiducia', 'The trust hand'),
          text: T('Distribuisci i fogli bianchi e i biglietti. Sul foglio ognuno ricalca la propria mano e scrive su ogni dito un adulto di cui si fida: a casa, a scuola, fuori. Nel palmo scrive la frase per chiedere aiuto. Ricorda che va bene scegliere anche adulti della scuola e che c’è un numero gratuito per i ragazzi, il 1.96.96.', 'Hand out the blank sheets and the tickets. On the sheet everyone traces their hand and writes on each finger an adult they trust: at home, at school, elsewhere. In the palm they write the words for asking help. Remind them that school adults count too and that in Italy there is a free number for young people, 1.96.96.'),
          say: T('«La frase è: “Mi è successa una cosa online e voglio parlartene.” Basta questa: al resto pensa l’adulto.»', '“The words are: ‘Something happened online and I want to talk to you about it.’ That’s all you need: the grown-up does the rest.”'),
        },
        {
          from: 42,
          to: 48,
          title: T('Discussione', 'Discussion'),
          text: T('Usa le domande qui sotto. Ascolta senza chiedere esperienze personali.', 'Use the questions below. Listen without asking for personal experiences.'),
        },
        {
          from: 48,
          to: 50,
          title: T('Chiusura', 'Wrap-up'),
          text: T('Ripetete insieme l’idea della lezione. La mano della fiducia si porta a casa.', 'Repeat the lesson’s idea together. The trust hand goes home.'),
          say: T('«Se qualcosa online mi fa stare male o mi chiede un segreto, lo dico a un adulto di cui mi fido.»', '“If something online makes me feel bad or asks me for a secret, I tell an adult I trust.”'),
        },
      ],
      game: {
        categories: [
          { id: 'ok', label: T('Va tutto bene', 'All fine') },
          { id: 'tell', label: T('Lo dico a un adulto', 'I tell a grown-up') },
        ],
        items: [
          { cat: 'ok', text: T('Un compagno scrive: «Domani porti le figurine?»', 'A classmate writes: “Bringing your stickers tomorrow?”'), why: T('Un messaggio normale tra amici.', 'A normal message between friends.') },
          { cat: 'tell', text: T('Un giocatore che non conosci ti regala monete del gioco e vuole diventare tuo «amico segreto»', 'A player you don’t know gives you game coins and wants to be your “secret friend”'), why: T('Regali e segreti da chi non conosci sono un segnale: si dice a un adulto.', 'Gifts and secrets from someone you don’t know are a warning sign: tell a grown-up.') },
          { cat: 'tell', text: T('Nel gruppo della classe prendono in giro un compagno con una foto', 'In the class group chat they make fun of a classmate with a photo'), why: T('Chi viene preso in giro sta male: avvisare un adulto lo aiuta.', 'The person being mocked feels bad: telling a grown-up helps them.') },
          { cat: 'ok', text: T('La nonna ti manda il video del suo gatto', 'Grandma sends you a video of her cat'), why: T('Un messaggio da una persona di famiglia: va tutto bene.', 'A message from family: all fine.') },
          { cat: 'tell', text: T('Qualcuno online ti chiede una foto e dice di non dirlo ai tuoi genitori', 'Someone online asks you for a photo and says not to tell your parents'), why: T('Foto e segreti chiesti online sono un segnale forte: lo dici subito a un adulto.', 'Photos and secrets asked for online are a strong warning sign: tell a grown-up straight away.') },
          { cat: 'ok', text: T('La maestra mette i compiti sulla piattaforma della scuola', 'The teacher posts homework on the school platform'), why: T('È il canale della scuola, usato dagli adulti che conosci.', 'It’s the school’s channel, used by adults you know.') },
          { cat: 'tell', text: T('Un amico ti scrive cose cattive e poi dice «era solo uno scherzo», ma tu stai male', 'A friend writes nasty things, then says “just joking”, but you feel bad'), why: T('Se ti fa stare male, non è uno scherzo: puoi parlarne con un adulto.', 'If it makes you feel bad, it isn’t a joke: you can talk to a grown-up.') },
          { cat: 'tell', text: T('Un messaggio dice: «Hai vinto un telefono! Tocca qui»', 'A message says: “You’ve won a phone! Tap here”'), why: T('Prima di toccare qualsiasi cosa, chiedi a un adulto.', 'Before tapping anything, ask a grown-up.') },
        ],
      },
      discussion: [
        {
          q: T('Perché chi vuole fare del male chiede di tenere un segreto?', 'Why does someone who wants to do harm ask you to keep a secret?'),
          a: T('Perché sa che un adulto lo fermerebbe. Il segreto serve a tenerti lontano da chi ti può aiutare.', 'Because they know a grown-up would stop them. The secret is meant to keep you away from the people who can help you.'),
        },
        {
          q: T('Se hai già fatto quello che ti avevano chiesto, è troppo tardi per dirlo?', 'If you’ve already done what they asked, is it too late to tell?'),
          a: T('No, mai. Non è colpa tua e nessuno ti sgrida: gli adulti sono lì per aiutare.', 'No, never. It isn’t your fault and nobody will be cross: grown-ups are there to help.'),
        },
        {
          q: T('Cosa fai se un amico ti racconta che gli è successo?', 'What do you do if a friend tells you it happened to them?'),
          a: T('Lo ascolti, gli dici che ha fatto bene a dirtelo e lo aiuti a parlarne con un adulto, anche andandoci insieme.', 'You listen, tell them they were right to tell you, and help them talk to a grown-up, even going together.'),
        },
      ],
      ticket: T(
        ['Una sorpresa è diversa da un segreto che pesa perché:', 'Se qualcosa online mi fa stare male, lo dico a:', 'La frase per chiedere aiuto:'],
        ['A surprise is different from a heavy secret because:', 'If something online makes me feel bad, I tell:', 'The words for asking for help:']
      ),
      adapt: {
        easier: T('In terza usa sei carte e leggile tu; la mano della fiducia si può disegnare senza scrivere.', 'With younger children use six cards and read them yourself; the trust hand can be drawn without writing.'),
        harder: T('In quinta aggiungete il caso dell’amico: cosa gli scriveresti per convincerlo a parlarne con un adulto?', 'With older children add the friend’s case: what would you write to persuade them to talk to a grown-up?'),
        inclusion: T('Chi non vuole scrivere nomi può disegnare le persone; nessuno deve mostrare la propria mano agli altri.', 'Anyone who doesn’t want to write names can draw the people; nobody has to show their hand to others.'),
      },
      home: T(
        'La mano della fiducia va a casa: con un adulto di casa si guarda insieme e si salva in rubrica il 114 e il 1.96.96. Poi, insieme, la tappa 7 di Primi passi con il livello «Per i più piccoli».',
        'The trust hand goes home: look at it with a grown-up and save the local child helpline numbers together (in Italy 114 and 1.96.96). Then do stage 7 of First steps together at the “For little ones” level.'
      ),
      civica: T('Traguardo n. 11 (interagire con gli altri rispettando le regole di ciascun contesto) e n. 12 (salvaguardare la propria e altrui sicurezza, evitando minacce al benessere fisico e psicologico).', 'Goal 11 (interacting with others following the rules of each context) and goal 12 (keeping oneself and others safe and avoiding threats to physical and psychological wellbeing).'),
      digcomp: T('2.1 Interagire con gli altri attraverso le tecnologie · 4.3 Proteggere la salute e il benessere', '2.1 Interacting through digital technologies · 4.3 Protecting health and well-being'),
      sources: [SRC.lineeGuida, SRC.digcomp, SRC.orientamento, PP.SRC.nspcc, PP.SRC.postale2025],
    },

    // ------------------------------------------------------------------ kit 3
    {
      n: 3,
      slug: 'il-gruppo-della-classe',
      cycle: 'media',
      icon: 'heart',
      sensitive: true,
      classes: T('Secondaria di primo grado, classi 1ª–3ª', 'Lower secondary, ages 11–14'),
      stages: ['cyberbullismo', 'condividere'],
      title: T('Il gruppo della classe', 'The class group chat'),
      desc: T(
        'Kit 3 di EVIL Scuola, secondaria di primo grado: cyberbullismo nel gruppo della classe, il ruolo di chi assiste e cosa prevede la legge. Lezione pronta da 50 minuti.',
        'EVIL for Schools kit 3, lower secondary: cyberbullying in the class group chat, the bystander’s role and what the law says. A ready-made 50-minute lesson.'
      ),
      hook: T('Nel gruppo nessuno è spettatore: ogni risata pesa, ma anche ogni messaggio di sostegno.', 'In the group nobody is just watching: every laugh weighs, but so does every message of support.'),
      idea: T('Se nel gruppo qualcuno viene preso di mira non rido e non inoltro, scrivo in privato a chi è preso di mira e avviso un adulto. A scuola c’è un referente, e la legge protegge chi lo subisce.', 'If someone is targeted in the group I don’t laugh and I don’t forward, I message the person privately and I tell an adult. In Italy every school has a contact person, and the law protects whoever is targeted.'),
      goals: T(
        [
          'distinguere uno scherzo dal cyberbullismo: si ripete, c’è chi ha più forza, fa stare male, avviene davanti a un pubblico;',
          'riconoscere i ruoli nel gruppo (chi attacca, chi ride o rilancia, chi tace, chi aiuta) e tre mosse concrete per chi assiste;',
          'sapere a chi rivolgersi a scuola e cosa prevede la legge in breve.',
        ],
        [
          'tell a joke from cyberbullying: it repeats, someone has more power, it makes someone feel bad, it happens in front of an audience;',
          'recognise the roles in the group (attacker, those who laugh or forward, those who stay silent, those who help) and three concrete moves for bystanders;',
          'know who to turn to at school and what the law says, in brief.',
        ]
      ),
      materials: T(
        [
          'LIM o proiettore con la tappa 8 di Primi passi.',
          'Una copia delle carte del gioco per ogni gruppo, ritagliata.',
          'Un biglietto d’uscita per ogni studente.',
          'Alla lavagna, i quattro criteri: si ripete? c’è chi ha più forza? fa stare male? c’è un pubblico?',
        ],
        [
          'A classroom screen or projector showing stage 8 of First steps.',
          'One set of game cards per group, cut out.',
          'One exit ticket per student.',
          'On the board, the four criteria: does it repeat? does someone have more power? does it hurt? is there an audience?',
        ]
      ),
      before: T(
        [
          'Concorda la lezione con il referente per il bullismo e il cyberbullismo: deve sapere che se ne parlerà, e tu devi sapere qual è la procedura della scuola.',
          'Se in classe c’è un caso in corso, non usare questo kit come risposta: prima si interviene con il referente e la famiglia.',
          'Stampa la guida, le carte e i biglietti.',
        ],
        [
          'Plan the lesson with the bullying and cyberbullying contact person: they need to know it will be discussed, and you need to know the school’s procedure.',
          'If there is an ongoing case in the class, don’t use this kit as the response: first act with the contact person and the family.',
          'Print the guide, the cards and the tickets.',
        ]
      ),
      plan: [
        {
          from: 0,
          to: 5,
          title: T('Aggancio: quante risate?', 'Hook: how many laughs?'),
          text: T('Dai le regole: si parla dei personaggi e mai dei compagni; nessuno deve raccontare cose sue; si può passare. Poi una domanda provocatoria, senza risposta giusta.', 'Set the rules: we talk about the characters and never about classmates; nobody has to share anything personal; anyone can pass. Then a provocative question with no right answer.'),
          say: T('«Quante risate servono perché uno scherzo smetta di essere uno scherzo?»', '“How many laughs does it take for a joke to stop being a joke?”'),
        },
        {
          from: 5,
          to: 15,
          title: T('La storia di Tommaso', 'Tommaso’s story'),
          text: T('Proietta la tappa 8: scena, storia e voto. Poi aprite le tre risposte e fermatevi su quella di chi esce dal gruppo: protegge sé, ma lascia solo Tommaso.', 'Project stage 8: scene, story and vote. Then open the three answers and pause on the one about leaving the group: it protects you, but leaves Tommaso alone.'),
          say: T('«Chi attacca cerca pubblico: ogni risata lo fa sentire più forte. Anche chi guarda conta.»', '“Attackers want an audience: every laugh makes them feel stronger. The people watching count too.”'),
        },
        {
          from: 15,
          to: 30,
          title: T('Gioco a gruppi: scherzo o cyberbullismo?', 'Group game: joke or cyberbullying?'),
          text: T('Gruppi da 3–4: dividono le carte nelle due colonne usando i quattro criteri alla lavagna. Poi ogni gruppo spiega la carta più discussa. Quando una carta divide il gruppo, chiedi: «E per chi la riceve, com’è?»', 'Groups of 3–4 sort the cards into the two columns using the four criteria on the board. Then each group explains the card they argued about most. When a card splits the group, ask: “And for the person on the receiving end, what is it like?”'),
        },
        {
          from: 30,
          to: 40,
          title: T('Le tre mosse di chi assiste', 'The bystander’s three moves'),
          text: T('Scrivi alla lavagna le tre mosse e falle provare: ogni studente scrive sul biglietto il messaggio privato che manderebbe a chi è preso di mira. Poi presenta in breve la legge e il referente della scuola.', 'Write the three moves on the board and let them practise: each student writes on the ticket the private message they would send the person targeted. Then briefly present the law and the school’s contact person.'),
          say: T('«Uno: non rido e non inoltro. Due: scrivo in privato “Ho visto. Mi dispiace. Ci sono.” Tre: avviso un adulto, anche insieme a un amico. Non serve essere eroi: basta non lasciare solo nessuno.»', '“One: I don’t laugh and I don’t forward. Two: I message privately ‘I saw it. I’m sorry. I’m here.’ Three: I tell an adult, even together with a friend. You don’t have to be a hero: just don’t leave anyone alone.”'),
        },
        {
          from: 40,
          to: 47,
          title: T('Discussione', 'Discussion'),
          text: T('Usa le domande qui sotto. Se qualcuno inizia a raccontare un caso vero della classe, ringrazia e proponi di parlarne dopo, in privato.', 'Use the questions below. If someone starts describing a real case in the class, thank them and suggest talking afterwards, in private.'),
        },
        {
          from: 47,
          to: 50,
          title: T('Chiusura', 'Wrap-up'),
          text: T('Ogni studente completa il biglietto. Indica chi è il referente della scuola e dove si trova la pagina Aiuto subito.', 'Each student completes the ticket. Say who the school’s contact person is and where to find the Get help now page.'),
        },
      ],
      game: {
        categories: [
          { id: 'joke', label: T('Scherzo', 'A joke') },
          { id: 'cb', label: T('Cyberbullismo', 'Cyberbullying') },
        ],
        items: [
          { cat: 'joke', text: T('Una battuta tra amici sul tuo goal sbagliato, e tu ridi con loro', 'Friends joke about the goal you missed, and you laugh along'), why: T('Ridono tutti, compreso chi la riceve, e finisce lì.', 'Everyone laughs, including the person it’s about, and it ends there.') },
          { cat: 'cb', text: T('Un meme con la faccia di un compagno che gira da giorni in due gruppi', 'A meme with a classmate’s face going round two groups for days'), why: T('Si ripete, c’è un pubblico e usa la sua faccia senza permesso.', 'It repeats, there’s an audience and it uses their face without permission.') },
          { cat: 'cb', text: T('Un gruppo nuovo creato apposta senza una persona, per parlarne male', 'A new group created on purpose without one person, to talk about them behind their back'), why: T('Escludere e isolare qualcuno è cyberbullismo.', 'Excluding and isolating someone is cyberbullying.') },
          { cat: 'cb', text: T('Un profilo falso con il nome di una compagna che pubblica cose imbarazzanti', 'A fake profile in a classmate’s name posting embarrassing things'), why: T('Il furto d’identità rientra nella definizione della legge 71/2017.', 'Identity theft is part of the definition in Italian Law 71/2017.') },
          { cat: 'joke', text: T('Uno sticker buffo mandato a un amico, che risponde con un altro sticker', 'A funny sticker sent to a friend, who replies with another sticker'), why: T('Un gioco tra pari, che diverte entrambi.', 'A game between equals that both enjoy.') },
          { cat: 'cb', text: T('Lo screenshot di una chat privata girato a tutta la classe per prendere in giro', 'A screenshot of a private chat sent to the whole class to make fun of someone'), why: T('Rende pubblico qualcosa di privato per deridere: fa male e resta.', 'It makes something private public in order to mock: it hurts and it stays.') },
          { cat: 'cb', text: T('Commenti cattivi sotto ogni video di un compagno', 'Nasty comments under every video a classmate posts'), why: T('Offese ripetute fanno male anche se sono «solo parole».', 'Repeated insults hurt even if they’re “just words”.') },
          { cat: 'joke', text: T('Un soprannome che piace anche a chi lo riceve', 'A nickname the person likes too'), why: T('Se smette di piacergli, smette di essere uno scherzo.', 'If they stop liking it, it stops being a joke.') },
        ],
      },
      discussion: [
        {
          q: T('Perché è difficile intervenire quando vedi qualcosa nel gruppo?', 'Why is it hard to step in when you see something in the group?'),
          a: T('Per paura di diventare il prossimo bersaglio o di restare soli. Per questo bastano mosse piccole e in privato: un messaggio a chi è preso di mira, un adulto avvisato insieme a un amico.', 'Out of fear of becoming the next target or of being left alone. That’s why small, private moves are enough: a message to the person targeted, an adult told together with a friend.'),
        },
        {
          q: T('Avvisare un adulto è fare la spia?', 'Is telling an adult snitching?'),
          a: T('No: fare la spia è mettere nei guai qualcuno per un vantaggio; chiedere aiuto è proteggere una persona che sta male.', 'No: snitching is getting someone into trouble for your own benefit; asking for help is protecting someone who is suffering.'),
        },
        {
          q: T('Cosa prevede la legge?', 'What does the law say?'),
          a: T('In Italia ogni scuola ha un referente per il bullismo e il cyberbullismo. Dai 14 anni, o tramite un genitore, si può chiedere al sito o al social di togliere i contenuti; se non risponde entro 24 ore o non provvede entro 48, ci si rivolge al Garante privacy. Per chi ha tra 14 e 18 anni esiste l’ammonimento del questore, e il 114 offre prima assistenza psicologica e legale.', 'In Italy every school has a bullying and cyberbullying contact person. From 14, or through a parent, you can ask the site or social network to remove content; if it doesn’t reply within 24 hours or act within 48, you turn to the Data Protection Authority. For 14 to 18-year-olds there is a formal police warning, and the 114 line offers first psychological and legal support.'),
        },
      ],
      ticket: T(
        ['Il messaggio privato che manderei a chi è preso di mira:', 'Le tre mosse di chi assiste:', 'A scuola posso parlarne con:'],
        ['The private message I’d send the person targeted:', 'The bystander’s three moves:', 'At school I can talk to:']
      ),
      adapt: {
        easier: T('In prima usa sei carte e lascia alla lavagna le tre mosse per tutta la lezione.', 'With younger students use six cards and keep the three moves on the board for the whole lesson.'),
        harder: T('In terza leggete insieme il codice interno della scuola contro il bullismo, che per legge ogni istituto deve adottare.', 'With older students read the school’s internal anti-bullying code together, which every Italian school must adopt by law.'),
        inclusion: T('Il messaggio di sostegno si può scrivere, dire a voce o scegliere tra tre proposte scritte alla lavagna.', 'The support message can be written, said aloud or chosen from three suggestions on the board.'),
      },
      home: T(
        'A casa, con un genitore, la tappa 8 di Primi passi; insieme scrivete il messaggio che mandereste a un amico preso di mira e salvate tra i preferiti la pagina Aiuto subito.',
        'At home, do stage 8 of First steps with a parent; together write the message you’d send a friend who is targeted and bookmark the Get help now page.'
      ),
      civica: T('Traguardo n. 11 (comunicazione rispettosa nei diversi contesti) e n. 12 (salvaguardare la propria e altrui sicurezza e il benessere psicologico; riconoscere e contrastare il cyberbullismo).', 'Goal 11 (respectful communication in different contexts) and goal 12 (keeping oneself and others safe and well; recognising and countering cyberbullying).'),
      digcomp: T('2.5 Netiquette · 4.3 Proteggere la salute e il benessere', '2.5 Netiquette · 4.3 Protecting health and well-being'),
      sources: [SRC.lineeGuida, SRC.digcomp, SRC.nota121, SRC.orientamento, PP.SRC.legge71, PP.SRC.legge70, PP.SRC.dlgs99],
    },

    // ------------------------------------------------------------------ kit 6
    {
      n: 6,
      slug: 'le-mie-foto-i-miei-diritti',
      cycle: 'superiori',
      icon: 'shield',
      sensitive: true,
      anonymousTicket: true,
      classes: T('Secondaria di secondo grado, classi 1ª–5ª', 'Upper secondary, ages 14–19'),
      stages: ['persone-online', 'condividere'],
      title: T('Le mie foto, i miei diritti', 'My photos, my rights'),
      desc: T(
        'Kit 6 di EVIL Scuola, secondaria di secondo grado: consenso, ricatti con le immagini (sextortion), diffusione di foto intime e strumenti per farle togliere. Lezione pronta da 50 minuti.',
        'EVIL for Schools kit 6, upper secondary: consent, image-based blackmail (sextortion), sharing of intimate photos and tools to get them taken down. A ready-made 50-minute lesson.'
      ),
      hook: T('Nessuno ha il diritto di chiederti foto. Tu hai il diritto di farle sparire.', 'Nobody has the right to ask you for photos. You have the right to make them disappear.'),
      idea: T('Se qualcuno mi ricatta con una foto non pago, salvo le prove, blocco e chiedo aiuto: non è colpa mia. Se una foto intima di qualcuno arriva a me, non la inoltro. E ci sono strumenti per farla togliere.', 'If someone blackmails me with a photo I don’t pay, I keep the evidence, I block and I ask for help: it isn’t my fault. If someone’s intimate photo reaches me, I don’t forward it. And there are tools to get it taken down.'),
      goals: T(
        [
          'riconoscere pressione e ricatto: richieste insistenti, minacce, richiesta di soldi o di altre immagini;',
          'conoscere le mosse da fare: non pagare, salvare le prove, bloccare e segnalare, parlarne con un adulto o con la Polizia Postale;',
          'sapere che chi diffonde immagini intime senza consenso commette un reato, anche se le ha solo ricevute, e quali strumenti aiutano a toglierle.',
        ],
        [
          'recognise pressure and blackmail: insistent requests, threats, demands for money or more images;',
          'know the moves: don’t pay, keep the evidence, block and report, talk to an adult or the police;',
          'know that sharing intimate images without consent is a crime even if you only received them, and which tools help remove them.',
        ]
      ),
      materials: T(
        [
          'LIM o proiettore con la tappa 7 di Primi passi, livello «Per approfondire».',
          'Una copia delle carte del gioco per ogni gruppo, ritagliata.',
          'Un biglietto d’uscita per ogni studente, anonimo: si raccoglie in una scatola.',
        ],
        [
          'A classroom screen or projector showing stage 7 of First steps, “Go deeper” level.',
          'One set of game cards per group, cut out.',
          'One exit ticket per student, anonymous: collected in a box.',
        ]
      ),
      before: T(
        [
          'Concorda la lezione con il referente per il bullismo e il cyberbullismo e, se la scuola lo prevede, con lo psicologo o lo sportello d’ascolto.',
          'Se sai di un caso in corso nella scuola, non usare questo kit: prima si interviene con il referente.',
          'Leggi i biglietti anonimi dopo la lezione con calma: se uno racconta una situazione in corso, segui la procedura della scuola.',
        ],
        [
          'Plan the lesson with the bullying and cyberbullying contact person and, where the school has one, with the school psychologist or counselling service.',
          'If you know of an ongoing case in the school, don’t use this kit: first act with the contact person.',
          'Read the anonymous tickets calmly after the lesson: if one describes an ongoing situation, follow the school’s procedure.',
        ]
      ),
      plan: [
        {
          from: 0,
          to: 5,
          title: T('Aggancio: una frase da discutere', 'Hook: a sentence to discuss'),
          text: T('Dai le regole: si parla di personaggi inventati, mai di persone vere o della scuola; nessuno racconta cose sue; si può passare. Scrivi la frase alla lavagna e chiedi cosa significa.', 'Set the rules: we talk about made-up characters, never real people or the school; nobody shares anything personal; anyone can pass. Write the sentence on the board and ask what it means.'),
          say: T('«“Nessuno ha il diritto di chiederti foto. Tu hai il diritto di farle sparire.” Secondo voi è vera? Che cosa vuol dire “diritto”, qui?»', '“‘Nobody has the right to ask you for photos. You have the right to make them disappear.’ Do you think it’s true? What does ‘right’ mean here?”'),
        },
        {
          from: 5,
          to: 15,
          title: T('La storia di Sam', 'Sam’s story'),
          text: T('Leggi la storia: Sam, 16 anni, conosce online un profilo molto gentile. Dopo qualche giorno di complimenti arriva la richiesta di una foto; poi la minaccia: «Paga, o la mando a tutti i tuoi follower.» La classe vota: pagare così finisce; non pagare, salvare le prove, bloccare e chiedere aiuto; cancellare tutto e non dirlo a nessuno.', 'Read the story: Sam, 16, meets a very friendly profile online. After a few days of compliments comes a request for a photo; then the threat: “Pay, or I send it to all your followers.” The class votes: pay so it ends; don’t pay, keep the evidence, block and ask for help; delete everything and tell nobody.'),
          say: T('«Pagare non lo fa finire: chi ricatta, se ottiene soldi, di solito chiede ancora. Cancellare tutto fa perdere le prove e lascia soli. La mossa giusta è la seconda, e la colpa è sempre di chi ricatta, mai di Sam.»', '“Paying doesn’t end it: blackmailers who get money usually ask for more. Deleting everything loses the evidence and leaves you alone. The right move is the second, and the blame is always on the blackmailer, never on Sam.”'),
        },
        {
          from: 15,
          to: 30,
          title: T('Gioco a gruppi: aiuta o fa danno?', 'Group game: does it help or harm?'),
          text: T('Gruppi da 3–4: dividono le carte, che sono azioni, nelle due colonne. Poi ogni gruppo spiega una carta. Insisti sulle azioni di chi riceve una foto: lì ognuno può fare la differenza.', 'Groups of 3–4 sort the cards, which are actions, into the two columns. Then each group explains one card. Dwell on the actions of people who receive a photo: that’s where everyone can make a difference.'),
        },
        {
          from: 30,
          to: 40,
          title: T('I diritti e gli strumenti', 'Rights and tools'),
          text: T('Proietta il livello «Per approfondire» della tappa 7 e presenta gli strumenti: la segnalazione alla Polizia Postale, la segnalazione preventiva al Garante privacy (anche da soli dai 14 anni) e Take It Down per le immagini di quando si era minorenni, che invia solo un’impronta del file. Ricorda la legge: diffondere immagini intime senza consenso è reato anche per chi le ha solo ricevute. E una regola ferma: una foto intima di un minorenne non si salva e non si inoltra mai, nemmeno come prova; si salvano le schermate dei messaggi e delle minacce, il nome del profilo e il link. Distribuisci i biglietti anonimi.', 'Project the “Go deeper” level of stage 7 and present the tools: reporting to the Polizia Postale (the Italian police’s online crime unit), the preventive report to the Italian Data Protection Authority (on your own from 14) and Take It Down for images taken when under 18, which sends only a fingerprint of the file. Recall the law: sharing intimate images without consent is a crime even for those who only received them. And one firm rule: an intimate photo of a minor is never saved or forwarded, not even as evidence; save screenshots of the messages and threats, the profile name and the link. Hand out the anonymous tickets.'),
          say: T('«Il file resta sul vostro telefono: a Take It Down arriva solo una specie di impronta digitale, che serve alle piattaforme per riconoscere e togliere la foto.»', '“The file stays on your phone: Take It Down only receives a kind of fingerprint, which platforms use to recognise and remove the photo.”'),
        },
        {
          from: 40,
          to: 47,
          title: T('Discussione', 'Discussion'),
          text: T('Usa le domande qui sotto. Tieni il discorso sul consenso e sulle responsabilità di chi diffonde, mai sulle scelte di chi ha mandato una foto.', 'Use the questions below. Keep the conversation on consent and on the responsibility of whoever shares, never on the choices of the person who sent a photo.'),
        },
        {
          from: 47,
          to: 50,
          title: T('Chiusura', 'Wrap-up'),
          text: T('Ognuno completa il biglietto anonimo: una cosa imparata e, se vuole, una domanda che non ha fatto in classe; i biglietti vanno nella scatola. Mostra di nuovo i numeri di aiuto.', 'Everyone writes on the anonymous ticket one thing they learned and, if they like, a question they didn’t ask in class; the tickets go in the box. Show the help numbers again.'),
          say: T('«Le quattro mosse: non pagare, salva le prove, blocca e segnala, parlane. Non siete mai soli.»', '“The four moves: don’t pay, keep the evidence, block and report, talk to someone. You’re never alone.”'),
        },
      ],
      game: {
        categories: [
          { id: 'help', label: T('Aiuta', 'Helps') },
          { id: 'harm', label: T('Fa danno', 'Harms') },
        ],
        items: [
          { cat: 'harm', text: T('Inoltrare a un amico la foto intima di una compagna arrivata nel gruppo', 'Forwarding a classmate’s intimate photo that arrived in the group to a friend'), why: T('Diffonderla senza consenso è reato anche per chi l’ha solo ricevuta (art. 612-ter c.p.), e moltiplica il danno.', 'Sharing it without consent is a crime even for those who only received it (Italian Criminal Code, art. 612-ter), and multiplies the harm.') },
          { cat: 'help', text: T('Non inoltrarla, segnalarla alla piattaforma e avvisare un adulto', 'Not forwarding it, reporting it to the platform and telling an adult'), why: T('Ferma la diffusione e mette in moto chi può farla togliere.', 'It stops the spread and brings in people who can get it removed.') },
          { cat: 'harm', text: T('Pagare chi ricatta perché smetta', 'Paying the blackmailer to make it stop'), why: T('Di solito non smette: chi ottiene soldi chiede ancora.', 'It usually doesn’t stop: blackmailers who get money ask for more.') },
          { cat: 'help', text: T('Salvare le prove (chat, profilo, minacce) prima di bloccare', 'Saving the evidence (chat, profile, threats) before blocking'), why: T('Servono alla Polizia Postale e per far togliere i contenuti. Si salvano messaggi, minacce, profilo e link: mai la foto intima di un minorenne, nemmeno come prova.', 'The police (in Italy the Polizia Postale) need it, and it helps get content removed. Save messages, threats, profile and links: never an intimate photo of a minor, not even as evidence.') },
          { cat: 'harm', text: T('Cancellare tutto e non dirlo a nessuno', 'Deleting everything and telling nobody'), why: T('Si perdono le prove e si resta soli con il problema.', 'The evidence is lost and you’re left alone with the problem.') },
          { cat: 'help', text: T('Usare Take It Down per una foto di quando avevi meno di 18 anni', 'Using Take It Down for a photo taken when you were under 18'), why: T('Il file resta sul telefono; le piattaforme che aderiscono usano l’impronta per toglierlo.', 'The file stays on your phone; participating platforms use the fingerprint to remove it.') },
          { cat: 'harm', text: T('Commentare «se l’è cercata»', 'Commenting “they asked for it”'), why: T('Sposta la colpa su chi subisce: la responsabilità è di chi ricatta e di chi diffonde.', 'It shifts the blame onto the victim: the responsibility lies with whoever blackmails and whoever shares.') },
          { cat: 'help', text: T('Scrivere alla persona: «Non è colpa tua. Ti aiuto a chiedere aiuto.»', 'Writing to the person: “It’s not your fault. I’ll help you get help.”'), why: T('Chi subisce si sente meno solo ed è più facile che parli con un adulto.', 'The person feels less alone and is more likely to talk to an adult.') },
        ],
      },
      discussion: [
        {
          q: T('Di chi è la colpa se una foto intima viene diffusa?', 'Whose fault is it if an intimate photo gets shared?'),
          a: T('Di chi la diffonde senza consenso, mai di chi l’ha fatta o mandata. Chi ha ricevuto una foto in fiducia e la inoltra commette un reato.', 'The fault lies with whoever shares it without consent, never with the person who took or sent it. Someone who received a photo in trust and forwards it commits a crime.'),
        },
        {
          q: T('Perché chi ricatta chiede di non dirlo a nessuno?', 'Why does a blackmailer ask you to tell no one?'),
          a: T('Perché il suo potere sta nella vergogna e nel silenzio. Appena ne parli con un adulto o con la Polizia Postale, perde forza.', 'Because their power lies in shame and silence. As soon as you talk to an adult or the police, they lose their grip.'),
        },
        {
          q: T('Cosa scriveresti a un amico a cui è successo?', 'What would you write to a friend this happened to?'),
          a: T('Qualcosa come: «Non è colpa tua. Non pagare, salva le prove, ti accompagno a parlarne con qualcuno.» E poi lo fai davvero.', 'Something like: “It’s not your fault. Don’t pay, keep the evidence, I’ll come with you to talk to someone.” And then you actually do it.'),
        },
      ],
      ticket: T(
        ['Una cosa che ho imparato oggi:', 'Le quattro mosse se qualcuno ricatta con una foto:', 'Una domanda che non ho fatto in classe (facoltativa, il biglietto è anonimo):'],
        ['One thing I learned today:', 'The four moves if someone blackmails with a photo:', 'A question I didn’t ask in class (optional, the ticket is anonymous):']
      ),
      adapt: {
        easier: T('Nel biennio usa sei carte e lascia alla lavagna le quattro mosse e i numeri di aiuto per tutta l’ora.', 'With younger classes use six cards and keep the four moves and the help numbers on the board for the whole lesson.'),
        harder: T('Nel triennio leggete insieme l’art. 612-ter del codice penale e la pagina del Garante sulla segnalazione preventiva, e discutete del consenso nelle relazioni.', 'With older classes read Article 612-ter of the Italian Criminal Code and the Data Protection Authority’s page on preventive reports together, and discuss consent in relationships.'),
        inclusion: T('Le carte si possono leggere in coppia; il biglietto si può completare con parole chiave. Nessuno deve esporsi davanti alla classe.', 'Cards can be read in pairs; the ticket can be completed with keywords. Nobody has to expose themselves in front of the class.'),
      },
      home: T(
        'Proposta per casa, non obbligatoria: salvare in rubrica il 114, il 1.96.96 e il sito della Polizia Postale, e guardare con un adulto la pagina Aiuto subito.',
        'Optional idea for home: save the local helpline numbers and the police reporting site in your contacts (in Italy 114, 1.96.96 and commissariatodips.it), and look at the Get help now page with an adult.'
      ),
      civica: T('Competenza n. 12 (secondo ciclo): gestire l’identità digitale e i dati della rete, salvaguardando la propria e altrui sicurezza ed evitando minacce al benessere fisico e psicologico.', 'Competence 12 (upper secondary): managing digital identity and online data, keeping oneself and others safe and avoiding threats to physical and psychological wellbeing.'),
      digcomp: T('2.6 Gestire l’identità digitale · 4.2 Proteggere i dati personali e la privacy · 4.3 Proteggere la salute e il benessere', '2.6 Managing digital identity · 4.2 Protecting personal data and privacy · 4.3 Protecting health and well-being'),
      sources: [SRC.lineeGuida, codiceRosso, PP.SRC.garanteRp, PP.SRC.takeitdown, postale, PP.SRC.sextortion, PP.SRC.postale2025, SRC.orientamento],
    },
  ];
};

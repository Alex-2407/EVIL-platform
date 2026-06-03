(function () {
  function Q(question, explanation, options) {
    return { question, explanation, options };
  }

  const PILLARS = {
    human: 'Inganno umano',
    tech: 'Tecnico',
    defend: 'Difesa',
    intel: 'Intelligence',
  };

  const CATEGORIES = {
    'phishing-email': {
      id: 'phishing-email',
      name: "Phishing & Email",
      pillar: 'human',
      icon: '◈',
      accent: '#fb7185',
      description: "Email fraudolente, BEC, segnali di allarme.",
      questions: [
        Q(
          "Ricevi un'email dalla banca che chiede di cliccare un link per verificare il conto. Cosa è più sospetto?",
          "I phisher commettono errori e usano link che sembrano legittimi ma puntano a siti fake.",
          [
        { text: "Le banche non inviano mai email", correct: false },
        { text: "Errori di ortografia e link che non corrisponde al dominio ufficiale", correct: true },
        { text: "Email ricevuta di lunedì", correct: false },
        { text: "Tono cordiale", correct: false }
          ]
        ),
        Q(
          "Quale indirizzo email è PROBABILMENTE fraudolento?",
          "Typosquatting: sostituiscono lettere (o→0) o usano domini invertiti. Controlla sempre il dominio reale.",
          [
        { text: "support@amazon.com", correct: false },
        { text: "support@amaz0n.com", correct: true },
        { text: "customer-service@amazon.com", correct: false },
        { text: "noreply@payments.amazon.com", correct: false }
          ]
        ),
        Q(
          "Email PayPal: conto sospeso, verifica subito. Cosa è più sospetto?",
          "Urgenza artificiale e assenza di dettagli personalizzati sono segnali classici di phishing.",
          [
        { text: "Urgenza artificiale e mancanza di dettagli personali", correct: true },
        { text: "Proviene da PayPal", correct: false },
        { text: "Contiene il logo", correct: false },
        { text: "È in inglese", correct: false }
          ]
        ),
        Q(
          "Oggetto: \"Importante: Azione Richiesta Urgente\". Qual è il segnale di allarme?",
          "L'urgenza forzata bypassa il pensiero critico: tattica comune nei messaggi fraudolenti.",
          [
        { text: "È un email importante", correct: false },
        { text: "Tono urgente per farti agire senza riflettere", correct: true },
        { text: "È in maiuscolo", correct: false },
        { text: "Mittente aziendale", correct: false }
          ]
        ),
        Q(
          "Quale caratteristica è tipica di un'email legittima da una banca?",
          "Le banche non chiedono password via link; usano dati personalizzati sulla transazione.",
          [
        { text: "Richiede password tramite link", correct: false },
        { text: "Dettagli personalizzati su conto o operazione", correct: true },
        { text: "Dominio casuale", correct: false },
        { text: "Allegato .exe", correct: false }
          ]
        ),
        Q(
          "BEC (Business Email Compromise): cosa descrive meglio l'attacco?",
          "Il BEC imita dirigenti o fornitori per indurre bonifici o furto di credenziali.",
          [
        { text: "Spam massivo senza target", correct: false },
        { text: "Email che imita CEO o fornitore per frodi su pagamenti", correct: true },
        { text: "Solo virus su allegati", correct: false },
        { text: "Attacco solo su social", correct: false }
          ]
        ),
        Q(
          "Come verificare se un link in email è sicuro prima di cliccare?",
          "Passa il mouse sul link (senza cliccare) e confronta dominio e HTTPS con il sito ufficiale.",
          [
        { text: "Cliccare e vedere se carica", correct: false },
        { text: "Ispezionare URL reale al passaggio del mouse e confrontare col sito ufficiale", correct: true },
        { text: "Fidarsi se il testo dice HTTPS", correct: false },
        { text: "Inoltrare a colleghi", correct: false }
          ]
        ),
        Q(
          "Cosa fare con un'email di phishing ricevuto in azienda?",
          "Segnalare al SOC/IT e non interagire evita escalation e aiuta a bloccare campagne.",
          [
        { text: "Rispondere per capire chi è", correct: false },
        { text: "Non cliccare, segnalare a IT/SOC e cancellare", correct: true },
        { text: "Inoltrare a tutti come avviso", correct: false },
        { text: "Aprire allegati in sandbox personale", correct: false }
          ]
        ),
      ],
    },
    'social-engineering': {
      id: 'social-engineering',
      name: "Social Engineering",
      pillar: 'human',
      icon: '◎',
      accent: '#f472b6',
      description: "Manipolazione psicologica, pretexting, autorità.",
      questions: [
        Q(
          "Un collega invia un link \"guarda questo video\". Cosa fai?",
          "Account compromessi inviano malware ai contatti: verifica su canale alternativo.",
          [
        { text: "Clicco subito", correct: false },
        { text: "Chiedo conferma al collega su canale diverso", correct: true },
        { text: "Scarico senza scansione", correct: false },
        { text: "Apro in incognito e clicco", correct: false }
          ]
        ),
        Q(
          "Sconosciuto si presenta come IT e chiede accesso al PC. Cosa fai?",
          "Verifica chiamando IT con numero interno noto, mai con quello fornito dal chiamante.",
          [
        { text: "Do accesso subito", correct: false },
        { text: "Richiamo IT con numero ufficiale interno", correct: true },
        { text: "Chiedo solo il nome", correct: false },
        { text: "Do password via chat", correct: false }
          ]
        ),
        Q(
          "Quale NON è tipica del social engineering digitale?",
          "Il SE digitale sfrutta urgenza, autorità e fiducia; la lettera certificata è meno immediata.",
          [
        { text: "Fingersi autorità (banca, polizia)", correct: false },
        { text: "Creare urgenza", correct: false },
        { text: "Lettera cartacea certificata come vettore principale immediato", correct: true },
        { text: "Sfruttare fiducia verso colleghi", correct: false }
          ]
        ),
        Q(
          "Email: hai vinto un premio senza aver partecipato. È phishing?",
          "Premi inaspettati sono truffe classiche per rubare dati o denaro.",
          [
        { text: "No, può essere legittimo", correct: false },
        { text: "Sì, quasi certamente truffa", correct: true },
        { text: "Solo se in spam", correct: false },
        { text: "Dipende dal mittente", correct: false }
          ]
        ),
        Q(
          "Cosa rende efficace il social engineering?",
          "Sfrutta emozioni (paura, curiosità, avidità) più che solo vulnerabilità tecniche.",
          [
        { text: "Sfrutta emozioni umane", correct: true },
        { text: "Solo tecnologia avanzata", correct: false },
        { text: "Solo su analfabeti digitali", correct: false },
        { text: "Richiede sempre accesso fisico", correct: false }
          ]
        ),
        Q(
          "Pretexting in sicurezza significa:",
          "Inventare uno scenario credibile per ottenere informazioni o accesso.",
          [
        { text: "Crittografare i dati", correct: false },
        { text: "Creare una storia falsa credibile per manipolare la vittima", correct: true },
        { text: "Scansionare le porte", correct: false },
        { text: "Backup automatico", correct: false }
          ]
        ),
        Q(
          "Quale principio aiuta a resistere alla manipolazione?",
          "Pausa, verifica indipendente e policy aziendali riducono il successo del SE.",
          [
        { text: "Agire subito per non perdere opportunità", correct: false },
        { text: "Pausa, verifica indipendente e policy", correct: true },
        { text: "Condividere password con IT al telefono", correct: false },
        { text: "Disattivare antivirus per velocità", correct: false }
          ]
        ),
        Q(
          "Vishing usa principalmente quale canale?",
          "Voice phishing: chiamate per rubare credenziali o indurre azioni.",
          [
        { text: "Solo email", correct: false },
        { text: "Telefono/voce", correct: true },
        { text: "Solo USB", correct: false },
        { text: "Solo fax", correct: false }
          ]
        ),
      ],
    },
    'smishing-vishing': {
      id: 'smishing-vishing',
      name: "Smishing & Vishing",
      pillar: 'human',
      icon: '☎',
      accent: '#e879f9',
      description: "Truffe via SMS e telefono, OTP, finti operatori.",
      questions: [
        Q(
          "SMS: \"Pacco in attesa, clicca per ritirare\". Rischio principale?",
          "Smishing usa link corti verso siti fake per credenziali o malware.",
          [
        { text: "Ritardo postale", correct: false },
        { text: "Link fraudolento per furto credenziali o malware", correct: true },
        { text: "Costo SMS", correct: false },
        { text: "Spam legale", correct: false }
          ]
        ),
        Q(
          "Chiamata: \"Sono la banca, conferma il codice OTP ricevuto\". Cosa fare?",
          "Mai condividere OTP: la banca non lo chiede; è furto sessione/account.",
          [
        { text: "Dettare il codice", correct: false },
        { text: "Non comunicare OTP e riagganciare; contattare banca con numero ufficiale", correct: true },
        { text: "Chiedere al chiamante di ripetere", correct: false },
        { text: "Inviare screenshot", correct: false }
          ]
        ),
        Q(
          "Numero che sembra locale ma è spoofato. Come difendersi?",
          "Non fidarsi del caller ID; verificare tramite canali ufficiali.",
          [
        { text: "Caller ID è sempre affidabile", correct: false },
        { text: "Non fidarsi del numero visualizzato; verificare con contatto ufficiale", correct: true },
        { text: "Richiamare lo stesso numero", correct: false },
        { text: "Dare dati se tono professionale", correct: false }
          ]
        ),
        Q(
          "SMS con link accorciato da mittente sconosciuto. Azione migliore?",
          "Eliminare e verificare servizi tramite app/sito ufficiale digitato manualmente.",
          [
        { text: "Cliccare per vedere", correct: false },
        { text: "Eliminare e usare app/sito ufficiale senza il link", correct: true },
        { text: "Rispondere STOP con dati", correct: false },
        { text: "Inoltrare ad amici", correct: false }
          ]
        ),
        Q(
          "Truffa \"supporto Microsoft\" al telefono. Segnale tipico?",
          "Chiedono accesso remoto o pagamenti per \"pulire virus\" inesistenti.",
          [
        { text: "Inviano solo email", correct: false },
        { text: "Richiedono accesso remoto o pagamento urgente", correct: true },
        { text: "Mandano fattura cartacea", correct: false },
        { text: "Non parlano mai", correct: false }
          ]
        ),
        Q(
          "SIM swapping serve agli attaccanti per:",
          "Intercettare SMS OTP spostando la SIM su dispositivo dell'attaccante.",
          [
        { text: "Aumentare segnale Wi-Fi", correct: false },
        { text: "Ricevere SMS/OTP della vittima su altra SIM", correct: true },
        { text: "Crittografare il telefono", correct: false },
        { text: "Backup foto", correct: false }
          ]
        ),
        Q(
          "Messaggio: \"Hai un rimborso, inserisci IBAN qui\". È:",
          "Richieste dati finanziari via SMS non ufficiale sono quasi sempre fraudolente.",
          [
        { text: "Procedura standard", correct: false },
        { text: "Probabilmente smishing", correct: true },
        { text: "Sempre legittimo se c'è euro", correct: false },
        { text: "Solo marketing", correct: false }
          ]
        ),
        Q(
          "Dopo una chiamata sospetta a cui hai dato dati parziali, cosa fare?",
          "Bloccare carte, cambiare password e segnalare alla banca/IT.",
          [
        { text: "Aspettare", correct: false },
        { text: "Bloccare account/carte, cambiare credenziali, segnalare", correct: true },
        { text: "Pubblicare su social", correct: false },
        { text: "Richiamare lo stesso numero", correct: false }
          ]
        ),
      ],
    },
    'physical-se': {
      id: 'physical-se',
      name: "Ingegneria Sociale Fisica",
      pillar: 'human',
      icon: '⬡',
      accent: '#fda4af',
      description: "USB drop, tailgating, baiting, dumpster diving.",
      questions: [
        Q(
          "Trovi una USB in parcheggio aziendale. Cosa fare?",
          "USB drop: malware al collegamento; consegnare a sicurezza senza inserirla.",
          [
        { text: "Inserirla per vedere contenuti", correct: false },
        { text: "Non inserirla; consegnare a sicurezza/IT", correct: true },
        { text: "Portarla a casa", correct: false },
        { text: "Regalarla a un collega", correct: false }
          ]
        ),
        Q(
          "Tailgating è:",
          "Entrare in area riservata seguendo qualcuno senza badge proprio.",
          [
        { text: "Phishing via email", correct: false },
        { text: "Accesso fisico seguendo altri senza autenticazione", correct: true },
        { text: "Attacco DDoS", correct: false },
        { text: "Crittografia debole", correct: false }
          ]
        ),
        Q(
          "Sconosciuto con pacco chiede di tenere il portone. Policy corretta?",
          "Non tenere porte; indirizzare a reception o verificare badge.",
          [
        { text: "Tenere sempre per gentilezza", correct: false },
        { text: "Rifiutare e indirizzare a reception/verifica badge", correct: true },
        { text: "Dare il badge", correct: false },
        { text: "Lasciarlo solo in sala", correct: false }
          ]
        ),
        Q(
          "Baiting può includere:",
          "Esca fisica o digitale (USB, download \"gratis\") per compromettere la vittima.",
          [
        { text: "Solo firewall", correct: false },
        { text: "USB o offerte ingannevoli come esca", correct: true },
        { text: "Solo backup", correct: false },
        { text: "Patch automatiche", correct: false }
          ]
        ),
        Q(
          "Dumpster diving in sicurezza significa:",
          "Recuperare documenti buttati per ottenere informazioni sensibili.",
          [
        { text: "Nuotare", correct: false },
        { text: "Recuperare informazioni da rifiuti/documenti scartati", correct: true },
        { text: "Scansione porte", correct: false },
        { text: "Brute force", correct: false }
          ]
        ),
        Q(
          "Badge visitor senza accompagnamento in area server. Tu:",
          "Escort obbligatoria nelle zone critiche; segnalare anomalie.",
          [
        { text: "Ignorare", correct: false },
        { text: "Segnalare e far rispettare policy escort", correct: true },
        { text: "Prestare il tuo badge", correct: false },
        { text: "Fotografare per social", correct: false }
          ]
        ),
        Q(
          "Pretest telefonico in ufficio: sconosciuto chiede nomi reparto. Risposta:",
          "Non divulgare struttura interna a sconosciuti; usare canali ufficiali.",
          [
        { text: "Elencare tutti i reparti", correct: false },
        { text: "Rifiutare e indirizzare a reception/comunicazione ufficiale", correct: true },
        { text: "Dare numeri interni", correct: false },
        { text: "Mostrare organigramma", correct: false }
          ]
        ),
        Q(
          "Miglior controllo contro tailgating?",
          "Mantrap, badge individuali e cultura \"challenge\" riducono accessi non autorizzati.",
          [
        { text: "Porta sempre aperta", correct: false },
        { text: "Mantrap, badge e cultura di sfida cortese", correct: true },
        { text: "Solo videocamera esterna", correct: false },
        { text: "Password su porta", correct: false }
          ]
        ),
      ],
    },
    'malware-ransomware': {
      id: 'malware-ransomware',
      name: "Malware & Ransomware",
      pillar: 'tech',
      icon: '⚠',
      accent: '#f87171',
      description: "Virus, trojan, ransomware, indicazioni di compromissione.",
      questions: [
        Q(
          "Allegato .exe da sconosciuto. Cosa fare?",
          "Eseguibili da fonti non verificate sono altamente pericolosi: eliminare.",
          [
        { text: "Aprire subito", correct: false },
        { text: "Eliminare senza aprire", correct: true },
        { text: "Aprire in VM personale", correct: false },
        { text: "Caricare su cloud", correct: false }
          ]
        ),
        Q(
          "Quale estensione è più rischiosa se da fonte ignota?",
          "Exe, bat, scr, js possono eseguire codice; massima cautela.",
          [
        { text: ".pdf da fonte verificata", correct: false },
        { text: ".exe", correct: true },
        { text: ".txt", correct: false },
        { text: ".png", correct: false }
          ]
        ),
        Q(
          "Ransomware tipicamente:",
          "Cifra file e chiede riscatto, spesso dopo compromissione iniziale.",
          [
        { text: "Aumenta solo la RAM", correct: false },
        { text: "Cifra dati e chiede pagamento per sblocco", correct: true },
        { text: "Migliora le performance", correct: false },
        { text: "È solo antivirus", correct: false }
          ]
        ),
        Q(
          "Segnale possibile infezione malware?",
          "Lentezza, pop-up, connessioni strane, file rinominati.",
          [
        { text: "Solo schermo più luminoso", correct: false },
        { text: "Prestazioni degradate, pop-up o file crittografati", correct: true },
        { text: "Wi-Fi più veloce", correct: false },
        { text: "Batteria infinita", correct: false }
          ]
        ),
        Q(
          "Dopo ransomware su PC aziendale, prima azione?",
          "Isolare dalla rete e avvisare SOC; non pagare senza policy.",
          [
        { text: "Pagare subito in bitcoin", correct: false },
        { text: "Disconnettere dalla rete e segnalare SOC/IT", correct: true },
        { text: "Continuare a lavorare", correct: false },
        { text: "Formattare senza segnalare", correct: false }
          ]
        ),
        Q(
          "Trojan si differenzia da virus perché:",
          "Si maschera da software utile per indurre installazione.",
          [
        { text: "Si replica da solo via email sempre", correct: false },
        { text: "Si presenta come software legittimo per essere eseguito", correct: true },
        { text: "È solo hardware", correct: false },
        { text: "Non fa nulla", correct: false }
          ]
        ),
        Q(
          "Macro in documento Office da sconosciuto:",
          "Macro possono eseguire malware; disabilitare se non necessarie.",
          [
        { text: "Sempre sicure", correct: false },
        { text: "Possono eseguire codice malevolo: non abilitare da fonti non fidate", correct: true },
        { text: "Solo su Mac", correct: false },
        { text: "Richieste da tutte le banche", correct: false }
          ]
        ),
        Q(
          "Backup efficace contro ransomware deve essere:",
          "Copie offline/immutabili impediscono cifratura da parte del malware.",
          [
        { text: "Solo sulla stessa unità cifrata dal malware", correct: false },
        { text: "Offline o immutabile, testato con restore", correct: true },
        { text: "Solo su desktop", correct: false },
        { text: "Mai testato", correct: false }
          ]
        ),
      ],
    },
    'url-links': {
      id: 'url-links',
      name: "URL & Link",
      pillar: 'tech',
      icon: '🔗',
      accent: '#38bdf8',
      description: "Typosquatting, IDN, shortener, HTTPS.",
      questions: [
        Q(
          "Link mostra https://paypa1.com. Problema?",
          "Typosquatting: dominio simile con caratteri sostituiti.",
          [
        { text: "HTTPS rende tutto sicuro", correct: false },
        { text: "Dominio typosquatted (l vs 1)", correct: true },
        { text: "Troppo corto", correct: false },
        { text: "Nessuno", correct: false }
          ]
        ),
        Q(
          "URL accorciato (bit.ly) da email sconosciuta:",
          "Gli shortener nascondono destinazione reale: rischio phishing.",
          [
        { text: "Sempre sicuri", correct: false },
        { text: "Nascondono destinazione: evitare senza verifica", correct: true },
        { text: "Sono solo per social", correct: false },
        { text: "Bloccati da legge", correct: false }
          ]
        ),
        Q(
          "Punycode/IDN homograph attack sfrutta:",
          "Caratteri unicode simili a lettere latine (es. а vs a).",
          [
        { text: "Solo firewall", correct: false },
        { text: "Caratteri visivamente simili in domini", correct: true },
        { text: "Solo IP statici", correct: false },
        { text: "VPN", correct: false }
          ]
        ),
        Q(
          "Come aprire sito bancario in sicurezza dopo email sospetta?",
          "Digitare URL manualmente o usare bookmark, mai link in email.",
          [
        { text: "Cliccare link email", correct: false },
        { text: "Digitare URL o bookmark noto", correct: true },
        { text: "Cercare su motore e cliccare primo risultato ads", correct: false },
        { text: "Aprire allegato", correct: false }
          ]
        ),
        Q(
          "Certificato HTTPS garantisce che il sito sia:",
          "HTTPS cifra il canale, non prova che il sito sia legittimo o benigno.",
          [
        { text: "Sempre legittimo", correct: false },
        { text: "Connessione cifrata, non necessariamente sito affidabile", correct: true },
        { text: "Senza malware", correct: false },
        { text: "Governativo", correct: false }
          ]
        ),
        Q(
          "Open redirect su sito noto può essere usato per:",
          "Far sembrare link partire da dominio fidato reindirizzando a malevolo.",
          [
        { text: "Accelerare internet", correct: false },
        { text: "Phishing usando fiducia nel dominio iniziale", correct: true },
        { text: "Backup", correct: false },
        { text: "MFA", correct: false }
          ]
        ),
        Q(
          "Hover sul link mostra http://192.168.1.5/login in email \"banca\". È:",
          "IP diretti in email istituzionali sono altamente sospetti.",
          [
        { text: "Normale", correct: false },
        { text: "Molto sospetto: probabile phishing", correct: true },
        { text: "Obbligatorio", correct: false },
        { text: "Solo mobile", correct: false }
          ]
        ),
        Q(
          "Quale pratica riduce rischio da link?",
          "Browser aggiornato, filtri, formazione e verifica dominio.",
          [
        { text: "Disabilitare tutti gli aggiornamenti", correct: false },
        { text: "Browser aggiornato, verifica dominio, non cliccare link sospetti", correct: true },
        { text: "Installare toolbar casuali", correct: false },
        { text: "Disattivare HTTPS", correct: false }
          ]
        ),
      ],
    },
    'passwords-mfa': {
      id: 'passwords-mfa',
      name: "Password & MFA",
      pillar: 'defend',
      icon: '🔐',
      accent: '#34d399',
      description: "Password robuste, manager, 2FA, passkey.",
      questions: [
        Q(
          "Quale informazione NON va chiesta via email?",
          "Password, PIN e codici di sicurezza non si condividono per email.",
          [
        { text: "Numero ordine", correct: false },
        { text: "Password, PIN o codice di sicurezza", correct: true },
        { text: "Email di contatto", correct: false },
        { text: "Orario ritiro", correct: false }
          ]
        ),
        Q(
          "Password più sicura tra queste:",
          "Lunga, casuale, unica per servizio; evitare dati personali.",
          [
        { text: "password123", correct: false },
        { text: "Passphrase lunga casuale unica per servizio", correct: true },
        { text: "Nome+anno nascita", correct: false },
        { text: "Stessa per tutti i siti", correct: false }
          ]
        ),
        Q(
          "MFA (2FA) aggiunge:",
          "Secondo fattore oltre alla password: qualcosa che hai o sei.",
          [
        { text: "Solo complessità password", correct: false },
        { text: "Secondo fattore (app, token, biometria)", correct: true },
        { text: "Solo captcha", correct: false },
        { text: "Niente", correct: false }
          ]
        ),
        Q(
          "Dove conservare password aziendali/personali?",
          "Password manager crittografato con MFA.",
          [
        { text: "Post-it sul monitor", correct: false },
        { text: "Password manager crittografato", correct: true },
        { text: "File Excel su Desktop", correct: false },
        { text: "Chat con sé stessi", correct: false }
          ]
        ),
        Q(
          "OTP via SMS è:",
          "Meglio di niente, ma app/hardware token resistono meglio a SIM swap.",
          [
        { text: "Sempre superiore a app authenticator", correct: false },
        { text: "Utile ma meno robusto di app/token hardware vs SIM swap", correct: true },
        { text: "Inutile", correct: false },
        { text: "Uguale a password sola", correct: false }
          ]
        ),
        Q(
          "Credential stuffing sfrutta:",
          "Riutilizzo password violate su altri siti.",
          [
        { text: "Bug fisici", correct: false },
        { text: "Stesse password riusate dopo data breach", correct: true },
        { text: "Solo USB", correct: false },
        { text: "Solo fax", correct: false }
          ]
        ),
        Q(
          "Passkey (FIDO2) tende a:",
          "Autenticazione phishing-resistant con chiavi crittografiche.",
          [
        { text: "Essere password scritte su carta", correct: false },
        { text: "Ridurre phishing con chiavi legate al dispositivo/servizio", correct: true },
        { text: "Sostituire backup", correct: false },
        { text: "Disabilitare HTTPS", correct: false }
          ]
        ),
        Q(
          "Politica aziendale: rotazione forzata ogni 30 giorni senza motivo:",
          "NIST e best practice favoriscono password lunghe e breach-driven change.",
          [
        { text: "Sempre obbligatoria", correct: false },
        { text: "Spesso sconsigliata se induce password deboli prevedibili", correct: true },
        { text: "Sostituisce MFA", correct: false },
        { text: "Elimina phishing", correct: false }
          ]
        ),
      ],
    },
    'crypto-hashing': {
      id: 'crypto-hashing',
      name: "Crittografia & Hash",
      pillar: 'tech',
      icon: '⬢',
      accent: '#a78bfa',
      description: "Simmetrica, asimmetrica, hash, firme digitali.",
      questions: [
        Q(
          "Hash crittografico (SHA-256) è:",
          "Funzione unidirezionale: impronta dati, non reversibile per ottenere input.",
          [
        { text: "Crittografia reversibile", correct: false },
        { text: "Impronta unidirezionale dei dati", correct: true },
        { text: "Password in chiaro", correct: false },
        { text: "Protocollo email", correct: false }
          ]
        ),
        Q(
          "AES simmetrico significa:",
          "Stessa chiave per cifrare e decifrare; veloce per grandi volumi.",
          [
        { text: "Chiavi pubblica/privata diverse per cifrare/decifrare messaggio", correct: false },
        { text: "Stessa chiave segreta per cifratura e decifratura", correct: true },
        { text: "Solo firma", correct: false },
        { text: "Solo hash", correct: false }
          ]
        ),
        Q(
          "RSA/ECC sono usati principalmente per:",
          "Scambio chiavi, firme digitali, certificati TLS.",
          [
        { text: "Solo compressione", correct: false },
        { text: "Crittografia asimmetrica e firme", correct: true },
        { text: "Solo antivirus", correct: false },
        { text: "Formattazione disco", correct: false }
          ]
        ),
        Q(
          "Salt nel hashing password serve a:",
          "Rendere rainbow table inefficaci con valore casuale per utente.",
          [
        { text: "Rendere password più corte", correct: false },
        { text: "Impedire attacchi con tabelle precompute", correct: true },
        { text: "Eliminare MFA", correct: false },
        { text: "Pubblicare hash", correct: false }
          ]
        ),
        Q(
          "TLS su sito web protegge principalmente:",
          "Riservatezza e integrità in transito tra client e server.",
          [
        { text: "Solo server da virus", correct: false },
        { text: "Traffico in transito tra browser e server", correct: true },
        { text: "Database a riposo automaticamente", correct: false },
        { text: "Utente da phishing", correct: false }
          ]
        ),
        Q(
          "Firma digitale garantisce:",
          "Autenticità e integrità del messaggio/documento.",
          [
        { text: "Anonimato totale", correct: false },
        { text: "Chi ha firmato e che non sia stato alterato", correct: true },
        { text: "Velocità internet", correct: false },
        { text: "Eliminazione malware", correct: false }
          ]
        ),
        Q(
          "MD5 per nuove applicazioni di sicurezza:",
          "Collisioni note: non usare per sicurezza; preferire SHA-256 o superiore.",
          [
        { text: "Raccomandato", correct: false },
        { text: "Sconsigliato per sicurezza", correct: true },
        { text: "Obbligatorio PCI", correct: false },
        { text: "Uguale a AES", correct: false }
          ]
        ),
        Q(
          "End-to-end encryption (E2EE) in chat significa:",
          "Solo i terminali conversano in chiaro; provider non legge contenuti.",
          [
        { text: "Solo password sul server", correct: false },
        { text: "Messaggi leggibili solo dai partecipanti", correct: true },
        { text: "Nessuna crittografia", correct: false },
        { text: "Solo HTTPS al login", correct: false }
          ]
        ),
      ],
    },
    'network-basics': {
      id: 'network-basics',
      name: "Reti: Fondamenti",
      pillar: 'tech',
      icon: '◉',
      accent: '#22d3ee',
      description: "TCP/IP, firewall, VPN, segmentazione.",
      questions: [
        Q(
          "Firewall stateful controlla principalmente:",
          "Traffico in base a regole, stato connessioni, porte e IP.",
          [
        { text: "Solo temperatura CPU", correct: false },
        { text: "Traffico di rete secondo policy", correct: true },
        { text: "Ortografia email", correct: false },
        { text: "Colore cavi", correct: false }
          ]
        ),
        Q(
          "VPN aziendale serve a:",
          "Tunnel cifrato per accesso remoto sicuro alle risorse interne.",
          [
        { text: "Accelerare gaming", correct: false },
        { text: "Connessione remota cifrata alla rete aziendale", correct: true },
        { text: "Sostituire MFA", correct: false },
        { text: "Pubblicare password", correct: false }
          ]
        ),
        Q(
          "Porta 443 è tipicamente usata per:",
          "HTTPS traffico web cifrato.",
          [
        { text: "FTP in chiaro", correct: false },
        { text: "HTTPS", correct: true },
        { text: "Telnet", correct: false },
        { text: "SMTP senza TLS", correct: false }
          ]
        ),
        Q(
          "Segmentazione di rete mira a:",
          "Limitare movimento laterale dell'attaccante.",
          [
        { text: "Aumentare un unico flat network", correct: false },
        { text: "Isolare zone per contenere compromissioni", correct: true },
        { text: "Eliminare log", correct: false },
        { text: "Disabilitare patch", correct: false }
          ]
        ),
        Q(
          "DNS poisoning può portare a:",
          "Reindirizzamento a siti malevoli risolvendo nomi falsi.",
          [
        { text: "Backup automatico", correct: false },
        { text: "Utenti inviati a server fraudolenti", correct: true },
        { text: "MFA più forte", correct: false },
        { text: "Crittografia disco", correct: false }
          ]
        ),
        Q(
          "Indirizzo IP privato (es. 10.x) è:",
          "Non routabile su Internet pubblico; uso interno LAN.",
          [
        { text: "Sempre esposto su Internet", correct: false },
        { text: "Usato in reti locali non direttamente internet-routable", correct: true },
        { text: "Solo IPv6", correct: false },
        { text: "Hash password", correct: false }
          ]
        ),
        Q(
          "Zero Trust in rete implica:",
          "Verificare ogni accesso, non fidarsi solo del perimetro.",
          [
        { text: "Nessun controllo interno", correct: false },
        { text: "Verifica continua identità e contesto", correct: true },
        { text: "Solo antivirus", correct: false },
        { text: "Rete aperta", correct: false }
          ]
        ),
        Q(
          "MITM su Wi-Fi pubblico si mitiga con:",
          "VPN, HTTPS, evitare login sensibili su reti non fidate.",
          [
        { text: "HTTP senza login", correct: false },
        { text: "VPN e HTTPS, evitare transazioni su Wi-Fi aperto", correct: true },
        { text: "Condividere password Wi-Fi", correct: false },
        { text: "Disattivare firewall", correct: false }
          ]
        ),
      ],
    },
    'owasp-web': {
      id: 'owasp-web',
      name: "Sicurezza Web (OWASP)",
      pillar: 'tech',
      icon: '🌐',
      accent: '#818cf8',
      description: "Injection, XSS, CSRF, broken access control.",
      questions: [
        Q(
          "SQL injection sfrutta:",
          "Input non validato concatenato in query SQL.",
          [
        { text: "Cavi Ethernet", correct: false },
        { text: "Input utente inserito in query SQL senza sanitizzazione", correct: true },
        { text: "Solo CSS", correct: false },
        { text: "Backup tape", correct: false }
          ]
        ),
        Q(
          "XSS (Cross-Site Scripting) permette di:",
          "Eseguire script nel browser della vittima nel contesto del sito.",
          [
        { text: "Solo leggere log server", correct: false },
        { text: "Iniettare script eseguiti nel browser utente", correct: true },
        { text: "Formattare SSD", correct: false },
        { text: "Cambiare DNS root", correct: false }
          ]
        ),
        Q(
          "CSRF protegge principalmente contro:",
          "Azioni non volute su sito dove la vittima è autenticata.",
          [
        { text: "Brute force offline", correct: false },
        { text: "Richieste forgiate che sfruttano sessione attiva", correct: true },
        { text: "Furto fisico laptop", correct: false },
        { text: "Ransomware", correct: false }
          ]
        ),
        Q(
          "Broken Access Control significa:",
          "Utenti accedono a risorse oltre i permessi previsti.",
          [
        { text: "Firewall spento", correct: false },
        { text: "Accesso non autorizzato a dati/funzioni", correct: true },
        { text: "Solo lentezza", correct: false },
        { text: "Certificato scaduto solo estetico", correct: false }
          ]
        ),
        Q(
          "Content Security Policy (CSP) aiuta contro:",
          "Limita origini script e risorse, riducendo XSS.",
          [
        { text: "Solo spam fax", correct: false },
        { text: "XSS limitando fonti di script/contenuti", correct: true },
        { text: "SIM swap", correct: false },
        { text: "Tailgating", correct: false }
          ]
        ),
        Q(
          "Security misconfiguration include:",
          "Default password, directory listing, debug in produzione.",
          [
        { text: "Solo phishing", correct: false },
        { text: "Default credenziali, servizi inutili esposti, debug attivo", correct: true },
        { text: "Solo MFA", correct: false },
        { text: "Hash bcrypt", correct: false }
          ]
        ),
        Q(
          "Validazione input lato server è necessaria perché:",
          "Il client può essere bypassato; il server deve validare sempre.",
          [
        { text: "Il browser è inviolabile", correct: false },
        { text: "L'attaccante controlla il client e può inviare dati arbitrari", correct: true },
        { text: "Solo per grafica", correct: false },
        { text: "Sostituisce TLS", correct: false }
          ]
        ),
        Q(
          "OWASP Top 10 è:",
          "Lista delle criticità web più rilevanti per sviluppatori e security.",
          [
        { text: "Lista hardware", correct: false },
        { text: "Classifica rischi applicativi web più critici", correct: true },
        { text: "Standard Wi-Fi", correct: false },
        { text: "Protocollo email", correct: false }
          ]
        ),
      ],
    },
    'cloud-security': {
      id: 'cloud-security',
      name: "Sicurezza Cloud",
      pillar: 'tech',
      icon: '☁',
      accent: '#60a5fa',
      description: "Shared responsibility, IAM, storage, logging.",
      questions: [
        Q(
          "Modello shared responsibility in cloud:",
          "Provider protegge infrastruttura; cliente configura e dati.",
          [
        { text: "Provider fa tutto incluso dati", correct: false },
        { text: "Divisione: provider infra, cliente dati e configurazione", correct: true },
        { text: "Cliente zero responsabilità", correct: false },
        { text: "Solo on-premise", correct: false }
          ]
        ),
        Q(
          "Bucket S3 pubblico per errore espone:",
          "Dati accessibili da Internet senza autenticazione.",
          [
        { text: "Solo log", correct: false },
        { text: "Possibile esfiltrazione massiva di dati", correct: true },
        { text: "Niente se c'è HTTPS", correct: false },
        { text: "Solo CPU", correct: false }
          ]
        ),
        Q(
          "Principio least privilege in IAM:",
          "Permessi minimi necessari per il compito.",
          [
        { text: "Admin a tutti", correct: false },
        { text: "Solo permessi strettamente necessari", correct: true },
        { text: "Nessun audit", correct: false },
        { text: "Chiavi root condivise", correct: false }
          ]
        ),
        Q(
          "MFA sulla console cloud amministrativa:",
          "Riduce compromissione account con credenziali rubate.",
          [
        { text: "Inutile", correct: false },
        { text: "Fortemente raccomandato", correct: true },
        { text: "Sostituisce backup", correct: false },
        { text: "Vieta logging", correct: false }
          ]
        ),
        Q(
          "Logging e monitoring in cloud servono a:",
          "Rilevare accessi anomali e incidenti.",
          [
        { text: "Decorazione", correct: false },
        { text: "Detection, forensics e compliance", correct: true },
        { text: "Solo fatturazione", correct: false },
        { text: "Eliminare patch", correct: false }
          ]
        ),
        Q(
          "Secrets in codice su repository pubblico:",
          "Scanner e attaccanti li trovano rapidamente: usare secret manager.",
          [
        { text: "Sicuro se repo privato un giorno", correct: false },
        { text: "Alto rischio: ruotare e usare vault/secret manager", correct: true },
        { text: "Best practice", correct: false },
        { text: "Solo in commenti", correct: false }
          ]
        ),
        Q(
          "Container security include:",
          "Immagini aggiornate, scan vulnerabilità, non root di default.",
          [
        { text: "Solo password deboli", correct: false },
        { text: "Patch immagini, least privilege, scan CVE", correct: true },
        { text: "Disabilitare TLS", correct: false },
        { text: "Privilegi root sempre", correct: false }
          ]
        ),
        Q(
          "Data residency/regolamento in cloud richiede:",
          "Sapere dove risiedono i dati e contratti conformi (es. GDPR).",
          [
        { text: "Ignorare regione", correct: false },
        { text: "Scelta regione e DPA conformi ai requisiti legali", correct: true },
        { text: "Solo USA sempre", correct: false },
        { text: "Nessun contratto", correct: false }
          ]
        ),
      ],
    },
    'privacy-gdpr': {
      id: 'privacy-gdpr',
      name: "Privacy & GDPR",
      pillar: 'intel',
      icon: '⚖',
      accent: '#c084fc',
      description: "Diritti interessato, basi giuridiche, DPO, breach.",
      questions: [
        Q(
          "GDPR si applica principalmente a:",
          "Trattamento dati personali di persone nell'UE/SEE con alcuni extraterritorialità.",
          [
        { text: "Solo siti .com USA", correct: false },
        { text: "Dati personali di persone in UE/SEE e organizzazioni che li trattano", correct: true },
        { text: "Solo email", correct: false },
        { text: "Solo governi", correct: false }
          ]
        ),
        Q(
          "Dato personale è:",
          "Qualsiasi info che identifica o rende identificabile una persona.",
          [
        { text: "Solo DNA", correct: false },
        { text: "Nome, email, IP, ID che identificano persona", correct: true },
        { text: "Solo password hash pubblico", correct: false },
        { text: "Solo meteo", correct: false }
          ]
        ),
        Q(
          "Diritto all'oblio (cancellazione) permette:",
          "Richiedere cancellazione in casi previsti dal regolamento.",
          [
        { text: "Cancellare qualsiasi dato sempre senza eccezioni", correct: false },
        { text: "Cancellazione quando applicabile per legge", correct: true },
        { text: "Solo per aziende USA", correct: false },
        { text: "Eliminare log obbligatori sempre", correct: false }
          ]
        ),
        Q(
          "Data breach notificabile all'autorità entro:",
          "72 ore dalla consapevolezza se rischio per diritti (salvo eccezioni).",
          [
        { text: "1 anno", correct: false },
        { text: "72 ore dalla consapevolezza (se richiesto)", correct: true },
        { text: "Mai", correct: false },
        { text: "Solo se chiesto da hacker", correct: false }
          ]
        ),
        Q(
          "Base giuridica trattamento può essere:",
          "Consenso, contratto, obbligo legale, interesse legittimo, ecc.",
          [
        { text: "Solo \"perché voglio\"", correct: false },
        { text: "Consenso, contratto, obbligo legale, interesse legittimo tra altre", correct: true },
        { text: "Solo marketing senza opt-out", correct: false },
        { text: "Nessuna", correct: false }
          ]
        ),
        Q(
          "Privacy by design significa:",
          "Integrare protezione dati fin dalla progettazione.",
          [
        { text: "Aggiungere privacy solo dopo breach", correct: false },
        { text: "Protezione dati fin dalla fase di design", correct: true },
        { text: "Solo cookie banner", correct: false },
        { text: "Eliminare log", correct: false }
          ]
        ),
        Q(
          "DPO è obbligatorio quando:",
          "Organizzazioni pubbliche o trattamenti su larga scala sensibili/monitoraggio.",
          [
        { text: "Mai", correct: false },
        { text: "In casi previsti (PA, larga scala dati sensibili, monitoraggio sistematico)", correct: true },
        { text: "Solo startup 2 persone sempre", correct: false },
        { text: "Solo cloud", correct: false }
          ]
        ),
        Q(
          "Minimizzazione dati implica:",
          "Raccogliere solo quanto necessario per lo scopo.",
          [
        { text: "Raccogliere tutto possibile", correct: false },
        { text: "Limitare dati a quanto strettamente necessario", correct: true },
        { text: "Vendere dati liberamente", correct: false },
        { text: "Conservare per sempre", correct: false }
          ]
        ),
      ],
    },
    'incident-response': {
      id: 'incident-response',
      name: "Incident Response",
      pillar: 'defend',
      icon: '🚨',
      accent: '#fbbf24',
      description: "Preparazione, contenimento, eradicazione, lessons learned.",
      questions: [
        Q(
          "Prima fase IR (NIST/SANS) spesso include:",
          "Preparazione: playbook, contatti, tool, formazione.",
          [
        { text: "Pagare riscatto senza policy", correct: false },
        { text: "Preparazione e pianificazione", correct: true },
        { text: "Cancellare tutti i log", correct: false },
        { text: "Comunicare su social", correct: false }
          ]
        ),
        Q(
          "Contenimento in incidente malware:",
          "Isolare sistemi per fermare propagazione.",
          [
        { text: "Lasciare tutto online", correct: false },
        { text: "Isolare host/segmenti affetti", correct: true },
        { text: "Formattare tutta l'azienda subito", correct: false },
        { text: "Ignorare", correct: false }
          ]
        ),
        Q(
          "Preservare evidenze forensi significa:",
          "Log, immagini disco, timestamp prima di sovrascrivere.",
          [
        { text: "Spegnere e cancellare tutto", correct: false },
        { text: "Acquisire log e immagini secondo procedura", correct: true },
        { text: "Post su forum", correct: false },
        { text: "Riavviare ripetutamente", correct: false }
          ]
        ),
        Q(
          "Comunicazione durante breach dati personali:",
          "Seguire legge, DPO, legale; messaggi chiari agli interessati se richiesto.",
          [
        { text: "Nascosto fino a leak stampa", correct: false },
        { text: "Coordinamento legale/DPO e notifiche previste", correct: true },
        { text: "Solo meme", correct: false },
        { text: "Email da hacker", correct: false }
          ]
        ),
        Q(
          "Lesson learned si fa:",
          "Dopo l'incidente per migliorare controlli e playbook.",
          [
        { text: "Mai", correct: false },
        { text: "Post-incident review per migliorare difese", correct: true },
        { text: "Prima dell'attacco", correct: false },
        { text: "Solo per marketing", correct: false }
          ]
        ),
        Q(
          "Ransomware: pagare il riscatto:",
          "Policy aziendale e legale; pagamento non garantisce recupero né stop attacco.",
          [
        { text: "Sempre obbligatorio", correct: false },
        { text: "Decisione policy/legale; non garantisce recupero", correct: true },
        { text: "Sostituisce backup", correct: false },
        { text: "Elimina malware automaticamente", correct: false }
          ]
        ),
        Q(
          "SOC riceve allarme phishing interno. Priorità:",
          "Valutare scope, bloccare indicatori, awareness.",
          [
        { text: "Ignorare", correct: false },
        { text: "Analizzare scope, bloccare IoC, informare utenti", correct: true },
        { text: "Cancellare mailbox globale", correct: false },
        { text: "Disattivare Internet", correct: false }
          ]
        ),
        Q(
          "Tabletop exercise serve a:",
          "Simulare incidenti per testare playbook senza crisi reale.",
          [
        { text: "Giocare a scacchi", correct: false },
        { text: "Esercitare risposta a scenari ipotetici", correct: true },
        { text: "Solo vendita software", correct: false },
        { text: "Eliminare MFA", correct: false }
          ]
        ),
      ],
    },
    'secure-browsing': {
      id: 'secure-browsing',
      name: "Navigazione Sicura",
      pillar: 'defend',
      icon: '🛡',
      accent: '#4ade80',
      description: "Estensioni, cookie, download, aggiornamenti.",
      questions: [
        Q(
          "Email sospetta con link al sito banca. Azione sicura:",
          "Aprire sito digitando URL, non cliccare link.",
          [
        { text: "Cliccare link", correct: false },
        { text: "Digitare URL ufficiale nella barra indirizzi", correct: true },
        { text: "Rispondere con password", correct: false },
        { text: "Cliccare se ben formattata", correct: false }
          ]
        ),
        Q(
          "Hai cliccato per errore link phishing. Subito:",
          "Cambia password da dispositivo pulito e monitora account.",
          [
        { text: "Aspettare", correct: false },
        { text: "Cambia password da dispositivo sicuro e monitora", correct: true },
        { text: "Formattare tutto senza altro", correct: false },
        { text: "Nulla se non hai digitato", correct: false }
          ]
        ),
        Q(
          "Download software: fonte più sicura:",
          "Sito ufficiale o store gestito, non pop-up random.",
          [
        { text: "Pop-up \"aggiorna flash\"", correct: false },
        { text: "Sito ufficiale editore o store certificato", correct: true },
        { text: "Forum pirata", correct: false },
        { text: "Email allegato exe", correct: false }
          ]
        ),
        Q(
          "Aggiornamenti browser e OS:",
          "Patchano vulnerabilità sfruttabili da malware.",
          [
        { text: "Opzionali e inutili", correct: false },
        { text: "Importanti per chiudere vulnerabilità", correct: true },
        { text: "Rallentano solo", correct: false },
        { text: "Da evitare sempre", correct: false }
          ]
        ),
        Q(
          "Cookie di terze parti e tracking:",
          "Limitare con impostazioni browser e policy privacy.",
          [
        { text: "Sempre necessari per sicurezza", correct: false },
        { text: "Gestire consenso e bloccare tracker non necessari", correct: true },
        { text: "Sostituiscono antivirus", correct: false },
        { text: "Obbligatori per login banca", correct: false }
          ]
        ),
        Q(
          "Estensione browser chiede accesso a tutte le pagine:",
          "Valutare necessità; rischio se da fonte non fidata.",
          [
        { text: "Sempre installare", correct: false },
        { text: "Installare solo da fonti fidate e permessi minimi", correct: true },
        { text: "Disabilita HTTPS", correct: false },
        { text: "Condivide password", correct: false }
          ]
        ),
        Q(
          "Sito mostra lucchetto ma certificato per altro dominio:",
          "Possibile MITM o configurazione errata: non procedere.",
          [
        { text: "Procedere", correct: false },
        { text: "Non procedere: errore certificato sospetto", correct: true },
        { text: "Ignorare sempre", correct: false },
        { text: "Inserire dati", correct: false }
          ]
        ),
        Q(
          "Navigazione in incognito:",
          "Non rende anonimi su rete; non salva storico locale.",
          [
        { text: "Nasconde da ISP e employer sempre", correct: false },
        { text: "Non salva storico locale ma non è anonimato completo", correct: true },
        { text: "Blocca tutti i malware", correct: false },
        { text: "Sostituisce VPN aziendale", correct: false }
          ]
        ),
      ],
    },
    'insider-threats': {
      id: 'insider-threats',
      name: "Insider Threat",
      pillar: 'intel',
      icon: '👤',
      accent: '#f97316',
      description: "Maliziosi, negligenza, furto dati, UEBA.",
      questions: [
        Q(
          "Insider threat può essere:",
          "Dipendente malevolo, negligente o account compromesso interno.",
          [
        { text: "Solo hacker esterni", correct: false },
        { text: "Persona interna o account interno abusato", correct: true },
        { text: "Solo DDoS", correct: false },
        { text: "Solo phishing", correct: false }
          ]
        ),
        Q(
          "Segnale possibile insider data exfiltration:",
          "Download massivi, accessi fuori orario, USB non autorizzate.",
          [
        { text: "Un solo login normale", correct: false },
        { text: "Accesso anomalo a dati sensibili e volumi insoliti", correct: true },
        { text: "Schermo spento", correct: false },
        { text: "Patch Tuesday", correct: false }
          ]
        ),
        Q(
          "Principio need-to-know:",
          "Accesso ai dati solo se necessario per il ruolo.",
          [
        { text: "Tutti vedono tutto", correct: false },
        { text: "Accesso limitato al necessario per mansione", correct: true },
        { text: "Admin condiviso", correct: false },
        { text: "Nessun log", correct: false }
          ]
        ),
        Q(
          "Offboarding dipendente deve includere:",
          "Revoca accessi, recupero asset, cambio password condivise.",
          [
        { text: "Lasciare account attivi", correct: false },
        { text: "Disabilitare account e recuperare dispositivi", correct: true },
        { text: "Condividere password team", correct: false },
        { text: "Nessuna azione", correct: false }
          ]
        ),
        Q(
          "UEBA aiuta a:",
          "Rilevare comportamenti utente anomali rispetto al baseline.",
          [
        { text: "Solo marketing", correct: false },
        { text: "Identificare anomalie comportamentali", correct: true },
        { text: "Sostituire firewall", correct: false },
        { text: "Eliminare MFA", correct: false }
          ]
        ),
        Q(
          "Segnalazione whistleblowing etica:",
          "Canale confidenziale per comportamenti illeciti o rischiosi.",
          [
        { text: "Da evitare sempre", correct: false },
        { text: "Usare canali aziendali previsti per segnalazioni", correct: true },
        { text: "Solo social pubblico", correct: false },
        { text: "Minacciare il collega", correct: false }
          ]
        ),
        Q(
          "Negligent insider esempio:",
          "Invio PII al destinatario sbagliato o laptop smarrito senza cifratura.",
          [
        { text: "Attacco nation-state solo", correct: false },
        { text: "Errore umano che espone dati", correct: true },
        { text: "Solo ransomware", correct: false },
        { text: "Solo tailgating", correct: false }
          ]
        ),
        Q(
          "DLP (Data Loss Prevention) monitora:",
          "Uscita non autorizzata di dati sensibili da canali aziendali.",
          [
        { text: "Solo temperatura", correct: false },
        { text: "Trasferimenti/email/cloud con dati classificati", correct: true },
        { text: "Colore desktop", correct: false },
        { text: "Luminosità", correct: false }
          ]
        ),
      ],
    },
    'iot-smart': {
      id: 'iot-smart',
      name: "IoT & Smart Device",
      pillar: 'tech',
      icon: '📡',
      accent: '#2dd4bf',
      description: "Default password, firmware, rete domestica.",
      questions: [
        Q(
          "Router domestico default password admin:",
          "Cambiare subito; credenziali note sono sfruttate da botnet.",
          [
        { text: "Lasciare admin/admin", correct: false },
        { text: "Cambiare con password forte unica", correct: true },
        { text: "Scriverla su sticker esterno", correct: false },
        { text: "Disabilitare WPA3", correct: false }
          ]
        ),
        Q(
          "Aggiornamenti firmware dispositivi IoT:",
          "Spesso ignorati ma chiudono vulnerabilità remote.",
          [
        { text: "Inutili", correct: false },
        { text: "Importanti quando disponibili dal produttore", correct: true },
        { text: "Solo estetici", correct: false },
        { text: "Vietati", correct: false }
          ]
        ),
        Q(
          "Telecamera IP esposta su Internet con password default:",
          "Accesso remoto non autorizzato e streaming abusivo.",
          [
        { text: "Sempre sicuro", correct: false },
        { text: "Alto rischio di compromissione e spionaggio", correct: true },
        { text: "Obbligatorio per cloud", correct: false },
        { text: "Solo problema estetico", correct: false }
          ]
        ),
        Q(
          "Rete guest per ospiti e IoT serve a:",
          "Segmentare dispositivi meno affidabili dal PC principale.",
          [
        { text: "Rallentare tutto", correct: false },
        { text: "Isolare IoT/ospiti dalla rete principale", correct: true },
        { text: "Condividere password admin", correct: false },
        { text: "Eliminare Wi-Fi", correct: false }
          ]
        ),
        Q(
          "MQTT/IoT senza TLS:",
          "Traffico leggibile e modificabile in rete.",
          [
        { text: "Più sicuro", correct: false },
        { text: "Espone comandi e dati in chiaro", correct: true },
        { text: "Obbligatorio GDPR", correct: false },
        { text: "Solo per blockchain", correct: false }
          ]
        ),
        Q(
          "Botnet IoT (es. Mirai) sfrutta spesso:",
          "Telnet/SSH con password default su dispositivi.",
          [
        { text: "Schermi OLED", correct: false },
        { text: "Credenziali default e servizi esposti", correct: true },
        { text: "Solo iPhone aggiornati", correct: false },
        { text: "MFA hardware", correct: false }
          ]
        ),
        Q(
          "Prima di acquistare dispositivo smart:",
          "Verificare policy privacy, aggiornamenti e reputazione sicurezza.",
          [
        { text: "Solo il prezzo più basso", correct: false },
        { text: "Valutare supporto patch, privacy e recensioni sicurezza", correct: true },
        { text: "Solo colore", correct: false },
        { text: "Ignorare EOL", correct: false }
          ]
        ),
        Q(
          "Dispositivo IoT non più supportato dal vendor:",
          "Isolare, sostituire o rimuovere dalla rete sensibile.",
          [
        { text: "Esporre su DMZ produzione", correct: false },
        { text: "Isolare o dismettere: rischio vulnerabilità non patchate", correct: true },
        { text: "Collegare a dominio admin", correct: false },
        { text: "Condividere VPN aziendale", correct: false }
          ]
        ),
      ],
    },
  };

  window.QUIZ_HUB = { PILLARS, CATEGORIES, version: 1 };
})();

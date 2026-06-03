/**
 * Espansione catalogo Centro Quiz — categorie strumenti EVIL + profondità su aree core.
 * Caricare dopo quiz-hub-data.js
 */
(function () {
  function Q(question, explanation, options) {
    return { question, explanation, options };
  }

  const hub = window.QUIZ_HUB;
  if (!hub?.CATEGORIES) return;

  const MORE = {
    'phishing-email': [
      Q(
        "Header SPF/DKIM/DMARC falliti in un'email apparentemente aziendale:",
        "Indicano possibile spoofing: non fidarsi solo al mittente visualizzato.",
        [
          { text: "Garantiscono autenticità", correct: false },
          { text: "Segnalano possibile falsificazione del mittente", correct: true },
          { text: "Rendono l'allegato sicuro", correct: false },
          { text: "Bloccano sempre il malware", correct: false },
        ]
      ),
      Q(
        "Spear phishing rispetto al phishing di massa:",
        "Target selezionato con messaggio personalizzato (nome, ruolo, progetto).",
        [
          { text: "È sempre generico", correct: false },
          { text: "Colpisce individui/aziende specifiche con contenuto su misura", correct: true },
          { text: "Non usa email", correct: false },
          { text: "Richiede solo SMS", correct: false },
        ]
      ),
      Q(
        "QR code in email \"scansiona per il bonus\":",
        "Può nascondere URL malevoli; stessa cautela dei link testuali.",
        [
          { text: "I QR sono sempre sicuri", correct: false },
          { text: "Può portare a siti phishing: verificare prima di aprire", correct: true },
          { text: "Sostituisce MFA", correct: false },
          { text: "È solo marketing legittimo", correct: false },
        ]
      ),
      Q(
        "Mittente display name \"CEO Mario Rossi\" ma dominio @mail-service.xyz:",
        "Il nome visualizzato è spoofabile; conta il dominio reale dell'indirizzo.",
        [
          { text: "Basta il nome per fidarsi", correct: false },
          { text: "Controllare dominio email reale, non solo il nome mostrato", correct: true },
          { text: "Tutti i domini .xyz sono banca", correct: false },
          { text: "Il logo nel corpo basta", correct: false },
        ]
      ),
      Q(
        "Policy aziendale ideale su allegati da esterni:",
        "Sandbox, blocchi estensioni rischiose e segnalazione centralizzata.",
        [
          { text: "Aprire sempre per verificare", correct: false },
          { text: "Bloccare/esaminare in sandbox e segnalare sospetti al SOC", correct: true },
          { text: "Inoltrare a tutti", correct: false },
          { text: "Disabilitare antivirus", correct: false },
        ]
      ),
    ],
    'malware-ransomware': [
      Q(
        "Double extortion nel ransomware moderno:",
        "Oltre alla cifratura, minaccia pubblicazione dati rubati.",
        [
          { text: "Chiede solo un pagamento senza furto dati", correct: false },
          { text: "Cifra e minaccia leak dei dati exfiltrati", correct: true },
          { text: "È solo un antivirus", correct: false },
          { text: "Colpisce solo stampanti", correct: false },
        ]
      ),
      Q(
        "Fileless malware spesso:",
        "Usa PowerShell/WMI/script in memoria senza file .exe classico su disco.",
        [
          { text: "Richiede sempre .exe visibile", correct: false },
          { text: "Sfrutta script e memoria, difficile da rilevare con sole signature file", correct: true },
          { text: "Non tocca processi", correct: false },
          { text: "È solo hardware", correct: false },
        ]
      ),
      Q(
        "Indicator of Compromise (IoC) utile post-infezione:",
        "Hash file, domini C2, IP, chiavi registry anomale per hunting.",
        [
          { text: "Solo colore wallpaper", correct: false },
          { text: "Hash, domini/IP C2, percorsi noti da threat intel", correct: true },
          { text: "Lunghezza password utente", correct: false },
          { text: "Marca del mouse", correct: false },
        ]
      ),
      Q(
        "EDR rispetto ad antivirus tradizionale:",
        "Monitora comportamento endpoint (processi, rete) oltre signature statiche.",
        [
          { text: "Solo blocca .txt", correct: false },
          { text: "Analisi comportamentale e telemetria sull'endpoint", correct: true },
          { text: "Sostituisce backup", correct: false },
          { text: "Elimina bisogno di patch", correct: false },
        ]
      ),
      Q(
        "Prima di ripristinare backup dopo ransomware:",
        "Verificare che l'attore non sia ancora presente e che il backup non sia contaminato.",
        [
          { text: "Ripristinare subito senza indagine", correct: false },
          { text: "Eradicare accesso attaccante e validare integrità backup", correct: true },
          { text: "Pagare e sperare", correct: false },
          { text: "Ignorare log", correct: false },
        ]
      ),
    ],
    'owasp-web': [
      Q(
        "Local File Inclusion (LFI) permette:",
        "Leggere file locali sul server tramite parametri non validati.",
        [
          { text: "Solo cambiare CSS", correct: false },
          { text: "Includere/leggere path locali (es. ../../../../etc/passwd)", correct: true },
          { text: "Solo brute force Wi-Fi", correct: false },
          { text: "Cifrare TLS", correct: false },
        ]
      ),
      Q(
        "SSRF (Server-Side Request Forgery):",
        "Il server effettua richieste verso URL interni scelti dall'attaccante.",
        [
          { text: "Solo attacco al browser vittima", correct: false },
          { text: "Forza il backend a contattare risorse interne/cloud metadata", correct: true },
          { text: "È phishing email", correct: false },
          { text: "Sostituisce MFA", correct: false },
        ]
      ),
      Q(
        "JWT con algoritmo \"none\" accettato dal server:",
        "Bypass firma: vulnerabilità critica di configurazione.",
        [
          { text: "Migliora sicurezza", correct: false },
          { text: "Permette token non firmati se non rifiutati esplicitamente", correct: true },
          { text: "È standard OWASP consigliato", correct: false },
          { text: "Solo estetico", correct: false },
        ]
      ),
      Q(
        "XXE (XML External Entity) può causare:",
        "Lettura file locali, SSRF o DoS tramite entità XML malformate.",
        [
          { text: "Solo errore grafico", correct: false },
          { text: "Lettura file o richieste server via parser XML non sicuro", correct: true },
          { text: "Solo su mobile", correct: false },
          { text: "Migliora performance", correct: false },
        ]
      ),
      Q(
        "Prepared statements in SQL mitigano:",
        "Separano struttura query dai dati, riducendo SQL injection.",
        [
          { text: "Solo XSS", correct: false },
          { text: "SQL injection legando parametri in modo sicuro", correct: true },
          { text: "Tailgating", correct: false },
          { text: "SIM swap", correct: false },
        ]
      ),
    ],
    'passwords-mfa': [
      Q(
        "Phishing-resistant MFA include:",
        "FIDO2/passkey e security key; evita solo OTP riusabili su siti clone.",
        [
          { text: "Password scritta in email", correct: false },
          { text: "Passkey/FIDO2 legati all'origine del sito", correct: true },
          { text: "Captcha da solo", correct: false },
          { text: "Domanda segreta \"gatto?\"", correct: false },
        ]
      ),
      Q(
        "Dopo data breach di un servizio dove usavi la stessa password:",
        "Cambiare quella password e tutte le riutilizzate altrove.",
        [
          { text: "Non fare nulla", correct: false },
          { text: "Ruotare password su quel servizio e su tutti dove era riusata", correct: true },
          { text: "Solo cambiare email display", correct: false },
          { text: "Disattivare MFA ovunque", correct: false },
        ]
      ),
      Q(
        "Recovery code MFA vanno:",
        "Conservati offline in luogo sicuro, non in chat/cloud non cifrati.",
        [
          { text: "Pubblicati su LinkedIn", correct: false },
          { text: "Archiviati offline e separati dal dispositivo MFA", correct: true },
          { text: "Inviati al manager via WhatsApp", correct: false },
          { text: "Usati come password principale", correct: false },
        ]
      ),
      Q(
        "NIST SP 800-63B suggerisce per password:",
        "Lunghezza e breach-check; evitare complessità forzata che genera pattern.",
        [
          { text: "Cambio obbligatorio ogni 7 giorni sempre", correct: false },
          { text: "Lunghezza, unicità, controllo leak; MFA dove possibile", correct: true },
          { text: "Solo 6 caratteri", correct: false },
          { text: "Stessa per tutti", correct: false },
        ]
      ),
      Q(
        "Admin condiviso \"Admin2024!\" su tutti i server:",
        "Credenziale condivisa: un leak compromette tutto l'ambiente.",
        [
          { text: "Best practice", correct: false },
          { text: "Account privilegiati individuali + vault + MFA", correct: true },
          { text: "Sostituisce patch", correct: false },
          { text: "Richiesto da GDPR", correct: false },
        ]
      ),
    ],
  };

  const NEW_CATEGORIES = {
    'dns-recon': {
      id: 'dns-recon',
      name: 'DNS & Recon',
      pillar: 'intel',
      icon: '◇',
      accent: '#38bdf8',
      description: 'Record DNS, subdomain, superficie d\'attacco — come DNS Enumerator.',
      questions: [
        Q('Record DNS MX indica principalmente:', 'Mail exchange: server che ricevono email per il dominio.', [
          { text: 'Server web HTTPS', correct: false },
          { text: 'Server di posta per il dominio', correct: true },
          { text: 'Solo CDN', correct: false },
          { text: 'Password admin', correct: false },
        ]),
        Q('Subdomain takeover avviene quando:', 'DNS punta a servizio esterno non più reclamato dall\'azienda.', [
          { text: 'TLS è valido', correct: false },
          { text: 'CNAME verso risorsa abbandonata che altri possono registrare', correct: true },
          { text: 'MX è vuoto', correct: false },
          { text: 'Si usa MFA', correct: false },
        ]),
        Q('Zone transfer AXFR non autorizzato espone:', 'Elenco completo record DNS interni/storici.', [
          { text: 'Solo logo', correct: false },
          { text: 'Mappa record DNS del dominio', correct: true },
          { text: 'Chiavi private TLS', correct: false },
          { text: 'Password utenti', correct: false },
        ]),
        Q('Wildcard DNS (*.azienda.it):', 'Qualsiasi sottodominio risolve — utile attaccanti per discovery.', [
          { text: 'Blocca tutti i subdomain', correct: false },
          { text: 'Fa risolvere sottodomini inesistenti a un IP default', correct: true },
          { text: 'È sempre vulnerabilità critica da sola', correct: false },
          { text: 'Sostituisce SPF', correct: false },
        ]),
        Q('TXT SPF serve a:', 'Indicare quali host possono inviare email per il dominio.', [
          { text: 'Cifrare il sito', correct: false },
          { text: 'Policy anti-spoofing mittente email', correct: true },
          { text: 'Accelerare CDN', correct: false },
          { text: 'Backup file', correct: false },
        ]),
        Q('Enumerazione subdomain in pentest autorizzato serve a:', 'Mappare superficie d\'attacco oltre il sito www.', [
          { text: 'Hackerare senza permesso', correct: false },
          { text: 'Trovare servizi dimenticati (dev, staging, api)', correct: true },
          { text: 'Solo marketing', correct: false },
          { text: 'Eliminare TLS', correct: false },
        ]),
        Q('Record A vs AAAA:', 'A = IPv4, AAAA = IPv6 per lo stesso hostname.', [
          { text: 'Sono identici', correct: false },
          { text: 'A punta a IPv4, AAAA a IPv6', correct: true },
          { text: 'Solo per email', correct: false },
          { text: 'Sostituiscono MX', correct: false },
        ]),
        Q('Dangling CNAME dopo shutdown SaaS:', 'Rischio takeover se non si aggiorna DNS.', [
          { text: 'Migliora sicurezza', correct: false },
          { text: 'Terzi possono reclamare il target e impersonare il subdomain', correct: true },
          { text: 'È richiesto da PCI', correct: false },
          { text: 'Blocca phishing', correct: false },
        ]),
        Q('DNS over HTTPS (DoH) per l\'utente:', 'Cifra query DNS verso resolver scelto — privacy da ISP locale.', [
          { text: 'Elimina bisogno di firewall', correct: false },
          { text: 'Protegge riservatezza query da osservatori locali', correct: true },
          { text: 'È sempre malware', correct: false },
          { text: 'Sostituisce backup', correct: false },
        ]),
        Q('Prima di testare DNS su cliente:', 'Autorizzazione scritta e scope definito (domini consentiti).', [
          { text: 'Basta curiosità', correct: false },
          { text: 'Permesso esplicito e regole di engagement', correct: true },
          { text: 'Solo di notte', correct: false },
          { text: 'Nessun limite', correct: false },
        ]),
      ],
    },
    'ssl-tls': {
      id: 'ssl-tls',
      name: 'SSL / TLS',
      pillar: 'defend',
      icon: '◆',
      accent: '#6ee7b7',
      description: 'Certificati, cipher, TLS 1.3 — allineato a SSL Analyzer.',
      questions: [
        Q('Certificato TLS scaduto su sito pubblico:', 'Browser avvisano; rischio MITM e perdita fiducia.', [
          { text: 'Migliora ranking SEO', correct: false },
          { text: 'Connessione non considerata affidabile; va rinnovato', correct: true },
          { text: 'È obbligatorio per phishing', correct: false },
          { text: 'Blocca solo email', correct: false },
        ]),
        Q('TLS 1.0 e 1.1 oggi:', 'Deprecati per vulnerabilità note; usare 1.2+ preferibilmente 1.3.', [
          { text: 'Sono lo standard consigliato', correct: false },
          { text: 'Vanno disabilitati in favore di versioni moderne', correct: true },
          { text: 'Più sicuri di 1.3', correct: false },
          { text: 'Sostituiscono MFA', correct: false },
        ]),
        Q('Certificate Transparency aiuta a:', 'Rilevare certificati emessi fraudolentemente per i tuoi domini.', [
          { text: 'Accelerare GPU', correct: false },
          { text: 'Monitorare CA che emettono cert per domini tuoi', correct: true },
          { text: 'Cifrare backup', correct: false },
          { text: 'Eliminare DNS', correct: false },
        ]),
        Q('Self-signed su sito produzione pubblico:', 'Nessuna CA fidata: utenti vedono avviso, rischio MITM.', [
          { text: 'Uguale a Let\'s Encrypt', correct: false },
          { text: 'Non catena fidata dai browser senza import manuale', correct: true },
          { text: 'Obbligatorio PCI', correct: false },
          { text: 'Impedisce XSS', correct: false },
        ]),
        Q('HSTS (HTTP Strict Transport Security):', 'Forza browser a usare HTTPS per il dominio.', [
          { text: 'Disabilita TLS', correct: false },
          { text: 'Riduce downgrade a HTTP chiaro', correct: true },
          { text: 'È un antivirus', correct: false },
          { text: 'Solo per email', correct: false },
        ]),
        Q('Perfect Forward Secrecy (PFS) significa:', 'Compromissione chiave lunga non decifra sessioni passate.', [
          { text: 'Stessa chiave per sempre', correct: false },
          { text: 'Chiavi di sessione effimere (es. ECDHE)', correct: true },
          { text: 'Niente cifratura', correct: false },
          { text: 'Solo MD5', correct: false },
        ]),
        Q('Cipher suite con NULL o EXPORT:', 'Deboli o senza cifratura: disabilitare in configurazione.', [
          { text: 'Da preferire', correct: false },
          { text: 'Vanno disabilitate — offrono poca o nessuna protezione', correct: true },
          { text: 'Richieste da OWASP per produzione', correct: false },
          { text: 'Sostituiscono WAF', correct: false },
        ]),
        Q('Mismatch nome certificato (CN/SAN):', 'Certificato valido ma hostname diverso → errore browser.', [
          { text: 'Sempre OK se HTTPS', correct: false },
          { text: 'Dominio nel cert deve corrispondere all\'URL visitato', correct: true },
          { text: 'Solo problema mobile', correct: false },
          { text: 'Indica malware desktop', correct: false },
        ]),
        Q('OCSP stapling migliora:', 'Performance e privacy verificando revoca senza query utente diretta.', [
          { text: 'Solo colori sito', correct: false },
          { text: 'Revoca certificati con meno latenza/privacy leak', correct: true },
          { text: 'Elimina bisogno di cert', correct: false },
          { text: 'È phishing', correct: false },
        ]),
        Q('Prima di analizzare SSL di terzi con EVIL SSL Analyzer:', 'Avere permesso o analizzare solo propri domini/test.', [
          { text: 'Qualsiasi banca a caso', correct: false },
          { text: 'Rispettare legge e autorizzazioni sul target', correct: true },
          { text: 'Solo VPN illegali', correct: false },
          { text: 'Nessuna regola', correct: false },
        ]),
      ],
    },
    'osint-basics': {
      id: 'osint-basics',
      name: 'OSINT',
      pillar: 'intel',
      icon: '◎',
      accent: '#fbbf24',
      description: 'Fonti aperte, profilazione, leak — Profilazione Social e Info Pubbliche.',
      questions: [
        Q('OSINT (Open Source Intelligence) è:', 'Informazioni da fonti pubbliche/legali, non accesso hackerato.', [
          { text: 'Solo malware', correct: false },
          { text: 'Dati raccolti da fonti aperte e legittime', correct: true },
          { text: 'Sempre illegale', correct: false },
          { text: 'Solo dark web', correct: false },
        ]),
        Q('Metadati EXIF in foto pubblicata possono rivelare:', 'Modello telefono, GPS, data — privacy leak.', [
          { text: 'Solo colore', correct: false },
          { text: 'Posizione, dispositivo, timestamp se non rimossi', correct: true },
          { text: 'Password Wi-Fi', correct: false },
          { text: 'Chiavi TLS', correct: false },
        ]),
        Q('Google dorking in contesto difensivo serve a:', 'Trovare esposizioni involontarie del proprio dominio.', [
          { text: 'Attaccare senza permesso', correct: false },
          { text: 'Individuare file/indici esposti da audit autorizzato', correct: true },
          { text: 'Solo spam', correct: false },
          { text: 'Cifrare disco', correct: false },
        ]),
        Q('Profilazione social per ingegneria sociale:', 'Attaccanti raccolgono hobby, colleghi, eventi da post pubblici.', [
          { text: 'Impossibile da LinkedIn', correct: false },
          { text: 'Informazioni pubbliche alimentano pretexting mirato', correct: true },
          { text: 'Solo tecniche network', correct: false },
          { text: 'Richiede sempre exploit zero-day', correct: false },
        ]),
        Q('Have I Been Pwned e servizi simili:', 'Verificano se email compare in breach noti — utile difesa.', [
          { text: 'Distribuiscono malware', correct: false },
          { text: 'Aiutano utenti a sapere se credenziali sono state esposte', correct: true },
          { text: 'Sostituiscono MFA', correct: false },
          { text: 'Sono solo per attaccanti', correct: false },
        ]),
        Q('Scraping aggressivo profili senza consenso:', 'Può violare ToS e leggi privacy — usare etica e permessi.', [
          { text: 'Sempre lecito ovunque', correct: false },
          { text: 'Rispettare termini di servizio e normative (GDPR)', correct: true },
          { text: 'Obbligatorio per PCI', correct: false },
          { text: 'Sostituisce autorizzazione pentest', correct: false },
        ]),
        Q('Wayback Machine utile per:', 'Vedere versioni storiche sito (path dimenticati, commenti).', [
          { text: 'Solo gaming', correct: false },
          { text: 'Ricostruire superficie esposta in passato', correct: true },
          { text: 'Cifrare ransomware', correct: false },
          { text: 'Generare certificati', correct: false },
        ]),
        Q('OPSEC per ricercatori:', 'Separare identità personale da account usati in indagini.', [
          { text: 'Usare stesso profilo personale ovunque', correct: false },
          { text: 'Compartimentare identità e non rivelare metodi sensibili', correct: true },
          { text: 'Pubblicare indirizzo casa', correct: false },
          { text: 'Disattivare 2FA', correct: false },
        ]),
        Q('LinkedIn \"ricerca lavoro\" da profilo falso HR:', 'Pretexting comune per malware o furto credenziali.', [
          { text: 'Sempre legittimo', correct: false },
          { text: 'Verificare identità su canali ufficiali prima di clic/link', correct: true },
          { text: 'Richiesto da NIST', correct: false },
          { text: 'Solo su fax', correct: false },
        ]),
        Q('Dati OSINT vanno:', 'Correlati e verificati — una fonte può essere obsoleta o falsa.', [
          { text: 'Creduti ciecamente', correct: false },
          { text: 'Incrociati con più fonti e data di raccolta', correct: true },
          { text: 'Pubblicati senza revisione', correct: false },
          { text: 'Usati per doxxing', correct: false },
        ]),
      ],
    },
    'file-forensics': {
      id: 'file-forensics',
      name: 'Analisi File',
      pillar: 'tech',
      icon: '▣',
      accent: '#fb923c',
      description: 'Hash, tipi MIME, sandbox — come Analisi File EVIL.',
      questions: [
        Q('Hash SHA-256 di un file serve a:', 'Identificare univocamente il file (integrità, threat intel).', [
          { text: 'Cifrare il file per invio', correct: false },
          { text: 'Confrontare con database malware/noti', correct: true },
          { text: 'Sostituire antivirus', correct: false },
          { text: 'Generare password', correct: false },
        ]),
        Q('Estensione .pdf.exe su Windows:', 'Può nascondere eseguibile — doppia estensione ingannevole.', [
          { text: 'È sempre documento sicuro', correct: false },
          { text: 'Spesso trucco per far eseguire malware', correct: true },
          { text: 'Richiesto da Adobe', correct: false },
          { text: 'Blocca ransomware', correct: false },
        ]),
        Q('MIME type reale vs estensione:', 'Il contenuto può non corrispondere all\'estensione — analizzare magic bytes.', [
          { text: 'Estensione basta sempre', correct: false },
          { text: 'Verificare tipo reale del file, non solo nome', correct: true },
          { text: 'Solo per immagini', correct: false },
          { text: 'Inutile in forensics', correct: false },
        ]),
        Q('Analisi malware in sandbox isolata:', 'Esegue campione in ambiente controllato per osservare comportamento.', [
          { text: 'Sul PC produzione utente', correct: false },
          { text: 'VM/air-gap dedicato senza rete sensibile', correct: true },
          { text: 'Via email a tutti', correct: false },
          { text: 'Solo lettura metadata', correct: false },
        ]),
        Q('ZIP password-protected da sconosciuto:', 'Può bypassare scanner email — cautela all\'estrazione.', [
          { text: 'Sempre benigno', correct: false },
          { text: 'Può nascondere payload — non estrarre su sistema prod', correct: true },
          { text: 'È firma digitale', correct: false },
          { text: 'Richiesto da HR', correct: false },
        ]),
        Q('Indicator: firma digitale valida su .exe:', 'Autentica editore ma non garantisce intento benigno se chiave rubata.', [
          { text: 'Garantisce assenza malware al 100%', correct: false },
          { text: 'Identifica publisher; software può comunque essere malevolo', correct: true },
          { text: 'È inutile', correct: false },
          { text: 'Sostituisce backup', correct: false },
        ]),
        Q('Upload file sospetto su VirusTotal:', 'Condivide campione con vendor — ok per ricerca, attenzione dati sensibili.', [
          { text: 'Sempre anonimo e privato', correct: false },
          { text: 'Utile ma il file può essere condiviso — no dati classificati', correct: true },
          { text: 'È illegale sempre', correct: false },
          { text: 'Formatta il PC', correct: false },
        ]),
        Q('LNK file (collegamento Windows) sospetto:', 'Può eseguire PowerShell nascosto al doppio clic.', [
          { text: 'Solo icona innocua', correct: false },
          { text: 'Può lanciare script malevoli — trattare come eseguibile', correct: true },
          { text: 'Solo su Linux', correct: false },
          { text: 'È certificato TLS', correct: false },
        ]),
        Q('Chain of custody in forensics:', 'Tracciare chi ha maneggiato evidenza per validità legale.', [
          { text: 'Opzionale sempre', correct: false },
          { text: 'Documentazione accessi e copie per prove', correct: true },
          { text: 'Solo per immagini JPEG', correct: false },
          { text: 'Sostituisce hash', correct: false },
        ]),
        Q('Prima di analizzare file di terzi:', 'Autorizzazione e rispetto privacy — solo campioni consentiti.', [
          { text: 'Qualsiasi PC aziendale altrui', correct: false },
          { text: 'Permesso e policy su dati personali/aziendali', correct: true },
          { text: 'Nessuna regola', correct: false },
          { text: 'Solo su social', correct: false },
        ]),
      ],
    },
    'api-security': {
      id: 'api-security',
      name: 'API Security',
      pillar: 'tech',
      icon: '⬡',
      accent: '#818cf8',
      description: 'REST, IDOR, JWT, rate limit — come i lab API del Virtual Lab.',
      questions: [
        Q('IDOR (Insecure Direct Object Reference):', 'Cambio ID nell\'URL/API accede a dati di altri utenti.', [
          { text: 'Solo problema SQL', correct: false },
          { text: 'Accesso oggetti altrui manipolando identificatori', correct: true },
          { text: 'Migliora MFA', correct: false },
          { text: 'Solo su DNS', correct: false },
        ]),
        Q('API key nel codice JavaScript frontend pubblico:', 'Esposta a chiunque — va sul backend.', [
          { text: 'Sicura se minificata', correct: false },
          { text: 'Visibile a tutti — usare proxy server-side', correct: true },
          { text: 'Meglio di OAuth', correct: false },
          { text: 'Sostituisce TLS', correct: false },
        ]),
        Q('Rate limiting su API login:', 'Riduce brute force e abuso automatizzato.', [
          { text: 'Inutile', correct: false },
          { text: 'Limita tentativi per IP/account', correct: true },
          { text: 'Peggiora XSS', correct: false },
          { text: 'Solo estetico', correct: false },
        ]),
        Q('GraphQL introspection in produzione:', 'Può esporre schema completo — spesso va disabilitata.', [
          { text: 'Sempre obbligatoria', correct: false },
          { text: 'Rivelazione eccessiva superficie se pubblica', correct: true },
          { text: 'Blocca JWT', correct: false },
          { text: 'È MFA', correct: false },
        ]),
        Q('BOLA (Broken Object Level Authorization) è:', 'Stesso concetto famiglia IDOR su API moderne.', [
          { text: 'Tipo di malware', correct: false },
          { text: 'Mancato controllo autorizzazione per oggetto', correct: true },
          { text: 'Protocollo email', correct: false },
          { text: 'Cipher TLS', correct: false },
        ]),
        Q('OAuth redirect_uri non validato:', 'Permette furto token tramite redirect malevolo.', [
          { text: 'Migliora UX solo', correct: false },
          { text: 'Attaccante può ricevere code/token su URI controllato', correct: true },
          { text: 'Sostituisce password', correct: false },
          { text: 'È hashing', correct: false },
        ]),
        Q('Verbose error API (stack trace):', 'Aiuta attaccanti a mappare tecnologia e path.', [
          { text: 'Da mostrare sempre al pubblico', correct: false },
          { text: 'Vanno messaggi generici al client, dettaglio solo in log server', correct: true },
          { text: 'Eliminano bisogno di auth', correct: false },
          { text: 'Sono PCI required', correct: false },
        ]),
        Q('mTLS tra microservizi:', 'Entrambe le parti presentano certificato — forte autenticazione.', [
          { text: 'Solo HTTP chiaro', correct: false },
          { text: 'Mutua autenticazione con certificati client+server', correct: true },
          { text: 'Sostituisce backup', correct: false },
          { text: 'Solo phishing', correct: false },
        ]),
        Q('Mass assignment su API REST:', 'Invio campi extra (es. role:admin) modifica oggetti non previsti.', [
          { text: 'Solo XSS', correct: false },
          { text: 'Binding campi non filtrati lato server', correct: true },
          { text: 'Richiesto da TLS 1.3', correct: false },
          { text: 'Solo DNS', correct: false },
        ]),
        Q('Test API in lab EVIL Virtual Lab:', 'Ambiente simulato — stesse tecniche solo con autorizzazione reale.', [
          { text: 'Valido su produzione bancaria senza permesso', correct: false },
          { text: 'Esercitazione in sandbox; produzione solo con scope legale', correct: true },
          { text: 'Sostituisce GDPR', correct: false },
          { text: 'Elimina logging', correct: false },
        ]),
      ],
    },
    'siem-detection': {
      id: 'siem-detection',
      name: 'Log & Detection',
      pillar: 'defend',
      icon: '◉',
      accent: '#94a3b8',
      description: 'SIEM, IOC, alert tuning — difesa basata su telemetria.',
      questions: [
        Q('SIEM aggrega principalmente:', 'Log da fonti multiple per correlazione e alert.', [
          { text: 'Solo email', correct: false },
          { text: 'Eventi da firewall, endpoint, cloud, app', correct: true },
          { text: 'Solo wallpaper', correct: false },
          { text: 'Password in chiaro', correct: false },
        ]),
        Q('False positive negli alert:', 'Rumore che affatica il team — richiede tuning regole.', [
          { text: 'Sempre ignorare tutti gli alert', correct: false },
          { text: 'Vanno ridotti calibrando detection e contesto', correct: true },
          { text: 'Indicano sempre attacco reale', correct: false },
          { text: 'Sostituiscono backup', correct: false },
        ]),
        Q('Impossible travel in UEBA:', 'Login da due Paesi distanti in tempo incompatibile.', [
          { text: 'Normale sempre', correct: false },
          { text: 'Possibile account compromesso o VPN sospetta', correct: true },
          { text: 'Solo bug schermo', correct: false },
          { text: 'Certificato scaduto', correct: false },
        ]),
        Q('Log retention troppo breve:', 'Impossibile investigare incidenti scoperti tardi.', [
          { text: 'Migliora privacy attaccante', correct: false },
          { text: 'Perdita evidenze per forensics e compliance', correct: true },
          { text: 'È obbligatorio 1 ora solo', correct: false },
          { text: 'Blocca phishing', correct: false },
        ]),
        Q('Sigma/YARA a livello alto:', 'Regole/pattern per rilevare comportamenti o stringhe malware.', [
          { text: 'Sostituiscono firewall fisico', correct: false },
          { text: 'Linguaggi regole per detection e hunting', correct: true },
          { text: 'Solo per grafica', correct: false },
          { text: 'Protocolli TLS', correct: false },
        ]),
        Q('Alert \"PowerShell -enc\" su endpoint:', 'Spesso indicatore esecuzione script offuscato — da investigare.', [
          { text: 'Sempre benigno', correct: false },
          { text: 'Comportamento sospetto comune in attacchi', correct: true },
          { text: 'Richiesto da marketing', correct: false },
          { text: 'Solo Linux', correct: false },
        ]),
        Q('MITRE ATT&CK serve a:', 'Mappare tattiche tecniche avversarie per detection e gap analysis.', [
          { text: 'Solo vendere hardware', correct: false },
          { text: 'Framework comune per TTP e copertura difensiva', correct: true },
          { text: 'Cifrare email', correct: false },
          { text: 'Sostituire MFA', correct: false },
        ]),
        Q('SOC tier 1 tipicamente:', 'Triage alert, runbook, escalation a tier 2.', [
          { text: 'Scrive exploit zero-day subito', correct: false },
          { text: 'Classifica e gestisce allarmi iniziali', correct: true },
          { text: 'Solo backup tape', correct: false },
          { text: 'Elimina log', correct: false },
        ]),
        Q('Centralizzare log senza orologio sincronizzato (NTP):', 'Timeline incidenti inaffidabile.', [
          { text: 'Migliora correlazione', correct: false },
          { text: 'Timestamp errati rendono difficile ricostruire attacco', correct: true },
          { text: 'È opzionale sempre', correct: false },
          { text: 'Blocca ransomware', correct: false },
        ]),
        Q('Playbook risposta a ransomware nel SOC:', 'Isolamento, preservazione log, comunicazione, restore testato.', [
          { text: 'Spegnere tutti i server senza log', correct: false },
          { text: 'Procedura documentata: contenimento, evidenze, recovery', correct: true },
          { text: 'Solo pagare riscatto', correct: false },
          { text: 'Ignorare NTP', correct: false },
        ]),
      ],
    },
  };

  Object.entries(MORE).forEach(([id, questions]) => {
    if (hub.CATEGORIES[id]) {
      hub.CATEGORIES[id].questions.push(...questions);
    }
  });

  Object.assign(hub.CATEGORIES, NEW_CATEGORIES);
  hub.version = 2;
  hub.totalExpanded = true;
})();

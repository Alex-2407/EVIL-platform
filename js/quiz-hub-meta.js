/** Centro quiz — nomi in codice, percorsi tematici e promesse di ogni quiz. Dati bilingui {it,en}. */
(function () {
  const L = (window.EVIL_I18N && window.EVIL_I18N.lang) || 'it';
  const pick = (o) => (o && typeof o === 'object' ? o[L] || o.it : o) || '';
  const q = (id, it, en, pitchIt, pitchEn) => [id, { code: { it, en }, pitch: { it: pitchIt, en: pitchEn } }];

  const QUIZ_META = Object.fromEntries([
    q('phishing-email', 'Non abboccare', 'Don’t Take the Bait', 'Smascherare mittenti, link e allegati prima del clic.', 'Unmask senders, links and attachments before you click.'),
    q('social-engineering', 'Il manipolatore', 'The Manipulator', 'Riconoscere fiducia, urgenza e autorità usate contro di te.', 'Spot trust, urgency and authority used against you.'),
    q('smishing-vishing', 'Squilla il sospetto', 'Suspicious Ring', 'SMS e telefonate truffa: chi ti chiama davvero?', 'Scam texts and calls: who is really calling?'),
    q('physical-se', 'Porta socchiusa', 'Door Ajar', 'Badge, tailgating e ospiti: la sicurezza fuori dallo schermo.', 'Badges, tailgating and visitors: security away from the screen.'),
    q('malware-ransomware', 'Riscatto', 'Ransom Note', 'Come entrano i malware e come si limita il danno.', 'How malware gets in and how to limit the damage.'),
    q('url-links', 'Dietro il link', 'Behind the Link', 'Leggere un indirizzo come lo leggerebbe un analista.', 'Read an address the way an analyst would.'),
    q('passwords-mfa', 'Le chiavi del regno', 'Keys to the Kingdom', 'Password robuste, gestori e autenticazione a più fattori.', 'Strong passwords, managers and multi-factor authentication.'),
    q('crypto-hashing', 'Cifre e impronte', 'Ciphers and Fingerprints', 'Hash, cifrari e chiavi: cosa protegge davvero cosa.', 'Hashes, ciphers and keys: what really protects what.'),
    q('network-basics', 'Sotto la rete', 'Down the Wire', 'IP, porte e protocolli: le fondamenta di ogni analisi.', 'IPs, ports and protocols: the groundwork of any analysis.'),
    q('owasp-web', 'Il banco di prova del web', 'The Web Gauntlet', 'Le falle web più diffuse e come si chiudono.', 'The most common web flaws and how to close them.'),
    q('cloud-security', 'Testa tra le nuvole', 'Head in the Cloud', 'Responsabilità condivisa, permessi e bucket esposti.', 'Shared responsibility, permissions and exposed buckets.'),
    q('privacy-gdpr', 'Dati sotto tutela', 'Data Under Guard', 'Basi giuridiche, diritti e obblighi di notifica.', 'Legal bases, rights and notification duties.'),
    q('incident-response', 'Ora zero', 'Hour Zero', 'Cosa fare nei primi minuti di un incidente.', 'What to do in the first minutes of an incident.'),
    q('secure-browsing', 'Navigatore prudente', 'Cautious Navigator', 'Abitudini di navigazione che evitano i guai.', 'Browsing habits that keep trouble away.'),
    q('insider-threats', 'Nemico in casa', 'Enemy Inside', 'Quando il rischio ha già un badge e un account.', 'When the risk already has a badge and an account.'),
    q('iot-smart', 'La casa ascolta', 'The House Listens', 'Telecamere, router e gadget: la superficie che dimentichi.', 'Cameras, routers and gadgets: the surface you forget.'),
    q('dns-recon', 'Mappa invisibile', 'Invisible Map', 'Cosa racconta il DNS su un’organizzazione.', 'What DNS reveals about an organisation.'),
    q('ssl-tls', 'Il lucchetto', 'The Padlock', 'Cosa garantisce davvero un certificato e cosa no.', 'What a certificate really guarantees and what it does not.'),
    q('osint-basics', 'Fonti aperte', 'Open Sources', 'Informazioni pubbliche, metodo e limiti etici.', 'Public information, method and ethical limits.'),
    q('file-forensics', 'Autopsia di un file', 'File Autopsy', 'Tipi, metadati, hash e segnali di un file sospetto.', 'Types, metadata, hashes and signs of a suspicious file.'),
    q('api-security', 'Porta di servizio', 'Service Entrance', 'Autenticazione, autorizzazione e abusi delle API.', 'Authentication, authorisation and API abuse.'),
    q('siem-detection', 'La sala di controllo', 'The Control Room', 'Log, regole e allarmi: vedere l’attacco mentre accade.', 'Logs, rules and alerts: see the attack as it happens.'),
  ]);

  const TRACKS = [
    { id: 'daily', name: { it: 'Difenditi ogni giorno', en: 'Defend yourself daily' }, blurb: { it: 'Le abitudini che fermano la maggior parte degli attacchi.', en: 'The habits that stop most attacks.' }, ids: ['phishing-email', 'passwords-mfa', 'url-links', 'secure-browsing', 'social-engineering', 'smishing-vishing', 'physical-se'] },
    { id: 'how', name: { it: 'Come funzionano le cose', en: 'How things work' }, blurb: { it: 'Reti, cifratura, DNS e file: le basi tecniche.', en: 'Networks, encryption, DNS and files: the technical basics.' }, ids: ['network-basics', 'crypto-hashing', 'ssl-tls', 'dns-recon', 'file-forensics'] },
    { id: 'attack', name: { it: 'Attacchi e superfici', en: 'Attacks and surfaces' }, blurb: { it: 'Malware, web, API, cloud e dispositivi connessi.', en: 'Malware, web, APIs, cloud and connected devices.' }, ids: ['malware-ransomware', 'owasp-web', 'api-security', 'cloud-security', 'iot-smart'] },
    { id: 'org', name: { it: 'Difesa e organizzazione', en: 'Defence and organisation' }, blurb: { it: 'Rilevare, rispondere, rispettare la legge.', en: 'Detect, respond, comply with the law.' }, ids: ['incident-response', 'siem-detection', 'insider-threats', 'privacy-gdpr', 'osint-basics'] },
  ];

  window.QUIZ_META = { pick, QUIZ_META, TRACKS };
})();

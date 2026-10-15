/** Glossario — argomenti, quiz e pagine collegate a ciascun gruppo di termini. Dati bilingui {it,en}. */
(function () {
  const L = (window.EVIL_I18N && window.EVIL_I18N.lang) || 'it';
  const pick = (o) => (o && typeof o === 'object' ? o[L] || o.it : o) || '';
  const words = (s) => s.split(',').map((x) => x.trim());

  const TOPICS = [
    { id: 'auth', name: { it: 'Accessi e password', en: 'Access and passwords' }, color: '#00ff9c', quiz: ['passwords-mfa'], links: [{ href: '/course.html?c=fondamenti', it: 'Corso Fondamenti', en: 'Foundations course' }],
      terms: words('privilege escalation, 2fa, mfa, otp, totp, passkey, webauthn, fido2, credential stuffing, password spraying, brute force, brute-force, rainbow table, salt, bcrypt, argon2, authorization, token, jwt, oauth, iam, pam, hydra, wordlist, sudo, privesc, least privilege, least-privilege, anonymous') },
    { id: 'social', name: { it: 'Inganno e fattore umano', en: 'Deception and the human factor' }, color: '#fb7185', quiz: ['phishing-email', 'social-engineering'], links: [{ href: '/osint-hub.html', it: 'OSINT hub', en: 'OSINT hub' }],
      terms: words('phishing, spear phishing, whaling, smishing, vishing, quishing, bec, typosquatting, sim swapping, pretexting, baiting, tailgating, shoulder surfing, dumpster diving, osint, opsec, exif') },
    { id: 'crypto', name: { it: 'Crittografia e fiducia', en: 'Cryptography and trust' }, color: '#a78bfa', quiz: ['crypto-hashing', 'ssl-tls'], links: [{ href: '/crypto-studio.html', it: 'Studio cifratura', en: 'Encryption studio' }],
      terms: words('tls, ssl, https, hsts, pki, x509, ocsp, crl, certificate transparency, pfs, ecdhe, mtls, rsa, aes, aes-gcm, aead, hmac, hash, sha-256, sha256, md5, e2ee, cifratura') },
    { id: 'net', name: { it: 'Rete e ricognizione', en: 'Network and reconnaissance' }, color: '#38bdf8', quiz: ['network-basics', 'dns-recon'], links: [{ href: '/domain-recon.html', it: 'Ricognizione dominio', en: 'Domain reconnaissance' }],
      terms: words('reconnaissance, ricognizione, enumeration, dns, axfr, cname, subdomain takeover, doh, spf, dkim, dmarc, nmap, port-scan, ping, ssh, curl, http, smb, smbclient, ftp, share, banner, vlan, vpn, dmz, firewall, ids, ips, internal-network, mitm, jump-box, zero trust') },
    { id: 'malware', name: { it: 'Malware e minacce', en: 'Malware and threats' }, color: '#f59e0b', quiz: ['malware-ransomware'], links: [{ href: '/malware-db.html', it: 'Catalogo malware', en: 'Malware catalogue' }, { href: '/malware-classification.html', it: 'Tassonomia malware', en: 'Malware taxonomy' }],
      terms: words('malware, ransomware, double extortion, trojan, worm, rootkit, spyware, keylogger, cryptojacking, fileless, botnet, ddos, dos, ioc, apt, zero-day, patch, cve, cvss, sandbox, honeypot, yara, webshell, payload, supply chain') },
    { id: 'web', name: { it: 'Web e API', en: 'Web and APIs' }, color: '#f472b6', quiz: ['owasp-web', 'api-security'], links: [{ href: '/web-simulator.html', it: 'Simulatore attacchi web', en: 'Web attack simulator' }, { href: '/virtual-lab.html', it: 'Lab virtuale', en: 'Virtual lab' }],
      terms: words('owasp, sql injection, sqli, xss, csrf, ssrf, lfi, rfi, xxe, rce, idor, bola, mass assignment, clickjacking, csp, cors, cookie, api, waf, sast, dast, command-injection, directory-traversal, entity, prepared-statement, post') },
    { id: 'defence', name: { it: 'Rilevamento e risposta', en: 'Detection and response' }, color: '#22d3ee', quiz: ['siem-detection', 'incident-response'], links: [{ href: '/hacked-timeline.html', it: 'Timeline incident response', en: 'Incident response timeline' }],
      terms: words('edr, siem, soc, ueba, dlp, sigma, mitre, mitre att&ck, forensics, chain of custody, pentest, red team, blue team, hardening, flag, ctf, dirb') },
    { id: 'privacy', name: { it: 'Privacy e legge', en: 'Privacy and law' }, color: '#c4b5fd', quiz: ['privacy-gdpr'], links: [{ href: '/ethics.html', it: 'Etica e legge', en: 'Ethics and law' }],
      terms: words('gdpr, dpo, pii') },
  ];

  const byTerm = Object.create(null);
  TOPICS.forEach((tp) => tp.terms.forEach((k) => { byTerm[k] = tp; }));

  // sinonimi/varianti: la prima forma vince, le altre non compaiono due volte
  const ALIASES = { sha256: 'sha-256', 'brute-force': 'brute force', 'least-privilege': 'least privilege', sqli: 'sql injection', privesc: 'privilege escalation', webshell: 'web shell', 'port-scan': 'port scan', 'jump-box': 'jump box', 'command-injection': 'command injection', 'directory-traversal': 'directory traversal', 'internal-network': 'internal network', 'prepared-statement': 'prepared statement', 'aes-gcm': 'aes', ricognizione: 'reconnaissance' };
  const GENERIC = ['post', 'share', 'flag', 'banner', 'entity', 'token', 'patch', 'anonymous', 'authorization', 'cookie', 'hash', 'worm', 'ping', 'curl', 'api'];

  window.GLOSSARY_META = { pick, TOPICS, byTerm, ALIASES, GENERIC };
})();

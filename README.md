# EVIL — piattaforma didattica di cybersecurity

Laboratori simulati, simulatore di attacchi web, Studio Cifratura, quiz, mappa degli incidenti
e strumenti di analisi difensiva (Check URL, header HTTP, DNS, SSL, file, OSINT).

- **Sito:** https://www.projectevil.it
- **Requisiti:** Node.js 22 (vedi `.nvmrc`)

## Avvio in locale

Su Windows basta un doppio clic su `AAAPRIMI PER INIZIARE/start-local.bat`. In alternativa:

```bash
npm install
node scripts/setup-local.js   # crea .env con NODE_ENV=development e segreti JWT casuali
npm run dev                   # riavvia il server quando cambia il codice
```

Poi apri http://localhost:5000/ (non i file `.html` con doppio clic).

In sviluppo, se l'email non è configurata, i messaggi (verifica account, reset password,
supporto) vengono salvati come file HTML in `data/email-outbox/`: aprili per cliccare i link.

## Comandi

| Comando | Cosa fa |
|---------|---------|
| `npm start` | genera il CSS della home e avvia il server (usato da Render) |
| `npm run dev` | come sopra, con riavvio automatico quando cambi il codice |
| `npm test` | test automatici (circa 6 secondi, nessuna rete esterna) |
| `npm run lint` | ESLint su server e script del browser |
| `npm run check:encoding` | cerca caratteri corrotti (emoji diventate `??`, `â€`, `propriet—`) |
| `npm run check:deploy` | controlla la configurazione prima di un deploy |
| `npm run build` | rigenera `css/home.bundle.css` da `home-hero/unified/motion/footer.css` |
| `npm run migrate:postgres` | copia gli utenti da `users.json` a Postgres (`DATABASE_URL`) |

Con `TEST_DATABASE_URL=postgres://...` `npm test` prova anche l'archivio utenti su Postgres.
La CI su GitHub Actions (`.github/workflows/ci.yml`) esegue lint, controllo della codifica,
test con un Postgres di servizio e `npm audit` a ogni push.

## Configurazione

Tutte le variabili sono descritte in `.env.example`. Le più importanti:

| Variabile | Note |
|-----------|------|
| `NODE_ENV` | `development` in locale, `production` online. Se manca, il server applica le regole di produzione. |
| `JWT_SECRET`, `JWT_SECRET_REFRESH` | almeno 32 caratteri, diversi tra loro (`node scripts/generate-secrets.js`) |
| `DATABASE_URL` | Postgres per gli account (consigliato in produzione, per esempio Neon gratuito). Senza, gli utenti stanno in `DATA_DIR/users.json`. |
| `BASE_URL` | indirizzo pubblico, per i link nelle email e i canonical (`https://www.projectevil.it`) |
| `MAILTRAP_API_TOKEN`, `EMAIL_USE_MAILTRAP_API=1` | invio email via HTTPS: Render free blocca le porte SMTP |
| `HELP_SUPPORT_EMAIL` | dove arrivano le richieste del modulo di supporto |
| `REDIS_URL` | opzionale: contatori dei limiti condivisi tra più istanze |

## Struttura

```
server/            server Express
  index.js         avvio, WebSocket, chiusura ordinata
  app.js           middleware nell'ordine giusto (header di sicurezza prima di tutto)
  pages.js         pagine HTML, versioni degli asset (hash del contenuto), sitemap
  routes/          auth, strumenti, laboratorio, progressi, supporto, incidenti, health
  lib/             archivio utenti, sessioni, progressi, richieste in uscita anti-SSRF
middleware/        header di sicurezza, limiti di richieste, autenticazione, log
services/          email, feed incidenti, laboratorio virtuale, strumenti di analisi
utils/             ambiente (development/test/production), cookie di sessione
html/ css/ js/     pagine e script del browser (js/server.js è solo il punto di avvio)
tests/             test automatici (node:test + supertest)
scripts/           setup locale, controlli, migrazione a Postgres
```

## Sicurezza in breve

- Le richieste verso siti scelti dagli utenti passano da `server/lib/safe-http.js`: il
  controllo sull'IP avviene all'apertura della connessione, quindi vale anche per i redirect
  e per il DNS rebinding. Reti private, loopback, metadata cloud e porte diverse da
  80/443/8080/8443 sono bloccate.
- Sessioni: access token breve e refresh token salvato (come hash) sull'account; logout,
  cambio e reset della password chiudono le sessioni.
- Limiti di richieste per utente o IP su login, registrazione, reset, strumenti e laboratorio.
- CSP e header di sicurezza su tutte le risposte; errori senza dettagli interni in produzione.

Per segnalare una vulnerabilità scrivi a support@projectevil.it.

## Deploy su Render

Vedi `docs/RENDER-MAILTRAP-SETUP.md` (variabili, Postgres gratuito, email via API).

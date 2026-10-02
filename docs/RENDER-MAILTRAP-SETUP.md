# Deploy su Render (projectevil.it)

## 1. Variabili d'ambiente

| Variabile | Valore | Perché |
|-----------|--------|--------|
| `NODE_ENV` | `production` | regole di produzione esplicite (se manca il server le applica comunque, con un avviso) |
| `BASE_URL` | `https://www.projectevil.it` | link nelle email, canonical, sitemap |
| `JWT_SECRET` | 64 caratteri casuali | `node scripts/generate-secrets.js` |
| `JWT_SECRET_REFRESH` | 64 caratteri casuali, diversi dal precedente | con segreti deboli o uguali il server non parte |
| `DATABASE_URL` | stringa di connessione Postgres | vedi punto 2 |
| `MAILTRAP_API_TOKEN` | token Sending di Mailtrap | vedi punto 3 |
| `EMAIL_USE_MAILTRAP_API` | `1` | |
| `SMTP_FROM_EMAIL` | `noreply@projectevil.it` | dominio verificato su Mailtrap |
| `HELP_SUPPORT_EMAIL` | `support@projectevil.it` | destinatario del modulo di supporto |
| `CORS_ORIGINS` | `https://projectevil.it,https://www.projectevil.it` | |
| `COOKIE_DOMAIN` | `.projectevil.it` | sessione valida con e senza www |
| `FORCE_HTTPS` | `1` | |
| `TRUST_PROXY` | `1` | Render ha **un** proxy davanti al server: serve per leggere l'IP reale dei visitatori (vedi sotto) |
| `DIAGNOSTICS_TOKEN` | stringa casuale lunga (facoltativa) | abilita `/api/health/smtp?key=...` |

### `TRUST_PROXY`: l'IP reale dei visitatori

Il server **non** si fida più di `X-Forwarded-For` per default, nemmeno in produzione: senza un
proxy davanti chiunque potrebbe scrivere quell'header e cambiare IP a ogni richiesta, aggirando i
limiti di richieste. La fiducia va dichiarata:

| Valore | Significato |
|--------|-------------|
| non impostata, `0`, `false` | nessun proxy: conta l'IP della connessione |
| `1` (o `2`, `3`…) | numero di proxy davanti al server. **Su Render: `1`** |
| `10.0.0.0/8,192.168.1.10` | elenco di IP o reti CIDR dei proxy fidati (anche `loopback`, `linklocal`, `uniquelocal`) |
| `true` | trattato come `1` (fidarsi di qualunque proxy non è ammesso) |

Su Render, senza `TRUST_PROXY=1`, tutti i visitatori risultano con l'IP del proxy e condividono
gli stessi limiti di richieste (dopo pochi login falliti di uno, tutti bloccati). Non mettere un
numero più alto di quello reale: un visitatore potrebbe falsificare il proprio IP. Se metti
Cloudflare (proxy) davanti a Render, i proxy diventano due: `TRUST_PROXY=2`.

All'avvio il log riporta la scelta (`Trust proxy: 1 proxy fidato davanti al server`) e, in
produzione senza `TRUST_PROXY`, un avviso. Lo segnala anche `npm run check:deploy`.

`EMAIL_DEV_OUTBOX` in produzione è ignorata.

Prima di ogni deploy: `npm run check:deploy` (con le stesse variabili) segnala cosa manca.

## 2. Account utenti: Postgres invece del disco

Il disco dei servizi Render gratuiti è effimero: si svuota a ogni deploy e riavvio, e con
lui `users.json`. Con `DATABASE_URL` gli account stanno in Postgres:

1. Crea un progetto gratuito su https://neon.tech (o un Postgres su Render).
2. Copia la connection string (`postgres://...?sslmode=require`) in `DATABASE_URL`.
3. Se hai già utenti in un `users.json`, copiali una volta:
   `DATABASE_URL=postgres://... npm run migrate:postgres -- percorso/users.json`
   (si può rilanciare: gli utenti già presenti vengono aggiornati, non duplicati).

La tabella (`evil_users`) viene creata all'avvio. All'avvio il log dice
`Utenti: Postgres (N account)`; se invece compare l'avviso sulla cartella non persistente,
`DATABASE_URL` non è impostata.

## 3. Email: API di Mailtrap, non SMTP

Render free blocca le porte SMTP (25, 465, 587): con SMTP le email non partono
(`Connection timeout`). Con `MAILTRAP_API_TOKEN` + `EMAIL_USE_MAILTRAP_API=1` tutte le email
(verifica account, reset password, supporto) passano dall'API HTTPS di Mailtrap.

Il token è quello di **Mailtrap → Sending Domains → projectevil.it → Integrations → API**.
Il mittente deve essere sul dominio verificato (`noreply@projectevil.it`).

Con un piano Render a pagamento si può usare anche SMTP (`SMTP_HOST=live.smtp.mailtrap.io`,
`SMTP_PORT=587`, `SMTP_USER=api`, `SMTP_PASS=<token>`), ma l'API resta la scelta più semplice.

## 4. Dopo il deploy

- `https://www.projectevil.it/api/health` → `{"status":"ok","env":"production",...}`
- Registra un account di prova: l'email di verifica deve arrivare entro un minuto.
- Con `DIAGNOSTICS_TOKEN` impostato:
  `https://www.projectevil.it/api/health/smtp?key=<token>` mostra come vengono inviate le email.
- I log (errori compresi) sono nel pannello **Logs** di Render. Le email vi compaiono
  mascherate (`gi***@example.com`) e token e chiavi negli URL come `***`; restano IP e user agent,
  necessari contro gli abusi. Render conserva i log per il periodo previsto dal piano
  (pochi giorni sul piano gratuito): non servono altre azioni per la cancellazione.

## Sicurezza

Non mettere mai segreti (`JWT_SECRET`, token Mailtrap, `DATABASE_URL`) nel repository.
Se sono finiti in un commit, generane di nuovi: cambiare i JWT chiude tutte le sessioni.

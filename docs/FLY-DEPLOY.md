# Deploy su Fly.io (projectevil.it)

Alternativa a Render free: server **sempre acceso** (niente sleep), Francoforte, circa **3,7 $/mese**
(512 MB). Gli account restano in Postgres (Neon), le email passano dall'API HTTPS di Mailtrap:
come su Render, quindi il codice non cambia. Per le variabili vale ancora
[RENDER-MAILTRAP-SETUP.md](RENDER-MAILTRAP-SETUP.md).

File coinvolti: `Dockerfile`, `.dockerignore`, `fly.toml` (nella radice del progetto).

## 1. Prima volta

1. Crea l'account su https://fly.io e aggiungi una carta (non c'è piano gratuito per i nuovi account).
2. Installa `flyctl` (https://fly.io/docs/flyctl/install/) e accedi: `fly auth login`.
3. Dalla cartella del progetto crea l'app senza distribuirla:
   `fly launch --no-deploy --copy-config --name evil-projectevil`
   (se il nome è preso, scegline un altro e aggiorna `app` in `fly.toml`).

## 2. Segreti

Non vanno in `fly.toml`. Con le stesse chiavi che usi oggi su Render:

```
fly secrets set \
  JWT_SECRET=... JWT_SECRET_REFRESH=... \
  DATABASE_URL='postgres://...?sslmode=require' \
  MAILTRAP_API_TOKEN=... \
  CERT_SIGNING_KEY=... \
  DIAGNOSTICS_TOKEN=...
```

- `JWT_SECRET` e `JWT_SECRET_REFRESH`: **gli stessi di Render**, altrimenti le sessioni attive
  decadono (nuovi: `node scripts/generate-secrets.js`).
- `DATABASE_URL`: se oggi usi già Neon, **riusa la stessa stringa**: gli account sono già lì e
  non c'è nulla da migrare. Se invece stavi su `users.json`:
  `DATABASE_URL=... npm run migrate:postgres -- percorso/users.json`.
- `CERT_SIGNING_KEY`: la stessa chiave dei diplomi, altrimenti i diplomi già emessi non risultano verificabili.

## 3. Deploy e prova

```
fly deploy
fly status
curl https://evil-projectevil.fly.dev/api/health
```

Deve rispondere `{"status":"ok","env":"production",...}`. Nei log (`fly logs`) cerca
`Utenti: Postgres (N account)`: se compare l'avviso sulla cartella non persistente, manca `DATABASE_URL`.
Prova registrazione e arrivo dell'email di verifica.

## 4. Dominio

**Prima** di spostare il DNS, in `fly.toml` passa dalla fase di prova alla produzione:
`BASE_URL = "https://projectevil.it"` (la stessa di Render) e togli il `#` da `COOKIE_DOMAIN`. Poi `fly deploy`.
Con `BASE_URL` sul dominio vero il sito reindirizza ogni altro indirizzo verso quel dominio: per questo durante la prova punta a `*.fly.dev`.

1. `fly certs add www.projectevil.it` e `fly certs add projectevil.it`.
2. `fly certs show www.projectevil.it` indica i record DNS da creare (CNAME per `www`, A/AAAA per il dominio nudo).
3. Cambia i record nel pannello del dominio **solo quando il test su `*.fly.dev` funziona**.
   Prima abbassa il TTL a 300 s, così un eventuale ritorno a Render è rapido.
4. Dopo la propagazione controlla `https://www.projectevil.it/api/health`, il login e le email.

## 5. Dopo

- Spegni Render solo dopo qualche giorno senza problemi.
- Aggiornamenti: `fly deploy` dopo ogni push. Log: `fly logs`. Riavvio: `fly machine restart`.
- Se 512 MB non bastano (messaggi di memoria nei log): `fly scale memory 1024`.
- Un solo server: durante un deploy ci può essere un breve stacco. Per due istanze serve `REDIS_URL`
  (limiti di richieste condivisi); finché c'è una sola macchina non serve.

## Costi indicativi (ottobre 2026)

Fly.io shared-cpu-1x 512 MB circa 3,69 $/mese; Neon free o piano a pagamento; Mailtrap secondo il piano.
Controlla i prezzi aggiornati sui siti dei fornitori prima di attivare.

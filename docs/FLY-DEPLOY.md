# Deploy su Fly.io (projectevil.it)

Alternativa a Render free: server **sempre acceso** (niente sleep), Francoforte, circa **3,7 $/mese**
(512 MB). Gli account restano in Postgres (Neon), le email passano dall'API HTTPS di Mailtrap:
come su Render, quindi il codice non cambia. Per le variabili vale ancora
[RENDER-MAILTRAP-SETUP.md](RENDER-MAILTRAP-SETUP.md).

File coinvolti: `Dockerfile` (a ogni build aggiorna i pacchetti Debian con `apt-get upgrade`), `.dockerignore`, `fly.toml` (nella radice del progetto).

Snyk sul Dockerfile guarda solo l'immagine base `node:22-slim` e non vede quell'aggiornamento. Per verificare l'immagine in esecuzione: `fly ssh console -C "dpkg-query -W perl-base libpcre2-8-0"`.

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

`fly.toml` è già in configurazione di produzione: `BASE_URL = "https://projectevil.it"` e `COOKIE_DOMAIN = ".projectevil.it"`.
Con `BASE_URL` sul dominio vero il sito reindirizza ogni altro indirizzo (anche `www` e `*.fly.dev`) verso quel dominio:
per provare un deploy prima di spostare il DNS serve temporaneamente un `BASE_URL` su `*.fly.dev`.

1. `fly certs add projectevil.it` e `fly certs add www.projectevil.it`.
2. `fly certs show projectevil.it` indica i record DNS da creare (A/AAAA per il dominio, CNAME per `www`).
3. Cambia i record nel pannello del dominio solo quando il test funziona; prima abbassa il TTL a 300 s.
4. Dopo la propagazione controlla `https://projectevil.it/api/health`, il login e le email.

Sul pannello DNS **non toccare** i record DKIM e SPF delle email. Quando aggiungi un record TXT, il **Nome** va scritto
come quello già presente (`projectevil.it`), non come `@`.

## 5. Chiave dei diplomi

`CERT_SIGNING_KEY` firma i diplomi: se la cambi, quelli già emessi non risultano più verificabili. Va generata **una volta sola**,
sul proprio computer e senza mostrarla (PowerShell):

```
$k = node -e "const c=require('crypto');const p=c.generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'});process.stdout.write(Buffer.from(p).toString('base64'))"
fly secrets set "CERT_SIGNING_KEY=$k"
```

Non usare `fly secrets import` con la pipe di PowerShell 5: aggiunge un carattere invisibile al nome del segreto.
Conserva una copia della chiave nel gestore di password.

## 6. Google (Search Console)

1. Aggiungi la proprietà di tipo **Dominio** `projectevil.it` e verifica con un record TXT.
2. Invia la sitemap con l'indirizzo completo: `https://projectevil.it/sitemap.xml`.
3. Controllo URL, `https://projectevil.it/`, Richiedi indicizzazione.
4. Non rimuovere il record TXT di verifica.

`/robots.txt` e `/sitemap.xml` seguono `BASE_URL`; `/.well-known/security.txt` indica a chi segnalare un problema di sicurezza.

## 7. Dopo

- Metti in pausa Render (senza cancellarlo) solo dopo qualche giorno senza problemi.
- Aggiornamenti: `fly deploy` dopo ogni push. Log: `fly logs`. Riavvio: `fly machine restart`.
- Se 512 MB non bastano (messaggi di memoria nei log): `fly scale memory 1024`.
- Un solo server: durante un deploy ci può essere un breve stacco. Per due istanze serve `REDIS_URL`
  (limiti di richieste condivisi); finché c'è una sola macchina non serve.

## Costi indicativi (ottobre 2026)

Fly.io shared-cpu-1x 512 MB circa 3,69 $/mese; Neon free o piano a pagamento; Mailtrap secondo il piano.
Controlla i prezzi aggiornati sui siti dei fornitori prima di attivare.

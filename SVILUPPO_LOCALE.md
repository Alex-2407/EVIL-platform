# Sviluppo locale (senza GitHub / Render)

Ogni modifica la vedi subito su **http://localhost:5000** — niente push, niente deploy.

## Requisiti

- [Node.js](https://nodejs.org/) **18 LTS** o superiore
- Il progetto clonato o scaricato in una cartella (es. `EVIL-platform-main`)

## Avvio rapido (Windows)

1. Doppio click su **`start-local.bat`** nella root del progetto  
   oppure, da terminale nella cartella del progetto:

```bash
npm install
node scripts/setup-local.js
npm start
```

2. Apri il browser su: **http://localhost:5000/**

3. Per fermare il server: `Ctrl+C` nel terminale, oppure `AAAPRIMI PER INIZIARE\stop-server.bat`

## Flusso di lavoro consigliato

| Ambiente | Quando usarlo |
|----------|----------------|
| **Locale** (`npm start`) | Modifiche a HTML, CSS, JS, API — feedback immediato |
| **Render** (push su GitHub) | Solo quando una versione è pronta da pubblicare |

1. Lavori in locale e ricarichi la pagina (`F5` o `Ctrl+F5` se i CSS non si aggiornano).
2. Quando sei soddisfatto: commit → push su GitHub → Render aggiorna da solo.

## Cosa NON fare

- **Non aprire** `html/home.html` con doppio click (protocollo `file://`). Login, API e stili non funzionano correttamente.
- Usa sempre **http://localhost:5000/** con il server avviato.

## Account e dati

- In locale gli utenti sono in **`users.json`** (creato dal setup se manca).
- Sono **diversi** da quelli su Render: registrati di nuovo in locale, oppure copia `users.json` solo se sai cosa stai facendo.
- **Email**: senza SMTP configurato in `.env`, la verifica email può non funzionare; per testare login/registrazione puoi usare Mailtrap (vedi `.env.example`) o ignorare la verifica se il server lo consente in dev.

## Redis

- **Non serve** Redis in locale: i token restano in memoria se non imposti `REDIS_URL`.
- Su Render puoi avere Redis collegato; in locale il comportamento è equivalente per sviluppo UI/API.

## Problemi comuni

**`JWT_SECRET not configured`**  
Esegui: `node scripts/setup-local.js`

**Porta 5000 occupata**  
Chiudi altri processi Node o in `.env` imposta `PORT=5001` e apri `http://localhost:5001`

**Pagina senza stile**  
Verifica di essere su `http://localhost:5000`, non su un file aperto dal disco.

**Modifiche non visibili**  
Hard refresh: `Ctrl+Shift+R` (Chrome/Edge).

## Variabili d'ambiente

Il file **`.env`** è solo sul tuo PC (non va su GitHub).  
Modello: `.env.example`. Il setup locale genera automaticamente i segreti JWT.

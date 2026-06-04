# EVIL Suite

Piattaforma web per cybersecurity education, strumenti di analisi e threat intelligence.

- **Sito:** https://www.projectevil.it
- **Avvio locale:** cartella `AAAPRIMI PER INIZIARE` → `start-local.bat`
- **Produzione:** `npm start` (Node.js 18+)

## Setup rapido

```bash
npm install
node scripts/setup-local.js
npm start
```

Apri http://localhost:5000/

## Script utili

| Comando | Descrizione |
|---------|-------------|
| `npm start` | Build CSS home + server |
| `npm test` | Verifica servizi locali |
| `npm run check:deploy` | Checklist pre-deploy |

Copia `.env.example` in `.env` e configura JWT/SMTP per auth email.

## Moduli

EVIL Core · EVIL Shield · EVIL Forge · EVIL Scout · EVIL Intel Map · EVIL Academy · EVIL Archive · EVIL Vault · EVIL Chrome

# 🚀 Deploy EVIL Platform su Render

## Prerequisiti
- [Git installato](https://git-scm.com/download/win) (se non lo hai, scaricalo)
- [Account su GitHub](https://github.com) (gratuito)
- [Account su Render](https://render.com) (gratuito con limitazioni)

---

## Step 1: Installare Git (Windows)

1. Scarica Git da: https://git-scm.com/download/win
2. Esegui l'installer e segui le istruzioni di default
3. Apri CMD o PowerShell e verifica: `git --version`

---

## Step 2: Creare un Repo GitHub

1. Vai su https://github.com/new
2. Nome repository: `evil-platform`
3. Descrizione: `Advanced Cybersecurity Learning Platform`
4. Scegli **Public** (per Render gratuito)
5. **Non** inizializzare con README (lo abbiamo già)
6. Clicca "Create Repository"

---

## Step 3: Caricare il Codice su GitHub

Apri **CMD** (non PowerShell) e esegui questi comandi **uno alla volta**:

```cmd
cd C:\Users\fabio\Desktop\TOTAL EVIL
git init
git config user.email "tua@email.com"
git config user.name "Tuo Nome"
git add .
git commit -m "Initial commit: EVIL Platform with security hardening"
git branch -M main
git remote add origin https://github.com/TUONOME/evil-platform.git
git push -u origin main
```

**Quando ti chiede username e password:**
- Username: il tuo username GitHub
- Password: un **Personal Access Token** (vedi Step 3b)

### Step 3b: Creare Personal Access Token

Se Git chiede la password:
1. Vai a: https://github.com/settings/tokens
2. Clicca "Generate new token (classic)"
3. Nome: `evil-deploy`
4. Seleziona: `repo` (full control)
5. Clicca "Generate token"
6. **Copia il token e salvalo** (non lo vedrai più)
7. Incolla il token quando Git ti chiede la password

---

## Step 4: Configurare Render

### 4.1 Creare un Nuovo Web Service su Render

1. Vai a https://dashboard.render.com
2. Clicca "New +" → "Web Service"
3. Seleziona "Deploy an existing Git repository"
4. Clicca "Connect" accanto al tuo repo `evil-platform`
5. Autorizza GitHub

### 4.2 Configurare il Deploy

**Nome:** `evil-platform` (o quello che preferisci)

**Ambiente**: `Node`

**Build Command:** 
```
npm install --legacy-peer-deps
```

**Start Command:** 
```
npm start
```

### 4.3 Configura le Variabili d'Ambiente

Clicca su "Environment" e aggiungi **tutte** queste variabili:

```
NODE_ENV = production
PORT = 10000
HOST = 0.0.0.0

JWT_SECRET = a2e133dfd8fa3f77dd52a91a0653a878292b4b610644a3e3f81d7c0ae3ac2086
JWT_SECRET_REFRESH = 8055a722ff66752d76648ec2e4c1bd8d9a71dcf410e6eb671344795ebc502198
JWT_EXPIRY_ACCESS = 1h
JWT_EXPIRY_REFRESH = 7d

BCRYPT_ROUNDS = 12
MIN_PASSWORD_LENGTH = 12
REQUIRE_UPPERCASE = true
REQUIRE_NUMBERS = true
REQUIRE_SPECIAL_CHARS = true

CORS_ORIGINS = https://evil-platform.onrender.com,http://localhost:5000,http://localhost:3000
CORS_CREDENTIALS = true

RATE_LIMIT_GLOBAL_MAX = 100
RATE_LIMIT_GLOBAL_WINDOW_MS = 900000
RATE_LIMIT_LOGIN_MAX = 5
RATE_LIMIT_LOGIN_WINDOW_MS = 900000
RATE_LIMIT_REGISTER_MAX = 3
RATE_LIMIT_REGISTER_WINDOW_MS = 3600000
RATE_LIMIT_SCAN_MAX = 50
RATE_LIMIT_SCAN_WINDOW_MS = 3600000
RATE_LIMIT_DNS_MAX = 100
RATE_LIMIT_DNS_WINDOW_MS = 3600000
RATE_LIMIT_UPLOAD_MAX = 50
RATE_LIMIT_UPLOAD_WINDOW_MS = 86400000

MAX_FILE_SIZE = 52428800
ALLOWED_MIME_TYPES = image/png,image/jpeg,image/gif,application/pdf,text/plain,application/zip
ALLOWED_EXTENSIONS = .png,.jpg,.jpeg,.pdf,.txt,.zip
UPLOAD_DIR = ./uploads
UPLOAD_USER_ISOLATION = true

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = 1800000

REDIS_URL = 
REDIS_PASSWORD = 
REDIS_TLS = false

HSTS_MAX_AGE = 31536000
HSTS_INCLUDE_SUBDOMAINS = true
CSP_ENABLED = true
FRAME_GUARD = DENY
X_CONTENT_TYPE_OPTIONS = nosniff

LOG_LEVEL = info
LOG_DIR = ./logs
AUDIT_LOG_FILE = ./logs/audit.log
```

**Nota:** Lascia `REDIS_URL` e `REDIS_PASSWORD` vuoti (l'app usa fallback in memoria).

### 4.4 Clicca "Create Web Service"

Render inizierà il deploy automaticamente. Aspetta 2-3 minuti.

---

## Step 5: Verifica il Deployment

1. Una volta completato, vedrai un URL come: `https://evil-platform.onrender.com`
2. Apri il browser e vai a: `https://evil-platform.onrender.com/home.html`
3. Se vedi la pagina EVIL → ✅ **Tutto funziona!**

---

## Step 6: Test Endpoints post-Deploy

Apri una nuova finestra CMD e testa i tuoi endpoint:

### Test Health Check
```cmd
curl https://evil-platform.onrender.com/api/health
```

### Test Registrazione
```cmd
curl -X POST https://evil-platform.onrender.com/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"name\":\"TestUser\",\"email\":\"test@example.com\",\"password\":\"SecurePass123!\",\"confirmPassword\":\"SecurePass123!\"}"
```

### Test Login
```cmd
curl -X POST https://evil-platform.onrender.com/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"SecurePass123!\"}"
```

---

## Problemi Comuni

### "Build failed" di Render
- Controlla i **Logs** in Render → clicca sul servizio → "Logs"
- Soluzione comune: assicurati che `Procfile` esista e sia corretto

### Errore 503 Service Unavailable
- L'app potrebbe essere ancora in avvio (aspetta 1-2 minuti)
- Controlla i logs per errori di Node.js

### CORS Error quando chiami da localhost
- Aggiorna `CORS_ORIGINS` in Render Environment per includere il tuo dominio locale

### Redis Non Disponibile
- È normale: l'app usa fallback in memoria per sessioni e rate limiting
- Se vuoi Redis: upgrade al piano pagato di Render

---

## Step 7 (Opzionale): Aggiungere Dominio Personalizzato

1. Su Render, clicca il tuo servizio
2. Vai a "Settings" → "Custom Domain"
3. Aggiungi il tuo dominio (es: `evil.tuodominio.com`)
4. Aggiorna i DNS del tuo registrar secondo le istruzioni Render
5. Attendi 24 ore per propagazione DNS
6. SSL automatico via Let's Encrypt ✅

---

## Prossimi Passi

✅ Platform online
✅ HTTPS/SSL automatico
✅ Zero configurazione server

Opzionali:
- Aggiungere dominio personalizzato
- Inviare email di verifica (Sendgrid)
- Abilitare backup automatico
- Aggiungere Redis gestito (piano pagato)

---

**Sei online! 🎉**

Il tuo EVIL Platform è ora accessibile 24/7 su Internet senza doverlo hostare a casa.

Se hai domande, controlla i logs di Render o ricontatta il supporto.

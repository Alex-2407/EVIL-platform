# EVIL Cybersecurity Platform - Guida Deployment

## Configurazione per Rete

Il sito è stato configurato per il deployment in rete con le seguenti caratteristiche:

### 1. **CORS Dinamico**

- **Development**: Accetta qualsiasi origin (file://, localhost, domini remoti)
- **Production**: Configurabile via variabile d'ambiente

#### Configurazione Environment

```bash
# Development (default)
node js/server.js

# Production con domini specifici
set NODE_ENV=production
set CORS_ORIGINS=https://example.com,https://app.example.com,https://example.it
node js/server.js
```

Oppure in PowerShell:
```powershell
$env:NODE_ENV="production"
$env:CORS_ORIGINS="https://example.com,https://app.example.com"
node js/server.js
```

### 2. **Cache Persistente**

- La cache degli incidenti viene automaticamente salvata su disco (file `.incidents-cache.json`).
- Al riavvio del server, carica la cache dal disco.
- Riduce i carichi sulle API esterne (NVD, CISA, CERT, etc.).

### 3. **Configurazione Rete**

#### A. Server Locale (sviluppo)

Esegui normalmente:
```bash
.\AAAPRIMI PER INIZIARE\start-server.bat
```

Accedi via:
- HTTP locale: `http://localhost:5000/attacks-map.html`
- IP locale: `http://192.168.x.x:5000/attacks-map.html` (sostituisci con il tuo IP)
- File diretto: `file:///C:/Users/utente01/Desktop/TOTAL%20EVIL/html/attacks-map.html`

#### B. Server Remoto / VPS / Cloud

1. Carica i file nel server (via FTP, Git, SFTP, etc.)
2. Installa Node.js (versione 18+)
3. Esegui nel server:

```bash
cd /path/to/TOTAL\ EVIL
npm install
NODE_ENV=production CORS_ORIGINS=https://yourdomain.com PORT=80 node js/server.js
```

Oppure usa un process manager (es. PM2):
```bash
npm install -g pm2
pm2 start js/server.js --name "evil-backend" --env-file .env
```

**File `.env` di esempio:**
```
NODE_ENV=production
PORT=5000
CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
```

#### C. Docker (opzionale)

Crea un `Dockerfile`:
```dockerfile
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5000

CMD ["node", "js/server.js"]
```

Build e run:
```bash
docker build -t evil-platform .
docker run -p 5000:5000 \
  -e NODE_ENV=production \
  -e CORS_ORIGINS=https://example.com \
  evil-platform
```

### 4. **HTTPS / SSL (Raccomandat in Produzione)**

#### Usando Let's Encrypt + Nginx (reverse proxy)

1. Installa Nginx:
```bash
# Ubuntu/Debian
sudo apt install nginx

# Oppure su Windows usa nginx binaries o WSL
```

2. Configura Nginx (`/etc/nginx/sites-available/evil`):
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Redirect HTTP -> HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

3. Ricarica Nginx:
```bash
sudo systemctl reload nginx
```

4. Ottieni certificato Let's Encrypt:
```bash
sudo certbot certonly --standalone -d yourdomain.com
```

### 5. **Firewall e Sicurezza**

#### Porte da esporre
- **80** (HTTP, redirect a HTTPS)
- **443** (HTTPS - Production)
- **5000** (se usi direttamente Node, non consigliato in prod)

#### Firewall (esempio UFW su Linux):
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 5000/tcp  # Blocca accesso diretto a Node
sudo ufw enable
```

#### Password e JWT
Il sistema usa JWT per l'autenticazione:
- **JWT_SECRET**: Configurabile via env (attualmente: `process.env.JWT_SECRET || 'evil-secret-key-2026-change-in-production'`)
- **Hash password**: Bcrypt (salted, 10 rounds)

In produzione, cambia il JWT_SECRET:
```bash
set JWT_SECRET=your-super-secret-key-here
node js/server.js
```

### 6. **Database Utenti**

Il file `users.json` contiene gli utenti registrati (hash bcrypt delle password).

**Backup consigliato:**
```bash
cp users.json users.json.backup


cp .incidents-cache.json .incidents-cache.json.backup
```

### 7. **Performance e Rate-Limiting**

#### API Esterne
Il server chiama automaticamente:
- **NVD (NIST)** - CVE data
- **CISA** - Known Exploited Vulnerabilities
- **CERT-IT** - Italian federal cybersecurity alerts
- **CERT-UK** - UK NCSC alerts
- **US-CERT** - US federal alerts
- **Vendor Feeds** - Microsoft, Cisco Talos, Akamai

Se uno di questi va in rate-limit, il sistema gracefully degrada e usa il fallback simulato.

**Retry con backoff esponenziale**: Integrato via `fetchWithRetries()` (base 500ms, jitter).

#### Cache e Aggiornamenti
- Client polling: **ogni 30 secondi** (aggiorna UI)
- Server refresh cache: **ogni 30 secondi** (richiama feed esterne)
- Persistenza cache: **Salva su disco dopo ogni aggiornamento**

Per ridurre carico esterno, modifica gli intervalli in `js/server.js`:
```javascript
// Riga ~940 circa
setInterval(refreshIncidentsCache, 5 * 60 * 1000); // 5 minuti invece di 30s
```

### 8. **Migrazione da Sviluppo a Produzione - Checklist**

- [ ] Installa Node.js v18+ sul server
- [ ] Esegui `npm install` nel server
- [ ] Configura variabili d'ambiente (`.env` o export)
- [ ] Imposta `NODE_ENV=production`
- [ ] Configura `CORS_ORIGINS` con il tuo dominio
- [ ] Cambia `JWT_SECRET`
- [ ] Configura HTTPS (Nginx + Let's Encrypt oppure reverse proxy)
- [ ] Backup di `users.json` e `.incidents-cache.json`
- [ ] Testa l'accesso locale: `curl http://localhost:5000/api/health`
- [ ] Testa l'accesso remoto: `curl https://yourdomain.com/api/health`
- [ ] Configura firewall (esponi solo 80, 443)
- [ ] Installa un process manager (PM2, systemd, etc.)
- [ ] Configura log rotation e monitoring
- [ ] Testa fallback offline (disattiva internet, verifica dati simulati)

### 9. **Troubleshooting**

#### Errore CORS
```
Access to XMLHttpRequest blocked by CORS policy
```

**Soluzione:**
```bash
# Controlla NODE_ENV
echo $NODE_ENV

# Controlla CORS_ORIGINS
echo $CORS_ORIGINS

# In development, CORS_ORIGINS non è necessario
NODE_ENV=development node js/server.js
```

#### Cache non persiste
```
💾 Errore salvataggio cache su disco
```

**Soluzione:**
- Verifica permessi di scrittura nella directory
- Controlla spazio disco `df -h`
- Il file `.incidents-cache.json` deve trovarsi nella root della cartella TOTAL EVIL

#### API esterne non raggiungibili
```
⚠️ NVD API non disponibile (rate limit)
```

**Comportamento atteso**: Il sistema usa fallback simulato. Controlla:
- Connessione internet del server
- Firewall che blocca HTTPS outbound
- Rate limit (attendi 1 ora)

### 10. **Logging e Debug**

Per vedere i log dettagliati:

```bash
# Con timestamp
node js/server.js 2>&1 | tee server-$(date +%Y%m%d-%H%M%S).log

# In PowerShell
node js/server.js | Tee-Object -FilePath "server-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"
```

Per disattivare i warning (non consigliato):
```bash
# In js/server.js, commenta i console.warn
# Non farlo in produzione, serve per debugging
```

---

## Supporto

Se hai domande sul deployment, controlla:
1. Output dei log sul server (`console.log`, `console.warn`)
2. L'endpoint health: `GET /api/health` (ritorna `{status: 'ok'...}`)
3. La sezione CORS sopra (la causa più comune di errori)
4. Firewall e route (controlla che le richieste raggiunghino il server)

Buon deployment! 🚀

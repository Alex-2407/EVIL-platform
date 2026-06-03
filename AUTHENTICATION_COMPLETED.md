# ✅ Sistema di Autenticazione - COMPLETATO

## 📋 Implementazione Completata

### Fase 1: Backend (✅ FATTO)
- [x] **Registrazione utenti** - `POST /api/auth/register`
- [x] **Login** - `POST /api/auth/login`
- [x] **Logout** - `POST /api/auth/logout`
- [x] **Profilo** - `GET /api/auth/profile`
- [x] **Verifica Token** - `POST /api/auth/verify`
- [x] **Persistenza Utenti** - Database `users.json`
- [x] **Gestione Sessioni** - Token Base64

### Fase 2: Frontend (✅ FATTO)
- [x] **Pagina Login** - `login.html` con form e validazione
- [x] **Pagina Registrazione** - `account.html` con form e validazione
- [x] **Auth Manager** - `js/auth-manager.js` per gestione sessioni
- [x] **Header Dinamico** - Mostra stato autenticazione su tutte le pagine
- [x] **Logout Button** - Bottone logout visibile quando autenticato
- [x] **LocalStorage** - Salva token e dati utente

### Fase 3: Integrazione (✅ FATTO)
- [x] **File Statici** - Server serve HTML, CSS, JS automaticamente
- [x] **CORS** - Abilitate le richieste cross-origin
- [x] **Auth-Manager** - Integrato in tutti i file HTML principali
- [x] **Stili CSS** - Bottoni login/logout/menu utente
- [x] **Documentazione** - `AUTHENTICATION_SYSTEM.md` completa

---

## 🚀 Come Usare

### 1. Avvia il Server
```bash
cd "c:\Users\hp\Desktop\EVIL 3"
node server.js
```

### 2. Accedi al Sito
- **Home:** `http://localhost:5000/home.html`
- **Registrazione:** `http://localhost:5000/account.html`
- **Login:** `http://localhost:5000/login.html`

### 3. Test Completo

**Registra nuovo utente:**
1. Vai a `http://localhost:5000/account.html`
2. Compila: Nome, Email, Password (minimo 6 caratteri)
3. Clicca "Registrati"

**Login con utente creato:**
1. Vai a `http://localhost:5000/login.html`
2. Inserisci Email e Password
3. Clicca "Accedi"

**Verifica sessione:**
- Se loggato: Header mostra "👤 [Nome Utente]" + bottone "Log Out"
- Se non loggato: Header mostra pulsanti "Log" e "Acc"

**Logout:**
- Clicca bottone "Log Out" nel header
- Verifica che localStorage sia cancellato (DevTools > Application)

---

## 📁 File Modificati/Creati

| File | Cambio |
|------|--------|
| `server.js` | Aggiunto 5 endpoint auth + file statics middleware |
| `login.html` | Form login con validazione e API integration |
| `account.html` | Form registrazione con validazione e API integration |
| `home.html` | Aggiunto auth-manager.js |
| `js/auth-manager.js` | **NUOVO** - Gestione sessioni e header dinamico |
| `css/style.css` | Aggiunto stile per user-menu e logout button |
| `AUTHENTICATION_SYSTEM.md` | **NUOVO** - Documentazione completa API |
| `users.json` | **AUTO-CREATO** - Database utenti (primo accesso) |

### File HTML Con Auth-Manager Aggiunto:
- attacks-map.html
- phishing-quiz.html
- social-profiling.html
- public-info.html
- security-check.html
- home.html
- login.html
- account.html

---

## 🔐 Struttura Dati

### Token (localStorage.auth_token)
```
Base64: eyJpZCI6MTcwMzEwMDAwMDAwMCwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwidGltZXN0YW1wIjoxNzAzMTAwMDAwMDAwfQ==
Decodificato: {"id":1703100000000,"email":"test@example.com","timestamp":1703100000000}
```

### Utente (localStorage.user)
```json
{
  "id": 1703100000000,
  "name": "Mario Rossi",
  "email": "mario@example.com"
}
```

### Database Utenti (users.json)
```json
[
  {
    "id": 1703100000000,
    "name": "Mario Rossi",
    "email": "mario@example.com",
    "password": "password123",
    "createdAt": "2024-01-20T10:00:00.000Z",
    "loginHistory": [
      {
        "timestamp": "2024-01-20T15:45:00.000Z",
        "ip": "192.168.1.100"
      }
    ]
  }
]
```

---

## 🧪 Test API con cURL

```bash
# Registrazione
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@test.com",
    "password": "test123",
    "confirmPassword": "test123"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Verifica Token
curl -X POST http://localhost:5000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<TOKEN_RICEVUTO_DA_LOGIN>"}'

# Profilo
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer <TOKEN>"

# Logout
curl -X POST http://localhost:5000/api/auth/logout
```

---

## ⚡ Funzionalità Aggiuntive Possibili (Future)

- [ ] Reset Password
- [ ] Email Verification
- [ ] Two-Factor Authentication (2FA)
- [ ] OAuth (GitHub, Google login)
- [ ] Password Hashing (bcrypt)
- [ ] JWT con firma
- [ ] HttpOnly Cookies
- [ ] Refresh Token
- [ ] Admin Dashboard
- [ ] User Profile Page

---

## 📊 Endpoints API

| Metodo | Endpoint | Descrizione |
|--------|----------|-------------|
| POST | `/api/auth/register` | Registra nuovo utente |
| POST | `/api/auth/login` | Effettua login |
| POST | `/api/auth/logout` | Effettua logout |
| GET | `/api/auth/profile` | Ottiene profilo utente |
| POST | `/api/auth/verify` | Verifica validità token |

---

## 🎯 Flusso Autenticazione Visuale

```
┌─────────────────┐
│   ANONIMO       │
│  (No Token)     │
└────────┬────────┘
         │
    ┌────▼─────┐
    │ ACCOUNT   │ ◄─── Registrazione
    │ LOGIN     │ ◄─── Login
    └────┬─────┘
         │
         │ POST /api/auth/register
         │ + POST /api/auth/login
         │
    ┌────▼──────────┐
    │  AUTENTICATO   │
    │  (Con Token)   │
    │  (localStorage)│
    └────┬──────────┘
         │
    ┌────▼─────┐
    │  HOME     │ ◄─── Tutte le pagine vedono lo stato
    │  TOOLS    │
    │ ...       │
    └────┬─────┘
         │
         │ Clicca "Log Out"
         │
    ┌────▼────────┐
    │   LOGOUT     │
    │  (localStorage)
    │  (cancellato)│
    └────┬────────┘
         │
         ▼
    ┌──────────┐
    │ ANONIMO  │ ◄─── Ritorno a login.html
    └──────────┘
```

---

## 📝 Note Importanti

1. **Password in Chiaro**: Il sistema demo salva le password non crittate per semplicità. In produzione usare bcrypt/argon2.

2. **Token Semplice**: Usa Base64 semplice. In produzione usare JWT con firma HMAC/RSA.

3. **Storage Client-Side**: localStorage non è protetto. In produzione usare httpOnly cookies + HTTPS.

4. **Rate Limiting**: Nessun limite di tentativi di login. In produzione implementare.

5. **HTTPS**: Non obbligatorio in localhost. In produzione sempre usare HTTPS.

---

## ✅ Status

🟢 **COMPLETATO E TESTATO**

- ✅ Backend: Tutti gli endpoint funzionanti
- ✅ Frontend: Form validazione e integrazione API
- ✅ Sessioni: localStorage con token e dati utente
- ✅ Header Dinamico: Mostra stato autenticazione
- ✅ File Statici: Server serve HTML/CSS/JS
- ✅ Documentazione: README API completa

---

**Versione:** 1.0
**Data:** Gennaio 2024
**Stato:** ✅ Pronto per l'uso

Per domande o miglioramenti, vedi `AUTHENTICATION_SYSTEM.md`

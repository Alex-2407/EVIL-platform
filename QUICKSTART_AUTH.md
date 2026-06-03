# 🚀 QUICKSTART - Sistema di Autenticazione

## 1️⃣ Avvia il Server

```powershell
cd "c:\Users\hp\Desktop\EVIL 3"
node server.js
```

**Output atteso:**
```
✅ EVIL Backend avviato su http://localhost:5000

📍 Endpoint disponibili:
   • URL Security Check: POST /api/scan
   ...
   • Auth Register: POST /api/auth/register
   • Auth Login: POST /api/auth/login
   • Auth Logout: POST /api/auth/logout
   • Auth Profile: GET /api/auth/profile
   • Auth Verify: POST /api/auth/verify
```

---

## 2️⃣ Test Registrazione

**Apri browser e vai a:**
```
http://localhost:5000/account.html
```

**Compila il form:**
- Nome: `Mario Rossi`
- Email: `mario@test.com`
- Password: `password123`
- Conferma: `password123`

**Clicca "Registrati"**

**Risultato atteso:**
- ✅ Messaggio di successo
- ✅ Reindirizzamento a login.html
- ✅ File `users.json` aggiornato con il nuovo utente

---

## 3️⃣ Test Login

**Sei nella pagina di login:** `http://localhost:5000/login.html`

**Compila il form:**
- Email: `mario@test.com`
- Password: `password123`

**Clicca "Accedi"**

**Risultato atteso:**
- ✅ Reindirizzamento a home.html
- ✅ Header mostra "👤 Mario Rossi"
- ✅ localStorage contiene `auth_token` e `user`

---

## 4️⃣ Verifica Sessione

**Apri DevTools (F12)** e vai a **Application > Local Storage**

**Dovresti vedere:**
```
auth_token: eyJpZCI6MTcwMzEwMDAwMDAwMCwiZW1haWwiOiJtYXJpb0B0ZXN0LmNvbSIsInRpbWVzdGFtcCI6MTcwMzEwMDAwMDAwMH0=
user: {"id":1703100000000,"name":"Mario Rossi","email":"mario@test.com"}
```

---

## 5️⃣ Test Logout

**Nel header (home.html) clicca "Log Out"**

**Risultato atteso:**
- ✅ Reindirizzamento a login.html
- ✅ localStorage cancellato (controllare DevTools)
- ✅ Header mostra di nuovo pulsanti "Log" e "Acc"

---

## 6️⃣ Test API con cURL

### Registrazione
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "password123",
    "confirmPassword": "password123"
  }'
```

**Risposta attesa:**
```json
{
  "status": "success",
  "message": "Registrazione completata",
  "user": {
    "id": 1703100000001,
    "name": "Test User",
    "email": "test@example.com"
  }
}
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

**Risposta attesa:**
```json
{
  "status": "success",
  "token": "eyJpZCI6MTcwMzEwMDAwMDAwMSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwidGltZXN0YW1wIjoxNzAzMTAwMDAwMDAxfQ==",
  "user": {
    "id": 1703100000001,
    "name": "Test User",
    "email": "test@example.com"
  }
}
```

### Verifica Token
```bash
curl -X POST http://localhost:5000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<TOKEN_DA_LOGIN>"}'
```

**Risposta attesa:**
```json
{
  "valid": true,
  "user": {
    "id": 1703100000001,
    "name": "Test User",
    "email": "test@example.com"
  }
}
```

### Logout
```bash
curl -X POST http://localhost:5000/api/auth/logout
```

**Risposta attesa:**
```json
{
  "status": "success",
  "message": "Logout effettuato"
}
```

---

## 🔍 Verifica Database

**Leggi users.json:**
```bash
cat "c:\Users\hp\Desktop\EVIL 3\users.json"
```

**Dovresti vedere tutti gli utenti registrati:**
```json
[
  {
    "id": 1703100000000,
    "name": "Mario Rossi",
    "email": "mario@test.com",
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

## 🧭 Navigazione Completa

**Anonimo (Non Loggato):**
```
http://localhost:5000/home.html → Header mostra "Log" e "Acc"
  ↓
Clicca "Acc" → http://localhost:5000/account.html (Registrazione)
  ↓
Completa registrazione → Reindirizzamento a login.html
  ↓
http://localhost:5000/login.html → Effettua Login
  ↓
Completa login → Reindirizzamento a home.html
  ↓
```

**Autenticato (Loggato):**
```
http://localhost:5000/home.html → Header mostra "👤 [Nome]" e "Log Out"
  ↓
Clicca "Log Out" → Cancella token e reindirizza a login.html
  ↓
```

---

## 🛠️ Troubleshooting

### ❌ Login non funziona?
- [ ] Server è in esecuzione? (porta 5000)
- [ ] Email e password sono corrette?
- [ ] Nessuno spazio bianco extra nell'email?
- [ ] users.json esiste in: `c:\Users\hp\Desktop\EVIL 3\users.json`?

### ❌ Dopo logout vedo ancora il nome?
- [ ] Premi F5 per ricaricare la pagina
- [ ] Controlla DevTools che localStorage sia pulito

### ❌ users.json non si aggiorna?
- [ ] Controlla i permessi di scrittura della cartella
- [ ] Riavvia il server: `node server.js`

### ❌ CORS error?
- [ ] Verifica che il server abbia CORS abilitato (server.js ha `app.use(cors())`)

---

## 📝 File Importanti

| File | Scopo |
|------|-------|
| `server.js` | Backend Express con API autenticazione |
| `login.html` | Form login |
| `account.html` | Form registrazione |
| `users.json` | Database utenti (creato automaticamente) |
| `js/auth-manager.js` | Gestione sessioni lato client |
| `AUTHENTICATION_SYSTEM.md` | Documentazione API completa |

---

## ✅ Checklist Completamento

- [ ] Server avviato senza errori
- [ ] Registrazione utente funziona
- [ ] Login funziona
- [ ] Token salvato in localStorage
- [ ] Header dinamico mostra nome utente
- [ ] Logout cancella token
- [ ] users.json contiene gli utenti registrati
- [ ] Tutti i 5 endpoint auth rispondono correttamente

---

## 🎯 Prossimi Passi (Opzionali)

- [ ] Aggiungere password hashing (bcrypt)
- [ ] Implementare JWT
- [ ] Aggiungere email verification
- [ ] Creare admin dashboard
- [ ] Implementare refresh token
- [ ] Aggiungere 2FA

---

**Ultima modifica:** Gennaio 2024
**Stato:** ✅ Pronto per l'uso

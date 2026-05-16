# Sistema di Autenticazione - EVIL Platform

## Panoramica
Sistema di autenticazione completo con registrazione, login e gestione delle sessioni basato su token.

## Flusso di Autenticazione

### Registrazione
1. Utente accede a `account.html`
2. Compila modulo con: Nome, Email, Password, Conferma Password
3. Form invia richiesta `POST /api/auth/register` con i dati
4. Server controlla:
   - Tutti i campi sono obbligatori
   - Password corrisponde alla conferma
   - Password minimo 6 caratteri
   - Email non è già registrata
5. Se valido: crea nuovo utente, salva in `users.json`, reindirizza a login.html
6. Se invalido: mostra messaggio di errore

### Login
1. Utente accede a `login.html`
2. Compila modulo con: Email e Password
3. Form invia richiesta `POST /api/auth/login` con credenziali
4. Server:
   - Verifica email e password contro `users.json`
   - Se valido: registra login, genera token Base64, ritorna token + dati utente
   - Se invalido: ritorna errore 401
5. Client salva in localStorage:
   - `auth_token` = token Base64
   - `user` = JSON con dati utente (id, name, email)
6. Reindirizza a `home.html`

### Sessione Persistente
- Token salvato in `localStorage.auth_token`
- Dati utente in `localStorage.user` (JSON)
- Il file `auth-manager.js` verifica automaticamente lo stato all'accesso di ogni pagina
- Se autenticato: mostra nome utente + bottone Logout
- Se non autenticato: mostra pulsanti Login/Registrazione

### Logout
1. Utente clicca bottone "Log Out" nel header (visibile se autenticato)
2. `logout()` function in `auth-manager.js`:
   - Cancella `auth_token` da localStorage
   - Cancella `user` da localStorage
   - Notifica server (opzionale): `POST /api/auth/logout`
   - Reindirizza a `login.html`

## Endpoints API

### POST /api/auth/register
**Richiesta:**
```json
{
  "name": "Mario Rossi",
  "email": "mario@example.com",
  "password": "password123",
  "confirmPassword": "password123"
}
```

**Risposta Successo (200):**
```json
{
  "status": "success",
  "message": "Registrazione completata",
  "user": {
    "id": 1234567890,
    "name": "Mario Rossi",
    "email": "mario@example.com"
  }
}
```

**Risposta Errore (400):**
```json
{
  "error": "Email già registrata"
}
```

---

### POST /api/auth/login
**Richiesta:**
```json
{
  "email": "mario@example.com",
  "password": "password123"
}
```

**Risposta Successo (200):**
```json
{
  "status": "success",
  "token": "eyJpZCI6MTIzNDU2Nzg5MCwiZW1haWwiOiJtYXJpb0BleGFtcGxlLmNvbSIsInRpbWVzdGFtcCI6MTcwMDAwMDAwMH0=",
  "user": {
    "id": 1234567890,
    "name": "Mario Rossi",
    "email": "mario@example.com"
  }
}
```

**Risposta Errore (401):**
```json
{
  "error": "Email o password incorretti"
}
```

---

### GET /api/auth/profile
**Headers Richiesti:**
```
Authorization: Bearer <token>
```

**Risposta Successo (200):**
```json
{
  "status": "success",
  "user": {
    "id": 1234567890,
    "name": "Mario Rossi",
    "email": "mario@example.com",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "loginHistory": [
      {
        "timestamp": "2024-01-20T15:45:00.000Z",
        "ip": "192.168.1.100"
      }
    ]
  }
}
```

---

### POST /api/auth/logout
**Richiesta:** (nessun body richiesto)

**Risposta (200):**
```json
{
  "status": "success",
  "message": "Logout effettuato"
}
```

---

### POST /api/auth/verify
**Richiesta:**
```json
{
  "token": "eyJpZCI6MTIzNDU2Nzg5MCwiZW1haWwiOiJtYXJpb0BleGFtcGxlLmNvbSIsInRpbWVzdGFtcCI6MTcwMDAwMDAwMH0="
}
```

**Risposta Valido (200):**
```json
{
  "valid": true,
  "user": {
    "id": 1234567890,
    "name": "Mario Rossi",
    "email": "mario@example.com"
  }
}
```

**Risposta Non Valido (200):**
```json
{
  "valid": false
}
```

## Struttura Database (users.json)

```json
[
  {
    "id": 1234567890,
    "name": "Mario Rossi",
    "email": "mario@example.com",
    "password": "password123",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "loginHistory": [
      {
        "timestamp": "2024-01-20T15:45:00.000Z",
        "ip": "192.168.1.100"
      },
      {
        "timestamp": "2024-01-20T16:20:00.000Z",
        "ip": "192.168.1.100"
      }
    ]
  }
]
```

## Funzionalità chiave di `auth-manager.js`

### isAuthenticated()
Controlla se esiste un token valido in localStorage.

```javascript
if (isAuthenticated()) {
  // Utente autenticato
}
```

### getCurrentUser()
Restituisce l'oggetto utente da localStorage.

```javascript
const user = getCurrentUser();
console.log(user.name); // "Mario Rossi"
```

### logout()
Effettua il logout: cancella localStorage e reindirizza a login.

```javascript
logout(); // Automatico al click del bottone "Log Out"
```

### Inizializzazione Automatica
Al caricamento di ogni pagina, il file controlla lo stato di autenticazione e aggiorna l'header:

- Se autenticato → mostra nome + bottone Logout
- Se non autenticato → mostra pulsanti Login/Registrazione

## File Interessati

| File | Descrizione |
|------|-------------|
| `server.js` | Backend Express con tutti gli endpoint |
| `login.html` | Pagina di login con form |
| `account.html` | Pagina di registrazione con form |
| `auth-manager.js` | Gestione sessione e UI dinamica |
| `users.json` | Database utenti (creato al primo accesso) |
| `css/style.css` | Stili per auth-btn e user-menu |

## Flusso Completo - Primo Accesso

1. **Utente anonimo** → Vede bottoni "Log" e "Acc"
2. **Clicca "Acc"** → Accede a `account.html`
3. **Compila registrazione** → POST `/api/auth/register`
4. **Registrazione ok** → Reindirizzato a `login.html`
5. **Compila login** → POST `/api/auth/login`
6. **Login ok** → Token salvato in localStorage, reindirizzato a `home.html`
7. **In `home.html`** → Header mostra "👤 Mario Rossi" + bottone "Log Out"
8. **Clicca "Log Out"** → localStorage cancellato, reindirizzato a `login.html`

## Sicurezza (Note Importanti)

⚠️ **Questo è un sistema demo per scopi educativi**

- Password salvate in chiaro (in produzione: usare bcrypt/argon2)
- Token Base64 semplice (in produzione: usare JWT con firma HMAC/RSA)
- Storage client-side non protetto (in produzione: usare httpOnly cookies)
- HTTPS non obbligatorio qui (in produzione: sempre usare HTTPS)
- No rate limiting su login (in produzione: implementare)

## Test

```bash
# 1. Registra nuovo utente
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"test123","confirmPassword":"test123"}'

# 2. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# 3. Verifica token
curl -X POST http://localhost:5000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<token-ricevuto>"}'

# 4. Logout
curl -X POST http://localhost:5000/api/auth/logout
```

## Problemi Comuni

**Q: Il login non funziona?**
A: Controlla che:
1. Il server sia in esecuzione (porta 5000)
2. Credenziali email/password siano corrette
3. L'email non abbia spazi bianchi extra

**Q: Dopo logout vedo ancora il nome utente?**
A: Ricarica la pagina con F5 per aggiornare lo stato dell'header.

**Q: Come creo un utente admin?**
A: Aggiungi manualmente un oggetto user a `users.json` con `"isAdmin": true` (feature futura).

---

**Versione:** 1.0
**Data:** Gennaio 2024
**Status:** ✅ Completo e Testato

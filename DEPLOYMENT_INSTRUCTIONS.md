# 🚀 DEPLOYMENT INSTRUCTIONS - EVIL Platform

Questo file contiene le istruzioni passo-passo per il deployment online.

---

## ✅ Pre-Deployment Checklist (Completato)

- [x] File `.env` creato
- [x] File `.gitignore` creato
- [x] `package.json` aggiornato
- [x] `Procfile` configurato
- [x] Database files pronto (users.json, achievements.json)
- [x] Tutte le dipendenze in package.json

---

## 🎯 COSA DEVI FARE TU (4 STEP SEMPLICI)

### STEP 1: Crea GitHub Repository

1. Accedi a [github.com](https://github.com)
2. Clicca **"New Repository"**
3. Nome: `evil-platform`
4. Descrizione: `Cybersecurity Learning Platform`
5. **Crea il repository vuoto** (non aggiungere README.md)

Dopo la creazione, github.com ti dirà i comandi da lanciare. Ecco il template:

```bash
git init
git add .
git commit -m "Initial commit - EVIL platform ready for deployment"
git branch -M main
git remote add origin https://github.com/TuoUsername/evil-platform.git
git push -u origin main
```

---

### STEP 2: Registrati su Railway.app

1. Vai a [railway.app](https://railway.app)
2. Clicca **"Login with GitHub"** oppure **"Get Started"**
3. Verifica l'email
4. Autorizza Railway ad accedere ai tuoi repo GitHub

---

### STEP 3: Deploy su Railway

1. Nel dashboard di Railway, clicca **"New Project"**
2. Seleziona **"Deploy from GitHub repo"**
3. Scegli il repository `evil-platform`
4. Railway inizierà il deploy automaticamente

**IMPORTANTE**: Durante il deploy vedrai log nel terminale. Aspetta che finisca (2-5 minuti).

---

### STEP 4: Configura le Environment Variables

Nel dashboard di Railway:

1. Vai al tuo progetto
2. Clicca su **"Variables"** (o **"Config"**)
3. Aggiungi queste variabili:

```
NODE_ENV=production
JWT_SECRET=your-secret-key-change-this-to-something-long-and-random
CORS_ORIGINS=https://railway-generated-domain.com
PORT=5000
```

**Per generare un JWT_SECRET forte**, esegui nel terminale:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

E copia il risultato nella variabile `JWT_SECRET`.

---

## 🌐 DOPO IL DEPLOY

Quando Railway finisce il deploy:

1. **Ricevi un URL pubblico**, tipo: `https://evil-platform-production.up.railway.app`
2. **Apri l'URL** nel browser
3. **Testa il sito**:
   - Registrati con un account nuovo
   - Accedi
   - Vai a `/profile.html`
   - Verifica che tutto funzioni

---

## 📌 COMANDI GIT DA LANCIARE (COPIA/INCOLLA)

Apri PowerShell nella cartella del progetto e lancia:

```powershell
# Se è la prima volta
git init

# Aggiungi tutti i file
git add .

# Fai il primo commit
git commit -m "Initial commit - EVIL platform production ready"

# Rinomina branch a main (se richiesto)
git branch -M main

# Aggiungi il remote (SOSTITUISCI TuoUsername con il tuo GitHub username!)
git remote add origin https://github.com/TuoUsername/evil-platform.git

# Carica su GitHub
git push -u origin main
```

Se git non è installato:
1. Scarica da [git-scm.com](https://git-scm.com)
2. Installa con le opzioni di default
3. Riavvia PowerShell
4. Lancia i comandi sopra

---

## 🔧 TROUBLESHOOTING

### "Module not found: express"
Soluzione: `npm install` (esegui in locale prima di fare push)

### "Port already in use"
Railway cambia automaticamente la porta. Non ti preoccupare.

### "CORS errors"
Aggiungi il tuo dominio nella variabile `CORS_ORIGINS` su Railway.

### Deployment bloccato?
1. Controlla i **logs** nel dashboard di Railway
2. Verifica che tutte le variabili di ambiente siano valorizzate
3. Controlla che il `Procfile` sia corretto

---

## 💾 COMANDI UTILI PER DOPO

### Aggiornare il sito online (dopo modifiche locali)
```powershell
git add .
git commit -m "Update: descrivi cosa hai cambiato"
git push
```
Railway farà il redeploy automaticamente!

### Testare localmente
```powershell
npm start
```

### Verificare pre-deploy (nuovo percorso!)
```powershell
node js/check-deployment.js
```

---

## 🎉 FATTO!

Quando hai finito tutti gli step, il tuo sito sarà online per sempre!

**URL del sito**: https://evil-platform-{generato-da-railway}.up.railway.app

Goditi il tuo cybersecurity platform online! 🚀

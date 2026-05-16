# 🏆 Sistema di Progressi e Trofei EVIL - Guida di Test

## 📦 Cosa è stato implementato

Un sistema completo di **progressi**, **trofei** e **statistiche** per gli utenti autenticati con animazione stile **Xbox** quando si sblocca un trofeo.

## 🚀 Come Testare

### 1. **Assicurati che il Server sia in Esecuzione**

```bash
npm start
# oppure
node server.js
```

Il server deve essere avviato su `http://localhost:5000`

### 2. **Accedi o Registrati**

1. Vai a `http://localhost:5000`
2. Clicca su "Acc" (Account) per registrarti
3. Compila il modulo di registrazione
4. Accedi con le tue credenziali

### 3. **Visita il Profilo**

Una volta loggato:
- Vai a `http://localhost:5000/profile.html`
- Vedrai il tuo profilo con:
  - Dati personali
  - Statistiche di progresso (scansioni, attività, trofei)
  - Griglia con tutti i trofei (bloccati/sbloccati)
  - Registro delle attività

### 4. **Sblocca i Trofei**

Esegui le seguenti attività per sbloccare i trofei:

#### **Primo Scan** (Easy)
- Vai a `security-check.html`
- Inserisci un URL (es. `google.com`)
- Clicca "Analizza"
- **✅ Trofeo sbloccato!** Vedrai l'animazione Xbox

#### **Master DNS** (Medium)
- Vai a `dns-enumerator.html`
- Esegui 10 enumerazioni DNS
- Dopo la 10ª, vedrai l'animazione del trofeo

#### **Difensore da Phishing** (Hard)
- Vai a `phishing-quiz.html`
- Completa il quiz con il 100% di precisione
- Se raggiungi 100%, il trofeo si sblocca automaticamente

#### **Social Engineer** (Medium)
- Vai a `social-engineering.html`
- Completa una simulazione
- Il trofeo si sblocca al completamento

#### **Analista SSL** (Easy)
- Vai a `ssl-analyzer.html`
- Analizza 5 certificati SSL
- Dopo la 5ª analisi, vedrai il trofeo

#### **Cacciatore di Vulnerabilità** (Medium)
- Vai a `vulnerability-scanner.html`
- Esegui 5 scansioni di vulnerabilità
- Il trofeo si sblocca dopo 5 risultati

#### **OSINT Pro** (Medium)
- Vai a `social-profiling.html`
- Raccogli informazioni da 3 profili social
- Il trofeo si sblocca

#### **Esperto di Malware** (Medium)
- Vai a `malware-classification.html`
- Identifica correttamente 5 tipi di malware
- Il trofeo si sblocca

#### **Ethical Hacker** (Hard)
- Vai a `ethical-hacking.html`
- Completa il tutorial
- Il trofeo si sblocca

#### **Lab Master** (Hard)
- Vai a `virtual-lab.html`
- Completa il laboratorio virtuale
- Il trofeo si sblocca

#### **Monitore di Attacchi** (Easy)
- Vai a `attacks-map.html`
- Visualizza la mappa attacchi
- Il trofeo si sblocca

#### **Generatore di Report** (Medium)
- Vai a `report-generator.html`
- Genera 3 report
- Il trofeo si sblocca

#### **Scansionista Seriale** (Medium)
- Esegui 10 scansioni di sicurezza
- Il trofeo si sblocca automaticamente

#### **Esploratore Totale** (Hard)
- Visita tutte le sezioni della piattaforma
- Il trofeo si sblocca

#### **Collezionista Supremo** (Legendary)
- Sblocca 10 trofei
- Il trofeo si sblocca automaticamente

## 🎮 L'Animazione Xbox

Quando sbloccate un trofeo, vedrete un'animazione nel basso centro dello schermo con:

- 🔴 **Logo EVIL** in rosso con glow luminoso
- 🏆 **Icona del trofeo** che bounza
- 💚 **Nome trofeo** in verde neon
- 📝 **Descrizione** dell'obiettivo
- ✅ **Etichetta** "TROFEO SBLOCCATO"

L'animazione dura **4 secondi** e poi scompare.

## 📊 Cosa Viene Salvato

Nel profilo vedrai:
- **Scansioni Completate**: Numero totale di scansioni eseguite
- **Attività Completate**: Numero totale di attività loggare
- **Trofei Sbloccati**: Numero di trofei sbloccati su 15 totali

Il registro attività mostra le **ultime 10 attività** con:
- Timestamp esatto
- Tipo di attività
- Emoji descrittiva

## 🔐 Struttura del Database

I progressi vengono salvati nel **server** associati all'ID utente in `users.json`:

```json
{
  "id": 123456789,
  "name": "Mario Rossi",
  "email": "mario@example.com",
  "password": "encrypted",
  "progress": {
    "totalScans": 5,
    "totalActivities": 12,
    "unlockedAchievements": ["first_scan", "ssl_analyst"],
    "activityLog": [
      {
        "name": "scan",
        "timestamp": "2026-01-21T22:41:07.883Z",
        "scanType": "url_security_check"
      }
    ],
    "lastUnlockedAchievement": "ssl_analyst"
  }
}
```

## 🛠️ File Principali

- **`achievements.json`** - Database dei 15 trofei
- **`js/progress-manager.js`** - Gestore dei progressi e trofei
- **`html/profile.html`** - Pagina profilo con statistiche
- **`css/style.css`** - Stili e animazioni
- **`server.js`** - API endpoints (righe 1080-1190)

## 🐛 Troubleshooting

### Problema: Non vedo l'animazione del trofeo

**Soluzione**: 
- Controlla che il browser non sia in modalità mute (audio del browser)
- Verifica che il CSS sia caricato (`F12` → Console)
- Controlla che il token di autenticazione sia valido

### Problema: I progressi non si salvano

**Soluzione**:
- Verifica di essere loggato
- Controlla che il server sia in esecuzione
- Vedi i log del server per errori
- Prova a ricaricare la pagina (`F5`)

### Problema: Il profilo non mostra i dati

**Soluzione**:
- Accedi di nuovo
- Cancella la cache del browser (`Ctrl+Shift+Del`)
- Prova con un browser diverso

## 📱 Responsività

Il sistema è completamente responsive:
- ✅ Desktop (1200px+)
- ✅ Tablet (768px - 1199px)
- ✅ Mobile (< 768px)

Le animazioni si adattano automaticamente alle dimensioni dello schermo.

## 🎯 Prossimi Passi (Opzionali)

Se desideri estendere il sistema, puoi:

1. **Aggiungere più trofei** in `achievements.json`
2. **Modificare l'animazione** nel CSS
3. **Aggiungere suoni** quando si sblocca un trofeo
4. **Creare una leaderboard** globale
5. **Aggiungere livelli** (bronze, silver, gold)
6. **Sincronizzare con Discord** per verifiche social

## ✅ Checklist di Test

- [ ] Registrati e accedi
- [ ] Visita il profilo
- [ ] Esegui una scansione di sicurezza
- [ ] Verifica che appaia l'animazione del trofeo
- [ ] Controlla il profilo per le statistiche aggiornate
- [ ] Esegui altre attività per sbloccare più trofei
- [ ] Verifica il registro attività
- [ ] Testa la responsività su mobile
- [ ] Esci e accedi di nuovo per verificare il salvataggio

## 📞 Supporto

Se hai domande o problemi, consulta:
- [PROGRESS_SYSTEM_GUIDE.md](PROGRESS_SYSTEM_GUIDE.md) - Guida tecnica
- Console del browser (`F12` → Console)
- Log del server

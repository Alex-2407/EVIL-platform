# Sistema di Progressi e Trofei EVIL

## 📋 Panoramica

È stato implementato un sistema completo di progressi e trofei con animazione stile Xbox. Gli utenti loggati possono:

- ✅ Sbloccare trofei durante le attività
- ✅ Visualizzare i propri progressi nel profilo
- ✅ Ricevere notifiche animate quando sbloccano un trofeo
- ✅ Consultare il registro delle attività

## 🗂️ File Modificati/Creati

### 1. **achievements.json** (Nuovo)
Database con tutti i trofei disponibili. Ogni trofeo ha:
- `id`: Identificatore univoco
- `name`: Nome del trofeo
- `description`: Descrizione dell'obiettivo
- `icon`: Emoji del trofeo
- `category`: Categoria (tools, database, education, osint, attacks, special)
- `difficulty`: Livello di difficoltà (easy, medium, hard, legendary)

### 2. **js/progress-manager.js** (Nuovo)
Gestore principale del sistema di progressi con le seguenti funzioni:

```javascript
// Caricare i progressi dal server
await loadUserProgress();

// Salvare i progressi sul server
await saveUserProgress();

// Registrare un'attività
await logActivity('activity_name', { dettagli });

// Incrementare il contatore di scansioni
await incrementScans();

// Verificare e sbloccare trofei
await checkAchievements(activityName, details);

// Mostrare l'animazione del trofeo
showAchievementNotification(achievementId);

// Ottenere i trofei sbloccati
getUnlockedAchievements();

// Ottenere le statistiche
getProgressStats();

// Aggiornare l'interfaccia
updateProgressUI();
```

### 3. **server.js** (Modificato)
Aggiunti 4 nuovi endpoint API:

- `GET /api/achievements` - Carica il database dei trofei
- `POST /api/progress/save` - Salva i progressi dell'utente
- `GET /api/progress/load` - Carica i progressi dell'utente
- `POST /api/progress/unlock-achievement` - Sblocca manualmente un trofeo (testing)

### 4. **css/style.css** (Modificato)
Aggiunti stili per:
- Animazione di popup del trofeo stile Xbox
- Glow del logo EVIL
- Animazioni di transizione e bounce
- Responsive design per mobile

### 5. **html/profile.html** (Nuovo)
Pagina dedicata al profilo utente con:
- Informazioni dell'utente
- Statistiche di progresso (scansioni, attività, trofei)
- Griglia interattiva di tutti i trofei (sbloccati e bloccati)
- Registro attività recente

### 6. **html/home.html, security-check.html** (Modificati)
Aggiunto il reference al progress-manager.js

## 🎮 Come Integrare nelle Altre Pagine

### Passo 1: Aggiungere il reference nel file HTML

Aggiungi questa riga prima del tag `</body>`:

```html
<script src="../js/progress-manager.js"></script>
```

### Passo 2: Registrare le attività

Aggiungi il trigger per loggare quando l'utente completa un'azione. Ecco gli esempi per ogni pagina:

#### **dns-enumerator.html** - DNS Enumeration
```javascript
// Dopo il completamento di una ricerca DNS
await logActivity('dns_enumeration', { count: results.length });
```

#### **ssl-analyzer.html** - SSL Analysis
```javascript
// Dopo l'analisi di un certificato
await logActivity('ssl_analysis', { count: certificatesAnalyzed });
```

#### **vulnerability-scanner.html** - Vulnerability Scanner
```javascript
// Quando trovate vulnerabilità
await logActivity('vulnerability_found', { count: vulnerabilitiesFound });
```

#### **phishing-quiz.html** - Phishing Quiz
```javascript
// Quando il quiz è completato con 100%
if (accuracy === 100) {
  await logActivity('phishing_quiz_completed', { accuracy: 100 });
}
```

#### **social-engineering.html** - Social Engineering
```javascript
// Quando la simulazione è completata
await logActivity('social_engineering_completed', { success: true });
```

#### **malware-classification.html** - Malware Database
```javascript
// Quando identifica un malware correttamente
await logActivity('malware_identified', { count: correctIdentifications });
```

#### **public-info.html** - OSINT
```javascript
// Quando raccoglie informazioni
await logActivity('osint_collection', { count: targetCount });
```

#### **ethical-hacking.html** - Ethical Hacking Tutorial
```javascript
// Quando completa il tutorial
await logActivity('ethical_hacking_completed', { success: true });
```

#### **virtual-lab.html** - Virtual Lab
```javascript
// Quando completa il lab
await logActivity('lab_completed', { success: true });
```

#### **attacks-map.html** - Attacks Map
```javascript
// Quando accede alla pagina
await logActivity('attacks_map_viewed', { success: true });
```

#### **report-generator.html** - Report Generator
```javascript
// Quando genera un report
await logActivity('report_generated', { count: reportsGenerated });
```

### Passo 3: Opzionale - Controllare l'autenticazione

Prima di loggare un'attività, verifica che l'utente sia loggato:

```javascript
if (isAuthenticated()) {
  await logActivity('activity_name', { details });
}
```

## 🏆 I Trofei Disponibili

| ID | Nome | Descrizione | Icona | Difficoltà |
|----|------|-------------|-------|-----------|
| first_scan | Primo Scan | Completa il tuo primo scan | 🔍 | Easy |
| malware_expert | Esperto di Malware | Identifica 5 tipi di malware | 🦠 | Medium |
| phishing_defender | Difensore da Phishing | Quiz con 100% di precisione | 🎣 | Hard |
| social_engineer | Social Engineer | Completa una simulazione | 🎭 | Medium |
| dns_master | Master DNS | Esegui 10 enumerazioni DNS | 🌐 | Medium |
| vuln_finder | Cacciatore di Vulnerabilità | Trova 5 vulnerabilità | 🔴 | Medium |
| ssl_analyst | Analista SSL | Analizza 5 certificati SSL | 🔒 | Easy |
| osint_pro | OSINT Pro | Raccogli info su 3 target | 🔎 | Medium |
| ethical_hacker | Ethical Hacker | Completa il tutorial | ⚔️ | Hard |
| lab_master | Lab Master | Completa il laboratorio virtuale | 🧪 | Hard |
| attack_monitor | Monitore di Attacchi | Visualizza la mappa attacchi | 🗺️ | Easy |
| report_generator | Generatore di Report | Genera 3 report | 📋 | Medium |
| ten_scans | Scansionista Seriale | Completa 10 scansioni | 📊 | Medium |
| master_collector | Collezionista Supremo | Sblocca 10 trofei | 👑 | Legendary |
| all_sections | Esploratore Totale | Visita tutte le sezioni | 🌟 | Hard |

## 🎨 Animazione del Trofeo

Quando un utente sblocca un trofeo, viene mostrata un'animazione stile Xbox nella parte bassa centrale dello schermo con:

- Logo EVIL rosso con glow
- Icona del trofeo che bounza
- Nome del trofeo in verde neon
- Descrizione dell'obiettivo
- Etichetta "TROFEO SBLOCCATO"
- Durata: 4 secondi

## 📱 Responsive Design

Il sistema è completamente responsive e funziona su:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🔐 Sicurezza

- I progressi sono salvati sul server associati all'ID utente
- Solo gli utenti autenticati possono salvare/caricare i progressi
- I token di autenticazione sono validati prima di ogni operazione

## 🚀 Testing

Per testare il sistema:

1. Registrati e accedi
2. Visita il tuo profilo (`profile.html`)
3. Esegui le varie attività per sbloccare i trofei
4. Osserva le animazioni Xbox quando sbloccavi i trofei
5. Controlla il registro attività nel profilo

## 🔧 Personalizzazione

### Aggiungere un nuovo trofeo

1. Aggiungi una voce in `achievements.json`
2. Aggiungi la logica di sblocco in `progress-manager.js` nella funzione `checkAchievements()`
3. Aggiungi il trigger di logging nella pagina HTML corrispondente

### Modificare l'animazione

Modifica il CSS in `style.css` nelle sezioni:
- `.achievement-unlock-notification`
- `.achievement-popup`
- `@keyframes achievementPulse`
- `@keyframes evilGlow`
- `@keyframes iconBounce`

## 📊 Struttura Dati dei Progressi

I progressi salvati nel server hanno questa struttura:

```json
{
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
```

## 📝 Note

- I progressi vengono salvati automaticamente quando un'attività viene loggata
- Il database dei trofei è un file JSON statico e può essere facilmente esteso
- Le animazioni usano CSS3 per performance ottimali
- Il sistema è compatibile con tutti i browser moderni

## 🐛 Troubleshooting

**Problema**: I trofei non si sbloccano
- Verifica di essere loggato
- Controlla la console del browser per errori
- Assicurati che il progress-manager.js sia caricato

**Problema**: L'animazione non si vede
- Verifica che il CSS sia caricato correttamente
- Controlla che non ci siano conflitti di z-index
- Prova con un browser diverso

**Problema**: I progressi non si salvano
- Verifica che il server sia in esecuzione
- Controlla il token di autenticazione
- Vedi i log del server per errori

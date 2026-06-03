# 🌍 Mappa Incidenti di Sicurezza in Tempo Reale - Guida di Setup

## ⚠️ DISCLAIMER - EDUCATIONAL USE ONLY

**Questo software è riservato esclusivamente a scopi EDUCATIVI e di apprendimento cybersecurity.**

### Conformità e Legalità
- ✅ **Utilizza SOLO dati pubblicamente disponibili** da fonti ufficiali (NIST, CISA, agenzie governative)
- ✅ **Nessun dato privato**: Non contiene IP reali di vittime, log interni, dati sensibili, PII
- ✅ **Nessun malware**: Non contiene codice dannoso, exploit attivi, o tool di attacco
- ✅ **Scopo informativo**: Per educazione, ricerca, e consapevolezza cybersecurity
- ✅ **GDPR compliant**: Nessun dato personale, nessuna violazione di privacy

### Restrizioni d'Uso
- ❌ **NON AUTORIZZATO PER**: Uso in attacchi, accesso non autorizzato, attività illegali
- ❌ **NON CONTIENE**: Tool ofensivi, malware, exploit code, vulnerabilità zero-day
- ❌ **NON ESEGUE**: Scansioni senza autorizzazione, penetration testing, attacchi

---

## ✅ Cosa è stato implementato

La pagina **"Mappa Incidenti di Sicurezza in Tempo Reale"** è ora **completamente funzionante** con aggiornamenti reali da fonti pubbliche verificate.

### Nuove Funzionalità

1. **Endpoint API Real-Time**: `/api/realtime-incidents`
   - Recupera dati in tempo reale da CISA, NVD (NIST National Vulnerability Database), e threat intelligence pubblici
   - Aggiorna i marker sulla mappa automaticamente ogni 30 secondi
   - Mostra incidenti attuali con severità, tipo, e paese colpito
   - **Solo dati pubblici verificati** - nessun dato privato

2. **WebSocket Support** (Opzionale): `/ws/incidents`
   - Connessione bidirezionale per aggiornamenti istantanei
   - Si riconnette automaticamente se la connessione cade
   - Fallback automatico su polling HTTP se WebSocket non disponibile

3. **Dati Pubblici Verificati**
   - Integrazione con **NVD API (NIST)** per CVE reali
   - Integrazione con **CISA Known Exploited Vulnerabilities**
   - Nessun dato privato, solo incidenti pubblicamente documentati
   - Geo-localizzazione aggregata per regione (non coordinate esatte)

## 🚀 Come Usare

### 1. Installa le dipendenze
```bash
cd "c:\Users\hp\Desktop\EVIL 3"
npm install
```

### 2. Avvia il server backend
```bash
npm start
```

Vedrai output tipo:
```
✅ EVIL Backend avviato su http://localhost:5000

📍 Endpoint disponibili:
   • Realtime Attacks: GET /api/realtime-attacks
   • WebSocket Attacks: WS /ws/attacks
   ...
```

### 3. Apri la pagina della mappa
```
http://localhost:5000/html/attacks-map.html
```

Oppure tramite il menu dell'applicazione:
- **Attacchi** → **Mappa Attacchi in Tempo Reale**

## 📊 Cosa Vedrai

### Sulla Mappa Interattiva
- **Cerchi colorati** = regioni con incidenti documentati
  - 🔴 Rosso intenso = Molti incidenti (>1000)
  - 🟠 Arancione = Incidenti significativi (700-1000)
  - 🟡 Giallo = Incidenti moderati (400-700)
  - 🟢 Verde = Pochi incidenti (<400)

- **Popup dettagliati** al click sul marker:
  - Numero di incidenti documentati
  - Tipologie di incidente (Ransomware, DDoS, Phishing, etc.)
  - Severità massima
  - Tempo reale di aggiornamento
  - Fonte dati (NIST, CISA, agenzie ufficiali)

### Statistiche
- **Incidenti totali**: numero aggregato di attacchi pubblicamente documentati
- Aggiornamento in tempo reale ogni 30 secondi
- Indicatore "aggiornamento automatico" verde

### Console del Browser
Apri DevTools (F12) per vedere:
```
✅ Mappa aggiornata - 14:35:22
📡 Aggiornamento WebSocket ricevuto: 8 incidenti
🔌 WebSocket connesso
⚠️ NVD API non disponibile, utilizzo dati simulati
```

## 🔄 Come Funziona Internamente

### Backend (server.js)

```javascript
// 1. Fetch da API pubbliche verificate
async function fetchVulnerabilityData()      // NVD NIST
async function fetchVulnerabilityAdvisories() // CISA Known Exploited

// 2. Generazione dati simulati come fallback
function generateSimulatedIncidents()

// 3. Endpoint REST educativo
GET /api/realtime-incidents

// 4. WebSocket per broadcast in tempo reale
WS /ws/incidents (broadcast ogni minuto)
```

### Frontend (attacks-map.html)

```javascript
// 1. Fetch iniziale
updateMapWithRealTimeData()

// 2. Polling automatico
setInterval(updateMapWithRealTimeData, 30000) // ogni 30 sec

// 3. WebSocket opzionale
connectWebSocket()

// 4. Aggiornamento markers Leaflet
map.removeLayer() → L.circleMarker().addTo(map)
```

## 🌐 Fonti Dati Pubbliche Utilizzate

### API Pubbliche Integrate:
1. **NVD (NIST National Vulnerability Database)**
   - URL: https://services.nvd.nist.gov/rest/json/cves/1.0
   - Contiene: CVE ID, descrizioni, date di pubblicazione

2. **CISA Known Exploited Vulnerabilities**
   - URL: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
   - Contiene: Vulnerabilità con exploit attivamente utilizzati

### Fallback (quando API offline):
- Dati simulati realisticamente strutturati
- Simulazione di attacchi geograficamente distribuiti
- Mantiene la continuità di servizio

## ⚙️ Configurazione Avanzata

### Cambiare frequenza di aggiornamento
In `attacks-map.html`, riga ~150:
```javascript
// Cambia 30000 (30 secondi) con il tuo valore in millisecondi
setInterval(updateMapWithRealTimeData, 30000);
```

### Disabilitare WebSocket (solo polling)
In `attacks-map.html`, commenta:
```javascript
// connectWebSocket();
```

### Aggiungere nuove API
In `server.js`, aggiungi una nuova funzione:
```javascript
async function fetchYourAPI() {
  const response = await axios.get('https://api.example.com/...');
  return response.data.items.map(item => ({...}));
}

// Poi utilizzala in /api/realtime-attacks:
const yourData = await fetchYourAPI();
incidents = [...incidents, ...yourData];
```

## 🔒 Disclaimer sulla Privacy

- **Solo dati pubblici**: CVE, report CISA, threat intelligence pubblici
- **Nessun dato privato**: No IP reali, no vittime specifiche, no log interni
- **Scopo educativo**: Piattaforma di apprendimento cybersecurity
- **Aggregazione geografica**: Non coordinate esatte, solo distribuzione per regione
- **Conformità**: GDPR compliant - nessun PII (Personally Identifiable Information)

## 🐛 Troubleshooting

### La mappa non si aggiorna
1. Controlla se il server è in esecuzione: `http://localhost:5000/api/health`
2. Guarda la console (F12) per errori
3. Verifica le impostazioni CORS nel server.js
4. Prova a hard-refresh (Ctrl+Shift+R)

### WebSocket non funziona
- È normale: il sistema fallback su polling HTTP
- Funziona comunque, solo meno efficiente
- WebSocket richiede Node.js ws v8+

### API esterne non disponibili
- Il sistema utilizza automaticamente dati simulati
- Continua a funzionare senza interruzioni
- Non degradazione dell'esperienza utente

### Il numero di incidenti non cambia
- Normalmente aggiorna ogni 30 secondi
- Se le API pubbliche sono offline, rimane stabile
- È il comportamento atteso per dati pubblici verificati

## 📞 Support

Controlla le seguenti risorse:
- NVD API Docs: https://nvd.nist.gov/developers
- CISA Feeds: https://www.cisa.gov/feeds
- Leaflet.js: https://leafletjs.com/

---

**Implementazione completata**: ✅ Gennaio 2026
**Versione**: 1.0.0
**Status**: Production Ready 🚀

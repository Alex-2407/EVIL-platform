# Regole per le IA che lavorano su EVIL

Questo è l'unico file di regole del progetto. Claude (CLAUDE.md), Codex (AGENTS.md) e Gemini/Antigravity (GEMINI.md)
leggono il proprio file, che rimanda qui: se una regola cambia, si cambia solo qui.

## Il progetto
EVIL (https://www.projectevil.it) è una piattaforma didattica di cybersecurity di Alessandro Branca.
Visione: la conoscenza è neutra come il fuoco. EVIL insegna competenze tecniche avanzate con forte consapevolezza
etica, legale e professionale, per formare programmatori, professionisti della sicurezza, ethical hacker, ricercatori
e ingegneri del software. Non incoraggia mai attività illegali. Obiettivo: diventare un punto di riferimento per la
sicurezza digitale a ogni livello, dal bambino col primo telefono allo studente di sicurezza (sezione scuole, video
semplici per ogni età, sezione cyberbullismo con come riconoscerlo, contrastarlo e a chi chiedere aiuto).

Stack: Node.js 22 + Express (server/, middleware/, services/, utils/), pagine in html/ css/ js/, traduzioni in i18n/
(italiano e inglese), test node:test in tests/, deploy su Fly.io (fly.toml, Dockerfile), Postgres Neon, email Mailtrap.
Leggi README.md per struttura, comandi e scelte di sicurezza prima di toccare il codice.

## Regole che valgono sempre
1. **Tutto funziona davvero.** Niente simulazioni spacciate per dati veri (es. notizie): solo dati pubblici e reali,
   con la fonte. Se una funzione non si può fare davvero, dillo invece di simularla.
2. **Italiano e inglese.** Ogni testo visibile va in entrambe le lingue tramite il sistema i18n (docs/I18N.md);
   dopo modifiche ai testi esegui `npm run build` e `npm run i18n:check`.
3. **Stile.** Tema scuro ambra/verde di EVIL, animazioni ed effetti curati, easter egg benvenuti. Non introdurre
   librerie grafiche o stili che stonano con quelli esistenti in css/.
4. **Sicurezza prima di tutto.** Non indebolire mai header, CSP, limiti di richieste, controlli anti-SSRF
   (server/lib/safe-http.js), autenticazione e gestione delle sessioni descritti nel README. Niente segreti nel codice
   o nei log: le variabili stanno in .env (vedi .env.example). Contenuti offensivi solo in forma didattica, etica e legale.
5. **Una modifica alla volta.** Piccola, completa, con test quando ha senso. Non riscrivere parti che non c'entrano.
6. **Controlli obbligatori prima di dire "fatto":** `npm test`, `npm run lint`, `npm run check:encoding` devono passare.
7. **Git.** Lavora solo sul ramo che ti viene indicato (rami `squadra/...`). Mai lavorare su `main`, mai fare push,
   merge o deploy: li decide Alessandro dopo aver provato la versione locale e aver detto "FINE".
8. **Lingua di lavoro:** scrivi commenti, messaggi e note per Alessandro in italiano, semplice e diretto.

## Progetto in corso: «EVIL per tutti»
Ramo `squadra/evil-per-tutti` (non ancora unito a `main`). Prima di lavorarci leggi, in quest'ordine:
docs/evil-per-tutti/STATO.md (a che punto siamo e prossimo passo), PIANO.md (fasi, decisioni D1–D7),
STILE.md (colori, movimento, parole, sorprese per l'area chiara «Per tutti»). L'area «Per tutti» usa uno stile a
carta chiara (css/per-tutti.css) diverso dal tema scuro del resto del sito: è una scelta voluta (PIANO.md, T4).
- **Pagine generate:** Primi passi (`html/primi-passi.html`, `html/pp-*.html`) ed EVIL Scuola (`html/scuola*.html`)
  e i loro dizionari inglesi non si modificano a mano. I testi stanno in `server/lib/primi-passi-content.js`,
  `server/lib/scuola-content.js`, `server/lib/scuola-kit-delicati.js`, `server/lib/scuola-famiglie.js`; poi
  `node scripts/build-primi-passi.js` e `node scripts/build-scuola.js` (un test fallisce se ci si dimentica).
- **Contenuti delicati** (pagina Aiuto, tappe 7 e 8, kit 2, 3 e 6): fonti ufficiali con data, mai colpa a chi subisce,
  restano «da rivedere» finché un esperto non li approva (decisione D3). I contatti di aiuto
  (server/lib/help-contacts.js) vanno riverificati entro il 16 gennaio 2027: un test lo ricorda.
- Fonti già verificate: docs/evil-per-tutti/fonti/FASE3.md. Revisioni passate: docs/evil-per-tutti/REVISIONI.md.
- Niente dati di minori, niente account sotto i 14 anni, niente tracciamento. Nessuna sorpresa nella pagina Aiuto.
- Controlli in più su questo ramo: `node scripts/i18n.js check --strict`; prove nel browser in scripts/e2e/
  (servono Playwright e il server avviato).

## La squadra e i ruoli
La squadra divide il lavoro in base alla quota disponibile di ogni abbonamento, non lo ripete: ogni passaggio lo fa una sola IA.
| Ruolo | Chi | Quando |
|---|---|---|
| Piano e codice | Codex (ChatGPT) | sempre: ha la quota più ampia e fa il grosso del lavoro, comprese le correzioni |
| Revisione | Gemini via Antigravity | sempre, in sola lettura: Gemini Flash per modifiche piccole, Gemini Argon per quelle grandi |
| Revisione di sicurezza | Claude via Antigravity (quota Google) | solo se la modifica tocca i file "delicati" elencati in squadra.json |
| Correzioni finali | Claude via Antigravity | solo se dopo due giri la revisione chiede ancora correzioni |
| Riserva | Claude Code sul PC (quota Claude Pro) | solo se Codex e Antigravity non sono disponibili |
| Contenuti visivi | Gemini e ChatGPT | immagini e video per scuole e bambini, illustrazioni |
| Sicurezza delle dipendenze | Snyk | scansioni |
| Decide e pubblica | Alessandro | prova in locale (AAAPRIMI PER INIZIARE/start-local.bat), poi dice FINE |

I comandi di controllo e i file delicati sono in squadra.json, nella cartella principale.

## La lavagna
docs/LAVAGNA.md è il filo comune: ogni IA, a fine turno, aggiunge in fondo una sezione breve
(chi sei, cosa hai fatto, file toccati, cosa resta al prossimo). Non cancellare le sezioni degli altri.

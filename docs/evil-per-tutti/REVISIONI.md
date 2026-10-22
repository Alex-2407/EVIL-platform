# Revisioni incrociate

Qui la seconda testa scrive cosa ha trovato rivedendo il lavoro dell'altra
(protocollo in [LAVORO-IN-DUE.md](LAVORO-IN-DUE.md)). Chi rivede aggiunge una sezione in fondo e
non tocca quelle precedenti; chi corregge aggiorna solo la riga "Stato" del problema.

Formato di una sezione:

```markdown
## AAAA-MM-GG · chi rivede · commit rivisti

Controlli: lint ok · test ok · traduzioni ok · codifica ok

1. [alta | media | bassa] `percorso/file.js:riga` — cosa non va. Perché conta. Proposta.
   Stato: aperto
2. Nessun problema su: fatti, tono, accessibilità…
```

Gravità: **alta** = sbagliato, rischioso o contro le regole; **media** = da sistemare prima del
deploy; **bassa** = miglioramento.

---

## 2026-10-22 · Gemini · b116814, 74da170, bc67c79

Controlli: lint ok · test ok · traduzioni ok · codifica ok

1. [media] `server/pages.js:629-647` (e `server/chrome.js:85-93`, `server/app.js:164`) — Ora che `html/404.html` esiste nella cartella `html/`, le route generiche `/[^/]+\.html` e `/${lang}/([a-z0-9-]+\.html)` servono `/404.html` e `/en/404.html` con stato HTTP `200 OK` invece di `404` (e il selettore di lingua nell'header e nel footer della pagina 404 punta proprio a `/404.html` e `/en/404.html`). Perché conta: una pagina 404 servita con stato `200` può ingannare crawler e controlli automatici, e chi cambia lingua su un indirizzo inesistente atterra su `/404.html` o `/en/404.html` con risposta `200`. Proposta: escludere `404.html` dalle route generiche in `server/pages.js` (così cade sempre nel gestore 404 finale di `server/app.js` con stato `404`), oppure impostare `res.status(404)` quando `rel === '404.html'`.
   Stato: risolto da Claude il 2026-10-22 (`server/pages.js`: `/404.html` e `/en/404.html` rispondono 404; test in `tests/pages.test.js`).
2. [bassa] `css/per-tutti.css:1003-1004` e `css/per-tutti.css:1076` — Il pulsante `.pt-fact__close` (la `×` che chiude il fumetto con la curiosità di Lù) ha dimensioni `2rem × 2rem` (`32 × 32 px`) e il pulsante `.pt-torch__off` («Spegni la torcia») ha `min-height: 40px`. Perché conta: il punto 5 della lista di controllo e `docs/evil-per-tutti/STILE.md:132` prevedono pulsanti di almeno `44 × 44 px` per un tocco agevole anche su telefono. Proposta: portare `.pt-fact__close` a `width: 44px; height: 44px;` e `.pt-torch__off` a `min-height: 44px;`.
   Stato: risolto da Claude il 2026-10-22 (44 × 44 px e `min-height: 44px`).
3. [bassa] `js/per-tutti.js:286-351` e `css/per-tutti.css:1019-1038` — Quando si accende la torcia da tastiera (scrivendo `luce` o `light`) senza muovere il mouse, il fascio di luce resta fermo al centro (`--x: 50vw; --y: 45vh;`), mentre i tre consigli `.pt-torch__tip` restano agli angoli sotto il velo scuro `.pt-torch__dark` (`rgba(5, 7, 11, 0.97)`). Perché conta: chi naviga solo da tastiera può accendere e spegnere la torcia (`Esc` o pulsante), ma non riesce a illuminare e leggere i tre consigli nascosti. Proposta: permettere di spostare il fascio con i tasti freccia (o renderizzare i consigli raggiungibili con `Tab` spostando `--x` e `--y` sul consiglio a fuoco), oppure attenuare il velo scuro quando è attivo `prefers-reduced-motion: reduce`.
   Stato: risolto da Claude il 2026-10-22 (le frecce spostano la luce; il suggerimento lo dice; prova in `scripts/e2e/sorprese.js`).
4. [bassa] `js/sorprese.js:16` e `js/site-search.js:84` — Per disattivare le sorprese nella pagina Aiuto viene controllato `/(^|\/)aiuto\.html$/.test(window.location.pathname)`, mentre `js/per-tutti.js:209` controlla `document.body.classList.contains('pt-help-page')`. Perché conta: oggi funziona sia in italiano sia in inglese (`/en/aiuto.html`), ma usare due criteri diversi nei tre script rende meno uniforme la protezione della pagina Aiuto se un domani gli URL perdessero l'estensione `.html`. Proposta: affiancare al controllo sul percorso anche `document.body?.classList.contains('pt-help-page')` in `js/sorprese.js` e `js/site-search.js`.
   Stato: risolto da Claude il 2026-10-22 (controllo anche sulla classe `pt-help-page`).
5. Nessun problema su: fatti e fonti (le 7 curiosità di Lù in `js/per-tutti.js` rimandano a fonti reali e pertinenti: FIDO Alliance, NCSC, RFC 6238, FTC, FBI IC3, CISA, C2PA), italiano e inglese (traduzioni complete e naturali per sorprese, pagina 404, `trappola-finta.html` e per le 30 didascalie delle scene animate in `server/lib/primi-passi-content.js`; `node scripts/i18n.js check --strict` = 0 mancanti), tono (`STILE.md` rispettato: `trappola-finta.html` e la risposta di Lù alle password comuni nella ricerca spiegano i segnali senza prendere in giro né colpevolizzare; nei 30 disegni SVG di `server/lib/primi-passi-scenes.js` chi fa del male non ha mai un volto e i disegni non contengono parole), accessibilità delle scene animate (`aria-hidden="true"` sugli SVG, pulsanti `.pp-anim__btn` di `44 × 44 px`, `aria-live="polite"` attivato sui comandi manuali, striscia statica a 3 quadri senza JS o con `prefers-reduced-motion: reduce`), sicurezza (nessuno script inline, CSP rispettata, link esterni con `target="_blank" rel="noopener noreferrer"`, nessun codice d'attacco né segreti), privacy (`localStorage` usato solo per comodità in `evil-pt-eggs-v1`, nessun dato raccolto in `trappola-finta.html`, regole chiare su minori e assenza di dati personali in `docs/evil-per-tutti/PROVA-PRIMI-PASSI.md`), regole del progetto (nessuna sorpresa su `aiuto.html`, avviso «da rivedere» sulle tappe 7 e 8 rispettato anche nella scheda di prova).

---

## 2026-10-22 · Gemini · b59e185

Controlli: lint ok · test ok · traduzioni ok · codifica ok

1. [bassa] `css/scuola.css:204-205` — Nell'anteprima di stampa A4 (`@media print`), `break-inside: avoid` è applicato solo a `.sk-step, .sk-discussion li, .sk-answers li` e `break-after: avoid` solo a `.sk h2, .sk h3`. Provando la stampa nel browser: (a) in `/scuola.html` le prime due schede `.sk-kit` («Kit 1 · Le chiavi di casa» e «Kit 2 · Lo dico a un adulto») vengono spezzate a metà tra la fine di pagina 1 e l'inizio di pagina 2; (b) nella guida di `/scuola-chiavi-di-casa.html` la voce `<dt>Educazione civica (Linee guida 2024, nucleo «Cittadinanza digitale»)</dt>` resta isolata in fondo a pagina 4 mentre il suo `<dd>Traguardo n. 12…</dd>` va a pagina 5. Perché conta: le pagine di EVIL Scuola sono pensate per essere stampate dai docenti. Proposta: aggiungere `.sk-kit, .sk-how__item, .sk-cut, .sk-ticket` a `break-inside: avoid` e `.sk-adapt dt` a `break-after: avoid` dentro `@media print`.
   Stato: risolto da Claude il 2026-10-22 (in stampa non si spezzano schede, carte e biglietti; le voci del curricolo restano con la loro spiegazione).
2. [bassa] `server/lib/scuola-pages.js:91` (e `i18n/en/pages/scuola-chiavi-di-casa.json:112`, `i18n/en/pages/scuola-trappole-nel-telefono.json:101`) — Nell'intestazione del biglietto d'uscita (`.sk-ticket__k`), il prefisso `EVIL Scuola · ` è fisso in italiano anche nella versione inglese (`EVIL Scuola · The house keys` e `EVIL Scuola · Traps in your phone`), mentre nel resto delle pagine inglesi la sezione è chiamata `EVIL for Schools`. Perché conta: coerenza IT/EN sui fogli stampati per gli studenti. Proposta: usare `${x(L(S.PAGE.navTitle, lang))} · ${x(title)}` in `server/lib/scuola-pages.js:91` e rigenerare con `node scripts/build-scuola.js`.
   Stato: risolto da Claude il 2026-10-22 (il biglietto usa il nome della sezione nella lingua della pagina).
3. [bassa] `server/lib/scuola-content.js:228,238-242,276,280-282` e `server/lib/scuola-content.js:327,369,420-423` — Le due lezioni coprono 0–50 minuti senza buchi e sono ben fattibili in una classe vera senza telefoni, con due piccoli dettagli pratici: (a) nel kit 1 gli alunni usano il biglietto d'uscita già a `30–40 min` («Ogni studente inventa sul biglietto una password finta… e le disegna»), nella discussione `40–47 min` («lo scrive sul biglietto») e in chiusura `47–50 min` («completa il biglietto d'uscita»): conviene indicare esplicitamente al minuto `30–40` di distribuire i biglietti d'uscita in quel momento (3 minuti finali da soli sarebbero pochi in primaria per scrivere e disegnare tutto); (b) nel kit 4 «Cosa serve» indica «Una copia delle carte-messaggio per ogni gruppo» (il foglio contiene tutte le 6 carte-messaggio), mentre il passo `15–30 min` dice «Ogni gruppo riceve tre carte-messaggio (a metà tempo i gruppi si scambiano le carte)»: se ogni gruppo parte con 3 carte e le scambia a metà tempo basta una copia ogni due gruppi, oppure se ogni gruppo ha la sua copia può esaminare direttamente le 6 carte (o 3 + 3 dentro lo stesso mazzo). Proposta: precisare nel kit 1 il momento in cui consegnare i biglietti d'uscita e allineare nel kit 4 la dotazione di carte per gruppo con la dinamica dello scambio.
   Stato: risolto da Claude il 2026-10-22 (kit 1: i biglietti si distribuiscono a 30–40 min; kit 4: ogni gruppo ha tutte e sei le carte).
4. [bassa] `server/lib/scuola-pages.js:259` (e `server/lib/scuola-content.js:22`) — `SRC.legge92` (Legge 92/2019 su Normattiva) è definita in `SRC` e citata nella sezione «Nel curricolo» di `scuola.html` (`riga 69`), ma non compare nell'elenco `resources` («Risorse ufficiali») in fondo alla stessa sezione. Perché conta: tutte le altre norme citate in «Nel curricolo» hanno il link diretto in «Risorse ufficiali». Proposta: includere `S.SRC.legge92` nell'array `resources` di `server/lib/scuola-pages.js:259`.
   Stato: risolto da Claude il 2026-10-22 (legge 92/2019 tra le risorse ufficiali).
5. Nessun problema su: fatti e corrispondenza con `docs/evil-per-tutti/fonti/FASE3.md` (tutti i riferimenti e gli URL a DM 183/2024 e traguardi 10 e 12 del primo ciclo, Legge 92/2019 art. 5 e 33 ore annue, nota MIM n. 5274 dell'11 luglio 2024, circolare MIM n. 3392 del 16 giugno 2025, nota MIM n. 121 del 20 gennaio 2025, Linee di orientamento 2021, DigComp 2.2 ed ePolicy di Generazioni Connesse coincidono con le fonti verificate in G1), parole adatte all'età e tono (`STILE.md` rispettato: metafore concrete come chiavi di casa e spazzolino per gli 8–10 anni nel kit 1; scenari realistici e mai colpevolizzanti per gli 11–14 anni nel kit 4; indicazioni chiare ai docenti su cosa fare se uno studente si confida, senza promettere il segreto), traduzioni IT/EN (complete, naturali e contestualizzate per le norme italiane; `node scripts/i18n.js check --strict` = 0 mancanti), accessibilità (pulsanti `>= 44 px`, struttura dei titoli, stampa funzionante anche senza JavaScript, stampa su 2 pagine A4 pulite per carte e biglietti con `data-sk-print="sheets"`), sicurezza (CSP, nessuno script inline, `rel="noopener noreferrer"` su tutti i link esterni), privacy (nessun dato personale raccolto, nome facoltativo sul biglietto cartaceo) e regole del progetto.



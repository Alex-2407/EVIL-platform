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


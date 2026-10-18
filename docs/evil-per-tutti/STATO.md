# Stato — EVIL per tutti

Ramo: `feat/evil-per-tutti` · piano: [PIANO.md](PIANO.md)

## Prossimo passo

**Fase 3, EVIL Scuola — 3.1 pagina Scuola e sei kit da 50 minuti** (due per ciclo, stampabili,
collegati alle linee guida di educazione civica e alle fonti ufficiali), poi modalità classe alla
LIM, kit per le famiglie e per il referente cyberbullismo.

In parallelo, quando Alessandro può: la **prova di Primi passi con 5–10 persone** (controllo di fine
fase 2) con la scheda [PROVA-PRIMI-PASSI.md](PROVA-PRIMI-PASSI.md); le correzioni che ne escono
diventano un passo dedicato.

## Fatto

| Passo | Cosa | Commit |
|---|---|---|
| 1.1 | Ramo, piano, stato e istruzioni per le sessioni future (`CLAUDE.md`) | `aad28f9` |
| 1.3 | Contatti di aiuto verificati (`server/lib/help-contacts.js`), segnaposto `<!--evil:fragment:…-->` generati dopo la traduzione (`server/fragments.js`), test con scadenza a 90 giorni | `0547766` |
| 1.2 | Sistema di stile: `STILE.md`, `css/per-tutti.css` (token con contrasto verificato, componenti, stampa, movimento ridotto), Atkinson Hyperlegible Next e Mono self-hosted (OFL), Lù in SVG (`server/lib/mascot.js`, frammenti `mascot*`), `js/per-tutti.js` (schede ARIA, entrate, Lù, Esci subito) | `cd29393` |
| 1.4 | Pagina Aiuto (`html/aiuto.html`, EN in `i18n/en/pages/aiuto.json`): per ruolo con schede, prove, diritti, contatti, Esci subito sotto l'header (anche con Esc Esc), area `per-tutti` prima nel menu (colore rosa, lucciole nel menu a tendina), header ricalibrato per cinque aree (1024–1920 px), suggerimento lingua su due righe da telefono, test `tests/per-tutti.test.js` | `3ab1fe3` |
| 1.5 | Pulsante "Aiuto" fisso in basso a sinistra su tutte le pagine tranne Aiuto (`server/chrome.js`, stili in `css/site-footer.css`), numeri da chiamare in cima a `help.html` prima del modulo | `8fba6ec` |
| 1.6 | Tutela dei minori: sezione 8 di `site-policies.html` (sezioni dopo rinumerate, EN aggiornato), collegata da `aiuto.html`, test | `5bbb9d9` |
| 2.2–2.11 (testi) | Contenuto delle 10 tappe in `server/lib/primi-passi-content.js` (IT/EN, storie, tre livelli, giochi, badge, fonti verificate il 18 ottobre 2026) e scheda editoriale `PRIMI-PASSI.md` | `a41e375` |
| 2.1, 2.2–2.12 | Primi passi online: `scripts/build-primi-passi.js` genera le 11 pagine e i dizionari inglesi dal modulo dei contenuti (`listUnits` in `server/i18n`, controllo di struttura e di traduzioni doppie), pagine in `server/lib/primi-passi-pages.js`, voci della mappa del sito da `sitePages()`, `js/primi-passi.js` (storia, "Fai subito", giochi classifica/ordina/scegli/trova con aiuti e "Gioca di nuovo", badge, riquadro "La tua tappa", percorso con le luci, lucciola d'oro, patentino stampabile in A4 orizzontale, ricomincia da zero), `css/primi-passi.css`, livelli con scheda predefinita da `aria-selected`, pulsante Aiuto compatto tra 641 e 1439 px, test `tests/primi-passi.test.js`, prove nel browser in `scripts/e2e/` | `9daf504` |
| 1.7 | Home "Chi sei?": subito dopo l'apertura una "stanza con la luce accesa" (`.pt-room`, che si accende entrando nello schermo) con Lù e quattro ingressi (ragazzi → Primi passi, genitori e nonni → truffe e Aiuto genitori, docenti → Primi passi alla LIM e Aiuto docenti, chi studia → percorsi), la striscia rossa per l'aiuto e quella scura verso le aree tecniche; il riquadro "Prima volta qui?" porta lì; EN tradotto; il pulsante Aiuto compatto non copre più il riquadro a 1366×768; test | `9c858fb` |
| 1.8 | Sorprese di Lù: password famose nella ricerca, "luce" accende la torcia con consigli nascosti, Lù toccata 5 volte racconta una curiosità vera con la fonte, premio finto nel footer → `trappola-finta.html`, pagina 404 vera (IT/EN, header, "password su un post-it"), messaggio in console, avvisi e badge segreto Esploratore (`js/sorprese.js`), badge segreti nella pagina di Primi passi; mai nella pagina Aiuto; test e `scripts/e2e/sorprese.js` | `b116814` |
| 2.13 | Scene delle storie: tre quadri per tappa (30 disegni SVG originali in `server/lib/primi-passi-scenes.js`, didascalie IT/EN nel campo `scene`), un quadro alla volta con pausa e frecce, partenza solo quando la scena è sullo schermo, oggetti che entrano uno dopo l'altro; striscia a fumetti con il movimento ridotto o senza JavaScript; chi fa del male non ha mai un volto, protagonisti con carnagioni e capelli diversi; corretto "la preside" nella tappa 9; regole in `PRIMI-PASSI.md` e `STILE.md`; test e prova nel browser | `74da170` |
| fine fase 2 | Scheda per la prova con 5–10 persone (`PROVA-PRIMI-PASSI.md`): chi, regole di tutela e privacy, preparazione in locale e da telefono, compiti, domande, cosa osservare, criteri di superamento, foglio di annotazione | questo commit |

## Note per chi riprende

- Alessandro ha chiesto il massimo su animazioni, colori, parole, frasi che agganciano, easter egg
  (simpatici ma non banali per gli adolescenti, più sobri per gli adulti): tutto passa da STILE.md.
- Prove nel browser: `scripts/e2e/aiuto.js` e `scripts/e2e/primi-passi.js` (serve Playwright,
  `PLAYWRIGHT=/percorso/node_modules/playwright`, e il server avviato). Le schermate di controllo
  si fanno con script nella cartella temporanea della sessione, non nel repository.
- Primi passi: i file `html/primi-passi.html`, `html/pp-*.html` e `i18n/en/pages/p*.json` sono
  generati. Si cambiano i testi in `server/lib/primi-passi-content.js` e si esegue
  `node scripts/build-primi-passi.js`; il test fallisce se ci si dimentica.
- I contatti di aiuto vanno riverificati entro il 16 gennaio 2027 (il test fallisce dopo 90 giorni).
- Le decisioni provvisorie (D1 nome, D3 revisori) aspettano Alessandro: non bloccano il codice,
  bloccano solo la pubblicazione della sezione Aiuto.
- Nessun deploy da questo ramo senza richiesta esplicita.

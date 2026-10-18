# Stato — EVIL per tutti

Ramo: `feat/evil-per-tutti` · piano: [PIANO.md](PIANO.md)

## Prossimo passo

**2.1 Primi passi**, prima della home "Chi sei?" (1.7): la home deve portare a destinazioni che
esistono. Il contenuto delle 10 tappe va progettato in `docs/evil-per-tutti/PRIMI-PASSI.md`.
Architettura decisa: contenuto bilingue in `server/lib/primi-passi-content.js` (come
`course-design.js`), uno script `scripts/build-primi-passi.js` che genera `html/primi-passi.html`,
`html/pp-<tappa>.html` e i dizionari `i18n/en/pages/*.json` (un test controlla che i file generati
siano aggiornati), voci nella mappa del sito generate dallo stesso modulo, `js/primi-passi.js` per
giochi (classifica, ordina, scegli, trova la trappola), progressi in `localStorage`, badge e
patentino stampabile. Poi 1.7 home "Chi sei?" (attenzione: il pulsante Aiuto in basso a sinistra
copre il riquadro "Primo accesso" della home a 1366×768), 1.8 sorprese.

## Fatto

| Passo | Cosa | Commit |
|---|---|---|
| 1.1 | Ramo, piano, stato e istruzioni per le sessioni future (`CLAUDE.md`) | `aad28f9` |
| 1.3 | Contatti di aiuto verificati (`server/lib/help-contacts.js`), segnaposto `<!--evil:fragment:…-->` generati dopo la traduzione (`server/fragments.js`), test con scadenza a 90 giorni | `0547766` |
| 1.2 | Sistema di stile: `STILE.md`, `css/per-tutti.css` (token con contrasto verificato, componenti, stampa, movimento ridotto), Atkinson Hyperlegible Next e Mono self-hosted (OFL), Lù in SVG (`server/lib/mascot.js`, frammenti `mascot*`), `js/per-tutti.js` (schede ARIA, entrate, Lù, Esci subito) | `cd29393` |
| 1.4 | Pagina Aiuto (`html/aiuto.html`, EN in `i18n/en/pages/aiuto.json`): per ruolo con schede, prove, diritti, contatti, Esci subito sotto l'header (anche con Esc Esc), area `per-tutti` prima nel menu (colore rosa, lucciole nel menu a tendina), header ricalibrato per cinque aree (1024–1920 px), suggerimento lingua su due righe da telefono, test `tests/per-tutti.test.js` | `3ab1fe3` |
| 1.5 | Pulsante "Aiuto" fisso in basso a sinistra su tutte le pagine tranne Aiuto (`server/chrome.js`, stili in `css/site-footer.css`), numeri da chiamare in cima a `help.html` prima del modulo | `8fba6ec` |
| 1.6 | Tutela dei minori: sezione 8 di `site-policies.html` (sezioni dopo rinumerate, EN aggiornato), collegata da `aiuto.html`, test | questo commit |

## Note per chi riprende

- Alessandro ha chiesto il massimo su animazioni, colori, parole, frasi che agganciano, easter egg
  (simpatici ma non banali per gli adolescenti, più sobri per gli adulti): tutto passa da STILE.md.
- Prove nel browser: script in `/tmp/.../scratchpad` (srv.sh, shots.js, e2e-aiuto.js) non sono nel
  repository; il controllo e2e dell'Aiuto copre schede, tastiera, link diretti, senza JS, Esci subito.
- I contatti di aiuto vanno riverificati entro il 16 gennaio 2027 (il test fallisce dopo 90 giorni).
- Le decisioni provvisorie (D1 nome, D3 revisori) aspettano Alessandro: non bloccano il codice,
  bloccano solo la pubblicazione della sezione Aiuto.
- Nessun deploy da questo ramo senza richiesta esplicita.

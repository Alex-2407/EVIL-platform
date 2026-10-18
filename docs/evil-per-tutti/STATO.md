# Stato — EVIL per tutti

Ramo: `feat/evil-per-tutti` · piano: [PIANO.md](PIANO.md)

## Prossimo passo

**1.2 Sistema di stile "Per tutti".** Scrivere `docs/evil-per-tutti/STILE.md` (colori con significato,
carattere leggibile, movimento, tono per età, frasi che agganciano senza dipendenza, easter egg),
poi `css/per-tutti.css`, il carattere self-hosted e la mascotte in SVG. Subito dopo: 1.4 pagina Aiuto,
che è la prima a usarli (con l'area `per-tutti` nella mappa del sito).

## Fatto

| Passo | Cosa | Commit |
|---|---|---|
| 1.1 | Ramo, piano, stato e istruzioni per le sessioni future (`CLAUDE.md`) | `aad28f9` |
| 1.3 | Contatti di aiuto verificati (`server/lib/help-contacts.js`), segnaposto `<!--evil:fragment:…-->` generati dopo la traduzione (`server/fragments.js`), test con scadenza a 90 giorni | questo commit |

## Note per chi riprende

- Alessandro ha chiesto il massimo su animazioni, colori, parole, frasi che agganciano, easter egg
  (simpatici ma non banali per gli adolescenti, più sobri per gli adulti): tutto passa da STILE.md.
- I contatti di aiuto vanno riverificati entro il 16 gennaio 2027 (il test fallisce dopo 90 giorni).
- Le decisioni provvisorie (D1 nome, D3 revisori) aspettano Alessandro: non bloccano il codice,
  bloccano solo la pubblicazione della sezione Aiuto.
- Nessun deploy da questo ramo senza richiesta esplicita.

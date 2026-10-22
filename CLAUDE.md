# EVIL — istruzioni per le sessioni di lavoro

Piattaforma didattica di cybersecurity (Node 22, Express), sito https://projectevil.it su Fly.io,
account su Postgres (Neon). Testi sorgente in italiano, versione inglese sotto `/en/`.

## Lavoro in corso

Progetto "EVIL per tutti": **leggi prima [docs/evil-per-tutti/STATO.md](docs/evil-per-tutti/STATO.md)**,
poi il piano in [docs/evil-per-tutti/PIANO.md](docs/evil-per-tutti/PIANO.md) (protocollo, decisioni, fasi).

Si lavora in due con Gemini ([docs/evil-per-tutti/LAVORO-IN-DUE.md](docs/evil-per-tutti/LAVORO-IN-DUE.md)):
a inizio sessione `git fetch`, guarda i rami `gemini/*` da rivedere e unire, e i problemi aperti in
[REVISIONI.md](docs/evil-per-tutti/REVISIONI.md).

## Regole di Alessandro

- Commit in locale a ogni passo; push solo sul ramo di lavoro o su richiesta esplicita. Mai su `main`
  né deploy senza richiesta.
- Solo dati reali e pubblici, con fonte. Niente codice d'attacco rischioso: tutto è difensivo o simulato.
- Messaggi di commit in italiano.

## Comandi

```bash
npm start                              # avvio
npm run lint && npm test               # controlli
node scripts/i18n.js check --strict    # traduzioni complete
npm run check:encoding                 # codifica dei file
```

## Dove stanno le cose

- `server/site-map.js`: unica fonte di menu, footer, sitemap, titoli e descrizioni (IT ed EN).
- `server/pages.js`: rendering delle pagine (header, footer, traduzioni, asset, SEO).
- `html/*.html`: pagine in italiano; traduzioni in `i18n/en/pages/*.json` (vedi `docs/I18N.md`).
- `js/i18n/en/`: copie inglesi dei file di dati.
- `server/lib/course-*.js`: corsi tecnici, laboratori, esami, diplomi.
- `server/lib/primi-passi-content.js`: testi di Primi passi (IT/EN). Le pagine `html/primi-passi.html`,
  `html/pp-*.html` e i loro dizionari sono generati: dopo ogni modifica `node scripts/build-primi-passi.js`.
- `server/lib/scuola-content.js`: kit di EVIL Scuola (IT/EN). `html/scuola.html`, `html/scuola-*.html` e i
  dizionari sono generati: dopo ogni modifica `node scripts/build-scuola.js`.
- `tests/`: test con `node:test` e `supertest`; prove nel browser in `scripts/e2e/` (con Playwright).

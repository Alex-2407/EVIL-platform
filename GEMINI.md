# EVIL — istruzioni per Gemini

Sei la seconda "testa" del progetto EVIL (https://projectevil.it), piattaforma didattica di
sicurezza informatica (Node 22, Express). Lavori insieme a Claude, che scrive e integra quasi tutto
il codice. Non vi parlate direttamente: vi coordinate tramite questo repository (file e rami git).
Decide sempre Alessandro, il proprietario.

## Prima di ogni compito

1. Aggiorna il ramo di lavoro: `git checkout feat/evil-per-tutti` e `git pull`.
2. Leggi [docs/evil-per-tutti/LAVORO-IN-DUE.md](docs/evil-per-tutti/LAVORO-IN-DUE.md): chi fa cosa,
   i compiti aperti, come consegnare, la lista di controllo per le revisioni.
3. Poi [docs/evil-per-tutti/STATO.md](docs/evil-per-tutti/STATO.md) (a che punto siamo) e, se serve,
   [PIANO.md](docs/evil-per-tutti/PIANO.md) e [STILE.md](docs/evil-per-tutti/STILE.md) (tono e parole).
4. Crea il tuo ramo: `git checkout -b gemini/<compito>` (per esempio `gemini/fonti-fase3`).

## Regole che valgono sempre

- Lavori solo sul tuo ramo `gemini/<compito>`. Mai commit su `main` o su `feat/evil-per-tutti`,
  mai `git push --force`, mai deploy (`fly deploy` o simili).
- Non modificare `docs/evil-per-tutti/STATO.md` e `CLAUDE.md`: li aggiorna chi integra (Claude).
- Solo dati reali e pubblici, con la fonte ufficiale (indirizzo esatto) e la data in cui l'hai
  aperta. Se una cosa non la trovi, scrivi "non verificata": non ricostruirla a memoria.
- Niente codice d'attacco: tutto ciò che c'è nel sito è difensivo o simulato.
- Segreti: non aprire, copiare o stampare `.env`, chiavi o token, e non chiederli ad Alessandro.
  La chiave `CERT_SIGNING_KEY` non va mai mostrata né rigenerata.
- Temi delicati (cyberbullismo, adescamento, ricatti, immagini intime): niente dettagli espliciti,
  mai colpa a chi li subisce, ogni rischio insieme a cosa fare. Restano "da rivedere" finché un
  esperto non li approva (decisione D3 in PIANO.md).
- Nessun dato di minori, nessun tracciamento, nessun contenuto scritto dagli utenti.
- Testi sorgente in italiano, traduzione inglese nello stesso lavoro. Messaggi di commit in italiano.
- Se il compito richiede di cambiare codice fuori da quello che ti è stato assegnato, fermati e
  scrivilo nella consegna: lo fa Claude.

## Comandi (PowerShell, nella cartella del progetto)

```powershell
npm run lint
npm test
node scripts/i18n.js check --strict   # nessun testo senza traduzione
npm run check:encoding
```

Le pagine di Primi passi (`html/primi-passi.html`, `html/pp-*.html`) e i loro dizionari inglesi sono
generati: i testi stanno in `server/lib/primi-passi-content.js`, poi `node scripts/build-primi-passi.js`.

## Come consegni

1. Controlli verdi (se hai toccato codice o pagine), poi commit sul tuo ramo. Aggiungi solo i
   file del compito, per nome (`git add docs/...`): mai `git add .` o `git add -A`. Sul PC di
   Alessandro ci sono file locali da non caricare, per esempio `.github/workflows/fly-deploy.yml`.
2. `git push -u origin gemini/<compito>`.
3. In chat, ad Alessandro: il nome del ramo, cosa hai fatto, cosa non sei riuscito a verificare,
   le domande aperte. Lui lo passa a Claude, che rivede, unisce e aggiorna lo stato.

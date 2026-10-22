# Lavoro in due: Claude e Gemini

Dal 22 ottobre 2026 EVIL si costruisce con due assistenti: **Claude** progetta, scrive il codice e
integra; **Gemini** verifica le fonti, prepara bozze e controlla il lavoro di Claude. Non si parlano:
si passano il lavoro attraverso il repository. Decide Alessandro.

Regole di Gemini: [GEMINI.md](../../GEMINI.md). Regole di Claude: [CLAUDE.md](../../CLAUDE.md).

## Chi fa cosa

| Lavoro | Claude | Gemini |
|---|---|---|
| Codice (server, pagine, script, stili, test) | sì | solo se assegnato, sul suo ramo |
| Integrazione in `feat/evil-per-tutti`, aggiornamento di STATO.md | sì | no |
| Ricerca e verifica di fatti, leggi, numeri, contatti | quando serve | sì, compito principale |
| Bozze di testi IT/EN nel formato dei contenuti | revisione finale | sì, sul suo ramo |
| Revisione incrociata | rivede i rami di Gemini | rivede i passi di Claude ([REVISIONI.md](REVISIONI.md)) |

## Rami

- `feat/evil-per-tutti`: ramo di lavoro, dove si integra. Ci scrive Claude.
- `gemini/<compito>`: un ramo per ogni compito di Gemini, nato da `feat/evil-per-tutti` aggiornato.
- `main`: nessuno dei due. Il deploy lo fa solo Alessandro.

## Il giro di un compito

1. Alessandro apre Gemini nella cartella del progetto e incolla il prompt del compito (sotto).
2. Gemini lavora sul suo ramo, fa push e riassume in chat cosa ha fatto.
3. Alessandro lo dice a Claude ("Gemini ha finito G1"); Claude comunque, a inizio sessione, fa
   `git fetch` e guarda i rami `gemini/*` e i problemi aperti in REVISIONI.md.
4. Claude rivede, corregge se serve, unisce e aggiorna STATO.md.
5. Dopo ogni passo di Claude, Gemini lo rivede e scrive l'esito in REVISIONI.md.

## Compiti aperti

| # | Compito | Chi | Stato |
|---|---|---|---|
| G1 | Verifica delle fonti per la fase 3 (EVIL Scuola): [fonti/FASE3.md](fonti/FASE3.md) | Gemini | fatto il 22 ottobre (unito) |
| G2 | Revisione dei passi 1.8, 2.13 e della scheda di prova | Gemini | fatto il 22 ottobre: 4 problemi, tutti risolti |
| C1 | 3.1a: motore dei kit, pagina Scuola, kit 1 e kit 4 | Claude | fatto il 22 ottobre |
| G3 | Revisione del passo 3.1a (EVIL Scuola) | Gemini | fatto il 22 ottobre: 4 problemi, tutti risolti |
| G4 | Bozza del kit 5 «Vero o falso nell’era dell’IA» | Gemini | fatto il 22 ottobre (unito, rivisto da Claude) |
| C2 | 3.1b–c: gli altri quattro kit, con le fonti di G1 | Claude | da fare |

## Prompt da incollare in Gemini

### G1 — Verifica delle fonti per la fase 3

```text
Compito G1 (leggi prima GEMINI.md). Ramo: gemini/fonti-fase3.
Verifica con la ricerca web le affermazioni qui sotto, che serviranno per i kit di EVIL Scuola.
Apri le fonti, preferendo quelle ufficiali (normattiva.it, gazzettaufficiale.it, mim.gov.it,
garanteprivacy.it, eur-lex.europa.eu, commissariatodips.it, ic3.gov e i siti dei servizi citati).
Scrivi il risultato in docs/evil-per-tutti/fonti/FASE3.md: una tabella con
# | affermazione | esito (confermata / da correggere / non trovata) | citazione breve (massimo
25 parole, tra virgolette) | fonte (indirizzo esatto) | ufficiale o secondaria | data di verifica.
Se un'affermazione è sbagliata, scrivi la versione corretta. Non inventare: meglio "non trovata".
Poi commit in italiano, push del ramo e un riassunto per Alessandro.

Scuola
1. Linee guida per l'educazione civica, DM n. 183 del 7 settembre 2024: nel nucleo "Cittadinanza
   digitale" il primo ciclo ha i traguardi n. 10, 11 e 12, il secondo ciclo le competenze n. 10, 11
   e 12. Riporta il testo esatto dei tre e l'indirizzo ufficiale del documento sul sito del MIM.
2. Le stesse Linee guida dicono di evitare lo smartphone nella scuola dell'infanzia e nel primo
   ciclo, e ammettono il tablet nel primo ciclo per finalità didattiche e inclusive.
3. Nota del MIM dell'11 luglio 2024 sul divieto dello smartphone nel primo ciclo: numero e contenuto.
4. Nota del MIM n. 3392 del 16 giugno 2025: divieto dello smartphone anche nella secondaria di
   secondo grado per tutto l'orario scolastico, anche a scopo didattico; quali eccezioni.
5. Legge 92/2019: l'articolo sulla cittadinanza digitale (art. 5) e il monte ore annuo minimo
   (33 ore): dove sta scritto.
6. Nota del MIM di gennaio 2025 (DGSIP, n. 121?) sugli adempimenti della legge 70/2024: referente
   per il bullismo, codice interno, tavolo permanente di monitoraggio. Numero e data esatti.
7. Linee di orientamento su bullismo e cyberbullismo, decreto n. 18 del 13 gennaio 2021: team
   antibullismo e team per l'emergenza.
8. Generazioni Connesse, il Safer Internet Centre italiano coordinato dal MIM: helpline 1.96.96 di
   Telefono Azzurro, hotline "Clicca e Segnala" (Telefono Azzurro) e STOP-IT (Save the Children),
   percorso ePolicy per le scuole.

Leggi e strumenti
9. Legge 71/2017 come modificata dalla 70/2024: chi ha più di 14 anni (o il genitore) può chiedere
   al gestore di oscurare o rimuovere i contenuti; se non risponde entro 24 ore o non provvede
   entro 48, ci si rivolge al Garante privacy; ammonimento del questore (da quale età).
10. Art. 612-ter del codice penale (legge 69/2019): pene; il comma su chi, avendo ricevuto le
    immagini, le diffonde a sua volta.
11. Art. 612-quater del codice penale, introdotto dalla legge 132/2025 sull'intelligenza
    artificiale (deepfake): testo, pena, entrata in vigore, procedibilità.
12. AI Act, regolamento UE 2024/1689, art. 50: obbligo di dichiarare i deepfake; da quando si
    applica (2 agosto 2026?) e se il "Digital Omnibus" ha spostato la data.
13. Garante privacy, segnalazione preventiva per le immagini intime (art. 144-bis del Codice
    privacy): chi può farla, anche i minori dai 14 anni, e come.
14. Take It Down (NCMEC): per foto e video di quando si era minorenni; il file resta sul
    dispositivo e si invia solo l'impronta (hash); gratuito.
15. Polizia Postale: le segnalazioni online si fanno su commissariatodips.it.
16. FBI, avviso IC3 I-120324-PSA del 3 dicembre 2024: consiglia una parola o frase segreta di
    famiglia per riconoscere le voci clonate.
17. 114 Emergenza Infanzia: dal d.lgs. 99/2025 offre anche prima assistenza psicologica e legale a
    chi subisce bullismo e cyberbullismo.
```

### G2 — Revisione incrociata

```text
Compito G2 (leggi prima GEMINI.md). Ramo: gemini/revisione-1.
Rivedi i commit b116814 (sorprese e pagina 404), 74da170 (scene animate di Primi passi) e
bc67c79 (scheda per la prova con persone vere). Usa git show <commit> e apri i file toccati.
Segui la "Lista di controllo per le revisioni" di docs/evil-per-tutti/LAVORO-IN-DUE.md.
Esegui npm run lint, npm test, node scripts/i18n.js check --strict e npm run check:encoding.
Non correggere il codice: scrivi i problemi in docs/evil-per-tutti/REVISIONI.md, in fondo, nel
formato indicato lì (file e riga, cosa non va, perché, proposta, gravità). Se non trovi problemi
in un punto della lista, scrivilo. Poi commit in italiano, push del ramo e un riassunto.
```

### G3 — Revisione del passo 3.1a

```text
Compito G3 (leggi prima GEMINI.md). Ramo: gemini/revisione-2.
Rivedi il commit più recente di feat/evil-per-tutti che ha nel titolo "EVIL Scuola" (passo 3.1a):
server/lib/scuola-content.js, server/lib/scuola-pages.js, css/scuola.css, js/scuola.js,
scripts/lib/generated-pages.js, html/scuola*.html. Avvia il sito in locale e apri /scuola.html,
/scuola-chiavi-di-casa.html e /scuola-trappole-nel-telefono.html, anche in inglese (/en/...),
e prova l'anteprima di stampa del browser. Segui la lista di controllo qui sotto e in più:
la lezione dura davvero 50 minuti ed è fattibile in una classe vera? Le parole sono adatte all'età?
I riferimenti alle Linee guida e alle note del MIM corrispondono a fonti/FASE3.md?
Scrivi i problemi in fondo a REVISIONI.md, senza correggere il codice. Commit, push, riassunto.
```

### G4 — Bozza del kit 5

```text
Compito G4 (leggi prima GEMINI.md). Ramo: gemini/kit-5.
Scrivi il kit 5 «Vero o falso nell'era dell'IA» (secondaria di secondo grado) in
server/lib/scuola-content.js, nello stesso formato dei kit 1 e 4 (stessi campi, testi in italiano e
inglese, slug 'vero-o-falso', cycle 'superiori', stages ['vero-falso'], icona 'newspaper') e toglilo
da PLANNED. Contenuto: fonti ufficiali e loro verifica (chi lo dice, quando, conferme), video e voci
creati con l'IA, perché "sembra vero" non è una prova, responsabilità di chi condivide. Usa solo
fatti di fonti/FASE3.md o delle tappe di Primi passi (per esempio art. 612-quater c.p., art. 50
dell'AI Act, l'avviso dell'FBI sulla parola segreta di famiglia), con la fonte in `sources`.
Gioco: 8 carte con contenuti inventati (niente persone o marchi reali), due colonne
«Mi fido» / «Prima verifico». Lezione da 0 a 50 minuti senza buchi, niente telefoni degli studenti.
Poi: node scripts/build-scuola.js, npm run lint, npm test, node scripts/i18n.js check --strict,
npm run check:encoding. Aggiungi al commit solo i file del kit (contenuto, html e json generati).
Commit, push, riassunto con le scelte fatte e i dubbi.
```

## Lista di controllo per le revisioni

1. **Fatti:** ogni numero, legge, data e contatto ha una fonte che dice davvero quella cosa.
2. **Italiano e inglese:** stesso contenuto, niente testi mancanti, inglese naturale; dove un
   consiglio vale solo in Italia, il testo inglese lo dice.
3. **Tono** (STILE.md): rassicura e dà istruzioni, niente paura gratuita, mai colpa a chi subisce,
   parole adatte all'età.
4. **Sicurezza:** niente codice d'attacco, niente segreti nel codice, niente script in linea (CSP),
   link esterni con `rel="noopener noreferrer"`.
5. **Accessibilità:** contrasto, testi alternativi, uso da tastiera, movimento ridotto, pulsanti
   di almeno 44 px.
6. **Privacy:** nessun dato personale, nessun tracciamento; `localStorage` solo per comodità.
7. **Regole del progetto:** niente su `main`, nessuna sorpresa nella pagina Aiuto, temi delicati
   marcati "da rivedere".
8. **Controlli:** lint, test, traduzioni e codifica senza errori.

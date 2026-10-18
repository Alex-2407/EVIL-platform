# EVIL per tutti — piano di lavoro

Obiettivo: fare di EVIL il punto di riferimento per la sicurezza digitale di tutti, dal bambino
con il primo telefono al tecnico. Proposta approvata da Alessandro il 18 ottobre 2026
(documento "EVIL per tutti — proposta di evoluzione").

Questo file è la mappa completa. Lo stato di avanzamento sta in [STATO.md](STATO.md); colori,
carattere, movimento, tono delle parole ed easter egg in [STILE.md](STILE.md).

## Protocollo: come si lavora e come si riprende dopo un'interruzione

1. **Prima di tutto leggi [STATO.md](STATO.md)**: dice l'ultimo passo finito e il prossimo.
2. **Ramo di lavoro:** `feat/evil-per-tutti` (nato da `feat/evil-v3`). `main` non si tocca e non si
   fa nessun deploy senza una richiesta esplicita di Alessandro.
3. **Un passo = una cosa finita e verificata:** codice, testi in italiano e inglese, controlli verdi
   (sotto), poi commit, push sul ramo e aggiornamento di STATO.md nello stesso commit.
   Un passo lasciato a metà non si committa: meglio un passo piccolo e chiuso.
4. **Contenuti delicati** (Aiuto, cyberbullismo, ricatti, adescamento): solo da fonti ufficiali,
   con fonte e data di verifica. Restano marcati "da rivedere" finché un esperto (psicologo o
   operatore di una linea di ascolto) non li approva. La sezione Aiuto non va in produzione prima.
5. **Niente dati di minori:** sotto i 14 anni EVIL non raccoglie dati personali (decisione D2).

### Controlli a ogni passo

```bash
npm run lint
npm test
node scripts/i18n.js check --strict   # nessun testo senza traduzione
npm run check:encoding
```

Più una prova nel browser (desktop 1366 px e telefono 390 px): nessun errore in console, niente
scorrimento orizzontale, tastiera e contrasto a posto.

## Decisioni

Le decisioni D1–D7 vengono dalla proposta; dove c'è "provvisoria" serve la conferma di Alessandro.

| # | Decisione | Stato |
|---|---|---|
| D1 | Area giovani e scuola: per ora "Per tutti" ed "EVIL Scuola"; nome amichevole definitivo da scegliere | provvisoria |
| D2 | Nessun account sotto i 14 anni | presa |
| D3 | Revisori dei contenuti delicati: uno psicologo o un operatore di linea di ascolto, più un docente | da trovare (Alessandro) |
| D4 | Video: animazioni nel browser (SVG, CSS, JS), poi esportate in MP4 per i social | presa |
| D5 | Voce: volontari, voce sintetica dichiarata come riserva | presa |
| D6 | Per ora persona fisica; associazione da valutare entro l'estate 2027 | presa |
| D7 | Lancio di EVIL Scuola al Safer Internet Day, 9 febbraio 2027, con pilota a gennaio | presa |

Decisioni tecniche:

| # | Decisione | Perché |
|---|---|---|
| T1 | Primi passi è un percorso statico nel browser: pagine generate da `server/lib/primi-passi-content.js` con `scripts/build-primi-passi.js` (dizionari inglesi compresi), progressi in `localStorage` | Niente account né dati; funziona alla LIM anche offline; il motore dei corsi resta per i corsi tecnici |
| T2 | Nuova area "Per tutti" (`per-tutti`) nella mappa del sito, prima nel menu | Porta d'ingresso visibile per il pubblico generale |
| T3 | I contenuti fatti di dati (contatti di aiuto) sono generati dal server dopo la traduzione, al posto di un segnaposto `<!--evil:fragment:nome-->` | Una sola fonte dei dati, con fonte, data e revisore, controllata dai test |
| T4 | Le pagine "Per tutti" usano uno stile chiaro a "carta" (`css/per-tutti.css`); header e footer restano quelli del sito | Più leggibile e meno intimidatorio, senza rifare tutto il sito |
| T5 | Ogni argomento ha tre profondità nella stessa pagina: "Per i più piccoli", "Per tutti", "Per tecnici" | Un indirizzo per argomento, ognuno trova la sua versione |

## Fasi e passi

Le date sono indicative (proposta, sezione "Come costruirlo").

### Fase 1 — Fondamenta (novembre–dicembre 2026)

- 1.1 Organizzazione: ramo, piano, stato, istruzioni per le sessioni future.
- 1.2 Area "Per tutti" nella mappa del sito e stile a carta chiara.
- 1.3 Contatti di aiuto: dati con fonte, data di verifica e revisore; test che segnala i contatti
  non verificati da più di 90 giorni.
- 1.4 Pagina Aiuto (`aiuto.html`): per chi la legge (chi subisce, chi assiste, genitori, docenti),
  cosa fare e cosa non fare, prove, strumenti di legge, contatti, pulsante "Esci subito".
- 1.5 Pulsante "Aiuto" su tutte le pagine; contatti in evidenza sopra il modulo di `help.html`.
- 1.6 Politica di tutela dei minori e impegni sulla privacy (niente tracciamento).
- 1.7 Home "Chi sei?": un ingresso per ogni pubblico (dopo che esistono le destinazioni).
- 1.8 Sorprese: gli easter egg di STILE.md (ricerca "123456", "luce", Lù cliccata 5 volte, finto
  premio nel footer, messaggio in console, pagina 404), con fatti verificati e citati.
- Controllo: la sezione Aiuto va online solo dopo la revisione di un esperto (D3).

### Fase 2 — Primi passi (dicembre 2026–gennaio 2027)

- 2.1 Motore del percorso: elenco delle tappe, selettore di profondità, giochi (classifica, ordina,
  scegli), progressi locali, badge.
- 2.2–2.11 Le 10 tappe, ognuna con storia, perché conta, "fai subito", gioco, tre profondità, IT ed EN:
  1. Cosa c'è da proteggere · 2. Password e passkey · 3. Verifica in due passaggi ·
  4. Aggiornamenti e backup · 5. Truffe · 6. Cosa condivido · 7. Persone online ·
  8. Cyberbullismo · 9. Vero o falso · 10. Se succede.
- 2.12 Patentino stampabile, generato nel browser (il nome non va al server).
- 2.13 Un'animazione breve per tappa, con sottotitoli e rispetto del movimento ridotto.
- Controllo: prova con 5–10 persone vere di età diverse.

### Fase 3 — EVIL Scuola (gennaio–febbraio 2027)

- 3.1 Pagina Scuola e sei kit da 50 minuti (due per ciclo), stampabili.
- 3.2 Modalità classe alla LIM: testo grande, avanzamento del docente, cartellini A–D da stampare.
- 3.3 Kit per le famiglie: lettera e patto del primo telefono.
- 3.4 Kit per il referente cyberbullismo.
- 3.5 Account docente (ruolo).
- 3.6 Pilota in 3–5 classi a gennaio; lancio il 9 febbraio 2027.
- Controllo: accordo con le scuole (art. 28 GDPR) prima delle classi con codice.

### Fase 4 — Crescita (marzo–giugno 2027)

- 4.1 Classi con codice e soprannomi assegnati, cancellazione a fine anno.
- 4.2 Livello "Per i più piccoli" con voce.
- 4.3 Video MP4 per i social.
- 4.4 Sezione Truffe per adulti, genitori e nonni.
- 4.5 Moduli su benessere digitale e diritto d'autore.
- Controllo: bilancio degli obiettivi di giugno 2027 (20 classi, 1.000 Primi passi completati,
  50 docenti, 3 partner).

### Fase 5 — Mondo (da settembre 2027)

- 5.1 Contatti di aiuto per Paese.
- 5.2 Nuove lingue, traduttori e revisori volontari.

## Regole per i contenuti

- Tono che rassicura e dà istruzioni: ogni rischio arriva insieme a cosa fare.
- Frasi brevi, parole semplici; per i più piccoli si ascolta e si guarda, si legge poco.
- Stessa verità a tre profondità; mai semplificare fino a dire una cosa falsa.
- Fatti, numeri, leggi e contatti solo da fonti ufficiali aperte e citate, con data di verifica.
- Personaggi e immagini originali di EVIL; niente personaggi famosi o marchi di altri.
- Nessun contenuto degli utenti, nessuna chat, nessun tracciamento.
- Testi sorgente in italiano, traduzione inglese nello stesso passo (vedi [docs/I18N.md](../I18N.md)).

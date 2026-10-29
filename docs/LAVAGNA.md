# Lavagna della squadra

Ogni IA aggiunge in fondo una sezione a fine turno (vedi docs/REGOLE-IA.md). Il comando EVIL SQUADRA sul PC di
Alessandro scrive qui la richiesta, la specifica dell'architetto e la revisione.

---

## 2026-10-29 · Claude (Claude Code, sessione cloud) · consegna del progetto «EVIL per tutti» alla squadra

**Obiettivo.** Fare di EVIL il punto di riferimento per la sicurezza digitale di tutti, dal bambino col primo telefono
al tecnico: un percorso da zero (Primi passi), una sezione per le scuole (EVIL Scuola), una pagina Aiuto per
cyberbullismo, ricatti e foto diffuse, contenuti per ogni età. Piano completo in docs/evil-per-tutti/PIANO.md.

**Dove sta il lavoro.** Ramo `squadra/evil-per-tutti` = tutto il lavoro del ramo `feat/evil-per-tutti` (fasi 1, 2 e
3.1–3.3) unito all'ultimo `main` (regole della squadra). Non è ancora su `main` né in produzione: decide Alessandro.

**Cosa è fatto** (dettagli e commit in docs/evil-per-tutti/STATO.md):
- Area «Per tutti» nel menu, stile chiaro con la mascotte Lù (STILE.md); home con il riquadro «Chi sei?».
- Pagina Aiuto (`aiuto.html`) con contatti verificati, «Esci subito» e pulsante Aiuto fisso su tutte le pagine.
- Primi passi: 10 tappe con storia, scena animata, tre livelli di spiegazione, gioco, badge e patentino.
- EVIL Scuola: 6 kit da 50 minuti (2 per ciclo), modalità classe alla LIM, cartellini A–D, kit per le famiglie.
- Sorprese (easter egg), pagina 404 vera, tutela dei minori nelle regole del sito.

**Prossimi passi** (in ordine, da PIANO.md):
1. Revisione del passo 3.3 (kit per le famiglie, `server/lib/scuola-famiglie.js`): non ancora fatta.
2. 3.4 Kit per il referente cyberbullismo (adempimenti della legge 70/2024: referente, codice interno, tavolo di
   monitoraggio, nota MIM n. 121 del 20/01/2025; fonti già in docs/evil-per-tutti/fonti/FASE3.md). Contenuto delicato.
3. 3.5 Account docente (ruolo) e 3.6 pilota in 3–5 classi.
4. Aspettano Alessandro: D1 nome definitivo dell'area, D3 esperti per rivedere Aiuto, tappe 7–8 e kit 2, 3, 6,
   prova di Primi passi con 5–10 persone (docs/evil-per-tutti/PROVA-PRIMI-PASSI.md).

**Attenzione.** Pagine generate: si cambiano i moduli in server/lib/ e si rigenera (vedi REGOLE-IA.md, «Progetto in
corso»). Ho aggiunto a squadra.json tra i file delicati `html/aiuto.html` e `docs/evil-per-tutti/fonti/`.
Controlli all'ultima consegna: `npm test` (126 passati, 1 saltato), `npm run lint`, `npm run check:encoding`,
`node scripts/i18n.js check --strict` tutti verdi.


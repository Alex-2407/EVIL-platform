# Primi passi — scheda editoriale

Il percorso da zero dell'area "Per tutti" (piano, fase 2.1): dieci tappe brevi per chi sa appena
usare il telefono, dai 9 anni in su, con tre livelli di spiegazione (per i più piccoli, per tutti,
per tecnici). Regole di scrittura in [STILE.md](STILE.md).

## Come si modifica

1. I testi stanno **solo** in `server/lib/primi-passi-content.js`, in italiano e in inglese.
2. `node scripts/build-primi-passi.js` rigenera `html/primi-passi.html`, `html/pp-<tappa>.html` e i
   dizionari `i18n/en/pages/*.json`. Non modificare a mano i file generati: un test lo segnala.
3. Le voci del menu e della sitemap vengono dallo stesso modulo (`sitePages()`).

## Com'è fatta una tappa

Scena in tre quadri · storia con una scelta (una sola risposta giusta) · "Te lo spieghiamo" in tre livelli · "Fai subito"
con il telefono in mano · un gioco (classifica, ordina, scegli le trappole, trova le trappole) · badge ·
anteprima della tappa successiva · link ai corsi e ai quiz di EVIL · fonti.
Una tappa è completata quando si finisce il gioco; i progressi restano in `localStorage`
(`evil-pp-v1`), senza account. Il nome sul patentino non viene salvato.

I giochi non hanno limiti di tempo né errori "rossi": una risposta sbagliata è ambra ("Quasi!
Riprova."), dopo due tentativi a vuoto arriva "Dammi un aiuto", e alla fine si può rigiocare. Da
schermo largo un riquadro "La tua tappa" spunta le quattro parti man mano. Nella pagina del percorso
ogni tappa completata accende una luce; con tutte e dieci Lù diventa d'oro (la "lucciola d'oro" di
STILE.md) e si sblocca il patentino, che si stampa su un A4 orizzontale.

Prova nel browser: `scripts/e2e/primi-passi.js`.

## Le tappe

| # | Tappa | Gioco | Badge | Fonti |
|---|---|---|---|---|
| 1 | Cosa c'è da proteggere | classifica: da tenere o da condividere | Custode | — (buon senso) |
| 2 | Password e passkey | ordina: dalla più debole alla più forte | Fabbro | NCSC, OWASP ×2, FIDO |
| 3 | Verifica in due passaggi | scegli le trappole | Doppia mandata | Geopop, ABI, RFC 6238, FIDO |
| 4 | Aggiornamenti e backup | classifica: si fa o è una trappola | Guardiano dei ricordi | CISA ×3, FBI |
| 5 | Truffe: SMS, email e telefonate | trova le tre trappole (corriere inventato SpediLù) | Occhio di lince | Libero, ABI, FIDO |
| 6 | Cosa condivido | classifica: lo pubblichi? | Regista della privacy | — (buon senso) |
| 7 | Persone online | scegli i segnali d'allarme | Radar | NSPCC, Cybersecurity360 (Polizia Postale 2025), Sky TG24, Garante, Take It Down |
| 8 | Cyberbullismo | classifica: scherzo o cyberbullismo | Alleato | L. 71/2017, L. 70/2024, d.lgs. 99/2025 |
| 9 | Vero o falso | classifica: fidarsi o verificare | Detective | C2PA, FTC |
| 10 | Se succede | ordina: account rubato | Pronto a tutto | ABI |

Tutte le fonti sono state aperte e verificate il **18 ottobre 2026**. I numeri citati:
Polizia Postale 2025 (via Cybersecurity360, 13 gennaio 2026): 428 casi di adescamento online,
174 con vittime tra 10 e 13 anni; 220 casi di sextortion con vittime minorenni, 192 (87%) tra 14 e 17 anni.

## Le scene (passo 2.13)

Ogni storia si apre con una scena in tre quadri: disegni SVG originali in
`server/lib/primi-passi-scenes.js`, didascalie IT/EN nel campo `scene` di ogni tappa.

- **Niente parole nei disegni:** le dicono le didascalie, che si traducono e si leggono con i
  lettori di schermo; i disegni sono nascosti ai lettori (`aria-hidden`).
- **Chi fa del male non ha mai un volto né un colore di pelle:** è un profilo grigio con il punto di
  domanda, una chiave rubata, un messaggio. I volti sono dei protagonisti delle storie (Martina,
  Elena, Leo, Tommaso, Paolo, la preside del video falso) e degli adulti che aiutano, con carnagioni
  e capelli diversi.
- **Con JavaScript:** un quadro alla volta; parte solo quando metà della scena è sullo schermo,
  scorre una volta (circa 8 secondi) e si ferma sull'ultimo quadro. Pausa e frecce sono sempre
  disponibili; con le frecce la didascalia nuova viene letta (`aria-live`), durante la riproduzione
  automatica no. Gli oggetti di ogni quadro entrano uno dopo l'altro.
- **Con il movimento ridotto o senza JavaScript:** striscia a fumetti con i tre quadri affiancati
  (da telefono scorrono di lato), nessun movimento.
- Per cambiare una scena: si modifica il quadro in `primi-passi-scenes.js` (oggetti già pronti:
  telefono, fumetto, lucchetto, chiave, persona, Lù…) e si rigenera con
  `node scripts/build-primi-passi.js`. Il test controlla tre quadri per tappa, niente parole e
  niente `id` nei disegni.

## Scelte editoriali

- Le storie sono inventate e i nomi sono di fantasia; nei giochi il corriere è un marchio inventato
  (SpediLù, in inglese LuParcel) per non imitare aziende vere.
- Tappe 7 e 8: riquadro "Se sta succedendo a te" con i numeri di aiuto e il link ad Aiuto subito; il
  terzo livello si chiama "Per approfondire" (dati e leggi) invece di "Per tecnici".
- Nessuna urgenza finta, nessuna serie di giorni, nessuna notifica: si aggancia con storie, scelte,
  giochi e badge per quello che si sa fare (STILE.md).
- La versione inglese è per chi legge in inglese: dove un consiglio vale solo in Italia (114,
  1.96.96, Polizia Postale, leggi italiane) lo dice.

## Revisione

| Cosa | Stato |
|---|---|
| Fatti e fonti | verificati il 18 ottobre 2026 |
| Tappe 7 e 8 (adescamento, sextortion, cyberbullismo) | da far rivedere a esperti di ascolto e tutela dei minori prima della pubblicazione, come la pagina Aiuto (decisione D3) |
| Tutto il percorso, testi per i più piccoli compresi | da provare con 5–10 persone di età diverse (controllo di fine fase 2, scheda in [PROVA-PRIMI-PASSI.md](PROVA-PRIMI-PASSI.md)) |
| Versione inglese | da far rileggere a una persona di madrelingua |

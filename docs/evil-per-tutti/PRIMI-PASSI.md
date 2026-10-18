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

Storia con una scelta (una sola risposta giusta) · "Te lo spieghiamo" in tre livelli · "Fai subito"
con il telefono in mano · un gioco (classifica, ordina, scegli le trappole, trova le trappole) · badge ·
anteprima della tappa successiva · link ai corsi e ai quiz di EVIL · fonti.
Una tappa è completata quando si finisce il gioco; i progressi restano in `localStorage`
(`evil-pp-v1`), senza account. Il nome sul patentino non viene salvato.

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
| Tutto il percorso, testi per i più piccoli compresi | da provare con 5–10 persone di età diverse (controllo di fine fase 2) |
| Versione inglese | da far rileggere a una persona di madrelingua |

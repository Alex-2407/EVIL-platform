# Prova di Primi passi con persone vere — scheda per chi la conduce

Controllo di fine fase 2 ([PIANO.md](PIANO.md)): prima di andare avanti, 5–10 persone di età
diverse usano Primi passi mentre tu guardi. Non si prova la persona, si prova il sito: ogni volta che
qualcuno si blocca, abbiamo trovato una cosa da correggere.

Tempo: 25–30 minuti a persona, più 10 minuti di preparazione.

## Cosa vogliamo sapere

1. **Si capisce da soli?** Dove cominciare, i tre livelli, la scelta nella storia, il gioco.
2. **Le parole sono giuste per ogni età?** Né da bambini per un quindicenne, né difficili per un nonno.
3. **Dove ci si blocca?** Pulsanti, giochi, telefono, testo troppo lungo.
4. **Viene voglia di andare avanti** senza spaventare? Luci, badge, la tappa dopo.

## Chi

| Fascia | Quante persone | Livello da far provare | Tappe consigliate |
|---|---|---|---|
| 9–11 anni | 2 | Per i più piccoli | 1, 2, 5 |
| 12–14 anni | 2 | Per tutti | 3, 6, 9 (7 e 8 solo con il sì del genitore, vedi sotto) |
| 15–18 anni | 1–2 | Per tutti | 4, 7, 8, 9 |
| 30–60 anni (un genitore, un docente) | 2 | Per tutti o Per tecnici | 2, 5, 10, più la pagina del percorso |
| oltre 65 anni | 1–2 | Per tutti | 5, 3, 10 |

- Almeno 3 persone da **telefono** (meglio il loro), le altre da computer; se puoi, una alla LIM.
- Mescola chi è a suo agio con la tecnologia e chi no. Se conosci una persona con dislessia o che
  usa un lettore di schermo, la sua prova vale doppio.
- Alla fine ogni tappa deve essere stata provata da almeno due persone.

## Regole (leggile prima)

- **Nessun dato personale.** Niente nomi, foto, video o registrazioni. Sul foglio scrivi solo
  P1, P2… con fascia d'età e dispositivo. Le frasi che annoti restano anonime.
- **Minorenni:** solo con un genitore presente e d'accordo (a scuola: il docente, con il permesso
  della famiglia). Il ragazzo o la ragazza può fermarsi quando vuole, senza dire perché.
- **Tappe 7 e 8** (adescamento e cyberbullismo) non sono ancora state riviste dagli esperti
  (decisione D3): sotto i 14 anni si provano solo se il genitore le ha lette prima e dice di sì.
  Tu resti accanto per tutta la tappa.
- **Se qualcuno racconta qualcosa che gli è successo:** ascolta con calma, ringrazia per averlo
  detto, non fare domande insistenti e non promettere di tenere il segreto. Con un minorenne ne parli
  con il genitore presente, se non è lui il problema. I contatti verificati sono nella pagina Aiuto
  (`/aiuto.html`). La prova si può fermare lì: la persona viene prima.
- Non aiutare subito. Intervieni solo se la persona è ferma da più di un minuto o ti chiede aiuto
  due volte, e annota il punto.

## Preparazione (10 minuti prima)

1. Sul tuo PC, nella cartella del progetto:
   ```powershell
   git fetch origin
   git checkout feat/evil-per-tutti
   git pull
   ```
   Poi avvia il sito in locale (doppio clic su `AAAPRIMI PER INIZIARE/start-local.bat`) e apri
   http://localhost:5000/primi-passi.html.
2. Per i telefoni sulla stessa Wi-Fi: in PowerShell `ipconfig`, prendi l'"Indirizzo IPv4" del PC
   (per esempio 192.168.1.20) e apri dal telefono `http://192.168.1.20:5000/primi-passi.html`.
   Se Windows chiede di consentire Node.js sulle reti private, rispondi sì.
3. Prima di ogni persona: in fondo alla pagina del percorso "Ricomincia da zero" (oppure una finestra
   in incognito), così parte senza progressi.
4. Stampa un foglio di annotazione (in fondo a questa scheda) per ogni persona.

## Come si svolge (25–30 minuti)

**Introduzione (2 minuti).** Puoi leggere così:

> "Grazie! Stiamo provando un percorso sulla sicurezza online. Non stiamo provando te: se qualcosa
> non è chiaro, è colpa del sito, e a noi serve proprio saperlo. Mentre lo usi, prova a dire ad alta
> voce cosa pensi. Io all'inizio non ti aiuto: è quello che ci serve vedere."

**Compiti (20 minuti).** Dai un compito alla volta, con queste parole:

1. "Questa è la pagina di Primi passi. Secondo te, cosa puoi fare qui?"
2. "Apri la tappa N." Poi: "Scegli il livello che ti sembra adatto a te."
3. "Guarda la storia e rispondi alla domanda." (Guardano la scena? Leggono le didascalie?)
4. "Leggi la spiegazione e fai quello che c'è in 'Fai subito', se ti va, con il tuo telefono."
5. "Fai il gioco fino alla fine."
6. "Torna alla pagina del percorso: cosa è cambiato?"
7. Ripeti 2–6 con una seconda tappa (e una terza, se c'è tempo e voglia).

**Domande finali (5 minuti).**

1. "Cosa ti ricordi di quello che hai visto? Cosa faresti adesso con il tuo telefono?"
2. "C'era una parola o una frase che non hai capito?"
3. "Da 1 a 5: 1 è troppo facile, da bambini; 3 è giusto; 5 è troppo difficile. Che voto dai?"
4. "C'è stato un momento in cui ti sei annoiato, o in cui ti ha messo ansia?"
5. "Lo faresti fare a un amico, a un fratello, a un nonno? Perché?"
6. "Se potessi cambiare una cosa, quale cambieresti?"

## Cosa osservare

- Dove si ferma, dove torna indietro, dove clicca su cose che non sono pulsanti.
- Se guarda la scena animata e legge le didascalie, o la salta.
- Se capisce le schede "Per i più piccoli / Per tutti / Per tecnici" o non le vede.
- Nei giochi: risposte sbagliate, uso di "Dammi un aiuto", se capisce quando ha finito.
- Da telefono: pulsanti troppo piccoli, testo che costringe a scorrere troppo, cose coperte.
- Il tempo per tappa (le tappe dicono 3–6 minuti: è onesto?).
- Le facce: sorrisi, noia, fastidio. Le frasi dette ad alta voce (annotale tra virgolette).

## Quando la prova è superata

- Almeno 4 persone su 5 finiscono una tappa senza aiuto.
- Nessun punto blocca due persone diverse (se succede, è da correggere prima della fase 3).
- Nessuno dice che fa paura; dai 12 anni in su nessuno lo trova "da bambini" (voto medio tra 2,5 e 3,5).
- Ognuno sa dire almeno una cosa da fare subito con il proprio telefono.

## Dopo la prova

Raccogli i fogli e incolla le note (anonime) in una nuova sessione di lavoro: le correzioni
diventano un passo dedicato prima della fase 3. Le note non vanno nel repository.

---

## Foglio di annotazione (uno per persona)

| | |
|---|---|
| Persona | P__ |
| Fascia d'età | 9–11 · 12–14 · 15–18 · 30–60 · oltre 65 |
| Dispositivo | telefono · tablet · computer · LIM |
| Con la tecnologia è | a suo agio · così così · in difficoltà |
| Livello scelto | Per i più piccoli · Per tutti · Per tecnici |

| Tappa | Minuti | Dove si è bloccata (e per quanto) | Aiuti chiesti o dati | Parole non capite |
|---|---|---|---|---|
| | | | | |
| | | | | |
| | | | | |

| Domanda finale | Risposta |
|---|---|
| Cosa ricorda, cosa farebbe subito | |
| Voto da 1 a 5 | |
| Noia o ansia | |
| Lo consiglierebbe? A chi? | |
| Cosa cambierebbe | |
| Frasi dette ad alta voce | |
| Problemi tecnici | |

# Stile "Per tutti" — colori, carattere, movimento, parole, sorprese

Ogni pagina dell'area "Per tutti" (Aiuto, Primi passi, Scuola, argomenti) segue questa guida.
Lo scopo: chi entra deve sentirsi accolto, capire subito, avere voglia di andare avanti e uscire
sapendo fare una cosa in più. File: `css/per-tutti.css`, `js/per-tutti.js`, mascotte nel frammento `mascot`.

## L'idea che tiene tutto insieme: accendere la luce

Il resto di EVIL è scuro: è il mondo di chi studia gli attacchi. "Per tutti" è la stanza con la luce
accesa. La guida è **Lù, una lucciola**: piccola, curiosa, fa luce dove i pericoli si nascondono.
La metafora regge per ogni età: per un bambino Lù è un'amica che illumina; per un adolescente è
un'ironia ("siamo nel sito che si chiama EVIL e la guida è una lucciola"); per un adulto è un
dettaglio grafico discreto. Nome e mascotte sono provvisori (decisione D1).

## Colori: ognuno ha un significato e lo tiene ovunque

Base a carta calda (meno abbagliante del bianco puro, aiuta chi legge con fatica), inchiostro
blu-notte. Tutte le coppie testo/sfondo sono verificate per il contrasto WCAG AA (≥ 4,5:1).

| Token | Valore | Significato | Contrasto |
|---|---|---|---|
| `--pt-paper` | `#FBF8F1` | sfondo della pagina | — |
| `--pt-card` | `#FFFFFF` | schede | — |
| `--pt-sunken` | `#F3EEE2` | riquadri incassati | — |
| `--pt-ink` | `#1B2130` | testo | 15,2:1 su carta |
| `--pt-ink-2` | `#4A5368` | testo secondario | 7,3:1 su carta |
| `--pt-line` | `#E3DCCB` | bordi (decorativi) | — |
| `--pt-focus` | `#B45309` | anello del focus da tastiera | 4,7:1 su carta |
| `--pt-safe` / `-bg` | `#0B6B4B` / `#DDF4E9` | fatto, sicuro, "Fai subito" | 5,7:1 |
| `--pt-warn` / `-bg` | `#8A4B00` / `#FFF0D1` | attenzione, trappola | 6,0:1 |
| `--pt-help` / `-bg` | `#A61E2A` / `#FDE3E3` | aiuto, pericolo vero | 6,1:1 |
| `--pt-help-solid` | `#C2272F` | pulsanti Aiuto ed Esci subito (testo bianco) | 5,8:1 |
| `--pt-info` / `-bg` | `#1C5592` / `#E2EEFB` | lo sapevi, link, livello tecnico | 6,5:1 |
| `--pt-school` / `-bg` | `#5B3796` / `#EFE8FB` | scuola e docenti | 7,2:1 |
| `--pt-kids` / `-bg` | `#7A5200` / `#FFF6CC` | per i più piccoli | 6,4:1 |
| `--pt-tech-bg` | `#0B1220` | pannello "Per tecnici" (torna il mondo EVIL) | testo 15,2:1, verde 14,1:1 |

Regole:

- **Il colore non parla mai da solo:** ogni stato ha anche un'icona e una parola.
- **Rosso solo per l'aiuto vero.** Gli errori nei giochi sono ambra ("Quasi!"), mai rossi.
- **Tre profondità, tre luci:** "Per i più piccoli" è soleggiato (giallo), "Per tutti" è carta,
  "Per tecnici" diventa un pannello scuro con il verde di EVIL. Cambiare livello cambia la luce.

## Carattere

- **Atkinson Hyperlegible Next** (licenza SIL OFL, self-hosted in `assets/fonts/atkinson/`):
  disegnato per chi vede poco, distingue I maiuscola, l minuscola e 1, O e 0. È esattamente ciò che
  serve quando si parla di password.
- **Atkinson Hyperlegible Mono** per password, codici, indirizzi e numeri da copiare.
- Corpo 18 px, interlinea 1,6, righe di massimo 68 caratteri. "Per i più piccoli": 20 px.
- Titoli in grassetto 700–750, mai tutto maiuscolo nel testo lungo.

## Movimento

Il movimento spiega, non decora: mostra una causa e il suo effetto (un lucchetto che si chiude
quando attivi la verifica in due passaggi, un messaggio che si sfalda quando trovi il dettaglio falso).

- Durate: 150–250 ms per le risposte ai clic, 300–450 ms per le entrate, mai oltre 600 ms.
- Curva: `cubic-bezier(.2,.8,.2,1)` (parte veloce, si posa piano).
- Entrate: dissolvenza più 8 px di salita, una volta sola, quando l'elemento entra nello schermo.
- Lù respira (scala 1–1,02 in 3 s), batte le ali, sbatte le palpebre ogni 4–7 s; la coda pulsa piano.
- Successo: un piccolo salto (scala 1 → 1,06 → 1) e la luce di Lù diventa verde.
- **Movimento ridotto:** con `prefers-reduced-motion` niente animazioni continue né spostamenti;
  restano solo cambi di colore e opacità istantanei.
- Mai lampeggi più di 3 volte al secondo, mai parallax, mai riproduzione automatica con audio.

## Parole: tono per chi legge

| Pubblico | Tono | Esempio |
|---|---|---|
| Piccoli (5–8) | Caldo, frasi di 8–10 parole, cose concrete (chiavi, porte, segreti), lodare l'impegno | "La password è una chiave. Non si presta, nemmeno all'amico del cuore." |
| Ragazzi (9–13) | Sfida e gioco, umorismo sulla vita vera (il gruppo della classe), mai prediche | "Sfida: in questo messaggio ci sono 3 trappole. Le trovi prima di Lù?" |
| Adolescenti (14–18) | Diretto, rispetta l'autonomia, ironia asciutta, diritti più che divieti | "Nessuno ha il diritto di chiederti foto. Tu invece hai il diritto di farle sparire." |
| Adulti | Chiaro, pratico, calmo, passi numerati, zero colpa | "Non è colpa tua: queste truffe le scrivono professionisti. Ecco come riconoscerle." |
| Tecnici | Preciso, asciutto, con riferimenti | "Il riuso delle credenziali rende possibile il credential stuffing; servono hash lenti con salt." |

Parole da usare: proteggere, accorgersi, chiedere aiuto, succede a tanti, non è colpa tua,
facciamolo insieme, prova, quasi.
Parole da evitare: "devi", "vietato", "stupido", "hacker cattivi", "terrore", "pericolosissimo",
gergo inglese non spiegato, colpe ("te la sei cercata").
Linguaggio inclusivo senza asterischi né schwa: "chi legge", "le persone", "ragazze e ragazzi".
Pulsanti come verbi: "Inizia", "Provaci", "Ho fatto!", "Mostrami come". Errori gentili:
"Quasi! Guarda meglio chi l'ha mandato."

## Frasi che agganciano (senza creare dipendenza)

Si aggancia con **curiosità, storie, sfide e umorismo**. Non si usano i meccanismi che creano
dipendenza, perché il sito li insegna a riconoscere: niente serie di giorni da non perdere,
niente urgenza finta, niente notifiche, niente scorrimento infinito, niente premi a caso.

Formule:

1. **Una storia con una scelta.** Ogni tappa parte da una persona e da un momento ("Sono le 23.
   A Giulia arriva un SMS dalla banca…") e chiede: "Tu cosa faresti?".
2. **Un vuoto da colmare.** "C'è un dettaglio che tradisce questo messaggio. Lo trovi in 10 secondi?"
3. **Una promessa onesta.** "3 minuti. Alla fine saprai riconoscere un SMS falso." (durate vere)
4. **Il telefono in mano.** "Prendi il telefono: lo facciamo insieme, adesso."
5. **Un finale che apre.** Ogni tappa chiude con l'anteprima della successiva ("Prossima tappa:
   il messaggio che arriva di notte"), e con un punto di arrivo chiaro ("Per oggi basta così").
6. **Badge per quello che sai fare**, non per il tempo passato sul sito.

## Easter egg

Ognuno fa sorridere e insegna qualcosa. Nessuno spaventa, nessuno è per adulti.

| Dove | Come si trova | Cosa succede | Per chi |
|---|---|---|---|
| Ricerca del sito | Cercare "123456" o "password" | Lù arrossisce: "Questa password la conoscono anche i muri" e mostra come crearne una vera | ragazzi, adolescenti |
| Area "Per tutti" | Scrivere "luce" sulla tastiera | Si spegne la luce: Lù diventa una torcia e illumina consigli nascosti nella pagina | ragazzi, adolescenti |
| Mascotte | Cliccare Lù 5 volte | Lù racconta una curiosità vera sulla sicurezza (con fonte) | tutti |
| Footer "Per tutti" | Un link troppo bello per essere vero ("Hai vinto un buono da 500 €! Ritiralo oggi") | "Era una trappola… finta" (`trappola-finta.html`): la pagina mostra i segnali che dovevano insospettire, senza prendere in giro | adolescenti, adulti |
| Console del browser | Aprire gli strumenti per sviluppatori | Un messaggio per chi guarda sotto il cofano: "Ti piace capire come funziona? L'area Impara fa per te" | adolescenti curiosi |
| Pagina 404 | Un indirizzo sbagliato | "Questa pagina si è persa come una password scritta su un post-it", con i link utili | tutti |
| Primi passi | Completare tutte le tappe | Badge segreto "Lucciola d'oro" con un'animazione dedicata | tutti |
| Tutto il sito | Trovare tutte le sorprese | Badge "Esploratore" (le cinque sorprese qui sopra, esclusa la console) | adolescenti |

Gli easter egg non sono mai nella sezione Aiuto: lì si cerca aiuto, non si gioca.

Dove stanno nel codice: `js/sorprese.js` (registro nel browser, chiave `evil-pt-eggs-v1`, avvisi,
badge Esploratore, messaggio in console), `js/site-search.js` (password famose), `js/per-tutti.js`
(torcia, curiosità di Lù con fonte, pagine sorpresa), `server/chrome.js` (premio finto),
`html/trappola-finta.html`, `html/404.html`. Prova nel browser: `scripts/e2e/sorprese.js`.

## Accessibilità (sempre)

WCAG 2.2 livello AA: contrasto verificato, tutto usabile da tastiera con focus visibile, zone
toccabili di almeno 44 px, testi alternativi, sottotitoli e trascrizione per ogni video,
nessun limite di tempo nei giochi, lingua dichiarata, struttura con titoli in ordine.

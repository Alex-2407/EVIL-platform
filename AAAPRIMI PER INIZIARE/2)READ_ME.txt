════════════════════════════════════════════════════════════════
                    ⚙️  GUIDA DI INSTALLAZIONE  ⚙️
════════════════════════════════════════════════════════════════

Benvenuto sulla piattaforma EVIL - Cybersecurity Platform!

PRESENTAZIONE LINK: https://prezi.com/view/MWiCZv2WRyBB00yaizKd/?referral_token=OO8ivMlnB3FN

Segui questi semplici step per visualizzare il sito:


PASSO 1: INSTALLARE NODE.JS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Vai su: https://nodejs.org/
2. Scarica la versione LTS (Long Term Support) - consigliato
3. Esegui l'installer e segui la procedura standard di installazione
4. Al termine, apri il Prompt dei Comandi e verifica con:
   
   node --version
   npm --version

Se visualizzi i numeri di versione, l'installazione è avvenuta correttamente!


PASSO 2: AVVIARE IL SERVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Nella cartella dove stai leggendo questo file troverai:
   
   • start-server.bat   ← CLICCA QUI PER AVVIARE
   • stop-server.bat    ← Per fermare il server quando hai finito

2. Fai doppio click su "start-server.bat"

3. Una finestra di comando si aprirà e vedrai dei messaggi.
   Aspetta finché non vedi la scritta:
   
   "Server avviato su http://localhost:5000"
   
   Quando vedi questo messaggio, il server è ONLINE e pronto! ✅


PASSO 3: ACCEDERE AL SITO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANTE: non aprire i file .html con doppio click (non funzionano
login e API). Usa SEMPRE il browser con il server acceso:

   http://localhost:5000/

(In alternativa dalla root del progetto: doppio click su start-local.bat)

Goditi il sito! 🎬 Vedrai un'animazione introduttiva affascinante!


PASSO 4: ARRESTO DEL SERVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Quando hai finito di usare il sito:

1. Fai doppio click su "stop-server.bat"

2. La finestra di comando si chiuderà automaticamente

3. Il server sarà arrestato ✅


⚡ TROUBLESHOOTING - Se qualcosa non funziona:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ "Node.js non trovato"
   → Assicurati di aver riavviato il computer dopo l'installazione

❌ "Porta 5000 occupata"
   → Apri il Task Manager e chiudi altri processi Node.js
   → O rilancia start-server.bat dopo pochi secondi

❌ "Pagina non si carica"
   → Controlla che il server sia effettivamente avviato
   → Prova a digitare: http://localhost:5000 nella barra indirizzi
   → Aggiorna la pagina con F5

❌ "Stile non visualizzato correttamente"
   → Svuota la cache del browser: Ctrl+Shift+Del (in Chrome/Edge)
   → Prova su un altro browser


════════════════════════════════════════════════════════════════
                    Buon hacking etico! 🔐
════════════════════════════════════════════════════════════════
'use strict';

const COURSES = {
  fondamenti: {
    prefix: 'FND',
    title: { it: 'Fondamenti', en: 'Foundations' },
    questions: [
      ['f01', 'Perché le password si memorizzano con un hash lento e un salt univoco?', ['Per poterle recuperare in chiaro', 'Per rendere costoso verificare tentativi e impedire hash identici per password uguali', 'Per cifrare il traffico HTTP', 'Per evitare che l’utente possa cambiarle'], 1],
      ['f02', 'Che cosa verifica principalmente HTTPS?', ['Che il sito non contenga vulnerabilità', 'La riservatezza del traffico e l’identità del server tramite certificato', 'Che il server esegua backup', 'Che ogni email del dominio sia legittima'], 1],
      ['f03', 'Ricevi un messaggio urgente che chiede la password tramite un link. Qual è la risposta più sicura?', ['Aprire il link da un altro dispositivo', 'Rispondere chiedendo conferma', 'Non usare il link e verificare dal sito o canale ufficiale', 'Inserire una password temporanea'], 2],
      ['f04', 'Quale controllo riduce il rischio di SQL injection?', ['Nascondere il messaggio di errore', 'Usare query parametrizzate', 'Cambiare il nome della tabella', 'Aggiungere un CAPTCHA'], 1],
      ['f05', 'A cosa serve l’autenticazione a più fattori?', ['A sostituire ogni aggiornamento software', 'Ad aggiungere una prova oltre alla password', 'A cifrare il database', 'A rendere pubblica la sessione'], 1],
      ['f06', 'Qual è il principio del privilegio minimo?', ['Dare a ogni account accesso amministrativo', 'Concedere solo i permessi necessari al compito', 'Condividere un account per il team', 'Rimuovere i log di accesso'], 1],
      ['f07', 'Un allegato inatteso chiede di abilitare macro. Cosa conviene fare?', ['Abilitare le macro per vedere il documento', 'Inoltrarlo a tutti per chiedere conferma', 'Non abilitarle e verificare il messaggio tramite un canale noto', 'Rinominarlo e riaprirlo'], 2],
      ['f08', 'Perché gli aggiornamenti di sicurezza sono importanti?', ['Rendono sempre più veloce la rete', 'Correggono vulnerabilità note sfruttabili', 'Impediscono ogni errore umano', 'Sostituiscono le copie di backup'], 1],
      ['f09', 'Qual è una buona pratica per i backup?', ['Conservare l’unica copia collegata e scrivibile dal server', 'Verificare periodicamente che copie isolate possano essere ripristinate', 'Salvare solo i file più recenti', 'Non testare mai il ripristino'], 1],
      ['f10', 'Qual è il primo comportamento utile dopo aver rilevato un possibile incidente?', ['Cancellare subito ogni file sospetto', 'Documentare ciò che si osserva e seguire il piano di segnalazione', 'Pubblicare i dettagli online', 'Spegnere ogni sistema senza coordinamento'], 1],
    ],
  },
  'sicurezza-web': {
    prefix: 'WEB',
    title: { it: 'Sicurezza web', en: 'Web security' },
    questions: [
      ['w01', 'Qual è la difesa primaria contro SQL injection?', ['Codificare l’output HTML', 'Usare query parametrizzate', 'Impostare una CSP', 'Aumentare il timeout'], 1],
      ['w02', 'Come si riduce il rischio di XSS quando si mostra testo fornito dall’utente?', ['Inserirlo direttamente in innerHTML', 'Codificarlo secondo il contesto di output', 'Cifrare la password', 'Aggiungere un rate limit alle immagini'], 1],
      ['w03', 'Quale controllo aiuta a prevenire richieste CSRF?', ['Token anti-CSRF associato alla sessione e controllato dal server', 'Disabilitare TLS', 'Accettare ogni richiesta GET', 'Mostrare il token nella pagina pubblica'], 0],
      ['w04', 'A cosa serve una Content Security Policy ben configurata?', ['A sostituire l’autenticazione', 'A limitare le origini da cui la pagina può caricare risorse ed eseguire script', 'A correggere automaticamente SQL injection', 'A cifrare i dati nel database'], 1],
      ['w05', 'Cosa dovrebbe fare un endpoint di login contro tentativi automatizzati?', ['Accettare tentativi illimitati', 'Applicare limiti e monitorare gli errori senza rivelare se un account esiste', 'Bloccare ogni utente dopo un errore', 'Restituire la password corretta in caso di errore'], 1],
      ['w06', 'Qual è il modo corretto di validare input ricevuti dal browser?', ['Fidarsi della validazione JavaScript', 'Validarli sul server secondo tipo, formato e limiti attesi', 'Rimuovere solo gli spazi', 'Accettare ogni stringa e pulirla nei log'], 1],
      ['w07', 'Come si riduce il rischio SSRF in uno strumento che effettua richieste a URL forniti dagli utenti?', ['Consentire qualsiasi host se usa HTTPS', 'Validare destinazione e IP alla connessione, controllando anche redirect', 'Controllare solo il nome DNS una volta', 'Accettare URL solo se terminano in .com'], 1],
      ['w08', 'Quale impostazione è adatta ai cookie di sessione?', ['HttpOnly, Secure su HTTPS e una SameSite appropriata', 'Leggibili da JavaScript e senza scadenza', 'Inseriti nell’URL', 'Condivisi tra tutti gli utenti'], 0],
      ['w09', 'Cosa riduce l’impatto di una vulnerabilità in un’applicazione web?', ['Eseguire il server con privilegi minimi e isolare i servizi', 'Usare un nome host difficile da indovinare', 'Nascondere il footer', 'Disattivare i log'], 0],
      ['w10', 'Qual è una risposta responsabile quando un test autorizzato trova una vulnerabilità?', ['Sfruttarla su altri sistemi per confermarla', 'Documentare evidenze e impatto e comunicarla al referente autorizzato', 'Pubblicare dati personali come prova', 'Lasciare la vulnerabilità aperta senza avviso'], 1],
    ],
  },
  'difesa-analisi': {
    prefix: 'SOC',
    title: { it: 'Difesa e analisi', en: 'Defence and analysis' },
    questions: [
      ['d01', 'Che cos’è un IOC nel lavoro di difesa?', ['Una prova definitiva che ogni host è compromesso', 'Un indicatore osservabile associato a una possibile attività malevola', 'Un tipo di backup', 'Un livello di accesso utente'], 1],
      ['d02', 'Perché un analista documenta tempi e azioni durante un incidente?', ['Per ricostruire la sequenza e mantenere tracciabilità delle decisioni', 'Per evitare di avvisare il team', 'Per cancellare gli eventi meno importanti', 'Per sostituire le copie forensi'], 0],
      ['d03', 'Un host mostra attività sospetta. Qual è un’azione di contenimento prudente?', ['Isolarlo secondo il piano preservando le evidenze', 'Cancellare i log e riavviarlo subito', 'Condividere le credenziali per indagare', 'Disattivare ogni controllo di rete'], 0],
      ['d04', 'Come si tratta un possibile falso positivo?', ['Ignorarlo senza registrazione', 'Verificare contesto e fonti e registrare la motivazione della decisione', 'Pubblicare il nome dell’utente coinvolto', 'Disattivare permanentemente l’allarme'], 1],
      ['d05', 'Quale vantaggio offre la telemetria endpoint (EDR)?', ['Elimina la necessità di aggiornamenti', 'Aiuta a rilevare e ricostruire attività sui dispositivi', 'Garantisce che non avvengano incidenti', 'Sostituisce i controlli di accesso'], 1],
      ['d06', 'Quale backup è più resiliente al ransomware?', ['Una copia sempre montata e scrivibile con le stesse credenziali', 'Copie isolate o immutabili con ripristini testati', 'Una cartella condivisa senza versioni', 'La sola copia sul computer dell’utente'], 1],
      ['d07', 'Cosa dovrebbe includere un report di incidente?', ['Solo un giudizio senza evidenze', 'Cronologia, evidenze, impatto, azioni e raccomandazioni', 'Password e token in chiaro', 'Dati non verificati presentati come certi'], 1],
      ['d08', 'Come si usa correttamente l’intelligence sulle minacce?', ['Come prova automatica di compromissione', 'Come contesto da correlare con telemetria e rischio locale', 'Per bloccare ogni IP pubblicato', 'Come sostituto delle patch'], 1],
      ['d09', 'Come si prioritizza una vulnerabilità da correggere?', ['Solo in base al nome del prodotto', 'Considerando sfruttabilità, esposizione e impatto sul contesto', 'In ordine alfabetico', 'Solo quando viene pubblicata sui social'], 1],
      ['d10', 'Qual è una pratica corretta per preservare evidenze digitali?', ['Modificare i file originali durante l’analisi', 'Limitare gli accessi e documentare acquisizione e integrità', 'Inviare i dati a un servizio non autorizzato', 'Cancellare i metadati prima di registrarli'], 1],
    ],
  },
};

function getCourse(courseId) {
  return Object.prototype.hasOwnProperty.call(COURSES, courseId) ? COURSES[courseId] : null;
}

function publicCourse(courseId, lang, translate) {
  const course = getCourse(courseId);
  if (!course) return null;
  return {
    courseId,
    prefix: course.prefix,
    title: lang === 'en' ? course.title.en : course.title.it,
    questions: course.questions.map(([id, question, options]) => ({
      id,
      question: translate(question),
      options: options.map(translate),
    })),
  };
}

function grade(courseId, answerOrder, answers) {
  const course = getCourse(courseId);
  if (!course) return null;
  let correct = 0;
  for (const [id, , , correctIndex] of course.questions) {
    const visibleIndex = answers[id];
    const order = answerOrder[id];
    if (Number.isInteger(visibleIndex) && order && order[visibleIndex] === correctIndex) correct += 1;
  }
  return Math.round((correct / course.questions.length) * 100);
}

module.exports = { COURSES, getCourse, publicCourse, grade };

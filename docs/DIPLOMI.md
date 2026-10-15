# Diplomi verificabili EVIL

EVIL firma i diplomi con una chiave Ed25519 privata. La chiave non deve essere
inclusa nel repository, nei log o in un'immagine pubblica.

## Generare e configurare la chiave

Per lo sviluppo locale, esegui `npm run setup:local` (oppure `node
scripts/setup-local.js`): lo script genera `CERT_SIGNING_KEY` nel `.env`
locale. Conserva una copia di backup cifrata e non condividere il file `.env`.

Per generare una chiave da configurare su Render, usa Node.js 22:

```sh
node -e "const c=require('crypto');const k=c.generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'});process.stdout.write(Buffer.from(k).toString('base64'))"
```

Copia l'intero output come valore della variabile d'ambiente `CERT_SIGNING_KEY`
nel servizio Render. In produzione, se la variabile manca o non è valida,
l'emissione viene disabilitata; non viene creata una chiave sul filesystem
effimero del servizio.

La chiave privata non è recuperabile dal server dopo averla persa: conserva
una copia cifrata in un gestore di segreti con accesso limitato. Non sostituire
la chiave senza avere prima archiviato la chiave pubblica e predisposto la
verifica dei diplomi già emessi.

## Rotazione delle chiavi

I nuovi diplomi usano sempre la chiave corrente. Per mantenere verificabili i
diplomi firmati con una chiave precedente, imposta facoltativamente
`CERT_PREVIOUS_PUBLIC_KEYS` come array JSON di oggetti `keyId` e `publicKeyPem`.
Il `keyId` è il prefisso di 16 caratteri esadecimali dello SHA-256 della chiave
pubblica DER SubjectPublicKeyInfo. Esempio:

```json
[{"keyId":"0123456789abcdef","publicKeyPem":"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----\n"}]
```

Usa il `keyId` e il PEM pubblicati dall'endpoint
`/api/certificates/public-key` prima della rotazione. Configura la variabile su
Render prima di distribuire la nuova chiave privata. Le chiavi pubbliche non
sono segrete; conserva comunque l'associazione tra ogni chiave e il suo `keyId`
per consentire verifiche future. Verifica una copia di backup della chiave
privata prima di dismettere quella precedente.

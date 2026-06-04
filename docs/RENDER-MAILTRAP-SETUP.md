# Deploy Render + Mailtrap Live + projectevil.it

## Variabili Render consigliate

| Variabile | Valore |
|-----------|--------|
| `BASE_URL` | `https://projectevil.it` |
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/var/data` (con **Persistent Disk** su Render) |
| `DB_FILE` | opzionale; se vuoto usa `DATA_DIR/users.json` |
| `TRUST_PROXY` | `1` |
| `FORCE_HTTPS` | `1` |
| `COOKIE_DOMAIN` | `.projectevil.it` |
| `CORS_ORIGINS` | `https://projectevil.it,https://www.projectevil.it` |

### Mailtrap Live (dominio verificato projectevil.it)

Credenziali da **Mailtrap → Sending Domains → projectevil.it → Integrations → SMTP**.

| Variabile | Valore |
|-----------|--------|
| `SMTP_HOST` | `live.smtp.mailtrap.io` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` |
| `SMTP_USER` | `api` |
| `SMTP_PASS` | *API token Mailtrap (Sending)* |
| `SMTP_FROM_EMAIL` | `noreply@projectevil.it` (dominio verificato) |
| `SMTP_MODE` | `live` |
| `REGISTER_SMTP_TIMEOUT_MS` | `12000` |

**Non usare** `smtp.gmail.com` se il DNS è configurato per Mailtrap (DKIM `rwmt*.dkim.smtp.mailtrap.live`).

### Gmail (alternativa, senza Mailtrap sending)

Solo se vuoi inviare da Gmail, non da dominio Mailtrap:

| Variabile | Valore |
|-----------|--------|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | `projectevil.supp@gmail.com` |
| `SMTP_PASS` | *password app 16 caratteri* |
| `SMTP_FROM_EMAIL` | `projectevil.supp@gmail.com` |

## Diagnostica dopo deploy

```text
GET https://projectevil.it/api/health/smtp
```

Risposta `ok: true` → SMTP raggiungibile. Se `hints` contiene avvisi, correggi le variabili su Render e **Manual Deploy**.

## `EMAIL_DEV_OUTBOX=0`

In produzione le email devono uscire solo via SMTP. Se la registrazione va in timeout, correggi SMTP (sopra); non disattivare SMTP senza aver configurato Mailtrap Live.

## Sicurezza

Non committare mai `JWT_SECRET`, `SMTP_PASS` o password app su GitHub. Ruota i segreti se sono stati esposti.

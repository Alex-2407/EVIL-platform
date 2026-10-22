# Revisioni incrociate

Qui la seconda testa scrive cosa ha trovato rivedendo il lavoro dell'altra
(protocollo in [LAVORO-IN-DUE.md](LAVORO-IN-DUE.md)). Chi rivede aggiunge una sezione in fondo e
non tocca quelle precedenti; chi corregge aggiorna solo la riga "Stato" del problema.

Formato di una sezione:

```markdown
## AAAA-MM-GG · chi rivede · commit rivisti

Controlli: lint ok · test ok · traduzioni ok · codifica ok

1. [alta | media | bassa] `percorso/file.js:riga` — cosa non va. Perché conta. Proposta.
   Stato: aperto
2. Nessun problema su: fatti, tono, accessibilità…
```

Gravità: **alta** = sbagliato, rischioso o contro le regole; **media** = da sistemare prima del
deploy; **bassa** = miglioramento.

---

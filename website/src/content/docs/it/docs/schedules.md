---
title: 'Pianificazioni'
description: 'La pagina Pianificazioni automatizza le attività ricorrenti con espressioni cron.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Indietro all'indice della documentazione](/docs/)

La pagina **Pianificazioni** automatizza le attività ricorrenti con espressioni cron. Nessun cron esterno, nessun script.

![Pianificazioni](/docs/images/schedules.png)

## Cosa puoi pianificare

- **Riavvii** - un riavvio notturno per mantenere in salute un server in esecuzione da molto tempo.
- **Backup** - snapshot regolari (contrassegnati come `scheduled` nella pagina [Backup](/docs/backups/)).
- **Comandi** - esegui qualsiasi comando del server secondo una pianificazione.
- **Verifiche aggiornamenti** - aggiorna periodicamente ciò che è obsoleto.

Ogni pianificazione è rivolta a un server specifico (o al pannello globalmente), viene eseguita con la propria espressione cron e può essere abilitata o disabilitata senza eliminarla. Viene mostrato l'ora dell'ultima esecuzione in modo da poter confermare che venga attivata.

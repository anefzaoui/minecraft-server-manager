---
title: 'Registro attività'
description: 'La pagina Attività è la traccia di controllo completa: un registro cronologico ricercabile di tutto ciò che è accaduto nel pannello.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Indietro all'indice della documentazione](/docs/)

La pagina **Attività** è il registro di controllo completo: una cronologia ricercabile di tutto ciò che è accaduto nel pannello.

![Attività](/docs/images/activity.png)

## Cosa viene registrato

- **Autenticazione** - accessi (incluso se è stata utilizzata l'autenticazione a due fattori o un codice di backup), e abilitazione, disabilitazione o reimpostazione dell'autenticazione a due fattori.
- **Ciclo di vita del server** - creazioni, avvii, arresti, riavvii, crash ed eventi di esaurimento della memoria.
- **Avvisi** - avvii bloccati, arresti falliti, pianificazioni fallite, arresti per quota, container non integri, offline-dopo-riavvio.
- **Dati** - backup creati e ripristinati, blueprint esportati, installazioni e aggiornamenti di pacchetti.
- **Configurazione** - modifiche ai comandi della chat, modifiche ai ruoli e modifiche alle impostazioni.

Ogni voce registra chi l'ha eseguita (un nome utente, o il pannello/pianificatore per azioni automatizzate), a quale server si riferisce e quando. La [dashboard](/docs/dashboard/) mostra le voci più recenti; questa pagina è la cronologia completa. Gli eventi del ciclo di vita e gli avvisi possono anche essere inoltrati a Discord (vedi [Integrazioni](/docs/integrations/)).

Poiché cattura eventi rilevanti per la sicurezza (accessi, modifiche all'autenticazione a due fattori, modifiche ai ruoli), il registro delle attività è anche il tuo primo punto di riferimento se qualcosa non va con un account.

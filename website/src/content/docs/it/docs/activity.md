---
title: 'Registro attività'
description: 'La pagina Attività è la traccia di controllo completa: un registro cronologico ricercabile di tutto ciò che è accaduto nel pannello.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Torna all'indice della documentazione](/docs/)

La pagina **Attività** è il registro di controllo completo: un record cronologico e ricercabile di tutto ciò che è accaduto nel pannello. Filtralo per server o per tipo di evento, cerca nei riepiloghi ed esporta ciò che hai filtrato come CSV o JSON. Le voci che hanno catturato un log (un crash, ad esempio) lo aprono in loco.

![Attività](/docs/images/activity.png)

## Cosa viene registrato

- **Autenticazione**: accessi (incluso se è stata utilizzata l'autenticazione a due fattori o un codice di backup), blocchi dell'account, modifiche della password e abilitazione, disabilitazione o reimpostazione dell'autenticazione a due fattori.
- **Ciclo di vita del server**: creazioni, avvii, arresti, riavvii, crash, riavvii automatici ed eventi di esaurimento della memoria.
- **Avvisi**: avvii bloccati, arresti falliti, pianificazioni fallite, arresti per quota, container non integri, offline-dopo-riavvio.
- **Dati**: backup creati e ripristinati, blueprint esportati, pacchetti installati e aggiornati, modifiche a mod e mondi, ed edizioni di file.
- **Giocatori**: espulsioni, ban, modifiche alla whitelist e agli operatori, e note sui giocatori.
- **Configurazione**: modifiche ai comandi della chat, modifiche agli utenti e ai ruoli, modifiche alle autorizzazioni per server, modifiche alle porte di gioco ed edizioni delle impostazioni.

Ogni voce registra chi l'ha eseguita (un nome utente, o il pannello/scheduler per azioni automatizzate), a quale server si riferisce e quando. La [dashboard](/docs/dashboard/) mostra le voci più recenti; questa pagina è la cronologia completa. Operatori e visualizzatori vedono solo le voci relative ai server che possono visualizzare (più quelle a livello di pannello), e le modifiche alle autorizzazioni per server sono mostrate solo agli amministratori. Gli eventi del ciclo di vita e gli avvisi possono anche essere inoltrati a Discord (vedi [Integrazioni](/docs/integrations/)).

Poiché cattura eventi rilevanti per la sicurezza (accessi, modifiche all'autenticazione a due fattori, modifiche ai ruoli e alle autorizzazioni), il registro delle attività è anche il tuo primo punto di riferimento se qualcosa non va con un account.

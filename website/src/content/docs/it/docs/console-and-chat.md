---
title: 'Console e comandi chat'
description: 'La scheda Console trasmette il log del server in tempo reale e fornisce una casella di comando per inviare qualsiasi comando del server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Torna all'indice della documentazione](/docs/)

## La console live

La scheda **Console** trasmette il log del server in tempo reale e fornisce una casella di comando per inviare qualsiasi comando del server. Niente `docker exec`, niente SSH. L'output viene visualizzato in linea, con colori e tutto il resto. L'invio di comandi richiede il permesso Console su quel server; senza di esso è comunque possibile visualizzare il log.

Sopra il log è possibile filtrare le righe per testo (o `/regex/`) e per livello (INFO, WARN, ERROR), e **Scarica** offre l'output recente, il `latest.log` completo, o tutti i file di log come zip.

![Console](/docs/images/server-console.png)

La console è anche il luogo in cui il pannello legge lo stato del server: osserva il log per classificare la fase di avvio ("Caricamento mod", "Generazione mondo", "Avvio completato") e chiama `list` per tracciare chi è online, in modo che la dashboard e le schede del server riflettano sempre la realtà.

Quel polling apre una connessione RCON di breve durata ogni ciclo, che il server registra come una coppia `Thread RCON Client … started` / `shutting down` ogni ~20 secondi, e (sui server il cui core o plugin la ripetono) una riga `Rcon issued server command: …` per ogni polling di sola lettura (`list` per il conteggio dei giocatori, più letture di `time query …` e `gamerule <name>` mentre i Controlli del Mondo sono aperti). L'opzione **Nascondi rumore della console** sopra il log filtra quelle righe (insieme alle righe di avvio del listener RCON). È attiva per impostazione predefinita e ricordata per browser; disattivala per vedere lo stream grezzo.

I comandi inviati dal pannello possono essere annunciati in gioco sotto un'etichetta per server (la casella **Annuncia come…**), in modo che i giocatori sappiano che un operatore ha agito piuttosto che una console misteriosa.

## Chat

**Console → Chat** invia messaggi nel gioco mentre il server è in esecuzione: i messaggi **Stilizzati** accettano colori e formattazione e possono essere inviati a tutti o a un singolo giocatore online, mentre **Semplice** invia una semplice trasmissione `[Server]` a tutti.

![Console → Chat](/docs/screenshots/04-chat.png)

## Comandi della chat

I comandi della chat (**Console → Comandi**) consentono ai giocatori di attivare azioni del pannello digitando un comando prefisso in chat di gioco, ad esempio `!spawn` per il teletrasporto casuale. Il rilevamento si basa sul log e l'esecuzione avviene tramite il server, quindi **non sono necessarie mod**.

![Comandi della chat](/docs/images/chat-commands.png)

Ogni comando ha:

- Un **trigger** (es. `spawn`), digitato dopo il **prefisso** del server (`!` per impostazione predefinita, uno o due caratteri, mai `/`).
- Un **azione**: teletrasporto casuale, teletrasporto a una struttura, teletrasporto a un bioma o esecuzione di comandi console grezzi.
- Un **livello di permesso**: tutti, giocatori in whitelist o solo operatori.
- Un **cooldown** per giocatore (30 secondi per impostazione predefinita), e messaggi personalizzabili di attesa / successo / fallimento con segnaposto come `{distance}`.

### Una nota sulla sicurezza

I comandi che possono danneggiare un server (`stop`, `op`, `ban`, `whitelist` e simili) sono consentiti solo con trigger **solo per operatori**. Il pannello li controlla anche quando sono annidati all'interno di una catena `execute … run …`, quindi un trigger di basso permesso non può introdurre di nascosto un comando pericoloso. Il testo ordinario della chat che menziona semplicemente quelle parole (come un messaggio `say`) viene ignorato.

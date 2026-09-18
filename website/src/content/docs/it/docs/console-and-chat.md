---
title: 'Console e comandi chat'
description: 'La scheda Console trasmette il log del server in tempo reale e fornisce una casella di comando per inviare qualsiasi comando del server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Indice della documentazione](/docs/)

## La console live

La scheda **Console** trasmette il log del server in tempo reale e fornisce una casella di comando per inviare qualsiasi comando del server. Niente `docker exec`, niente SSH. L'output viene visualizzato inline, con colori e tutto il resto.

![Console](/docs/images/server-console.png)

La console è anche il luogo in cui il pannello legge lo stato del server: osserva il log per classificare la fase di avvio ("Caricamento mod", "Generazione mondo", "Avvio completato") e chiama `list` per tracciare chi è online, in modo che la dashboard e le schede del server riflettano sempre la realtà.

Questo polling apre una connessione RCON di breve durata ogni ciclo, che il server registra come una coppia `Thread RCON Client … started` / `shutting down` ogni ~20 secondi, e (sui server il cui core o plugin la replicano) una riga `Rcon issued server command: …` per ogni lettura di sola consultazione: `list` per il conteggio dei giocatori, più letture di `time query …` e `gamerule <name>` mentre la pagina Controlli Mondo è aperta. L'interruttore **Nascondi rumore RCON** sopra il log filtra queste righe (insieme alle righe di avvio del listener RCON). È attivo per impostazione predefinita e memorizzato per browser; disattivarlo per vedere lo stream grezzo.

I comandi inviati dal pannello possono essere annunciati in gioco sotto un'etichetta per server, in modo che i giocatori sappiano che un operatore ha agito piuttosto che una console misteriosa.

## Comandi chat

I comandi chat consentono ai giocatori di attivare azioni del pannello digitando un comando di prefisso in chat di gioco, ad esempio `!spawn` per il teletrasporto casuale. Il rilevamento si basa sul log e l'esecuzione avviene tramite il server, quindi **non sono necessarie mod**.

![Comandi chat](/docs/images/chat-commands.png)

Ogni comando ha:

- Un **trigger** (es. `spawn`) e un **prefisso** (`!` per impostazione predefinita).
- Un **azione**: teletrasporto casuale, teletrasporto verso una struttura, teletrasporto verso un bioma o esecuzione di comandi console grezzi.
- Un **livello di permesso**: tutti, giocatori in whitelist o solo operatori.
- Un **cooldown** e messaggi personalizzabili di attesa / successo / fallimento con segnaposto come `{distance}`.

### Una nota sulla sicurezza

I comandi che possono danneggiare un server (`stop`, `op`, `ban`, `whitelist` e simili) sono consentiti solo con trigger **solo per operatori**. Il pannello controlla questi comandi anche quando sono annidati all'interno di una catena `execute … run …`, in modo che un trigger di basso permesso non possa introdurre di nascosto un comando pericoloso. Il testo ordinario della chat che menziona semplicemente quelle parole (come un messaggio `say`) viene ignorato.

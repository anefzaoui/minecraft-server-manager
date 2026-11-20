---
title: 'La dashboard'
description: 'La dashboard è la tua base operativa: ogni server, il suo stato in tempo reale e un feed degli eventi più recenti.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Torna all'indice della documentazione](/docs/)

La dashboard è la tua base operativa: ogni server, il suo stato in tempo reale e un flusso continuo di ciò che è successo.

![Dashboard](/docs/images/dashboard.png)

## Le tessere riassuntive

In alto:

- **Server online**: quanti dei tuoi server sono in esecuzione, sul totale.
- **Giocatori connessi**: il numero totale di giocatori su tutti i server in esecuzione.
- **Aggiornamenti disponibili**: quanti server, pack o mod hanno una versione più recente ([vedi Aggiornamenti](/docs/updates/)).
- **Docker**: se il pannello può raggiungere il demone Docker e la sua versione.

Una seconda riga aggiunge **Memoria allocata** (e quanta è in uso), **Spazio su disco utilizzato** in tutte le cartelle dei dati del server, **Stato · 24h** (crash, arresti per esaurimento memoria e riavvii automatici nell'ultimo giorno) e **Aggiornamenti** suddivisi tra aggiornamenti di mod e a livello di server. Sotto di essi, **Server per stato** conta i tuoi server in ogni stato, e **Panoramica risorse** mostra la quota di memoria e CPU di ogni server.

## Schede server

Ogni server viene visualizzato come una scheda con il suo stato (In esecuzione, Avvio, Arrestato, Crashato e stati intermedi come Non integro o Bloccato), il tipo e la versione di Minecraft, la porta di gioco e i suoi tag. Ogni scheda mostra l'utilizzo di **giocatori** e **disco** rispetto alla quota; i server in esecuzione mostrano anche **CPU** e **memoria** in tempo reale, aggiornate continuamente.

Fai clic su una scheda per aprire quel server. La scheda vuota **Crea un server** e il pulsante **Crea un server** nella barra superiore avviano entrambi la [procedura guidata di creazione](/docs/servers/).

Puoi cercare i tuoi server (per nome, tipo, versione o tag), ordinarli per stato, nome, dimensione, ultimo avvio o data di creazione, e passare dalla visualizzazione a griglia a quella a elenco con l'interruttore a destra.

## Attività recenti

Il flusso in basso mostra le voci più recenti dal registro di controllo leggibile del pannello: accessi, backup, esportazioni di blueprint, controlli degli aggiornamenti, modifiche ai comandi della chat, avvii e arresti dei server e altro ancora. Ogni voce è contrassegnata dal server a cui appartiene (o dal pannello stesso) e da quanto tempo fa è avvenuta. **Visualizza tutto** apre la cronologia completa nella pagina [Attività](/docs/activity/).

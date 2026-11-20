---
title: 'Mappa live'
description: "Attiva una mappa 3D live di BlueMap del mondo di un server con un clic, servita solo tramite l'accesso al pannello."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Indietro all'indice della documentazione](/docs/)

La scheda **Mondo → Mappa** di un server mostra una mappa 3D live e zoomabile del suo mondo, disegnata da [BlueMap](https://bluemap.bluecolored.de/) (gratuito e open source), con le posizioni dei giocatori e ogni dimensione. Il pannello lo installa, lo configura e lo serve; non è necessario aprire una porta o modificare un file di configurazione.

## Attivazione

1. Apri il server, quindi **Mondo → Mappa**.
2. Premi **Abilita Mappa Live**. Il pannello installa la build di BlueMap che corrisponde al loader e alla versione di Minecraft del server da Modrinth, accetta il download delle risorse di BlueMap per te e sceglie una porta gratuita per esso.
3. Riavvia il server (la modifica viene applicata al prossimo avvio e il server viene contrassegnato come in attesa di uno).

BlueMap esegue il rendering in background, quindi una nuova mappa richiede alcuni minuti per disegnare le sue prime tessere. Fino ad allora, la scheda indica che la mappa non è ancora pronta e si aggiorna da sola. Una volta attiva, **Schermo Intero** apre la mappa in una propria scheda del browser.

Funziona su server con un mod loader (Fabric, Quilt, Forge, NeoForge) e su server plugin (Paper, Purpur e il resto della famiglia Paper, Spigot), inclusi i server modpack. I server Vanilla non dispongono di una build di BlueMap e la scheda lo indica.

## Chi può vederla

La mappa viene servita solo tramite il pannello, dietro il suo accesso: chiunque possa visualizzare il server nel pannello può aprire la sua mappa, e nessun altro. La porta di BlueMap non è mai destinata ad essere aperta su Internet ([porte a colpo d'occhio](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). L'attivazione o la disattivazione della mappa richiede l'autorizzazione **Impostazioni** del server ([utenti e ruoli](/docs/users-and-roles/#per-server-permissions)).

Quando il pannello stesso viene eseguito in Docker, raggiunge BlueMap all'interno del container del server; il [README](https://github.com/anefzaoui/minecraft-server-manager#installation) spiega i dettagli per le configurazioni di reverse-proxy.

## Disattivazione

**Disabilita Mappa** rimuove il jar di BlueMap installato dal pannello e libera la sua porta, di nuovo dal prossimo riavvio. Il mondo stesso non viene toccato; le tessere della mappa renderizzate rimangono nella cartella del server finché non le elimini nella scheda **File**.

Correlati: [mondi e file](/docs/worlds-and-files/), [inviti e pagina di stato](/docs/invites-and-status-page/).

---
title: 'Aggiornamenti'
description: 'La pagina Aggiornamenti tiene traccia di ciò che è obsoleto nella tua flotta in un unico posto:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Indietro all'indice della documentazione](/docs/)

La pagina **Aggiornamenti** tiene traccia di ciò che è obsoleto nella tua flotta in un unico posto:

- Versioni dei **Modpack** ([modpacks](/docs/modpacks/)) rispetto a Modrinth / CurseForge / l'indice di rilascio di GTNH.
- **Contenuti personalizzati** che hai aggiunto tu stesso - mod, datapack, resource pack, plugin - ognuno rispetto alla sua origine: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) o GitHub Releases. Le ricerche su GitHub utilizzano la rivalidazione ETag, quindi i controlli giornalieri incidono minimamente sul limite di richieste.
- Obsolescenza dell'**immagine Docker**: l'ID dell'immagine di ogni container in esecuzione rispetto a un tag appena scaricato (deduplicato tra i server con lo stesso tag), offerto come aggiornamento ricreabile.
- **Blocchi di versione standalone**: per un server senza un pack gestito, un pin esplicito di `mc_version` rispetto al manifest di Mojang e una variabile d'ambiente esplicita per la build del loader (`PAPER_BUILD`, `FORGE_VERSION` e simili) rispetto al registro del loader. Le build di Paper provengono dall'attuale **Fill v3 API** di PaperMC (l'endpoint legacy v2 ha smesso di ricevere nuove versioni di Minecraft).

![Aggiornamenti](/docs/images/updates.png)

## Come funziona

Il pannello confronta le versioni bloccate di ciascun server con la fonte upstream e elenca tutto ciò che ha una nuova release. Un conteggio corrispondente appare anche nel riquadro "Aggiornamenti disponibili" della [dashboard](/docs/dashboard/).

I controlli vengono eseguiti su richiesta e possono essere pianificati ([Pianificazioni](/docs/schedules/)). La **policy** di aggiornamento è per server: decidi tu se il pannello ti avvisa semplicemente o lascia tutto manuale.

## Applicare un aggiornamento

Gli aggiornamenti non sono mai silenziosi. Quando scegli di aggiornare un pack, il pannello:

1. Esegue un **backup pre-aggiornamento** (in modo che sia reversibile; vengono conservati gli ultimi 10 backup pre-aggiornamento per server).
2. Ripina la versione esatta della nuova release.
3. Ricrea il container, risolvendo nuovamente il runtime Java se necessario.
4. Monitora il primo avvio, con un budget di tempo per piattaforma.

Se non si avvia correttamente, viene ripristinato il backup pre-aggiornamento. A un server che segue le release stabili non viene mai offerta una beta, e il link al changelog punta alla vera differenza per versione dove la fonte la fornisce. Un aggiornamento fallito attiva anche un [avviso](/docs/integrations/) su Discord se l'integrazione è configurata.

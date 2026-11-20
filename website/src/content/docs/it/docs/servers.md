---
title: 'Creazione e gestione dei server'
description: 'Crea, avvia, arresta, ricrea e configura server Minecraft nel pannello: la procedura guidata di creazione, le impostazioni, la memoria e la porta di gioco.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Indietro all'indice della documentazione](/docs/)

## Creazione di un server

Fai clic su **Crea un server** (barra superiore) o sulla scheda **Crea un server** per aprire la procedura guidata.

![Creazione di un server](/docs/images/create-wizard.png)

La procedura guidata precompila l'heap Java e la quota disco da **Impostazioni predefinite per nuovi server** nella pagina Impostazioni, che un amministratore può modificare in qualsiasi momento. Anche un nuovo server prende da lì il suo limite di CPU.

![Impostazioni predefinite per nuovi server](/docs/images/settings-defaults.png)

Scegli:

- Un **nome** (e una descrizione, icona e colore d'accento opzionali). I tag per organizzare la tua flotta vengono aggiunti in seguito, nelle impostazioni del server.
- Un **tipo di server**: Vanilla, Paper o Purpur nella scheda **Vanilla**. Per un server moddato, la scheda **Da mod** sceglie il loader (Fabric, Forge, NeoForge o Quilt), la versione di Minecraft e una build del loader (l'ultima o una specifica), quindi ti consente di cercare le mod.
- Una **versione di Minecraft**: `LATEST`, uno snapshot o una versione specifica (incluse beta e alpha).
- Una **porta di gioco**: viene suggerita una porta libera. La console remota (RCON) utilizza la porta 1000 in più (per impostazione predefinita). Puoi modificarla in seguito (vedi [Modifica della porta di gioco](#changing-the-game-port)).
- **Risorse**: l'heap Java (il limite di memoria del container è impostato al 50% in più rispetto ad esso) e una quota disco.

**Opzioni avanzate** apre ogni altra impostazione supportata dall'immagine del server, più variabili d'ambiente aggiuntive e (per gli amministratori) le impostazioni avanzate di Docker.

Preferisci un modpack? La scheda **Da modpack** installa invece un pacchetto CurseForge, Modrinth o GT New Horizons (vedi [Modpack](/docs/modpacks/)), oppure accetta uno **zip personalizzato che carichi**: un `.mrpack` di Modrinth, un'esportazione di modpack di CurseForge (`manifest.json`), o qualsiasi zip di file jar di mod. Il manifest (o un voto di maggioranza tra i file jar identificati) compila il loader e la versione di Minecraft, e ogni mod viene installata in un'unica operazione. Puoi anche partire da un [Blueprint](/docs/blueprints/) salvato nella scheda **Da blueprint**.

Il pannello sceglie automaticamente un runtime Java sensato per la tua versione, scarica l'immagine, crea il container e lo avvia, tutto da un unico modulo.

## L'elenco dei server

La pagina **Server** elenca la tua intera flotta con stato e statistiche rapide.

![Elenco server](/docs/images/servers-list.png)

## Un singolo server

![Giocatori](/docs/images/players.png)

Aprire un server ti offre uno spazio di lavoro a schede:

- **Panoramica**: l'indirizzo da condividere con i giocatori, la descrizione, l'utilizzo in tempo reale e chi è online.
- **Console**: lo stream di log in tempo reale e l'input dei comandi, la chat di gioco e i [comandi della console](/docs/console-and-chat/).
- **Giocatori**: l'elenco, più inventario e statistiche.
- **Mod**: l'elenco delle mod installate, il [browser delle mod](/docs/modpacks/) e gli aggiornamenti dei contenuti. Su un server moddato, la sua sotto-scheda **Versioni** verifica per quali future versioni di Minecraft le tue mod hanno build disponibili ([aggiornamenti](/docs/updates/#minecraft-version-compatibility)).
- **Mondo**: [mondi, la mappa live e il file manager](/docs/worlds-and-files/).
- **Backup**: [snapshot e ripristino](/docs/backups/) per questo server.
- **Monitoraggio**: cronologia per server e metriche in tempo reale, inclusi i report di crash (vedi sotto).
- **Impostazioni**: **Configurazione** (tutto ciò che riguarda il funzionamento del server), più le [integrazioni](/docs/integrations/) (Discord, Pagina di stato, Inviti e, per gli amministratori, Chatbot).

I controlli di avvio, arresto e riavvio si trovano nell'intestazione sopra ogni scheda. Ciò che puoi fare su ciascuna scheda dipende dalle tue [autorizzazioni su quel server](/docs/users-and-roles/#per-server-permissions): ad esempio, la sotto-scheda **File** richiede l'autorizzazione File e l'invio di comandi della console richiede Console.

![Panoramica del server](/docs/images/server-overview.png)

La barra **Controlli del mondo** scorre su ogni scheda: l'orologio di gioco, il meteo, le gamerule comuni come chip di attivazione/disattivazione e "Mostra tutte le regole del mondo" per le altre.

![Controlli del mondo](/docs/images/world-controls.png)

**Monitoraggio → Live** mostra TPS e millisecondi per tick, una scheda di salute e stabilità con crash (ultime 24 ore e 7 giorni), arresti forzati per memoria insufficiente e riavvii automatici, e dimensioni per mondo.

![Monitoraggio live](/docs/images/monitoring-live.png)

## Impostazioni del server

**Impostazioni → Configurazione** è la superficie di configurazione completa: nome, descrizione, MOTD, icona, colore e tag, risorse, porta di gioco, policy di aggiornamento, avvio all'avvio del pannello e riavvio automatico in caso di crash, ogni variabile d'ambiente supportata dall'immagine del server, le impostazioni avanzate di Docker e l'esportazione, clonazione, ricostruzione ed eliminazione di blueprint. Le modifiche che hanno effetto solo dopo la ricostruzione del server vengono salvate immediatamente e attendono: un pulsante **Applica modifiche** appare nell'intestazione del server e vengono applicate anche al prossimo avvio del server.

**Riavvio automatico in caso di crash** riavvia un server bloccato, attendendo più a lungo tra un tentativo e l'altro (5, 10, poi 20 secondi) e fermandosi dopo 3 tentativi entro 10 minuti. Salta i crash che il pannello riconosce come problemi di configurazione (l'EULA, la Java errata, un mondo da una versione più recente, una porta in uso, memoria insufficiente, una chiave CurseForge mancante), perché quelli richiedono prima una correzione. Se un'altra azione è occupata con il server (un backup, un ripristino, una modifica della porta), attende fino a 30 minuti e rinuncia non appena qualcuno arresta o avvia manualmente il server.

Le modifiche dirette alle impostazioni rimangono sempre attive tra i riavvii. Una modifica PvP o di difficoltà effettuata con la barra **Controlli del mondo**, un'attivazione/disattivazione della whitelist nella scheda **Giocatori** o una modifica di `server.properties` nell'editor **File** rimuove la variabile d'ambiente corrispondente (se impostata) e contrassegna il server per la ricostruzione, in modo che il valore su disco prevalga invece di essere riaffermato dall'immagine del container al prossimo avvio.

![Impostazioni del server](/docs/images/server-settings.png)

**Informazioni sul misuratore di memoria.** "RAM (heap Java)" viene passata a Java sia come heap iniziale che massimo, e Java riempie un heap che gli è stato dato in anticipo entro il primo minuto, con o senza i preset di flag Aikar / MeowIce. Quindi il misuratore di memoria si assesta a circa la dimensione dell'heap e rimane lì anche quando nessuno sta giocando; il segno sul misuratore indica dove si trova l'heap sotto il limite del container, e la nota sottostante lo dice. Se preferisci che la memoria segua l'uso reale, fornisci al server un heap iniziale più piccolo con **Heap iniziale** nella scheda Risorse in **Impostazioni → Configurazione** (o sotto **Opzioni avanzate** nella procedura guidata), ad esempio 512 MB: su un heap da 2 GB ciò ha ridotto l'uso inattivo da 2,6 GB a circa 1,3 GB nelle nostre misurazioni. Java necessita anche di memoria al di fuori dell'heap (circa 0,5 GB su vanilla, da 1,5 a 2 GB su un modpack di grandi dimensioni), che è ciò per cui serve il margine del limite del container. Vedi "Due limiti di memoria" nel README per i numeri.

> Le **Impostazioni avanzate di Docker** (nome del container, rete Docker, mappature porte aggiuntive e bind di volumi aggiuntivi) sono **solo per amministratori**, poiché un bind mount più l'accesso Docker del pannello equivalgono a root sull'host. Vedi [Utenti e ruoli](/docs/users-and-roles/).

### Modifica della porta di gioco

La scheda **Porta di gioco** in **Impostazioni → Configurazione** sposta un server su un'altra porta in qualsiasi momento, con il proprio pulsante **Salva porta**. **Usa porta libera successiva** sceglie la più bassa disponibile e la scheda controlla qualsiasi porta inserita prima di salvarla. RCON segue sempre a 1000 sopra la porta di gioco (l'offset predefinito). Gli amministratori possono scegliere qualsiasi porta da 1024 in su; tutti gli altri scelgono dalla prima porta di gioco (25565 per impostazione predefinita) in su. Il salvataggio applica la modifica immediatamente: un server arrestato si sposta semplicemente, e uno in esecuzione chiede prima, quindi si riavvia sulla nuova porta (il mondo viene salvato prima e i giocatori si riconnettono sulla nuova porta). Se il server non può avviarsi sulla nuova porta, torna a quella vecchia. La modifica viene rifiutata mentre altre modifiche attendono **Applica modifiche**, quindi applicale prima. La modifica della porta richiede l'autorizzazione Impostazioni su quel server.

![La scheda Porta di gioco](/docs/images/server-port.png)

![Il prompt prima che un server in esecuzione si riavvii sulla sua nuova porta](/docs/images/port-restart.png)

## Report di crash e analisi mclo.gs

I report di crash (`crash-reports/*.txt` e file JVM `hs_err_pid*.log`) vengono raccolti automaticamente, analizzati in un riepilogo di una riga con l'eccezione e le mod sospette, e elencati sotto **Monitoraggio → Cronologia**:

![Scheda report di crash](/docs/images/crash-mclogs-card.png)

Ogni scheda report offre un visualizzatore integrato (con sezioni comprimibili ed eccezioni evidenziate), copia-stack-trace e download, più due azioni [mclo.gs](https://mclo.gs):

- **Condividi su mclo.gs** pubblica il report come paste pubblico e copia il link: la cosa esatta che gli autori di mod e i Discord di supporto chiedono. Il link viene ricordato sul report, quindi nulla viene mai caricato due volte.
- **Analizza** esegue gli insight automatici di mclo.gs sul paste: problemi noti con correzioni suggerite (dipendenze mancanti, conflitti di versione, conflitti di mod comuni), visualizzati direttamente nel pannello.

![Insight mclo.gs](/docs/images/crash-insights.png)

Entrambe le azioni sono protette da una conferma esplicita, poiché un paste è pubblico: i report di crash possono includere nomi di giocatori e il tuo elenco completo di mod. Il pannello non carica mai nulla da solo.

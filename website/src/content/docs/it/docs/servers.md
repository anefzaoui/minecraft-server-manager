---
title: 'Creazione e gestione di server'
description: 'Fai clic su Crea un server (barra superiore) o sulla scheda Crea un server per aprire la procedura guidata.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Indice della documentazione](/docs/)

## Creazione di un server

Fai clic su **Crea un server** (barra superiore) o sulla scheda **Crea un server** per aprire la procedura guidata.

![Crea un server](/docs/images/create-wizard.png)

La procedura guidata precompila i campi per memoria, CPU e quota disco da **Impostazioni predefinite per nuovi server** nella pagina Impostazioni, che un amministratore può modificare in qualsiasi momento.

![Impostazioni predefinite per nuovi server](/docs/images/settings-defaults.png)

Scegli:

- Un **nome** (e un'icona opzionale, un colore d'accento e tag per organizzare la tua flotta).
- Un **tipo di server** - vanilla, Paper, Fabric, Forge, NeoForge e altro, ognuno mappato alla corretta immagine itzg dietro le quinte.
- Una **versione di Minecraft** - `LATEST`, uno snapshot o una versione specifica.
- **Risorse** - RAM (heap), limite di memoria del container, CPU e una quota disco.

Preferisci un modpack? La scheda **Da modpack** installa invece un pacchetto CurseForge, Modrinth, FTB o GT New Horizons (vedi [Modpack](/docs/modpacks/)), oppure accetta uno **zip personalizzato che carichi**: un'esportazione di modpack CurseForge (`manifest.json`) o qualsiasi zip di mod jar. Il manifest (o un voto di maggioranza tra i jar identificati) compila il loader e la versione di Minecraft, e ogni mod viene installata in un'unica operazione. Puoi anche iniziare da un [Blueprint](/docs/blueprints/) salvato.

Il pannello sceglie automaticamente un runtime Java sensato per la tua versione, scarica l'immagine, crea il container e (opzionalmente) lo avvia, tutto da un unico modulo.

## Elenco dei server

La pagina **Server** elenca la tua intera flotta con stato e statistiche rapide.

![Elenco server](/docs/images/servers-list.png)

## Un singolo server

![Giocatori](/docs/images/players.png)

Aprire un server ti offre uno spazio di lavoro a schede:

- **Panoramica** - stato, statistiche live, uptime e i controlli principali di avvio/arresto/riavvio.
- **Console** - lo stream di log live e l'input dei comandi, più la chat di gioco ([dettagli](/docs/console-and-chat/)).
- **Giocatori** - chi è online, più inventario, statistiche e [comandi della chat](/docs/console-and-chat/).
- **Mod** - l'elenco delle mod installate, il [browser delle mod](/docs/modpacks/) e gli aggiornamenti dei contenuti.
- **Mondo** - [mondi, la mappa live e il file manager](/docs/worlds-and-files/).
- **Backup** - [snapshot e ripristino](/docs/backups/) per questo server.
- **Monitoraggio** - cronologia per server e metriche live, inclusi i report di crash (vedi sotto).
- **Impostazioni** - tutto su come funziona il server, più le [integrazioni](/docs/integrations/) (Discord, pagina di stato, inviti, chatbot).

![Panoramica server](/docs/images/server-overview.png)

La barra **Controlli del mondo** scorre su ogni scheda: l'orologio di gioco, il meteo, le comuni gamerule come chip di attivazione e "Mostra tutte le regole del mondo" per le restanti.

![Controlli del mondo](/docs/images/world-controls.png)

**Monitoraggio → Live** mostra TPS e millisecondi per tick, una scheda di salute e stabilità con le ultime 24 ore / 7 giorni di crash e riavvii, e dimensioni per mondo.

![Monitoraggio live](/docs/images/monitoring-live.png)

## Impostazioni del server

La scheda **Impostazioni** è la superficie di configurazione completa: rinomina, risorse, policy di aggiornamento, avvio/riavvio automatico, variabili d'ambiente e override Docker avanzati. I campi che modificano il funzionamento del container sono chiaramente contrassegnati come richiedenti un riavvio.

![Impostazioni server](/docs/images/server-settings.png)

**Informazioni sul misuratore di memoria.** "RAM (Java heap)" viene passata a Java sia come heap iniziale che massimo, e Java riempie un heap che gli è stato dato in anticipo entro il primo minuto, con o senza i preset di flag Aikar / MeowIce. Quindi il misuratore di memoria si stabilizza a circa la dimensione dell'heap e rimane lì anche quando nessuno sta giocando; il segno sul misuratore indica dove si trova l'heap sotto il limite del container, e la nota sotto dice così. Se preferisci vedere la memoria seguire l'uso reale, imposta un **Heap iniziale** più piccolo (avanzato): su un heap da 2 GB ciò ha ridotto l'uso inattivo da 2,6 GB a circa 1,3 GB nelle nostre misurazioni. Java necessita anche di memoria al di fuori dell'heap (circa 0,5 GB su vanilla, da 1,5 a 2 GB su un modpack di grandi dimensioni), che è ciò per cui serve il margine del limite del container. Vedi "Due limiti di memoria" nel README per i numeri.

> I campi di override Docker avanzati (nome container personalizzato, porte aggiuntive e bind mount, e override grezzi) sono **solo per amministratori**, poiché un bind mount più l'accesso Docker del pannello equivalgono a root sull'host. Vedi [Utenti e ruoli](/docs/users-and-roles/).

## Report di crash e analisi mclo.gs

I report di crash (`crash-reports/*.txt` e file JVM `hs_err_pid*.log`) vengono raccolti automaticamente, analizzati in un riepilogo di una riga con l'eccezione e le mod sospette, e elencati sotto **Monitoraggio → Cronologia**:

![Scheda report di crash](/docs/images/crash-mclogs-card.png)

Ogni scheda del report offre un visualizzatore integrato (con sezioni comprimibili ed eccezioni evidenziate), copia stack trace e download, più due azioni [mclo.gs](https://mclo.gs):

- **Condividi su mclo.gs** pubblica il report come paste pubblico e copia il link - la cosa esatta che gli autori di mod e i Discord di supporto richiedono. Il link viene ricordato sul report, quindi nulla viene mai caricato due volte.
- **Analizza** esegue gli insight automatizzati di mclo.gs sul paste: problemi noti con soluzioni suggerite (dipendenze mancanti, discrepanze di versione, conflitti di mod comuni), visualizzati direttamente nel pannello.

![Insight mclo.gs](/docs/images/crash-insights.png)

Entrambe le azioni sono precedute da una conferma esplicita, poiché un paste è pubblico: i report di crash possono includere nomi di giocatori e il tuo elenco completo di mod. Il pannello non carica mai nulla da solo.

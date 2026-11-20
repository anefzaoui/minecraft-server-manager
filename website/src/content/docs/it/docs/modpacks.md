---
title: 'Modpack'
description: 'Installa modpack CurseForge, Modrinth, FTB e GT New Horizons come server, sempre bloccati a una versione esatta del pacchetto.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Indietro all'indice della documentazione](/docs/)

La pagina **Modpack** (e la scheda **Da Modpack** nella [procedura guidata di creazione](/docs/servers/)) installa un modpack come server, sempre **bloccato a una versione esatta del pack** in modo che un riavvio non possa mai aggiornare silenziosamente il pack senza che tu te ne accorga.

![Modpacks](/docs/images/modpacks.png)

## Piattaforme supportate

- **CurseForge**: ricerca per nome. Richiede una chiave API di CurseForge (aggiungila in **Impostazioni → Chiavi API**).
- **Modrinth**: ricerca per nome.
- **FTB**: pack Feed The Beast, solo tramite API (un ID numerico del pack più un ID di versione esplicito). Il pannello non controlla ancora gli aggiornamenti dei pack FTB.
- **GT New Horizons**: il pack expert 1.7.10, installato dall'indice di rilascio di GTNH. GTNH sceglie il suo runtime Java per ogni versione del pack (2.8.0+ viene eseguito su **Java 25** tramite patch lwjgl3ify incluse, versioni precedenti su Java 21 o 17), e la procedura guidata aumenta la RAM e il disco del server ai minimi sensati per esso.
- **Zip personalizzato**: non un pack pubblicato. Carica un **esportazione di modpack CurseForge** (lo zip con `manifest.json` che l'app di CurseForge produce per un set di mod scelto manualmente), un **`.mrpack` di Modrinth**, o **qualsiasi zip di jar di mod**. Il pannello risolve il manifest in blocco (o identifica ogni jar tramite hash/impronta/metadati), visualizza in anteprima ciò che è compatibile e installa tutto in un'unica operazione, incluse le configurazioni `overrides/` del pack se lo desideri. Le mod i cui autori non consentono download automatici sono elencate con un link al browser e uno slot di caricamento manuale invece di fallire l'installazione.

## Come funziona il blocco

Quando scegli un pack, il pannello risolve la versione esatta, la registra e la installa. Nella pagina **Aggiornamenti** ti verrà comunicato quando una versione più recente è disponibile (a meno che la [politica di aggiornamento](#update-policy) del server non sia **Solo Manuale**); l'aggiornamento è un'azione deliberata e protetta con un backup pre-aggiornamento e un rollback. Ai server che seguono la versione stabile non viene mai offerta una beta. La scheda **Versioni** di un server risponde all'altra metà della domanda: quali future versioni di Minecraft possono seguire le mod che ha effettivamente ([aggiornamenti](/docs/updates/#minecraft-version-compatibility)).

Anche la versione del mod loader viene fornita con il pack: il server installa la build Forge, NeoForge o Fabric dichiarata dal pack. Se un pack Forge o Fabric CurseForge dichiara una versione troppo vecchia per le proprie mod, la scheda **Versioni** può sovrascriverla fino a quando il pack non viene corretto; un aggiornamento del pack rimuove la sovrascrittura, poiché la nuova versione dichiara la propria ([modifica della versione del mod loader](/docs/updates/#changing-the-mod-loader-version)).

I server creati su versioni molto vecchie del pannello (precedenti alla 0.9.7) potevano rimanere _non bloccati_, il che significa che l'immagine del container installava silenziosamente la versione più recente del pack ad ogni avvio. Il pannello ora li ripara all'avvio: blocca ciascuno alla versione effettivamente installata (letta dai record del pannello o dal manifest di installazione dell'immagine, mai un "latest" appena risolto) e registra un evento. Se non riesce a determinare cosa è installato, la pagina Impostazioni del server mostra un avviso con un pulsante **Scegli una versione…** (pack CurseForge, Modrinth e GTNH) che apre il [selettore di versione](#changing-the-pack-version), e qualsiasi tentativo di salvare una configurazione di modpack non bloccata viene rifiutato categoricamente.

## Politica di aggiornamento

Ogni server ha una scheda **Politica di Aggiornamento** nella sua scheda **Impostazioni → Configurazione**, e tutte e tre le opzioni significano ciò che dicono:

- **Solo Manuale** (predefinito): nulla cambia da solo, e il server viene completamente escluso dal badge di aggiornamento e dalla pagina Aggiornamenti. La modalità "lasciami in pace": ideale per un pack personalizzato o importato che non vuoi mai venga toccato. Non blocca la versione: [**Cambia Versione…**](#changing-the-pack-version) funziona con ogni politica. Per essere informato sulle nuove versioni e applicarle con un clic, scegli **Avvisami**.
- **Avvisami**: il controllo giornaliero mostra gli aggiornamenti disponibili come badge e nella pagina Aggiornamenti; l'applicazione è sempre a tuo clic.
- **Aggiornamento Automatico**: dopo il controllo giornaliero programmato, gli aggiornamenti **del pack** in sospeso vengono applicati attraverso lo stesso percorso protetto di un aggiornamento manuale: backup pre-aggiornamento, monitoraggio dello stato e rollback automatico se la nuova versione non si avvia correttamente. Gli aggiornamenti che sposterebbero il server a una versione diversa di Minecraft vengono sempre saltati con un evento invece: convertire un mondo in modo permanente è una decisione che il pannello si rifiuta di prendere per te. I pulsanti manuali **Controlla Ora** controllano solo; non attivano mai gli aggiornamenti automatici.

## Aggiornamento di un pack

Da un server bloccato puoi aggiornare a una versione più recente in un'unica operazione. Il pannello esegue prima un backup, scambia la versione bloccata, ricostruisce il server (risolvendo nuovamente Java se la nuova versione necessita di un runtime diverso) e monitora il primo avvio, con una finestra generosa per pack di grandi dimensioni come GTNH che scaricano un paio di gigabyte e costruiscono un mondo con centinaia di mod al primo avvio.

## Cambiare la versione del pack

Per eseguire una versione specifica, più recente o più vecchia, usa **Cambia Versione…** sulla scheda del pack della scheda **Panoramica** del server. Nella pagina **Modpack**, l'apertura della scheda di un pack installato offre la stessa scelta: scegli una versione nel menu a discesa e fai clic su **Passa a questa versione**. Entrambe richiedono il permesso **Contenuto** del server, ed entrambe sono disponibili per i pack CurseForge, Modrinth e GTNH (i pack FTB non hanno ancora un elenco di versioni). L'elenco mostra le 25 versioni più recenti per CurseForge e Modrinth, e ogni rilascio GTNH.

Il passaggio avviene attraverso lo stesso percorso protetto di un aggiornamento: un backup pre-aggiornamento, il nuovo blocco, una ricostruzione e un primo avvio monitorato, con un rollback con un clic se il server non si avvia correttamente. Le tue mod personalizzate vengono mantenute, così come le mod del pack che hai disabilitato, insieme alle altre impostazioni di installazione del pack (mod forzate, file da ignorare, progetti aggiuntivi). L'installazione di un pack diverso riavvia queste impostazioni da zero, poiché hanno senso solo per il pack per cui sono state create.

Ogni versione è elencata con la versione di Minecraft che esegue, confrontata con la versione con cui il tuo mondo è stato salvato l'ultima volta:

- **Stessa versione di Minecraft**: passa dopo una normale conferma. Tornare a una versione precedente del pack può rimuovere blocchi e oggetti da mod che quella versione non ha, quindi il backup rimane nella scheda Backup in entrambi i casi.
- **Versione di Minecraft più recente**: consentito dopo una conferma che avvisa che il mondo viene convertito in modo permanente. Il backup eseguito per primo è l'unico modo per tornare al vecchio mondo.
- **Versione di Minecraft più vecchia**: non disponibile. Minecraft non può caricare un mondo su una versione precedente a quella che lo ha salvato l'ultima volta, quindi il pannello rifiuta piuttosto che lasciare un server che va in crash all'avvio.

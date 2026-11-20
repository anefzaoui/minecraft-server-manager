---
title: 'Mondi e file'
description: 'La libreria dei mondi, caricamenti e scambi di mondi, la scheda mod e plugin e il file manager nel browser.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Indietro all'indice della documentazione](/docs/)

## Mondi

La pagina **Mondi** è la libreria dei mondi: ogni mondo salvato in un unico posto. **Carica Mondo** prende un archivio `.zip` o `.tar` e trova automaticamente il mondo al suo interno, **Salva in Libreria** crea uno snapshot del mondo live di un server (funziona mentre il server è in esecuzione), e ogni mondo della libreria può essere scaricato o installato su qualsiasi server con **Installa in…**. L'installazione sostituisce il mondo del server (il server deve essere fermo e il suo mondo attuale viene prima sottoposto a backup) o lo aggiunge a fianco, per attivarlo in seguito. Un controllo di compatibilità viene eseguito prima di ogni installazione.

La scheda **Mondo → Mondi** di un server elenca i mondi presenti su quel server. Da lì puoi attivare un altro mondo (con il server fermo), scaricare, duplicare, rinominare o [comprimere](/docs/world-shrink/) un mondo, copiarlo su un altro server, eliminare uno inattivo e resettare il mondo attivo con un seed nuovo, conservato o personalizzato (viene offerto prima un backup di sicurezza). La stessa libreria si trova sotto, con **Installa Qui**.

![Mondi](/docs/images/worlds.png)

## Il file manager

Sotto la sezione **Mondo** di un server, la scheda **File** è un file manager completo nel browser per la directory dei dati di quel server. Elenca, leggi, modifica, rinomina, sposta, copia, elimina e carica file, crea cartelle e cerca il testo dei file sotto una cartella con **Trova nei File**: tutto ciò che faresti normalmente tramite SSH, dal browser.

![File manager](/docs/images/server-files.png)

I file di testo si aprono in un editor con un limite di 8 MB; i file più grandi possono essere scaricati. I caricamenti accettano fino a 20 file contemporaneamente.

### Rimanere all'interno della sandbox

Ogni operazione sui file è confinata alla directory dei dati del server. Il pannello risolve ogni percorso e rifiuta qualsiasi cosa che tenti di uscire: attraversamento `..`, percorsi assoluti e persino collegamenti simbolici che puntano al di fuori della directory (inclusi quelli pendenti che non esistono ancora). Una mod o un plugin non può inserire un link per ingannare il file manager a leggere o scrivere altrove sull'host.

## Mod

Per server moddati e con plugin, la scheda **Mod** (un gruppo a sé stante nella barra laterale del server) gestisce il set di mod: sfoglia e aggiungi mod, e vedi cosa è installato. Dalla riga di ogni mod installata puoi aggiornarla (o ignorare quell'aggiornamento), [ripristinarla](/docs/updates/#undoing-a-mod-update), disabilitarla o rimuoverla, e **Aggiorna Tutto** applica ogni aggiornamento disponibile con un riavvio. Gli aggiornamenti di mod e pack compaiono anche nella pagina [Aggiornamenti](/docs/updates/).

### Aggiungere mod

![Mod](/docs/images/mods.png)

Quattro modi per aggiungerle, tutti dalla barra degli strumenti della scheda Mod:

- **Cerca Mod**: cerca **Modrinth o CurseForge** (il chip CurseForge appare una volta memorizzata una chiave API in **Impostazioni → Chiavi API**), e sui server plugin anche **Hangar** (il registro plugin di PaperMC) e **SpigotMC** (tramite il proxy CDN di Spiget), entrambi senza chiavi. Una scheda **Datapack** cerca i datapack di Modrinth. Tutto viene filtrato in base al loader e alla versione di Minecraft del server (una casella di controllo mostra anche build non elencate come compatibili, a tuo rischio); i server Quilt vedono automaticamente anche le build contrassegnate come fabric, poiché Quilt esegue mod Fabric. I risultati già presenti sul server mostrano un badge **Installato**. Se un autore di CurseForge vieta i download automatici (o una risorsa SpigotMC è ospitata esternamente), il pannello lo indica chiaramente e offre un percorso **Apri CurseForge** (o **Apri SpigotMC**) + **Carica Jar** invece di fallire a metà installazione.

  ![Ricerca Hangar](/docs/images/mods-search-hangar.png)

- **Importa Zip**: un pulsante, tre forme, rilevate automaticamente:
  - Un **modpack Modrinth (`.mrpack`)**: ogni file fissato viene canonizzato nuovamente nel suo progetto Modrinth tramite ricerca hash (quindi le mod importate mantengono nomi reali, icone e rimangono aggiornabili; i file che Modrinth non conosce vengono installati dall'URL del pack stesso), verificato rispetto ai checksum sha512 del pack durante il download, e visualizzato con verdetto di idoneità. I file client-only vengono saltati visibilmente, e entrambi gli alberi di sovrascrittura (`overrides/`, poi `server-overrides/`; la copia specifica del server vince) possono essere applicati.

    ![Importazione mrpack](/docs/images/mrpack-import.png)

  - Un **esportazione di modpack CurseForge** (lo zip che l'app CurseForge produce, con `manifest.json`): ogni mod fissata viene risolta in blocco, visualizzata con avvisi (loader/MC errati per questo server, file non più su CurseForge, mod che richiedono download manuale), e installata con progresso reale. Gli `overrides/` del pack (config, script) possono essere opzionalmente applicati; qualsiasi file che verrebbe sovrascritto viene prima sottoposto a backup in `.import-backups/<timestamp>/` all'interno della cartella del server.
  - Uno **zip semplice di jar** che hai raccolto tu stesso: ogni jar viene identificato (corrispondenza hash Modrinth → impronta digitale CurseForge → metadati del jar stesso) e giudicato rispetto al server (_idoneo / loader errato / versione MC errata / già installato / non identificato_), così scegli cosa appartiene effettivamente prima che qualcosa venga installato.
- **Aggiungi tramite URL**: incolla quasi tutto: pagine di progetto Modrinth, CurseForge, Hangar o SpigotMC, un URL di repository o release GitHub (funziona anche un semplice `owner/repo`; le installazioni GitHub preferiscono la release stabile più recente e saltano i jar secondari `-sources`/`-javadoc`), uno slug Modrinth semplice, o qualsiasi URL diretto `.jar`. Il pannello risolve la build corretta per il loader e la versione MC del server.

  ![Aggiungi tramite link](/docs/images/mods-add-by-link.png)

- **Carica Jar** (dal fallback di ricerca o dal risolutore di download in sospeso): i jar caricati vengono identificati allo stesso modo, quindi mantengono il loro nome reale, versione, icona e diventano aggiornabili.

Ogni installazione dal registro viene **verificata tramite checksum durante il download**: lo stream viene controllato rispetto al digest più forte pubblicato dal registro (sha512 → sha256 → sha1 → md5) e una mancata corrispondenza interrompe il processo prima che qualcosa atterri sul server.

Un intero zip (`.mrpack` incluso) può anche **creare un server**: nella scheda **Da Modpack** della procedura guidata, caricalo e il manifest del pack (o un voto di maggioranza tra i jar identificati) compilerà il loader, la versione di Minecraft e la build del loader.

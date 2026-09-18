---
title: 'Mondi e file'
description: 'La pagina Mondi gestisce i dati del mondo sui tuoi server: scambia il mondo attivo, carica un mondo o scaricane uno.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Indice della documentazione](/docs/)

## Mondi

La pagina **Mondi** gestisce i dati del mondo tra i tuoi server: scambia il mondo attivo, carica un mondo o scaricalo.

![Mondi](/docs/images/worlds.png)

## Il file manager

Sotto la sezione **Mondo** di un server, la scheda **File** è un file manager completo all'interno del browser per la directory dei dati di quel server. Elenca, leggi, modifica, crea, rinomina, sposta, copia, elimina e carica file: tutto ciò che faresti normalmente tramite SSH, dal browser.

![File manager](/docs/images/server-files.png)

I file di testo si aprono in un editor con un limite di 2 MB; i file più grandi possono essere scaricati. I caricamenti accettano più file contemporaneamente.

### Rimanere all'interno della sandbox

Ogni operazione sui file è confinata alla directory dei dati del server. Il pannello risolve ogni percorso e rifiuta qualsiasi cosa che possa uscire: attraversamento `..`, percorsi assoluti e persino collegamenti simbolici che puntano al di fuori della directory (inclusi quelli pendenti che non esistono ancora). Una mod o un plugin non possono creare un link per ingannare il file manager a leggere o scrivere altrove sull'host.

## Mod

Per i server moddati, la scheda **Mod** (un suo gruppo nella barra laterale del server) gestisce il set di mod: sfoglia e aggiungi mod, e vedi cosa è installato. Gli aggiornamenti di mod e pacchetti compaiono nella pagina [Aggiornamenti](/docs/updates/).

### Aggiungere mod

![Mod](/docs/images/mods.png)

Quattro modi per aggiungerle, tutti dalla barra degli strumenti della scheda Mod:

- **Cerca mod** - cerca su **Modrinth o CurseForge** (il chip CurseForge appare una volta memorizzata una chiave API in Impostazioni → Chiavi API), e sui server plugin anche **Hangar** (il registro plugin di PaperMC) e **SpigotMC** (tramite il proxy CDN di Spiget) - entrambi senza chiave. Tutto viene filtrato in base al loader e alla versione di Minecraft del server; i server Quilt vedono automaticamente anche le build etichettate come fabric, poiché Quilt esegue mod Fabric. I risultati già presenti sul server mostrano un badge **Installato**. Se un autore di CurseForge vieta i download automatici - o una risorsa SpigotMC è ospitata esternamente - il pannello lo indica chiaramente e offre un percorso **Apri pagina** + **Carica jar** invece di fallire a metà installazione.

  ![Ricerca Hangar](/docs/images/mods-search-hangar.png)

- **Importa zip** - un pulsante, tre forme, rilevamento automatico:
  - Un **Modpack Modrinth (`.mrpack`)**: ogni file bloccato viene canonizzato nuovamente nel suo progetto Modrinth tramite ricerca hash (quindi le mod importate mantengono nomi reali, icone e rimangono aggiornabili; i file che Modrinth non conosce vengono installati dall'URL del pacchetto stesso), verificato rispetto ai checksum sha512 del pacchetto durante il download e visualizzato con verdetto di idoneità. I file client-only vengono saltati visibilmente, e entrambi gli alberi di sovrascrittura (`overrides/`, poi `server-overrides/` - la copia specifica del server vince) possono essere applicati.

    ![Importazione mrpack](/docs/images/mrpack-import.png)

  - Un **esportazione di modpack CurseForge** (lo zip che l'app di CurseForge produce, con `manifest.json`): ogni mod bloccata viene risolta in blocco, visualizzata con avvisi (loader/MC errati per questo server, file non più su CurseForge, mod che richiedono un download manuale) e installata con progresso reale. Gli `overrides/` del pacchetto (config, script) possono anche essere applicati opzionalmente - qualsiasi file che verrebbe sovrascritto viene prima sottoposto a backup in `.import-backups/<timestamp>/` all'interno della cartella del server.
  - Uno **zip semplice di jar** che hai raccolto tu stesso: ogni jar viene identificato (corrispondenza hash Modrinth → impronta digitale CurseForge → i metadati del jar stesso) e giudicato rispetto al server - _corrisponde / loader errato / versione MC errata / già installato / non identificato_ - così scegli cosa appartiene effettivamente prima che qualcosa venga installato.
- **Aggiungi tramite link** - incolla quasi tutto: pagine di progetto Modrinth, CurseForge, Hangar o SpigotMC, un repository GitHub o URL di rilascio (anche un semplice `owner/repo` funziona - le installazioni GitHub preferiscono la release stabile più recente e saltano i file sidecar `-sources`/`-javadoc`), uno slug Modrinth semplice, o qualsiasi URL diretto `.jar`. Il pannello risolve la build corretta per il loader e la versione MC del server.

  ![Aggiungi tramite link](/docs/images/mods-add-by-link.png)

- **Carica jar** (dal fallback di ricerca o dal risolutore di download in sospeso) - i jar caricati vengono identificati allo stesso modo, quindi mantengono il loro nome reale, versione, icona e diventano aggiornabili.

Ogni installazione dal registro viene **verificata tramite checksum durante il download**: lo stream viene controllato rispetto al digest più forte pubblicato dal registro (sha512 → sha256 → sha1 → md5) e una mancata corrispondenza interrompe il processo prima che qualcosa atterri sul server.

Un intero zip (`.mrpack` incluso) può anche **creare un server**: nella scheda _Da modpack_ della procedura guidata, caricalo e il manifest del pacchetto (o un voto di maggioranza tra i jar identificati) compilerà il loader, la versione di Minecraft e la build del loader.

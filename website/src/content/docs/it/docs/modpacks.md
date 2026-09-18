---
title: 'Modpack'
description: 'La pagina Modpack (e la scheda "Da modpack" nella procedura guidata di creazione) installa un modpack come server, sempre bloccato a una versione esatta del pacchetto in modo che un riavvio possa'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Torna all'indice della documentazione](/docs/)

La pagina **Modpack** (e la scheda **Da modpack** nella [procedura guidata di creazione](/docs/servers/)) installa un modpack come server, sempre **bloccato a una versione esatta del pack** in modo che un riavvio non possa mai aggiornare silenziosamente il pack a tua insaputa.

![Modpacks](/docs/images/modpacks.png)

## Piattaforme supportate

- **CurseForge** - cerca o incolla l'URL di un pack. Richiede una chiave API di CurseForge per la ricerca e i pack privati (aggiungila in Impostazioni → Chiavi API).
- **Modrinth** - cerca per nome.
- **FTB** - Feed The Beast packs.
- **GT New Horizons** - il pack expert 1.7.10, installato dall'indice di rilascio di GTNH. GTNH sceglie il suo runtime Java per versione del pack (2.8.0+ funziona su **Java 25** tramite patch lwjgl3ify incluse, versioni precedenti su Java 21 o 17), e la procedura guidata aumenta la RAM e il disco del server ai minimi sensati per esso.
- **Zip personalizzato** - non un pack pubblicato: carica un **esportazione di modpack di CurseForge** (lo zip con `manifest.json` che l'app di CurseForge produce per un set di mod scelto manualmente) o **qualsiasi zip di jar di mod**. Il pannello risolve il manifest in blocco tramite l'API di CurseForge (o identifica ogni jar tramite hash/fingerprint/metadati), visualizza in anteprima ciò che è compatibile e installa tutto in un'unica operazione, incluse le configurazioni `overrides/` del pack se si sceglie di includerle. Le mod i cui autori non consentono il download automatico sono elencate con un link al browser e uno slot di caricamento manuale invece di fallire l'installazione.

## Come funziona il blocco

Quando scegli un pack, il pannello risolve la versione esatta, la registra e la installa. Nella pagina **Aggiornamenti** ti verrà comunicato quando una versione più recente è disponibile; l'aggiornamento è un'azione deliberata e protetta con un backup pre-aggiornamento e un rollback. Ai server con tracciamento stabile non viene mai offerta una beta.

I server creati su versioni molto vecchie del pannello (prima della 0.9.7) potevano rimanere _non bloccati_, il che significa che l'immagine del container installava silenziosamente la versione più recente del pack ad ogni avvio. Il pannello ora li ripara all'avvio: blocca ciascuno alla versione effettivamente installata (letta dai record del pannello o dal manifest di installazione dell'immagine, mai un "latest" appena risolto) e registra un evento. Se non riesce a determinare cosa è installato, la pagina Impostazioni del server mostra un avviso che chiede di scegliere manualmente la versione, e qualsiasi tentativo di salvare una configurazione di modpack non bloccata viene rifiutato categoricamente.

## Politica di aggiornamento

Ogni server ha una politica di aggiornamento in **Impostazioni**, e tutte e tre le opzioni significano ciò che dicono:

- **Solo manuale** - nulla cambia da solo, e il server viene escluso dal badge di aggiornamento e dalla pagina Aggiornamenti. La modalità "lasciami in pace": ideale per un pack modificato manualmente o importato che non vuoi mai venga toccato.
- **Avvisami** (predefinito) - il controllo giornaliero mostra gli aggiornamenti disponibili come badge e nella pagina Aggiornamenti; l'applicazione è sempre a tua discrezione.
- **Aggiornamento automatico** - dopo il controllo giornaliero programmato, gli aggiornamenti **del pack** in sospeso vengono applicati tramite lo stesso percorso protetto di un aggiornamento manuale: backup pre-aggiornamento, monitoraggio dello stato e rollback automatico se la nuova versione non si avvia correttamente. Gli aggiornamenti che sposterebbero il server a una versione diversa di Minecraft vengono sempre saltati con un evento invece che applicati - convertire un mondo in modo permanente è una decisione che il pannello si rifiuta di prendere per te. I pulsanti manuali "controlla ora" controllano solo; non attivano mai gli aggiornamenti automatici.

## Aggiornamento di un pack

Da un server bloccato puoi aggiornare a una versione più recente in un'unica azione. Il pannello esegue prima un backup, scambia la versione bloccata, ricrea il container (risolvendo nuovamente Java se la nuova versione necessita di un runtime diverso) e monitora il primo avvio, con una finestra generosa per pack di grandi dimensioni come GTNH che scaricano un paio di gigabyte e costruiscono un mondo con diverse centinaia di mod al primo avvio.

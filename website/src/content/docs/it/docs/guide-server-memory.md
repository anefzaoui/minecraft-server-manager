---
title: 'Quanta RAM necessita un server Minecraft?'
description: 'Quanta RAM necessita un server Minecraft per vanilla, Paper, mod leggere e modpack pesanti, e quanta lasciarne per la macchina.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Indietro all'indice della documentazione](/docs/)

Risposta breve, per un server su cui si giocherà effettivamente:

| Cosa stai eseguendo                                   | Heap Java | Dai alla macchina |
| ----------------------------------------------------- | --------- | ----------------- |
| Vanilla o Paper, fino a 10 giocatori                  | 2 GB      | 4 GB              |
| Paper con plugin, da 10 a 30 giocatori                | 4 GB      | 6 GB              |
| Un modpack leggero, da 40 a 80 mod                    | 4 GB      | 6 GB              |
| Un pacchetto "kitchen-sink" corposo, da 150 a 300 mod | 6-8 GB    | 10 GB             |
| GregTech New Horizons e mostri simili                 | 8-12 GB   | 16 GB             |

Due numeri, non uno. Questa è la parte che la maggior parte delle guide salta, ed è il motivo per cui le persone acquistano un server da 4 GB, assegnano 4 GB a Java e poi lo guardano morire.

## L'heap e la macchina sono numeri diversi

L'heap Java (`-Xmx`) è la quantità di memoria che il gioco stesso può utilizzare per il mondo, le entità e i dati delle mod. La macchina, o il container, deve contenere quell'heap **più** tutto il resto di cui Java ha bisogno: metadati delle classi, stack dei thread, gestione della memoria (garbage collection), buffer di rete e la JVM stessa. Questo overhead è di circa 0,5-1,5 GB per un server moddato.

Se l'heap è uguale alla memoria della macchina, il kernel uccide il server nel momento in cui Java richiede quell'overhead. In Docker questo appare come codice di uscita 137, e nei log come nulla: il processo svanisce semplicemente a metà frase. Le persone di solito incolpano una mod.

Una regola sicura: **heap più il 25 percento, e almeno un gigabyte di scorta.** Un heap da 8 GB richiede una macchina da 10 GB.

## Più RAM non significa più prestazioni

Minecraft è legato a un singolo thread nella maggior parte delle sue operazioni. Dare a un pacchetto da 40 mod 16 GB non velocizza la generazione dei chunk; allunga ogni pausa di garbage collection, perché c'è più da scansionare. Un server che scatta ogni trenta secondi è spesso un server con troppo heap, non troppo poco.

Aumenta l'heap quando vedi queste cose, e non altrimenti:

- `java.lang.OutOfMemoryError: Java heap space` nel log.
- Ripetuti "Can't keep up! Is the server overloaded?" con pause di garbage collection nei timings.
- L'utilizzo della memoria che sale al massimo e rimane bloccato lì per ore.

## Perché il tuo server mostra 12 GB utilizzati mentre nessuno è online

Perché glielo hai detto tu. Due impostazioni predefinite cospirano:

1. L'immagine Docker comune imposta l'heap iniziale uguale al massimo, quindi `-Xms` e `-Xmx` sono entrambi il tuo numero. Java lo rivendica subito piuttosto che crescere gradualmente.
2. Il popolare set di flag di Aikar include `-XX:+AlwaysPreTouch`, che scansiona ogni pagina di quell'heap all'avvio in modo che le pagine siano effettivamente allocate. È deliberato: scambia un avvio più lento e una cifra "idle" elevata per meno pause in seguito.

Misurato su Paper 1.21.1 con un heap da 2 GB in un container da 4 GB, campionato per tre minuti dopo che il mondo ha finito di caricarsi:

| Configurazione                               | Memoria residente |
| -------------------------------------------- | ----------------- |
| Nessun flag                                  | 2.60 GiB          |
| Flag di Aikar                                | 2.59 GiB          |
| Flag di Aikar senza `AlwaysPreTouch`         | 1.95 GiB          |
| Flag di Aikar con un heap iniziale da 512 MB | 1.38 GiB          |
| Nessun flag con un heap iniziale da 512 MB   | 1.25 GiB          |

Quindi un server che "usa" 12 GB in idle è solitamente un heap da 12 GB che è stato pre-toccato, non una perdita di memoria. Il tuo monitoraggio lo sta leggendo correttamente; il numero semplicemente non significa ciò che sembra.

Se desideri una cifra "idle" onesta, imposta l'heap iniziale più basso del massimo. Lo paghi con qualche raccolta in più all'inizio. Se preferisci tempi di frame costanti, lascialo stare e smetti di guardare il grafico.

## I giocatori contano meno di quanto pensi

Raddoppiare da 10 a 20 giocatori costa molto meno che aggiungere cinquanta mod. I giocatori aggiungono principalmente entità e chunk caricati, che scalano dolcemente. Le mod aggiungono dati di classe, registri, funzionalità di generazione del mondo e le proprie cache, che non lo fanno. Dimensiona prima per il pacchetto, poi aggiungi circa 100-200 MB per giocatore regolare su un server moddato.

La distanza di visualizzazione (view distance) è l'altro grande fattore. Ridurla da 12 a 8 chunk può far risparmiare un gigabyte su un server trafficato ed è appena percettibile nel gioco.

## In Minecraft Server Manager

Ogni server ha due campi separati, **Heap Java** e **Limite di memoria del container**, proprio perché sono domande diverse. La procedura guidata di creazione imposta il limite del container al 50% sopra l'heap per te, e il pannello rifiuta di salvare un server il cui limite del container non è superiore al suo heap, perché quella combinazione finisce con il codice di uscita 137 anziché con un messaggio di errore.

Il misuratore di memoria su un server mostra ciò che il container sta realmente utilizzando, con una nota quando l'heap è stato richiesto in anticipo, in modo che un heap pre-toccato non venga letto come fuori controllo. Un server che il kernel ha terminato per memoria viene registrato esattamente così nella cronologia, anziché come un misterioso crash.

Correlati: [creazione e gestione dei server](/docs/servers/),
[report di crash](/docs/servers/#crash-reports--mclogs-analysis), [archiviazione e quote](/docs/storage/).

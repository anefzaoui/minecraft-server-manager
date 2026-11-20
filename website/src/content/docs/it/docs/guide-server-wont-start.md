---
title: 'Il tuo server Minecraft non si avvia'
description: "Un server Minecraft che non si avvia, risolto in ordine di probabilità: il log, la versione Java, la memoria, l'EULA e la porta, e le mod."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Indietro all'indice della documentazione](/docs/)

Procedi in quest'ordine. È ordinato in base alla frequenza con cui ciascuno è la risposta, e i primi quattro coprono la maggior parte dei casi.

## 1. Leggi le ultime venti righe, non le prime

Scorri fino alla **fine** del log. Una stack trace Java viene stampata dall'interno verso l'esterno, quindi la parte superiore del muro di testo è la meno interessante. Quello che ti serve è l'ultima riga `Caused by:` e ciò che la segue. Quella singola riga di solito indica il problema.

Due forme ti dicono dove ti trovi:

- `Exception in thread "main"` o un percorso del file di crash vicino alla fine indica che il gioco stesso è fallito.
- Il log che si interrompe a metà riga, senza alcuna eccezione, significa che qualcosa ha terminato il processo dall'esterno. Salta al punto 3.

## 2. UnsupportedClassVersionError significa Java errato

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

La classe file 52 è Java 8, 60 è 16, 61 è 17, 65 è 21, 69 è 25. Il messaggio significa che il server necessita di una versione di Java più recente di quella in esecuzione; il contrario, un vecchio pacchetto su un nuovo Java, di solito fallisce con un errore di mixin o di reflection.

| Versione di Minecraft | Java |
| --------------------- | ---- |
| 1.16.5 e precedenti   | 8    |
| 1.17                  | 16   |
| 1.18 e 1.19           | 17   |
| 1.20 a 1.20.4         | 17   |
| 1.20.5 a 1.21.x       | 21   |
| 26.1 e successivi     | 25   |

I vecchi pacchetti necessitano veramente di Java 8. Più recente non è meglio qui.

## 3. Codice di uscita 137 è il kernel, non una mod

Il log si interrompe a metà frase, non c'è un file di crash e il container riporta 137. Si tratta di un kill per esaurimento di memoria: il processo ha richiesto memoria che la macchina non aveva, quindi è stato terminato.

Quasi sempre l'heap Java è stato impostato sullo stesso numero della memoria della macchina. L'heap necessita della memoria della macchina **meno** l'overhead della JVM stessa, che è di 0,5-1,5 GB su un server moddato. Riduci l'heap o aumenta la macchina. [Quanta RAM necessita un server](/docs/guide-server-memory/) contiene i numeri.

## 4. L'EULA e la porta

Due classici con soluzioni in una riga:

- `You need to agree to the EULA in order to run the server.` Imposta `eula=true`, in `eula.txt` o con la variabile d'ambiente che la tua configurazione utilizza.
- `Address already in use` o `FAILED TO BIND TO PORT`. Qualcos'altro occupa la porta 25565, spesso una copia precedente dello stesso server che non si è mai arrestata completamente. Trovala e arrestala invece di cambiare la porta, altrimenti te ne ritroverai con due.

## 5. A una mod manca una dipendenza

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Le mod di Fabric necessitano quasi sempre della Fabric API come file separato. Le mod di Forge e NeoForge elencano le loro dipendenze nell'errore stesso. Installa la versione indicata, non quella più recente: "richiede 0.91.x" significa quella riga, e 0.92 fallirà lo stesso controllo.

A volte la dipendenza mancante è il loader stesso:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

La soluzione è una build del loader più recente, non una mod diversa. "47.4.14 o superiore" significa qualsiasi build da lì in su, e Forge non pubblica ogni numero, quindi la build da installare potrebbe essere la successiva. Su un modpack, aggiorna prima il pacchetto: un pacchetto la cui versione del loader è troppo vecchia per le sue mod è un bug per il suo autore da correggere.

## 6. Una mod è per il loader o la versione sbagliata

Un jar per un loader diverso non fallisce educatamente. Aspettati un errore di mixin, un `NoClassDefFoundError`, o un crash all'interno di una classe di cui non hai mai sentito parlare. Controlla la pagina del jar: sia il loader che la versione di Minecraft devono corrispondere esattamente. 1.20.1 e 1.20.4 sono giochi diversi per quanto riguarda le mod.

## 7. Il mondo proviene da una versione più recente

```
This world was created by a newer version of Minecraft
```

I mondi si aggiornano in avanti e mai indietro. Ripristina il backup precedente all'aggiornamento, o esegui la versione che il mondo si aspetta. Non esiste un percorso di downgrade che mantenga intatti i chunk.

## Quando si è bloccato dopo aver funzionato bene per settimane

Domanda diversa, risposta di solito diversa:

- **Si è bloccato sotto carico**, con i timing che mostrano lunghe pause: garbage collection, quindi guarda la dimensione dell'heap prima delle mod.
- **Si è bloccato nello stesso punto del mondo**: un chunk corrotto o un'entità danneggiata. Il file di crash di solito indica le coordinate.
- **Si è bloccato subito dopo un aggiornamento**: la mod aggiornata è il sospettato, anche se la traccia punta altrove. Ripristinala e vedi.
- **Si è bloccato al riavvio, dopo essere stato bene prima**: controlla il disco. Un disco pieno produce errori spettacolari e fuorvianti.

## Ottenere aiuto che aiuti davvero

Pubblica l'**intero log**, non l'ultima riga, e dì cosa hai cambiato prima che si rompesse. Incollalo da qualche parte progettato per questo, come [mclo.gs](https://mclo.gs), piuttosto che in chat. Includi la versione di Minecraft, il loader, il pacchetto e la sua versione, e quanta heap ha il server. Un report con questi quattro fatti riceve una risposta in un solo reply; senza di essi ci vogliono cinque.

## In Minecraft Server Manager

I crash vengono rilevati dall'uscita del container stesso, quindi un server che si arresta alle tre del mattino viene registrato con il suo estratto di log invece di essere trovato il giorno dopo. I soliti sospetti in questa pagina (l'EULA, il Java errato, un mondo da una versione più recente, una porta già in uso, Java che esaurisce la memoria) vengono riconosciuti in quel log e nominati nella voce di cronologia con cosa fare al riguardo, e l'auto-riavvio li ignora, poiché il riavvio non li risolverà. I file di crash vengono analizzati all'arrivo: l'eccezione viene evidenziata, lo stack è comprimibile e le mod che appaiono nella traccia sono elencate come sospette.

Qualsiasi report può essere condiviso su mclo.gs dalla sua scheda quando hai bisogno di aiuto (dopo una conferma, poiché la pubblicazione è pubblica), e il menu **Download** della console ha tutti i file di log in un unico zip, quindi "pubblica l'intero log" è un download piuttosto che un progetto di archeologia. Un kill per esaurimento di memoria viene registrato come kill per esaurimento di memoria, il che fa risparmiare l'ora solita di incolpare una mod. Se qualcos'altro necessita veramente della porta, la scheda **Porta di gioco** in **Impostazioni → Configurazione** sposta il server su una libera.

Un loader troppo vecchio viene modificato dalla scheda **Versioni** del server, che verifica che la build esista e fa un backup prima di ricostruire il server ([modifica della versione del mod loader](/docs/updates/#changing-the-mod-loader-version)).

Correlati: [quanta RAM necessita un server](/docs/guide-server-memory/), [scelta di un loader](/docs/guide-choosing-a-loader/), [creazione e gestione di server](/docs/servers/).

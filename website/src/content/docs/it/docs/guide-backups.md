---
title: 'Backup del server Minecraft che funzionano davvero'
description: 'Come creare backup del server Minecraft che funzionano davvero: copie consistenti, conservate altrove e testate almeno una volta.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Indietro all'indice della documentazione](/docs/)

La maggior parte dei server ha dei backup. Molti meno hanno backup che funzionano, e la differenza viene scoperta solo nel peggior giorno. Tre cose li distinguono: la copia è coerente, si trova altrove e qualcuno l'ha ripristinata almeno una volta.

## Copia il mondo mentre non viene scritto

Un server in esecuzione scrive continuamente i file di regione. Copiali mentre sono in fase di scrittura e otterrai un file che è per metà vecchio e per metà nuovo, che o non si caricherà o si caricherà con un buco nel terreno dove prima c'era la base di qualcuno. Nulla ti avvisa, perché la copia è riuscita.

Ci sono due modi corretti per fare una copia:

1. **Ferma il server**, copia, riavvialo. Semplice, onesto e impopolare a causa del tempo di inattività.
2. **Di' al gioco di smettere di scrivere prima.** Esegui `save-off`, poi `save-all flush`, attendi che finisca, copia, poi `save-on`. Il mondo è completo e silenzioso per la durata della copia.

Non saltare mai direttamente alla copia. Uno snapshot a livello di file system o di volume va bene solo se è genuinamente atomico, e un `cp -r` mentre i giocatori stanno piazzando blocchi non lo è.

## Esegui il backup di più del mondo

Ripristinare solo il mondo ti dà il terreno e perde il server. Vuoi anche:

- `server.properties`, e qualsiasi altra cosa imposti le regole.
- I jar delle mod o dei plugin, nelle versioni esatte che erano in esecuzione. Un mondo non si caricherà senza le mod che hanno creato i suoi blocchi.
- Dati dei giocatori, incluse `whitelist.json`, `ops.json` e le cartelle delle statistiche e dei progressi.
- La versione del pacchetto, se proviene da un pacchetto. Scriverla conta.

Il controllo di sanità più rapido su qualsiasi backup: potresti ricostruire questo server su una macchina nuova di zecca solo dall'archivio? Se la risposta richiede una frase che inizia con "e poi reinstallerei", non è un backup completo.

## Una copia sullo stesso disco non è un backup

Un backup che risiede sulla macchina che protegge copre esattamente un guasto: hai cancellato qualcosa. Non copre il disco che muore, il provider che sospende l'account o un errore che cancella l'intera directory.

Mantienilo semplice piuttosto che perfetto:

- Una copia locale, per il caso comune, che è qualcuno che fa griefing o un aggiornamento errato.
- Una copia altrove. Un'altra macchina, un object store o un NAS domestico che scarica ogni notte tramite SSH.
- Abbastanza cronologia per sopravvivere a un problema che non hai notato immediatamente. La corruzione viene spesso trovata giorni dopo, e se mantieni tre giorni di backup hai già sovrascritto quello buono.

Sette copie giornaliere più quattro settimanali coprono quasi ogni incidente reale e costano pochissimo spazio.

## Testa un ripristino prima di averne bisogno

Scegli un backup, ripristinalo in un server di riserva e connettiti. Questo è l'intero test, richiede quindici minuti e cattura tutti i fallimenti classici: l'archivio che manca della cartella delle mod, un mondo che necessita di una versione che non esegui più, permessi che rendono i file illeggibili, un caricamento troncato.

Fallo una volta quando imposti i backup e un'altra volta dopo ogni modifica importante al server.

## Dimensioni e come mantenerle sotto controllo

I mondi crescono perché i giocatori esplorano. Un mondo in cui qualcuno ha volato per diecimila blocchi in linea retta porta con sé ogni chunk lungo quella linea per sempre, e la maggior parte di quei chunk non verrà mai più visitata.

Tre leve, in ordine di quanto rendono:

1. **Elimina i chunk non visitati.** Gli strumenti che potano in base all'ora dell'ultimo tocco rimuovono tipicamente una grande frazione di un mondo ben percorso senza effetti visibili nel gioco.
2. **Comprimi correttamente.** I file di regione si comprimono bene; gli archivi di essi non beneficiano di nulla di esotico.
3. **Non conservare ogni copia oraria per un anno.** La conservazione batte la compressione.

## In Minecraft Server Manager

I backup seguono il percorso `save-off`, flush, copia, `save-on`, e un arresto o riavvio richiesto a metà backup viene rifiutato fino al completamento della copia piuttosto che gareggiare con essa. L'archivio copre l'intera directory del server, quindi mod, configurazione e dati dei giocatori viaggiano con il mondo.

I backup possono essere eseguiti su una pianificazione insieme a riavvii e comandi, e ogni nuovo server inizia con una pianificazione di backup giornaliera. Il conteggio della conservazione per ogni tipo è separato, quindi le dieci copie pianificate che si accumulano da sole non possono scacciare quella che hai fatto a mano prima di una modifica rischiosa, e i limiti di età e dimensione si applicano sopra. Gli amministratori modificano tutto nella pagina Impostazioni, o per server nella sua scheda Backup. Il ripristino richiede prima un nuovo backup, quindi un ripristino al punto sbagliato nel tempo è di per sé annullabile. Un mondo può essere ridotto da solo o come parte di un backup, che è la leva che conta di più per le dimensioni.

L'intero pannello, inclusi tutti i backup, risiede sotto un'unica directory. Copiare quella directory altrove è la metà della storia fuori macchina, ed è deliberatamente l'unica cosa che devi copiare.

Correlati: [backup nel pannello](/docs/backups/), [pianificazioni](/docs/schedules/),
[riduzione di un mondo](/docs/world-shrink/), [spostamento di un server su un altro host](/docs/guide-moving-a-server/).

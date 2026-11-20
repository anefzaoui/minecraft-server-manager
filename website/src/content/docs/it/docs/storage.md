---
title: 'Archiviazione'
description: 'Visualizza dove viene utilizzato lo spazio su disco, imposta un limite di quota disco per ogni cartella del server e pulisci ciò che non ti serve più.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Indice della documentazione](/docs/)

La pagina **Storage** mostra dove sta andando il tuo disco: utilizzo per categoria, ciascun server rispetto alla sua quota, i file più grandi e come l'utilizzo totale sta evolvendo nelle scansioni recenti. È riservata agli amministratori.

![Storage](/docs/images/storage.png)

## Le quote disco sono applicate dal pannello

Docker non può limitare l'utilizzo del disco di un bind mount, quindi lo fa il pannello. Un indicizzatore di dimensioni in background esamina la cartella dei dati (ogni 15 minuti, dopo le modifiche o quando premi **Scansiona Ora**), memorizza nella cache l'impronta di ciascun server e applica la quota disco che imposti per server. Un'azione che porterebbe la cartella di un server (mondo, mod, configurazioni, log e tutto il resto al suo interno) oltre la sua quota, come l'installazione di una mod o di un mondo o il caricamento di file, viene bloccata finché non viene liberato spazio o aumentata la quota, piuttosto che permettere a un server di riempire il tuo host.

Imposta la quota di un server nelle sue [impostazioni](/docs/servers/#server-settings). L'attivazione di **Ferma il Server Quando Supera la Quota** lì ferma anche un server in esecuzione una volta che la sua cartella supera del 10% la quota, e lo annota nella cronologia del server. I server moddati possono essere grandi, quindi concedi loro spazio. I [backup](/docs/backups/) sono memorizzati separatamente e non contano ai fini della quota.

## Pulizia

La scheda **Pulizia con un clic** libera spazio che il pannello può recuperare in sicurezza: file temporanei più vecchi di un'ora, file di libreria orfani e log archiviati e report di crash più vecchi di 30 giorni. Ciascuno mostra quanto libera e apre un'anteprima prima che venga eliminato qualcosa. Gli elenchi **Per categoria** e **File più grandi** rimandano direttamente al file manager, così puoi trovare cos'altro potare prima di esaurire lo spazio.

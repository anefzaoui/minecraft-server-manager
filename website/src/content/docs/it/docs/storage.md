---
title: 'Archiviazione'
description: 'La pagina Archiviazione mostra dove sta andando il tuo disco: utilizzo per server e come sta cambiando nel tempo.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Indice della documentazione](/docs/)

La pagina **Archiviazione** mostra dove sta andando il tuo disco: utilizzo per server e come sta evolvendo nel tempo.

![Archiviazione](/docs/images/storage.png)

## Le quote disco sono applicate dal pannello

Docker non può limitare l'utilizzo del disco di un bind mount, quindi lo fa il pannello. Un indicizzatore di dimensioni in background esamina la directory dei dati, memorizza nella cache l'impronta di ciascun server e applica la quota disco impostata per server. Quando i dati di un server (mondo + backup + tutto il resto) si avvicinano alla sua quota, il pannello arresta la crescita incontrollata anziché lasciare che un server riempia il tuo host.

Imposta la quota di un server nelle sue [impostazioni](/docs/servers/). I server moddati e i loro [backup](/docs/backups/) possono essere di grandi dimensioni, quindi concedi loro spazio.

## Pulizia

La vista Archiviazione ti aiuta a trovare cosa potare (vecchi backup, mondi inutilizzati o un server che è cresciuto ben oltre le aspettative) prima di esaurire lo spazio.

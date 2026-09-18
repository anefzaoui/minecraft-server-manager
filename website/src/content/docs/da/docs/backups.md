---
title: 'Sikkerhedskopier'
description: 'Sikkerhedskopier-siden viser alle snapshots på tværs af din flåde, med størrelse, årsag og alder.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Sikkerhedskopier**-siden viser alle snapshots på tværs af din flåde, med størrelse, årsag og alder.

![Sikkerhedskopier](/docs/images/backups.png)

## Oprettelse af en sikkerhedskopi

Fra en servers **Sikkerhedskopier**-fane (eller via en [plan](/docs/schedules/)) kan du tage et snapshot af hele servermappen med et enkelt klik. Panelet beroliger verdenen først (`save-off` → `save-all`), zippper dataene, og genaktiverer derefter lagring (`save-on`), så sikkerhedskopier er konsistente, selv på en kørende server. Komprimering kører i en baggrundstråd, så den ikke blokerer panelet. Hver sikkerhedskopi kan have en note.

Hvert arkiv er **integritetskontrolleret**, i det øjeblik det skrives: panelet genåbner zip-filen og læser dens mappe. Et beskadiget eller ulæseligt arkiv slettes, og sikkerhedskopieringskaldet fejler med det samme, i stedet for at problemet dukker op måneder senere, når en gendannelse er det eneste, der står mellem dig og datatab. Et arkiv med nul poster (en server, der aldrig er startet) er tilladt, men markeres i begivenheden.

Marker **"Formindsk også verdenen bagefter"** (på Sikkerhedskopier-fanen eller i en sikkerhedskopiplan) for at fjerne sjældent besøgte chunks, når arkivet er sikkert skrevet (se **[Formindskelse af en verden](/docs/world-shrink/)**). Formindskelsen kører kun, mens serveren er stoppet; på en kørende server sker sikkerhedskopieringen stadig, og formindskelsen springes over.

![Server sikkerhedskopier](/docs/images/server-backups.png)

## Årsager til sikkerhedskopiering

Sikkerhedskopier tagges efter, hvorfor de blev taget:

- **manuel** - du klikkede på knappen.
- **planlagt** - oprettet af en [plan](/docs/schedules/). Hver ny server får også automatisk en daglig planlagt sikkerhedskopi (fordelt mellem 02:00 og 05:59), så en server har automatisk dækning fra dag ét, ikke kun før opdateringer.
- **før-opdatering** - taget automatisk før en pakkeopgradering, så en opgradering altid kan fortrydes.
- **før-gendannelse** - taget automatisk lige før en gendannelse eller en nulstilling af verdenen, som et sikkerhedsnet, hvis gendannelsen ikke var, hvad du ønskede.

## Opbevaring

Opbevaring er begrænset **pr. server, pr. årsag**: de nyeste i hver gruppe beholdes, ældre fjernes automatisk efter hver succesfuld sikkerhedskopi:

| Årsag           | Beholdes |
| --------------- | -------- |
| planlagt        | 10       |
| før-opdatering  | 10       |
| manuel          | 20       |
| før-gendannelse | 5        |

`før-gendannelse` har sin egen lille pulje, netop for at en automatisk sikkerhedskopi aldrig kan fjerne en `manuel` sikkerhedskopi, du bevidst har gemt.

To valgfrie lofter gælder oven på antal pr. årsag, begge slået fra som standard: en **maksimal alder** (sikkerhedskopier ældre end N dage fjernes, uanset årsag) og en **maksimal samlet størrelse** pr. server (de ældste sikkerhedskopier fjernes, indtil den samlede størrelse passer, `før-gendannelse`-sikkerhedskopier først). Den nyeste sikkerhedskopi af en server fjernes aldrig af nogen af disse lofter. Alle disse kan ændres globalt på Indstillinger-siden og tilsidesættes pr. server på dens Sikkerhedskopier-fane.

Sikkerhedskopier kan **omdøbes** fra listen over sikkerhedskopier (omdøbningsknappen på hver række). Arkivet på disken og panelets registrering flyttes sammen, så download, gendannelse og opbevaring fortsætter med at fungere med det nye navn.

![Omdøb en sikkerhedskopi](/docs/images/backup-rename.png)

> Opbevaring er automatisk begrænset, men store moddede arkiver tæller stadig med i en servers [disk-kvote](/docs/storage/), så hold øje med den samlede størrelse for store pakker.

## Gendannelse

Gendannelse af en sikkerhedskopi stopper serveren (verificerer, at containeren virkelig stoppede, før der røres ved nogen filer), tager en `før-gendannelse` sikkerhedskopi, erstatter **hele servermappen** med snapshotet og lader den være stoppet, så du kan starte den igen. Fordi pakkeopgraderinger altid tager en `før-opdatering` sikkerhedskopi først, kan du altid rulle en dårlig opgradering tilbage.

## Panelets egen database

Server-sikkerhedskopier dækker kun per-server verdensmapper. Panelets egen database (`panel.db`, der indeholder brugere, roller, 2FA-hemmeligheder, planer, pakke-pins og historik) tages et snapshot af separat under den daglige vedligeholdelsestimer:

- `VACUUM INTO` skriver en konsistent, defragmenteret kopi til `data/backups/_panel/`; de nyeste **14** beholdes.
- Ved opstart kører panelet `PRAGMA integrity_check` og logger højlydt, hvis den fejler, og peger dig mod `data/backups/_panel` for den nyeste gode kopi.

Tag en sikkerhedskopi af hele `data/`-træet (den indeholder også `.secret-key`, krypteringsnøglen i hvile), og du har taget en sikkerhedskopi af alt.

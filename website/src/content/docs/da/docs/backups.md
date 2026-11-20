---
title: 'Sikkerhedskopier'
description: 'Sikkerhedskopier-siden viser alle snapshots på tværs af din flåde, med størrelse, årsag og alder, filtrerbar efter server og årsag.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Sikkerhedskopier**-siden viser alle snapshots på tværs af din flåde, med størrelse, årsag og alder, filtrerbar efter server og årsag.

![Sikkerhedskopier](/docs/images/backups.png)

## Oprettelse af en sikkerhedskopi

Fra en servers **Sikkerhedskopier**-fane (eller via en [plan](/docs/schedules/)) kan du tage et snapshot af hele servermappen med et enkelt klik. Panelet beroliger først verdenen (`save-off` → `save-all`), zippes dataene, og genaktiverer derefter lagring (`save-on`), så sikkerhedskopier er konsistente, selv på en kørende server. Komprimering kører i en baggrundstråd, så den ikke blokerer panelet. En sikkerhedskopi startet via API'en kan indeholde en note.

Hvert arkiv **integritetskontrolleres** i det øjeblik, det skrives: panelet genåbner zip-filen og læser dens indhold. Et beskadiget eller ulæseligt arkiv slettes, og sikkerhedskopieringskaldet fejler øjeblikkeligt, i stedet for at problemet dukker op måneder senere, når en gendannelse er det eneste, der står mellem dig og datatab. Et arkiv med nul poster (en server, der aldrig er startet) er tilladt, men markeres i begivenheden.

Marker **"Formindsk også verdenen bagefter"** (på Sikkerhedskopier-fanen eller i en sikkerhedskopieringsplan) for at fjerne sjældent besøgte bidder, når arkivet er sikkert skrevet (se **[Formindskelse af en verden](/docs/world-shrink/)**). Formindskelsen kører kun, mens serveren er stoppet; på en kørende server sker sikkerhedskopieringen stadig, og formindskelsen springes over.

![Server sikkerhedskopier](/docs/images/server-backups.png)

## Årsager til sikkerhedskopiering

Sikkerhedskopier tagges efter, hvorfor de blev taget:

- **manuel**: du klikkede på **Sikkerhedskopier nu**. Udskiftning af en servers aktive verden med en fra biblioteket tager også først en `manuel` sikkerhedskopi.
- **planlagt**: oprettet af en [plan](/docs/schedules/). Hver ny server får også automatisk en daglig planlagt sikkerhedskopi (fordelt mellem 02:00 og 05:59), så en server har automatisk dækning fra dag ét, ikke kun før opdateringer.
- **før-opdatering**: taget automatisk før en pakkeopgradering eller en Minecraft-versionsændring, så en opgradering altid kan rulles tilbage.
- **før-gendannelse**: taget automatisk lige før en gendannelse eller en nulstilling af verdenen, som et sikkerhedsnet, hvis gendannelsen ikke er, hvad du ønskede.

## Opbevaring

Opbevaring er begrænset **pr. server, pr. årsag**: de nyeste i hver gruppe beholdes, ældre fjernes automatisk efter hver succesfuld sikkerhedskopi:

| Årsag           | Beholdes som standard |
| --------------- | --------------------- |
| planlagt        | 10                    |
| før-opdatering  | 10                    |
| manuel          | 20                    |
| før-gendannelse | 5                     |

`før-gendannelse` (kaldet sikkerhedskopier i panelet) har sin egen lille pulje netop for at en automatisk sikkerhedskopi aldrig kan fjerne en `manuel` sikkerhedskopi, du bevidst har beholdt.

To valgfrie lofter gælder oven på antallet pr. årsag, begge slået fra som standard: en **maksimal alder** (sikkerhedskopier ældre end N dage fjernes, uanset årsag) og en **maksimal samlet størrelse** pr. server (de ældste fjernes, indtil den samlede størrelse passer: sikkerhedskopier først, derefter planlagte, derefter resten). Den nyeste sikkerhedskopi af en server fjernes aldrig af et af disse lofter.

### Ændring af det

Administratorer indstiller panelets politik i **Sikkerhedskopi Opbevaring**-kortet på **Indstillinger**-siden (**Udfyld Indbyggede** indsætter standarderne ovenfor tilbage i formularen, klar til at gemme). En server kan afvige på et af de seks værdier: åbn dens **Sikkerhedskopier**-fane og udvid **Opbevaring for Denne Server**. Hvert felt der er tomt, medmindre den server indstiller det, og et tomt felt følger panelets værdi (vist indeni). Så en server kan f.eks. beholde 3 planlagte sikkerhedskopier og bruge panelets værdier for alt andet; at rydde et felt sætter det tilbage til panelets værdi.

![Indstillingskortet for Sikkerhedskopi Opbevaring i Indstillinger](/docs/images/settings-retention.png)

![Opbevaring for Denne Server på en servers Sikkerhedskopier-fane](/docs/images/server-retention.png)

Gemning sletter aldrig noget af sig selv. Hvis de nye grænser ville efterlade eksisterende sikkerhedskopier over grænsen, lister panelet, pr. server, hvor mange sikkerhedskopier af hver type ville gå tabt, hvor meget plads det frigør, og hvor gammel den ældste er. Det angiver også, hvornår en server allerede var over sine grænser før denne ændring (f.eks. efter en tidligere **Fra Næste Sikkerhedskopi**), da anvendelse nu trimmer alt over grænsen, ikke kun hvad denne redigering tilføjer. Derefter spørger den, hvordan de skal anvendes:

- **Fjern Nu** sletter præcis de sikkerhedskopier, den lige har listet, intet mere: en sikkerhedskopi lavet imellemtiden venter på næste trimning. Fra Indstillinger-siden springes en server midt i en gendannelse, sikkerhedskopi eller lignende handling over og trimmes efter dens næste sikkerhedskopi; på en servers egen Sikkerhedskopier-fane bliver du bedt om at prøve igen, når den handling er afsluttet. Mens en servers gamle sikkerhedskopier slettes (normalt sekunder), skal andre handlinger på den server vente: en planlagt sikkerhedskopi eller start, der lander der, prøver igen hvert minut, indtil den kan (op til 30 minutter), en nedstyrtet server genstartes inden for ca. 20 sekunder efter afslutning (op til 30 minutter), og en planlagt genstart eller stop, der kolliderer med den, springes over indtil dens næste tidspunkt.
- **Fra Næste Sikkerhedskopi** beholder dem indtil videre; hver server trimmer sine sikkerhedskopier næste gang, den laver en, som den altid har gjort.

![Dialogen, der viser, hvad nye grænser ville fjerne](/docs/images/retention-preview.png)

En sikkerhedskopi, der gendannes, fjernes aldrig, mens gendannelsen kører: opbevaring lader den være i fred (og sletter ikke andre sikkerhedskopier for at give plads til den), og manuel sletning nægtes, indtil gendannelsen er afsluttet.

De samme indstillinger er tilgængelige for scripts som admin API-endepunkter: `GET`/`POST /api/backups/retention` og `/api/servers/:id/backups/retention`. Panelets værdier kan ikke være `null`. For en server fjerner en værdi af `null` (eller `""`) den ene nøgle, så den følger panelets værdi igen, og `{ "reset": true }` fjerner dem alle. Under hver af disse to stier rapporterer `POST …/preview`, hvad en ændring ville fjerne uden at fjerne den (`backups`, `bytes`, `servers`, `ids` og en opdeling pr. server `byServer`), og `POST …/apply` anvender den gemte politik nu og svarer `{ deleted, skipped }` panel-vidt (`skipped` tæller travle servere) eller `{ deleted }` for én server. Send previewets `{ "token": "..." }` (gemt i 10 minutter) eller dets `{ "ids": [...] }` for kun at slette disse; uden nogen af dem fjernes alt over grænsen. En anvendelse pr. server på en travl server svarer 409.

Sikkerhedskopier kan **omdøbes** fra sikkerhedskopilisten (omdøbningsknappen på hver række). Arkivet på disken og panelets registrering flyttes sammen, så download, gendannelse og opbevaring fortsætter med at fungere med det nye navn.

![Omdøb en sikkerhedskopi](/docs/images/backup-rename.png)

> Opbevaring er automatisk begrænset, men store moddede arkiver tæller stadig med i en servers [disk kvote](/docs/storage/), så hold øje med det samlede for store pakker.

## Gendannelse

Gendannelse af en sikkerhedskopi stopper serveren (verificerer, at containeren virkelig stoppede, før der røres ved nogen filer), tager en `før-gendannelse` sikkerhedskopi, erstatter **hele servermappen** med snapshotet og lader den være stoppet, så du kan starte den igen. Arkivet pakkes først ud til siden og byttes ind, så snart det er fuldt udpakket, så en gendannelse, der fejler undervejs, efterlader de aktuelle filer urørte. Fordi pakkeopgraderinger altid tager en `før-opdatering` sikkerhedskopi først, kan du altid rulle en dårlig opgradering tilbage.

## Panelets egen database

Server sikkerhedskopier dækker kun hver servers egen mappe. Panelets egen database (`panel.db`, der indeholder brugere, roller, 2FA-hemmeligheder, planer, pakke-pins og historik) tages snapshot af separat på den daglige vedligeholdelsestimer:

- `VACUUM INTO` skriver en konsistent, defragmenteret kopi til `backups/_panel/` i datamappen; de nyeste **14** beholdes.
- Ved opstart kører panelet `PRAGMA integrity_check` og logger højt, hvis det fejler, og peger dig mod `backups/_panel` for den nyeste gode kopi.

Sikkerhedskopier hele datamappen (den indeholder også `.secret-key`, krypteringsnøglen i hvile) og du har sikkerhedskopieret alt.

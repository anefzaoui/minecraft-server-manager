---
title: 'Lagerplads'
description: 'Se, hvor diskpladsen bliver af, sæt en diskkvote for hver servermappe, og ryd op i det, du ikke længere har brug for.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Lagerplads**-siden viser, hvor din disk bliver brugt: forbrug efter kategori, hver server mod dens kvote, de største filer, og hvordan det samlede forbrug udvikler sig over de seneste scanninger. Den er kun for administratorer.

![Lagerplads](/docs/images/storage.png)

## Disk-kvoter håndhæves af panelet

Docker kan ikke begrænse diskforbruget for en bind mount, så panelet gør det. En baggrunds-størrelsesindekserer gennemgår data-mappen (hvert 15. minut, efter ændringer, eller når du trykker på **Scan igen nu**), cacher hver servers fodaftryk og håndhæver den disk-kvote, du indstiller pr. server. En handling, der ville tage en servers mappe (verden, mods, konfigurationer, logs og alt andet deri) over dens kvote, såsom at installere en mod eller en verden eller uploade filer, blokeres, indtil der frigøres plads, eller kvoten hæves, i stedet for at lade én server fylde din vært.

Indstil en servers kvote i dens [indstillinger](/docs/servers/#server-settings). Aktivering af **Stop serveren, når kvoten overskrides** der stopper også en kørende server, når dens mappe vokser mere end 10% over kvoten, og noterer det i serverens historik. Moddede servere kan være store, så giv dem plads. [Sikkerhedskopier](/docs/backups/) gemmes separat og tæller ikke med i kvoten.

## Oprydning

**Oprydning med ét klik**-kortet frigør plads, som panelet sikkert kan genindvinde: midlertidige filer ældre end en time, forældreløse biblioteksfiler og arkiverede logs og crash-rapporter ældre end 30 dage. Hver enkelt viser, hvor meget den frigør, og åbner en forhåndsvisning, før noget slettes. Listerne **Efter kategori** og **Største filer** linker direkte ind i filhåndteringen, så du kan finde ud af, hvad du ellers kan beskære, før du løber tør for plads.

---
title: 'Lagring'
description: 'Se hvor diskplassen blir av, sett en grense for diskbruk for hver servermappe, og rydd opp i det du ikke lenger trenger.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Tilbake til dokumentindeks](/docs/)

**Lagring**-siden viser hvor disken din går: bruk etter kategori, hver server mot sin kvote, de største filene, og hvordan total bruk utvikler seg over de siste skanningene. Den er kun for administratorer.

![Lagring](/docs/images/storage.png)

## Disk-kvoter håndheves av panelet

Docker kan ikke begrense diskbruken til et bind mount, så panelet gjør det. En bakgrunns-størrelsesindekserer går gjennom data-mappen (hvert 15. minutt, etter endringer, eller når du trykker **Skann på nytt nå**), cacher hver servers fotavtrykk, og håndhever disk-kvoten du setter per server. En handling som ville tatt en servers mappe (verden, mods, konfigurasjoner, logger og alt annet i den) over kvoten, som å installere en mod eller en verden eller laste opp filer, blir blokkert inntil plass frigjøres eller kvoten økes, i stedet for å la én server fylle verten din.

Sett en servers kvote i dens [innstillinger](/docs/servers/#server-settings). Å slå på **Stopp serveren ved overskredet kvote** der stopper også en kjørende server når mappen vokser mer enn 10 % over kvoten, og noterer det i serverens historikk. Moddede servere kan være store, så gi dem rom. [Sikkerhetskopier](/docs/backups/) lagres separat og teller ikke mot kvoten.

## Opprydding

**Ett-klikks opprydding**-kortet frigjør plass som panelet trygt kan gjenvinne: midlertidige filer eldre enn en time, foreldreløse bibliotekfiler, og arkiverte logger og krasjrapporter eldre enn 30 dager. Hver av dem viser hvor mye den frigjør og åpner en forhåndsvisning før noe slettes. **Etter kategori** og **Største filer**-listene lenker rett inn i filbehandleren, slik at du kan finne hva annet du kan fjerne før du går tom for plass.

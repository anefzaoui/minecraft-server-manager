---
title: 'Lagring'
description: 'Lagringssiden viser hvor plassen din går: forbruk per server og hvordan det utvikler seg over tid.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Tilbake til dokumentindeks](/docs/)

**Lagring**-siden viser hvor disken din går: bruk per server og hvordan den utvikler seg over tid.

![Lagring](/docs/images/storage.png)

## Disk-kvoter håndheves av panelet

Docker kan ikke begrense diskbruken til et bind mount, så panelet gjør det. En bakgrunns-størrelsesindekserer går gjennom datakatalogen, cacher hver servers fotavtrykk, og håndhever disk-kvoten du setter per server. Når en servers data (verden + sikkerhetskopier + alt annet) nærmer seg kvoten sin, stopper panelet ukontrollert vekst i stedet for å la én server fylle opp verten din.

Sett en servers kvote i dens [innstillinger](/docs/servers/). Modifiserte servere og deres [sikkerhetskopier](/docs/backups/) kan være store, så gi dem rom.

## Opprydding

Lagrings-visningen hjelper deg med å finne hva du skal beskjære (gamle sikkerhetskopier, ubrukte verdener, eller en server som har vokst langt utover forventningene) før du går tom for plass.

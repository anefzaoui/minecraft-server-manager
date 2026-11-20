---
title: 'Live kort'
description: 'Tænd et live 3D-kort af serverens verden med BlueMap med et enkelt klik, serveret udelukkende gennem panelets login.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Tilbage til dokumentindeks](/docs/)

En servers faneblad **Verden → Kort** viser et live, zoombart 3D-kort over dens verden, tegnet af [BlueMap](https://bluemap.bluecolored.de/) (gratis og open source), med spillerpositioner og alle dimensioner. Panelet installerer det, konfigurerer det og hoster det; du behøver aldrig at åbne en port eller redigere en konfigurationsfil for det.

## Aktivering

1. Åbn serveren, derefter **Verden → Kort**.
2. Tryk på **Aktivér live-kort**. Panelet installerer den BlueMap-version, der matcher serverens loader og Minecraft-version fra Modrinth, accepterer BlueMaps download af ressourcer for dig og vælger en gratis port til det.
3. Genstart serveren (ændringen træder i kraft ved næste start, og serveren markeres som ventende på en genstart).

BlueMap renderes i baggrunden, så et nyt kort tager et par minutter at tegne sine første fliser. Indtil da siger fanen, at kortet ikke er klar endnu, og tjekker igen af sig selv. Når det er klar, åbner **Fuldskærm** kortet i sin egen browserfane.

Det virker på servere med en mod loader (Fabric, Quilt, Forge, NeoForge) og på plugin-servere (Paper, Purpur og resten af Paper-familien, Spigot), inklusive modpack-servere. Vanilla-servere har ingen BlueMap-build, og fanen angiver dette.

## Hvem kan se det

Kortet hostes kun via panelet, bag dets login: alle, der kan se serveren i panelet, kan åbne dens kort, og ingen andre. BlueMaps egen port er aldrig beregnet til at være åben mod internettet ([porte i et overblik](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Aktivering eller deaktivering af kortet kræver serverens **Indstillinger**-tilladelse ([brugere & roller](/docs/users-and-roles/#per-server-permissions)).

Når panelet selv kører i Docker, når det BlueMap inde i serverens container; [README](https://github.com/anefzaoui/minecraft-server-manager#installation) forklarer detaljerne for reverse-proxy-opsætninger.

## Deaktivering

**Deaktivér kort** fjerner den BlueMap jar-fil, som panelet installerede, og frigør dens port, igen fra næste genstart. Selve verdenen er uberørt; renderede kortfliser forbliver i serverens mappe, indtil du sletter dem på **Filer**-fanen.

Relateret: [verdener & filer](/docs/worlds-and-files/), [invitationer & status-side](/docs/invites-and-status-page/).

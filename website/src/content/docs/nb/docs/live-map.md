---
title: 'Live kart'
description: 'Slå på et live 3D-kart av serverens verden med ett klikk via BlueMap, servert kun gjennom panelets innlogging.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Tilbake til dokumentindeks](/docs/)

En servers fane **Verden → Kart** viser et levende, zoombart 3D-kart over verdenen, tegnet av [BlueMap](https://bluemap.bluecolored.de/) (gratis og åpen kildekode), med spillerposisjoner og alle dimensjoner. Panelet installerer det, konfigurerer det og serverer det; du trenger aldri å åpne en port eller redigere en konfigurasjonsfil for det.

## Aktivering

1. Åpne serveren, deretter **Verden → Kart**.
2. Trykk **Aktiver levende kart**. Panelet installerer BlueMap-versjonen som samsvarer med serverens lastelaster og Minecraft-versjon fra Modrinth, godtar BlueMaps nedlasting av ressurser for deg, og velger en ledig port for det.
3. Start serveren på nytt (endringen gjelder ved neste oppstart, og serveren markeres som venter på en slik).

BlueMap gjengir i bakgrunnen, så et nytt kart tar noen minutter å tegne sine første fliser. Inntil da sier fanen at kartet ikke er klart ennå og sjekker igjen av seg selv. Når det er klart, åpner **Fullskjerm** kartet i en egen nettleserfane.

Det fungerer på servere med en mod-laster (Fabric, Quilt, Forge, NeoForge) og på plugin-servere (Paper, Purpur og resten av Paper-familien, Spigot), inkludert modpack-servere. Vanilla-servere har ingen BlueMap-versjon, og fanen sier det.

## Hvem kan se det

Kartet serveres kun gjennom panelet, bak innloggingen: alle som kan se serveren i panelet kan åpne kartet, og ingen andre. BlueMaps egen port er aldri ment å være åpen mot internett ([porter i et øyeblikk](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Aktivering eller deaktivering av kartet krever serverens **Innstillinger**-tillatelse ([brukere og roller](/docs/users-and-roles/#per-server-permissions)).

Når panelet selv kjører i Docker, når det BlueMap inne i serverens container; [README](https://github.com/anefzaoui/minecraft-server-manager#installation) forklarer detaljene for reverse-proxy-oppsett.

## Deaktivering

**Deaktiver kart** fjerner BlueMap-jar-filen panelet installerte og frigjør porten, igjen fra neste omstart. Selve verdenen er urørt; gjengitte kartfliser forblir i serverens mappe til du sletter dem på **Filer**-fanen.

Relatert: [verdener og filer](/docs/worlds-and-files/), [invitasjoner og statusside](/docs/invites-and-status-page/).

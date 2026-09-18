---
title: 'Dashboardet'
description: 'Dashboardet er din base: hver server, dens live-status og et løbende feed af, hvad der er sket.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Tilbage til dokumentindeks](/docs/)

Dashboardet er din hjemmebase: hver server, dens live-status og et løbende feed af, hvad der er sket.

![Dashboard](/docs/images/dashboard.png)

## Oversigtsoverskrifterne

På tværs af toppen:

- **Servere online** - hvor mange af dine servere der kører i øjeblikket.
- **Spillere forbundet** - det samlede antal spillere på tværs af alle kørende servere.
- **Opdateringer tilgængelige** - hvor mange servere, pakker eller mods der har en nyere version ([se Opdateringer](/docs/updates/)).
- **Docker** - om panelet kan nå Docker-daemonen, og dens version.

## Serverkort

Hver server vises som et kort med dens status (Kører, Starter, Stoppet, Krasjet), typen og Minecraft-versionen samt dens spilport. For kørende servere får du også live **spillere**, **CPU**, **hukommelse** og **disk** forbrug, der opdateres løbende.

Klik på et kort for at åbne den pågældende server. Det tomme **Opret en server**-kort og knappen **Opret en server** i topbjælken starter begge [oprettelsesguiden](/docs/servers/).

Du kan søge og sortere dine servere og skifte mellem gitter- og listevisninger med kontakten til højre.

## Seneste aktivitet

Feedet nederst er en live, menneskelæselig revisionslog: logins, backups, blueprint-eksport, opdateringskontroller, chat-kommandoændringer, serverstarter og -stop og meget mere. Hver post er tagget med den server, den tilhører (eller selve panelet), og hvor længe siden det skete. Den fulde historik findes på siden [Aktivitet](/docs/activity/).

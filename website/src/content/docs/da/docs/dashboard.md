---
title: 'Dashboardet'
description: 'Dashboardet er din base: hver server, dens live-status og et løbende feed af, hvad der er sket.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Tilbage til dokumentindeks](/docs/)

Dashboardet er din hjemmebase: hver server, dens live-status og et løbende feed af, hvad der er sket.

![Dashboard](/docs/images/dashboard.png)

## Oversigtsoversigterne

Øverst:

- **Servere online**: hvor mange af dine servere der kører i øjeblikket, ud af det samlede antal.
- **Spillere forbundet**: det samlede antal spillere på tværs af alle kørende servere.
- **Opdateringer tilgængelige**: hvor mange servere, pakker eller mods der har en nyere version ([se Opdateringer](/docs/updates/)).
- **Docker**: om panelet kan nå Docker-daemonen, og dens version.

En anden række tilføjer **Tildelt hukommelse** (og hvor meget der er i brug), **Brugt lagerplads** på tværs af alle serverdatamapper, **Sundhed · 24t** (nedbrud, stop pga. manglende hukommelse og automatiske genstarter i løbet af den sidste dag) og **Opdateringer** opdelt i mods og server-niveau opdateringer. Under dem tæller **Servere efter status** dine servere i hver tilstand, og **Ressourceoversigten** viser hver servers andel af hukommelse og CPU.

## Serverkort

Hver server vises som et kort med dens status (Kører, Starter, Stoppet, Nedbrudt og mellemliggende tilstande som U-sund eller Stoppet), typen og Minecraft-versionen, dens spilport og dens tags. Hvert kort viser **spillere** og **disk** brug mod kvoten; kørende servere viser også live **CPU** og **hukommelse**, opdateret løbende.

Klik på et kort for at åbne den pågældende server. Det tomme **Opret en server**-kort og knappen **Opret en server** øverst på siden starter begge [oprettelsesguiden](/docs/servers/).

Du kan søge efter dine servere (efter navn, type, version eller tag), sortere dem efter status, navn, størrelse, sidst startet eller oprettet, og skifte mellem gitter- og listevisninger med kontakten til højre.

## Seneste aktivitet

Feedet nederst viser de seneste poster fra panelets menneskelæsbare revisionsspor: logins, sikkerhedskopier, eksport af blueprints, opdateringskontroller, ændringer i chatkommandoer, serverstarter og -stop, og mere. Hver post er tagget med den server, den tilhører (eller selve panelet), og hvor længe siden det skete. **Vis alle** åbner hele historikken på siden [Aktivitet](/docs/activity/).

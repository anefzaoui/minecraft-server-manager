---
title: 'Kontrollpanelet'
description: 'Kontrollpanelet er din base: hver server, dens live status og en løpende strøm av hva som har skjedd.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Tilbake til dokumentindeks](/docs/)

Dashbordet er hjemmebasen din: hver server, dens live status, og en kontinuerlig strøm av hva som har skjedd.

![Dashboard](/docs/images/dashboard.png)

## Sammendragsfliser

Øverst:

- **Servere online** - hvor mange av serverne dine som kjører for øyeblikket.
- **Spillere tilkoblet** - totalt antall spillere på tvers av alle kjørende servere.
- **Oppdateringer tilgjengelig** - hvor mange servere, pakker eller mods som har en nyere versjon ([se Oppdateringer](/docs/updates/)).
- **Docker** - om panelet kan nå Docker-demonen, og dens versjon.

## Serverkort

Hver server vises som et kort med status (Kjører, Starter, Stoppet, Krasjet), typen og Minecraft-versjonen, og spillporten. For kjørende servere får du også live **spillere**, **CPU**, **minne** og **disk**-bruk, oppdatert kontinuerlig.

Klikk på et kort for å åpne den serveren. Det tomme **Opprett en server**-kortet og **Opprett en Server**-knappen i topplinjen starter begge [opprettingsveiviseren](/docs/servers/).

Du kan søke og sortere serverne dine, og bytte mellom rutenett- og listevisninger med bryteren til høyre.

## Nylig aktivitet

Strømmen nederst er en live, menneskelesbar revisjonslogg: innlogginger, sikkerhetskopier, eksport av blåkopier, oppdateringssjekker, endringer i chatkommandoer, serverstarter og -stopp, og mer. Hvert element er merket med serveren det tilhører (eller selve panelet) og hvor lenge siden det skjedde. Hele historikken finnes på [Aktivitet](/docs/activity/)-siden.

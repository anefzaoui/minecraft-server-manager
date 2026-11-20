---
title: 'Kontrollpanelet'
description: 'Kontrollpanelet er din base: hver server, dens live status og en løpende strøm av hva som har skjedd.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Tilbake til dokumentindeks](/docs/)

Kontrollpanelet er din base: hver server, dens live-status, og en kontinuerlig strøm av hva som har skjedd.

![Kontrollpanel](/docs/images/dashboard.png)

## Sammendragsfliser

Øverst:

- **Servere online**: hvor mange av serverne dine som kjører for øyeblikket, av totalen.
- **Spillere tilkoblet**: totalt antall spillere på tvers av alle kjørende servere.
- **Oppdateringer tilgjengelig**: hvor mange servere, pakker eller mods som har en nyere versjon ([se Oppdateringer](/docs/updates/)).
- **Docker**: om panelet kan nå Docker-demonen, og dens versjon.

En andre rad legger til **Minne tildelt** (og hvor mye som er i bruk), **Lagring brukt** på tvers av alle serverdata-mapper, **Helse · 24t** (krasj, stopp grunnet minnemangel, og automatiske omstarter siste døgn), og **Oppdateringer** delt inn i mods og server-nivå oppdateringer. Under dem teller **Servere etter status** serverne dine i hver tilstand, og **Ressursoversikt** viser hver servers andel av minne og CPU.

## Serverkort

Hver server vises som et kort med sin status (Kjører, Starter, Stoppet, Krasjet, og mellomtilstander som Ufrisk eller Stanset), typen og Minecraft-versjonen, spillporten, og taggene. Hvert kort viser **spillere** og **disk** bruk mot kvoten; kjørende servere viser også live **CPU** og **minne**, oppdatert kontinuerlig.

Klikk på et kort for å åpne den serveren. Det tomme **Opprett en server**-kortet og **Opprett en server**-knappen øverst starter begge [opprettelsesveiviseren](/docs/servers/).

Du kan søke etter serverne dine (etter navn, type, versjon eller tag), sortere dem etter status, navn, størrelse, sist startet, eller opprettet, og bytte mellom rutenett- og listevisning med vekslebryteren til høyre.

## Nylig aktivitet

Strømmen nederst viser de nyeste oppføringene fra panelets menneskelesbare revisjonsspor: innlogginger, sikkerhetskopier, eksport av blåkopier, oppdateringssjekker, endringer i chat-kommandoer, serverstarter og -stopp, og mer. Hver oppføring er tagget med serveren den tilhører (eller panelet selv) og hvor lenge siden det skjedde. **Vis alle** åpner hele historikken på siden [Aktivitet](/docs/activity/).

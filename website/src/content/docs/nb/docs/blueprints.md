---
title: 'Blåkopier'
description: 'Blåkopier lagrer en Minecraft-servers hele konfigurasjon som en gjenbrukbar oppskrift for å lage nye servere. Hemmeligheter er aldri inkludert.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Tilbake til dokumentindeks](/docs/)

En **blueprint** fanger hele konfigurasjonen til en server (type, versjon, ressurser, miljø, pack pin, egendefinerte mods, og valgfritt konfigurasjon og verden) i én enkelt, bærbar `.mcserver.zip`-fil som du kan bruke til å lage nye servere. Hemmeligheter (passord, tokens og nøkler i miljøet) skrives aldri til en blueprint.

![Blueprints](/docs/images/blueprints.png)

## Eksportering

Fra serverens fane **Innstillinger → Konfigurasjon**, bruk **Eksporter som Blueprint** og velg hva som skal inkluderes: serverens konfigurasjon alltid, dens konfigurasjonsmapper (aktivert som standard), og valgfritt selve de egendefinerte mod-filene (en større fil som installeres uten å laste ned noe) og den aktive verdenen. Resultatet lagres i ditt blueprint-bibliotek og kan lastes ned for deling.

**Klon server**, på samme kort, utfører en eksport og en import i ett trinn for å lage en kopi av serveren, med eller uten dens verden.

## Importering og oppretting fra en blueprint

Importer en blueprint-fil (**Importer Blueprint** på **Blueprints**-siden) eller velg en fra biblioteket (**Opprett en server** på kortet, eller veiviserens fane **Fra Blueprint**) for å opprette en ny server som er forhåndskonfigurert nøyaktig som originalen. Den nye serveren får sine egne porter og et nytt RCON-passord. Egendefinerte mods som ikke var innebygd, lastes ned igjen og sjekkes mot hashene som blueprinten registrerte. Biblioteket starter også med to start-blueprints, én Paper og én Fabric.

Det er den raskeste måten å:

- Starte identiske servere (et nettverk av minispillservere, staging-kopier av produksjon).
- Flytte en server mellom paneler.
- Beholde en kjent, god mal du alltid kan falle tilbake på.

Fordi en blueprint registrerer den nøyaktige [pack pin](/docs/modpacks/), installerer en modpack-server opprettet fra en blueprint den samme pinned versjonen, uten overraskende oppgraderinger.

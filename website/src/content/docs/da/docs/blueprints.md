---
title: 'Blueprints'
description: 'Blueprints gemmer en Minecraft-servers komplette konfiguration som en genanvendelig opskrift til at oprette nye servere. Hemmeligheder er aldrig inkluderet.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Tilbage til dokumentindeks](/docs/)

En **blueprint** fanger en servers hele konfiguration (type, version, ressourcer, miljø, pack pin, brugerdefinerede mods og valgfrit dens konfiguration og verden) i en enkelt bærbar `.mcserver.zip`-fil, som du kan bruge til at oprette nye servere. Hemmeligheder (adgangskoder, tokens og nøgler i miljøet) skrives aldrig til en blueprint.

![Blueprints](/docs/images/blueprints.png)

## Eksport

Fra en servers fane **Indstillinger → Konfiguration** skal du bruge **Eksporter som Blueprint** og vælge, hvad der skal inkluderes: serverens konfiguration altid, dens konfigurationsmapper (slået til som standard) og valgfrit selve de brugerdefinerede modfiler (en større fil, der installeres uden at downloade noget) og den aktive verden. Resultatet gemmes i dit blueprint-bibliotek og kan downloades for at dele.

**Klon Server**, på samme kort, udfører en eksport og en import i ét trin for at lave en kopi af serveren, med eller uden dens verden.

## Import og oprettelse fra en blueprint

Importer en blueprint-fil (**Importér Blueprint** på siden **Blueprints**) eller vælg en fra biblioteket (**Opret en Server** på dens kort, eller guiden **Fra Blueprint**-fane) for at oprette en ny server, der er forudkonfigureret præcis som originalen. Den nye server får sine egne porte og en ny RCON-adgangskode. Brugerdefinerede mods, der ikke var indlejret, downloades igen og kontrolleres mod de hashes, som blueprinten registrerede. Biblioteket starter også med to start-blueprints, én Paper og én Fabric.

Det er den hurtigste måde at:

- Starte identiske servere (et netværk af minigameservere, staging-kopier af produktion).
- Flytte en server mellem paneler.
- Beholde en kendt-god skabelon, du altid kan falde tilbage på.

Fordi en blueprint registrerer den præcise [pack pin](/docs/modpacks/), installerer en modpack-server oprettet fra en blueprint den samme fastgjorte version, uden overraskende opgraderinger.

---
title: 'Updates'
description: 'De pagina Updates toont in één oogopslag wat er verouderd is binnen uw vloot:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Updates** houdt bij wat er verouderd is op al uw servers, op één plek:

- **Modpack**-versies ([modpacks](/docs/modpacks/)) vergeleken met Modrinth / CurseForge / de GTNH release-index.
- **Aangepaste inhoud** die u zelf hebt toegevoegd - mods, datapacks, resourcepacks, plugins - elk vergeleken met de bron: Modrinth, CurseForge, Hangar, SpigotMC (Spiget), of GitHub Releases. GitHub-opvragingen gebruiken ETag-hervalidatie, dus dagelijkse controles raken de rate limit nauwelijks.
- **Docker image**-veroudering: de image-ID van elke draaiende container vergeleken met een vers gedownloade tag (gedupliceerd over servers met dezelfde tag), aangeboden als een upgrade die alleen opnieuw aangemaakt hoeft te worden.
- **Standalone versie-vastpinnen**: voor een server zonder beheerd pack, een expliciete `mc_version`-pin vergeleken met Mojangs manifest, en een expliciete loader-build omgevingsvariabele (`PAPER_BUILD`, `FORGE_VERSION`, en dergelijke) vergeleken met het register van de loader. Paper-builds komen van PaperMC's huidige **Fill v3 API** (het legacy v2-eindpunt ontvangt geen nieuwe Minecraft-versies meer).

![Updates](/docs/images/updates.png)

## Hoe het werkt

Het paneel controleert de vastgezette versies van elke server tegen de upstream bron en toont alles met een nieuwere release. Een overeenkomstig aantal verschijnt ook op de tegel "Updates beschikbaar" op het [dashboard](/docs/dashboard/).

Controles worden op aanvraag uitgevoerd en kunnen worden gepland ([Schedules](/docs/schedules/)). De update **policy** is per server: u bepaalt of het paneel u alleen informeert, of dat alles handmatig blijft.

## Een update toepassen

Updates zijn nooit stil. Wanneer u ervoor kiest om een pack te upgraden, doet het paneel het volgende:

1. Maakt een **back-up vóór de update** (zodat deze omkeerbaar is; de laatste 10 back-ups vóór de update per server worden bewaard).
2. Pint de exacte nieuwe versie opnieuw vast.
3. Maakt de container opnieuw aan, waarbij de Java-runtime indien nodig opnieuw wordt opgelost.
4. Monitort de eerste opstart, met een tijdslimiet per platform.

Als deze niet gezond opstart, wordt teruggerold naar de back-up vóór de update. Een server die stabiel volgt, krijgt nooit een bèta aangeboden, en de link naar het changelog wijst naar de echte per-versie diff waar de bron deze aanbiedt. Een mislukte update activeert ook een Discord [melding](/docs/integrations/) als de integratie is geconfigureerd.

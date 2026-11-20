---
title: 'Blueprints'
description: 'Blueprints slaan de volledige configuratie van een Minecraft-server op als een herbruikbaar recept voor het maken van nieuwe servers. Geheimen worden nooit opgenomen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Terug naar de documentatie-index](/docs/)

Een **blueprint** legt de volledige configuratie van een server vast (type, versie, bronnen, omgeving, pack pin, aangepaste mods, en optioneel de configuratie en wereld) in één draagbaar `.mcserver.zip`-bestand waaruit je nieuwe servers kunt maken. Geheimen (wachtwoorden, tokens en sleutels in de omgeving) worden nooit naar een blueprint geschreven.

![Blueprints](/docs/images/blueprints.png)

## Exporteren

Vanuit het tabblad **Instellingen → Configuratie** van een server, gebruik **Exporteren als Blueprint** en kies wat je wilt opnemen: altijd de serverconfiguratie, de configuratiemappen (standaard ingeschakeld), en optioneel de aangepaste mod-bestanden zelf (een groter bestand dat installeert zonder iets te downloaden) en de actieve wereld. Het resultaat wordt opgeslagen in je blueprintbibliotheek en kan worden gedownload om te delen.

**Server klonen**, op dezelfde kaart, doet een export en een import in één stap om een kopie van de server te maken, met of zonder de wereld.

## Importeren en creëren vanuit een blueprint

Importeer een blueprintbestand (**Blueprint importeren** op de pagina **Blueprints**) of kies er een uit de bibliotheek (**Server creëren** op de kaart ervan, of het tabblad **Vanuit Blueprint** in de wizard) om een nieuwe server te creëren die exact is voorgeconfigureerd zoals het origineel. De nieuwe server krijgt zijn eigen poorten en een nieuw RCON-wachtwoord. Aangepaste mods die niet waren ingebed, worden opnieuw gedownload en gecontroleerd tegen de hashes die de blueprint heeft vastgelegd. De bibliotheek begint ook met twee starter-blueprints, één Paper en één Fabric.

Het is de snelste manier om:

- Identieke servers op te zetten (een netwerk van minigame-servers, staging-kopieën van productie).
- Een server te verplaatsen tussen panels.
- Een bekende, goede sjabloon te bewaren waar je altijd op terug kunt vallen.

Omdat een blueprint de exacte [pack pin](/docs/modpacks/) vastlegt, installeert een modpack-server die is gemaakt van een blueprint dezelfde vastgepinde versie, zonder verrassende upgrades.

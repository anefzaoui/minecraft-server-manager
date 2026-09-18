---
title: 'Servers maken en beheren'
description: 'Klik op "Create a Server" (bovenbalk) of de kaart "Create a server" om de wizard te openen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Terug naar de documentatie-index](/docs/)

## Een server aanmaken

Klik op **Create a Server** (bovenin de balk) of de **Create a server** kaart om de wizard te openen.

![Create a server](/docs/images/create-wizard.png)

De wizard vult de velden voor geheugen, CPU en schijfquotum voor met de **Defaults for new servers** op de Instellingen-pagina, die een beheerder op elk moment kan wijzigen.

![Defaults for new servers](/docs/images/settings-defaults.png)

Je kiest:

- Een **naam** (en optioneel een icoon, accentkleur en tags om je vloot te organiseren).
- Een **servertype** - vanilla, Paper, Fabric, Forge, NeoForge, en meer, elk gekoppeld aan de juiste itzg-image achter de schermen.
- Een **Minecraft-versie** - `LATEST`, een snapshot, of een specifieke versie.
- **Resources** - RAM (heap), containergeheugenlimiet, CPU en een schijfquotum.

Liever een modpack? Het tabblad **From modpack** installeert in plaats daarvan een CurseForge-, Modrinth-, FTB- of GT New Horizons-pack (zie [Modpacks](/docs/modpacks/)), of neemt een **aangepaste zip die je uploadt**: een CurseForge modpack-export (`manifest.json`) of een willekeurige zip met mod-jars. Het manifest (of een meerderheidsstemming over de geïdentificeerde jars) vult de loader en Minecraft-versie in, en elke mod wordt in één taak geïnstalleerd. Je kunt ook beginnen met een opgeslagen [Blueprint](/docs/blueprints/).

Het paneel kiest automatisch een verstandige Java-runtime voor je versie, haalt de image op, maakt de container aan en start deze (optioneel), allemaal vanuit hetzelfde formulier.

## De serverlijst

De **Servers**-pagina toont je volledige vloot met status en snelle statistieken.

![Servers list](/docs/images/servers-list.png)

## Een enkele server

![Players](/docs/images/players.png)

Het openen van een server geeft je een werkruimte met tabbladen:

- **Overview** - status, live statistieken, uptime en de primaire start/stop/herstart-bedieningselementen.
- **Console** - de live logstream en commando-invoer, plus in-game chat ([details](/docs/console-and-chat/)).
- **Players** - wie er online is, plus inventaris, statistieken en [chatcommando's](/docs/console-and-chat/).
- **Mods** - de geïnstalleerde modlijst, de [mod browser](/docs/modpacks/) en inhouds-updates.
- **World** - [werelden, de live kaart en de bestandsbeheerder](/docs/worlds-and-files/).
- **Backups** - [snapshots en herstel](/docs/backups/) voor deze server.
- **Monitoring** - per server geschiedenis en live metingen, inclusief crashrapporten (zie hieronder).
- **Settings** - alles over hoe de server draait, plus de [integraties](/docs/integrations/) (Discord, statuspagina, uitnodigingen, chatbot).

![Server overview](/docs/images/server-overview.png)

De **World Controls**-rail loopt mee op elk tabblad: de in-game klok, het weer, de veelvoorkomende gamerules als toggle-chips, en "Show all world rules" voor de rest.

![World controls](/docs/images/world-controls.png)

**Monitoring → Live** toont TPS en milliseconden per tick, een gezondheids- en stabiliteitskaart met de laatste 24 uur / 7 dagen aan crashes en herstarts, en per wereld groottes.

![Live monitoring](/docs/images/monitoring-live.png)

## Serverinstellingen

Het **Settings**-tabblad is het volledige configuratieoppervlak: hernoemen, resources, updatebeleid, automatisch starten/herstarten, omgevingsvariabelen en geavanceerde Docker-overrides. Velden die veranderen hoe de container draait, zijn duidelijk gemarkeerd als dat een herstart vereist.

![Server settings](/docs/images/server-settings.png)

**Over de geheugenmeter.** "RAM (Java heap)" wordt aan Java doorgegeven als zowel de start- als de maximale heap, en Java vult een heap die het vooraf kreeg binnen de eerste minuut, met of zonder de Aikar / MeowIce flag presets. Dus de geheugenmeter stabiliseert zich rond de heapgrootte en blijft daar, zelfs als niemand speelt; de tik op de meter markeert waar de heap zich bevindt onder de containerlimiet, en de notitie eronder zegt dat. Als je liever ziet dat het geheugen het werkelijke gebruik volgt, stel dan een kleinere **Initial heap** (geavanceerd) in: op een 2 GB heap bracht dat in onze metingen het idle gebruik van 2,6 GB naar ongeveer 1,3 GB. Java heeft ook geheugen nodig buiten de heap (ongeveer 0,5 GB bij vanilla, 1,5 tot 2 GB bij een grote modpack), waarvoor de marge van de containerlimiet bedoeld is. Zie de README's "Two memory limits" voor de cijfers.

> Geavanceerde Docker-overridevelden (aangepaste containernaam, extra poort en bind mounts, en ruwe overrides) zijn **alleen voor beheerders**, omdat een bind mount plus de Docker-toegang van het paneel effectief root op de host is. Zie [Users & roles](/docs/users-and-roles/).

## Crashrapporten & mclo.gs analyse

Crashrapporten (`crash-reports/*.txt` en JVM `hs_err_pid*.log` bestanden) worden automatisch opgepikt, geparsed tot een samenvatting van één regel met de uitzondering en vermoedelijke mods, en weergegeven onder **Monitoring → History**:

![Crash report card](/docs/images/crash-mclogs-card.png)

Elke rapportkaart biedt een ingebouwde viewer (met inklapbare secties en gemarkeerde uitzonderingen), copy-stack-trace, en download, plus twee [mclo.gs](https://mclo.gs) acties:

- **Share to mclo.gs** publiceert het rapport als een openbare paste en kopieert de link - precies wat mod-auteurs en support Discords vragen. De link wordt onthouden op het rapport, dus niets wordt ooit twee keer geüpload.
- **Analyze** voert mclo.gs's geautomatiseerde inzichten uit over de paste: bekende problemen met voorgestelde oplossingen (ontbrekende afhankelijkheden, versieconflicten, veelvoorkomende modconflicten), direct weergegeven in het paneel.

![mclo.gs insights](/docs/images/crash-insights.png)

Beide acties bevinden zich achter een expliciete bevestiging, omdat een paste openbaar is: crashrapporten kunnen spelersnamen en je volledige modlijst bevatten. Het paneel uploadt nooit zelf iets.

---
title: 'Servers maken en beheren'
description: 'Maak, start, stop, herbouw en configureer Minecraft servers in het paneel: de aanmaak-wizard, instellingen, geheugen en de gamepoort.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Terug naar de documentatie-index](/docs/)

## Een server aanmaken

Klik op **Create a Server** (bovenin de balk) of de **Create a Server**-kaart om de wizard te openen.

![Create a server](/docs/images/create-wizard.png)

De wizard vult de Java heap en schijfquotum vooraf in vanuit **Defaults for new servers** op de Instellingenpagina, die een beheerder op elk moment kan wijzigen. Een nieuwe server haalt ook zijn CPU-limiet daarvandaan.

![Defaults for new servers](/docs/images/settings-defaults.png)

Je kiest:

- Een **naam** (en een optionele beschrijving, icoon en accentkleur). Tags om je vloot te organiseren worden later toegevoegd, op de instellingen van de server.
- Een **servertype**: Vanilla, Paper, of Purpur op het tabblad **Vanilla**. Voor een modded server kiest het tabblad **From Mods** de loader (Fabric, Forge, NeoForge, of Quilt), de Minecraft-versie, en een loader-build (de nieuwste, of een specifieke), en laat je vervolgens zoeken naar mods.
- Een **Minecraft-versie**: `LATEST`, een snapshot, of een specifieke versie (inclusief beta's en alpha's).
- Een **gamepoort**: er wordt een gratis poort voorgesteld. De remote console (RCON) gebruikt standaard de poort 1000 hoger. Je kunt dit later wijzigen (zie [De gamepoort wijzigen](#changing-the-game-port)).
- **Resources**: de Java heap (het geheugenlimiet van de container wordt 50% hoger ingesteld) en een schijfquotum.

**Advanced Options** opent alle andere instellingen die de server-image ondersteunt, plus extra omgevingsvariabelen en (voor beheerders) de geavanceerde Docker-instellingen.

Liever een modpack? Het tabblad **From Modpack** installeert in plaats daarvan een CurseForge-, Modrinth-, of GT New Horizons-pack (zie [Modpacks](/docs/modpacks/)), of neemt een **aangepaste zip die je uploadt**: een Modrinth `.mrpack`, een CurseForge modpack-export (`manifest.json`), of elke zip met mod-jars. Het manifest (of een meerderheidsstem over de geïdentificeerde jars) vult de loader en Minecraft-versie in, en elke mod wordt in één taak geïnstalleerd. Je kunt ook beginnen met een opgeslagen [Blueprint](/docs/blueprints/) op het tabblad **From Blueprint**.

Het paneel kiest automatisch een verstandige Java runtime voor je versie, haalt de image binnen, maakt de container aan en start deze, allemaal vanuit één formulier.

## De serverlijst

De **Servers**-pagina toont je hele vloot met status en snelle statistieken.

![Servers list](/docs/images/servers-list.png)

## Een enkele server

![Players](/docs/images/players.png)

Het openen van een server geeft je een werkruimte met tabbladen:

- **Overview**: het adres om te delen met spelers, de beschrijving, live gebruik, en wie er online is.
- **Console**: de live logstream en commando-invoer, in-game chat, en [chat commando's](/docs/console-and-chat/).
- **Players**: de lijst met spelers, plus inventaris en statistieken.
- **Mods**: de lijst met geïnstalleerde mods, de [mod browser](/docs/modpacks/), en contentupdates. Op een modded server controleert het subtabblad **Versions** voor welke toekomstige Minecraft-versies je mods builds hebben ([updates](/docs/updates/#minecraft-version-compatibility)).
- **World**: [werelden, de live map, en de bestandsbeheerder](/docs/worlds-and-files/).
- **Backups**: [snapshots en herstel](/docs/backups/) voor deze server.
- **Monitoring**: per server geschiedenis en live metingen, inclusief crashrapporten (zie hieronder).
- **Settings**: **Configuration** (alles over hoe de server draait), plus de [integraties](/docs/integrations/) (Discord, Status Page, Invites, en, voor beheerders, Chatbot).

De start-, stop- en herstartknoppen bevinden zich in de header boven elk tabblad. Wat je op elk tabblad kunt doen, hangt af van je [machtigingen op die server](/docs/users-and-roles/#per-server-permissions): bijvoorbeeld, het subtabblad **Files** vereist de Files-machtiging, en het verzenden van consolecommando's vereist Console.

![Server overview](/docs/images/server-overview.png)

De **World Controls**-rail loopt mee op elk tabblad: de in-game klok, het weer, de veelvoorkomende gamerules als toggle chips, en "Show all world rules" voor de rest.

![World controls](/docs/images/world-controls.png)

**Monitoring → Live** toont TPS en milliseconden per tick, een gezondheids- en stabiliteitskaart met crashes (laatste 24 uur en 7 dagen), out-of-memory kills, en auto-herstarts, en groottes per wereld.

![Live monitoring](/docs/images/monitoring-live.png)

## Serverinstellingen

**Settings → Configuration** is het volledige configuratieoppervlak: naam, beschrijving, MOTD, icoon, kleur en tags, resources, de gamepoort, updatebeleid, starten bij paneelboot en automatisch herstarten bij crash, elke omgevingsvariabele die de server-image ondersteunt, de geavanceerde Docker-instellingen, en blueprint export, kloon, herbouw en verwijdering. Wijzigingen die pas effect hebben nadat de server is herbouwd, worden direct opgeslagen en wachten: een **Apply Changes**-knop verschijnt in de header van de server, en ze worden ook toegepast de volgende keer dat de server start.

**Auto-restart on crash** start een gecrashte server opnieuw, wacht langer tussen elke poging (5, 10, dan 20 seconden) en stopt na 3 pogingen binnen 10 minuten. Het slaat crashes over die het paneel herkent als een opstartprobleem (de EULA, de verkeerde Java, een wereld van een nieuwere versie, een bezette poort, out-of-memory, een ontbrekende CurseForge-sleutel), omdat die eerst een oplossing nodig hebben. Als een andere actie bezig is met de server (een back-up, een herstel, een poortwijziging), wacht het tot 30 minuten, en geeft het op zodra iemand de server zelf stopt of start.

Directe instellingswijzigingen blijven altijd behouden na herstarts. Een PvP- of moeilijkheidswijziging die is gemaakt met de **World Controls**-rail, een whitelist-toggle op het **Players**-tabblad, of een `server.properties`-bewerking in de **Files**-editor verwijdert de bijbehorende omgevingsvariabele (indien ingesteld) en markeert de server om herbouwd te worden, zodat de waarde op schijf voorrang krijgt boven de waarde die door de container-image bij de volgende start opnieuw wordt toegepast.

![Server settings](/docs/images/server-settings.png)

**Over de geheugenmeter.** "RAM (Java heap)" wordt aan Java doorgegeven als zowel de start- als de maximale heap, en Java vult een heap die het vooraf kreeg binnen de eerste minuut, met of zonder de Aikar / MeowIce flag presets. Dus de geheugenmeter stabiliseert zich rond de heapgrootte en blijft daar, zelfs als niemand speelt; de tik op de meter markeert waar de heap zich bevindt onder de containerlimiet, en de notitie eronder vermeldt dit. Als je liever ziet dat het geheugen het werkelijke gebruik volgt, geef de server dan een kleinere startheap met **Initial heap** in de Resources-kaart op **Settings → Configuration** (of onder **Advanced Options** in de wizard), bijvoorbeeld 512 MB: op een 2 GB heap bracht dat idle gebruik van 2,6 GB naar ongeveer 1,3 GB in onze metingen. Java heeft ook geheugen buiten de heap nodig (ongeveer 0,5 GB op vanilla, 1,5 tot 2 GB op een grote modpack), waarvoor de marge van de containerlimiet bedoeld is. Zie de README's "Two memory limits" voor de cijfers.

> De **Advanced Docker Settings** (containernaam, Docker-netwerk, extra poorttoewijzingen en extra volume-binds) zijn **alleen voor beheerders**, omdat een bind mount plus de Docker-toegang van het paneel effectief root op de host is. Zie [Users & roles](/docs/users-and-roles/).

### De gamepoort wijzigen

De **Game Port**-kaart op **Settings → Configuration** verplaatst een server op elk moment naar een andere poort, met een eigen **Save Port**-knop. **Use Next Free Port** kiest de laagste vrije poort, en de kaart controleert elke poort die je invoert voordat je deze opslaat. RCON volgt altijd op 1000 boven de gamepoort (de standaard offset). Beheerders kunnen elke poort kiezen vanaf 1024 omhoog; iedereen anders kiest vanaf de eerste gamepoort (standaard 25565) omhoog. Opslaan past de wijziging direct toe: een gestopte server wordt gewoon verplaatst, en een draaiende server vraagt eerst toestemming en herstart dan op de nieuwe poort (de wereld wordt eerst opgeslagen en spelers maken opnieuw verbinding op de nieuwe poort). Als de server niet kan starten op de nieuwe poort, gaat deze terug naar de oude. De wijziging wordt geweigerd terwijl andere wijzigingen wachten op **Apply Changes**, dus pas die eerst toe. Het wijzigen van de poort vereist de Settings-machtiging op die server.

![The Game Port card](/docs/images/server-port.png)

![The prompt before a running server restarts on its new port](/docs/images/port-restart.png)

## Crashrapporten & mclo.gs analyse

Crashrapporten (`crash-reports/*.txt` en JVM `hs_err_pid*.log` bestanden) worden automatisch opgepikt, geparsed tot een samenvatting van één regel met de uitzondering en vermoedelijke mods, en weergegeven onder **Monitoring → History**:

![Crash report card](/docs/images/crash-mclogs-card.png)

Elke rapportkaart biedt een ingebouwde viewer (met inklapbare secties en gemarkeerde uitzonderingen), copy-stack-trace, en download, plus twee [mclo.gs](https://mclo.gs) acties:

- **Share to mclo.gs** publiceert het rapport als een openbare paste en kopieert de link: precies wat mod-auteurs en support Discords vragen. De link wordt onthouden voor het rapport, dus niets wordt ooit dubbel geüpload.
- **Analyze** voert mclo.gs's geautomatiseerde inzichten uit op de paste: bekende problemen met voorgestelde oplossingen (ontbrekende afhankelijkheden, versieconflicten, veelvoorkomende mod-conflicten), direct weergegeven in het paneel.

![mclo.gs insights](/docs/images/crash-insights.png)

Beide acties vereisen een expliciete bevestiging, omdat een paste openbaar is: crashrapporten kunnen spelersnamen en je volledige modlijst bevatten. Het paneel uploadt nooit iets uit zichzelf.

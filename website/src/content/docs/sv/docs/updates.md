---
title: 'Uppdateringar'
description: 'Spåra och installera uppdateringar för Minecraft-versioner, modpacks, mods och plugins på varje server, med en policy per server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Tillbaka till dokumentindex](/docs/)

**Uppdateringar**-sidan spårar vad som är föråldrat på alla dina servrar på ett ställe:

- **Modpack**-versioner ([modpacks](/docs/modpacks/)) mot Modrinth / CurseForge / GTNH release index.
- **Eget innehåll** som du lagt till själv (mods, datapacks, resource packs, plugins), var och en mot sin källa: Modrinth, CurseForge, Hangar, SpigotMC (Spiget), eller GitHub Releases. GitHub-uppslag använder ETag-validering, så dagliga kontroller påverkar knappt dess rate limit.
- **Docker image**-föråldring: varje servercontainers image ID mot en nyligen nedladdad tagg (deduplicerad över servrar med samma tagg), erbjuds som en uppgradering som endast kräver ombyggnad.
- **Fasta versioner**: för en server utan hanterat pack, en explicit `mc_version`-pinning mot Mojangs manifest, och en explicit loader-build miljövariabel (`PAPER_BUILD`, `FORGE_VERSION`, och liknande) mot loaderns register. Paper-builds kommer från PaperMC:s nuvarande **Fill v3 API** (det äldre v2-slutpunkten slutade ta emot nya Minecraft-versioner). På en server med mods erbjuds en nyare Minecraft-version endast när en [versionskontroll](#minecraft-version-compatibility) har visat att varje installerad mod har en build för den. En fast Forge-server erbjuds Forge's rekommenderade build, aldrig en build äldre än den den är fast till, och en server fast till en release erbjuds aldrig en förhandsversion (en som redan är på en beta kan erbjudas en nyare beta eller releasen). Att applicera en loader-build tar en backup före uppdateringen först. Att flytta en Forge- eller NeoForge-server till en ny Minecraft-version rensar dess fasta loader-build-nummer, eftersom en build görs för en Minecraft-version; ett nyckelord som `latest` behålls, eftersom det följer versionen av sig själv. För att välja en specifik build själv, se [ändra mod loader-version](#changing-the-mod-loader-version).

![Uppdateringar](/docs/images/updates.png)

## Hur det fungerar

Panelen kontrollerar varje servers fasta versioner mot källan och listar allt med en nyare release. Ett matchande antal visas också på [instrumentpanelens](/docs/dashboard/) "Uppdateringar tillgängliga"-ruta.

Kontroller körs dagligen enligt ett standardmässigt [schema](/docs/schedules/) och på begäran med **Kontrollera alla nu**. **Ignorera** på en rad slutar erbjuda den specifika versionen; en nyare erbjuds igen. Uppdaterings**policy** är per server: panelen lämnar allt manuellt (standard, vilket också håller servern borta från den här sidan), meddelar dig bara, eller applicerar pack-uppdateringar själv ([uppdateringspolicy](/docs/modpacks/#update-policy)).

## Minecraft-versionskompatibilitet

En nyare Minecraft-version är inte en uppgradering om dina mods inte kan följa med. Varje server har sin egen **Versioner**-flik (under Mods) som besvarar den frågan:

- Versionen som servern kör nu, och den **högsta versionen som varje installerad mod har en build för**.
- En hopfällbar rad per framtida Minecraft-version, med hur många mods som är redo och hur många som inte har något publicerat ännu. Öppna en rad för att se vilka mods som skulle bli kvar, och vilka som är okej.

![Versionskompatibilitet](/docs/images/server-versions.png)

Tryck på **Kontrollera framtida versioner** för att köra den. Ingenting skannas av sig självt: en kontroll läser varje jar i serverns mods-mapp och frågar Modrinth och CurseForge om var och en, så det händer bara när du ber om det. Framsteg och partiella resultat skrivs medan det pågår, så att stänga sidan eller uppdatera förlorar inget, och en kontroll som avbryts av en panelomstart säger det och erbjuder att köra igen. Allt som en avbruten kontroll redan har arbetat ut behålls, så att köra den igen gör inte om det arbetet.

En rapport beskriver bara servern den gjordes för. Ändra Minecraft-versionen, loadern, eller själva modsen (lägg till en, ta bort en, uppdatera en) och rapporten markeras som föråldrad och slutar användas, tills du kör kontrollen igen.

Mods identifieras från modpackens egen filista där det finns en, och annars genom filens innehåll, på samma sätt som en launcher känner igen en jar. Två typer av mods kan inte besvaras för, och ingen gissas:

- **Kunde inte identifieras**: en handbyggd jar eller en privat build som inget register känner igen.
- **Kunde inte kontrolleras**: en mod från GitHub Releases, Hangar eller SpigotMC, eller en vars projekt har tagits bort. Dessa publicerar ingen lista över vilka Minecraft-versioner varje build är för.

Medan någon av dem är installerad, kommer panelen inte att erbjuda en ett-klicks Minecraft-versionsuppdatering alls, eftersom den inte ärligt kan säga vad som skulle gå sönder. Att applicera en version över vad modsen stöder vägras, och namnger modsen som blockerar det.

Mods du har **inaktiverat** deltar inte: servern laddar dem inte, så att stänga av en mod är ett verkligt sätt att komma förbi en blockering. Att slå på eller av en mod markerar rapporten för omkontroll.

Detta täcker servrar som kör mods: Fabric, Forge, NeoForge och Quilt. Paper-liknande plugin-servrar behåller det enkla nyaste-release-beteendet och har ingen Versions-flik, eftersom två av registren som plugins kommer från inte publicerar något som en kontroll kan läsa.

![En version öppnad, som visar vilka mods som skulle bli kvar](/docs/images/server-versions-expanded.png)

Att öppna en version listar först modsen utan build för den (de som bestämmer svaret) och håller de klara bakom ett klick. Stora pack laddar en sida med mods åt gången, så en 300-mod-server öppnas lika snabbt som en fem-mod-server.

## Ändra mod loader-version

**Versioner**-fliken har också en **Loader Version**-kort. Den visar vilken Forge, NeoForge, Fabric eller Quilt build servern har installerad och, där det kan ändras, en väljare för att byta till en annan.

- **En Forge, NeoForge, Fabric eller Quilt server** kan köra vilken publicerad build som helst. Väljaren listar de senaste buildsen för serverns Minecraft-version, med Forge's rekommenderade och senaste builds märkta. **Annan Build…** tar vilken äldre som helst med dess nummer, och **Standard** går tillbaka till att låta servern välja.
- **Ett Forge- eller Fabric CurseForge-modpack** installerar den loader-version som dess egen manifest deklarerar, så det vanliga sättet att ändra det är att uppdatera packen. När packen själv listar fel version (en mod inuti den begär en nyare Forge än packen installerar), kan kortet åsidosätta det, och **Modpackets Version** tar bort åsidosättningen igen. Att uppdatera packen tar också bort den, eftersom den nya versionen deklarerar sin egen loader. Om den nya versionen fortfarande listar fel, ställ in åsidosättningen igen.
- **Ett NeoForge CurseForge-modpack, eller ett Modrinth-modpack,** visar sin loader men kan inte åsidosättas: serverimagen applicerar bara åsidosättningen på Forge- och Fabric-pack. Dess loader följer pack-versionen, så uppdatera packen istället. Ett FTB-pack's loader kan inte heller ändras här. Dess kort visas vanligtvis inte, eftersom FTB:s egen installationsprogram behåller register som panelen inte läser.

Panelen kontrollerar att builden existerar innan den frågar dig något. En Forge- eller NeoForge-build görs för en Minecraft-version, så på en server som följer den senaste releasen, håller en pinning av den också servern på den Minecraft-version den kör nu (bekräftelsen säger det). Att välja **Standard** efteråt tar bort pinnen men behåller den Minecraft-versionen. En server som följde den senaste releasen kan också flytta till en annan Java-image när den byggs om, den som den versionen behöver. En sådan server som aldrig har startats ombeds att starta en gång först, så att panelen vet den versionen. Forge hoppar över build-nummer (det finns ingen 47.4.14 mellan 47.4.13 och 47.4.15), så en mod som "kräver 47.4.14 eller högre" tillfredsställs av nästa build upp, och vägran namnger den. En ändring tar en backup före uppdateringen, och bygger sedan om servern. Den nya builden installeras nästa gång servern startar, och kortet säger det tills dess.

## Ångra en mod-uppdatering

Varje build som en mod uppdateras från finns kvar i det delade biblioteket, så en uppdatering som bryter något kan ångras. Moddens rad på **Mods**-fliken får en **Ångra**-knapp som sätter tillbaka den föregående builden. Det finns ingen nedladdning, så det fungerar även om projektet sedan dess har tagits bort från sitt register. Builden du ångrade dig från slutar erbjudas tills en nyare dyker upp.

![Ångra en mod till den build den uppdaterades från](/docs/images/mods-revert.png)

## Applicera en uppdatering

Uppdateringar är aldrig tysta. När du väljer att uppgradera ett pack (eller [byta det till en annan version](/docs/modpacks/#changing-the-pack-version), inklusive äldre), gör panelen:

1. Tar en **backup före uppdateringen** (så den kan ångras; som standard behålls de senaste 10 backuperna före uppdateringen per server, se [kvarhållning](/docs/backups/#retention)).
2. Återställer den exakta nya versionen.
3. Bygger om servern, och löser om Java-körningen vid behov.
4. Övervakar den första starten, med en tidsbudget per plattform.

Om den inte startar felfritt, rullar du tillbaka till backupen före uppdateringen. En server som följer stabila releaser erbjuds aldrig en beta, och länken till ändringsloggen pekar på den verkliga diffen per version där källan tillhandahåller en. En misslyckad uppdatering utlöser också ett Discord-[meddelande](/docs/integrations/) om integrationen är konfigurerad.

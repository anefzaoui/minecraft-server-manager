---
title: 'Uppdateringar'
description: 'Sidan Uppdateringar spårar vad som är föråldrat i hela din flotta på ett ställe:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Tillbaka till dokumentindex](/docs/)

**Uppdateringar**-sidan spårar vad som är föråldrat på alla dina servrar på ett ställe:

- **Modpack**-versioner ([modpacks](/docs/modpacks/)) mot Modrinth / CurseForge / GTNH release index.
- **Anpassat innehåll** du lagt till själv – mods, datapacks, resurshantverk, plugins – var och en mot sin källa: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) eller GitHub Releases. GitHub-uppslag använder ETag-validering, så dagliga kontroller påverkar knappt dess rate limit.
- **Docker image**-föråldring: varje körande containers image ID mot en nyligen neddragen tagg (deduplicerad över servrar med samma tagg), erbjuds som en uppgradering som endast återskapar.
- **Statiska versionslåsningar**: för en server utan hanterat pack, ett explicit `mc_version`-lås mot Mojangs manifest, och en explicit loader-build miljövariabel (`PAPER_BUILD`, `FORGE_VERSION`, och liknande) mot laddarens register. Paper-builds kommer från PaperMC:s nuvarande **Fill v3 API** (det äldre v2-slutpunkten slutade ta emot nya Minecraft-versioner).

![Uppdateringar](/docs/images/updates.png)

## Hur det fungerar

Panelen kontrollerar varje servers låsta versioner mot källan och listar allt med en nyare release. En matchande räknare visas också på [instrumentpanelens](/docs/dashboard/) "Uppdateringar tillgängliga"-ruta.

Kontroller körs vid behov och kan schemaläggas ([Scheman](/docs/schedules/)). Uppdaterings**policy** är per server: du bestämmer om panelen bara meddelar dig, eller om allt förblir manuellt.

## Tillämpa en uppdatering

Uppdateringar är aldrig tysta. När du väljer att uppgradera ett pack:

1. Tar en **backup före uppdatering** (så att den kan återställas; de senaste 10 säkerhetskopiorna före uppdatering per server sparas).
2. Låser om den exakta nya versionen.
3. Återskapar containern, och löser om Java-körningen vid behov.
4. Övervakar den första starten, med en tidsbudget per plattform.

Om den inte startar felfritt, rullar du tillbaka till säkerhetskopian före uppdateringen. En server som spårar stabila versioner erbjuds aldrig en beta, och länken till ändringsloggen pekar på den verkliga versionsspecifika diffen där källan tillhandahåller en sådan. En misslyckad uppdatering utlöser också ett Discord-meddelande [alert](/docs/integrations/) om integrationen är konfigurerad.

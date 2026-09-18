---
title: 'Modpacks'
description: 'Modpacks-sidan (och fliken Från modpack i guiden för skapande) installerar ett modpack som en server, alltid låst till en exakt packversion så att en omstart kan'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Tillbaka till dokumentindex](/docs/)

**Modpacks**-sidan (och fliken **Från modpack** i [skapande-guiden](/docs/servers/)) installerar ett modpack som en server, alltid **låst till en exakt pack-version** så att en omstart aldrig tyst kan uppgradera packen utan att du märker det.

![Modpacks](/docs/images/modpacks.png)

## Stödda plattformar

- **CurseForge** - sök eller klistra in en pack-URL. Kräver en CurseForge API-nyckel för sökning och privata packar (lägg till den under Inställningar → API-nycklar).
- **Modrinth** - sök efter namn.
- **FTB** - Feed The Beast-packar.
- **GT New Horizons** - 1.7.10 expert-pack, installerat från GTNH:s egen releaseindex. GTNH väljer sin Java-runtime per pack-version (2.8.0+ körs på **Java 25** via inbyggda lwjgl3ify-patchar, äldre releaser på Java 21 eller 17), och guiden höjer serverns RAM och diskutrymme till rimliga miniminivåer för det.
- **Anpassad zip** - inte ett publicerat pack alls: ladda upp en **CurseForge modpack-export** (zip-filen med `manifest.json` som CurseForge-appen producerar för en handplockad mod-uppsättning) eller **vilken zip som helst med mod-jar-filer**. Panelen löser manifestet i bulk via CurseForge API (eller identifierar varje jar-fil med hash/fingeravtryck/metadata), förhandsgranskar vad som passar och installerar allt i en uppgift - inklusive packens `overrides/`-konfigurationer om du väljer det. Mods vars författare inte tillåter automatiserade nedladdningar listas med en webblänkadress och en manuell uppladdningsplats istället för att misslyckas med installationen.

## Hur låsning fungerar

När du väljer ett pack löser panelen den exakta versionen, registrerar den och installerar den. På sidan **Uppdateringar** får du veta när en nyare version är tillgänglig; uppgradering är en avsiktlig, skyddad åtgärd med en säkerhetskopia före uppdatering och återställning. Servrar som följer stabila versioner erbjuds aldrig en betaversion.

Servrar som skapats på mycket gamla panelversioner (före 0.9.7) kunde lämnas _olåsta_, vilket innebar att containeravbildningen tyst installerade den senaste pack-versionen vid varje start. Panelprogrammet reparerar nu dessa vid uppstart: den låser var och en till den version som faktiskt är installerad (läst från panelens egna register eller avbildningens installationsmanifest, aldrig en nyligen löst "senaste") och loggar en händelse. Om den inte kan avgöra vad som är installerat, visar serverns Inställningar-sida en varning som ber dig att välja versionen manuellt, och alla försök att spara en olåst modpack-konfiguration avvisas omedelbart.

## Uppdateringspolicy

Varje server har en uppdateringspolicy i **Inställningar**, och alla tre alternativen betyder vad de säger:

- **Endast manuell** - ingenting ändras någonsin av sig självt, och servern lämnas helt utanför uppdateringsmärket och Uppdateringar-sidan. Läget "lämna mig ifred": idealiskt för ett handjusterat eller importerat pack som du aldrig vill ska röras.
- **Meddela mig** (standard) - den dagliga kontrollen visar tillgängliga uppdateringar som ett märke och på Uppdateringar-sidan; att tillämpa dem är alltid ditt klick.
- **Auto-uppdatering** - efter den schemalagda dagliga kontrollen tillämpas väntande **pack**-uppdateringar genom samma skyddade väg som en manuell uppgradering: säkerhetskopia före uppdatering, hälsokontroll och en automatisk återställning om den nya versionen inte startar. Uppdateringar som skulle flytta servern till en annan Minecraft-version hoppas alltid över med en händelse istället - att permanent konvertera en värld är ett beslut som panelen vägrar att fatta åt dig. Knapparna för manuell "kontrollera nu" kontrollerar bara; de utlöser aldrig automatiska uppdateringar.

## Uppgradera ett pack

Från en låst server kan du uppgradera till en nyare version i en enda åtgärd. Panelprogrammet tar en säkerhetskopia först, byter den låsta versionen, återskapar containern (löser om Java om den nya versionen behöver en annan runtime) och övervakar den första starten, med ett generöst fönster för stora packar som GTNH som laddar ner ett par gigabyte och bygger en värld med flera hundra mods vid första starten.

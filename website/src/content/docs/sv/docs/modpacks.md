---
title: 'Modpacks'
description: 'Installera CurseForge, Modrinth, FTB och GT New Horizons modpacks som servrar, alltid låsta till en exakt packversion.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Tillbaka till dokumentindex](/docs/)

**Modpacks**-sidan (och fliken **Från Modpack** i [skapelseguiden](/docs/servers/)) installerar ett modpack som en server, alltid **låst till en exakt packversion** så att en omstart aldrig tyst kan uppgradera packen under dig.

![Modpacks](/docs/images/modpacks.png)

## Stödda plattformar

- **CurseForge**: sök efter namn. Kräver en CurseForge API-nyckel (lägg till den under **Inställningar → API-nycklar**).
- **Modrinth**: sök efter namn.
- **FTB**: Feed The Beast-pack, endast via API (ett numeriskt pack-ID plus ett explicit versions-ID). Panelen kontrollerar ännu inte FTB-pack för uppdateringar.
- **GT New Horizons**: 1.7.10-expertpacken, installerad från GTNH:s egen releaseindex. GTNH väljer sin Java-runtime per packversion (2.8.0+ körs på **Java 25** via inbyggda lwjgl3ify-patchar, äldre releaser på Java 21 eller 17), och guiden höjer serverns RAM och diskutrymme till rimliga miniminivåer för den.
- **Anpassad zip**: inte ett publicerat pack alls. Ladda upp en **CurseForge modpack-export** (zip-filen med `manifest.json` som CurseForge-appen producerar för en handplockad uppsättning mods), en **Modrinth `.mrpack`**, eller **vilken zip som helst med mod-jar-filer**. Panelaren löser manifestet i bulk (eller identifierar varje jar efter hash/fingeravtryck/metadata), förhandsgranskar vad som passar och installerar allt i en uppgift, inklusive packens `overrides/`-konfigurationer om du väljer det. Mods vars författare inte tillåter automatiserade nedladdningar listas med en webblänkslänk och en manuell uppladdningsplats istället för att misslyckas med installationen.

## Hur låsning fungerar

När du väljer ett pack löser panelen den exakta versionen, registrerar den och installerar den. På sidan **Uppdateringar** får du veta när en nyare version är tillgänglig (om inte serverns [uppdateringspolicy](#update-policy) är **Endast manuell**); att uppgradera är en avsiktlig, skyddad åtgärd med en säkerhetskopia före uppdatering och återställning. Servrar som följer stabila versioner erbjuds aldrig en beta. En servers egen flik **Versioner** besvarar den andra halvan av frågan: vilka framtida Minecraft-versioner som mods den faktiskt har kan följa ([uppdateringar](/docs/updates/#minecraft-version-compatibility)).

Mod-laddarversionen följer också med packen: servern installerar den Forge-, NeoForge- eller Fabric-version som packen deklarerar. Om ett Forge- eller Fabric CurseForge-pack deklarerar en som är för gammal för sina egna mods, kan fliken **Versioner** åsidosätta den tills packen är fixad; en packuppdatering tar bort åsidosättningen, eftersom den nya versionen deklarerar sin egen ([ändra mod-laddarversion](/docs/updates/#changing-the-mod-loader-version)).

Servrar som skapats på mycket gamla panelversioner (före 0.9.7) kunde lämnas _olåsta_, vilket innebar att containeravbildningen tyst installerade den senaste packversionen vid varje start. Panelaren reparerar nu dessa vid uppstart: den låser var och en till den version som faktiskt är installerad (läst från panelens egna register eller avbildningens installationsmanifest, aldrig en nyligen löst "senaste") och loggar en händelse. Om den inte kan avgöra vad som är installerat, visar serverns Inställningar-sida en varning med en knapp **Välj en version…** (CurseForge-, Modrinth- och GTNH-pack) som öppnar [versionsväljaren](#changing-the-pack-version), och alla försök att spara en olåst modpack-konfiguration avvisas omedelbart.

## Uppdateringspolicy

Varje server har ett kort **Uppdateringspolicy** på fliken **Inställningar → Konfiguration**, och alla tre alternativen betyder vad de säger:

- **Endast manuell** (standard): ingenting ändras någonsin av sig självt, och servern lämnas helt utanför uppdateringsmärket och Uppdateringar-sidan. Läget "lämna mig ifred": idealiskt för ett handjusterat eller importerat pack som du aldrig vill ska röras. Det låser inte versionen: [**Ändra version…**](#changing-the-pack-version) fungerar under alla policyer. För att bli informerad om nya versioner och tillämpa dem med ett klick, välj **Meddela mig**.
- **Meddela mig**: den dagliga kontrollen visar tillgängliga uppdateringar som ett märke och på Uppdateringar-sidan; att tillämpa dem är alltid ditt klick.
- **Automatisk uppdatering**: efter den schemalagda dagliga kontrollen tillämpas väntande **pack**-uppdateringar genom samma skyddade väg som en manuell uppgradering: säkerhetskopia före uppdatering, hälsokontroll och automatisk återställning om den nya versionen inte startar. Uppdateringar som skulle flytta servern till en annan Minecraft-version hoppas alltid över med en händelse istället: att konvertera en värld permanent är ett beslut som panelen vägrar att fatta åt dig. De manuella knapparna **Kontrollera nu** kontrollerar endast; de utlöser aldrig automatiska uppdateringar.

## Uppgradera ett pack

Från en låst server kan du uppgradera till en nyare version i en enda åtgärd. Panelaren tar en säkerhetskopia först, byter den låsta versionen, bygger om servern (löser om Java om den nya versionen behöver en annan runtime) och övervakar den första starten, med ett generöst fönster för stora pack som GTNH som laddar ner ett par gigabyte och bygger en värld med flera hundra mods vid första starten.

## Ändra packversion

För att köra en specifik version, nyare eller äldre, använd **Ändra version…** på packkortet på serverns flik **Översikt**. På sidan **Modpacks**, när du öppnar ett installerat packs kort, får du samma val: välj en version i rullgardinsmenyn och klicka på **Byt till denna version**. Båda kräver serverns **Innehålls**-behörighet, och båda är tillgängliga för CurseForge-, Modrinth- och GTNH-pack (FTB-pack har ännu ingen versionslista). Listan visar de 25 senaste versionerna för CurseForge och Modrinth, och alla GTNH-releaser.

Bytet går genom samma skyddade väg som en uppgradering: en säkerhetskopia före uppdatering, den nya låsningen, en ombyggnad och en övervakad första start, med en ett-klicks-återställning om servern inte startar felfritt. Dina anpassade mods förs över, liksom de pack-mods du inaktiverade, tillsammans med packens andra installationsinställningar (mods som tvingats in, filer att ignorera, extra projekt). Att installera ett annat pack startar dessa inställningar från noll, eftersom de bara är meningsfulla för det pack de skapades för.

Varje version listas med Minecraft-versionen den kör, jämfört med versionen din värld senast sparades med:

- **Samma Minecraft-version**: byt efter en normal bekräftelse. Att gå tillbaka till en äldre packversion kan tappa block och föremål från mods som den versionen inte har, så säkerhetskopian finns kvar på fliken Säkerhetskopior oavsett.
- **Nyare Minecraft-version**: tillåtet efter en bekräftelse som varnar att världen konverteras för gott. Säkerhetskopian som tas först är den enda vägen tillbaka till den gamla världen.
- **Äldre Minecraft-version**: otillgänglig. Minecraft kan inte ladda en värld på en äldre version än den som senast sparade den, så panelaren vägrar snarare än att lämna en server som kraschar vid start.

---
title: 'Skapa och hantera servrar'
description: 'Skapa, starta, stoppa, bygg om och konfigurera Minecraft-servrar i panelen: guiden för skapande, inställningar, minne och spelport.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Tillbaka till dokumentindex](/docs/)

## Skapa en server

Klicka på **Skapa en server** (överst i menyraden) eller på kortet **Skapa en server** för att öppna guiden.

![Skapa en server](/docs/images/create-wizard.png)

Guiden förifyller Java heap och diskutrymme från **Standardinställningar för nya servrar** på sidan Inställningar, vilket en administratör kan ändra när som helst. En ny server hämtar även sin CPU-gräns därifrån.

![Standardinställningar för nya servrar](/docs/images/settings-defaults.png)

Du väljer:

- Ett **namn** (och en valfri beskrivning, ikon och accentfärg). Taggar för att organisera din flotta läggs till senare, på serverns inställningar.
- En **servertyp**: Vanilla, Paper eller Purpur under fliken **Vanilla**. För en moddad server väljer fliken **Från mods** laddaren (Fabric, Forge, NeoForge eller Quilt), Minecraft-versionen och en laddarversion (den senaste eller en specifik), och låter dig sedan söka efter mods.
- En **Minecraft-version**: `LATEST`, en snapshot eller en specifik version (betor och alfan inkluderade).
- En **spelport**: en ledig port föreslås. Fjärrkonsolen (RCON) använder porten 1000 högre (som standard). Du kan ändra den senare (se [Ändra spelporten](#changing-the-game-port)).
- **Resurser**: Java heap (container-minnesgränsen sätts 50 % högre än den) och en diskutrymmesgräns.

**Avancerade alternativ** öppnar alla andra inställningar som serveravbildningen stöder, plus extra miljövariabler och (för administratörer) de avancerade Docker-inställningarna.

Föredrar du ett modpack? Fliken **Från modpack** installerar ett CurseForge-, Modrinth- eller GT New Horizons-pack istället (se [Modpacks](/docs/modpacks/)), eller tar emot en **anpassad zip du laddar upp**: en Modrinth `.mrpack`, en CurseForge modpack-export (`manifest.json`), eller vilken zip som helst med mod-filer. Manifestet (eller en majoritetsröstning bland de identifierade filerna) fyller i laddaren och Minecraft-versionen, och alla mods installeras i en enda uppgift. Du kan också börja från en sparad [Blueprint](/docs/blueprints/) på fliken **Från blueprint**.

Panelen väljer automatiskt en lämplig Java-runtime för din version, hämtar avbildningen, skapar containern och startar den, allt från ett enda formulär.

## Serverlistan

Sidan **Servrar** listar hela din flotta med status och snabba statistik.

![Serverlistan](/docs/images/servers-list.png)

## En enskild server

![Spelare](/docs/images/players.png)

Att öppna en server ger dig en arbetsyta med flikar:

- **Översikt**: adressen att dela med spelare, beskrivningen, aktuell användning och vilka som är online.
- **Konsol**: live loggström och kommandoinmatning, chatt i spelet och [chattkommandon](/docs/console-and-chat/).
- **Spelare**: listan, plus inventarier och statistik.
- **Mods**: listan över installerade mods, [mod-bläddraren](/docs/modpacks/) och innehållsuppdateringar. På en moddad server kontrollerar dess underflik **Versioner** vilka framtida Minecraft-versioner dina mods har byggen för ([uppdateringar](/docs/updates/#minecraft-version-compatibility)).
- **Värld**: [världar, livekartan och filhanteraren](/docs/worlds-and-files/).
- **Säkerhetskopior**: [ögonblicksbilder och återställning](/docs/backups/) för denna server.
- **Övervakning**: historik och livemätvärden per server, inklusive kraschrapporter (se nedan).
- **Inställningar**: **Konfiguration** (allt om hur servern körs), plus [integrationerna](/docs/integrations/) (Discord, Status Page, Invites och, för administratörer, Chatbot).

Start-, stopp- och omstartsreglagen sitter i sidhuvudet ovanför varje flik. Vad du kan göra på varje flik beror på dina [behörigheter på den servern](/docs/users-and-roles/#per-server-permissions): till exempel kräver underfliken **Filer** behörigheten Filer, och att skicka konsolkommandon kräver Konsol.

![Serveröversikt](/docs/images/server-overview.png)

**Världskontrollerna** löper längs med varje flik: klockan i spelet, vädret, de vanliga gamerules som växlingsbara chip, och "Visa alla världregler" för resten.

![Världskontroller](/docs/images/world-controls.png)

**Övervakning → Live** visar TPS och millisekunder per tick, ett kort för hälsa och stabilitet med krascher (senaste 24 timmarna och 7 dagarna), minnesavstängningar och automatiska omstarter, samt storlekar per värld.

![Liveövervakning](/docs/images/monitoring-live.png)

## Serverinställningar

**Inställningar → Konfiguration** är hela konfigurationsytan: namn, beskrivning, MOTD, ikon, färg och taggar, resurser, spelporten, uppdateringspolicy, start vid panelstart och automatisk omstart vid krasch, alla miljövariabler som serveravbildningen stöder, de avancerade Docker-inställningarna, och export, kloning, återbyggnad och borttagning av blueprints. Ändringar som bara träder i kraft när servern har byggts om sparas omedelbart och väntar: en knapp **Verkställ ändringar** visas i serverns sidhuvud, och de verkställs även nästa gång servern startas.

**Automatisk omstart vid krasch** startar en kraschad server igen, väntar längre mellan varje försök (5, 10, sedan 20 sekunder) och stoppar efter 3 försök inom 10 minuter. Den hoppar över krascher som panelen känner igen som ett konfigurationsproblem (EULA, fel Java, en värld från en nyare version, en port som används, slut på minne, en saknad CurseForge-nyckel), eftersom dessa behöver åtgärdas först. Om en annan åtgärd är upptagen med servern (en säkerhetskopia, en återställning, en portändring), väntar den upp till 30 minuter, och den ger upp så snart någon stoppar eller startar servern själv.

Direkta inställningsändringar gäller alltid över omstarter. En PvP- eller svårighetsändring gjord med **Världskontrollerna**, en vitlistningsväxling på fliken **Spelare**, eller en `server.properties`-redigering i **Filer**-redigeraren tar bort motsvarande miljövariabel (om en var satt) och markerar servern för återbyggnad, så att värdet på disken vinner istället för att återigen påtvingas av containeravbildningen vid nästa start.

![Serverinställningar](/docs/images/server-settings.png)

**Om minnesmätaren.** "RAM (Java heap)" ges till Java som både dess start- och maximala heap, och Java fyller en heap som den fick i förväg inom den första minuten, med eller utan Aikar / MeowIce flagginställningarna. Så minnesmätaren stabiliseras vid ungefär heap-storleken och stannar där även när ingen spelar; ticket på mätaren markerar var heapen ligger under containergränsen, och noten under den säger så. Om du hellre vill se minnet följa verklig användning, ge servern en mindre start-heap med **Initial heap** i resurserkortet på **Inställningar → Konfiguration** (eller under **Avancerade alternativ** i guiden), till exempel 512 MB: på en 2 GB heap minskade det lediga användandet från 2,6 GB till cirka 1,3 GB i våra mätningar. Java behöver också minne utanför heapen (cirka 0,5 GB på vanilla, 1,5 till 2 GB på ett stort modpack), vilket är vad containergränsens marginal är till för. Se README:s "Två minnesgränser" för siffrorna.

> De **Avancerade Docker-inställningarna** (containernamn, Docker-nätverk, extra portmappningar och extra volymbindningar) är **endast för administratörer**, eftersom en bind mount plus panelens Docker-åtkomst i praktiken är root på värden. Se [Användare & roller](/docs/users-and-roles/).

### Ändra spelporten

Kortet **Spelport** på **Inställningar → Konfiguration** flyttar en server till en annan port när som helst, med en egen knapp **Spara port**. **Använd nästa lediga port** väljer den lägsta lediga, och kortet kontrollerar alla portar du anger innan du sparar den. RCON följer alltid 1000 högre än spelporten (standardförskjutningen). Administratörer kan välja vilken port som helst från 1024 och uppåt; alla andra väljer från den första spelporten (25565 som standard) och uppåt. Sparande verkställer ändringen omedelbart: en stoppad server flyttas bara, och en igångvarande server frågar först, och startar sedan om på den nya porten (världen sparas först, och spelare återansluter på den nya porten). Om servern inte kan starta på den nya porten, återgår den till den gamla. Ändringen nekas medan andra ändringar väntar på **Verkställ ändringar**, så verkställ dem först. Att ändra porten kräver behörigheten Inställningar på den servern.

![Kortet Spelport](/docs/images/server-port.png)

![Prompten innan en igångvarande server startar om på sin nya port](/docs/images/port-restart.png)

## Kraschrapporter & mclo.gs-analys

Kraschrapporter (`crash-reports/*.txt` och JVM `hs_err_pid*.log`-filer) plockas upp automatiskt, parsas till en sammanfattning på en rad med undantaget och misstänkta mods, och listas under **Övervakning → Historik**:

![Kraschrapportkort](/docs/images/crash-mclogs-card.png)

Varje rapportkort erbjuder en inbyggd visare (med hopfällbara sektioner och markerade undantag), kopiera stackspårning, och nedladdning, plus två [mclo.gs](https://mclo.gs)-åtgärder:

- **Dela till mclo.gs** publicerar rapporten som en offentlig paste och kopierar länken: exakt vad modutvecklare och support-Discords frågar efter. Länken sparas på rapporten, så inget laddas någonsin upp två gånger.
- **Analysera** kör mclo.gs:s automatiska insikter över pasten: kända problem med föreslagna lösningar (saknade beroenden, versionskonflikter, vanliga modkonflikter), visade direkt i panelen.

![mclo.gs insikter](/docs/images/crash-insights.png)

Båda åtgärderna ligger bakom en uttrycklig bekräftelse, eftersom en paste är offentlig: kraschrapporter kan inkludera spelarnamn och din fullständiga modlista. Panelen laddar aldrig upp något på egen hand.

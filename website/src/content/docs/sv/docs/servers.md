---
title: 'Skapa och hantera servrar'
description: 'Klicka på Skapa en server (överst i fältet) eller på kortet Skapa en server för att öppna guiden.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Tillbaka till dokumentindex](/docs/)

## Skapa en server

Klicka på **Skapa en server** (överst) eller kortet **Skapa en server** för att öppna guiden.

![Skapa en server](/docs/images/create-wizard.png)

Guiden förifyller fälten för minne, CPU och diskutrymmeskvot från **Standardvärden för nya servrar** på sidan Inställningar, som en administratör kan ändra när som helst.

![Standardvärden för nya servrar](/docs/images/settings-defaults.png)

Du väljer:

- Ett **namn** (och valfri ikon, accentfärg och taggar för att organisera din flotta).
- En **servertyp** - vanilla, Paper, Fabric, Forge, NeoForge och mer, var och en mappad till rätt itzg-image i bakgrunden.
- En **Minecraft-version** - `LATEST`, en snapshot eller en specifik version.
- **Resurser** - RAM (heap), container-minnesgräns, CPU och en diskutrymmeskvot.

Föredrar du ett modpack? Fliken **Från modpack** installerar ett CurseForge-, Modrinth-, FTB- eller GT New Horizons-paket istället (se [Modpacks](/docs/modpacks/)), eller tar en **anpassad zip du laddar upp**: en CurseForge modpack-export (`manifest.json`) eller vilken zip som helst med mod-filer. Manifestet (eller en majoritetsomröstning över de identifierade filerna) fyller i laddaren och Minecraft-versionen, och varje mod installeras i en uppgift. Du kan också börja från en sparad [Blueprint](/docs/blueprints/).

Panelen väljer automatiskt en vettig Java-runtime för din version, hämtar imagen, skapar containern och (valfritt) startar den, allt från samma formulär.

## Serverlistan

Sidan **Servrar** listar hela din flotta med status och snabba statistikuppgifter.

![Serverlista](/docs/images/servers-list.png)

## En enskild server

![Spelare](/docs/images/players.png)

Att öppna en server ger dig en arbetsyta med flikar:

- **Översikt** - status, live-statistik, upptid och de primära kontrollerna för start/stopp/omstart.
- **Konsol** - live-loggströmmen och kommandoinmatning, plus chatt i spelet ([detaljer](/docs/console-and-chat/)).
- **Spelare** - vilka som är online, plus inventarier, statistik och [chattkommandon](/docs/console-and-chat/).
- **Mods** - installerad modlista, [modbläddraren](/docs/modpacks/) och innehållsuppdateringar.
- **Värld** - [världar, live-kartan och filhanteraren](/docs/worlds-and-files/).
- **Säkerhetskopior** - [ögonblicksbilder och återställning](/docs/backups/) för denna server.
- **Övervakning** - server-specifik historik och live-mätvärden, inklusive kraschrapporter (se nedan).
- **Inställningar** - allt om hur servern körs, plus [integrationerna](/docs/integrations/) (Discord, status-sida, inbjudningar, chatbot).

![Serveröversikt](/docs/images/server-overview.png)

**Världskontrollerna** följer med på varje flik: klockan i spelet, väder, de vanliga spelreglerna som omkopplingsbara chip, och "Visa alla världregler" för resten.

![Världskontroller](/docs/images/world-controls.png)

**Övervakning → Live** visar TPS och millisekunder per tick, ett kort för hälsa och stabilitet med de senaste 24 timmarna / 7 dagarna av krascher och omstarter, och storlekar per värld.

![Live-övervakning](/docs/images/monitoring-live.png)

## Serverinställningar

Fliken **Inställningar** är hela konfigurationsytan: byt namn, resurser, uppdateringspolicy, automatisk start/automatisk omstart, miljövariabler och avancerade Docker-inställningar. Fält som ändrar hur containern körs markeras tydligt som att de kräver en omstart.

![Serverinställningar](/docs/images/server-settings.png)

**Om minnesmätaren.** "RAM (Java heap)" ges till Java som både dess start- och maximala heap, och Java fyller en heap som den fick i förväg inom den första minuten, med eller utan Aikar / MeowIce flagginställningarna. Så minnesmätaren stabiliseras runt heap-storleken och stannar där även när ingen spelar; ticket på mätaren markerar var heapen ligger under containergränsen, och noten under den säger så. Om du hellre vill se minnet följa verklig användning, ställ in en mindre **Initial heap** (avancerat): på en 2 GB heap som minskade idle-användningen från 2,6 GB till cirka 1,3 GB i våra mätningar. Java behöver också minne utanför heapen (cirka 0,5 GB på vanilla, 1,5 till 2 GB på ett stort modpack), vilket är vad containergränsens marginal är till för. Se README:ns "Två minnesgränser" för siffrorna.

> Avancerade Docker-inställningsfält (anpassat containernamn, extra port och bind mounts, och råa inställningar) är **endast för administratörer**, eftersom en bind mount plus panelens Docker-åtkomst i praktiken är root på värden. Se [Användare & roller](/docs/users-and-roles/).

## Kraschrapporter & mclo.gs-analys

Kraschrapporter (`crash-reports/*.txt` och JVM `hs_err_pid*.log`-filer) plockas upp automatiskt, parsas till en sammanfattning på en rad med undantaget och misstänkta mods, och listas under **Övervakning → Historik**:

![Kraschrapportkort](/docs/images/crash-mclogs-card.png)

Varje rapportkort erbjuder en inbyggd visare (med kollapsbara sektioner och markerade undantag), kopiera stack trace, och nedladdning, plus två [mclo.gs](https://mclo.gs)-åtgärder:

- **Dela till mclo.gs** publicerar rapporten som en offentlig paste och kopierar länken - exakt vad mod-utvecklare och support-Discords ber om. Länken sparas på rapporten, så inget laddas någonsin upp två gånger.
- **Analysera** kör mclo.gs:s automatiserade insikter över pasten: kända problem med föreslagna lösningar (saknade beroenden, versionskonflikter, vanliga mod-konflikter), visade direkt i panelen.

![mclo.gs-insikter](/docs/images/crash-insights.png)

Båda åtgärderna ligger bakom en explicit bekräftelse, eftersom en paste är offentlig: kraschrapporter kan inkludera spelarnamn och din fullständiga modlista. Paneln laddar aldrig upp något på egen hand.

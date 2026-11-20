---
title: 'Instrumentpanelen'
description: 'Instrumentpanelen är din hemmabas: varje server, dess live-status och ett löpande flöde av vad som har hänt.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Tillbaka till dokumentindex](/docs/)

Instrumentpanelen är din hembas: varje server, dess live-status och ett kontinuerligt flöde av vad som har hänt.

![Instrumentpanel](/docs/images/dashboard.png)

## Sammanfattningsbrickorna

Överst:

- **Servrar online**: hur många av dina servrar som körs för närvarande, av det totala antalet.
- **Anslutna spelare**: det totala antalet spelare på alla körande servrar.
- **Uppdateringar tillgängliga**: hur många servrar, paket eller mods som har en nyare version ([se Uppdateringar](/docs/updates/)).
- **Docker**: om panelen kan nå Docker-demonen och dess version.

En andra rad lägger till **Tilldelat minne** (och hur mycket som används), **Använt lagringsutrymme** över alla serverdatamappar, **Hälsa · 24h** (krascher, stopp på grund av slut på minne och automatiska omstarter under det senaste dygnet), och **Uppdateringar** uppdelat på mods och uppdateringar på servernivå. Nedanför dem räknar **Servrar efter status** dina servrar i varje tillstånd, och **Resursöversikt** visar varje servers andel av minne och CPU.

## Serverkort

Varje server visas som ett kort med dess status (Körs, Startar, Stoppad, Kraschad och mellanliggande tillstånd som Ohälsosam eller Stannad), typ och Minecraft-version, dess spelport och dess taggar. Varje kort visar **spelare** och **disk**-användning mot kvoten; körande servrar visar också live **CPU** och **minne**, uppdaterat kontinuerligt.

Klicka på ett kort för att öppna den servern. Det tomma **Skapa en server**-kortet och knappen **Skapa en server** högst upp startar båda [skapande-guiden](/docs/servers/).

Du kan söka bland dina servrar (efter namn, typ, version eller tagg), sortera dem efter status, namn, storlek, senast startad eller skapad, och växla mellan rutnät- och listvyer med växlingsknappen till höger.

## Senaste aktivitet

Flödet längst ner visar de senaste posterna från panelens mänskligt läsbara revisionslogg: inloggningar, säkerhetskopior, export av ritningar, uppdateringskontroller, ändringar av chattkommandon, serverstarter och -stopp, och mer. Varje post är taggad med servern den tillhör (eller panelen själv) och hur länge sedan det hände. **Visa alla** öppnar hela historiken på sidan [Aktivitet](/docs/activity/).

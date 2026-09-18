---
title: 'Instrumentpanelen'
description: 'Instrumentpanelen är din hemmabas: varje server, dess live-status och ett löpande flöde av vad som har hänt.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Tillbaka till dokumentindex](/docs/)

Instrumentbrädan är din hembas: varje server, dess live-status och ett kontinuerligt flöde av vad som har hänt.

![Instrumentbräda](/docs/images/dashboard.png)

## Sammanfattningsbrickorna

Överst:

- **Servrar online** - hur många av dina servrar som körs för närvarande.
- **Anslutna spelare** - det totala antalet spelare på alla körande servrar.
- **Uppdateringar tillgängliga** - hur många servrar, paket eller mods som har en nyare version ([se Uppdateringar](/docs/updates/)).
- **Docker** - om panelen kan nå Docker-demonen och dess version.

## Serverkort

Varje server visas som ett kort med dess status (Körs, Startar, Stoppad, Kraschad), typ och Minecraft-version, samt dess spelport. För körande servrar får du även live-information om **spelare**, **CPU**, **minne** och **disk**-användning, som uppdateras kontinuerligt.

Klicka på ett kort för att öppna den servern. Det tomma **Skapa en server**-kortet och knappen **Skapa en Server** i toppfältet startar båda [skapande-guiden](/docs/servers/).

Du kan söka och sortera dina servrar, och växla mellan rutnät- och listvyer med växlingsknappen till höger.

## Senaste aktivitet

Flödet längst ner är en live, läsbar revisionslogg: inloggningar, säkerhetskopieringar, export av ritningar, uppdateringskontroller, ändringar av chattkommandon, serverstarter och -stopp, och mer. Varje post är märkt med servern den tillhör (eller själva panelen) och hur länge sedan det hände. Hela historiken finns på sidan [Aktivitet](/docs/activity/).

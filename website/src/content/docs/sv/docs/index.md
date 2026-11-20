---
title: 'Dokumentation'
description: 'Ett komplett, självhostat kontrollpanel för itzg/docker-minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

Ett komplett, självhostat kontrollpanel för [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server). Skapa, kör och hantera Minecraft-servrar från din webbläsare. Ingen kommandorad, ingen manuell redigering av YAML.

![Dashboard](/docs/images/dashboard.png)

## Kom igång

- **[Komma igång](/docs/getting-started/)** - första installationen, inloggning och hur du navigerar.
- **[Instrumentpanelen](/docs/dashboard/)** - översikten av alla servrar, spelare och aktivitet.

## Kör servrar

- **[Skapa och hantera servrar](/docs/servers/)** - guiden för att skapa, servertyper, versioner och inställningar per server.
- **[Konsol och chattkommandon](/docs/console-and-chat/)** - live-konsolen och anpassade chattkommandon i spelet som körs som spelaren.
- **[Modpacks](/docs/modpacks/)** - installera CurseForge, Modrinth, FTB och GT New Horizons-paket, alltid låsta till en exakt version.
- **[Världar och filer](/docs/worlds-and-files/)** - byt världar, hantera mods och redigera filer direkt i webbläsaren.
- **[Minska en värld](/docs/world-shrink/)** - frigör diskutrymme genom att ta bort chunkar som ingen besöker, antingen fristående eller som del av en säkerhetskopia.
- **[Livekarta](/docs/live-map/)** - en 3D-karta av världen med BlueMap med ett klick, bakom panelens inloggning.
- **[Inbjudningar och status-sida](/docs/invites-and-status-page/)** - adressen, inbjudningstext och klientmodpack för vänner, samt en publik status-sida.

## Data och automation

- **[Chattbot per server](/docs/chatbot/)** - lokal/OpenAI-kompatibel konversation, utåtriktad kommunikation, sparade transkriptioner och begränsade spelkrafter.
- **[Säkerhetskopior](/docs/backups/)** - ögonblicksbilder med ett klick, schemalagda säkerhetskopior, hur många som ska sparas (för hela panelen eller per server) och återställning.
- **[Ritningar](/docs/blueprints/)** - fånga en servers hela konfiguration och skapa nya servrar baserat på den.
- **[Scheman](/docs/schedules/)** - omstart, säkerhetskopiering och kommandon drivna av cron.
- **[Lagring](/docs/storage/)** - diskutrymme per server och kvoter som tillämpas av panelen.
- **[Uppdateringar](/docs/updates/)** - spåra nya versioner av servrar, paket, images och mods, kontrollera vilka Minecraft-versioner dina mods stöder och ångra en mod-uppdatering.
- **[Aktivitetslogg](/docs/activity/)** - en revisionslogg över allt som har hänt.
- **[Integrationer](/docs/integrations/)** - Discord webhook-notiser och kategorin Aviseringar.
- **[Publikt API](/docs/public-api/)** - ett skrivskyddat HTTP API med token-autentisering för att hämta serverstatus från utanför panelen.

## Konton och säkerhet

- **[Användare och roller](/docs/users-and-roles/)** - administratör, operatör och tittare, vad var och en kan göra, och behörigheter per server som förfinar dem.
- **[Tvåfaktorsautentisering](/docs/two-factor-authentication/)** - skydda din inloggning med en autentiseringsapp.

## Guider

Inte specifikt för denna panel: frågor som varje Minecraft-serverägare stöter på.

- **[Hur mycket RAM behöver en server?](/docs/guide-server-memory/)** - de två siffrorna att ställa in, och varför en inaktiv server läser som 12 GB.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - vilken man ska köra, och skillnaden mellan plugins/mods bakom valet.
- **[Din server startar inte](/docs/guide-server-wont-start/)** - läsa loggen, och de få orsaker som ligger bakom de flesta fel.
- **[Säkerhetskopior som faktiskt återställs](/docs/guide-backups/)** - konsekventa kopior, vad annat man ska spara, och testa en innan du behöver den.
- **[Flytta en server till en annan värd](/docs/guide-moving-a-server/)** - ordningen som håller driftstopp kort och inventarier intakta.

## Under huven

- **[Arkitektur](/docs/architecture/)** - hur panelen är uppbyggd.
- **[Webbplatsen](/docs/website/)** - hur minecraft-server-manager.com byggs, översätts och driftsätts från detta repo.

---

> Skärmdumpar i dessa dokument är tagna i panelens mörka tema. Panelens standard är mörkt om inte ditt operativsystem föredrar ljust; använd temaväxlaren i toppfältet för att byta.

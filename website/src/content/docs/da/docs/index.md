---
title: 'Dokumentation'
description: 'Et komplet, selv-hostet kontrolpanel til itzg/docker-minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

Et komplet, selv-hostet kontrolpanel til [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server). Opret, kør og administrer Minecraft-servere fra din browser. Ingen kommandolinje, ingen manuel redigering af YAML.

![Dashboard](/docs/images/dashboard.png)

## Start her

- **[Kom godt i gang](/docs/getting-started/)** - Første opsætning, login og hvordan du navigerer.
- **[Dashboardet](/docs/dashboard/)** - Oversigten over alle servere, spillere og aktivitet.

## Kørsel af servere

- **[Oprettelse og administration af servere](/docs/servers/)** - Oprettelsesguiden, servertyper, versioner og server-specifikke indstillinger.
- **[Konsol og chatkommandoer](/docs/console-and-chat/)** - Den live konsol og brugerdefinerede chatkommandoer i spillet, der kører som spilleren.
- **[Modpacks](/docs/modpacks/)** - Installer CurseForge, Modrinth, FTB og GT New Horizons packs, altid fastgjort til en præcis version.
- **[Verdener og filer](/docs/worlds-and-files/)** - Skift verdener, administrer mods, og rediger filer direkte i browseren.
- **[Formindskelse af en verden](/docs/world-shrink/)** - Genvind diskplads ved at fjerne ubesøgte chunks, enten alene eller som en del af en backup.
- **[Live kort](/docs/live-map/)** - Et 3D-kort af verdenen med ét klik via BlueMap, bag panelets login.
- **[Invitationer og status-side](/docs/invites-and-status-page/)** - Adressen, invitationstekst og client modpack til venner, samt en offentlig status-side.

## Data og automatisering

- **[Server-specifik chatbot](/docs/chatbot/)** - Lokal/OpenAI-kompatibel samtale, opsøgende arbejde, gemte transskriptioner og begrænsede gameplay-kræfter.
- **[Backups](/docs/backups/)** - Øjebliksbilleder med ét klik, planlagte backups, hvor mange der skal gemmes (på tværs af panelet eller pr. server) og gendannelse.
- **[Skabeloner](/docs/blueprints/)** - Fang en servers hele konfiguration og opret nye ud fra den.
- **[Planer](/docs/schedules/)** - Cron-drevet genstart, backups og kommandoer.
- **[Lagerplads](/docs/storage/)** - Server-specifik diskforbrug og panel-håndhævede kvoter.
- **[Opdateringer](/docs/updates/)** - Spor nye server-, pack-, image- og mod-versioner, tjek hvilke Minecraft-versioner dine mods understøtter, og fortryd en mod-opdatering.
- **[Aktivitetslog](/docs/activity/)** - En revisionsspor over alt, hvad der er sket.
- **[Integrationer](/docs/integrations/)** - Discord webhook-notifikationer og kategorien Alarmer.
- **[Offentlig API](/docs/public-api/)** - En skrivebeskyttet, token-autentificeret HTTP API til at hente serverstatus udefra panelet.

## Konti og sikkerhed

- **[Brugere og roller](/docs/users-and-roles/)** - Administrator, operatør og seer, hvad hver enkelt kan gøre, og server-specifikke tilladelser, der forfiner dem.
- **[To-faktor godkendelse](/docs/two-factor-authentication/)** - Beskyt dit login med en godkendelsesapp.

## Guides

Ikke specifikt for dette panel: spørgsmålene, som enhver Minecraft-serverejer støder på.

- **[Hvor meget RAM har en server brug for?](/docs/guide-server-memory/)** - De to tal, der skal indstilles, og hvorfor en inaktiv server læses som 12 GB.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - Hvilken der skal køres, og forskellen på plugins/mods bag valget.
- **[Din server vil ikke starte](/docs/guide-server-wont-start/)** - Læsning af loggen og de få årsager bag de fleste fejl.
- **[Backups, der rent faktisk gendannes](/docs/guide-backups/)** - Konsistente kopier, hvad der ellers skal gemmes, og test af en, før du har brug for den.
- **[Flytning af en server til en anden vært](/docs/guide-moving-a-server/)** - Den rækkefølge, der holder nedetid kort og beholdninger intakte.

## Under motorhjelmen

- **[Arkitektur](/docs/architecture/)** - Hvordan panelet er sammensat.
- **[Websitet](/docs/website/)** - Hvordan minecraft-server-manager.com er bygget, oversat og implementeret fra dette repo.

---

> Skærmbilleder i disse dokumenter er taget i panelets mørke tema. Panelet starter mørkt, medmindre dit OS foretrækker lyst; brug tema-kontakten i topbjælken til at skifte.

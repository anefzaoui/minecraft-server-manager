---
title: 'Aan de slag'
description: 'Installeer Minecraft Server Manager en voltooi de eerste installatie: de systeemcontrole, uw tijdzone en het beheerdersaccount.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Terug naar de documentatie-index](/docs/)

## Eerste installatie

De eerste keer dat u het paneel opent, begeleidt een korte installatiewizard u hierbij:

1.  **Systeemcontrole** controleert of Docker bereikbaar is, Node.js up-to-date is en de gegevensmap beschrijfbaar is. Als Docker nog niet draait, kunt u toch doorgaan; het maken en starten van servers wacht tot het wel het geval is.
2.  **Maak uw beheerdersaccount aan**. Dit is het enige account dat bestaat totdat u meer toevoegt, en het heeft volledige controle. Kies een gebruikersnaam (2 tot 32 tekens) en een wachtwoord van minimaal 8 tekens. U bent direct aangemeld zodra het is aangemaakt.
3.  **Paneelconfiguratie** (optioneel): een openbaar domein om spelers te tonen in verbindingsadressen, een CurseForge API-sleutel en uw tijdzone. Dit alles kan later worden gewijzigd in **Instellingen**.

De laatste stap biedt **Maak een server aan** of **Ga naar het dashboard**.

![De stap Systeemcontrole van de eerste installatie](/docs/images/setup-system-check.png)

> **Blootgestelde installaties zijn PIN-beveiligd.** Als u het paneel start op een niet-loopback adres (`PANEL_HOST` anders dan `127.0.0.1`), vraagt de installatiepagina ook om een **6-cijferige PIN**. Het paneel drukt deze af naar de console bij het opstarten. Voer deze in samen met uw gebruikersnaam en wachtwoord. Dit voorkomt dat een vreemde die als eerste de poort bereikt, het beheerdersaccount claimt. De PIN verdwijnt zodra het beheerdersaccount bestaat.

## Inloggen

Na de installatie wordt het paneel beschermd door een inlogscherm. Voer uw gebruikersnaam en wachtwoord in om door te gaan.

![Inloggen](/docs/images/login.png)

Als [tweefactorauthenticatie](/docs/two-factor-authentication/) is ingeschakeld voor uw account, wordt u direct na uw wachtwoord gevraagd om een 6-cijferige code uit uw authenticatie-app.

## De weg vinden

Alles hangt af van de linkerzijbalk:

- **Dashboard** - alle servers in één oogopslag ([details](/docs/dashboard/)).
- **Servers**, **Modpacks**, **Worlds**, **Blueprints** - servers en hun inhoud maken en beheren.
- **Updates**, **Backups**, **Schema's**, **Opslag**, **Activiteit** - de operationele kant: wat verouderd is, uw snapshots, automatisering, schijfgebruik en het auditlogboek.
- **Machtigingen** (onderaan, alleen voor beheerders): wat elke gebruiker mag doen op elke server ([details](/docs/users-and-roles/#per-server-permissions)).
- **Instellingen** (onderaan, alleen voor beheerders): API-sleutels, paneelconfiguratie, standaardinstellingen voor nieuwe servers, [backupretentie](/docs/backups/#retention), gebruikers, inlogbeveiliging en de openbare API.

Onder deze opties toont de zijbalk uw servers. Het openen van een server toont zijn eigen tabbladen: **Overzicht**, **Console**, **Spelers**, **Mods**, **Wereld**, **Backups**, **Monitoring** en **Instellingen**, de meeste met gerelateerde subtabbladen (bijvoorbeeld, **Instellingen → Configuratie** bevat de instellingen van de server en zijn gamepoort). Zie [Een enkele server](/docs/servers/#a-single-server).

De bovenste balk bevat de knop **Maak een server aan**, een **themawisselaar** (donker/licht) en uw **accountmenu**, waar u uw profielfoto kunt wijzigen, [tweefactorauthenticatie](/docs/two-factor-authentication/) kunt beheren of kunt afmelden.

## Op een telefoon of tablet

Elke pagina is eerst ontworpen voor een smal scherm en wordt breder vanaf daar: de zijbalk verdwijnt achter de menuknop, gegevenstabellen worden kaarten, werkbalken vouwen zich op en de wereld-controls-rail wordt samengeklapt tot een kaart die u opent wanneer u deze nodig heeft. Knoppen en chips hebben een echte aanraakdoelgrootte. Niets is alleen voor desktops.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Dashboard op een telefoon" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Serveroverzicht op een telefoon" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Console op een telefoon" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Mods-tabblad op een telefoon" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Versiecompatibiliteit op een telefoon" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Instellingen op een telefoon" width="180">
</p>

## Wat u nodig heeft

Het paneel communiceert met Docker om servers te draaien, dus het heeft toegang nodig tot een Docker-daemon (Docker Desktop of een Docker Engine-socket). Wanneer Docker bereikbaar is, toont de Docker-tegel op het dashboard **Verbonden** en de versie ervan. Als het niet draait, blijft het paneel wel werken. U kunt servers pas starten totdat de daemon actief is.

## Volgende stappen

- [Maak uw eerste server aan →](/docs/servers/)
- [Beveilig uw account met 2FA →](/docs/two-factor-authentication/)

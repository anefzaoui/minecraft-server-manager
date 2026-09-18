---
title: 'Aan de slag'
description: 'De eerste keer dat je het paneel opent, wordt je gevraagd om een beheerdersaccount aan te maken.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Terug naar de documentatie-index](/docs/)

## Eerste installatie

De eerste keer dat je het paneel opent, wordt je gevraagd om een beheerdersaccount aan te maken. Dit is het enige account dat bestaat totdat je er meer toevoegt, en het heeft volledige controle.

Kies een gebruikersnaam en een wachtwoord van minimaal 8 tekens. Dat is alles: je bent ingelogd en wordt direct naar het dashboard geleid.

> **Blootgestelde installaties zijn PIN-beveiligd.** Als je het paneel bindt aan een niet-loopback adres (`PANEL_HOST` anders dan `127.0.0.1`), vraagt de installatiepagina ook om een **6-cijferige PIN**. Het paneel drukt deze bij het opstarten af naar de console. Voer deze in samen met je gebruikersnaam en wachtwoord. Dit voorkomt dat een vreemde die als eerste de poort bereikt, het beheerdersaccount kan claimen. De PIN verdwijnt zodra het beheerdersaccount bestaat.

## Inloggen

Na de installatie wordt het paneel beschermd door een inlogscherm. Voer je gebruikersnaam en wachtwoord in om verder te gaan.

![Inloggen](/docs/images/login.png)

Als [tweefactorauthenticatie](/docs/two-factor-authentication/) is ingeschakeld voor je account, wordt je direct na je wachtwoord gevraagd om een 6-cijferige code uit je authenticatie-app.

## De weg vinden

Alles hangt af van de linkerbalk:

- **Dashboard** - alle servers in één oogopslag ([details](/docs/dashboard/)).
- **Servers**, **Modpacks**, **Worlds**, **Blueprints** - servers en hun inhoud maken en beheren.
- **Updates**, **Backups**, **Schedules**, **Storage**, **Activity** - de operationele kant: wat is verouderd, je snapshots, automatisering, schijfgebruik en het auditlogboek.
- **Instellingen** (onderaan): gebruikers, API-sleutels en paneelconfiguratie.

De bovenste balk bevat de knop **Maak een server aan**, een **themawisselaar** (donker/licht) en je **accountmenu**, waar je [tweefactorauthenticatie](/docs/two-factor-authentication/) kunt beheren of kunt uitloggen.

## Op een telefoon of tablet

Elke pagina is eerst ontworpen voor een smal scherm en wordt breder: de zijbalk verdwijnt achter de menuknop, gegevenstabellen worden kaarten, werkbalken worden omgezet en de wereld-bedieningsrail wordt samengeklapt tot een kaart die je opent wanneer je deze nodig hebt. Knoppen en chips hebben een echte aanraakdoelgrootte. Niets is alleen voor desktop.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Dashboard op een telefoon" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Serveroverzicht op een telefoon" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Console op een telefoon" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Mods-tabblad op een telefoon" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Instellingen op een telefoon" width="180">
</p>

## Wat je nodig hebt

Het paneel communiceert met Docker om servers te draaien, dus het heeft toegang nodig tot een Docker-daemon (Docker Desktop of een Docker Engine socket). Wanneer Docker bereikbaar is, toont de Docker-tegel van het dashboard **Connected** en de versie ervan. Zo niet, dan draait het paneel nog steeds. Je kunt servers pas starten totdat de daemon actief is.

## Volgende stappen

- [Maak je eerste server aan →](/docs/servers/)
- [Beveilig je account met 2FA →](/docs/two-factor-authentication/)

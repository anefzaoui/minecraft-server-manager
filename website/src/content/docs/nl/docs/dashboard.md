---
title: 'Het dashboard'
description: 'Het dashboard is je thuisbasis: elke server, de live status ervan en een lopende feed van wat er is gebeurd.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Terug naar de documentatie-index](/docs/)

Het dashboard is je thuisbasis: elke server, de live status ervan en een constante stroom van wat er is gebeurd.

![Dashboard](/docs/images/dashboard.png)

## De samenvattingskaarten

Bovenaan:

- **Servers online**: hoeveel van je servers momenteel draaien, van het totaal.
- **Spelers verbonden**: het totale aantal spelers op alle draaiende servers.
- **Updates beschikbaar**: hoeveel servers, packs of mods een nieuwere versie hebben ([zie Updates](/docs/updates/)).
- **Docker**: of het paneel de Docker daemon kan bereiken, en de versie ervan.

Een tweede rij voegt **Toegewezen geheugen** (en hoeveel er in gebruik is), **Gebruikte opslag** over alle serverdatamappen, **Gezondheid · 24u** (crashes, stops wegens geheugentekort en automatische herstarts in de afgelopen dag), en **Updates** opgesplitst in mods en server-level updates. Daaronder tellen **Servers per status** je servers in elke staat, en het **Resourceoverzicht** toont het aandeel van elke server in geheugen en CPU.

## Serverkaarten

Elke server wordt weergegeven als een kaart met zijn status (Draait, Starten, Gestopt, Gecrasht, en tussenliggende statussen zoals Ongezond of Vastgelopen), het type en de Minecraft-versie, de gamepoort en de tags. Elke kaart toont **spelers** en **schijf**gebruik tegen de limiet; draaiende servers tonen ook live **CPU** en **geheugen**, continu bijgewerkt.

Klik op een kaart om die server te openen. De lege **Maak een server** kaart en de **Maak een server** knop in de bovenbalk starten beide de [aanmaak-wizard](/docs/servers/).

Je kunt je servers doorzoeken (op naam, type, versie of tag), sorteren op status, naam, grootte, laatst gestart of aangemaakt, en schakelen tussen raster- en lijstweergaven met de schakelaar aan de rechterkant.

## Recente activiteit

De feed onderaan toont de meest recente vermeldingen uit het door de mens leesbare auditlogboek van het paneel: logins, back-ups, blueprint-exports, updatecontroles, wijzigingen in chatcommando's, serverstarts en -stops, en meer. Elke vermelding is getagd met de server waartoe deze behoort (of het paneel zelf) en hoe lang geleden deze plaatsvond. **Bekijk alles** opent de volledige geschiedenis op de [Activiteit](/docs/activity/) pagina.

---
title: 'Live map'
description: 'Schakel met één klik een live 3D-kaart van de wereld van een server in met BlueMap, die uitsluitend via de aanmelding van het paneel wordt aangeboden.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Terug naar de documentatie-index](/docs/)

Het tabblad **World → Map** van een server toont een live, zoombare 3D-kaart van zijn wereld, gegenereerd door [BlueMap](https://bluemap.bluecolored.de/) (gratis en open source), met spelersposities en elke dimensie. Het paneel installeert het, configureert het en serveert het; je hoeft er nooit een poort voor te openen of een configuratiebestand voor te bewerken.

## Inschakelen

1. Open de server, ga dan naar **World → Map**.
2. Druk op **Live Map inschakelen**. Het paneel installeert de BlueMap-build die overeenkomt met de loader en Minecraft-versie van de server van Modrinth, accepteert de download van BlueMap's resources voor je, en kiest een gratis poort ervoor.
3. Herstart de server (de wijziging wordt toegepast bij de volgende start, en de server wordt gemarkeerd als wachtend op een herstart).

BlueMap rendert op de achtergrond, dus een nieuwe kaart heeft een paar minuten nodig om de eerste tegels te tekenen. Tot dan zegt het tabblad dat de kaart nog niet beschikbaar is en controleert het zichzelf opnieuw. Zodra deze beschikbaar is, opent **Volledig scherm** de kaart in een eigen browsertabblad.

Het werkt op servers met een mod loader (Fabric, Quilt, Forge, NeoForge) en op plugin-servers (Paper, Purpur en de rest van de Paper-familie, Spigot), inclusief modpack-servers. Vanilla-servers hebben geen BlueMap-build, en het tabblad geeft dit aan.

## Wie kan het zien

De kaart wordt alleen via het paneel geserveerd, achter de inlog: iedereen die de server in het paneel kan bekijken, kan de kaart openen, en niemand anders. De eigen poort van BlueMap is nooit bedoeld om open te staan voor internet ([poorten in één oogopslag](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Het in- of uitschakelen van de kaart vereist de **Settings**-permissie van de server ([gebruikers & rollen](/docs/users-and-roles/#per-server-permissions)).

Wanneer het paneel zelf in Docker draait, bereikt het BlueMap binnen de container van de server; de [README](https://github.com/anefzaoui/minecraft-server-manager#installation) legt de details uit voor reverse-proxy-opstellingen.

## Uitschakelen

**Kaart uitschakelen** verwijdert de door het paneel geïnstalleerde BlueMap jar en maakt de poort vrij, opnieuw vanaf de volgende herstart. De wereld zelf blijft onaangetast; gerenderde kaarttegels blijven in de map van de server staan totdat je ze verwijdert op het tabblad **Files**.

Gerelateerd: [werelden & bestanden](/docs/worlds-and-files/), [uitnodigingen & statuspagina](/docs/invites-and-status-page/).

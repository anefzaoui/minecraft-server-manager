---
title: 'Live-Karte'
description: 'Schalte mit einem Klick eine Live-3D-Karte der Spielwelt deines Servers mit BlueMap frei, die nur über die Anmeldemaske des Panels bereitgestellt wird.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Der Tab **Welt → Karte** eines Servers zeigt eine live, zoom- und schwenkbare 3D-Karte seiner Welt, gezeichnet von [BlueMap](https://bluemap.bluecolored.de/) (kostenlos und Open Source), mit Spielerpositionen und jeder Dimension. Das Panel installiert, konfiguriert und stellt sie bereit; Sie müssen dafür niemals einen Port öffnen oder eine Konfigurationsdatei bearbeiten.

## Einschalten

1. Öffnen Sie den Server, dann **Welt → Karte**.
2. Drücken Sie **Live-Karte aktivieren**. Das Panel installiert den BlueMap-Build, der zum Loader und zur Minecraft-Version des Servers passt, von Modrinth, akzeptiert den Download der BlueMap-Ressourcen für Sie und wählt einen freien Port dafür aus.
3. Starten Sie den Server neu (die Änderung wird beim nächsten Start wirksam, und der Server wird als auf einen Neustart wartend markiert).

BlueMap rendert im Hintergrund, sodass eine neue Karte einige Minuten benötigt, um ihre ersten Kacheln zu zeichnen. Bis dahin zeigt der Tab an, dass die Karte noch nicht verfügbar ist, und prüft selbstständig erneut. Sobald sie verfügbar ist, öffnet **Vollbild** die Karte in einem eigenen Browser-Tab.

Es funktioniert auf Servern mit einem Mod-Loader (Fabric, Quilt, Forge, NeoForge) und auf Plugin-Servern (Paper, Purpur und der Rest der Paper-Familie, Spigot), einschließlich Modpack-Servern. Vanilla-Server haben keinen BlueMap-Build, und der Tab zeigt dies an.

## Wer kann sie sehen

Die Karte wird ausschließlich über das Panel bereitgestellt, hinter dessen Anmeldeprozess: Jeder, der den Server im Panel sehen kann, kann seine Karte öffnen, und niemand sonst. Der eigene Port von BlueMap ist niemals dafür vorgesehen, das Internet zu öffnen ([Ports im Überblick](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Das Ein- oder Ausschalten der Karte erfordert die **Einstellungen**-Berechtigung des Servers ([Benutzer & Rollen](/docs/users-and-roles/#per-server-permissions)).

Wenn das Panel selbst in Docker läuft, greift es auf BlueMap innerhalb des Containers des Servers zu; das [README](https://github.com/anefzaoui/minecraft-server-manager#installation) erklärt die Details für Reverse-Proxy-Setups.

## Ausschalten

**Karte deaktivieren** entfernt das vom Panel installierte BlueMap-JAR und gibt seinen Port wieder frei, wiederum ab dem nächsten Neustart. Die Welt selbst bleibt unberührt; gerenderte Kartenkacheln verbleiben im Ordner des Servers, bis Sie sie auf dem Tab **Dateien** löschen.

Verwandt: [Welten & Dateien](/docs/worlds-and-files/), [Einladungen & Statusseite](/docs/invites-and-status-page/).

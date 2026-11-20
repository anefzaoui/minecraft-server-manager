---
title: 'Das Dashboard'
description: 'Das Dashboard ist deine Basis: jeder Server, sein Live-Status und ein laufender Feed dessen, was passiert ist.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Das Dashboard ist Ihre Basis: jeder Server, sein Live-Status und ein fortlaufender Feed dessen, was passiert ist.

![Dashboard](/docs/images/dashboard.png)

## Die Zusammenfassungs-Kacheln

Ganz oben:

- **Server online**: wie viele Ihrer Server gerade laufen, im Verhältnis zur Gesamtzahl.
- **Spieler verbunden**: die Gesamtzahl der Spieler auf allen laufenden Servern.
- **Updates verfügbar**: wie viele Server, Packs oder Mods eine neuere Version haben ([siehe Updates](/docs/updates/)).
- **Docker**: ob das Panel den Docker-Daemon erreichen kann und dessen Version.

Eine zweite Reihe fügt **Zugewiesener Arbeitsspeicher** (und dessen Nutzung), **Genutzter Speicherplatz** über alle Server-Datenordner hinweg, **Gesundheit · 24h** (Abstürze, Out-of-Memory-Stopps und automatische Neustarts am letzten Tag) und **Updates** aufgeteilt in Mod- und Server-Level-Updates hinzu. Darunter zählen **Server nach Status** Ihre Server in jedem Zustand und die **Ressourcenübersicht** zeigt den Anteil von Arbeitsspeicher und CPU jedes Servers an.

## Server-Karten

Jeder Server wird als Karte mit seinem Status (Läuft, Startet, Gestoppt, Abgestürzt und Zwischenzustände wie Nicht Gesund oder Blockiert), dem Typ und der Minecraft-Version, seinem Game-Port und seinen Tags angezeigt. Jede Karte zeigt **Spieler** und **Festplattennutzung** im Verhältnis zum Kontingent; laufende Server zeigen auch Live-**CPU** und **Arbeitsspeicher**, die kontinuierlich aktualisiert werden.

Klicken Sie auf eine Karte, um diesen Server zu öffnen. Die leere **Server erstellen**-Karte und die Schaltfläche **Server erstellen** in der oberen Leiste starten beide den [Erstellungs-Assistenten](/docs/servers/).

Sie können Ihre Server durchsuchen (nach Name, Typ, Version oder Tag), sie nach Status, Name, Größe, zuletzt gestartet oder erstellt sortieren und mit dem Schalter rechts zwischen Raster- und Listenansicht wechseln.

## Aktuelle Aktivitäten

Der Feed unten zeigt die neuesten Einträge aus dem für Menschen lesbaren Audit-Trail des Panels: Logins, Backups, Blueprint-Exporte, Update-Prüfungen, Änderungen an Chat-Befehlen, Serverstarts und -stopps und mehr. Jeder Eintrag ist mit dem Server, zu dem er gehört (oder dem Panel selbst), und wie lange er her ist, gekennzeichnet. **Alle anzeigen** öffnet die vollständige Historie auf der Seite [Aktivität](/docs/activity/).

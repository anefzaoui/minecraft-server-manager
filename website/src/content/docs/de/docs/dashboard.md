---
title: 'Das Dashboard'
description: 'Das Dashboard ist deine Basis: jeder Server, sein Live-Status und ein laufender Feed dessen, was passiert ist.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/dashboard.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Das Dashboard ist Ihre Basis: jeder Server, sein Live-Status und ein laufender Feed dessen, was gerade passiert.

![Dashboard](/docs/images/dashboard.png)

## Die Übersichts-Kacheln

Ganz oben:

- **Server online** - wie viele Ihrer Server gerade laufen.
- **Spieler verbunden** - die Gesamtzahl der Spieler auf allen laufenden Servern.
- **Updates verfügbar** - wie viele Server, Packs oder Mods eine neuere Version haben ([siehe Updates](/docs/updates/)).
- **Docker** - ob das Panel den Docker-Daemon erreichen kann und dessen Version.

## Server-Karten

Jeder Server wird als Karte mit seinem Status (Läuft, Startet, Gestoppt, Abgestürzt), dem Typ und der Minecraft-Version sowie seinem Spiele-Port angezeigt. Für laufende Server erhalten Sie außerdem Live-Daten zur Auslastung von **Spielern**, **CPU**, **Arbeitsspeicher** und **Festplatte**, die kontinuierlich aktualisiert werden.

Klicken Sie auf eine Karte, um diesen Server zu öffnen. Die leere **Server erstellen**-Karte und die Schaltfläche **Server erstellen** in der oberen Leiste starten beide den [Erstellungsassistenten](/docs/servers/).

Sie können Ihre Server suchen und sortieren und mit dem Schalter rechts zwischen Raster- und Listenansicht wechseln.

## Aktuelle Aktivitäten

Der Feed am unteren Rand ist eine Live- und für Menschen lesbare Audit-Trail: Logins, Backups, Blueprint-Exporte, Update-Prüfungen, Chat-Befehlsänderungen, Serverstarts und -stopps und mehr. Jeder Eintrag ist mit dem Server, zu dem er gehört (oder dem Panel selbst), und dem Zeitpunkt, wann er stattgefunden hat, gekennzeichnet. Die vollständige Historie finden Sie auf der Seite [Aktivitäten](/docs/activity/).

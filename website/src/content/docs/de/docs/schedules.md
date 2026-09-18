---
title: 'Zeitpläne'
description: 'Die Seite Zeitpläne automatisiert wiederkehrende Aufgaben mit Cron-Ausdrücken.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Die Seite **Zeitpläne** automatisiert wiederkehrende Aufgaben mit Cron-Ausdrücken. Kein externer Cron, keine Skripte.

![Zeitpläne](/docs/images/schedules.png)

## Was Sie planen können

- **Neustarts** – ein nächtlicher Neustart, um einen langlebigen Server stabil zu halten.
- **Backups** – regelmäßige Schnappschüsse (auf der Seite [Backups](/docs/backups/) als `scheduled` markiert).
- **Befehle** – Ausführen beliebiger Serverbefehle nach einem Zeitplan.
- **Update-Prüfungen** – periodisches Aktualisieren von Veraltetem.

Jeder Zeitplan zielt auf einen bestimmten Server (oder das Panel global) ab, läuft mit seinem eigenen Cron-Ausdruck und kann aktiviert oder deaktiviert werden, ohne ihn zu löschen. Die letzte Ausführungszeit wird angezeigt, damit Sie bestätigen können, dass er ausgeführt wird.

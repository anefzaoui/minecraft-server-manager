---
title: 'Zeitpläne'
description: 'Die Seite Zeitpläne automatisiert wiederkehrende Aufgaben mit Cron-Ausdrücken. Kein externer Cron, keine Skripte.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Die Seite **Zeitpläne** automatisiert wiederkehrende Aufgaben mit Cron-Ausdrücken. Kein externer Cron, keine Skripte.

![Zeitpläne](/docs/images/schedules.png)

## Was Sie planen können

- **Neustarts**: Ein nächtlicher Neustart, um einen langlebigen Server gesund zu halten.
- **Stopps und Starts**: Einen Server über Nacht herunterfahren und am Morgen wieder hochfahren.
- **Backups**: Regelmäßige Schnappschüsse (auf der Seite [Backups](/docs/backups/) als `scheduled` markiert). Ein Backup-Zeitplan kann die Welt auch nach jedem Backup verkleinern ([Welt verkleinern](/docs/world-shrink/)). Jeder neue Server erhält automatisch einen täglichen Backup-Zeitplan.
- **Befehle**: Führen Sie einen beliebigen Serverbefehl nach einem Zeitplan aus.
- **Update-Prüfungen**: Aktualisieren Sie periodisch, was veraltet ist. Die geplante Prüfung ist auch das, was Updates für Server anwendet, die auf [Auto-Update](/docs/modpacks/#update-policy) eingestellt sind.

Jeder Zeitplan zielt auf einen bestimmten Server (oder das Panel global) ab, läuft mit seinem eigenen Cron-Ausdruck und kann aktiviert oder deaktiviert werden, ohne ihn zu löschen. Der Editor zeigt die nächsten Ausführungszeiten an, während Sie tippen. Cron-Zeiten folgen der Zeitzone des Panels (eingestellt in **Einstellungen**), und die Tabelle zeigt die nächste Ausführung jedes Zeitplans an. Jede Ausführung wird als Verlaufereignis aufgezeichnet, ebenso wie eine fehlgeschlagene Ausführung.

Das Panel richtet auch eigene Wartungszeitpläne beim ersten Start ein, die Sie neu terminieren oder ausschalten können: eine tägliche Update-Prüfung, ein Speicher-Rescan alle sechs Stunden, ein tägliches Löschen alter temporärer Dateien, eine Überprüfung ablaufender Sperren alle 15 Minuten (Aufhebung temporärer Sperren, die abgelaufen sind) und ein nächtliches Auffüllen von Inhaltsmetadaten (Auffüllen fehlender Mod-Namen und Symbole).

## Wenn der Server beschäftigt ist

Ein geplantes Backup oder ein Start, der seinen Server mitten in einer anderen Aktion findet (eine Wiederherstellung, eine Backup-Bereinigung, eine Portänderung), wartet und versucht es jede Minute erneut, bis die Aktion abgeschlossen ist, für bis zu 30 Minuten. Ein wartender Start wird abgebrochen, wenn jemand den Server in der Zwischenzeit startet oder stoppt. Ein geplanter Neustart oder Stopp wird nicht wiederholt: Er wird übersprungen und beim nächsten Mal erneut ausgeführt.

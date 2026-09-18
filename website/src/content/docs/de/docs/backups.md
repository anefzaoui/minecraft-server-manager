---
title: 'Backups'
description: 'Die Seite „Backups“ zeigt jeden Schnappschuss Ihrer gesamten Flotte mit Größe, Grund und Alter an.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Die Seite **Backups** zeigt jeden Schnappschuss Ihrer gesamten Flotte an, mit Größe, Grund und Alter.

![Backups](/docs/images/backups.png)

## Ein Backup erstellen

Über den Tab **Backups** eines Servers (oder über einen [Zeitplan](/docs/schedules/)) können Sie das gesamte Serververzeichnis mit einem Klick sichern. Das Panel beruhigt zuerst die Welt (`save-off` → `save-all`), komprimiert die Daten, und aktiviert dann das Speichern wieder (`save-on`), sodass Backups auch auf einem laufenden Server konsistent sind. Die Komprimierung läuft in einem separaten Hintergrund-Thread, um das Panel nicht zu blockieren. Jedes Backup kann eine Notiz enthalten.

Jedes Archiv wird **integritätsgeprüft**, sobald es geschrieben wird: Das Panel öffnet das Zip-Archiv erneut und liest dessen Verzeichnis. Ein beschädigtes oder nicht öffnungsfähiges Archiv wird gelöscht und der Backup-Vorgang schlägt sofort fehl, anstatt dass das Problem Monate später auftritt, wenn eine Wiederherstellung die einzige Rettung vor Datenverlust ist. Ein Archiv ohne Einträge (ein Server, der nie gestartet wurde) ist erlaubt, wird aber im Ereignisprotokoll markiert.

Aktivieren Sie **"Welt danach auch verkleinern"** (auf dem Backups-Tab oder in einem Backup-Zeitplan), um selten besuchte Chunks zu entfernen, sobald das Archiv sicher geschrieben wurde (siehe **[Welt verkleinern](/docs/world-shrink/)**). Die Verkleinerung läuft nur, wenn der Server gestoppt ist; auf einem laufenden Server findet das Backup trotzdem statt und die Verkleinerung wird übersprungen.

![Server-Backups](/docs/images/server-backups.png)

## Backup-Gründe

Backups werden nach dem Grund ihrer Erstellung gekennzeichnet:

- **manuell** - Sie haben auf den Knopf gedrückt.
- **geplant** - Erstellt durch einen [Zeitplan](/docs/schedules/). Jeder neue Server erhält außerdem automatisch ein tägliches geplantes Backup (gestaffelt zwischen 02:00 und 05:59), sodass ein Server vom ersten Tag an automatisch abgedeckt ist, nicht erst vor Updates.
- **vor-Update** - Automatisch vor einem Pack-Upgrade erstellt, sodass ein Upgrade immer rückgängig gemacht werden kann.
- **vor-Wiederherstellung** - Automatisch direkt vor einer Wiederherstellung oder einem Welten-Reset erstellt, als Sicherheitsnetz, falls die Wiederherstellung nicht wie gewünscht verläuft.

## Aufbewahrung

Die Aufbewahrung ist **pro Server, pro Grund** begrenzt: Die neuesten in jeder Gruppe werden aufbewahrt, ältere werden nach jedem erfolgreichen Backup automatisch gelöscht:

| Grund                 | Aufbewahrt |
| --------------------- | ---------- |
| geplant               | 10         |
| vor-Update            | 10         |
| manuell               | 20         |
| vor-Wiederherstellung | 5          |

`vor-Wiederherstellung` hat einen eigenen kleinen Speicherplatz, damit ein automatisches Sicherheitsbackup niemals ein von Ihnen bewusst aufbewahrtes `manuell`-Backup verdrängen kann.

Zwei optionale Obergrenzen gelten zusätzlich zu den pro-Grund-Anzahl, beide standardmäßig deaktiviert: ein **maximales Alter** (Backups, die älter als N Tage sind, werden unabhängig vom Grund gelöscht) und eine **maximale Gesamtgröße** pro Server (die ältesten Backups werden gelöscht, bis die Gesamtgröße passt, wobei `vor-Wiederherstellung`-Backups zuerst betroffen sind). Das neueste Backup eines Servers wird durch keine dieser Obergrenzen gelöscht. Alle diese Einstellungen können global auf der Einstellungsseite geändert und pro Server auf dessen Backups-Tab überschrieben werden.

Backups können in der Backup-Liste **umbenannt** werden (der Umbenennen-Knopf in jeder Zeile). Das Archiv auf der Festplatte und der Eintrag im Panel bewegen sich zusammen, sodass Download, Wiederherstellung und Aufbewahrung mit dem neuen Namen weiterhin funktionieren.

![Ein Backup umbenennen](/docs/images/backup-rename.png)

> Die Aufbewahrung ist automatisch begrenzt, aber große modifizierte Archive zählen weiterhin zur [Festplattenquote](/docs/storage/) eines Servers. Behalten Sie also die Gesamtsumme für große Packs im Auge.

## Wiederherstellen

Das Wiederherstellen eines Backups stoppt den Server (überprüft, ob der Container wirklich gestoppt ist, bevor Dateien berührt werden), erstellt ein `vor-Wiederherstellung`-Sicherungsbackup, ersetzt das **gesamte Serververzeichnis** durch den Schnappschuss und lässt es gestoppt, damit Sie es neu starten können. Da Pack-Upgrades immer zuerst ein `vor-Update`-Backup erstellen, können Sie ein fehlerhaftes Upgrade immer rückgängig machen.

## Die eigene Datenbank des Panels

Server-Backups decken nur die Per-Server-Weltverzeichnisse ab. Die eigene Datenbank des Panels (`panel.db`, die Benutzer, Rollen, 2FA-Geheimnisse, Zeitpläne, Pack-Pins und den Verlauf enthält) wird separat durch den täglichen Wartungs-Timer gesichert:

- `VACUUM INTO` schreibt eine konsistente, defragmentierte Kopie nach `data/backups/_panel/`; die neuesten **14** werden aufbewahrt.
- Beim Start führt das Panel `PRAGMA integrity_check` aus und protokolliert lautstark, wenn es fehlschlägt, und verweist Sie auf `data/backups/_panel` für die neueste funktionierende Kopie.

Wenn Sie den gesamten `data/`-Baum sichern (er enthält auch `.secret-key`, den Schlüssel für die Verschlüsselung im Ruhezustand), haben Sie alles gesichert.

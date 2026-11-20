---
title: 'Backups'
description: 'Die Seite „Backups“ zeigt jeden Schnappschuss Ihrer gesamten Flotte an, mit Größe, Grund und Alter, filterbar nach Server und Grund.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Zurück zum Index](/docs/)

Die Seite **Backups** zeigt jeden Schnappschuss Ihrer gesamten Flotte an, mit Größe, Grund und Alter, filterbar nach Server und Grund.

![Backups](/docs/images/backups.png)

## Ein Backup erstellen

Über den Tab **Backups** eines Servers (oder über einen [Zeitplan](/docs/schedules/)) können Sie das gesamte Serververzeichnis mit einem Klick sichern. Das Panel hält zuerst die Welt an (`save-off` → `save-all`), komprimiert die Daten und aktiviert dann das Speichern wieder (`save-on`), sodass Backups auch auf einem laufenden Server konsistent sind. Die Komprimierung läuft in einem separaten Hintergrund-Thread, um das Panel nicht zu blockieren. Ein über die API gestartetes Backup kann eine Notiz enthalten.

Jedes Archiv wird **integritätsgeprüft**, sobald es geschrieben wird: Das Panel öffnet das Zip-Archiv erneut und liest dessen Verzeichnis. Ein beschädigtes oder nicht zu öffnendes Archiv wird gelöscht und der Backup-Vorgang schlägt sofort fehl, anstatt dass das Problem Monate später auftritt, wenn eine Wiederherstellung die einzige Rettung vor Datenverlust ist. Ein Archiv mit null Einträgen (ein Server, der noch nie gestartet wurde) ist erlaubt, wird aber im Ereignisprotokoll markiert.

Aktivieren Sie **"Welt danach auch verkleinern"** (auf dem Backups-Tab oder in einem Backup-Zeitplan), um selten besuchte Chunks zu entfernen, sobald das Archiv sicher geschrieben wurde (siehe **[Welt verkleinern](/docs/world-shrink/)**). Die Verkleinerung läuft nur, während der Server gestoppt ist; auf einem laufenden Server findet das Backup trotzdem statt und die Verkleinerung wird übersprungen.

![Server-Backups](/docs/images/server-backups.png)

## Backup-Gründe

Backups werden nach dem Grund ihrer Erstellung gekennzeichnet:

- **manuell**: Sie haben auf **Jetzt sichern** geklickt. Das Ersetzen der aktiven Welt eines Servers durch eine aus der Bibliothek nimmt ebenfalls zuerst ein `manual`-Backup vor.
- **geplant**: Erstellt durch einen [Zeitplan](/docs/schedules/). Jeder neue Server erhält außerdem automatisch ein tägliches geplantes Backup (gestaffelt zwischen 02:00 und 05:59), sodass ein Server vom ersten Tag an automatischen Schutz hat, nicht nur vor Updates.
- **vor-Update**: Automatisch vor einem Pack-Upgrade oder einem Minecraft-Versionswechsel erstellt, damit ein Upgrade immer rückgängig gemacht werden kann.
- **vor-Wiederherstellung**: Automatisch direkt vor einer Wiederherstellung oder einem Weltrücksetzerstellung erstellt, als Sicherheitsnetz, falls die Wiederherstellung nicht wie gewünscht verläuft.

## Aufbewahrung

Die Aufbewahrung ist **pro Server, pro Grund** begrenzt: Die neuesten in jeder Gruppe werden aufbewahrt, ältere werden nach jedem erfolgreichen Backup automatisch gelöscht:

| Grund                 | Standardmäßig behalten |
| --------------------- | ---------------------- |
| geplant               | 10                     |
| vor-Update            | 10                     |
| manuell               | 20                     |
| vor-Wiederherstellung | 5                      |

`pre-restore` (im Panel als Sicherheitskopien bezeichnet) hat seinen eigenen kleinen Speicherplatz, damit eine automatische Sicherheitskopie niemals eine von Ihnen bewusst aufbewahrte `manual`-Kopie verdrängen kann.

Zwei optionale Obergrenzen gelten zusätzlich zu den Pro-Grund-Anzahlen, beide standardmäßig deaktiviert: ein **maximales Alter** (Backups, die älter als N Tage sind, werden gelöscht, unabhängig von ihrem Grund) und eine **maximale Gesamtgröße** pro Server (die ältesten werden gelöscht, bis die Gesamtgröße passt: zuerst Sicherheitskopien, dann geplante, dann der Rest). Das neueste Backup eines Servers wird von keiner dieser Obergrenzen gelöscht.

### Ändern der Aufbewahrung

Administratoren legen die panelweite Richtlinie in der Karte **Backup-Aufbewahrung** auf der Seite **Einstellungen** fest (**Standardwerte einfügen** fügt die obigen Standardwerte wieder in das Formular ein, bereit zum Speichern). Ein Server kann sich in jedem der sechs Werte unterscheiden: Öffnen Sie dessen **Backups**-Tab und klappen Sie **Aufbewahrung für diesen Server** auf. Jedes Feld dort ist leer, es sei denn, der Server legt es fest, und ein leeres Feld folgt dem panelweiten Wert (innerhalb angezeigt). Ein Server kann also beispielsweise 3 geplante Backups aufbewahren und für alles andere die panelweiten Werte verwenden; das Leeren eines Feldes setzt es auf den panelweiten Wert zurück.

![Die Karte "Backup-Aufbewahrung" in den Einstellungen](/docs/images/settings-retention.png)

![Aufbewahrung für diesen Server auf dem Backups-Tab eines Servers](/docs/images/server-retention.png)

Das Speichern löscht nichts von sich aus. Wenn die neuen Limits bestehende Backups über das Limit hinaus belassen würden, listet das Panel pro Server auf, wie viele Backups jeder Art gelöscht würden, wie viel Speicherplatz dadurch freigegeben wird und wie alt das älteste davon ist. Es wird auch angegeben, wann ein Server bereits vor dieser Änderung über seinen Limits lag (z. B. nach einem früheren **Ab nächstem Backup**), da die Anwendung jetzt alles über dem Limit kürzt, nicht nur das, was diese Bearbeitung hinzufügt. Dann wird gefragt, wie die Limits angewendet werden sollen:

- **Jetzt entfernen** löscht genau die aufgelisteten Backups, nicht mehr: Ein inzwischen erstelltes Backup wartet auf die nächste Kürzung. Auf der Einstellungsseite wird ein Server, der sich mitten in einer Wiederherstellung, einem Backup oder einer ähnlichen Aktion befindet, übersprungen und wird nach seinem nächsten Backup gekürzt; auf dem eigenen Backups-Tab eines Servers werden Sie aufgefordert, es erneut zu versuchen, sobald diese Aktion abgeschlossen ist. Während die alten Backups eines Servers gelöscht werden (normalerweise Sekunden), müssen andere Aktionen auf diesem Server warten: Ein geplantes Backup oder Start, das/der dann eintrifft, versucht es jede Minute erneut (bis zu 30 Minuten), ein abgestürzter Server wird etwa 20 Sekunden nach Abschluss neu gestartet (bis zu 30 Minuten) und ein geplantes Neustart oder Stopp, das damit kollidiert, wird bis zur nächsten geplanten Zeit übersprungen.
- **Ab nächstem Backup** behält sie vorerst; jeder Server kürzt seine Backups beim nächsten Erstellungsvorgang, wie er es immer getan hat.

![Der Dialog, der auflistet, was neue Limits entfernen würden](/docs/images/retention-preview.png)

Ein Backup, das wiederhergestellt wird, wird während der Wiederherstellung niemals entfernt: Die Aufbewahrung lässt es in Ruhe (und löscht keine anderen Backups, um Platz dafür zu schaffen), und das manuelle Löschen wird bis zum Abschluss der Wiederherstellung verweigert.

Die gleichen Einstellungen sind für Skripte über Admin-API-Endpunkte verfügbar: `GET`/`POST /api/backups/retention` und `/api/servers/:id/backups/retention`. Panelweite Werte können nicht `null` sein. Für einen Server entfernt ein Wert von `null` (oder `""`) diesen einzelnen Schlüssel, sodass er wieder dem panelweiten Wert folgt, und `{ "reset": true }` entfernt sie alle. Unter jedem dieser beiden Pfade berichtet `POST …/preview`, was eine Änderung entfernen würde, ohne sie zu entfernen (`backups`, `bytes`, `servers`, `ids` und eine pro Server aufgeschlüsselte `byServer`-Übersicht), und `POST …/apply` wendet die gespeicherte Richtlinie jetzt an und antwortet mit `{ deleted, skipped }` panelweit (`skipped` zählt beschäftigte Server) oder `{ deleted }` für einen Server. Senden Sie das Vorschau-Token (`{ "token": "..." }`, 10 Minuten gültig) oder die IDs (`{ "ids": [...] }`), um nur diese zu löschen; ohne beides wird alles über dem Limit gelöscht. Eine pro Server angewendete Änderung auf einem beschäftigten Server antwortet mit 409.

Backups können in der Backup-Liste **umbenannt** werden (der Umbenennen-Button in jeder Zeile). Das Archiv auf der Festplatte und der Eintrag im Panel werden zusammen verschoben, sodass Download, Wiederherstellung und Aufbewahrung mit dem neuen Namen weiterhin funktionieren.

![Ein Backup umbenennen](/docs/images/backup-rename.png)

> Die Aufbewahrung ist automatisch begrenzt, aber große modifizierte Archive zählen weiterhin für das [Festplattenkontingent](/docs/storage/) eines Servers. Behalten Sie also die Gesamtsumme für große Packs im Auge.

## Wiederherstellen

Das Wiederherstellen eines Backups stoppt den Server (überprüft, ob der Container wirklich gestoppt wurde, bevor Dateien berührt werden), erstellt ein `pre-restore`-Sicherheitsbackup, ersetzt das **gesamte Serververzeichnis** durch den Schnappschuss und lässt es gestoppt, damit Sie es neu starten können. Das Archiv wird zuerst zur Seite entpackt und erst dann eingetauscht, wenn es vollständig extrahiert ist. Eine Wiederherstellung, die unterwegs fehlschlägt, hinterlässt die aktuellen Dateien unberührt. Da Pack-Upgrades immer zuerst ein `pre-update`-Backup erstellen, können Sie ein fehlerhaftes Upgrade immer rückgängig machen.

## Die eigene Datenbank des Panels

Server-Backups decken nur den Ordner jedes Servers ab. Die eigene Datenbank des Panels (`panel.db`, die Benutzer, Rollen, 2FA-Geheimnisse, Zeitpläne, Pack-Pins und den Verlauf enthält) wird separat durch den täglichen Wartungs-Timer gesichert:

- `VACUUM INTO` schreibt eine konsistente, defragmentierte Kopie nach `backups/_panel/` im Datenordner; die neuesten **14** werden aufbewahrt.
- Beim Start führt das Panel `PRAGMA integrity_check` aus und protokolliert lautstark, wenn es fehlschlägt, und verweist Sie auf `backups/_panel` für die neueste funktionierende Kopie.

Wenn Sie den gesamten Datenordner sichern (er enthält auch `.secret-key`, den Verschlüsselungsschlüssel im Ruhezustand), haben Sie alles gesichert.

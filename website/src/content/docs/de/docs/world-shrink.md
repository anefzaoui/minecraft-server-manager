---
title: 'Eine Welt verkleinern'
description: 'Verkleinern Sie eine Minecraft-Welt, indem Sie selten besuchte Chunks löschen, um Speicherplatz zurückzugewinnen und Backups zu beschleunigen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Zurück zum Dokumentenindex](/docs/)

Mit der Zeit breitet sich eine Welt aus: Jeder Ort, den ein Spieler jemals betreten, überflogen oder mit einer Enderperle erreicht hat, hinterlässt generierte Chunks auf der Festplatte, selbst wenn niemand jemals zurückgekehrt ist. **Welt verkleinern** entfernt die Chunks, in denen sich fast niemand aufgehalten hat, sodass die Welt weniger Platz einnimmt. Minecraft baut einen entfernten Bereich aus dem Weltsamen wieder auf, sobald jemand erneut dorthin reist. Dies ist also sicher für Land, das niemand nutzt. Alles, was ein Spieler jedoch an einem Ort _gebaut_ hat, an dem er sich kaum aufgehalten hat, würde ebenfalls verloren gehen. Deshalb sollten Sie zuerst ein Backup erstellen (das Backup ist das Rückgängigmachen).

## Was zählt als "selten besucht"

Jeder Chunk speichert, wie lange sich Spieler darin aufgehalten haben (Minecraft nennt dies `InhabitedTime`). Welt verkleinern entfernt standardmäßig jeden Chunk mit **weniger als 30 Sekunden** Gesamtspielerzeit. Der Dialog zum Verkleinern ermöglicht es Ihnen, diesen Schwellenwert (1 Sekunde bis 1 Stunde) und die Anzahl der Chunks um den Spawn herum, die beibehalten werden sollen (Standard 8, `0` schaltet den Spawn-Schutz aus), zu ändern.

Was immer beibehalten wird:

- Der Bereich um den **Spawn-Punkt** der Welt (aus `level.dat` gelesen) in der Oberwelt. Die Unterwelt, das Ende und benutzerdefinierte Dimensionen haben keinen Spawn-Bereich.
- Jeder Chunk, dessen Besuchszeit nicht gelesen werden konnte, zum Beispiel eine Welt, die mit einem Komprimierungsformat gespeichert wurde, das das Panel nicht dekodieren kann (LZ4). Die Vorschau und das Ergebnis zeigen Ihnen, wie viele solcher Chunks übersprungen wurden.

Jede Dimension der Welt wird abgedeckt: Bukkit-ähnliche Geschwisterordner (`world_nether`, `world_the_end`) sowie das Vanilla- und Forge/Fabric-Layout (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Wenn ein Chunk entfernt wird, gehen seine Entitäten und Dorfpunkte von Interesse mit ihm verloren. Ein neu generierter Chunk erbt daher keine veralteten Mobs, Loren oder Arbeitsplätze.

## Durchführung über den Reiter "Welten"

1. Erstellen Sie ein Backup über den Reiter **Backups**. Das Verkleinern über den Reiter "Welten" erstellt kein Backup für Sie.
2. Öffnen Sie **Welt → Welten**, suchen Sie die Welt und klicken Sie auf das Verkleinerungs-Symbol.
3. Klicken Sie auf **Vorschau**, um grob zu sehen, wie viele Chunks (und wie viele Megabyte) entfernt würden. Noch wird nichts geändert; eine Vorschau funktioniert, während der Server läuft.
4. Klicken Sie auf **Welt verkleinern**. Das Verkleinern bearbeitet die Welt-Dateien direkt, daher muss der Server gestoppt werden: Stoppen Sie ihn entweder zuerst oder aktivieren Sie die Option, ihn zu stoppen, zu verkleinern und dann in einem Durchgang wieder zu starten (der Server wird auch dann wieder gestartet, wenn das Verkleinern fehlschlägt). Der Fortschritt wird in der Taskleiste angezeigt.

![Welt verkleinern](/docs/images/world-shrink.png)

## Durchführung als Teil eines Backups

Aktivieren Sie auf dem Reiter **Backups** die Option **"Welt danach auch verkleinern"**, bevor Sie auf **Jetzt sichern** klicken. Das Backup-Archiv wird zuerst geschrieben (dieses Archiv ist Ihr Rückgängigmachen), dann wird die Welt verkleinert, aber nur, wenn der Server gestoppt ist. Wenn der Server läuft, wird das Backup trotzdem ausgeführt und das Verkleinern wird mit einem Hinweis übersprungen.

Geplante Backups haben die gleiche Option: Wählen Sie im Zeitplan-Editor die Aufgabe **Backup** und aktivieren Sie **"Welt nach jedem Backup verkleinern"**. Kombinieren Sie dies mit einem **Server stoppen**-Zeitplan einige Minuten früher, wenn Sie möchten, dass es unbeaufsichtigt ausgeführt wird.

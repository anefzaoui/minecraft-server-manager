---
title: 'Minecraft-Server-Backups, die wirklich wiederhergestellt werden können'
description: 'So erstellen Sie Minecraft-Server-Backups, die wirklich wiederhergestellt werden können: konsistente Kopien, die woanders aufbewahrt und mindestens einmal getestet werden.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Die meisten Server haben Backups. Deutlich weniger haben Backups, die funktionieren, und der Unterschied wird erst am schlimmsten Tag entdeckt. Drei Dinge trennen sie: Die Kopie ist konsistent, sie befindet sich woanders und jemand hat sie mindestens einmal wiederhergestellt.

## Die Welt kopieren, während sie nicht beschrieben wird

Ein laufender Server schreibt Regionsdateien kontinuierlich. Kopieren Sie sie mitten im Schreibvorgang, erhalten Sie eine Datei, die halb alt und halb neu ist, die entweder nicht geladen werden kann oder mit einem Loch im Boden geladen wird, wo sich früher die Basis von jemandem befand. Nichts warnt Sie, weil die Kopie erfolgreich war.

Es gibt zwei richtige Wege, eine Kopie zu erstellen:

1. **Stoppen Sie den Server**, kopieren Sie ihn, starten Sie ihn erneut. Einfach, ehrlich und unbeliebt wegen der Ausfallzeit.
2. **Weisen Sie das Spiel an, zuerst mit dem Schreiben aufzuhören.** Führen Sie `save-off` aus, dann `save-all flush`, warten Sie, bis es abgeschlossen ist, kopieren Sie, dann `save-on`. Die Welt ist für die Dauer der Kopie vollständig und ruhig.

Überspringen Sie niemals direkt zur Kopie. Ein Snapshot auf Dateisystem- oder Volume-Ebene ist nur dann in Ordnung, wenn er wirklich atomar ist, und ein `cp -r`, während Spieler Blöcke platzieren, ist es nicht.

## Mehr als nur die Welt sichern

Wenn Sie nur die Welt wiederherstellen, erhalten Sie das Terrain und verlieren den Server. Sie benötigen außerdem:

- `server.properties` und alles andere, was die Regeln festlegt.
- Die Mod- oder Plugin-JARs in den genauen Versionen, die liefen. Eine Welt wird ohne die Mods, die ihre Blöcke erstellt haben, nicht geladen.
- Spielerdaten, einschließlich `whitelist.json`, `ops.json` und der Ordner für Statistiken und Errungenschaften.
- Die Pack-Version, falls sie von einem Pack stammt. Das Aufschreiben zählt.

Der schnellste Funktionstest für jedes Backup: Könnten Sie diesen Server allein aus dem Archiv auf einer neuen Maschine neu aufbauen? Wenn die Antwort einen Satz erfordert, der mit "und dann würde ich neu installieren" beginnt, ist es kein vollständiges Backup.

## Eine Kopie auf derselben Festplatte ist kein Backup

Ein Backup, das sich auf der geschützten Maschine befindet, deckt genau einen Fehler ab: Sie haben etwas gelöscht. Es deckt nicht ab, dass die Festplatte ausfällt, der Anbieter das Konto sperrt oder ein Fehler das gesamte Verzeichnis löscht.

Halten Sie es einfach statt perfekt:

- Eine lokale Kopie für den häufigen Fall, dass jemand etwas beschädigt oder ein fehlerhaftes Update.
- Eine Kopie woanders. Eine andere Maschine, ein Objektspeicher oder ein Heim-NAS, das nächtlich über SSH zieht.
- Genügend Historie, um ein Problem zu überstehen, das Sie nicht sofort bemerkt haben. Beschädigungen werden oft Tage später entdeckt, und wenn Sie drei Tage Backups aufbewahren, haben Sie das gute bereits überschrieben.

Sieben tägliche Kopien plus vier wöchentliche decken fast jeden realen Vorfall ab und kosten nur sehr wenig Speicherplatz.

## Testen Sie eine Wiederherstellung, bevor Sie sie benötigen

Wählen Sie ein Backup aus, stellen Sie es auf einem separaten Server wieder her und verbinden Sie sich. Das ist der gesamte Test, er dauert fünfzehn Minuten und fängt alle klassischen Fehler ab: Das Archiv hat den Mods-Ordner vergessen, eine Welt, die eine Version benötigt, die Sie nicht mehr ausführen, Berechtigungen, die die Dateien unlesbar machen, ein abgebrochener Upload.

Machen Sie das einmal, wenn Sie die Backups einrichten, und noch einmal nach jeder größeren Änderung am Server.

## Größe und wie man sie im Griff behält

Welten wachsen, weil Spieler erkunden. Eine Welt, in der jemand zehntausend Blöcke geradeaus geflogen ist, trägt alle Chunks entlang dieser Linie für immer mit sich, und die meisten dieser Chunks werden nie wieder besucht.

Drei Hebel, geordnet nach dem, was sie am meisten zurückgeben:

1. **Unbesuchte Chunks trimmen.** Werkzeuge, die nach der zuletzt berührten Zeit beschneiden, entfernen typischerweise einen großen Teil einer gut bereisten Welt ohne sichtbare Auswirkungen im Spiel.
2. **Richtig komprimieren.** Regionsdateien komprimieren gut; Archive davon profitieren nicht von etwas Exotischem.
3. **Nicht jede stündliche Kopie ein Jahr lang aufbewahren.** Aufbewahrung schlägt Komprimierung.

## In Minecraft Server Manager

Backups folgen dem Pfad `save-off`, flush, copy, `save-on`, und ein während des Backups angeforderter Stopp oder Neustart wird verweigert, bis die Kopie abgeschlossen ist, anstatt damit zu konkurrieren. Das Archiv deckt das gesamte Serververzeichnis ab, sodass Mods, Konfiguration und Spieldaten mit der Welt transportiert werden.

Backups können neben Neustarts und Befehlen nach einem Zeitplan ausgeführt werden, und jeder neue Server startet mit einem täglichen Backup-Zeitplan. Die Aufbewahrungsfrist zählt jede Art separat, sodass die zehn geplanten Kopien, die sich von selbst ansammeln, nicht die eine verdrängen können, die Sie vor einer riskanten Änderung von Hand vorgenommen haben, und Alters- und Größenbeschränkungen gelten zusätzlich. Administratoren ändern all dies auf der Einstellungsseite oder pro Server auf dessen Backups-Tab. Die Wiederherstellung erfordert zuerst ein frisches Backup, sodass eine Wiederherstellung auf den falschen Zeitpunkt selbst rückgängig gemacht werden kann. Eine Welt kann allein oder als Teil eines Backups geschrumpft werden, was der Hebel ist, der für die Größe am wichtigsten ist.

Das gesamte Panel, einschließlich jedes Backups, befindet sich unter einem Verzeichnis. Das Kopieren dieses Verzeichnisses an einen anderen Ort ist die Off-Machine-Hälfte der Geschichte, und es ist absichtlich das Einzige, was Sie kopieren müssen.

Verwandt: [Backups im Panel](/docs/backups/), [Zeitpläne](/docs/schedules/), [Welt schrumpfen](/docs/world-shrink/), [Server auf einen anderen Host verschieben](/docs/guide-moving-a-server/).

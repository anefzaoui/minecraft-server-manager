---
title: 'Minecraft-Server auf einen anderen Host verschieben'
description: 'Eine Welt zu verschieben ist einfach. Einen Server zu verschieben, bei dem sich Spieler noch anmelden können, mit ihren Inventaren, Homes und Berechtigungen intakt, ist der Teil, der schiefgeht.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Das Verschieben einer Welt ist einfach. Das Verschieben eines Servers, bei dem sich Spieler immer noch anmelden können, mit ihren Inventaren, Homes und Berechtigungen intakt, ist der Teil, der schiefgeht. Die unten stehende Reihenfolge hält die Ausfallzeit auf wenige Minuten und bewahrt einen Weg zurück, falls die neue Maschine enttäuscht.

## Zuerst Bestandsaufnahme machen

Schreiben Sie diese auf, bevor Sie etwas anfassen. Jede einzelne davon hat eine Migration schlecht beendet, wenn sie angenommen statt überprüft wurde:

- **Minecraft-Version und Loader**, genau. 1.20.1 NeoForge ist nicht 1.20.1 Forge.
- **Die Mod- oder Plugin-Liste mit Versionen.** Die Welt wird ohne die Mods, die sie erstellt haben, nicht geladen.
- **Java-Version**, die der Minecraft-Version folgt.
- **`level-name`** aus `server.properties`. Der Weltordner heißt oft nicht `world`.
- **Online-Modus.** Wenn der alte Server mit `online-mode=false` lief und der neue mit aktiviertem Modus, oder umgekehrt, erhält jeder Spieler eine andere UUID und damit ein brandneues, leeres Inventar. Dies ist der schmerzhafteste Fehler auf dieser Seite.
- **Alles, was außerhalb des Serverordners lebt**, wie z. B. die MySQL-Datenbank eines Plugins.

## Kopieren, während es läuft, dann noch einmal kopieren, während es gestoppt ist

Der Trick für kurze Ausfallzeiten ist, zuerst die langsame Kopie durchzuführen.

1. **Bei laufendem Server** kopieren Sie das gesamte Serververzeichnis auf die neue Maschine. Bei einer großen Welt kann dies eine Stunde dauern; niemand bemerkt es, weil nichts angehalten wurde.
2. **Kündigen Sie einen Neustart an und stoppen Sie dann den Server ordnungsgemäß.** Ein ordnungsgemäßes Herunterfahren bewirkt, dass das Spiel die Welt speichert; das Beenden des Prozesses tut dies nicht.
3. **Nochmals kopieren.** Diesmal werden nur die geänderten Dateien verschoben, was Sekunden bis Minuten dauert.
4. **Starten Sie ihn auf der neuen Maschine**, wenn möglich auf einem nicht öffentlichen Port, und verbinden Sie sich selbst damit. Überprüfen Sie eine Basis, die Sie kennen, Ihr eigenes Inventar und ob Plugins oder Mods ohne Fehler geladen wurden.
5. **Dann** weisen Sie die Spieler darauf hin.

`rsync -a --delete` ist das übliche Werkzeug für die Schritte 1 und 3. Behalten Sie Berechtigungen und Zeitstempel bei: Eine Welt, die als falscher Benutzer kopiert wird, ist ein Server, der nicht startet, und die Fehlermeldung wird dies nicht deutlich sagen.

## Löschen Sie den alten noch nicht

Behalten Sie die alte Maschine, gestoppt, aber intakt, für mindestens ein paar Tage. Sie ist die einzige echte Rückrollmöglichkeit. Halten Sie sie ausgeschaltet statt laufen, damit niemand versehentlich der verlassenen Kopie beitritt und dort eine Woche lang baut.

## Lassen Sie die Adresse den Umzug überleben

Wenn Spieler sich mit einer reinen IP-Adresse verbinden, zwingt jeder Umzug jeden Spieler, seine Serverliste zu bearbeiten, und einige von ihnen tun dies nie.

Verwenden Sie einen Hostnamen, den Sie kontrollieren und der auf den Server zeigt. Der Umzug wird dann zu einer DNS-Änderung, und die Adresse im Client jedes Spielers bleibt gleich. Reduzieren Sie die TTL (Time-to-Live) des Eintrags einen Tag vor dem Umzug, damit die Änderung schnell propagiert wird.

Wenn Sie möchten, dass Spieler eine reine Domain eingeben, während der Server auf einem nicht standardmäßigen Port läuft, tut ein SRV-Eintrag dies. Es ist derselbe Mechanismus, den kommerzielle Hoster verwenden, um `play.something.net` anzubieten.

## Überprüfen Sie die neue Maschine, bevor Sie ihr vertrauen

Drei Dinge, die sich zwischen Hosts unterscheiden und nach dem Umzug Probleme verursachen:

- **Die Firewall.** Ihr Spielport muss offen sein, und nur Ihr Spielport. Setzen Sie kein Verwaltungs-Panel oder eine Karte dem Internet aus, nur weil es lokal funktioniert hat.
- **Single-Core-Geschwindigkeit.** Minecraft kümmert sich weit mehr darum, wie schnell ein Kern ist, als darum, wie viele es gibt. Acht langsame Kerne fühlen sich schlechter an als zwei schnelle.
- **Festplatte.** Eine Welt auf rotierender Speicherung oder einem stark geteilten Volume wird beim Laden von Chunks stottern.

## Verlassen eines verwalteten Panels

Wenn Sie von einem Hoster kommen, der Ihnen ein Control Panel anstelle einer Maschine gegeben hat, suchen Sie nach dem Download- oder Dateimanager und nehmen Sie das gesamte Serververzeichnis anstelle nur der Welt. Holen Sie sich die Plugin- und Mod-JARs selbst, nicht eine Liste: Die Versionen sind wichtig, und "latest" ist nächsten Monat eine andere Datei.

Überprüfen Sie auch, ob Ihre Backups Ihnen gehören. Ein Backup, das nur innerhalb des Panels existiert, das Sie verlassen, ist kein Backup, das Ihnen gehört.

## In Minecraft Server Manager

Das gesamte Panel ist ein Verzeichnis. Wenn Sie es auf eine andere Maschine kopieren und das Panel dort starten, werden alle Server, Welten, Backups und Einstellungen mitgenommen, was das Verschieben des Panels selbst zu einer Kopie und nicht zu einer Migration macht.

Für einen einzelnen Server anstelle aller erfasst eine Blueprint seine Konfiguration, Mod-Set und die angepinnte Pack-Version (und, wenn Sie es ankreuzen, die aktive Welt) als eine einzige `.mcserver.zip`-Datei, die auf einem anderen Panel importiert werden kann, um denselben Server neu zu erstellen. Welten können separat heruntergeladen und installiert werden, wenn nur die Welt reisen muss.

Wenn der von einem Server verwendete Spielport auf der neuen Maschine bereits belegt ist oder Sie zuerst auf einem nicht öffentlichen Port testen möchten, ändern Sie ihn unter **Einstellungen → Konfiguration**: Die Karte **Spielport** hat **Nächsten freien Port verwenden**, ein laufender Server fragt, bevor er auf dem neuen Port neu startet, und wenn er dort nicht starten kann, kehrt er zum alten zurück. Wechseln Sie ihn zum öffentlichen Port, wenn Sie die Spieler darauf hinweisen.

Verwandt: [blueprints](/docs/blueprints/), [backups that actually restore](/docs/guide-backups/), [worlds and files](/docs/worlds-and-files/).

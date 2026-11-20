---
title: 'Wie viel RAM benötigt ein Minecraft-Server?'
description: 'Wie viel RAM ein Minecraft-Server für Vanilla, Paper, leichte Mods und große Modpacks benötigt und wie viel für die Maschine übrig bleiben sollte.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Zurück zum Dokumentenindex](/docs/)

Kurze Antwort, für einen Server, auf dem tatsächlich gespielt wird:

| Was Sie ausführen                                | Java-Heap   | Geben Sie der Maschine |
| ------------------------------------------------ | ----------- | ---------------------- |
| Vanilla oder Paper, bis zu 10 Spieler            | 2 GB        | 4 GB                   |
| Paper mit Plugins, 10 bis 30 Spieler             | 4 GB        | 6 GB                   |
| Ein leichtes Modpack, 40 bis 80 Mods             | 4 GB        | 6 GB                   |
| Ein großes "Kitchen-Sink"-Pack, 150 bis 300 Mods | 6 bis 8 GB  | 10 GB                  |
| GregTech New Horizons und ähnliche Monster       | 8 bis 12 GB | 16 GB                  |

Zwei Zahlen, nicht eine. Das ist der Teil, den die meisten Anleitungen überspringen, und der Grund, warum Leute einen 4 GB Server kaufen, Java 4 GB zuweisen und dann zusehen, wie er abstürzt.

## Der Heap und die Maschine sind unterschiedliche Zahlen

Der Java-Heap (`-Xmx`) ist der Arbeitsspeicher, den das Spiel selbst für die Welt, Entitäten und Mod-Daten verwenden darf. Die Maschine oder der Container muss diesen Heap **plus** alles andere aufnehmen, was Java benötigt: Klassendaten, Thread-Stacks, Garbage-Collector-Buchhaltung, Netzwerkpuffer und die JVM selbst. Dieser Overhead beträgt für einen Modded Server etwa 0,5 bis 1,5 GB.

Wenn der Heap der Arbeitsspeicher der Maschine entspricht, beendet der Kernel den Server in dem Moment, in dem Java auf diesen Overhead zugreift. In Docker erscheint dies als Exit-Code 137, und in den Logs als gar nichts: Der Prozess verschwindet einfach mitten im Satz. Leute geben normalerweise einem Mod die Schuld.

Eine sichere Regel: **Heap plus 25 Prozent und mindestens ein Gigabyte Reserve.** Ein 8 GB Heap benötigt eine 10 GB Maschine.

## Mehr RAM ist nicht mehr Leistung

Minecraft ist in den meisten seiner Operationen auf einen einzelnen Thread beschränkt. Ein 40-Mod-Pack mit 16 GB zu versorgen, lässt Chunks nicht schneller generieren; es verlängert jede Garbage-Collection-Pause, da es mehr zu durchsuchen gibt. Ein Server, der alle dreißig Sekunden stottert, ist oft ein Server mit zu viel Heap, nicht zu wenig.

Erhöhen Sie den Heap, wenn Sie Folgendes sehen, und nicht sonst:

- `java.lang.OutOfMemoryError: Java heap space` im Log.
- Wiederholtes "Can't keep up! Is the server overloaded?" mit Garbage-Collection-Pausen in den Timings.
- Speichernutzung, die bis zum Anschlag steigt und dort stundenlang verbleibt.

## Warum Ihr Server 12 GB belegt, obwohl niemand online ist

Weil Sie es ihm so gesagt haben. Zwei Standardeinstellungen wirken zusammen:

1. Das gängige Docker-Image setzt den Start-Heap gleich dem Maximum, sodass `-Xms` und `-Xmx` beide Ihre Zahl sind. Java beansprucht ihn sofort, anstatt ihn wachsen zu lassen.
2. Das beliebte Aikar-Flag-Set enthält `-XX:+AlwaysPreTouch`, das jede Seite dieses Heaps beim Start durchläuft, damit die Seiten tatsächlich zugewiesen werden. Dies ist beabsichtigt: Es tauscht einen langsameren Start und einen hohen Leerlaufwert gegen weniger Pausen später.

Gemessen auf Paper 1.21.1 mit einem 2 GB Heap in einem 4 GB Container, stichprobenartig für drei Minuten nach Abschluss des Ladens der Welt:

| Konfiguration                           | Resident Memory |
| --------------------------------------- | --------------- |
| Keine Flags                             | 2.60 GiB        |
| Aikar-Flags                             | 2.59 GiB        |
| Aikar-Flags ohne `AlwaysPreTouch`       | 1.95 GiB        |
| Aikar-Flags mit einem 512 MB Start-Heap | 1.38 GiB        |
| Keine Flags mit einem 512 MB Start-Heap | 1.25 GiB        |

Ein Server, der im Leerlauf 12 GB "verbraucht", ist also normalerweise ein 12 GB Heap, der vorab berührt wurde, kein Speicherleck. Ihre Überwachung liest ihn korrekt; die Zahl bedeutet nur nicht, was sie zu bedeuten scheint.

Wenn Sie einen ehrlichen Leerlaufwert wünschen, setzen Sie den Start-Heap niedriger als das Maximum. Sie bezahlen dafür mit ein paar mehr Sammlungen am Anfang. Wenn Sie stattdessen gleichmäßige Frame-Zeiten bevorzugen, lassen Sie es so und hören Sie auf, das Diagramm zu beobachten.

## Spieler zählen weniger, als Sie denken

Die Verdoppelung von 10 auf 20 Spieler kostet weit weniger, als fünfzig Mods hinzuzufügen. Spieler fügen hauptsächlich Entitäten und geladene Chunks hinzu, die sich nur geringfügig skalieren. Mods fügen Klassendaten, Registrierungen, Weltgenerierungsfunktionen und ihre eigenen Caches hinzu, die sich nicht so verhalten. Berücksichtigen Sie zuerst die Größe des Packs, fügen Sie dann etwa 100 bis 200 MB pro regulärem Spieler auf einem Modded Server hinzu.

Die Sichtweite ist der andere große Hebel. Eine Reduzierung von 12 auf 8 Chunks kann auf einem belebten Server einen Gigabyte einsparen und ist im Spiel kaum merklich.

## In Minecraft Server Manager

Jeder Server hat zwei separate Felder, **Java-Heap** und **Container-Speicherlimit**, genau deshalb, weil sie unterschiedliche Fragen sind. Der Erstellungsassistent setzt das Containerlimit um 50 Prozent über dem Heap für Sie, und das Panel weigert sich, einen Server zu speichern, dessen Containerlimit nicht über seinem Heap liegt, da diese Kombination mit dem Exit-Code 137 und nicht mit einer Fehlermeldung endet.

Die Speicheranzeige eines Servers zeigt an, was der Container tatsächlich verwendet, mit einem Hinweis, wenn der Heap im Voraus beansprucht wurde, sodass ein vorab berührter Heap nicht als außer Kontrolle geraten angezeigt wird. Ein Server, den der Kernel wegen Speichermangels beendet hat, wird in der Historie genau als solcher erfasst, anstatt als mysteriöser Absturz.

Verwandt: [Server erstellen und verwalten](/docs/servers/),
[Absturzberichte](/docs/servers/#crash-reports--mclogs-analysis), [Speicher und Kontingente](/docs/storage/).

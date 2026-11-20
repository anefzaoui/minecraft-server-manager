---
title: 'Dein Minecraft-Server startet nicht'
description: 'Ein Minecraft-Server, der nicht startet, behoben in der Reihenfolge der Wahrscheinlichkeit: das Log, die Java-Version, der Arbeitsspeicher, die EULA und der Port sowie Mods.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Arbeite diese Liste ab. Sie ist danach geordnet, wie oft jeder Punkt die Antwort ist, und die ersten vier decken die meisten Fälle ab.

## 1. Lies die letzten zwanzig Zeilen, nicht die ersten

Scrolle zum **Ende** des Logs. Ein Java Stack Trace wird von innen nach außen ausgegeben, daher ist der Anfang der Textwand der uninteressanteste Teil. Was du willst, ist die letzte `Caused by:` Zeile und was danach kommt. Diese einzelne Zeile benennt normalerweise das Problem.

Zwei Formen zeigen dir, wo du stehst:

- `Exception in thread "main"` oder ein Absturzberichtpfad am Ende bedeutet, dass das Spiel selbst abgestürzt ist.
- Das Log stoppt einfach mitten in einer Zeile, ohne jegliche Ausnahme, bedeutet, dass etwas den Prozess von außen beendet hat. Springe zu Punkt 3.

## 2. UnsupportedClassVersionError bedeutet das falsche Java

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Klasse 52 ist Java 8, 60 ist 16, 61 ist 17, 65 ist 21, 69 ist 25. Die Meldung bedeutet, dass der Server ein neueres Java benötigt, als er gerade ausführt; das Gegenteil, ein altes Pack auf neuem Java, schlägt normalerweise stattdessen mit einem Mixin- oder Reflexionsfehler fehl.

| Minecraft-Version | Java |
| ----------------- | ---- |
| 1.16.5 und älter  | 8    |
| 1.17              | 16   |
| 1.18 und 1.19     | 17   |
| 1.20 bis 1.20.4   | 17   |
| 1.20.5 bis 1.21.x | 21   |
| 26.1 und neuer    | 25   |

Alte Packs benötigen tatsächlich Java 8. Neuer ist hier nicht besser.

## 3. Exit Code 137 ist der Kernel, kein Mod

Das Log stoppt mitten im Satz, es gibt keinen Absturzbericht und der Container meldet 137. Das ist ein Out-of-Memory-Kill: Der Prozess hat Speicher angefordert, den die Maschine nicht hatte, und wurde daher beendet.

Fast immer wurde der Java-Heap auf die gleiche Größe wie der Speicher der Maschine gesetzt. Der Heap benötigt den Speicher der Maschine **abzüglich** des eigenen Overheads der JVM, der bei einem modifizierten Server 0,5 bis 1,5 GB beträgt. Reduziere den Heap oder erhöhe die Maschine. [Wie viel RAM ein Server benötigt](/docs/guide-server-memory/) enthält die Zahlen.

## 4. Die EULA und der Port

Zwei Klassiker mit Ein-Zeilen-Lösungen:

- `You need to agree to the EULA in order to run the server.` Setze `eula=true` in `eula.txt` oder mit der Umgebungsvariable, die dein Setup verwendet.
- `Address already in use` oder `FAILED TO BIND TO PORT`. Etwas anderes belegt Port 25565, oft eine frühere Kopie desselben Servers, die nie vollständig gestoppt wurde. Finde sie und stoppe sie, anstatt den Port zu ändern, sonst hast du am Ende zwei.

## 5. Ein Mod fehlt seine Abhängigkeit

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Fabric-Mods benötigen überwiegend die Fabric API als separate Datei. Forge- und NeoForge-Mods listen ihre Abhängigkeiten in der Fehlermeldung selbst auf. Installiere die genannte Version, nicht die neueste: "requires 0.91.x" bedeutet diese Zeile, und 0.92 wird denselben Check fehlschlagen lassen.

Manchmal ist die fehlende Abhängigkeit der Loader selbst:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

Die Lösung ist ein neuerer Loader-Build, nicht ein anderer Mod. "47.4.14 or above" bedeutet jeden Build ab dort aufwärts, und Forge veröffentlicht nicht jede Nummer, daher kann der zu installierende Build der nächste sein. Bei einem Modpack aktualisiere zuerst das Pack: Ein Pack, dessen eigener Loader zu alt für seine Mods ist, ist ein Fehler, den der Autor beheben muss.

## 6. Ein Mod ist für den falschen Loader oder die falsche Version

Eine Jar-Datei für einen anderen Loader schlägt nicht höflich fehl. Erwarte einen Mixin-Fehler, einen `NoClassDefFoundError` oder einen Absturz innerhalb einer Klasse, von der du noch nie gehört hast. Überprüfe die Seite des Jar: Loader und Minecraft-Version müssen exakt übereinstimmen. 1.20.1 und 1.20.4 sind für Mods unterschiedliche Spiele.

## 7. Die Welt ist von einer neueren Version

```
This world was created by a newer version of Minecraft
```

Welten werden vorwärts und niemals rückwärts aktualisiert. Stelle das Backup von vor dem Upgrade wieder her oder führe die Version aus, die die Welt erwartet. Es gibt keinen Downgrade-Pfad, der die Chunks intakt hält.

## Wenn es nach wochenlangem Laufen abgestürzt ist

Andere Frage, normalerweise andere Antwort:

- **Es ist unter Last abgestürzt**, mit Timings, die lange Pausen zeigen: Garbage Collection, also schaue auf die Heap-Größe vor den Mods.
- **Es ist an derselben Stelle in der Welt abgestürzt**: ein beschädigter Chunk oder eine kaputte Entität. Der Absturzbericht nennt normalerweise Koordinaten.
- **Es ist direkt nach einem Update abgestürzt**: Der aktualisierte Mod ist der Verdächtige, auch wenn die Spur woanders hinzeigt. Mache ihn rückgängig und sieh nach.
- **Es ist beim Neustart abgestürzt, nachdem es vorher in Ordnung war**: Überprüfe die Festplatte. Eine volle Festplatte erzeugt spektakuläre und irreführende Fehler.

## Hilfe bekommen, die wirklich hilft

Poste das **gesamte Log**, nicht die letzte Zeile, und sage, was du geändert hast, bevor es kaputt ging. Poste es irgendwo, das dafür gedacht ist, wie z.B. [mclo.gs](https://mclo.gs), anstatt in den Chat. Gib die Minecraft-Version, den Loader, das Pack und seine Version sowie den Heap-Speicher des Servers an. Ein Bericht mit diesen vier Fakten wird in einer Antwort beantwortet; ohne sie dauert es fünf.

## In Minecraft Server Manager

Abstürze werden aus dem eigenen Beenden des Containers erkannt, sodass ein Server, der um drei Uhr morgens abstürzt, mit seinem Log-Auszug aufgezeichnet wird, anstatt erst am nächsten Tag gefunden zu werden. Die üblichen Verdächtigen auf dieser Seite (die EULA, das falsche Java, eine Welt von einer neueren Version, ein bereits belegter Port, Java-Speichermangel) werden in diesem Log erkannt und im Verlaufseintrag mit den entsprechenden Handlungsanweisungen benannt, und Auto-Neustart lässt diese in Ruhe, da ein Neustart sie nicht beheben wird. Absturzberichte werden bei Ankunft analysiert: Die Ausnahme wird hervorgehoben, der Stack ist einklappbar und Mods, die in der Spur erscheinen, werden als Verdächtige aufgelistet.

Jeder Bericht kann von seiner Karte aus nach mclo.gs geteilt werden, wenn du Hilfe benötigst (nach einer Bestätigung, da die Kopie öffentlich ist), und das **Download**-Menü der Konsole enthält jede Log-Datei als ein Zip-Archiv, sodass "das gesamte Log posten" ein Download und kein archäologisches Projekt ist. Ein Out-of-Memory-Kill wird als Out-of-Memory-Kill aufgezeichnet, was die übliche Stunde des Beschuldigens eines Mods erspart. Wenn etwas anderes tatsächlich den Port benötigt, verschiebt die **Game Port**-Karte unter **Einstellungen → Konfiguration** den Server auf einen freien.

Ein zu alter Loader wird über den **Versionen**-Tab des Servers geändert, der prüft, ob der Build existiert und ein Backup erstellt, bevor der Server neu erstellt wird ([Ändern der Mod-Loader-Version](/docs/updates/#changing-the-mod-loader-version)).

Verwandt: [Wie viel RAM ein Server benötigt](/docs/guide-server-memory/), [Auswahl eines Loaders](/docs/guide-choosing-a-loader/), [Server erstellen und verwalten](/docs/servers/).

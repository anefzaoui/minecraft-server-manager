---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: Welches soll es sein?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge oder Quilt: Welcher Minecraft-Servertyp soll ausgeführt werden, abhängig davon, was deine Spieler installieren.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Wählen Sie anhand dessen, was die Spieler installieren sollen, und nicht anhand dessen, was am schnellsten klingt.

| Sie wollen                                                | Führen Sie dies aus       | Spieler installieren |
| --------------------------------------------------------- | ------------------------- | -------------------- |
| Survival mit Freunden, nichts Ungewöhnliches              | Vanilla                   | Nichts               |
| Ein öffentlicher Server mit Rängen, Claims und Moderation | Paper                     | Nichts               |
| Ein bestimmtes Modpack von CurseForge oder Modrinth       | Was auch immer dort steht | Das Pack             |
| Ein modernes Modpack, das Sie selbst erstellen            | Fabric oder NeoForge      | Dieselben Mods       |
| Ein altes Pack aus der Ära 1.7 bis 1.12                   | Forge                     | Dieselben Mods       |

Das ist für die meisten Leute die ganze Entscheidung. Der Rest dieser Seite erklärt, warum.

## Plugins und Mods sind nicht dasselbe

Das ist die Unterscheidung, von der alles andere abhängt.

**Plugins** laufen nur auf dem Server. Paper, Spigot und Bukkit laden sie. Spieler verbinden sich mit einem normalen,
unveränderten Client und merken nichts davon. Alles, was sich grundlegend um Regeln, Berechtigungen, Wirtschaftssysteme,
Claims, Minispiele oder Moderation dreht, ist ein Plugin, und deshalb läuft fast jeder öffentliche Server mit Paper.

**Mods** verändern das Spiel selbst: neue Blöcke, neue Dimensionen, neue Maschinen. Der Client muss dieselben Mods wie der Server laden,
sonst kann er nicht verstehen, was der Server ihm mitteilt. Jeder, der sich einem gemoddeten Server anschließt, installiert zuerst das Pack.

Ein Server kann nicht sinnvoll beides sein. Hybridprojekte existieren, die eine Plugin-API an einen Mod-Loader anhängen,
und sie funktionieren, bis sie es nicht mehr tun, normalerweise im ungünstigsten Moment. Wenn Sie beides benötigen, betreiben Sie einen Proxy mit einem
gemoddeten Server und einem Plugin-Server dahinter, anstatt eines Hybrids.

## Die Plugin-Seite

**Paper** ist die Standardantwort. Es ist ein Fork von Spigot mit jahrelanger Performance-Optimierung und einer
Konfigurationsdatei für fast jedes Verhalten, das einen Administrator jemals geärgert hat. Vanilla-Plugins aus der Bukkit-Ära laufen meistens immer noch.

**Purpur** ist ein Fork von Paper mit noch mehr Einstellungsmöglichkeiten, einschließlich Gameplay-Optionen. Nehmen Sie es, wenn Sie
diese spezifischen Schalter wollen; ansonsten Paper.

**Vanilla** ist es wert, wenn es um das unveränderte Spiel geht. Es ist bei vielen Spielern langsamer und hat kein Berechtigungssystem,
daher ist die Moderation manuell.

Paper verändert standardmäßig einige Vanilla-Verhaltensweisen im Namen der Performance. Wenn eine Redstone-Konstruktion
aus einem Video auf Ihrem Server nicht funktioniert, ist das normalerweise der Grund, und es ist normalerweise eine Einstellung.

## Die Mod-Seite

**Fabric** ist klein, aktualisiert sich innerhalb weniger Tage auf eine neue Minecraft-Version und enthält die meisten modernen
Performance-Mods. Fast jeder Fabric-Mod benötigt auch die Fabric API, die ein separater Download ist.
Wenn Ihr Ziel ein schneller Server mit einer Handvoll Quality-of-Life-Mods ist, ist dies die richtige Wahl.

**NeoForge** ist, wo das alte Forge-Ökosystem jetzt seine Arbeit für aktuelle Versionen leistet. Es spaltete sich während 1.20.1 von
Forge ab, und die meisten großen Packs, die für 1.20.2 und neuer erstellt wurden, zielen darauf ab. Wenn Sie heute ein neues,
schwergewichtigeres Pack beginnen, ist dies die richtige Wahl.

**Forge** besitzt immer noch die Vergangenheit. Alles aus den Ären 1.7.10, 1.12.2 und 1.16.5, was eine ganze Menge der beliebten Packs ist,
ist Forge und wird es immer sein. Behalten Sie es für diese.

**Quilt** ist ein Fork von Fabric, der die meisten Fabric-Mods ausführt. Es existiert aus guten Gründen, aber wenn Sie keinen spezifischen Grund haben,
es zu wählen, wählen Sie Fabric.

Mods für einen Loader laufen nicht auf einem anderen. Eine Mod-Seite, auf der Fabric steht, bedeutet Fabric.

## Wenn Sie ein Pack installieren, entscheidet das Pack

Wählen Sie nicht selbst. Das Pack listet seinen Loader und seine genaue Minecraft-Version auf, und beides muss übereinstimmen.
"Nahe genug" gibt es hier nicht: ein Pack für 1.20.1 läuft nicht auf 1.20.4, und ein 1.20.1 NeoForge-Pack läuft nicht auf 1.20.1 Forge.

Installieren Sie das Pack anhand seiner ID oder seines Links anstatt durch manuelles Auswählen von Mods und heften Sie die Version an. Packs
aktualisieren sich, und ein Update, das mitten in der Saison unter Ihren Füßen landet, ist der Grund, warum Welten beschädigt werden.

## Welche Java-Version

Die Anforderung von Minecraft verschiebt sich mit dem Spiel, und die Ausführung der falschen Version führt zu einem wenig hilfreichen
`UnsupportedClassVersionError` anstelle einer klaren Meldung.

| Minecraft-Version | Java |
| ----------------- | ---- |
| 1.16.5 und früher | 8    |
| 1.17              | 16   |
| 1.18 und 1.19     | 17   |
| 1.20 bis 1.20.4   | 17   |
| 1.20.5 bis 1.21.x | 21   |
| 26.1 und später   | 25   |

Alte Packs benötigen wirklich Java 8; dies ist einer der wenigen Bereiche in der Software, in denen die neueste Version
falsch ist.

## In Minecraft Server Manager

Der Erstellungsassistent fragt, was Sie ausführen möchten, und wählt die Java-Version aus der obigen Tabelle aus, sodass der
Abgleich versehentlich nie passiert. Vanilla, Paper und Purpur befinden sich auf dem Tab **Vanilla**; der
Tab **From Mods** nimmt Fabric, Forge, NeoForge oder Quilt entgegen, mit der Minecraft-Version und einem Loader-Build (dem neuesten oder einem, den Sie anheften). Die Installation eines Packs von CurseForge, Modrinth oder GT New Horizons
heftet es an eine exakte Version. Das Upgrade erfolgt erst, wenn Sie es anwenden (oder nach der täglichen Prüfung, wenn die Update-Richtlinie des Servers
**Auto-Update** ist), erstellt immer zuerst ein Backup und kann rückgängig gemacht werden.

Der Mod-Browser weiß, welcher Loader ein Server verwendet, und filtert, was er anbietet, entsprechend, sodass ein Fabric-JAR nicht versehentlich auf einem NeoForge-Server landen kann.

Verwandt: [Server erstellen und verwalten](/docs/servers/), [Modpacks](/docs/modpacks/),
[wie viel RAM ein Server benötigt](/docs/guide-server-memory/).

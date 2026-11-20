---
title: 'Updates'
description: 'Verfolgen und installieren Sie Updates für Minecraft-Versionen, Modpacks, Mods und Plugins für jeden Server, mit einer Richtlinie pro Server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Die Seite **Updates** verfolgt auf einen Blick, was in Ihrer Flotte veraltet ist:

- **Modpack**-Versionen ([Modpacks](/docs/modpacks/)) im Vergleich zu Modrinth / CurseForge / dem GTNH-Release-Index.
- **Benutzerdefinierte Inhalte**, die Sie selbst hinzugefügt haben (Mods, Datapacks, Ressourcenpakete, Plugins), jeweils im Vergleich zu ihrer Quelle: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) oder GitHub Releases. GitHub-Abfragen verwenden ETag-Neubewertung, sodass tägliche Prüfungen die Ratenbegrenzung kaum berühren.
- **Veraltete Docker-Images**: Die Image-ID jedes Server-Containers im Vergleich zu einem frisch heruntergeladenen Tag (dedupliziert über Server mit demselben Tag), angeboten als Upgrade nur für den Neuaufbau.
- **Feste Versionen für eigenständige Installationen**: Für einen Server ohne verwaltetes Paket eine explizite `mc_version`-Festlegung im Vergleich zum Manifest von Mojang und eine explizite Umgebungsvariable für den Loader-Build (`PAPER_BUILD`, `FORGE_VERSION` und ähnliches) im Vergleich zum Registry des Loaders. Paper-Builds stammen von der aktuellen **Fill v3 API** von PaperMC (der ältere v2-Endpunkt empfängt keine neuen Minecraft-Versionen mehr). Auf einem Server mit Mods wird eine neuere Minecraft-Version nur angeboten, wenn eine [Versionsprüfung](#minecraft-version-compatibility) gezeigt hat, dass jeder installierte Mod eine Version dafür hat. Ein Server mit einer festen Forge-Version erhält den empfohlenen Build von Forge, niemals einen Build, der älter ist als der, auf den er festgelegt ist, und ein Server, der auf ein Release festgelegt ist, erhält niemals eine Vorabversion (einer, der sich bereits in einer Beta befindet, kann eine neuere Beta oder das Release erhalten). Das Anwenden eines Loader-Builds erstellt zuerst ein Backup vor dem Update. Das Verschieben eines Forge- oder NeoForge-Servers auf eine neue Minecraft-Version löscht seine festgelegte Loader-Build-Nummer, da ein Build für eine einzige Minecraft-Version erstellt wird; ein Schlüsselwort wie `latest` bleibt erhalten, da es sich selbst an die Version anhängt. Um einen bestimmten Build selbst auszuwählen, siehe [Ändern der Mod-Loader-Version](#changing-the-mod-loader-version).

![Updates](/docs/images/updates.png)

## Funktionsweise

Das Panel vergleicht die festgelegten Versionen jedes Servers mit der Upstream-Quelle und listet alles auf, was eine neuere Veröffentlichung hat. Eine übereinstimmende Anzahl erscheint auch auf der Kachel "Updates verfügbar" im [Dashboard](/docs/dashboard/).

Prüfungen laufen standardmäßig täglich nach einem [Zeitplan](/docs/schedules/) und bei Bedarf mit **Alle jetzt prüfen**. **Ignorieren** in einer Zeile stoppt das Anbieten dieser bestimmten Version; eine neuere wird wieder angeboten. Die Update-**Richtlinie** ist pro Server: Das Panel lässt alles manuell (Standard, was den Server auch von dieser Seite fernhält), benachrichtigt Sie nur oder wendet Paket-Updates selbst an ([Update-Richtlinie](/docs/modpacks/#update-policy)).

## Minecraft-Versionskompatibilität

Eine neuere Minecraft-Version ist kein Upgrade, wenn Ihre Mods nicht mitkommen können. Jeder Server hat seinen eigenen **Versionen**-Tab (unter Mods), der diese Frage beantwortet:

- Die Version, die der Server jetzt ausführt, und die **höchste Version, für die jeder installierte Mod eine Version hat**.
- Eine aufklappbare Zeile pro zukünftiger Minecraft-Version, mit der Anzahl der bereitstehenden Mods und der Anzahl, für die noch nichts veröffentlicht wurde. Öffnen Sie eine Zeile, um zu sehen, welche Mods zurückbleiben würden und welche in Ordnung sind.

![Versionskompatibilität](/docs/images/server-versions.png)

Drücken Sie **Zukünftige Versionen prüfen**, um es auszuführen. Nichts scannt von selbst: Eine Prüfung liest jedes Jar im Mods-Ordner des Servers und fragt Modrinth und CurseForge nach jedem einzelnen, daher geschieht dies nur, wenn Sie es anfordern. Fortschritt und Teilergebnisse werden währenddessen geschrieben, sodass das Schließen der Seite oder das Aktualisieren nichts verliert, und eine Prüfung, die durch einen Panel-Neustart unterbrochen wurde, gibt dies an und bietet an, sie erneut auszuführen. Alles, was eine unterbrochene Prüfung bereits ermittelt hat, wird beibehalten, sodass eine erneute Ausführung diese Arbeit nicht wiederholt.

Ein Bericht beschreibt nur den Server, für den er erstellt wurde. Ändern Sie die Minecraft-Version, den Loader oder die Mods selbst (fügen Sie einen hinzu, entfernen Sie einen, aktualisieren Sie einen), und der Bericht wird als veraltet markiert und nicht mehr verwendet, bis Sie die Prüfung erneut ausführen.

Mods werden aus der eigenen Dateiliste des Modpacks identifiziert, wo vorhanden, und ansonsten anhand des Datei-Inhalts, auf die gleiche Weise, wie ein Launcher ein Jar erkennt. Zwei Arten von Mods können nicht beantwortet werden und werden auch nicht erraten:

- **Konnte nicht identifiziert werden**: Ein handgefertigtes Jar oder ein privater Build, den keine Registry erkennt.
- **Konnte nicht geprüft werden**: Ein Mod von GitHub Releases, Hangar oder SpigotMC, oder einer, dessen Projekt entfernt wurde. Diese veröffentlichen keine Liste, welche Minecraft-Version jede Version hat.

Solange einer davon installiert ist, bietet das Panel überhaupt kein Ein-Klick-Minecraft-Versions-Update an, da es nicht ehrlich sagen kann, was kaputt gehen würde. Das Anwenden einer Version, die über die von den Mods unterstützte hinausgeht, wird verweigert und nennt die Mods, die es blockieren.

Von Ihnen **deaktivierte** Mods spielen keine Rolle: Der Server lädt sie nicht, daher ist das Deaktivieren eines Mods ein wirklicher Weg, einen Blocker zu umgehen. Das Ein- oder Ausschalten eines Mods markiert den Bericht zur erneuten Prüfung.

Dies gilt für Server, die Mods ausführen: Fabric, Forge, NeoForge und Quilt. Paper-ähnliche Plugin-Server behalten das einfache Verhalten der neuesten Veröffentlichung und haben keinen Versions-Tab, da zwei der Registries, von denen Plugins stammen, nichts veröffentlichen, das eine Prüfung lesen könnte.

![Eine Version geöffnet, die zeigt, welche Mods zurückbleiben würden](/docs/images/server-versions-expanded.png)

Das Öffnen einer Version listet zuerst die Mods ohne Version dafür auf (diejenigen, die die Antwort bestimmen) und hält die bereitstehenden hinter einem Klick. Große Packs laden eine Seite von Mods auf einmal, sodass ein 300-Mod-Server genauso schnell geöffnet wird wie ein Fünf-Mod-Server.

## Ändern der Mod-Loader-Version

Der Tab **Versionen** hat auch eine Karte **Loader-Version**. Sie zeigt, welcher Forge-, NeoForge-, Fabric- oder Quilt-Build auf dem Server installiert ist und, wo er geändert werden kann, einen Auswähler, um zu einem anderen zu wechseln.

- **Ein Forge-, NeoForge-, Fabric- oder Quilt-Server** kann jeden veröffentlichten Build ausführen. Der Auswähler listet die letzten Builds für die Minecraft-Version des Servers auf, wobei die empfohlenen und neuesten Builds von Forge gekennzeichnet sind. **Anderer Build…** wählt einen älteren anhand seiner Nummer aus, und **Standard** kehrt dazu zurück, den Server auswählen zu lassen.
- **Ein Forge- oder Fabric-CurseForge-Modpack** installiert die Loader-Version, die sein eigenes Manifest deklariert. Der übliche Weg, sie zu ändern, ist die Aktualisierung des Packs. Wenn das Pack selbst die falsche Version angibt (ein Mod darin fragt nach einem neueren Forge als das Pack installiert), kann die Karte dies überschreiben, und **Version des Modpacks** entfernt die Überschreibung wieder. Das Aktualisieren des Packs entfernt sie ebenfalls, da die neue Version ihre eigene Loader deklariert. Wenn die neue Version immer noch die falsche angibt, legen Sie die Überschreibung erneut fest.
- **Ein NeoForge-CurseForge-Modpack oder ein Modrinth-Modpack** zeigt seinen Loader an, kann aber nicht überschrieben werden: Das Server-Image wendet die Überschreibung nur auf Forge- und Fabric-Packs an. Sein Loader folgt der Pack-Version, also aktualisieren Sie stattdessen das Pack. Der Loader eines FTB-Packs kann hier ebenfalls nicht geändert werden. Seine Karte erscheint normalerweise nicht, da der eigene Installer von FTB Aufzeichnungen führt, die das Panel nicht liest.

Das Panel prüft, ob der Build existiert, bevor es Sie etwas fragt. Ein Forge- oder NeoForge-Build wird für eine Minecraft-Version erstellt. Auf einem Server, der der neuesten Veröffentlichung folgt, behält das Festlegen eines solchen Builds auch den Server auf der Minecraft-Version, die er gerade ausführt (die Bestätigung besagt dies). Die Auswahl von **Standard** danach entfernt die Festlegung, behält aber diese Minecraft-Version bei. Ein Server, der der neuesten Veröffentlichung folgte, kann auch zu einem anderen Java-Image wechseln, wenn er neu erstellt wird, das, was diese Version benötigt. Einem solchen Server, der noch nie gestartet wurde, wird angeboten, zuerst einmal zu starten, damit das Panel diese Version kennt. Forge überspringt Build-Nummern (es gibt kein 47.4.14 zwischen 47.4.13 und 47.4.15), sodass ein Mod, der "47.4.14 oder höher erfordert", durch den nächsten Build erfüllt wird, und die Ablehnung nennt ihn. Eine Änderung erstellt ein Backup vor dem Update und baut dann den Server neu auf. Der neue Build wird beim nächsten Start des Servers installiert, und die Karte zeigt dies bis dahin an.

## Rückgängigmachen eines Mod-Updates

Jeder Build, von dem ein Mod aktualisiert wird, verbleibt in der gemeinsamen Bibliothek, sodass ein Update, das etwas kaputt macht, rückgängig gemacht werden kann. Die Zeile des Mods im Tab **Mods** erhält eine Schaltfläche **Zurücksetzen**, die den vorherigen Build wiederherstellt. Es gibt keinen Download, daher funktioniert es auch dann, wenn das Projekt inzwischen aus seiner Registry entfernt wurde. Der Build, von dem Sie zurückgesetzt haben, wird nicht mehr angeboten, bis eine neuere Version erscheint.

![Einen Mod auf den Build zurücksetzen, von dem er aktualisiert wurde](/docs/images/mods-revert.png)

## Anwenden eines Updates

Updates sind niemals lautlos. Wenn Sie sich entscheiden, ein Pack zu aktualisieren (oder [es auf eine andere Version zu wechseln](/docs/modpacks/#changing-the-pack-version), auch ältere), tut das Panel Folgendes:

1. Erstellt ein **Backup vor dem Update** (damit es rückgängig gemacht werden kann; standardmäßig werden die letzten 10 Backups vor dem Update pro Server aufbewahrt, siehe [Aufbewahrung](/docs/backups/#retention)).
2. Pinnt die exakte neue Version neu an.
3. Baut den Server neu auf und löst bei Bedarf die Java-Laufzeitumgebung neu auf.
4. Überwacht den ersten Start mit einem plattformspezifischen Zeitbudget.

Wenn er nicht gesund startet, rollen Sie zum Backup vor dem Update zurück. Ein stabil verfolgender Server erhält niemals eine Beta, und der Link zum Changelog verweist auf die tatsächliche Versionsdifferenz, wo die Quelle eine bereitstellt. Ein fehlgeschlagenes Update löst auch eine Discord-[Benachrichtigung](/docs/integrations/) aus, wenn die Integration konfiguriert ist.

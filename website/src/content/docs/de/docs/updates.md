---
title: 'Aktualisierungen'
description: 'Die Seite "Aktualisierungen" verfolgt, was auf Ihren Servern veraltet ist, an einem Ort:'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Die Seite **Updates** verfolgt, was auf all Ihren Servern veraltet ist, an einem Ort:

- **Modpack**-Versionen ([Modpacks](/docs/modpacks/)) im Vergleich zu Modrinth / CurseForge / dem GTNH-Release-Index.
- **Benutzerdefinierte Inhalte**, die Sie selbst hinzugefügt haben – Mods, Datapacks, Ressourcen-Packs, Plugins – jeweils im Vergleich zu ihrer Quelle: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) oder GitHub Releases. GitHub-Abfragen verwenden ETag-Neubewertung, sodass tägliche Prüfungen die Ratenbegrenzung kaum berühren.
- **Veraltete Docker-Images**: Die Image-ID jedes laufenden Containers im Vergleich zu einem frisch heruntergeladenen Tag (dedupliziert über Server mit demselben Tag), angeboten als Upgrade, das nur neu erstellt werden muss.
- **Standalone-Versions-Pins**: Für einen Server ohne verwaltetes Pack wird ein expliziter `mc_version`-Pin im Vergleich zum Manifest von Mojang und eine explizite Loader-Build-Umgebungsvariable (`PAPER_BUILD`, `FORGE_VERSION` und ähnliches) im Vergleich zum Registry des Loaders verwendet. Paper-Builds stammen von der aktuellen **Fill v3 API** von PaperMC (der ältere v2-Endpunkt empfängt keine neuen Minecraft-Versionen mehr).

![Updates](/docs/images/updates.png)

## Funktionsweise

Das Panel vergleicht die angepinnten Versionen jedes Servers mit der Upstream-Quelle und listet alles auf, für das eine neuere Version verfügbar ist. Eine übereinstimmende Anzahl erscheint auch auf der Kachel "Updates verfügbar" auf dem [Dashboard](/docs/dashboard/).

Prüfungen laufen bei Bedarf und können geplant werden ([Zeitpläne](/docs/schedules/)). Die Update-**Richtlinie** ist pro Server: Sie entscheiden, ob das Panel Sie nur benachrichtigt oder ob alles manuell bleibt.

## Ein Update anwenden

Updates sind niemals stillschweigend. Wenn Sie sich entscheiden, ein Pack zu aktualisieren, führt das Panel Folgendes aus:

1. Erstellt ein **Backup vor dem Update** (damit es rückgängig gemacht werden kann; die letzten 10 Backups vor dem Update pro Server werden aufbewahrt).
2. Pinnt die exakte neue Version neu an.
3. Erstellt den Container neu und löst bei Bedarf die Java-Laufzeitumgebung neu auf.
4. Überwacht den ersten Start mit einem Zeitbudget pro Plattform.

Wenn er nicht fehlerfrei startet, wird zum Backup vor dem Update zurückgekehrt. Ein stabil laufender Server erhält niemals ein Beta-Angebot, und der Link zum Changelog verweist auf die tatsächliche Diff pro Version, wo die Quelle eine bereitstellt. Ein fehlgeschlagenes Update löst auch eine Discord-[Benachrichtigung](/docs/integrations/) aus, wenn die Integration konfiguriert ist.

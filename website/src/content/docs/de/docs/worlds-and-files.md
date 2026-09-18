---
title: 'Welten & Dateien'
description: 'Die Seite "Welten" verwaltet die Weltdaten Ihrer Server: Wechseln Sie die aktive Welt, laden Sie eine Welt hoch oder laden Sie eine herunter.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

## Welten

Die Seite **Welten** verwaltet die Weltdaten auf Ihren Servern: Wechseln Sie die aktive Welt, laden Sie eine Welt hoch oder laden Sie eine herunter.

![Welten](/docs/images/worlds.png)

## Der Dateimanager

Unter dem Abschnitt **Welt** eines Servers ist der Tab **Dateien** ein vollständiger Dateimanager im Browser für das Datenverzeichnis dieses Servers. Listen, lesen, bearbeiten, erstellen, umbenennen, verschieben, kopieren, löschen und hochladen von Dateien: alles, was Sie normalerweise über SSH tun würden, aus dem Browser heraus.

![Dateimanager](/docs/images/server-files.png)

Textdateien werden mit einem Limit von 2 MB in einem Editor geöffnet; größere Dateien können heruntergeladen werden. Uploads akzeptieren mehrere Dateien gleichzeitig.

### Innerhalb des Sandkastens bleiben

Jede Dateioperation ist auf das eigene Datenverzeichnis des Servers beschränkt. Das Panel löst jeden Pfad auf und lehnt alles ab, was ausbrechen würde: `..`-Traversal, absolute Pfade und sogar Symlinks, die außerhalb des Verzeichnisses zeigen (einschließlich hängender, die noch nicht existieren). Ein Mod oder Plugin kann keinen Link pflanzen, um den Dateimanager zu täuschen, damit er woanders auf dem Host liest oder schreibt.

## Mods

Für modifizierte Server verwaltet der Tab **Mods** (eine eigene Gruppe in der Server-Seitenleiste) die Mod-Sammlung: Mods durchsuchen und hinzufügen und sehen, was installiert ist. Mod- und Pack-Updates werden auf der Seite [Updates](/docs/updates/) angezeigt.

### Mods hinzufügen

![Mods](/docs/images/mods.png)

Vier Wege hinein, alle von der Werkzeugleiste des Mods-Tabs:

- **Mods suchen** - durchsuchen Sie **Modrinth oder CurseForge** (der CurseForge-Chip erscheint, sobald ein API-Schlüssel unter Einstellungen → API-Schlüssel gespeichert ist), und auf Plugin-Servern auch **Hangar** (die eigene Plugin-Registry von PaperMC) und **SpigotMC** (über den CDN-Proxy von Spiget) - beides schlüssellos. Alles wird auf den Loader und die Minecraft-Version des Servers gefiltert; Quilt-Server sehen automatisch auch Fabric-getaggte Builds, da Quilt Fabric-Mods ausführt. Ergebnisse, die sich bereits auf dem Server befinden, zeigen einen **Installiert**-Badge. Wenn ein CurseForge-Autor automatisierte Downloads nicht zul gestattet – oder eine SpigotMC-Ressource extern gehostet wird – teilt das Panel dies im Voraus mit und bietet stattdessen einen **Seite öffnen** + **JAR hochladen**-Pfad an, anstatt mitten in der Installation abzubrechen.

  ![Hangar-Suche](/docs/images/mods-search-hangar.png)

- **ZIP importieren** - ein Knopf, drei Formen, automatisch erkannt:
  - Ein **Modrinth Modpack (`.mrpack`)**: Jede angeheftete Datei wird über Hash-Lookup wieder in ihr Modrinth-Projekt zurückgeführt (sodass importierte Mods echte Namen, Icons behalten und update-fähig bleiben; Dateien, die Modrinth nicht kennt, werden von der eigenen URL des Packs installiert), beim Herunterladen anhand der SHA512-Prüfsummen des Packs verifiziert und mit passenden Urteilen vorausgecheckt. Nur-Client-Dateien werden sichtbar übersprungen, und beide Überschreibungsbäume (`overrides/`, dann `server-overrides/` - die serverspezifische Kopie gewinnt) können angewendet werden.

    ![mrpack Import](/docs/images/mrpack-import.png)

  - Ein **CurseForge Modpack-Export** (die ZIP, die die CurseForge-App erstellt, mit `manifest.json`): Jeder angeheftete Mod wird in großen Mengen aufgelöst, mit Warnungen vorausgecheckt (falscher Loader/MC für diesen Server, Dateien nicht mehr auf CurseForge, Mods, die einen manuellen Download benötigen) und mit echtem Fortschritt installiert. Die `overrides/` des Packs (Konfigurationen, Skripte) können optional ebenfalls angewendet werden - jede Datei, die überschrieben würde, wird zuerst in `.import-backups/<timestamp>/` innerhalb des Serverordners gesichert.
  - Eine **einfache ZIP von JARs**, die Sie selbst gesammelt haben: Jede JAR wird identifiziert (Modrinth-Hash-Übereinstimmung → CurseForge-Fingerabdruck → die eigene Metadaten der JAR) und gegen den Server beurteilt – _passt / falscher Loader / falsche MC-Version / bereits installiert / nicht identifiziert_ – damit Sie auswählen, was tatsächlich dazugehört, bevor etwas installiert wird.
- **Per Link hinzufügen** - fügen Sie fast alles ein: Modrinth-, CurseForge-, Hangar- oder SpigotMC-Projektseiten, ein GitHub-Repo- oder Release-URL (ein einfaches `owner/repo` funktioniert auch - GitHub-Installationen bevorzugen die neueste stabile Version und überspringen `-sources`/`-javadoc` Sidecar-JARs), ein einfacher Modrinth-Slug oder eine beliebige direkte `.jar`-URL. Das Panel löst den richtigen Build für den Loader und die MC-Version des Servers auf.

  ![Per Link hinzufügen](/docs/images/mods-add-by-link.png)

- **JAR hochladen** (vom Such-Fallback oder dem ausstehenden Download-Resolver) - hochgeladene JARs werden auf die gleiche Weise identifiziert, sodass sie ihren echten Namen, ihre Version, ihr Icon behalten und update-fähig werden.

Jede Registry-Installation wird **während des Downloads auf Prüfsummen überprüft**: Der Stream wird gegen den stärksten Digest geprüft, den die Registry veröffentlicht (sha512 → sha256 → sha1 → md5), und eine Nichtübereinstimmung bricht ab, bevor etwas auf dem Server landet.

Eine ganze ZIP (`.mrpack` eingeschlossen) kann auch **einen Server erstellen**: Im Reiter _Aus Modpack_ des Assistenten laden Sie diese hoch und das Pack-Manifest (oder eine Mehrheitsentscheidung über die identifizierten JARs) füllt den Loader, die Minecraft-Version und den Loader-Build aus.

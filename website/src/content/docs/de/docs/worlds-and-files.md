---
title: 'Welten & Dateien'
description: 'Die Weltbibliothek, Welt-Uploads und -Wechsel, der Mods- und Plugins-Tab sowie der In-Browser-Dateimanager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Zurück zum Dokumentenindex](/docs/)

## Welten

Die Seite **Welten** ist die Weltbibliothek: jede gespeicherte Welt an einem Ort. **Welt hochladen** nimmt ein `.zip` oder `.tar` Archiv und findet die Welt automatisch darin, **In Bibliothek speichern** erstellt einen Schnappschuss der Live-Welt eines Servers (funktioniert, während der Server läuft), und jede Welt in der Bibliothek kann mit **Installieren in…** heruntergeladen oder auf jedem Server installiert werden. Die Installation ersetzt entweder die Welt des Servers (der Server muss gestoppt sein und seine aktuelle Welt wird zuerst gesichert) oder fügt sie daneben hinzu, um sie später zu aktivieren. Vor jeder Installation wird eine Kompatibilitätsprüfung durchgeführt.

Der eigene Tab **Welt → Welten** eines Servers listet die Welten auf diesem Server auf. Von dort aus können Sie eine andere Welt aktivieren (bei gestopptem Server), eine Welt herunterladen, duplizieren, umbenennen oder [verkleinern](/docs/world-shrink/), auf einen anderen Server kopieren, eine inaktive löschen und die aktive Welt mit einem neuen, beibehaltenen oder benutzerdefinierten Seed zurücksetzen (zuerst wird eine Sicherheitskopie angeboten). Die gleiche Bibliothek befindet sich darunter, mit **Hier installieren**.

![Welten](/docs/images/worlds.png)

## Der Dateimanager

Unter dem Abschnitt **Welt** eines Servers ist der Tab **Dateien** ein vollständiger Dateimanager im Browser für das Datenverzeichnis dieses Servers. Dateien auflisten, lesen, bearbeiten, umbenennen, verschieben, kopieren, löschen und hochladen, Ordner erstellen und den Text von Dateien unter einem Ordner mit **In Dateien suchen** durchsuchen: alles, was Sie normalerweise über SSH tun würden, aus dem Browser.

![Dateimanager](/docs/images/server-files.png)

Textdateien werden mit einem Limit von 8 MB in einem Editor geöffnet; größere Dateien können heruntergeladen werden. Uploads akzeptieren bis zu 20 Dateien gleichzeitig.

### Innerhalb der Sandbox bleiben

Jede Dateioperation ist auf das eigene Datenverzeichnis des Servers beschränkt. Das Panel löst jeden Pfad auf und lehnt alles ab, was ausbrechen würde: `..` Traversierung, absolute Pfade und sogar Symlinks, die außerhalb des Verzeichnisses zeigen (einschließlich hängender, die noch nicht existieren). Ein Mod oder Plugin kann keinen Link pflanzen, um den Dateimanager zu täuschen, um woanders auf dem Host zu lesen oder zu schreiben.

## Mods

Für modifizierte Server und Plugin-Server verwaltet der Tab **Mods** (eine eigene Gruppe in der Server-Seitenleiste) die Mod-Sammlung: Mods durchsuchen und hinzufügen und sehen, was installiert ist. In jeder Zeile eines installierten Mods können Sie ihn aktualisieren (oder dieses Update ignorieren), [zurücksetzen](/docs/updates/#undoing-a-mod-update), deaktivieren oder entfernen, und **Alle aktualisieren** wendet jedes verfügbare Update mit einem Neustart an. Mod- und Pack-Updates werden auch auf der Seite [Updates](/docs/updates/) angezeigt.

### Mods hinzufügen

![Mods](/docs/images/mods.png)

Vier Wege hinein, alle von der Werkzeugleiste des Mods-Tabs:

- **Mods suchen**: Durchsuchen Sie **Modrinth oder CurseForge** (der CurseForge-Chip erscheint, sobald ein API-Schlüssel unter **Einstellungen → API-Schlüssel** gespeichert ist), und auf Plugin-Servern auch **Hangar** (die eigene Plugin-Registry von PaperMC) und **SpigotMC** (über den CDN-Proxy von Spiget), beide schlüssellos. Ein Tab **Datapacks** durchsucht die Datapacks von Modrinth. Alles wird auf den Loader und die Minecraft-Version des Servers gefiltert (eine Checkbox zeigt auch Builds an, die nicht als kompatibel aufgeführt sind, auf eigene Gefahr); Quilt-Server sehen automatisch auch Fabric-getaggte Builds, da Quilt Fabric-Mods ausführt. Ergebnisse, die bereits auf dem Server vorhanden sind, zeigen einen **Installiert**-Badge. Wenn ein CurseForge-Autor automatisierte Downloads nicht zul gestattet (oder eine SpigotMC-Ressource extern gehostet wird), teilt das Panel dies im Voraus mit und bietet stattdessen einen Pfad **CurseForge öffnen** (oder **SpigotMC öffnen**) + **JAR hochladen** an, anstatt mitten in der Installation abzubrechen.

  ![Hangar-Suche](/docs/images/mods-search-hangar.png)

- **Zip importieren**: Ein Knopf, drei Formen, automatisch erkannt:
  - Ein **Modrinth Modpack (`.mrpack`)**: Jede angeheftete Datei wird über eine Hash-Suche zurück in ihr Modrinth-Projekt kanonisiert (sodass importierte Mods echte Namen und Icons behalten und update-fähig bleiben; Dateien, die Modrinth nicht kennt, werden von der eigenen URL des Packs installiert), beim Herunterladen anhand der SHA512-Prüfsummen des Packs verifiziert und mit passenden Urteilen in der Vorschau angezeigt. Client-only-Dateien werden sichtbar übersprungen, und beide Override-Bäume (`overrides/`, dann `server-overrides/`; die serverspezifische Kopie gewinnt) können angewendet werden.

    ![mrpack Import](/docs/images/mrpack-import.png)

  - Ein **CurseForge Modpack-Export** (der Zip, den die CurseForge-App erstellt, mit `manifest.json`): Jeder angeheftete Mod wird in großen Mengen aufgelöst, mit Warnungen in der Vorschau angezeigt (falscher Loader/MC für diesen Server, Dateien nicht mehr auf CurseForge, Mods, die einen manuellen Download benötigen) und mit echtem Fortschritt installiert. Die `overrides/` des Packs (Konfigurationen, Skripte) können optional ebenfalls angewendet werden; jede Datei, die überschrieben würde, wird zuerst in `.import-backups/<timestamp>/` im Serverordner gesichert.
  - Ein **einfacher Zip von JARs**, den Sie selbst gesammelt haben: Jede JAR-Datei wird identifiziert (Modrinth-Hash-Übereinstimmung → CurseForge-Fingerabdruck → Metadaten der JAR-Datei selbst) und gegen den Server beurteilt (_passt / falscher Loader / falsche MC-Version / bereits installiert / nicht identifiziert_), sodass Sie auswählen, was tatsächlich dazugehört, bevor etwas installiert wird.
- **Nach URL hinzufügen**: Fügen Sie fast alles ein: Modrinth-, CurseForge-, Hangar- oder SpigotMC-Projektseiten, eine GitHub-Repo- oder Release-URL (ein einfaches `owner/repo` funktioniert auch; GitHub-Installationen bevorzugen die neueste stabile Version und überspringen `-sources`/`-javadoc` Sidecar-JARs), einen einfachen Modrinth-Slug oder eine beliebige direkte `.jar`-URL. Das Panel löst den richtigen Build für den Loader und die MC-Version des Servers auf.

  ![Nach Link hinzufügen](/docs/images/mods-add-by-link.png)

- **JAR hochladen** (aus dem Such-Fallback oder dem Pending-Downloads-Resolver): Hochgeladene JARs werden auf die gleiche Weise identifiziert, sodass sie ihren echten Namen, ihre Version, ihr Symbol behalten und update-fähig werden.

Jede Registry-Installation wird **während des Downloads auf Prüfsummen überprüft**: der Stream wird gegen den stärksten Digest geprüft, den die Registry veröffentlicht (sha512 → sha256 → sha1 → md5), und eine Nichtübereinstimmung bricht ab, bevor etwas auf dem Server landet.

Ein ganzer Zip (`.mrpack` inklusive) kann auch **einen Server erstellen**: im Tab **Vom Modpack** des Assistenten laden Sie ihn hoch und das Pack-Manifest (oder eine Mehrheitsentscheidung über die identifizierten JARs) füllt den Loader, die Minecraft-Version und den Loader-Build aus.

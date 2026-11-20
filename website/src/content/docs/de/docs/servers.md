---
title: 'Server erstellen & verwalten'
description: 'Erstellen, starten, stoppen, neu erstellen und konfigurieren Sie Minecraft-Server im Panel: der Erstellungsassistent, Einstellungen, Arbeitsspeicher und der Spiel-Port.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

## Server erstellen

Klicke auf **Server erstellen** (obere Leiste) oder die Karte **Server erstellen**, um den Assistenten zu öffnen.

![Server erstellen](/docs/images/create-wizard.png)

Der Assistent füllt den Java-Heap und die Festplattenzuweisung aus den **Standardeinstellungen für neue Server** auf der Seite Einstellungen vor, die ein Administrator jederzeit ändern kann. Ein neuer Server bezieht auch sein CPU-Limit von dort.

![Standardeinstellungen für neue Server](/docs/images/settings-defaults.png)

Du wählst:

- Einen **Namen** (und eine optionale Beschreibung, ein Icon und eine Akzentfarbe). Tags zur Organisation deines Fuhrparks werden später auf den Servereinstellungen hinzugefügt.
- Einen **Servertyp**: Vanilla, Paper oder Purpur auf dem Tab **Vanilla**. Für einen modifizierten Server wählt der Tab **Von Mods** den Loader (Fabric, Forge, NeoForge oder Quilt), die Minecraft-Version und einen Loader-Build (den neuesten oder einen bestimmten) aus und lässt dich dann nach Mods suchen.
- Eine **Minecraft-Version**: `LATEST`, ein Snapshot oder eine bestimmte Version (Betas und Alphas inklusive).
- Einen **Spiel-Port**: Ein freier Port wird vorgeschlagen. Die Remote Console (RCON) verwendet standardmäßig den Port 1000 höher. Du kannst ihn später ändern (siehe [Spiel-Port ändern](#changing-the-game-port)).
- **Ressourcen**: Den Java-Heap (das Container-Speicherlimit wird um 50 % darüber gesetzt) und eine Festplattenzuweisung.

**Erweiterte Optionen** öffnet alle anderen Einstellungen, die das Server-Image unterstützt, plus zusätzliche Umgebungsvariablen und (für Administratoren) die erweiterten Docker-Einstellungen.

Bevorzugst du ein Modpack? Der Tab **Von Modpack** installiert stattdessen ein CurseForge-, Modrinth- oder GT New Horizons-Pack (siehe [Modpacks](/docs/modpacks/)) oder nimmt einen **benutzerdefinierten Zip, den du hochlädst**: ein Modrinth `.mrpack`, einen CurseForge-Modpack-Export (`manifest.json`) oder einen beliebigen Zip von Mod-JARs. Das Manifest (oder eine Mehrheitsentscheidung über die identifizierten JARs) füllt den Loader und die Minecraft-Version aus, und jeder Mod wird in einem Schritt installiert. Du kannst auch von einer gespeicherten [Blueprint](/docs/blueprints/) auf dem Tab **Von Blueprint** starten.

Das Panel wählt automatisch eine sinnvolle Java-Laufzeitumgebung für deine Version aus, zieht das Image, erstellt den Container und startet ihn – alles aus einem einzigen Formular.

## Die Serverliste

Die Seite **Server** listet deinen gesamten Fuhrpark mit Status und Schnellstatistiken auf.

![Serverliste](/docs/images/servers-list.png)

## Ein einzelner Server

![Spieler](/docs/images/players.png)

Das Öffnen eines Servers gibt dir einen tabbed Workspace:

- **Übersicht**: Die Adresse, die du mit Spielern teilen kannst, die Beschreibung, die Live-Nutzung und wer online ist.
- **Konsole**: Der Live-Log-Stream und die Befehlseingabe, In-Game-Chat und [Chat-Befehle](/docs/console-and-chat/).
- **Spieler**: Die Liste der Spieler sowie Inventar und Statistiken.
- **Mods**: Die Liste der installierten Mods, der [Mod-Browser](/docs/modpacks/) und Inhaltsaktualisierungen. Auf einem modifizierten Server prüft der Unter-Tab **Versionen**, für welche zukünftigen Minecraft-Versionen deine Mods Builds haben ([Updates](/docs/updates/#minecraft-version-compatibility)).
- **Welt**: [Welten, die Live-Karte und der Dateimanager](/docs/worlds-and-files/).
- **Backups**: [Snapshots und Wiederherstellung](/docs/backups/) für diesen Server.
- **Überwachung**: Server-spezifische Historie und Live-Metriken, einschließlich Absturzberichten (siehe unten).
- **Einstellungen**: **Konfiguration** (alles über die Ausführung des Servers), plus die [Integrationen](/docs/integrations/) (Discord, Statusseite, Einladungen und für Administratoren Chatbot).

Die Start-, Stopp- und Neustart-Steuerelemente befinden sich in der Kopfzeile über jedem Tab. Was du auf jedem Tab tun kannst, hängt von deinen [Berechtigungen für diesen Server](/docs/users-and-roles/#per-server-permissions) ab; zum Beispiel benötigt der Unter-Tab **Dateien** die Berechtigung "Dateien", und das Senden von Konsolenbefehlen erfordert "Konsole".

![Serverübersicht](/docs/images/server-overview.png)

Die **Welt-Steuerelemente**-Leiste fährt auf jedem Tab mit: die In-Game-Uhr, das Wetter, die gängigen Gamerules als Umschalt-Chips und "Alle Weltregeln anzeigen" für den Rest.

![Welt-Steuerelemente](/docs/images/world-controls.png)

**Überwachung → Live** zeigt TPS und Millisekunden pro Tick, eine Gesundheits- und Stabilitätskarte mit Abstürzen (letzte 24 Stunden und 7 Tage), Out-of-Memory-Kills und automatischen Neustarts sowie pro Welt Größen an.

![Live-Überwachung](/docs/images/monitoring-live.png)

## Servereinstellungen

**Einstellungen → Konfiguration** ist die vollständige Konfigurationsoberfläche: Name, Beschreibung, MOTD, Icon, Farbe und Tags, Ressourcen, Spiel-Port, Update-Richtlinie, Start beim Panel-Start und automatischer Neustart bei Absturz, jede Umgebungsvariable, die das Server-Image unterstützt, die erweiterten Docker-Einstellungen und Blueprint-Export, Klonen, Neuerstellen und Löschen. Änderungen, die erst nach dem Neuerstellen des Servers wirksam werden, werden sofort gespeichert und warten: Eine Schaltfläche **Änderungen anwenden** erscheint in der Kopfzeile des Servers, und sie werden auch beim nächsten Start des Servers angewendet.

**Automatischer Neustart bei Absturz** startet einen abgestürzten Server erneut, wartet länger zwischen jedem Versuch (5, 10, dann 20 Sekunden) und stoppt nach 3 Versuchen innerhalb von 10 Minuten. Er überspringt Abstürze, die das Panel als Einrichtungsproblem erkennt (die EULA, die falsche Java-Version, eine Welt aus einer neueren Version, ein belegter Port, zu wenig Speicher, ein fehlender CurseForge-Schlüssel), da diese zuerst behoben werden müssen. Wenn eine andere Aktion mit dem Server beschäftigt ist (ein Backup, eine Wiederherstellung, eine Portänderung), wartet er bis zu 30 Minuten und gibt auf, sobald jemand den Server selbst stoppt oder startet.

Direkte Einstellungsänderungen bleiben über Neustarts hinweg bestehen. Eine PvP- oder Schwierigkeitsänderung, die mit der **Welt-Steuerelemente**-Leiste vorgenommen wird, ein Whitelist-Umschalter auf dem Tab **Spieler** oder eine Bearbeitung von `server.properties` im **Dateien**-Editor entfernt die entsprechende Umgebungsvariable (falls eine gesetzt war) und markiert den Server zur Neuerstellung, sodass der Wert auf der Festplatte Vorrang hat, anstatt beim nächsten Start vom Container-Image erneut angewendet zu werden.

![Servereinstellungen](/docs/images/server-settings.png)

**Zum Speicher-Meter.** "RAM (Java-Heap)" wird Java sowohl als Start- als auch als maximaler Heap übergeben, und Java füllt einen ihm vorab zugewiesenen Heap innerhalb der ersten Minute, mit oder ohne die Aikar / MeowIce Flag-Presets. Der Speicher-Meter stabilisiert sich also bei etwa der Heap-Größe und bleibt dort, auch wenn niemand spielt; der Strich auf dem Meter markiert, wo der Heap unter dem Container-Limit liegt, und die Notiz darunter besagt dies. Wenn du lieber sehen möchtest, wie der Speicher dem tatsächlichen Verbrauch folgt, gib dem Server einen kleineren Start-Heap mit **Initialer Heap** in der Ressourcenkarte unter **Einstellungen → Konfiguration** (oder unter **Erweiterte Optionen** im Assistenten), z. B. 512 MB: Bei einem 2-GB-Heap reduzierte dies im Leerlauf den Verbrauch von 2,6 GB auf etwa 1,3 GB in unseren Messungen. Java benötigt auch Speicher außerhalb des Heaps (etwa 0,5 GB bei Vanilla, 1,5 bis 2 GB bei einem großen Modpack), wofür der Spielraum des Container-Limits vorgesehen ist. Siehe die "Zwei Speicherlimits" in der README für die Zahlen.

> Die **Erweiterten Docker-Einstellungen** (Containername, Docker-Netzwerk, zusätzliche Port-Mappings und zusätzliche Volume-Bindungen) sind **nur für Administratoren**, da ein Bind-Mount plus der Docker-Zugriff des Panels effektiv Root auf dem Host sind. Siehe [Benutzer & Rollen](/docs/users-and-roles/).

### Spiel-Port ändern

Die Karte **Spiel-Port** unter **Einstellungen → Konfiguration** verschiebt einen Server jederzeit auf einen anderen Port, mit einer eigenen Schaltfläche **Port speichern**. **Nächsten freien Port verwenden** wählt den niedrigsten freien Port aus, und die Karte prüft jeden von dir eingegebenen Port, bevor du ihn speicherst. RCON folgt immer 1000 über dem Spiel-Port (der Standard-Offset). Administratoren können jeden Port ab 1024 wählen; alle anderen wählen ab dem ersten Spiel-Port (standardmäßig 25565) aufwärts. Das Speichern wendet die Änderung sofort an: Ein gestoppter Server wird einfach verschoben, und ein laufender Server fragt zuerst nach und startet dann auf dem neuen Port neu (die Welt wird zuerst gespeichert und die Spieler verbinden sich auf dem neuen Port neu). Wenn der Server auf dem neuen Port nicht starten kann, kehrt er zum alten Port zurück. Die Änderung wird verweigert, während andere Änderungen auf **Änderungen anwenden** warten, also wende diese zuerst an. Das Ändern des Ports erfordert die Berechtigung "Einstellungen" für diesen Server.

![Die Karte Spiel-Port](/docs/images/server-port.png)

![Die Aufforderung vor dem Neustart eines laufenden Servers auf seinem neuen Port](/docs/images/port-restart.png)

## Absturzberichte & mclo.gs-Analyse

Absturzberichte (`crash-reports/*.txt` und JVM `hs_err_pid*.log`-Dateien) werden automatisch erfasst, in eine einzeilige Zusammenfassung mit der Ausnahme und vermuteten Mods zerlegt und unter **Überwachung → Verlauf** aufgelistet:

![Absturzbericht-Karte](/docs/images/crash-mclogs-card.png)

Jede Berichts-Karte bietet einen integrierten Viewer (mit einklappbaren Abschnitten und hervorgehobenen Ausnahmen), Kopieren des Stack-Trace und Download, plus zwei [mclo.gs](https://mclo.gs)-Aktionen:

- **An mclo.gs senden** veröffentlicht den Bericht als öffentlichen Paste und kopiert den Link: genau das, was Mod-Autoren und Support-Discords verlangen. Der Link wird für den Bericht gespeichert, sodass nichts jemals zweimal hochgeladen wird.
- **Analysieren** führt die automatisierten Einblicke von mclo.gs über den Paste aus: bekannte Probleme mit vorgeschlagenen Lösungen (fehlende Abhängigkeiten, Versionskonflikte, häufige Mod-Konflikte), direkt im Panel gerendert.

![mclo.gs Einblicke](/docs/images/crash-insights.png)

Beide Aktionen erfordern eine explizite Bestätigung, da ein Paste öffentlich ist: Absturzberichte können Spielernamen und deine vollständige Mod-Liste enthalten. Das Panel lädt niemals etwas von selbst hoch.

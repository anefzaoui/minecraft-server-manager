---
title: 'Server erstellen & verwalten'
description: 'Klicke auf Server erstellen (obere Leiste) oder auf die Karte Server erstellen, um den Assistenten zu öffnen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

## Server erstellen

Klicke auf **Server erstellen** (obere Leiste) oder auf die Karte **Server erstellen**, um den Assistenten zu öffnen.

![Server erstellen](/docs/images/create-wizard.png)

Der Assistent füllt die Felder für Arbeitsspeicher, CPU und Festplattenkontingent aus den **Standardeinstellungen für neue Server** auf der Einstellungsseite vor, die ein Administrator jederzeit ändern kann.

![Standardeinstellungen für neue Server](/docs/images/settings-defaults.png)

Du wählst:

- Einen **Namen** (und optional ein Symbol, eine Akzentfarbe und Tags zur Organisation deiner Serverflotte).
- Einen **Servertyp** – Vanilla, Paper, Fabric, Forge, NeoForge und mehr, die jeweils im Hintergrund auf das richtige itzg-Image abgebildet werden.
- Eine **Minecraft-Version** – `LATEST`, ein Snapshot oder eine bestimmte Version.
- **Ressourcen** – RAM (Heap), Container-Speicherlimit, CPU und ein Festplattenkontingent.

Bevorzugst du ein Modpack? Der Tab **Aus Modpack** installiert stattdessen ein CurseForge-, Modrinth-, FTB- oder GT New Horizons-Pack (siehe [Modpacks](/docs/modpacks/)) oder nimmt einen **hochgeladenen benutzerdefinierten Zip-Archiv**: eine CurseForge-Modpack-Exportdatei (`manifest.json`) oder jedes beliebige Zip-Archiv mit Mod-JARs. Das Manifest (oder eine Mehrheitsentscheidung über die identifizierten JARs) füllt den Loader und die Minecraft-Version aus, und jeder Mod wird in einer Aufgabe installiert. Du kannst auch mit einer gespeicherten [Blueprint](/docs/blueprints/) beginnen.

Das Panel wählt automatisch eine sinnvolle Java-Laufzeitumgebung für deine Version aus, zieht das Image, erstellt den Container und startet ihn (optional) – alles über ein einziges Formular.

## Die Serverliste

Die Seite **Server** listet deine gesamte Serverflotte mit Status und schnellen Statistiken auf.

![Serverliste](/docs/images/servers-list.png)

## Ein einzelner Server

![Spieler](/docs/images/players.png)

Das Öffnen eines Servers gibt dir einen tabbed Workspace:

- **Übersicht** – Status, Live-Statistiken, Uptime und die primären Start-/Stopp-/Neustart-Steuerelemente.
- **Konsole** – der Live-Log-Stream und die Befehlseingabe, plus In-Game-Chat ([Details](/docs/console-and-chat/)).
- **Spieler** – wer online ist, plus Inventar, Statistiken und [Chat-Befehle](/docs/console-and-chat/).
- **Mods** – die installierte Mod-Liste, der [Mod-Browser](/docs/modpacks/) und Inhaltsaktualisierungen.
- **Welt** – [Welten, die Live-Karte und der Dateimanager](/docs/worlds-and-files/).
- **Backups** – [Snapshots und Wiederherstellung](/docs/backups/) für diesen Server.
- **Überwachung** – serverbezogene Historie und Live-Metriken, einschließlich Absturzberichten (siehe unten).
- **Einstellungen** – alles über die Ausführung des Servers, plus die [Integrationen](/docs/integrations/) (Discord, Statusseite, Einladungen, Chatbot).

![Serverübersicht](/docs/images/server-overview.png)

Die **Welt-Steuerelemente**-Leiste begleitet dich auf jedem Tab: die In-Game-Uhr, das Wetter, die gängigen Gamerules als Toggle-Chips und "Alle Weltregeln anzeigen" für den Rest.

![Welt-Steuerelemente](/docs/images/world-controls.png)

**Überwachung → Live** zeigt TPS und Millisekunden pro Tick, eine Gesundheits- und Stabilitätskarte mit den Abstürzen und Neustarts der letzten 24 Stunden / 7 Tage und größen pro Welt an.

![Live-Überwachung](/docs/images/monitoring-live.png)

## Server-Einstellungen

Der Tab **Einstellungen** ist die vollständige Konfigurationsfläche: Umbenennen, Ressourcen, Update-Richtlinie, automatisches Starten/Neustarten, Umgebungsvariablen und erweiterte Docker-Overrides. Felder, die die Ausführung des Containers ändern, sind deutlich als neustartpflichtig gekennzeichnet.

![Server-Einstellungen](/docs/images/server-settings.png)

**Zum Speicher-Meter.** "RAM (Java Heap)" wird Java sowohl als Start- als auch als maximaler Heap übergeben, und Java füllt einen ihm vorab zugewiesenen Heap innerhalb der ersten Minute, mit oder ohne die Aikar / MeowIce Flag-Presets. Der Speicher-Meter stabilisiert sich also bei etwa der Heap-Größe und bleibt dort, auch wenn niemand spielt; der Strich auf dem Meter markiert, wo der Heap unter dem Container-Limit liegt, und die Notiz darunter besagt dies. Wenn du möchtest, dass der Speicher den tatsächlichen Verbrauch widerspiegelt, stelle einen kleineren **Initialen Heap** (Erweitert) ein: bei einem 2 GB Heap reduzierte dies den Leerlaufverbrauch in unseren Messungen von 2,6 GB auf etwa 1,3 GB. Java benötigt auch Speicher außerhalb des Heaps (etwa 0,5 GB bei Vanilla, 1,5 bis 2 GB bei einem großen Modpack), wofür der Spielraum des Container-Limits vorgesehen ist. Siehe "Zwei Speicherlimits" in der README für die Zahlen.

> Erweiterte Docker-Override-Felder (benutzerdefinierter Containername, zusätzliche Port- und Bind-Mounts sowie rohe Overrides) sind **nur für Administratoren**, da ein Bind-Mount plus der Docker-Zugriff des Panels effektiv Root auf dem Host darstellt. Siehe [Benutzer & Rollen](/docs/users-and-roles/).

## Absturzberichte & mclo.gs-Analyse

Absturzberichte (`crash-reports/*.txt` und JVM `hs_err_pid*.log`-Dateien) werden automatisch erfasst, in eine einzeilige Zusammenfassung mit der Ausnahme und vermuteten Mods geparst und unter **Überwachung → Verlauf** aufgelistet:

![Absturzbericht-Karte](/docs/images/crash-mclogs-card.png)

Jede Berichts-Karte bietet einen integrierten Viewer (mit einklappbaren Abschnitten und hervorgehobenen Ausnahmen), Kopieren des Stack-Trace und Download, plus zwei [mclo.gs](https://mclo.gs)-Aktionen:

- **An mclo.gs senden** veröffentlicht den Bericht als öffentlichen Paste und kopiert den Link – genau das, was Mod-Autoren und Support-Discords verlangen. Der Link wird für den Bericht gespeichert, sodass nichts jemals doppelt hochgeladen wird.
- **Analysieren** führt die automatisierten Einblicke von mclo.gs über den Paste aus: bekannte Probleme mit vorgeschlagenen Lösungen (fehlende Abhängigkeiten, Versionskonflikte, häufige Mod-Konflikte), direkt im Panel angezeigt.

![mclo.gs Einblicke](/docs/images/crash-insights.png)

Beide Aktionen erfordern eine explizite Bestätigung, da ein Paste öffentlich ist: Absturzberichte können Spielernamen und deine vollständige Mod-Liste enthalten. Das Panel lädt niemals etwas von sich aus hoch.

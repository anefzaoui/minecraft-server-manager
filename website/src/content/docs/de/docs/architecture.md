---
title: 'Architektur'
description: 'Minecraft Server Manager ist eine Single-Process, serverseitig gerenderte Node.js-Anwendung.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Zurück zum Dokumentenindex](/docs/)

Minecraft Server Manager ist eine Single-Process, Server-gerenderte Node.js-Anwendung. Sie verwaltet
Minecraft-Server, die als Docker-Container mit dem
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) Image ausgeführt werden, und kommuniziert
mit dem Docker-Daemon über dessen API (niemals durch Aufruf der `docker` CLI).

## Laufzeitstruktur

- **Express + Handlebars** rendern Seiten serverseitig. Es gibt keine SPA; der Browser-JS in `public/js/`
  ist handgeschriebene progressive Verbesserung. Ein esbuild-Schritt (`pnpm run build:js`) bündelt und
  minifiziert ihn zu `public/dist/js/`; die App liefert diesen Bundle, wenn er vorhanden ist, andernfalls die rohe Quelle,
  sodass ein Entwicklungs-Lauf ohne Build trotzdem funktioniert.
- **`node:sqlite`** (in Node integriert; das Panel benötigt Node ≥ 24) ist die Datenbank – synchron,
  null native Module, WAL-Modus. Ein kleiner, versionierter Migrationsläufer wendet `src/db/migrations/*` beim
  Start an. Prepared Statements werden in `src/db/index.js` mit dem SQL-Text als Schlüssel gecacht.
- **`ws`** transportiert die Live-Konsolen- und Statistik-Streams. Beide werden **vermittelt**: ein Upstream
  `docker logs --follow` (oder `docker stats`) pro Server, einmal demuxt und an jeden
  verbundenen Tab verteilt, anstatt ein Upstream pro Betrachter. Der Konsolen-Broker hält einen kleinen Wiedergabepuffer
  für spät beitretende Tabs und verwirft einen Abonnenten, dessen Socket zu weit zurückfällt, anstatt den
  gemeinsamen Stream zu verlangsamen.
- **dockerode** ist der einzige Weg, wie die App mit Docker spricht. Der Endpunkt wird plattformabhängig
  automatisch erkannt (Windows Named Pipe vs. Unix Socket).
- **Der gesamte persistente Zustand befindet sich in einem Verzeichnis** (`$DATA_DIR`, Standard `./data`). Das Kopieren dieses
  Verzeichnisses migriert das gesamte Panel.

## Schichtung

Abhängigkeiten fließen in eine Richtung:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ Middleware) │   Input parsen & validieren, Antworten formen
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │         services/*          │   Domänenlogik (die eigentlichen Funktionen)
                 └───┬─────────┬─────────┬─────┘
                     │         │         │
        ┌────────────▼──┐ ┌────▼────┐ ┌──▼──────────┐
        │   docker/*    │ │  db/*   │ │  storage/*  │   Infrastruktur
        └───────────────┘ └─────────┘ └─────────────┘
```

- **`web/routes/`** - ein Router pro Domäne (`players`, `worlds`, `crashes`, `blueprints`, `files`, …).
  `web/app.js` bindet die Top-Level-Router (`api.js`, die JSON-API für Sessions, die auch die Kern-Server-Routen enthält und die Domänen-Router pro Server bindet; `index.js`, die Seiten; `auth`, `account`,
  `tasks`, …). Router validieren mit zod, rufen einen Service auf und geben JSON zurück
  oder rendern eine Ansicht. Geschäftslogik gehört hier nicht hin. Zwei Router sind in der **öffentlichen Zone** gebunden,
  vor `requireAuth`: `routes/status.js` (optional pro Server HTML-Statusseiten) und
  `routes/apiV1.js` (`/api/v1`, eine schreibgeschützte JSON-API, authentifiziert durch ein vom Admin ausgestelltes Bearer-Token
  aus `services/apiTokens.js`, deaktiviert, es sei denn, sie ist in den Einstellungen aktiviert; siehe `docs/public-api.md`).
- **`services/`** - das Herzstück der Anwendung. Jeder Service verwaltet eine Domäne und kann von
  Infrastruktur und anderen Services abhängen.
- **`docker/`** - dockerode-Wrapper: `connect` (Endpunkterkennung + Daemon-Gesundheit), `containers`
  (Erstellen/Starten/Stoppen/Neuerstellen mit Bind-Mounts, Speicher-/CPU-Limits und Labels), `logs`, `stats`,
  `images`, `networks` (Host-Netzwerk-Erkennung), `hostPath` (re-rootet Bind-Pfade unter
  `DATA_DIR`), und ein `watcher`, der Docker-Ereignisse in Verlauf + Absturzerkennung umwandelt.
- **`db/`** - der SQLite-Wrapper und Migrationsläufer.
- **`storage/`** - der `./data` Bootstrap, der **Pfadschutz** (`safeJoin`, das Rückgrat für Dateisicherheit)
  und der Hintergrund-Größenindexierer + Kontingentprüfung.

Übergreifend:

- **`config/`** - Umgebungskonfiguration plus der **Feldkatalog**: die einzige Quelle der Wahrheit für
  Servereinstellungen. Jede itzg-Umgebungsvariable ist katalogisiert (Label, Hilfe, Typ, Einheit, Standard,
  Validierung, Abschnitt, Gefahren-Flags). Der Assistent, die Einstellungsformulare und die zod-Validierung werden alle daraus abgeleitet,
  sodass das Hinzufügen einer neuen Einstellung eine Datenänderung ist, keine neue UI-Verdrahtung.
- **`events/`** - `recordEvent()` ist der einzige Einstiegspunkt für das Verlaufsprotokoll; Lebenszyklusereignisse erfassen auch
  Container-Log-Auszüge in `data/logs/<id>/events/`.
- **`ws/`** - authentifizierte Konsolen- + Statistik-WebSockets (Session-Cookie bei Upgrade verifiziert, `Origin`
  geprüft, um Cross-Site-Hijacking zu blockieren), vermittelt pro Server (siehe "Laufzeitstruktur").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` gibt einen pro Modul
  [Pino](https://getpino.io)-Logger zurück; Level aus `LOG_LEVEL`, `makeFailureThrottle()` hält eine
  dauerhaft fehlschlagende Hintergrundschleife auf einer Logzeile plus einer "wiederhergestellten" Zeile.
  `src/utils/logSanitize.js` schwärzt Anmeldeinformations-förmige Schlüssel und Webhook-Token aus den strukturierten
  Metadaten; `src/config/logLevel.js` ist die gemeinsame Level-Whitelist (separat gehalten, um einen Require-Zyklus mit
  `config` zu vermeiden). `src/instrument.js` ist eine ruhende Sentry-Naht, die zuerst in
  `src/server.js` geladen wird. `src/web/middleware/requestLog.js` schreibt eine Zugriffslog-Zeile pro Anfrage
  (überspringt `/healthz` und statische Assets). ESLint erzwingt `no-console` unter `src/**`, mit
  `preflight.js`, `instrument.js` und `config/index.js` als Ausnahmen (sie laufen, bevor der Logger existiert).
- **Ratenbegrenzung** - `src/web/middleware/rateLimit.js` platziert `express-rate-limit` vor `/api`
  (`RATE_LIMIT_API_PER_MIN`, Standard 1200) und die Login- / 2FA- / Setup-POSTs
  (`RATE_LIMIT_AUTH_PER_15MIN`, Standard 100); `0` deaktiviert einen Limiter. Er schlüsselt nach `req.ip`, daher
  ist `TRUST_PROXY` hinter einem Proxy wichtig. `/api/v1` hat eigene Limiter: eine Pro-Client-IP-Obergrenze
  (fünfmal das Pro-Token-Budget), die vor der Token-Überprüfung läuft, dann ein Pro-Token-Budget
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, Standard 120), das nach der ID des verifizierten Tokens geschlüsselt ist. Ein
  separater Pro-Account-Soft-Zähler in
  `src/web/middleware/auth.js` behandelt die Login-Sperre (pro IP und global pro Account, abklingend).
- **Autorisierung**: zwei Ebenen. Die globale Rolle (`requireAuth` → `requireRole` / `requireWrite` in
  `src/web/middleware/auth.js`) sperrt Panel-weite Aktionen und ist der Standard für jeden Server. Pro-Server-
  Berechtigungen (`src/services/permissions.js`, neun Fähigkeiten, gespeichert als JSON-Liste pro
  `(user, server)` in `user_server_permissions`) verfeinern diesen Standard für einen Server; jede
  `/api/servers/:id`-Route, jeder Sub-Router-Mount, jede Seite, jeder WebSocket und jede Flotten-weite Auflistung geht durch
  `src/web/middleware/serverAccess.js` (`serverScope`, gebunden an das `/servers/:id`-Präfix sowohl der API als auch des Seiten-Routers,
  versteckt einen Server ohne `view` als 404; `requireCap(cap)` benennt die Fähigkeit, die eine Route benötigt). Schreibvorgänge, die ihren
  Server im Body benennen (Zeitpläne, Welt-Extraktion und -Installation, Blueprint-Export) werden für Betrachter von `requireWrite` nur für diesen Server geöffnet, und jede solche Route prüft die Fähigkeit selbst. `test/permissions-routes.test.js` durchläuft die Live-Router-Stacks und schlägt fehl, wenn eine Server-bezogene Schreibroute, ein Mount oder eine Seite keine Sperre hat.

## Wichtige Domänenverhalten

- **Modpacks sind immer angepinnt.** Das Image aktualisiert ungepinnte Packs bei jedem Neustart automatisch, daher löst das Panel "latest" zur Installationszeit in eine konkrete Versions-ID auf und pinnt es. Upgrades sind ein expliziter orchestrierter Ablauf (`updates/`): Vorschau → Backup vor dem Update → ordnungsgemäßes Stoppen → Neu-Pinnen → Neuerstellen → Gesundheitsüberwachung → Ein-Klick-Rollback.
- **Das benutzerdefinierte Mod-Overlay** wird vom Panel verwaltet: Benutzerdefinierte Mods landen in der deduplizierten Bibliothek und werden hart verlinkt in den Server, sodass sie Pack-Updates überleben. Das Deaktivieren ist klassenbewusst. Da die Bibliothek jede heruntergeladene Build speichert, zeichnet ein Update die ersetzte Build (`server_content.previous_*`) auf und kann allein aus lokalen Dateien zurückgerollt werden. Das Deaktivieren eines Pack-Mods schreibt stattdessen die Ausschluss-Umgebungsvariable des Packs; `packs.applyPack` überträgt diese und den Rest der Pack-Abstimmung (`PACK_TUNING_KEYS`) über eine Versionsänderung desselben Packs und verwirft sie, wenn das Pack geändert wird.
- **Ein Minecraft-Versions-Upgrade muss verdient werden.** `services/compat.js` scannt die Mods eines Servers – aufgelöst aus vom Panel installierten Zeilen, dann dem CurseForge-Pack-Manifest, dann nach Inhalts-Hash gegen Modrinth/CurseForge – und erstellt eine (Loader, Minecraft-Version) Support-Matrix pro Projekt aus CurseForges `latestFilesIndexes` (200 Projekte pro Anfrage) und Modrinths Projekt-Versionsliste (eine Anfrage pro Projekt, was den Loader und die Version zusammenhält). Der Update-Checker bietet nur die neueste Version an, die JEDER Mod unterstützt, und bietet überhaupt nichts an, wenn die Antwort nicht ermittelt werden kann: kein Scan, ein Scan für eine andere Version oder einen anderen Loader, einer, der nie abgeschlossen wurde, oder ein Jar, das keine Registrierung erkennt. Scans sind nur manuell, und ihr Fortschritt und Teilergebnisse befinden sich in `version_compat` (nicht im In-Memory `services/tasks.js`), sodass eine Aktualisierung oder ein Panel-Neustart fortgesetzt wird, anstatt auf einem Spinner zu hängen; `reconcileScans()` markiert Scans, die durch ein Herunterfahren verwaist wurden, beim nächsten Boot.
- **Die Mod-Loader-Version ist ein Pin, wie alles andere.** `services/loaderPin.js` liest die installierte Build aus dem eigenen Installationsmanifest des Images (`.forge-manifest.json` und Freunde) und schreibt den Pin: die itzg-Variable des Loaders auf einem einfachen Server (`FORGE_VERSION`, …), oder
  `CF_MOD_LOADER_VERSION` auf einem Forge- oder Fabric-CurseForge-Pack, was die vom Pack deklarierte Version überschreibt. Das CurseForge-Installationsprogramm des Images ignoriert diese Überschreibung für NeoForge, und Modrinth- und FTB-Packs haben keine, sodass ihr Loader dem Pack folgt. `packs.applyPack` entfernt jede `CF_`-Variable bei einem Pack-Update oder Rollback, was eine Überschreibung mit dem Rest verwirft. Eine typisierte Build wird zuerst gegen die vollständige Liste der Registrierung geprüft (`services/loaderVersions.js`; Forge's kommt von seinen Maven-Metadaten, die Zahlen überspringen; ein Treffer wird einmal gegen die Registrierung selbst erneut geprüft), dann ist die Änderung Backup → Pin (über die Umgebung, wie sie nach dem Backup ist) → Neuerstellung.
- **Ports** werden aus einem Basisschema zugewiesen (Spiel ab `PORT_GAME_START` aufwärts, RCON = Spiel +
  `PORT_RCON_OFFSET`, Bedrock ab `PORT_BEDROCK_START`), auf Verfügbarkeit geprüft und in der DB reserviert. "Belegt" ist die Vereinigung aller Ansprüche jedes Servers (Live-Ports plus ein ausstehendes Paar darunter), aller Host-Ports, die jeder Docker-Container veröffentlicht (`containers.publishedHostPorts`: Live-Bindungen laufender Container plus konfigurierte Bindungen jedes gestoppten Containers, da eine OS-Bindungsprüfung aus dem Panel-eigenen Container nur den Netzwerk-Namespace dieses Containers sieht) und der OS-Prüfung. Der Docker-Teil wird für 3 s gecacht und begrenzt: eine Liste, die in 2,5 s nicht antwortet, verwirft nur den Docker-Teil, und eine langsame Inspektion kostet nur die Ports dieses Containers. Servererstellungen und `servers.changeGamePort` wählen Ports über eine Serialisierungskette aus, die nur die Auswahl und ihre Beanspruchung abdeckt (die Zeilenschreibung für eine Erstellung, die In-Memory-Reservierung für eine Portänderung);
  BlueMaps Port-Auswahl und die zusätzlichen Port-Überschreibungen sind nicht darin enthalten und konsultieren Docker nicht. Eine Portänderung an einem bestehenden Server (`servers.changeGamePort`, unter dem Server-Op-Lock) wird sofort angewendet, da Docker Port-Bindungen bei der Containererstellung festlegt: das neue Paar (RCON immer Spiel + `PORT_RCON_OFFSET`) wird im Speicher geprüft und reserviert
  (`ports.reserve`, sowohl das alte als auch das neue Paar, von jeder anderen Auswahl berücksichtigt) unter dem Port-Lock. Es wird verweigert (409 `PENDING_CHANGES`), solange andere Einstellungen auf einen Rebuild warten, sodass es nur einen Container neu erstellt, der bereits lief, auf einem neuen Port; und ein laufender Server wird nur geändert, wenn die Anfrage `restart: true` angibt (andernfalls 409 `NEEDS_CONFIRM`). Das Image wird gezogen und ein benutzerdefinierter Containername geprüft, bevor etwas angefasst wird. Ein laufender Server wird gestoppt; dann wird das neue Paar mit `pending_recreate = 1` geschrieben (damit ein Panel-Absturz von dort aus einen ehrlichen "Rebuild pending" hinterlässt), der Container entfernt, mit dem neuen Paar neu erstellt und gestartet. Wenn ein Schritt nach dem Stoppen fehlschlägt, schreibt `putBackOnOldPort` das alte Paar zurück, erstellt es neu (und startet es neu, wenn es lief) und zeichnet auf, welcher Schritt fehlgeschlagen ist; Verlauf und Benachrichtigungen geben an, ob selbst das fehlgeschlagen ist, was den Server gestoppt lässt, bis jemand ihn startet. Die Fähigkeit `settings` reicht aus, auch für laufende Server. Nicht-Admins dürfen nur ab `PORT_GAME_START` aufwärts auswählen.
  (Die Spalten `port_*_pending` aus Migration 029 gehören zu einem früheren, unveröffentlichten Design und werden nicht verwendet; 031 löscht sie.) Eine Lock-Kollision antwortet mit 409 und `code: 'BUSY'`, was die aufrufenden Aufrufer unten prüfen, anstatt die Formulierung. Ein automatischer Neustart nach Absturz
  (`watcher.restartAfterCrash`) und ein geplanter Backup- oder Startvorgang (`scheduler.runTaskWithRetry`), die feststellen, dass der Server mit einer anderen Aktion beschäftigt ist, versuchen es alle 20 s / 60 s für bis zu 30 Minuten erneut, und ein Pack-Update oder Rollback versucht seine gesperrten Schritte auf die gleiche Weise (`opLock.retryWhileBusy`);
  ein Absturz-Neustart oder ein wartender geplanter Start gibt auf, sobald jemand den Server seitdem gestoppt, getötet oder gestartet hat (`events.lifecycleActionSince`), und der Absturz-Neustart auch, wenn der automatische Neustart deaktiviert ist oder der Server weg ist. Geplante Neustarts, Stopps und Befehle werden nicht wiederholt, und ein Zeitplan, dessen letzte Ausführung noch wartet, überspringt seine nächste Auslösung.
- **Festplattenkontingente** werden vom Panel durchgesetzt, da Docker die Nutzung von Bind-Mounts nicht begrenzen kann: Der Indexierer speichert Größen pro Verzeichnis und wachstumsbezogene Festplattenoperationen werden daran gebunden.
- **Geheimnisse** (RCON-Passwörter, API-Schlüssel, TOTP-Geheimnisse, die Discord-Webhook-URL) werden im Ruhezustand mit AES-256-GCM verschlüsselt, wobei ein dedizierter zufälliger Schlüssel unter `$DATA_DIR/.secret-key` (Modus `0600`, automatisch generiert) verwendet wird. Er ist unabhängig von `SESSION_SECRET`; ein von `SESSION_SECRET` abgeleiteter Schlüssel wird als nur-dekodierbarer Fallback für Werte aufbewahrt, die vor dem Vorhandensein des dedizierten Schlüssels geschrieben wurden, und
  `src/services/secretsMigration.js` verschlüsselt diese beim Booten einmal unter dem dedizierten Schlüssel neu.
  Ein `.secret-key`, das existiert, aber nicht geparst werden kann, ist ein schwerwiegender Boot-Fehler (er wird niemals stillschweigend überschrieben). Blaupausen entfernen alle Geheimnisse beim Export.
- **`server.properties` gehört dem Panel, wird aber von Umgebungsvariablen überschattet.** Das itzg-Image setzt jede umgebungsvariablenbasierte Eigenschaft bei jedem Start neu (`OVERRIDE_SERVER_PROPERTIES` ist standardmäßig true), sodass ein Wert, den das Panel direkt bearbeitet – Weltensteuerung PvP/Schwierigkeitsgrad, der Whitelist-Schalter, der Dateieditor – beim nächsten Start stillschweigend zurückgesetzt würde, es sei denn, die entsprechende Umgebungsvariable wird entfernt und der Container neu erstellt. Jeder direkte Eigenschaftsschreibvorgang geht durch `writeServerProperties()` (ganze Datei) oder `setServerProperty()` (ein Schlüssel) in `src/services/servers.js`, die die Datei atomar neu schreiben, die Umgebungsvariable hinter jedem geänderten Schlüssel unsetten (über das `prop:`-Attribut auf Katalogfeldern, das in Tests gegen die eigenen Eigenschaftsdefinitionen des Images geprüft wird) und `pending_recreate` kennzeichnen. Der Schwierigkeitsgrad wird sowohl in die Datei geschrieben als auch über RCON gesendet, da ein dedizierter Server die Eigenschaft `difficulty` bei jedem Boot neu anwendet. Minecraft selbst speichert `server.properties` aus seinen Boot-Werten neu, wenn `whitelist on/off` aufgerufen wird, was Bearbeitungen, die während des Serverbetriebs vorgenommen wurden, rückgängig machen würde. Der laufende Whitelist-Schalter speichert daher zuerst die Datei und schreibt sie mit nur `white-list` geändert zurück. Die Umgebungsvariablen bleiben bei der Erstellung vollständig konfigurierbar (der Assistent rendert sie und sie werden einmal angewendet); sie entpinnen sich erst beim ersten Mal, wenn das Panel die zugrunde liegende Eigenschaft bearbeitet. MOTD hat den gleichen Vertrag: eine direkte Bearbeitung der `motd`-Datei setzt sie zurück, sodass der letzte Schreibvorgang gewinnt.

## Daten- und Wire-Formate

- **`data/panel.db`** - die SQLite-Datenbank. Täglich gesnapshottet über `VACUUM INTO` nach
  `data/backups/_panel/` (die neuesten 14 werden aufbewahrt); `PRAGMA integrity_check` wird beim Booten ausgeführt.
- **`data/.session-secret`** - das automatisch generierte Cookie-Signierungs-Geheimnis, erstellt beim ersten Start, wenn
  `SESSION_SECRET` nicht gesetzt ist. Das Löschen rotiert das Geheimnis (was Sitzungen ungültig macht).
- **`data/.secret-key`** - der dedizierte 32-Byte-Verschlüsselungsschlüssel im Ruhezustand (Modus `0600`), automatisch erstellt
  beim ersten Start. Unabhängig von `SESSION_SECRET`; das Löschen macht jedes gespeicherte Anmeldeinformations-
  unentschlüsselbar, daher gehört es zu Ihren Backups.
- **Blaupausen (`.mcserver.zip`)** - ein Zip mit einer `manifest.json`, die Konfiguration, Ressourcen, den
  angehefteten Pack-Referenz, das Overlay-Manifest (Quell-URLs + sha256), ausgewählte Konfigurationsdateien und
  optional eine Welt beschreibt. Der Import lädt jeden Mod neu herunter und verifiziert ihn per Hash und weist neue Ports zu.
- **Docker-Container**, die vom Panel erstellt werden, sind benannt und gelabelt, damit der Watcher sie finden kann;
  das Panel besitzt ihren gesamten Lebenszyklus.

## Boot-Sequenz

1. `require('./instrument')` (die Sentry-Naht) vor allem anderen, dann `require('./preflight')`
   um bei einer nicht unterstützten Node-Version klar zu scheitern.
2. Konfiguration laden; `.session-secret` **und** `.secret-key` sicherstellen/generieren.
3. `ensureDataRoot()` - das `./data`-Layout erstellen, `tmp/` löschen.
4. DB-Migrationen ausführen, dann `PRAGMA integrity_check` (protokolliert lautstark, zeigt auf `data/backups/_panel`
   bei einem Fehler).
5. Legacy `SESSION_SECRET`-verschlüsselte Geheimnisse unter `.secret-key` neu verschlüsseln (`secretsMigration`).
6. API-Schlüssel einmalig aus der Umgebung importieren (`apiKeys.importFromEnvOnce()`), jeden Server anpinnen, der noch einen ungepinnten Modpack-Selektor trägt (`packPins.pinUnpinnedServers()`), als unterbrochen markierte Versionskompatibilitäts-Scans aus einem vorherigen Prozess kennzeichnen
   (`compat.reconcileScans()`), dann Starter-Blaupausen seeden (geschützt).
7. HTTP- + WS-Server starten. Bei einem exponierten Bind den ersten Start-`/setup`-PIN ausgeben.
8. Den Laufzeit-Guard nach dem Booten installieren (fängt nicht abgefangene Fehler ab; `MSM_EXIT_ON_FATAL=1` sorgt für einen harten Exit für beaufsichtigte Deployments).
9. Hintergrunddienste starten: WS-Broker, Speicherindexierer, Absturz- + Inventar-Watcher, Scheduler,
   Discord-Ereignisbrücke, Chatbot-Outreach-Watcher und der **tägliche Wartungstimer** (alte Analysezeilen, Chatbot-Transkripte, Ereignisverlauf (365 Tage) und API-Cache-Zeilen bereinigen, dann `panel.db` schnappschussen).
10. Docker **im Hintergrund** initialisieren. Die Benutzeroberfläche ist vollständig nutzbar, während der Daemon unten ist;
    Docker-Funktionen leuchten auf, sobald er erreichbar wird. Nach der Verbindung gleicht `refreshStatuses({ boot })`
    die gecachten Status ab, sendet ein einmaliges `offline-after-restart`-Ereignis für einen Server, der vor dem Panel-Neustart hochgefahren war und nicht wieder hochgefahren wird, und die Boot-Schleife startet
    `auto_start`-Server und stellt `auto_restart`-Server wieder her, die während des Ausfalls abgestürzt sind
    (unter Berücksichtigung des Crash-Loop-Backoffs).

> Die Reihenfolge Instrument-vor-Preflight ist ein bewusster Kompromiss: Sie ermöglicht es einer zukünftigen Sentry-Verdrahtung,
> die Laufzeit zuerst zu patchen, auf Kosten einer etwas weniger freundlichen Nachricht bei einer wirklich alten Node-Version.

## Build-Pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM mit Code-Splitting). `postinstall` führt **nur CSS** aus. `public/css/app.css`
und `public/dist/` sind Git-ignorierte Build-Artefakte; die Dockerfile-Build-Stufe führt den vollständigen
`pnpm run build` aus und kopiert `public/` in das Laufzeit-Image. Statische Assets werden
`immutable`/long-cache für fingerabgedruckte Dateien, short-cache für CSS/JS und `no-cache` für HTML und
`/api` serviert.

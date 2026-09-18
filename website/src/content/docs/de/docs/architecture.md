---
title: 'Architektur'
description: 'Minecraft Server Manager ist eine Single-Process, serverseitig gerenderte Node.js-Anwendung.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/architecture.md'
---

[← Zurück zum Doku-Index](/docs/)

Minecraft Server Manager ist eine Single-Process, Server-gerenderte Node.js-Anwendung. Sie verwaltet
Minecraft-Server, die als Docker-Container mit dem
[itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server) Image laufen, und kommuniziert
mit dem Docker-Daemon über dessen API (niemals durch Aufruf der `docker` CLI).

## Laufzeitstruktur

- **Express + Handlebars** rendern Seiten serverseitig. Es gibt keine SPA; das Browser-JS in `public/js/`
  ist handgeschriebene progressive Verbesserung. Ein esbuild-Schritt (`pnpm run build:js`) bündelt und
  minifiziert es zu `public/dist/js/`; die App liefert dieses Bundle, wenn es vorhanden ist, andernfalls
  die rohen Quelldateien, sodass ein Entwicklungs-Lauf ohne Build trotzdem funktioniert.
- **`node:sqlite`** (in Node integriert; das Panel benötigt Node ≥ 24) ist die Datenbank – synchron,
  null native Module, WAL-Modus. Ein kleiner, versionierter Migrationsläufer wendet `src/db/migrations/*`
  beim Start an. Prepared Statements werden in `src/db/index.js` mit dem SQL-Text als Schlüssel gecacht.
- **`ws`** transportiert die Live-Konsolen- und Statistik-Streams. Beide sind **vermittelt**: ein Upstream
  `docker logs --follow` (oder `docker stats`) pro Server, einmal demuxed und an jeden
  verbundenen Tab verteilt, anstatt ein Upstream pro Betrachter. Der Konsolen-Broker hält einen kleinen
  Wiederholungspuffer für spät beitretende Tabs und verwirft einen Abonnenten, dessen Socket zu weit
  zurückfällt, anstatt den gemeinsamen Stream zu verlangsamen.
- **dockerode** ist der einzige Weg, wie die App mit Docker spricht. Der Endpunkt wird plattformabhängig
  automatisch erkannt (Windows Named Pipe vs. Unix Socket).
- **Der gesamte persistente Zustand befindet sich in einem Verzeichnis** (`$DATA_DIR`, Standard `./data`). Das
  Kopieren dieses Verzeichnisses migriert das gesamte Panel.

## Schichtung

Abhängigkeiten fließen in eine Richtung:

```
                 ┌─────────────────────────────┐
   HTTP  ───────▶│  web/routes/*  (+ middleware)│   Input parsen & validieren, Antworten formen
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

- **`web/routes/`** - ein Router pro Domäne (`servers`, `players`, `worlds`, `crashes`, `blueprints`,
  `files`, …), gemountet in `web/app.js`. Router validieren mit zod, rufen einen Service auf und geben
  JSON zurück oder rendern eine Ansicht. Geschäftslogik gehört hier nicht hin. Zwei Router sind in der
  **öffentlichen Zone** gemountet, vor `requireAuth`: `routes/status.js` (opt-in HTML-Statusseiten pro
  Server) und `routes/apiV1.js` (`/api/v1`, eine schreibgeschützte JSON-API, authentifiziert durch ein
  von einem Admin ausgestelltes Bearer-Token aus `services/apiTokens.js`, deaktiviert, es sei denn, es ist
  in den Einstellungen aktiviert; siehe `docs/public-api.md`).
- **`services/`** - das Herzstück der App. Jeder Service verwaltet eine Domäne und kann von
  Infrastruktur und anderen Services abhängen.
- **`docker/`** - dockerode-Wrapper: `connect` (Endpunkterkennung + Daemon-Gesundheit), `containers`
  (Erstellen/Starten/Stoppen/Neuerstellen mit Bind-Mounts, Speicher-/CPU-Limits und Labels), `logs`, `stats`,
  `images` und ein `watcher`, der Docker-Ereignisse in Historie + Absturzerkennung umwandelt.
- **`db/`** - der SQLite-Wrapper und Migrationsläufer.
- **`storage/`** - der `./data`-Bootstrap, der **Pfadschutz** (`safeJoin`, das Rückgrat der Dateisicherheit)
  und der Hintergrund-Größenindexierer + Quoten-Erzwingung.

Übergreifend:

- **`config/`** - Umgebungskonfiguration plus der **Feldkatalog**: die einzige Quelle der Wahrheit für
  Servereinstellungen. Jede itzg-Umgebungsvariable ist katalogisiert (Label, Hilfe, Typ, Einheit, Standard,
  Validierung, Abschnitt, Gefahren-Flags). Der Assistent, die Einstellungsformulare und die zod-Validierung
  leiten sich alle davon ab, sodass das Hinzufügen einer neuen Einstellung eine Datenänderung ist, keine neue
  UI-Verdrahtung.
- **`events/`** - `recordEvent()` ist der einzige Einstiegspunkt für das Verlaufsprotokoll; Lebenszyklusereignisse
  erfassen auch Auszüge aus Container-Logs in `data/logs/<id>/events/`.
- **`ws/`** - authentifizierte Konsolen- + Statistik-WebSockets (Sitzungs-Cookie wird beim Upgrade verifiziert,
  `Origin` wird geprüft, um Cross-Site-Hijacking zu blockieren), vermittelt pro Server (siehe "Laufzeitstruktur").
- **`logger.js` + `instrument.js`** - `require('./logger')(label)` gibt einen pro Modul
  [Pino](https://getpino.io)-Logger zurück; Level von `LOG_LEVEL`, `makeFailureThrottle()` hält eine
  dauerhaft fehlschlagende Hintergrundschleife auf einer Protokollzeile plus einer "wiederhergestellten" Zeile.
  `src/utils/logSanitize.js` schwärzt Anmeldeinformations-förmige Schlüssel und Webhook-Token aus den strukturierten
  Metadaten; `src/config/logLevel.js` ist die gemeinsame Level-Allowlist (separat gehalten, um einen Require-Zyklus
  mit `config` zu vermeiden). `src/instrument.js` ist eine ruhende Sentry-Nahtstelle, die zuerst in
  `src/server.js` geladen wird. `src/web/middleware/requestLog.js` schreibt eine Zugriffslog-Zeile pro Anfrage
  (überspringt `/healthz` und statische Assets). ESLint erzwingt `no-console` unter `src/**`, wobei
  `preflight.js`, `instrument.js` und `config/index.js` ausgenommen sind (sie laufen, bevor der Logger existiert).
- **Ratenbegrenzung** - `src/web/middleware/rateLimit.js` platziert `express-rate-limit` vor `/api`
  (`RATE_LIMIT_API_PER_MIN`, Standard 1200) und die Login- / 2FA- / Setup-POSTs
  (`RATE_LIMIT_AUTH_PER_15MIN`, Standard 100); `0` deaktiviert einen Limiter. Er schlüsselt nach `req.ip`,
  daher ist `TRUST_PROXY` hinter einem Proxy wichtig. `/api/v1` hat seinen eigenen Limiter pro Token
  (`RATE_LIMIT_PUBLIC_API_PER_MIN`, Standard 120), der nach einem Hash des Bearer-Tokens mit einem IP-Fallback
  schlüsselt. Ein separater Zähler pro Konto in
  `src/web/middleware/auth.js` behandelt die Login-Sperre (pro IP und global pro Konto, abklingend).

## Wichtige Domänenverhalten

- **Modpacks sind immer angepinnt.** Das Image aktualisiert ungepinte Packs bei jedem Neustart automatisch,
  daher löst das Panel "latest" zur Installationszeit in eine konkrete Versions-ID auf und pinnt es.
  Upgrades sind ein expliziter orchestrierter Ablauf (`updates/`): Vorschau → Backup vor Update →
  ordnungsgemäßer Stopp → Neu-Pinning → Neuerstellung → Gesundheitsüberwachung → Ein-Klick-Rollback.
- **Das benutzerdefinierte Mod-Overlay** wird vom Panel verwaltet: vom Benutzer hinzugefügte Mods landen in der
  deduplizierten Bibliothek und werden hart verlinkt in den Server, sodass sie Pack-Updates überleben.
  Deaktivierung ist klassenbewusst.
- **Ports** werden aus einem Basisschema zugewiesen (Spiel ab `PORT_GAME_START` aufwärts, RCON = Spiel +
  `PORT_RCON_OFFSET`, Bedrock ab `PORT_BEDROCK_START`), auf Verfügbarkeit geprüft und in der DB reserviert.
- **Festplattenkontingente** werden vom Panel erzwungen, da Docker die Nutzung von Bind-Mounts nicht begrenzen
  kann: Der Indexierer cacht Verzeichnisgrößen und Festplattenwachstumsoperationen werden daran gekoppelt.
- **Geheimnisse** (RCON-Passwörter, API-Schlüssel, TOTP-Geheimnisse, die Discord-Webhook-URL) werden im Ruhezustand
  mit AES-256-GCM verschlüsselt, wobei ein dedizierter zufälliger Schlüssel unter `$DATA_DIR/.secret-key`
  (Modus `0600`, automatisch generiert) verwendet wird. Er ist unabhängig von `SESSION_SECRET`; ein von
  `SESSION_SECRET` abgeleiteter Schlüssel wird als Fallback nur zum Entschlüsseln für Werte aufbewahrt, die
  vor dem Vorhandensein des dedizierten Schlüssels geschrieben wurden, und
  `src/services/secretsMigration.js` verschlüsselt diese beim Start einmal unter dem dedizierten Schlüssel neu.
  Ein vorhandener `.secret-key`, der nicht geparst werden kann, ist ein schwerwiegender Startfehler (er wird niemals
  stumm überlagert neu generiert). Blueprints entfernen alle Geheimnisse beim Export.

## Daten- & Wire-Formate

- **`data/panel.db`** - die SQLite-Datenbank. Täglich per `VACUUM INTO` nach
  `data/backups/_panel/` gesnapshottet (die neuesten 14 werden aufbewahrt); `PRAGMA integrity_check` läuft beim Start.
- **`data/.session-secret`** - das automatisch generierte Cookie-Signierungsgeheimnis, erstellt beim ersten Lauf, wenn
  `SESSION_SECRET` nicht gesetzt ist. Das Löschen rotiert das Geheimnis (was Sitzungen ungültig macht).
- **`data/.secret-key`** - der dedizierte 32-Byte-Verschlüsselungsschlüssel im Ruhezustand (Modus `0600`), automatisch
  beim ersten Lauf erstellt. Unabhängig von `SESSION_SECRET`; das Löschen macht jedes gespeicherte Anmeldeinformations-Geheimnis
  unentschlüsselbar, daher gehört es zu Ihren Backups.
- **Blueprints (`.mcserver.zip`)** - ein Zip mit einer `manifest.json`, die Konfiguration, Ressourcen, die
  angeheftete Pack-Referenz, das Overlay-Manifest (Quell-URLs + sha256), ausgewählte Konfigurationsdateien und
  optional eine Welt beschreibt. Der Import lädt jeden Mod neu herunter und verifiziert ihn per Hash und weist neue Ports zu.
- **Docker-Container**, die vom Panel erstellt werden, sind benannt und gelabelt, damit der Watcher sie finden kann;
  das Panel besitzt ihren gesamten Lebenszyklus.

## Startsequenz

1. `require('./instrument')` (die Sentry-Nahtstelle) vor allem anderen, dann `require('./preflight')`
   um bei einer nicht unterstützten Node-Version klar zu scheitern.
2. Konfiguration laden; `.session-secret` **und** `.secret-key` sicherstellen/generieren.
3. `ensureDataRoot()` - das `./data`-Layout erstellen, `tmp/` löschen.
4. DB-Migrationen ausführen, dann `PRAGMA integrity_check` (protokolliert laut, zeigt bei Fehler auf `data/backups/_panel`).
5. Legacy-Secrets, die mit `SESSION_SECRET` verschlüsselt wurden, unter `.secret-key` neu verschlüsseln (`secretsMigration`).
6. Starter-Blueprints (geschützt) säen.
7. HTTP- + WS-Server starten. Auf einer exponierten Bindung die PIN für den ersten Lauf `/setup` ausgeben.
8. Laufzeit-Guard nach dem Booten installieren (fängt nicht abgefangene Fehler ab; `MSM_EXIT_ON_FATAL=1` bewirkt einen harten Exit für überwachte Deployments).
9. Hintergrunddienste starten: WS-Broker, Speicher-Indexierer, Absturz- + Inventar-Watcher, Scheduler,
   Discord-Event-Bridge und der **tägliche Wartungstimer** (alte Analysezeilen bereinigen + `panel.db`
   schnappschießen).
10. Docker **im Hintergrund** initialisieren. Die UI ist vollständig nutzbar, während der Daemon unten ist;
    Docker-Funktionen leuchten auf, sobald er erreichbar wird. Nach der Verbindung gleicht `refreshStatuses({ boot })`
    die gecachten Status ab, sendet ein einmaliges `offline-after-restart`-Ereignis für einen Server, der vor dem
    Panel-Neustart lief und nicht wieder gestartet wird, und die Boot-Schleife startet
    `auto_start`-Server und stellt abgestürzte `auto_restart`-Server wieder her (unter Berücksichtigung des
    Crash-Loop-Backoffs).

> Die Reihenfolge Instrument-vor-Preflight ist ein bewusster Kompromiss: Sie ermöglicht es einer zukünftigen Sentry-Verdrahtung,
> die Laufzeit zuerst zu patchen, auf Kosten einer etwas weniger freundlichen Meldung bei einem wirklich alten Node.

## Build-Pipeline

`pnpm run build` = `build:css` (Tailwind → `public/css/app.css`) + `build:js` (esbuild →
`public/dist/js/`, ESM mit Code-Splitting). `postinstall` führt **nur CSS** aus. `public/css/app.css`
und `public/dist/` sind Git-ignorierte Build-Artefakte; die Dockerfile-Build-Stufe führt den vollständigen
`pnpm run build` aus und kopiert `public/` in das Laufzeit-Image. Statische Assets werden
`immutable`/long-cache für fingerabgedruckte Dateien, short-cache für CSS/JS und `no-cache` für HTML und
`/api` ausgeliefert.

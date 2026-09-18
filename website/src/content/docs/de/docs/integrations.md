---
title: 'Integrationen'
description: 'Jeder Server führt seine Integrationen unter der Gruppe Einstellungen: Discord, eine öffentliche Statusseite, Einladungen mit einem Klick und der optionale Chatbot-Tab.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Zurück zum Doku-Index](/docs/)

Jeder Server verfügt über seine Integrationen in der Gruppe **Einstellungen**: **Discord**, eine öffentliche **Statusseite**, Ein-Klick-**Einladungen** und den optionalen **Chatbot**-Tab. Diese Seite behandelt Discord (die anderen haben ihre eigenen Dokumentationen und Setup-Helfer im Panel).

## Discord-Benachrichtigungen

Das Panel leitet Serverereignisse über einen Webhook an einen Discord-Kanal weiter. Kein Bot, kein OAuth.

### Einrichtung

1. In Discord: **Servereinstellungen → Integrationen → Webhooks → Neuer Webhook**. Wählen Sie den Kanal aus und kopieren Sie die Webhook-URL.
2. Öffnen Sie im Panel die Registerkarte **Einstellungen → Discord** des Servers, fügen Sie die URL in **Webhook-URL** ein, schalten Sie die Karte **ein** und **speichern** Sie. Die URL wird verschlüsselt gespeichert (im selben Ruhespeicher wie Ihre API-Schlüssel).
3. Verwenden Sie **Test senden**, um zu bestätigen, dass es funktioniert.

![Discord-Integration](/docs/images/integrations-discord.png)

Um eine gespeicherte URL zu ersetzen, fügen Sie eine neue ein und speichern Sie. Lassen Sie das Feld leer, um die aktuelle beizubehalten. Die gespeicherte URL wird maskiert angezeigt (das Token ist verborgen).

### Was wird gesendet

Benachrichtigungen sind in umschaltbare Kategorien gruppiert. Alle sind standardmäßig aktiviert.

| Kategorie         | Ereignisse                                                     |
| ----------------- | -------------------------------------------------------------- |
| **Start / Stopp** | Server gestartet, Server gestoppt                              |
| **Abstürze**      | Absturz, Absturzschleife erkannt, neuer Absturzbericht         |
| **Backups**       | Backup erstellt, Backup wiederhergestellt                      |
| **Updates**       | Update angewendet, Update zurückgerollt, Update fehlgeschlagen |
| **Kicks / Bans**  | Spieler gekickt, Spieler gebannt                               |
| **Warnungen**     | Die Dinge, die einen Server leise kaputt lassen (siehe unten)  |

### Die Kategorie Warnungen

`Warnungen` ist der Kanal "etwas braucht einen Menschen" für Bedingungen, die früher nur im Panel sichtbar waren:

| Ereignis                | Bedeutung                                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Der Container wurde wegen Speichermangels gestoppt.                                                                              |
| `unhealthy`             | Der Prozess läuft, aber die `mc-health`-Sonde schlägt fehl: ein lebendiger, aber toter Server.                                   |
| `startup-stalled`       | Startet nach ca. 10 Minuten immer noch, ohne "Fertig" in den Protokollen (mit einer Diagnose, was zu beheben ist, wenn bekannt). |
| `stop-failed`           | Ein ordnungsgemäßes Herunterfahren hat nicht gegriffen und der Container läuft immer noch.                                       |
| `schedule-failed`       | Ein geplanter Neustart / Backup / Befehl ist fehlgeschlagen.                                                                     |
| `quota-exceeded`        | Das Festplattenspeicher-Quota im Strict-Modus wurde ausgelöst und der Server wurde gestoppt.                                     |
| `offline-after-restart` | Der Server war vor dem Neustart des Panels online, ist es jetzt nicht mehr und wird nicht automatisch gestartet.                 |
| `crash-report`          | Ein neuer Absturzbericht wurde erfasst und analysiert.                                                                           |
| `update-failed`         | Ein geschütztes Upgrade kam nicht gesund hoch.                                                                                   |

### Wie die Zustellung funktioniert

Eine Hintergrundbrücke fragt das [Ereignisprotokoll](/docs/activity/) alle 15 Sekunden ab und leitet zugeordnete Zeilen weiter. Wenn ein Webhook-POST vorübergehend fehlschlägt, wird diese Zeile bei späteren Abfragen erneut versucht, anstatt verworfen zu werden; ein dauerhaft unerreichbarer Webhook wird nach einigen Versuchen stummgeschaltet (eine Protokollzeile pro Stunde). Die Brücke spielt niemals Ereignisse ab, die vor dem Start des Panels aufgetreten sind.

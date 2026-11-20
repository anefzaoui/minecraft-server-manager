---
title: 'Integrationen'
description: 'Jeder Server hat seine Integrationen unter der Gruppe Einstellungen: Discord, eine öffentliche Statusseite, Einladungen mit einem Klick und der optionale Chatbot-Tab (nur für Admins).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Zurück zum Dokumentenindex](/docs/)

Jeder Server verfügt über seine Integrationen in der Gruppe **Einstellungen**: **Discord**, eine öffentliche **Statusseite**, Ein-Klick-**Einladungen** und den optionalen Tab **Chatbot** (nur für Administratoren). Diese Seite behandelt Discord; [Einladungen & Statusseite](/docs/invites-and-status-page/) behandelt diese beiden, und [der Chatbot](/docs/chatbot/) hat seine eigene Seite.

## Discord-Benachrichtigungen

Das Panel leitet Serverereignisse über einen Webhook an einen Discord-Kanal weiter. Kein Bot, kein OAuth.

### Einrichtung

1. In Discord: **Servereinstellungen → Integrationen → Webhooks → Neuer Webhook**. Wählen Sie den Kanal aus und kopieren Sie die Webhook-URL.
2. Öffnen Sie im Panel den Tab **Einstellungen → Discord** des Servers, fügen Sie die URL in **Webhook-URL** ein, schalten Sie die Karte **ein** und klicken Sie auf **Speichern**. Die URL wird verschlüsselt gespeichert (im selben Ruhespeicher wie Ihre API-Schlüssel).
3. Verwenden Sie **Test senden**, um zu bestätigen, dass es funktioniert.

![Discord-Integration](/docs/images/integrations-discord.png)

Um eine gespeicherte URL zu ersetzen, fügen Sie eine neue ein und speichern Sie; lassen Sie das Feld leer, um die aktuelle beizubehalten. Die gespeicherte URL wird maskiert angezeigt (das Token ist verborgen).

### Was wird gesendet

Benachrichtigungen sind in umschaltbare Kategorien unterteilt. Alle sind standardmäßig aktiviert.

| Kategorie         | Ereignisse                                                          |
| ----------------- | ------------------------------------------------------------------- |
| **Start / Stopp** | Server gestartet, Server gestoppt                                   |
| **Abstürze**      | Absturz, Absturzschleife erkannt, neuer Absturzbericht              |
| **Backups**       | Backup erstellt, Backup wiederhergestellt                           |
| **Updates**       | Update angewendet, Update rückgängig gemacht, Update fehlgeschlagen |
| **Kicks / Bans**  | Spieler gekickt, Spieler gebannt                                    |
| **Warnungen**     | Die Dinge, die einen Server leise kaputt lassen (siehe unten)       |

### Die Kategorie Warnungen

`Warnungen` ist der Kanal "etwas braucht einen Menschen" für Bedingungen, die früher nur im Panel sichtbar waren:

| Ereignis                | Bedeutung                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Der Container wurde wegen Speichermangels gestoppt.                                                                                     |
| `unhealthy`             | Der Prozess läuft, aber die `mc-health`-Sonde schlägt fehl: ein lebendiger, aber toter Server.                                          |
| `startup-stalled`       | Startet nach ca. 10 Minuten immer noch, ohne "Fertig" in den Protokollen (mit einer Diagnose, was zu beheben ist, wo eine bekannt ist). |
| `stop-failed`           | Ein ordnungsgemäßes Herunterfahren hat nicht stattgefunden und der Container läuft immer noch.                                          |
| `schedule-failed`       | Ein geplanter Neustart / Backup / Befehl ist fehlgeschlagen.                                                                            |
| `quota-exceeded`        | Das Festplattenspeicherlimit im Strict-Modus wurde ausgelöst und der Server wurde gestoppt.                                             |
| `offline-after-restart` | Der Server war vor dem Neustart des Panels aktiv, ist es jetzt nicht mehr und wird nicht automatisch gestartet.                         |
| `port-change-failed`    | Eine Portänderung ist fehlgeschlagen und der Server konnte nicht auf seinen alten Port zurückgesetzt werden, daher ist er ausgefallen.  |
| `auto-restart-gave-up`  | Ein abgestürzter Server wurde nicht neu gestartet, da eine andere Aktion ihn zu lange beschäftigt hielt.                                |

### Wie die Zustellung funktioniert

Eine Hintergrundbrücke prüft alle 15 Sekunden das [Ereignisprotokoll](/docs/activity/) und leitet zugeordnete Zeilen weiter. Wenn ein Webhook-POST vorübergehend fehlschlägt, wird diese Zeile bei späteren Prüfungen erneut versucht, anstatt verworfen zu werden; nach einigen fehlgeschlagenen Versuchen wird die Zeile übersprungen, und Zustellungsfehler werden höchstens einmal pro Stunde und Server protokolliert. Nach einem Panel-Neustart sendet die Brücke die noch nicht zugestellten Ereignisse, aber nie mehr als zwei Stunden zurück; bei ihrer allerersten Ausführung beginnt sie mit dem neuesten Ereignis.

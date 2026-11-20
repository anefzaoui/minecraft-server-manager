---
title: 'Konsole & Chat-Befehle'
description: 'Der Reiter "Konsole" streamt das Serverprotokoll in Echtzeit und bietet eine Befehlszeile, um beliebige Serverbefehle zu senden.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Zurück zum Docs-Index](/docs/)

## Die Live-Konsole

Der Tab **Konsole** streamt das Serverprotokoll in Echtzeit und bietet ein Befehlsfeld zum Senden beliebiger Serverbefehle. Kein `docker exec`, kein SSH. Die Ausgabe erscheint direkt, inklusive Farben. Zum Senden von Befehlen ist die Berechtigung "Console" für diesen Server erforderlich; ohne diese kannst du nur das Protokoll ansehen.

Oberhalb des Protokolls kannst du Zeilen nach Text (oder einem `/Regex/`) und nach Level (INFO, WARN, ERROR) filtern. **Herunterladen** bietet die aktuelle Ausgabe, die vollständige `latest.log` oder alle Protokolldateien als ZIP-Archiv an.

![Konsole](/docs/images/server-console.png)

Die Konsole ist auch der Ort, an dem das Panel den Zustand des Servers liest: Es beobachtet das Protokoll, um die Startphase zu klassifizieren ("Lade Mods", "Generiere Welt", "Starte fertig") und ruft `list` auf, um zu verfolgen, wer online ist, damit das Dashboard und die Serverkarten immer die Realität widerspiegeln.

Dieses Abfragen öffnet pro Zyklus eine kurzlebige RCON-Verbindung, die im Serverprotokoll als Paar `Thread RCON Client … started` / `shutting down` alle ~20 Sekunden protokolliert wird, sowie (auf Servern, deren Kern oder Plugins dies wiedergeben) eine Zeile `Rcon issued server command: …` für jede schreibgeschützte Abfrage (`list` für Spieleranzahl, sowie `time query …` und `gamerule <name>`-Lesevorgänge, während "World Controls" geöffnet ist). Der Schalter **Konsolenrauschen ausblenden** oberhalb des Protokolls filtert diese Zeilen heraus (zusammen mit den Startzeilen des RCON-Listeners). Er ist standardmäßig aktiviert und wird pro Browser gespeichert; deaktiviere ihn, um den rohen Stream zu sehen.

Vom Panel gesendete Befehle können im Spiel unter einem pro Server definierten Label (das Feld **Ankündigen als…**) angekündigt werden, damit die Spieler wissen, dass ein Operator gehandelt hat und nicht eine mysteriöse Konsole.

## Chat

**Konsole → Chat** sendet Nachrichten in das Spiel, während der Server läuft: **Formatierte** Nachrichten übernehmen Farben und Formatierungen und können an alle oder einen einzelnen Online-Spieler gesendet werden. **Einfache** Nachrichten senden eine einfache `[Server]`-Übertragung an alle.

![Konsole → Chat](/docs/screenshots/04-chat.png)

## Chat-Befehle

Chat-Befehle (**Konsole → Befehle**) ermöglichen es Spielern, Panel-Aktionen auszulösen, indem sie einen Präfixbefehl im Spiel-Chat eingeben, z. B. `!spawn` für zufällige Teleportation. Die Erkennung basiert auf Protokollen und die Ausführung erfolgt über den Server, sodass **keine Mods erforderlich sind**.

![Chat-Befehle](/docs/images/chat-commands.png)

Jeder Befehl hat:

- Einen **Auslöser** (z. B. `spawn`), der nach dem **Präfix** des Servers eingegeben wird (`!` standardmäßig, ein oder zwei Zeichen, niemals `/`).
- Eine **Aktion**: zufällige Teleportation, Teleportation zu einer Struktur, Teleportation zu einem Biom oder Ausführung von rohen Konsolenbefehlen.
- Eine **Berechtigungsstufe**: alle, Spieler auf der Whitelist oder nur Operatoren.
- Eine pro Spieler **Abklingzeit** (standardmäßig 30 Sekunden) und anpassbare Nachrichten für ausstehende / erfolgreiche / fehlgeschlagene Aktionen mit Platzhaltern wie `{distance}`.

### Ein Hinweis zur Sicherheit

Befehle, die einen Server beschädigen können (`stop`, `op`, `ban`, `whitelist` und ähnliche), sind nur bei **Operator-only**-Auslösern erlaubt. Das Panel prüft dies auch, wenn sie in eine `execute … run …`-Kette verschachtelt sind, sodass ein Auslöser mit niedriger Berechtigung keinen gefährlichen Befehl einschleusen kann. Gewöhnlicher Chat-Text, der diese Wörter nur erwähnt (wie eine `say`-Nachricht), wird ignoriert.

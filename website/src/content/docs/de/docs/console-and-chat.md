---
title: 'Konsole & Chat-Befehle'
description: 'Der Reiter "Konsole" streamt das Serverprotokoll in Echtzeit und bietet eine Befehlszeile, um beliebige Serverbefehle zu senden.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

## Die Live-Konsole

Der Tab **Konsole** streamt das Serverprotokoll in Echtzeit und bietet ein Befehlsfeld zum Senden beliebiger Serverbefehle. Kein `docker exec`, kein SSH. Die Ausgabe erscheint direkt, inklusive Farben.

![Konsole](/docs/images/server-console.png)

Die Konsole ist auch dort, wo das Panel den Status des Servers liest: Es beobachtet das Protokoll, um die Startphase zu klassifizieren („Lade Mods“, „Generiere Welt“, „Starte fertig“) und ruft `list` auf, um zu verfolgen, wer online ist, sodass das Dashboard und die Serverkarten immer die Realität widerspiegeln.

Diese Abfrage öffnet pro Zyklus eine kurzlebige RCON-Verbindung, die der Server als Paar von `Thread RCON Client … started` / `shutting down` alle ~20 Sekunden protokolliert, und (auf Servern, deren Kern oder Plugins dies widerspiegeln) eine Zeile `Rcon issued server command: …` für jede schreibgeschützte Abfrage – `list` für Spieleranzahlen, plus `time query …` und `gamerule <name>`-Lesevorgänge, während die Seite „Weltsteuerung“ geöffnet ist. Der Schalter **RCON-Rauschen ausblenden** über dem Protokoll filtert diese Zeilen heraus (zusammen mit den Startzeilen des RCON-Listeners). Er ist standardmäßig aktiviert und wird pro Browser gespeichert; schalten Sie ihn aus, um den Rohdatenstrom zu sehen.

Vom Panel gesendete Befehle können im Spiel unter einem pro Server definierten Label angekündigt werden, sodass Spieler wissen, dass ein Operator gehandelt hat und nicht eine mysteriöse Konsole.

## Chat-Befehle

Chat-Befehle ermöglichen es Spielern, Panel-Aktionen auszulösen, indem sie einen Präfix-Befehl im Spiel-Chat eingeben, z. B. `!spawn` für zufällige Teleportation. Die Erkennung basiert auf dem Protokoll und die Ausführung erfolgt über den Server, sodass **keine Mods erforderlich sind**.

![Chat-Befehle](/docs/images/chat-commands.png)

Jeder Befehl hat:

- Einen **Auslöser** (z. B. `spawn`) und ein **Präfix** (standardmäßig `!`).
- Eine **Aktion**: zufällige Teleportation, Teleportation zu einer Struktur, Teleportation zu einem Biom oder Ausführung von rohen Konsolenbefehlen.
- Eine **Berechtigungsstufe**: jeder, nur Whitelist-Spieler oder nur Operatoren.
- Eine **Abklingzeit** und anpassbare Nachrichten für ausstehende / erfolgreiche / fehlgeschlagene Aktionen mit Platzhaltern wie `{distance}`.

### Ein Hinweis zur Sicherheit

Befehle, die einen Server beschädigen können (`stop`, `op`, `ban`, `whitelist` und ähnliche), sind nur mit **nur für Operatoren**-Auslösern erlaubt. Das Panel prüft dies auch, wenn sie in eine `execute … run …`-Kette verschachtelt sind, sodass ein Auslöser mit niedriger Berechtigung keinen gefährlichen Befehl einschleusen kann. Gewöhnlicher Chat-Text, der diese Wörter nur erwähnt (wie eine `say`-Nachricht), wird ignoriert.

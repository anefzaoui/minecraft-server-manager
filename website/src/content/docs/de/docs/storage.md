---
title: 'Speicher'
description: 'Die Speicherseite zeigt, wohin Ihr Speicherplatz fließt: Nutzung pro Server und wie sie sich im Laufe der Zeit entwickelt.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Die Seite **Speicher** zeigt, wohin Ihr Speicherplatz fließt: Nutzung pro Server und deren Entwicklung im Zeitverlauf.

![Speicher](/docs/images/storage.png)

## Festplattenspeicherbeschränkungen werden vom Panel durchgesetzt

Docker kann die Festplattennutzung eines Bind-Mounts nicht begrenzen, daher übernimmt das Panel diese Aufgabe. Ein Hintergrund-Größenindexierer durchläuft das Datenverzeichnis, speichert den Speicherbedarf jedes Servers zwischen und erzwingt die pro Server festgelegte Festplattenspeicherbeschränkung. Wenn die Daten eines Servers (Welt + Sicherungen + alles andere) seine Beschränkung erreichen, stoppt das Panel das unkontrollierte Wachstum, anstatt zuzulassen, dass ein Server Ihren Host füllt.

Legen Sie die Beschränkung eines Servers in seinen [Einstellungen](/docs/servers/) fest. Modifizierte Server und ihre [Sicherungen](/docs/backups/) können groß sein, geben Sie ihnen also Platz.

## Bereinigung

Die Speicheransicht hilft Ihnen, herauszufinden, was Sie bereinigen können (alte Sicherungen, ungenutzte Welten oder ein Server, der weit über die Erwartungen hinaus gewachsen ist), bevor Ihnen der Speicherplatz ausgeht.

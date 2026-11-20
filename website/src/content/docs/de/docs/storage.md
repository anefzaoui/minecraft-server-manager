---
title: 'Speicher'
description: 'Sehen Sie, wohin der Speicherplatz fließt, begrenzen Sie jeden Serverordner mit einer Festplattenquote und bereinigen Sie, was Sie nicht mehr benötigen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Die Seite **Speicher** zeigt, wohin Ihr Speicherplatz fließt: Nutzung nach Kategorie, jeder Server im Verhältnis zu seinem Kontingent, die größten Dateien und wie sich die Gesamtnutzung über die letzten Scans entwickelt. Sie ist nur für Administratoren.

![Speicher](/docs/images/storage.png)

## Festplattenkontingente werden vom Panel erzwungen

Docker kann die Festplattennutzung eines Bind-Mounts nicht begrenzen, daher übernimmt das Panel diese Aufgabe. Ein Hintergrund-Größenindexierer durchläuft den Datenordner (alle 15 Minuten, nach Änderungen oder wenn Sie auf **Jetzt neu scannen** klicken), speichert den Fußabdruck jedes Servers zwischen und erzwingt das von Ihnen pro Server festgelegte Festplattenkontingent. Eine Aktion, die den Ordner eines Servers (Welt, Mods, Konfigurationen, Protokolle und alles andere darin) über sein Kontingent hinauswachsen lassen würde, wie z. B. die Installation eines Mods oder einer Welt oder das Hochladen von Dateien, wird blockiert, bis Speicherplatz freigegeben oder das Kontingent erhöht wird, anstatt zuzulassen, dass ein Server Ihren Host füllt.

Legen Sie das Kontingent eines Servers in seinen [Einstellungen](/docs/servers/#server-settings) fest. Wenn Sie dort **Server stoppen, wenn Kontingent überschritten** aktivieren, wird ein laufender Server gestoppt, sobald sein Ordner mehr als 10 % über dem Kontingent liegt, und dies wird in der Historie des Servers vermerkt. Modifizierte Server können groß sein, geben Sie ihnen also Platz. [Backups](/docs/backups/) werden separat gespeichert und zählen nicht zum Kontingent.

## Bereinigung

Die Karte **Ein-Klick-Bereinigung** gibt Speicherplatz frei, den das Panel sicher zurückfordern kann: temporäre Dateien, die älter als eine Stunde sind, verwaiste Bibliotheksdateien und archivierte Protokolle und Absturzberichte, die älter als 30 Tage sind. Jede Option zeigt an, wie viel freigegeben wird, und öffnet eine Vorschau, bevor etwas gelöscht wird. Die Listen **Nach Kategorie** und **Größte Dateien** verlinken direkt zum Dateimanager, sodass Sie finden können, was Sie sonst noch bereinigen können, bevor Ihnen der Speicherplatz ausgeht.

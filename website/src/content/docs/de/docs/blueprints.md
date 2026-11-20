---
title: 'Blueprints'
description: 'Blueprints speichern die gesamte Konfiguration eines Minecraft-Servers als wiederverwendbare Vorlage für die Erstellung neuer Server. Geheimnisse werden niemals einbezogen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Zurück zum Dokumentenindex](/docs/)

Eine **Vorlage** erfasst die gesamte Konfiguration eines Servers (Typ, Version, Ressourcen, Umgebung, Pack-Pin, benutzerdefinierte Mods und optional seine Konfiguration und Welt) in einer einzigen portablen `.mcserver.zip`-Datei, aus der Sie neue Server erstellen können. Geheimnisse (Passwörter, Token und Schlüssel in der Umgebung) werden niemals in eine Vorlage geschrieben.

![Vorlagen](/docs/images/blueprints.png)

## Exportieren

Auf der Registerkarte **Einstellungen → Konfiguration** eines Servers verwenden Sie **Als Vorlage exportieren** und wählen aus, was enthalten sein soll: immer die Serverkonfiguration, seine Konfigurationsverzeichnisse (standardmäßig aktiviert) und optional die benutzerdefinierten Mod-Dateien selbst (eine größere Datei, die ohne Herunterladen von etwas installiert wird) und die aktive Welt. Das Ergebnis wird in Ihrer Vorlagenbibliothek gespeichert und kann zum Teilen heruntergeladen werden.

**Server klonen**, auf derselben Karte, führt einen Export und einen Import in einem Schritt durch, um eine Kopie des Servers zu erstellen, mit oder ohne seine Welt.

## Importieren und Erstellen aus einer Vorlage

Importieren Sie eine Vorlagendatei (**Vorlage importieren** auf der Seite **Vorlagen**) oder wählen Sie eine aus der Bibliothek aus (**Server erstellen** auf der entsprechenden Karte oder auf der Registerkarte **Aus Vorlage** im Assistenten), um einen neuen Server zu erstellen, der exakt wie das Original vorkonfiguriert ist. Der neue Server erhält seine eigenen Ports und ein neues RCON-Passwort. Benutzerdefinierte Mods, die nicht eingebettet waren, werden erneut heruntergeladen und mit den vom Vorlagen-Blueprint aufgezeichneten Hashes verglichen. Die Bibliothek beginnt auch mit zwei Starter-Vorlagen, einer für Paper und einer für Fabric.

Dies ist der schnellste Weg, um:

- Identische Server zu starten (ein Netzwerk von Minispiel-Servern, Staging-Kopien von Produktionsumgebungen).
- Einen Server zwischen Panels zu verschieben.
- Eine bekannte, gute Vorlage zu behalten, auf die Sie immer zurückgreifen können.

Da eine Vorlage den exakten [Pack-Pin](/docs/modpacks/) aufzeichnet, installiert ein aus einer Vorlage erstellter Modpack-Server dieselbe angepinnte Version, ohne überraschende Upgrades.

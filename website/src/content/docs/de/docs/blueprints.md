---
title: 'Blueprints'
description: 'Ein Blueprint erfasst die gesamte Konfiguration eines Servers (Typ, Version, Ressourcen, Umgebung, Pack-Pin und optional seine Konfiguration und Welt) in einer einzigen Po'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Zurück zum Dokumentenindex](/docs/)

Eine **Vorlage** erfasst die gesamte Konfiguration eines Servers (Typ, Version, Ressourcen, Umgebung, Pack-Pin und optional seine Konfiguration und Welt) in einer einzigen portablen Datei, aus der Sie neue Server erstellen können.

![Vorlagen](/docs/images/blueprints.png)

## Exportieren

Exportieren Sie von einem Server eine Vorlage und wählen Sie aus, was enthalten sein soll: Konfiguration immer und optional eingebettete Dateien und die Welt. Das Ergebnis wird in Ihrer Vorlagenbibliothek gespeichert und kann zum Teilen heruntergeladen werden.

## Importieren & Erstellen aus einer Vorlage

Importieren Sie eine Vorlagendatei (oder wählen Sie eine aus der Bibliothek aus), um einen neuen Server zu erstellen, der exakt wie das Original vorkonfiguriert ist. Dies ist der schnellste Weg, um:

- Identische Server zu starten (ein Netzwerk von Minispiel-Servern, Staging-Kopien der Produktion).
- Einen Server zwischen Panels zu verschieben.
- Eine bekannte, gute Vorlage aufzubewahren, auf die Sie immer zurückgreifen können.

Da eine Vorlage den exakten [Pack-Pin](/docs/modpacks/) aufzeichnet, installiert ein Modpack-Server, der aus einer Vorlage neu erstellt wird, dieselbe angepinnte Version, ohne überraschende Upgrades.

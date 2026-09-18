---
title: 'Modpacks'
description: 'Die Modpacks-Seite (und der Tab „Aus Modpack“ im Erstellungsassistenten) installiert ein Modpack als Server, immer fixiert auf eine exakte Pack-Version, sodass ein Neustart'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Die Seite **Modpacks** (und der Tab **Von Modpack** im [Erstellungswizard](/docs/servers/)) installiert ein Modpack als Server, immer **an eine exakte Pack-Version angeheftet**, sodass ein Neustart das Pack niemals unbemerkt aktualisieren kann.

![Modpacks](/docs/images/modpacks.png)

## Unterstützte Plattformen

- **CurseForge** - Suche oder füge eine Pack-URL ein. Benötigt einen CurseForge API-Schlüssel für die Suche und private Packs (füge ihn unter Einstellungen → API-Schlüssel hinzu).
- **Modrinth** - Suche nach Namen.
- **FTB** - Feed The Beast Packs.
- **GT New Horizons** - Das 1.7.10 Expert Pack, installiert aus dem eigenen Release-Index von GTNH. GTNH wählt seine Java-Laufzeitumgebung pro Pack-Version (2.8.0+ läuft auf **Java 25** über gebündelte lwjgl3ify-Patches, ältere Versionen auf Java 21 oder 17), und der Wizard erhöht den RAM und Speicherplatz des Servers auf sinnvolle Mindestwerte dafür.
- **Benutzerdefiniertes Zip** - gar kein veröffentlichtes Pack: Lade einen **CurseForge Modpack-Export** (die Zip-Datei mit `manifest.json`, die die CurseForge-App für eine handverlesene Mod-Sammlung erstellt) oder **beliebige Zip-Dateien mit Mod-JARs** hoch. Das Panel löst das Manifest gesammelt über die CurseForge API auf (oder identifiziert jeden JAR anhand von Hash/Fingerabdruck/Metadaten), zeigt eine Vorschau dessen an, was passt, und installiert alles in einem Schritt – einschließlich der `overrides/`-Konfigurationen des Packs, wenn du zustimmst. Mods, deren Autoren automatisierte Downloads nicht erlauben, werden mit einem Browser-Link und einem manuellen Upload-Slot aufgeführt, anstatt die Installation fehlschlagen zu lassen.

## Wie das Anheften funktioniert

Wenn du ein Pack auswählst, löst das Panel die exakte Version auf, speichert sie und installiert diese. Auf der Seite **Updates** wirst du darüber informiert, wenn eine neuere Version verfügbar ist; das Upgrade ist eine bewusste, geschützte Aktion mit einem Backup vor dem Update und Rollback. Server, die auf Stabilität setzen, erhalten niemals eine Beta-Version angeboten.

Server, die auf sehr alten Panel-Versionen (vor 0.9.7) erstellt wurden, könnten _unangeheftet_ geblieben sein, was bedeutet, dass das Container-Image bei jedem Start leise die neueste Pack-Version installiert hat. Das Panel repariert diese nun beim Start: Es sperrt jeden Server auf die Version, die tatsächlich installiert ist (gelesen aus den eigenen Aufzeichnungen des Panels oder dem Installationsmanifest des Images, niemals ein frisch aufgelöstes "latest") und protokolliert ein Ereignis. Wenn es nicht feststellen kann, was installiert ist, zeigt die Einstellungsseite des Servers eine Warnung an, die dich auffordert, die Version manuell auszuwählen, und jeder Versuch, eine unangeheftete Modpack-Konfiguration zu speichern, wird sofort abgelehnt.

## Update-Richtlinie

Jeder Server hat eine Update-Richtlinie in **Einstellungen**, und alle drei Optionen bedeuten genau das, was sie sagen:

- **Nur manuell** - nichts ändert sich von selbst, und der Server wird vollständig aus der Update-Anzeige und der Updates-Seite herausgehalten. Der "Lass mich in Ruhe"-Modus: Ideal für ein handoptimiertes oder importiertes Pack, das du niemals angefasst haben möchtest.
- **Benachrichtige mich** (Standard) - die tägliche Prüfung zeigt verfügbare Updates als Badge und auf der Updates-Seite an; das Anwenden ist immer dein Klick.
- **Automatische Updates** - nach der geplanten täglichen Prüfung werden anstehende **Pack**-Updates über denselben geschützten Weg wie ein manuelles Upgrade angewendet: Backup vor dem Update, Gesundheitsüberwachung und ein automatisches Rollback, falls die neue Version nicht startet. Updates, die den Server auf eine andere Minecraft-Version verschieben würden, werden immer übersprungen und stattdessen ein Ereignis protokolliert – die Konvertierung einer Welt auf Dauer ist eine Entscheidung, die das Panel nicht für dich treffen wird. Die manuellen "Jetzt prüfen"-Schaltflächen prüfen nur; sie lösen niemals automatische Updates aus.

## Ein Pack aktualisieren

Von einem angehefteten Server aus kannst du in einer Aktion auf eine neuere Version aktualisieren. Das Panel erstellt zuerst ein Backup, tauscht die angeheftete Version aus, erstellt den Container neu (löst Java neu auf, falls die neue Version eine andere Laufzeitumgebung benötigt) und überwacht den ersten Start, mit einem großzügigen Zeitfenster für große Packs wie GTNH, die ein paar Gigabyte herunterladen und eine Welt mit mehreren hundert Mods beim ersten Start aufbauen.

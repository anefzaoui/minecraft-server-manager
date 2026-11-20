---
title: 'Dokumentation'
description: 'Ein vollständiges, selbst gehostetes Control Panel für itzg/docker-minecraft-server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/README.md'
---

Ein vollständiges, selbst gehostetes Control Panel für [itzg/docker-minecraft-server](https://github.com/itzg/docker-minecraft-server). Erstellen, ausführen und verwalten Sie Minecraft-Server von Ihrem Browser aus. Keine Kommandozeile, kein manuelles Bearbeiten von YAML.

![Dashboard](/docs/images/dashboard.png)

## Erste Schritte

- **[Erste Schritte](/docs/getting-started/)** - Einrichtung beim ersten Start, Anmeldung und Orientierung.
- **[Das Dashboard](/docs/dashboard/)** - die Übersicht über alle Server, Spieler und Aktivitäten.

## Server ausführen

- **[Server erstellen & verwalten](/docs/servers/)** - der Erstellungsassistent, Servertypen, Versionen und serverseitige Einstellungen.
- **[Konsole & Chat-Befehle](/docs/console-and-chat/)** - die Live-Konsole und benutzerdefinierte In-Game-Chat-Befehle, die als Spieler ausgeführt werden.
- **[Modpacks](/docs/modpacks/)** - Installieren Sie CurseForge-, Modrinth-, FTB- und GT New Horizons-Packs, immer an eine exakte Version gebunden.
- **[Welten & Dateien](/docs/worlds-and-files/)** - Welten austauschen, Mods verwalten und Dateien direkt im Browser bearbeiten.
- **[Eine Welt verkleinern](/docs/world-shrink/)** - Festplattenspeicher zurückgewinnen, indem nicht besuchte Chunks entfernt werden, entweder eigenständig oder als Teil eines Backups.
- **[Live-Karte](/docs/live-map/)** - eine 3D-Karte der Welt mit BlueMap mit einem Klick, hinter der Anmeldemaske des Panels.
- **[Einladungen & Statusseite](/docs/invites-and-status-page/)** - die Adresse, Einladungstext und Client-Modpack für Freunde sowie eine öffentliche Statusseite.

## Daten & Automatisierung

- **[Server-Chatbot](/docs/chatbot/)** - lokale/OpenAI-kompatible Konversation, Benachrichtigungen, gespeicherte Transkripte und eingeschränkte Spielberechtigungen.
- **[Backups](/docs/backups/)** - Schnappschüsse mit einem Klick, geplante Backups, Anzahl der zu behaltenden Backups (panelweit oder pro Server) und Wiederherstellung.
- **[Blaupausen](/docs/blueprints/)** - Erfassen Sie die gesamte Konfiguration eines Servers und erstellen Sie daraus neue.
- **[Zeitpläne](/docs/schedules/)** - Cron-gesteuerte Neustarts, Backups und Befehle.
- **[Speicher](/docs/storage/)** - serverseitige Festplattennutzung und vom Panel erzwungene Kontingente.
- **[Updates](/docs/updates/)** - Verfolgen Sie neue Server-, Pack-, Image- und Mod-Versionen, prüfen Sie, welche Minecraft-Versionen Ihre Mods unterstützen, und machen Sie ein Mod-Update rückgängig.
- **[Aktivitätsprotokoll](/docs/activity/)** - eine Überwachungsprotokoll aller Ereignisse.
- **[Integrationen](/docs/integrations/)** - Discord-Webhook-Benachrichtigungen und die Kategorie "Alerts".
- **[Öffentliche API](/docs/public-api/)** - eine schreibgeschützte, Token-authentifizierte HTTP-API zum Abrufen des Serverstatus von außerhalb des Panels.

## Konten & Sicherheit

- **[Benutzer & Rollen](/docs/users-and-roles/)** - Administrator, Operator und Betrachter, was jeder tun kann, und serverseitige Berechtigungen, die diese verfeinern.
- **[Zwei-Faktor-Authentifizierung](/docs/two-factor-authentication/)** - schützen Sie Ihre Anmeldung mit einer Authentifizierungs-App.

## Anleitungen

Nicht spezifisch für dieses Panel: die Fragen, auf die jeder Minecraft-Serverbesitzer stößt.

- **[Wie viel RAM benötigt ein Server?](/docs/guide-server-memory/)** - die beiden einzustellenden Zahlen und warum ein inaktiver Server 12 GB anzeigt.
- **[Vanilla, Paper, Fabric, Forge, NeoForge, Quilt](/docs/guide-choosing-a-loader/)** - welche zu verwenden sind und der Unterschied zwischen Plugins/Mods, der die Wahl beeinflusst.
- **[Ihr Server startet nicht](/docs/guide-server-wont-start/)** - das Lesen des Protokolls und die wenigen Ursachen für die meisten Fehler.
- **[Backups, die tatsächlich wiederhergestellt werden können](/docs/guide-backups/)** - konsistente Kopien, was sonst noch aufbewahrt werden muss und das Testen eines Backups, bevor Sie es benötigen.
- **[Einen Server zu einem anderen Hoster verschieben](/docs/guide-moving-a-server/)** - die Reihenfolge, die Ausfallzeiten kurz und Inventare intakt hält.

## Unter der Haube

- **[Architektur](/docs/architecture/)** - wie das Panel aufgebaut ist.
- **[Die Website](/docs/website/)** - wie minecraft-server-manager.com aus diesem Repository erstellt, übersetzt und bereitgestellt wird.

---

> Screenshots in dieser Dokumentation wurden im dunklen Theme des Panels aufgenommen. Das Panel startet dunkel, es sei denn, Ihr Betriebssystem bevorzugt hell; verwenden Sie den Theme-Schalter in der oberen Leiste zum Wechseln.

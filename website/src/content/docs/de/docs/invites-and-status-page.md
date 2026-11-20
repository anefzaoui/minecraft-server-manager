---
title: 'Einladungen & Statusseite'
description: 'Lade Freunde zu einem Server mit Adresse, Version und einem Client-Modpack ein und teile eine öffentliche Statusseite, die nur das anzeigt, was du möchtest.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Zurück zum Dokumentenindex](/docs/)

Zwei Tabs unter der Gruppe **Einstellungen** eines Servers helfen Spielern, ihn zu finden und beizutreten: **Einladungen** schreibt alles auf, was ein Freund zum Verbinden benötigt, und **Statusseite** veröffentlicht eine kleine öffentliche Seite, die anzeigt, ob der Server läuft. Beide benötigen die Berechtigung **Einstellungen** des Servers ([Benutzer & Rollen](/docs/users-and-roles/#per-server-permissions)).

## Einladungen

**Einstellungen → Einladungen** hat eine Karte **Freunde einladen**:

- **Zu teilende Adresse** listet die Adressen des Rechners in deinem lokalen Netzwerk mit dem Spiel-Port des Servers, deine öffentliche Adresse, wenn das Panel sie erkennen konnte (Spieler außerhalb deines Netzwerks erreichen ihn nur über Portweiterleitung), und **Benutzerdefinierte Adresse…** für eine Domain oder Adresse, die du selbst eingerichtet hast, wie z. B. `play.example.com:25565`.
- **Einladungstext** ist eine Nachricht zum sofortigen Einfügen mit dem Namen des Servers, der von dir gewählten Adresse und seiner Minecraft-Version und -Art. **Einladungstext kopieren** legt ihn in die Zwischenablage. Wenn die Whitelist aktiviert ist, fragt der Text Freunde nach ihrem Minecraft-Benutzernamen, und die Karte erinnert dich daran, jeden Freund auf dem Tab **Spieler** hinzuzufügen, bevor er beitritt.
- **Was Freunde benötigen** besagt, was auf der Seite des Spielers erforderlich ist: nichts als die richtige Minecraft-Version für einen Vanilla- oder Plugin-Server (Paper und ähnliche), oder die Mods des Servers für einen modifizierten.

### Das Client-Modpack

Auf einem modifizierten Server bietet die Karte auch **Client-Modpack herunterladen (.mrpack)**. Freunde importieren es in Prism Launcher oder die Modrinth App, die die Minecraft-Version und den Mod-Loader des Servers installiert, die Mods herunterlädt und den Server mit der von dir gewählten Adresse zu ihrer Multiplayer-Liste hinzufügt.

Die Datei wird aus den Mods erstellt, die du selbst zum Server hinzugefügt hast (das Custom-Mod-Overlay), die von Modrinth stammen. Mods von anderswo werden stattdessen auf der Karte aufgelistet, sodass Freunde diese Dateien von Hand zu ihrem `mods`-Ordner hinzufügen können. Auf einem Server, der aus einem Modpack erstellt wurde, sollten Freunde dieses Pack in der Version, die der Server ausführt, in ihrem Launcher installieren; der Tab **Übersicht** zeigt die Version an.

### Über das Internet spielen

**Über das Internet spielen (Portweiterleitung)** am unteren Rand der Karte erklärt die Router-Seite: leite den Spiel-Port des Servers (TCP und UDP) an die Maschine weiter, auf der das Panel läuft, und teile dann deine öffentliche Adresse mit dem Port. Wenn dein Internetanbieter CGNAT verwendet, kann die Portweiterleitung nicht funktionieren, und ein Tunneldienst (z. B. playit.gg) ist der Weg hinein. Das Panel öffnet keine Router-Ports von sich aus. Nur Spiel-Ports gehören ins Internet; halte den eigenen Port des Panels und die RCON-Ports geschlossen ([Ports im Überblick](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Statusseite

**Einstellungen → Statusseite** schaltet eine öffentliche Seite für einen Server ein, standardmäßig aus:

1. Schalte die Karte ein.
2. Wähle die **Seitenadresse**: die Seite befindet sich unter `/status/<adresse>` auf deinem Panel, und die Adresse besteht aus 3 bis 40 Kleinbuchstaben, Zahlen oder Bindestrichen, eindeutig über deine Server hinweg.
3. Drücke **Speichern**. **Seite öffnen** und **Link kopieren** geben dir dann den zu teilenden Link.

Jeder mit dem Link sieht den Namen des Servers, seine MOTD, Version, ob er läuft, die Spieleranzahl und seine Uptime, und nichts weiter. Die Seite hat keinen Link zum Panel und benötigt keine Anmeldung. Sie liest den internen Status des Panels, sodass Besucher niemals Arbeit am Docker-Daemon verursachen.

Das Ausschalten der Seite behält ihre Adresse, sodass das erneute Einschalten denselben Link wiederherstellt. Für eine eigene Seite oder einen eigenen Bot gibt die [öffentliche API](/docs/public-api/) denselben Status als JSON zurück.

Verwandt: [Discord-Benachrichtigungen](/docs/integrations/), [die Live-Karte](/docs/live-map/), [Server erstellen und verwalten](/docs/servers/).

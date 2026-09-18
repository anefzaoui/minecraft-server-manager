---
title: 'Erste Schritte'
description: 'Beim ersten Öffnen des Panels werden Sie aufgefordert, ein Administratorkonto zu erstellen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

## Ersteinrichtung

Beim ersten Öffnen des Panels werden Sie aufgefordert, ein Administratorkonto zu erstellen. Dies ist das einzige Konto, das existiert, bis Sie weitere hinzufügen, und es hat die volle Kontrolle.

Wählen Sie einen Benutzernamen und ein Passwort mit mindestens 8 Zeichen. Das war's: Sie sind angemeldet und werden direkt zum Dashboard weitergeleitet.

> **Öffentlich zugängliche Installationen sind PIN-geschützt.** Wenn Sie das Panel an eine Nicht-Loopback-Adresse binden (`PANEL_HOST` ungleich `127.0.0.1`), fragt die Einrichtungsseite auch nach einer **6-stelligen PIN**. Das Panel gibt diese beim Start auf seiner Konsole aus. Geben Sie sie zusammen mit Ihrem Benutzernamen und Passwort ein. Dies verhindert, dass ein Fremder, der zuerst den Port erreicht, das Administratorkonto beansprucht. Die PIN verschwindet, sobald das Administratorkonto existiert.

## Anmelden

Nach der Einrichtung ist das Panel durch einen Anmeldebildschirm geschützt. Geben Sie Ihren Benutzernamen und Ihr Passwort ein, um fortzufahren.

![Anmelden](/docs/images/login.png)

Wenn die [Zwei-Faktor-Authentifizierung](/docs/two-factor-authentication/) für Ihr Konto aktiviert ist, werden Sie direkt nach Ihrem Passwort nach einem 6-stelligen Code aus Ihrer Authentifizierungs-App gefragt.

## Sich zurechtfinden

Alles hängt von der linken Seitenleiste ab:

- **Dashboard** - Alle Server auf einen Blick ([Details](/docs/dashboard/)).
- **Server**, **Modpacks**, **Welten**, **Blaupausen** - Server und deren Inhalte erstellen und verwalten.
- **Updates**, **Backups**, **Zeitpläne**, **Speicher**, **Aktivität** - die operative Seite: Was ist veraltet, Ihre Snapshots, Automatisierung, Festplattennutzung und das Audit-Protokoll.
- **Einstellungen** (unten): Benutzer, API-Schlüssel und Panel-Konfiguration.

Die obere Leiste enthält die Schaltfläche **Server erstellen**, einen **Themenumschalter** (dunkel/hell) und Ihr **Kontomenü**, in dem Sie die [Zwei-Faktor-Authentifizierung](/docs/two-factor-authentication/) verwalten oder sich abmelden können.

## Auf einem Handy oder Tablet

Jede Seite ist zuerst für einen schmalen Bildschirm ausgelegt und verbreitert sich von dort aus: Die Seitenleiste versteckt sich hinter dem Menüknopf, Datentabellen stapeln sich zu Karten, Werkzeugleisten werden umgebrochen und die Weltsteuerungsleiste wird zu einer Karte zusammengeklappt, die Sie öffnen, wenn Sie sie benötigen. Schaltflächen und Chips haben eine angemessene Berührungszielgröße. Nichts ist nur für Desktops.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Dashboard auf einem Handy" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Serverübersicht auf einem Handy" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsole auf einem Handy" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Mods-Tab auf einem Handy" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Einstellungen auf einem Handy" width="180">
</p>

## Was Sie brauchen

Das Panel kommuniziert mit Docker, um Server auszuführen, daher benötigt es Zugriff auf einen Docker-Daemon (Docker Desktop oder einen Docker Engine Socket). Wenn Docker erreichbar ist, zeigt die Docker-Kachel im Dashboard **Verbunden** und seine Version an. Wenn nicht, läuft das Panel trotzdem. Sie können Server erst starten, bis der Daemon läuft.

## Nächste Schritte

- [Erstellen Sie Ihren ersten Server →](/docs/servers/)
- [Sichern Sie Ihr Konto mit 2FA →](/docs/two-factor-authentication/)

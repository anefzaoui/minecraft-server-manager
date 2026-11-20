---
title: 'Aktivitätsprotokoll'
description: 'Die Aktivitätsseite ist der vollständige Audit-Trail: ein durchsuchbarer, chronologischer Verlauf aller Ereignisse im Panel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Die Seite **Aktivität** ist der vollständige Audit-Trail: eine durchsuchbare, chronologische Aufzeichnung aller Ereignisse im Panel. Filtern Sie sie nach Server oder Ereignistyp, durchsuchen Sie die Zusammenfassungen und exportieren Sie Ihre Filterergebnisse als CSV oder JSON. Einträge, die ein Log erfasst haben (z. B. einen Absturz), öffnen dieses direkt.

![Aktivität](/docs/images/activity.png)

## Was wird aufgezeichnet?

- **Authentifizierung**: Anmeldungen (einschließlich der Verwendung von 2FA oder einem Backup-Code), Kontosperrungen, Passwortänderungen und Aktivierung, Deaktivierung oder Zurücksetzung von 2FA.
- **Server-Lebenszyklus**: Erstellung, Start, Stopp, Neustart, Abstürze, automatische Neustarts und Out-of-Memory-Ereignisse.
- **Benachrichtigungen**: Verzögerte Starts, Stoppfehler, fehlgeschlagene Zeitpläne, Quoten-Stopps, fehlerhafte Container, offline nach Neustart.
- **Daten**: Erstellte und wiederhergestellte Backups, exportierte Blaupausen, installierte und aktualisierte Pakete, Änderungen an Mods und Welten sowie Dateibearbeitungen.
- **Spieler**: Kicks, Bans, Änderungen an Whitelist und Op-Status sowie Spieler-Notizen.
- **Konfiguration**: Änderungen an Chat-Befehlen, Änderungen an Benutzern und Rollen, serverseitige Berechtigungsänderungen, Änderungen an Spielports und Bearbeitungen von Einstellungen.

Jeder Eintrag zeichnet auf, wer ihn durchgeführt hat (ein Benutzername oder das Panel/der Scheduler für automatisierte Aktionen), auf welchen Server er sich bezieht und wann. Das [Dashboard](/docs/dashboard/) zeigt die neuesten Einträge; diese Seite ist die vollständige Historie. Operatoren und Betrachter sehen nur Einträge für die Server, die sie einsehen können (plus panelweite Einträge), und serverseitige Berechtigungsänderungen werden nur Administratoren angezeigt. Lebenszyklus- und Benachrichtigungsereignisse können auch an Discord weitergeleitet werden (siehe [Integrationen](/docs/integrations/)).

Da die Aktivität protokoll sicherheitsrelevante Ereignisse (Anmeldungen, 2FA-Änderungen, Rollen- und Berechtigungsänderungen) erfasst, ist das Aktivitätsprotokoll auch Ihre erste Anlaufstelle, wenn mit einem Konto etwas nicht stimmt.

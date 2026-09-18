---
title: 'Aktivitätsprotokoll'
description: 'Die Aktivitätsseite ist der vollständige Audit-Trail: ein durchsuchbarer, chronologischer Verlauf aller Ereignisse im Panel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Zurück zum Dokumentenindex](/docs/)

Die Seite **Aktivität** ist der vollständige Audit-Trail: eine durchsuchbare, chronologische Aufzeichnung aller Ereignisse im Panel.

![Aktivität](/docs/images/activity.png)

## Was wird aufgezeichnet?

- **Authentifizierung** – Anmeldungen (einschließlich der Verwendung von 2FA oder eines Backup-Codes) sowie die Aktivierung, Deaktivierung oder Zurücksetzung von 2FA.
- **Server-Lebenszyklus** – Erstellungen, Starts, Stopps, Neustarts, Abstürze und Out-of-Memory-Ereignisse.
- **Warnungen** – blockierte Starts, fehlgeschlagene Stopps, fehlgeschlagene Zeitpläne, Stopps aufgrund von Kontingenten, fehlerhafte Container, offline nach Neustart.
- **Daten** – erstellte und wiederhergestellte Backups, exportierte Blueprints, installierte und aktualisierte Packs.
- **Konfiguration** – Änderungen an Chat-Befehlen, Rollenänderungen und Bearbeitungen von Einstellungen.

Jeder Eintrag zeichnet auf, wer ihn durchgeführt hat (ein Benutzername oder das Panel/der Scheduler für automatisierte Aktionen), auf welchen Server er sich bezieht und wann. Das [Dashboard](/docs/dashboard/) zeigt die neuesten Einträge an; diese Seite ist die vollständige Historie. Lebenszyklus- und Warnmeldungen können auch an Discord weitergeleitet werden (siehe [Integrationen](/docs/integrations/)).

Da sie sicherheitsrelevante Ereignisse (Anmeldungen, 2FA-Änderungen, Rollenänderungen) erfasst, ist das Aktivitätsprotokoll auch Ihre erste Anlaufstelle, wenn mit einem Konto etwas nicht stimmt.

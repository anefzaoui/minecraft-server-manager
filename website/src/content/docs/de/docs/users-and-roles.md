---
title: 'Benutzer & Rollen'
description: 'Das Panel ist mehrbenutzerfähig.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Das Panel ist für mehrere Benutzer ausgelegt. Verwalten Sie Konten unter **Einstellungen → Benutzer**.

![Benutzer](/docs/images/settings-users.png)

## Die drei Rollen

| Rolle        | Kann tun                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Alles: Benutzer, API-Schlüssel, globale Dateien, erweiterte Docker-Overrides und alle Serveraktionen verwalten.                             |
| **operator** | Server ausführen und konfigurieren (starten/stoppen, Konsole, Backups, Welten, Mods, die meisten Einstellungen), aber keine Admin-Bereiche. |
| **viewer**   | Nur Lesezugriff. Server und deren Status anzeigen, aber keine Änderungen vornehmen.                                                         |

Jeder Benutzer, einschließlich eines Betrachters, kann seine eigene [Zwei-Faktor-Authentifizierung](/docs/two-factor-authentication/) verwalten, da der Schutz des eigenen Logins keine Serververwaltungsaktion ist.

## Nur für Admins und warum

Einige Dinge sind absichtlich auf Administratoren beschränkt:

- **Benutzerverwaltung, API-Schlüssel und globale Dateien.**
- **Die [öffentliche API](/docs/public-api/)** – Aktivierung von `/api/v1` und Erstellung, Einschränkung oder Widerruf seiner schreibgeschützten Bearer-Token.
- **Erweiterte Docker-Overrides** – benutzerdefinierter Containername, zusätzliche Portweiterleitungen und Bind-Mounts. Ein Bind-Mount kann jeden Host-Pfad in einen Container einbinden und ist in Kombination mit dem Docker-Zugriff des Panels effektiv Root auf dem Host. Diese Felder erscheinen nur für Administratoren.

Benutzerdefinierte Containernamen dürfen sich auch nicht im `msm-` Namensraum des Panels befinden, sodass ein manuell benannter Container niemals die Instanz eines anderen Servers überschatten und einen Stopp- oder Befehl an die falsche Instanz umleiten kann.

## Kontenverwaltung

![Profilbild](/docs/images/profile-picture.png)

Administratoren können Benutzer erstellen, Rollen ändern, Passwörter zurücksetzen und Konten aus der Benutzertabelle löschen. Die Spalte **2FA** zeigt an, ob für einen Benutzer die Zwei-Faktor-Authentifizierung aktiviert ist; ein Administrator kann die 2FA eines anderen Benutzers **zurücksetzen** (für den Fall verlorener Telefone und Backup-Codes), aber niemals seine eigene deaktivieren, ohne sein Passwort, was der Self-Service-Flow stattdessen übernimmt.

Fehlgeschlagene Anmeldungen werden pro Konto ratenbegrenzt (sowohl ein Zähler pro IP als auch ein globaler Zähler pro Konto), um Brute-Force-Versuche zu verlangsamen, und dasselbe Limit deckt auch den 2FA-Code-Schritt ab, sodass ein korrektes Passwort den Zähler nicht zurücksetzen kann, bevor der Code erraten wird. Davor sitzt eine gröbere Ratenbegrenzung pro Client-IP für die Endpunkte Login / 2FA / Setup, die über `RATE_LIMIT_AUTH_PER_15MIN` (Standard 100; hinter einem Reverse-Proxy, setzen Sie `TRUST_PROXY`, damit sie auf die echte Client-IP schlüsselt) eingestellt werden kann.

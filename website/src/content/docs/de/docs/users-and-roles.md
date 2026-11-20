---
title: 'Benutzer & Rollen'
description: 'Konten, die Rollen Administrator, Operator und Betrachter sowie serverseitige Berechtigungen in Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Zurück zum Docs-Index](/docs/)

Das Panel ist mandantenfähig. Verwalten Sie Konten unter **Einstellungen → Benutzer**.

![Benutzer](/docs/images/settings-users.png)

## Die drei Rollen

| Rolle        | Standard für jeden Server                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Alles: Benutzer, API-Schlüssel, globale Dateien, erweiterte Docker-Überschreibungen und alle Serveraktionen verwalten.                      |
| **operator** | Server ausführen und konfigurieren (starten/stoppen, Konsole, Backups, Welten, Mods, die meisten Einstellungen), aber nicht Admin-Bereiche. |
| **viewer**   | Nur Lesezugriff. Server und deren Status anzeigen, aber keine Änderungen vornehmen.                                                         |

Jeder Benutzer, einschließlich eines viewers, kann seine eigene [Zwei-Faktor-Authentifizierung](/docs/two-factor-authentication/) verwalten, da der Schutz des eigenen Logins keine Serververwaltungsaktion ist.

Eine Rolle ist der **Standard** für jeden Server. Um jemandem auf einem Server andere Rechte zu geben, verwenden Sie die serverseitigen Berechtigungen unten.

## Serverseitige Berechtigungen

Die Seite **Berechtigungen** (in der Seitenleiste oder **Serverberechtigungen** unter **Einstellungen → Benutzer**) zeigt ein Raster: jeder Operator und Viewer an der Seite, jeder Server oben. Klicken Sie auf eine Zelle, um zu entscheiden, was dieser Benutzer auf diesem einen Server tun darf. Admins werden nicht aufgelistet, da sie immer alles haben.

![Berechtigungen](/docs/images/settings-permissions.png)

Jede Zelle ist eine Reihe von Berechtigungen:

| Berechtigung | Was sie auf diesem Server erlaubt                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **View**     | Server, dessen Status, Konsolenausgabe, Spieler, Verlauf und Statistiken anzeigen.                                                      |
| **Power**    | Server starten, stoppen, neu starten, beenden und neu erstellen.                                                                        |
| **Console**  | Konsolenbefehle und schnelle Weltaktionen ausführen, Chat senden und Chatbefehle verwalten.                                             |
| **Players**  | Spieler kicken, bannen, auf die Whitelist setzen, zu Ops machen und Spieler-Notizen bearbeiten.                                         |
| **Content**  | Mods, Plugins, Packs, Welten, Datapacks installieren und entfernen sowie Inventare bearbeiten.                                          |
| **Backups**  | Backups erstellen, wiederherstellen, herunterladen und löschen.                                                                         |
| **Files**    | Serverdateien, archivierte Protokolle und Protokollbündel durchsuchen, bearbeiten, hochladen und herunterladen; Blueprints exportieren. |
| **Settings** | Servereinstellungen, Eigenschaften, Integrationen, Symbol und Upgrade-Versionen ändern.                                                 |
| **Delete**   | Server löschen.                                                                                                                         |

![Berechtigungseditor](/docs/images/permissions-editor.png)

Unter dem Raster öffnet **Was jede Berechtigung abdeckt** jede Berechtigung in das, was eine Person tun kann, was nicht enthalten ist, und die genauen Panel-Routen, die sie freischaltet. Die letzte Liste wird von der Testsuite gegen den laufenden Code geprüft.

![Berechtigungsreferenz](/docs/images/permissions-reference.png)

Auf einem Telefon stapelt sich das Raster zu einer Karte pro Benutzer, mit einer Zeile pro Server.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Berechtigungen auf einem Telefon" width="180">
</p>

Wie die Teile zusammenpassen:

- **Die Rolle ist der Standard.** Ein Operator beginnt mit jeder Berechtigung auf jedem Server; ein Viewer beginnt nur mit View. Eine Zelle in blasser Schrift (ihr Tooltip sagt "Rollenstandard") wurde noch nie geändert.
- **Eine Zelle überschreibt die Rolle nur für diesen Server.** Geben Sie einem Viewer auf einem Server Power und Console, und er kann ihn ausführen, während alle anderen Server für ihn schreibgeschützt bleiben. Nehmen Sie einem Operator auf Ihrem Hauptserver die Löschberechtigung weg, und er behält dort alles andere.
- **Jede Berechtigung beinhaltet View.** Sie können keinen Server bedienen, den Sie nicht sehen können.
- **Schalten Sie alles aus, um einen Server auszublenden.** Er verschwindet aus der Seitenleiste, dem Dashboard, den Backups, Zeitplänen, der Aktivität, den Updates, den Modpacks, dem Live-Status, den laufenden Aufgaben und den Blueprints dieses Benutzers, und die Weltenbibliothek hört auf, ihn zu benennen. Ein direkter Link, ein API-Aufruf oder ein Konsolen-Socket antwortet "nicht gefunden", genau wie ein nicht existierender Server.
- **Panelweite Aktionen folgen weiterhin der Rolle.** Servererstellung (einschließlich Klonen), Speicher, Benutzer, API-Schlüssel, globale Einstellungen und panelweite Zeitpläne sind nicht serverspezifisch. Ein Viewer mit Berechtigungen für einige Server kann diese trotzdem nicht ausführen. Operatoren behalten die Servererstellung und panelweite Zeitpläne; Speicher, Benutzer, API-Schlüssel und globale Einstellungen sind nur für Admins.
- **Zeitpläne folgen dem Server.** Ein geplanter Neustart, ein Backup oder ein Befehl auf einem Server erfordert die entsprechende Berechtigung dort (Power, Backups oder Console), unabhängig von der Rolle.
- **Blueprints folgen ebenfalls dem Server.** Das Exportieren eines Servers als Blueprint erfordert dort die Berechtigung Files, da das Archiv seine Dateien enthält. Ein von einem Server exportierter Blueprint, den jemand nicht sehen kann, ist auch für ihn verborgen.
- **Nur für Admins zugängliche Bereiche bleiben für Admins zugänglich** auf jedem Server: der Chatbot, die Backup-Aufbewahrung und erweiterte Docker-Überschreibungen.

Jede Änderung wird im Aktivitätsprotokoll mit Angabe, wer was geändert hat, protokolliert; diese Einträge werden nur Admins angezeigt. Das Löschen eines Benutzers entfernt seine Zeilen. Das Entfernen eines Servers behält sie, sodass ein Server, der für jemanden verborgen ist, in seiner Historie und seinen gespeicherten Backups verborgen bleibt.

Bestehende Installationen funktionieren unverändert weiter: Bis ein Admin eine Zelle bearbeitet, hat jeder Benutzer genau das, was seine Rolle ihm zuvor gegeben hat.

## Nur für Admins, und warum

Einige Dinge sind absichtlich auf Admins beschränkt:

- **Benutzerverwaltung, Speicher, globale Einstellungen, API-Schlüssel und globale Dateien.**
- **Die [öffentliche API](/docs/public-api/)**: Aktivierung von `/api/v1` und Erstellung, Geltungsbereichsbestimmung oder Widerruf seiner schreibgeschützten Bearer-Token.
- **Erweiterte Docker-Überschreibungen**: benutzerdefinierter Containername, zusätzliche Port-Veröffentlichungen und Bind-Mounts. Ein Bind-Mount kann jeden Host-Pfad in einen Container einbinden und ist in Kombination mit dem Docker-Zugriff des Panels effektiv Root auf dem Host. Diese Felder erscheinen nur für Admins.

Benutzerdefinierte Containernamen können sich auch nicht im eigenen `msm-` Namensraum des Panels befinden, sodass ein manuell benannter Container niemals den eines anderen Servers überschatten und einen Stopp- oder Befehl an die falsche Instanz umleiten kann.

## Konten verwalten

![Profilbild](/docs/images/profile-picture.png)

Admins können Benutzer erstellen, Rollen ändern, Passwörter zurücksetzen und Konten aus der Benutzertabelle löschen. Die Spalte **2FA** zeigt an, ob ein Benutzer die Zwei-Faktor-Authentifizierung aktiviert hat; ein Admin kann die 2FA eines anderen Benutzers mit **2FA zurücksetzen** im Aktionsmenü dieses Benutzers zurücksetzen (für den Fall eines verlorenen Telefons und von Backup-Codes), aber niemals seine eigene deaktivieren, ohne sein Passwort, was der Self-Service-Flow stattdessen handhabt.

Fehlgeschlagene Anmeldungen werden pro Konto ratenbegrenzt (sowohl ein Zähler pro IP als auch ein globaler Zähler pro Konto), um Brute-Force-Versuche zu verlangsamen, und dieselbe Grenze deckt auch den 2FA-Code-Schritt ab, sodass ein korrektes Passwort den Zähler nicht zurücksetzen kann, bevor Codes erraten werden. Davor sitzt eine gröbere Ratenbegrenzung pro Client-IP für die Anmelde-, 2FA- und Setup-Endpunkte, die über `RATE_LIMIT_AUTH_PER_15MIN` (Standard 100; hinter einem Reverse-Proxy, setzen Sie `TRUST_PROXY`, damit sie auf die echte Client-IP reagiert) eingestellt werden kann.

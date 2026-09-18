---
title: 'Zwei-Faktor-Authentifizierung'
description: 'Die Zwei-Faktor-Authentifizierung (2FA) fügt einen zweiten Schritt zur Anmeldung hinzu: Nach Ihrem Passwort geben Sie einen kurzen Code von einer Authentifizierungs-App auf Ihrem Telefon ein.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Zurück zum Dokumentenverzeichnis](/docs/)

Zwei-Faktor-Authentifizierung (2FA) fügt einen zweiten Schritt zur Anmeldung hinzu: Nach Ihrem Passwort geben Sie einen kurzen Code von einer Authentifizierungs-App auf Ihrem Telefon ein. Selbst wenn jemand Ihr Passwort erfährt, kann er ohne Ihr Gerät nicht darauf zugreifen.

Es funktioniert mit jeder Standard-TOTP-Authentifizierungs-App (Google Authenticator, Authy, 1Password, Microsoft Authenticator und andere) und ist für **jedes** Konto verfügbar, nicht nur für Administratoren. Der Schutz Ihres eigenen Logins ist keine Serververwaltungsaktion, daher können Zuschauer und Betreiber ihn ebenfalls aktivieren.

## 2FA aktivieren

Öffnen Sie das Kontomenü (Ihre Initialen, oben rechts) und wählen Sie **Zwei-Faktor-Authentifizierung**.

![Konto-Menü](/docs/images/2fa-user-menu.png)

Sie erhalten einen Registrierungsdialog:

![Registrierung](/docs/images/2fa-enroll.png)

1. **Scannen Sie den QR-Code** mit Ihrer Authentifizierungs-App oder tippen Sie auf **Kopieren** und geben Sie den manuellen Schlüssel von Hand ein.
2. Geben Sie den **6-stelligen Code** ein, den Ihre App jetzt anzeigt.
3. **Bestätigen Sie Ihr Passwort.** Die Aktivierung von 2FA überprüft Ihr Passwort erneut, sodass eine versehentlich offene Sitzung es nicht mit dem Gerät einer anderen Person einschalten kann.
4. Klicken Sie auf **Aktivieren**.

### Sichern Sie Ihre Backup-Codes

Sobald 2FA aktiviert ist, zeigt das Panel eine Reihe von einmaligen **Backup-Codes** an.

![Backup-Codes](/docs/images/2fa-backup-codes.png)

Jeder Code funktioniert **einmal**, um sich anzumelden, falls Sie jemals den Zugriff auf Ihre Authentifizierungs-App verlieren. Speichern Sie sie an einem sicheren Ort (ein Passwort-Manager ist ideal), da sie nicht erneut angezeigt werden. Sie können jederzeit einen neuen Satz generieren (wodurch die alten ungültig werden).

## Anmeldung mit 2FA

Von da an hat die Anmeldung einen zweiten Schritt. Nach Ihrem Benutzernamen und Passwort fragt das Panel nach Ihrem Code:

![2FA-Anmeldung](/docs/images/2fa-login-challenge.png)

Geben Sie den aktuellen 6-stelligen Code aus Ihrer App (oder einen Ihrer Backup-Codes) ein und Sie sind angemeldet. Bis Sie diesen Schritt abgeschlossen haben, ist die Sitzung **nicht** angemeldet: Sie kann keine Seite oder API erreichen.

## 2FA verwalten oder deaktivieren

Öffnen Sie denselben Eintrag **Zwei-Faktor-Authentifizierung** im Kontomenü, während er aktiviert ist. Nachdem Sie Ihr Passwort bestätigt haben, können Sie:

- **Backup-Codes neu generieren** – gibt einen neuen Satz aus und macht den alten ungültig.
- **2FA deaktivieren** – entfernt es von Ihrem Konto.

Beide Aktionen überprüfen zuerst Ihr aktuelles Passwort.

## Telefon _und_ Backup-Codes verloren?

Ein **Administrator** kann die 2FA eines anderen Benutzers unter **Einstellungen → Benutzer** zurücksetzen (die Schaltfläche **Zurücksetzen** in der 2FA-Spalte). Dies löscht die 2FA für das Konto, sodass sich der Benutzer mit nur seinem Passwort anmelden und es neu einrichten kann. Administratoren können ihre _eigene_ 2FA nicht ohne Passwort zurücksetzen. Sie durchlaufen die normale passwortgeschützte Deaktivierung, sodass eine kompromittierte Admin-Sitzung ihren eigenen zweiten Faktor nicht entfernen kann.

## Gut zu wissen

- Codes sind zeitbasiert und wechseln alle 30 Sekunden; das Panel akzeptiert eine geringe Zeitabweichung und erholt sich leise, wenn die Uhr des Servers später korrigiert wird.
- Ein Code kann nicht wiederverwendet werden – sobald er zur Anmeldung verwendet wurde, funktioniert derselbe Code innerhalb seines Zeitfensters nicht mehr.
- Falsche Codes werden ratenbegrenzt. Die Begrenzung ist mit dem Passwortschritt **gemeinsam** (eine pro Konto-Sperrung plus eine pro IP `RATE_LIMIT_AUTH_PER_15MIN`-Begrenzung), sodass die Eingabe eines korrekten Passworts den Zähler nicht direkt vor dem Raten des 6-stelligen Codes zurücksetzen kann.
- 2FA-Änderungen (Aktivierung, Deaktivierung, Zurücksetzung, Verwendung von Backup-Codes) werden alle im [Aktivitätsprotokoll](/docs/activity/) aufgezeichnet.

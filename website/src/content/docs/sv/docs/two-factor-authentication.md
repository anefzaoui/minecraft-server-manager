---
title: 'Tvåfaktorsautentisering'
description: 'Tvåfaktorsautentisering (2FA) lägger till ett andra steg vid inloggning: efter ditt lösenord anger du en kort kod från en autentiseringsapp på din telefon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Tillbaka till dokumentindex](/docs/)

Tvåfaktorsautentisering (2FA) lägger till ett andra steg vid inloggning: efter ditt lösenord anger du en kort kod från en autentiseringsapp på din telefon. Även om någon får reda på ditt lösenord kan de inte logga in utan din enhet.

Det fungerar med alla standardmässiga TOTP-autentiserare (Google Authenticator, Authy, 1Password, Microsoft Authenticator och andra), och det är tillgängligt för **alla** konton, inte bara administratörer. Att skydda din egen inloggning är inte en serverhanteringsåtgärd, så tittare och operatörer kan också aktivera det.

## Aktivera 2FA

Öppna kontomenyn (din initial, längst upp till höger) och välj **Tvåfaktorsautentisering**.

![Kontomeny](/docs/images/2fa-user-menu.png)

Du får en registreringsdialogruta:

![Registrering](/docs/images/2fa-enroll.png)

1. **Skanna QR-koden** med din autentiseringsapp, eller tryck på **Kopiera** och ange den manuella nyckeln för hand.
2. Ange den **6-siffriga koden** som din app nu visar.
3. **Bekräfta ditt lösenord.** Att aktivera 2FA kontrollerar ditt lösenord igen, så en oavsiktlig öppen session kan inte aktivera det med någon annans enhet.
4. Klicka på **Aktivera**.

### Spara dina backupkoder

I samma ögonblick som 2FA aktiveras visar panelen en uppsättning engångs **backupkoder**.

![Backupkoder](/docs/images/2fa-backup-codes.png)

Varje kod fungerar **en gång**, för att logga in om du någonsin tappar åtkomsten till din autentiseringsapp. Spara dem på en säker plats (en lösenordshanterare är idealisk) eftersom de inte kommer att visas igen. Du kan generera en ny uppsättning när som helst (vilket ogiltigförklarar de gamla).

## Logga in med 2FA

Från och med då har inloggningen ett andra steg. Efter ditt användarnamn och lösenord frågar panelen efter din kod:

![2FA-inloggning](/docs/images/2fa-login-challenge.png)

Ange den aktuella 6-siffriga koden från din app (eller en av dina backupkoder) så är du inne. Innan du slutför detta steg är sessionen **inte** inloggad: den kan inte nå någon sida eller API.

## Hantera eller stäng av 2FA

Öppna samma **Tvåfaktorsautentisering**-post i kontomenyn medan den är aktiverad. Efter att ha bekräftat ditt lösenord kan du:

- **Generera nya backupkoder** - utfärdar en ny uppsättning och avregistrerar den gamla.
- **Stäng av 2FA** - tar bort det från ditt konto.

Båda kontrollerar ditt nuvarande lösenord först.

## Tappat telefonen _och_ dina backupkoder?

En **administratör** kan återställa en annan användares 2FA från **Inställningar → Användare** (**Återställ**-knappen i 2FA-kolumnen). Det rensar 2FA för kontot så att användaren kan logga in med bara sitt lösenord och konfigurera det på nytt. Administratörer kan inte återställa sin _egen_ 2FA utan lösenord. De går igenom den normala lösenordsbegränsade avstängningen, så en kapad administratörssession kan inte ta bort sin egen andra faktor.

## Bra att veta

- Koder är tidsbaserade och roterar var 30:e sekund; panelen accepterar en liten klockdrift och återhämtar sig tyst om serverns klocka senare korrigeras.
- En kod kan inte spelas upp igen – när den har använts för att logga in fungerar inte samma kod igen inom sitt fönster.
- Felaktiga koder är begränsade. Begränsningen är **delad** med lösenordssteget (en kontobaserad spärr plus en IP-baserad `RATE_LIMIT_AUTH_PER_15MIN`-begränsning), så att ange ett korrekt lösenord kan inte återställa räknaren precis innan man gissar den 6-siffriga koden.
- 2FA-ändringar (aktivering, avaktivering, återställning, användning av backupkod) registreras alla i [Aktivitetsloggen](/docs/activity/).

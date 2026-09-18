---
title: 'Twee-factorauthenticatie'
description: 'Twee-factorauthenticatie (2FA) voegt een tweede stap toe aan het inloggen: na je wachtwoord voer je een korte code in van een authenticatie-app op je telefoon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Terug naar de documentatie-index](/docs/)

Twee-factorauthenticatie (2FA) voegt een tweede stap toe aan het inloggen: na je wachtwoord voer je een korte code in van een authenticatie-app op je telefoon. Zelfs als iemand je wachtwoord achterhaalt, kunnen ze zonder jouw apparaat niet binnenkomen.

Het werkt met elke standaard TOTP-authenticator (Google Authenticator, Authy, 1Password, Microsoft Authenticator, en andere), en het is beschikbaar voor **elk** account, niet alleen voor beheerders. Het beveiligen van je eigen login is geen serverbeheertaak, dus kijkers en operators kunnen het ook inschakelen.

## 2FA inschakelen

Open het accountmenu (je initialen, rechtsboven) en kies **Twee-factorauthenticatie**.

![Accountmenu](/docs/images/2fa-user-menu.png)

Je krijgt een inschrijvingsdialoogvenster:

![Inschrijven](/docs/images/2fa-enroll.png)

1. **Scan de QR-code** met je authenticatie-app, of tik op **Kopiëren** en voer de handmatige sleutel met de hand in.
2. Typ de **6-cijferige code** die je app nu toont.
3. **Bevestig je wachtwoord.** Het inschakelen van 2FA controleert je wachtwoord opnieuw, zodat een openstaande sessie het niet kan inschakelen met het apparaat van iemand anders.
4. Klik op **Inschakelen**.

### Bewaar je back-upcodes

Zodra 2FA is ingeschakeld, toont het paneel een set eenmalige **back-upcodes**.

![Back-upcodes](/docs/images/2fa-backup-codes.png)

Elke code werkt **één keer** om in te loggen als je ooit de toegang tot je authenticatie-app verliest. Bewaar ze ergens veilig (een wachtwoordmanager is ideaal), want ze worden niet opnieuw getoond. Je kunt op elk moment een nieuwe set genereren (waardoor de oude ongeldig wordt).

## Inloggen met 2FA

Vanaf dan heeft het inloggen een tweede stap. Na je gebruikersnaam en wachtwoord vraagt het paneel om je code:

![2FA inloggen](/docs/images/2fa-login-challenge.png)

Voer de huidige 6-cijferige code van je app (of een van je back-upcodes) in en je bent binnen. Totdat je deze stap voltooit, is de sessie **niet** ingelogd: het kan geen enkele pagina of API bereiken.

## 2FA beheren of uitschakelen

Open dezelfde **Twee-factorauthenticatie**-optie in het accountmenu terwijl deze is ingeschakeld. Na het bevestigen van je wachtwoord kun je:

- **Back-upcodes opnieuw genereren** - geeft een nieuwe set uit en trekt de oude in.
- **2FA uitschakelen** - verwijdert het van je account.

Beide controleren eerst je huidige wachtwoord.

## Je telefoon _en_ je back-upcodes kwijt?

Een **beheerder** kan de 2FA van een andere gebruiker opnieuw instellen via **Instellingen → Gebruikers** (de knop **Opnieuw instellen** in de 2FA-kolom). Dat wist 2FA voor het account, zodat de gebruiker kan inloggen met alleen zijn wachtwoord en het opnieuw kan instellen. Beheerders kunnen hun _eigen_ 2FA niet zonder wachtwoord opnieuw instellen. Ze doorlopen de normale, wachtwoord-beveiligde uitschakeling, zodat een gekaapte beheerderssessie zijn eigen tweede factor niet kan verwijderen.

## Goed om te weten

- Codes zijn tijdgebaseerd en roteren elke 30 seconden; het paneel accepteert een kleine klokafwijking en herstelt stilzwijgend als de klok van de server later wordt gecorrigeerd.
- Een code kan niet opnieuw worden gebruikt - zodra deze is gebruikt om in te loggen, werkt diezelfde code niet meer binnen zijn periode.
- Verkeerde codes worden beperkt in hun gebruik. De beperking is **gedeeld** met de wachtwoordstap (een vergrendeling per account plus een `RATE_LIMIT_AUTH_PER_15MIN` beperking per IP-adres), dus het invoeren van een correct wachtwoord kan de teller niet resetten vlak voordat je de 6-cijferige code raadt.
- 2FA-wijzigingen (inschakelen, uitschakelen, opnieuw instellen, gebruik van back-upcodes) worden allemaal vastgelegd in het [Activiteitenlogboek](/docs/activity/).

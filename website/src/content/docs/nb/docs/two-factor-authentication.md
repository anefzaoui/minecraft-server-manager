---
title: 'Tofaktorautentisering'
description: 'Tofaktorautentisering (2FA) legger til et ekstra steg ved innlogging: etter passordet ditt skriver du inn en kort kode fra en autentiseringsapp på telefonen din.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Tilbake til dokumentindeks](/docs/)

Tofaktorautentisering (2FA) legger til et ekstra trinn ved innlogging: etter passordet ditt skriver du inn en kort kode fra en autentiseringsapp på telefonen din. Selv om noen får tak i passordet ditt, kan de ikke logge inn uten enheten din.

Den fungerer med enhver standard TOTP-autentiseringsapp (Google Authenticator, Authy, 1Password, Microsoft Authenticator og andre), og den er tilgjengelig for **alle** kontoer, ikke bare administratorer. Å beskytte din egen innlogging er ikke en serveradministrasjonsfunksjon, så seere og operatører kan også aktivere den.

## Aktivere 2FA

Åpne kontomenyen (initialene dine, øverst til høyre) og velg **Tofaktorautentisering**.

![Kontomeny](/docs/images/2fa-user-menu.png)

Du vil få en registreringsdialog:

![Registrering](/docs/images/2fa-enroll.png)

1. **Skann QR-koden** med autentiseringsappen din, eller trykk **Kopier** og skriv inn den manuelle nøkkelen for hånd.
2. Skriv inn **6-sifret kode** som appen din viser nå.
3. **Bekreft passordet ditt.** Aktivering av 2FA sjekker passordet ditt på nytt, slik at en tilfeldig åpen sesjon ikke kan slå den på med en annens enhet.
4. Klikk **Aktiver**.

### Lagre sikkerhetskopikodene dine

I det øyeblikket 2FA er aktivert, viser panelet et sett med engangs **sikkerhetskopikoder**.

![Sikkerhetskopikoder](/docs/images/2fa-backup-codes.png)

Hver kode fungerer **én gang**, for å logge inn hvis du mister tilgangen til autentiseringsappen din. Lagre dem et trygt sted (en passordbehandler er ideell) fordi de ikke vil bli vist igjen. Du kan generere et nytt sett når som helst (som ugyldiggjør de gamle).

## Logge inn med 2FA

Fra da av har innlogging et ekstra trinn. Etter brukernavn og passord ber panelet om koden din:

![2FA-innlogging](/docs/images/2fa-login-challenge.png)

Skriv inn den gjeldende 6-sifrede koden fra appen din (eller en av sikkerhetskopikodene dine), så er du inne. Før du fullfører dette trinnet, er sesjonen **ikke** logget inn: den kan ikke nå noen side eller API.

## Administrere eller slå av 2FA

Åpne det samme **Tofaktorautentisering**-valget i kontomenyen mens det er aktivert. Etter å ha bekreftet passordet ditt kan du:

- **Generer nye sikkerhetskopikoder** - utsteder et nytt sett og trekker tilbake det gamle.
- **Deaktiver 2FA** - fjerner det fra kontoen din.

Begge sjekker ditt nåværende passord først.

## Mistet telefonen _og_ sikkerhetskopikodene dine?

En **administrator** kan tilbakestille en annen brukers 2FA fra **Innstillinger → Brukere** (**Tilbakestill**-knappen i 2FA-kolonnen). Det sletter 2FA for kontoen slik at brukeren kan logge inn med bare passordet sitt og sette det opp på nytt. Administratorer kan ikke tilbakestille sin _egen_ 2FA uten passord. De går gjennom den vanlige passordbeskyttede deaktiveringen, slik at en overtatt administrativ sesjon ikke kan fjerne sin egen andre faktor.

## Greit å vite

- Koder er tidsbaserte og roterer hvert 30. sekund; panelet aksepterer en liten klokkedrift, og gjenoppretter stille hvis serverens klokke senere korrigeres.
- En kode kan ikke gjenbrukes - når den er brukt til å logge inn, vil den samme koden ikke fungere igjen innenfor sitt tidsvindu.
- Feil koder er begrenset i antall. Begrensningen er **delt** med passordtrinnet (en per-konto utestengning pluss en per-IP `RATE_LIMIT_AUTH_PER_15MIN`-begrensning), så å skrive inn et riktig passord kan ikke tilbakestille telleren rett før du gjetter den 6-sifrede koden.
- 2FA-endringer (aktivering, deaktivering, tilbakestilling, bruk av sikkerhetskopikode) blir alle registrert i [Aktivitetsloggen](/docs/activity/).

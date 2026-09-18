---
title: 'Tofaktor-godkendelse'
description: 'Tofaktor-godkendelse (2FA) tilføjer et andet trin til login: efter din adgangskode indtaster du en kort kode fra en godkendelsesapp på din telefon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Tilbage til dokumentindeks](/docs/)

Tofaktor-godkendelse (2FA) tilføjer et andet trin til login: efter din adgangskode indtaster du en kort kode fra en godkendelsesapp på din telefon. Selvom nogen får fat i din adgangskode, kan de ikke komme ind uden din enhed.

Det virker med enhver standard TOTP-godkender (Google Authenticator, Authy, 1Password, Microsoft Authenticator og andre), og det er tilgængeligt for **enhver** konto, ikke kun administratorer. Beskyttelse af dit eget login er ikke en serveradministrationshandling, så seere og operatører kan også aktivere det.

## Aktivering af 2FA

Åbn kontomenuen (dit initial, øverst til højre) og vælg **Tofaktor-godkendelse**.

![Kontomenu](/docs/images/2fa-user-menu.png)

Du får en registreringsdialog:

![Registrering](/docs/images/2fa-enroll.png)

1. **Scan QR-koden** med din godkendelsesapp, eller tryk på **Kopiér** og indtast den manuelle nøgle i hånden.
2. Indtast den **6-cifrede kode**, som din app nu viser.
3. **Bekræft din adgangskode.** Aktivering af 2FA genbekræfter din adgangskode, så en tilfældig åben session ikke kan slå den til med en andens enhed.
4. Klik på **Aktivér**.

### Gem dine backupkoder

I det øjeblik 2FA er aktiveret, viser panelet et sæt engangs **backupkoder**.

![Backupkoder](/docs/images/2fa-backup-codes.png)

Hver kode virker **én gang** til login, hvis du nogensinde mister adgangen til din godkendelsesapp. Gem dem et sikkert sted (en adgangskodemanager er ideel), da de ikke vises igen. Du kan generere et nyt sæt når som helst (hvilket ugyldiggør de gamle).

## Login med 2FA

Derefter har login et andet trin. Efter dit brugernavn og adgangskode beder panelet om din kode:

![2FA login](/docs/images/2fa-login-challenge.png)

Indtast den aktuelle 6-cifrede kode fra din app (eller en af dine backupkoder), og du er inde. Indtil du fuldfører dette trin, er sessionen **ikke** logget ind: den kan ikke tilgå nogen side eller API.

## Administration eller deaktivering af 2FA

Åbn den samme **Tofaktor-godkendelse**-indstilling i kontomenuen, mens den er aktiveret. Efter at have bekræftet din adgangskode kan du:

- **Genopret backupkoder** - udsteder et nyt sæt og afskriver det gamle.
- **Deaktiver 2FA** - fjerner det fra din konto.

Begge dele genbekræfter først din aktuelle adgangskode.

## Mistet din telefon _og_ dine backupkoder?

En **administrator** kan nulstille en anden brugers 2FA fra **Indstillinger → Brugere** (**Nulstil**-knappen i 2FA-kolonnen). Det rydder 2FA for kontoen, så brugeren kan logge ind med kun deres adgangskode og sætte det op igen. Administratorer kan ikke nulstille deres _egen_ 2FA uden adgangskode. De gennemgår den normale adgangskode-beskyttede deaktivering, så en kapret administrator-session ikke kan fjerne sin egen anden faktor.

## Godt at vide

- Koder er tidsbaserede og roterer hvert 30. sekund; panelet accepterer en lille tidsafvigelse og genopretter stille, hvis serverens ur senere korrigeres.
- En kode kan ikke genbruges - når den er brugt til login, virker den samme kode ikke igen inden for dens tidsvindue.
- Forkerte koder er begrænset i antal. Begrænsningen er **delt** med adgangskode-trinnet (en kontobaseret lockout plus en IP-baseret `RATE_LIMIT_AUTH_PER_15MIN` begrænsning), så indtastning af en korrekt adgangskode kan ikke nulstille tælleren lige før gætning af den 6-cifrede kode.
- 2FA-ændringer (aktivering, deaktivering, nulstilling, brug af backupkode) registreres alle i [Aktivitetsloggen](/docs/activity/).

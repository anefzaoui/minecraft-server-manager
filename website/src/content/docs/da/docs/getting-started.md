---
title: 'Kom godt i gang'
description: 'Installer Minecraft Server Manager og fuldfør den første opsætning: systemtjekket, din tidszone og administratorkontoen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Tilbage til dokumentindeks](/docs/)

## Første opsætning

Første gang du åbner panelet, guider en kort opsætningsguide dig igennem det:

1.  **Systemtjek** sikrer, at Docker er tilgængeligt, Node.js er ny nok, og data-mappen kan skrives til. Hvis Docker ikke kører endnu, kan du stadig fortsætte; oprettelse og start af servere venter, indtil det er det.
2.  **Opret din administratorkonto**. Dette er den eneste konto, der eksisterer, indtil du tilføjer flere, og den har fuld kontrol. Vælg et brugernavn (2 til 32 tegn) og en adgangskode på mindst 8 tegn. Du er logget ind, så snart den er oprettet.
3.  **Panelkonfiguration** (valgfrit): et offentligt domæne, der skal vises til spillere i forbindelsesadresser, en CurseForge API-nøgle og din tidszone. Alt dette kan ændres senere under **Indstillinger**.

Det sidste trin tilbyder **Opret en server** eller **Gå til dashboardet**.

![Systemtjek-trinnet under første opsætning](/docs/images/setup-system-check.png)

> **Eksponerede installationer er PIN-beskyttede.** Hvis du starter panelet bundet til en ikke-loopback-adresse (`PANEL_HOST` ud over `127.0.0.1`), beder opsætningssiden også om en **6-cifret PIN-kode**. Panelet udskriver den til sin konsol ved opstart. Indtast den sammen med dit brugernavn og din adgangskode. Dette forhindrer en fremmed, der når porten først, i at gøre krav på administratorkontoen. PIN-koden forsvinder, når administratorkontoen er oprettet.

## Log ind

Efter opsætningen er panelet beskyttet af en login-skærm. Indtast dit brugernavn og din adgangskode for at fortsætte.

![Log ind](/docs/images/login.png)

Hvis [to-faktor-godkendelse](/docs/two-factor-authentication/) er aktiveret på din konto, bliver du bedt om en 6-cifret kode fra din godkendelsesapp lige efter din adgangskode.

## Find rundt

Alt hænger sammen fra sidebjælken til venstre:

- **Dashboard** - alle servere på et øjeblik ([detaljer](/docs/dashboard/)).
- **Servere**, **Modpacks**, **Verdener**, **Skabeloner** - opret og administrer servere og deres indhold.
- **Opdateringer**, **Sikkerhedskopier**, **Tidsplaner**, **Lagerplads**, **Aktivitet** - den operationelle side: hvad der er forældet, dine snapshots, automatisering, diskforbrug og revisionsloggen.
- **Tilladelser** (nederst, kun for administratorer): hvad hver bruger må gøre på hver server ([detaljer](/docs/users-and-roles/#per-server-permissions)).
- **Indstillinger** (nederst, kun for administratorer): API-nøgler, panelkonfiguration, standardindstillinger for nye servere, [opbevaring af sikkerhedskopier](/docs/backups/#retention), brugere, login-sikkerhed og den offentlige API.

Under disse viser sidebjælken dine servere. Åbning af en viser dens egne faner: **Oversigt**, **Konsol**, **Spillere**, **Mods**, **Verden**, **Sikkerhedskopier**, **Overvågning** og **Indstillinger**, de fleste med relaterede underfaner (f.eks. indeholder **Indstillinger → Konfiguration** serverens indstillinger og dens spilport). Se [En enkelt server](/docs/servers/#a-single-server).

Topbjælken har knappen **Opret en server**, en **tema-omskifter** (mørk/lys) og din **kontomenu**, hvor du kan ændre dit profilbillede, administrere [to-faktor-godkendelse](/docs/two-factor-authentication/) eller logge ud.

## På en telefon eller tablet

Hver side er designet til en smal skærm først og udvides derfra: sidebjælken gemmes bag menu-knappen, datatabeller stables til kort, værktøjslinjer ombrydes, og "world-controls"-skinnen kollapser til et kort, du åbner, når du har brug for det. Knapper og chips har en reel berøringsstørrelse. Intet er kun tilgængeligt på desktop.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Dashboard på en telefon" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Serveroversigt på en telefon" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsol på en telefon" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Mods-fane på en telefon" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Versionskompatibilitet på en telefon" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Indstillinger på en telefon" width="180">
</p>

## Hvad du skal bruge

Panelet kommunikerer med Docker for at køre servere, så det har brug for adgang til en Docker-daemon (Docker Desktop eller en Docker Engine socket). Når Docker er tilgængeligt, viser dashboardets Docker-flise **Forbundet** og dens version. Hvis den ikke er det, kører panelet stadig. Du kan bare ikke starte servere, før daemonen er oppe.

## Næste skridt

- [Opret din første server →](/docs/servers/)
- [Sikr din konto med 2FA →](/docs/two-factor-authentication/)

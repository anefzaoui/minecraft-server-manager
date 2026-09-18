---
title: 'Kom godt i gang'
description: 'Første gang du åbner panelet, bliver du bedt om at oprette en administratorbruger.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Tilbage til dokumentindeks](/docs/)

## Første opsætning

Første gang du åbner panelet, bliver du bedt om at oprette en administratorkonto. Dette er den eneste konto, der eksisterer, indtil du tilføjer flere, og den har fuld kontrol.

Vælg et brugernavn og en adgangskode på mindst 8 tegn. Det er det hele: du er logget ind og ført direkte til instrumentbrættet.

> **Eksponerede installationer er PIN-beskyttede.** Hvis du starter panelet bundet til en ikke-loopback-adresse (`PANEL_HOST` ud over `127.0.0.1`), beder opsætningssiden også om en **6-cifret PIN-kode**. Panelet udskriver den til sin konsol ved opstart. Indtast den sammen med dit brugernavn og din adgangskode. Dette forhindrer en fremmed, der når porten først, i at gøre krav på administratorkontoen. PIN-koden forsvinder, når administratorkontoen er oprettet.

## Log ind

Efter opsætningen er panelet beskyttet af en login-skærm. Indtast dit brugernavn og din adgangskode for at fortsætte.

![Log ind](/docs/images/login.png)

Hvis [to-faktor-godkendelse](/docs/two-factor-authentication/) er aktiveret på din konto, bliver du bedt om en 6-cifret kode fra din godkendelsesapp lige efter din adgangskode.

## Find rundt

Alt hænger sammen med sidebjælken til venstre:

- **Instrumentbræt** - alle servere på et øjeblik ([detaljer](/docs/dashboard/)).
- **Servere**, **Modpacks**, **Verdener**, **Skabeloner** - opret og administrer servere og deres indhold.
- **Opdateringer**, **Sikkerhedskopier**, **Tidsplaner**, **Lagerplads**, **Aktivitet** - den operationelle side: hvad der er forældet, dine snapshots, automatisering, diskforbrug og revisionsloggen.
- **Indstillinger** (nederst): brugere, API-nøgler og panelkonfiguration.

Topbjælken indeholder knappen **Opret en server**, en **tema-vælger** (mørk/lys) og din **kontomenu**, hvor du kan administrere [to-faktor-godkendelse](/docs/two-factor-authentication/) eller logge ud.

## På en telefon eller tablet

Hver side er designet til en smal skærm først og udvides derfra: sidebjælken gemmes bag menu-knappen, datatabeller stables til kort, værktøjslinjer ombrydes, og verdensstyrings-skinnen kollapser til et kort, du åbner, når du har brug for det. Knapper og chips har en reel berøringsflade. Intet er kun til desktop.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Instrumentbræt på en telefon" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Serveroversigt på en telefon" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsol på en telefon" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Mods-fane på en telefon" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Indstillinger på en telefon" width="180">
</p>

## Hvad du har brug for

Panelet taler med Docker for at køre servere, så det har brug for adgang til en Docker-daemon (Docker Desktop eller en Docker Engine socket). Når Docker er tilgængelig, viser instrumentbrættets Docker-flise **Tilsluttet** og dens version. Hvis den ikke er det, kører panelet stadig. Du kan bare ikke starte servere, før daemonen er oppe.

## Næste skridt

- [Opret din første server →](/docs/servers/)
- [Sikr din konto med 2FA →](/docs/two-factor-authentication/)

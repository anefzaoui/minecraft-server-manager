---
title: 'Komme i gang'
description: 'Installer Minecraft Server Manager og fullfør førstegangsoppsettet: systemkontrollen, tidssonen din og administratorkontoen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Tilbake til dokumentindeks](/docs/)

## Første gangs oppsett

Første gang du åpner panelet, veileder en kort oppsettsveiviser deg gjennom det:

1.  **Systemkontroll** sørger for at Docker er tilgjengelig, Node.js er ny nok, og datamappen kan skrives til. Hvis Docker ikke kjører ennå, kan du fortsatt fortsette; opprettelse og start av servere venter til det er i gang.
2.  **Opprett administratorkontoen din**. Dette er den eneste kontoen som eksisterer før du legger til flere, og den har full kontroll. Velg et brukernavn (2 til 32 tegn) og et passord på minst 8 tegn. Du er logget inn så snart den er opprettet.
3.  **Panelkonfigurasjon** (valgfritt): et offentlig domene for å vise spillere i tilkoblingsadresser, en CurseForge API-nøkkel og tidssonen din. Alt dette kan endres senere i **Innstillinger**.

Det siste trinnet tilbyr **Opprett en server** eller **Gå til dashbordet**.

![Systemkontroll-steget under første gangs oppsett](/docs/images/setup-system-check.png)

> **Eksponerte installasjoner er PIN-beskyttet.** Hvis du starter panelet bundet til en ikke-loopback-adresse (`PANEL_HOST` annet enn `127.0.0.1`), ber oppsettsiden også om en **6-sifret PIN-kode**. Panelet skriver den til konsollen ved oppstart. Skriv den inn sammen med brukernavn og passord. Dette hindrer en fremmed som når porten først fra å kreve administratorkontoen. PIN-koden forsvinner når administratorkontoen eksisterer.

## Innlogging

Etter oppsett er panelet beskyttet av en påloggingsskjerm. Skriv inn brukernavn og passord for å fortsette.

![Logg inn](/docs/images/login.png)

Hvis [toveis autentisering](/docs/two-factor-authentication/) er aktivert på kontoen din, blir du bedt om en 6-sifret kode fra autentiseringsappen din rett etter passordet.

## Finn veien rundt

Alt henger fra sidefeltet til venstre:

- **Dashbord** - alle servere på et øyeblikk ([detaljer](/docs/dashboard/)).
- **Servere**, **Modpacks**, **Verdener**, **Blåkopier** - opprett og administrer servere og innholdet deres.
- **Oppdateringer**, **Sikkerhetskopier**, **Tidsplaner**, **Lagring**, **Aktivitet** - driftssiden: hva som er utdatert, øyeblikksbildene dine, automatisering, diskbruk og revisjonsloggen.
- **Tillatelser** (nederst, kun for administratorer): hva hver bruker kan gjøre på hver server ([detaljer](/docs/users-and-roles/#per-server-permissions)).
- **Innstillinger** (nederst, kun for administratorer): API-nøkler, panelkonfigurasjon, standardinnstillinger for nye servere, [oppbevaring av sikkerhetskopier](/docs/backups/#retention), brukere, innloggingssikkerhet og det offentlige API-et.

Under disse lister sidefeltet opp serverne dine. Åpning av en viser sine egne faner: **Oversikt**, **Konsoll**, **Spillere**, **Mods**, **Verden**, **Sikkerhetskopier**, **Overvåking** og **Innstillinger**, de fleste med relaterte underfaner (for eksempel, **Innstillinger → Konfigurasjon** inneholder serverens innstillinger og spillporten). Se [En enkelt server](/docs/servers/#a-single-server).

Topplinjen har knappen **Opprett en server**, en **temaveksler** (mørk/lys) og **kontomenyen** din, hvor du kan endre profilbildet ditt, administrere [toveis autentisering](/docs/two-factor-authentication/) eller logge ut.

## På en telefon eller nettbrett

Hver side er lagt ut for en smal skjerm først og utvider seg derfra: sidefeltet gjemmer seg bak menyknappen, datatabeller stables til kort, verktøylinjer brytes, og serverkontroll-skinnen kollapser til et kort du åpner når du trenger det. Knapper og brikker har en reell berøringsmål-størrelse. Ingenting er kun for skrivebord.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Dashbord på en telefon" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Serveroversikt på en telefon" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsoll på en telefon" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Mods-fane på en telefon" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Versjonskompatibilitet på en telefon" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Innstillinger på en telefon" width="180">
</p>

## Hva du trenger

Panelet snakker med Docker for å kjøre servere, så det trenger tilgang til en Docker-daemon (Docker Desktop eller en Docker Engine-socket). Når Docker er tilgjengelig, viser Docker-flisen på dashbordet **Tilkoblet** og versjonen. Hvis den ikke er det, kjører panelet fortsatt. Du kan bare ikke starte servere før daemonen er oppe.

## Neste steg

- [Opprett din første server →](/docs/servers/)
- [Sikre kontoen din med 2FA →](/docs/two-factor-authentication/)

---
title: 'Komme i gang'
description: 'Første gang du åpner panelet, blir du bedt om å opprette en administratorkonto.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Tilbake til dokumentindeks](/docs/)

## Første gangs oppsett

Første gang du åpner panelet, blir du bedt om å opprette en administratorkonto. Dette er den eneste kontoen som eksisterer før du legger til flere, og den har full kontroll.

Velg et brukernavn og et passord på minst 8 tegn. Det er alt: du er logget inn og sendt rett til dashbordet.

> **Eksponerte installasjoner er PIN-beskyttet.** Hvis du starter panelet bundet til en ikke-loopback-adresse (`PANEL_HOST` annet enn `127.0.0.1`), ber oppsettsiden også om en **6-sifret PIN-kode**. Panelet skriver den ut til konsollen ved oppstart. Skriv den inn sammen med brukernavnet og passordet ditt. Dette hindrer en fremmed som når porten først fra å kreve administratorkontoen. PIN-koden forsvinner når administratorkontoen eksisterer.

## Innlogging

Etter oppsett er panelet beskyttet av en påloggingsskjerm. Skriv inn brukernavnet og passordet ditt for å fortsette.

![Logg inn](/docs/images/login.png)

Hvis [toveis autentisering](/docs/two-factor-authentication/) er aktivert på kontoen din, blir du bedt om en 6-sifret kode fra autentiseringsappen din rett etter passordet.

## Finn frem

Alt henger fra sidefeltet til venstre:

- **Dashbord** - alle servere på et øyeblikk ([detaljer](/docs/dashboard/)).
- **Servere**, **Modpacks**, **Verdener**, **Blåkopier** - opprett og administrer servere og deres innhold.
- **Oppdateringer**, **Sikkerhetskopier**, **Tidsplaner**, **Lagring**, **Aktivitet** - den operative siden: hva som er utdatert, øyeblikksbildene dine, automatisering, diskbruk og revisjonsloggen.
- **Innstillinger** (nederst): brukere, API-nøkler og panelkonfigurasjon.

Topplinjen har knappen **Opprett en server**, en **tema-veksler** (mørk/lys) og **kontomenyen** din, der du kan administrere [toveis autentisering](/docs/two-factor-authentication/) eller logge ut.

## På en telefon eller nettbrett

Hver side er lagt ut for en smal skjerm først og utvides derfra: sidefeltet gjemmes bak menyknappen, datatabeller stables til kort, verktøylinjer brytes, og verktøylinjen for serverkontroller kollapser til et kort du åpner når du trenger det. Knapper og brikker har en reell berøringsstørrelse. Ingenting er kun for skrivebord.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Dashbord på en telefon" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Serveroversikt på en telefon" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konsoll på en telefon" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Mods-fane på en telefon" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Innstillinger på en telefon" width="180">
</p>

## Hva du trenger

Panelet snakker med Docker for å kjøre servere, så det trenger tilgang til en Docker-daemon (Docker Desktop eller en Docker Engine-socket). Når Docker er tilgjengelig, viser Docker-flisen på dashbordet **Tilkoblet** og versjonen. Hvis den ikke er det, kjører panelet fortsatt. Du kan bare ikke starte servere før daemonen er oppe.

## Neste steg

- [Opprett din første server →](/docs/servers/)
- [Sikre kontoen din med 2FA →](/docs/two-factor-authentication/)

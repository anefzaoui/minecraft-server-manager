---
title: 'Opprette og administrere servere'
description: 'Klikk på Opprett en server (topplinjen) eller kortet Opprett en server for å åpne veiviseren.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Tilbake til dokumentasjonsindeks](/docs/)

## Opprette en server

Klikk **Opprett en server** (øverste felt) eller kortet **Opprett en server** for å åpne veiviseren.

![Opprett en server](/docs/images/create-wizard.png)

Veiviseren forhåndsutfyller feltene for minne, CPU og diskkvote fra **Standardinnstillinger for nye servere** på Innstillinger-siden, som en administrator kan endre når som helst.

![Standardinnstillinger for nye servere](/docs/images/settings-defaults.png)

Du velger:

- Et **navn** (og valgfritt ikon, aksentfarge og tagger for å organisere flåten din).
- En **servertype** - vanilla, Paper, Fabric, Forge, NeoForge og mer, hver koblet til riktig itzg-bilde i bakgrunnen.
- En **Minecraft-versjon** - `LATEST`, en snapshot, eller en spesifikk versjon.
- **Ressurser** - RAM (heap), minnebegrensning for container, CPU og en diskkvote.

Foretrekker du en modpack? Fanen **Fra modpack** installerer en CurseForge, Modrinth, FTB eller GT New Horizons-pakke i stedet (se [Modpacks](/docs/modpacks/)), eller tar en **tilpasset zip du laster opp**: en CurseForge modpack-eksport (`manifest.json`) eller en hvilken som helst zip med mod-filer. Manifestet (eller et flertall av de identifiserte filene) fyller inn lastelagret og Minecraft-versjonen, og hver mod installeres i én oppgave. Du kan også starte fra en lagret [Blueprint](/docs/blueprints/).

Panelet velger automatisk en fornuftig Java-kjøretid for versjonen din, henter bildet, oppretter containeren og (valgfritt) starter den, alt fra ett skjema.

## Serverlisten

**Servere**-siden viser hele flåten din med status og raske statistikker.

![Serverliste](/docs/images/servers-list.png)

## En enkelt server

![Spillere](/docs/images/players.png)

Å åpne en server gir deg et arbeidsområde med faner:

- **Oversikt** - status, sanntidsstatistikk, oppetid og de primære kontrollene for start/stopp/omstart.
- **Konsoll** - sanntidsloggstrømmen og kommandolinjen, pluss chat i spillet ([detaljer](/docs/console-and-chat/)).
- **Spillere** - hvem som er online, pluss inventar, statistikk og [chatkommandoer](/docs/console-and-chat/).
- **Mods** - listen over installerte mods, [mod-leseren](/docs/modpacks/) og innholdsoppdateringer.
- **Verden** - [verdener, sanntidskartet og filbehandleren](/docs/worlds-and-files/).
- **Sikkerhetskopier** - [øyeblikksbilder og gjenoppretting](/docs/backups/) for denne serveren.
- **Overvåking** - historikk per server og sanntidsmålinger, inkludert krasjrapporter (se nedenfor).
- **Innstillinger** - alt om hvordan serveren kjører, pluss [integrasjonene](/docs/integrations/) (Discord, statusside, invitasjoner, chatbot).

![Serveroversikt](/docs/images/server-overview.png)

**Verdenskontroller**-panelet følger med på hver fane: klokken i spillet, været, vanlige spilleregler som vekslebrytere, og "Vis alle verdensregler" for resten.

![Verdenskontroller](/docs/images/world-controls.png)

**Overvåking → Sanntid** viser TPS og millisekunder per tick, et kort for helse og stabilitet med de siste 24 t / 7 d med krasj og omstarter, og størrelser per verden.

![Sanntidsovervåking](/docs/images/monitoring-live.png)

## Serverinnstillinger

**Innstillinger**-fanen er hele konfigurasjonsflaten: gi nytt navn, ressurser, oppdateringspolicy, automatisk start / automatisk omstart, miljøvariabler og avanserte Docker-overstyringer. Felt som endrer hvordan containeren kjører, er tydelig merket som krever en omstart.

![Serverinnstillinger](/docs/images/server-settings.png)

**Om minnemåleren.** "RAM (Java heap)" gis til Java som både start- og maksimal heap, og Java fyller en heap den fikk på forhånd innen det første minuttet, med eller uten Aikar / MeowIce flagg-forhåndsinnstillingene. Så minnemåleren stabiliserer seg på omtrent heap-størrelsen og blir der selv når ingen spiller; hakket på måleren markerer hvor heapen ligger under containergrensen, og merknaden under sier det. Hvis du heller vil se minnet følge reell bruk, sett en mindre **Start-heap** (avansert): på en 2 GB heap som reduserte inaktiv bruk fra 2,6 GB til omtrent 1,3 GB i våre målinger. Java trenger også minne utenfor heapen (omtrent 0,5 GB på vanilla, 1,5 til 2 GB på en stor modpack), som er det containergrensens spillerom er til for. Se READMEs "To minnegrenser" for tallene.

> Avanserte Docker-overstyringsfelter (tilpasset containernavn, ekstra port og bind-monteringer, og rå overstyringer) er **kun for administratorer**, fordi en bind-montering pluss panelets Docker-tilgang er effektivt root på verten. Se [Brukere og roller](/docs/users-and-roles/).

## Krasjrapporter & mclo.gs-analyse

Krasjrapporter (`crash-reports/*.txt` og JVM `hs_err_pid*.log`-filer) plukkes opp automatisk, parses til en oppsummering på én linje med unntaket og mistenkte mods, og listes under **Overvåking → Historikk**:

![Krasjrapportkort](/docs/images/crash-mclogs-card.png)

Hvert rapportkort tilbyr en innebygd seer (med kollapsbare seksjoner og uthevede unntak), kopier-stack-trace, og nedlasting, pluss to [mclo.gs](https://mclo.gs)-handlinger:

- **Del til mclo.gs** publiserer rapporten som en offentlig paste og kopierer lenken - akkurat det mod-forfattere og support Discords ber om. Lenken huskes på rapporten, så ingenting lastes opp to ganger.
- **Analyser** kjører mclo.gs' automatiserte innsikter over pasten: kjente problemer med foreslåtte løsninger (manglende avhengigheter, versjonskonflikter, vanlige mod-konflikter), gjengitt rett i panelet.

![mclo.gs innsikter](/docs/images/crash-insights.png)

Begge handlingene er bak en eksplisitt bekreftelse, fordi en paste er offentlig: krasjrapporter kan inneholde spillernavn og hele mod-listen din. Panelet laster aldri opp noe på egen hånd.

---
title: 'Oprettelse & administration af servere'
description: 'Klik på Opret en server (øverste bjælke) eller på kortet Opret en server for at åbne guiden.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Tilbage til dokumentindeks](/docs/)

## Oprettelse af en server

Klik på **Opret en server** (øverste bjælke) eller på kortet **Opret en server** for at åbne guiden.

![Opret en server](/docs/images/create-wizard.png)

Guiden forudfylder felterne for hukommelse, CPU og diskkvote fra **Standardindstillinger for nye servere** på siden Indstillinger, som en administrator kan ændre når som helst.

![Standardindstillinger for nye servere](/docs/images/settings-defaults.png)

Du vælger:

- Et **navn** (og valgfrit ikon, accentfarve og tags til at organisere din flåde).
- En **servertype** - vanilla, Paper, Fabric, Forge, NeoForge og mere, hver mappet til det rigtige itzg-image bag kulisserne.
- En **Minecraft-version** - `LATEST`, et snapshot eller en specifik version.
- **Ressourcer** - RAM (heap), containerhukommelsesgrænse, CPU og en diskkvote.

Foretrækker du en modpack? Fanen **Fra modpack** installerer en CurseForge, Modrinth, FTB eller GT New Horizons-pakke i stedet (se [Modpacks](/docs/modpacks/)), eller tager en **brugerdefineret zip, du uploader**: en CurseForge modpack-eksport (`manifest.json`) eller enhver zip af mod-jars. Manifestet (eller et flertalsafstemning på tværs af de identificerede jars) udfylder loaderen og Minecraft-versionen, og hver mod installeres i én opgave. Du kan også starte fra en gemt [Blueprint](/docs/blueprints/).

Panelet vælger automatisk en fornuftig Java-runtime til din version, henter imaget, opretter containeren og (valgfrit) starter den, alt sammen fra den ene formular.

## Serverlisten

Siden **Servere** viser din samlede flåde med status og hurtige statistikker.

![Serverliste](/docs/images/servers-list.png)

## En enkelt server

![Spillere](/docs/images/players.png)

Åbning af en server giver dig et arbejdsområde med faner:

- **Oversigt** - status, live-statistikker, oppetid og de primære start/stop/genstart-kontroller.
- **Konsol** - live logstream og kommandoprompt, plus in-game chat ([detaljer](/docs/console-and-chat/)).
- **Spillere** - hvem der er online, plus inventar, statistik og [chatkommandoer](/docs/console-and-chat/).
- **Mods** - den installerede modliste, [modbrowseren](/docs/modpacks/) og indholdsopdateringer.
- **Verden** - [verdener, live-kortet og filhåndteringen](/docs/worlds-and-files/).
- **Sikkerhedskopier** - [snapshots og gendannelse](/docs/backups/) for denne server.
- **Overvågning** - server-specifik historik og live-metrikker, inklusive crash-rapporter (se nedenfor).
- **Indstillinger** - alt om, hvordan serveren kører, plus [integrationerne](/docs/integrations/) (Discord, status-side, invitationer, chatbot).

![Serveroversigt](/docs/images/server-overview.png)

**Verdenkontrollerne** glider med på hver fane: in-game ur, vejr, de almindelige gamerules som toggle-chips og "Vis alle verdensregler" for resten.

![Verdenkontroller](/docs/images/world-controls.png)

**Overvågning → Live** viser TPS og millisekunder pr. tick, et sundheds- og stabilitetskort med de sidste 24 timer / 7 dage med crashes og genstarter, og størrelser pr. verden.

![Live-overvågning](/docs/images/monitoring-live.png)

## Serverindstillinger

Fanen **Indstillinger** er den fulde konfigurationsflade: omdøb, ressourcer, opdateringspolitik, auto-start / auto-genstart, miljøvariabler og avancerede Docker-overrides. Felter, der ændrer, hvordan containeren kører, er tydeligt markeret som krævende en genstart.

![Serverindstillinger](/docs/images/server-settings.png)

**Om hukommelsesmåleren.** "RAM (Java heap)" gives til Java som både dens start- og dens maksimale heap, og Java fylder en heap, den fik givet på forhånd inden for det første minut, med eller uden Aikar / MeowIce flag-forudindstillingerne. Så hukommelsesmåleren falder til omkring heap-størrelsen og forbliver der, selv når ingen spiller; ticken på måleren markerer, hvor heapen sidder under containergrænsen, og noten under den siger det. Hvis du hellere vil se hukommelsen følge reel brug, skal du indstille en mindre **Initial heap** (avanceret): på en 2 GB heap, der bragte inaktiv brug fra 2,6 GB til omkring 1,3 GB i vores målinger. Java har også brug for hukommelse uden for heapen (ca. 0,5 GB på vanilla, 1,5 til 2 GB på en stor modpack), hvilket er, hvad containergrænsens headroom er til. Se README'ens "To hukommelsesgrænser" for tallene.

> Avancerede Docker-override-felter (brugerdefineret containernavn, ekstra port- og bind-mounts, og rå overrides) er **kun for administratorer**, fordi et bind-mount plus panelets Docker-adgang effektivt er root på hosten. Se [Brugere & roller](/docs/users-and-roles/).

## Crash-rapporter & mclo.gs-analyse

Crash-rapporter (`crash-reports/*.txt` og JVM `hs_err_pid*.log` filer) opsamles automatisk, parses til en et-linjes opsummering med undtagelsen og formodede mods, og listes under **Overvågning → Historik**:

![Crash-rapportkort](/docs/images/crash-mclogs-card.png)

Hvert rapportkort tilbyder en indbygget viewer (med kollapsbare sektioner og fremhævede undtagelser), kopier-stack-trace og download, plus to [mclo.gs](https://mclo.gs) handlinger:

- **Del til mclo.gs** udgiver rapporten som en offentlig paste og kopierer linket - præcis det, mod-forfattere og support Discords beder om. Linket huskes på rapporten, så intet nogensinde uploades to gange.
- **Analyser** kører mclo.gs's automatiserede indsigter over pasten: kendte problemer med foreslåede løsninger (manglende afhængigheder, versionskonflikter, almindelige mod-konflikter), vist direkte i panelet.

![mclo.gs-indsigter](/docs/images/crash-insights.png)

Begge handlinger er bag en eksplicit bekræftelse, fordi en paste er offentlig: crash-rapporter kan indeholde spillernavne og din fulde modliste. Panelet uploader aldrig noget af sig selv.

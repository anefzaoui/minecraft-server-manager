---
title: 'Oprettelse og administration af servere'
description: 'Opret, start, stop, genopbyg og konfigurer Minecraft-servere i panelet: oprettelsesguiden, indstillinger, hukommelse og spilporten.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/servers.md'
---

[← Tilbage til dokumentindeks](/docs/)

## Oprettelse af en server

Klik på **Opret en server** (øverste bjælke) eller på **Opret en server**-kortet for at åbne guiden.

![Opret en server](/docs/images/create-wizard.png)

Guiden forudfylder Java heap og diskkvote fra **Standardindstillinger for nye servere** på Indstillinger-siden, som en administrator kan ændre når som helst. En ny server får sin CPU-grænse derfra også.

![Standardindstillinger for nye servere](/docs/images/settings-defaults.png)

Du vælger:

- Et **navn** (og en valgfri beskrivelse, ikon og accentfarve). Tags til at organisere din flåde tilføjes senere, på serverens indstillinger.
- En **servertype**: Vanilla, Paper eller Purpur på fanen **Vanilla**. For en modded server vælger fanen **Fra mods** loaderen (Fabric, Forge, NeoForge eller Quilt), Minecraft-versionen og en loader-build (den seneste eller en specifik), og lader dig derefter søge efter mods.
- En **Minecraft-version**: `LATEST`, en snapshot eller en specifik version (betaer og alfaer inkluderet).
- En **spilport**: en ledig port foreslås. Fjernkonsollen (RCON) bruger porten 1000 højere (som standard). Du kan ændre den senere (se [Ændring af spilporten](#changing-the-game-port)).
- **Ressourcer**: Java heap (containerens hukommelsesgrænse sættes 50% højere) og en diskkvote.

**Avancerede indstillinger** åbner alle andre indstillinger, som serverbilledet understøtter, plus ekstra miljøvariabler og (for administratorer) de avancerede Docker-indstillinger.

Foretrækker du en modpack? Fanen **Fra modpack** installerer en CurseForge, Modrinth eller GT New Horizons pack i stedet (se [Modpacks](/docs/modpacks/)), eller tager en **brugerdefineret zip, du uploader**: en Modrinth `.mrpack`, en CurseForge modpack-eksport (`manifest.json`), eller enhver zip med mod-filer. Manifestet (eller et flertalsafstemning på tværs af de identificerede filer) udfylder loaderen og Minecraft-versionen, og hver mod installeres i én opgave. Du kan også starte fra en gemt [Blueprint](/docs/blueprints/) på fanen **Fra blueprint**.

Panelet vælger automatisk en fornuftig Java-runtime til din version, henter billedet, opretter containeren og starter den, alt sammen fra den ene formular.

## Serverlisten

**Servere**-siden viser din samlede flåde med status og hurtige statistikker.

![Serverliste](/docs/images/servers-list.png)

## En enkelt server

![Spillere](/docs/images/players.png)

Åbning af en server giver dig et fanebaseret arbejdsområde:

- **Oversigt**: adressen at dele med spillere, beskrivelsen, live forbrug og hvem der er online.
- **Konsol**: live logstream og kommandoinput, in-game chat og [chatkommandoer](/docs/console-and-chat/).
- **Spillere**: listen over spillere, plus inventar og statistik.
- **Mods**: listen over installerede mods, [modbrowseren](/docs/modpacks/) og indholdsopdateringer. På en modded server tjekker dens underfane **Versioner** hvilke fremtidige Minecraft-versioner dine mods har builds til ([opdateringer](/docs/updates/#minecraft-version-compatibility)).
- **Verden**: [verdener, livekortet og filhåndteringen](/docs/worlds-and-files/).
- **Sikkerhedskopier**: [snapshots og gendannelse](/docs/backups/) for denne server.
- **Overvågning**: server-specifik historik og live-målinger, inklusive crash-rapporter (se nedenfor).
- **Indstillinger**: **Konfiguration** (alt om hvordan serveren kører), plus [integrationerne](/docs/integrations/) (Discord, Status Side, Invites og, for administratorer, Chatbot).

Start-, stop- og genstartskontrollerne sidder i headeren over hver fane. Hvad du kan gøre på hver fane afhænger af dine [tilladelser på den server](/docs/users-and-roles/#per-server-permissions): for eksempel kræver underfanen **Filer** filtilladelsen, og afsendelse af konsolkommandoer kræver Konsol.

![Serveroversigt](/docs/images/server-overview.png)

**Verdenkontrollerne**-bjælken kører med på hver fane: in-game uret, vejret, de almindelige gamerules som toggle-chips, og "Vis alle verdensregler" for resten.

![Verdenkontroller](/docs/images/world-controls.png)

**Overvågning → Live** viser TPS og millisekunder per tick, et sundheds- og stabilitetskort med crashes (sidste 24 timer og 7 dage), out-of-memory kills og auto-genstarter, og størrelser per verden.

![Live overvågning](/docs/images/monitoring-live.png)

## Serverindstillinger

**Indstillinger → Konfiguration** er den fulde konfigurationsflade: navn, beskrivelse, MOTD, ikon, farve og tags, ressourcer, spilporten, opdateringspolitik, start ved panelopstart og auto-genstart ved crash, alle miljøvariabler serverbilledet understøtter, de avancerede Docker-indstillinger, og blueprint-eksport, kloning, genopbygning og sletning. Ændringer, der kun træder i kraft, når serveren er genopbygget, gemmes med det samme og venter: en **Anvend ændringer**-knap vises i serverens header, og de anvendes også næste gang serveren starter.

**Auto-genstart ved crash** starter en crashet server igen, venter længere mellem hvert forsøg (5, 10, derefter 20 sekunder) og stopper efter 3 forsøg inden for 10 minutter. Den springer crashes over, som panelet genkender som et opsætningsproblem (EULA, forkert Java, en verden fra en nyere version, en port i brug, out-of-memory, en manglende CurseForge-nøgle), fordi disse kræver en løsning først. Hvis en anden handling er optaget med serveren (en backup, en gendannelse, en portændring), venter den op til 30 minutter, og den giver op, så snart nogen stopper eller starter serveren selv.

Direkte ændringer af indstillinger forbliver altid gyldige på tværs af genstarter. En PvP- eller sværhedsgradsændring foretaget med **Verdenkontrollerne**-bjælken, en whitelist-toggle på **Spillere**-fanen, eller en `server.properties`-redigering i **Filer**-editoren fjerner den tilsvarende miljøvariabel (hvis en var sat) og markerer serveren til genopbygning, så værdien på disken vinder i stedet for at blive genanvendt af containerbilledet ved næste start.

![Serverindstillinger](/docs/images/server-settings.png)

**Om hukommelsesmåleren.** "RAM (Java heap)" gives til Java som både dens start- og maksimale heap, og Java fylder en heap, den fik tildelt på forhånd inden for det første minut, med eller uden Aikar / MeowIce flag-forudindstillingerne. Så hukommelsesmåleren falder til omkring heap-størrelsen og forbliver der, selv når ingen spiller; ticken på måleren markerer, hvor heapen ligger under containergrænsen, og noten under den siger det. Hvis du hellere vil se hukommelsen følge reel brug, giv serveren en mindre start heap med **Initial heap** i Ressourcer-kortet på **Indstillinger → Konfiguration** (eller under **Avancerede indstillinger** i guiden), for eksempel 512 MB: på en 2 GB heap reducerede det inaktiv brug fra 2,6 GB til omkring 1,3 GB i vores målinger. Java har også brug for hukommelse uden for heapen (ca. 0,5 GB på vanilla, 1,5 til 2 GB på en stor modpack), hvilket er hvad containergrænsens headroom er til. Se README'ens "To hukommelsesgrænser" for tallene.

> **Avancerede Docker-indstillinger** (containernavn, Docker-netværk, ekstra portmappinger og ekstra volumenbindinger) er **kun for administratorer**, fordi en bind mount plus panelets Docker-adgang effektivt er root på hosten. Se [Brugere & roller](/docs/users-and-roles/).

### Ændring af spilporten

**Spilport**-kortet på **Indstillinger → Konfiguration** flytter en server til en anden port når som helst, med sin egen **Gem port**-knap. **Brug næste ledige port** vælger den laveste ledige, og kortet tjekker enhver port, du indtaster, før du gemmer den. RCON følger altid 1000 over spilporten (standardforskydningen). Administratorer kan vælge enhver port fra 1024 og op; alle andre vælger fra den første spilport (25565 som standard) og op. Gemning anvender ændringen med det samme: en stoppet server flyttes bare, og en kørende server spørger først, og genstarter derefter på den nye port (verdenen gemmes først, og spillere genopretter forbindelsen på den nye port). Hvis serveren ikke kan starte på den nye port, vender den tilbage til den gamle. Ændringen nægtes, mens andre ændringer venter på **Anvend ændringer**, så anvend dem først. Ændring af porten kræver Indstillinger-tilladelsen på den pågældende server.

![Spilport-kortet](/docs/images/server-port.png)

![Prompten før en kørende server genstarter på sin nye port](/docs/images/port-restart.png)

## Crash-rapporter & mclo.gs analyse

Crash-rapporter (`crash-reports/*.txt` og JVM `hs_err_pid*.log` filer) opsamles automatisk, parses til en et-linjers opsummering med undtagelsen og formodede mods, og listes under **Overvågning → Historik**:

![Crash-rapport-kort](/docs/images/crash-mclogs-card.png)

Hvert rapportkort tilbyder en indbygget seer (med kollapsbare sektioner og fremhævede undtagelser), kopier-stack-trace og download, plus to [mclo.gs](https://mclo.gs) handlinger:

- **Del til mclo.gs** udgiver rapporten som en offentlig paste og kopierer linket: præcis hvad mod-forfattere og support Discords beder om. Linket huskes på rapporten, så intet uploades nogensinde to gange.
- **Analyser** kører mclo.gs's automatiserede indsigt over pasten: kendte problemer med foreslåede løsninger (manglende afhængigheder, versionskonflikter, almindelige mod-konflikter), vist direkte i panelet.

![mclo.gs indsigt](/docs/images/crash-insights.png)

Begge handlinger er bag en eksplicit bekræftelse, fordi en paste er offentlig: crash-rapporter kan indeholde spillernavne og din fulde mod-liste. Panelet uploader aldrig noget af sig selv.

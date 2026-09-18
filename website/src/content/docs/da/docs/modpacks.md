---
title: 'Modpacks'
description: 'Modpacks-siden (og fanen "Fra modpack" i oprettelsesguiden) installerer en modpack som en server, altid fastgjort til en præcis pakkeversion, så en genstart kan'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Modpacks**-siden (og fanen **Fra modpack** i [oprettelsesguiden](/docs/servers/)) installerer en modpack som en server, altid **fastgjort til en præcis pakkeversion**, så en genstart aldrig lydløst kan opgradere pakken under dig.

![Modpacks](/docs/images/modpacks.png)

## Understøttede platforme

- **CurseForge** - søg eller indsæt en pakke-URL. Kræver en CurseForge API-nøgle til søgning og private pakker (tilføj den under Indstillinger → API-nøgler).
- **Modrinth** - søg efter navn.
- **FTB** - Feed The Beast-pakker.
- **GT New Horizons** - 1.7.10-ekspertpakken, installeret fra GTNH's egen udgivelsesindeks. GTNH vælger sin Java-runtime pr. pakkeversion (2.8.0+ kører på **Java 25** via bundtede lwjgl3ify-patches, ældre udgivelser på Java 21 eller 17), og guiden øger serverens RAM og disk til fornuftige minimumsgrænser for den.
- **Brugerdefineret zip** - slet ikke en udgivet pakke: upload en **CurseForge modpack-eksport** (zip-filen med `manifest.json`, som CurseForge-appen producerer for et håndplukket mod-sæt) eller **enhver zip-fil med mod-jars**. Panelet løser manifestet i bulk via CurseForge API'en (eller identificerer hver jar efter hash/fingeraftryk/metadata), forhåndsviser hvad der passer, og installerer alt i én opgave - inklusive pakkens `overrides/` konfigurationer, hvis du vælger det. Mods, hvis forfattere forbyder automatiske downloads, vises med et browserlink og en manuel upload-plads i stedet for at fejle installationen.

## Sådan fungerer fastgørelse

Når du vælger en pakke, løser panelet den præcise version, registrerer den og installerer den. På **Opdateringer**-siden får du besked, når en nyere version er tilgængelig; opgradering er en bevidst, beskyttet handling med en sikkerhedskopi før opdatering og tilbagerulning. Server, der følger stabile versioner, tilbydes aldrig en beta.

Servere oprettet på meget gamle panelversioner (før 0.9.7) kunne efterlades _ikke-fastgjorte_, hvilket betyder, at containerbilledet stille og roligt ville installere den nyeste pakkeversion ved hver start. Panelet reparerer nu disse ved opstart: det låser hver enkelt til den version, der rent faktisk er installeret (læst fra panelets egne optegnelser eller billedets installationsmanifest, aldrig en nyopløst "seneste") og logger en hændelse. Hvis det ikke kan afgøre, hvad der er installeret, viser serverens Indstillinger-side en advarsel, der beder dig om at vælge versionen manuelt, og ethvert forsøg på at gemme en ikke-fastgjort modpack-konfiguration afvises blankt.

## Opdateringspolitik

Hver server har en opdateringspolitik i **Indstillinger**, og alle tre muligheder betyder, hvad de siger:

- **Kun manuelt** - intet ændrer sig nogensinde af sig selv, og serveren udelades helt fra opdateringsmærket og Opdateringer-siden. "Lad mig være"-tilstanden: ideel til en manuelt finjusteret eller importeret pakke, du aldrig vil have rørt.
- **Giv mig besked** (standard) - det daglige tjek viser tilgængelige opdateringer som et mærke og på Opdateringer-siden; anvendelse af dem er altid dit klik.
- **Automatisk opdatering** - efter det planlagte daglige tjek anvendes ventende **pakke**-opdateringer gennem den samme beskyttede vej som en manuel opgradering: sikkerhedskopi før opdatering, sundhedsovervågning og en automatisk tilbagerulning, hvis den nye version fejler ved opstart. Opdateringer, der ville flytte serveren til en anden Minecraft-version, springes altid over med en hændelse i stedet - konvertering af en verden permanent er en beslutning, panelet nægter at træffe for dig. De manuelle "tjek nu"-knapper tjekker kun; de udløser aldrig automatiske opdateringer.

## Opgradering af en pakke

Fra en fastgjort server kan du opgradere til en nyere version i én handling. Panelet tager først en sikkerhedskopi, skifter den fastgjorte version, genskaber containeren (genopløser Java, hvis den nye version kræver en anden runtime) og overvåger den første opstart, med et generøst vindue for store pakker som GTNH, der downloader et par gigabyte og bygger en verden med flere hundrede mods ved første start.

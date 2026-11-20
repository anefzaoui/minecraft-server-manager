---
title: 'Modpacks'
description: 'Installer CurseForge, Modrinth, FTB og GT New Horizons modpacks som servere, altid fastgjort til en præcis pack-version.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Modpacks**-siden (og fanen **Fra Modpack** i [oprettelsesguiden](/docs/servers/)) installerer en modpack som en server, altid **fastgjort til en præcis pakkeversion**, så en genstart aldrig lydløst kan opgradere pakken under dig.

![Modpacks](/docs/images/modpacks.png)

## Understøttede platforme

- **CurseForge**: søg efter navn. Kræver en CurseForge API-nøgle (tilføj den under **Indstillinger → API-nøgler**).
- **Modrinth**: søg efter navn.
- **FTB**: Feed The Beast-pakker, kun via API'en (et numerisk pakke-ID plus et eksplicit versions-ID). Panelet tjekker endnu ikke FTB-pakker for opdateringer.
- **GT New Horizons**: 1.7.10 ekspertpakken, installeret fra GTNH's egen udgivelsesindeks. GTNH vælger sin Java-runtime pr. pakkeversion (2.8.0+ kører på **Java 25** via bundtede lwjgl3ify-patches, ældre udgivelser på Java 21 eller 17), og guiden øger serverens RAM og disk til fornuftige minimumskrav for den.
- **Brugerdefineret zip**: slet ikke en udgivet pakke. Upload en **CurseForge modpack-eksport** (zip-filen med `manifest.json`, som CurseForge's app producerer for et håndplukket sæt mods), en **Modrinth `.mrpack`**, eller **enhver zip med mod-filer**. Panelet behandler manifestet i bulk (eller identificerer hver mod-fil efter hash/fingeraftryk/metadata), forhåndsviser hvad der passer, og installerer alt i én opgave, inklusive pakkens `overrides/` konfigurationer, hvis du vælger det. Mods, hvis forfattere forbyder automatiske downloads, vises med et browserlink og en manuel upload-plads i stedet for at fejle installationen.

## Sådan fungerer fastgørelse

Når du vælger en pakke, finder panelet den præcise version, registrerer den og installerer den. På siden **Opdateringer** får du besked, når en nyere version er tilgængelig (medmindre serverens [opdateringspolitik](#update-policy) er **Kun Manuel**); opgradering er en bevidst, beskyttet handling med en backup før opdatering og rollback. Server med stabil sporing får aldrig tilbudt en beta. En servers egen fane **Versioner** besvarer den anden halvdel af spørgsmålet: hvilke fremtidige Minecraft-versioner mod'ene, den rent faktisk har, kan følge ([opdateringer](/docs/updates/#minecraft-version-compatibility)).

Mod loader-versionen følger også med pakken: serveren installerer den Forge-, NeoForge- eller Fabric-build, som pakken erklærer. Hvis en Forge- eller Fabric CurseForge-pakke erklærer en, der er for gammel til dens egne mods, kan fanen **Versioner** tilsidesætte den, indtil pakken er rettet; en pakkeopdatering fjerner tilsidesættelsen, da den nye version erklærer sin egen ([ændring af mod loader-versionen](/docs/updates/#changing-the-mod-loader-version)).

Servere oprettet på meget gamle panelversioner (før 0.9.7) kunne efterlades _ikke-fastgjorte_, hvilket betyder, at containerbilledet stille og roligt ville installere den nyeste pakkeversion ved hver start. Panelet reparerer nu disse ved opstart: det låser hver enkelt til den version, der rent faktisk er installeret (læst fra panelets egne optegnelser eller billedets installationsmanifest, aldrig en nyopløst "seneste") og logger en hændelse. Hvis det ikke kan afgøre, hvad der er installeret, viser serverens Indstillinger-side en advarsel med en knap **Vælg en version…** (CurseForge, Modrinth og GTNH-pakker), der åbner [versionsvælgeren](#changing-the-pack-version), og ethvert forsøg på at gemme en ikke-fastgjort modpack-konfiguration afvises straks.

## Opdateringspolitik

Hver server har et **Opdateringspolitik**-kort på sin fane **Indstillinger → Konfiguration**, og alle tre muligheder betyder, hvad de siger:

- **Kun Manuel** (standard): intet ændrer sig af sig selv, og serveren udelades helt fra opdateringsmærket og Opdateringer-siden. "Lad mig være"-tilstanden: ideel til en manuelt finjusteret eller importeret pakke, du aldrig vil have rørt. Den låser ikke versionen: [**Skift version…**](#changing-the-pack-version) virker under enhver politik. For at blive informeret om nye versioner og anvende dem med et enkelt klik, vælg **Giv mig besked**.
- **Giv mig besked**: den daglige kontrol viser tilgængelige opdateringer som et mærke og på Opdateringer-siden; anvendelse af dem er altid dit klik.
- **Auto-opdatering**: efter den planlagte daglige kontrol anvendes ventende **pakke**-opdateringer via den samme beskyttede sti som en manuel opgradering: backup før opdatering, sundhedsovervågning og en automatisk rollback, hvis den nye version fejler ved opstart. Opdateringer, der ville flytte serveren til en anden Minecraft-version, springes altid over med en hændelse i stedet: konvertering af en verden permanent er en beslutning, panelet nægter at træffe for dig. De manuelle **Tjek nu**-knapper tjekker kun; de udløser aldrig auto-opdateringer.

## Opgradering af en pakke

Fra en fastgjort server kan du opgradere til en nyere version i én handling. Panelet tager først en backup, skifter den fastgjorte version, genopbygger serveren (genopløser Java, hvis den nye version kræver en anden runtime) og overvåger den første opstart, med et generøst vindue for store pakker som GTNH, der downloader et par gigabyte og bygger en verden med flere hundrede mods ved første start.

## Ændring af pakkeversion

For at køre en specifik version, nyere eller ældre, skal du bruge **Skift version…** på pakke-kortet på serverens **Oversigt**-fane. På siden **Modpacks** giver åbning af et installeret pakkes kort det samme valg: vælg en version i rullemenuen og klik **Skift til denne version**. Begge kræver serverens **Indhold**-tilladelse, og begge er tilgængelige for CurseForge, Modrinth og GTNH-pakker (FTB-pakker har endnu ingen versionsliste). Listen viser de 25 nyeste versioner for CurseForge og Modrinth, og hver GTNH-udgivelse.

Skiftet går gennem den samme beskyttede sti som en opgradering: en backup før opdatering, den nye fastgørelse, en genopbygning og en overvåget første opstart, med en et-klik rollback, hvis serveren ikke starter sundt. Dine brugerdefinerede mods medfølger, ligesom de pakke-mods, du har deaktiveret, sammen med pakkens andre installationsindstillinger (tvungne mods, filer der skal ignoreres, ekstra projekter). Installation af en anden pakke starter disse indstillinger forfra, da de kun giver mening for den pakke, de blev lavet til.

Hver version vises med den Minecraft-version, den kører, sammenlignet med den version, din verden sidst blev gemt med:

- **Samme Minecraft-version**: skift efter en normal bekræftelse. At gå tilbage til en ældre pakkeversion kan fjerne blokke og genstande fra mods, som den version ikke har, så backup'en forbliver i Backup-fanen uanset hvad.
- **Nyere Minecraft-version**: tilladt efter en bekræftelse, der advarer om, at verden konverteres permanent. Backup'en, der tages først, er den eneste vej tilbage til den gamle verden.
- **Ældre Minecraft-version**: utilgængelig. Minecraft kan ikke indlæse en verden på en ældre version end den, der sidst gemte den, så panelet nægter i stedet for at efterlade en server, der crasher ved opstart.

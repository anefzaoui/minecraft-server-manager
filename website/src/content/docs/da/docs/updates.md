---
title: 'Opdateringer'
description: 'Følg og anvend opdateringer til Minecraft-versioner, modpacks, mods og plugins på tværs af alle servere, med en politik pr. server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Opdateringer**-siden sporer, hvad der er forældet på tværs af din flåde ét sted:

- **Modpack**-versioner ([modpacks](/docs/modpacks/)) mod Modrinth / CurseForge / GTNH-udgivelsesindekset.
- **Brugerdefineret indhold**, du selv har tilføjet (mods, datapacks, resource packs, plugins), hver mod sin kilde: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) eller GitHub Releases. GitHub-opslag bruger ETag-genvalidering, så daglige tjek knap nok rører dets rate limit.
- **Docker image**-forældelse: Hvert server-containers image ID mod et frisk-hentet tag (dedupliceret på tværs af servere med samme tag), tilbudt som en opgradering, der kun kræver genopbygning.
- **Standalone version pins**: For en server uden en administreret pakke, en eksplicit `mc_version` pin mod Mojangs manifest, og en eksplicit loader-build env var (`PAPER_BUILD`, `FORGE_VERSION` og lignende) mod loaderens register. Paper builds kommer fra PaperMC's nuværende **Fill v3 API** (den ældre v2-endpoint stoppede med at modtage nye Minecraft-versioner). På en server med mods tilbydes en nyere Minecraft-version kun, når en [versionskontrol](#minecraft-version-compatibility) har vist, at hver installeret mod har en build til den. En pinned Forge-server tilbydes Forge's anbefalede build, aldrig en build ældre end den, den er pinned til, og en server pinned til en udgivelse tilbydes aldrig en pre-release (en, der allerede er på en beta, kan tilbydes en nyere beta eller udgivelsen). Anvendelse af en loader-build tager først en pre-update backup. Flytning af en Forge- eller NeoForge-server til en ny Minecraft-version rydder dens pinned loader-build-nummer, da en build laves til én Minecraft-version; et nøgleord som `latest` beholdes, da det følger versionen af sig selv. For at vælge en specifik build selv, se [ændring af mod loader-versionen](#changing-the-mod-loader-version).

![Opdateringer](/docs/images/updates.png)

## Sådan virker det

Panelet tjekker hver servers pinned versioner mod kilden og lister alt med en nyere udgivelse. Et matchende antal vises også på [dashboardets](/docs/dashboard/) "Opdateringer tilgængelige"-flise.

Tjek kører dagligt på en standard [plan](/docs/schedules/) og on-demand med **Tjek Alle Nu**. **Ignorer** på en række stopper med at tilbyde den pågældende version; en nyere tilbydes igen. Opdaterings**politik** er pr. server: panelet lader alt være manuelt (standard, hvilket også holder serveren ude af denne side), giver dig blot besked, eller anvender pakkeopdateringer selv ([opdateringspolitik](/docs/modpacks/#update-policy)).

## Minecraft-versionskompatibilitet

En nyere Minecraft-version er ikke en opgradering, hvis dine mods ikke kan følge med. Hver server har sin egen **Versioner**-fane (under Mods), der besvarer det spørgsmål:

- Den version serveren kører nu, og den **højeste version, hver installeret mod har en build til**.
- Én kollapsbar række pr. fremtidig Minecraft-version, med hvor mange mods der er klar, og hvor mange der intet har udgivet endnu. Åbn en række for at se, hvilke mods der ville blive efterladt, og hvilke der er fine.

![Versionskompatibilitet](/docs/images/server-versions.png)

Tryk på **Tjek Fremtidige Versioner** for at køre den. Intet scanner af sig selv: et tjek læser hver jar i serverens mods-mappe og spørger Modrinth og CurseForge om hver enkelt, så det sker kun, når du beder om det. Fremskridt og delvise resultater skrives, mens det kører, så lukning af siden eller genopfriskning mister intet, og et tjek afbrudt af en panelgenstart siger det og tilbyder at køre igen. Alt, hvad et afbrudt tjek allerede havde fundet ud af, gemmes, så en ny kørsel gentager ikke det arbejde.

En rapport beskriver kun den server, den blev lavet til. Ændr Minecraft-versionen, loaderen eller selve modsene (tilføj en, fjern en, opdater en), og rapporten markeres som forældet og stopper med at blive brugt, indtil du kører tjekket igen.

Mods identificeres ud fra modpackens egen fil-liste, hvor der er en, og ellers ud fra filens indhold, på samme måde som en launcher genkender en jar. To typer mods kan ikke besvares for, og ingen af dem gættes på:

- **Kunne ikke identificeres**: en håndbygget jar eller en privat build, som ingen af registre genkender.
- **Kunne ikke tjekkes**: en mod fra GitHub Releases, Hangar eller SpigotMC, eller en, hvis projekt er blevet fjernet. Disse udgiver ingen liste over, hvilken Minecraft-version hver build er til.

Mens en af dem er installeret, tilbyder panelet slet ikke en et-klik Minecraft-versionsopdatering, fordi det ikke ærligt kan sige, hvad der ville gå i stykker. Anvendelse af en version over det, mods understøtter, nægtes, og navngiver de mods, der blokerer den.

Mods, du har **deaktiveret**, deltager ikke: serveren indlæser dem ikke, så at slukke en mod er en reel måde at komme forbi en blokerer. At tænde eller slukke en mod markerer rapporten til gen-tjek.

Dette dækker servere, der kører mods: Fabric, Forge, NeoForge og Quilt. Paper-stil plugin-servere beholder den almindelige nyeste-udgivelsesadfærd og har ingen Versioner-fane, fordi to af registre, plugins kommer fra, intet udgiver, som et tjek kan læse.

![En version åbnet, der viser, hvilke mods der ville blive efterladt](/docs/images/server-versions-expanded.png)

Åbning af en version lister først mods uden en build til den (dem, der bestemmer svaret) og holder de klar-mods bag et klik. Store packs indlæser en side med mods ad gangen, så en 300-mod server åbner lige så hurtigt som en fem-mod en.

## Ændring af mod loader-versionen

**Versioner**-fanen har også et **Loader Version**-kort. Det viser, hvilken Forge, NeoForge, Fabric eller Quilt build serveren har installeret, og hvor den kan ændres, en vælger til at skifte til en anden.

- **En Forge, NeoForge, Fabric eller Quilt server** kan køre enhver udgivet build. Vælgeren viser de seneste builds til serverens Minecraft-version, med Forge's anbefalede og seneste builds mærket. **Anden Build…** tager enhver ældre med dens nummer, og **Standard** går tilbage til at lade serveren vælge.
- **En Forge- eller Fabric CurseForge modpack** installerer loader-versionen, dens egen manifest erklærer, så den sædvanlige måde at ændre den på er at opdatere pakken. Når selve pakken viser den forkerte version (en mod indeni beder om en nyere Forge, end pakken installerer), kan kortet tilsidesætte den, og **Modpackens Version** fjerner tilsidesættelsen igen. Opdatering af pakken fjerner den også, fordi den nye version erklærer sin egen loader. Hvis den nye version stadig viser den forkerte, indstil tilsidesættelsen igen.
- **En NeoForge CurseForge modpack eller en Modrinth modpack** viser sin loader, men kan ikke tilsidesættes: server-imaget anvender kun tilsidesættelsen på Forge- og Fabric-pakker. Dens loader følger pakkeversionen, så opdater pakken i stedet. En FTB-pakkes loader kan heller ikke ændres her. Dens kort vises normalt ikke, fordi FTB's egen installer gemmer optegnelser, som panelet ikke læser.

Panelet tjekker, at build'en eksisterer, før det beder dig om noget. En Forge- eller NeoForge-build laves til én Minecraft-version, så på en server, der følger den nyeste udgivelse, holder fastgørelse af en også serveren på den Minecraft-version, den kører nu (bekræftelsen siger det). Valg af **Standard** bagefter fjerner pinden, men beholder den Minecraft-version. En server, der fulgte den nyeste udgivelse, kan også flytte til et andet Java-image, når den genbygges, den version, den har brug for. En sådan server, der aldrig er startet, bliver bedt om at starte én gang først, så panelet kender den version. Forge springer build-numre over (der er ingen 47.4.14 mellem 47.4.13 og 47.4.15), så en mod, der "kræver 47.4.14 eller over", er tilfredsstillet af den næste build op, og afvisningen navngiver den. En ændring tager en pre-update backup, derefter genopbygger serveren. Den nye build installeres næste gang serveren starter, og kortet siger det indtil da.

## Fortrydelse af en mod-opdatering

Hver build, en mod opdateres fra, forbliver i det delte bibliotek, så en opdatering, der bryder noget, kan fortrydes. Mod'ens række på **Mods**-fanen får en **Fortryd**-knap, der sætter den forrige build tilbage. Der er ingen download, så det virker, selvom projektet siden er blevet fjernet fra sit register. Den build, du fortryder væk fra, stopper med at blive tilbudt, indtil en nyere dukker op.

![Fortryd en mod til den build, den blev opdateret fra](/docs/images/mods-revert.png)

## Anvendelse af en opdatering

Opdateringer er aldrig lydløse. Når du vælger at opgradere en pakke (eller [skifte den til en anden version](/docs/modpacks/#changing-the-pack-version), inklusive ældre), gør panelet følgende:

1. Tager en **pre-update backup** (så den kan fortrydes; som standard gemmes de sidste 10 pre-update backups pr. server, se [retention](/docs/backups/#retention)).
2. Gen-pinner den nøjagtige nye version.
3. Genopbygger serveren, genopløser Java-runtime om nødvendigt.
4. Overvåger den første opstart med et tidsbudget pr. platform.

Hvis den ikke starter sundt, ruller du tilbage til pre-update backup'en. En server, der følger stabile udgivelser, tilbydes aldrig en beta, og changelog-linket peger på den faktiske per-version diff, hvor kilden leverer en. En fejlslagen opdatering udløser også en Discord [alarm](/docs/integrations/), hvis integrationen er konfigureret.

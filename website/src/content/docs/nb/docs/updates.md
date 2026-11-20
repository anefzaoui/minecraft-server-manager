---
title: 'Oppdateringer'
description: 'Spor og installer oppdateringer for Minecraft-versjoner, modpacks, mods og plugins på tvers av alle servere, med en policy per server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Tilbake til dokumentindeks](/docs/)

**Oppdateringer**-siden sporer hva som er utdatert på tvers av flåten din på ett sted:

- **Modpack**-versjoner ([modpacks](/docs/modpacks/)) mot Modrinth / CurseForge / GTNH-utgivelsesindeksen.
- **Egendefinert innhold** du har lagt til selv (mods, datapacks, ressurshåndteringspakker, plugins), hver mot sin kilde: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) eller GitHub Releases. GitHub-oppslag bruker ETag-revalidering, så daglige kontroller berører knapt rate-grensen.
- **Docker image**-foreldelse: Hvert server-containers image ID mot en nylig hentet tagg (deduplikert på tvers av servere med samme tagg), tilbudt som en oppgradering som kun krever gjenoppbygging.
- **Standalone versjonsfester**: for en server uten administrert pakke, en eksplisitt `mc_version`-fest mot Mojangs manifest, og en eksplisitt loader-build miljøvariabel (`PAPER_BUILD`, `FORGE_VERSION`, og lignende) mot loaderens register. Paper-builds kommer fra PaperMC's nåværende **Fill v3 API** (den eldre v2-endepunktet sluttet å motta nye Minecraft-versjoner). På en server med mods tilbys en nyere Minecraft-versjon kun når en [versjonskontroll](#minecraft-version-compatibility) har vist at hver installerte mod har en build for den. En festet Forge-server tilbys Forge's anbefalte build, aldri en build eldre enn den den er festet til, og en server festet til en utgivelse tilbys aldri en forhåndsutgivelse (en som allerede er på en beta kan tilbys en nyere beta eller utgivelsen). Bruk av en loader-build tar en sikkerhetskopi før oppdatering først. Å flytte en Forge- eller NeoForge-server til en ny Minecraft-versjon sletter dens festede loader-build-nummer, fordi en build lages for én Minecraft-versjon; et nøkkelord som `latest` beholdes, siden det følger versjonen av seg selv. For å velge en spesifikk build selv, se [endre mod loader-versjonen](#changing-the-mod-loader-version).

![Oppdateringer](/docs/images/updates.png)

## Hvordan det fungerer

Panelet sjekker hver servers festede versjoner mot kilden oppstrøms og lister opp alt med en nyere utgivelse. Et matchende antall vises også på [dashbordets](/docs/dashboard/) "Oppdateringer tilgjengelig"-flis.

Kontroller kjøres daglig på en standard [plan](/docs/schedules/) og etter behov med **Sjekk alle nå**. **Ignorer** på en rad slutter å tilby den spesifikke versjonen; en nyere vil bli tilbudt igjen. Oppdaterings**policy** er per server: panelet lar alt være manuelt (standard, som også holder serveren utenfor denne siden), bare varsler deg, eller bruker pakkeoppdateringer selv ([oppdateringspolicy](/docs/modpacks/#update-policy)).

## Minecraft-versjonskompatibilitet

En nyere Minecraft-versjon er ikke en oppgradering hvis moddene dine ikke kan følge med. Hver server har sin egen **Versjoner**-fane (under Mods) som svarer på det spørsmålet:

- Versjonen serveren kjører nå, og **høyeste versjon hver installerte mod har en build for**.
- Én utvidbar rad per fremtidig Minecraft-versjon, med hvor mange mods som er klare og hvor mange som ikke har noe publisert ennå. Åpne en rad for å se hvilke mods som ville bli etterlatt, og hvilke som er greie.

![Versjonskompatibilitet](/docs/images/server-versions.png)

Trykk **Sjekk fremtidige versjoner** for å kjøre den. Ingenting skanner av seg selv: en sjekk leser hver jar i serverens mods-mappe og spør Modrinth og CurseForge om hver enkelt, så det skjer bare når du ber om det. Fremdrift og delvise resultater skrives mens det pågår, så å lukke siden eller oppdatere mister ingenting, og en sjekk avbrutt av en panelomstart sier det og tilbyr å kjøre igjen. Alt en avbrutt sjekk allerede har funnet ut, beholdes, så å kjøre den igjen gjentar ikke det arbeidet.

En rapport beskriver kun serveren den ble laget for. Endre Minecraft-versjonen, loaderen, eller selve moddene (legg til en, fjern en, oppdater en) og rapporten markeres som utdatert og slutter å bli brukt, inntil du kjører sjekken igjen.

Mods identifiseres fra modpackens egen filiste der det finnes en, og ellers etter filens innhold, på samme måte som en launcher gjenkjenner en jar. To typer mods kan ikke besvares for, og ingen av dem gjetter:

- **Kunne ikke identifiseres**: en håndlaget jar eller en privat build som ingen av registrene gjenkjenner.
- **Kunne ikke sjekkes**: en mod fra GitHub Releases, Hangar eller SpigotMC, eller en hvis prosjekt er fjernet. Disse publiserer ingen liste over hvilken Minecraft-versjon hver build er for.

Mens en av dem er installert, vil panelet ikke tilby en ett-klikks Minecraft-versjonsoppdatering i det hele tatt, fordi det ikke ærlig kan si hva som vil bryte. Bruk av en versjon over det moddene støtter, nektes, og navngir moddene som blokkerer det.

Mods du har **deaktivert** deltar ikke: serveren laster dem ikke, så å slå av en mod er en reell måte å komme forbi en blokkering. Å slå en mod av eller på markerer rapporten for ny sjekk.

Dette dekker servere som kjører mods: Fabric, Forge, NeoForge og Quilt. Paper-stil plugin-servere beholder den enkle nyeste-utgivelsesatferden og har ingen Versjoner-fane, fordi to av registrene plugins kommer fra, publiserer ingenting en sjekk kan lese.

![En versjon åpnet, som viser hvilke mods som ville bli etterlatt](/docs/images/server-versions-expanded.png)

Åpning av en versjon lister moddene uten build for den først (de som bestemmer svaret) og holder de klare bak en klikk. Store pakker laster en side med mods om gangen, så en 300-mod server åpnes like raskt som en fem-mod en.

## Endre mod loader-versjonen

**Versjoner**-fanen har også et **Loader Version**-kort. Det viser hvilken Forge, NeoForge, Fabric eller Quilt build serveren har installert og, der det kan endres, en velger for å bytte til en annen.

- **En Forge, NeoForge, Fabric eller Quilt-server** kan kjøre enhver publisert build. Velgeren lister de siste buildene for serverens Minecraft-versjon, med Forge's anbefalte og siste builds merket. **Annen Build…** tar en hvilken som helst eldre ved nummeret, og **Standard** går tilbake til å la serveren velge.
- **En Forge- eller Fabric CurseForge-modpack** installerer loader-versjonen dens egen manifest erklærer, så den vanlige måten å endre den på er å oppdatere pakken. Når pakken selv lister feil versjon (en mod inni den ber om en nyere Forge enn pakken installerer), kan kortet overstyre den, og **Modpackens Versjon** fjerner overstyringen igjen. Oppdatering av pakken fjerner den også, fordi den nye versjonen erklærer sin egen loader. Hvis den nye versjonen fortsatt lister feil, sett overstyringen igjen.
- **En NeoForge CurseForge-modpack, eller en Modrinth-modpack,** viser sin loader, men kan ikke overstyres: serverimaget bruker kun overstyringen på Forge- og Fabric-pakker. Dens loader følger pakkeversjonen, så oppdater pakken i stedet. En FTB-pakkes loader kan heller ikke endres her. Dens kort vises vanligvis ikke, fordi FTBs egen installatør holder oversikt som panelet ikke leser.

Panelet sjekker at builden eksisterer før det spør deg om noe. En Forge- eller NeoForge-build er laget for én Minecraft-versjon, så på en server som følger den nyeste utgivelsen, holder det å feste en også serveren på Minecraft-versjonen den kjører nå (bekreftelsen sier det). Å velge **Standard** etterpå fjerner festet, men beholder den Minecraft-versjonen. En server som fulgte den nyeste utgivelsen kan også flytte til et annet Java-image når den bygges på nytt, den som den versjonen trenger. Slike servere som aldri har startet, blir bedt om å starte én gang først, slik at panelet kjenner den versjonen. Forge hopper over build-numre (det er ingen 47.4.14 mellom 47.4.13 og 47.4.15), så en mod som "krever 47.4.14 eller høyere" er tilfredsstilt av neste build opp, og nektelsen navngir den. En endring tar en sikkerhetskopi før oppdatering, deretter bygger serveren på nytt. Den nye builden installeres neste gang serveren starter, og kortet sier det inntil da.

## Angre en mod-oppdatering

Hver build en mod oppdateres fra, forblir i det delte biblioteket, så en oppdatering som bryter noe kan reverseres. Moddens rad på **Mods**-fanen får en **Reverter**-knapp som setter tilbake forrige build. Det er ingen nedlasting, så det fungerer selv om prosjektet siden har blitt fjernet fra registeret. Builden du reverserte bort fra, slutter å bli tilbudt inntil en nyere dukker opp.

![Reverter en mod til builden den ble oppdatert fra](/docs/images/mods-revert.png)

## Bruke en oppdatering

Oppdateringer er aldri stille. Når du velger å oppgradere en pakke (eller [bytte den til en annen versjon](/docs/modpacks/#changing-the-pack-version), inkludert eldre), gjør panelet følgende:

1. Tar en **sikkerhetskopi før oppdatering** (slik at den kan reverseres; som standard beholdes de siste 10 sikkerhetskopiene før oppdatering per server, se [oppbevaring](/docs/backups/#retention)).
2. Fester den eksakte nye versjonen på nytt.
3. Bygger serveren på nytt, og løser Java-kjøretiden om nødvendig.
4. Overvåker den første oppstarten, med et tidsbudsjett per plattform.

Hvis den ikke starter sunt, ruller du tilbake til sikkerhetskopien før oppdatering. En server som følger stabil utgivelse, tilbys aldri en beta, og lenken til endringsloggen peker til den faktiske diffen per versjon der kilden tilbyr en. En mislykket oppdatering utløser også et Discord [varsel](/docs/integrations/) hvis integrasjonen er konfigurert.

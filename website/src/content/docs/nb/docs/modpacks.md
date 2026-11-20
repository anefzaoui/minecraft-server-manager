---
title: 'Modpacks'
description: 'Installer CurseForge, Modrinth, FTB og GT New Horizons modpacks som servere, alltid festet til en eksakt pakkeversjon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Tilbake til dokumentindeks](/docs/)

**Modpacks**-siden (og fanen **Fra modpack** i [opprettingsveiviseren](/docs/servers/)) installerer en modpack som en server, alltid **festet til en eksakt pakkeversjon** slik at en omstart aldri stille og rolig kan oppgradere pakken uten at du vet om det.

![Modpacks](/docs/images/modpacks.png)

## Støttede plattformer

- **CurseForge**: søk etter navn. Krever en CurseForge API-nøkkel (legg den til under **Innstillinger → API-nøkler**).
- **Modrinth**: søk etter navn.
- **FTB**: Feed The Beast-pakker, kun via API (et numerisk pakke-ID pluss en eksplisitt versjons-ID). Panelet sjekker ikke FTB-pakker for oppdateringer ennå.
- **GT New Horizons**: 1.7.10 ekspertpakken, installert fra GTNHs egen utgivelsesindeks. GTNH velger sin Java-runtime per pakkeversjon (2.8.0+ kjører på **Java 25** via bundlete lwjgl3ify-patcher, eldre utgivelser på Java 21 eller 17), og veiviseren øker serverens RAM og disk til fornuftige minimumsverdier for den.
- **Egendefinert zip**: ingen publisert pakke i det hele tatt. Last opp en **CurseForge modpack-eksport** (zip-filen med `manifest.json` som CurseForge-appen produserer for et håndplukket sett med mods), en **Modrinth `.mrpack`**, eller **enhver zip med mod-filer**. Panelet løser manifestet i bulk (eller identifiserer hver mod-fil etter hash/fingeravtrykk/metadata), forhåndsviser hva som passer, og installerer alt i én oppgave, inkludert pakkens `overrides/`-konfigurasjoner hvis du velger det. Mods som forfatterne deres ikke tillater automatiserte nedlastinger av, listes med en nettleserlenke og en manuell opplastingsplass i stedet for å feile installasjonen.

## Slik fungerer festing

Når du velger en pakke, løser panelet den eksakte versjonen, registrerer den og installerer den. På **Oppdateringer**-siden vil du bli fortalt når en nyere versjon er tilgjengelig (med mindre serverens [oppdateringspolicy](#update-policy) er **Kun manuell**); oppgradering er en bevisst, beskyttet handling med en sikkerhetskopi før oppdatering og tilbakestilling. Server som sporer stabile versjoner tilbys aldri en beta. En servers egen **Versjoner**-fane svarer på den andre halvdelen av spørsmålet: hvilke fremtidige Minecraft-versjoner moddene den faktisk har kan følge ([oppdateringer](/docs/updates/#minecraft-version-compatibility)).

Mod loader-versjonen følger også med pakken: serveren installerer Forge, NeoForge eller Fabric-versjonen som pakken erklærer. Hvis en Forge- eller Fabric CurseForge-pakke erklærer en som er for gammel for sine egne mods, kan **Versjoner**-fanen overstyre den til pakken er fikset; en pakkeoppdatering fjerner overstyringen, siden den nye versjonen erklærer sin egen ([endre mod loader-versjon](/docs/updates/#changing-the-mod-loader-version)).

Servere opprettet på svært gamle panelversjoner (før 0.9.7) kunne bli liggende _ufestet_, noe som betyr at containerbildet stille og rolig ville installere den nyeste pakkeversjonen ved hver oppstart. Panelet reparerer nå disse ved oppstart: det låser hver av dem til versjonen som faktisk er installert (lest fra panelets egne registre eller bildets installasjonsmanifest, aldri en nylig løst "siste") og logger en hendelse. Hvis det ikke kan finne ut hva som er installert, viser serverens Innstillinger-side en advarsel med en **Velg en versjon…**-knapp (CurseForge, Modrinth og GTNH-pakker) som åpner [versjonsvelgeren](#changing-the-pack-version), og ethvert forsøk på å lagre en ufestet modpack-konfigurasjon blir umiddelbart avvist.

## Oppdateringspolicy

Hver server har et **Oppdateringspolicy**-kort på **Innstillinger → Konfigurasjon**-fanen, og alle tre alternativene betyr det de sier:

- **Kun manuell** (standard): ingenting endres av seg selv, og serveren utelates helt fra oppdateringsmerket og Oppdateringer-siden. "La meg være i fred"-modusen: ideell for en håndjustert eller importert pakke du aldri vil skal røres. Den låser ikke versjonen: [**Endre versjon…**](#changing-the-pack-version) fungerer under enhver policy. For å bli varslet om nye versjoner og bruke dem med ett klikk, velg **Gi meg beskjed**.
- **Gi meg beskjed**: den daglige sjekken viser tilgjengelige oppdateringer som et merke og på Oppdateringer-siden; å bruke dem er alltid ditt klikk.
- **Auto-oppdatering**: etter den planlagte daglige sjekken, blir ventende **pakke**-oppdateringer brukt gjennom samme beskyttede vei som en manuell oppgradering: sikkerhetskopi før oppdatering, helseovervåking og en automatisk tilbakestilling hvis den nye versjonen ikke starter. Oppdateringer som ville flytte serveren til en annen Minecraft-versjon blir alltid hoppet over med en hendelse i stedet: å konvertere en verden permanent er en beslutning panelet nekter å ta for deg. De manuelle **Sjekk nå**-knappene sjekker bare; de utløser aldri auto-oppdateringer.

## Oppgradere en pakke

Fra en festet server kan du oppgradere til en nyere versjon i én handling. Panelet tar en sikkerhetskopi først, bytter den festede versjonen, bygger serveren på nytt (løser Java på nytt hvis den nye versjonen trenger en annen runtime), og overvåker den første oppstarten, med et sjenerøst vindu for store pakker som GTNH som laster ned et par gigabyte og bygger en verden med flere hundre mods ved første oppstart.

## Endre pakkeversjon

For å kjøre en spesifikk versjon, nyere eller eldre, bruk **Endre versjon…** på pakke-kortet på serverens **Oversikt**-fane. På **Modpacks**-siden gir åpning av et installert pakkes kort samme valg: velg en versjon i rullegardinmenyen og klikk **Bytt til denne versjonen**. Begge krever serverens **Innhold**-tillatelse, og begge er tilgjengelige for CurseForge, Modrinth og GTNH-pakker (FTB-pakker har ingen versjonsliste ennå). Listen viser de 25 nyeste versjonene for CurseForge og Modrinth, og alle GTNH-utgivelser.

Byttet går gjennom samme beskyttede vei som en oppgradering: en sikkerhetskopi før oppdatering, den nye festingen, en gjenoppbygging og en overvåket første oppstart, med en ett-klikks tilbakestilling hvis serveren ikke starter opp sunt. Dine egne mods blir beholdt, og det samme gjelder pakke-mods du deaktiverte, sammen med pakkens andre installasjonsinnstillinger (mods tvunget inn, filer som skal ignoreres, ekstra prosjekter). Installering av en annen pakke starter disse innstillingene på nytt, fordi de bare gir mening for pakken de ble laget for.

Hver versjon er listet med Minecraft-versjonen den kjører, sammenlignet med versjonen verdenen din sist ble lagret med:

- **Samme Minecraft-versjon**: bytt etter en normal bekreftelse. Å gå tilbake til en eldre pakkeversjon kan fjerne blokker og gjenstander fra mods som den versjonen ikke har, så sikkerhetskopien blir liggende i Sikkerhetskopier-fanen uansett.
- **Nyere Minecraft-versjon**: tillatt etter en bekreftelse som advarer om at verdenen blir konvertert for godt. Sikkerhetskopien som tas først er den eneste veien tilbake til den gamle verdenen.
- **Eldre Minecraft-versjon**: utilgjengelig. Minecraft kan ikke laste en verden på en eldre versjon enn den som sist lagret den, så panelet nekter i stedet for å etterlate en server som krasjer ved oppstart.

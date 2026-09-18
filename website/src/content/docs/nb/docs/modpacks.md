---
title: 'Modpacks'
description: 'Modpacks-siden (og fanen «Fra modpack» i opprettingsveiviseren) installerer en modpack som en server, alltid festet til en nøyaktig pakkeversjon slik at en omstart kan'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Tilbake til dokumentasjonsindeks](/docs/)

**Modpacks**-siden (og fanen **Fra modpack** i [opprettingsveiviseren](/docs/servers/)) installerer en modpack som en server, alltid **festet til en eksakt pakkeversjon** slik at en omstart aldri stille kan oppgradere pakken uten at du vet det.

![Modpacks](/docs/images/modpacks.png)

## Støttede plattformer

- **CurseForge** - søk eller lim inn en pakke-URL. Krever en CurseForge API-nøkkel for søk og private pakker (legg den til under Innstillinger → API-nøkler).
- **Modrinth** - søk etter navn.
- **FTB** - Feed The Beast-pakker.
- **GT New Horizons** - 1.7.10 ekspertpakken, installert fra GTNHs egen utgivelsesindeks. GTNH velger sin Java-runtime per pakkeversjon (2.8.0+ kjører på **Java 25** via medfølgende lwjgl3ify-patcher, eldre utgivelser på Java 21 eller 17), og veiviseren øker serverens RAM og disk til fornuftige minimumsverdier for den.
- **Egendefinert zip** - ingen publisert pakke i det hele tatt: last opp en **CurseForge modpack-eksport** (zip-filen med `manifest.json` som CurseForge-appen produserer for et håndplukket sett med mods) eller **enhver zip med mod-filer**. Panelet løser manifestet i bulk via CurseForge API (eller identifiserer hver mod-fil etter hash/fingeravtrykk/metadata), forhåndsviser hva som passer, og installerer alt i én oppgave - inkludert pakkens `overrides/`-konfigurasjoner hvis du velger det. Mods som forfatterne ikke tillater automatiserte nedlastinger, listes med en nettleserlenke og en manuell opplastingsplass i stedet for å feile installasjonen.

## Slik fungerer festing

Når du velger en pakke, løser panelet den eksakte versjonen, registrerer den og installerer den. På **Oppdateringer**-siden vil du bli fortalt når en nyere versjon er tilgjengelig; oppgradering er en bevisst, beskyttet handling med en sikkerhetskopi før oppdatering og tilbakerulling. Servere som sporer stabile versjoner tilbys aldri en beta.

Servere opprettet på veldig gamle panelversjoner (før 0.9.7) kunne bli stående _ufestet_, noe som betyr at containerbildet stille ville installere den nyeste pakkeversjonen ved hver oppstart. Panelet reparerer nå disse ved oppstart: det låser hver av dem til versjonen som faktisk er installert (lest fra panelets egne logger eller bildets installasjonsmanifest, aldri en nylig løst "siste") og logger en hendelse. Hvis det ikke kan fastslå hva som er installert, viser serverens Innstillinger-side en advarsel som ber deg velge versjonen manuelt, og ethvert forsøk på å lagre en ufestet modpack-konfigurasjon blir umiddelbart avvist.

## Oppdateringspolicy

Hver server har en oppdateringspolicy i **Innstillinger**, og alle tre alternativene betyr det de sier:

- **Kun manuell** - ingenting endres av seg selv, og serveren utelates helt fra oppdateringsmerket og Oppdateringer-siden. "La meg være i fred"-modusen: ideell for en manuelt finjustert eller importert pakke du aldri vil skal røres.
- **Varsle meg** (standard) - den daglige sjekken viser tilgjengelige oppdateringer som et merke og på Oppdateringer-siden; å bruke dem er alltid ditt klikk.
- **Automatisk oppdatering** - etter den planlagte daglige sjekken, blir ventende **pakke**-oppdateringer brukt gjennom samme beskyttede vei som en manuell oppgradering: sikkerhetskopi før oppdatering, helseovervåking og en automatisk tilbakerulling hvis den nye versjonen ikke starter. Oppdateringer som ville flytte serveren til en annen Minecraft-versjon, blir alltid hoppet over med en hendelse i stedet - å konvertere en verden permanent er en beslutning panelet nekter å ta for deg. De manuelle "sjekk nå"-knappene sjekker bare; de utløser aldri automatiske oppdateringer.

## Oppgradere en pakke

Fra en festet server kan du oppgradere til en nyere versjon i én handling. Panelet tar en sikkerhetskopi først, bytter den festede versjonen, gjenskaper containeren (løser Java på nytt hvis den nye versjonen trenger en annen runtime), og overvåker den første oppstarten, med et sjenerøst vindu for store pakker som GTNH som laster ned et par gigabyte og bygger en verden med flere hundre mods ved første oppstart.

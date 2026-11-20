---
title: 'Verdener og filer'
description: 'Verdensbiblioteket, opplasting og bytting av verdener, fanen for mods og plugins, og filbehandleren i nettleseren.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Tilbake til dokumentindeks](/docs/)

## Verdener

**Verdener**-siden er verdensbiblioteket: alle lagrede verdener på ett sted. **Last opp verden** tar et `.zip`- eller `.tar`-arkiv og finner verden inni det automatisk, **Lagre i bibliotek** tar et øyeblikksbilde av en servers live-verden (det fungerer mens serveren kjører), og hver bibliotekverden kan lastes ned eller installeres på hvilken som helst server med **Installer til…**. Installering enten erstatter serverens verden (serveren må stoppes, og dens nåværende verden sikkerhetskopieres først) eller legger den til ved siden av, for å aktivering senere. En kompatibilitetssjekk kjøres før hver installasjon.

En servers egen **Verden → Verdener**-fane viser verdenene på den serveren. Derfra kan du aktivere en annen verden (med serveren stoppet), laste ned, duplisere, gi nytt navn, eller [krymp](/docs/world-shrink/) en verden, kopiere den til en annen server, slette en inaktiv, og tilbakestille den aktive verdenen med et nytt, beholdt eller tilpasset frø (en sikkerhetskopi tilbys først). Det samme biblioteket ligger under, med **Installer her**.

![Verdener](/docs/images/worlds.png)

## Filbehandleren

Under en servers **Verden**-seksjon er **Filer**-fanen en full filbehandler i nettleseren for den serverens datakatalog. List, les, rediger, gi nytt navn, flytt, kopier, slett og last opp filer, opprett mapper, og søk i teksten til filer under en mappe med **Finn i filer**: alt du normalt ville gjort over SSH, fra nettleseren.

![Filbehandler](/docs/images/server-files.png)

Tekstfiler åpnes i en editor med en grense på 8 MB; større filer kan lastes ned. Opplastinger aksepterer opptil 20 filer samtidig.

### Holder seg innenfor sandkassen

Hver filoperasjon er begrenset til serverens egen datakatalog. Panelet løser hver bane og nekter alt som ville unnslippe: `..`-traversering, absolutte baner, og til og med symlinker som peker utenfor katalogen (inkludert dinglende som ikke eksisterer ennå). En mod eller plugin kan ikke plante en lenke for å lure filbehandleren til å lese eller skrive andre steder på verten.

## Mods

For modifiserte og plugin-servere administrerer **Mods**-fanen (sin egen gruppe i serverens sidefelt) mod-settet: bla gjennom og legg til mods, og se hva som er installert. Fra hver installerte mods rad kan du oppdatere den (eller ignorere den oppdateringen), [tilbakestille](/docs/updates/#undoing-a-mod-update) den, deaktivere den, eller fjerne den, og **Oppdater alle** bruker alle tilgjengelige oppdateringer med én omstart. Mod- og pakkeoppdateringer vises også på [Oppdateringer](/docs/updates/)-siden.

### Legge til mods

![Mods](/docs/images/mods.png)

Fire måter å legge til på, alle fra Mods-fanens verktøylinje:

- **Søk mods**: søk **Modrinth eller CurseForge** (CurseForge-brikken vises når en API-nøkkel er lagret under **Innstillinger → API-nøkler**), og på plugin-servere også **Hangar** (PaperMCs egen plugin-register) og **SpigotMC** (via Spigets CDN-proxy), begge uten nøkkel. En **Datapakker**-fane søker Modrinths datapakker. Alt er filtrert til serverens loader og Minecraft-versjon (en avkrysningsboks viser også bygg som ikke er oppført som kompatible, på egen risiko); Quilt-servere ser automatisk også fabric-merkede bygg, siden Quilt kjører Fabric-mods. Resultater som allerede er på serveren viser et **Installert**-merke. Hvis en CurseForge-forfatter forbyr automatiserte nedlastinger (eller en SpigotMC-ressurs er hostet utenfor), sier panelet dette på forhånd og tilbyr en **Åpne CurseForge** (eller **Åpne SpigotMC**) + **Last opp Jar**-bane i stedet for å mislykkes midt i installasjonen.

  ![Hangar-søk](/docs/images/mods-search-hangar.png)

- **Importer Zip**: én knapp, tre former, automatisk oppdaget:
  - En **Modrinth modpack (`.mrpack`)**: hver festede fil kanoniseres tilbake til sitt Modrinth-prosjekt via hash-oppslag (slik at importerte mods beholder ekte navn, ikoner og forblir oppdaterbare; filer Modrinth ikke kjenner til installeres fra pakkens egen URL), verifiseres mot pakkens sha512-sjekksummer under nedlasting, og forhåndsvises med pass-dommer. Klient-kun-filer hoppes over synlig, og begge overstyringstrærne (`overrides/`, deretter `server-overrides/`; den serverspesifikke kopien vinner) kan brukes.

    ![mrpack-import](/docs/images/mrpack-import.png)

  - En **CurseForge modpack-eksport** (zip-filen CurseForges app produserer, med `manifest.json`): hver festede mod løses i bulk, forhåndsvises med advarsler (feil loader/MC for denne serveren, filer ikke lenger på CurseForge, mods som trenger en manuell nedlasting), og installeres med reell fremdrift. Pakkens `overrides/` (konfigurasjoner, skript) kan eventuelt også brukes; alle filer som ville blitt overskrevet, sikkerhetskopieres først til `.import-backups/<timestamp>/` inne i servermappen.
  - En **vanlig zip med jars** du har samlet selv: hver jar identifiseres (Modrinth hash-match → CurseForge fingeravtrykk → jars egen metadata) og vurderes mot serveren (_passer / feil loader / feil MC-versjon / allerede installert / uidentifisert_), slik at du velger hva som faktisk hører hjemme før noe installeres.
- **Legg til via URL**: lim inn nesten hva som helst: Modrinth, CurseForge, Hangar eller SpigotMC prosjektsider, en GitHub repo- eller utgivelses-URL (en bare `eier/repo` fungerer også; GitHub-installasjoner foretrekker den nyeste stabile utgivelsen og hopper over `-sources`/`-javadoc` sidecar-jars), en bare Modrinth-slug, eller en hvilken som helst direkte `.jar`-URL. Panelet løser riktig bygg for serverens loader og MC-versjon.

  ![Legg til via lenke](/docs/images/mods-add-by-link.png)

- **Last opp Jar** (fra søkefallbacken eller den ventende nedlastingsløseren): opplastede jars identifiseres på samme måte, slik at de beholder sitt virkelige navn, versjon, ikon og blir oppdaterbare.

Hver registerinstallasjon er **sjekksum-verifisert mens den lastes ned**: strømmen sjekkes mot den sterkeste digest registeret publiserer (sha512 → sha256 → sha1 → md5) og et avvik avbryter før noe lander på serveren.

En hel zip (`.mrpack` inkludert) kan også **opprette en server**: i veiviserens **Fra Modpack**-fane, last den opp og pakkemanifestet (eller et flertall av de identifiserte jars) fyller ut loader, Minecraft-versjon og loader-bygg.

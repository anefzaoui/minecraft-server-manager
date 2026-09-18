---
title: 'Verdener og filer'
description: 'Verdenssiden administrerer verdensdataene på tvers av serverne dine: bytt aktiv verden, last opp en verden, eller last ned en.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Tilbake til dokumentindeks](/docs/)

## Verdener

**Worlds**-siden administrerer verdensdata på tvers av serverne dine: bytt aktiv verden, last opp en verden, eller last ned en.

![Worlds](/docs/images/worlds.png)

## Filbehandleren

Under en servers **World**-seksjon er **Files**-fanen en komplett filbehandler i nettleseren for serverens datakatalog. List opp, les, rediger, opprett, gi nytt navn til, flytt, kopier, slett og last opp filer: alt du normalt ville gjort over SSH, fra nettleseren.

![File manager](/docs/images/server-files.png)

Tekstfiler åpnes i en editor med en grense på 2 MB; større filer kan lastes ned. Opplastinger aksepterer flere filer samtidig.

### Holde seg innenfor sandkassen

Alle filoperasjoner er begrenset til serverens egen datakatalog. Panelet løser opp hver sti og nekter alt som ville unnslippe: `..` traversering, absolutte stier, og til og med symbollenker som peker utenfor katalogen (inkludert hengende lenker som ennå ikke eksisterer). En mod eller plugin kan ikke plante en lenke for å lure filbehandleren til å lese eller skrive andre steder på verten.

## Mods

For moddede servere administrerer **Mods**-fanen (sin egen gruppe i serverens sidefelt) mod-settet: bla gjennom og legg til mods, og se hva som er installert. Mod- og pakkeoppdateringer vises på [Updates](/docs/updates/)-siden.

### Legge til mods

![Mods](/docs/images/mods.png)

Fire måter å legge til på, alle fra verktøylinjen på Mods-fanen:

- **Søk etter mods** - søk på **Modrinth eller CurseForge** (CurseForge-brikken vises når en API-nøkkel er lagret under Settings → API keys), og på plugin-servere også **Hangar** (PaperMC sin egen plugin-register) og **SpigotMC** (via Spigets CDN-proxy) - begge uten nøkkel. Alt filtreres til serverens loader og Minecraft-versjon; Quilt-servere ser automatisk også fabric-merkede bygg, siden Quilt kjører Fabric-mods. Resultater som allerede er på serveren viser et **Installed**-merke. Hvis en CurseForge-forfatter forbyr automatiserte nedlastinger - eller en SpigotMC-ressurs er hostet eksternt - sier panelet det tydelig og tilbyr en **Open page** + **Upload jar**-sti i stedet for å feile midt i installasjonen.

  ![Hangar search](/docs/images/mods-search-hangar.png)

- **Importer zip** - én knapp, tre former, automatisk detektert:
  - En **Modrinth modpack (`.mrpack`)**: hver festede fil blir kanonisert tilbake til sitt Modrinth-prosjekt via hash-oppslag (slik at importerte mods beholder ekte navn, ikoner og forblir oppdaterbare; filer Modrinth ikke kjenner til installeres fra pakkens egen URL), verifisert mot pakkens sha512-kontrollsummer under nedlasting, og forhåndsvist med passende dommer. Klient-bare filer hoppes over synlig, og begge overskrivningstrær (`overrides/`, deretter `server-overrides/` - den server-spesifikke kopien vinner) kan brukes.

    ![mrpack import](/docs/images/mrpack-import.png)

  - En **CurseForge modpack-eksport** (zip-filen CurseForge-appen produserer, med `manifest.json`): hver festede mod løses i bulk, forhåndsvises med advarsler (feil loader/MC for denne serveren, filer som ikke lenger er på CurseForge, mods som trenger manuell nedlasting), og installeres med reell fremdrift. Paksens `overrides/` (konfigurasjoner, skript) kan valgfritt brukes også - enhver fil som ville blitt overskrevet, sikkerhetskopieres først til `.import-backups/<timestamp>/` inne i servermappen.
  - En **vanlig zip-fil med jar-filer** du samlet selv: hver jar-fil identifiseres (Modrinth hash-match → CurseForge fingeravtrykk → jar-filens egen metadata) og vurderes mot serveren - _passer / feil loader / feil MC-versjon / allerede installert / uidentifisert_ - slik at du velger hva som faktisk hører til før noe installeres.
- **Legg til via lenke** - lim inn nesten hva som helst: Modrinth, CurseForge, Hangar, eller SpigotMC prosjektsider, en GitHub repo eller release URL (en ren `owner/repo` fungerer også - GitHub-installasjoner foretrekker den nyeste stabile utgivelsen og hopper over `-sources`/`-javadoc` sidecar-jar-filer), en ren Modrinth slug, eller en hvilken som helst direkte `.jar` URL. Panelet løser opp riktig bygg for serverens loader og MC-versjon.

  ![Add by link](/docs/images/mods-add-by-link.png)

- **Last opp jar** (fra søkefallet eller den ventende nedlastingsløseren) - opplastede jar-filer identifiseres på samme måte, slik at de beholder sitt ekte navn, versjon, ikon, og blir oppdaterbare.

Hver registerinstallasjon blir **kontrollert med kontrollsummer under nedlasting**: strømmen sjekkes mot den sterkeste digesten registeret publiserer (sha512 → sha256 → sha1 → md5) og en uoverensstemmelse avbryter før noe lander på serveren.

En hel zip-fil (`.mrpack` inkludert) kan også **opprette en server**: i veiviserens _From modpack_-fane, last den opp og pakke-manifestet (eller et flertall av de identifiserte jar-filene) fyller inn loader, Minecraft-versjon og loader-bygg.

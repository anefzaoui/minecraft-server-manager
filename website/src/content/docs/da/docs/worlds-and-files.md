---
title: 'Verdener & filer'
description: 'Verdenssiden administrerer verdensdata på tværs af dine servere: skift den aktive verden, upload en verden eller download en.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Tilbage til dokumentindeks](/docs/)

## Verdener

**Verdener**-siden administrerer verdensdata på tværs af dine servere: skift den aktive verden, upload en verden eller download en.

![Verdener](/docs/images/worlds.png)

## Filhåndteringen

Under en servers **Verden**-sektion er fanen **Filer** en komplet filhåndtering i browseren for serverens datakatalog. List, læs, rediger, opret, omdøb, flyt, kopier, slet og upload filer: alt hvad du normalt ville gøre over SSH, fra browseren.

![Filhåndtering](/docs/images/server-files.png)

Tekstfiler åbnes i en editor med en grænse på 2 MB; større filer kan downloades. Uploads accepterer flere filer på én gang.

### Bliv inden for sandkassen

Alle filoperationer er begrænset til serverens eget datakatalog. Panelet løser hver sti og afviser alt, der ville undslippe: `..` traversal, absolutte stier og endda symboliske links, der peger uden for biblioteket (inklusive hængende links, der endnu ikke eksisterer). Et mod eller plugin kan ikke plante et link for at narre filhåndteringen til at læse eller skrive andre steder på værten.

## Mods

For servere med mods, administrerer fanen **Mods** (sin egen gruppe i serverens sidebjælke) mod-sættet: gennemse og tilføj mods, og se hvad der er installeret. Mod- og pakkeopdateringer vises på siden [Opdateringer](/docs/updates/).

### Tilføjelse af mods

![Mods](/docs/images/mods.png)

Fire måder at komme ind på, alle fra værktøjslinjen i Mods-fanen:

- **Søg mods** - søg på **Modrinth eller CurseForge** (CurseForge-chippen vises, når en API-nøgle er gemt under Indstillinger → API-nøgler), og på plugin-servere også **Hangar** (PaperMC's egen plugin-register) og **SpigotMC** (via Spigets CDN-proxy) - begge uden nøgle. Alt filtreres til serverens loader og Minecraft-version; Quilt-servere ser automatisk fabric-taggede builds også, da Quilt kører Fabric-mods. Resultater, der allerede er på serveren, viser et **Installer**-mærke. Hvis en CurseForge-forfatter forbyder automatiske downloads - eller en SpigotMC-ressource er hostet eksternt - siger panelet det tydeligt og tilbyder en **Åbn side** + **Upload jar**-sti i stedet for at fejle midt i installationen.

  ![Hangar-søgning](/docs/images/mods-search-hangar.png)

- **Importer zip** - én knap, tre former, automatisk registreret:
  - En **Modrinth modpack (`.mrpack`)**: hver fastgjorte fil normaliseres tilbage til sit Modrinth-projekt via hash-opslag (så importerede mods beholder rigtige navne, ikoner og forbliver opdateringsbare; filer Modrinth ikke kender, installeres fra pakkens egen URL), verificeres mod pakkens sha512-checksums under download, og forhåndsvises med passende domme. Kun klient-filer springes over synligt, og begge override-træer (`overrides/`, derefter `server-overrides/` - den server-specifikke kopi vinder) kan anvendes.

    ![mrpack import](/docs/images/mrpack-import.png)

  - En **CurseForge modpack eksport** (den zip, som CurseForge-appen producerer, med `manifest.json`): hver fastgjorte mod opløses i bulk, forhåndsvises med advarsler (forkert loader/MC til denne server, filer ikke længere på CurseForge, mods der kræver manuel download), og installeres med reel fremgang. Pagens `overrides/` (configs, scripts) kan valgfrit anvendes - enhver fil, der ville blive overskrevet, sikkerhedskopieres først til `.import-backups/<timestamp>/` inde i servermappen.
  - En **almindelig zip af jars**, du selv har samlet: hver jar identificeres (Modrinth hash-match → CurseForge fingerprint → jar'ens egen metadata) og bedømmes mod serveren - _passer / forkert loader / forkert MC-version / allerede installeret / uidentificeret_ - så du vælger, hvad der rent faktisk hører til, før noget installeres.
- **Tilføj via link** - indsæt næsten hvad som helst: Modrinth, CurseForge, Hangar eller SpigotMC projektsider, en GitHub repo eller release URL (et simpelt `owner/repo` virker også - GitHub-installationer foretrækker den nyeste stabile release og springer `-sources`/`-javadoc` sidecar jars over), en simpel Modrinth slug, eller enhver direkte `.jar` URL. Panelet opløser den rigtige build til serverens loader og MC-version.

  ![Tilføj via link](/docs/images/mods-add-by-link.png)

- **Upload jar** (fra søgefaldback eller pending-downloads resolveren) - uploadede jars identificeres på samme måde, så de beholder deres rigtige navn, version, ikon og bliver opdateringsbare.

Hver registerinstallation er **checksum-verificeret under download**: streamen kontrolleres mod det stærkeste digest, som registeret udgiver (sha512 → sha256 → sha1 → md5), og en uoverensstemmelse afbrydes, før noget lander på serveren.

En hel zip (`.mrpack` inkluderet) kan også **oprette en server**: i guiden's _Fra modpack_ fane, upload den, og pakke-manifestet (eller et flertal af de identificerede jars) udfylder loader, Minecraft-version og loader-build.

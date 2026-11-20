---
title: 'Verdener & filer'
description: 'Verdensbiblioteket, upload og udskiftning af verdener, fanen mods og plugins samt filhåndteringen i browseren.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Tilbage til dokumentindeks](/docs/)

## Verdener

**Verdener**-siden er verdensbiblioteket: alle gemte verdener samlet ét sted. **Upload Verden** tager et `.zip` eller `.tar` arkiv og finder automatisk verdenen indeni. **Gem i Bibliotek** tager et snapshot af en servers kørende verden (det virker, mens serveren kører), og hver biblioteksverden kan downloades eller installeres på enhver server med **Installer til…**. Installation erstatter enten serverens verden (serveren skal være stoppet, og dens nuværende verden sikkerhedskopieres først) eller tilføjer den ved siden af, for at aktivere senere. En kompatibilitetstjek kører før hver installation.

En servers egen **Verden → Verdener** fane viser de verdener, der er på den server. Derfra kan du aktivere en anden verden (med serveren stoppet), downloade, duplikere, omdøbe eller [formindske](/docs/world-shrink/) en verden, kopiere den til en anden server, slette en inaktiv, og nulstille den aktive verden med et nyt, bevaret eller brugerdefineret seed (en sikkerhedskopi tilbydes først). Det samme bibliotek vises nedenfor, med **Installer Her**.

![Verdener](/docs/images/worlds.png)

## Filhåndteringen

Under en servers **Verden**-sektion er **Filer**-fanen en komplet filhåndtering i browseren for serverens datakatalog. List, læs, rediger, omdøb, flyt, kopier, slet og upload filer, opret mapper, og søg i teksten af filer under en mappe med **Find i Filer**: alt, hvad du normalt ville gøre over SSH, fra browseren.

![Filhåndtering](/docs/images/server-files.png)

Tekstfiler åbnes i en editor med en grænse på 8 MB; større filer kan downloades. Uploads accepterer op til 20 filer ad gangen.

### Bliv inden for sandkassen

Hver filoperation er begrænset til serverens eget datakatalog. Panelet løser hver sti og afviser alt, der ville undslippe: `..` traversal, absolutte stier, og endda symlinks, der peger uden for mappen (inklusive hængende, der endnu ikke eksisterer). En mod eller et plugin kan ikke plante et link for at narre filhåndteringen til at læse eller skrive andre steder på værten.

## Mods

For moddede og plugin-servere administrerer **Mods**-fanen (sin egen gruppe i serverens sidebar) mod-sættet: browse og tilføj mods, og se hvad der er installeret. Fra hver installeret mods række kan du opdatere den (eller ignorere den opdatering), [tilbageføre](/docs/updates/#undoing-a-mod-update) den, deaktivere den, eller fjerne den, og **Opdater Alle** anvender alle tilgængelige opdateringer med en genstart. Mod- og pakkeopdateringer vises også på [Opdateringer](/docs/updates/) siden.

### Tilføjelse af mods

![Mods](/docs/images/mods.png)

Fire veje ind, alle fra værktøjslinjen på Mods-fanen:

- **Søg Mods**: søg på **Modrinth eller CurseForge** (CurseForge-chippen vises, når en API-nøgle er gemt under **Indstillinger → API-nøgler**), og på plugin-servere også **Hangar** (PaperMC's egen plugin-register) og **SpigotMC** (via Spiget's CDN proxy), begge uden nøgle. En fane **Datapacks** søger Modrinth's datapacks. Alt filtreres til serverens loader og Minecraft-version (et afkrydsningsfelt viser også builds, der ikke er markeret som kompatible, på egen risiko); Quilt-servere ser automatisk fabric-tagged builds også, da Quilt kører Fabric mods. Resultater, der allerede er på serveren, viser et **Installer**-badge. Hvis en CurseForge-forfatter forbyder automatiske downloads (eller en SpigotMC-ressource er hostet eksternt), siger panelet det tydeligt og tilbyder en **Åbn CurseForge** (eller **Åbn SpigotMC**) + **Upload Jar** vej i stedet for at fejle midt i installationen.

  ![Hangar-søgning](/docs/images/mods-search-hangar.png)

- **Importér Zip**: én knap, tre former, automatisk registreret:
  - En **Modrinth modpack (`.mrpack`)**: hver fastgjorte fil normaliseres tilbage til sit Modrinth-projekt via hash-opslag (så importerede mods beholder rigtige navne, ikoner og forbliver opdateringsbare; filer Modrinth ikke kender, installeres fra pakkens egen URL), verificeres mod pakkens sha512 checksums under download, og forhåndsvises med passende domme. Kun klient-filer springes over synligt, og begge override-træer (`overrides/`, derefter `server-overrides/`; den server-specifikke kopi vinder) kan anvendes.

    ![mrpack import](/docs/images/mrpack-import.png)

  - En **CurseForge modpack eksport** (den zip, som CurseForge's app producerer, med `manifest.json`): hver fastgjorte mod løses i bulk, forhåndsvises med advarsler (forkert loader/MC for denne server, filer ikke længere på CurseForge, mods der kræver manuel download), og installeres med reel fremgang. Pakkens `overrides/` (configs, scripts) kan valgfrit anvendes også; enhver fil, der ville blive overskrevet, sikkerhedskopieres først til `.import-backups/<timestamp>/` inde i servermappen.
  - En **almindelig zip af jars**, du selv har samlet: hver jar identificeres (Modrinth hash-match → CurseForge fingerprint → jar'ens egen metadata) og bedømmes mod serveren (_passer / forkert loader / forkert MC version / allerede installeret / uidentificeret_), så du vælger, hvad der rent faktisk hører til, før noget installeres.
- **Tilføj efter URL**: indsæt næsten hvad som helst: Modrinth, CurseForge, Hangar, eller SpigotMC projektsider, en GitHub repo eller release URL (et simpelt `owner/repo` virker også; GitHub installationer foretrækker den nyeste stabile release og springer `-sources`/`-javadoc` sidecar jars over), en simpel Modrinth slug, eller enhver direkte `.jar` URL. Panelet løser den rigtige build til serverens loader og MC-version.

  ![Tilføj efter link](/docs/images/mods-add-by-link.png)

- **Upload Jar** (fra søge-fallback eller pending-downloads resolveren): uploadede jars identificeres på samme måde, så de beholder deres rigtige navn, version, ikon og bliver opdateringsbare.

Hver register-installation **verificeres med checksum under download**: streamen kontrolleres mod det stærkeste digest, registeret udgiver (sha512 → sha256 → sha1 → md5), og en uoverensstemmelse afbryder, før noget lander på serveren.

En hel zip (`.mrpack` inkluderet) kan også **oprette en server**: i guiden's **Fra Modpack** fane, upload den, og pakkens manifest (eller et flertal af de identificerede jars) udfylder loader, Minecraft-version og loader-build.

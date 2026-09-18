---
title: 'Världar & filer'
description: 'Sidan Världar hanterar världsinformationen på dina servrar: byt aktiv värld, ladda upp en värld eller ladda ner en.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Tillbaka till dokumentindex](/docs/)

## Världar

Sidan **Världar** hanterar världsinformationen för dina servrar: byt aktiv värld, ladda upp en värld eller ladda ner en.

![Världar](/docs/images/worlds.png)

## Filhanteraren

Under en servers **Värld**-sektion är fliken **Filer** en komplett filhanterare i webbläsaren för serverns datakatalog. Lista, läs, redigera, skapa, byt namn på, flytta, kopiera, ta bort och ladda upp filer: allt du normalt skulle göra via SSH, från webbläsaren.

![Filhanterare](/docs/images/server-files.png)

Textfiler öppnas i en redigerare med en gräns på 2 MB; större filer kan laddas ner. Uppladdningar accepterar flera filer samtidigt.

### Håll dig inom sandlådan

Varje filoperation är begränsad till serverns egen datakatalog. Panelens löser varje sökväg och nekar allt som skulle bryta sig ut: `..` traversering, absoluta sökvägar och till och med symboliska länkar som pekar utanför katalogen (inklusive hängande länkar som ännu inte existerar). En mod eller plugin kan inte skapa en länk för att lura filhanteraren att läsa eller skriva någon annanstans på värden.

## Mods

För servrar med mods, hanterar fliken **Mods** (en egen grupp i serverns sidofält) mod-uppsättningen: bläddra och lägg till mods, och se vad som är installerat. Uppdateringar av mods och modpacks visas på sidan [Uppdateringar](/docs/updates/).

### Lägga till mods

![Mods](/docs/images/mods.png)

Fyra vägar in, alla från verktygsfältet på Mods-fliken:

- **Sök mods** - sök på **Modrinth eller CurseForge** (CurseForge-etiketten visas när en API-nyckel har lagrats under Inställningar → API-nycklar), och på plugin-servrar även **Hangar** (PaperMC:s egen plugin-register) och **SpigotMC** (via Spigets CDN-proxy) - båda utan nyckel. Allt filtreras efter serverns laddare och Minecraft-version; Quilt-servrar ser automatiskt även fabric-taggade byggen, eftersom Quilt kör Fabric-mods. Resultat som redan finns på servern visar en **Installerats**-etikett. Om en CurseForge-författare inte tillåter automatiserade nedladdningar - eller en SpigotMC-resurs är hostad externt - meddelar panelen detta direkt och erbjuder en **Öppna sida** + **Ladda upp jar**-väg istället för att misslyckas mitt i installationen.

  ![Hangar-sökning](/docs/images/mods-search-hangar.png)

- **Importera zip** - en knapp, tre former, automatiskt detekterat:
  - Ett **Modrinth modpack (`.mrpack`)**: varje fäst fil normaliseras tillbaka till sitt Modrinth-projekt via hash-uppslag (så importerade mods behåller riktiga namn, ikoner och förblir uppdateringsbara; filer som Modrinth inte känner till installeras från packens egen URL), verifieras mot packens sha512-checksummor under nedladdning, och förhandsgranskas med passande domar. Klient-specifika filer hoppas över synligt, och båda överlappande träd (`overrides/`, sedan `server-overrides/` - den server-specifika kopian vinner) kan tillämpas.

    ![mrpack-import](/docs/images/mrpack-import.png)

  - En **CurseForge modpack-export** (zip-filen som CurseForge-appen producerar, med `manifest.json`): varje fäst mod löses upp i bulk, förhandsgranskas med varningar (fel laddare/MC för denna server, filer som inte längre finns på CurseForge, mods som kräver manuell nedladdning), och installeras med verklig framsteg. Packens `overrides/` (konfigurationer, skript) kan också tillämpas - alla filer som skulle skrivas över säkerhetskopieras först till `.import-backups/<timestamp>/` inuti servermappen.
  - En **vanlig zip med jar-filer** som du samlat själv: varje jar identifieras (Modrinth hash-matchning → CurseForge fingeravtryck → jar-filens egen metadata) och bedöms mot servern - _passar / fel laddare / fel MC-version / redan installerad / oidentifierad_ - så du väljer vad som faktiskt hör hemma innan något installeras.
- **Lägg till via länk** - klistra in nästan vad som helst: Modrinth, CurseForge, Hangar eller SpigotMC projektsidor, en GitHub repo eller release URL (ett rent `ägare/repo` fungerar också - GitHub-installationer föredrar den senaste stabila releasen och hoppar över `-sources`/`-javadoc` sidokick-jars), en ren Modrinth-slug, eller någon direkt `.jar` URL. Panelens löser rätt bygg för serverns laddare och MC-version.

  ![Lägg till via länk](/docs/images/mods-add-by-link.png)

- **Ladda upp jar** (från sökfallbacken eller upplösaren för väntande nedladdningar) - uppladdade jar-filer identifieras på samma sätt, så de behåller sitt riktiga namn, version, ikon och blir uppdateringsbara.

Varje registerinstallation **verifieras med checksumma under nedladdning**: strömmen kontrolleras mot den starkaste digest som registret publicerar (sha512 → sha256 → sha1 → md5) och en mismatch avbryter innan något landar på servern.

En hel zip (`.mrpack` inkluderad) kan också **skapa en server**: i guiden under fliken _Från modpack_, ladda upp den och packens manifest (eller en majoritetsröstning bland de identifierade jar-filerna) fyller i laddaren, Minecraft-versionen och laddarens byggnummer.

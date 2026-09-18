---
title: 'Werelden & bestanden'
description: 'De pagina Werelden beheert de wereldgegevens van uw servers: wissel de actieve wereld, upload een wereld of download er een.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Terug naar de documentatie-index](/docs/)

## Werelden

De pagina **Werelden** beheert de wereldgegevens van uw servers: wissel de actieve wereld, upload een wereld of download er een.

![Werelden](/docs/images/worlds.png)

## De bestandsbeheerder

Onder de sectie **Wereld** van een server is het tabblad **Bestanden** een volledige bestandsbeheerder in de browser voor de gegevensmap van die server. Bestanden weergeven, lezen, bewerken, maken, hernoemen, verplaatsen, kopiëren, verwijderen en uploaden: alles wat u normaal via SSH zou doen, vanuit de browser.

![Bestandsbeheerder](/docs/images/server-files.png)

Tekstbestanden worden geopend in een editor met een limiet van 2 MB; grotere bestanden kunnen worden gedownload. Uploads accepteren meerdere bestanden tegelijk.

### Binnen de sandbox blijven

Elke bestandshandeling is beperkt tot de eigen gegevensmap van de server. Het paneel lost elk pad op en weigert alles wat zou ontsnappen: `..` traversals, absolute paden, en zelfs symlinks die buiten de map wijzen (inclusief bungelende die nog niet bestaan). Een mod of plugin kan geen link plaatsen om de bestandsbeheerder te misleiden om elders op de host te lezen of te schrijven.

## Mods

Voor servers met mods beheert het tabblad **Mods** (een eigen groep in de zijbalk van de server) de mod-set: blader door en voeg mods toe, en zie wat er is geïnstalleerd. Updates van mods en packs verschijnen op de pagina [Updates](/docs/updates/).

### Mods toevoegen

![Mods](/docs/images/mods.png)

Vier manieren, allemaal vanuit de werkbalk van het tabblad Mods:

- **Mods zoeken** - zoek op **Modrinth of CurseForge** (de CurseForge-chip verschijnt zodra een API-sleutel is opgeslagen onder Instellingen → API-sleutels), en op plugin-servers ook **Hangar** (het eigen plugin-register van PaperMC) en **SpigotMC** (via de CDN-proxy van Spiget) - beide zonder sleutel. Alles wordt gefilterd op de loader en Minecraft-versie van de server; Quilt-servers zien automatisch ook fabric-getagde builds, aangezien Quilt Fabric-mods draait. Resultaten die al op de server staan, tonen een **Geïnstalleerd**-badge. Als een CurseForge-auteur geautomatiseerde downloads niet toestaat - of een SpigotMC-resource wordt buiten de site gehost - zegt het paneel dit vooraf en biedt het een **Pagina openen** + **Jar uploaden**-pad in plaats van halverwege de installatie te falen.

  ![Hangar zoeken](/docs/images/mods-search-hangar.png)

- **Zip importeren** - één knop, drie vormen, automatisch gedetecteerd:
  - Een **Modrinth modpack (`.mrpack`)**: elk vastgepind bestand wordt canoniek teruggevoerd naar zijn Modrinth-project via hash-lookup (zodat geïmporteerde mods echte namen, pictogrammen behouden en controleerbaar blijven voor updates; bestanden die Modrinth niet kent, worden geïnstalleerd vanaf de eigen URL van het pack), geverifieerd tegen de sha512 checksums van het pack tijdens het downloaden, en voorgesteld met geschiktheidsbeoordelingen. Alleen-client bestanden worden zichtbaar overgeslagen, en beide override-trees (`overrides/`, dan `server-overrides/` - de server-specifieke kopie wint) kunnen worden toegepast.

    ![mrpack import](/docs/images/mrpack-import.png)

  - Een **CurseForge modpack export** (de zip die de app van CurseForge produceert, met `manifest.json`): elke vastgepinde mod wordt in bulk opgelost, voorgesteld met waarschuwingen (verkeerde loader/MC voor deze server, bestanden niet langer op CurseForge, mods die een handmatige download nodig hebben), en geïnstalleerd met echte voortgang. De `overrides/` van het pack (configs, scripts) kunnen optioneel ook worden toegepast - elk bestand dat zou worden overschreven, wordt eerst geback-upt in `.import-backups/<timestamp>/` binnen de servermap.
  - Een **gewone zip van jars** die u zelf hebt verzameld: elke jar wordt geïdentificeerd (Modrinth hash-match → CurseForge fingerprint → de eigen metadata van de jar) en beoordeeld ten opzichte van de server - _past / verkeerde loader / verkeerde MC-versie / al geïnstalleerd / niet geïdentificeerd_ - zodat u kiest wat er daadwerkelijk bij hoort voordat er iets wordt geïnstalleerd.
- **Toevoegen via link** - plak bijna alles: Modrinth, CurseForge, Hangar of SpigotMC projectpagina's, een GitHub repo of release URL (een kale `owner/repo` werkt ook - GitHub-installaties geven de voorkeur aan de nieuwste stabiele release en slaan `-sources`/`-javadoc` sidecar jars over), een kale Modrinth slug, of een directe `.jar` URL. Het paneel lost de juiste build op voor de loader en MC-versie van de server.

  ![Toevoegen via link](/docs/images/mods-add-by-link.png)

- **Jar uploaden** (vanuit de zoek-fallback of de wachtende-downloads resolver) - geüploade jars worden op dezelfde manier geïdentificeerd, zodat ze hun echte naam, versie, pictogram behouden en controleerbaar worden voor updates.

Elke registry-installatie wordt **checksum-geverifieerd tijdens het downloaden**: de stream wordt gecontroleerd tegen de sterkste digest die de registry publiceert (sha512 → sha256 → sha1 → md5) en een mismatch annuleert voordat er iets op de server landt.

Een hele zip (`.mrpack` inbegrepen) kan ook **een server maken**: in het wizard-tabblad _Van modpack_, upload deze en het pack-manifest (of een meerderheidstem over de geïdentificeerde jars) vult de loader, Minecraft-versie en loader-build in.

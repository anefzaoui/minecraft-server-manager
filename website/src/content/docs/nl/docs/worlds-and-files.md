---
title: 'Werelden & bestanden'
description: 'De wereldbibliotheek, werelduploads en -wisselingen, het tabblad mods en plugins, en de bestandsbeheerder in de browser.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Terug naar de documentatie-index](/docs/)

## Werelden

De pagina **Werelden** is de wereldbibliotheek: elke opgeslagen wereld op één plek. **Wereld Uploaden** neemt een `.zip` of `.tar` archief en vindt de wereld er automatisch in, **Opslaan in Bibliotheek** maakt een momentopname van de live wereld van een server (het werkt terwijl de server draait), en elke bibliotheekwereld kan worden gedownload of geïnstalleerd op elke server met **Installeren naar…**. Installeren vervangt de wereld van de server (de server moet gestopt zijn en de huidige wereld wordt eerst gebackupt) of voegt deze ernaast toe, om later te activeren. Een compatibiliteitscontrole wordt uitgevoerd vóór elke installatie.

Het eigen tabblad **Wereld → Werelden** van een server toont de werelden op die server. Vanaf daar kun je een andere wereld activeren (met de server gestopt), downloaden, dupliceren, hernoemen of [verkleinen](/docs/world-shrink/) een wereld, kopiëren naar een andere server, een inactieve verwijderen en de actieve wereld resetten met een nieuwe, behouden of aangepaste seed (een veiligheidsbackup wordt eerst aangeboden). Dezelfde bibliotheek staat hieronder, met **Hier Installeren**.

![Werelden](/docs/images/worlds.png)

## De bestandsbeheerder

Onder de sectie **Wereld** van een server, is het tabblad **Bestanden** een volledige bestandsbeheerder in de browser voor de gegevensmap van die server. Bestanden weergeven, lezen, bewerken, hernoemen, verplaatsen, kopiëren, verwijderen en uploaden, mappen maken en de tekst van bestanden onder een map zoeken met **Zoeken in Bestanden**: alles wat je normaal via SSH zou doen, vanuit de browser.

![Bestandsbeheerder](/docs/images/server-files.png)

Tekstbestanden worden geopend in een editor met een limiet van 8 MB; grotere bestanden kunnen worden gedownload. Uploads accepteren tot 20 bestanden tegelijk.

### Binnen de sandbox blijven

Elke bestandshandeling is beperkt tot de eigen gegevensmap van de server. Het paneel lost elk pad op en weigert alles wat zou ontsnappen: `..` traversals, absolute paden, en zelfs symlinks die buiten de map wijzen (inclusief bungelende die nog niet bestaan). Een mod of plugin kan geen link plaatsen om de bestandsbeheerder te misleiden om elders op de host te lezen of te schrijven.

## Mods

Voor gemodificeerde servers en servers met plugins beheert het tabblad **Mods** (een eigen groep in de serverzijbalk) de mod-set: mods bladeren en toevoegen, en zien wat geïnstalleerd is. Vanuit de rij van elke geïnstalleerde mod kun je deze updaten (of die update negeren), [ongedaan maken](/docs/updates/#undoing-a-mod-update), uitschakelen of verwijderen, en **Alles Updaten** past elke beschikbare update toe met één herstart. Mod- en pack-updates verschijnen ook op de pagina [Updates](/docs/updates/).

### Mods toevoegen

![Mods](/docs/images/mods.png)

Vier manieren, allemaal vanaf de werkbalk van het tabblad Mods:

- **Mods Zoeken**: zoek **Modrinth of CurseForge** (de CurseForge-chip verschijnt zodra een API-sleutel is opgeslagen onder **Instellingen → API-sleutels**), en op plugin-servers ook **Hangar** (de eigen plugin-register van PaperMC) en **SpigotMC** (via de CDN-proxy van Spiget), beide zonder sleutel. Een tabblad **Datapacks** zoekt naar datapacks van Modrinth. Alles wordt gefilterd op de loader en Minecraft-versie van de server (een selectievakje toont ook builds die niet als compatibel worden vermeld, op eigen risico); Quilt-servers zien automatisch ook fabric-getagde builds, aangezien Quilt Fabric-mods draait. Resultaten die al op de server staan, tonen een **Geïnstalleerd** badge. Als een CurseForge-auteur geautomatiseerde downloads niet toestaat (of een SpigotMC-resource buiten de site wordt gehost), zegt het paneel dit direct en biedt het een **CurseForge Openen** (of **SpigotMC Openen**) + **Jar Uploaden** pad in plaats van halverwege de installatie te falen.

  ![Hangar zoeken](/docs/images/mods-search-hangar.png)

- **Zip Importeren**: één knop, drie vormen, automatisch gedetecteerd:
  - Een **Modrinth modpack (`.mrpack`)**: elk vastgepind bestand wordt ge-kanoniseerd terug naar zijn Modrinth-project via hash-lookup (zodat geïmporteerde mods echte namen, iconen behouden en controleerbaar blijven voor updates; bestanden die Modrinth niet kent, worden geïnstalleerd vanaf de eigen URL van het pack), geverifieerd tegen de sha512 checksums van het pack tijdens het downloaden, en voorgesteld met passende beoordelingen. Client-only bestanden worden zichtbaar overgeslagen, en beide override-trees (`overrides/`, dan `server-overrides/`; de server-specifieke kopie wint) kunnen worden toegepast.

    ![mrpack importeren](/docs/images/mrpack-import.png)

  - Een **CurseForge modpack export** (de zip die de app van CurseForge produceert, met `manifest.json`): elke vastgepinde mod wordt in bulk opgelost, voorgesteld met waarschuwingen (verkeerde loader/MC voor deze server, bestanden niet meer op CurseForge, mods die een handmatige download nodig hebben), en geïnstalleerd met echte voortgang. De `overrides/` van het pack (configs, scripts) kunnen optioneel ook worden toegepast; elk bestand dat zou worden overschreven, wordt eerst gebackupt naar `.import-backups/<timestamp>/` binnen de servermap.
  - Een **platte zip van jars** die je zelf hebt verzameld: elke jar wordt geïdentificeerd (Modrinth hash-match → CurseForge fingerprint → de eigen metadata van de jar) en beoordeeld tegen de server (_past / verkeerde loader / verkeerde MC-versie / al geïnstalleerd / ongeïdentificeerd_), zodat je kiest wat er daadwerkelijk bij hoort voordat er iets wordt geïnstalleerd.
- **Toevoegen op URL**: plak bijna alles: Modrinth, CurseForge, Hangar, of SpigotMC projectpagina's, een GitHub repo of release URL (een kale `owner/repo` werkt ook; GitHub-installaties geven de voorkeur aan de nieuwste stabiele release en slaan `-sources`/`-javadoc` sidecar jars over), een kale Modrinth-slug, of een directe `.jar` URL. Het paneel lost de juiste build op voor de loader en MC-versie van de server.

  ![Toevoegen op link](/docs/images/mods-add-by-link.png)

- **Jar Uploaden** (vanuit de zoek-fallback of de wachtende-downloads resolver): geüploade jars worden op dezelfde manier geïdentificeerd, zodat ze hun echte naam, versie, icoon behouden en controleerbaar worden voor updates.

Elke registry-installatie wordt **checksum-geverifieerd tijdens het downloaden**: de stream wordt gecontroleerd tegen de sterkste digest die de registry publiceert (sha512 → sha256 → sha1 → md5) en een mismatch annuleert voordat er iets op de server landt.

Een hele zip (`.mrpack` inbegrepen) kan ook **een server maken**: in het tabblad **Van Modpack** van de wizard, upload deze en het pack-manifest (of een meerderheidsstem over de geïdentificeerde jars) vult de loader, Minecraft-versie en loader-build in.

---
title: 'Updates'
description: 'Volg en pas updates toe voor Minecraft-versies, modpacks, mods en plugins op elke server, met een beleid per server.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/updates.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Updates** houdt bij wat er verouderd is op al uw servers, op één plek:

- **Modpack**-versies ([modpacks](/docs/modpacks/)) vergeleken met Modrinth / CurseForge / de GTNH-release-index.
- **Aangepaste inhoud** die u zelf hebt toegevoegd (mods, datapacks, resource packs, plugins), elk vergeleken met de bron: Modrinth, CurseForge, Hangar, SpigotMC (Spiget) of GitHub Releases. GitHub-opvragingen gebruiken ETag-hervalidatie, dus dagelijkse controles raken de rate limit nauwelijks.
- **Docker image**-veroudering: de image-ID van elke servercontainer vergeleken met een vers gedownloade tag (gedupliceerd over servers met dezelfde tag), aangeboden als een upgrade die alleen opnieuw opbouwen vereist.
- **Standalone versie-vastpinnen**: voor een server zonder beheerd pack, een expliciete `mc_version`-pin vergeleken met Mojang's manifest, en een expliciete loader-build omgevingsvariabele (`PAPER_BUILD`, `FORGE_VERSION`, enz.) vergeleken met het register van de loader. Paper-builds komen van PaperMC's huidige **Fill v3 API** (het legacy v2-eindpunt ontving geen nieuwe Minecraft-versies meer). Op een server met mods wordt een nieuwere Minecraft-versie pas aangeboden nadat een [versiecontrole](#minecraft-version-compatibility) heeft aangetoond dat elke geïnstalleerde mod een build daarvoor heeft. Een vastgepinde Forge-server krijgt Forge's aanbevolen build aangeboden, nooit een build ouder dan degene waaraan deze is vastgepind, en een server die is vastgepind op een release krijgt nooit een pre-release aangeboden (een die al op een bèta staat, kan een nieuwere bèta of de release aangeboden krijgen). Het toepassen van een loader-build vereist eerst een back-up vóór de update. Het verplaatsen van een Forge- of NeoForge-server naar een nieuwe Minecraft-versie wist het vastgepinde loader-buildnummer, omdat een build voor één Minecraft-versie wordt gemaakt; een trefwoord zoals `latest` wordt behouden, omdat het de versie zelf volgt. Om zelf een specifieke build te kiezen, zie [de mod loader-versie wijzigen](#changing-the-mod-loader-version).

![Updates](/docs/images/updates.png)

## Hoe het werkt

Het paneel controleert de vastgepinde versies van elke server tegen de upstream bron en toont alles met een nieuwere release. Een overeenkomstig aantal verschijnt ook op de tegel "Updates beschikbaar" op het [dashboard](/docs/dashboard/).

Controles worden dagelijks uitgevoerd volgens een standaard [schema](/docs/schedules/) en op aanvraag met **Alles Nu Controleren**. **Negeren** op een rij stopt het aanbieden van die specifieke versie; een nieuwere wordt opnieuw aangeboden. De update **beleid** is per server: het paneel laat alles handmatig (de standaard, die de server ook van deze pagina houdt), informeert u alleen, of past pack-updates zelf toe ([update beleid](/docs/modpacks/#update-policy)).

## Minecraft versiecompatibiliteit

Een nieuwere Minecraft-versie is geen upgrade als uw mods niet mee kunnen. Elke server heeft zijn eigen **Versies** tabblad (onder Mods) dat die vraag beantwoordt:

- De versie die de server nu draait, en de **hoogste versie waarvoor elke geïnstalleerde mod een build heeft**.
- Eén inklapbare rij per toekomstige Minecraft-versie, met hoeveel mods gereed zijn en hoeveel er nog niets gepubliceerd hebben. Open een rij om te zien welke mods achterblijven en welke in orde zijn.

![Versiecompatibiliteit](/docs/images/server-versions.png)

Druk op **Toekomstige Versies Controleren** om het uit te voeren. Niets scant vanzelf: een controle leest elke jar in de mods-map van de server en vraagt Modrinth en CurseForge naar elk item, dus het gebeurt alleen wanneer u het vraagt. Voortgang en gedeeltelijke resultaten worden tijdens het proces geschreven, dus het sluiten van de pagina of vernieuwen verliest niets, en een controle die wordt onderbroken door een paneel-herstart zegt dit en biedt aan om opnieuw te draaien. Alles wat een onderbroken controle al had uitgewerkt, wordt bewaard, dus opnieuw uitvoeren herhaalt dat werk niet.

Een rapport beschrijft alleen de server waarvoor het is gemaakt. Wijzig de Minecraft-versie, de loader, of de mods zelf (voeg er een toe, verwijder er een, update er een) en het rapport wordt als verouderd gemarkeerd en stopt met gebruiken, totdat u de controle opnieuw uitvoert.

Mods worden geïdentificeerd uit de eigen bestandslijst van het modpack waar die er is, en anders op basis van de inhoud van het bestand, op dezelfde manier als een launcher een jar herkent. Twee soorten mods kunnen niet worden beantwoord, en geen van beide wordt geraden:

- **Kon niet worden geïdentificeerd**: een handgemaakte jar of een privé-build die geen van beide registers herkent.
- **Kon niet worden gecontroleerd**: een mod van GitHub Releases, Hangar of SpigotMC, of een mod waarvan het project is verwijderd. Deze publiceren geen lijst van welke Minecraft-versie elke build voor is.

Zolang een van beide is geïnstalleerd, biedt het paneel helemaal geen one-click Minecraft-versie-update aan, omdat het niet eerlijk kan zeggen wat er kapot zou gaan. Het toepassen van een versie boven wat de mods ondersteunen wordt geweigerd, en de mods die dit blokkeren worden benoemd.

Mods die u **uitgeschakeld** hebt, spelen geen rol: de server laadt ze niet, dus een mod uitzetten is een echte manier om een blokkade te omzeilen. Een mod aan- of uitzetten markeert het rapport voor hercontrole.

Dit geldt voor servers die mods draaien: Fabric, Forge, NeoForge en Quilt. Paper-stijl plugin-servers behouden het standaard nieuwste-release gedrag en hebben geen Versies tabblad, omdat twee van de registers waaruit plugins komen niets publiceren dat een controle kan lezen.

![Een versie geopend, met welke mods achter zouden blijven](/docs/images/server-versions-expanded.png)

Het openen van een versie toont eerst de mods zonder build ervoor (degenen die het antwoord bepalen) en houdt de gereed zijnde achter een klik. Grote packs laden pagina's met mods tegelijk, dus een server met 300 mods opent net zo snel als een met vijf mods.

## De mod loader-versie wijzigen

Het **Versies** tabblad heeft ook een **Loader Versie** kaart. Deze toont welke Forge, NeoForge, Fabric of Quilt build de server heeft geïnstalleerd en, waar deze kan worden gewijzigd, een keuzelijst om naar een andere te schakelen.

- **Een Forge, NeoForge, Fabric of Quilt server** kan elke gepubliceerde build draaien. De keuzelijst toont de recente builds voor de Minecraft-versie van de server, met Forge's aanbevolen en nieuwste builds gelabeld. **Andere Build…** neemt elke oudere door zijn nummer, en **Standaard** gaat terug naar het laten kiezen van de server.
- **Een Forge of Fabric CurseForge modpack** installeert de loader-versie die het eigen manifest verklaart, dus de gebruikelijke manier om deze te wijzigen is door het pack bij te werken. Wanneer het pack zelf de verkeerde versie vermeldt (een mod erin vraagt om een nieuwere Forge dan het pack installeert), kan de kaart deze overschrijven, en **De Versie van het Modpack** verwijdert de overschrijving weer. Het bijwerken van het pack verwijdert deze ook, omdat de nieuwe versie zijn eigen loader verklaart. Als de nieuwe versie nog steeds de verkeerde vermeldt, stel de overschrijving dan opnieuw in.
- **Een NeoForge CurseForge modpack, of een Modrinth modpack,** toont zijn loader maar kan niet worden overschreven: de server image past de overschrijving alleen toe op Forge en Fabric packs. De loader volgt de pack-versie, dus update het pack in plaats daarvan. Een FTB pack's loader kan hier ook niet worden gewijzigd. De kaart verschijnt meestal niet, omdat FTB's eigen installer records bijhoudt die het paneel niet leest.

Het paneel controleert of de build bestaat voordat het u iets vraagt. Een Forge- of NeoForge-build wordt gemaakt voor één Minecraft-versie, dus op een server die de nieuwste release volgt, houdt het vastpinnen van een build ook de server op de Minecraft-versie die deze nu draait (de bevestiging zegt dit). Kiezen voor **Standaard** daarna verwijdert de pin maar behoudt die Minecraft-versie. Een server die de nieuwste release volgde, kan ook naar een andere Java-image gaan wanneer deze opnieuw wordt opgebouwd, degene die die versie nodig heeft. Zo'n server die nog nooit is gestart, wordt gevraagd om eerst één keer te starten, zodat het paneel die versie kent. Forge slaat buildnummers over (er is geen 47.4.14 tussen 47.4.13 en 47.4.15), dus een mod die "47.4.14 of hoger vereist" wordt tevreden gesteld door de volgende build omhoog, en de weigering benoemt deze. Een wijziging vereist een back-up vóór de update, en bouwt vervolgens de server opnieuw op. De nieuwe build wordt geïnstalleerd de volgende keer dat de server start, en de kaart zegt dit tot dan toe.

## Een mod-update ongedaan maken

Elke build waaruit een mod is bijgewerkt, blijft in de gedeelde bibliotheek, dus een update die iets breekt, is omkeerbaar. De rij van de mod op het **Mods** tabblad krijgt een **Terugdraaien** knop die de vorige build terugzet. Er is geen download, dus het werkt zelfs als het project sindsdien uit zijn register is verwijderd. De build waarvandaan u bent teruggedraaid, wordt niet meer aangeboden totdat er een nieuwere verschijnt.

![Een mod terugdraaien naar de build waarvan deze is bijgewerkt](/docs/images/mods-revert.png)

## Een update toepassen

Updates zijn nooit stil. Wanneer u ervoor kiest om een pack bij te werken (of [het naar een andere versie te schakelen](/docs/modpacks/#changing-the-pack-version), inclusief oudere versies), doet het paneel het volgende:

1. Maakt een **back-up vóór de update** (dus het is omkeerbaar; standaard worden de laatste 10 back-ups vóór de update per server bewaard, zie [retentie](/docs/backups/#retention)).
2. Pind de exacte nieuwe versie opnieuw vast.
3. Bouwt de server opnieuw op, waarbij de Java-runtime indien nodig opnieuw wordt opgelost.
4. Monitort de eerste opstart, met een tijdslimiet per platform.

Als deze niet gezond opstart, rolt u terug naar de back-up vóór de update. Een server die stabiele versies volgt, krijgt nooit een bèta aangeboden, en de link naar het changelog wijst naar de daadwerkelijke per-versie diff waar de bron deze aanbiedt. Een mislukte update vuurt ook een Discord [waarschuwing](/docs/integrations/) af als de integratie is geconfigureerd.

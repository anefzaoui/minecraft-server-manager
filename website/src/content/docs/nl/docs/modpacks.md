---
title: 'Modpacks'
description: 'Installeer CurseForge, Modrinth, FTB en GT New Horizons modpacks als servers, altijd vastgezet op een exacte packversie.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Modpacks** (en het tabblad **Van Modpack** in de [wizard voor het maken](/docs/servers/)) installeert een modpack als server, altijd **vastgezet op een exacte packversie**, zodat een herstart nooit stilletjes de pack kan upgraden zonder dat je het merkt.

![Modpacks](/docs/images/modpacks.png)

## Ondersteunde platforms

- **CurseForge**: zoeken op naam. Vereist een CurseForge API-sleutel (voeg deze toe onder **Instellingen → API-sleutels**).
- **Modrinth**: zoeken op naam.
- **FTB**: Feed The Beast packs, alleen via de API (een numerieke pack-ID plus een expliciete versie-ID). Het paneel controleert FTB-packs nog niet op updates.
- **GT New Horizons**: de 1.7.10 expert pack, geïnstalleerd vanuit GTNH's eigen release-index. GTNH kiest zijn Java runtime per packversie (2.8.0+ draait op **Java 25** via gebundelde lwjgl3ify patches, oudere releases op Java 21 of 17), en de wizard verhoogt het RAM en de schijfruimte van de server naar redelijke minimumwaarden.
- **Aangepaste zip**: helemaal geen gepubliceerd pack. Upload een **CurseForge modpack-export** (de zip met `manifest.json` die de CurseForge-app produceert voor een handmatig geselecteerde modset), een **Modrinth `.mrpack`**, of **elke zip met mod jars**. Het paneel lost de manifesten in bulk op (of identificeert elke jar op hash/fingerprint/metadata), toont een voorbeeld van wat past, en installeert alles in één taak, inclusief de `overrides/` configuraties van het pack als je dat wilt. Mods waarvan de auteurs geautomatiseerde downloads niet toestaan, worden vermeld met een browsertlink en een handmatige upload-slot in plaats van de installatie te laten mislukken.

## Hoe vastzetten werkt

Wanneer je een pack kiest, lost het paneel de exacte versie op, registreert deze en installeert die. Op de pagina **Updates** word je geïnformeerd wanneer een nieuwere versie beschikbaar is (tenzij het [updatebeleid](#update-policy) van de server **Alleen Handmatig** is); upgraden is een bewuste, beveiligde actie met een back-up vóór de update en een rollback. Servers die stabiele versies volgen, krijgen nooit een bèta aangeboden. Het eigen tabblad **Versies** van een server beantwoordt de andere helft van de vraag: welke toekomstige Minecraft-versies de mods die het daadwerkelijk heeft, kunnen volgen ([updates](/docs/updates/#minecraft-version-compatibility)).

De mod loader-versie wordt ook meegeleverd met het pack: de server installeert de Forge, NeoForge of Fabric build die het pack declareert. Als een Forge of Fabric CurseForge pack er een declareert die te oud is voor zijn eigen mods, kan het tabblad **Versies** deze overschrijven totdat het pack is opgelost; een pack-update verwijdert de overschrijving, aangezien de nieuwe versie zijn eigen versie declareert ([de mod loader-versie wijzigen](/docs/updates/#changing-the-mod-loader-version)).

Servers die op zeer oude paneelversies (vóór 0.9.7) zijn gemaakt, konden _niet vastgezet_ blijven, wat betekende dat de container-image bij elke start stilletjes de nieuwste packversie zou installeren. Het paneel repareert deze nu bij het opstarten: het vergrendelt elk exemplaar op de versie die daadwerkelijk is geïnstalleerd (gelezen uit de eigen records van het paneel of het installatiemanifest van de image, nooit een vers opgeloste "nieuwste") en logt een gebeurtenis. Als het niet kan bepalen wat er is geïnstalleerd, toont de Instellingenpagina van de server een waarschuwing met een knop **Versie Kiezen…** (CurseForge, Modrinth en GTNH packs) die de [versiekiezer](#changing-the-pack-version) opent, en elke poging om een niet-vastgezette modpack-configuratie op te slaan, wordt onmiddellijk afgewezen.

## Updatebeleid

Elke server heeft een **Updatebeleid**-kaart op het tabblad **Instellingen → Configuratie**, en alle drie de opties betekenen wat ze zeggen:

- **Alleen Handmatig** (standaard): niets verandert vanzelf, en de server wordt volledig buiten de update-badge en de Updates-pagina gehouden. De "laat me met rust"-modus: ideaal voor een handmatig afgestemd of geïmporteerd pack dat je nooit wilt laten aanraken. Het vergrendelt de versie niet: [**Versie Wijzigen…**](#changing-the-pack-version) werkt onder elk beleid. Om op de hoogte te worden gebracht van nieuwe versies en deze met één klik toe te passen, kies **Meld het me**.
- **Meld het me**: de dagelijkse controle toont beschikbare updates als een badge en op de Updates-pagina; het toepassen ervan is altijd jouw klik.
- **Automatisch Updaten**: na de geplande dagelijkse controle worden wachtende **pack**-updates toegepast via hetzelfde beveiligde pad als een handmatige upgrade: back-up vóór de update, gezondheidsbewaking en een automatische rollback als de nieuwe versie niet opstart. Updates die de server naar een andere Minecraft-versie zouden verplaatsen, worden altijd overgeslagen met een gebeurtenis in plaats daarvan: het permanent converteren van een wereld is een beslissing die het paneel niet voor je wil nemen. De handmatige knoppen **Nu Controleren** controleren alleen; ze activeren nooit automatische updates.

## Een pack upgraden

Vanaf een vastgezette server kun je in één actie upgraden naar een nieuwere versie. Het paneel maakt eerst een back-up, wisselt de vastgezette versie, herbouwt de server (lost Java opnieuw op als de nieuwe versie een andere runtime nodig heeft) en bewaakt de eerste opstart, met een ruime marge voor grote packs zoals GTNH die een paar gigabytes downloaden en een wereld met honderden mods bouwen bij de eerste start.

## De packversie wijzigen

Om een specifieke versie te draaien, nieuwer of ouder, gebruik je **Versie Wijzigen…** op de packkaart van het tabblad **Overzicht** van de server. Op de pagina **Modpacks** geeft het openen van de kaart van een geïnstalleerd pack dezelfde keuze: kies een versie in de dropdown en klik op **Schakel naar Deze Versie**. Beide vereisen de **Content**-permissie van de server, en beide zijn beschikbaar voor CurseForge, Modrinth en GTNH packs (FTB packs hebben nog geen versie-lijst). De lijst toont de 25 nieuwste versies voor CurseForge en Modrinth, en elke GTNH-release.

De wisseling verloopt via hetzelfde beveiligde pad als een upgrade: een back-up vóór de update, de nieuwe pin, een herbouw en een bewaakte eerste opstart, met een rollback met één klik als de server niet gezond opkomt. Je aangepaste mods worden meegenomen, net als de pack-mods die je hebt uitgeschakeld, samen met de andere installatie-instellingen van het pack (gedwongen mods, te negeren bestanden, extra projecten). Het installeren van een ander pack start die instellingen opnieuw, omdat ze alleen zinvol zijn voor het pack waarvoor ze zijn gemaakt.

Elke versie wordt vermeld met de Minecraft-versie waarop deze draait, vergeleken met de versie waarmee je wereld het laatst is opgeslagen:

- **Zelfde Minecraft-versie**: schakelen na een normale bevestiging. Teruggaan naar een oudere packversie kan blokken en items laten vallen van mods die die versie niet heeft, dus de back-up blijft hoe dan ook in het tabblad Back-ups staan.
- **Nieuwere Minecraft-versie**: toegestaan na een bevestiging die waarschuwt dat de wereld permanent is geconverteerd. De back-up die eerst wordt gemaakt, is de enige weg terug naar de oude wereld.
- **Oudere Minecraft-versie**: niet beschikbaar. Minecraft kan geen wereld laden op een oudere versie dan degene die deze het laatst heeft opgeslagen, dus het paneel weigert in plaats van een server te laten crashen bij het opstarten.

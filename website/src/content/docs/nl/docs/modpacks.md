---
title: 'Modpacks'
description: "De Modpacks-pagina (en het tabblad 'Van modpack' in de wizard) installeert een modpack als server, altijd vastgezet op een exacte packversie zodat een herstart kan"
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Modpacks** (en het tabblad **Van modpack** in de [wizard voor het aanmaken](/docs/servers/)) installeert een modpack als server, altijd **vastgezet op een exacte pack-versie**, zodat een herstart het pack nooit stilletjes kan upgraden zonder dat je het merkt.

![Modpacks](/docs/images/modpacks.png)

## Ondersteunde platforms

- **CurseForge** - zoek of plak een pack-URL. Vereist een CurseForge API-sleutel voor zoeken en privé-packs (voeg deze toe onder Instellingen → API-sleutels).
- **Modrinth** - zoek op naam.
- **FTB** - Feed The Beast packs.
- **GT New Horizons** - het 1.7.10 expert pack, geïnstalleerd vanuit GTNH's eigen release-index. GTNH kiest zijn Java runtime per pack-versie (2.8.0+ draait op **Java 25** via gebundelde lwjgl3ify patches, oudere releases op Java 21 of 17), en de wizard verhoogt het RAM en de schijfruimte van de server naar zinnige minimumwaarden hiervoor.
- **Aangepaste zip** - helemaal geen gepubliceerd pack: upload een **CurseForge modpack-export** (de zip met `manifest.json` die de app van CurseForge produceert voor een handmatig gekozen set mods) of **elke zip met mod-jars**. Het paneel lost het manifest in bulk op via de CurseForge API (of identificeert elke jar op hash/fingerprint/metadata), toont een voorbeeld van wat past, en installeert alles in één taak - inclusief de `overrides/` configuraties van het pack als je hiervoor kiest. Mods waarvan de auteurs geautomatiseerde downloads niet toestaan, worden weergegeven met een browsertlink en een handmatige upload-slot in plaats van de installatie te laten mislukken.

## Hoe vastzetten werkt

Wanneer je een pack kiest, lost het paneel de exacte versie op, registreert deze en installeert die. Op de pagina **Updates** word je geïnformeerd wanneer een nieuwere versie beschikbaar is; upgraden is een bewuste, beveiligde actie met een back-up vóór de update en een rollback-mogelijkheid. Servers die stabiele versies volgen, krijgen nooit een bèta aangeboden.

Servers die op zeer oude paneelversies (vóór 0.9.7) zijn aangemaakt, konden _niet vastgezet_ zijn, wat betekende dat de container-image bij elke start stilletjes de nieuwste pack-versie zou installeren. Het paneel repareert deze nu bij het opstarten: het koppelt elk van deze aan de versie die daadwerkelijk is geïnstalleerd (gelezen uit de eigen gegevens van het paneel of het installatie-manifest van de image, nooit een vers opgeloste "latest") en logt een gebeurtenis. Als het niet kan achterhalen wat er is geïnstalleerd, toont de pagina Instellingen van de server een waarschuwing waarin je wordt gevraagd de versie handmatig te kiezen, en elke poging om een niet-vastgezette modpack-configuratie op te slaan, wordt direct geweigerd.

## Updatebeleid

Elke server heeft een updatebeleid in **Instellingen**, en alle drie de opties betekenen wat ze zeggen:

- **Alleen handmatig** - niets verandert vanzelf, en de server wordt volledig buiten beschouwing gelaten voor de update-badge en de Updates-pagina. De "laat me met rust"-modus: ideaal voor een handmatig afgestemd of geïmporteerd pack dat je nooit wilt laten aanraken.
- **Informeer mij** (standaard) - de dagelijkse controle toont beschikbare updates als een badge en op de Updates-pagina; het toepassen ervan is altijd jouw klik.
- **Automatisch updaten** - na de geplande dagelijkse controle worden wachtende **pack**-updates toegepast via hetzelfde beveiligde pad als een handmatige upgrade: back-up vóór de update, gezondheidsbewaking en een automatische rollback als de nieuwe versie niet opstart. Updates die de server naar een andere Minecraft-versie zouden verplaatsen, worden altijd overgeslagen met een gebeurtenis - het permanent converteren van een wereld is een beslissing die het paneel weigert voor je te nemen. De handmatige "nu controleren"-knoppen controleren alleen; ze activeren nooit automatische updates.

## Een pack upgraden

Vanaf een vastgezette server kun je in één actie upgraden naar een nieuwere versie. Het paneel maakt eerst een back-up, wisselt de vastgezette versie, reconstrueert de container (waarbij Java opnieuw wordt opgelost als de nieuwe versie een andere runtime nodig heeft) en bewaakt het eerste opstarten, met een ruime marge voor grote packs zoals GTNH die een paar gigabytes downloaden en een wereld met honderden mods bouwen bij de eerste start.

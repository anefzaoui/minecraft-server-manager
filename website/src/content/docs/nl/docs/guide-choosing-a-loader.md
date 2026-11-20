---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: welke?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge of Quilt: welk type Minecraft-server te draaien, gekozen op basis van wat je spelers installeren.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Terug naar de documentatie-index](/docs/)

Kies op basis van wat je spelers wilt laten installeren, niet op wat het snelst klinkt.

| Je wilt                                             | Draai dit          | Spelers installeren |
| --------------------------------------------------- | ------------------ | ------------------- |
| Survival met vrienden, niets ongewoons              | Vanilla            | Niets               |
| Een openbare server met rangen, claims en moderatie | Paper              | Niets               |
| Een specifieke modpack van CurseForge of Modrinth   | Wat er staat       | De pack             |
| Een moderne modpack die je zelf bouwt               | Fabric of NeoForge | Dezelfde mods       |
| Een oude pack uit het 1.7 tot 1.12 tijdperk         | Forge              | Dezelfde mods       |

Dat is voor de meeste mensen de hele beslissing. De rest van deze pagina legt uit waarom.

## Plugins en mods zijn niet hetzelfde

Dit is het onderscheid waar al het andere van afhangt.

**Plugins** draaien alleen op de server. Paper, Spigot en Bukkit laden ze. Spelers verbinden met een gewone,
ongewijzigde client en merken er niets van. Alles wat fundamenteel gaat over regels, permissies, economieën,
claims, minigames of moderatie is een plugin, en daarom draait bijna elke openbare server op Paper.

**Mods** veranderen het spel zelf: nieuwe blokken, nieuwe dimensies, nieuwe machines. De client moet
dezelfde mods laden als de server, anders kan hij niet begrijpen wat de server hem vertelt. Iedereen die
een modded server verbindt, installeert eerst de pack.

Een server kan niet zinvol beide zijn. Hybride projecten bestaan die een plugin API op een mod loader
bouwen, en ze werken totdat ze dat niet meer doen, meestal op het slechtste moment. Als je beide nodig hebt,
draai dan een proxy met een modded server en een plugin server erachter in plaats van één hybride.

## De plugin-kant

**Paper** is het standaardantwoord. Het is een fork van Spigot met jaren aan prestatieverbeteringen en een
configuratiebestand voor bijna elk gedrag dat een beheerder ooit heeft geïrriteerd. Vanilla plugins uit het
Bukkit-tijdperk werken meestal nog steeds.

**Purpur** is een fork van Paper met nog meer knoppen, waaronder gameplay-opties. Gebruik dit als je die
specifieke schakelaars wilt; anders Paper.

**Vanilla** is de moeite waard om te draaien als het punt het ongewijzigde spel is. Het is langzamer met veel
spelers en heeft geen permissiesysteem, dus moderatie is handmatig.

Paper verandert standaard wat vanilla-gedrag ten gunste van prestaties. Als een redstone-contraptie uit een
video niet werkt op je server, is dat meestal de reden, en het is meestal een instelling.

## De mod-kant

**Fabric** is klein, werkt binnen enkele dagen bij tot een nieuwe Minecraft-versie, en bevat de meeste moderne
prestatie-mods. Bijna elke Fabric mod heeft ook de Fabric API nodig, wat een aparte download is.
Als je doel een snelle server is met een handvol quality-of-life mods, is dit de juiste keuze.

**NeoForge** is waar het oude Forge-ecosysteem nu zijn werk doet voor huidige versies. Het splitste zich af
van Forge tijdens 1.20.1, en de meeste grote packs gebouwd voor 1.20.2 en later richten zich erop. Als je vandaag
een nieuw zwaar pack start, is dit de juiste keuze.

**Forge** beheerst nog steeds het verleden. Alles uit de 1.7.10, 1.12.2 en 1.16.5 tijdperken, wat een groot deel
is van de geliefde packs, is Forge en zal dat altijd blijven. Houd het daarvoor.

**Quilt** is een fork van Fabric die de meeste Fabric mods draait. Het bestaat om goede redenen, maar als je
geen specifieke reden hebt om het te kiezen, kies dan Fabric.

Mods voor de ene loader werken niet op de andere. Een mod-pagina die Fabric zegt, betekent Fabric.

## Als je een pack installeert, bepaalt de pack

Kies niet zelf. De pack vermeldt zijn loader en zijn exacte Minecraft-versie, en beide moeten overeenkomen.
"Dichtbij genoeg" bestaat hier niet: een pack voor 1.20.1 draait niet op 1.20.4, en een 1.20.1 NeoForge
pack draait niet op 1.20.1 Forge.

Installeer de pack via zijn ID of link in plaats van handmatig mods te kiezen, en pin de versie. Packs
updaten, en een update die midden in het seizoen onder je voeten landt, is hoe werelden corrupt raken.

## Welke Java-versie

Minecraft's vereiste beweegt mee met het spel, en het draaien van de verkeerde versie produceert een onbehulpzame
`UnsupportedClassVersionError` in plaats van een duidelijke melding.

| Minecraft-versie  | Java |
| ----------------- | ---- |
| 1.16.5 en eerder  | 8    |
| 1.17              | 16   |
| 1.18 en 1.19      | 17   |
| 1.20 tot 1.20.4   | 17   |
| 1.20.5 tot 1.21.x | 21   |
| 26.1 en later     | 25   |

Oude packs hebben echt Java 8 nodig; dit is een van de weinige plekken in software waar de nieuwste versie
verkeerd is.

## In Minecraft Server Manager

De creatiewizard vraagt wat je wilt draaien en kiest de Java-versie uit de bovenstaande tabel, zodat de
mismatch nooit per ongeluk gebeurt. Vanilla, Paper en Purpur staan op het tabblad **Vanilla**; het
tabblad **Van Mods** accepteert Fabric, Forge, NeoForge of Quilt, met de Minecraft-versie en een loader
build (de nieuwste, of een die je vastzet). Het installeren van een pack van CurseForge, Modrinth of GT New Horizons
pint het vast aan een exacte versie. Upgraden gebeurt alleen wanneer je het toepast (of na de dagelijkse controle,
als het updatebeleid van de server op **Automatisch bijwerken** staat), maakt altijd eerst een back-up en kan
worden teruggedraaid.

De mod-browser weet welke loader een server draait en filtert wat het aanbiedt, zodat een Fabric jar niet
per ongeluk op een NeoForge server terecht kan komen.

Gerelateerd: [servers maken en beheren](/docs/servers/), [modpacks](/docs/modpacks/),
[hoeveel RAM een server nodig heeft](/docs/guide-server-memory/).

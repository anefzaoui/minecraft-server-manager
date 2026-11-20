---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: hvilken?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge eller Quilt: hvilken type Minecraft-server skal kjøres, valgt basert på hva spillerne dine installerer.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Tilbake til dokumentindeks](/docs/)

Velg basert på hva du vil at spillerne skal installere, ikke basert på hva som høres raskest ut.

| Du vil ha                                          | Kjør dette            | Spillere installerer |
| -------------------------------------------------- | --------------------- | -------------------- |
| Survival med venner, ingenting uvanlig             | Vanilla               | Ingenting            |
| En offentlig server med ranger, krav og moderering | Paper                 | Ingenting            |
| En spesifikk modpack fra CurseForge eller Modrinth | Hva enn det står      | Pakken               |
| En moderne modpack du bygger selv                  | Fabric eller NeoForge | De samme moddene     |
| En gammel pakke fra 1.7 til 1.12-æraen             | Forge                 | De samme moddene     |

Det er hele avgjørelsen for de fleste. Resten av denne siden forklarer hvorfor.

## Plugins og mods er ikke det samme

Dette er skillet alt annet henger på.

**Plugins** kjører kun på serveren. Paper, Spigot og Bukkit laster dem. Spillere kobler seg til med en vanlig,
uendret klient og vet aldri. Alt som grunnleggende handler om regler, tillatelser, økonomier,
krav, minispill eller moderering er et plugin, og det er derfor nesten alle offentlige servere kjører Paper.

**Mods** endrer selve spillet: nye blokker, nye dimensjoner, nye maskiner. Klienten må laste de
samme moddene som serveren, ellers kan den ikke forstå hva serveren forteller den. Alle som kobler seg til en
moddet server, installerer pakken først.

En server kan ikke meningsfullt være begge deler. Hybridprosjekter finnes som fester et plugin-API til en modlaster,
og de fungerer til de ikke gjør det, vanligvis på verst tenkelige tidspunkt. Hvis du trenger begge, kjør en proxy med en
moddet server og en plugin-server bak den, heller enn én hybrid.

## Plugin-siden

**Paper** er standardløsningen. Det er en fork av Spigot med år med ytelsesforbedringer og en
konfigurasjonsfil for nesten enhver oppførsel som noensinne har irritert en administrator. Vanilla plugins
fra Bukkit-æraen fungerer stort sett fortsatt.

**Purpur** er en fork av Paper med enda flere innstillinger, inkludert spillrelaterte. Bruk den hvis du vil ha
disse spesifikke bryterne; ellers Paper.

**Vanilla** er verdt å kjøre når poenget er det uendrede spillet. Det er tregere med mange spillere,
og det har ikke noe tillatelsessystem, så moderering er manuell.

Paper endrer noe vanilla-oppførsel som standard for å forbedre ytelsen. Hvis en redstone-konstruksjon
fra en video ikke fungerer på serveren din, er det vanligvis grunnen, og det er vanligvis en innstilling.

## Mod-siden

**Fabric** er liten, oppdateres til en ny Minecraft-versjon i løpet av dager, og bærer de fleste moderne
ytelsesmods. Nesten alle Fabric-mods krever også Fabric API, som er en separat nedlasting.
Hvis målet ditt er en rask server med en håndfull livskvalitets-mods, er dette den.

**NeoForge** er der det gamle Forge-økosystemet nå gjør sitt arbeid for gjeldende versjoner. Det skilte seg fra
Forge under 1.20.1, og de fleste store pakker bygget for 1.20.2 og senere retter seg mot den. Hvis du starter en
ny tungvekterpakke i dag, er dette den.

**Forge** eier fortsatt fortiden. Alt fra 1.7.10, 1.12.2 og 1.16.5-æraene, som er en stor del
av de elskede pakkene, er Forge og vil alltid være det. Behold den for disse.

**Quilt** er en fork av Fabric som kjører de fleste Fabric-mods. Den eksisterer av gode grunner, men hvis du ikke har
noen spesifikk grunn til å velge den, velg Fabric.

Mods for én laster kjører ikke på en annen. En mod-side som sier Fabric betyr Fabric.

## Hvis du installerer en pakke, bestemmer pakken

Ikke velg. Pakken lister opp sin laster og sin eksakte Minecraft-versjon, og begge må stemme overens.
"Nesten" er ikke noe her: en pakke for 1.20.1 kjører ikke på 1.20.4, og en 1.20.1 NeoForge-pakke
kjører ikke på 1.20.1 Forge.

Installer pakken etter ID eller lenke heller enn å plukke mods manuelt, og fest versjonen. Pakker
oppdateres, og en oppdatering som lander under føttene dine midt i sesongen er slik verdener blir korrupte.

## Hvilken Java-versjon

Minecrafts krav flytter seg med spillet, og å kjøre feil versjon gir en lite hjelpsom
`UnsupportedClassVersionError` i stedet for en klar melding.

| Minecraft-versjon   | Java |
| ------------------- | ---- |
| 1.16.5 og tidligere | 8    |
| 1.17                | 16   |
| 1.18 og 1.19        | 17   |
| 1.20 til 1.20.4     | 17   |
| 1.20.5 til 1.21.x   | 21   |
| 26.1 og senere      | 25   |

Gamle pakker trenger virkelig Java 8; dette er et av de få stedene i programvare der den nyeste versjonen
er feil.

## I Minecraft Server Manager

Opprettingsveiviseren spør hva du vil kjøre og velger Java-versjonen fra tabellen over, slik at
mismatchen aldri skjer ved et uhell. Vanilla, Paper og Purpur er på fanen **Vanilla**; fanen
**Fra Mods** tar Fabric, Forge, NeoForge eller Quilt, med Minecraft-versjonen og en laster-
build (den siste, eller en du fester). Å installere en pakke fra CurseForge, Modrinth eller GT New Horizons
fester den til en eksakt versjon. Oppgradering skjer bare når du bruker den (eller etter daglig sjekk, hvis
serverens oppdateringspolicy er **Auto-Update**), tar alltid en sikkerhetskopi først, og kan rulles tilbake.

Mod-leseren vet hvilken laster en server kjører og filtrerer hva den tilbyr deretter, slik at en Fabric
jar ikke kan havne på en NeoForge-server ved en feiltakelse.

Relatert: [opprette og administrere servere](/docs/servers/), [modpacks](/docs/modpacks/),
[hvor mye RAM en server trenger](/docs/guide-server-memory/).

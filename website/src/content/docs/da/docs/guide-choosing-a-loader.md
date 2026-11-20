---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: hvilken?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge eller Quilt: hvilken type Minecraft-server skal du køre, valgt ud fra hvad dine spillere installerer.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Tilbage til docs-indeks](/docs/)

Vælg ud fra, hvad du vil have spillere til at installere, ikke ud fra, hvad der lyder hurtigst.

| Du vil have                                       | Kør dette             | Spillere installerer |
| ------------------------------------------------- | --------------------- | -------------------- |
| Survival med venner, intet usædvanligt            | Vanilla               | Intet                |
| En offentlig server med rang, krav og moderation  | Paper                 | Intet                |
| En specifik modpack fra CurseForge eller Modrinth | Hvad den siger        | Pakken               |
| En moderne modpack, du selv bygger                | Fabric eller NeoForge | De samme mods        |
| En gammel pakke fra 1.7 til 1.12-æraen            | Forge                 | De samme mods        |

Det er hele beslutningen for de fleste. Resten af denne side forklarer hvorfor.

## Plugins og mods er ikke det samme

Dette er skelnen, alt andet hænger på.

**Plugins** kører kun på serveren. Paper, Spigot og Bukkit indlæser dem. Spillere forbinder med en almindelig,
uændret klient og ved det aldrig. Alt, der grundlæggende handler om regler, tilladelser, økonomier,
krav, minispil eller moderation, er et plugin, og det er derfor, næsten enhver offentlig server kører Paper.

**Mods** ændrer selve spillet: nye blokke, nye dimensioner, nye maskiner. Klienten skal indlæse
de samme mods som serveren, ellers kan den ikke forstå, hvad serveren fortæller den. Enhver, der forbinder til
en modded server, installerer pakken først.

En server kan ikke meningsfuldt være begge dele. Hybride projekter findes, der bolter et plugin API på en mod loader,
og de virker, indtil de ikke gør, normalt på det værst tænkelige tidspunkt. Hvis du har brug for begge dele, kør en proxy med en
modded server og en plugin server bagved i stedet for en hybrid.

## Plugin-siden

**Paper** er standardløsningen. Det er en fork af Spigot med års performance-arbejde og en
konfigurationsfil for næsten enhver adfærd, der nogensinde har irriteret en administrator. Vanilla plugins
fra Bukkit-æraen kører mest stadig.

**Purpur** er en fork af Paper med endnu flere knapper, herunder gameplay-relaterede. Tag den, hvis du vil have
disse specifikke kontakter; ellers Paper.

**Vanilla** er værd at køre, når pointen er det uændrede spil. Det er langsommere med mange spillere,
og det har intet tilladelsessystem, så moderation er manuel.

Paper ændrer som standard visse vanilla-adfærd for at forbedre performance. Hvis en redstone-konstruktion
fra en video ikke virker på din server, er det normalt årsagen, og det er normalt en indstilling.

## Mod-siden

**Fabric** er lille, opdateres til en ny Minecraft-version inden for få dage og bærer de fleste moderne
performance-mods. Næsten enhver Fabric mod ønsker også Fabric API, som er en separat download.
Hvis dit mål er en hurtig server med en håndfuld quality-of-life mods, er dette den.

**NeoForge** er hvor det gamle Forge-økosystem nu udfører sit arbejde for aktuelle versioner. Det splittede fra
Forge under 1.20.1, og de fleste store pakker bygget til 1.20.2 og senere målretter det. Hvis du starter en
ny tungvægts pakke i dag, er dette den.

**Forge** ejer stadig fortiden. Alt fra 1.7.10, 1.12.2 og 1.16.5 æraerne, hvilket er en stor del
af de elskede pakker, er Forge og vil altid være. Behold den til dem.

**Quilt** er en fork af Fabric, der kører de fleste Fabric mods. Den eksisterer af gode grunde, men hvis du ikke har
nogen specifik grund til at vælge den, så vælg Fabric.

Mods til én loader kører ikke på en anden. En mod-side, der siger Fabric, betyder Fabric.

## Hvis du installerer en pakke, bestemmer pakken

Vælg ikke. Pakken angiver sin loader og sin præcise Minecraft-version, og begge skal matche.
"Tæt på" eksisterer ikke her: en pakke til 1.20.1 kører ikke på 1.20.4, og en 1.20.1 NeoForge
pakke kører ikke på 1.20.1 Forge.

Installer pakken ud fra dens ID eller link i stedet for manuelt at vælge mods, og fastgør versionen. Pakker
opdateres, og en opdatering, der lander under dine fødder midt i en sæson, er, hvordan verdener bliver korrupte.

## Hvilken Java-version

Minecrafts krav bevæger sig med spillet, og at køre den forkerte version giver en ubrugelig
`UnsupportedClassVersionError` i stedet for en klar besked.

| Minecraft version   | Java |
| ------------------- | ---- |
| 1.16.5 og tidligere | 8    |
| 1.17                | 16   |
| 1.18 og 1.19        | 17   |
| 1.20 til 1.20.4     | 17   |
| 1.20.5 til 1.21.x   | 21   |
| 26.1 og senere      | 25   |

Gamle pakker kræver virkelig Java 8; dette er et af de få steder i software, hvor den nyeste version
er forkert.

## I Minecraft Server Manager

Oprettelsesguiden spørger, hvad du vil køre, og vælger Java-versionen fra tabellen ovenfor, så
mismatchet aldrig sker ved et uheld. Vanilla, Paper og Purpur er på dens **Vanilla**-fane;
**Fra Mods**-fanen tager Fabric, Forge, NeoForge eller Quilt, med Minecraft-versionen og en loader
build (den seneste, eller en du fastgør). Installation af en pakke fra CurseForge, Modrinth eller GT New Horizons
fastgør den til en præcis version. Opgradering sker kun, når du anvender den (eller efter den daglige kontrol, hvis
serverens opdateringspolitik er **Auto-Update**), tager altid en backup først og kan rulles tilbage.

Mod-browseren ved, hvilken loader en server kører, og filtrerer, hvad den tilbyder derefter, så en Fabric
jar ikke kan lande i en NeoForge-server ved en fejl.

Relateret: [oprettelse og administration af servere](/docs/servers/), [modpacks](/docs/modpacks/),
[hvor meget RAM en server behøver](/docs/guide-server-memory/).

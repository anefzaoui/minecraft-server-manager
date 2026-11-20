---
title: 'Hur mycket RAM behöver en Minecraft-server?'
description: 'Hur mycket RAM en Minecraft-server behöver för vanilla, Paper, lätta mods och stora modpacks, samt hur mycket som ska lämnas över till maskinen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Tillbaka till dokumentindex](/docs/)

Kort svar, för en server som faktiskt ska spelas på:

| Vad du kör                                       | Java heap    | Ge maskinen |
| ------------------------------------------------ | ------------ | ----------- |
| Vanilla eller Paper, upp till 10 spelare         | 2 GB         | 4 GB        |
| Paper med plugins, 10 till 30 spelare            | 4 GB         | 6 GB        |
| Ett lätt modpack, 40 till 80 mods                | 4 GB         | 6 GB        |
| Ett stort "kitchen-sink"-pack, 150 till 300 mods | 6 till 8 GB  | 10 GB       |
| GregTech New Horizons och liknande monster       | 8 till 12 GB | 16 GB       |

Två siffror, inte en. Det är den del som de flesta guider hoppar över, och det är anledningen till att folk köper en 4 GB-server, ger Java 4 GB, och sedan ser den dö.

## Heapen och maskinen är olika siffror

Java heapen (`-Xmx`) är hur mycket minne spelet självt får använda för världen, entiteter och moddata. Maskinen, eller containern, måste rymma den heapen **plus** allt annat som Java behöver: klassmetadata, trådstaplar, skräpsamlarkontroll, nätverksbuffertar och själva JVM:en. Den overheaden är ungefär 0,5 till 1,5 GB för en moddad server.

Om heapen är lika med maskinens minne, dödar kärnan servern i samma ögonblick som Java når för den overheaden. I Docker visas detta som avslutningskod 137, och i loggarna som ingenting alls: processen försvinner helt enkelt mitt i en mening. Folk skyller oftast på en mod.

En säker regel: **heap plus 25 procent, och minst en ledig gigabyte.** En 8 GB heap kräver en 10 GB maskin.

## Mer RAM är inte mer prestanda

Minecraft är enkeltrådsbunden i det mesta den gör. Att ge ett 40-mods pack 16 GB gör inte att chunks genereras snabbare; det gör att varje skräpsamlingspaus blir längre, eftersom det finns mer att gå igenom. En server som hackar var trettionde sekund är ofta en server med för mycket heap, inte för lite.

Öka heapen när du ser detta, och inte annars:

- `java.lang.OutOfMemoryError: Java heap space` i loggen.
- Upprepade "Can't keep up! Is the server overloaded?" med skräpsamlingspauser i tidsmätningarna.
- Minnesanvändning som klättrar till taket och stannar där i timmar.

## Varför din server visar 12 GB använd medan ingen är online

För att du har sagt åt den att göra det. Två standardinställningar samverkar:

1. Den vanliga Docker-imagen sätter start-heapen lika med max, så `-Xms` och `-Xmx` är båda ditt nummer. Java reserverar det direkt istället för att växa in i det.
2. Den populära Aikar flagg-uppsättningen inkluderar `-XX:+AlwaysPreTouch`, som går igenom varje sida av heapen vid uppstart så att sidorna verkligen allokeras. Det är avsiktligt: det byter en långsammare start och en hög idle-siffra mot färre pauser senare.

Mätt på Paper 1.21.1 med en 2 GB heap i en 4 GB container, samplad i tre minuter efter att världen laddats klart:

| Konfiguration                          | Resident memory |
| -------------------------------------- | --------------- |
| Inga flaggor                           | 2.60 GiB        |
| Aikar flaggor                          | 2.59 GiB        |
| Aikar flaggor utan `AlwaysPreTouch`    | 1.95 GiB        |
| Aikar flaggor med en 512 MB start-heap | 1.38 GiB        |
| Inga flaggor med en 512 MB start-heap  | 1.25 GiB        |

Så en server som "använder" 12 GB vid idle är oftast en 12 GB heap som har förbehandlats, inte en läcka. Din övervakning läser den korrekt; siffran betyder bara inte vad den ser ut att göra.

Om du vill ha en ärlig idle-siffra, sätt start-heapen lägre än max. Du betalar för det med några fler insamlingar tidigt. Om du hellre vill ha jämna bildtider, låt det vara och sluta titta på grafen.

## Spelare spelar mindre roll än du tror

Att dubbla från 10 till 20 spelare kostar långt mindre än att lägga till femtio mods. Spelare lägger mest till entiteter och laddade chunks, vilket skalar mjukt. Mods lägger till klassdata, register, världgenereringsfunktioner och sina egna cacheminnen, vilket inte gör det. Storlek för packen först, lägg sedan till ungefär 100 till 200 MB per vanlig spelare på en moddad server.

Visningsavstånd är den andra stora spaken. Att sänka från 12 till 8 chunks kan spara en gigabyte på en upptagen server och märks knappt i spelet.

## I Minecraft Server Manager

Varje server har två separata fält, **Java heap** och **container minnesgräns**, just för att de är olika frågor. Skapar-guiden sätter containergränsen 50 procent över heapen åt dig, och panelen vägrar att spara en server vars containergräns inte är över dess heap, eftersom den kombinationen slutar med avslutningskod 137 snarare än ett felmeddelande.

Minnesmätaren på en server visar vad containern verkligen använder, med en notering när heapen hämtades upp i förväg, så en förbehandlad heap läses inte som en som löper amok. En server som kärnan dödade för minne registreras exakt så i historiken, snarare än som en mystisk krasch.

Relaterat: [skapa och hantera servrar](/docs/servers/),
[kraschrapporter](/docs/servers/#crash-reports--mclogs-analysis), [lagring och kvoter](/docs/storage/).

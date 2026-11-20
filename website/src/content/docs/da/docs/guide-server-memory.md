---
title: 'Hvor meget RAM har en Minecraft-server brug for?'
description: 'Hvor meget RAM en Minecraft-server har brug for til vanilla, Paper, lette mods og store modpacks, og hvor meget der skal efterlades til maskinen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Tilbage til dokumentindeks](/docs/)

Kort svar, for en server der rent faktisk skal spilles på:

| Hvad du kører                                  | Java heap   | Giv maskinen |
| ---------------------------------------------- | ----------- | ------------ |
| Vanilla eller Paper, op til 10 spillere        | 2 GB        | 4 GB         |
| Paper med plugins, 10 til 30 spillere          | 4 GB        | 6 GB         |
| En let modpakke, 40 til 80 mods                | 4 GB        | 6 GB         |
| En stor "kitchen-sink" pakke, 150 til 300 mods | 6 til 8 GB  | 10 GB        |
| GregTech New Horizons og lignende monstre      | 8 til 12 GB | 16 GB        |

To tal, ikke ét. Det er den del, de fleste guides springer over, og det er grunden til, at folk køber en 4 GB
server, giver Java 4 GB, og derefter ser den dø.

## Heap og maskine er forskellige tal

Java heap (`-Xmx`) er hvor meget hukommelse spillet selv må bruge til verdenen, entiteter og moddata. Maskinen, eller containeren, skal rumme den heap **plus** alt andet, som Java har brug for:
klassemetadata, tråd-stacks, garbage-collector bogføring, netværksbuffere og selve JVM'en.
Den overhead er cirka 0,5 til 1,5 GB for en modded server.

Hvis heapen er lig med maskinens hukommelse, dræber kernen serveren i det øjeblik, Java rækker ud efter den overhead. I Docker vises det som exit code 137, og i loggene som ingenting overhovedet: processen forsvinder simpelthen midt i en sætning. Folk bebrejder normalt et mod.

En sikker regel: **heap plus 25 procent, og mindst en ekstra gigabyte.** En 8 GB heap kræver en 10 GB
maskine.

## Mere RAM er ikke mere ydeevne

Minecraft er single-thread bundet i det meste af, hvad det gør. At give en 40-mod pakke 16 GB gør ikke
chunks hurtigere; det gør hver garbage collection pause længere, fordi der er mere at gennemgå. En server, der hakker hvert tredive sekund, er ofte en server med for meget heap, ikke for lidt.

Forøg heapen, når du ser disse, og ikke ellers:

- `java.lang.OutOfMemoryError: Java heap space` i loggen.
- Gentagne "Can't keep up! Is the server overloaded?" med garbage-collection pauser i timingen.
- Hukommelsesforbrug, der klatrer til loftet og bliver der i timevis.

## Hvorfor din server viser 12 GB brugt, mens ingen er online

Fordi du har bedt den om det. To standardindstillinger konspirerer:

1. Det almindelige Docker-image sætter start-heap lig med maksimum, så `-Xms` og `-Xmx` er
   begge dit tal. Java reserverer det på forhånd i stedet for at vokse ind i det.
2. Det populære Aikar flag-sæt inkluderer `-XX:+AlwaysPreTouch`, som gennemgår hver side af den heap ved
   opstart, så siderne bliver rigtigt allokeret. Det er bevidst: det bytter en langsommere opstart og et stort
   idle-tal for færre pauser senere.

Målt på Paper 1.21.1 med en 2 GB heap i en 4 GB container, samplet i tre minutter efter verdenen var færdig med at loade:

| Konfiguration                        | Resident memory |
| ------------------------------------ | --------------- |
| Ingen flags                          | 2.60 GiB        |
| Aikar flags                          | 2.59 GiB        |
| Aikar flags uden `AlwaysPreTouch`    | 1.95 GiB        |
| Aikar flags med en 512 MB start heap | 1.38 GiB        |
| Ingen flags med en 512 MB start heap | 1.25 GiB        |

Så en server, der "bruger" 12 GB ved idle, er normalt en 12 GB heap, der er blevet pre-touched, ikke en læk.
Din overvågning læser det korrekt; tallet betyder bare ikke, hvad det ser ud til.

Hvis du vil have et ærligt idle-tal, sæt start-heap lavere end maksimum. Du betaler for det med et par flere collections tidligt. Hvis du hellere vil have stabile billedhastigheder, lad det være og stop med at se på grafen.

## Spillere betyder mindre, end du tror

Fordobling fra 10 til 20 spillere koster langt mindre end at tilføje halvtreds mods. Spillere tilføjer mest entiteter og loaded chunks, som skalerer blidt. Mods tilføjer klassedata, registre, verden-genereringsfunktioner og deres egne caches, som ikke gør. Størrelse til pakken først, tilføj derefter cirka 100 til 200 MB per almindelig spiller på en modded server.

View distance er den anden store faktor. At falde fra 12 til 8 chunks kan spare en gigabyte på en travl server og er knap mærkbar i spillet.

## I Minecraft Server Manager

Hver server har to separate felter, **Java heap** og **container memory limit**, netop fordi de er forskellige spørgsmål. Oprettelsesguiden sætter container-grænsen 50 procent over heapen for dig, og panelet nægter at gemme en server, hvis container-grænse ikke er over dens heap, fordi den kombination ender med exit code 137 snarere end en fejlmeddelelse.

Hukommelsesmeteret på en server viser, hvad containeren reelt bruger, med en note, når heapen blev reserveret på forhånd, så en pre-touched heap ikke læses som løbsk. En server, som kernen dræbte for hukommelse, registreres præcist som det i historikken, snarere end som et mystisk crash.

Relateret: [oprettelse og administration af servere](/docs/servers/),
[crash reports](/docs/servers/#crash-reports--mclogs-analysis), [lagerplads og kvoter](/docs/storage/).

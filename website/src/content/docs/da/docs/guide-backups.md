---
title: 'Minecraft-server-sikkerhedskopier, der rent faktisk kan gendannes'
description: 'Sådan laver du Minecraft-server-sikkerhedskopier, der rent faktisk kan gendannes: konsistente kopier, gemt et andet sted og testet mindst én gang.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Tilbage til dokumentindeks](/docs/)

De fleste servere har backups. Langt færre har backups, der virker, og forskellen opdages kun på den værste dag. Tre ting adskiller dem: kopien er konsistent, den ligger et andet sted, og nogen har gendannet den mindst én gang.

## Kopier verden, mens der ikke skrives til den

En kørende server skriver konstant til regionsfiler. Kopier dem midt i en skrivning, og du får en fil, der er halvt gammel og halvt ny, som enten ikke kan indlæses eller indlæses med et hul i jorden, hvor nogens base plejede at være. Intet advarer dig, fordi kopieringen lykkedes.

Der er to korrekte måder at tage en kopi på:

1. **Stop serveren**, kopier, start den igen. Simpelt, ærligt og upopulært på grund af nedetiden.
2. **Bed spillet om at stoppe med at skrive først.** Kør `save-off`, derefter `save-all flush`, vent på, at det er færdigt, kopier, og kør så `save-on`. Verden er komplet og stille under kopieringen.

Spring aldrig direkte til kopieringen. Et snapshot på filsystem- eller volumeniveau er kun fint, hvis det er ægte atomisk, og en `cp -r`, mens spillere placerer blokke, er det ikke.

## Tag backup af mere end bare verden

Gendannelse af kun verden giver dig terrænet og mister serveren. Du vil også have:

- `server.properties`, og alt andet, der sætter reglerne.
- Mod- eller plugin-jars, i de nøjagtige versioner, der kørte. En verden kan ikke indlæses uden de mods, der skabte dens blokke.
- Spillernes data, inklusive `whitelist.json`, `ops.json` og mapperne for statistik og fremskridt.
- Pakkeversionen, hvis den kom fra en pakke. At skrive den ned tæller.

Den hurtigste fornuftighedskontrol af enhver backup: kan du genopbygge denne server på en frisk maskine udelukkende fra arkivet? Hvis svaret kræver en sætning, der starter med "og så ville jeg geninstallere", er det ikke en komplet backup.

## Én kopi på samme disk er ikke en backup

En backup, der ligger på den maskine, den beskytter, dækker præcis én fejl: du har slettet noget. Den dækker ikke disken, der dør, udbyderen, der suspenderer kontoen, eller en fejl, der sletter hele mappen.

Hold det simpelt snarere end perfekt:

- Én lokal kopi til det almindelige tilfælde, som er nogen, der laver hærværk eller en dårlig opdatering.
- Én kopi et andet sted. En anden maskine, et objektlager eller en hjemme-NAS, der trækker natligt over SSH.
- Nok historik til at overleve et problem, du ikke bemærkede med det samme. Korruption opdages ofte dage senere, og hvis du gemmer tre dages backups, har du allerede overskrevet den gode.

Syv daglige kopier plus fire ugentlige dækker næsten enhver reel hændelse og koster meget lidt plads.

## Test en gendannelse, før du får brug for en

Vælg en backup, gendan den til en ekstra server, og tilslut. Det er hele testen, det tager femten minutter, og det fanger alle de klassiske fejl: arkivet mangler mod-mappen, en verden, der kræver en version, du ikke længere kører, tilladelser, der gør filerne ulæselige, en afbrudt upload.

Gør det én gang, når du sætter backups op, og én gang mere efter enhver større ændring på serveren.

## Størrelse, og hvordan man holder den fornuftig

Verdener vokser, fordi spillere udforsker. En verden, hvor nogen har fløjet ti tusind blokke i en lige linje, bærer alle chunks langs den linje for evigt, og de fleste af disse chunks vil aldrig blive besøgt igen.

Tre håndtag, i rækkefølge efter hvor meget de giver tilbage:

1. **Trim ubesøgte chunks.** Værktøjer, der beskærer efter sidst-berørt tid, fjerner typisk en stor del af en velbesøgt verden uden synlig effekt i spillet.
2. **Komprimer ordentligt.** Regionsfiler komprimerer godt; arkiver af dem drager ikke fordel af noget eksotisk.
3. **Gem ikke enhver timekopi i et år.** Opbevaring slår komprimering.

## I Minecraft Server Manager

Backups følger stien `save-off`, flush, copy, `save-on`, og en stop- eller genstartsanmodning midt i en backup afvises, indtil kopieringen er færdig, snarere end at køre om kap med den. Arkivet dækker hele servermappen, så mods, konfiguration og spillerdata følger med verden.

Backups kan køre på en tidsplan sammen med genstarter og kommandoer, og enhver ny server starter med en daglig backup-tidsplan. Opbevaring tæller hver slags separat, så de ti planlagte kopier, der samler sig af sig selv, ikke kan skubbe den fra, du tog manuelt før en risikabel ændring, og alders- og størrelsesgrænser gælder oveni. Administratorer ændrer alt dette på Indstillinger-siden eller pr. server på dens Backups-fane. Gendannelse tager først en ny backup, så en gendannelse til det forkerte tidspunkt er i sig selv uigenkaldelig. En verden kan krympes alene eller som en del af en backup, hvilket er det håndtag, der betyder mest for størrelsen.

Hele panelet, inklusive enhver backup, lever under én mappe. At kopiere den mappe et andet sted hen er den halvdel af historien, der er uden for maskinen, og det er bevidst den eneste ting, du skal kopiere.

Relateret: [backups i panelet](/docs/backups/), [tidsplaner](/docs/schedules/),
[krympning af en verden](/docs/world-shrink/), [flytning af en server til en anden vært](/docs/guide-moving-a-server/).

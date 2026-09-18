---
title: 'Krympa en värld'
description: 'Med tiden sprider sig en värld ut: varje plats en spelare någonsin har gått, flugit eller'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Tillbaka till dokumentindex](/docs/)

Med tiden sprider sig en värld ut: varje plats en spelare någonsin har gått, flugit eller transporterats med en Ender Pearl lämnar genererade bitar på disken, även om ingen någonsin återvänt. **Krymp värld** tar bort de bitar som nästan ingen har spenderat tid i, så att världen tar mindre plats. Minecraft bygger om ett borttaget område från världens frö i samma ögonblick som någon reser dit igen, så detta är säkert för land som ingen använder, men allt som en spelare _byggde_ på en plats de knappt stod på skulle också försvinna, vilket är anledningen till att du bör ta en säkerhetskopia först (säkerhetskopian är ångra-funktionen).

## Vad räknas som "sällan besökt"

Varje bit registrerar hur länge spelare har stått i den (Minecraft kallar detta `InhabitedTime`). Krymp värld tar bort alla bitar med **under 30 sekunders** total speltid som standard; krympdialogen låter dig ändra den tröskeln (1 sekund till 1 timme) och hur många bitar runt spawn som ska behållas (standard 8, `0` stänger av spawn-skyddet).

Vad som alltid behålls:

- Området runt världens **spawn-punkt** (läst från `level.dat`) i övervärlden. Nether, End och anpassade dimensioner har ingen spawn-area.
- Alla bitar vars besökstid inte kunde läsas, till exempel en värld sparad med ett komprimeringsformat som panelen inte kan avkoda (LZ4). Förhandsgranskningen och resultatet talar om hur många sådana bitar som hoppades över.

Varje dimension i världen täcks: Bukkit-liknande systermappar (`world_nether`, `world_the_end`) samt vanilla- och Forge/Fabric-layouten (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). När en bit tas bort, följer dess entiteter och bybor med, så en regenererad bit ärver inte gamla monster, gruvvagnar eller arbetsplatser.

## Gör det från fliken Världar

1. Ta en säkerhetskopia från fliken **Säkerhetskopior**. Krympning från fliken Världar tar ingen åt dig.
2. Öppna **Värld → Världar**, hitta världen och klicka på krymp-ikonen.
3. Klicka på **Förhandsgranska** för att se ungefär hur många bitar (och hur många megabyte) som skulle tas bort. Ingenting har ändrats ännu; en förhandsgranskning fungerar medan servern körs.
4. Klicka på **Krymp värld**. Krympning redigerar världens filer direkt, så servern måste vara stoppad: antingen stoppa den först, eller markera alternativet för att stoppa den, krympa och starta den igen i ett svep (servern startas igen även om krympningen misslyckas). Framsteg visas i aktivitetsfältet.

![Krymp värld](/docs/images/world-shrink.png)

## Gör det som en del av en säkerhetskopia

På fliken **Säkerhetskopior**, markera **"Krymp även världen efteråt"** före **Säkerhetskopiera nu**. Säkerhetskopieringsarkivet skrivs först (det arkivet är din ångra-funktion), sedan krymps världen, men bara om servern är stoppad. Om servern körs, körs säkerhetskopian fortfarande och krympningen hoppas över med en notering.

Schemalagda säkerhetskopior har samma alternativ: i schemaläggningsredigeraren, välj uppgiften **Säkerhetskopiera** och markera **"Krymp världen efter varje säkerhetskopia"**. Para ihop det med ett **Stoppa server**-schema några minuter tidigare om du vill att det ska köras utan tillsyn.

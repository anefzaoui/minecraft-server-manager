---
title: 'Vanilla, Paper, Fabric, Forge, NeoForge, Quilt: vilken?'
description: 'Vanilla, Paper, Fabric, Forge, NeoForge eller Quilt: vilken typ av Minecraft-server ska köras, vald baserat på vad dina spelare installerar.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-choosing-a-loader.md'
---

[← Tillbaka till dokumentindex](/docs/)

Välj baserat på vad du vill att spelarna ska installera, inte vad som låter snabbast.

| Du vill                                                | Kör detta             | Spelare installerar |
| ------------------------------------------------------ | --------------------- | ------------------- |
| Överlevnad med vänner, inget ovanligt                  | Vanilla               | Ingenting           |
| En offentlig server med roller, anspråk och moderering | Paper                 | Ingenting           |
| Ett specifikt modpack från CurseForge eller Modrinth   | Vad det står          | Packen              |
| Ett modernt modpack du bygger själv                    | Fabric eller NeoForge | Samma mods          |
| Ett gammalt pack från eran 1.7 till 1.12               | Forge                 | Samma mods          |

Det är hela beslutet för de flesta. Resten av den här sidan förklarar varför.

## Plugins och mods är inte samma sak

Det här är skiljelinjen som allt annat hänger på.

**Plugins** körs bara på servern. Paper, Spigot och Bukkit laddar dem. Spelare ansluter med en vanlig,
oförändrad klient och märker aldrig något. Allt som i grunden handlar om regler, behörigheter, ekonomier,
anspråk, minispel eller moderering är ett plugin, och det är därför nästan alla offentliga servrar kör Paper.

**Mods** ändrar själva spelet: nya block, nya dimensioner, nya maskiner. Klienten måste ladda samma mods
som servern, annars kan den inte förstå vad servern säger till den. Alla som ansluter till en moddad
server installerar packen först.

En server kan inte meningsfullt vara båda. Hybridprojekt finns som lägger till ett plugin-API ovanpå en
mod-laddare, och de fungerar tills de inte gör det, oftast vid sämsta möjliga tillfälle. Om du behöver
båda, kör en proxy med en moddad server och en plugin-server bakom den snarare än en hybrid.

## Pluginsidan

**Paper** är standardvalet. Det är en fork av Spigot med år av prestandaoptimeringar och en
konfigurationsfil för nästan varje beteende som någonsin irriterat en administratör. Vanilla-plugins
från Bukkit-eran fungerar fortfarande oftast.

**Purpur** är en fork av Paper med ännu fler inställningar, inklusive de som rör spelupplevelsen. Välj
den om du vill ha de specifika reglagen; annars Paper.

**Vanilla** är värt att köra när poängen är det oförändrade spelet. Det är långsammare med många spelare,
och det har inget behörighetssystem, så modereringen är manuell.

Paper ändrar vissa vanilla-beteenden som standard i prestandans namn. Om en redstone-konstruktion från
en video inte fungerar på din server, är det oftast anledningen, och det är oftast en inställning.

## Modsidan

**Fabric** är litet, uppdateras till en ny Minecraft-version inom några dagar och har de flesta moderna
prestandamods. Nästan alla Fabric-mods kräver också Fabric API, som är en separat nedladdning.
Om ditt mål är en snabb server med en handfull mods för livskvalitet, är detta valet.

**NeoForge** är där det gamla Forge-ekosystemet nu gör sitt arbete för aktuella versioner. Det delades från
Forge under 1.20.1, och de flesta stora packar byggda för 1.20.2 och senare riktar sig mot det. Om du
startar ett nytt tungvikts-pack idag, är detta valet.

**Forge** äger fortfarande det förflutna. Allt från eran 1.7.10, 1.12.2 och 1.16.5, vilket är en stor del
av de älskade packarna, är Forge och kommer alltid att vara. Behåll det för dem.

**Quilt** är en fork av Fabric som kör de flesta Fabric-mods. Den finns av goda skäl, men om du inte har
någon specifik anledning att välja den, välj Fabric.

Mods för en laddare körs inte på en annan. En modsida som säger Fabric betyder Fabric.

## Om du installerar ett pack, bestämmer packen

Välj inte. Packen listar sin laddare och sin exakta Minecraft-version, och båda måste matcha.
"Tillräckligt nära" existerar inte här: ett pack för 1.20.1 körs inte på 1.20.4, och ett 1.20.1 NeoForge-pack
körs inte på 1.1.20.1 Forge.

Installera packen med dess ID eller länk snarare än att manuellt välja mods, och fäst versionen. Packar
uppdateras, och en uppdatering som dyker upp under fötterna mitt under säsongen är hur världar blir
korrupta.

## Vilken Java-version

Minecrafts krav följer spelet, och att köra fel version ger ett oanvändbart
`UnsupportedClassVersionError` snarare än ett tydligt meddelande.

| Minecraft-version   | Java |
| ------------------- | ---- |
| 1.16.5 och tidigare | 8    |
| 1.17                | 16   |
| 1.18 och 1.19       | 17   |
| 1.20 till 1.20.4    | 17   |
| 1.20.5 till 1.21.x  | 21   |
| 26.1 och senare     | 25   |

Gamla pack kräver verkligen Java 8; detta är ett av få ställen i mjukvara där den senaste versionen
är fel.

## I Minecraft Server Manager

Skapandeguide frågar vad du vill köra och väljer Java-versionen från tabellen ovan, så att
mismatch aldrig sker av misstag. Vanilla, Paper och Purpur finns på fliken **Vanilla**; fliken
**Från Mods** tar Fabric, Forge, NeoForge eller Quilt, med Minecraft-versionen och en laddarbyggnad
(den senaste, eller en du fäster). Att installera ett pack från CurseForge, Modrinth eller GT New Horizons
fäster det till en exakt version. Uppgradering sker bara när du tillämpar den (eller efter den dagliga
kontrollen, om serverns uppdateringspolicy är **Auto-Update**), tar alltid en säkerhetskopia först,
och kan återställas.

Mod-webbläsaren vet vilken laddare en server kör och filtrerar vad den erbjuder därefter, så en Fabric
jar kan inte hamna på en NeoForge-server av misstag.

Relaterat: [skapa och hantera servrar](/docs/servers/), [modpacks](/docs/modpacks/),
[hur mycket RAM en server behöver](/docs/guide-server-memory/).

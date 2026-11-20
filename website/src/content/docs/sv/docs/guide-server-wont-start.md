---
title: 'Din Minecraft-server startar inte'
description: 'En Minecraft-server som inte startar, åtgärdad i sannolikhetsordning: loggen, Java-versionen, minnet, EULA och port, samt mods.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Tillbaka till dokumentindex](/docs/)

Arbeta dig neråt i den här listan. Den är ordnad efter hur ofta varje punkt är svaret, och de fyra första täcker de flesta fallen.

## 1. Läs de sista tjugo raderna, inte de första

Scrolla till **slutet** av loggen. En Java stack trace skrivs ut inifrån och ut, så toppen av textväggen är den minst intressanta delen. Det du vill ha är den sista `Caused by:`-raden och vad som följer den. Den raden brukar namnge problemet.

Två former talar om var du befinner dig:

- `Exception in thread "main"` eller en kraschrapportsökväg nära slutet betyder att spelet i sig misslyckades.
- Loggen som helt enkelt slutar mitt i en rad, utan någon undantag alls, betyder att något dödade processen utifrån. Hoppa till punkt 3.

## 2. UnsupportedClassVersionError betyder fel Java

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main har kompilerats
av en nyare version av Java Runtime (class file version 65.0)
```

Klassfil 52 är Java 8, 60 är 16, 61 är 17, 65 är 21, 69 är 25. Meddelandet betyder att servern behöver en nyare Java än den körs på; tvärtom, ett gammalt pack på ny Java, misslyckas vanligtvis med ett mixin- eller reflektionsfel istället.

| Minecraft-version   | Java |
| ------------------- | ---- |
| 1.16.5 och tidigare | 8    |
| 1.17                | 16   |
| 1.18 och 1.19       | 17   |
| 1.20 till 1.20.4    | 17   |
| 1.20.5 till 1.21.x  | 21   |
| 26.1 och senare     | 25   |

Gamla pack behöver genuint Java 8. Nyare är inte bättre här.

## 3. Avslutningskod 137 är kärnan, inte en mod

Loggen slutar mitt i en mening, det finns ingen kraschrapport, och containern rapporterar 137. Det är en out-of-memory-kill: processen begärde minne som maskinen inte hade, så den avslutades.

Nästan alltid sattes Java-heapen till samma antal som maskinens minne. Heapen behöver maskinens minne **minus** JVM:s egen overhead, vilket är 0,5 till 1,5 GB på en moddad server. Sänk heapen, eller höj maskinen. [Hur mycket RAM en server behöver](/docs/guide-server-memory/) har siffrorna.

## 4. EULA och porten

Två klassiker med enradiga lösningar:

- `You need to agree to the EULA in order to run the server.` Ställ in `eula=true`, i `eula.txt` eller med miljövariabeln som din installation använder.
- `Address already in use` eller `FAILED TO BIND TO PORT`. Något annat håller 25565, ofta en tidigare kopia av samma server som aldrig helt stoppades. Hitta den och stoppa den istället för att ändra porten, annars får du två.

## 5. En mod saknar sitt beroende

```
Mod X kräver mod Y, som saknas
Fabric API är inte installerat
```

Fabric-mods kräver överväldigande Fabric API som en separat fil. Forge- och NeoForge-mods listar sina beroenden i själva felet. Installera den angivna versionen, inte den senaste: "kräver 0.91.x" betyder den raden, och 0.92 kommer att misslyckas med samma kontroll.

Ibland är det saknade beroendet själva laddaren:

```
Mod X kräver forge 47.4.14 eller högre
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

Lösningen är en nyare laddar-build, inte en annan mod. "47.4.14 eller högre" betyder vilken build som helst därifrån och uppåt, och Forge publicerar inte alla nummer, så builden att installera kan vara nästa längs med. På ett modpack, uppdatera packen först: ett pack vars egen laddarversion är för gammal för dess mods är ett fel för dess författare att fixa.

## 6. En mod är för fel laddare eller version

En jar för en annan laddare misslyckas inte artigt. Förvänta dig ett mixin-fel, ett `NoClassDefFoundError`, eller en krasch inuti en klass du aldrig hört talas om. Kontrollera jar-filens sida: laddaren och Minecraft-versionen måste matcha exakt. 1.20.1 och 1.20.4 är olika spel så långt mods är berörda.

## 7. Världen är från en nyare version

```
This world was created by a newer version of Minecraft
```

Världar uppgraderas framåt och aldrig bakåt. Återställ säkerhetskopian från före uppgraderingen, eller kör den version som världen förväntar sig. Det finns ingen nedgraderingsväg som behåller chunkarna intakta.

## När den kraschade efter att ha fungerat i veckor

Annan fråga, oftast annat svar:

- **Den kraschade under belastning**, med timings som visar långa pauser: skräpsamling, så titta på heapstorleken före mods.
- **Den kraschade vid samma punkt i världen**: en korrupt chunk eller en trasig entitet. Kraschrapporten namnger oftast koordinater.
- **Den kraschade direkt efter en uppdatering**: modden som uppdaterades är misstänkt, även om spåret pekar någon annanstans. Rulla tillbaka den och se.
- **Den kraschade vid omstart, efter att ha varit okej tidigare**: kontrollera disken. En full disk ger spektakulära och missvisande fel.

## Få hjälp som faktiskt hjälper

Posta **hela loggen**, inte den sista raden, och säg vad du ändrade innan det gick sönder. Klistra in den någonstans som är avsedd för det, som [mclo.gs](https://mclo.gs), snarare än i chatten. Inkludera Minecraft-versionen, laddaren, packen och dess version, och hur mycket heap servern har. En rapport med dessa fyra fakta får svar i ett enda svar; utan dem tar det fem.

## I Minecraft Server Manager

Krascher upptäcks från containerns egen avslutning, så en server som dör klockan tre på morgonen registreras med sitt loggutdrag snarare än hittas nästa dag. De vanliga misstänkta på den här sidan (EULA, fel Java, en värld från en nyare version, en port som redan används, Java som får slut på minne) känns igen i den loggen och namnges i historikposten med vad man ska göra åt dem, och automatisk omstart lämnar dem ifred, eftersom omstart inte kommer att fixa dem. Kraschrapporter parsas vid ankomst: undantaget markeras, stacken kan kollapsas, och mods som förekommer i spåret listas som misstänkta.

Varje rapport kan delas till mclo.gs från dess kort när du behöver hjälp (efter en bekräftelse, eftersom inlägget är offentligt), och konsolens **Ladda ner**-meny har alla loggfiler som en zip, så "posta hela loggen" är en nedladdning snarare än ett arkeologiskt projekt. En out-of-memory-kill registreras som en out-of-memory-kill, vilket sparar den vanliga timmen av att skylla på en mod. Om något annat genuint behöver porten, flyttar **Spelport**-kortet på **Inställningar → Konfiguration** servern till en ledig.

En laddare som är för gammal ändras från serverns **Versioner**-flik, som kontrollerar att builden existerar och tar en säkerhetskopia innan den bygger om servern ([ändra laddarversionen för moddar](/docs/updates/#changing-the-mod-loader-version)).

Relaterat: [hur mycket RAM en server behöver](/docs/guide-server-memory/), [välja en laddare](/docs/guide-choosing-a-loader/), [skapa och hantera servrar](/docs/servers/).

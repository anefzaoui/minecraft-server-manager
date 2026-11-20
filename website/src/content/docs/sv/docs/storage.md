---
title: 'Lagring'
description: 'Se var diskutrymmet tar vägen, begränsa varje servermapp med en diskutrymmeskvot och rensa bort det du inte längre behöver.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Tillbaka till dokumentindex](/docs/)

Sidan **Lagring** visar var din diskutrymme tar vägen: användning per kategori, varje server mot sin kvot, de största filerna och hur den totala användningen trenderar över de senaste genomsökningarna. Den är endast för administratörer.

![Lagring](/docs/images/storage.png)

## Diskutrymme-kvoter hanteras av panelen

Docker kan inte begränsa diskutrymmesanvändningen för en bind mount, så panelen gör det. En bakgrunds-storleksindexerare går igenom data-mappen (var 15:e minut, efter ändringar, eller när du trycker på **Skanna om nu**), cachar varje servers fotavtryck och upprätthåller den diskutrymme-kvot du ställer in per server. En åtgärd som skulle ta en servers mapp (värld, mods, konfigurationer, loggar och allt annat i den) över dess kvot, som att installera en mod eller en värld eller ladda upp filer, blockeras tills utrymme frigörs eller kvoten höjs, snarare än att låta en server fylla din värd.

Ställ in en servers kvot i dess [inställningar](/docs/servers/#server-settings). Att aktivera **Stoppa servern vid överskriden kvot** där stoppar också en körande server när dess mapp växer mer än 10% över kvoten, och noterar det i serverns historik. Moddade servrar kan vara stora, så ge dem utrymme. [Säkerhetskopior](/docs/backups/) lagras separat och räknas inte mot kvoten.

## Rengöring

Kortet **Engångsrengöring** frigör utrymme som panelen säkert kan återta: temporära filer äldre än en timme, föräldralösa biblioteksfiler och arkiverade loggar och kraschrapporter äldre än 30 dagar. Var och en visar hur mycket den frigör och öppnar en förhandsgranskning innan något raderas. Listorna **Per kategori** och **Största filer** länkar direkt till filhanteraren, så att du kan hitta vad mer du kan rensa innan du får slut på utrymme.

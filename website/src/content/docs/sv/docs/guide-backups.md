---
title: 'Minecraft-server-säkerhetskopior som faktiskt går att återställa'
description: 'Hur du skapar Minecraft-server-säkerhetskopior som faktiskt går att återställa: konsekventa kopior, lagrade någon annanstans och testade minst en gång.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Tillbaka till dokumentindex](/docs/)

De flesta servrar har säkerhetskopior. Färre har säkerhetskopior som fungerar, och skillnaden upptäcks bara under den värsta dagen. Tre saker skiljer dem åt: kopian är konsekvent, den finns någon annanstans, och någon har återställt den minst en gång.

## Kopiera världen medan den inte skrivs till

En körande server skriver regionsfiler kontinuerligt. Kopiera dem mitt under skrivning och du får en fil som är halvt gammal och halvt ny, vilket antingen misslyckas med att laddas eller laddas med ett hål i marken där någons bas brukade vara. Ingenting varnar dig, eftersom kopieringen lyckades.

Det finns två korrekta sätt att ta en kopia:

1. **Stoppa servern**, kopiera, starta den igen. Enkelt, ärligt och impopulärt på grund av nertid.
2. **Be spelet att sluta skriva först.** Kör `save-off`, sedan `save-all flush`, vänta tills det är klart, kopiera, sedan `save-on`. Världen är komplett och tyst under kopieringens varaktighet.

Skippa aldrig direkt till kopieringen. En ögonblicksbild på filsystemet eller volymnivån är endast bra om den är genuint atomisk, och en `cp -r` medan spelare placerar block är det inte.

## Säkerhetskopiera mer än bara världen

Att bara återställa världen ger dig terrängen och förlorar servern. Du vill också ha:

- `server.properties`, och vad som helst annat som sätter reglerna.
- Mod- eller plugin-filer, i exakt de versioner som kördes. En värld laddas inte utan de mods som skapade dess block.
- Spelardata, inklusive `whitelist.json`, `ops.json` och mapparna för statistik och framsteg.
- Pack-versionen, om den kom från ett pack. Att skriva ner den räknas.

Den snabbaste rimlighetskontrollen för någon säkerhetskopia: kan du bygga om den här servern på en ny maskin enbart från arkivet? Om svaret kräver en mening som börjar med "och sedan skulle jag installera om", är det inte en komplett säkerhetskopia.

## En kopia på samma disk är inte en säkerhetskopia

En säkerhetskopia som finns på maskinen den skyddar täcker exakt ett fel: du raderade något. Den täcker inte att disken dör, att leverantören stänger av kontot, eller ett misstag som raderar hela katalogen.

Håll det enkelt snarare än perfekt:

- En lokal kopia, för det vanliga fallet, vilket är att någon förstör eller en dålig uppdatering.
- En kopia någon annanstans. En annan maskin, ett objektlager, eller en hemmagjord NAS som hämtar nattligen via SSH.
- Tillräckligt med historik för att överleva ett problem du inte märkte omedelbart. Korruption upptäcks ofta dagar senare, och om du behåller tre dagars säkerhetskopior har du redan skrivit över den bra.

Sju dagliga kopior plus fyra veckovisa täcker nästan alla verkliga incidenter och kostar väldigt lite utrymme.

## Testa en återställning innan du behöver en

Välj en säkerhetskopia, återställ den till en reservserver och anslut. Det är hela testet, det tar femton minuter, och det fångar alla klassiska fel: arkivet saknar mod-mappen, en värld som behöver en version du inte längre kör, behörigheter som gör filerna oläsbara, en trunkerad uppladdning.

Gör det en gång när du ställer in säkerhetskopiorna, och en gång till efter en stor ändring av servern.

## Storlek, och hur man håller den rimlig

Världar växer eftersom spelare utforskar. En värld där någon flög tiotusen block i en rak linje bär med sig varje chunk längs den linjen för alltid, och de flesta av dessa chunks kommer aldrig att besökas igen.

Tre spakar, i ordning efter hur mycket de ger tillbaka:

1. **Trimma o-besökta chunks.** Verktyg som beskär efter senast-rörd tid tar vanligtvis bort en stor del av en väl-rest värld utan synlig effekt i spelet.
2. **Komprimera ordentligt.** Regionsfiler komprimeras bra; arkiv av dem drar inte nytta av något exotiskt.
3. **Behåll inte varje timmes kopia i ett år.** Lagringstid slår komprimering.

## I Minecraft Server Manager

Säkerhetskopior tar vägen `save-off`, flush, kopiera, `save-on`, och en stopp- eller omstarts-begäran mitt under en säkerhetskopia nekas tills kopieringen är klar snarare än att tävla mot den. Arkivet täcker hela serverkatalogen, så mods, konfiguration och spelardata följer med världen.

Säkerhetskopior kan köras på ett schema tillsammans med omstarter och kommandon, och varje ny server startar med ett dagligt säkerhetskopieringsschema. Lagringstid räknar varje typ separat, så de tio schemalagda kopiorna som samlas på egen hand kan inte tränga undan den du tog manuellt före en riskabel ändring, och ålders- och storleksgränser gäller ovanpå det. Administratörer ändrar allt detta på sidan Inställningar, eller per server på fliken Säkerhetskopior. Återställning tar en ny säkerhetskopia först, så en återställning till fel tidpunkt är i sig ångringsbar. En värld kan krympas på egen hand eller som en del av en säkerhetskopia, vilket är den spak som betyder mest för storleken.

Hela panelen, inklusive varje säkerhetskopia, lever under en enda katalog. Att kopiera den katalogen någon annanstans är den externa halvan av historien, och det är medvetet det enda du behöver kopiera.

Relaterat: [säkerhetskopior i panelen](/docs/backups/), [scheman](/docs/schedules/),
[krympa en värld](/docs/world-shrink/), [flytta en server till en annan värd](/docs/guide-moving-a-server/).

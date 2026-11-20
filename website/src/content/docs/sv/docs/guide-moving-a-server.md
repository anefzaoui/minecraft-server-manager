---
title: 'Flytta en Minecraft-server till en annan värd'
description: 'Att flytta en värld är enkelt. Att flytta en server som spelare fortfarande kan logga in på, med deras inventarier, hem och behörigheter intakta, är den del som går fel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Tillbaka till dokumentindex](/docs/)

Att flytta en värld är enkelt. Att flytta en server som spelare fortfarande kan logga in på, med sina inventarier, hem och behörigheter intakta, är det som går fel. Ordningen nedan håller driftstoppet nere till några få minuter och behåller en väg tillbaka om den nya maskinen gör dig besviken.

## Inventera först

Skriv ner dessa innan du rör något. Var och en av dem har lett till en misslyckad migrering när de antogs snarare än kontrollerades:

- **Minecraft-version och laddare**, exakt. 1.20.1 NeoForge är inte 1.20.1 Forge.
- **Listan över mods eller plugins med versioner.** Världen kommer inte att laddas utan de mods som skapade den.
- **Java-version**, som följer Minecraft-versionen.
- **`level-name`** från `server.properties`. Världens mapp kallas ofta inte `world`.
- **Online-läge.** Om den gamla servern kördes med `online-mode=false` och den nya körs med det på, eller tvärtom, får varje spelare ett annat UUID och därmed ett helt nytt, tomt inventarie. Detta är det enskilt mest smärtsamma misstaget på den här sidan.
- **Något som lever utanför servermappen**, som en plugins MySQL-databas.

## Kopiera medan den körs, kopiera sedan igen medan den är stoppad

Tricket för kort driftstopp är att göra den långsamma kopieringen först.

1. **Med servern igång**, kopiera hela serverkatalogen till den nya maskinen. På en stor värld kan detta ta en timme; ingen märker det, eftersom inget har stoppats.
2. **Annonsera en omstart, stoppa sedan servern korrekt.** En graciös avstängning får spelet att spola ut världen; att döda processen gör inte det.
3. **Kopiera igen.** Endast de filer som har ändrats flyttas denna gång, så det tar sekunder till minuter.
4. **Starta den på den nya maskinen**, på en icke-offentlig port om du kan, och anslut själv. Kontrollera en bas du känner till, ditt eget inventarie, och att plugins eller mods laddades utan fel.
5. **Peka sedan spelarna mot den.**

`rsync -a --delete` är det vanliga verktyget för steg 1 och 3. Behåll behörigheter och tidsstämplar: en värld som kopieras som fel användare är en server som inte startar, och felet kommer inte att ange det tydligt.

## Ta inte bort den gamla än

Behåll den gamla maskinen, stoppad men intakt, i minst några dagar. Det är den enda verkliga återställningen. Håll den avstängd snarare än igång, så att ingen av misstag ansluter till den övergivna kopian och bygger där i en vecka.

## Låt adressen överleva flytten

Om spelare ansluter till enbart en IP-adress, tvingar varje flytt varje spelare att redigera sin serverlista, och några av dem gör det aldrig.

Använd ett värdnamn du kontrollerar, pekande mot servern. Att flytta blir då en DNS-ändring, och adressen i allas klient förblir densamma. Sänk postens "time-to-live" en dag före flytten så att ändringen sprids snabbt.

Om du vill att spelare ska skriva in ett vanligt domännamn medan servern körs på en icke-standardport, gör en SRV-post det. Det är samma mekanism som kommersiella värdar använder för att dela ut `play.something.net`.

## Kontrollera den nya maskinen innan du litar på den

Tre saker som skiljer sig mellan värdar och som ställer till problem efter flytten:

- **Brandväggen.** Din spelport måste vara öppen, och endast din spelport. Exponera inte ett hanteringsgränssnitt eller en karta för internet bara för att det fungerade på localhost.
- **Enkelkärnhastighet.** Minecraft bryr sig mycket mer om hur snabb en kärna är än hur många det finns. Åtta långsamma kärnor kommer att kännas sämre än två snabba.
- **Disk.** En värld på roterande lagring eller en kraftigt delad volym kommer att hacka under laddning av chunkar.

## Att lämna ett hanterat gränssnitt

Om du kommer från en värd som gav dig ett kontrollpanel snarare än en maskin, hitta nedladdnings- eller filhanteraren, och ta hela serverkatalogen snarare än bara världen. Skaffa själva plugin- och mod-filerna, inte en lista: versionerna spelar roll, och "senaste" är en annan fil nästa månad.

Kontrollera att dina säkerhetskopior också är dina. En säkerhetskopia som bara finns inuti panelen du lämnar är inte en säkerhetskopia du äger.

## I Minecraft Server Manager

Hela panelen är en katalog. Att kopiera den till en annan maskin och starta panelen där tar med sig varje server, värld, säkerhetskopia och inställning, vilket gör att flytta själva panelen till en kopiering snarare än en migrering.

För en server snarare än alla, fångar en ritning dess konfiguration, mod-uppsättning och fäst packversion (och, om du markerar den, den aktiva världen) som en enda `.mcserver.zip` som kan importeras på en annan panel för att återskapa samma server. Världar kan laddas ner och installeras separat när bara världen behöver flyttas.

Om spelporten som en server använde redan är upptagen på den nya maskinen, eller om du vill testa på en icke-offentlig port först, ändra den under **Inställningar → Konfiguration**: kortet **Spelport** har **Använd Nästa Lediga Port**, en igångvarande server frågar innan den startar om på den nya porten, och om den inte kan starta där går den tillbaka till den gamla. Byt till den offentliga porten när du pekar spelarna mot den.

Relaterat: [ritningar](/docs/blueprints/), [säkerhetskopior som faktiskt återställs](/docs/guide-backups/), [världar och filer](/docs/worlds-and-files/).

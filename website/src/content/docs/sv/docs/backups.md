---
title: 'Säkerhetskopior'
description: 'Sidan Säkerhetskopior visar varje ögonblicksbild i din flotta, med storlek, orsak och ålder, filtrerbar per server och per orsak.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Tillbaka till dokumentindex](/docs/)

Sidan **Säkerhetskopior** visar alla ögonblicksbilder från din flotta, med storlek, orsak och ålder, filtrerbara per server och orsak.

![Backups](/docs/images/backups.png)

## Skapa en säkerhetskopia

Från en servers flik **Säkerhetskopior** (eller via ett [schema](/docs/schedules/)) kan du ta en ögonblicksbild av hela serverkatalogen med ett klick. Panelens programvara pausar världen först (`save-off` → `save-all`), zippar data, och återaktiverar sedan sparande (`save-on`), så säkerhetskopior är konsekventa även på en körande server. Komprimering körs i en bakgrundstråd så att den inte blockerar panelen. En säkerhetskopia som startas via API:et kan ha en anteckning.

Varje arkiv **kontrolleras för integritet** i samma ögonblick som det skrivs: panelen öppnar zip-filen igen och läser dess katalog. Ett skadat eller oläsbart arkiv raderas och säkerhetskopieringsanropet misslyckas omedelbart, istället för att problemet upptäcks månader senare när en återställning är det enda som skiljer dig från dataförlust. Ett arkiv med noll poster (en server som aldrig har startats) tillåts men flaggas i händelseloggen.

Markera **"Minska även världen efteråt"** (på fliken Säkerhetskopior, eller i ett säkerhetskopieringsschema) för att ta bort sällan besökta delar av världen när arkivet har skrivits säkert (se **[Minska en värld](/docs/world-shrink/)**). Minskningen körs endast medan servern är stoppad; på en körande server sker säkerhetskopieringen fortfarande och minskningen hoppas över.

![Server backups](/docs/images/server-backups.png)

## Orsaker till säkerhetskopior

Säkerhetskopior taggas baserat på varför de togs:

- **manuell**: du klickade på **Säkerhetskopiera nu**. Att ersätta en servers aktiva värld med en från biblioteket tar också en `manuell` säkerhetskopia först.
- **schemalagd**: skapad av ett [schema](/docs/schedules/). Varje ny server får också en daglig schemalagd säkerhetskopia automatiskt (spridd mellan 02:00 och 05:59), så en server har automatisk täckning från dag ett, inte bara före uppdateringar.
- **före-uppdatering**: tas automatiskt före en paketuppgradering eller en ändring av Minecraft-version, så en uppgradering alltid kan ångras.
- **före-återställning**: tas automatiskt precis före en återställning eller en världsåterställning, som ett skyddsnät om återställningen inte blev som du tänkt dig.

## Lagringstid

Lagringstiden begränsas **per server, per orsak**: de nyaste i varje grupp behålls, äldre tas bort automatiskt efter varje lyckad säkerhetskopiering:

| Orsak              | Behålls som standard |
| ------------------ | -------------------- |
| schemalagd         | 10                   |
| före-uppdatering   | 10                   |
| manuell            | 20                   |
| före-återställning | 5                    |

`före-återställning` (kallade säkerhetskopior i panelen) har sin egen lilla "hink" just för att en automatisk säkerhetskopia aldrig ska kunna ersätta en `manuell` säkerhetskopia som du medvetet har behållit.

Två valfria tak gäller utöver antalet per orsak, båda avstängda som standard: en **maximal ålder** (säkerhetskopior äldre än N dagar tas bort, oavsett orsak) och en **maximal total storlek** per server (de äldsta tas bort tills totalen passar: säkerhetskopior först, sedan schemalagda, sedan resten). Den nyaste säkerhetskopian av en server tas aldrig bort av något av dessa tak.

### Ändra det

Administratörer ställer in panelens policy i kortet **Lagringstid för säkerhetskopior** på sidan **Inställningar** (**Fyll i inbyggda värden** lägger tillbaka standardvärdena ovan i formuläret, redo att sparas). En server kan skilja sig åt gällande något av de sex värdena: öppna dess flik **Säkerhetskopior** och expandera **Lagringstid för denna server**. Varje fält där är tomt om inte servern har ställt in det, och ett tomt fält följer panelens värde (visas inuti det). En server kan alltså till exempel behålla 3 schemalagda säkerhetskopior och använda panelens värden för allt annat; att rensa ett fält återställer det till panelens värde.

![Kortet Backup Retention i Inställningar](/docs/images/settings-retention.png)

![Lagringstid för denna server på en servers Säkerhetskopior-flik](/docs/images/server-retention.png)

Sparande raderar aldrig något av sig självt. Om de nya gränserna skulle lämna befintliga säkerhetskopior över gränsen, listar panelen, per server, hur många säkerhetskopior av varje typ som skulle tas bort, hur mycket utrymme det frigör och hur gammal den äldsta är. Den anger också när en server redan var över sina gränser före denna ändring (till exempel efter en tidigare **Från nästa säkerhetskopia**), eftersom en tillämpning nu trimmar allt som är över gränsen, inte bara vad denna redigering lägger till. Sedan frågar den hur de ska tillämpas:

- **Ta bort nu** raderar exakt de säkerhetskopior som den just listade, inget mer: en säkerhetskopia som gjorts under tiden väntar på nästa trimning. Från sidan Inställningar hoppas en server som är mitt i en återställning, säkerhetskopiering eller liknande åtgärd över och trimmas efter sin nästa säkerhetskopia; på en servers egen flik Säkerhetskopior blir du ombedd att försöka igen när den åtgärden är klar. Medan en servers gamla säkerhetskopior raderas (vanligtvis sekunder), måste andra åtgärder på den servern vänta: en schemalagd säkerhetskopiering eller start som inträffar då försöker igen varje minut tills den kan (upp till 30 minuter), en kraschad server startas om inom cirka 20 sekunder efter att den har avslutats (upp till 30 minuter), och en schemalagd omstart eller stopp som kolliderar med den hoppas över till nästa tidpunkt.
- **Från nästa säkerhetskopia** behåller dem tills vidare; varje server trimmar sina säkerhetskopior nästa gång den skapar en, som den alltid har gjort.

![Dialogrutan som listar vad nya gränser skulle ta bort](/docs/images/retention-preview.png)

En säkerhetskopia som återställs tas aldrig bort medan återställningen körs: lagringstiden ignorerar den (och raderar inte andra säkerhetskopior för att ge plats åt den), och att radera den manuellt vägras tills återställningen är klar.

Samma inställningar är tillgängliga för skript som admin API-slutpunkter: `GET`/`POST /api/backups/retention` och `/api/servers/:id/backups/retention`. Panelövergripande värden kan inte vara `null`. För en server tar ett värde av `null` (eller `""`) bort den nyckeln, så att den följer panelövergripande värde igen, och `{ "reset": true }` tar bort dem alla. Under var och en av dessa två sökvägar rapporterar `POST …/preview` vad en ändring skulle ta bort utan att ta bort det (`backups`, `bytes`, `servers`, `ids` och en uppdelning per server `byServer`), och `POST …/apply` tillämpar den sparade policyn nu och svarar med `{ deleted, skipped }` panelövergripande (`skipped` räknar upptagna servrar) eller `{ deleted }` för en server. Skicka förhandsgranskningens `{ "token": "..." }` (behålls i 10 minuter) eller dess `{ "ids": [...] }` för att bara ta bort dessa; utan någon av dem tas allt över gränsen bort. En server-specifik tillämpning på en upptagen server svarar 409.

Säkerhetskopior kan **döpas om** från säkerhetskopieringslistan (knappen för att döpa om på varje rad). Arkivet på disken och panelens register flyttas tillsammans, så nedladdning, återställning och lagring fortsätter att fungera med det nya namnet.

![Döp om en säkerhetskopia](/docs/images/backup-rename.png)

> Lagringstiden begränsas automatiskt, men stora arkiv med många moddar räknas fortfarande mot en servers [diskutrymme](/docs/storage/), så håll ett öga på totalen för stora paket.

## Återställa

Att återställa en säkerhetskopia stoppar servern (verifierar att containern verkligen stoppades innan några filer rörs), tar en `före-återställning` säkerhetskopia, ersätter **hela serverkatalogen** med ögonblicksbilden och lämnar den stoppad för dig att starta igen. Arkivet packas upp vid sidan först och byts ut först när det har extraherats helt, så en återställning som misslyckas halvvägs lämnar de aktuella filerna orörda. Eftersom paketuppgraderingar alltid tar en `före-uppdatering` säkerhetskopia först, kan du alltid rulla tillbaka en dålig uppgradering.

## Panelens egen databas

Server-säkerhetskopior täcker bara varje servers egen mapp. Panelens egen databas (`panel.db`, som innehåller användare, roller, 2FA-hemligheter, scheman, paketfästen och historik) tas en ögonblicksbild av separat vid den dagliga underhållstimern:

- `VACUUM INTO` skriver en konsekvent, defragmenterad kopia till `backups/_panel/` i datakatalogen; de nyaste **14** behålls.
- Vid uppstart kör panelen `PRAGMA integrity_check` och loggar högt om den misslyckas, och pekar dig mot `backups/_panel` för den senaste fungerande kopian.

Säkerhetskopiera hela datakatalogen (den innehåller också `.secret-key`, krypteringsnyckeln i vila) och du har säkerhetskopierat allt.

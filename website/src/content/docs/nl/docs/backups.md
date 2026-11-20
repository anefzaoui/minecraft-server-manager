---
title: 'Back-ups'
description: 'De Back-ups pagina toont elke snapshot van uw vloot, met grootte, reden en leeftijd, filterbaar per server en per reden.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Backups** toont elke snapshot van uw vloot, met grootte, reden en leeftijd, filterbaar per server en per reden.

![Backups](/docs/images/backups.png)

## Een backup maken

Vanaf het tabblad **Backups** van een server (of via een [schema](/docs/schedules/)) kunt u met één klik de hele serverdirectory snapshotten. Het paneel brengt eerst de wereld tot rust (`save-off` → `save-all`), comprimeert de gegevens, en schakelt vervolgens het opslaan weer in (`save-on`), zodat backups consistent zijn, zelfs op een draaiende server. Compressie draait in een achtergrondthread, zodat het paneel niet vastloopt. Een backup die via de API is gestart, kan een notitie bevatten.

Elk archief wordt **integriteitsgecontroleerd** op het moment dat het wordt geschreven: het paneel heropent de zip en leest de inhoudsopgave. Een beschadigd of niet te openen archief wordt verwijderd en de backup-aanroep mislukt onmiddellijk, in plaats van dat het probleem maanden later naar boven komt wanneer een herstel het enige is tussen u en gegevensverlies. Een archief met nul items (een server die nog nooit is gestart) is toegestaan, maar wordt gemarkeerd in de gebeurtenis.

Vink **"Krimp de wereld daarna ook"** aan (op het tabblad Backups, of in een backupschema) om zelden bezochte chunks te verwijderen nadat het archief veilig is geschreven (zie **[Een wereld krimpen](/docs/world-shrink/)**). Het krimpen draait alleen terwijl de server is gestopt; op een draaiende server gebeurt de backup nog steeds en wordt het krimpen overgeslagen.

![Server backups](/docs/images/server-backups.png)

## Redenen voor backups

Backups worden getagd op basis van waarom ze zijn gemaakt:

- **handmatig**: u heeft op **Nu een backup maken** geklikt. Het vervangen van de actieve wereld van een server door een exemplaar uit de bibliotheek maakt eerst ook een `handmatige` backup.
- **gepland**: gemaakt door een [schema](/docs/schedules/). Elke nieuwe server krijgt ook automatisch een dagelijkse geplande backup (verspreid tussen 02:00 en 05:59), zodat een server vanaf dag één automatische dekking heeft, niet alleen vóór updates.
- **pre-update**: automatisch gemaakt vóór een pakketupgrade of een wijziging van de Minecraft-versie, zodat een upgrade altijd omkeerbaar is.
- **pre-restore**: automatisch gemaakt vlak voor een herstel of een wereldreset, als een vangnet voor het geval het herstel niet is wat u wilde.

## Retentie

Retentie wordt **per server, per reden** beperkt: de nieuwste in elke groep worden bewaard, oudere worden automatisch opgeruimd na elke succesvolle backup:

| Reden       | Standaard bewaard |
| ----------- | ----------------- |
| gepland     | 10                |
| pre-update  | 10                |
| handmatig   | 20                |
| pre-restore | 5                 |

`pre-restore` (veiligheidsbackups genoemd in het paneel) heeft zijn eigen kleine opslagruimte, juist zodat een automatische veiligheidsbackup nooit een `handmatige` backup kan overschrijven die u bewust hebt bewaard.

Twee optionele limieten zijn van toepassing bovenop de tellingen per reden, beide standaard uitgeschakeld: een **maximale leeftijd** (backups ouder dan N dagen worden opgeruimd, ongeacht hun reden) en een **maximale totale grootte** per server (de oudste worden opgeruimd totdat het totaal past: eerst veiligheidsbackups, dan geplande, dan de rest). De nieuwste backup van een server wordt nooit door een van beide limieten verwijderd.

### Wijzigen

Beheerders stellen het beleid voor het hele paneel in de kaart **Backup Retentie** op de pagina **Instellingen** (**Ingebouwde waarden invullen** plaatst de bovenstaande standaardwaarden terug in het formulier, klaar om op te slaan). Een server kan verschillen op elk van de zes waarden: open het tabblad **Backups** en vouw **Retentie voor deze server** uit. Elk veld is leeg, tenzij die server het instelt, en een leeg veld volgt de waarde van het hele paneel (getoond erin). Een server kan dus bijvoorbeeld 3 geplande backups bewaren en voor al het andere de waarden van het hele paneel gebruiken; een veld leegmaken plaatst het terug naar de waarde van het hele paneel.

![De kaart Backup Retentie in Instellingen](/docs/images/settings-retention.png)

![Retentie voor deze server op het tabblad Backups van een server](/docs/images/server-retention.png)

Opslaan verwijdert nooit iets op zichzelf. Als de nieuwe limieten bestaande backups boven de limiet zouden laten uitkomen, toont het paneel per server hoeveel backups van elk type zouden worden verwijderd, hoeveel ruimte dat vrijmaakt en hoe oud de oudste is. Het vermeldt ook wanneer een server al boven zijn limieten zat vóór deze wijziging (bijvoorbeeld na een eerdere **Vanaf de volgende backup**), aangezien het nu toepassen alles boven de limiet opschoont, niet alleen wat deze bewerking toevoegt. Vervolgens wordt gevraagd hoe deze toe te passen:

- **Nu verwijderen** verwijdert precies de backups die het zojuist heeft vermeld, niets meer: een backup die ondertussen is gemaakt, wacht op de volgende opschoning. Vanaf de Instellingen-pagina wordt een server die midden in een herstel, backup of vergelijkbare actie zit overgeslagen en wordt opgeschoond na de volgende backup; op het eigen tabblad Backups van een server wordt u gevraagd het opnieuw te proberen zodra die actie is voltooid. Terwijl de oude backups van een server worden verwijderd (meestal seconden), moeten andere acties op die server wachten: een geplande backup of start die dan plaatsvindt, probeert het elke minuut opnieuw (tot 30 minuten), een gecrashte server wordt binnen ongeveer 20 seconden na voltooiing opnieuw gestart (tot 30 minuten), en een geplande herstart of stop die ermee botst, wordt overgeslagen tot de volgende keer.
- **Vanaf de volgende backup** bewaart ze voorlopig; elke server ruimt zijn backups op de volgende keer dat hij er een maakt, zoals hij altijd heeft gedaan.

![Het dialoogvenster met wat nieuwe limieten zouden verwijderen](/docs/images/retention-preview.png)

Een backup die wordt hersteld, wordt nooit verwijderd terwijl het herstel loopt: retentie laat het met rust (en verwijdert geen andere backups om ruimte te maken), en het handmatig verwijderen ervan wordt geweigerd totdat het herstel is voltooid.

Dezelfde instellingen zijn beschikbaar voor scripts als beheerders-API-eindpunten: `GET`/`POST /api/backups/retention` en `/api/servers/:id/backups/retention`. Waarden voor het hele paneel kunnen niet `null` zijn. Voor een server verwijdert een waarde van `null` (of `""`) die specifieke sleutel, zodat deze weer de waarde van het hele paneel volgt, en `{ "reset": true }` verwijdert ze allemaal. Onder elk van die twee paden meldt `POST …/preview` wat een wijziging zou verwijderen zonder het te verwijderen (`backups`, `bytes`, `servers`, `ids` en een uitsplitsing per server `byServer`), en `POST …/apply` past het opgeslagen beleid nu toe en antwoordt met `{ deleted, skipped }` voor het hele paneel (`skipped` telt drukke servers) of `{ deleted }` voor één server. Stuur het preview-token `{ "token": "..." }` (10 minuten bewaard) of de bijbehorende `{ "ids": [...] }` om alleen die te verwijderen; zonder een van beide gaat alles boven de limiet. Een per-server-toepassing op een drukke server geeft 409 terug.

Backups kunnen worden **hernoemd** vanuit de backup-lijst (de hernoemknop op elke rij). Het archief op schijf en de registratie van het paneel verplaatsen samen, zodat downloaden, herstellen en retentie blijven werken met de nieuwe naam.

![Een backup hernoemen](/docs/images/backup-rename.png)

> Retentie is automatisch begrensd, maar grote gemodificeerde archieven tellen nog steeds mee voor de [schijfquotum](/docs/storage/) van een server, dus houd het totaal in de gaten voor grote pakketten.

## Herstellen

Het herstellen van een backup stopt de server (verifieert dat de container echt is gestopt voordat er bestanden worden aangeraakt), maakt een `pre-restore` veiligheidsbackup, vervangt de **hele serverdirectory** door de snapshot, en laat deze gestopt achter zodat u hem opnieuw kunt starten. Het archief wordt eerst ernaast uitgepakt en pas ingewisseld zodra het volledig is uitgepakt, dus een herstel dat halverwege mislukt, laat de huidige bestanden onaangetast. Omdat pakketupgrades altijd eerst een `pre-update` backup maken, kunt u een slechte upgrade altijd terugdraaien.

## De eigen database van het paneel

Serverbackups dekken alleen de eigen map van elke server. De eigen database van het paneel (`panel.db`, met gebruikers, rollen, 2FA-geheimen, schema's, pakketpinnen en geschiedenis) wordt afzonderlijk gesnapt tijdens de dagelijkse onderhoudstimer:

- `VACUUM INTO` schrijft een consistente, gedefragmenteerde kopie naar `backups/_panel/` in de gegevensmap; de nieuwste **14** worden bewaard.
- Bij het opstarten voert het paneel `PRAGMA integrity_check` uit en logt luid als deze mislukt, en wijst u naar `backups/_panel` voor de nieuwste goede kopie.

Maak een backup van de hele gegevensmap (het bevat ook `.secret-key`, de encryptiesleutel in rust) en u heeft alles gebackupt.

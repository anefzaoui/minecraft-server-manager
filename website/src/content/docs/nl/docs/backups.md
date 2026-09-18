---
title: 'Back-ups'
description: 'De Back-ups pagina toont elke snapshot van uw vloot, met grootte, reden en leeftijd.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Backups** toont elke snapshot van uw vloot, met grootte, reden en leeftijd.

![Backups](/docs/images/backups.png)

## Een backup maken

Vanaf het tabblad **Backups** van een server (of via een [schema](/docs/schedules/)) kunt u met één klik een snapshot maken van de volledige serverdirectory. Het paneel brengt de wereld eerst tot rust (`save-off` → `save-all`), comprimeert de gegevens, en schakelt vervolgens het opslaan weer in (`save-on`), zodat backups consistent zijn, zelfs op een draaiende server. Compressie draait in een aparte achtergrondthread, zodat het paneel niet wordt geblokkeerd. Elke backup kan een notitie bevatten.

Elk archief wordt **geïntegreerd gecontroleerd** op het moment dat het wordt geschreven: het paneel heropent de zip en leest de inhoudsopgave. Een beschadigd of niet-openbaar archief wordt verwijderd en de backup-aanroep mislukt onmiddellijk, in plaats van dat het probleem maanden later aan het licht komt wanneer een herstel het enige is dat u van gegevensverlies scheidt. Een archief met nul items (een server die nog nooit is gestart) is toegestaan, maar wordt gemarkeerd in de gebeurtenissen.

Vink **"Kromp ook de wereld erna"** aan (op het tabblad Backups, of in een backupschema) om zelden bezochte chunks te verwijderen zodra het archief veilig is geschreven (zie **[Een wereld inkrimpen](/docs/world-shrink/)**). Het inkrimpen wordt alleen uitgevoerd terwijl de server is gestopt; op een draaiende server vindt de backup nog steeds plaats en wordt het inkrimpen overgeslagen.

![Server backups](/docs/images/server-backups.png)

## Redenen voor backups

Backups worden getagd op basis van waarom ze zijn gemaakt:

- **handmatig** - u heeft op de knop geklikt.
- **gepland** - gemaakt door een [schema](/docs/schedules/). Elke nieuwe server krijgt ook automatisch een dagelijkse geplande backup toegewezen (verspreid tussen 02:00 en 05:59), zodat een server vanaf dag één automatische dekking heeft, niet alleen vóór updates.
- **pre-update** - automatisch gemaakt vóór een pack-upgrade, zodat een upgrade altijd omkeerbaar is.
- **pre-restore** - automatisch gemaakt vlak vóór een herstel of een wereldreset, als een vangnet voor het geval het herstel niet is wat u wilde.

## Retentie

De retentie is **beperkt per server, per reden**: de nieuwste in elke groep worden bewaard, oudere worden automatisch opgeruimd na elke succesvolle backup:

| Reden       | Bewaard |
| ----------- | ------- |
| gepland     | 10      |
| pre-update  | 10      |
| handmatig   | 20      |
| pre-restore | 5       |

`pre-restore` heeft zijn eigen kleine opslagruimte, juist zodat een automatische veiligheidsbackup nooit een `handmatige` backup kan verwijderen die u bewust hebt bewaard.

Twee optionele limieten zijn van toepassing bovenop de tellingen per reden, beide standaard uitgeschakeld: een **maximale leeftijd** (backups ouder dan N dagen worden opgeruimd, ongeacht hun reden) en een **maximale totale grootte** per server (de oudste backups worden opgeruimd totdat het totaal past, waarbij `pre-restore`-backups eerst worden verwijderd). De nieuwste backup van een server wordt nooit door een van beide limieten verwijderd. Al deze instellingen kunnen globaal worden gewijzigd op de instellingenpagina en per server worden overschreven op het tabblad Backups.

Backups kunnen worden **hernoemd** vanuit de backup-lijst (de hernoemknop op elke rij). Het archief op schijf en de gegevens van het paneel bewegen samen, zodat downloaden, herstellen en retentie blijven werken met de nieuwe naam.

![Rename a backup](/docs/images/backup-rename.png)

> De retentie is automatisch begrensd, maar grote modded archieven tellen nog steeds mee voor het [schijfquotum](/docs/storage/) van een server, dus houd het totaal in de gaten voor grote packs.

## Herstellen

Het herstellen van een backup stopt de server (verifieert dat de container echt is gestopt voordat er bestanden worden aangeraakt), maakt een `pre-restore` veiligheidsbackup, vervangt de **volledige serverdirectory** door de snapshot, en laat deze gestopt achter zodat u hem opnieuw kunt starten. Omdat pack-upgrades altijd eerst een `pre-update` backup maken, kunt u een slechte upgrade altijd terugdraaien.

## De eigen database van het paneel

Serverbackups dekken alleen per-server wereldmappen. De eigen database van het paneel (`panel.db`, met gebruikers, rollen, 2FA-geheimen, schema's, pack-pinnen en geschiedenis) wordt afzonderlijk gesnapt tijdens de dagelijkse onderhoudstimer:

- `VACUUM INTO` schrijft een consistente, gedefragmenteerde kopie naar `data/backups/_panel/`; de nieuwste **14** worden bewaard.
- Bij het opstarten voert het paneel `PRAGMA integrity_check` uit en logt luid als deze mislukt, en wijst u op `data/backups/_panel` voor de nieuwste goede kopie.

Maak een backup van de volledige `data/`-tree (het bevat ook `.secret-key`, de encryptiesleutel in rust) en u heeft alles gebackupt.

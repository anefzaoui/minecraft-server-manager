---
title: 'Een wereld verkleinen'
description: 'Verklein een Minecraft-wereld door zelden bezochte chunks te verwijderen, om schijfruimte terug te winnen en back-ups te versnellen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Terug naar de documentatie-index](/docs/)

Na verloop van tijd breidt een wereld zich uit: elke plek waar een speler ooit heeft gelopen, gevlogen of is meegenomen door een Ender Pearl, laat gegenereerde chunks op schijf achter, zelfs als niemand ooit terugging. **Wereld krimpen** verwijdert de chunks waar bijna niemand tijd in heeft doorgebracht, zodat de wereld minder ruimte inneemt. Minecraft herbouwt een verwijderd gebied vanuit de wereldzaad op het moment dat iemand er weer naartoe reist, dus dit is veilig voor land dat niemand gebruikt, maar alles wat een speler _bouwde_ op een plek waar ze nauwelijks stonden, zou ook verdwijnen, daarom moet je eerst een back-up maken (de back-up is de ongedaanmaking).

## Wat telt als "zelden bezocht"

Elke chunk registreert hoeveel tijd spelers erin hebben doorgebracht (Minecraft noemt dit `InhabitedTime`). Wereld krimpen verwijdert standaard elke chunk met minder dan **30 seconden** totale speeltijd; het dialoogvenster voor krimpen laat je die drempel (1 seconde tot 1 uur) en het aantal chunks rond de spawn dat je wilt behouden (standaard 8, `0` schakelt spawn-bescherming uit) aanpassen.

Wat altijd wordt behouden:

- Het gebied rond het **spawn-punt** van de wereld (gelezen uit `level.dat`) in de overworld. De Nether, de End en aangepaste dimensies hebben geen spawn-gebied.
- Elke chunk waarvan de bezoekstijd niet kon worden gelezen, bijvoorbeeld een wereld opgeslagen met een compressieformaat dat het paneel niet decodeert (LZ4). Het voorbeeld en het resultaat laten zien hoeveel van dergelijke chunks zijn overgeslagen.

Elke dimensie van de wereld wordt behandeld: Bukkit-stijl zustermappen (`world_nether`, `world_the_end`) evenals de vanilla en Forge/Fabric-indeling (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Wanneer een chunk wordt verwijderd, gaan de entiteiten en de punten van belang van de dorpelingen mee, dus een geregenereerde chunk erft geen verouderde mobs, mijntreinen of banen.

## Dit doen vanuit het tabblad Werelden

1. Maak een back-up van het tabblad **Back-ups**. Krimpen vanuit het tabblad Werelden maakt er geen voor je.
2. Open **Wereld → Werelden**, zoek de wereld en klik op het krimp-icoon.
3. Klik op **Voorbeeld** om ruwweg te zien hoeveel chunks (en hoeveel megabytes) zouden worden verwijderd. Er wordt nog niets gewijzigd; een voorbeeld werkt terwijl de server draait.
4. Klik op **Wereld krimpen**. Krimpen bewerkt de wereld-bestanden direct, dus de server moet gestopt zijn: stop hem eerst, of vink de optie aan om hem te stoppen, te krimpen en weer te starten in één keer (de server wordt opnieuw gestart, zelfs als het krimpen mislukt). De voortgang wordt weergegeven in de taakbalk.

![Wereld krimpen](/docs/images/world-shrink.png)

## Dit doen als onderdeel van een back-up

Vink op het tabblad **Back-ups** **"Krimp de wereld ook daarna"** aan voordat je op **Nu back-uppen** klikt. Het back-up-archief wordt eerst geschreven (dat archief is je ongedaanmaking), daarna wordt de wereld gekrompen, maar alleen als de server gestopt is. Als de server draait, wordt de back-up nog steeds gemaakt en wordt het krimpen overgeslagen met een melding.

Geplande back-ups hebben dezelfde optie: kies in de planner-editor de taak **Back-up** en vink **"Krimp de wereld na elke back-up"** aan. Koppel dit aan een **Server stoppen**-planning een paar minuten eerder als je wilt dat het onbeheerd wordt uitgevoerd.

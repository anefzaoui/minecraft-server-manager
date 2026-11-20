---
title: 'Opslag'
description: 'Bekijk waar schijfruimte naartoe gaat, stel een schijfquotum in voor elke servermap, en ruim op wat u niet langer nodig heeft.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Opslag** toont waar je schijfruimte naartoe gaat: gebruik per categorie, elke server tegen zijn quotum, de grootste bestanden en hoe het totale gebruik zich ontwikkelt over recente scans. Deze pagina is alleen voor beheerders.

![Opslag](/docs/images/storage.png)

## Schijfquota's worden afgedwongen door het paneel

Docker kan het schijfgebruik van een bind mount niet beperken, dus het paneel doet dit. Een achtergrond-indexeerder scant de data-map (elke 15 minuten, na wijzigingen, of wanneer je op **Nu Scannen** drukt), slaat de voetafdruk van elke server op en handhaaft het schijfquotum dat je per server instelt. Een actie die de map van een server (world, mods, configs, logs en al het andere erin) over zijn quotum zou brengen, zoals het installeren van een mod of een wereld of het uploaden van bestanden, wordt geblokkeerd totdat er ruimte is vrijgemaakt of het quotum is verhoogd, in plaats van één server je host te laten vullen.

Stel het quotum van een server in via de [instellingen](/docs/servers/#server-settings). Door daar **Stop de Server bij Overschrijding Quotum** in te schakelen, wordt een draaiende server ook gestopt zodra de map meer dan 10% boven het quotum uitgroeit, en dit wordt genoteerd in de geschiedenis van de server. Servers met mods kunnen groot zijn, dus geef ze ruimte. [Back-ups](/docs/backups/) worden apart opgeslagen en tellen niet mee voor het quotum.

## Opruimen

De kaart **Opruimen met één klik** maakt ruimte vrij die het paneel veilig kan terugwinnen: tijdelijke bestanden ouder dan een uur, wees-bibliotheekbestanden en gearchiveerde logs en crashrapporten ouder dan 30 dagen. Elk item toont hoeveel ruimte het vrijmaakt en opent een voorbeeld voordat er iets wordt verwijderd. De lijsten **Per Categorie** en **Grootste Bestanden** linken rechtstreeks naar de bestandsbeheerder, zodat je kunt zien wat je nog meer kunt opruimen voordat je zonder ruimte komt te zitten.

---
title: 'Opslag'
description: 'De Opslag-pagina toont waar je schijfruimte naartoe gaat: gebruik per server en hoe dit zich in de loop van de tijd ontwikkelt.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Opslag** toont waar je schijfruimte naartoe gaat: gebruik per server en hoe dit zich in de loop van de tijd ontwikkelt.

![Opslag](/docs/images/storage.png)

## Schijfquota's worden afgedwongen door het paneel

Docker kan het schijfgebruik van een bind mount niet beperken, dus het paneel doet dit. Een achtergrond-indexeerder scant de gegevensmap, cachet de voetafdruk van elke server en handhaaft de schijfquota die je per server instelt. Wanneer de gegevens van een server (wereld + back-ups + al het andere) de limiet naderen, stopt het paneel de ongebreidelde groei in plaats van één server je host te laten vullen.

Stel de quota van een server in via de [instellingen](/docs/servers/). Servers met mods en hun [back-ups](/docs/backups/) kunnen groot zijn, dus geef ze de ruimte.

## Opruimen

De Opslag-weergave helpt je te vinden wat je kunt snoeien (oude back-ups, ongebruikte werelden, of een server die ver buiten de verwachtingen is gegroeid) voordat je zonder ruimte komt te zitten.

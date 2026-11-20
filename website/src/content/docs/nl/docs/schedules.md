---
title: "Schema's"
description: "De pagina Schema's automatiseert terugkerende taken met cron-expressies. Geen externe cron, geen scripts."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Schema's** automatiseert terugkerende taken met cron-expressies. Geen externe cron, geen scripts.

![Schema's](/docs/images/schedules.png)

## Wat u kunt plannen

- **Herstarts**: een nachtelijke herstart om een langlopende server gezond te houden.
- **Stops en starts**: een server 's nachts uitschakelen en 's ochtends weer inschakelen.
- **Back-ups**: regelmatige snapshots (gelabeld als `scheduled` op de pagina [Back-ups](/docs/backups/)). Een back-upschema kan ook de wereld na elke back-up verkleinen ([een wereld verkleinen](/docs/world-shrink/)). Elke nieuwe server krijgt automatisch een dagelijks back-upschema.
- **Commando's**: voer elk servercommando uit op een schema.
- **Updatecontroles**: ververs periodiek wat verouderd is. De geplande controle is ook wat updates toepast voor servers die zijn ingesteld op [Automatische update](/docs/modpacks/#update-policy).

Elk schema richt zich op een specifieke server (of het paneel globaal), draait op zijn eigen cron-expressie en kan worden ingeschakeld of uitgeschakeld zonder te worden verwijderd. De editor toont de volgende uitvoertijden terwijl u typt, cron-tijden volgen de tijdzone van het paneel (ingesteld in **Instellingen**), en de tabel toont de volgende uitvoering van elk schema. Elke uitvoering wordt vastgelegd als een geschiedenisgebeurtenis, net als een mislukte uitvoering.

Het paneel start ook zijn eigen onderhoudsschema's op de eerste keer opstarten, die u kunt aanpassen of uitschakelen: een dagelijkse updatecontrole, een opslagherschanning elke zes uur, een dagelijkse opschoning van oude tijdelijke bestanden, een controle op verlopen bans elke 15 minuten (het opheffen van tijdelijke bans die zijn verlopen), en een nachtelijke backfill van contentmetadata (het invullen van ontbrekende modnamen en pictogrammen).

## Wanneer de server bezig is

Een gepland back-up- of startcommando dat zijn server midden in een andere actie aantreft (een herstel, een back-up opschoning, een poortwijziging) wacht en probeert het elke minuut opnieuw totdat die actie is voltooid, tot maximaal 30 minuten. Een wachtende start wordt geannuleerd als iemand de server ondertussen start of stopt. Een geplande herstart of stop wordt niet opnieuw geprobeerd: deze wordt overgeslagen en wordt opnieuw uitgevoerd op het volgende geplande tijdstip.

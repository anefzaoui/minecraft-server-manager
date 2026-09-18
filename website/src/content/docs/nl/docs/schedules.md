---
title: "Schema's"
description: "De pagina Schema's automatiseert terugkerende taken met cron-expressies."
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Schema's** automatiseert terugkerende taken met cron-expressies. Geen externe cron, geen scripts.

![Schema's](/docs/images/schedules.png)

## Wat u kunt plannen

- **Herstarts** - een nachtelijke herstart om een langlopende server gezond te houden.
- **Back-ups** - regelmatige snapshots (gelabeld `scheduled` op de pagina [Back-ups](/docs/backups/)).
- **Commando's** - voer elk servercommando uit volgens een schema.
- **Update-controles** - ververs periodiek wat verouderd is.

Elk schema richt zich op een specifieke server (of het paneel globaal), draait op zijn eigen cron-expressie en kan worden ingeschakeld of uitgeschakeld zonder het te verwijderen. De laatste uitvoertijd wordt weergegeven, zodat u kunt bevestigen dat het correct wordt uitgevoerd.

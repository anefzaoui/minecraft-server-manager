---
title: 'Tidsplaner'
description: 'Siden Tidsplaner automatiserer gjentakende oppgaver med cron-uttrykk.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Tilbake til dokumentindeks](/docs/)

**Tidsplaner**-siden automatiserer gjentakende oppgaver med cron-uttrykk. Ingen ekstern cron, ingen skript.

![Tidsplaner](/docs/images/schedules.png)

## Hva du kan tidsplanlegge

- **Omstarter** - en nattlig omstart for å holde en server som kjører lenge sunn.
- **Sikkerhetskopier** - regelmessige øyeblikksbilder (merket `scheduled` på [Sikkerhetskopier](/docs/backups/)-siden).
- **Kommandoer** - kjør en hvilken som helst serverkommando på en tidsplan.
- **Oppdateringssjekker** - oppdater periodisk hva som er utdatert.

Hver tidsplan retter seg mot en spesifikk server (eller panelet globalt), kjører på sitt eget cron-uttrykk, og kan aktiveres eller deaktiveres uten å slette den. Siste kjøretid vises slik at du kan bekrefte at den kjører.

---
title: 'Scheman'
description: 'Sidan Scheman automatiserar återkommande uppgifter med cron-uttryck.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Tillbaka till dokumentindex](/docs/)

**Scheman**-sidan automatiserar återkommande uppgifter med cron-uttryck. Ingen extern cron, inga skript.

![Scheman](/docs/images/schedules.png)

## Vad du kan schemalägga

- **Omstarter** - en nattlig omstart för att hålla en server som körs länge frisk.
- **Säkerhetskopior** - regelbundna ögonblicksbilder (märkta `scheduled` på sidan [Säkerhetskopior](/docs/backups/)).
- **Kommandon** - kör valfritt serverkommando enligt ett schema.
- **Uppdateringskontroller** - uppdatera periodiskt vad som är föråldrat.

Varje schema riktar sig mot en specifik server (eller panelen globalt), körs med sitt eget cron-uttryck och kan aktiveras eller inaktiveras utan att tas bort. Tiden för senaste körning visas så att du kan bekräfta att den körs.

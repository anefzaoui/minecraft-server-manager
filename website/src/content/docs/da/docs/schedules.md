---
title: 'Tidsplaner'
description: 'Siden Tidsplaner automatiserer tilbagevendende opgaver med cron-udtryk.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Planer**-siden automatiserer tilbagevendende opgaver med cron-udtryk. Ingen ekstern cron, ingen scripts.

![Planer](/docs/images/schedules.png)

## Hvad du kan planlægge

- **Genstarter** - en natlig genstart for at holde en server, der kører længe, sund.
- **Sikkerhedskopier** - regelmæssige snapshots (mærket `scheduled` på [Sikkerhedskopier](/docs/backups/) siden).
- **Kommandoer** - kør enhver serverkommando efter en tidsplan.
- **Opdateringskontroller** - opdater periodisk, hvad der er forældet.

Hver plan målretter en specifik server (eller panelet globalt), kører på sit eget cron-udtryk og kan aktiveres eller deaktiveres uden at blive slettet. Sidste køretid vises, så du kan bekræfte, at den kører.

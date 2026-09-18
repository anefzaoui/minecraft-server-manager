---
title: 'Aktivitetslogg'
description: 'Aktivitetssidan är den fullständiga granskningsloggen: en sökbar, kronologisk logg över allt som har hänt i panelen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Tillbaka till dokumentindex](/docs/)

Sidan **Aktivitet** är den fullständiga granskningsloggen: en sökbar, kronologisk logg över allt som har hänt i panelen.

![Aktivitet](/docs/images/activity.png)

## Vad som loggas

- **Autentisering** - inloggningar (inklusive om 2FA eller en backupkod användes), och 2FA aktiverades, inaktiverades eller återställdes.
- **Serverlivscykel** - skapanden, starter, stopp, omstarter, krascher och "out-of-memory"-händelser.
- **Varningar** - "stalled boots", stoppfel, misslyckade schemaläggningar, stopp på grund av kvoter, ohälsosamma containrar, "offline-after-restart".
- **Data** - säkerhetskopior skapade och återställda, "blueprints" exporterade, "pack"-installationer och uppgraderingar.
- **Konfiguration** - ändringar av chattkommandon, rolländringar och redigeringar av inställningar.

Varje post registrerar vem som utförde åtgärden (ett användarnamn, eller panelen/schemaläggaren för automatiserade åtgärder), vilken server det gäller och när. [Instrumentpanelen](/docs/dashboard/) visar de senaste posterna; den här sidan är hela historiken. Livscykel- och varningshändelser kan också vidarebefordras till Discord (se [Integrationer](/docs/integrations/)).

Eftersom den fångar säkerhetsrelevanta händelser (inloggningar, 2FA-ändringar, rolländringar), är aktivitetsloggen också din första anhalt om något verkar vara fel med ett konto.

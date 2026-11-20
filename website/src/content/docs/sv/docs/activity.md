---
title: 'Aktivitetslogg'
description: 'Aktivitetssidan är den fullständiga granskningsloggen: en sökbar, kronologisk logg över allt som har hänt i panelen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Tillbaka till dokumentindex](/docs/)

Sidan **Aktivitet** är den fullständiga granskningsloggen: en sökbar, kronologisk registrering av allt som har hänt i panelen. Filtrera den efter server eller händelsetyp, sök i sammanfattningarna och exportera det du filtrerat som CSV eller JSON. Poster som fångade en logg (t.ex. en krasch) öppnar den på plats.

![Aktivitet](/docs/images/activity.png)

## Vad som registreras

- **Autentisering**: inloggningar (inklusive om 2FA eller en reservkod användes), kontolåsningar, lösenordsändringar och 2FA som aktiverats, inaktiverats eller återställts.
- **Serverlivscykel**: skapanden, starter, stopp, omstarter, krascher, automatiska omstarter och händelser med slut på minne.
- **Varningar**: tröga uppstarter, stoppfel, misslyckade scheman, kvotstopp, ohälsosamma containrar, offline-efter-omstart.
- **Data**: säkerhetskopior som skapats och återställts, ritningar som exporterats, paketinstallationer och uppgraderingar, ändringar av moddar och världar, samt filredigeringar.
- **Spelare**: sparkar, bannlysningar, ändringar i vitlistan och op-status, samt spelarnoter.
- **Konfiguration**: ändringar av chattkommandon, ändringar av användare och roller, server-specifika behörighetsändringar, ändringar av spelportar och inställningsredigeringar.

Varje post registrerar vem som utförde åtgärden (ett användarnamn, eller panelen/schemaläggaren för automatiserade åtgärder), vilken server det gäller och när. [Instrumentpanelen](/docs/dashboard/) visar de senaste posterna; den här sidan är hela historiken. Operatörer och tittare ser bara poster för de servrar de kan se (plus panelövergripande), och server-specifika behörighetsändringar visas endast för administratörer. Livscykel- och varningshändelser kan också vidarebefordras till Discord (se [Integrationer](/docs/integrations/)).

Eftersom den fångar säkerhetsrelevanta händelser (inloggningar, 2FA-ändringar, ändringar av roller och behörigheter), är aktivitetsloggen också din första anhalt om något verkar vara fel med ett konto.

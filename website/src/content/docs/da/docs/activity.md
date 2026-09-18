---
title: 'Aktivitetslog'
description: 'Aktivitetssiden er den komplette revisionsspor: en søgbar, kronologisk oversigt over alt, hvad der er sket i panelet.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Aktivitet**-siden er den komplette revisionslog: en søgbar, kronologisk registrering af alt, hvad der er sket i panelet.

![Aktivitet](/docs/images/activity.png)

## Hvad registreres

- **Autentificering** - login (inklusive om 2FA eller en backupkode blev brugt), og 2FA blev aktiveret, deaktiveret eller nulstillet.
- **Serverlivscyklus** - oprettelser, start, stop, genstart, nedbrud og out-of-memory-hændelser.
- **Alarmer** - fastlåste opstart, stopfejl, mislykkede tidsplaner, kvote-stop, usunde containere, offline-efter-genstart.
- **Data** - sikkerhedskopier oprettet og gendannet, skabeloner eksporteret, pakkeinstallationer og opgraderinger.
- **Konfiguration** - ændringer af chatkommandoer, rolleændringer og redigering af indstillinger.

Hvert element registrerer, hvem der gjorde det (et brugernavn eller panelet/planlæggeren for automatiserede handlinger), hvilken server det vedrører, og hvornår. [Dashboardet](/docs/dashboard/) viser de seneste elementer; denne side er den komplette historik. Livscyklus- og alarmhændelser kan også videresendes til Discord (se [Integrationer](/docs/integrations/)).

Fordi det fanger sikkerhedsrelevante hændelser (login, 2FA-ændringer, rolleændringer), er aktivitetsloggen også dit første stop, hvis noget ser forkert ud med en konto.

---
title: 'Aktivitetslog'
description: 'Aktivitetssiden er den komplette revisionsspor: en søgbar, kronologisk oversigt over alt, hvad der er sket i panelet.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Aktivitet**-siden er den komplette revisionslog: en søgbar, kronologisk oversigt over alt, der er sket i panelet. Filtrer den efter server eller hændelsestype, søg i resuméerne, og eksporter det filtrerede som CSV eller JSON. Poster, der har fanget en log (f.eks. et crash), åbner den på stedet.

![Aktivitet](/docs/images/activity.png)

## Hvad der registreres

- **Autentificering**: login (inklusive om 2FA eller en backupkode blev brugt), kontolåsninger, adgangskodeskift og 2FA, der er aktiveret, deaktiveret eller nulstillet.
- **Serverlivscyklus**: oprettelser, starter, stopper, genstarter, crashes, automatiske genstarter og hændelser med for lidt hukommelse.
- **Alarmer**: fastlåste opstarter, stopfejl, mislykkede tidsplaner, kvotastop, usunde containere, offline-efter-genstart.
- **Data**: oprettede og gendannede sikkerhedskopier, eksporterede skabeloner, installerede og opgraderede pakker, ændringer af mods og verdener samt filredigeringer.
- **Spillere**: spark, bans, ændringer af whitelist og op, samt spillerbemærkninger.
- **Konfiguration**: ændringer af chatkommandoer, ændringer af brugere og roller, server-specifikke tillidsændringer, ændringer af spilporte og redigering af indstillinger.

Hver post registrerer, hvem der gjorde det (et brugernavn eller panelet/planlæggeren for automatiserede handlinger), hvilken server det vedrører, og hvornår. [Dashboardet](/docs/dashboard/) viser de seneste poster; denne side er den komplette historik. Operatører og seere ser kun poster for de servere, de kan se (plus panel-dækkende), og server-specifikke tillidsændringer vises kun for administratorer. Livscyklus- og alarmhændelser kan også videresendes til Discord (se [Integrationer](/docs/integrations/)).

Da den fanger sikkerhedsrelevante hændelser (login, 2FA-ændringer, rolle- og tillidsændringer), er aktivitetsloggen også dit første stop, hvis noget ser forkert ud med en konto.

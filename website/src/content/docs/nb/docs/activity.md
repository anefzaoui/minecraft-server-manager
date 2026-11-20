---
title: 'Aktivitetslogg'
description: 'Aktivitetssiden er den komplette revisjonsloggen: en søkbar, kronologisk oversikt over alt som har skjedd i panelet.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Tilbake til dokumentindeks](/docs/)

**Aktivitet**-siden er den komplette revisjonsloggen: en søkbar, kronologisk oversikt over alt som har skjedd i panelet. Filtrer den etter server eller hendelsestype, søk i sammendragene, og eksporter det du har filtrert som CSV eller JSON. Oppføringer som fanget en logg (en krasj, for eksempel) åpner den på stedet.

![Aktivitet](/docs/images/activity.png)

## Hva som registreres

- **Autentisering**: innlogginger (inkludert om 2FA eller en sikkerhetskode ble brukt), kontolåsing, passordendringer, og 2FA som ble aktivert, deaktivert eller tilbakestilt.
- **Serverlivssyklus**: opprettelser, starter, stopper, omstarter, krasj, automatiske omstarter og hendelser uten minne.
- **Varsler**: stansede oppstarter, stoppfeil, mislykkede tidsplaner, kvottestopp, usunne containere, offline-etter-omstart.
- **Data**: sikkerhetskopier opprettet og gjenopprettet, blåkopier eksportert, pakkeinstallasjoner og oppgraderinger, mod- og verdensendringer, og filditeringer.
- **Spillere**: spark, utestengelser, endringer i hvitliste og op, og spillerkommentarer.
- **Konfigurasjon**: endringer i chat-kommandoer, bruker- og rolendringer, server-spesifikke tillatelsesendringer, endringer i spillporter, og innstillingsendringer.

Hver oppføring registrerer hvem som gjorde det (et brukernavn, eller panelet/planleggeren for automatiserte handlinger), hvilken server det gjelder, og når. [Kontrollpanelet](/docs/dashboard/) viser de nyeste oppføringene; denne siden er den komplette historikken. Operatører og seere ser bare oppføringer for serverne de kan se (pluss panelomfattende), og server-spesifikke tillatelsesendringer vises kun for administratorer. Livssyklus- og varselhendelser kan også videresendes til Discord (se [Integrasjoner](/docs/integrations/)).

Siden den fanger opp sikkerhetsrelevante hendelser (innlogginger, 2FA-endringer, rolle- og tillatelsesendringer), er aktivitetsloggen også ditt første stopp hvis noe ser feil ut med en konto.

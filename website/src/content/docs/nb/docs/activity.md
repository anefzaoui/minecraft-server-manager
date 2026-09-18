---
title: 'Aktivitetslogg'
description: 'Aktivitetssiden er den komplette revisjonsloggen: en søkbar, kronologisk oversikt over alt som har skjedd i panelet.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Tilbake til dokumentindeks](/docs/)

**Aktivitet**-siden er den komplette revisjonsloggen: en søkbar, kronologisk oversikt over alt som har skjedd i panelet.

![Aktivitet](/docs/images/activity.png)

## Hva som registreres

- **Autentisering** - innlogginger (inkludert om 2FA eller en reservekode ble brukt), og 2FA blir aktivert, deaktivert eller tilbakestilt.
- **Serverens livssyklus** - opprettelser, starter, stopper, omstarter, krasj og hendelser uten minne.
- **Varsler** - stansede oppstarter, stoppfeil, mislykkede tidsplaner, kvotestopp, usunne containere, offline-etter-omstart.
- **Data** - sikkerhetskopier opprettet og gjenopprettet, maler eksportert, pakkeinstallasjoner og oppgraderinger.
- **Konfigurasjon** - endringer i chat-kommandoer, rolleendringer og redigeringer av innstillinger.

Hver oppføring registrerer hvem som gjorde det (et brukernavn, eller panelet/planleggeren for automatiserte handlinger), hvilken server det gjelder, og når. [Kontrollpanelet](/docs/dashboard/) viser de nyeste oppføringene; denne siden er den komplette historikken. Livssyklus- og varselhendelser kan også videresendes til Discord (se [Integrasjoner](/docs/integrations/)).

Fordi den fanger opp sikkerhetsrelevante hendelser (innlogginger, 2FA-endringer, rolleendringer), er aktivitetsloggen også ditt første stopp hvis noe ser ut til å være galt med en konto.

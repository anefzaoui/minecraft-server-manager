---
title: 'Lagerplads'
description: 'Lagerplads-siden viser, hvor din diskplads bliver brugt: forbrug pr. server og hvordan det udvikler sig over tid.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Tilbage til dokumentindeks](/docs/)

**Lagerplads**-siden viser, hvor din disk bliver brugt: forbrug pr. server og hvordan det udvikler sig over tid.

![Lagerplads](/docs/images/storage.png)

## Diskkvoter håndhæves af panelet

Docker kan ikke begrænse diskforbruget af en bind mount, så panelet gør det. En baggrunds-størrelsesindekserer gennemgår data-mappen, cacher hver servers fodaftryk og håndhæver den diskkvote, du indstiller pr. server. Når en servers data (verden + sikkerhedskopier + alt andet) nærmer sig sin kvote, stopper panelet ukontrolleret vækst i stedet for at lade én server fylde din vært.

Indstil en servers kvote i dens [indstillinger](/docs/servers/). Moddede servere og deres [sikkerhedskopier](/docs/backups/) kan være store, så giv dem plads.

## Oprydning

Lagerplads-visningen hjælper dig med at finde, hvad du skal beskære (gamle sikkerhedskopier, ubrugte verdener eller en server, der er vokset langt ud over forventningerne), før du løber tør for plads.

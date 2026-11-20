---
title: 'Tidsplaner'
description: 'Tidsplaner-siden automatiserer gjentakende oppgaver med cron-uttrykk. Ingen ekstern cron, ingen skript.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Tilbake til dokumentindeks](/docs/)

**Tidsplaner**-siden automatiserer gjentakende oppgaver med cron-uttrykk. Ingen ekstern cron, ingen skript.

![Tidsplaner](/docs/images/schedules.png)

## Hva du kan tidsplanlegge

- **Omstarter**: en nattlig omstart for å holde en server som kjører lenge sunn.
- **Stopp og start**: ta en server ned over natten og start den opp igjen om morgenen.
- **Sikkerhetskopier**: regelmessige øyeblikksbilder (merket `scheduled` på [Sikkerhetskopier](/docs/backups/)-siden). En sikkerhetskopieringsplan kan også krympe verden etter hver sikkerhetskopi ([krympe en verden](/docs/world-shrink/)). Hver nye server får en daglig sikkerhetskopieringsplan automatisk.
- **Kommandoer**: kjør hvilken som helst serverkommando på en tidsplan.
- **Oppdateringssjekker**: oppdater periodisk hva som er utdatert. Den planlagte sjekken er også det som bruker oppdateringer for servere satt til [Auto-oppdatering](/docs/modpacks/#update-policy).

Hver tidsplan retter seg mot en spesifikk server (eller panelet globalt), kjører på sitt eget cron-uttrykk, og kan aktiveres eller deaktiveres uten å slette den. Redigeringsprogrammet forhåndsviser neste kjøringstid mens du skriver, cron-tider følger panelets tidssone (stilt inn i **Innstillinger**), og tabellen viser neste kjøring for hver tidsplan. Hver utløsning registreres som en historikkhendelse, og det samme gjelder en mislykket kjøring.

Panelet setter også opp sine egne vedlikeholdstidsplaner ved første oppstart, som du kan endre tidspunkt for eller slå av: en daglig oppdateringssjekk, en lagringsskanning hver sjette time, en daglig sletting av gamle midlertidige filer, en feiing av utløpte utestengelser hvert 15. minutt (fjerner midlertidige utestengelser som har løpt ut), og en nattlig fylling av innholdsmetadata (fyller inn manglende modnavn og ikoner).

## Når serveren er opptatt

En planlagt sikkerhetskopi eller start som finner serveren midt i en annen handling (en gjenoppretting, en opprydding av sikkerhetskopier, en portendring) venter og prøver igjen hvert minutt til handlingen er ferdig, i opptil 30 minutter. En ventende start avbrytes hvis noen starter eller stopper serveren i mellomtiden. En planlagt omstart eller stopp blir ikke forsøkt på nytt: den hoppes over og kjøres igjen ved neste planlagte tidspunkt.

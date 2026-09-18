---
title: 'Integrationer'
description: 'Hver server har sine integrationer under Indstillinger-gruppen: Discord, en offentlig Status Side, et-klik Invites og den valgfrie Chatbot-fane.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Tilbage til dokumentindeks](/docs/)

Hver server har sine integrationer under **Indstillinger**-gruppen: **Discord**, en offentlig **Status Side**, **Invites** med ét klik og den valgfrie **Chatbot**-fane. Denne side dækker Discord (de andre har deres egne dokumenter og opsætningshjælpere i panelet).

## Discord-notifikationer

Panelet videresender serverbegivenheder til en Discord-kanal via en webhook. Ingen bot, ingen OAuth.

### Opsætning

1. I Discord: **Serverindstillinger → Integrationer → Webhooks → Ny webhook**. Vælg kanalen og kopier webhook-URL'en.
2. I panelet, åbn serverens **Indstillinger → Discord**-fane, indsæt URL'en i **Webhook URL**, slå kortet **til**, og **Gem**. URL'en gemmes krypteret (i samme lager som dine API-nøgler).
3. Brug **Send test** for at bekræfte, at det virker.

![Discord integration](/docs/images/integrations-discord.png)

For at erstatte en gemt URL, indsæt en ny og gem; lad feltet være tomt for at beholde den nuværende. Den gemte URL vises maskeret (tokenet er skjult).

### Hvad sendes

Notifikationer er grupperet i kategorier, der kan slås til og fra. Alle er slået til som standard.

| Kategori             | Begivenheder                                                             |
| -------------------- | ------------------------------------------------------------------------ |
| **Start / stop**     | Server startet, server stoppet                                           |
| **Nedbrud**          | Nedbrud, nedbruds-loop detekteret, ny nedbrudsrapport                    |
| **Sikkerhedskopier** | Sikkerhedskopi oprettet, sikkerhedskopi gendannet                        |
| **Opdateringer**     | Opdatering anvendt, opdatering tilbagerullet, opdatering fejlet          |
| **Spark / ban**      | Spiller sparket, spiller bandlyst                                        |
| **Alarmer**          | De ting, der stille og roligt efterlader en server ødelagt (se nedenfor) |

### 'Alarmer'-kategorien

`Alarmer` er "noget kræver menneskelig indgriben"-kanalen, for forhold, der tidligere kun var synlige i panelet:

| Begivenhed              | Betydning                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Containeren blev stoppet for at have løbet tør for hukommelse.                                                                           |
| `unhealthy`             | Processen kører, men `mc-health`-proben fejler: en live, men død server.                                                                 |
| `startup-stalled`       | Stadig i gang med at starte efter ca. 10 minutter uden "Færdig" i loggene (med en diagnose af, hvad der skal rettes, hvor det er kendt). |
| `stop-failed`           | Et pænt stop trådte ikke i kraft, og containeren kører stadig.                                                                           |
| `schedule-failed`       | En planlagt genstart / sikkerhedskopi / kommando fejlede.                                                                                |
| `quota-exceeded`        | Disk-kvote i streng tilstand blev overskredet, og serveren blev stoppet.                                                                 |
| `offline-after-restart` | Serveren var oppe før panelet genstartede, er det ikke nu, og vil ikke blive auto-startet.                                               |
| `crash-report`          | En ny nedbrudsrapport blev fanget og parset.                                                                                             |
| `update-failed`         | En beskyttet opgradering kom ikke sund op.                                                                                               |

### Hvordan levering fungerer

En baggrundsbro aflytter [begivenhedsloggen](/docs/activity/) hvert 15. sekund og videresender mappede rækker. Hvis et webhook POST fejler midlertidigt, forsøges den række igen ved senere aflytninger i stedet for at blive droppet; en permanent utilgængelig webhook bliver dæmpet (én loglinje pr. time) efter et par forsøg. Broen afspiller aldrig begivenheder fra før panelet startede.

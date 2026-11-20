---
title: 'Integrationer'
description: 'Hver server har sine integrationer under Indstillinger-gruppen: Discord, en offentlig Status Side, Invites med ét klik og den valgfrie Chatbot-fane (kun for administratorer).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Tilbage til dokumentindeks](/docs/)

Hver server har sine integrationer under **Indstillinger**-gruppen: **Discord**, en offentlig **Statusside**, **Invites** med ét klik og den valgfrie **Chatbot**-fane (kun administratorer). Denne side dækker Discord; [invites & statusside](/docs/invites-and-status-page/) dækker de to, og [chatbotten](/docs/chatbot/) har sin egen side.

## Discord-notifikationer

Panelet videresender serverbegivenheder til en Discord-kanal via en webhook. Ingen bot, ingen OAuth.

### Opsætning

1. I Discord: **Serverindstillinger → Integrationer → Webhooks → Ny Webhook**. Vælg kanalen og kopier webhook-URL'en.
2. I panelet, åbn serverens **Indstillinger → Discord**-fane, indsæt URL'en i **Webhook URL**, tænd for kortet, og **Gem**. URL'en gemmes krypteret (i samme lager som dine API-nøgler).
3. Brug **Send test** for at bekræfte, at det virker.

![Discord-integration](/docs/images/integrations-discord.png)

For at erstatte en gemt URL, indsæt en ny og gem; lad feltet stå tomt for at beholde den nuværende. Den gemte URL vises maskeret (tokenet er skjult).

### Hvad sendes

Notifikationer er grupperet i kategorier, der kan slås til/fra. Alle er slået til som standard.

| Kategori             | Begivenheder                                                             |
| -------------------- | ------------------------------------------------------------------------ |
| **Start / stop**     | Server startet, server stoppet                                           |
| **Nedbrud**          | Nedbrud, nedbrudsloop registreret, ny nedbrudsrapport                    |
| **Sikkerhedskopier** | Sikkerhedskopi oprettet, sikkerhedskopi gendannet                        |
| **Opdateringer**     | Opdatering anvendt, opdatering tilbagerullet, opdatering fejlet          |
| **Kicks / bans**     | Spiller sparket, spiller bannet                                          |
| **Alarmer**          | De ting, der stille og roligt efterlader en server ødelagt (se nedenfor) |

### 'Alarmer'-kategorien

`Alarmer` er kanalen for "noget kræver en menneskelig indgriben", for forhold, der tidligere kun var synlige i panelet:

| Begivenhed              | Betydning                                                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Containeren blev stoppet for at have løbet tør for hukommelse.                                                                           |
| `unhealthy`             | Processen kører, men `mc-health`-proben fejler: en levende, men død server.                                                              |
| `startup-stalled`       | Stadig i gang med at starte efter ca. 10 minutter uden "Færdig" i loggene (med en diagnose af, hvad der skal rettes, hvor det er kendt). |
| `stop-failed`           | Et pænt stop trådte ikke i kraft, og containeren kører stadig.                                                                           |
| `schedule-failed`       | En planlagt genstart / sikkerhedskopi / kommando fejlede.                                                                                |
| `quota-exceeded`        | Disk-kvote i streng tilstand blev overskredet, og serveren blev stoppet.                                                                 |
| `offline-after-restart` | Serveren var online før panelet genstartede, er det ikke nu, og vil ikke blive automatisk startet.                                       |
| `port-change-failed`    | En portændring fejlede, og serveren kunne ikke sættes tilbage på sin gamle port, så den er nede.                                         |
| `auto-restart-gave-up`  | En nedbrudt server blev ikke genstartet, fordi en anden handling holdt den optaget for længe.                                            |

### Hvordan levering fungerer

En baggrundsbro aflytter [aktivitetsloggen](/docs/activity/) hvert 15. sekund og videresender mappede rækker. Hvis en webhook POST fejler midlertidigt, forsøges den række igen ved senere aflytninger i stedet for at blive droppet; efter et par mislykkede forsøg springes rækken over, og leveringsfejl logges højst én gang i timen pr. server. Efter en panelgenstart sender broen de begivenheder, den endnu ikke har leveret, men aldrig mere end to timer tilbage; ved sin allerførste kørsel starter den fra den nyeste begivenhed.

---
title: 'Integrasjoner'
description: 'Hver server har sine integrasjoner under Innstillinger-gruppen: Discord, en offentlig Status-side, Invites med ett klikk og den valgfrie Chatbot-fanen.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Tilbake til dokumentindeks](/docs/)

Hver server har sine integrasjoner under **Innstillinger**-gruppen: **Discord**, en offentlig **Status-side**, **Invitasjoner** med ett klikk, og den valgfrie **Chatbot**-fanen. Denne siden dekker Discord (de andre har sine egne dokumenter og oppsetthjelpere i panelet).

## Discord-varsler

Panelet videresender serverhendelser til en Discord-kanal via en webhook. Ingen bot, ingen OAuth.

### Oppsett

1. I Discord: **Serverinnstillinger → Integrasjoner → Webhooks → Ny Webhook**. Velg kanalen og kopier webhook-URL-en.
2. I panelet, åpne serverens **Innstillinger → Discord**-fane, lim inn URL-en i **Webhook URL**, slå på kortet, og **Lagre**. URL-en lagres kryptert (i samme lagring som API-nøklene dine).
3. Bruk **Send test** for å bekrefte at det fungerer.

![Discord-integrasjon](/docs/images/integrations-discord.png)

For å erstatte en lagret URL, lim inn en ny og lagre; la feltet stå tomt for å beholde den nåværende. Den lagrede URL-en vises maskert (tokenet er skjult).

### Hva sendes

Varsler er gruppert i kategorier som kan slås av/på. Alle er på som standard.

| Kategori                  | Hendelser                                                            |
| ------------------------- | -------------------------------------------------------------------- |
| **Start / stopp**         | Server startet, server stoppet                                       |
| **Krasj**                 | Krasj, krasjløkke oppdaget, ny krasjrapport                          |
| **Sikkerhetskopier**      | Sikkerhetskopi opprettet, sikkerhetskopi gjenopprettet               |
| **Oppdateringer**         | Oppdatering brukt, oppdatering rullet tilbake, oppdatering mislyktes |
| **Spark / utestengelser** | Spiller sparket, spiller utestengt                                   |
| **Varsler**               | Ting som stille etterlater en server ødelagt (se nedenfor)           |

### Varsler-kategorien

`Varsler` er kanalen for "noe trenger et menneske", for forhold som tidligere bare var synlige i panelet:

| Hendelse                | Betydning                                                                                                                   |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Beholderen ble stoppet for å ha gått tom for minne.                                                                         |
| `unhealthy`             | Prosessen kjører, men `mc-health`-sonden feiler: en levende, men død server.                                                |
| `startup-stalled`       | Fortsatt i oppstart etter ca. 10 minutter uten "Ferdig" i loggene (med en diagnose av hva som må fikses, der det er kjent). |
| `stop-failed`           | En ryddig stopp tok ikke effekt, og beholderen kjører fortsatt.                                                             |
| `schedule-failed`       | En planlagt omstart / sikkerhetskopi / kommando mislyktes.                                                                  |
| `quota-exceeded`        | Disk-kvote i streng modus ble utløst, og serveren ble stoppet.                                                              |
| `offline-after-restart` | Serveren var oppe før panelet startet på nytt, er det ikke nå, og vil ikke bli startet automatisk.                          |
| `crash-report`          | En ny krasjrapport ble fanget opp og analysert.                                                                             |
| `update-failed`         | En sikret oppgradering kom ikke opp som sunn.                                                                               |

### Hvordan levering fungerer

En bakgrunnsbro sjekker [hendelsesloggen](/docs/activity/) hvert 15. sekund og videresender matchede rader. Hvis en webhook POST feiler midlertidig, prøves den raden på nytt ved senere sjekker i stedet for å bli droppet; en permanent utilgjengelig webhook blir dempet (én logglinje per time) etter noen få forsøk. Broen spiller aldri av hendelser fra før panelet startet.

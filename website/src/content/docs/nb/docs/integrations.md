---
title: 'Integrasjoner'
description: 'Hver server har sine integrasjoner under Innstillinger-gruppen: Discord, en offentlig Status-side, Invitasjoner med ett klikk, og den valgfrie Chatbot-fanen (kun for administratorer).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Tilbake til dokumentindeks](/docs/)

Hver server har sine integrasjoner under **Innstillinger**-gruppen: **Discord**, en offentlig **Status-side**, **Invitasjoner** med ett klikk, og den valgfrie **Chatbot**-fanen (kun for administratorer). Denne siden dekker Discord; [invitasjoner og status-side](/docs/invites-and-status-page/) dekker de to, og [chatboten](/docs/chatbot/) har sin egen side.

## Discord-varsler

Panelet videresender serverhendelser til en Discord-kanal via en webhook. Ingen bot, ingen OAuth.

### Oppsett

1. I Discord: **Serverinnstillinger → Integrasjoner → Webhooks → Ny webhook**. Velg kanalen og kopier webhook-URL-en.
2. I panelet, åpne serverens **Innstillinger → Discord**-fane, lim inn URL-en i **Webhook URL**, slå på kortet, og **Lagre**. URL-en lagres kryptert (i samme lagring som dine API-nøkler).
3. Bruk **Send test** for å bekrefte at det fungerer.

![Discord-integrasjon](/docs/images/integrations-discord.png)

For å erstatte en lagret URL, lim inn en ny og lagre; la feltet stå tomt for å beholde den nåværende. Den lagrede URL-en vises maskert (tokenet er skjult).

### Hva sendes

Varsler er gruppert i kategorier som kan slås av og på. Alle er på som standard.

| Kategori             | Hendelser                                                         |
| -------------------- | ----------------------------------------------------------------- |
| **Start / stopp**    | Server startet, server stoppet                                    |
| **Krasj**            | Krasj, krasjløkke oppdaget, ny krasjrapport                       |
| **Sikkerhetskopier** | Sikkerhetskopi opprettet, sikkerhetskopi gjenopprettet            |
| **Oppdateringer**    | Oppdatering brukt, oppdatering rullet tilbake, oppdatering feilet |
| **Spark / bann**     | Spiller sparket, spiller bannet                                   |
| **Varsler**          | Ting som stille etterlater en server ødelagt (se nedenfor)        |

### Varsler-kategorien

`Varsler` er kanalen for "noe trenger et menneske", for forhold som tidligere bare var synlige i panelet:

| Hendelse                | Betydning                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `oom`                   | Beholderen ble stoppet fordi den gikk tom for minne.                                                                     |
| `unhealthy`             | Prosessen kjører, men `mc-health`-sjekken feiler: en levende, men død server.                                            |
| `startup-stalled`       | Starter fortsatt etter ca. 10 minutter uten "Ferdig" i loggene (med en diagnose av hva som må fikses, der det er kjent). |
| `stop-failed`           | En ryddig stopp tok ikke effekt, og beholderen kjører fortsatt.                                                          |
| `schedule-failed`       | En planlagt omstart / sikkerhetskopi / kommando feilet.                                                                  |
| `quota-exceeded`        | Disk-kvote i streng modus ble overskredet, og serveren ble stoppet.                                                      |
| `offline-after-restart` | Serveren var oppe før panelet startet på nytt, er det ikke nå, og vil ikke bli startet automatisk.                       |
| `port-change-failed`    | En portendring feilet, og serveren kunne ikke settes tilbake til sin gamle port, så den er nede.                         |
| `auto-restart-gave-up`  | En krasjet server ble ikke startet på nytt fordi en annen handling holdt den opptatt for lenge.                          |

### Hvordan levering fungerer

En bakgrunnsbro sjekker [hendelsesloggen](/docs/activity/) hvert 15. sekund og videresender matchede rader. Hvis en webhook POST feiler midlertidig, prøves den raden på nytt ved senere sjekker i stedet for å bli droppet; etter noen få mislykkede forsøk hoppes raden over, og leveringsfeil logges maksimalt én gang per time per server. Etter en panel-omstart sender broen hendelsene den ennå ikke har levert, men aldri mer enn to timer tilbake; ved sin aller første kjøring starter den fra den nyeste hendelsen.

---
title: 'Integrationer'
description: 'Varje server har sina integrationer under gruppen Inställningar: Discord, en publik Status Sida, engångs-inbjudningar och den valfria Chattbot-fliken (endast administratörer).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Tillbaka till dokumentindex](/docs/)

Varje server har sina integrationer under gruppen **Inställningar**: **Discord**, en publik **Status Sida**, **Inbjudningar** med ett klick, och den valfria fliken **Chatbot** (endast för administratörer). Den här sidan täcker Discord; [inbjudningar & status sida](/docs/invites-and-status-page/) täcker de två, och [chatboten](/docs/chatbot/) har en egen sida.

## Discord-notiser

Panelen vidarebefordrar serverhändelser till en Discord-kanal via en webhook. Ingen bot, ingen OAuth.

### Installation

1. I Discord: **Serverinställningar → Integrationer → Webhooks → Ny Webhook**. Välj kanalen och kopiera webhook-URL:en.
2. I panelen, öppna serverns flik **Inställningar → Discord**, klistra in URL:en i **Webhook URL**, slå på kortet **på**, och **Spara**. URL:en lagras krypterat (i samma lagring som dina API-nycklar).
3. Använd **Skicka Test** för att bekräfta att det fungerar.

![Discord integration](/docs/images/integrations-discord.png)

För att ersätta en lagrad URL, klistra in en ny och spara; lämna fältet tomt för att behålla den nuvarande. Den lagrade URL:en visas maskerad (token är dold).

### Vad som skickas

Notiser grupperas i kategorier som kan slås på och av. Alla är på som standard.

| Kategori                  | Händelser                                                               |
| ------------------------- | ----------------------------------------------------------------------- |
| **Start / stopp**         | Server startad, server stoppad                                          |
| **Krascher**              | Krasch, kraschloop upptäckt, ny kraschrapport                           |
| **Säkerhetskopior**       | Säkerhetskopia skapad, säkerhetskopia återställd                        |
| **Uppdateringar**         | Uppdatering tillämpad, uppdatering återställd, uppdatering misslyckades |
| **Kicks / bannlysningar** | Spelare kickad, spelare bannlyst                                        |
| **Varningar**             | Saker som tyst lämnar en server trasig (se nedan)                       |

### Kategorin Varningar

`Varningar` är kanalen för "något behöver en människa", för förhållanden som tidigare bara var synliga i panelen:

| Händelse                | Betydelse                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Containern stoppades för att minnet tog slut.                                                                                 |
| `unhealthy`             | Processen är igång men `mc-health`-proben misslyckas: en levande men död server.                                              |
| `startup-stalled`       | Startar fortfarande efter ca 10 minuter utan "Klar" i loggarna (med en diagnos av vad som behöver åtgärdas, där det är känt). |
| `stop-failed`           | En smidig stoppåtgärd tog inte effekt och containern körs fortfarande.                                                        |
| `schedule-failed`       | En schemalagd omstart / säkerhetskopia / kommando misslyckades.                                                               |
| `quota-exceeded`        | Disk-kvoten i strikt läge utlöstes och servern stoppades.                                                                     |
| `offline-after-restart` | Servern var igång före panelens omstart, är det inte nu, och kommer inte att startas automatiskt.                             |
| `port-change-failed`    | En portändring misslyckades och servern kunde inte återställas till sin gamla port, så den är nere.                           |
| `auto-restart-gave-up`  | En kraschad server startades inte om eftersom en annan åtgärd höll den upptagen för länge.                                    |

### Hur leveransen fungerar

En bakgrundsbro inspekterar [händelseloggen](/docs/activity/) var 15:e sekund och vidarebefordrar mappade rader. Om en webhook POST misslyckas tillfälligt, försöks den raden igen vid senare inspektioner istället för att tappas; efter några misslyckade försök hoppas raden över, och leveransfel loggas högst en gång per timme per server. Efter en panelomstart skickar bron de händelser den ännu inte levererat, men aldrig mer än två timmar tillbaka; vid sin allra första körning börjar den från den senaste händelsen.

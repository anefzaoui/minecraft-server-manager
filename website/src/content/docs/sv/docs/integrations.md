---
title: 'Integrationer'
description: 'Varje server har sina integrationer under gruppen Inställningar: Discord, en publik Status Sida, en-klicks Inbjudningar och den valfria Chattbot-fliken.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Tillbaka till dokumentindex](/docs/)

Varje server har sina integrationer under gruppen **Inställningar**: **Discord**, en publik **Statusida**, **Inbjudningar** med ett klick och den valfria fliken **Chatbot**. Den här sidan täcker Discord (de andra har sina egna dokument och installationshjälp i panelen).

## Discord-notiser

Panelen vidarebefordrar serverhändelser till en Discord-kanal via en webhook. Ingen bot, ingen OAuth.

### Installation

1. I Discord: **Serverinställningar → Integrationer → Webhooks → Ny webhook**. Välj kanalen och kopiera webhook-URL:en.
2. I panelen, öppna serverns flik **Inställningar → Discord**, klistra in URL:en i **Webhook URL**, slå på kortet **på** och **Spara**. URL:en lagras krypterat (i samma vilande lagring som dina API-nycklar).
3. Använd **Skicka test** för att bekräfta att det fungerar.

![Discord-integration](/docs/images/integrations-discord.png)

För att ersätta en lagrad URL, klistra in en ny och spara; lämna fältet tomt för att behålla den nuvarande. Den lagrade URL:en visas maskerad (token är dold).

### Vad som skickas

Notiser grupperas i kategorier som kan slås på/av. Alla är på som standard.

| Kategori                  | Händelser                                                               |
| ------------------------- | ----------------------------------------------------------------------- |
| **Start / stopp**         | Server startad, server stoppad                                          |
| **Krascher**              | Krasch, kraschloop upptäckt, ny kraschrapport                           |
| **Säkerhetskopior**       | Säkerhetskopia skapad, säkerhetskopia återställd                        |
| **Uppdateringar**         | Uppdatering tillämpad, uppdatering återställd, uppdatering misslyckades |
| **Kicks / bannlysningar** | Spelare kickad, spelare bannlyst                                        |
| **Varningar**             | Saker som tyst lämnar en server trasig (se nedan)                       |

### Kategorin Varningar

`Varningar` är kanalen "något behöver en människa", för förhållanden som tidigare bara var synliga i panelen:

| Händelse                | Betydelse                                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | Containern stoppades för att minnet tog slut.                                                                           |
| `unhealthy`             | Processen är igång men `mc-health`-sonden misslyckas: en levande men död server.                                        |
| `startup-stalled`       | Fortfarande startar efter ~10 minuter utan "Klar" i loggarna (med en diagnos av vad som ska åtgärdas, där det är känt). |
| `stop-failed`           | En korrekt avslutning tog inte effekt och containern körs fortfarande.                                                  |
| `schedule-failed`       | En schemalagd omstart / säkerhetskopia / kommando misslyckades.                                                         |
| `quota-exceeded`        | Diskutrymmeskvoten i strikt läge utlöstes och servern stoppades.                                                        |
| `offline-after-restart` | Servern var igång innan panelen startades om, är det inte nu, och kommer inte att startas automatiskt.                  |
| `crash-report`          | En ny kraschrapport har fångats och analyserats.                                                                        |
| `update-failed`         | En skyddad uppgradering kom inte upp som frisk.                                                                         |

### Hur leveransen fungerar

En bakgrundsbro pollar [händelseloggen](/docs/activity/) var 15:e sekund och vidarebefordrar mappade rader. Om en webhook POST misslyckas tillfälligt, försöks den raden igen vid senare pollingar snarare än att tappas; en permanent oåtkomlig webhook tystas (en loggrad per timme) efter några försök. Bron spelar aldrig upp händelser från innan panelen startades.

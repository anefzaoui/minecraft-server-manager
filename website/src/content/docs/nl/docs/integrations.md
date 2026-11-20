---
title: 'Integraties'
description: 'Elke server heeft zijn integraties onder de groep Instellingen: Discord, een openbare Statuspagina, uitnodigingen met één klik en het optionele Chatbot-tabblad (alleen voor beheerders).'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Terug naar de documentatie-index](/docs/)

Elke server heeft zijn integraties onder de groep **Instellingen**: **Discord**, een openbare **Statuspagina**, **Uitnodigingen** met één klik, en het optionele tabblad **Chatbot** (alleen voor beheerders). Deze pagina behandelt Discord; [uitnodigingen & statuspagina](/docs/invites-and-status-page/) behandelt die twee, en [de chatbot](/docs/chatbot/) heeft zijn eigen pagina.

## Discord-meldingen

Het paneel stuurt servergebeurtenissen door naar een Discord-kanaal via een webhook. Geen bot, geen OAuth.

### Installatie

1. In Discord: **Serverinstellingen → Integraties → Webhooks → Nieuwe webhook**. Kies het kanaal en kopieer de webhook-URL.
2. Open in het paneel het tabblad **Instellingen → Discord** van de server, plak de URL in **Webhook-URL**, zet de kaart **aan** en klik op **Opslaan**. De URL wordt versleuteld opgeslagen (in dezelfde opslag als uw API-sleutels).
3. Gebruik **Test verzenden** om te bevestigen dat het werkt.

![Discord-integratie](/docs/images/integrations-discord.png)

Om een opgeslagen URL te vervangen, plakt u een nieuwe en slaat u op; laat het veld leeg om de huidige te behouden. De opgeslagen URL wordt gemaskeerd weergegeven (het token is verborgen).

### Wat wordt verzonden

Meldingen zijn gegroepeerd in schakelbare categorieën. Alle staan standaard aan.

| Categorie          | Gebeurtenissen                                                        |
| ------------------ | --------------------------------------------------------------------- |
| **Start / stop**   | Server gestart, server gestopt                                        |
| **Crashes**        | Crash, crash-loop gedetecteerd, nieuw crashrapport                    |
| **Backups**        | Backup gemaakt, backup hersteld                                       |
| **Updates**        | Update toegepast, update teruggedraaid, update mislukt                |
| **Kicks / bans**   | Speler gekickt, speler geband                                         |
| **Waarschuwingen** | De dingen die stilletjes een server kapot achterlaten (zie hieronder) |

### De categorie Waarschuwingen

`Waarschuwingen` is het "iets heeft een mens nodig"-kanaal, voor omstandigheden die vroeger alleen in het paneel zichtbaar waren:

| Gebeurtenis             | Betekenis                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | De container is gestopt omdat het geheugen vol was.                                                                                    |
| `unhealthy`             | Het proces draait, maar de `mc-health`-controle mislukt: een levende maar dode server.                                                 |
| `startup-stalled`       | Nog steeds aan het starten na ~10 minuten zonder "Klaar" in de logs (met een diagnose van wat er moet worden opgelost, indien bekend). |
| `stop-failed`           | Een nette stop heeft niet gewerkt en de container draait nog steeds.                                                                   |
| `schedule-failed`       | Een geplande herstart / backup / commando is mislukt.                                                                                  |
| `quota-exceeded`        | De schijfquotum in strikte modus is overschreden en de server is gestopt.                                                              |
| `offline-after-restart` | De server was actief vóór de herstart van het paneel, is dat nu niet, en zal niet automatisch worden gestart.                          |
| `port-change-failed`    | Een poortwijziging is mislukt en de server kon niet worden teruggezet naar de oude poort, dus deze is uitgeschakeld.                   |
| `auto-restart-gave-up`  | Een gecrashte server is niet opnieuw gestart omdat een andere actie te lang bezig was.                                                 |

### Hoe levering werkt

Een achtergrondbrug controleert het [gebeurtenislogboek](/docs/activity/) elke 15 seconden en stuurt gemapte rijen door. Als een webhook POST tijdelijk mislukt, wordt die rij opnieuw geprobeerd bij latere controles in plaats van te worden genegeerd; na een paar mislukte pogingen wordt de rij overgeslagen en worden leveringsfouten maximaal één keer per uur per server gelogd. Na een herstart van het paneel stuurt de brug de gebeurtenissen die nog niet zijn geleverd, maar nooit meer dan twee uur terug; bij de allereerste uitvoering begint deze vanaf de nieuwste gebeurtenis.

---
title: 'Integraties'
description: 'Elke server heeft zijn integraties onder de groep Instellingen: Discord, een openbare Statuspagina, Eén-klik Uitnodigingen en het optionele Chatbot-tabblad.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/integrations.md'
---

[← Terug naar de documentatie-index](/docs/)

Elke server heeft zijn integraties onder de groep **Instellingen**: **Discord**, een openbare **Statuspagina**, **Uitnodigingen** met één klik en het optionele tabblad **Chatbot**. Deze pagina behandelt Discord (de andere hebben hun eigen documentatie en installatiehulpen in het paneel).

## Discord-meldingen

Het paneel stuurt servergebeurtenissen door naar een Discord-kanaal via een webhook. Geen bot, geen OAuth.

### Installatie

1. In Discord: **Serverinstellingen → Integraties → Webhooks → Nieuwe webhook**. Kies het kanaal en kopieer de webhook-URL.
2. Open in het paneel het tabblad **Instellingen → Discord** van de server, plak de URL in **Webhook URL**, schakel de kaart **in** en klik op **Opslaan**. De URL wordt versleuteld opgeslagen (in dezelfde at-rest-opslag als uw API-sleutels).
3. Gebruik **Test verzenden** om te bevestigen dat het werkt.

![Discord-integratie](/docs/images/integrations-discord.png)

Om een opgeslagen URL te vervangen, plakt u een nieuwe en slaat u op; laat het veld leeg om de huidige te behouden. De opgeslagen URL wordt gemaskeerd weergegeven (het token is verborgen).

### Wat wordt verzonden

Meldingen zijn gegroepeerd in schakelbare categorieën. Standaard staan ze allemaal aan.

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

| Gebeurtenis             | Betekenis                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `oom`                   | De container is gestopt omdat het geheugen op was.                                                                                  |
| `unhealthy`             | Het proces draait, maar de `mc-health`-probe mislukt: een live maar dode server.                                                    |
| `startup-stalled`       | Nog steeds aan het starten na ongeveer 10 minuten zonder "Klaar" in de logs (met een diagnose van wat te repareren, indien bekend). |
| `stop-failed`           | Een nette stop is niet doorgevoerd en de container draait nog steeds.                                                               |
| `schedule-failed`       | Een geplande herstart / backup / commando is mislukt.                                                                               |
| `quota-exceeded`        | Strikte schijfquotum overschreden en de server is gestopt.                                                                          |
| `offline-after-restart` | De server draaide voor de herstart van het paneel, draait nu niet en wordt niet automatisch gestart.                                |
| `crash-report`          | Een nieuw crashrapport is vastgelegd en verwerkt.                                                                                   |
| `update-failed`         | Een beveiligde upgrade is niet gezond opgestart.                                                                                    |

### Hoe levering werkt

Een achtergrondbrug controleert elke 15 seconden het [gebeurtenislogboek](/docs/activity/) en stuurt gemapte rijen door. Als een webhook POST tijdelijk mislukt, wordt die rij opnieuw geprobeerd bij latere controles in plaats van te worden genegeerd; een permanent onbereikbare webhook wordt na een paar pogingen gedempt (één logregel per uur). De brug speelt nooit gebeurtenissen af van vóór de start van het paneel.

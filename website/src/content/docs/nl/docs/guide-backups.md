---
title: 'Minecraft serverback-ups die daadwerkelijk herstellen'
description: 'Hoe je Minecraft serverback-ups maakt die daadwerkelijk herstellen: consistente kopieën, ergens anders bewaard, en minstens één keer getest.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Terug naar de documentatie-index](/docs/)

De meeste servers hebben back-ups. Veel minder hebben back-ups die werken, en het verschil wordt pas ontdekt op de slechtste dag. Drie dingen scheiden ze: de kopie is consistent, deze bevindt zich ergens anders, en iemand heeft hem ten minste één keer hersteld.

## Kopieer de wereld terwijl er niet in wordt geschreven

Een draaiende server schrijft continu regiobestanden. Kopieer ze halverwege het schrijven en je krijgt een bestand dat half oud en half nieuw is, wat ofwel niet laadt ofwel laadt met een gat in de grond waar iemands basis was. Niets waarschuwt je, want de kopie is gelukt.

Er zijn twee correcte manieren om een kopie te maken:

1. **Stop de server**, kopieer, start hem opnieuw. Simpel, eerlijk en impopulair vanwege de downtime.
2. **Vertel het spel eerst te stoppen met schrijven.** Voer `save-off` uit, dan `save-all flush`, wacht tot het klaar is, kopieer, dan `save-on`. De wereld is compleet en stil gedurende de kopie.

Sla de stap naar de kopie nooit over. Een snapshot op bestandsysteem- of volumeniveau is prima, alleen als deze werkelijk atomair is, en een `cp -r` terwijl spelers blokken plaatsen, is dat niet.

## Maak meer back-ups dan alleen de wereld

Alleen de wereld herstellen brengt je het terrein en verliest de server. Je wilt ook:

- `server.properties`, en al het andere dat de regels bepaalt.
- De mod- of plugin-jars, in de exacte versies die draaiden. Een wereld zal niet laden zonder de mods die de blokken hebben gemaakt.
- Spelersgegevens, inclusief `whitelist.json`, `ops.json` en de statistieken- en voortgangsmappen.
- De pack-versie, als deze van een pack kwam. Opschrijven telt.

De snelste sanity check op elke back-up: kun je deze server op een nieuwe machine herbouwen vanuit het archief alleen? Als het antwoord een zin vereist die begint met "en dan zou ik opnieuw installeren", is het geen complete back-up.

## Eén kopie op dezelfde schijf is geen back-up

Een back-up die op de machine staat die hij beschermt, dekt precies één storing: je hebt iets verwijderd. Het dekt niet het falen van de schijf, het opschorten van het account door de provider, of een fout die de hele map verwijdert.

Houd het simpel in plaats van perfect:

- Eén lokale kopie, voor het veelvoorkomende geval, zoals iemand die grieft of een slechte update.
- Eén kopie ergens anders. Een andere machine, een objectopslag, of een thuis-NAS die 's nachts via SSH trekt.
- Genoeg geschiedenis om een probleem te overleven dat je niet onmiddellijk hebt opgemerkt. Corruptie wordt vaak dagen later gevonden, en als je drie dagen back-ups bewaart, heb je het goede exemplaar al overschreven.

Zeven dagelijkse kopieën plus vier wekelijkse kopieën dekken bijna elk echt incident en kosten heel weinig ruimte.

## Test een herstel voordat je het nodig hebt

Kies een back-up, herstel deze naar een reserve-server en maak verbinding. Dat is de volledige test, het duurt vijftien minuten en het vangt alle klassieke fouten op: het archief mist de mods-map, een wereld die een versie nodig heeft die je niet meer draait, permissies die de bestanden onleesbaar maken, een afgebroken upload.

Doe het één keer wanneer je de back-ups instelt, en nog een keer na elke grote wijziging aan de server.

## Grootte, en hoe deze beheersbaar te houden

Werelden groeien omdat spelers verkennen. Een wereld waarin iemand tienduizend blokken in een rechte lijn vloog, draagt elke chunk langs die lijn voor altijd mee, en de meeste van die chunks zullen nooit meer worden bezocht.

Drie hendels, in volgorde van hoeveel ze opleveren:

1. **Trim onbezochte chunks.** Hulpmiddelen die sorteren op laatst aangeraakte tijd verwijderen doorgaans een groot deel van een veelbereisde wereld zonder zichtbaar effect in het spel.
2. **Comprimeer correct.** Regiobestanden comprimeren goed; archieven ervan hebben geen baat bij iets exotisch.
3. **Bewaar niet elk uurlijks exemplaar een jaar lang.** Retentie gaat boven compressie.

## In Minecraft Server Manager

Back-ups volgen het `save-off`, flush, copy, `save-on` pad, en een stop of herstart die halverwege een back-up wordt aangevraagd, wordt geweigerd totdat de kopie klaar is in plaats van ermee te concurreren. Het archief omvat de hele serverdirectory, dus mods, configuratie en spelersgegevens reizen mee met de wereld.

Back-ups kunnen op schema draaien naast herstarts en commando's, en elke nieuwe server begint met een dagelijks back-upschema. Retentie telt elk type afzonderlijk, zodat de tien geplande kopieën die zich vanzelf opstapelen de kopie die je handmatig hebt gemaakt vóór een risicovolle wijziging niet kunnen verdringen, en leeftijds- en groottebeperkingen gelden daarbovenop. Beheerders wijzigen dit allemaal op de Instellingen-pagina, of per server op het tabblad Back-ups. Herstellen vereist eerst een nieuwe back-up, dus een herstel naar het verkeerde tijdstip is zelf ongedaan te maken. Een wereld kan op zichzelf of als onderdeel van een back-up worden verkleind, wat de belangrijkste hendel is voor de grootte.

Het hele paneel, inclusief elke back-up, bevindt zich onder één directory. Het kopiëren van die directory naar elders is de helft van het verhaal buiten de machine, en het is opzettelijk het enige dat je hoeft te kopiëren.

Gerelateerd: [back-ups in het paneel](/docs/backups/), [schema's](/docs/schedules/),
[een wereld verkleinen](/docs/world-shrink/), [een server verplaatsen naar een andere host](/docs/guide-moving-a-server/).

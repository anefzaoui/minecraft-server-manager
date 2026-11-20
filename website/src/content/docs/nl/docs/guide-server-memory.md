---
title: 'Hoeveel RAM heeft een Minecraft-server nodig?'
description: 'Hoeveel RAM een Minecraft-server nodig heeft voor vanilla, Paper, lichte mods en grote modpacks, en hoeveel er over moet blijven voor de machine.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-memory.md'
---

[← Terug naar de documentatie-index](/docs/)

Kort antwoord, voor een server waar daadwerkelijk op gespeeld zal worden:

| Wat je draait                                   | Java heap   | Geef de machine |
| ----------------------------------------------- | ----------- | --------------- |
| Vanilla of Paper, tot 10 spelers                | 2 GB        | 4 GB            |
| Paper met plugins, 10 tot 30 spelers            | 4 GB        | 6 GB            |
| Een lichte mod pack, 40 tot 80 mods             | 4 GB        | 6 GB            |
| Een grote kitchen-sink pack, 150 tot 300 mods   | 6 tot 8 GB  | 10 GB           |
| GregTech New Horizons en vergelijkbare monsters | 8 tot 12 GB | 16 GB           |

Twee getallen, niet één. Dat is het deel dat de meeste handleidingen overslaan, en het is de reden dat mensen een 4 GB server kopen, Java 4 GB geven, en dan zien hoe deze crasht.

## De heap en de machine zijn verschillende getallen

De Java heap (`-Xmx`) is hoeveel geheugen het spel zelf mag gebruiken voor de wereld, entiteiten en mod-gegevens. De machine, of de container, moet die heap **plus** al het andere dat Java nodig heeft bevatten: class metadata, thread stacks, garbage-collector administratie, netwerkbuffers en de JVM zelf. Die overhead is ruwweg 0,5 tot 1,5 GB voor een modded server.

Als de heap gelijk is aan het geheugen van de machine, beëindigt de kernel de server op het moment dat Java die overhead probeert te gebruiken. In Docker verschijnt dit als exit code 137, en in de logs als helemaal niets: het proces verdwijnt simpelweg midden in een zin. Mensen geven meestal een mod de schuld.

Een veilige regel: **heap plus 25 procent, en minimaal één gigabyte over.** Een 8 GB heap vereist een 10 GB machine.

## Meer RAM is niet meer prestaties

Minecraft is in de meeste van zijn taken single-thread gebonden. Een 40-mod pack 16 GB geven maakt chunks niet sneller genereren; het zorgt ervoor dat elke garbage collection pauze langer duurt, omdat er meer te doorlopen is. Een server die elke dertig seconden hapert, is vaak een server met te veel heap, niet te weinig.

Verhoog de heap wanneer je deze ziet, en niet anders:

- `java.lang.OutOfMemoryError: Java heap space` in de log.
- Herhaaldelijk "Can't keep up! Is the server overloaded?" met garbage-collection pauzes in de timings.
- Geheugengebruik dat tot het maximum klimt en daar urenlang vast blijft zitten.

## Waarom je server 12 GB gebruikt terwijl er niemand online is

Omdat je het zo hebt ingesteld. Twee standaardinstellingen werken samen:

1. De gebruikelijke Docker-image stelt de start-heap gelijk aan het maximum, dus `-Xms` en `-Xmx` zijn beide jouw getal. Java claimt het direct in plaats van het te laten groeien.
2. De populaire Aikar flag set bevat `-XX:+AlwaysPreTouch`, die elke pagina van die heap bij het opstarten doorloopt, zodat de pagina's daadwerkelijk worden toegewezen. Dit is bewust: het ruilt een langzamere opstart en een hoog idle-getal in voor minder pauzes later.

Gemeten op Paper 1.21.1 met een 2 GB heap in een 4 GB container, bemonsterd gedurende drie minuten nadat de wereld volledig was geladen:

| Configuratie                          | Resident geheugen |
| ------------------------------------- | ----------------- |
| Geen flags                            | 2.60 GiB          |
| Aikar flags                           | 2.59 GiB          |
| Aikar flags zonder `AlwaysPreTouch`   | 1.95 GiB          |
| Aikar flags met een 512 MB start-heap | 1.38 GiB          |
| Geen flags met een 512 MB start-heap  | 1.25 GiB          |

Dus een server die "12 GB" gebruikt in idle-modus is meestal een 12 GB heap die is "pre-touched", geen geheugenlek. Je monitoring leest het correct; het getal betekent alleen niet wat het lijkt.

Als je een eerlijk idle-getal wilt, stel dan de start-heap lager in dan het maximum. Je betaalt ervoor met iets meer collecties in het begin. Als je liever stabiele frametijden wilt, laat het dan zo en stop met het bekijken van de grafiek.

## Spelers zijn minder belangrijk dan je denkt

Verdubbelen van 10 naar 20 spelers kost veel minder dan vijftig mods toevoegen. Spelers voegen voornamelijk entiteiten en geladen chunks toe, die geleidelijk schalen. Mods voegen class data, registers, wereldgeneratiefuncties en hun eigen caches toe, die dat niet doen. Maak eerst ruimte voor de pack, voeg dan ongeveer 100 tot 200 MB per reguliere speler toe op een modded server.

De view distance is de andere grote factor. Dalend van 12 naar 8 chunks kan een gigabyte besparen op een drukke server en is nauwelijks merkbaar in het spel.

## In Minecraft Server Manager

Elke server heeft twee aparte velden, **Java heap** en **container geheugenlimiet**, precies omdat dit verschillende vragen zijn. De wizard stelt de containerlimiet 50 procent boven de heap in voor je, en het paneel weigert een server op te slaan waarvan de containerlimiet niet boven de heap ligt, omdat die combinatie eindigt in exit code 137 in plaats van een foutmelding.

De geheugenmeter op een server toont wat de container daadwerkelijk gebruikt, met een melding wanneer de heap vooraf is geclaimd, zodat een pre-touched heap niet wordt gezien als een runaway. Een server die door de kernel vanwege geheugen is beëindigd, wordt precies zo geregistreerd in de geschiedenis, in plaats van als een mysterieuze crash.

Gerelateerd: [servers aanmaken en beheren](/docs/servers/),
[crash reports](/docs/servers/#crash-reports--mclogs-analysis), [opslag en quota's](/docs/storage/).

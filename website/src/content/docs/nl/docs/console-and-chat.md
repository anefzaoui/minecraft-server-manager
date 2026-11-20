---
title: 'Console & chat-opdrachten'
description: 'Het tabblad Console streamt het serverlogboek in realtime en biedt een opdrachtvak om serveropdrachten te verzenden.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Terug naar de documentatie-index](/docs/)

## De live console

Het tabblad **Console** streamt het serverlogboek in realtime en biedt een opdrachtvak om serveropdrachten te verzenden. Geen `docker exec`, geen SSH. De uitvoer verschijnt direct, inclusief kleuren. Het verzenden van opdrachten vereist de Console-permissie voor die server; zonder deze permissie kun je nog steeds het logboek bekijken.

Boven het logboek kun je regels filteren op tekst (of een `/regex/`) en op niveau (INFO, WARN, ERROR). De knop **Downloaden** biedt de recente uitvoer, het volledige `latest.log`, of alle logbestanden als zip.

![Console](/docs/images/server-console.png)

De console is ook waar het paneel de status van de server leest: het volgt het logboek om de opstartfase te classificeren ("Loading mods", "Generating world", "Finishing startup") en roept `list` aan om bij te houden wie er online is, zodat het dashboard en de serverkaarten altijd de realiteit weergeven.

Dat peilen opent elke cyclus een kortstondige RCON-verbinding, die de server logt als een paar `Thread RCON Client … started` / `shutting down` elke ~20 seconden, en (op servers waarvan de core of plugins dit echoën) een `Rcon issued server command: …` regel voor elke alleen-lezen peiling (`list` voor spelersaantallen, plus `time query …` en `gamerule <name>` lezingen terwijl World Controls geopend is). De schakelaar **Console-ruis verbergen** boven het logboek filtert die regels eruit (samen met de RCON-luisteraar opstartregels). Deze staat standaard aan en wordt per browser onthouden; schakel hem uit om de ruwe stream te zien.

Opdrachten die vanuit het paneel worden verzonden, kunnen in-game worden aangekondigd onder een per-server label (het vak **Aankondigen als…**), zodat spelers weten dat een operator heeft gehandeld in plaats van een mysterieuze console.

## Chat

**Console → Chat** stuurt berichten naar het spel terwijl de server draait: **Gestileerde** berichten nemen kleuren en opmaak over en kunnen naar iedereen of één online speler gaan, en **Plat** stuurt een eenvoudige `[Server]` uitzending naar iedereen.

![Console → Chat](/docs/screenshots/04-chat.png)

## Chatopdrachten

Chatopdrachten (**Console → Commands**) laten spelers paneelacties triggeren door een prefix-commando in de gamechat te typen, bijvoorbeeld `!spawn` voor willekeurige teleportatie. Detectie is log-gebaseerd en uitvoering gaat via de server, dus **geen mods vereist**.

![Chatopdrachten](/docs/images/chat-commands.png)

Elke opdracht heeft:

- Een **trigger** (bijv. `spawn`), getypt na de **prefix** van de server (`!` standaard, één of twee tekens, nooit `/`).
- Een **actie**: willekeurige teleportatie, teleportatie naar een structuur, teleportatie naar een biome, of het uitvoeren van ruwe consoleopdrachten.
- Een **permissieniveau**: iedereen, spelers op de whitelist, of alleen operators.
- Een **cooldown** per speler (standaard 30 seconden), en aanpasbare berichten voor afwachting / succes / falen met placeholders zoals `{distance}`.

### Een opmerking over veiligheid

Opdrachten die een server kunnen beschadigen (`stop`, `op`, `ban`, `whitelist`, en vergelijkbare) zijn alleen toegestaan bij **alleen-operator** triggers. Het paneel controleert hierop, zelfs wanneer ze genesteld zijn in een `execute … run …` keten, zodat een trigger met lage permissie geen gevaarlijke opdracht kan binnensmokkelen. Gewone chattekst die die woorden slechts noemt (zoals een `say` bericht) wordt met rust gelaten.

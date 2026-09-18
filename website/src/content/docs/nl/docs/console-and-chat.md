---
title: 'Console & chat-opdrachten'
description: 'Het tabblad Console streamt het serverlogboek in realtime en biedt een opdrachtvak om serveropdrachten te verzenden.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Terug naar de documentatie-index](/docs/)

## De live console

Het tabblad **Console** streamt het serverlogboek in realtime en biedt een commandomelder om servercommando's te verzenden. Geen `docker exec`, geen SSH. De uitvoer verschijnt direct, inclusief kleuren.

![Console](/docs/images/server-console.png)

De console is ook waar het paneel de status van de server leest: het volgt het logboek om de opstartfase te classificeren ("Loading mods", "Generating world", "Finishing startup") en roept `list` aan om bij te houden wie er online is, zodat het dashboard en de serverkaarten altijd de realiteit weergeven.

Die polling opent elke cyclus een kortstondige RCON-verbinding, die de server logt als een paar `Thread RCON Client … started` / `shutting down` elke ~20 seconden, en (op servers waarvan de kern of plugins dit echoën) een `Rcon issued server command: …` regel voor elke alleen-lezen poll - `list` voor spelersaantallen, plus `time query …` en `gamerule <name>` lezingen terwijl de World Controls-pagina open is. De schakelaar **RCON-ruis verbergen** boven het logboek filtert die regels eruit (samen met de opstartregels van de RCON-listener). Deze staat standaard aan en wordt per browser onthouden; schakel deze uit om de ruwe stream te zien.

Commando's die vanuit het paneel worden verzonden, kunnen in-game worden aangekondigd onder een per-serverlabel, zodat spelers weten dat een operator heeft gehandeld in plaats van een mysterieuze console.

## Chatcommando's

Chatcommando's stellen spelers in staat om paneelacties te activeren door een prefixcommando in de gamechat te typen, bijvoorbeeld `!spawn` voor willekeurige teleportatie. Detectie is log-gebaseerd en uitvoering gaat via de server, dus **geen mods vereist**.

![Chatcommando's](/docs/images/chat-commands.png)

Elk commando heeft:

- Een **trigger** (bijv. `spawn`) en een **prefix** (standaard `!`).
- Een **actie**: willekeurige teleportatie, teleportatie naar een structuur, teleportatie naar een bioom, of het uitvoeren van ruwe consolecommando's.
- Een **permissieniveau**: iedereen, spelers op de whitelist, of alleen operators.
- Een **cooldown**, en aanpasbare berichten voor in behandeling / succes / mislukking met placeholders zoals `{distance}`.

### Een opmerking over veiligheid

Commando's die een server kunnen vernielen (`stop`, `op`, `ban`, `whitelist`, en vergelijkbare) zijn alleen toegestaan bij **alleen-operator** triggers. Het paneel controleert hierop, zelfs wanneer ze genesteld zijn binnen een `execute … run …` keten, zodat een trigger met lage permissie geen gevaarlijk commando kan binnensmokkelen. Gewone chattekst die die woorden slechts noemt (zoals een `say`-bericht) wordt met rust gelaten.

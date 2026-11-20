---
title: 'Konsol & chat-kommandoer'
description: 'Konsol-fanen streamer serverloggen i realtid og giver dig en kommandoboks til at sende enhver serverkommando.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Tilbage til dokumentindeks](/docs/)

## Livekonsollen

**Konsol**-fanen streamer serverloggen i realtid og giver dig et kommandofelt til at sende enhver serverkommando. Ingen `docker exec`, ingen SSH. Output kommer tilbage inline, med farver og det hele. Afsendelse af kommandoer kræver Konsol-tilladelsen på den pågældende server; uden den kan du stadig se loggen.

Over loggen kan du filtrere linjer efter tekst (eller et `/regex/`) og efter niveau (INFO, WARN, ERROR), og **Download** tilbyder den seneste output, den fulde `latest.log`, eller alle logfiler som en zip.

![Konsol](/docs/images/server-console.png)

Konsollen er også der, hvor panelet læser serverens tilstand: den overvåger loggen for at klassificere opstartsfasen ("Loading mods", "Generating world", "Finishing startup") og kalder `list` for at spore, hvem der er online, så dashboardet og serverkortene altid afspejler virkeligheden.

Den afstemning åbner en kortvarig RCON-forbindelse hver cyklus, som serveren logger som et par `Thread RCON Client … started` / `shutting down` hver ~20. sekund, og (på servere, hvis kerne eller plugins gentager det) en `Rcon issued server command: …` linje for hver skrivebeskyttet afstemning (`list` for spillerantal, plus `time query …` og `gamerule <name>` læsninger, mens World Controls er åben). **Skjul konsolstøj**-afbryderen over loggen filtrerer disse linjer fra (sammen med RCON-lytterens opstarts-linjer). Den er slået til som standard og huskes pr. browser; slå den fra for at se den rå stream.

Kommandoer sendt fra panelet kan annonceres i spillet under en pr.-server-etiket (boksen **Annoncer som…**), så spillere ved, at en operatør har handlet, snarere end en mystisk konsol.

## Chat

**Konsol → Chat** sender beskeder ind i spillet, mens serveren kører: **Formaterede** beskeder tager farver og formatering og kan sendes til alle eller én online spiller, og **Almindelig** sender en simpel `[Server]`-udsendelse til alle.

![Konsol → Chat](/docs/screenshots/04-chat.png)

## Chatkommandoer

Chatkommandoer (**Konsol → Kommandoer**) lader spillere udløse panelhandlinger ved at skrive en præfiks-kommando i spilchatten, f.eks. `!spawn` for at tilfældigt teleportere. Registrering er log-baseret, og udførelse sker gennem serveren, så **ingen mods er påkrævet**.

![Chatkommandoer](/docs/images/chat-commands.png)

Hver kommando har:

- En **trigger** (f.eks. `spawn`), skrevet efter serverens **præfiks** (`!` som standard, et eller to tegn, aldrig `/`).
- En **handling**: tilfældig teleport, teleport til en struktur, teleport til en biome, eller kør rå konsolkommandoer.
- Et **tilladelsesniveau**: alle, hvidlistede spillere eller kun operatører.
- En pr.-spiller **nedkøling** (30 sekunder som standard), og tilpasselige beskeder for afventning / succes / fiasko med pladsholdere som `{distance}`.

### En note om sikkerhed

Kommandoer, der kan ødelægge en server (`stop`, `op`, `ban`, `whitelist` og lignende), er kun tilladt på **kun-operatør**-triggere. Panelet tjekker for disse, selv når de er indlejret i en `execute … run …` kæde, så en trigger med lav tilladelse ikke kan smugle en farlig kommando igennem. Almindelig chattekst, der blot nævner disse ord (som en `say`-besked), lades uberørt.

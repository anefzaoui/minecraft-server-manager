---
title: 'Konsol & chat-kommandoer'
description: 'Konsol-fanen streamer serverloggen i realtid og giver dig en kommandoboks til at sende enhver serverkommando.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Tilbage til dokumentindeks](/docs/)

## Live-konsol

**Konsol**-fanen streamer serverloggen i realtid og giver dig et kommandofelt til at sende enhver serverkommando. Ingen `docker exec`, ingen SSH. Outputtet kommer tilbage inline, med farver og det hele.

![Konsol](/docs/images/server-console.png)

Konsollen er også der, hvor panelet læser serverens tilstand: den overvåger loggen for at klassificere opstartsfasen ("Loading mods", "Generating world", "Finishing startup") og kalder `list` for at spore, hvem der er online, så dashboardet og serverkortene altid afspejler virkeligheden.

Denne polling åbner en kortvarig RCON-forbindelse hver cyklus, hvilket serveren logger som et par `Thread RCON Client … started` / `shutting down` hver ~20 sekund, og (på servere, hvis kerne eller plugins ekkoer det) en `Rcon issued server command: …` linje for hver skrivebeskyttet polling - `list` for spillerantal, plus `time query …` og `gamerule <name>` læsninger, mens siden World Controls er åben. **Skjul RCON-støj**-kontakten over loggen filtrerer disse linjer fra (sammen med RCON-lytterens opstartslinjer). Den er slået til som standard og huskes pr. browser; slå den fra for at se den rå stream.

Kommandoer sendt fra panelet kan annonceres in-game under en pr.-server-etiket, så spillere ved, at en operatør handlede snarere end en mystisk konsol.

## Chatkommandoer

Chatkommandoer lader spillere udløse panelhandlinger ved at skrive en præfiks-kommando i spilchatten, f.eks. `!spawn` for tilfældig teleport. Registrering er log-baseret og udførelse sker gennem serveren, så **ingen mods er påkrævet**.

![Chatkommandoer](/docs/images/chat-commands.png)

Hver kommando har:

- En **trigger** (f.eks. `spawn`) og et **præfiks** (`!` som standard).
- En **handling**: tilfældig teleport, teleport til en struktur, teleport til en biome eller kør rå konsolkommandoer.
- Et **tilladelsesniveau**: alle, whitelistede spillere eller kun operatører.
- En **nedkøling**, og tilpasselige ventende / succes / fejlmeddelelser med pladsholdere som `{distance}`.

### En bemærkning om sikkerhed

Kommandoer, der kan ødelægge en server (`stop`, `op`, `ban`, `whitelist` og lignende), er kun tilladt på **kun-operatør**-triggere. Panelet tjekker for disse, selv når de er indlejret i en `execute … run …` kæde, så en lav-tilladelsestriggere ikke kan smugle en farlig kommando igennem. Almindelig chattekst, der blot nævner disse ord (som en `say`-besked), lades være i fred.

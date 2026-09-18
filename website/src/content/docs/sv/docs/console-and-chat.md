---
title: 'Konsol & chattkommandon'
description: 'Konsolfliken strömmar serverloggen i realtid och ger dig en kommandoruta för att skicka valfria serverkommandon.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Tillbaka till dokumentindex](/docs/)

## Livekonsolen

**Konsol**-fliken strömmar serverloggen i realtid och ger dig ett kommandofält för att skicka serverkommandon. Ingen `docker exec`, ingen SSH. Utdata kommer tillbaka direkt, med färger och allt.

![Konsol](/docs/images/server-console.png)

Konsolen är också där panelen läser av serverns tillstånd: den övervakar loggen för att klassificera uppstartsfasen ("Laddar mods", "Genererar värld", "Avslutar start") och anropar `list` för att spåra vem som är online, så instrumentpanelen och serverkorten alltid återspeglar verkligheten.

Denna avläsning öppnar en kortlivad RCON-anslutning varje cykel, vilket servern loggar som ett par `Thread RCON Client … started` / `shutting down` var ~20:e sekund, och (på servrar vars kärna eller plugins ekor det) en `Rcon issued server command: …` rad för varje skrivskyddad avläsning – `list` för spelarantal, plus `time query …` och `gamerule <name>` läsningar medan sidan Världskontroller är öppen. **Dölj RCON-brus**-växeln ovanför loggen filtrerar bort dessa rader (tillsammans med startraderna för RCON-lyssnaren). Den är på som standard och sparas per webbläsare; stäng av den för att se den råa strömmen.

Kommandon som skickas från panelen kan annonseras i spelet under en etikett per server, så spelare vet att en operatör agerade snarare än en mystisk konsol.

## Chattkommandon

Chatkommandon låter spelare utlösa panelåtgärder genom att skriva ett prefixkommando i spelchatten, till exempel `!spawn` för slumpmässig teleportering. Detektering är loggbaserad och exekvering sker genom servern, så **inga mods krävs**.

![Chattkommandon](/docs/images/chat-commands.png)

Varje kommando har:

- En **utlösare** (t.ex. `spawn`) och ett **prefix** (`!` som standard).
- En **åtgärd**: slumpmässig teleportering, teleportering till en struktur, teleportering till en biom, eller kör råa konsolkommandon.
- En **behörighetsnivå**: alla, vitlistade spelare, eller endast operatörer.
- En **nedkylning**, och anpassningsbara meddelanden för väntande/framgång/misslyckande med platshållare som `{distance}`.

### En notering om säkerhet

Kommandon som kan förstöra en server (`stop`, `op`, `ban`, `whitelist` och liknande) är endast tillåtna på **endast operatör**-utlösare. Panelkontrollerar för dessa även när de är nästlade inuti en `execute … run …`-kedja, så en utlösare med låg behörighet kan inte smuggla igenom ett farligt kommando. Vanlig chatttext som bara nämner dessa ord (som ett `say`-meddelande) lämnas ifred.

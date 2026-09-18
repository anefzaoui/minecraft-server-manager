---
title: 'Konsoll og chat-kommandoer'
description: 'Konsollfanen strømmer serverloggen i sanntid og gir deg en kommandoboks for å sende hvilken som helst serverkommando.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Tilbake til dokumentindeks](/docs/)

## Livekonsollen

**Konsoll**-fanen strømmer serverloggen i sanntid og gir deg et kommandofelt for å sende serverkommandoer. Ingen `docker exec`, ingen SSH. Utdata kommer tilbake inline, med farger og alt.

![Konsoll](/docs/images/server-console.png)

Konsollen er også der panelet leser serverens tilstand: den overvåker loggen for å klassifisere oppstartsfasen ("Loading mods", "Generating world", "Finishing startup") og kaller `list` for å spore hvem som er online, slik at dashbordet og serverkortene alltid reflekterer virkeligheten.

Den pollingen åpner en kortvarig RCON-tilkobling hver syklus, som serveren logger som et par `Thread RCON Client … started` / `shutting down` hver ~20 sekund, og (på servere der kjernen eller plugins videresender det) en `Rcon issued server command: …` linje for hver skrivebeskyttet avlesning – `list` for spillerantall, pluss `time query …` og `gamerule <name>` avlesninger mens Verktøykontroller-siden er åpen. **Skjul RCON-støy**-bryteren over loggen filtrerer disse linjene ut (sammen med RCON-lytteroppstartlinjene). Den er på som standard og huskes per nettleser; slå den av for å se den rå strømmen.

Kommandoer sendt fra panelet kan annonseres i spillet under en per-server-etikett, slik at spillere vet at en operatør handlet i stedet for en mystisk konsoll.

## Chatkommandoer

Chatkommandoer lar spillere utløse panelhandlinger ved å skrive en prefiks-kommando i spillchatten, for eksempel `!spawn` for tilfeldig teleportering. Deteksjon er loggbasert og utførelse går gjennom serveren, så **ingen mods er nødvendig**.

![Chatkommandoer](/docs/images/chat-commands.png)

Hver kommando har:

- En **utløser** (f.eks. `spawn`) og et **prefiks** (`!` som standard).
- En **handling**: tilfeldig teleportering, teleportering til en struktur, teleportering til en biome, eller kjøre rå konsollkommandoer.
- Et **tillitsnivå**: alle, spillere på hvitelisten, eller kun operatører.
- En **nedkjøling**, og tilpassbare meldinger for venting / suksess / feil med plassholdere som `{distance}`.

### En merknad om sikkerhet

Kommandoer som kan ødelegge en server (`stop`, `op`, `ban`, `whitelist`, og lignende) er kun tillatt på **kun operatør**-utløsere. Panelet sjekker for disse selv når de er nestet inne i en `execute … run …` kjede, slik at en utløser med lavt tillitsnivå ikke kan smugle en farlig kommando gjennom. Vanlig chattekst som bare nevner disse ordene (som en `say`-melding) blir ignorert.

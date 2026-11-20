---
title: 'Konsoll og chat-kommandoer'
description: 'Konsollfanen strømmer serverloggen i sanntid og gir deg en kommandoboks for å sende hvilken som helst serverkommando.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Tilbake til dokumentindeks](/docs/)

## Livekonsoll

**Konsoll**-fanen strømmer serverloggen i sanntid og gir deg et kommandofelt for å sende serverkommandoer. Ingen `docker exec`, ingen SSH. Utdata kommer tilbake direkte, med farger og alt. For å sende kommandoer kreves Konsoll-tillatelsen for den serveren; uten den kan du fortsatt se loggen.

Over loggen kan du filtrere linjer etter tekst (eller et `/regex/`) og etter nivå (INFO, WARN, ERROR), og **Last ned** tilbyr nylig utdata, hele `latest.log`, eller alle loggfiler som en zip.

![Konsoll](/docs/images/server-console.png)

Konsollen er også der panelet leser serverens tilstand: den ser på loggen for å klassifisere oppstartsfasen ("Laster inn mods", "Genererer verden", "Fullfører oppstart") og kaller `list` for å spore hvem som er online, slik at dashbordet og serverkortene alltid reflekterer virkeligheten.

Den pollingen åpner en kortvarig RCON-tilkobling hver syklus, som serveren logger som et par `Thread RCON Client … started` / `shutting down` omtrent hvert ~20 sekund, og (på servere der kjernen eller plugins gjenspeiler det) en `Rcon issued server command: …` linje for hver skrivebeskyttet poll (`list` for spillerantall, pluss `time query …` og `gamerule <name>` lesinger mens Verdiregler er åpne). **Skjul konsollstøy**-bryteren over loggen filtrerer disse linjene ut (sammen med RCON-lytteroppstartlinjene). Den er på som standard og huskes per nettleser; slå den av for å se den rå strømmen.

Kommandoer sendt fra panelet kan annonseres i spillet under en per-server-etikett (**Annonser som…**-boksen), slik at spillere vet at en operatør handlet i stedet for en mystisk konsoll.

## Chat

**Konsoll → Chat** sender meldinger inn i spillet mens serveren kjører: **Stiliserte** meldinger tar farger og formatering og kan gå til alle eller én online spiller, og **Vanlig** sender en enkel `[Server]`-kringkasting til alle.

![Konsoll → Chat](/docs/screenshots/04-chat.png)

## Chatkommandoer

Chatkommandoer (**Konsoll → Kommandoer**) lar spillere utløse panelhandlinger ved å skrive en prefiks-kommando i chatten, for eksempel `!spawn` for tilfeldig teleportering. Deteksjon er loggbasert og utførelse går gjennom serveren, så **ingen mods er nødvendig**.

![Chatkommandoer](/docs/images/chat-commands.png)

Hver kommando har:

- En **utløser** (f.eks. `spawn`), skrevet etter serverens **prefiks** (`!` som standard, ett eller to tegn, aldri `/`).
- En **handling**: tilfeldig teleportering, teleportering til en struktur, teleportering til et biom, eller kjøre rå konsollkommandoer.
- Et **tillatelsesnivå**: alle, spillere på hvitlisten, eller kun operatører.
- En per-spiller **nedkjøling** (30 sekunder som standard), og tilpassbare meldinger for ventende / suksess / feil med plassholdere som `{distance}`.

### En merknad om sikkerhet

Kommandoer som kan ødelegge en server (`stop`, `op`, `ban`, `whitelist`, og lignende) er kun tillatt på **kun operatør**-utløsere. Panelet sjekker for disse selv når de er nestet inne i en `execute … run …`-kjede, slik at en utløser med lav tillatelse ikke kan smugle en farlig kommando gjennom. Vanlig chattekst som bare nevner disse ordene (som en `say`-melding) blir ignorert.

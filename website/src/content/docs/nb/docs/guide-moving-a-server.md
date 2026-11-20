---
title: 'Flytte en Minecraft-server til en annen vert'
description: 'Å flytte en verden er enkelt. Å flytte en server som spillere fortsatt kan logge inn på, med inventar, hjem og tillatelser intakt, er den delen som ofte går galt.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Tilbake til dokumentindeks](/docs/)

Å flytte en verden er enkelt. Å flytte en server som spillere fortsatt kan logge inn på, med beholdning, hjem og tillatelser intakt, er det som ofte går galt. Rekkefølgen nedenfor holder nedetiden nede på noen få minutter og gir en vei tilbake hvis den nye maskinen skuffer.

## Ta en status først

Skriv ned disse før du rører noe. Hver av dem har ført til en mislykket migrering når de ble antatt i stedet for sjekket:

- **Minecraft-versjon og loader**, nøyaktig. 1.20.1 NeoForge er ikke 1.20.1 Forge.
- **Listen over modifikasjoner eller plugins med versjoner.** Verden vil ikke lastes uten modifikasjonene som skapte den.
- **Java-versjon**, som følger Minecraft-versjonen.
- **`level-name`** fra `server.properties`. Verdenmappen kalles ofte ikke `world`.
- **Online-modus.** Hvis den gamle serveren kjørte med `online-mode=false` og den nye kjører med den på, eller omvendt, får hver spiller en annen UUID og dermed en helt ny, tom beholdning. Dette er den mest smertefulle feilen på denne siden.
- **Alt som lever utenfor servermappen**, for eksempel en plugins MySQL-database.

## Kopier mens den kjører, kopier deretter igjen mens den er stoppet

Trikset for kort nedetid er å gjøre den trege kopieringen først.

1. **Mens serveren kjører**, kopier hele serverkatalogen til den nye maskinen. På en stor verden kan dette ta en time; ingen merker det, fordi ingenting har stoppet.
2. **Annonser en omstart, og stopp deretter serveren ordentlig.** En grasiøs stopp får spillet til å tømme verden; å drepe prosessen gjør ikke det.
3. **Kopier igjen.** Bare filene som er endret, flyttes denne gangen, så det tar sekunder til minutter.
4. **Start den på den nye maskinen**, på en ikke-offentlig port hvis du kan, og koble deg til den selv. Sjekk en base du kjenner, din egen beholdning, og at plugins eller modifikasjoner lastet uten feil.
5. **Deretter** peker du spillerne mot den.

`rsync -a --delete` er det vanlige verktøyet for trinn 1 og 3. Bevar tillatelser og tidsstempler: en verden kopiert som feil bruker er en server som ikke vil starte, og feilen vil ikke si det tydelig.

## Ikke slett den gamle ennå

Behold den gamle maskinen, stoppet, men intakt, i minst noen dager. Det er den eneste reelle tilbakerullingen. Hold den avslått i stedet for å kjøre, slik at ingen ved et uhell kobler seg til den forlatte kopien og bygger der i en uke.

## La adressen overleve flyttingen

Hvis spillere kobler seg til en ren IP-adresse, tvinger hver flytting hver spiller til å redigere serverlisten sin, og noen av dem gjør det aldri.

Bruk et vertsnavn du kontrollerer, pekt mot serveren. Flytting blir da en DNS-endring, og adressen i alles klient forblir den samme. Senk postens tid-til-levetid (TTL) en dag før flyttingen, slik at endringen sprer seg raskt.

Hvis du vil at spillere skal skrive inn et rent domene mens serveren kjører på en ikke-standard port, gjør en SRV-post det. Det er den samme mekanismen kommersielle verter bruker for å dele ut `play.something.net`.

## Sjekk den nye maskinen før du stoler på den

Tre ting som skiller seg mellom verter og biter etter flyttingen:

- **Brannmuren.** Spillporten din må være åpen, og bare spillporten din. Ikke eksponer et administrasjonspanel eller et kart til internett bare fordi det fungerte på localhost.
- **Enkeltkjerners hastighet.** Minecraft bryr seg langt mer om hvor raskt én kjerne er enn hvor mange det er. Åtte trege kjerner vil føles verre enn to raske.
- **Disk.** En verden på roterende lagring eller et tungt delt volum vil hakke under lasting av biter.

## Forlate et administrert panel

Hvis du kommer fra en vert som ga deg et kontrollpanel i stedet for en maskin, finn nedlastingen eller filbehandleren, og ta hele serverkatalogen i stedet for bare verden. Skaff deg selve plugin- og mod-jar-filene, ikke en liste: versjonene betyr noe, og "siste" er en annen fil neste måned.

Sjekk at sikkerhetskopiene dine er dine, også. En sikkerhetskopi som bare eksisterer inne i panelet du forlater, er ikke en sikkerhetskopi du eier.

## I Minecraft Server Manager

Hele panelet er én katalog. Å kopiere det til en annen maskin og starte panelet der, tar med alle servere, verdener, sikkerhetskopier og innstillinger, noe som gjør flytting av selve panelet til en kopiering snarere enn en migrering.

For én server i stedet for alle, fanger en blueprint opp konfigurasjonen, mod-settet og den festede pakkeversjonen (og, hvis du krysser av, den aktive verdenen) som en enkelt `.mcserver.zip` som kan importeres på et annet panel for å gjenoppbygge den samme serveren. Verdener kan lastes ned og installeres separat når bare verden trenger å reise.

Hvis spillporten en server brukte allerede er opptatt på den nye maskinen, eller du vil teste på en ikke-offentlig port først, endre den under **Innstillinger → Konfigurasjon**: **Spillport**-kortet har **Bruk Neste Ledige Port**, en kjørende server spør før den starter på nytt på den nye porten, og hvis den ikke kan starte der, går den tilbake til den gamle. Bytt den til den offentlige porten når du peker spillerne mot den.

Relatert: [blueprints](/docs/blueprints/), [sikkerhetskopier som faktisk gjenopprettes](/docs/guide-backups/), [verdener og filer](/docs/worlds-and-files/).

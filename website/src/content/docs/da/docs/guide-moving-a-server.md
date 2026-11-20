---
title: 'Flytning af en Minecraft-server til en anden vært'
description: 'Det er nemt at flytte en verden. At flytte en server, som spillere stadig kan logge ind på, med deres inventar, hjem og tilladelser intakte, er den del, der går galt.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-moving-a-server.md'
---

[← Tilbage til dokumentindeks](/docs/)

At flytte en verden er nemt. At flytte en server, som spillere stadig kan logge ind på, med deres inventar, hjem og tilladelser intakte, er den del, der går galt. Rækkefølgen nedenfor holder nedetiden nede på et par minutter og bevarer en vej tilbage, hvis den nye maskine skuffer.

## Tag status først

Skriv disse ned, før du rører ved noget. Hver eneste af dem har afsluttet en migrering dårligt, når den blev antaget snarere end tjekket:

- **Minecraft-version og loader**, præcist. 1.20.1 NeoForge er ikke 1.20.1 Forge.
- **Listen over mods eller plugins med versioner.** Verden vil ikke indlæses uden de mods, der skabte den.
- **Java-version**, som følger Minecraft-versionen.
- **`level-name`** fra `server.properties`. Verdensmappen kaldes ofte ikke `world`.
- **Online-tilstand.** Hvis den gamle server kørte med `online-mode=false` og den nye kører med den slået til, eller omvendt, får hver spiller en anden UUID og derfor et helt nyt, tomt inventar. Dette er den enkelt mest smertefulde fejl på denne side.
- **Alt, der lever uden for servermappen**, såsom en plugins MySQL-database.

## Kopier, mens den kører, kopier derefter igen, mens den er stoppet

Tricket til kort nedetid er at lave den langsomme kopi først.

1. **Mens serveren kører**, kopier hele servermappen til den nye maskine. På en stor verden kan dette tage en time; ingen bemærker det, fordi intet er stoppet.
2. **Annoncer en genstart, stop derefter serveren korrekt.** En ordentlig stop får spillet til at tømme verdenen; at dræbe processen gør det ikke.
3. **Kopier igen.** Kun de filer, der er ændret, flyttes denne gang, så det tager sekunder til minutter.
4. **Start den på den nye maskine**, på en ikke-offentlig port, hvis du kan, og log ind på den selv. Tjek en base, du kender, dit eget inventar, og at plugins eller mods blev indlæst uden fejl.
5. **Derefter** henvis spillerne til den.

`rsync -a --delete` er det sædvanlige værktøj til trin 1 og 3. Bevar tilladelser og tidsstempler: en verden kopieret som den forkerte bruger er en server, der ikke starter, og fejlen vil ikke sige det tydeligt.

## Slet ikke den gamle endnu

Behold den gamle maskine, stoppet, men intakt, i mindst et par dage. Det er den eneste reelle rollback. Hold den slukket snarere end kørende, så ingen ved et uheld logger ind på den forladte kopi og bygger der i en uge.

## Lad adressen overleve flytningen

Hvis spillere forbinder til en bar IP-adresse, tvinger hver flytning alle spillere til at redigere deres serverliste, og nogle af dem gør det aldrig.

Brug et værtsnavn, du kontrollerer, pegende på serveren. At flytte bliver derefter en DNS-ændring, og adressen i alles klient forbliver den samme. Sænk postens time-to-live en dag før flytningen, så ændringen udbredes hurtigt.

Hvis du vil have spillere til at indtaste et bart domæne, mens serveren kører på en ikke-standard port, gør en SRV-post det. Det er den samme mekanisme, som kommercielle værter bruger til at uddele `play.something.net`.

## Tjek den nye maskine, før du stoler på den

Tre ting, der adskiller sig mellem værter og bider efter flytningen:

- **Firewallen.** Din spilport skal være åben, og kun din spilport. Udsæt ikke et administrationspanel eller et kort for internettet bare fordi det virkede på localhost.
- **Enkeltkernet hastighed.** Minecraft bekymrer sig langt mere om, hvor hurtig en kerne er, end hvor mange der er. Otte langsomme kerner vil føles værre end to hurtige.
- **Disk.** En verden på roterende lager eller et stærkt delt volumen vil hakke under indlæsning af chunks.

## Forlader et administreret panel

Hvis du kommer fra en vært, der gav dig et kontrolpanel snarere end en maskine, find download- eller filhåndteringen, og tag hele servermappen snarere end kun verdenen. Få selve plugin- og mod-jars, ikke en liste: versionerne betyder noget, og "seneste" er en anden fil næste måned.

Tjek også, at dine backups er dine. En backup, der kun eksisterer inde i panelet, du forlader, er ikke en backup, du ejer.

## I Minecraft Server Manager

Hele panelet er én mappe. At kopiere det til en anden maskine og starte panelet der bringer hver server, verden, backup og indstilling med sig, hvilket gør flytning af selve panelet til en kopi snarere end en migrering.

For én server snarere end alle, fanger en blueprint dens konfiguration, mod-sæt og pinned pack-version (og, hvis du markerer det, den aktive verden) som en enkelt `.mcserver.zip`, der kan importeres på et andet panel for at genskabe den samme server. Verdener kan downloades og installeres separat, når kun verdenen skal rejse.

Hvis spilporten, en server brugte, allerede er optaget på den nye maskine, eller du vil teste på en ikke-offentlig port først, skal du ændre den under **Indstillinger → Konfiguration**: **Spilport**-kortet har **Brug Næste Fri Port**, en kørende server spørger, før den genstarter på den nye port, og hvis den ikke kan starte der, går den tilbage til den gamle. Skift den til den offentlige port, når du henviser spillere til den.

Relateret: [blueprints](/docs/blueprints/), [backups der rent faktisk gendannes](/docs/guide-backups/), [verdener og filer](/docs/worlds-and-files/).

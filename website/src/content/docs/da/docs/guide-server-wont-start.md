---
title: 'Din Minecraft-server starter ikke'
description: 'En Minecraft-server, der ikke vil starte, løst i rækkefølge efter sandsynlighed: loggen, Java-versionen, hukommelse, EULA og port, samt mods.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Tilbage til dokumentindeks](/docs/)

Arbejd dig ned ad denne liste. Den er sorteret efter, hvor ofte hvert punkt er svaret, og de første fire dækker de fleste.

## 1. Læs de sidste tyve linjer, ikke de første

Rul til **slutningen** af loggen. En Java stack trace udskrives inderst først, så toppen af tekstvæggen er den mindst interessante del. Det, du vil have, er den sidste `Caused by:` linje og alt, hvad der følger efter den. Den enkelte linje navngiver normalt problemet.

To former fortæller dig, hvor du er:

- `Exception in thread "main"` eller en crash report-sti nær slutningen betyder, at spillet selv fejlede.
- Loggen stopper simpelthen midt i en linje, uden nogen undtagelse overhovedet, betyder, at noget dræbte processen udefra. Hop til punkt 3.

## 2. UnsupportedClassVersionError betyder forkert Java

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Class file 52 er Java 8, 60 er 16, 61 er 17, 65 er 21, 69 er 25. Beskeden betyder, at serveren kræver en nyere Java, end den kører på; det omvendte, en gammel pakke på ny Java, fejler normalt med en mixin- eller refleksionsfejl i stedet.

| Minecraft version   | Java |
| ------------------- | ---- |
| 1.16.5 og tidligere | 8    |
| 1.17                | 16   |
| 1.18 og 1.19        | 17   |
| 1.20 til 1.20.4     | 17   |
| 1.20.5 til 1.21.x   | 21   |
| 26.1 og senere      | 25   |

Gamle pakker kræver ægte Java 8. Nyere er ikke bedre her.

## 3. Exit code 137 er kernen, ikke et mod

Loggen stopper midt i en sætning, der er ingen crash report, og containeren rapporterer 137. Det er et out-of-memory kill: processen bad om hukommelse, som maskinen ikke havde, så den blev termineret.

Næsten altid var Java heap sat til det samme tal som maskinens hukommelse. Heap'en kræver maskinens hukommelse **minus** JVM'ens egen overhead, som er 0,5 til 1,5 GB på en modded server. Sænk heap'en, eller hæv maskinen. [Hvor meget RAM en server behøver](/docs/guide-server-memory/) har tallene.

## 4. EULA og porten

To klassikere med én-linjes løsninger:

- `You need to agree to the EULA in order to run the server.` Sæt `eula=true`, i `eula.txt` eller med miljøvariablen, som din opsætning bruger.
- `Address already in use` eller `FAILED TO BIND TO PORT`. Noget andet holder 25565, ofte en tidligere kopi af den samme server, der aldrig stoppede helt. Find den og stop den i stedet for at ændre porten, ellers ender du med to.

## 5. Et mod mangler sin afhængighed

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Fabric mods kræver overvældende Fabric API som en separat fil. Forge og NeoForge mods lister deres afhængigheder i selve fejlen. Installer den navngivne version, ikke den nyeste: "requires 0.91.x" betyder den linje, og 0.92 vil fejle den samme kontrol.

Nogle gange er den manglende afhængighed selve loaderen:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

Løsningen er en nyere loader build, ikke et andet mod. "47.4.14 or above" betyder enhver build derfra og op, og Forge udgiver ikke ethvert nummer, så den build, der skal installeres, kan være den næste. På en modpack, opdater pakken først: en pakke, hvis egen loader version er for gammel til dens mods, er en fejl for dens forfatter at rette.

## 6. Et mod er til forkert loader eller version

En jar til en anden loader fejler ikke høfligt. Forvent en mixin-fejl, en `NoClassDefFoundError`, eller et crash inde i en klasse, du aldrig har hørt om. Tjek jar'ens side: loaderen og Minecraft-versionen skal begge matche præcist. 1.20.1 og 1.20.4 er forskellige spil, så vidt mods er bekymrede.

## 7. Verdenen er fra en nyere version

```
This world was created by a newer version of Minecraft
```

Verdener opgraderer fremad og aldrig baglæns. Gendan backup'en fra før opgraderingen, eller kør den version, som verdenen forventer. Der er ingen nedgraderingssti, der bevarer chunks intakte.

## Når det crashede efter at have kørt fint i uger

Andet spørgsmål, normalt et andet svar:

- **Det crashede under belastning**, med timings, der viser lange pauser: garbage collection, så se på heap-størrelsen før mods.
- **Det crashede på samme punkt i verdenen**: en korrupt chunk eller en ødelagt entitet. Crash reporten navngiver normalt koordinater.
- **Det crashede lige efter en opdatering**: mod'et, der blev opdateret, er den mistænkte, selvom trace peger et andet sted hen. Rul det tilbage og se.
- **Det crashede ved genstart, efter at have været fint før**: tjek disken. En fuld disk producerer spektakulære og vildledende fejl.

## Få hjælp, der rent faktisk hjælper

Post hele **loggen**, ikke den sidste linje, og fortæl, hvad du ændrede, før det gik i stykker. Indsæt den et sted, der er designet til det, som f.eks. [mclo.gs](https://mclo.gs), i stedet for i chatten. Inkluder Minecraft-versionen, loaderen, pakken og dens version, og hvor meget heap serveren har. En rapport med disse fire fakta får svar i ét svar; uden dem tager det fem.

## I Minecraft Server Manager

Crashes detekteres fra containerens egen afslutning, så en server, der dør klokken tre om morgenen, registreres med sit loguddrag i stedet for at blive fundet dagen efter. De sædvanlige mistænkte på denne side (EULA, forkert Java, en verden fra en nyere version, en port allerede i brug, Java løber tør for hukommelse) genkendes i den log og navngives i historikposten med, hvad man skal gøre ved dem, og auto-restart lader dem være, da genstart ikke vil rette dem. Crash reports parses ved ankomst: undtagelsen fremhæves, stacken kan kollapses, og mods, der optræder i trace'en, listes som mistænkte.

Enhver rapport kan deles til mclo.gs fra dens kort, når du har brug for hjælp (efter en bekræftelse, da paste er offentlig), og konsollens **Download**-menu har alle logfiler som én zip, så "post hele loggen" er en download i stedet for et arkæologisk projekt. Et out-of-memory kill registreres som et out-of-memory kill, hvilket sparer den sædvanlige time med at bebrejde et mod. Hvis noget andet reelt har brug for porten, flytter **Game Port**-kortet på **Settings → Configuration** serveren til en ledig.

En loader, der er for gammel, ændres fra serverens **Versions**-fane, som tjekker, at build'en eksisterer og tager en backup, før den genopbygger serveren ([ændring af mod loader version](/docs/updates/#changing-the-mod-loader-version)).

Relateret: [hvor meget RAM en server behøver](/docs/guide-server-memory/), [valg af loader](/docs/guide-choosing-a-loader/), [oprettelse og administration af servere](/docs/servers/).

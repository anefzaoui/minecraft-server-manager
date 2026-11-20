---
title: 'Minecraft-serveren din starter ikke'
description: 'En Minecraft-server som ikke starter, løst i rekkefølge etter sannsynlighet: loggen, Java-versjonen, minne, EULA og port, og mods.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-server-wont-start.md'
---

[← Tilbake til dokumentindeks](/docs/)

Arbeid deg nedover denne listen. Den er sortert etter hvor ofte hvert punkt er svaret, og de fire første dekker de fleste tilfellene.

## 1. Les de siste tjue linjene, ikke de første

Rull til **slutten** av loggen. En Java stack trace skrives ut innerst først, så toppen av tekstveggen er den minst interessante delen. Det du vil ha er den siste `Caused by:`-linjen og det som følger den. Den ene linjen navngir vanligvis problemet.

To former forteller deg hvor du er:

- `Exception in thread "main"` eller en krasjrapportsti nær slutten betyr at spillet selv feilet.
- Loggen stopper rett og slett midt i en linje, uten noen unntak i det hele tatt, betyr at noe drepte prosessen utenfra. Hopp til punkt 3.

## 2. UnsupportedClassVersionError betyr feil Java

```
java.lang.UnsupportedClassVersionError: net/minecraft/server/Main has been compiled
by a more recent version of the Java Runtime (class file version 65.0)
```

Klassefil 52 er Java 8, 60 er 16, 61 er 17, 65 er 21, 69 er 25. Meldingen betyr at serveren trenger en nyere Java enn den kjører på; det motsatte, en gammel pakke på ny Java, feiler vanligvis med en mixin- eller refleksjonfeil i stedet.

| Minecraft-versjon   | Java |
| ------------------- | ---- |
| 1.16.5 og tidligere | 8    |
| 1.17                | 16   |
| 1.18 og 1.19        | 17   |
| 1.20 til 1.20.4     | 17   |
| 1.20.5 til 1.21.x   | 21   |
| 26.1 og senere      | 25   |

Gamle pakker trenger genuint Java 8. Nyere er ikke bedre her.

## 3. Avslutningskode 137 er kjernen, ikke en mod

Loggen stopper midt i en setning, det er ingen krasjrapport, og containeren rapporterer 137. Det er en out-of-memory kill: prosessen ba om minne som maskinen ikke hadde, så den ble terminert.

Nesten alltid ble Java heap satt til samme antall som maskinens minne. Heapen trenger maskinens minne **minus** JVMs egen overhead, som er 0,5 til 1,5 GB på en moddet server. Reduser heapen, eller øk maskinen. [Hvor mye RAM en server trenger](/docs/guide-server-memory/) har tallene.

## 4. EULA og porten

To klassikere med én-linjes løsninger:

- `You need to agree to the EULA in order to run the server.` Sett `eula=true`, i `eula.txt` eller med miljøvariabelen oppsettet ditt bruker.
- `Address already in use` eller `FAILED TO BIND TO PORT`. Noe annet holder 25565, ofte en tidligere kopi av samme server som aldri stoppet helt. Finn den og stopp den i stedet for å endre porten, ellers ender du opp med to.

## 5. En mod mangler sin avhengighet

```
Mod X requires mod Y, which is missing
Fabric API is not installed
```

Fabric-mods trenger overveldende Fabric API som en egen fil. Forge og NeoForge-mods lister sine avhengigheter i selve feilen. Installer den navngitte versjonen, ikke den nyeste: "requires 0.91.x" betyr den linjen, og 0.92 vil feile den samme sjekken.

Noen ganger er den manglende avhengigheten selve lastemodulen:

```
Mod X requires forge 47.4.14 or above
Mod ID: 'forge', Requested by: 'x', Expected range: '[47.4.14,)', Actual version: '47.4.10'
```

Løsningen er en nyere lastemodul-build, ikke en annen mod. "47.4.14 or above" betyr enhver build derfra og opp, og Forge publiserer ikke alle numre, så builden som skal installeres kan være den neste. På en modpack, oppdater pakken først: en pakke hvis egen lastemodul-versjon er for gammel for dens mods er en feil for dens forfatter å fikse.

## 6. En mod er for feil lastemodul eller versjon

En jar for en annen lastemodul feiler ikke pent. Forvent en mixin-feil, en `NoClassDefFoundError`, eller en krasj inne i en klasse du aldri har hørt om. Sjekk jar-filens side: lastemodulen og Minecraft-versjonen må begge stemme nøyaktig. 1.20.1 og 1.20.4 er forskjellige spill så langt som mods er bekymret.

## 7. Verden er fra en nyere versjon

```
This world was created by a newer version of Minecraft
```

Verdener oppgraderer fremover og aldri bakover. Gjenopprett sikkerhetskopien fra før oppgraderingen, eller kjør versjonen verden forventer. Det finnes ingen nedgraderingssti som beholder chunkene intakte.

## Når den krasjet etter å ha kjørt fint i uker

Annet spørsmål, vanligvis annet svar:

- **Den krasjet under belastning**, med timings som viser lange pauser: garbage collection, så se på heap-størrelsen før mods.
- **Den krasjet på samme punkt i verden**: en korrupt chunk eller en ødelagt entitet. Krasjrapporten navngir vanligvis koordinater.
- **Den krasjet rett etter en oppdatering**: modden som ble oppdatert er mistenkt, selv om sporet peker et annet sted. Rull den tilbake og se.
- **Den krasjet ved omstart, etter å ha vært fin før**: sjekk disken. En full disk gir spektakulære og misvisende feil.

## Få hjelp som faktisk hjelper

Post **hele loggen**, ikke den siste linjen, og si hva du endret før den brakk. Lim den inn et sted designet for det, som [mclo.gs](https://mclo.gs), i stedet for i chatten. Inkluder Minecraft-versjonen, lastemodulen, pakken og dens versjon, og hvor mye heap serveren har. En rapport med disse fire fakta får svar i ett svar; uten dem tar det fem.

## I Minecraft Server Manager

Krasj oppdages fra containerens egen avslutning, så en server som dør klokken tre om morgenen blir registrert med sitt loggutdrag i stedet for å bli funnet dagen etter. De vanlige mistenkte på denne siden (EULA, feil Java, en verden fra en nyere versjon, en port som allerede er i bruk, Java som går tom for minne) blir gjenkjent i den loggen og navngitt i historikkoppføringen med hva man skal gjøre med dem, og auto-restart lar de være i fred, siden omstart ikke vil fikse dem. Krasjrapporter blir analysert ved ankomst: unntaket er uthevet, stabelen kan kollapses, og mods som vises i sporet er listet som mistenkte.

Enhver rapport kan deles til mclo.gs fra kortet når du trenger hjelp (etter en bekreftelse, siden innlegget er offentlig), og konsollens **Last ned**-meny har alle loggfiler som én zip, så "post hele loggen" er en nedlasting i stedet for et arkeologisk prosjekt. En out-of-memory kill blir registrert som en out-of-memory kill, noe som sparer den vanlige timen med å skylde på en mod. Hvis noe annet genuint trenger porten, flytter **Spillport**-kortet på **Innstillinger → Konfigurasjon** serveren til en ledig en.

En lastemodul som er for gammel endres fra serverens **Versjoner**-fane, som sjekker at builden eksisterer og tar en sikkerhetskopi før den bygger serveren på nytt ([endre lastemodul-versjon](/docs/updates/#changing-the-mod-loader-version)).

Relatert: [hvor mye RAM en server trenger](/docs/guide-server-memory/), [velge en lastemodul](/docs/guide-choosing-a-loader/), [opprette og administrere servere](/docs/servers/).

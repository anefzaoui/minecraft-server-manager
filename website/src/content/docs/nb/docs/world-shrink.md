---
title: 'Krympe en verden'
description: 'Krympe en Minecraft-verden ved å slette sjeldent besøkte biter (chunks) for å frigjøre diskplass og fremskynde sikkerhetskopiering.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Tilbake til dokumentindeks](/docs/)

Over tid sprer en verden seg ut: hvert sted en spiller noensinne har gått, flydd, eller
blitt båret av en Ender pearl etterlater genererte biter på disk, selv om ingen
noen gang dro tilbake. **Krympe verden** fjerner bitene som nesten ingen har brukt
tid i, slik at verden tar mindre plass. Minecraft gjenskaper et fjernet område fra
verdens frø i det øyeblikket noen reiser dit igjen, så dette er trygt for
land ingen bruker, men alt en spiller _bygde_ på et sted de knapt sto
på ville også forsvinne, derfor bør du ta en sikkerhetskopi først (sikkerhetskopien er
angre).

## Hva regnes som "sjeldent besøkt"

Hver bit registrerer hvor lenge spillere har stått i den (Minecraft kaller
dette `InhabitedTime`). Krympe verden fjerner enhver bit under **30 sekunder** med
total spilletid som standard; krympe-dialogen lar deg endre den terskelen
(1 sekund til 1 time) og hvor mange biter rundt spawn som skal beholdes (standard 8,
`0` slår av spawn-beskyttelse).

Det som beholdes, alltid:

- Området rundt verdens **spawn-punkt** (lest fra `level.dat`) i
  oververdenen. Nether, End, og egendefinerte dimensjoner har ingen spawn-område.
- Enhver bit hvis besøkstid ikke kunne leses, for eksempel en verden lagret med
  et komprimeringsformat panelet ikke dekoder (LZ4). Forhåndsvisningen og
  resultatet forteller deg hvor mange slike biter som ble hoppet over.

Hver dimensjon av verden er dekket: Bukkit-stil søskenmapper
(`world_nether`, `world_the_end`) samt vanilla og Forge/Fabric
oppsett (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`).
Når en bit fjernes, forsvinner dens entiteter og landsbyboeres interessepunkter med
den, så en regenerert bit arver ikke utdaterte monstre, malmvogner eller arbeidssteder.

## Gjøre det fra Verden-fanen

1. Ta en sikkerhetskopi fra **Sikkerhetskopier**-fanen. Krymping fra Verden-fanen
   tar ikke en for deg.
2. Åpne **Verden → Verdener**, finn verdenen, og klikk krympe-ikonet.
3. Klikk **Forhåndsvisning** for å se omtrent hvor mange biter (og hvor mange megabyte)
   som ville blitt fjernet. Ingenting er endret ennå; en forhåndsvisning fungerer mens serveren
   kjører.
4. Klikk **Krympe verden**. Krymping redigerer verdensfilene direkte, så
   serveren må stoppes: enten stopp den først, eller huk av alternativet for å stoppe den,
   krympe, og starte den igjen i én omgang (serveren startes igjen selv om
   krympingen feiler). Fremdrift vises i oppgavefeltet.

![Krympe verden](/docs/images/world-shrink.png)

## Gjøre det som del av en sikkerhetskopi

På **Sikkerhetskopier**-fanen, huk av **"Krympe også verden etterpå"** før
**Sikkerhetskopier nå**. Sikkerhetskopiarkivet skrives først (det arkivet er din
angre), deretter krympes verdenen, men bare hvis serveren er stoppet. Hvis
serveren kjører, kjører sikkerhetskopien fortsatt og krympingen hoppes over med en merknad.

Planlagte sikkerhetskopier har samme alternativ: i planleggingseditoren, velg
**Sikkerhetskopier**-oppgaven og huk av **"Krympe verden etter hver sikkerhetskopi"**. Par den med en
**Stopp server**-plan noen minutter tidligere hvis du vil at den skal kjøre
uten tilsyn.

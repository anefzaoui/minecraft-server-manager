---
title: 'Minecraft-server-sikkerhetskopier som faktisk kan gjenopprettes'
description: 'Slik lager du sikkerhetskopier av Minecraft-serveren din som faktisk kan gjenopprettes: konsistente kopier, lagret et annet sted, og testet minst én gang.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/guide-backups.md'
---

[← Tilbake til dokumentindeks](/docs/)

De fleste servere har sikkerhetskopier. Langt færre har sikkerhetskopier som fungerer, og forskjellen oppdages bare på den verste dagen. Tre ting skiller dem: kopien er konsistent, den ligger et annet sted, og noen har gjenopprettet den minst én gang.

## Kopier verden mens den ikke skrives til

En kjørende server skriver regionfiler kontinuerlig. Kopier dem midt i en skriveoperasjon, og du får en fil som er halvt gammel og halvt ny, som enten ikke kan lastes inn eller lastes inn med et hull i bakken der noens base pleide å være. Ingenting varsler deg, fordi kopieringen lyktes.

Det er to riktige måter å ta en kopi på:

1.  **Stopp serveren**, kopier, start den igjen. Enkelt, ærlig, og upopulært på grunn av nedetiden.
2.  **Be spillet om å slutte å skrive først.** Kjør `save-off`, deretter `save-all flush`, vent til det er ferdig, kopier, deretter `save-on`. Verden er komplett og stille under kopieringen.

Hopp aldri rett til kopieringen. Et øyeblikksbilde på filsystem- eller volumnivå er bare greit hvis det er genuint atomisk, og en `cp -r` mens spillere plasserer blokker, er det ikke.

## Sikkerhetskopier mer enn bare verden

Gjenoppretting av bare verden gir deg terrenget og mister serveren. Du vil også ha:

- `server.properties`, og alt annet som setter reglene.
- Mod- eller plugin-jar-filene, i de nøyaktige versjonene som kjørte. En verden vil ikke lastes inn uten modifikasjonene som skapte blokkene.
- Spillerdata, inkludert `whitelist.json`, `ops.json` og mappene for statistikk og prestasjoner.
- Pakkeversjonen, hvis den kom fra en pakke. Å skrive den ned teller.

Den raskeste fornuftssjekken på en hvilken som helst sikkerhetskopi: kan du gjenoppbygge denne serveren på en ny maskin fra arkivet alene? Hvis svaret krever en setning som starter med "og så vil jeg reinstallere", er det ikke en komplett sikkerhetskopi.

## Én kopi på samme disk er ikke en sikkerhetskopi

En sikkerhetskopi som ligger på maskinen den beskytter, dekker nøyaktig én feil: du slettet noe. Den dekker ikke at disken dør, leverandøren suspenderer kontoen, eller en feil som sletter hele mappen.

Hold det enkelt heller enn perfekt:

- Én lokal kopi, for det vanlige tilfellet, som er noen som saboterer eller en dårlig oppdatering.
- Én kopi et annet sted. En annen maskin, et objektlager, eller en hjemme-NAS som trekker nattlig over SSH.
- Nok historikk til å overleve et problem du ikke la merke til umiddelbart. Korrupsjon oppdages ofte dager senere, og hvis du beholder tre dagers sikkerhetskopier, har du allerede overskrevet den gode.

Syv daglige kopier pluss fire ukentlige dekker nesten alle reelle hendelser og koster veldig lite plass.

## Test en gjenoppretting før du trenger en

Velg en sikkerhetskopi, gjenopprett den til en reserve-server, og koble deg til. Det er hele testen, det tar femten minutter, og det fanger alle de klassiske feilene: arkivet mangler mod-mappen, en verden som trenger en versjon du ikke lenger kjører, tillatelser som gjør filene ulisbare, en trunkert opplasting.

Gjør det én gang når du setter opp sikkerhetskopiene, og én gang til etter en stor endring på serveren.

## Størrelse, og hvordan holde den fornuftig

Verdener vokser fordi spillere utforsker. En verden der noen har flydd ti tusen blokker i en rett linje, bærer alle biter langs den linjen for alltid, og de fleste av disse bitene vil aldri bli besøkt igjen.

Tre spaker, i rekkefølge etter hvor mye de gir tilbake:

1.  **Trim ubesøkte biter.** Verktøy som trimmer etter sist berørt tid fjerner vanligvis en stor del av en godt reist verden uten synlig effekt i spillet.
2.  **Komprimer ordentlig.** Regionfiler komprimeres godt; arkiver av dem drar ikke nytte av noe eksotisk.
3.  **Ikke behold hver timekopi i et år.** Oppbevaring slår komprimering.

## I Minecraft Server Manager

Sikkerhetskopier tar veien `save-off`, flush, copy, `save-on`, og en stopp eller omstart som er forespurt midt i en sikkerhetskopi, blir nektet til kopieringen er ferdig, i stedet for å konkurrere med den. Arkivet dekker hele serverkatalogen, så mods, konfigurasjon og spillerdata følger med verden.

Sikkerhetskopier kan kjøre på en tidsplan sammen med omstarter og kommandoer, og hver nye server starter med en daglig sikkerhetskopitidsplan. Oppbevaring teller hver type separat, så de ti planlagte kopiene som hoper seg opp av seg selv, kan ikke skyve ut den du tok manuelt før en risikabel endring, og alders- og størrelsesgrenser gjelder i tillegg. Administratorer endrer alt dette på Innstillinger-siden, eller per server på fanen Sikkerhetskopier. Gjenoppretting tar en ny sikkerhetskopi først, så en gjenoppretting til feil tidspunkt er i seg selv ugjort. En verden kan krympes alene eller som en del av en sikkerhetskopi, som er spaken som betyr mest for størrelsen.

Hele panelet, inkludert hver sikkerhetskopi, lever under én katalog. Å kopiere den katalogen et annet sted er den eksterne halvdelen av historien, og det er bevisst det eneste du trenger å kopiere.

Relatert: [sikkerhetskopier i panelet](/docs/backups/), [tidsplaner](/docs/schedules/), [krymping av en verden](/docs/world-shrink/), [flytte en server til en annen vert](/docs/guide-moving-a-server/).

---
title: 'Sikkerhetskopier'
description: 'Sikkerhetskopier-siden viser alle øyeblikksbilder på tvers av flåten din, med størrelse, årsak og alder, filtrerbart etter server og årsak.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Tilbake til dokumentindeks](/docs/)

**Sikkerhetskopier**-siden viser alle øyeblikksbilder på tvers av hele systemet ditt, med størrelse, årsak og alder, filtrerbart etter server og årsak.

![Sikkerhetskopier](/docs/images/backups.png)

## Opprette en sikkerhetskopi

Fra en servers **Sikkerhetskopier**-fane (eller via en [planlagt jobb](/docs/schedules/)) kan du ta et øyeblikksbilde av hele serverkatalogen med ett klikk. Panelet setter verdenen i en stabil tilstand først (`save-off` → `save-all`), zipp'er dataene, og aktiverer deretter lagring igjen (`save-on`), slik at sikkerhetskopier er konsistente selv på en kjørende server. Komprimering kjører i en bakgrunnstråd slik at den ikke stopper panelet. En sikkerhetskopi startet via API-et kan ha en merknad.

Hvert arkiv blir **integritetskontrollert** i det øyeblikket det skrives: panelet gjenåpner zip-filen og leser katalogen. Et ødelagt eller ulåsbart arkiv blir slettet, og sikkerhetskopieringen feiler umiddelbart, i stedet for at problemet dukker opp måneder senere når en gjenoppretting er det eneste som står mellom deg og datatap. Et arkiv uten innhold (en server som aldri har startet) er tillatt, men flagget i hendelsesloggen.

Merk av for **"Krymp også verden etterpå"** (på Sikkerhetskopier-fanen, eller i en planlagt sikkerhetskopiering) for å fjerne sjeldent besøkte biter når arkivet er trygt skrevet (se **[Krymping av en verden](/docs/world-shrink/)**). Krympingen kjører kun mens serveren er stoppet; på en kjørende server skjer sikkerhetskopieringen fortsatt, og krympingen hoppes over.

![Server sikkerhetskopier](/docs/images/server-backups.png)

## Årsaker til sikkerhetskopiering

Sikkerhetskopier blir tagget med hvorfor de ble tatt:

- **manuell**: du klikket **Sikkerhetskopier nå**. Erstatning av en servers aktive verden med en fra biblioteket tar også en `manuell` sikkerhetskopi først.
- **planlagt**: opprettet av en [planlagt jobb](/docs/schedules/). Hver nye server får også automatisk en daglig planlagt sikkerhetskopi (fordelt mellom 02:00 og 05:59), slik at en server har automatisk dekning fra dag én, ikke bare før oppdateringer.
- **før-oppdatering**: tatt automatisk før en pakkeoppgradering eller en endring av Minecraft-versjon, slik at en oppgradering alltid kan reverseres.
- **før-gjenoppretting**: tatt automatisk rett før en gjenoppretting eller en tilbakestilling av verden, som et sikkerhetsnett i tilfelle gjenopprettingen ikke er det du ønsket.

## Oppbevaring

Oppbevaring er begrenset **per server, per årsak**: de nyeste i hver gruppe beholdes, eldre blir automatisk fjernet etter hver vellykkede sikkerhetskopiering:

| Årsak              | Beholdes som standard |
| ------------------ | --------------------- |
| planlagt           | 10                    |
| før-oppdatering    | 10                    |
| manuell            | 20                    |
| før-gjenoppretting | 5                     |

`før-gjenoppretting` (kalt sikkerhetskopier i panelet) har sin egen lille "bøtte" nettopp for at en automatisk sikkerhetskopi aldri skal kunne overskrive en `manuell` sikkerhetskopi du bevisst har beholdt.

To valgfrie tak gjelder i tillegg til antall per årsak, begge av som standard: en **maksimal alder** (sikkerhetskopier eldre enn N dager blir fjernet, uansett årsak) og en **maksimal total størrelse** per server (de eldste blir fjernet til totalen passer: sikkerhetskopier først, deretter planlagte, så resten). Den nyeste sikkerhetskopien av en server blir aldri fjernet av noen av disse takene.

### Endre det

Administratorer setter policyen for hele panelet i **Sikkerhetskopieringsoppbevaring**-kortet på **Innstillinger**-siden (**Fyll inn innebygde verdier** setter standardverdiene ovenfor tilbake i skjemaet, klare til lagring). En server kan avvike på en av de seks verdiene: åpne dens **Sikkerhetskopier**-fane og utvid **Oppbevaring for denne serveren**. Hvert felt der er blankt med mindre den serveren setter det, og et blankt felt følger verdien for hele panelet (vist inni det). Så en server kan for eksempel beholde 3 planlagte sikkerhetskopier og bruke verdiene for hele panelet for alt annet; å tømme et felt setter det tilbake til verdien for hele panelet.

![Innstillingskortet for Sikkerhetskopieringsoppbevaring i Innstillinger](/docs/images/settings-retention.png)

![Oppbevaring for denne serveren på en servers Sikkerhetskopier-fane](/docs/images/server-retention.png)

Lagring sletter aldri noe av seg selv. Hvis de nye grensene ville etterlate eksisterende sikkerhetskopier over grensen, lister panelet, per server, hvor mange sikkerhetskopier av hver type som ville gå, hvor mye plass det frigjør og hvor gammel den eldste er. Det sier også når en server allerede var over sine grenser før denne endringen (for eksempel etter en tidligere **Fra neste sikkerhetskopi**), siden anvendelse nå trimmer alt over grensen, ikke bare det denne redigeringen legger til. Deretter spør den hvordan de skal anvendes:

- **Fjern nå** sletter nøyaktig sikkerhetskopiene den nettopp listet opp, ikke mer: en sikkerhetskopi tatt i mellomtiden venter på neste trimming. Fra Innstillinger-siden blir en server midt i en gjenoppretting, sikkerhetskopiering eller lignende handling hoppet over og trimmes etter neste sikkerhetskopi; på en servers egen Sikkerhetskopier-fane blir du bedt om å prøve igjen når den handlingen er ferdig. Mens en servers gamle sikkerhetskopier blir slettet (vanligvis sekunder), må andre handlinger på den serveren vente: en planlagt sikkerhetskopi eller start som lander da prøver igjen hvert minutt til den kan (i opptil 30 minutter), en krasjet server startes på nytt innen ca. 20 sekunder etter at den er ferdig (i opptil 30 minutter), og en planlagt omstart eller stopp som kolliderer med den hoppes over til neste gang.
- **Fra neste sikkerhetskopi** beholder dem inntil videre; hver server trimmer sikkerhetskopiene sine neste gang den tar en, som den alltid har gjort.

![Dialogen som lister opp hva nye grenser ville fjerne](/docs/images/retention-preview.png)

En sikkerhetskopi som blir gjenopprettet, blir aldri fjernet mens gjenopprettingen kjører: oppbevaring lar den være i fred (og sletter ikke andre sikkerhetskopier for å gi plass til den), og å slette den manuelt nektes til gjenopprettingen er ferdig.

De samme innstillingene er tilgjengelige for skript som admin API-endepunkter: `GET`/`POST /api/backups/retention` og `/api/servers/:id/backups/retention`. Verdier for hele panelet kan ikke være `null`. For en server fjerner en verdi på `null` (eller `""`) den nøkkelen, slik at den følger verdien for hele panelet igjen, og `{ "reset": true }` fjerner dem alle. Under begge disse to stiene rapporterer `POST …/preview` hva en endring ville fjerne uten å fjerne det (`backups`, `bytes`, `servers`, `ids` og en per-server `byServer` nedbrytning), og `POST …/apply` anvender den lagrede policyen nå og svarer `{ deleted, skipped }` for hele panelet (`skipped` teller travle servere) eller `{ deleted }` for én server. Send forhåndsvisningens `{ "token": "..." }` (beholdes i 10 minutter) eller dens `{ "ids": [...] }` for å slette kun disse; uten noen av dem går alt over grensen. En per-server anvendelse på en travel server svarer 409.

Sikkerhetskopier kan **gi nytt navn** fra sikkerhetskopilisten (endre navn-knappen på hver rad). Arkivet på disk og panelets registrering flyttes sammen, slik at nedlasting, gjenoppretting og oppbevaring fortsetter å fungere med det nye navnet.

![Gi nytt navn til en sikkerhetskopi](/docs/images/backup-rename.png)

> Oppbevaring er begrenset automatisk, men store modifiserte arkiver teller fortsatt mot en servers [disk-kvote](/docs/storage/), så hold et øye med totalen for store pakker.

## Gjenoppretting

Gjenoppretting av en sikkerhetskopi stopper serveren (verifiserer at containeren virkelig stoppet før den berører noen filer), tar en `før-gjenoppretting` sikkerhetskopi, erstatter **hele serverkatalogen** med øyeblikksbildet, og lar den være stoppet slik at du kan starte den igjen. Arkivet pakkes ut til siden først og byttes inn først når det er fullstendig utpakket, slik at en gjenoppretting som feiler halvveis lar de nåværende filene være urørt. Fordi pakkeoppgraderinger alltid tar en `før-oppdatering` sikkerhetskopi først, kan du alltid rulle tilbake en dårlig oppgradering.

## Panelets egen database

Server sikkerhetskopier dekker kun hver servers egen mappe. Panelets egen database (`panel.db`, som inneholder brukere, roller, 2FA-hemmeligheter, planlagte jobber, pakke-pins og historikk) tas et øyeblikksbilde av separat på den daglige vedlikeholdstimeren:

- `VACUUM INTO` skriver en konsistent, defragmentert kopi til `backups/_panel/` i datamappen; de nyeste **14** beholdes.
- Ved oppstart kjører panelet `PRAGMA integrity_check` og logger høyt hvis den feiler, og peker deg mot `backups/_panel` for den nyeste gode kopien.

Sikkerhetskopier hele datamappen (den inneholder også `.secret-key`, krypteringsnøkkelen i hvile) og du har sikkerhetskopiert alt.

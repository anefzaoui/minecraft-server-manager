---
title: 'Sikkerhetskopier'
description: 'Sikkerhetskopier-siden viser alle øyeblikksbilder på tvers av flåten din, med størrelse, årsak og alder.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Tilbake til dokumentasjonsindeks](/docs/)

**Sikkerhetskopier**-siden viser alle øyeblikksbilder på tvers av flåten din, med størrelse, årsak og alder.

![Sikkerhetskopier](/docs/images/backups.png)

## Opprette en sikkerhetskopi

Fra en servers **Sikkerhetskopier**-fane (eller via en [plan](/docs/schedules/)) kan du ta et øyeblikksbilde av hele serverkatalogen med ett klikk. Panelet setter verdenen på pause først (`save-off` → `save-all`), zippes dataene, og aktiverer deretter lagring igjen (`save-on`), slik at sikkerhetskopier er konsistente selv på en kjørende server. Komprimering kjører i en bakgrunnstråd slik at den ikke stopper panelet. Hver sikkerhetskopi kan ha en merknad.

Hvert arkiv blir **integritetskontrollert** i det øyeblikket det skrives: panelet gjenåpner zip-filen og leser katalogen. Et skadet eller ikke-åpningsbart arkiv blir slettet og sikkerhetskopieringskallet feiler umiddelbart, i stedet for at problemet dukker opp måneder senere når en gjenoppretting er det eneste som står mellom deg og datatap. Et arkiv uten oppføringer (en server som aldri har startet) er tillatt, men flagget i hendelsen.

Kryss av for **"Krymp også verden etterpå"** (på Sikkerhetskopier-fanen, eller i en sikkerhetskopieringsplan) for å fjerne sjelden besøkte biter når arkivet er trygt skrevet (se **[Krymping av en verden](/docs/world-shrink/)**). Krympingen kjører kun mens serveren er stoppet; på en kjørende server skjer sikkerhetskopieringen fortsatt, og krympingen hoppes over.

![Server-sikkerhetskopier](/docs/images/server-backups.png)

## Årsaker til sikkerhetskopiering

Sikkerhetskopier blir tagget basert på hvorfor de ble tatt:

- **manuell** - du klikket på knappen.
- **planlagt** - opprettet av en [plan](/docs/schedules/). Hver nye server får også automatisk en daglig planlagt sikkerhetskopi (fordelt mellom 02:00 og 05:59), slik at en server har automatisk dekning fra dag én, ikke bare før oppdateringer.
- **før-oppdatering** - tatt automatisk før en pakkeoppgradering, slik at en oppgradering alltid kan reverseres.
- **før-gjenoppretting** - tatt automatisk rett før en gjenoppretting eller en verdenstilbakestilling, som et sikkerhetsnett i tilfelle gjenopprettingen ikke var det du ønsket.

## Oppbevaring

Oppbevaring er begrenset **per server, per årsak**: de nyeste i hver gruppe beholdes, eldre blir automatisk fjernet etter hver vellykkede sikkerhetskopi:

| Årsak              | Beholdes |
| ------------------ | -------- |
| planlagt           | 10       |
| før-oppdatering    | 10       |
| manuell            | 20       |
| før-gjenoppretting | 5        |

`før-gjenoppretting` har sin egen lille beholder nettopp for at en automatisk sikkerhetskopi aldri kan overskrive en `manuell` sikkerhetskopi du bevisst har beholdt.

To valgfrie tak gjelder i tillegg til antall per årsak, begge er av som standard: en **maksimal alder** (sikkerhetskopier eldre enn N dager blir fjernet, uansett årsak) og en **maksimal total størrelse** per server (de eldste sikkerhetskopiene blir fjernet til totalen passer, `før-gjenoppretting`-kopiene først). Den nyeste sikkerhetskopien av en server blir aldri fjernet av noen av takene. Alle disse kan endres globalt på Innstillinger-siden, og overstyres per server på dens Sikkerhetskopier-fane.

Sikkerhetskopier kan **gi nytt navn** fra listen over sikkerhetskopier (gi nytt navn-knappen på hver rad). Arkivet på disken og panelets registrering flyttes sammen, slik at nedlasting, gjenoppretting og oppbevaring fortsetter å fungere med det nye navnet.

![Gi nytt navn til en sikkerhetskopi](/docs/images/backup-rename.png)

> Oppbevaring er automatisk begrenset, men store moddede arkiver teller fortsatt mot en servers [disk-kvote](/docs/storage/), så følg med på totalen for store pakker.

## Gjenoppretting

Gjenoppretting av en sikkerhetskopi stopper serveren (verifiserer at containeren virkelig stoppet før den rører noen filer), tar en `før-gjenoppretting` sikkerhetskopi, erstatter **hele serverkatalogen** med øyeblikksbildet, og lar den være stoppet slik at du kan starte den igjen. Fordi pakkeoppgraderinger alltid tar en `før-oppdatering` sikkerhetskopi først, kan du alltid rulle tilbake en dårlig oppgradering.

## Panelets egen database

Server-sikkerhetskopier dekker kun per-server verdens-kataloger. Panelets egen database (`panel.db`, som inneholder brukere, roller, 2FA-hemmeligheter, planer, pakke-pins og historikk) blir tatt et øyeblikksbilde av separat under den daglige vedlikeholdstimeren:

- `VACUUM INTO` skriver en konsistent, defragmentert kopi til `data/backups/_panel/`; de nyeste **14** beholdes.
- Ved oppstart kjører panelet `PRAGMA integrity_check` og logger høyt hvis den feiler, og peker deg mot `data/backups/_panel` for den nyeste gode kopien.

Ta sikkerhetskopi av hele `data/`-treet (det inneholder også `.secret-key`, krypteringsnøkkelen i hvilemodus), og du har tatt sikkerhetskopi av alt.

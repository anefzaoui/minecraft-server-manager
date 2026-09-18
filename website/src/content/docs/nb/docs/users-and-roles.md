---
title: 'Brukere og roller'
description: 'Panelet er multi-bruker.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Tilbake til dokumentindeks](/docs/)

Panelet er for flere brukere. Administrer kontoer under **Innstillinger → Brukere**.

![Brukere](/docs/images/settings-users.png)

## De tre rollene

| Rolle        | Kan gjøre                                                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Alt: administrere brukere, API-nøkler, globale filer, avanserte Docker-overstyringer og alle serverhandlinger.                                 |
| **operator** | Kjøre og konfigurere servere (starte/stoppe, konsoll, sikkerhetskopier, verdener, mods, de fleste innstillinger), men ikke admin-only områder. |
| **viewer**   | Kun lesing. Se servere og deres status, men uten å gjøre endringer.                                                                            |

Alle brukere, inkludert en seer, kan administrere sin egen [toveis autentisering](/docs/two-factor-authentication/), fordi beskyttelse av din egen innlogging ikke er en serveradministrasjonshandling.

## Kun for administratorer, og hvorfor

Noen få ting er bevisst begrenset til administratorer:

- **Brukeradministrasjon, API-nøkler og globale filer.**
- **[Offentlig API](/docs/public-api/)** - aktivering av `/api/v1` og oppretting, omfang eller tilbakekalling av dets lesbare Bearer-tokens.
- **Avanserte Docker-overstyringer** - egendefinert containernavn, ekstra portpubliseringer og bind mounts. En bind mount kan mappe enhver vertssti inn i en container, og kombinert med panelets Docker-tilgang er det effektivt root på verten. Disse feltene vises kun for administratorer.

Egendefinerte containernavn kan heller ikke ligge i panelets eget `msm-` navnerom, så en håndnavngitt container kan aldri skyggelegge en annen servers og feilaktig dirigere en stopp- eller kommando til feil instans.

## Administrere kontoer

![Profilbilde](/docs/images/profile-picture.png)

Administratorer kan opprette brukere, endre roller, tilbakestille passord og slette kontoer fra Brukertabellen. **2FA**-kolonnen viser om hver bruker har toveis autentisering aktivert; en administrator kan **tilbakestille** en annen brukers 2FA (for tilfeller med tapt telefon og backup-koder), men aldri deaktivere sin egen uten passordet sitt, noe selvbetjeningsflyten håndterer i stedet.

Mislykkede innlogginger er begrenset per konto (både en teller per IP og en global teller for kontoen) for å bremse brute-force-forsøk, og den samme grensen dekker 2FA-kodesteget slik at et korrekt passord ikke kan tilbakestille telleren før gjetting av koder. Foran dette sitter en grovere begrensning per klient-IP på innloggings-/2FA-/oppsettendepunktene, justerbar via `RATE_LIMIT_AUTH_PER_15MIN` (standard 100; bak en revers proxy, sett `TRUST_PROXY` slik at den nøkler på den ekte klient-IP-en).

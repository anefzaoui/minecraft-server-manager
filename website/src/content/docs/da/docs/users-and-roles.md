---
title: 'Brugere & roller'
description: 'Panelet er multi-bruger.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Tilbage til dokumentindeks](/docs/)

Panelet er multi-bruger. Administrer konti under **Indstillinger → Brugere**.

![Brugere](/docs/images/settings-users.png)

## De tre roller

| Rolle        | Kan                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **admin**    | Alt: administrer brugere, API-nøgler, globale filer, avancerede Docker-overskrivninger og alle serverhandlinger.               |
| **operator** | Kør og konfigurer servere (start/stop, konsol, backups, verdener, mods, de fleste indstillinger), men ikke admin-only områder. |
| **viewer**   | Kun læsning. Se servere og deres status, men foretag ingen ændringer.                                                          |

Enhver bruger, inklusive en viewer, kan administrere deres egen [to-faktor-godkendelse](/docs/two-factor-authentication/), fordi beskyttelse af dit eget login ikke er en serveradministrationshandling.

## Kun for administratorer, og hvorfor

Få ting er bevidst begrænset til administratorer:

- **Brugeradministration, API-nøgler og globale filer.**
- **[Offentlige API](/docs/public-api/)** - aktivering af `/api/v1` og oprettelse, afgrænsning eller tilbagekaldelse af dens skrivebeskyttede Bearer-tokens.
- **Avancerede Docker-overskrivninger** - brugerdefineret containernavn, ekstra portudgivelser og bind mounts. Et bind mount kan mappe enhver host-sti ind i en container, og kombineret med panelets Docker-adgang er det effektivt root på hosten. Disse felter vises kun for administratorer.

Brugerdefinerede containernavne kan heller ikke leve i panelets egen `msm-` navnerum, så en håndnavngivet container kan aldrig skygge for en anden servers og omdirigere et stop eller en kommando til den forkerte instans.

## Administration af konti

![Profilbillede](/docs/images/profile-picture.png)

Administratorer kan oprette brugere, ændre roller, nulstille adgangskoder og slette konti fra Bruger-tabellen. **2FA**-kolonnen viser, om hver bruger har to-faktor aktiveret; en administrator kan **nulstille** en anden brugers 2FA (for tilfælde med mistet telefon og backup-koder), men aldrig deaktivere deres egen uden deres adgangskode, hvilket selvbetjeningsflowet håndterer i stedet.

Mislykkede logins er rate-begrænset pr. konto (både en tæller pr. IP og en global konto-tæller) for at bremse brute-force forsøg, og den samme grænse dækker 2FA-kodetrinnet, så en korrekt adgangskode ikke kan nulstille tælleren før kodegætning. Foran dette sidder en grovere pr. klient-IP anmodningsbegrænser på login / 2FA / opsætnings-endpoints, der kan justeres via `RATE_LIMIT_AUTH_PER_15MIN` (standard 100; bag en reverse proxy, sæt `TRUST_PROXY`, så den nøgler på den rigtige klient-IP).

---
title: 'Brukere og roller'
description: 'Kontoer, admin-, operatør- og seerrollene, samt tillatelser per server i Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Tilbake til dokumentindeks](/docs/)

Panelet er for flere brukere. Administrer kontoer under **Innstillinger → Brukere**.

![Brukere](/docs/images/settings-users.png)

## De tre rollene

| Rolle        | Standard for hver server                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **admin**    | Alt: administrer brukere, API-nøkler, globale filer, avanserte Docker-overstyringer og alle serverhandlinger.                              |
| **operator** | Kjør og konfigurer servere (start/stopp, konsoll, sikkerhetskopier, verdener, mods, de fleste innstillinger), men ikke admin-only områder. |
| **viewer**   | Kun lesing. Se servere og deres status, men foreta ingen endringer.                                                                        |

Hver bruker, inkludert en viewer, kan administrere sin egen [toveis autentisering](/docs/two-factor-authentication/), fordi beskyttelse av din egen innlogging ikke er en serveradministrasjonshandling.

En rolle er **standard** for hver server. For å gi noen andre rettigheter på én server, bruk tillatelser per server nedenfor.

## Tillatelser per server

**Tillatelser**-siden (i sidefeltet, eller **Servertillatelser** under **Innstillinger → Brukere**) viser et rutenett: hver operator og viewer nedover siden, hver server på tvers av toppen. Klikk på en celle for å bestemme hva den brukeren kan gjøre på akkurat den ene serveren. Administratorer er ikke oppført fordi de alltid har alt.

![Tillatelser](/docs/images/settings-permissions.png)

Hver celle er et sett med tillatelser:

| Tillatelse   | Hva den tillater på den serveren                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| **View**     | Se serveren, dens status, konsollutdata, spillere, historikk og statistikk.                              |
| **Power**    | Start, stopp, start på nytt, drep og bygg om serveren.                                                   |
| **Console**  | Kjør konsollkommandoer og raske verdenshandlinger, send chat, og administrer chatkommandoer.             |
| **Players**  | Spark, bann, legg til på hvitliste, gi op-status, og rediger spillerkommentarer.                         |
| **Content**  | Installer og fjern mods, plugins, pakker, verdener, datapacks, og rediger inventar.                      |
| **Backups**  | Opprett, gjenopprett, last ned og slett sikkerhetskopier.                                                |
| **Files**    | Bla gjennom, rediger, last opp og last ned serverfiler, arkiverte logger og loggpakker; eksporter maler. |
| **Settings** | Endre serverinnstillinger, egenskaper, integrasjoner, ikon, og oppgrader versjoner.                      |
| **Delete**   | Slett serveren.                                                                                          |

![Tillatelsesredigering](/docs/images/permissions-editor.png)

Under rutenettet åpner **Hva hver tillatelse dekker** hver tillatelse til hva en person kan gjøre, hva som ikke er inkludert, og de nøyaktige panelrutene den låser opp. Den siste listen sjekkes mot kjørende kode av testsettet.

![Tillatelsesreferanse](/docs/images/permissions-reference.png)

På en telefon stables rutenettet til ett kort per bruker, med en rad per server.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Tillatelser på en telefon" width="180">
</p>

Hvordan delene passer sammen:

- **Rollen er standard.** En operator starter med alle tillatelser på alle servere; en viewer starter kun med View. En celle i svak tekst (verktøytipset sier "Rolle standard") har aldri blitt endret.
- **En celle overstyrer rollen kun for den serveren.** Gi en viewer Power og Console på én server, og de kan kjøre den, mens alle andre servere forblir skrivebeskyttet for dem. Fjern Delete fra en operator på hovedserveren din, og de beholder alt annet der.
- **Alle tillatelser inkluderer View.** Du kan ikke handle på en server du ikke kan se.
- **Slå av alt for å skjule en server.** Den forsvinner fra brukerens sidefelt, dashbord, sikkerhetskopier, tidsplaner, aktivitet, oppdateringer, modpakker, live status, kjørende oppgaver og maler, og verdensbiblioteket slutter å nevne den. En direkte lenke, API-kall eller konsollkontakt svarer "ikke funnet", det samme som en server som ikke eksisterer.
- **Panelomfattende handlinger følger fortsatt rollen.** Oppretting av servere (inkludert kloning av en), lagring, brukere, API-nøkler, globale innstillinger og panelomfattende tidsplaner er ikke per server, så en viewer med tillatelser på noen servere kan fortsatt ikke gjøre noe av dette. Operatorer beholder serveroppretting og panelomfattende tidsplaner; lagring, brukere, API-nøkler og globale innstillinger er kun for administratorer.
- **Tidsplaner følger serveren.** En planlagt omstart, sikkerhetskopiering eller kommando på en server krever den tilsvarende tillatelsen der (Power, Backups eller Console), uansett rolle.
- **Maler følger også serveren.** Eksport av en server som en mal krever Files der, fordi arkivet bærer filene. En mal eksportert fra en server noen ikke kan se, er skjult for dem også.
- **Admin-only områder forblir admin-only** på hver server: chatbotten, sikkerhetskopibevaring og avanserte Docker-overstyringer.

Hver endring skrives til aktivitetsloggen med hvem som endret hva; disse oppføringene vises kun for administratorer. Sletting av en bruker fjerner radene deres. Fjerning av en server beholder dem, så en server skjult for noen forblir skjult i historikken og beholdte sikkerhetskopier.

Eksisterende installasjoner fortsetter å fungere uendret: helt til en administrator redigerer en celle, har hver bruker nøyaktig det rollen deres ga dem før.

## Kun for administratorer, og hvorfor

Noen få ting er bevisst begrenset til administratorer:

- **Brukeradministrasjon, lagring, globale innstillinger, API-nøkler og globale filer.**
- **[Offentlig API](/docs/public-api/)**: aktivering av `/api/v1` og oppretting, omfang eller tilbakekalling av dets skrivebeskyttede Bearer-tokens.
- **Avanserte Docker-overstyringer**: egendefinert containernavn, ekstra portpubliseringer og bind mounts. Et bind mount kan mappe enhver vertssti inn i en container, og kombinert med panelets Docker-tilgang er det effektivt root på verten. Disse feltene vises kun for administratorer.

Egendefinerte containernavn kan heller ikke ligge i panelets egen `msm-` navnerom, så en manuelt navngitt container kan aldri skyggelegge en annen servers og feilstyre en stopp eller kommando til feil instans.

## Administrere kontoer

![Profilbilde](/docs/images/profile-picture.png)

Administratorer kan opprette brukere, endre roller, tilbakestille passord og slette kontoer fra Brukertabellen. **2FA**-kolonnen viser om hver bruker har toveisautentisering aktivert; en administrator kan tilbakestille en annen brukers 2FA med **Tilbakestill 2FA** i brukerens handlingsmeny (for tilfellet med mistet telefon og backup-koder), men aldri deaktivere sin egen uten passordet sitt, som selvbetjeningsflyten håndterer i stedet.

Mislykkede innlogginger er begrenset per konto (både en per IP og en global konto-teller) for å bremse brute-force-forsøk, og den samme grensen dekker 2FA-kodesteget slik at et riktig passord ikke kan tilbakestille telleren før kodesgjettning. Foran dette sitter en grovere begrensning per klient-IP-forespørsel på innloggings- / 2FA- / oppsett-endepunktene, justerbar via `RATE_LIMIT_AUTH_PER_15MIN` (standard 100; bak en revers proxy, sett `TRUST_PROXY` slik at den nøkler på den ekte klient-IP-en).

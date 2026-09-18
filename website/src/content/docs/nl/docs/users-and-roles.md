---
title: 'Gebruikers & rollen'
description: 'Het paneel is multi-user.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Terug naar de documentatie-index](/docs/)

Het paneel is multi-user. Beheer accounts onder **Instellingen → Gebruikers**.

![Gebruikers](/docs/images/settings-users.png)

## De drie rollen

| Rol          | Kan doen                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Alles: gebruikers, API-sleutels, globale bestanden, geavanceerde Docker-overrides en elke serveractie beheren.                                 |
| **operator** | Servers uitvoeren en configureren (starten/stoppen, console, back-ups, werelden, mods, de meeste instellingen), maar niet admin-only gebieden. |
| **viewer**   | Alleen-lezen. Servers en hun status bekijken, maar geen wijzigingen aanbrengen.                                                                |

Elke gebruiker, inclusief een viewer, kan hun eigen [two-factor authenticatie](/docs/two-factor-authentication/) beheren, omdat het beschermen van je eigen login geen serverbeheeractie is.

## Alleen voor admins, en waarom

Een paar dingen zijn opzettelijk beperkt tot admins:

- **Gebruikersbeheer, API-sleutels en globale bestanden.**
- **De [publieke API](/docs/public-api/)** - het inschakelen van `/api/v1` en het aanmaken, beperken of intrekken van de read-only Bearer-tokens ervan.
- **Geavanceerde Docker-overrides** - aangepaste containernaam, extra poortpublicaties en bind mounts. Een bind mount kan elk hostpad in een container mappen, en gecombineerd met de Docker-toegang van het paneel is dat effectief root op de host. Deze velden verschijnen alleen voor admins.

Aangepaste containernamen kunnen ook niet in de eigen `msm-` namespace van het paneel leven, dus een handmatig benoemde container kan nooit een andere server overschaduwen en een stop- of commando naar de verkeerde instantie sturen.

## Accounts beheren

![Profielafbeelding](/docs/images/profile-picture.png)

Admins kunnen gebruikers aanmaken, rollen wijzigen, wachtwoorden opnieuw instellen en accounts verwijderen uit de Gebruikers-tabel. De kolom **2FA** toont of elke gebruiker two-factor heeft ingeschakeld; een admin kan de 2FA van een andere gebruiker **resetten** (voor het geval van een verloren telefoon en back-upcodes), maar nooit hun eigen uitschakelen zonder hun wachtwoord, wat de self-service flow in plaats daarvan afhandelt.

Mislukte logins worden rate-limited per account (zowel een teller per IP als een globale teller per account) om brute-force pogingen te vertragen, en dezelfde limiet dekt de 2FA-code stap, zodat een correct wachtwoord de teller niet kan resetten voordat er codes worden geraden. Daarvoor zit een grovere per-client-IP request limiter op de login / 2FA / setup endpoints, instelbaar via `RATE_LIMIT_AUTH_PER_15MIN` (standaard 100; achter een reverse proxy, stel `TRUST_PROXY` in zodat deze op het echte client-IP telt).

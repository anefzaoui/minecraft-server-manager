---
title: 'Gebruikers & rollen'
description: 'Accounts, de rollen admin, operator en viewer, en server-specifieke permissies in Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Terug naar de documentatie-index](/docs/)

Het paneel is multi-user. Beheer accounts onder **Instellingen → Gebruikers**.

![Gebruikers](/docs/images/settings-users.png)

## De drie rollen

| Rol          | Standaard op elke server                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Alles: beheer gebruikers, API-sleutels, globale bestanden, geavanceerde Docker-overrides en elke serveractie.                                  |
| **operator** | Servers uitvoeren en configureren (starten/stoppen, console, back-ups, werelden, mods, de meeste instellingen), maar niet admin-only gebieden. |
| **viewer**   | Alleen-lezen. Bekijk servers en hun status, maar voer geen wijzigingen door.                                                                   |

Elke gebruiker, inclusief een viewer, kan hun eigen [twee-factorauthenticatie](/docs/two-factor-authentication/) beheren, omdat het beveiligen van je eigen login geen serverbeheertaak is.

Een rol is de **standaard** voor elke server. Om iemand andere rechten te geven op één server, gebruik je de per-server permissies hieronder.

## Per-server permissies

De pagina **Permissies** (in de zijbalk, of **Server Permissies** onder **Instellingen → Gebruikers**) toont een raster: elke operator en viewer aan de zijkant, elke server bovenaan. Klik op een cel om te bepalen wat die gebruiker op die ene server mag doen. Admins worden niet vermeld omdat ze altijd alles hebben.

![Permissies](/docs/images/settings-permissions.png)

Elke cel is een set permissies:

| Permissie        | Wat het toestaat op die server                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Bekijken**     | Bekijk de server, de status, console-uitvoer, spelers, geschiedenis en statistieken.                             |
| **Power**        | Start, stop, herstart, stop (kill) en herbouw de server.                                                         |
| **Console**      | Voer console-commando's en snelle wereldacties uit, stuur chatberichten en beheer chatcommando's.                |
| **Spelers**      | Kick, ban, whitelist, op, en bewerk spelersnotities.                                                             |
| **Content**      | Installeer en verwijder mods, plugins, packs, werelden, datapacks, en bewerk inventarissen.                      |
| **Back-ups**     | Maak, herstel, download en verwijder back-ups.                                                                   |
| **Bestanden**    | Blader door, bewerk, upload en download serverbestanden, gearchiveerde logs en logbundels; exporteer blueprints. |
| **Instellingen** | Wijzig serverinstellingen, eigenschappen, integraties, icoon en upgrade versies.                                 |
| **Verwijderen**  | Verwijder de server.                                                                                             |

![Permissie-editor](/docs/images/permissions-editor.png)

Onder het raster opent **Wat Elke Permissie Dekt** elke permissie naar wat een persoon kan doen, wat niet is inbegrepen, en de exacte paneelroutes die het ontgrendelt. Die laatste lijst wordt gecontroleerd tegen de draaiende code door de testsuite.

![Permissie-referentie](/docs/images/permissions-reference.png)

Op een telefoon stapelt het raster zich op tot één kaart per gebruiker, met een rij per server.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Permissies op een telefoon" width="180">
</p>

Hoe de onderdelen samenkomen:

- **De rol is de standaard.** Een operator begint met elke permissie op elke server; een viewer begint met alleen Bekijken. Een cel in vage tekst (de tooltip zegt "Rol standaard") is nooit gewijzigd.
- **Een cel overschrijft de rol voor die server alleen.** Geef een viewer Power en Console op één server en ze kunnen deze uitvoeren, terwijl elke andere server voor hen alleen-lezen blijft. Verwijder Delete van een operator op je hoofdsERVER en ze behouden alles daar.
- **Elke permissie omvat Bekijken.** Je kunt geen server bewerken die je niet kunt zien.
- **Schakel alles uit om een server te verbergen.** Deze verdwijnt uit de zijbalk, het dashboard, back-ups, planningen, activiteit, updates, modpacks, live status, draaiende taken en blueprints van die gebruiker, en de wereldbibliotheek stopt met het benoemen ervan. Een directe link, API-oproep of console-socket antwoordt "niet gevonden", hetzelfde als een server die niet bestaat.
- **Paneel-brede acties volgen nog steeds de rol.** Het maken van servers (inclusief het klonen ervan), opslag, gebruikers, API-sleutels, globale instellingen en paneel-brede planningen zijn niet per server, dus een viewer met permissies op sommige servers kan nog steeds geen van deze doen. Operators behouden servercreatie en paneel-brede planningen; opslag, gebruikers, API-sleutels en globale instellingen zijn alleen voor admins.
- **Planningen volgen de server.** Een geplande herstart, back-up of commando op een server vereist de bijbehorende permissie daar (Power, Back-ups of Console), ongeacht de rol.
- **Blueprints volgen ook de server.** Het exporteren van een server als blueprint vereist Files daar, omdat het archief de bestanden bevat. Een blueprint die is geëxporteerd van een server die iemand niet kan zien, is ook voor hen verborgen.
- **Admin-only gebieden blijven admin-only** op elke server: de chatbot, back-up retentie en geavanceerde Docker overrides.

Elke wijziging wordt geschreven naar het activiteitenlogboek met wie wat heeft gewijzigd; die vermeldingen worden alleen aan admins getoond. Het verwijderen van een gebruiker verwijdert hun rijen. Het verwijderen van een server behoudt ze, dus een server die voor iemand verborgen is, blijft verborgen in de geschiedenis en bewaarde back-ups.

Bestaande installaties blijven ongewijzigd werken: totdat een admin een cel bewerkt, heeft elke gebruiker precies wat hun rol hen voorheen gaf.

## Alleen voor admins, en waarom

Een paar dingen zijn opzettelijk beperkt tot admins:

- **Gebruikersbeheer, opslag, globale instellingen, API-sleutels en globale bestanden.**
- **De [openbare API](/docs/public-api/)**: het inschakelen van `/api/v1` en het maken, beperken of intrekken van de alleen-lezen Bearer-tokens ervan.
- **Geavanceerde Docker overrides**: aangepaste containernaam, extra poortpublicaties en bind mounts. Een bind mount kan elk hostpad in een container mappen, en gecombineerd met de Docker-toegang van het paneel is dat effectief root op de host. Deze velden verschijnen alleen voor admins.

Aangepaste containernamen kunnen ook niet in de eigen `msm-` namespace van het paneel leven, dus een handmatig benoemde container kan nooit een andere server overschaduwen en een stop- of commando-oproep naar de verkeerde instantie omleiden.

## Accounts beheren

![Profiel foto](/docs/images/profile-picture.png)

Admins kunnen gebruikers aanmaken, rollen wijzigen, wachtwoorden opnieuw instellen en accounts verwijderen uit de Gebruikers-tabel. De kolom **2FA** toont of elke gebruiker twee-factor heeft ingeschakeld; een admin kan de 2FA van een andere gebruiker opnieuw instellen met **Reset 2FA** in het actiemenu van die gebruiker (voor het geval van een verloren telefoon en back-upcodes), maar nooit hun eigen uitschakelen zonder hun wachtwoord, wat de self-service flow in plaats daarvan afhandelt.

Mislukte logins worden per account beperkt (zowel een teller per IP als een globale teller per account) om brute-force pogingen te vertragen, en dezelfde limiet dekt de 2FA-code stap, zodat een correct wachtwoord de teller niet kan resetten voordat de code is geraden. Daarvoor zit een grovere limiet per client-IP verzoek op de login / 2FA / setup eindpunten, instelbaar via `RATE_LIMIT_AUTH_PER_15MIN` (standaard 100; achter een reverse proxy, stel `TRUST_PROXY` in zodat deze op het echte client IP wordt gebaseerd).

---
title: 'Activiteitenlogboek'
description: 'De Activiteitspagina is het volledige audit trail: een doorzoekbaar, chronologisch overzicht van alles wat er in het paneel is gebeurd.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Terug naar de documentatie-index](/docs/)

De pagina **Activiteit** is het volledige auditlogboek: een doorzoekbaar, chronologisch overzicht van alles wat er in het paneel is gebeurd. Filter het op server of op gebeurtenistype, doorzoek de samenvattingen en exporteer wat u hebt gefilterd als CSV of JSON. Items die een logboek hebben vastgelegd (bijvoorbeeld een crash) openen dit ter plekke.

![Activiteit](/docs/images/activity.png)

## Wat wordt er vastgelegd

- **Authenticatie**: aanmeldingen (inclusief of 2FA of een back-upcode is gebruikt), accountvergrendelingen, wachtwoordwijzigingen en 2FA dat is ingeschakeld, uitgeschakeld of opnieuw ingesteld.
- **Serverlevenscyclus**: aanmaken, starten, stoppen, herstarten, crashen, automatische herstarts en geheugenproblemen (out-of-memory).
- **Waarschuwingen**: vastgelopen opstarten, stopfouten, mislukte planningen, quotastops, ongezonde containers, offline na herstart.
- **Gegevens**: back-ups gemaakt en hersteld, blauwdrukken geëxporteerd, pakketten geïnstalleerd en geüpgraded, mod- en wereldwijzigingen, en bestanden bewerkt.
- **Spelers**: kicks, bans, wijzigingen in de whitelist en op-status, en spelersnotities.
- **Configuratie**: wijzigingen in chatcommando's, gebruikers- en rolwijzigingen, server-specifieke permissiewijzigingen, wijzigingen in gamepoorten en instellingen bewerkt.

Elk item legt vast wie het heeft gedaan (een gebruikersnaam, of het paneel/de scheduler voor geautomatiseerde acties), met welke server het verband houdt en wanneer. Het [dashboard](/docs/dashboard/) toont de meest recente items; deze pagina is de volledige geschiedenis. Operators en kijkers zien alleen items voor de servers die ze kunnen bekijken (plus server-brede items), en server-specifieke permissiewijzigingen worden alleen aan beheerders getoond. Levenscyclus- en waarschuwingsgebeurtenissen kunnen ook worden doorgestuurd naar Discord (zie [Integraties](/docs/integrations/)).

Omdat het beveiligingsrelevante gebeurtenissen vastlegt (aanmeldingen, 2FA-wijzigingen, rol- en permissiewijzigingen), is het activiteitlogboek ook uw eerste stop als er iets mis lijkt te zijn met een account.

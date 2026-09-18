---
title: 'Activiteitenlogboek'
description: 'De Activiteitspagina is het volledige audit trail: een doorzoekbaar, chronologisch overzicht van alles wat er in het paneel is gebeurd.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Terug naar de documentatie-index](/docs/)

De **Activiteit**-pagina is het volledige auditlogboek: een doorzoekbaar, chronologisch overzicht van alles wat er in het paneel is gebeurd.

![Activiteit](/docs/images/activity.png)

## Wat wordt er vastgelegd

- **Authenticatie** - aanmeldingen (inclusief of 2FA of een back-upcode werd gebruikt), en 2FA dat werd ingeschakeld, uitgeschakeld of gereset.
- **Serverlevenscyclus** - aanmaken, starten, stoppen, herstarten, crashen en out-of-memory-gebeurtenissen.
- **Waarschuwingen** - vastgelopen opstartingen, stopfouten, mislukte planningen, quota-stops, ongezonde containers, offline-na-herstart.
- **Gegevens** - back-ups gemaakt en hersteld, blauwdrukken geëxporteerd, pakketten geïnstalleerd en geüpgraded.
- **Configuratie** - wijzigingen in chatcommando's, rolwijzigingen en bewerkingsinstellingen.

Elke vermelding legt vast wie het heeft gedaan (een gebruikersnaam, of het paneel/de scheduler voor geautomatiseerde acties), op welke server het betrekking heeft en wanneer. Het [dashboard](/docs/dashboard/) toont de meest recente vermeldingen; deze pagina is de volledige geschiedenis. Levenscyclus- en waarschuwingsgebeurtenissen kunnen ook worden doorgestuurd naar Discord (zie [Integraties](/docs/integrations/)).

Omdat het beveiligingsrelevante gebeurtenissen vastlegt (logins, 2FA-wijzigingen, rolwijzigingen), is het activiteitslogboek ook uw eerste stop als er iets mis lijkt te zijn met een account.

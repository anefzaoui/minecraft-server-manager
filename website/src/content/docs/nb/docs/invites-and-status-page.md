---
title: 'Invitasjoner og status-side'
description: 'Inviter venner til en server med adresse, versjon og en klient-modpack, og del en offentlig status-side som viser kun det du velger.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Tilbake til dokumentindeks](/docs/)

To faner under en servers **Innstillinger**-gruppe hjelper spillere med å finne og bli med på den: **Invitasjoner** skriver alt en venn trenger for å koble til, og **Status-side** publiserer en liten offentlig side som viser om serveren er oppe. Begge krever serverens **Innstillinger**-tillatelse ([brukere og roller](/docs/users-and-roles/#per-server-permissions)).

## Invitasjoner

**Innstillinger → Invitasjoner** har et **Inviter venner**-kort:

- **Adresse å dele** lister opp maskinens adresser på ditt lokale nettverk med serverens spillport, din offentlige adresse når panelet kunne oppdage den (spillere utenfor nettverket ditt når den bare via portvideresending), og **Egendefinert adresse…** for et domene eller en adresse du har satt opp selv, som for eksempel `play.example.com:25565`.
- **Invitasjonstekst** er en klar-til-å-lime-inn-melding med serverens navn, adressen du valgte, og dens Minecraft-versjon og type. **Kopier invitasjonstekst** legger den på utklippstavlen. Når hvitlisten er på, ber teksten venner om deres Minecraft-brukernavn, og kortet minner deg på å legge til hver venn på **Spillere**-fanen før de blir med.
- **Hva venner trenger** sier hva som kreves på spillersiden: ingenting annet enn riktig Minecraft-versjon for en vanilla- eller plugin-server (Paper og lignende), eller serverens mods for en moddet server.

### Klientmodpacken

På en moddet server tilbyr kortet også **Last ned klientmodpack (.mrpack)**. Venner importerer den i Prism Launcher eller Modrinth App, som installerer serverens Minecraft-versjon og mod-laster, laster ned mods, og legger til serveren i deres flerspillersliste med adressen du valgte.

Filen bygges fra mods du selv har lagt til serveren (den egendefinerte mod-overleggen) som kommer fra Modrinth. Mods fra andre steder listes i stedet på kortet, slik at venner kan legge disse filene til sin `mods`-mappe manuelt. På en server opprettet fra en modpack, bør venner installere den pakken, i den versjonen serveren kjører, i sin launcher; **Oversikt**-fanen viser versjonen.

### Spill over internett

**Spill over internett (portvideresending)** nederst på kortet forklarer ruter-siden: videresend serverens spillport (TCP og UDP) til maskinen som kjører panelet, del deretter din offentlige adresse med porten. Hvis internettleverandøren din bruker CGNAT, kan ikke portvideresending fungere, og en tunnel-tjeneste (for eksempel playit.gg) er veien inn. Panelet åpner ikke ruterporter av seg selv. Kun spillporter hører hjemme på internett; hold panelets egne porter og RCON-porter lukket ([porter i et øyeblikk](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Status-side

**Innstillinger → Status-side** slår på en offentlig side for én server, av som standard:

1. Slå på kortet.
2. Velg **Sideadresse**: siden ligger på `/status/<adresse>` på panelet ditt, og adressen er 3 til 40 små bokstaver, tall eller bindestreker, unik på tvers av serverne dine.
3. Trykk **Lagre**. **Åpne side** og **Kopier lenke** gir deg deretter lenken å dele.

Alle med lenken ser serverens navn, dens MOTD, versjon, om den kjører, spillerantallet og oppetiden, og ingenting annet. Siden har ingen lenke inn i panelet og krever ingen innlogging. Den leser panelets status i minnet, så besøkende forårsaker aldri arbeid på Docker-demonen.

Å slå av siden beholder adressen, så å slå den på igjen gjenoppretter den samme lenken. For en egen side eller bot, returnerer [offentlig API](/docs/public-api/) samme type status som JSON.

Relatert: [Discord-varsler](/docs/integrations/), [det levende kartet](/docs/live-map/), [opprette og administrere servere](/docs/servers/).

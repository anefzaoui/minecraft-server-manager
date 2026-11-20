---
title: 'Uitnodigingen & statuspagina'
description: 'Nodig vrienden uit voor een server met het adres, de versie en een client modpack, en deel een openbare statuspagina die alleen toont wat jij kiest.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Terug naar de documentatie-index](/docs/)

Twee tabbladen onder de groep **Instellingen** van een server helpen spelers deze te vinden en ermee te verbinden: **Uitnodigingen** bevat alle informatie die een vriend nodig heeft om verbinding te maken, en **Statuspagina** publiceert een kleine openbare pagina die aangeeft of de server actief is. Beide vereisen de **Instellingen**-permissie van de server ([gebruikers & rollen](/docs/users-and-roles/#per-server-permissions)).

## Uitnodigingen

**Instellingen → Uitnodigingen** heeft een kaart **Vrienden uitnodigen**:

- **Te delen adres** toont de adressen van de machine in uw lokale netwerk met de gamepoort van de server, uw openbare adres als het paneel dit kon detecteren (spelers buiten uw netwerk bereiken het alleen via port forwarding), en **Aangepast adres…** voor een domein of adres dat u zelf hebt ingesteld, zoals `play.example.com:25565`.
- **Uitnodigingstekst** is een kant-en-klare bericht met de naam van de server, het door u gekozen adres, en de Minecraft-versie en -type. **Kopieer uitnodigingstekst** plaatst dit op het klembord. Als de whitelist is ingeschakeld, vraagt de tekst vrienden naar hun Minecraft-gebruikersnaam, en de kaart herinnert u eraan om elke vriend op het tabblad **Spelers** toe te voegen voordat ze verbinding maken.
- **Wat vrienden nodig hebben** beschrijft wat er aan de kant van de speler nodig is: niets anders dan de juiste Minecraft-versie voor een vanilla- of pluginserver (Paper en vergelijkbaar), of de mods van de server voor een gemodificeerde server.

### De client modpack

Op een gemodificeerde server biedt de kaart ook **Download Client Modpack (.mrpack)**. Vrienden importeren dit in Prism Launcher of de Modrinth App, die de Minecraft-versie en mod loader van de server installeert, de mods downloadt en de server toevoegt aan hun multiplayerlijst met het door u gekozen adres.

Het bestand wordt gebouwd uit de mods die u zelf aan de server hebt toegevoegd (de custom-mod overlay) die afkomstig zijn van Modrinth. Mods van elders worden in plaats daarvan op de kaart vermeld, zodat vrienden die bestanden handmatig aan hun `mods`-map kunnen toevoegen. Op een server die is gemaakt van een modpack, moeten vrienden dat pakket, in de versie waarop de server draait, in hun launcher installeren; het tabblad **Overzicht** toont de versie.

### Online spelen via internet

**Online spelen via internet (port forwarding)** onderaan de kaart legt de routerkant uit: forward de gamepoort van de server (TCP en UDP) naar de machine waarop het paneel draait, deel vervolgens uw openbare adres met de poort. Als uw internetprovider CGNAT gebruikt, kan port forwarding niet werken en is een tunneldienst (bijvoorbeeld playit.gg) de oplossing. Het paneel opent zelf geen routerpoorten. Alleen gamepoorten horen op het internet; houd de eigen poort van het paneel en de RCON-poorten gesloten ([poorten in één oogopslag](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Statuspagina

**Instellingen → Statuspagina** schakelt een openbare pagina in voor één server, standaard uitgeschakeld:

1. Schakel de kaart in.
2. Kies het **Paginadres**: de pagina bevindt zich op `/status/<adres>` op uw paneel, en het adres bestaat uit 3 tot 40 kleine letters, cijfers of streepjes, uniek voor al uw servers.
3. Druk op **Opslaan**. **Pagina openen** en **Link kopiëren** geven u vervolgens de te delen link.

Iedereen met de link ziet de naam van de server, de MOTD, versie, of deze actief is, het aantal spelers en de uptime, en niets anders. De pagina heeft geen link naar het paneel en vereist geen aanmelding. Het leest de status in het geheugen van het paneel, dus bezoekers veroorzaken nooit werk aan de Docker daemon.

Het uitschakelen van de pagina behoudt het adres, dus door het weer in te schakelen wordt dezelfde link hersteld. Voor een eigen pagina of bot retourneert de [openbare API](/docs/public-api/) hetzelfde soort status als JSON.

Gerelateerd: [Discord-meldingen](/docs/integrations/), [de live kaart](/docs/live-map/), [servers maken en beheren](/docs/servers/).

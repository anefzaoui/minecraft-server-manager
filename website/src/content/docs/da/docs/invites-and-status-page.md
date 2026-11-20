---
title: 'Invitationer & statusside'
description: 'Inviter venner til en server med adressen, versionen og en klient-modpack, og del en offentlig statusside, der kun viser, hvad du vælger.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Tilbage til dokumentindeks](/docs/)

To faner under en servers **Indstillinger**-gruppe hjælper spillere med at finde og tilslutte sig den: **Invitationer** skriver alt, hvad en ven behøver for at oprette forbindelse, og **Status-side** udgiver en lille offentlig side, der viser, om serveren er oppe. Begge kræver serverens **Indstillinger**-tilladelse ([brugere & roller](/docs/users-and-roles/#per-server-permissions)).

## Invitationer

**Indstillinger → Invitationer** har et **Inviter venner**-kort:

- **Adresse at dele** viser maskinens adresser på dit lokale netværk med serverens spilport, din offentlige adresse, når panelet kunne registrere den (spillere uden for dit netværk når den kun via port forwarding), og **Brugerdefineret adresse…** for et domæne eller en adresse, du selv har sat op, f.eks. `play.example.com:25565`.
- **Invitationstekst** er en klar til at indsætte besked med serverens navn, den adresse, du valgte, og dens Minecraft-version og -type. **Kopiér invitationstekst** placerer den på udklipsholderen. Når whitelisten er slået til, beder teksten venner om deres Minecraft-brugernavn, og kortet minder dig om at tilføje hver ven på **Spillere**-fanen, før de tilslutter sig.
- **Hvad venner behøver** siger, hvad der skal gøres på spillersiden: intet andet end den rigtige Minecraft-version til en vanilla- eller plugin-server (Paper og lignende), eller serverens mods til en modded server.

### Klientens modpack

På en modded server tilbyder kortet også **Download klient modpack (.mrpack)**. Venner importerer det i Prism Launcher eller Modrinth App, som installerer serverens Minecraft-version og mod loader, downloader modsene og tilføjer serveren til deres multiplayerliste med den adresse, du valgte.

Filen er bygget ud fra de mods, du selv har tilføjet til serveren (custom-mod overlay), som kommer fra Modrinth. Mods fra andre steder er i stedet angivet på kortet, så venner kan tilføje disse filer til deres `mods`-mappe manuelt. På en server oprettet fra et modpack, bør venner installere den pakke, i den version serveren kører, i deres launcher; **Oversigt**-fanen viser versionen.

### Spil over internettet

**Spil over internettet (port forwarding)** nederst på kortet forklarer router-siden: videresend serverens spilport (TCP og UDP) til maskinen, der kører panelet, del derefter din offentlige adresse med porten. Hvis din internetudbyder bruger CGNAT, kan port forwarding ikke fungere, og en tunnel-tjeneste (f.eks. playit.gg) er vejen ind. Panelet åbner ikke routerporte af sig selv. Kun spilporte hører til på internettet; hold panelets egen port og RCON-porte lukket ([porte i et overblik](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Status-side

**Indstillinger → Status-side** slår en offentlig side til for én server, slået fra som standard:

1. Tænd for kortet.
2. Vælg **Sideadresse**: siden ligger på `/status/<adresse>` på dit panel, og adressen er 3 til 40 små bogstaver, tal eller bindestreger, unik på tværs af dine servere.
3. Tryk på **Gem**. **Åbn side** og **Kopiér link** giver dig derefter linket til at dele.

Alle med linket ser serverens navn, dens MOTD, version, om den kører, spillerantallet og dens oppetid, og intet andet. Siden har intet link ind i panelet og kræver ingen login. Den læser panelets status i hukommelsen, så besøgende aldrig forårsager arbejde på Docker-daemonen.

At slå siden fra bevarer dens adresse, så at slå den til igen gendanner det samme link. For en side eller en bot af din egen, returnerer [det offentlige API](/docs/public-api/) den samme slags status som JSON.

Relateret: [Discord-notifikationer](/docs/integrations/), [det live kort](/docs/live-map/), [oprettelse og administration af servere](/docs/servers/).

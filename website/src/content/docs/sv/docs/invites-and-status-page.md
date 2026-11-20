---
title: 'Inbjudningar & status-sida'
description: 'Bjud in vänner till en server med adressen, versionen och en klientmodpack, och dela en offentlig status-sida som visar endast det du väljer.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/invites-and-status-page.md'
---

[← Tillbaka till dokumentindex](/docs/)

Två flikar under en servers **Inställningar**-grupp hjälper spelare att hitta och ansluta till den: **Inbjudningar** skriver ner allt en vän behöver för att ansluta, och **Status-sida** publicerar en liten offentlig sida som visar om servern är igång. Båda kräver serverns **Inställningar**-behörighet ([användare & roller](/docs/users-and-roles/#per-server-permissions)).

## Inbjudningar

**Inställningar → Inbjudningar** har ett **Bjud in vänner**-kort:

- **Adress att dela** listar maskinens adresser på ditt lokala nätverk med serverns spelport, din publika adress när panelen kunde upptäcka den (spelare utanför ditt nätverk når den bara via portvidarebefordran), och **Anpassad adress…** för en domän eller adress du ställt in själv, som till exempel `play.example.com:25565`.
- **Inbjudningstext** är ett färdigt meddelande att klistra in med serverns namn, den adress du valt, och dess Minecraft-version och typ. **Kopiera inbjudningstext** lägger den på urklippet. När vitlistan är på, frågar texten vänner efter deras Minecraft-användarnamn, och kortet påminner dig om att lägga till varje vän på fliken **Spelare** innan de ansluter.
- **Vad vänner behöver** säger vad som krävs på spelarens sida: inget annat än rätt Minecraft-version för en vanilla- eller plugin-server (Paper och liknande), eller serverns mods för en moddad server.

### Klientens modpack

På en moddad server erbjuder kortet även **Ladda ner klientmodpack (.mrpack)**. Vänner importerar det i Prism Launcher eller Modrinth App, som installerar serverns Minecraft-version och mod-laddare, laddar ner moddarna och lägger till servern i deras multiplayerlista med den adress du valt.

Filen byggs från moddarna du själv lagt till på servern (anpassad mod-overlay) som kommer från Modrinth. Moddar från andra ställen listas istället på kortet, så vänner kan lägga till dessa filer i sin `mods`-mapp manuellt. På en server skapad från ett modpack, bör vänner installera det paketet, i den version som servern kör, i sin launcher; fliken **Översikt** visar versionen.

### Spela över internet

**Spela över internet (portvidarebefordran)** längst ner på kortet förklarar routersidan: vidarebefordra serverns spelport (TCP och UDP) till maskinen som kör panelen, dela sedan din publika adress med porten. Om din internetleverantör använder CGNAT, kan portvidarebefordran inte fungera, och en tunnel-tjänst (till exempel playit.gg) är lösningen. Panel-programmet öppnar inte själv routerportar. Endast spelportar hör hemma på internet; håll panelens egna port och RCON-portarna stängda ([portar i en överblick](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)).

## Status-sida

**Inställningar → Status-sida** slår på en offentlig sida för en server, avstängd som standard:

1. Slå på kortet.
2. Välj **Sid-adress**: sidan finns på `/status/<adress>` på din panel, och adressen är 3 till 40 små bokstäver, siffror eller bindestreck, unik över dina servrar.
3. Tryck på **Spara**. **Öppna sida** och **Kopiera länk** ger dig sedan länken att dela.

Vem som helst med länken ser serverns namn, dess MOTD, version, om den körs, spelarantal och upptid, och inget annat. Sidan har ingen länk in i panelen och kräver ingen inloggning. Den läser panelens status i minnet, så besökare orsakar aldrig arbete på Docker-demonen.

Att stänga av sidan behåller dess adress, så att slå på den igen återställer samma länk. För en egen sida eller bot, returnerar [publika API:et](/docs/public-api/) samma typ av status som JSON.

Relaterat: [Discord-notifikationer](/docs/integrations/), [live-kartan](/docs/live-map/), [skapa och hantera servrar](/docs/servers/).

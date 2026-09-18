---
title: 'Formindskning af en verden'
description: 'Over tid spreder en verden sig: ethvert sted, en spiller nogensinde har gået, fløjet eller'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Tilbage til dokumentindeks](/docs/)

Over tid breder en verden sig ud: hvert sted en spiller nogensinde har gået, fløjet eller er blevet transporteret af en Ender Pearl efterlader genererede klumper på disken, selvom ingen nogensinde er vendt tilbage. **Formindsk verden** fjerner de klumper, som næsten ingen har brugt tid i, så verden fylder mindre. Minecraft genopbygger et fjernet område fra verdens "seed" i det øjeblik, nogen rejser dertil igen, så dette er sikkert for land, som ingen bruger, men alt, hvad en spiller _byggede_ på et sted, de knap nok stod på, ville også forsvinde, hvilket er grunden til, at du bør tage en backup først (backupen er fortrydelsesknappen).

## Hvad tæller som "sjældent besøgt"

Hver klump registrerer, hvor lang tid spillere har brugt på at stå i den (Minecraft kalder dette `InhabitedTime`). Formindsk verden fjerner som standard enhver klump med under **30 sekunders** samlet spilletid; dialogboksen for formindskelse lader dig ændre denne tærskel (1 sekund til 1 time) og hvor mange klumper omkring spawn, der skal bevares (standard 8, `0` slår spawn-beskyttelse fra).

Hvad der altid bevares:

- Området omkring verdens **spawn-punkt** (læst fra `level.dat`) i oververdenen. Nether, End og brugerdefinerede dimensioner har intet spawn-område.
- Enhver klump, hvis besøgstid ikke kunne læses, f.eks. en verden gemt med et komprimeringsformat, som panelet ikke kan afkode (LZ4). Forhåndsvisningen og resultatet fortæller dig, hvor mange sådanne klumper der blev sprunget over.

Hver dimension af verden er dækket: Bukkit-lignende søstermapper (`world_nether`, `world_the_end`) samt den almindelige og Forge/Fabric-layout (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`). Når en klump fjernes, forsvinder dens entiteter og landsbyboeres interessepunkter med den, så en regenereret klump ikke arver gamle mobs, minecarts eller arbejdspladser.

## Gør det fra fanen Verdener

1. Tag en backup fra fanen **Backups**. Formindskelse fra fanen Verdener tager ikke en for dig.
2. Åbn **World → Worlds**, find verdenen, og klik på formindskelsesikonet.
3. Klik på **Preview** for at se cirka hvor mange klumper (og hvor mange megabytes) der ville blive fjernet. Intet er ændret endnu; en forhåndsvisning virker, mens serveren kører.
4. Klik på **Shrink World**. Formindskelse redigerer verdensfilerne direkte, så serveren skal stoppes: enten stop den først, eller marker muligheden for at stoppe den, formindske og starte den igen i én omgang (serveren startes igen, selvom formindskelsen fejler). Fremskridt vises i opgavebakken.

![Formindsk verden](/docs/images/world-shrink.png)

## Gør det som en del af en backup

På fanen **Backups**, marker **"Also shrink the world afterwards"** før **Back Up Now**. Backup-arkivet skrives først (det arkiv er din fortrydelsesknap), derefter formindskes verdenen, men kun hvis serveren er stoppet. Hvis serveren kører, kører backupen stadig, og formindskelsen springes over med en bemærkning.

Planlagte backups har samme mulighed: i planlægningseditoren skal du vælge **Backup**-opgaven og markere **"Shrink the world after each backup"**. Par den med en **Stop server**-planlægning et par minutter tidligere, hvis du vil have den til at køre uden opsyn.

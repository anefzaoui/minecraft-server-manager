---
title: 'Livskarta'
description: 'Aktivera en BlueMap live 3D-karta över en servers värld med ett klick, serverad endast via panelens inloggning.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/live-map.md'
---

[← Tillbaka till dokumentindex](/docs/)

En servers flik **Värld → Karta** visar en levande, zoombar 3D-karta över dess värld, ritad av [BlueMap](https://bluemap.bluecolored.de/) (gratis och öppen källkod), med spelarpositioner och varje dimension. Panelappen installerar den, konfigurerar den och serverar den; du behöver aldrig öppna en port eller redigera en konfigurationsfil för den.

## Aktivera den

1. Öppna servern, sedan **Värld → Karta**.
2. Tryck på **Aktivera levande karta**. Panelappen installerar den BlueMap-version som matchar serverns laddare och Minecraft-version från Modrinth, accepterar BlueMaps nedladdning av resurser åt dig och väljer en ledig port för den.
3. Starta om servern (ändringen gäller vid nästa start, och servern markeras som väntande på en omstart).

BlueMap renderar i bakgrunden, så en ny karta tar några minuter att rita sina första brickor. Tills dess visar fliken att kartan inte är redo än och kontrollerar igen av sig själv. När den är redo öppnar **Helskärm** kartan i en egen webbläsarflik.

Den fungerar på servrar med en mod-laddare (Fabric, Quilt, Forge, NeoForge) och på plugin-servrar (Paper, Purpur och resten av Paper-familjen, Spigot), inklusive modpack-servrar. Vanilla-servrar har ingen BlueMap-version, och fliken anger detta.

## Vem kan se den

Kartans data serveras endast via panelappen, bakom dess inloggning: alla som kan se servern i panelappen kan öppna dess karta, och ingen annan. BlueMaps egen port är aldrig avsedd att öppnas mot internet ([portar i en överblick](https://github.com/anefzaoui/minecraft-server-manager#ports-at-a-glance)). Att aktivera eller inaktivera kartan kräver serverns **Inställningar**-behörighet ([användare & roller](/docs/users-and-roles/#per-server-permissions)).

När panelappen själv körs i Docker når den BlueMap inuti serverns container; [README](https://github.com/anefzaoui/minecraft-server-manager#installation) förklarar detaljerna för reverse-proxy-uppsättningar.

## Inaktivera den

**Inaktivera karta** tar bort BlueMap-jar-filen som panelappen installerade och frigör dess port, igen från och med nästa omstart. Själva världen lämnas orörd; renderade kartbrickor finns kvar i serverns mapp tills du raderar dem på fliken **Filer**.

Relaterat: [världar & filer](/docs/worlds-and-files/), [inbjudningar & statusida](/docs/invites-and-status-page/).

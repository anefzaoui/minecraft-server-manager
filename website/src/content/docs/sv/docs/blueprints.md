---
title: 'Ritningar'
description: 'Ritningar sparar en Minecraft-servers hela konfiguration som ett återanvändbart recept för att skapa nya servrar. Hemligheter inkluderas aldrig.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Tillbaka till dokumentindex](/docs/)

En **ritning** (blueprint) fångar en servers hela konfiguration (typ, version, resurser, miljö, pack-pin, anpassade mods, och valfritt dess konfiguration och värld) i en enda portabel `.mcserver.zip`-fil som du kan använda för att skapa nya servrar. Hemligheter (lösenord, tokens och nycklar i miljön) skrivs aldrig till en ritning.

![Ritningar](/docs/images/blueprints.png)

## Exportera

Från en servers flik **Inställningar → Konfiguration**, använd **Exportera som ritning** och välj vad som ska inkluderas: serverns konfiguration alltid, dess konfigurationskataloger (aktiverade som standard), och valfritt själva de anpassade modfilerna (en större fil som installeras utan att ladda ner något) och den aktiva världen. Resultatet sparas i ditt ritningsbibliotek och kan laddas ner för att delas.

**Klona server**, på samma kort, utför en export och en import i ett steg för att skapa en kopia av servern, med eller utan dess värld.

## Importera & skapa från en ritning

Importera en ritningsfil (**Importera ritning** på sidan **Ritningar**) eller välj en från biblioteket (**Skapa en server** på dess kort, eller guiden **Från ritning**-fliken) för att skapa en ny server som är förkonfigurerad exakt som originalet. Den nya servern får sina egna portar och ett nytt RCON-lösenord. Anpassade mods som inte bäddades in laddas ner igen och kontrolleras mot de hashvärden som ritningen registrerade. Biblioteket börjar också med två startritningar, en Paper och en Fabric.

Det är det snabbaste sättet att:

- Starta identiska servrar (ett nätverk av minispelsservrar, staging-kopior av produktion).
- Flytta en server mellan paneler.
- Behålla en känd-bra mall som du alltid kan återgå till.

Eftersom en ritning registrerar den exakta [pack-pinnen](/docs/modpacks/), installerar en modpack-server skapad från en ritning samma fastsatta version, utan överraskande uppgraderingar.

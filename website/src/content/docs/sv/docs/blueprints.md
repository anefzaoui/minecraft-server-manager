---
title: 'Ritningar'
description: 'En ritning fångar en servers hela konfiguration (typ, version, resurser, miljö, pack-pin och valfritt dess konfiguration och värld) till en enda po'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/blueprints.md'
---

[← Tillbaka till dokumentindex](/docs/)

En **ritning** (blueprint) fångar en servers hela konfiguration (typ, version, resurser, miljö, pack-pin, och valfritt dess konfiguration och värld) i en enda portabel fil som du kan använda för att skapa nya servrar.

![Ritningar](/docs/images/blueprints.png)

## Exportera

Från en server, exportera en ritning och välj vad som ska inkluderas: konfiguration alltid, och valfritt inbäddade filer och världen. Resultatet sparas i ditt ritningsbibliotek och kan laddas ner för att delas.

## Importera & skapa från en ritning

Importera en ritningsfil (eller välj en från biblioteket) för att skapa en ny server som är förkonfigurerad exakt som originalet. Det är det snabbaste sättet att:

- Starta identiska servrar (ett nätverk av minispelsservrar, staging-kopior av produktion).
- Flytta en server mellan paneler.
- Behålla en känd-bra mall som du alltid kan återgå till.

Eftersom en ritning registrerar den exakta [pack-pinnen](/docs/modpacks/), installerar en modpack-server återskapad från en ritning samma fastnaglade version, utan oväntade uppgraderingar.

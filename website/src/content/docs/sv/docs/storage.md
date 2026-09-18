---
title: 'Lagring'
description: 'Lagringssidan visar vart ditt diskutrymme tar vägen: användning per server och hur den utvecklas över tid.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Tillbaka till dokumentindex](/docs/)

**Lagring**-sidan visar vart ditt diskutrymme tar vägen: användning per server och hur den utvecklas över tid.

![Lagring](/docs/images/storage.png)

## Disk-kvoter hanteras av panelen

Docker kan inte begränsa disk-användningen för en bind mount, så panelen gör det. En bakgrunds-indexerare går igenom data-katalogen, cachar varje servers fotavtryck och upprätthåller den disk-kvot du ställer in per server. När en servers data (värld + säkerhetskopior + allt annat) närmar sig sin kvot, stoppar panelen okontrollerad tillväxt istället för att låta en server fylla din värd.

Ställ in en servers kvot i dess [inställningar](/docs/servers/). Moddade servrar och deras [säkerhetskopior](/docs/backups/) kan vara stora, så ge dem utrymme.

## Rensa

Lagrings-vyn hjälper dig att hitta vad du kan rensa (gamla säkerhetskopior, oanvända världar, eller en server som har vuxit långt bortom förväntningarna) innan du får slut på utrymme.

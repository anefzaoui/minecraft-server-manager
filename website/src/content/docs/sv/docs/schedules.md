---
title: 'Scheman'
description: 'Sidan Scheman automatiserar återkommande uppgifter med cron-uttryck. Ingen extern cron, inga skript.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Tillbaka till dokumentindex](/docs/)

**Scheman**-sidan automatiserar återkommande uppgifter med cron-uttryck. Ingen extern cron, inga skript.

![Scheman](/docs/images/schedules.png)

## Vad du kan schemalägga

- **Omstarter**: en nattlig omstart för att hålla en server som körs länge frisk.
- **Stopp och start**: stäng av en server över natten och starta den igen på morgonen.
- **Säkerhetskopior**: regelbundna ögonblicksbilder (märkta `scheduled` på sidan [Säkerhetskopior](/docs/backups/)). Ett schema för säkerhetskopiering kan också krympa världen efter varje säkerhetskopia ([krympa en värld](/docs/world-shrink/)). Varje ny server får ett dagligt schema för säkerhetskopiering automatiskt.
- **Kommandon**: kör valfritt serverkommando enligt ett schema.
- **Uppdateringskontroller**: uppdatera periodiskt vad som är inaktuellt. Den schemalagda kontrollen är också det som tillämpar uppdateringar för servrar som är inställda på [Auto-Update](/docs/modpacks/#update-policy).

Varje schema riktar sig mot en specifik server (eller panelen globalt), körs med sitt eget cron-uttryck och kan aktiveras eller inaktiveras utan att tas bort. Redigeraren förhandsgranskar nästa körtid medan du skriver, cron-tider följer panelens tidszon (inställd i **Inställningar**), och tabellen visar varje schemas nästa körning. Varje körning registreras som en historikhändelse, liksom en misslyckad körning.

Panelen sätter också sina egna underhållsscheman vid första uppstart, som du kan ändra tid för eller stänga av: en daglig uppdateringskontroll, en lagringsomskanning var sjätte timme, en daglig rensning av gamla temporära filer, en kontroll av utgångna avstängningar var 15:e minut (lyfter temporära avstängningar som har löpt ut), och en nattlig påfyllning av innehållsmetadata (fyller i saknade modnamn och ikoner).

## När servern är upptagen

En schemalagd säkerhetskopia eller start som hittar sin server mitt i en annan åtgärd (en återställning, en rensning av säkerhetskopior, en portändring) väntar och försöker igen varje minut tills åtgärden är klar, i upp till 30 minuter. En väntande start avbryts om någon startar eller stoppar servern under tiden. En schemalagd omstart eller stopp försöks inte igen: den hoppas över och körs igen vid nästa tidpunkt.

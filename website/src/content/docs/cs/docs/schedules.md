---
title: 'Plánované úlohy'
description: 'Stránka Plánované úlohy automatizuje opakující se úkoly pomocí cron výrazů. Žádný externí cron, žádné skripty.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Zpět na přehled dokumentace](/docs/)

Stránka **Plány** automatizuje opakující se úlohy pomocí cron výrazů. Žádný externí cron, žádné skripty.

![Plány](/docs/images/schedules.png)

## Co lze naplánovat

- **Restarty**: noční restart pro udržení dlouho běžícího serveru v dobrém stavu.
- **Zastavení a spuštění**: přes noc vypnout server a ráno jej znovu spustit.
- **Zálohy**: pravidelné snímky (označené jako `scheduled` na stránce [Zálohy](/docs/backups/)). Plán zálohování může také zmenšit svět po každé záloze ([zmenšení světa](/docs/world-shrink/)). Každý nový server automaticky získá denní plán zálohování.
- **Příkazy**: spouštět libovolný příkaz serveru podle plánu.
- **Kontroly aktualizací**: periodicky obnovovat, co je zastaralé. Naplánovaná kontrola je také to, co aplikuje aktualizace pro servery nastavené na [Automatickou aktualizaci](/docs/modpacks/#update-policy).

Každý plán cílí na konkrétní server (nebo na panel globálně), běží na vlastním cron výrazu a lze jej povolit nebo zakázat bez jeho smazání. Editor zobrazuje náhled dalších časů spuštění při psaní, cron časy se řídí časovým pásmem panelu (nastaveným v **Nastavení**) a tabulka zobrazuje další spuštění každého plánu. Každé spuštění je zaznamenáno jako událost v historii, stejně jako neúspěšné spuštění.

Panel také při prvním spuštění nastaví své vlastní plány údržby, které můžete změnit nebo vypnout: denní kontrola aktualizací, skenování úložiště každých šest hodin, denní čištění starých dočasných souborů, kontrola vypršení banů každých 15 minut (zrušení dočasných banů, kterým vypršela platnost) a noční doplňování metadat obsahu (doplnění chybějících názvů a ikon modů).

## Když je server zaneprázdněn

Naplánovaná záloha nebo spuštění, které zjistí, že server je uprostřed jiné akce (obnova, čištění záloh, změna portu), počká a pokusí se znovu každou minutu, dokud akce neskončí, maximálně však 30 minut. Čekající spuštění je zrušeno, pokud mezitím někdo server spustí nebo zastaví. Naplánovaný restart nebo zastavení se neopakuje: je přeskočen a spustí se znovu v další naplánovaný čas.

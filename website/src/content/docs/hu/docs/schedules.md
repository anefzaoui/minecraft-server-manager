---
title: 'Ütemezések'
description: 'Az Ütemezések oldal automatizálja az ismétlődő feladatokat cron kifejezésekkel.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/schedules.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Ütemezések** oldal automatizálja az ismétlődő feladatokat cron kifejezésekkel. Nincs külső cron, nincsenek szkriptek.

![Ütemezések](/docs/images/schedules.png)

## Mit ütemezhetsz

- **Újraindítások** - egy éjszakai újraindítás a hosszú ideje futó szerver egészségének megőrzése érdekében.
- **Biztonsági mentések** - rendszeres pillanatfelvételek (a [Biztonsági mentések](/docs/backups/) oldalon `scheduled` címkével ellátva).
- **Parancsok** - bármely szerverparancs futtatása ütemezetten.
- **Frissítések ellenőrzése** - időszakonként frissíti, mi az, ami elavult.

Minden ütemezés egy adott szervert céloz meg (vagy a panelt globálisan), saját cron kifejezésén fut, és törlés nélkül engedélyezhető vagy letiltható. Az utolsó futtatás ideje látható, így megerősítheted, hogy működik.

---
title: 'Tevékenységnapló'
description: 'A Tevékenység oldal a teljes audit trail: minden, ami a panelben történt, kereshető, kronologikus nyilvántartása.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Tevékenység** oldal a teljes napló: minden, ami a panelen történt, kereshető, időrendi nyilvántartása.

![Tevékenység](/docs/images/activity.png)

## Mi van rögzítve

- **Hitelesítés** - bejelentkezések (beleértve, hogy használtak-e 2FA-t vagy biztonsági kódot), valamint a 2FA engedélyezése, letiltása vagy visszaállítása.
- **Szerver életciklus** - létrehozások, indítások, leállítások, újraindítások, összeomlások és memóriakiürülési események.
- **Riasztások** - leállt indítások, leállítási hibák, sikertelen ütemezések, kvóták miatti leállítások, nem egészséges konténerek, újraindítás után offline állapot.
- **Adatok** - létrehozott és visszaállított biztonsági mentések, exportált sablonok, csomagok telepítése és frissítései.
- **Konfiguráció** - csevegési parancsok módosításai, szerepkörök módosításai és beállítások szerkesztései.

Minden bejegyzés rögzíti, hogy ki tette (felhasználónév, vagy a panel/ütemező az automatizált műveletekhez), melyik szerverhez kapcsolódik, és mikor. A [vezérlőpult](/docs/dashboard/) mutatja a legutóbbi bejegyzéseket; ez az oldal a teljes előzmény. Az életciklus- és riasztási események továbbíthatók a Discordra is (lásd: [Integrációk](/docs/integrations/)).

Mivel biztonsági szempontból releváns eseményeket (bejelentkezések, 2FA módosítások, szerepkör módosítások) rögzít, a tevékenységnapló az elsődleges hely, ahová fordulni érdemes, ha valami gyanús az egyik fiókkal kapcsolatban.

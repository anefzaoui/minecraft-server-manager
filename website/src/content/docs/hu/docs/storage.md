---
title: 'Tárhely'
description: 'A Tárhely oldal megmutatja, hogyan oszlik el a lemezterületed: kiszolgálónkénti használat és az időbeli trendek.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Tárhely** oldal megmutatja, hová tűnik a lemezterületed: kiszolgálónkénti használat és az időbeli alakulása.

![Tárhely](/docs/images/storage.png)

## Lemezkvóták érvényesítése a panelen keresztül

A Docker nem tudja korlátozni a bind mount lemezhasználatát, így ezt a panel végzi. Egy háttérben futó méretindexelő bejárja az adatkönyvtárat, gyorsítótárazza minden kiszolgáló lábnyomát, és érvényesíti az általad beállított, kiszolgálónkénti lemezkvótát. Amikor egy kiszolgáló adatai (világ + biztonsági mentések + minden más) megközelítik a kvótáját, a panel megállítja a túlzott növekedést, ahelyett, hogy hagyná, hogy egy kiszolgáló megtöltse a gazdagépedet.

Állítsd be egy kiszolgáló kvótáját a [beállításaiban](/docs/servers/). A moddol szerverek és a [biztonsági mentéseik](/docs/backups/) nagyok lehetnek, ezért adj nekik elegendő helyet.

## Tisztítás

A Tárhely nézet segít megtalálni, mit kell eltávolítani (régi biztonsági mentések, nem használt világok, vagy egy várakozáson felül megnőtt kiszolgáló), mielőtt kifogynál a helyből.

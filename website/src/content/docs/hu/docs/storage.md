---
title: 'Tárhely'
description: 'Tekintse meg, hol fogy a lemezterület, korlátozza a szervermappákat lemez kvótával, és törölje a felesleges fájlokat.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/storage.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Tárhely** oldal megmutatja, hogy hol fogy a lemezterület: kategóriánkénti használat, szerverek a kvótájukkal szemben, a legnagyobb fájlok, és hogyan alakul a teljes használat a legutóbbi vizsgálatok során. Csak rendszergazdák számára érhető el.

![Tárhely](/docs/images/storage.png)

## Lemezkvóták érvényesítése a panelen keresztül

A Docker nem tudja korlátozni egy bind mount lemezhsználatát, ezért ezt a panel végzi. Egy háttérben futó méretindexelő bejárja az adatmappát (15 percenként, változások után, vagy amikor megnyomod a **Vizsgálat most** gombot), tárolja az egyes szerverek méretét, és érvényesíti az általad szerverenként beállított lemezkvótát. Az olyan műveletek, amelyek a szerver mappáját (világ, modok, konfigurációk, naplók és minden más benne) a kvótán túlra vinnék, mint például egy mod vagy egy világ telepítése, vagy fájlok feltöltése, blokkolva lesznek, amíg nem szabadítasz fel helyet, vagy emeled meg a kvótát, ahelyett, hogy egy szerver megtöltené a gazdagépedet.

Egy szerver kvótáját annak [beállításaiban](/docs/servers/#server-settings) állíthatod be. A **Szerver leállítása kvóta túllépése esetén** opció bekapcsolása ott leállítja a futó szervert is, ha a mappája több mint 10%-kal nőtt a kvóta fölé, és ezt jelzi a szerver előzményeiben. A modokkal ellátott szerverek nagyok lehetnek, ezért adj nekik elegendő helyet. A [biztonsági mentések](/docs/backups/) külön tárolódnak, és nem számítanak bele a kvótába.

## Tisztítás

A **Kattintással történő tisztítás** kártya felszabadítja a panel által biztonságosan visszanyerhető helyet: egy óránál régebbi ideiglenes fájlok, elárvult könyvtári fájlok, és 30 napnál régebbi archivált naplók és összeomlási jelentések. Mindegyik megmutatja, mennyi helyet szabadít fel, és előnézetet nyit, mielőtt bármi törlésre kerülne. A **Kategória szerint** és a **Legnagyobb fájlok** listák közvetlenül a fájlkezelőbe mutatnak, így megtalálhatod, mit lehet még eltávolítani, mielőtt elfogyna a hely.

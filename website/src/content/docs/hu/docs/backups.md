---
title: 'Biztonsági mentések'
description: 'A Biztonsági mentések oldal az összes pillanatfelvételt mutatja a teljes flottában, mérettel, okkal és korszakkal.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Biztonsági mentések** oldal minden pillanatfelvételt megjelenít a teljes flottából, mérettel, okkal és korszakkal.

![Biztonsági mentések](/docs/images/backups.png)

## Biztonsági mentés létrehozása

Egy szerver **Biztonsági mentések** lapjáról (vagy egy [ütemezés](/docs/schedules/) keresztül) egyetlen kattintással pillanatfelvételt készíthet a teljes szerverkönyvtárról. A panel először "lecsendesíti" a világot (`save-off` → `save-all`), tömöríti az adatokat, majd újra engedélyezi a mentést (`save-on`), így a biztonsági mentések konzisztensek még futó szerver esetén is. A tömörítés egy háttérszálon fut, így nem akasztja meg a panelt. Minden biztonsági mentéshez megjegyzés fűzhető.

Minden archívum **integritása ellenőrzésre kerül** abban a pillanatban, amikor íródik: a panel újra megnyitja a zip fájlt és elolvassa a tartalomjegyzékét. Egy sérült vagy megnyithatatlan archívum törlődik, és a biztonsági mentési kérés azonnal meghiúsul, ahelyett, hogy a probléma hónapokkal később derülne ki, amikor a visszaállítás az egyetlen dolog, ami elválasztja Önt az adatvesztéstől. Egy nulla bejegyzésű archívum (egy soha el nem indított szerver) megengedett, de a naplóban jelölve lesz.

Jelölje be a **"A világ zsugorítása utána"** opciót (a Biztonsági mentések lapon vagy egy biztonsági mentési ütemezésben) a ritkán látogatott chunkok eltávolításához, miután az archívum biztonságosan meg lett írva (lásd: **[Világ zsugorítása](/docs/world-shrink/)**). A zsugorítás csak akkor fut, amikor a szerver le van állítva; futó szerver esetén a biztonsági mentés megtörténik, de a zsugorítás kimarad.

![Szerver biztonsági mentések](/docs/images/server-backups.png)

## A biztonsági mentések okai

A biztonsági mentések címkézve vannak, hogy miért készültek:

- **manuális** - Ön kattintott a gombra.
- **ütemezett** - egy [ütemezés](/docs/schedules/) hozta létre. Minden új szerver automatikusan kap egy napi ütemezett biztonsági mentést is (02:00 és 05:59 között elosztva), így egy szerver már az első naptól kezdve automatikus védelmet élvez, nem csak frissítések előtt.
- **frissítés előtt** - automatikusan készül egy csomagfrissítés előtt, így egy frissítés mindig visszafordítható.
- **visszaállítás előtt** - automatikusan készül közvetlenül egy visszaállítás vagy világ-visszaállítás előtt, mint egy biztonsági háló, arra az esetre, ha a visszaállítás nem az, amit szeretett volna.

## Megőrzés

A megőrzés **szerverenként, okonként** van korlátozva: az újabbak minden csoportban megmaradnak, a régebbiek automatikusan törlődnek minden sikeres biztonsági mentés után:

| Ok                  | Megtartva |
| ------------------- | --------- |
| ütemezett           | 10        |
| frissítés előtt     | 10        |
| manuális            | 20        |
| visszaállítás előtt | 5         |

A `visszaállítás előtt` külön kis tárolóval rendelkezik pontosan azért, hogy egy automatikus biztonsági mentés soha ne törölhesse ki az Ön által szándékosan megőrzött `manuális` biztonsági mentést.

Két opcionális felső korlát is érvényesül a per-ok számokon felül, mindkettő alapértelmezetten ki van kapcsolva: egy **maximális kor** (az N napnál régebbi biztonsági mentések törlődnek, okuktól függetlenül) és egy **maximális teljes méret** szerverenként (a legrégebbi biztonsági mentések törlődnek, amíg a teljes méret bele nem fér, először a `visszaállítás előtt` mentések). Egy szerver legújabb biztonsági mentése soha nem törlődik egyik korlát által sem. Mindezek globálisan módosíthatók a Beállítások oldalon, és szerverenként felülírhatók annak Biztonsági mentések lapján.

A biztonsági mentések **átnevezhetők** a biztonsági mentési listából (az átnevezés gomb minden soron). Az archívum a lemezen és a panel nyilvántartása együtt mozog, így a letöltés, visszaállítás és megőrzés továbbra is működik az új névvel.

![Biztonsági mentés átnevezése](/docs/images/backup-rename.png)

> A megőrzés automatikusan korlátozott, de a nagy, moddolt archívumok továbbra is beleszámítanak egy szerver [lemez kvótájába](/docs/storage/), ezért tartsa szemmel a teljes méretet a nagy csomagoknál.

## Visszaállítás

Egy biztonsági mentés visszaállítása leállítja a szervert (ellenőrzi, hogy a konténer valóban leállt-e, mielőtt bármilyen fájlhoz érne), készít egy `visszaállítás előtt` biztonsági mentést, kicseréli a **teljes szerverkönyvtárat** a pillanatfelvétellel, és leállítva hagyja, hogy Ön újraindíthassa. Mivel a csomagfrissítések mindig először készítenek `frissítés előtt` biztonsági mentést, mindig vissza tudja állítani egy rossz frissítést.

## A panel saját adatbázisa

A szerver biztonsági mentései csak a szerverenkénti világkönyvtárakat fedik le. A panel saját adatbázisa (`panel.db`, amely felhasználókat, szerepköröket, 2FA titkos kulcsokat, ütemezéseket, csomag rögzítéseket és előzményeket tárol) külön kerül pillanatfelvételre a napi karbantartási időzítő során:

- A `VACUUM INTO` parancs egy konzisztens, töredezettségmentesített másolatot ír a `data/backups/_panel/` könyvtárba; a legújabb **14** kerül megőrzésre.
- Indításkor a panel futtatja a `PRAGMA integrity_check` parancsot, és hangosan naplóz, ha az meghiúsul, rámutatva a `data/backups/_panel` könyvtárban található legújabb jó másolatra.

Készítsen biztonsági mentést a teljes `data/` fáról (ez tartalmazza a `.secret-key` fájlt is, az adattitkosítás kulcsát), és ezzel biztonsági mentést készített mindenről.

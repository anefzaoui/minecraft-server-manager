---
title: 'Biztonsági mentések'
description: 'A Biztonsági mentések oldal az összes pillanatképét mutatja a teljes flottában, mérettel, okkal és korszakkal, kiszolgálónként és okonként szűrhetően.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/backups.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Biztonsági mentések** oldal minden pillanatfelvételt megjelenít a teljes flottában, mérettel, okkal és korszakkal, kiszolgálónként és okonként szűrhetően.

![Biztonsági mentések](/docs/images/backups.png)

## Biztonsági mentés létrehozása

Egy kiszolgáló **Biztonsági mentések** lapjáról (vagy egy [ütemezés](/docs/schedules/) keresztül) egyetlen kattintással pillanatfelvételt készíthet a teljes kiszolgálói könyvtárról. A panel először "lecsendesíti" a világot (`save-off` → `save-all`), tömöríti az adatokat, majd újra engedélyezi a mentést (`save-on`), így a biztonsági mentések konzisztensek, még futó kiszolgáló esetén is. A tömörítés egy háttérszálon fut, így nem akasztja meg a panelt. Az API-n keresztül indított biztonsági mentéshez megjegyzés fűzhető.

Minden archívum **integritás-ellenőrzésen** esik át íráskor: a panel újra megnyitja a zip fájlt és elolvassa a tartalmát. Egy sérült vagy megnyithatatlan archívum törlődik, és a biztonsági mentési kérés azonnal meghiúsul, ahelyett, hogy a probléma hónapokkal később derülne ki, amikor a visszaállítás az egyetlen dolog, ami elválaszt a adatvesztéstől. Egy nulla bejegyzésű archívum (egy soha el nem indított kiszolgáló) megengedett, de a rendszer naplózza az eseményt.

Jelölje be a **"A világ zsugorítása utána"** opciót (a Biztonsági mentések lapon vagy egy biztonsági mentési ütemezésben) a ritkán látogatott chunkok eltávolításához, miután az archívum biztonságosan megírásra került (lásd: **[Világ zsugorítása](/docs/world-shrink/)**). A zsugorítás csak akkor fut, ha a kiszolgáló leállt; futó kiszolgáló esetén a biztonsági mentés továbbra is megtörténik, és a zsugorítás kimarad.

![Kiszolgáló biztonsági mentései](/docs/images/server-backups.png)

## Biztonsági mentési okok

A biztonsági mentések címkézve vannak, hogy miért készültek:

- **kézi**: Ön rákattintott a **Most biztonsági mentés** gombra. Egy kiszolgáló aktív világának egy könyvtárból származóval való felcserélése szintén először egy `kézi` biztonsági mentést készít.
- **ütemezett**: egy [ütemezés](/docs/schedules/) által létrehozva. Minden új kiszolgáló automatikusan kap egy napi ütemezett biztonsági mentést is (02:00 és 05:59 között elosztva), így egy kiszolgáló már az első naptól kezdve automatikus védelemmel rendelkezik, nem csak frissítések előtt.
- **frissítés előtt**: automatikusan készül csomagfrissítés vagy Minecraft verzióváltás előtt, így egy frissítés mindig visszafordítható.
- **visszaállítás előtt**: automatikusan készül közvetlenül egy visszaállítás vagy világ-visszaállítás előtt, mint egy biztonsági háló, arra az esetre, ha a visszaállítás nem az, amit szeretett volna.

## Megőrzés

A megőrzés **kiszolgálónként, okonként** van korlátozva: az újabbak az egyes csoportokban maradnak, a régebbiek automatikusan törlődnek minden sikeres biztonsági mentés után:

| Ok                  | Alapértelmezetten megőrizve |
| ------------------- | --------------------------- |
| ütemezett           | 10                          |
| frissítés előtt     | 10                          |
| kézi                | 20                          |
| visszaállítás előtt | 5                           |

A `visszaállítás előtt` (a panelen biztonsági mentéseknek nevezve) saját kis "ládával" rendelkezik, pontosan azért, hogy egy automatikus biztonsági mentés soha ne törölhesse ki egy Ön által szándékosan megőrzött `kézi` biztonsági mentést.

Két opcionális felső korlát is érvényesül az okonkénti számokon felül, mindkettő alapértelmezetten ki van kapcsolva: egy **maximális kor** (az N napnál régebbi biztonsági mentések törlődnek, okuktól függetlenül) és egy **maximális teljes méret** kiszolgálónként (a legrégebbiek törlődnek, amíg a teljes méret belefér: először a biztonsági mentések, majd az ütemezettek, majd a többi). Egy kiszolgáló legújabb biztonsági mentése soha nem törlődik egyik korlát által sem.

### Módosítás

Az adminisztrátorok a panel-szintű szabályzatot a **Beállítások** oldal **Biztonsági mentési megőrzés** kártyáján állíthatják be (**Beépítettek kitöltése** gomb az alapértelmezett értékeket betölti az űrlapba, mentésre készen). Egy kiszolgáló eltérhet bármelyik hat értékben: nyissa meg a **Biztonsági mentések** lapját és bontsa ki a **Megőrzés ehhez a kiszolgálóhoz** részt. Minden mező ott üres, kivéve, ha az adott kiszolgáló beállította azt, és az üres mező a panel-szintű értéket követi (az jelenik meg benne). Tehát egy kiszolgáló például megtarthat 3 ütemezett biztonsági mentést, és minden máshoz a panel-szintű értékeket használhatja; egy mező törlése visszaállítja a panel-szintű értékre.

![A Biztonsági mentési megőrzés kártya a Beállításokban](/docs/images/settings-retention.png)

![Megőrzés ehhez a kiszolgálóhoz egy kiszolgáló Biztonsági mentések lapján](/docs/images/server-retention.png)

A mentés önmagában soha nem töröl semmit. Ha az új korlátok miatt a meglévő biztonsági mentések túllépnék a határt, a panel kiszolgálónként felsorolja, hogy minden típusú biztonsági mentésből hány kerülne törlésre, mennyi hely szabadulna fel, és a legrégebbi hány napos. Azt is jelzi, ha egy kiszolgáló már korábban is túllépte a korlátait (például egy korábbi **Következő biztonsági mentéstől** után), mivel az azonnali alkalmazás mindent töröl a korlát felett, nem csak azt, amit ez az editálás hozzáad. Majd megkérdezi, hogyan kell alkalmazni őket:

- **Most törlés** pontosan azokat a biztonsági mentéseket törli, amelyeket éppen felsorolt, semmi többet: egy közben készült biztonsági mentés a következő törlésre vár. A Beállítások oldalról egy helyreállítás, biztonsági mentés vagy hasonló művelet közepén lévő kiszolgáló ki lesz hagyva, és a következő biztonsági mentése után töröl; egy kiszolgáló saját Biztonsági mentések lapján arra kéri, hogy próbálja újra, miután az a művelet befejeződött. Miközben egy kiszolgáló régi biztonsági mentései törlődnek (általában másodpercek), más műveleteknek várniuk kell: egy ütemezett biztonsági mentés vagy indítás, amely akkor esik, újra próbálkozik minden percben (legfeljebb 30 percig), egy összeomlott kiszolgáló újraindul annak befejezése után kb. 20 másodperccel (legfeljebb 30 percig), és egy ütemezett újraindítás vagy leállítás, amely ütközik vele, kimarad a következő időpontjáig.
- **Következő biztonsági mentéstől** egyelőre megőrzi őket; minden kiszolgáló a következő biztonsági mentés elkészítésekor törli a biztonsági mentéseit, ahogy mindig is tette.

![A párbeszédablak, amely felsorolja, mit törölnének az új korlátok](/docs/images/retention-preview.png)

Egy visszaállítás alatt álló biztonsági mentés soha nem kerül törlésre, amíg a visszaállítás fut: a megőrzés figyelmen kívül hagyja (és nem töröl más biztonsági mentéseket, hogy helyet csináljon neki), és kézi törlése megtagadva, amíg a visszaállítás be nem fejeződik.

Ugyanazok a beállítások elérhetők szkriptek számára is, mint admin API végpontok: `GET`/`POST /api/backups/retention` és `/api/servers/:id/backups/retention`. A panel-szintű értékek nem lehetnek `null`. Egy kiszolgáló esetében a `null` (vagy `""`) érték eltávolítja azt az egy kulcsot, így az ismét a panel-szintű értéket követi, és a `{ "reset": true }` eltávolítja az összeset. Mindkét útvonal alatt a `POST …/preview` jelentést készít arról, mit törölne egy módosítás anélkül, hogy törölné azt (`backups`, `bytes`, `servers`, `ids` és kiszolgálónkénti `byServer` bontás), és a `POST …/apply` most alkalmazza a mentett szabályzatot, és válaszol `{ deleted, skipped }` panel-szinten (`skipped` elfoglalt kiszolgálókat számol) vagy `{ deleted }` egy kiszolgálóra. Küldje el az előnézet `{ "token": "..." }` (10 percig megőrizve) vagy a `{ "ids": [...] }` értékét csak azok törléséhez; egyik nélkül minden, ami a korlát felett van, törlődik. Egy kiszolgálón végzett alkalmazás egy elfoglalt kiszolgálón 409-et válaszol.

A biztonsági mentések **átnevezhetők** a biztonsági mentési listából (az átnevezés gomb minden sorban). A lemezen lévő archívum és a panel nyilvántartása együtt mozog, így a letöltés, visszaállítás és megőrzés továbbra is működik az új névvel.

![Biztonsági mentés átnevezése](/docs/images/backup-rename.png)

> A megőrzés automatikusan korlátozott, de a nagy, moddolással ellátott archívumok továbbra is beleszámítanak egy kiszolgáló [lemezkvótájába](/docs/storage/), ezért figyeljen a teljes méretre a nagy csomagoknál.

## Visszaállítás

Egy biztonsági mentés visszaállítása leállítja a kiszolgálót (ellenőrzi, hogy a konténer valóban leállt-e, mielőtt bármilyen fájlhoz érne), készít egy `visszaállítás előtt` biztonsági mentést, kicseréli a **teljes kiszolgálói könyvtárat** a pillanatfelvétellel, és leállítva hagyja, hogy Ön újraindítsa. Az archívum először oldalra kerül kibontásra, és csak akkor kerül beillesztésre, ha teljesen kibontódott, így egy részlegesen meghiúsult visszaállítás az aktuális fájlokat érintetlenül hagyja. Mivel a csomagfrissítések mindig először egy `frissítés előtt` biztonsági mentést készítenek, mindig vissza tudja fordítani egy rossz frissítést.

## A panel saját adatbázisa

A kiszolgálói biztonsági mentések csak az egyes kiszolgálók saját mappáját fedik le. A panel saját adatbázisa (`panel.db`, amely felhasználókat, szerepköröket, 2FA titkos kulcsokat, ütemezéseket, csomagcsapokat és előzményeket tárol) külön készül pillanatfelvételként a napi karbantartási időzítő során:

- `VACUUM INTO` egy konzisztens, töredezettségmentesített másolatot ír a `backups/_panel/` könyvtárba az adatok mappájában; a legújabb **14** kerül megőrzésre.
- Indításkor a panel futtatja a `PRAGMA integrity_check` parancsot, és hangosan naplóz, ha az meghiúsul, a legújabb jó másolatra mutatva a `backups/_panel` könyvtárban.

Az egész adatok mappát (amely tartalmazza a `.secret-key` fájlt is, az adattitkosítás kulcsát) biztonsági mentve mindent biztonsági mentett.

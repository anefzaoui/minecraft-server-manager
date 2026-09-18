---
title: 'Világ méretének csökkentése'
description: 'Idővel egy világ terjeszkedik: minden hely, ahol egy játékos valaha is járt, repült, vagy'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/world-shrink.md'
---

[← Vissza a dokumentumokhoz](/docs/)

Idővel egy világ terjeszkedik: minden hely, ahol egy játékos valaha is járt, repült, vagy
ender gyönggyel szállították, generált darabokat hagy a lemezen, még akkor is, ha senki sem
ment vissza. A **Világ zsugorítása** eltávolítja azokat a darabokat, amelyekben szinte senki sem
töltött időt, így a világ kevesebb helyet foglal. A Minecraft egy eltávolított területet újjáépít a
világ seedjéből abban a pillanatban, amikor valaki újra odautazik, így ez biztonságos
az olyan földekre, amelyeket senki sem használ, de bármi, amit egy játékos _épített_ egy olyan helyen, ahol alig állt meg,
az is eltűnne, ezért először készíts biztonsági másolatot (a biztonsági másolat az
visszavonás).

## Mi számít "ritkán látogatottnak"

Minden darab rögzíti, mennyi időt töltöttek a játékosok benne (a Minecraft ezt
`InhabitedTime`-nak hívja). A Világ zsugorítása eltávolítja az összes darabot **30 másodperc**
alatti teljes játékidővel alapértelmezetten; a zsugorítás párbeszédablak lehetővé teszi a küszöbérték
(1 másodperctől 1 óráig) és a spawn körül megtartandó darabok számának módosítását (alapértelmezetten 8,
`0` kikapcsolja a spawn védelmet).

Mi marad meg, mindig:

- A világ **spawn pontja** körüli terület (olvasva a `level.dat`-ból) az
  overworldben. A Nether, az End és az egyéni dimenziók nem rendelkeznek spawn területtel.
- Bármely darab, amelynek látogatási idejét nem lehetett olvasni, például egy mentett világ
  egy olyan tömörítési formátummal, amelyet a panel nem tud dekódolni (LZ4). Az előnézet és az
  eredmény megmondja, hány ilyen darabot hagytunk ki.

A világ minden dimenziója érintett: a Bukkit-stílusú testvér mappák
(`world_nether`, `world_the_end`), valamint a vanilla és a Forge/Fabric
elrendezés (`world/DIM-1`, `world/DIM1`, `world/dimensions/<namespace>/<name>`).
Amikor egy darab eltávolításra kerül, az entitásai és a falusi érdekességei vele együtt mennek,
így egy regenerált darab nem örököl elavult mobokat, csilléket vagy munkahelyeket.

## A Világok lapról történő végrehajtás

1. Készíts biztonsági másolatot a **Biztonsági mentések** lapon. A Világok lapról történő zsugorítás nem készít automatikusan biztonsági másolatot.
2. Nyissa meg a **Világ → Világok** lapot, keresse meg a világot, és kattintson a zsugorítás ikonra.
3. Kattintson az **Előnézet** gombra, hogy nagyjából lássa, hány darab (és hány megabájt)
   kerülne eltávolításra. Még semmi sem változott; az előnézet futó szerver mellett is működik.
4. Kattintson a **Világ zsugorítása** gombra. A zsugorítás közvetlenül a világfájlokat szerkeszti, ezért a
   szervert le kell állítani: vagy állítsa le először, vagy pipálja be az opciót a leállításához,
   zsugorításához és újraindításához egy lépésben (a szerver akkor is újraindul, ha
   a zsugorítás sikertelen). A folyamat a feladatkezelőben látható.

![Világ zsugorítása](/docs/images/world-shrink.png)

## Biztonsági mentés részeként történő végrehajtás

A **Biztonsági mentések** lapon pipálja be a **"Világ zsugorítása utána"** opciót a
**Mentés most** gomb előtt. A biztonsági mentési archívum íródik először (ez az archívum az Ön
visszavonása), majd a világ zsugorodik, de csak akkor, ha a szerver leállt. Ha a
szerver fut, a biztonsági mentés akkor is fut, és a zsugorítás kihagyásra kerül egy megjegyzéssel.

Az ütemezett biztonsági mentések ugyanazt az opciót kínálják: az ütemezés szerkesztőjében válassza a
**Biztonsági mentés** feladatot, és pipálja be a **"Világ zsugorítása minden biztonsági mentés után"** opciót. Párosítsa ezt egy
**Szerver leállítása** ütemezéssel néhány perccel korábban, ha azt szeretné, hogy felügyelet nélkül fusson.

---
title: 'Konzol és csevegési parancsok'
description: 'A Konzol lap valós időben streameli a szervernaplót, és rendelkezik egy parancssori mezővel, amellyel bármilyen szerverparancsot elküldhet.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Vissza a dokumentumokhoz](/docs/)

## Az élő konzol

A **Konzol** lap valós időben streameli a szervernaplót, és rendelkezik egy parancssori résszel, ahonnan bármilyen szerverparancsot küldhetsz. Nincs szükség `docker exec`-re, nincs SSH. A kimenet beágyazva érkezik vissza, színekkel és minden mással együtt.

![Konzol](/docs/images/server-console.png)

A konzol az a hely is, ahol a panel leolvassa a szerver állapotát: figyeli a naplót a rendszerindítási fázis osztályozásához ("Modok betöltése", "Világ generálása", "Indítás befejezése"), és meghívja a `list` parancsot a bejelentkezett játékosok nyomon követésére, így az irányítópult és a szerverkártyák mindig a valóságot tükrözik.

Ez az ellenőrzés minden ciklusban egy rövid életű RCON kapcsolatot nyit, amelyet a szerver naplózza egy `Thread RCON Client … started` / `shutting down` párként minden ~20 másodpercben, és (azoknál a szervereknél, amelyek magja vagy bővítményei ezt visszhangozzák) egy `Rcon issued server command: …` sorral minden csak olvasható ellenőrzéshez – `list` a játékosok számához, plusz `time query …` és `gamerule <name>` olvasások, amíg a Világkezelés oldal nyitva van. A napló feletti **RCON zaj elrejtése** kapcsoló kiszűri ezeket a sorokat (valamint az RCON figyelő indító sorait). Alapértelémezésben be van kapcsolva, és böngészőnként meg van jegyezve; kapcsold ki, hogy lásd a nyers adatfolyamot.

A panelről küldött parancsok a játékon belül, szerverenkénti címkével jelenhetnek meg, így a játékosok tudják, hogy egy operátor cselekedett, nem pedig egy rejtélyes konzol.

## Csevegési parancsok

A csevegési parancsok lehetővé teszik a játékosok számára, hogy panel műveleteket indítsanak el egy előtaggal ellátott parancs beírásával a játékon belüli csevegésben, például `!spawn` a véletlenszerű teleportáláshoz. Az észlelés naplóalapú, és a végrehajtás a szerveren keresztül történik, így **nincs szükség modokra**.

![Csevegési parancsok](/docs/images/chat-commands.png)

Minden parancsnak van:

- Egy **kiváltója** (pl. `spawn`) és egy **előtagja** (`!` alapértelmezetten).
- Egy **művelet**: véletlenszerű teleportálás, teleportálás egy struktúrához, teleportálás egy biomhoz, vagy nyers konzolparancsok futtatása.
- Egy **engedélyezési szint**: mindenki, a fehérlistán szereplő játékosok, vagy csak az operátorok.
- Egy **hűtési idő**, és testreszabható függőben lévő / sikeres / sikertelen üzenetek olyan helyőrzőkkel, mint a `{distance}`.

### Megjegyzés a biztonságról

Azokat a parancsokat, amelyek tönkretehetik a szervert (`stop`, `op`, `ban`, `whitelist` és hasonlókat), csak **csak operátoroknak szóló** kiváltókkal lehet engedélyezni. A panel még akkor is ellenőrzi ezeket, ha egy `execute … run …` láncba vannak ágyazva, így egy alacsony engedélyezési szintű kiváltó nem tud átcsempészni egy veszélyes parancsot. Az egyszerű csevegési szöveg, amely csupán megemlíti ezeket a szavakat (mint egy `say` üzenet), érintetlenül marad.

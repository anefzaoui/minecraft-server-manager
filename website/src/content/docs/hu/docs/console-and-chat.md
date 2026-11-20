---
title: 'Konzol és csevegési parancsok'
description: 'A Konzol lap valós időben streameli a szervernaplót, és rendelkezik egy parancssori mezővel, amellyel bármilyen szerverparancsot elküldhet.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/console-and-chat.md'
---

[← Vissza a dokumentumokhoz](/docs/)

## Az élő konzol

A **Konzol** lap valós időben streameli a szervernaplót, és rendelkezik egy parancssori résszel, ahová bármilyen szerverparancsot beírhat. Nincs szükség `docker exec`-re, nincs SSH. A kimenet beágyazva jelenik meg, színekkel és minden mással együtt. Parancsok küldéséhez a szerveren a Konzol engedély szükséges; enélkül továbbra is figyelheti a naplót.

A napló felett szűrheti a sorokat szöveg (vagy `/regex/`) és szint (INFO, WARN, ERROR) alapján, a **Letöltés** pedig a legutóbbi kimenetet, a teljes `latest.log`-ot, vagy minden naplófájlt zip-ként kínál fel.

![Konzol](/docs/images/server-console.png)

A konzol az a hely is, ahol a panel leolvassa a szerver állapotát: figyeli a naplót a rendszerindítási fázis osztályozásához ("Loading mods", "Generating world", "Finishing startup"), és meghívja a `list` parancsot az online felhasználók nyomon követésére, így az irányítópult és a szerverkártyák mindig a valóságot tükrözik.

Ez az ellenőrzés minden ciklusban egy rövid életű RCON kapcsolatot nyit meg, amelyet a szerver naplózza egy `Thread RCON Client … started` / `shutting down` párként ~20 másodpercenként, és (azokon a szervereken, amelyek magja vagy bővítményei ezt visszhangozzák) egy `Rcon issued server command: …` sor minden csak olvasható ellenőrzéshez (`list` a játékosok számához, valamint `time query …` és `gamerule <name>` olvasások, amíg a World Controls meg van nyitva). A napló feletti **Konzol zaj elrejtése** kapcsoló kiszűri ezeket a sorokat (valamint az RCON figyelő indító sorait). Alapértelmezetten be van kapcsolva, és böngerőnként megjegyzi; kapcsolja ki a nyers stream megtekintéséhez.

A panelről küldött parancsok a játékon belül is bejelenthetők szerverenkénti címkével (a **Bejelentés mint…** mező), így a játékosok tudják, hogy egy operátor cselekedett, nem pedig egy rejtélyes konzol.

## Csevegés

A **Konzol → Csevegés** üzeneteket küld a játékba, amíg a szerver fut: a **Formázott** üzenetek színeket és formázást kapnak, és mehetnek mindenkinek vagy egy online játékosnak, a **Sima** pedig egy egyszerű `[Server]` broadcastot küld mindenkinek.

![Konzol → Csevegés](/docs/screenshots/04-chat.png)

## Csevegési parancsok

A csevegési parancsok (**Konzol → Parancsok**) lehetővé teszik a játékosok számára, hogy panelműveleteket indítsanak el egy előtaggal ellátott parancs beírásával a játékon belüli csevegésben, például `!spawn` a véletlenszerű teleportáláshoz. Az észlelés naplóalapú, és a végrehajtás a szerveren keresztül történik, így **nincs szükség modokra**.

![Csevegési parancsok](/docs/images/chat-commands.png)

Minden parancsnak van:

- Egy **kiváltója** (pl. `spawn`), amelyet a szerver **előtagja** (`!` alapértelmezetten, egy vagy két karakter, soha nem `/`) után írnak be.
- Egy **művelet**: véletlenszerű teleportálás, teleportálás egy épülethez, teleportálás egy biomhoz, vagy nyers konzolparancsok futtatása.
- Egy **engedélyszint**: mindenki, a fehérlistán szereplő játékosok, vagy csak az operátorok.
- Játékosonkénti **hűtési idő** (alapértelmezetten 30 másodperc), és testreszabható függőben lévő / sikeres / sikertelen üzenetek olyan helyőrzőkkel, mint a `{distance}`.

### Megjegyzés a biztonságról

Azokat a parancsokat, amelyek tönkretehetik a szervert (`stop`, `op`, `ban`, `whitelist` és hasonlókat), csak **csak operátoroknak** szóló kiváltókkal lehet engedélyezni. A panel ezeket akkor is ellenőrzi, ha egy `execute … run …` láncba vannak ágyazva, így egy alacsony jogosultságú kiváltó nem tud átcsempészni egy veszélyes parancsot. Az olyan hétköznapi csevegési szövegek, amelyek csak megemlítik ezeket a szavakat (mint egy `say` üzenet), érintetlenül maradnak.

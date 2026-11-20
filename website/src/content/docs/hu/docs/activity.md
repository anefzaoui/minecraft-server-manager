---
title: 'Tevékenységnapló'
description: 'A Tevékenység oldal a teljes audit trail: minden, ami a panelben történt, kereshető, kronologikus nyilvántartása.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/activity.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Napló** oldal a teljes audit trail: egy kereshető, időrendi nyilvántartás mindenről, ami a panelen történt. Szűrd szerver vagy eseménytípus szerint, keress az összefoglalókban, és exportáld a szűrt elemeket CSV vagy JSON formátumban. Azok a bejegyzések, amelyek naplót rögzítettek (például egy összeomlás), helyben megnyitják azt.

![Napló](/docs/images/activity.png)

## Mi kerül rögzítésre

- **Hitelesítés**: bejelentkezések (beleértve, hogy használtak-e kétfaktoros hitelesítést vagy biztonsági kódot), fiókzárolások, jelszócserék, valamint a kétfaktoros hitelesítés engedélyezése, letiltása vagy visszaállítása.
- **Szerver életciklus**: létrehozások, indítások, leállítások, újraindítások, összeomlások, automatikus újraindítások és memóriahiány események.
- **Riasztások**: akadozó indulások, leállítási hibák, sikertelen ütemezések, kvóták miatti leállítások, nem egészséges konténerek, újraindítás után offline állapot.
- **Adatok**: létrehozott és visszaállított biztonsági mentések, exportált blueprintok, telepített és frissített csomagok, módosítások és világváltozások, valamint fájlok szerkesztése.
- **Játékosok**: kirúgások, bannolások, fehérlista és op változások, valamint játékosjegyzetek.
- **Konfiguráció**: csevegési parancsok változásai, felhasználói és szerepkör változások, szerver specifikus engedélyek változásai, játékkapcsolatok változásai, és beállítások szerkesztése.

Minden bejegyzés rögzíti, ki tette (felhasználónév, vagy a panel/ütemező automatizált műveletek esetén), melyik szerverhez kapcsolódik, és mikor. A [Vezérlőpult](/docs/dashboard/) mutatja a legfrissebb bejegyzéseket; ez az oldal a teljes előzmény. Az operátorok és a megtekintők csak az általuk megtekinthető szerverekre vonatkozó bejegyzéseket látják (plusz a panelre vonatkozókat), és a szerver specifikus engedélyváltozásokat csak az adminisztrátorok láthatják. Az életciklus és a riasztási események továbbíthatók a Discordra is (lásd [Integrációk](/docs/integrations/)).

Mivel biztonsági szempontból releváns eseményeket rögzít (bejelentkezések, kétfaktoros hitelesítés változásai, szerepkör- és engedélyváltozások), a napló az elsődleges hely, ahová fordulni érdemes, ha valami gyanús történik egy fiókkal kapcsolatban.

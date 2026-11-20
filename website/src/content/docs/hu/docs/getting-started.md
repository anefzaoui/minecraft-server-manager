---
title: 'Első lépések'
description: 'Telepítse a Minecraft Server Managert, és fejezze be az első indítási beállításokat: rendszerellenőrzés, időzóna és rendszergazdai fiók.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Vissza a dokumentumokhoz](/docs/)

## Első lépések

Amikor először megnyitod a panelt, egy rövid beállítási varázsló vezet végig rajta:

1.  **Rendszerellenőrzés**: Biztosítja, hogy a Docker elérhető, a Node.js elég új, és az adatok mappája írható. Ha a Docker még nem fut, akkor is folytathatod; a szerverek létrehozása és indítása addig vár, amíg az el nem indul.
2.  **Rendszergazdai fiók létrehozása**: Ez az egyetlen fiók, amely létezik, amíg nem adsz hozzá többet, és teljes irányítással rendelkezik. Válassz egy felhasználónevet (2–32 karakter) és egy legalább 8 karakteres jelszót. A létrehozás után azonnal bejelentkezel.
3.  **Panelkonfiguráció** (opcionális): egy nyilvános tartomány, amelyet a játékosoknak megjeleníthetsz a csatlakozási címeken, egy CurseForge API kulcs, és az időzónád. Mindez később módosítható a **Beállítások** menüpontban.

Az utolsó lépés a **Szerver létrehozása** vagy az **Irányítópultra ugrás** lehetőséget kínálja.

![Az első lépések rendszerellenőrzési lépése](/docs/images/setup-system-check.png)

> **A nyilvánosan elérhető telepítések PIN-kóddal védettek.** Ha a panelt nem csak a loopback címen (`PANEL_HOST` a `127.0.0.1`-től eltérő értéken) indítod el, a beállítási oldal egy **6 számjegyű PIN-kódot** is kér. A panel a panel indulásakor a konzolra írja ki. Írd be a felhasználóneveddel és a jelszavaddal együtt. Ez megakadályozza, hogy egy idegen, aki elsőként éri el a portot, megszerezze a rendszergazdai fiókot. A PIN eltűnik, amint a rendszergazdai fiók létrejön.

## Bejelentkezés

A beállítás után a panel egy bejelentkezési képernyővel védett. Írd be a felhasználónevedet és a jelszavadat a folytatáshoz.

![Bejelentkezés](/docs/images/login.png)

Ha a [kétfaktoros hitelesítés](/docs/two-factor-authentication/) engedélyezve van a fiókodon, a jelszavad után azonnal meg kell adnod egy 6 számjegyű kódot az hitelesítő alkalmazásodból.

## Navigáció

Minden a bal oldali sávból indul:

- **Irányítópult**: Minden szerver áttekintése ([részletek](/docs/dashboard/)).
- **Szerverek**, **Modpackok**, **Világok**, **Blueprintok**: szerverek és tartalmuk létrehozása és kezelése.
- **Frissítések**, **Biztonsági mentések**, **Ütemezések**, **Tárhely**, **Tevékenység**: az üzemeltetési oldal: mi az, ami elavult, a pillanatfelvételeid, az automatizálás, a lemezhasználat és az audit napló.
- **Engedélyek** (alul, csak rendszergazdáknak): mit tehet minden felhasználó minden szerveren ([részletek](/docs/users-and-roles/#per-server-permissions)).
- **Beállítások** (alul, csak rendszergazdáknak): API kulcsok, panelkonfiguráció, alapértékek az új szerverekhez, [biztonsági mentési megőrzés](/docs/backups/#retention), felhasználók, bejelentkezési biztonság és a nyilvános API.

Ezek alatt a sáv felsorolja a szervereidet. Egy szerver kiválasztása megjeleníti annak saját lapjait: **Áttekintés**, **Konzol**, **Játékosok**, **Modok**, **Világ**, **Biztonsági mentések**, **Figyelés** és **Beállítások**, legtöbbjük kapcsolódó al-lapokkal (például a **Beállítások → Konfiguráció** tartalmazza a szerver beállításait és a játékkapcsolatát). Lásd: [Egyetlen szerver](/docs/servers/#a-single-server).

A felső sáv tartalmazza a **Szerver létrehozása** gombot, egy **témaváltót** (sötét/világos), és a **fiókmenüt**, ahol módosíthatod a profilképedet, kezelheted a [kétfaktoros hitelesítést](/docs/two-factor-authentication/) vagy kijelentkezhetsz.

## Telefonon vagy táblagépen

Minden oldal először keskeny képernyőre van tervezve, és onnan szélesedik: a bal oldali sáv a menü gomb mögé rejtőzik, az adat táblázatok kártyákká alakulnak, az eszköztárak áttekerednek, és a világvezérlő sín egy kártyává csukódik össze, amelyet akkor nyitsz meg, amikor szükséged van rá. A gombok és a chipek valós érintési célmérettel rendelkeznek. Semmi sem csak asztali számítógépen használható.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Irányítópult telefonon" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Szerver áttekintés telefonon" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konzol telefonon" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Modok lap telefonon" width="180">
  <img src="/docs/images/mobile/server-versions.png" alt="Verzió kompatibilitás telefonon" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Beállítások telefonon" width="180">
</p>

## Amire szükséged van

A panel a Dockerrel kommunikál a szerverek futtatásához, ezért hozzáférésre van szüksége egy Docker daemonhoz (Docker Desktop vagy egy Docker Engine socket). Amikor a Docker elérhető, az irányítópult Docker csempéje **Csatlakoztatva** feliratot és annak verzióját mutatja. Ha nem, a panel továbbra is fut. Csak akkor indíthatsz szervereket, ha a daemon elindult.

## Következő lépések

- [Hozd létre az első szerveredet →](/docs/servers/)
- [Biztosítsd a fiókodat 2FA-val →](/docs/two-factor-authentication/)

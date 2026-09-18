---
title: 'Első lépések'
description: 'Amikor először megnyitja a panelt, létre kell hoznia egy rendszergazdai fiókot.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/getting-started.md'
---

[← Vissza a dokumentumokhoz](/docs/)

## Első indítási beállítás

Amikor először megnyitja a panelt, létre kell hoznia egy rendszergazdai fiókot. Ez az egyetlen fiók, amíg nem ad hozzá többet, és teljes irányítással rendelkezik.

Válasszon egy felhasználónevet és egy legalább 8 karakter hosszú jelszót. Ennyi: be is jelentkezett, és egyenesen az irányítópultra kerül.

> **A külső telepítéseket PIN-kód védi.** Ha a panelt nem csak a loopback címhez (`PANEL_HOST` az `127.0.0.1`-től eltérő értéken) köti, a beállítási oldal egy **6 számjegyű PIN-kódot** is kér. A panel indításkor a konzolra írja ki. Adja meg a felhasználónév és a jelszó mellett. Ez megakadályozza, hogy egy idegen, aki elsőként éri el a portot, megszerezze a rendszergazdai fiókot. A PIN eltűnik, amint a rendszergazdai fiók létrejön.

## Bejelentkezés

A beállítás után a panel egy bejelentkezési képernyővel védett. Adja meg a felhasználónevét és jelszavát a folytatáshoz.

![Bejelentkezés](/docs/images/login.png)

Ha a fiókján [kétfaktoros hitelesítés](/docs/two-factor-authentication/) van engedélyezve, a jelszó megadása után azonnal kérni fog egy 6 számjegyű kódot az hitelesítő alkalmazásából.

## A navigáció

Minden a bal oldali sávból indul:

- **Irányítópult** - minden szerver egy pillantásra ([részletek](/docs/dashboard/)).
- **Szerverek**, **Modpackok**, **Világok**, **Blueprintok** - szerverek és tartalmuk létrehozása és kezelése.
- **Frissítések**, **Biztonsági mentések**, **Ütemezések**, **Tárhely**, **Tevékenység** - az üzemeltetési oldal: mi az, ami elavult, a pillanatképek, az automatizálás, a lemezhasználat és az audit napló.
- **Beállítások** (alul): felhasználók, API kulcsok és panelkonfiguráció.

A felső sávban található a **Szerver létrehozása** gomb, egy **témaváltó** (sötét/világos) és a **fiók menüje**, ahol kezelheti a [kétfaktoros hitelesítést](/docs/two-factor-authentication/) vagy kijelentkezhet.

## Telefonon vagy táblagépen

Minden oldal először keskeny képernyőre van tervezve, és onnan szélesedik: az oldalsáv a menü gomb mögé rejtőzik, az adat táblázatok kártyákká rakódnak, a eszköztárak tördelődnek, és a világvezérlő sín egy kártyává omlik össze, amelyet akkor nyit meg, amikor szüksége van rá. A gombok és a chipek valódi érintési célpont méretűek. Semmi sem csak asztali számítógépen használható.

<p align="center">
  <img src="/docs/images/mobile/dashboard.png" alt="Irányítópult telefonon" width="180">
  <img src="/docs/images/mobile/server-overview.png" alt="Szerver áttekintés telefonon" width="180">
  <img src="/docs/images/mobile/server-console.png" alt="Konzol telefonon" width="180">
  <img src="/docs/images/mobile/mods.png" alt="Modok lap telefonon" width="180">
  <img src="/docs/images/mobile/settings.png" alt="Beállítások telefonon" width="180">
</p>

## Amire szüksége van

A panel a Dockerrel kommunikál a szerverek futtatásához, ezért hozzáférésre van szüksége egy Docker daemonhoz (Docker Desktop vagy egy Docker Engine socket). Amikor a Docker elérhető, az irányítópult Docker csempéje **Csatlakoztatva** állapotot és annak verzióját mutatja. Ha nem, a panel továbbra is fut. Csak akkor indíthat szervereket, ha a daemon fut.

## Következő lépések

- [Hozza létre első szerverét →](/docs/servers/)
- [Biztosítsa fiókját 2FA-val →](/docs/two-factor-authentication/)

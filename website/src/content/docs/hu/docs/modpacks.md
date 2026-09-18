---
title: 'Modpackok'
description: 'A Modpackok oldal (és a létrehozási varázsló Modpackból fül) telepít egy modpackot szerverként, mindig egy pontos csomagverzióhoz rögzítve, így egy újraindítás képes'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/modpacks.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A **Modpackok** oldal (és a [létrehozási varázsló](/docs/servers/) **Modpackból** fül) egy modpackot telepít szerverként, mindig **egy pontos csomagverzióhoz rögzítve**, így egy újraindítás soha nem frissítheti csendben a csomagot.

![Modpackok](/docs/images/modpacks.png)

## Támogatott platformok

- **CurseForge** - keress vagy illessz be egy csomag URL-t. A kereséshez és privát csomagokhoz CurseForge API kulcs szükséges (add hozzá a Beállítások → API kulcsok alatt).
- **Modrinth** - keress név szerint.
- **FTB** - Feed The Beast csomagok.
- **GT New Horizons** - az 1.7.10 expert csomag, a GTNH saját kiadási indexéből telepítve. A GTNH csomagonként választja meg a Java futtatókörnyezetet (a 2.8.0+ a **Java 25**-ön fut a mellékelt lwjgl3ify patch-eken keresztül, az idősebb kiadások Java 21-en vagy 17-en futnak), és a varázsló emeli a szerver RAM-ját és lemezét ésszerű minimumokra.
- **Egyéni zip** - egyáltalán nem egy publikált csomag: tölts fel egy **CurseForge modpack exportot** (a zip fájl a `manifest.json`-nal, amit a CurseForge alkalmazása előállít egy kézzel kiválasztott modkészlethez) vagy **bármilyen mod jar zip fájlt**. A panel tömegesen feloldja a manifestet a CurseForge API-n keresztül (vagy minden jar-t azonosít hash/ujjlenyomat/metaadatok alapján), előnézetet készít arról, ami illeszkedik, és egyetlen feladatban telepít mindent - beleértve a csomag `overrides/` konfigurációit is, ha bekapcsolod. Azok a modok, amelyek szerzői nem engedélyezik az automatizált letöltéseket, böngészőlinkkel és manuális feltöltési hellyel jelennek meg a telepítés meghiúsulása helyett.

## A rögzítés működése

Amikor kiválasztasz egy csomagot, a panel feloldja a pontos verziót, rögzíti azt, és telepíti. A **Frissítések** oldalon értesülsz, ha újabb verzió érhető el; a frissítés egy szándékos, őrzött művelet előzetes biztonsági mentéssel és visszaállítással. A stabil verziókövető szerverek soha nem kapnak béta verziót.

A nagyon régi panel verziókon (0.9.7 előtt) létrehozott szerverek _nem rögzítettek_ maradhatnak, ami azt jelenti, hogy a konténerkép minden indításkor csendben telepíti a legújabb csomagverziót. A panel most ezeket indításkor javítja: minden egyes szervert rögzít ahhoz a verzióhoz, amelyik ténylegesen telepítve van (a panel saját rekordjaiból vagy a kép telepítési manifestjéből olvasva, soha nem egy frissen feloldott "legújabb"), és naplóz egy eseményt. Ha nem tudja megállapítani, mi van telepítve, a szerver Beállítások oldala figyelmeztetést jelenít meg, kérve a verzió manuális kiválasztását, és minden kísérlet egy nem rögzített modpack konfiguráció mentésére azonnal elutasításra kerül.

## Frissítési szabályzat

Minden szervernek van egy frissítési szabályzata a **Beállítások** között, és mindhárom opció azt jelenti, amit mond:

- **Csak manuális** - semmi sem változik önmagától, és a szerver teljesen kimarad a frissítési jelvényből és a Frissítések oldalról. Az "hagyd békén" mód: ideális egy kézzel hangolt vagy importált csomaghoz, amelyet soha nem akarsz érinteni.
- **Értesítsen** (alapértelmezett) - a napi ellenőrzés elérhetővé teszi a frissítéseket jelvényként és a Frissítések oldalon; azok alkalmazása mindig a te kattintásod.
- **Automatikus frissítés** - a napi ütemezett ellenőrzés után a függőben lévő **csomag** frissítések ugyanazon az őrzött útvonalon keresztül kerülnek alkalmazásra, mint egy manuális frissítés: előzetes biztonsági mentés, állapotfigyelés és automatikus visszaállítás, ha az új verzió nem indul el. Azok a frissítések, amelyek a szervert egy másik Minecraft verzióra váltanák, mindig kihagyásra kerülnek egy eseménnyel - a világ végleges konvertálása olyan döntés, amelyet a panel nem hoz meg helyetted. A manuális "ellenőrizd most" gombok csak ellenőriznek; soha nem indítanak el automatikus frissítéseket.

## Csomag frissítése

Egy rögzített szerverről egyetlen művelettel frissíthetsz egy újabb verzióra. A panel először biztonsági másolatot készít, kicseréli a rögzített verziót, újra létrehozza a konténert (újra feloldja a Java-t, ha az új verzió más futtatókörnyezetet igényel), és figyeli az első indítást, bőséges ablakot biztosítva a nagy csomagok, mint a GTNH számára, amelyek letöltenek pár gigabájt adatot és felépítenek egy több száz modos világot az első indításkor.

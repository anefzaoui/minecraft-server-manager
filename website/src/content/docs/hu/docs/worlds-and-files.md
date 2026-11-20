---
title: 'Világok és fájlok'
description: 'A világkönyvtár, világfeltöltések és cserék, a modok és bővítmények lap, valamint a böngészőben elérhető fájlkezelő.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Vissza a dokumentumokhoz](/docs/)

## Világok

A **Világok** oldal a világkönyvtár: minden mentett világ egy helyen. A **Világ feltöltése** egy `.zip` vagy `.tar` archívumot vesz át, és automatikusan megtalálja benne a világot. A **Mentés a könyvtárba** parancs egy szerver futó világáról készít pillanatképet (működik, amíg a szerver fut), és minden könyvtári világ letölthető vagy telepíthető bármelyik szerverre a **Telepítés ide…** paranccsal. A telepítés vagy felülírja a szerver világát (a szervernek le kell állnia, és az aktuális világáról biztonsági mentés készül előtte), vagy mellé adja, hogy később aktiválható legyen. Minden telepítés előtt kompatibilitási ellenőrzés fut le.

Egy szerver saját **Világ → Világok** lapja listázza az adott szerveren lévő világokat. Onnan aktiválhat egy másik világot (a szerver leállítása mellett), letölthet, duplikálhat, átnevezhet vagy [zsugoríthat](/docs/world-shrink/) egy világot, másolhatja egy másik szerverre, törölhet egy inaktívat, és visszaállíthatja az aktív világot egy új, megtartott vagy egyedi maggal (előtte biztonsági mentés ajánlata történik). Ugyanez a könyvtár jelenik meg alatta, a **Telepítés ide** gombbal.

![Világok](/docs/images/worlds.png)

## A fájlkezelő

Egy szerver **Világ** szekciója alatt a **Fájlok** lap egy teljes böngészőben futó fájlkezelő az adott szerver adatkönyvtárához. Listázhat, olvashat, szerkeszthet, átnevezhet, mozgathat, másolhat, törölhet és feltölthet fájlokat, létrehozhat mappákat, és kereshet a fájlok szövegtartalmában egy mappa alatt a **Keresés a fájlokban** paranccsal: mindent, amit általában SSH-n keresztül tenne, a böngészőből.

![Fájlkezelő](/docs/images/server-files.png)

A szöveges fájlok szerkesztőben nyílnak meg, 8 MB-os korláttal; nagyobb fájlok letölthetők. A feltöltések egyszerre legfeljebb 20 fájlt fogadnak el.

### A homokozón belül maradás

Minden fájlművelet a szerver saját adatkönyvtárára korlátozódik. A panel feloldja az egyes elérési utakat és megtagad mindent, ami kilépne: `..` navigációt, abszolút elérési utakat, és még a szimbolikus linkeket is, amelyek a könyvtáron kívülre mutatnak (beleértve a még nem létező, lógó linkeket is). Egy mod vagy plugin nem ültethet el egy linket, hogy becsapja a fájlkezelőt, hogy máshol olvasson vagy írjon a gazdagépen.

## Modok

Modolt és plugin szerverek esetén a **Modok** lap (saját csoport a szerver oldalsávjában) kezeli a modkészletet: böngészhet és hozzáadhat modokat, és láthatja, mi van telepítve. Minden telepített mod sorából frissítheti (vagy figyelmen kívül hagyhatja a frissítést), [visszavonhatja](/docs/updates/#undoing-a-mod-update) azt, letilthatja vagy eltávolíthatja, és az **Összes frissítése** parancs egyetlen újraindítással alkalmazza az összes elérhető frissítést. A mod- és csomagfrissítések a [Frissítések](/docs/updates/) oldalon is megjelennek.

### Modok hozzáadása

![Modok](/docs/images/mods.png)

Négyféleképpen, mind a Modok lap eszköztárából:

- **Modok keresése**: keresés a **Modrinth vagy CurseForge** oldalon (a CurseForge chip akkor jelenik meg, ha egy API kulcsot tároltak a **Beállítások → API kulcsok** alatt), és plugin szervereken a **Hangar** (a PaperMC saját plugin regisztrálása) és a **SpigotMC** (a Spiget CDN proxyján keresztül) is, mindkettő kulcs nélkül. Egy **Adatcsomagok** lap keres a Modrinth adatcsomagjai között. Minden szűrve van a szerver betöltőjére és Minecraft verziójára (egy jelölőnégyzet olyan buildokat is mutat, amelyek nincsenek kompatibilisként listázva, saját felelősségre); a Quilt szerverek automatikusan látják a fabric-címkézett buildokat is, mivel a Quilt Fabric modokat futtat. Azok az eredmények, amelyek már a szerveren vannak, **Telepítve** jelvényt kapnak. Ha egy CurseForge szerző nem engedélyezi az automatizált letöltéseket (vagy egy SpigotMC erőforrás külső helyen van tárolva), a panel ezt előre jelzi, és felajánlja a **CurseForge megnyitása** (vagy **SpigotMC megnyitása**) + **Jar feltöltése** utat a telepítés közbeni hibázás helyett.

  ![Hangar keresés](/docs/images/mods-search-hangar.png)

- **Zip importálása**: egy gomb, három alakzat, automatikusan felismerve:
  - Modrinth modpack (`.mrpack`): minden rögzített fájl kanonizálódik vissza a Modrinth projektjébe hash keresés útján (így az importált modok megtartják a valós neveket, ikonokat, és frissíthetőek maradnak; a Modrinth által nem ismert fájlok a csomag saját URL-jéről települnek), letöltés közben ellenőrizve a csomag sha512 ellenőrzőösszegei alapján, és a megfelelő illeszkedési eredményekkel előnézetben. Az ügyfél-specifikus fájlok láthatóan kihagyódnak, és mindkét felülírási fa (`overrides/`, majd `server-overrides/`; a szerver-specifikus másolat nyer) alkalmazható.

    ![mrpack importálás](/docs/images/mrpack-import.png)

  - CurseForge modpack export (a zip, amit a CurseForge alkalmazása előállít, `manifest.json` fájllal): minden rögzített mod tömegesen feloldódik, előnézetben figyelmeztetésekkel (nem megfelelő betöltő/MC ehhez a szerverhez, már nem elérhető fájlok a CurseForge-on, manuális letöltést igénylő modok), és valós haladással települ. A csomag `overrides/` (konfigurációk, szkriptek) opcionálisan alkalmazhatók; minden felülírandó fájl először biztonsági mentést kap a `.import-backups/<timestamp>/` mappába a szerver mappáján belül.
  - Egy saját gyűjtött jar fájlokból álló sima zip: minden jar azonosítva van (Modrinth hash egyezés → CurseForge ujjlenyomat → a jar saját metaadatai) és a szerverhez képest megítélve (_illeszkedik / nem megfelelő betöltő / nem megfelelő MC verzió / már telepítve / azonosítatlan_), így kiválaszthatja, mi tartozik valójában, mielőtt bármi települne.
- **Hozzáadás URL-ről**: szinte bármit beilleszthet: Modrinth, CurseForge, Hangar vagy SpigotMC projektoldalak, egy GitHub tároló vagy kiadási URL (egy egyszerű `tulajdonos/repo` is működik; a GitHub telepítések az újabb stabil kiadást részesítik előnyben, és kihagyják a `-sources`/`-javadoc` segéd-jar fájlokat), egy sima Modrinth slug, vagy bármilyen közvetlen `.jar` URL. A panel feloldja a megfelelő buildot a szerver betöltőjéhez és MC verziójához.

  ![Hozzáadás linkről](/docs/images/mods-add-by-link.png)

- **Jar feltöltése** (a keresési tartalékból vagy a függőben lévő letöltések feloldójából): a feltöltött jar fájlok ugyanúgy azonosítódnak, így megtartják valós nevüket, verziójukat, ikonjukat, és frissíthetővé válnak.

Minden regisztrációs telepítés **letöltés közben ellenőrzőösszeg-ellenőrzött**: a stream ellenőrzése a legerősebb, amit a regisztráció közzétesz (sha512 → sha256 → sha1 → md5), és egy egyezés hiánya megszakítja a folyamatot, mielőtt bármi is a szerverre kerülne.

Egy egész zip (beleértve a `.mrpack`-ot) is **szervert hozhat létre**: a varázsló **Modpackból** lapján töltse fel, és a csomag manifestje (vagy az azonosított jar fájlok többségi szavazata) kitölti a betöltőt, a Minecraft verziót és a betöltő buildot.

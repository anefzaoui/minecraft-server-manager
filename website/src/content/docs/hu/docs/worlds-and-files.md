---
title: 'Világok és fájlok'
description: 'A Világok oldal kezeli a szervereid világadatait: cseréld az aktív világot, tölts fel egy világot, vagy tölts le egyet.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/worlds-and-files.md'
---

[← Vissza a dokumentumokhoz](/docs/)

## Világok

A **Világok** oldal kezeli a szervereid világadatait: válts aktív világot, tölts fel vagy tölts le egy világot.

![Világok](/docs/images/worlds.png)

## A fájlkezelő

Egy szerver **Világ** szekciója alatt a **Fájlok** lap egy teljes böngészőben futó fájlkezelő az adott szerver adatkönyvtárához. Listázhatsz, olvashatsz, szerkeszthetsz, létrehozhatsz, átnevezhetsz, mozgathatsz, másolhatsz, törölhetsz és feltölthetsz fájlokat: mindent, amit általában SSH-n keresztül tennél, böngészőből.

![Fájlkezelő](/docs/images/server-files.png)

A szöveges fájlok szerkesztőben nyílnak meg, 2 MB-os limit mellett; nagyobb fájlokat le lehet tölteni. A feltöltések egyszerre több fájlt is elfogadnak.

### A homokozón belül maradás

Minden fájlművelet a szerver saját adatkönyvtárára korlátozódik. A panel feloldja az elérési utakat és megtagad minden olyat, ami kilépne onnan: `..` navigáció, abszolút elérési utak, és még szimbolikus linkek is, amelyek a könyvtáron kívülre mutatnak (beleértve a még nem létező, lógó linkeket is). Egy mod vagy plugin nem tud elhelyezni egy linket, hogy becsapja a fájlkezelőt, hogy máshol olvasson vagy írjon a gazdagépen.

## Modok

Modolt szerverek esetén a **Modok** lap (saját csoport a szerver oldalsávjában) kezeli a modkészletet: böngészhetsz és hozzáadhatsz modokat, és láthatod, mi van telepítve. A mod- és csomagfrissítések a [Frissítések](/docs/updates/) oldalon jelennek meg.

### Modok hozzáadása

![Modok](/docs/images/mods.png)

Négyféleképpen, mind a Modok lap eszköztárából:

- **Modok keresése** - keress a **Modrinth vagy CurseForge** oldalon (a CurseForge chip akkor jelenik meg, ha egy API kulcs van tárolva a Beállítások → API kulcsok alatt), és plugin szervereken még a **Hangar** (a PaperMC saját plugin regisztrálása) és a **SpigotMC** (a Spiget CDN proxyján keresztül) - mindkettő kulcs nélküli. Minden szűrésre kerül a szerver betöltője és Minecraft verziója szerint; a Quilt szerverek automatikusan látják a fabric-taggel ellátott buildokat is, mivel a Quilt Fabric modokat futtat. Azok az eredmények, amelyek már a szerveren vannak, egy **Telepítve** jelvényt kapnak. Ha egy CurseForge szerző nem engedélyezi az automatikus letöltéseket - vagy egy SpigotMC erőforrás külső helyen van tárolva - a panel ezt előre jelzi, és az **Oldal megnyitása** + **Jar feltöltése** utat kínálja a telepítés közbeni hibázás helyett.

  ![Hangar keresés](/docs/images/mods-search-hangar.png)

- **Zip importálása** - egy gomb, három alakzat, automatikus felismerés:
  - Modrinth modpack (`.mrpack`): minden rögzített fájl kanonizálva lesz vissza a Modrinth projektjére hash kereséssel (így az importált modok megőrzik valós nevüket, ikonjaikat, és frissíthetőek maradnak; a Modrinth által nem ismert fájlok a csomag saját URL-jéről települnek), letöltés közben ellenőrizve a csomag sha512 ellenőrzőösszegeivel, és előnézettel, a megfelelő eredményekkel. Az ügyfél-specifikus fájlok láthatóan átugrásra kerülnek, és mindkét felülírási fa (`overrides/`, majd `server-overrides/` - a szerver-specifikus másolat nyer) alkalmazható.

    ![mrpack importálás](/docs/images/mrpack-import.png)

  - CurseForge modpack export (a zip, amit a CurseForge appja előállít, `manifest.json`-nal): minden rögzített mod tömegesen feloldásra kerül, előnézettel és figyelmeztetésekkel (nem megfelelő betöltő/MC verzió ehhez a szerverhez, már nem elérhető fájlok a CurseForge-on, manuális letöltést igénylő modok), és valós haladással települ. A csomag `overrides/` (konfigurációk, szkriptek) is opcionálisan alkalmazható - minden fájl, ami felülírásra kerülne, először biztonsági mentést kap a `.import-backups/<timestamp>/` könyvtárba a szerver mappáján belül.
  - Egy saját gyűjtésű jar fájlokból álló sima zip: minden jar azonosítva lesz (Modrinth hash egyezés → CurseForge ujjlenyomat → a jar saját metaadatai) és a szerverhez mérve - _illeszkedik / nem megfelelő betöltő / nem megfelelő MC verzió / már telepítve / azonosítatlan_ - így kiválaszthatod, mi tartozik oda, mielőtt bármi települne.
- **Hivatkozás alapján hozzáadás** - szinte bármit beilleszthetsz: Modrinth, CurseForge, Hangar, vagy SpigotMC projektoldalak, egy GitHub tároló vagy kiadási URL (egy egyszerű `tulajdonos/repo` is működik - a GitHub telepítések az újabb stabil kiadást részesítik előnyben és kihagyják a `-sources`/`-javadoc` kiegészítő jarokat), egy egyszerű Modrinth slug, vagy bármilyen közvetlen `.jar` URL. A panel feloldja a megfelelő buildot a szerver betöltője és MC verziója számára.

  ![Hozzáadás hivatkozás alapján](/docs/images/mods-add-by-link.png)

- **Jar feltöltése** (a keresési tartalékból vagy a függőben lévő letöltések feloldójából) - a feltöltött jarok ugyanúgy azonosítódnak, így megőrzik valós nevüket, verziójukat, ikonjukat, és frissíthetővé válnak.

Minden regisztrációs telepítés **ellenőrzőösszeg-ellenőrzött a letöltés során**: a stream ellenőrzésre kerül a legerősebb, a regisztráció által közzétett kivonattal (sha512 → sha256 → sha1 → md5) és egy egyezés hiánya megszakítja a folyamatot, mielőtt bármi is a szerverre kerülne.

Egy egész zip fájl (`.mrpack` is) **szervert is létrehozhat**: a varázsló _Modpackból_ lapján töltsd fel, és a csomag manifestje (vagy az azonosított jarok többségi szavazata) kitölti a betöltőt, a Minecraft verziót és a betöltő buildot.

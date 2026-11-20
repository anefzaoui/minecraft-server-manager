---
title: 'Felhasználók és szerepkörök'
description: 'Fiókok, az adminisztrátor, üzemeltető és megtekintő szerepkörök, valamint a Minecraft Server Manager szerverenkénti engedélyei.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A panel több felhasználót is kezel. A fiókokat a **Beállítások → Felhasználók** alatt kezelheted.

![Felhasználók](/docs/images/settings-users.png)

## A három szerepkör

| Szerepkör    | Alapértelmezett minden szerveren                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **admin**    | Minden: felhasználók, API kulcsok, globális fájlok, speciális Docker felülbírálások és minden szerver művelet kezelése.                                      |
| **operator** | Szerverek futtatása és konfigurálása (indítás/leállítás, konzol, biztonsági mentések, világok, modok, legtöbb beállítás), de nem admin-specifikus területek. |
| **viewer**   | Csak olvasható. Szerverek és állapotuk megtekintése, de módosítások nélkül.                                                                                  |

Minden felhasználó, beleértve a nézőt is, kezelheti saját [kétfaktoros hitelesítését](/docs/two-factor-authentication/), mert a saját bejelentkezés védelme nem szerverkezelési művelet.

Egy szerepkör az **alapértelmezett** minden szerveren. Ha valakinek más jogokat szeretnél adni egy szerveren, használd az alábbi szerver-specifikus engedélyeket.

## Szerver-specifikus engedélyek

Az **Engedélyek** oldal (az oldalsávban, vagy a **Beállítások → Felhasználók** alatt a **Szerver engedélyei**) egy rácsot mutat: minden operátor és néző oldalt, minden szerver felül. Kattints egy cellára, hogy eldöntsd, mit tehet az adott felhasználó azon az egy szerveren. Az adminok nincsenek felsorolva, mert mindig mindent tudnak.

![Engedélyek](/docs/images/settings-permissions.png)

Minden cella egy engedélyhalmaz:

| Engedély     | Mit tesz lehetővé azon a szerveren                                                                                          |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **View**     | A szerver, annak állapota, konzol kimenete, játékosok, előzmények és statisztikák megtekintése.                             |
| **Power**    | A szerver indítása, leállítása, újraindítása, leölése és újraépítése.                                                       |
| **Console**  | Konzolparancsok és gyors világműveletek futtatása, csevegés küldése és csevegési parancsok kezelése.                        |
| **Players**  | Játékosok kirúgása, kitiltása, fehérlistázása, op-ként való beállítása és játékosjegyzetek szerkesztése.                    |
| **Content**  | Modok, pluginok, csomagok, világok, datapack-ok telepítése és eltávolítása, valamint leltárak szerkesztése.                 |
| **Backups**  | Biztonsági mentések létrehozása, visszaállítása, letöltése és törlése.                                                      |
| **Files**    | Szerverfájlok, archivált naplók és naplókötegek böngészése, szerkesztése, feltöltése és letöltése; blueprintok exportálása. |
| **Settings** | Szerverbeállítások, tulajdonságok, integrációk, ikon és verziófrissítések módosítása.                                       |
| **Delete**   | A szerver törlése.                                                                                                          |

![Engedély szerkesztő](/docs/images/permissions-editor.png)

A rács alatt a **Mit fed le minden engedély** minden engedélyt kibont arra, hogy mit tehet egy személy, mit nem tartalmaz, és mely pontos panel útvonalakat nyit meg. Az utolsó lista a futó kód ellenőrzésre kerül a tesztsuite által.

![Engedély referencia](/docs/images/permissions-reference.png)

Telefonon a rács minden felhasználóhoz egy kártyává, szerverenként egy sorrá rakódik össze.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Engedélyek telefonon" width="180">
</p>

Hogyan illeszkednek össze a darabok:

- **A szerepkör az alapértelmezett.** Egy operátor minden engedéllyel indul minden szerveren; egy néző csak a Megtekintéssel. Egy cella halvány szöveggel (a tooltipje azt mondja: "Szerepkör alapértelmezett") soha nem lett megváltoztatva.
- **Egy cella felülírja a szerepkört az adott szerverre vonatkozóan.** Adj egy nézőnek Power és Console jogot egy szerveren, és tudja futtatni azt, míg minden más szerver csak olvasható marad számára. Vedd el a Delete jogot egy operátortól a fő szerveredről, és ott mindent mást megtartanak.
- **Minden engedély tartalmazza a Megtekintést.** Nem tehetsz műveleteket egy olyan szerveren, amit nem látsz.
- **Kapcsolj ki mindent egy szerver elrejtéséhez.** Eltűnik az adott felhasználó oldalsávjából, irányítópultjáról, biztonsági mentéseiről, ütemezéseiről, tevékenységeiről, frissítéseiről, modpackjairól, élő állapotáról, futó feladatairól és blueprintjairól, és a világok könyvtára sem nevezi meg. Egy közvetlen link, API hívás vagy konzol socket "nem található" választ ad, ugyanúgy, mint egy nem létező szerver.
- **A panel-szintű műveletek továbbra is a szerepkört követik.** Szerverek létrehozása (beleértve egy klónozását), tárhely, felhasználók, API kulcsok, globális beállítások és panel-szintű ütemezések nem szerver-specifikusak, így egy néző, akinek bizonyos szervereken vannak engedélyei, még mindig nem tudja megtenni ezeket. Az operátorok megtartják a szerver létrehozását és a panel-szintű ütemezéseket; a tárhely, felhasználók, API kulcsok és globális beállítások csak adminok számára érhetők el.
- **Az ütemezések követik a szervert.** Egy szerveren lévő ütemezett újraindítás, biztonsági mentés vagy parancs ott a megfelelő engedélyt igényli (Power, Backups, vagy Console), függetlenül a szerepkörtől.
- **A blueprintok is követik a szervert.** Egy szerver blueprintként való exportálása ott a Files engedélyt igényli, mert az archívum tartalmazza a fájlokat. Egy olyan szerverről exportált blueprint, amit valaki nem lát, az is rejtve marad előle.
- **Az admin-specifikus területek admin-specifikusak maradnak** minden szerveren: a chatbot, a biztonsági mentések megtartása és a speciális Docker felülbírálások.

Minden változás bekerül a tevékenység naplóba, ki mit változtatott; ezek a bejegyzések csak az adminok számára láthatók. Egy felhasználó törlése eltávolítja a sorait. Egy szerver eltávolítása megőrzi őket, így egy rejtett szerver rejtve marad a történetében és a megőrzött biztonsági mentéseiben.

A meglévő telepítések változatlanul működnek: amíg egy admin nem szerkeszt egy cellát, minden felhasználó pontosan azt kapja, amit a szerepköre korábban adott nekik.

## Csak adminoknak, és miért

Néhány dolgot szándékosan korlátoztunk az adminokra:

- **Felhasználókezelés, tárhely, globális beállítások, API kulcsok és globális fájlok.**
- **A [nyilvános API](/docs/public-api/)**: a `/api/v1` engedélyezése és az olvasó-only Bearer tokenek létrehozása, hatókörbe helyezése vagy visszavonása.
- **Speciális Docker felülbírálások**: egyéni konténernév, extra port publikálások és bind mountok. Egy bind mount bármilyen host útvonalat képes egy konténerbe csatolni, és a panel Docker hozzáférésével kombinálva ez gyakorlatilag root jogot jelent a hoston. Ezek a mezők csak adminok számára jelennek meg.

Az egyéni konténernevek nem élhetnek a panel saját `msm-` névterében sem, így egy kézzel elnevezett konténer soha nem árnyékolhat le egy másik szerverét, és nem irányíthat át egy leállítást vagy parancsot a rossz példányra.

## Fiókok kezelése

![Profilkép](/docs/images/profile-picture.png)

Az adminok felhasználókat hozhatnak létre, módosíthatják a szerepköröket, visszaállíthatják a jelszavakat és törölhetnek fiókokat a Felhasználók táblázatból. A **2FA** oszlop mutatja, hogy az adott felhasználó rendelkezik-e kétfaktoros hitelesítéssel; egy admin visszaállíthatja egy másik felhasználó 2FA-ját a **Reset 2FA** opcióval az adott felhasználó műveleti menüjében (elveszett telefon és biztonsági kódok esetére), de soha nem tilthatja le a sajátját jelszó nélkül, amit az önszerviz folyamat kezel helyette.

A sikertelen bejelentkezések fiókonként vannak sebességkorlátozva (mind IP-címenként, mind globálisan a fiókra vonatkozóan), hogy lassítsák a brute-force kísérleteket, és ugyanez a korlátozás vonatkozik a 2FA kód lépésre is, így egy helyes jelszó nem tudja visszaállítani a számlálót a kód-tippelés előtt. Ennek elé helyezkedik egy durvább IP-címenkénti kéréskorlátozó a bejelentkezési / 2FA / beállítási végpontokon, amely a `RATE_LIMIT_AUTH_PER_15MIN` (alapértelmezett 100; fordított proxy mögött állítsa be a `TRUST_PROXY`-t, hogy az igazi kliens IP-címét használja) segítségével állítható.

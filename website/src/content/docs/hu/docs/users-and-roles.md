---
title: 'Felhasználók és szerepkörök'
description: 'A panel több felhasználós.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A panel több felhasználós. A fiókokat a **Beállítások → Felhasználók** alatt kezelheted.

![Felhasználók](/docs/images/settings-users.png)

## A három szerepkör

| Szerepkör    | Mit tehet                                                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **admin**    | Mindent: felhasználók, API kulcsok, globális fájlok, speciális Docker felülbírálások és minden szerver művelet kezelése.                                        |
| **operator** | Szerverek futtatása és konfigurálása (indítás/leállítás, konzol, biztonsági mentések, világok, modok, legtöbb beállítás), de nem az admin-specifikus területek. |
| **viewer**   | Csak olvasható. Szerverek és állapotuk megtekintése, de változtatások nem eszközölhetők.                                                                        |

Minden felhasználó, beleértve a nézőt is, kezelheti saját [kéttényezős hitelesítését](/docs/two-factor-authentication/), mert a saját bejelentkezésed védelme nem szerverkezelési művelet.

## Csak rendszergazdáknak, és miért

Néhány dolgot szándékosan csak rendszergazdák kezelhetnek:

- **Felhasználókezelés, API kulcsok és globális fájlok.**
- **A [nyilvános API](/docs/public-api/)** - az `/api/v1` engedélyezése és az csak olvasható Bearer tokenek létrehozása, hatókörének meghatározása vagy visszavonása.
- **Speciális Docker felülbírálások** - egyéni tárolónév, további portok közzététele és csatolási pontok (bind mounts). Egy csatolási pont bármilyen gazdagép útvonalat képes egy tárolóba csatolni, és a panel Docker hozzáférésével kombinálva ez lényegében root hozzáférést jelent a gazdagépen. Ezek a mezők csak rendszergazdák számára jelennek meg.

Az egyéni tárolónevek nem élhetnek a panel saját `msm-` névterében sem, így egy kézzel elnevezett tároló soha nem árnyékolhat le egy másik szerverét, és nem irányíthat át egy leállítást vagy parancsot a rossz példányra.

## Fiókok kezelése

![Profilkép](/docs/images/profile-picture.png)

A rendszergazdák a Felhasználók táblázatból hozhatnak létre felhasználókat, módosíthatják a szerepköröket, visszaállíthatják a jelszavakat és törölhetnek fiókokat. A **2FA** oszlop mutatja, hogy az egyes felhasználók rendelkeznek-e kéttényezős hitelesítéssel; egy rendszergazda visszaállíthatja egy másik felhasználó 2FA-ját (elveszett telefon és biztonsági kódok esetére), de soha nem tilthatja le a sajátját jelszava nélkül, amit az önszerviz folyamat kezel helyette.

A sikertelen bejelentkezések fiókonként (IP-címenként és globálisan is) sebességkorlátozottak a brute-force kísérletek lassítása érdekében, és ugyanez a korlátozás vonatkozik a 2FA kód lépésre is, így egy helyes jelszó nem tudja visszaállítani a számlálót a kód-találgatás előtt. Ennek elé helyezkedik egy durvább IP-címenkénti kéréskorlátozó a bejelentkezési / 2FA / beállítási végpontokon, amely a `RATE_LIMIT_AUTH_PER_15MIN` (alapértelmezett 100; fordított proxy mögött állítsa be a `TRUST_PROXY` értéket, hogy az a valódi kliens IP-címét használja) segítségével állítható.

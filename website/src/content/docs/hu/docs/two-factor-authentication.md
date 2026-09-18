---
title: 'Kétfaktoros hitelesítés'
description: 'A kétfaktoros hitelesítés (2FA) egy második lépést ad a bejelentkezéshez: a jelszó megadása után be kell írnia egy rövid kódot a telefonján lévő hitelesítő alkalmazásból.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A kétfaktoros hitelesítés (2FA) egy második lépést ad a bejelentkezéshez: a jelszó megadása után be kell írnod egy rövid kódot a telefonodon lévő hitelesítő alkalmazásból. Még ha valaki meg is tudja a jelszavadat, nem tud bejutni az eszközöd nélkül.

Ez bármilyen szabványos TOTP hitelesítővel működik (Google Authenticator, Authy, 1Password, Microsoft Authenticator és mások), és **minden** fiók számára elérhető, nem csak az adminisztrátoroknak. A saját bejelentkezésed védelme nem szerverkezelési művelet, így a nézők és az üzemeltetők is engedélyezhetik.

## 2FA engedélyezése

Nyisd meg a fiók menüt (a jobb felső sarokban lévő kezdőbetűd) és válaszd a **Kétfaktoros hitelesítés** lehetőséget.

![Fiók menü](/docs/images/2fa-user-menu.png)

Megjelenik egy regisztrációs párbeszédablak:

![Regisztráció](/docs/images/2fa-enroll.png)

1. **Olvasd be a QR-kódot** a hitelesítő alkalmazásoddal, vagy koppints a **Másolás** gombra, és írd be manuálisan a kulcsot.
2. Írd be a 6 számjegyű **kódot**, amit az alkalmazásod most mutat.
3. **Erősítsd meg a jelszavadat.** A 2FA engedélyezése újra ellenőrzi a jelszavadat, így egy véletlenül nyitva maradt munkamenet nem tudja bekapcsolni valaki más eszközével.
4. Kattints az **Engedélyezés** gombra.

### Mentsd el a biztonsági kódjaidat

Amint a 2FA engedélyezve lett, a panel megjelenít egy egyszer használatos **biztonsági kódok** készletet.

![Biztonsági kódok](/docs/images/2fa-backup-codes.png)

Minden kód **egyszer** használható a bejelentkezéshez, ha elveszítenéd a hozzáférést a hitelesítő alkalmazásodhoz. Mentsd el őket biztonságos helyre (egy jelszókezelő ideális), mert többet nem jelennek meg. Bármikor generálhatsz egy új készletet (ami érvényteleníti a régieket).

## Bejelentkezés 2FA-val

Ettől kezdve a bejelentkezésnek van egy második lépése. A felhasználóneved és jelszavad megadása után a panel elkéri a kódodat:

![2FA bejelentkezés](/docs/images/2fa-login-challenge.png)

Írd be az alkalmazásod aktuális 6 számjegyű kódját (vagy az egyik biztonsági kódodat), és már bent is vagy. Amíg ezt a lépést nem teljesíted, a munkamenet **nem** bejelentkezett: nem érhet el semmilyen oldalt vagy API-t.

## 2FA kezelése vagy kikapcsolása

Nyisd meg ugyanazt a **Kétfaktoros hitelesítés** opciót a fiók menüben, amíg az engedélyezve van. A jelszavad megerősítése után a következőket teheted:

- **Biztonsági kódok újragenerálása** - kiad egy új készletet és érvényteleníti a régit.
- **2FA kikapcsolása** - eltávolítja a fiókodból.

Mindkettő először ellenőrzi az aktuális jelszavadat.

## Elvesztetted a telefonodat _és_ a biztonsági kódjaidat?

Egy **adminisztrátor** visszaállíthatja egy másik felhasználó 2FA-ját a **Beállítások → Felhasználók** menüpontban (a 2FA oszlopban található **Visszaállítás** gomb). Ez törli a 2FA-t a fiókhoz, így a felhasználó csak a jelszavával tud bejelentkezni, és újra beállíthatja azt. Az adminisztrátorok nem tudják jelszó nélkül visszaállítani a _saját_ 2FA-jukat. Ők a szokásos jelszóval védett kikapcsolási folyamaton mennek keresztül, így egy feltört adminisztrátori munkamenet nem tudja eltávolítani a saját második tényezőjét.

## Jó tudni

- A kódok időalapúak és 30 másodpercenként változnak; a panel elfogad egy kis időeltolódást, és csendben helyreáll, ha a szerver órája később korrigálásra kerül.
- Egy kód nem játszható le újra – miután bejelentkezéshez használták, ugyanaz a kód nem fog működni az ablakán belül.
- A helytelen kódok sebességkorlátozottak. A korlátozó **közös** a jelszó lépéssel (fiókonkénti zárolás plusz IP-nkénti `RATE_LIMIT_AUTH_PER_15MIN` korlátozó), így egy helyes jelszó megadása nem tudja visszaállítani a számlálót közvetlenül a 6 számjegyű kód kitalálása előtt.
- A 2FA változásai (engedélyezés, kikapcsolás, visszaállítás, biztonsági kód használata) mind rögzítésre kerülnek a [Tevékenységnaplóban](/docs/activity/).

---
title: 'Kétfaktoros hitelesítés'
description: 'A kétfaktoros hitelesítés (2FA) egy második lépést ad a bejelentkezéshez: a jelszó megadása után be kell írnia egy rövid kódot a telefonján lévő hitelesítő alkalmazásból.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Vissza a dokumentumokhoz](/docs/)

A kétfaktoros hitelesítés (2FA) egy második lépést ad a bejelentkezéshez: a jelszó megadása után be kell írnia egy rövid kódot a telefonján lévő hitelesítő alkalmazásból. Még ha valaki meg is tudja a jelszavát, nem tud bejutni az Ön eszköze nélkül.

Bármilyen szabványos TOTP hitelesítővel működik (Google Authenticator, Authy, 1Password, Microsoft Authenticator és mások), és **minden** fiók számára elérhető, nem csak az adminisztrátoroknak. A saját bejelentkezésének védelme nem szerverkezelési művelet, így a megtekintők és az üzemeltetők is engedélyezhetik.

## 2FA engedélyezése

Nyissa meg a fiókmenüt (az Ön kezdőbetűje vagy profilképe, jobb felső sarok), és válassza a **2FA** lehetőséget.

![Fiókmenü](/docs/images/2fa-user-menu.png)

Megjelenik egy regisztrációs párbeszédablak:

![Regisztráció](/docs/images/2fa-enroll.png)

1. **Olvassa be a QR-kódot** a hitelesítő alkalmazásával, vagy koppintson a **Másolás** gombra, és írja be kézzel a manuális kulcsot.
2. Írja be a **6 számjegyű kódot**, amelyet az alkalmazás most mutat.
3. **Erősítse meg a jelszavát.** A 2FA engedélyezése újra ellenőrzi a jelszavát, így egy véletlenül nyitva maradt munkamenet nem tudja bekapcsolni valaki más eszközével.
4. Kattintson az **Engedélyezés** gombra.

### Mentse el a biztonsági mentési kódjait

Amint a 2FA engedélyezve lett, a panel megjelenít egy egyszer használatos **biztonsági mentési kódok** készletet.

![Biztonsági mentési kódok](/docs/images/2fa-backup-codes.png)

Minden kód **egyszer** használható a bejelentkezéshez, ha elveszítené a hozzáférést a hitelesítő alkalmazásához. Mentse el őket biztonságos helyre (ideális esetben egy jelszókezelőbe), mert többet nem jelennek meg. Bármikor generálhat új készletet (ami érvényteleníti a régieket).

## Bejelentkezés 2FA-val

Ettől kezdve a bejelentkezésnek van egy második lépése. A felhasználónév és a jelszó megadása után a panel elkéri a kódját:

![2FA bejelentkezés](/docs/images/2fa-login-challenge.png)

Adja meg az alkalmazás aktuális 6 számjegyű kódját (vagy az egyik biztonsági mentési kódját), és már bent is van. Amíg ezt a lépést nem teljesíti, a munkamenet **nem** bejelentkezett: nem érhet el semmilyen oldalt vagy API-t.

## 2FA kezelése vagy kikapcsolása

Nyissa meg ugyanazt a **2FA** bejegyzést a fiókmenüben, amíg az engedélyezve van. Jelszavának megerősítése után a következőket teheti:

- **Biztonsági mentési kódok újragenerálása:** Új készletet bocsát ki, és érvényteleníti a régieket.
- **2FA kikapcsolása:** Eltávolítja a fiókjából.

Mindkettő először ellenőrzi az aktuális jelszavát.

## Elvesztette a telefonját _és_ a biztonsági mentési kódjait?

Egy **adminisztrátor** visszaállíthatja egy másik felhasználó 2FA-ját a **Beállítások → Felhasználók** menüpontból (a felhasználó műveleti menüjében a **2FA visszaállítása**). Ez törli a 2FA-t a fiókhoz, így a felhasználó csak a jelszavával tud bejelentkezni, és újra beállíthatja azt. Az adminisztrátorok nem állíthatják vissza saját 2FA-jukat jelszó nélkül. A normál jelszóval védett kikapcsolási folyamatot követik, így egy feltört adminisztrátori munkamenet nem tudja eltávolítani a saját második tényezőjét.

## Jó tudni

- A kódok időalapúak és 30 másodpercenként váltódnak; a panel elfogad egy kis időeltolódást, és csendesen helyreáll, ha a szerver órája később korrigálásra kerül.
- Egy kódot nem lehet megismételni: miután bejelentkezéshez használták, ugyanaz a kód nem fog működni az ablakán belül.
- A téves kódok sebességkorlátozottak. A korlátozó **megosztott** a jelszó lépéssel (fiókonkénti zárolás plusz IP-címenkénti `RATE_LIMIT_AUTH_PER_15MIN` korlátozó), így a helyes jelszó megadása nem állíthatja vissza a számlálót közvetlenül a 6 számjegyű kód kitalálása előtt.
- A 2FA-val kapcsolatos változások (engedélyezés, kikapcsolás, visszaállítás, biztonsági mentési kód használata) mind rögzítésre kerülnek a [Tevékenységnaplóban](/docs/activity/).

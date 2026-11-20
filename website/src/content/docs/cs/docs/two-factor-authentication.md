---
title: 'Dvoufaktorové ověřování'
description: 'Dvoufaktorové ověřování (2FA) přidává druhý krok k přihlášení: po zadání hesla zadáte krátký kód z aplikace pro ověřování na vašem telefonu.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/two-factor-authentication.md'
---

[← Zpět na index dokumentace](/docs/)

Dvoufaktorové ověřování (2FA) přidává druhý krok k přihlášení: po zadání hesla zadáte krátký kód z aplikace pro ověřování na vašem telefonu. I když někdo zjistí vaše heslo, bez vašeho zařízení se nedostane dovnitř.

Funguje s jakýmkoli standardním TOTP ověřovačem (Google Authenticator, Authy, 1Password, Microsoft Authenticator a další) a je k dispozici pro **každý** účet, nejen pro administrátory. Ochrana vlastního přihlášení není akcí správy serveru, takže ji mohou povolit i prohlížeči a operátoři.

## Povolení 2FA

Otevřete menu účtu (vaše iniciála nebo profilový obrázek, vpravo nahoře) a zvolte **2FA**.

![Menu účtu](/docs/images/2fa-user-menu.png)

Zobrazí se vám dialog pro registraci:

![Registrace](/docs/images/2fa-enroll.png)

1. **Naskenujte QR kód** pomocí své aplikace pro ověřování, nebo klepněte na **Kopírovat** a zadejte ruční klíč ručně.
2. Zadejte **6místný kód**, který vaše aplikace nyní zobrazuje.
3. **Potvrďte své heslo.** Povolení 2FA znovu ověřuje vaše heslo, takže otevřená relace nemůže povolit 2FA s cizím zařízením.
4. Klikněte na **Povolit**.

### Uložte si záložní kódy

V okamžiku, kdy je 2FA povoleno, panel zobrazí sadu jednorázových **záložních kódů**.

![Záložní kódy](/docs/images/2fa-backup-codes.png)

Každý kód funguje **jednou** k přihlášení, pokud ztratíte přístup ke své aplikaci pro ověřování. Uložte si je na bezpečné místo (ideálně správce hesel), protože se již nezobrazí. Novou sadu si můžete kdykoli vygenerovat (což zneplatní staré).

## Přihlášení s 2FA

Od té chvíle má přihlášení druhý krok. Po uživatelském jménu a heslu vás panel požádá o kód:

![Přihlášení s 2FA](/docs/images/2fa-login-challenge.png)

Zadejte aktuální 6místný kód ze své aplikace (nebo jeden ze svých záložních kódů) a jste přihlášeni. Dokud tento krok nedokončíte, relace **není** přihlášena: nemůže přistupovat k žádné stránce ani API.

## Správa nebo vypnutí 2FA

Otevřete stejnou položku **2FA** v menu účtu, když je povolena. Po potvrzení hesla můžete:

- **Znovu vygenerovat záložní kódy** vydá novou sadu a zneplatní staré.
- **Vypnout 2FA** odebere ji z vašeho účtu.

Obě akce nejprve znovu ověří vaše aktuální heslo.

## Ztratili jste telefon _a_ své záložní kódy?

**Administrátor** může resetovat 2FA jiného uživatele z **Nastavení → Uživatelé** (**Resetovat 2FA** v menu akcí daného uživatele). Tím se pro účet vymaže 2FA, takže se uživatel může přihlásit pouze svým heslem a znovu jej nastavit. Administrátoři nemohou resetovat své _vlastní_ 2FA bez hesla. Procházejí běžným procesem vypnutí s ověřením hesla, takže kompromitovaná administrátorská relace nemůže odstranit svůj vlastní druhý faktor.

## Dobré vědět

- Kódy jsou časově založené a mění se každých 30 sekund; panel akceptuje malý časový posun a tiše se zotaví, pokud je čas serveru později opraven.
- Kód nelze znovu použít: jakmile je použit k přihlášení, stejný kód již nebude v rámci svého okna fungovat.
- Nesprávné kódy podléhají omezení rychlosti. Omezení je **sdílené** s krokem hesla (uzamčení na účet plus omezení `RATE_LIMIT_AUTH_PER_15MIN` na IP adresu), takže zadání správného hesla nemůže resetovat čítač těsně před uhodnutím 6místného kódu.
- Změny 2FA (povolení, vypnutí, resetování, použití záložního kódu) jsou zaznamenány v [Logu aktivit](/docs/activity/).

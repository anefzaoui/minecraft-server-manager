---
title: 'Uživatelé a role'
description: 'Účty, role administrátora, operátora a prohlížeče a oprávnění pro jednotlivé servery v Minecraft Server Manager.'
editUrl: 'https://github.com/anefzaoui/minecraft-server-manager/edit/main/docs/users-and-roles.md'
---

[← Zpět na index dokumentace](/docs/)

Panel je vícemužný. Účty spravujte v sekci **Nastavení → Uživatelé**.

![Uživatelé](/docs/images/settings-users.png)

## Tři role

| Role          | Výchozí nastavení pro každý server                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **admin**     | Vše: správa uživatelů, API klíčů, globálních souborů, pokročilých Docker přepsání a všech akcí serveru.                         |
| **operátor**  | Spouštění a konfigurace serverů (start/stop, konzole, zálohy, světy, mody, většina nastavení), ale ne oblasti pouze pro adminy. |
| **prohlížeč** | Pouze pro čtení. Zobrazuje servery a jejich stav, ale neprovádí žádné změny.                                                    |

Každý uživatel, včetně prohlížeče, si může spravovat vlastní [dvoufaktorovou autentizaci](/docs/two-factor-authentication/), protože ochrana vlastního přihlášení není akce správy serveru.

Role je **výchozí** pro každý server. Chcete-li někomu udělit jiná oprávnění na jednom serveru, použijte níže uvedená oprávnění pro jednotlivé servery.

## Oprávnění pro jednotlivé servery

Stránka **Oprávnění** (v postranním panelu nebo **Oprávnění serveru** v sekci **Nastavení → Uživatelé**) zobrazuje mřížku: operátoři a prohlížeči dole, servery nahoře. Kliknutím na buňku rozhodnete, co daný uživatel smí na tomto jednom serveru dělat. Admini nejsou uvedeni, protože mají vždy vše.

![Oprávnění](/docs/images/settings-permissions.png)

Každá buňka představuje sadu oprávnění:

| Oprávnění     | Co umožňuje na daném serveru                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| **Zobrazit**  | Zobrazit server, jeho stav, výstup konzole, hráče, historii a statistiky.                                       |
| **Napájení**  | Spustit, zastavit, restartovat, ukončit a znovu sestavit server.                                                |
| **Konzole**   | Spouštět příkazy konzole a rychlé akce světa, posílat chat a spravovat příkazy chatu.                           |
| **Hráči**     | Vyhodit, zabanovat, přidat na whitelist, udělit operátorská práva a upravovat poznámky hráčů.                   |
| **Obsah**     | Instalovat a odstraňovat mody, pluginy, balíčky, světy, datapacky a upravovat inventáře.                        |
| **Zálohy**    | Vytvářet, obnovovat, stahovat a mazat zálohy.                                                                   |
| **Soubory**   | Procházet, upravovat, nahrávat a stahovat soubory serveru, archivované logy a balíčky logů; exportovat šablony. |
| **Nastavení** | Měnit nastavení serveru, vlastnosti, integrace, ikonu a aktualizovat verze.                                     |
| **Smazat**    | Smazat server.                                                                                                  |

![Editor oprávnění](/docs/images/permissions-editor.png)

Pod mřížkou se v sekci **Co každé oprávnění pokrývá** rozbalí každé oprávnění na to, co osoba může dělat, co není zahrnuto, a přesné cesty v panelu, které odemyká. Poslední seznam je ověřen proti běžícímu kódu testovací sadou.

![Reference oprávnění](/docs/images/permissions-reference.png)

Na telefonu se mřížka skládá do jedné karty na uživatele, s řádkem na server.

<p align="center">
  <img src="/docs/images/mobile/permissions.png" alt="Oprávnění na telefonu" width="180">
</p>

Jak do sebe jednotlivé části zapadají:

- **Role je výchozí.** Operátor začíná s každým oprávněním na každém serveru; prohlížeč začíná pouze se zobrazením. Buňka slabým písmem (její popisek říká "Výchozí role") nebyla nikdy změněna.
- **Buňka přepíše roli pouze pro daný server.** Udělte prohlížeči Napájení a Konzoli na jednom serveru a bude ho moci spouštět, zatímco všechny ostatní servery pro něj zůstanou pouze pro čtení. Odeberte operátorovi Smazat na vašem hlavním serveru a na něm si ponechá vše ostatní.
- **Každé oprávnění zahrnuje Zobrazení.** Nemůžete jednat na serveru, který nemůžete vidět.
- **Vypnutím všeho skryjete server.** Zmizí z postranního panelu uživatele, řídicího panelu, záloh, plánů, aktivity, aktualizací, modpacků, živého stavu, běžících úloh a šablon a knihovna světů jej přestane pojmenovávat. Přímý odkaz, volání API nebo konzolové připojení odpoví "nenalezeno", stejně jako server, který neexistuje.
- **Akce napříč panelem se stále řídí rolí.** Vytváření serverů (včetně klonování), úložiště, uživatelé, API klíče, globální nastavení a plány napříč panelem nejsou pro jednotlivé servery, takže prohlížeč s oprávněními na některých serverech stále nemůže nic z toho dělat. Operátoři si ponechávají vytváření serverů a plány napříč panelem; úložiště, uživatelé, API klíče a globální nastavení jsou pouze pro adminy.
- **Plány následují server.** Naplánovaný restart, záloha nebo příkaz na serveru vyžaduje odpovídající oprávnění (Napájení, Zálohy nebo Konzole), bez ohledu na roli.
- **Šablony také následují server.** Export serveru jako šablony vyžaduje oprávnění Soubory, protože archiv nese jeho soubory. Šablona exportovaná ze serveru, který někdo nemůže vidět, je pro něj také skrytá.
- **Oblasti pouze pro adminy zůstávají pouze pro adminy** na každém serveru: chatbot, uchovávání záloh a pokročilá Docker přepsání.

Každá změna je zapsána do protokolu aktivity s informací, kdo co změnil; tyto záznamy jsou zobrazeny pouze adminům. Smazání uživatele odstraní jeho řádky. Odebrání serveru je ponechá, takže server skrytý před někým zůstane skrytý ve své historii a zachovaných zálohách.

Existující instalace fungují beze změny: dokud admin neupraví buňku, každý uživatel má přesně to, co mu jeho role předtím dala.

## Pouze pro adminy a proč

Několik věcí je záměrně omezeno na adminy:

- **Správa uživatelů, úložiště, globální nastavení, API klíče a globální soubory.**
- **[Veřejné API](/docs/public-api/)**: povolení `/api/v1` a vytváření, omezení rozsahu nebo zrušení jeho tokenů typu Bearer pouze pro čtení.
- **Pokročilá Docker přepsání**: vlastní název kontejneru, další publikované porty a připojené svazky (bind mounts). Připojený svazek může mapovat libovolnou cestu hostitele do kontejneru a v kombinaci s přístupem panelu k Dockeru to efektivně znamená práva root na hostiteli. Tato pole se zobrazují pouze adminům.

Vlastní názvy kontejnerů také nemohou žít v rámci panelu `msm-`, takže ručně pojmenovaný kontejner nikdy nemůže zastínit jinou instanci serveru a přesměrovat příkaz stop nebo jiný příkaz na nesprávnou instanci.

## Správa účtů

![Profilový obrázek](/docs/images/profile-picture.png)

Admini mohou vytvářet uživatele, měnit role, resetovat hesla a mazat účty z tabulky Uživatelé. Sloupec **2FA** ukazuje, zda má každý uživatel povolené dvoufaktorové ověřování; admin může resetovat 2FA jiného uživatele pomocí **Resetovat 2FA** v menu akcí daného uživatele (pro případ ztraceného telefonu a záložních kódů), ale nikdy nemůže zakázat své vlastní bez svého hesla, což je řešeno v rámci samoobslužného procesu.

Neúspěšná přihlášení jsou omezena na účet (jak globální počítadlo na IP, tak na účet), aby se zpomalily pokusy o útok hrubou silou, a stejný limit pokrývá i krok s 2FA kódem, takže správné heslo nemůže resetovat počítadlo před hádáním kódu. Před tím je hrubší omezovač požadavků na klienta na koncových bodech přihlášení / 2FA / nastavení, nastavitelný pomocí `RATE_LIMIT_AUTH_PER_15MIN` (výchozí hodnota 100; za reverzním proxy serverem nastavte `TRUST_PROXY`, aby se počítalo podle skutečné IP klienta).
